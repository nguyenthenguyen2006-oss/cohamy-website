import 'server-only';
import {z} from 'zod';
import {database,type Sql} from './db';
import {assertCurrentPrincipal,audit,digest} from './auth';
import {assertPermission,CrmError} from './permissions';
import {deleteAccountSchema} from './account-deletion-contracts';
import type {Principal} from './types';
function admin(user:Principal){assertPermission(user,'accounts.manage');if(user.area!=='crm'||user.role!=='ADMIN')throw new CrmError('FORBIDDEN',403);}
type Member={id:string;organization_id:string;organization_name:string;organization_active:boolean;organization_kind:string;role:string;active:boolean;version:number};
async function snapshot(sql:Sql,id:string,lock=false){
 const account=(await sql.query<{id:string;email:string;display_name:string;active:boolean;deleted_at:string|null}>(`SELECT u.id,u.email,u.display_name,u.active,u.deleted_at FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id WHERE m.id=$1 ${lock?'FOR UPDATE OF u':''}`,[id])).rows[0];
 if(!account)throw new CrmError('NOT_FOUND',404);
 const memberships=(await sql.query<Member>(`SELECT m.id,m.organization_id,o.name AS organization_name,o.active AS organization_active,o.kind AS organization_kind,m.role,m.active,m.version FROM cohamy_crm.memberships m JOIN cohamy_crm.organizations o ON o.id=m.organization_id WHERE m.user_id=$1 ORDER BY m.id ${lock?'FOR UPDATE OF m':''}`,[account.id])).rows;
 const selected=memberships.find(m=>m.id===id);if(!selected)throw new CrmError('NOT_FOUND',404);
 const activeAdmins=Number((await sql.query<{n:string}>("SELECT count(DISTINCT u.id)::text AS n FROM cohamy_crm.users u JOIN cohamy_crm.memberships m ON m.user_id=u.id JOIN cohamy_crm.organizations o ON o.id=m.organization_id WHERE u.active AND u.deleted_at IS NULL AND m.active AND o.active AND o.kind='COHAMY' AND m.role='ADMIN'")).rows[0].n);
 const hasAdmin=account.active&&memberships.some(m=>m.active&&m.organization_active&&m.organization_kind==='COHAMY'&&m.role==='ADMIN');
 return {account,memberships,selected,lastActiveAdmin:hasAdmin&&activeAdmins<=1,fingerprint:digest(JSON.stringify({account,memberships}))};
}
export async function previewAccountDeletion(user:Principal,id:string){
 admin(user);if(!z.uuid().safeParse(id).success)throw new CrmError('NOT_FOUND',404);
 return(await database()).transaction(async sql=>{
  await assertCurrentPrincipal(sql,user);const s=await snapshot(sql,id),self=s.account.id===user.id;
  const sessions=Number((await sql.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.sessions WHERE membership_id IN(SELECT id FROM cohamy_crm.memberships WHERE user_id=$1) AND revoked_at IS NULL AND expires_at>now()',[s.account.id])).rows[0].n);
  const blockedReason=s.account.deleted_at?'ACCOUNT_ALREADY_DELETED':self?'CANNOT_DELETE_SELF':s.lastActiveAdmin?'LAST_ACTIVE_ADMIN':null;
  return {membershipId:id,userId:s.account.id,email:s.account.email,displayName:s.account.display_name,expectedVersion:s.selected.version,previewFingerprint:s.fingerprint,memberships:s.memberships,activeSessions:sessions,canDelete:!blockedReason,blockedReason,retainedBusinessHistory:true,scope:'ALL_MEMBERSHIPS_OF_THIS_IDENTITY'};
 });
}
export async function deleteAccount(user:Principal,id:string,input:unknown):Promise<Record<string,unknown>>{
 admin(user);if(!z.uuid().safeParse(id).success)throw new CrmError('NOT_FOUND',404);const parsed=deleteAccountSchema.safeParse(input);if(!parsed.success)throw new CrmError('INVALID_FIELDS',400);const d=parsed.data,hash=digest(JSON.stringify({action:'DELETE_ACCOUNT',id,...d}));
 return(await database()).transaction(async sql=>{
  // Match the existing account role/lock mutation barrier before holding identity rows.
  await sql.exec('LOCK TABLE cohamy_crm.task_dependencies IN SHARE ROW EXCLUSIVE MODE');await assertCurrentPrincipal(sql,user);
  await sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[user.id+':'+d.idempotencyKey]);
  const prior=(await sql.query<{request_hash:string;result:Record<string,unknown>}>('SELECT request_hash,result FROM cohamy_crm.account_provision_actions WHERE actor_id=$1 AND key=$2',[user.id,d.idempotencyKey])).rows[0];
  if(prior){if(prior.request_hash!==hash)throw new CrmError('IDEMPOTENCY_CONFLICT',409);return prior.result;}
  const s=await snapshot(sql,id,true);
  if(s.account.id===user.id)throw new CrmError('CANNOT_DELETE_SELF',409);
  if(s.account.deleted_at)throw new CrmError('ACCOUNT_ALREADY_DELETED',409);
  if(s.lastActiveAdmin)throw new CrmError('LAST_ACTIVE_ADMIN',409);
  if(s.selected.version!==d.expectedVersion||s.fingerprint!==d.previewFingerprint)throw new CrmError('ACCOUNT_DELETE_PREVIEW_CHANGED',409);
  if(s.account.email.toLowerCase()!==d.confirmEmail)throw new CrmError('ACCOUNT_EMAIL_CONFIRMATION_MISMATCH',400);
  await sql.query('UPDATE cohamy_crm.users SET active=false,deleted_at=now(),deleted_by=$1,deletion_reason=$2 WHERE id=$3',[user.id,d.reason,s.account.id]);
  await sql.query('UPDATE cohamy_crm.memberships SET active=false,version=version+1 WHERE user_id=$1',[s.account.id]);
  await sql.query('UPDATE cohamy_crm.sessions SET revoked_at=now() WHERE membership_id IN(SELECT id FROM cohamy_crm.memberships WHERE user_id=$1) AND revoked_at IS NULL',[s.account.id]);
  await sql.query('UPDATE cohamy_crm.account_invitations SET revoked_at=now() WHERE user_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL',[s.account.id]);
  await sql.query('UPDATE cohamy_crm.password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',[s.account.id]);
  const result={id,userId:s.account.id,email:s.account.email,status:'DELETED',membershipCount:s.memberships.length,retainedBusinessHistory:true};
  await sql.query('INSERT INTO cohamy_crm.account_provision_actions(actor_id,key,request_hash,result) VALUES($1,$2,$3,$4::jsonb)',[user.id,d.idempotencyKey,hash,JSON.stringify(result)]);
  await audit(sql,user.id,'account.deleted',id,{userId:s.account.id,email:s.account.email,membershipIds:s.memberships.map(m=>m.id),reason:d.reason,retainedBusinessHistory:true});return result;
 });
}
