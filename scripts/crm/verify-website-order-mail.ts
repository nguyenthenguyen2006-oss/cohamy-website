import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createQaFixture} from './qa-fixture';
import {installQaRuntime} from './qa-runtime';
import {instrumentDocumentMailQa} from './qa-document-mail';
import {database,type Sql,type Database} from '../../lib/crm/db';
import {digest} from '../../lib/crm/auth';
import {enqueueWebsiteOrderReceived} from '../../lib/crm/website-order-notifications';
import {WEBSITE_ORDER_MAIL_EVENT} from '../../lib/crm/website-order-mail-event';
import {runDocumentMailOutbox,receiveBrevoWebhook} from '../../lib/crm/document-mail';
import type {DocumentEmail} from '../../lib/crm/brevo';
import {CrmError} from '../../lib/crm/permissions';

const expectedRecipients={to:['kangminamhd@gmail.com','nguyenptkthd@gmail.com'],cc:[],bcc:[]};
type Rule={id:string;enabled:boolean;recipients:typeof expectedRecipients;subject:string;body:string;version:number};
type Job={id:string;event:string;event_key:string;entity_id:string;rule_id:string;status:string;recipients:typeof expectedRecipients;subject:string;body:string;files:unknown[];attempts:number;last_error:string};

async function main(){
  const postgres=process.env.CRM_DATABASE_MODE==='postgres';
  if(postgres){
    const target=new URL(process.env.CRM_DATABASE_URL??'');
    assert.equal(process.env.CRM_ENVIRONMENT,'STAGING');
    assert.ok(['localhost','127.0.0.1'].includes(target.hostname));assert.equal(target.port,'55432');
    assert.match(target.pathname,/^\/cohamy_qa_[a-z0-9_]+$/);
  }else{
    delete process.env.CRM_DATABASE_URL;process.env.CRM_DATABASE_MODE='pglite';process.env.CRM_ENVIRONMENT='LOCAL';
    process.env.CRM_LOCAL_DATA_DIR='.local/crm-qa-website-mail-'+randomUUID();
  }
  delete process.env.CRM_QA_DOCUMENT_MAIL;
  process.env.CRM_EMAIL_ENABLED='false';process.env.CRM_PUBLIC_ORIGIN='https://online-mail-qa.invalid';
  const fixture=await createQaFixture(),owner=await database(),close=await installQaRuntime(owner),db=await database();
  const cases:{name:string;status:string}[]=[],providerCalls:DocumentEmail[]=[];
  let complete=false;
  const test=async(name:string,run:()=>Promise<void>)=>{await run();cases.push({name,status:'PASS'});console.log('PASS '+name);};
  const jobs=async(id:string)=>(await db.query<Job>('SELECT * FROM cohamy_crm.document_mail_outbox WHERE event=$1 AND entity_id=$2 ORDER BY id',[WEBSITE_ORDER_MAIL_EVENT,id])).rows;
  const rule=async()=>(await db.query<Rule>('SELECT id,enabled,recipients,subject,body,version FROM cohamy_crm.document_mail_rules WHERE event=$1 AND warehouse_id IS NULL AND factory_membership_id IS NULL',[WEBSITE_ORDER_MAIL_EVENT])).rows[0];
  async function insertOrder(sql:Sql,id=randomUUID()){
    const code='QA-WEB-MAIL-'+id.slice(0,8);
    await sql.query(`INSERT INTO cohamy_crm.website_orders(id,code,idempotency_key,request_hash,locale,contact,lines,subtotal,payment_requested)
      VALUES($1,$2,$3,$4,'vi',$5::jsonb,$6::jsonb,1000,'cod')`,[id,code,randomUUID(),digest(id),JSON.stringify({fullName:'Fictitious mail QA',email:'buyer@qa.invalid',phone:'0900000000',address:'QA address',city:'QA city',district:'',ward:'',note:''}),JSON.stringify([{name:'QA package',quantity:1,unitPrice:'1000',lineTotal:'1000'}])]);
    return {id,code,createdAt:'2026-11-05T01:30:00.000Z'};
  }
  const fakeProvider=async(input:DocumentEmail)=>{providerCalls.push(input);return 'qa-website-'+input.jobId;};
  try{
    await test('Migration seeds only the two requested recipients and QA instrumentation preserves that rule',async()=>{
      const before=await rule();assert.ok(before);assert.equal(before.enabled,true);assert.deepEqual(before.recipients,expectedRecipients);
      assert.equal((await db.query('SELECT id FROM cohamy_crm.document_mail_outbox WHERE event=$1',[WEBSITE_ORDER_MAIL_EVENT])).rows.length,0);
      const instrumented:Database={query:db.query.bind(db),exec:db.exec.bind(db),transaction:db.transaction.bind(db),close:async()=>{}};
      process.env.CRM_QA_DOCUMENT_MAIL='true';
      try{await instrumentDocumentMailQa(instrumented,fixture.admin.userId);}finally{delete process.env.CRM_QA_DOCUMENT_MAIL;}
      assert.deepEqual(await rule(),before);
    });
    await test('Order and notification enqueue roll back together',async()=>{
      const id=randomUUID();
      await assert.rejects(db.transaction(async sql=>{const order=await insertOrder(sql,id);await enqueueWebsiteOrderReceived(sql,order);throw new Error('QA_ROLLBACK');}),/QA_ROLLBACK/);
      assert.equal((await db.query('SELECT id FROM cohamy_crm.website_orders WHERE id=$1',[id])).rows.length,0);assert.equal((await jobs(id)).length,0);
    });
    const order=await db.transaction(async sql=>{const created=await insertOrder(sql);await enqueueWebsiteOrderReceived(sql,created);return created;});
    await test('New-order email snapshot has exact recipients, Vietnamese time, authenticated Admin link and no PDF',async()=>{
      const list=await jobs(order.id);assert.equal(list.length,1);const job=list[0];
      assert.equal(job.status,'PENDING');assert.deepEqual(job.recipients,expectedRecipients);assert.deepEqual(job.files,[]);
      assert.ok(job.rule_id);assert.equal(job.event_key,WEBSITE_ORDER_MAIL_EVENT+':'+order.id+':1');
      assert.ok(job.subject.includes(order.code));assert.ok(job.body.includes('08:30'));assert.ok(job.body.includes('giờ Việt Nam'));
      assert.ok(job.body.includes('https://online-mail-qa.invalid/crm/online-customers/'+order.id));
      assert.ok(!job.body.includes('buyer@qa.invalid')&&!job.body.includes('0900000000'),'Customer PII stays behind the authenticated Admin link');
    });
    await test('Repeated or concurrent helper calls cannot create another event/rule delivery',async()=>{
      const original=(await jobs(order.id))[0];
      await Promise.all([db.transaction(sql=>enqueueWebsiteOrderReceived(sql,order)),db.transaction(sql=>enqueueWebsiteOrderReceived(sql,order))]);
      const after=await jobs(order.id);assert.equal(after.length,1);assert.equal(after[0].id,original.id);assert.equal(after[0].body,original.body);
    });
    await test('Rule seeding never overrides Admin choices and disabled-rule orders are not backfilled',async()=>{
      const before=await rule(),choice={to:['admin-choice@qa.invalid'],cc:[],bcc:[]};
      await db.query('UPDATE cohamy_crm.document_mail_rules SET enabled=false,recipients=$1::jsonb,version=version+1 WHERE id=$2',[JSON.stringify(choice),before.id]);
      const disabled=await rule();await owner.exec(await fs.readFile('db/crm/057-website-order-mail.sql','utf8'));assert.deepEqual(await rule(),disabled);
      const oldOrder=await db.transaction(async sql=>{const created=await insertOrder(sql);await enqueueWebsiteOrderReceived(sql,created);return created;});assert.equal((await jobs(oldOrder.id)).length,0);
      await db.query('UPDATE cohamy_crm.document_mail_rules SET enabled=$1,recipients=$2::jsonb,version=version+1 WHERE id=$3',[before.enabled,JSON.stringify(before.recipients),before.id]);
      await owner.exec(await fs.readFile('db/crm/057-website-order-mail.sql','utf8'));assert.equal((await jobs(oldOrder.id)).length,0);
    });
    await test('Real outbox worker accepts the attachmentless event but delivery requires both fake recipient webhooks',async()=>{
      const result=await runDocumentMailOutbox(fakeProvider);assert.equal(result.accepted,1);assert.equal(result.failed,0);assert.equal(providerCalls.length,1);
      const sent=providerCalls[0];assert.deepEqual(sent.recipients,expectedRecipients);assert.deepEqual(sent.attachments,[]);
      assert.equal((await jobs(order.id))[0].status,'ACCEPTED');
      const event={event:'delivered','message-id':'qa-website-'+sent.jobId,ts_event:Math.floor(Date.now()/1000)};
      await receiveBrevoWebhook({...event,email:expectedRecipients.to[0]});assert.equal((await jobs(order.id))[0].status,'ACCEPTED');
      await receiveBrevoWebhook({...event,email:expectedRecipients.to[1]});assert.equal((await jobs(order.id))[0].status,'DELIVERED');
      assert.equal((await runDocumentMailOutbox(fakeProvider)).processed,0);assert.equal(providerCalls.length,1);
    });
    await test('An unknown provider outcome remains UNKNOWN and is never automatically resent',async()=>{
      const unknownOrder=await db.transaction(async sql=>{const created=await insertOrder(sql);await enqueueWebsiteOrderReceived(sql,created);return created;});
      let attempts=0;await runDocumentMailOutbox(async()=>{attempts++;throw new CrmError('EMAIL_RESULT_UNKNOWN',503);});
      assert.equal((await jobs(unknownOrder.id))[0].status,'UNKNOWN');assert.equal(attempts,1);
      await runDocumentMailOutbox(async()=>{attempts++;return 'unexpected-resend';});assert.equal(attempts,1);
    });
    complete=true;
  }finally{
    await fs.mkdir('docs/crm/test-results/online-customers',{recursive:true});
    await fs.writeFile('docs/crm/test-results/online-customers/mail-services-'+(postgres?'staging':'local')+'.json',JSON.stringify({status:complete?'PASS':'FAIL',environment:postgres?'STAGING isolated PostgreSQL restricted DML role':'LOCAL isolated PGlite',testedAt:new Date().toISOString(),cases,provider:'INJECTED_FAKE_NO_NETWORK',webhooks:'SYNTHETIC_LOCAL_ONLY',publicCheckoutIntegration:'Verified separately by parent suite',externalEmails:0,productionWrites:0},null,2)+'\n');
    await close();await owner.close();
  }
}
main().catch(error=>{console.error(error instanceof Error?error.message:'WEBSITE_MAIL_QA_FAILED');process.exitCode=1;});
