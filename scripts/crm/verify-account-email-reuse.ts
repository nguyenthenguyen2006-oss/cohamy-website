import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {createQaFixture,qaPassword} from './qa-fixture';
import {installQaRuntime} from './qa-runtime';
import {database} from '../../lib/crm/db';
import * as auth from '../../lib/crm/auth';
import * as repository from '../../lib/crm/repository';
import * as provisioning from '../../lib/crm/account-provisioning';
import * as deletion from '../../lib/crm/account-deletion';
import * as security from '../../lib/crm/account-security';
import {invokeOperation} from '../../lib/crm/mcp/bridge';
import {browseData} from '../../lib/crm/mcp/data';

async function main(){
 const postgres=process.env.CRM_DATABASE_MODE==='postgres';
 if(postgres){const url=new URL(process.env.CRM_DATABASE_URL!);assert.equal(process.env.CRM_ENVIRONMENT,'STAGING');assert.ok(['localhost','127.0.0.1'].includes(url.hostname));assert.equal(url.port,'55432');assert.match(url.pathname,/^\/cohamy_qa_email_reuse_[a-z0-9]+$/);}
 else{delete process.env.CRM_DATABASE_URL;process.env.CRM_DATABASE_MODE='pglite';process.env.CRM_ENVIRONMENT='LOCAL';process.env.CRM_LOCAL_DATA_DIR='.local/crm-qa-email-reuse-'+randomUUID();}
 process.env.CRM_EMAIL_ENABLED='false';process.env.CRM_PUBLIC_ORIGIN=postgres?'https://cohamy.vn':'http://localhost:4367';
 const ids=await createQaFixture(),owner=await database(),close=await installQaRuntime(owner),db=await database();
 const admin=(await auth.login('admin@crm-qa.invalid',qaPassword)).user,sales=(await auth.login('sales@crm-qa.invalid',qaPassword)).user;
 const password='Reuse1!'+randomBytes(18).toString('hex'),cases:{name:string;status:string}[]=[];
 const pass=(name:string)=>{cases.push({name,status:'PASS'});console.log('PASS '+name);};let complete=false;
 const input=(email:string,loginMethod:'GENERATED'|'INVITATION'='INVITATION')=>({email,displayName:'QA recreated account',role:'WAREHOUSE_HN' as const,organizationId:admin.organizationId,loginMethod,idempotencyKey:randomUUID()});
 async function remove(id:string){const preview=await deletion.previewAccountDeletion(admin,id);return deletion.deleteAccount(admin,id,{expectedVersion:preview.expectedVersion,previewFingerprint:preview.previewFingerprint,confirmEmail:preview.email,reason:'QA email reuse after approved deletion',idempotencyKey:randomUUID()});}
 async function createDeleted(email:string){const initial=await provisioning.provisionAccount(admin,{...input(email,'GENERATED'),role:'WAREHOUSE_HCM'}),session=await auth.login(email,String(initial.generatedPassword));await remove(String(initial.membershipId));return {initial,session};}
 try{
  const email='reinvite@reuse-qa.invalid',old=await createDeleted(email);
  const oldIdentity=(await owner.query('SELECT * FROM cohamy_crm.users WHERE id=$1',[old.initial.id])).rows[0];
  const oldMemberships=(await owner.query('SELECT * FROM cohamy_crm.memberships WHERE user_id=$1 ORDER BY id',[old.initial.id])).rows;
  const command=input(email.toUpperCase()),created=await provisioning.provisionAccount(admin,command);
  assert.notEqual(created.id,old.initial.id);assert.notEqual(created.membershipId,old.initial.membershipId);assert.equal(created.email,email);assert.equal(created.status,'PENDING_ACTIVATION');
  assert.deepEqual((await owner.query('SELECT * FROM cohamy_crm.users WHERE id=$1',[old.initial.id])).rows[0],oldIdentity);
  assert.deepEqual((await owner.query('SELECT * FROM cohamy_crm.memberships WHERE user_id=$1 ORDER BY id',[old.initial.id])).rows,oldMemberships);
  pass('Deleted email provisions a new identity and membership while the original identity, password and membership history stay byte-equivalent');

  assert.equal(await auth.authenticate(old.session.token),null);await assert.rejects(auth.login(email,String(old.initial.generatedPassword)),/INVALID_CREDENTIALS/);
  assert.equal(await auth.membershipPrincipal(String(old.initial.membershipId)),null);await assert.rejects(repository.setAccountActive(admin,String(old.initial.membershipId),{active:true}),/ACCOUNT_DELETED/);
  await assert.rejects(provisioning.provisionAccount(admin,input(email)),/ACCOUNT_ALREADY_EXISTS/);assert.deepEqual(await provisioning.provisionAccount(admin,command),created);
  pass('Old sessions, old passwords and old memberships remain revoked; a live pending identity still reserves the email and retries do not create a duplicate');

  let token='';await provisioning.issueAccountInvitation(admin,{membershipId:created.membershipId,action:'SEND',idempotencyKey:randomUUID()},async(_email,_subject,body)=>{token=body.match(/token=([A-Za-z0-9_-]{43})/)![1];});
  await provisioning.activateProvisionedAccount({token,password},'reuse-invitation');
  const active=await auth.login(email,password);assert.equal(active.user.id,created.id);assert.equal(active.user.membershipId,created.membershipId);assert.equal(active.user.role,'WAREHOUSE_HN');
  const assignments=(await db.query<{region:string}>('SELECT w.region FROM cohamy_crm.warehouse_assignments a JOIN cohamy_crm.warehouses w ON w.id=a.warehouse_id WHERE a.membership_id=$1',[created.membershipId])).rows;
  assert.ok(assignments.length>0);assert.ok(assignments.every(r=>r.region==='NORTH'));
  pass('A new invitation activates and authenticates the new account in the requested HN role without inheriting the deleted HCM access');

  const reset=await security.requestPasswordReset(email);assert.equal(reset.accepted,true);
  const resets=(await owner.query<{user_id:string}>('SELECT user_id FROM cohamy_crm.password_reset_tokens WHERE user_id=ANY($1::uuid[]) AND used_at IS NULL',[[old.initial.id,created.id]])).rows;
  assert.ok(resets.length);assert.ok(resets.every(r=>r.user_id===created.id));
  pass('Password recovery selects only the new live identity, never the archived row sharing its email');

  await repository.setAccountActive(admin,String(created.membershipId),{active:false});await assert.rejects(provisioning.provisionAccount(admin,input(email)),/ACCOUNT_ALREADY_EXISTS/);await repository.setAccountActive(admin,String(created.membershipId),{active:true});
  await assert.rejects(provisioning.provisionAccount(sales,input('forbidden@reuse-qa.invalid')),/FORBIDDEN/);
  await assert.rejects(provisioning.provisionAccount(admin,{...input('bad-org@reuse-qa.invalid'),organizationId:ids.dealerA}),/ROLE_ORGANIZATION_MISMATCH/);
  pass('Locked accounts retain email ownership; Admin-only and organization boundaries remain enforced');

  const pendingEmail='generated@reuse-qa.invalid',pending=await provisioning.provisionAccount(admin,input(pendingEmail));let retiredToken='';
  await provisioning.issueAccountInvitation(admin,{membershipId:pending.membershipId,action:'SEND',idempotencyKey:randomUUID()},async(_email,_subject,body)=>{retiredToken=body.match(/token=([A-Za-z0-9_-]{43})/)![1];});await remove(String(pending.membershipId));
  const generated=await provisioning.provisionAccount(admin,input(pendingEmail,'GENERATED'));assert.notEqual(generated.id,pending.id);assert.ok(generated.generatedPassword);
  assert.equal((await auth.login(pendingEmail,String(generated.generatedPassword))).user.id,generated.id);
  await assert.rejects(provisioning.activateProvisionedAccount({token:retiredToken,password},'old-invitation'),/ACTIVATION_INVALID_OR_EXPIRED/);
  pass('Generated login also recreates a fresh identity and a deleted account activation link cannot affect it');

  await remove(String(generated.membershipId));const repeated=await provisioning.provisionAccount(admin,input(pendingEmail,'GENERATED'));
  assert.notEqual(repeated.id,generated.id);assert.equal((await auth.login(pendingEmail,String(repeated.generatedPassword))).user.id,repeated.id);
  assert.equal((await owner.query('SELECT id FROM cohamy_crm.users WHERE email=$1',[pendingEmail])).rows.length,3);
  pass('Repeated delete and recreate cycles retain every archived identity and still authenticate the single current account');

  const raceEmail='concurrent@reuse-qa.invalid';await createDeleted(raceEmail);
  const race=await Promise.allSettled([provisioning.provisionAccount(admin,input(raceEmail)),provisioning.provisionAccount(admin,input(raceEmail.toUpperCase()))]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.ok(race.some(r=>r.status==='rejected'&&/ACCOUNT_ALREADY_EXISTS/.test(String(r.reason))));
  assert.equal((await owner.query('SELECT id FROM cohamy_crm.users WHERE email=$1 AND deleted_at IS NULL',[raceEmail])).rows.length,1);
  pass('Concurrent requests for the same deleted email produce exactly one current account, including case normalization');

  const mcpEmail='mcp-reuse@reuse-qa.invalid',mcpOld=await createDeleted(mcpEmail),mcpInput=input(mcpEmail);
  const native=await invokeOperation(admin,{operation:'POST /api/crm/accounts/provision',input:mcpInput},true);assert.equal(native.status,201);
  const replay=await invokeOperation(admin,{operation:'POST /api/crm/accounts/provision',input:mcpInput},true);assert.deepEqual(replay,native);
  const data=await browseData(admin,{table:'users',filters:[{column:'email',op:'eq',value:mcpEmail}],limit:10});
  assert.ok(Array.isArray(data.items));const historyRows=data.items as {id:string;deleted_at:string|null}[];
  assert.equal(data.total,2);assert.ok(historyRows.some(r=>r.id===mcpOld.initial.id&&r.deleted_at));assert.ok(historyRows.some(r=>r.id!==mcpOld.initial.id&&!r.deleted_at));
  assert.ok(!JSON.stringify(data).includes('password_hash'));assert.equal((await repository.listAccounts(admin)).filter(r=>r.email===mcpEmail).length,1);
  pass('MCP provisions and replays the same command, reads both safe history and the new identity, while the current account list excludes the archived one');

  const ui=await createDeleted('browser-reuse@reuse-qa.invalid'),mcp=await createDeleted('browser-mcp-reuse@reuse-qa.invalid');
  const fixture={dataDir:process.env.CRM_LOCAL_DATA_DIR,qaPassword,adminMembershipId:admin.membershipId,organizationId:admin.organizationId,ui:{email:ui.initial.email,oldId:ui.initial.id},mcp:{email:mcp.initial.email,oldId:mcp.initial.id}};
  await fs.mkdir('.local',{recursive:true});await fs.writeFile('.local/email-reuse-qa.json',JSON.stringify(fixture),{mode:0o600});
  assert.ok((await auth.login('admin@crm-qa.invalid',qaPassword)).user);complete=true;
 }finally{
  await fs.mkdir('docs/crm/test-results/account-email-reuse',{recursive:true});
  await fs.writeFile('docs/crm/test-results/account-email-reuse/services-'+(postgres?'staging':'local')+'.json',JSON.stringify({status:complete?'PASS':'FAIL',environment:postgres?'STAGING native PostgreSQL runtime role':'LOCAL isolated PGlite',cases,externalEmails:0,productionAccountWrites:0},null,2)+'\n');
  await close();await owner.close();
 }
}
main().catch(error=>{console.error(error instanceof Error?error.stack:'ACCOUNT_REUSE_QA_FAILED');process.exitCode=1;});
