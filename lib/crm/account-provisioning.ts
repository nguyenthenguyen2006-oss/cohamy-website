import 'server-only';
import {randomBytes,randomUUID} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {audit,assertCurrentPrincipal,digest} from './auth';
import {database,type Sql} from './db';
import {assertPermission,CrmError} from './permissions';
import {roleOrganizationKind,isBuyerRole,type Principal} from './types';
import {provisionAccountSchema,accountInvitationSchema} from './account-provision-contracts';
import {ensureRegionalWarehouseAssignments} from './repository';
import {sendTransactionalEmail} from './brevo';

const activationSchema=z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/u),password:z.string().min(12).max(72).refine(v=>Buffer.byteLength(v,'utf8')<=72&&/[a-z]/.test(v)&&/[A-Z]/.test(v)&&/\d/.test(v)&&/[^A-Za-z0-9]/.test(v),'STRONG_PASSWORD_REQUIRED')}).strict();
const parse=<T>(schema:z.ZodType<T>,value:unknown):T=>{const p=schema.safeParse(value);if(!p.success)throw new CrmError('INVALID_FIELDS',400);return p.data;};
function admin(user:Principal){assertPermission(user,'accounts.manage');if(user.role!=='ADMIN'||user.area!=='crm')throw new CrmError('FORBIDDEN',403);}
async function previous(sql:Sql,user:Principal,key:string,hash:string){
 // Serialize the same idempotency key even when it targets different users.
 await sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[user.id+':'+key]);
 const row=(await sql.query<{request_hash:string;result:Record<string,unknown>}>('SELECT request_hash,result FROM cohamy_crm.account_provision_actions WHERE actor_id=$1 AND key=$2',[user.id,key])).rows[0];
 if(row&&row.request_hash!==hash)throw new CrmError('IDEMPOTENCY_CONFLICT',409);return row?.result;
}
async function remember(sql:Sql,user:Principal,key:string,hash:string,result:unknown){await sql.query('INSERT INTO cohamy_crm.account_provision_actions(actor_id,key,request_hash,result) VALUES($1,$2,$3,$4::jsonb)',[user.id,key,hash,JSON.stringify(result)]);}
export async function provisionAccount(user:Principal,input:unknown,demo=false):Promise<Record<string,unknown>>{
 admin(user);const d=parse(provisionAccountSchema,input),{loginMethod,...legacyInput}=d,hash=digest(JSON.stringify({action:'PROVISION',...(loginMethod==='GENERATED'?d:legacyInput)}));
 if(demo&&!['LOCAL','STAGING'].includes(process.env.CRM_ENVIRONMENT??''))throw new CrmError('DEMO_PROVISION_FORBIDDEN',403);
 // Explicit GENERATED mode returns a new random credential once. Never persist
 // its plaintext in receipts/audit or change a pre-existing account's credential.
 const generatedPassword=loginMethod==='GENERATED'?'A7!z'+randomBytes(24).toString('base64url'):undefined;
 const passwordHash=await bcrypt.hash(generatedPassword??randomBytes(48).toString('base64url'),12);
 return(await database()).transaction(async sql=>{
  await sql.exec('LOCK TABLE cohamy_crm.task_dependencies IN SHARE ROW EXCLUSIVE MODE');await assertCurrentPrincipal(sql,user);const old=await previous(sql,user,d.idempotencyKey,hash);if(old)return old;
  const org=(await sql.query<{kind:string;active:boolean}>('SELECT kind,active FROM cohamy_crm.organizations WHERE id=$1 FOR UPDATE',[d.organizationId])).rows[0];
  if(!org?.active||org.kind!==roleOrganizationKind(d.role))throw new CrmError('ROLE_ORGANIZATION_MISMATCH',400);
  if(isBuyerRole(d.role)&&(await sql.query("SELECT id FROM cohamy_crm.memberships WHERE organization_id=$1 AND role IN('CUSTOMER','SUPERMARKET') AND role<>$2 AND active",[d.organizationId,d.role])).rows.length)throw new CrmError('BUYER_ROLE_CONFLICT',409);
  if((await sql.query('SELECT id FROM cohamy_crm.users WHERE lower(email)=$1 AND deleted_at IS NULL',[d.email])).rows.length)throw new CrmError('ACCOUNT_ALREADY_EXISTS',409);
  const id=randomUUID(),membershipId=randomUUID();
  const status=generatedPassword?'ACTIVE':'PENDING_ACTIVATION';
  await sql.query("INSERT INTO cohamy_crm.users(id,email,display_name,password_hash,activation_status,activated_at,is_demo) VALUES($1,$2,$3,$4,$5,CASE WHEN $5='ACTIVE' THEN now() ELSE NULL END,$6)",[id,d.email,d.displayName,passwordHash,status,demo]);
  await sql.query('INSERT INTO cohamy_crm.memberships(id,user_id,organization_id,role) VALUES($1,$2,$3,$4)',[membershipId,id,d.organizationId,d.role]);
  await ensureRegionalWarehouseAssignments(sql,d.organizationId,membershipId,d.role);
  const result={id,membershipId,email:d.email,displayName:d.displayName,role:d.role,organizationId:d.organizationId,status,...(generatedPassword?{loginMethod:'GENERATED',initialLoginIssued:true,loginPath:isBuyerRole(d.role)?'/portal/login':'/crm/login'}:{})};
  await remember(sql,user,d.idempotencyKey,hash,result);await audit(sql,user.id,'account.provisioned',membershipId,{userId:id,email:d.email,role:d.role,organizationId:d.organizationId,loginMethod});
  return generatedPassword?{...result,generatedPassword}:result;
 });
}
export type ActivationMailer=(email:string,subject:string,body:string,idempotencyKey:string)=>Promise<unknown>;
function activationOrigin(){
 let url:URL;try{url=new URL(process.env.CRM_PUBLIC_ORIGIN??'');}catch{throw new CrmError('CRM_HTTPS_ORIGIN_REQUIRED',503);}
 const local=process.env.CRM_ENVIRONMENT==='LOCAL'&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname);
 if((!local&&url.protocol!=='https:')||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new CrmError('CRM_HTTPS_ORIGIN_REQUIRED',503);return url.origin;
}
export async function issueAccountInvitation(user:Principal,input:unknown,mailer:ActivationMailer=sendTransactionalEmail):Promise<Record<string,unknown>>{
 admin(user);const d=parse(accountInvitationSchema,input),hash=digest(JSON.stringify(d)),origin=d.action==='REVOKE'?'':activationOrigin(),db=await database();
 const prepared=await db.transaction(async sql=>{
  await sql.exec('LOCK TABLE cohamy_crm.task_dependencies IN SHARE ROW EXCLUSIVE MODE');await assertCurrentPrincipal(sql,user);const old=await previous(sql,user,d.idempotencyKey,hash);if(old)return {result:old};
  const m=(await sql.query<{user_id:string;email:string;activation_status:string;active:boolean;kind:string;role:string;deleted_at:string|null}>(`SELECT m.user_id,u.email,u.activation_status,u.deleted_at,(u.active AND m.active AND o.active) AS active,o.kind,m.role
   FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id JOIN cohamy_crm.organizations o ON o.id=m.organization_id WHERE m.id=$1 FOR UPDATE OF u,m,o`,[d.membershipId])).rows[0];
  if(!m)throw new CrmError('NOT_FOUND',404);if(m.deleted_at)throw new CrmError('ACCOUNT_DELETED',409);if(m.activation_status!=='PENDING_ACTIVATION')throw new CrmError('ACCOUNT_ALREADY_ACTIVE',409);
  if(d.action!=='REVOKE'&&(!m.active||m.kind!==roleOrganizationKind(m.role)))throw new CrmError('ACCOUNT_DISABLED',409);
  if(d.action==='REVOKE'){
   await sql.query('UPDATE cohamy_crm.account_invitations SET revoked_at=now() WHERE user_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL',[m.user_id]);
   const result={membershipId:d.membershipId,status:'REVOKED'};await remember(sql,user,d.idempotencyKey,hash,result);await audit(sql,user.id,'account.invitation-revoked',d.membershipId);return {result};
  }
  const latest=(await sql.query<{created_at:string}>('SELECT created_at FROM cohamy_crm.account_invitations WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',[m.user_id])).rows[0];
  if(d.action==='SEND'&&latest)throw new CrmError('INVITATION_EXISTS_USE_RESEND',409);
  if(latest&&Date.now()-new Date(latest.created_at).getTime()<60000)throw new CrmError('INVITATION_RATE_LIMITED',429);
  await sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['invitation-rate:'+user.id]);
  const count=(await sql.query<{n:string}>("SELECT count(*)::text AS n FROM cohamy_crm.account_invitations WHERE created_at>now()-interval '1 hour' AND (created_by=$1 OR user_id=$2)",[user.id,m.user_id])).rows[0];
  if(Number(count.n)>=30)throw new CrmError('INVITATION_RATE_LIMITED',429);
  const perUser=(await sql.query<{n:string}>("SELECT count(*)::text AS n FROM cohamy_crm.account_invitations WHERE created_at>now()-interval '1 hour' AND user_id=$1",[m.user_id])).rows[0];if(Number(perUser.n)>=5)throw new CrmError('INVITATION_RATE_LIMITED',429);
  await sql.query('UPDATE cohamy_crm.account_invitations SET revoked_at=now() WHERE user_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL',[m.user_id]);
  const token=randomBytes(32).toString('base64url'),id=randomUUID(),expiresAt=new Date(Date.now()+86400000).toISOString();
  await sql.query('INSERT INTO cohamy_crm.account_invitations(id,user_id,membership_id,token_hash,expires_at,created_by) VALUES($1,$2,$3,$4,$5,$6)',[id,m.user_id,d.membershipId,digest(token),expiresAt,user.id]);
  const result={invitationId:id,membershipId:d.membershipId,expiresAt,status:'PENDING'};await remember(sql,user,d.idempotencyKey,hash,result);await audit(sql,user.id,'account.invitation-issued',d.membershipId,{invitationId:id,expiresAt});return {result,email:m.email,token};
 });
 if('token' in prepared&&prepared.token){
  let status='SENT';try{await mailer(prepared.email!,'Cohamy · Kích hoạt tài khoản',`Bạn được cấp tài khoản Cohamy. Mở liên kết sau trong 24 giờ để tự đặt mật khẩu:\n${origin}/crm/activate#token=${prepared.token}\n\nLiên kết chỉ dùng một lần. Cohamy không gửi mật khẩu qua email. Nếu không nhận ra lời mời, hãy bỏ qua email này.`,String(prepared.result.invitationId));}
  catch{status='UNKNOWN';}
  await db.transaction(async sql=>{await sql.query('UPDATE cohamy_crm.account_invitations SET delivery_status=$1 WHERE id=$2',[status,prepared.result.invitationId]);await audit(sql,user.id,status==='SENT'?'account.invitation-sent':'account.invitation-delivery-unknown',d.membershipId,{invitationId:prepared.result.invitationId});});
 }
 // Replays return the latest delivery state without issuing or re-sending a secret.
 if('invitationId' in prepared.result&&prepared.result.invitationId){const row=(await db.query<{delivery_status:string}>('SELECT delivery_status FROM cohamy_crm.account_invitations WHERE id=$1',[prepared.result.invitationId])).rows[0];return {...prepared.result,status:row.delivery_status};}return prepared.result;
}
export async function activateProvisionedAccount(input:unknown,clientKey:string){
 const db=await database();
 // Committed outside the token transaction: failed attempts cannot roll back the limiter.
 const limited=await db.query<{attempts:number}>(`INSERT INTO cohamy_crm.account_activation_attempts(key_hash,attempts) VALUES($1,1)
  ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN cohamy_crm.account_activation_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE cohamy_crm.account_activation_attempts.attempts+1 END,
  window_start=CASE WHEN cohamy_crm.account_activation_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE cohamy_crm.account_activation_attempts.window_start END RETURNING attempts`,[digest('activation:'+clientKey)]);
 if(limited.rows[0].attempts>15)throw new CrmError('ACTIVATION_RATE_LIMITED',429);
 const d=parse(activationSchema,input),passwordHash=await bcrypt.hash(d.password,12);
 return db.transaction(async sql=>{
  const hint=(await sql.query<{user_id:string}>('SELECT user_id FROM cohamy_crm.account_invitations WHERE token_hash=$1',[digest(d.token)])).rows[0];if(!hint)throw new CrmError('ACTIVATION_INVALID_OR_EXPIRED',400);
  // Match invitation issuance lock order. Disabling an identity also prevents activation.
  const account=(await sql.query<{activation_status:string;active:boolean}>('SELECT activation_status,active FROM cohamy_crm.users WHERE id=$1 FOR UPDATE',[hint.user_id])).rows[0];
  const invitation=(await sql.query<{id:string;membership_id:string}>(`SELECT i.id,i.membership_id FROM cohamy_crm.account_invitations i JOIN cohamy_crm.memberships m ON m.id=i.membership_id JOIN cohamy_crm.organizations o ON o.id=m.organization_id
   WHERE i.token_hash=$1 AND i.expires_at>now() AND i.consumed_at IS NULL AND i.revoked_at IS NULL AND i.delivery_status='SENT' AND m.active AND o.active FOR UPDATE OF i,m`,[digest(d.token)])).rows[0];
  if(!account?.active||account.activation_status!=='PENDING_ACTIVATION'||!invitation)throw new CrmError('ACTIVATION_INVALID_OR_EXPIRED',400);
  await sql.query("UPDATE cohamy_crm.users SET password_hash=$1,activation_status='ACTIVE',activated_at=now() WHERE id=$2",[passwordHash,hint.user_id]);
  await sql.query('UPDATE cohamy_crm.account_invitations SET consumed_at=now() WHERE id=$1',[invitation.id]);
  await sql.query('UPDATE cohamy_crm.account_invitations SET revoked_at=now() WHERE user_id=$1 AND id<>$2 AND revoked_at IS NULL AND consumed_at IS NULL',[hint.user_id,invitation.id]);
  await sql.query('UPDATE cohamy_crm.password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',[hint.user_id]);
  await sql.query('UPDATE cohamy_crm.sessions SET revoked_at=now() WHERE membership_id IN(SELECT id FROM cohamy_crm.memberships WHERE user_id=$1) AND revoked_at IS NULL',[hint.user_id]);
  await audit(sql,hint.user_id,'account.activated',invitation.membership_id);return {activated:true};
 });
}
export async function accountActivationHistory(user:Principal,membershipId:string){
 admin(user);if(!z.uuid().safeParse(membershipId).success)throw new CrmError('NOT_FOUND',404);
 return(await database()).transaction(async sql=>{await assertCurrentPrincipal(sql,user);
 const account=(await sql.query<{user_id:string}>('SELECT user_id FROM cohamy_crm.memberships WHERE id=$1',[membershipId])).rows[0];if(!account)throw new CrmError('NOT_FOUND',404);
 const invitations=(await sql.query('SELECT id,expires_at,consumed_at,revoked_at,delivery_status,created_at FROM cohamy_crm.account_invitations WHERE membership_id=$1 ORDER BY created_at DESC,id LIMIT 50',[membershipId])).rows;
 const events=(await sql.query("SELECT id,action,created_at,payload FROM cohamy_crm.audit_events WHERE entity_id IN($1,$2) AND action LIKE 'account.%' ORDER BY created_at DESC,id LIMIT 100",[membershipId,account.user_id])).rows;
 return {invitations,events,limit:100};
 });
}
