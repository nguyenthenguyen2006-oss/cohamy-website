import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import type {FlowSnapshot} from '../../lib/crm/document-flow-model';
import type {MailFile,MailRecipients} from '../../lib/crm/document-mail-model';

process.env.CRM_DATABASE_MODE='pglite';
process.env.CRM_ENVIRONMENT='LOCAL';
process.env.CRM_LOCAL_DATA_DIR='.local/crm-qa-businessmail-'+randomUUID();
process.env.CRM_EMAIL_ENABLED='false';
process.env.CRM_QA_DOCUMENT_MAIL='false';
process.env.CRM_PUBLIC_ORIGIN='http://127.0.0.1:4341';
const tests:{test:string;status:string}[]=[];
async function test(name:string,fn:()=>Promise<void>){await fn();tests.push({test:name,status:'PASS'});console.log('PASS',name);}

async function main(){
 const {createQaFixture,qaPassword}=await import('./qa-fixture');
 const {database}=await import('../../lib/crm/db'),auth=await import('../../lib/crm/auth'),repo=await import('../../lib/crm/repository'),flow=await import('../../lib/crm/document-flow'),mail=await import('../../lib/crm/document-mail');
 await createQaFixture();const db=await database();
 try{
  const admin=(await auth.login('admin@crm-qa.invalid',qaPassword)).user,accountant=(await auth.login('accountant@crm-qa.invalid',qaPassword)).user;
  await repo.createAccount(admin,{email:'hn-businessmail@qa.invalid',role:'WAREHOUSE_HN',displayName:'LOCAL QA HN',password:qaPassword,organizationId:admin.organizationId});
  await repo.createAccount(admin,{email:'factory-businessmail@qa.invalid',role:'FACTORY',displayName:'LOCAL QA Factory',password:qaPassword,organizationId:admin.organizationId});
  const factory=(await auth.login('factory-businessmail@qa.invalid',qaPassword)).user;
  await db.query("UPDATE cohamy_crm.products SET stock_unit='gói' WHERE stock_unit=''");
  const workspace=await flow.flowWorkspace(admin),warehouse=workspace.warehouses[0],product=workspace.products[0];assert.ok(warehouse&&product);
  const base={event:'audit:sales-order.confirmed',warehouseId:null as string|null,factoryMembershipId:null as string|null,enabled:true,recipients:{to:['direct@qa.invalid','outside@qa.invalid'],cc:['DIRECT@qa.invalid'],bcc:['hidden@qa.invalid']},subject:'{{type}} {{code}}',body:'{{status}} {{warehouse}} {{url}}',attachments:'EVENT' as const,version:0};
  const stored=async(event:string)=>{
   const id=randomUUID(),entityId=randomUUID(),pdf=Buffer.from('%PDF-1.4\n% isolated stored snapshot fixture\n%%EOF'),checksum=createHash('sha256').update(pdf).digest('hex'),filename=`BQ-${id.slice(0,8)}-v1.pdf`;
   const envelope:FlowSnapshot={id:entityId,code:`BQ-${id.slice(0,8)}`,kind:'REQUEST',revision:1,state:'SENT',warehouseId:warehouse.id,warehouseName:warehouse.name,warehouseCode:warehouse.code,factoryMembershipId:null,factoryName:'',sourceId:null,sourceCode:'',sourceRevision:null,requestId:null,requestCode:'',createdAt:new Date().toISOString(),createdBy:'',confirmedAt:new Date().toISOString(),confirmedBy:'',dueDate:'',note:'',lines:[],delivery:{},totals:{}};
   const files:MailFile[]=[{type:'BUSINESS',id,filename,checksum}],excludeRecipients=['DIRECT@qa.invalid'];
   await db.query('INSERT INTO cohamy_crm.document_business_snapshots(id,event_key,event,entity_id,revision,snapshot,filename,pdf,checksum) VALUES($1,$2,$3,$4,1,$5::jsonb,$6,$7,$8)',[id,'preview-'+id,event,entityId,JSON.stringify({record:{code:envelope.code},envelope,files,label:'Báo giá',excludeRecipients}),filename,pdf,checksum]);
   return {id,envelope,files,excludeRecipients,pdf};
  };
  await test('Unsupported warehouse/factory dimensions reject on server; Admin-only settings and preview',async()=>{
   await assert.rejects(mail.saveMailRule(admin,{...base,event:'finance:CASH_PAY_REQUESTED',warehouseId:warehouse.id}),/MAIL_SCOPE_NOT_SUPPORTED/);
   await assert.rejects(mail.saveMailRule(admin,{...base,event:'audit:quotation.sent',warehouseId:warehouse.id}),/MAIL_SCOPE_NOT_SUPPORTED/);
   await assert.rejects(mail.saveMailRule(admin,{...base,factoryMembershipId:factory.membershipId}),/MAIL_SCOPE_NOT_SUPPORTED/);
   await assert.rejects(mail.mailSettings(accountant),/FORBIDDEN/);
   await assert.rejects(mail.previewMailRule(accountant,{ruleId:randomUUID(),businessSnapshotId:randomUUID()}),/FORBIDDEN/);
  });
  await test('BUSINESS rule preview reads immutable envelope/files and creates no email; picker contains saved snapshot',async()=>{
   const rule=await mail.saveMailRule(admin,{...base,warehouseId:warehouse.id}),snapshot=await stored(base.event),before=(await mail.mailSettings(admin)).jobs.length;
   const preview=await mail.previewMailRule(admin,{ruleId:rule.id,businessSnapshotId:snapshot.id});
   assert.equal(preview.applies,true);assert.deepEqual(preview.recipients,{to:['outside@qa.invalid'],cc:[],bcc:['hidden@qa.invalid']});assert.equal(preview.subject,`Báo giá ${snapshot.envelope.code}`);assert.deepEqual(preview.files,snapshot.files);
   assert.equal((await mail.mailSettings(admin)).jobs.length,before);assert.ok((await mail.mailSettings(admin)).businessSnapshots.some(s=>s.id===snapshot.id));
   const attachments=await mail.mailFiles(db,preview.files);assert.deepEqual(Buffer.from(attachments[0].content,'base64'),snapshot.pdf);
   assert.ok(preview.body.includes(`/crm/sales/${snapshot.envelope.id}`));
  });
  await test('RFQ rule excludes already-direct pipeline recipient and preview equals actual job recipients/files',async()=>{
   const event='procurement:RFQ_DISPATCHED',snapshot=await stored(event);
   const first=await mail.saveMailRule(admin,{...base,event,recipients:{to:['DIRECT@qa.invalid','shared@qa.invalid'],cc:['first@qa.invalid'],bcc:[]}});
   await db.transaction(sql=>mail.enqueueDocumentMail(sql,{event,snapshot:snapshot.envelope,files:snapshot.files,excludeRecipients:snapshot.excludeRecipients}));
   const jobs=(await db.query<{rule_id:string;recipients:MailRecipients;files:MailFile[]}>('SELECT rule_id,recipients,files FROM cohamy_crm.document_mail_outbox WHERE event=$1 ORDER BY rule_id',[event])).rows;
   assert.equal(jobs.length,1);const all=jobs.flatMap(j=>[...j.recipients.to,...j.recipients.cc,...j.recipients.bcc]);assert.equal(all.filter(e=>e==='shared@qa.invalid').length,1);assert.ok(!all.includes('direct@qa.invalid'));
   const preview=await mail.previewMailRule(admin,{ruleId:first.id,businessSnapshotId:snapshot.id});assert.deepEqual(preview.recipients,jobs[0].recipients);assert.deepEqual(preview.files,jobs[0].files);
  });
  await test('Core BUNDLE preview and job retain dispatched source revision after Admin updates request; core URL pins PDF revision',async()=>{
   const globalRule=await mail.saveMailRule(admin,{...base,event:'factory.dispatch.confirmed',recipients:{to:['shared-core@qa.invalid','global-core@qa.invalid'],cc:[],bcc:[]},attachments:'BUNDLE'});
   const rule=await mail.saveMailRule(admin,{...base,event:'factory.dispatch.confirmed',warehouseId:warehouse.id,factoryMembershipId:factory.membershipId,recipients:{to:['shared-core@qa.invalid','factory-docs@qa.invalid'],cc:[],bcc:[]},attachments:'BUNDLE'});
   const request=await flow.saveFlowDocument(admin,{kind:'REQUEST',warehouseId:warehouse.id,factoryMembershipId:factory.membershipId,lines:[{productId:product.id,quantity:'100'}],confirm:true,idempotencyKey:randomUUID()});
   await flow.acceptFactoryRequest(factory,{id:request.id,idempotencyKey:randomUUID()});
   const dispatch=await flow.saveFlowDocument(factory,{kind:'DISPATCH',parentId:request.id,lines:[{productId:product.id,quantity:'10'}],confirm:true,idempotencyKey:randomUUID()});
   await flow.amendFlowDocument(admin,{id:request.id,kind:'REQUEST',version:request.version,lines:[{productId:product.id,quantity:'120'}],note:'Bổ sung nhu cầu',reason:'LOCAL QA bổ sung nhu cầu riêng',idempotencyKey:randomUUID()});
   const original=(await db.query<{id:string}>('SELECT id FROM cohamy_crm.document_flow_revisions WHERE entity_id=$1 AND revision=1',[request.id])).rows[0],newer=(await db.query<{id:string}>('SELECT id FROM cohamy_crm.document_flow_revisions WHERE entity_id=$1 AND revision=2',[request.id])).rows[0];assert.ok(original&&newer);
   const jobs=(await db.query<{rule_id:string;recipients:MailRecipients;files:MailFile[]}>('SELECT rule_id,recipients,files FROM cohamy_crm.document_mail_outbox WHERE event=$1 AND entity_id=$2',['factory.dispatch.confirmed',dispatch.id])).rows;
   assert.equal(jobs.length,2);assert.equal(jobs.flatMap(j=>[...j.recipients.to,...j.recipients.cc,...j.recipients.bcc]).filter(email=>email==='shared-core@qa.invalid').length,1);
   for(const selected of [globalRule,rule]){const preview=await mail.previewMailRule(admin,{ruleId:selected.id,documentId:dispatch.id}),job=jobs.find(j=>j.rule_id===selected.id)!;assert.ok(preview.files.some(f=>f.id===original.id));assert.ok(!preview.files.some(f=>f.id===newer.id));assert.deepEqual(preview.files,job.files);assert.deepEqual(preview.recipients,job.recipients);assert.ok(preview.body.includes(`/api/crm/document-flow/pdf?id=${dispatch.id}&revision=1`));}
  });
  await test('VAT BUNDLE preview uses sealed source_revision and own FLOW PDF after later Admin amendment',async()=>{
   const documents=await import('../../lib/crm/workspace'),rule=await mail.saveMailRule(admin,{...base,event:'vat.saved',recipients:{to:['vat-docs@qa.invalid'],cc:[],bcc:[]},attachments:'BUNDLE'});
   const request=await flow.saveFlowDocument(admin,{kind:'REQUEST',warehouseId:warehouse.id,factoryMembershipId:factory.membershipId,lines:[{productId:product.id,quantity:'10'}],confirm:true,idempotencyKey:randomUUID()});await flow.acceptFactoryRequest(factory,{id:request.id,idempotencyKey:randomUUID()});
   const dispatch=await flow.saveFlowDocument(factory,{kind:'DISPATCH',parentId:request.id,lines:[{productId:product.id,quantity:'10'}],confirm:true,idempotencyKey:randomUUID()});
   const vat=await documents.uploadDocument(accountant,{entityType:'factory-invoice',entityId:dispatch.id,title:'VAT LOCAL QA',docCategory:'VAT_ORIGINAL',filename:'VAT-PREVIEW.pdf',mime:'application/pdf',content:Buffer.from('%PDF-1.4\n% LOCAL QA VAT preview\n%%EOF')});
   await flow.amendFlowDocument(admin,{id:dispatch.id,kind:'DISPATCH',version:dispatch.version,lines:[{productId:product.id,quantity:'9'}],note:'Đính chính giao',reason:'LOCAL QA đính chính trước khi kho nhận',idempotencyKey:randomUUID()});
   const preview=await mail.previewMailRule(admin,{ruleId:rule.id,documentId:dispatch.id}),job=(await db.query<{files:MailFile[]}>('SELECT files FROM cohamy_crm.document_mail_outbox WHERE event=$1 AND entity_id=$2',['vat.saved',dispatch.id])).rows[0];
   assert.deepEqual(preview.files,job.files);assert.ok(preview.files.some(f=>f.type==='VAT'&&f.id===vat.versionId));assert.equal(preview.files.length,3);assert.ok(preview.body.includes(`/api/crm/document-flow/pdf?id=${dispatch.id}&revision=1`));
  });
  await fs.mkdir('docs/crm/test-results/document-flow',{recursive:true});
  await fs.writeFile('docs/crm/test-results/document-flow/business-mail-local.json',JSON.stringify({environment:'LOCAL isolated PGlite',provider:'DISABLED; no external sends',evidence:'Stored BUSINESS fixtures test preview/file/rule behavior; RFQ business service execution is covered separately by procurement captures. Core BUNDLE uses actual flow service.',tests},null,2));
 }finally{await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
