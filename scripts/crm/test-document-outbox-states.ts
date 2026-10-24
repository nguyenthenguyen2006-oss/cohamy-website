import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import type {DocumentEmail} from '../../lib/crm/brevo';
import type {MailFile} from '../../lib/crm/document-mail-model';

process.env.CRM_DATABASE_MODE='pglite';
process.env.CRM_ENVIRONMENT='LOCAL';
process.env.CRM_LOCAL_DATA_DIR='.local/crm-qa-outbox-states-'+randomUUID();
process.env.CRM_DATABASE_URL='';
process.env.CRM_EMAIL_ENABLED='false';
process.env.CRM_QA_DOCUMENT_MAIL='false';
process.env.CRM_BREVO_API_KEY='';
process.env.CRM_BREVO_SENDER_EMAIL='';
const checks:{test:string;status:string;error?:string}[]=[],evidence:Record<string,unknown>={};
const originalFetch=globalThis.fetch;let networkAttempts=0;
globalThis.fetch=async()=>{networkAttempts++;throw Error('OUTBOX_QA_EXTERNAL_NETWORK_DISABLED');};
type Job={id:string;entity_id:string;status:string;attempts:number;last_error:string;message_id:string|null;claim_token:string|null;parent_job_id:string|null;files:MailFile[];delay:string};
const recipients={to:['to@outbox-qa.invalid'],cc:['cc@outbox-qa.invalid'],bcc:['bcc@outbox-qa.invalid']};
const allRecipients=[...recipients.to,...recipients.cc,...recipients.bcc];
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
async function test(name:string,fn:()=>Promise<void>){try{await fn();checks.push({test:name,status:'PASS'});console.log('PASS '+name);}catch(error){checks.push({test:name,status:'FAIL',error:error instanceof Error?error.message:String(error)});throw error;}}

async function main(){
 const {createQaFixture,qaPassword}=await import('./qa-fixture'),{database}=await import('../../lib/crm/db'),auth=await import('../../lib/crm/auth'),repo=await import('../../lib/crm/repository'),flow=await import('../../lib/crm/document-flow'),mail=await import('../../lib/crm/document-mail'),{CrmError}=await import('../../lib/crm/permissions'),fixture=await import('./pricing-fixture');
 await createQaFixture();const db=await database(),admin=(await auth.login('admin@crm-qa.invalid',qaPassword)).user;
 await repo.createAccount(admin,{email:'factory-outbox@crm-qa.invalid',role:'FACTORY',displayName:'LOCAL QA · Nhà máy hộp thư',password:qaPassword,organizationId:admin.organizationId});
 const factory=(await auth.login('factory-outbox@crm-qa.invalid',qaPassword)).user,warehouse=await repo.createWarehouse(admin,{code:'QA_OUTBOX_HN',name:'LOCAL QA · Kho hộp thư HN',organizationId:admin.organizationId,region:'NORTH'});
 const productId=(await fixture.createPriceProducts(admin))[0];assert.ok(warehouse.id);
 const job=async(id:string)=>(await db.query<Job>("SELECT *,EXTRACT(EPOCH FROM available_at-updated_at)::text AS delay FROM cohamy_crm.document_mail_outbox WHERE id=$1",[id])).rows[0];
 const due=async(id:string)=>{await db.query("UPDATE cohamy_crm.document_mail_outbox SET available_at=now()-interval '1 second' WHERE id=$1",[id]);};
 const validate=async(input:DocumentEmail)=>{assert.deepEqual(input.recipients,recipients);assert.equal(input.attachments.length,1);const saved=await job(input.jobId),attachment=input.attachments[0],bytes=Buffer.from(attachment.content,'base64');assert.equal(attachment.name,saved.files[0].filename);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.equal(hash(bytes),saved.files[0].checksum);};
 const makeJob=async()=>{
  const source=await flow.saveFlowDocument(admin,{kind:'REQUEST',warehouseId:warehouse.id,factoryMembershipId:factory.membershipId,lines:[{productId,quantity:'10'}],confirm:true,idempotencyKey:randomUUID()});
  const jobs=(await db.query<Job>('SELECT * FROM cohamy_crm.document_mail_outbox WHERE entity_id=$1',[source.id])).rows;assert.equal(jobs.length,1);assert.equal(jobs[0].status,'PENDING');assert.equal(jobs[0].attempts,0);return jobs[0];
 };
 const accepted=async()=>{const j=await makeJob(),messageId='<outbox-qa-'+randomUUID()+'>';await mail.runDocumentMailOutbox(async input=>{assert.equal(input.jobId,j.id);await validate(input);return messageId;});assert.equal((await job(j.id)).status,'ACCEPTED');return {...j,messageId};};
 const webhook=(messageId:string,email:string,event:string,ts:number)=>mail.receiveBrevoWebhook({'message-id':messageId,email,event,ts_event:ts});
 try{
  await test('Real Admin rule and confirmed request enqueue exactly one archived PDF job',async()=>{
   const rule=await mail.saveMailRule(admin,{event:'factory.request.sent',warehouseId:warehouse.id,factoryMembershipId:factory.membershipId,enabled:true,recipients,subject:'{{code}} · LOCAL QA',body:'{{type}} {{warehouse}} {{factory}} {{revision}}',attachments:'EVENT',version:0});
   const rules=(await mail.mailSettings(admin)).rules;assert.equal(rules.length,1);assert.equal(rules[0].id,rule.id);
   const j=await accepted();evidence.sourceJob=j.id;evidence.sourceDocument=j.entity_id;
  });
  await test('Stale SENDING becomes UNKNOWN without provider call; only audited explicit resend creates a child',async()=>{
   const j=await makeJob();await db.query("UPDATE cohamy_crm.document_mail_outbox SET status='SENDING',attempts=1,claim_token=$2,claimed_at=now()-interval '3 minutes' WHERE id=$1",[j.id,randomUUID()]);
   let calls=0;const fake=async(input:DocumentEmail)=>{calls++;await validate(input);return '<crash-child-'+randomUUID()+'>';};
   assert.deepEqual(await mail.runDocumentMailOutbox(fake),{processed:0,accepted:0,failed:0});const stale=await job(j.id);assert.equal(stale.status,'UNKNOWN');assert.equal(stale.last_error,'WORKER_CRASH_RESULT_UNKNOWN');assert.equal(stale.attempts,1);assert.equal(stale.claim_token,null);
   await due(j.id);await mail.runDocumentMailOutbox(fake);assert.equal(calls,0);
   await assert.rejects(mail.retryDocumentMail(admin,{id:j.id,reason:'QA implicit resend is denied'}),/MAIL_EXPLICIT_RESEND_REQUIRED/);
   const child=await mail.retryDocumentMail(admin,{id:j.id,reason:'QA explicit resend after independent provider check',resend:true});
   assert.equal((await job(child.id)).parent_job_id,j.id);assert.equal((await job(j.id)).status,'UNKNOWN');await mail.runDocumentMailOutbox(fake);assert.equal(calls,1);assert.equal((await job(child.id)).status,'ACCEPTED');
   const audit=(await db.query<{payload:{jobId:string;newJobId:string;explicitResend:boolean}}>("SELECT payload FROM cohamy_crm.audit_events WHERE action='document-mail.manual-retry' AND payload->>'newJobId'=$1",[child.id])).rows[0];assert.equal(audit.payload.jobId,j.id);assert.equal(audit.payload.explicitResend,true);evidence.crashRecovery={parent:j.id,child:child.id,status:(await job(j.id)).status};
  });
  await test('429 and 5xx classifier uses exponential backoff, respects due time and exhausts at five attempts',async()=>{
   const j=await makeJob(),history:unknown[]=[];let calls=0;
   const fake=async(input:DocumentEmail)=>{calls++;assert.equal(input.jobId,j.id);await validate(input);throw new CrmError(calls%2?'EMAIL_RATE_LIMITED':'EMAIL_PROVIDER_UNAVAILABLE',calls%2?429:503);};
   for(let attempt=1;attempt<=5;attempt++){
    await mail.runDocumentMailOutbox(fake);const current=await job(j.id);assert.equal(current.attempts,attempt);assert.equal(current.status,attempt<5?'RETRY':'FAILED');assert.equal(Number(current.delay),Math.min(3600,30*2**attempt));history.push({attempt,status:current.status,error:current.last_error,backoffSeconds:Number(current.delay)});
    assert.deepEqual(await mail.runDocumentMailOutbox(fake),{processed:0,accepted:0,failed:0});assert.equal(calls,attempt);if(attempt<5)await due(j.id);
   }
   await due(j.id);await mail.runDocumentMailOutbox(fake);assert.equal(calls,5);evidence.retryHistory=history;
  });
  await test('Permanent provider failure stops immediately and never auto retries',async()=>{
   const j=await makeJob();let calls=0;const fake=async(input:DocumentEmail)=>{calls++;await validate(input);throw new CrmError('EMAIL_PERMANENT_FAILURE',503);};
   await mail.runDocumentMailOutbox(fake);const failed=await job(j.id);assert.equal(failed.status,'FAILED');assert.equal(failed.attempts,1);assert.equal(failed.last_error,'EMAIL_PERMANENT_FAILURE');await due(j.id);await mail.runDocumentMailOutbox(fake);assert.equal(calls,1);
  });
  await test('Missing configuration, disabled email and unavailable file defer without spending attempt budget',async()=>{
   const j=await makeJob(),history:unknown[]=[];
   for(const code of ['EMAIL_NOT_CONFIGURED','EMAIL_DISABLED','BREVO_ENCRYPTION_NOT_CONFIGURED','BREVO_SECRET_UNREADABLE','BREVO_SETTINGS_UNAVAILABLE']){await mail.runDocumentMailOutbox(async input=>{await validate(input);throw new CrmError(code,503);});const current=await job(j.id);assert.equal(current.status,'DEFERRED');assert.equal(current.attempts,0);assert.equal(current.last_error,code);history.push({code,attempts:current.attempts});await due(j.id);}
   await db.query('UPDATE cohamy_crm.document_mail_outbox SET files=$1::jsonb WHERE id=$2',[JSON.stringify([{...j.files[0],id:randomUUID()}]),j.id]);let calls=0;
   await mail.runDocumentMailOutbox(async()=>{calls++;return 'must-not-be-called';});let current=await job(j.id);assert.equal(calls,0);assert.equal(current.status,'DEFERRED');assert.equal(current.attempts,0);assert.equal(current.last_error,'MAIL_FILE_NOT_READY');history.push({code:current.last_error,attempts:current.attempts});
   await db.query('UPDATE cohamy_crm.document_mail_outbox SET files=$1::jsonb WHERE id=$2',[JSON.stringify(j.files),j.id]);await due(j.id);
   await mail.runDocumentMailOutbox(async input=>{calls++;await validate(input);return '<qa-restored-file>';});current=await job(j.id);assert.equal(current.status,'ACCEPTED');assert.equal(current.attempts,1);assert.equal(calls,1);evidence.deferredBudget=history;
  });
  await test('Hard bounce of one recipient makes the whole job BOUNCED; duplicate and older delivery cannot overwrite it',async()=>{
   const j=await accepted(),ts=Math.floor(Date.now()/1000)-20;
   await webhook(j.messageId,recipients.to[0],'delivered',ts);await webhook(j.messageId,recipients.cc[0],'delivered',ts);await webhook(j.messageId,recipients.bcc[0],'hard_bounce',ts+5);assert.equal((await job(j.id)).status,'BOUNCED');
   await webhook(j.messageId,recipients.bcc[0],'delivered',ts);assert.equal((await job(j.id)).status,'BOUNCED');
   assert.deepEqual(await webhook(j.messageId,recipients.bcc[0],'hard_bounce',ts+5),{duplicate:true});assert.equal((await job(j.id)).status,'BOUNCED');assert.equal((await job(j.id)).attempts,1);
  });
  await test('Soft bounce defers provider status; only all recipients delivered completes and older/tied events cannot regress it',async()=>{
   const j=await accepted(),ts=Math.floor(Date.now()/1000)-20;
   await webhook(j.messageId,recipients.cc[0],'soft_bounce',ts+5);assert.equal((await job(j.id)).status,'PROVIDER_DEFERRED');
   await webhook(j.messageId,recipients.cc[0],'hard_bounce',ts);assert.equal((await job(j.id)).status,'PROVIDER_DEFERRED');
   await webhook(j.messageId,recipients.cc[0],'delivered',ts+10);assert.equal((await job(j.id)).status,'ACCEPTED');
   for(const email of [recipients.to[0],recipients.bcc[0]])await webhook(j.messageId,email,'delivered',ts+10);assert.equal((await job(j.id)).status,'DELIVERED');
   await webhook(j.messageId,recipients.to[0],'deferred',ts+5);await webhook(j.messageId,recipients.cc[0],'soft_bounce',ts+10);assert.equal((await job(j.id)).status,'DELIVERED');assert.equal((await job(j.id)).attempts,1);
  });
  await test('Webhook arriving before provider API response is reconciled after message id is stored',async()=>{
   const j=await makeJob(),messageId='<qa-early-'+randomUUID()+'>',ts=Math.floor(Date.now()/1000)-5;let calls=0;
   await mail.runDocumentMailOutbox(async input=>{calls++;await validate(input);assert.equal((await job(j.id)).status,'SENDING');assert.equal((await job(j.id)).message_id,null);for(const email of allRecipients)await webhook(messageId,email,'delivered',ts);assert.equal((await job(j.id)).status,'SENDING');return messageId;});
   const current=await job(j.id);assert.equal(calls,1);assert.equal(current.status,'DELIVERED');assert.equal(current.message_id,messageId);assert.equal(current.attempts,1);evidence.earlyWebhook={jobId:j.id,status:current.status,recipients:allRecipients.length};
  });
  await test('Unknown provider result is terminal for automatic worker execution',async()=>{
   const j=await makeJob();let calls=0;const fake=async(input:DocumentEmail)=>{calls++;await validate(input);throw Error('QA connection interrupted after request write');};await mail.runDocumentMailOutbox(fake);const current=await job(j.id);assert.equal(current.status,'UNKNOWN');assert.equal(current.last_error,'EMAIL_RESULT_UNKNOWN');assert.equal(current.attempts,1);await due(j.id);await mail.runDocumentMailOutbox(fake);assert.equal(calls,1);
  });
  await test('No external network call occurred and every queued attachment still matches its archive',async()=>{
   assert.equal(networkAttempts,0);for(const row of(await db.query<Job>('SELECT * FROM cohamy_crm.document_mail_outbox')).rows)await mail.mailFiles(db,row.files);
   evidence.finalStates=(await db.query("SELECT status,count(*)::text AS jobs FROM cohamy_crm.document_mail_outbox GROUP BY status ORDER BY status")).rows;
  });
 }finally{
  await fs.mkdir('docs/crm/test-results/document-flow',{recursive:true});await fs.writeFile('docs/crm/test-results/document-flow/outbox-states-pglite.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'LOCAL fresh isolated PGlite',dataDir:process.env.CRM_LOCAL_DATA_DIR,provider:'INJECTED FAKE ONLY; real Brevo configuration cleared; external fetch blocked',networkAttempts,status:checks.length===10&&checks.every(c=>c.status==='PASS')?'PASS':'FAIL',checks,evidence},null,2));await db.close();globalThis.fetch=originalFetch;
 }
}
main().catch(error=>{globalThis.fetch=originalFetch;console.error(error instanceof Error?error.stack??error.message:String(error));process.exitCode=1;});
