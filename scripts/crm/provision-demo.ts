import {randomUUID} from 'node:crypto';
import {database} from '../../lib/crm/db';
import {migrate} from '../../lib/crm/bootstrap';
import {membershipPrincipal,audit} from '../../lib/crm/auth';
import {provisionAccount} from '../../lib/crm/account-provisioning';
import {setAccountActive} from '../../lib/crm/repository';
import type {Role} from '../../lib/crm/types';
// No default password, activation token, or real email delivery. Refuse production
// even when this script is copied into a deployed source tree.
export async function seedProvisionDemos(adminMembershipId:string,cleanup=false){
 const local=process.env.CRM_ENVIRONMENT==='LOCAL'&&process.env.CRM_DATABASE_MODE==='pglite'&&/^\.local[/\\]crm[^/\\]*qa[^/\\]*$/u.test(process.env.CRM_LOCAL_DATA_DIR??'');
 let staging=false;try{const u=new URL(process.env.CRM_DATABASE_URL??'');staging=process.env.CRM_ENVIRONMENT==='STAGING'&&process.env.CRM_DATABASE_MODE==='postgres'&&['localhost','127.0.0.1'].includes(u.hostname)&&u.port==='55432'&&/^\/cohamy_qa_[a-z0-9_]+$/.test(u.pathname);}catch{}
 if(!local&&!staging)throw Error('DEMO_PROVISION_REQUIRES_ISOLATED_QA_DATABASE');
 await migrate();const db=await database(),admin=await membershipPrincipal(adminMembershipId);if(!admin||admin.role!=='ADMIN')throw Error('ADMIN_REQUIRED');
 const items=[];for(const role of ['ADMIN','FACTORY','SALES','ACCOUNTANT','CUSTOMER','SUPERMARKET'] as Role[]){
  const email='demo_'+role.toLowerCase()+'@cohamy-demo.invalid';
  const existing=(await db.query<{id:string;is_demo:boolean}>('SELECT m.id,u.is_demo FROM cohamy_crm.users u JOIN cohamy_crm.memberships m ON m.user_id=u.id WHERE u.email=$1',[email])).rows[0];
  if(existing&&!existing.is_demo)throw Error('DEMO_EMAIL_COLLIDES_WITH_NON_DEMO_ACCOUNT');
  if(cleanup){if(existing){await setAccountActive(admin,existing.id,{active:false});await db.query('UPDATE cohamy_crm.account_invitations SET revoked_at=now() WHERE membership_id=$1 AND revoked_at IS NULL AND consumed_at IS NULL',[existing.id]);}continue;}
  if(existing){items.push({role,membershipId:existing.id,reused:true});continue;}
  let organizationId=admin.organizationId;
  if(['CUSTOMER','SUPERMARKET'].includes(role)){
   const code='DEMO_'+role,org=(await db.query<{id:string;is_demo:boolean}>('SELECT id,is_demo FROM cohamy_crm.organizations WHERE code=$1',[code])).rows[0];
   if(org&&!org.is_demo)throw Error('DEMO_ORGANIZATION_COLLISION');organizationId=org?.id??randomUUID();
   if(!org)await db.query("INSERT INTO cohamy_crm.organizations(id,code,name,kind,is_demo) VALUES($1,$2,$3,'CUSTOMER',true)",[organizationId,code,code]);
  }
  const created=await provisionAccount(admin,{email,displayName:'DEMO_'+role,role,organizationId,idempotencyKey:randomUUID()},true);
  items.push({role,membershipId:created.membershipId,reused:false});
 }
 if(cleanup)await audit(db,admin.id,'account.demo-cleaned',adminMembershipId,{mode:'disable-only',scope:'six reserved demo emails',businessDataDeleted:false});
 return {mode:cleanup?'DISABLED':'SEEDED_PENDING_ACTIVATION',items,externalEmails:0,passwordsIssued:0};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/provision-demo.ts')){seedProvisionDemos(process.argv[2],process.argv.includes('--cleanup')).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e instanceof Error?e.message:'DEMO_PROVISION_FAILED');process.exitCode=1;}).finally(async()=>{await(await database()).close();});}
