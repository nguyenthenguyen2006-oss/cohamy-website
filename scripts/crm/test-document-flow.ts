import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import fs from 'node:fs/promises';
const pg=process.env.CRM_DATABASE_MODE==='postgres';
if(!pg){process.env.CRM_DATABASE_MODE='pglite';process.env.CRM_ENVIRONMENT='LOCAL';process.env.CRM_LOCAL_DATA_DIR='.local/crm-qa-documentflow-'+randomUUID();}
process.env.CRM_EMAIL_ENABLED='false';
const result:{test:string;status:string}[]=[];
async function test(name:string,fn:()=>Promise<void>){await fn();result.push({test:name,status:'PASS'});console.log('PASS',name);}
async function main(){
 const {createQaFixture,qaPassword}=await import('./qa-fixture');const {database}=await import('../../lib/crm/db');const auth=await import('../../lib/crm/auth');const repo=await import('../../lib/crm/repository');
 const flow=await import('../../lib/crm/document-flow');const mail=await import('../../lib/crm/document-mail');const workspace=await import('../../lib/crm/workspace');
 const old=await import('../../lib/crm/accountant-workflow');const inventory=await import('../../lib/crm/inventory');const finance=await import('../../lib/crm/finance');
 await createQaFixture();const owner=await database(),{installQaRuntime}=await import('./qa-runtime'),close=await installQaRuntime(owner);const db=await database();
 const admin=(await auth.login('admin@crm-qa.invalid',qaPassword)).user;
 for(const [email,role] of [['factory-flow@crm-qa.invalid','FACTORY'],['factory-other@crm-qa.invalid','FACTORY'],['hn-flow@crm-qa.invalid','WAREHOUSE_HN'],['hcm-flow@crm-qa.invalid','WAREHOUSE_HCM'],['manager-flow@crm-qa.invalid','MANAGER']] as const)await repo.createAccount(admin,{email,role,displayName:'LOCAL QA · '+role,password:qaPassword,organizationId:admin.organizationId});
 const factory=(await auth.login('factory-flow@crm-qa.invalid',qaPassword)).user,other=(await auth.login('factory-other@crm-qa.invalid',qaPassword)).user,hn=(await auth.login('hn-flow@crm-qa.invalid',qaPassword)).user,hcm=(await auth.login('hcm-flow@crm-qa.invalid',qaPassword)).user,accountant=(await auth.login('accountant@crm-qa.invalid',qaPassword)).user,manager=(await auth.login('manager-flow@crm-qa.invalid',qaPassword)).user;
 await db.query("UPDATE cohamy_crm.products SET stock_unit='gói' WHERE stock_unit=''");
 const ws=await flow.flowWorkspace(admin),hnWh=ws.warehouses.find(w=>w.code.includes('HN'))!,hcmWh=ws.warehouses.find(w=>w.code.includes('HCM'))!,product=ws.products[0],productB=ws.products[1];assert.ok(hnWh&&hcmWh&&product);
 const countStock=async(w=hnWh.id)=>Number((await db.query<{q:string}>('SELECT COALESCE(sum(on_hand),0)::text AS q FROM cohamy_crm.inventory_balances WHERE warehouse_id=$1 AND product_id=$2',[w,product.id])).rows[0].q);
 const createRequest=(qty='100',wh=hnWh.id)=>flow.saveFlowDocument(admin,{kind:'REQUEST',warehouseId:wh,factoryMembershipId:factory.membershipId,lines:[{productId:product.id,quantity:qty}],confirm:true,idempotencyKey:randomUUID()});
 const dispatch=async(requestId:string,qty='100')=>{await flow.acceptFactoryRequest(factory,{id:requestId,idempotencyKey:randomUUID()});return flow.saveFlowDocument(factory,{kind:'DISPATCH',parentId:requestId,lines:[{productId:product.id,quantity:qty}],confirm:true,idempotencyKey:randomUUID()});};
 const receipt=(dispatchId:string,qty='100',keeper=hn)=>flow.saveFlowDocument(keeper,{kind:'RECEIPT',parentId:dispatchId,lines:[{productId:product.id,quantity:qty,note:qty==='100'?'':'Thiếu / hỏng khi kiểm đếm'}],confirm:true,idempotencyKey:randomUUID()});
 let req:{id:string;code:string;version:number;state:string},disp:{id:string;code:string;version:number;state:string},rec:{id:string;code:string;version:number;state:string},shortRec:{id:string;code:string;version:number;state:string},vat:{id:string;versionId:string;number:number};
 try{
 await test('Draft, source allocation, PDF preview and 100 dispatched without stock change',async()=>{
  const before=await countStock();const draft=await flow.saveFlowDocument(admin,{kind:'REQUEST',warehouseId:hnWh.id,factoryMembershipId:factory.membershipId,lines:[{productId:product.id,quantity:'100'}],idempotencyKey:randomUUID()});
  assert.equal((await flow.flowWorkspace(factory)).documents.length,0);await flow.downloadFlowPdf(admin,draft.id);assert.equal(await countStock(),before);
  req=await flow.confirmFlowDocument(admin,{id:draft.id,kind:'REQUEST',version:draft.version,idempotencyKey:randomUUID()});assert.equal((await flow.flowWorkspace(factory)).documents.length,1);await flow.acceptFactoryRequest(factory,{id:req.id,idempotencyKey:randomUUID()});
  disp=await dispatch(req.id);assert.equal(await countStock(),before);
 });
 await test('Receipt 100 creates balance and immutable pair + inventory movements atomically',async()=>{
  const before=await countStock();rec=await receipt(disp.id);assert.equal(await countStock(),before+100);const actual=(await flow.flowWorkspace(accountant)).documents.find(x=>x.id===rec.id)!;assert.equal(actual.lines[0].quantity,'100');
  assert.equal((await db.query<{q:string}>('SELECT sum(quantity)::text AS q FROM cohamy_crm.inventory_movements m JOIN cohamy_crm.inventory_documents d ON d.id=m.document_id WHERE d.reference_id=$1',[rec.id])).rows[0].q,'100.000000');
 });
 await test('100 sent / 98 received, original remains 100, discrepancy -2',async()=>{
  const request=await createRequest(),d=await dispatch(request.id),before=await countStock();shortRec=await receipt(d.id,'98');assert.equal(await countStock(),before+98);const data=await flow.flowWorkspace(accountant);assert.equal(data.documents.find(s=>s.id===d.id)!.lines[0].quantity,'100');assert.equal(data.documents.find(s=>s.id===shortRec.id)!.lines[0].difference,'-2');
 });
 await test('Same/different idempotency keys and concurrent receives cannot post stock twice',async()=>{
  const before=await countStock();await assert.rejects(receipt(disp.id),/ALREADY_RECEIVED/);assert.equal(await countStock(),before);
  const r=await createRequest(),d=await dispatch(r.id),key=randomUUID(),input={kind:'RECEIPT',parentId:d.id,lines:[{productId:product.id,quantity:'100'}],confirm:true,idempotencyKey:key};
  const a=await flow.saveFlowDocument(hn,input),b=await flow.saveFlowDocument(hn,input);assert.equal(a.id,b.id);assert.equal(await countStock(),before+100);
  const r2=await createRequest(),d2=await dispatch(r2.id),b2=await countStock();const outcomes=await Promise.allSettled([receipt(d2.id),receipt(d2.id)]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(await countStock(),b2+100);
 });
 await test('Cross-warehouse reads, receipts, preview and downloaded VAT are denied on server',async()=>{
  assert.ok(!(await flow.flowWorkspace(hcm)).documents.some(x=>x.warehouseId===hnWh.id));await assert.rejects(flow.downloadFlowPdf(hcm,disp.id),/NOT_FOUND/);await assert.rejects(receipt(disp.id,'100',hcm),/NOT_FOUND/);await assert.rejects(workspace.documents(hcm,'factory-invoice',disp.id),/NOT_FOUND/);
 });
 await test('Factory cannot forge request, missing/wrong source, warehouse or SKU',async()=>{
  for(const u of [factory,hn,accountant,manager])await assert.rejects(flow.saveFlowDocument(u,{kind:'REQUEST',warehouseId:hnWh.id,factoryMembershipId:factory.membershipId,lines:[{productId:product.id,quantity:'1'}],idempotencyKey:randomUUID()}),/FORBIDDEN/);
  await assert.rejects(old.handleAccountantWorkflowAction(factory,'create-factory-dispatch',{warehouseId:hnWh.id,lines:[{productId:product.id,dispatchedQty:1}]}),/SOURCE_REQUIRED/);
  await assert.rejects(flow.saveFlowDocument(other,{kind:'DISPATCH',parentId:req.id,lines:[{productId:product.id,quantity:'1'}],idempotencyKey:randomUUID()}),/NOT_FOUND/);
  const r=await createRequest();await flow.acceptFactoryRequest(factory,{id:r.id,idempotencyKey:randomUUID()});await assert.rejects(flow.saveFlowDocument(factory,{kind:'DISPATCH',parentId:r.id,warehouseId:hcmWh.id,lines:[{productId:product.id,quantity:'1'}],idempotencyKey:randomUUID()}),/SOURCE_WAREHOUSE_MISMATCH/);
  await assert.rejects(flow.saveFlowDocument(factory,{kind:'DISPATCH',parentId:r.id,lines:[{productId:productB.id,quantity:'1'}],idempotencyKey:randomUUID()}),/PRODUCT_OUTSIDE_REQUEST/);
 });
 await test('Installments serialize against total requested; amendments preserve prior source revisions',async()=>{
  const r=await createRequest('100'),first=await dispatch(r.id,'60');const outcomes=await Promise.allSettled([dispatch(r.id,'40'),dispatch(r.id,'40')]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  const amendment=await flow.amendFlowDocument(admin,{id:r.id,kind:'REQUEST',version:1,lines:[{productId:product.id,quantity:'120'}],note:'Bổ sung 20',reason:'Bổ sung nhu cầu kho Hà Nội',idempotencyKey:randomUUID()});assert.equal(amendment.version,2);const data=await flow.flowWorkspace(admin);assert.equal(data.documents.find(x=>x.id===first.id)!.sourceRevision,1);await dispatch(r.id,'20');await assert.rejects(dispatch(r.id,'1'),/REQUEST_QUANTITY_EXCEEDED/);
 });
 await test('Accountant has no legacy money, inventory, or factory approval mutation',async()=>{
  for(const action of ['record-order-payment','confirm-order-payment','accountant-clear-order','accountant-verify-factory-invoice','save-vat-invoice','update-reconciliation-status','register-warehouse-order'])await assert.rejects(old.handleAccountantWorkflowAction(accountant,action,{}),/FORBIDDEN/);
  await assert.rejects(inventory.postReceipt(accountant,{}),/FORBIDDEN/);await assert.rejects(finance.createPaymentReceipt(accountant,{}),/FORBIDDEN/);
 });
 await test('VAT bytes in DB, exact version, immutable metadata/upload versions, scoped download',async()=>{
  const content=Buffer.from('%PDF-1.4\n% LOCAL QA VAT\n%%EOF');vat=await workspace.uploadDocument(accountant,{entityType:'factory-invoice',entityId:disp.id,title:'LOCAL QA VAT',docCategory:'VAT_ORIGINAL',filename:'VAT-LOCAL.pdf',mime:'application/pdf',content});const file=await workspace.downloadDocument(accountant,vat.versionId);assert.deepEqual(Buffer.from(file.content),content);assert.equal((await db.query<{checksum:string}>('SELECT checksum FROM cohamy_crm.document_versions WHERE id=$1',[vat.versionId])).rows[0].checksum,createHash('sha256').update(content).digest('hex'));await assert.rejects(workspace.downloadDocument(factory,vat.versionId),/NOT_FOUND/);
  await assert.rejects(workspace.downloadDocument(hcm,vat.versionId),/NOT_FOUND/);
  await assert.rejects(workspace.uploadDocument(accountant,{entityType:'factory-invoice',entityId:disp.id,title:'Overwrite VAT',docCategory:'VAT_ORIGINAL',documentId:vat.id,filename:'VAT-NEW.pdf',mime:'application/pdf',content}),/VAT_FILE_LOCKED/);
  await assert.rejects(workspace.uploadDocument(accountant,{entityType:'factory-invoice',entityId:disp.id,title:'Second VAT',docCategory:'VAT_ORIGINAL',filename:'VAT-NEW.pdf',mime:'application/pdf',content}),/VAT_FILE_LOCKED/);
  await assert.rejects(db.query('UPDATE cohamy_crm.private_documents SET title=$1 WHERE id=$2',['Tampered',vat.id]),/VAT_FILE_LOCKED/);
  await assert.rejects(db.query('INSERT INTO cohamy_crm.document_versions(id,document_id,number,filename,mime,size,checksum,content,created_by) VALUES($1,$2,2,$3,$4,$5,$6,$7,$8)',[randomUUID(),vat.id,'new.pdf','application/pdf',content.length,'bad',content,admin.id]),/VAT_FILE_LOCKED/);
 });
 await test('Confirmed data cannot mutate; ADMIN correction creates offset movement + revision',async()=>{
  for(const u of [factory,hn,accountant,manager])await assert.rejects(flow.amendFlowDocument(u,{id:rec.id,kind:'RECEIPT',version:1,lines:[],note:'',reason:'No access',idempotencyKey:randomUUID()}),/FORBIDDEN/);
  await assert.rejects(db.query('UPDATE cohamy_crm.factory_invoices SET note=$1 WHERE id=$2',['Tampered',rec.id]),/DOCUMENT_LOCKED/);
  const before=await countStock();await flow.amendFlowDocument(admin,{id:shortRec.id,kind:'RECEIPT',version:1,lines:[{productId:product.id,quantity:'97'}],note:'Kiểm đếm lại',reason:'Điều chỉnh sau kiểm đếm độc lập',idempotencyKey:randomUUID()});assert.equal(await countStock(),before-1);const oldPdf=await flow.downloadFlowPdf(admin,shortRec.id,1);assert.equal(oldPdf.snapshot.lines[0].quantity,'98');
 });
 await test('Snapshot and PDF bytes stay stable after catalog and account changes',async()=>{
  const before=await flow.downloadFlowPdf(admin,rec.id,1);await db.query('UPDATE cohamy_crm.products SET name=$1,retail_price=999999 WHERE id=$2',['LOCAL QA changed catalogue name',product.id]);const after=await flow.downloadFlowPdf(admin,rec.id,1);assert.deepEqual(after.bytes,before.bytes);assert.equal(after.snapshot.lines[0].name,before.snapshot.lines[0].name);await fs.mkdir('docs/crm/test-results/document-flow',{recursive:true});await fs.writeFile('docs/crm/test-results/document-flow/receipt.pdf',after.bytes);
 });
 await test('Delivery draft autofills source money, preview is read-only, confirm issues exactly once',async()=>{
  const order=await old.handleAccountantWorkflowAction(admin,'register-warehouse-order',{warehouseId:hnWh.id,ordererType:'CUSTOMER',organizationName:'LOCAL QA · Khách giao hàng',ordererName:'LOCAL QA · Người nhận',ordererPhone:'0900000123',discountPercent:10,vatRate:0,paymentSubmitted:false,lines:[{productId:product.id,quantity:20,unitPrice:50000}]}) as {id:string};
  const delivery={giver:'LOCAL QA · Người giao',recipient:'LOCAL QA · Người nhận',recipientPhone:'0900000123',address:'LOCAL QA · Địa chỉ thử riêng',deliveryDate:'2026-10-23',carrier:'LOCAL QA · Xe thử nghiệm'};
  const before=await countStock(),draft=await flow.saveFlowDocument(hn,{kind:'ISSUE',warehouseId:hnWh.id,clearanceId:order.id,lines:[{productId:product.id,quantity:'20'}],delivery,idempotencyKey:randomUUID()});
  const preview=await flow.downloadFlowPdf(hn,draft.id);assert.equal(await countStock(),before);assert.equal(preview.snapshot.totals.goods,'1000000');assert.equal(preview.snapshot.totals.discount,'100000');assert.equal(preview.snapshot.totals.total,'900000');
  const key=randomUUID(),input={id:draft.id,kind:'ISSUE',version:draft.version,idempotencyKey:key};const issue=await flow.confirmFlowDocument(hn,input);assert.equal(await countStock(),before-20);assert.equal((await flow.confirmFlowDocument(hn,input)).id,issue.id);assert.equal(await countStock(),before-20);
  await assert.rejects(flow.saveFlowDocument(hn,{kind:'ISSUE',warehouseId:hnWh.id,clearanceId:order.id,lines:[{productId:product.id,quantity:'1'}],delivery,confirm:true,idempotencyKey:randomUUID()}),/ORDER_QUANTITY_EXCEEDED/);
  await assert.rejects(flow.confirmFlowDocument(manager,{id:draft.id,kind:'ISSUE',version:1,idempotencyKey:randomUUID()}),/FORBIDDEN/);
  const pdf=await flow.downloadFlowPdf(accountant,issue.id,1);await fs.writeFile('docs/crm/test-results/document-flow/delivery-one-line.pdf',pdf.bytes);
  await flow.amendFlowDocument(admin,{id:issue.id,kind:'ISSUE',version:1,lines:[{productId:product.id,quantity:'19'}],note:'Nhận lại 1 sản phẩm sau kiểm đếm',reason:'Đính chính số thực xuất có xác nhận',idempotencyKey:randomUUID()});assert.equal(await countStock(),before-19);assert.equal((await flow.downloadFlowPdf(admin,issue.id,1)).snapshot.lines[0].quantity,'20');
 });
 await test('Standalone delivery preserves unknown money, stock, customer and editable Admin metadata',async()=>{
  const before=await countStock(),delivery={giver:'LOCAL QA',recipient:'LOCAL QA recipient',recipientPhone:'0900000000',address:'LOCAL QA address',deliveryDate:'2026-10-23',carrier:'LOCAL QA carrier',customer:'LOCAL QA independent recipient'};
  const draft=await flow.saveFlowDocument(hn,{kind:'ISSUE',warehouseId:hnWh.id,lines:[{productId:product.id,quantity:'2'}],delivery,idempotencyKey:randomUUID()});
  const preview=await flow.downloadFlowPdf(hn,draft.id);assert.equal(preview.snapshot.totals.total,'');assert.equal(preview.snapshot.lines[0].unitPrice,'');assert.equal(await countStock(),before);
  const confirmed=await flow.confirmFlowDocument(hn,{id:draft.id,kind:'ISSUE',version:draft.version,idempotencyKey:randomUUID()});assert.equal(await countStock(),before-2);
  await flow.amendFlowDocument(admin,{id:confirmed.id,kind:'ISSUE',version:confirmed.version,lines:[{productId:product.id,quantity:'1'}],delivery:{...delivery,address:'LOCAL QA corrected address'},dueDate:'2026-10-25',note:'LOCAL QA correction',reason:'Independent correction with original history',idempotencyKey:randomUUID()});
  assert.equal(await countStock(),before-1);const revised=await flow.viewFlowDocument(admin,confirmed.id);assert.equal(revised.delivery.address,'LOCAL QA corrected address');assert.equal(revised.delivery.customer,delivery.customer);assert.equal(revised.totals.total,'');assert.equal((await flow.viewFlowDocument(admin,confirmed.id,1)).delivery.address,delivery.address);
 });
 await test('Dispatch correction after receipt preserves exact original pair revision and actual stock',async()=>{
  const r=await createRequest('10'),d=await dispatch(r.id,'8'),received=await receipt(d.id,'8'),before=await countStock(),original=await flow.downloadFlowPdf(admin,d.id,1);
  await flow.amendFlowDocument(admin,{id:d.id,kind:'DISPATCH',version:1,lines:[{productId:product.id,quantity:'9'}],note:'LOCAL QA corrected dispatch',reason:'Correction retains receipt linked to original dispatch',idempotencyKey:randomUUID()});
  assert.equal(await countStock(),before);const pair=await flow.viewFlowDocument(accountant,received.id);assert.equal(pair.sourceRevision,1);assert.equal(pair.lines[0].shipped,'8');assert.deepEqual((await flow.downloadFlowPdf(admin,d.id,1)).bytes,original.bytes);
 });
 await test('Failure inside receipt transaction rolls back invoice, ledger, balance and email',async()=>{
  const r=await createRequest(),d=await dispatch(r.id),before=await countStock(),beforeCount=(await db.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.factory_invoices')).rows[0].n;
  await owner.exec("CREATE FUNCTION cohamy_crm.qa_fail_movement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA_INJECTED_STOCK_FAILURE'; END $$; CREATE TRIGGER qa_movement_failure BEFORE INSERT ON cohamy_crm.inventory_movements FOR EACH ROW EXECUTE FUNCTION cohamy_crm.qa_fail_movement();");
  try{await assert.rejects(receipt(d.id),/QA_INJECTED_STOCK_FAILURE/);}finally{await owner.exec('DROP TRIGGER qa_movement_failure ON cohamy_crm.inventory_movements; DROP FUNCTION cohamy_crm.qa_fail_movement();');}
  assert.equal(await countStock(),before);assert.equal((await db.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.factory_invoices')).rows[0].n,beforeCount);await receipt(d.id);
 });
 await test('Mail settings persist; recipients deduplicate; no retroactive or draft jobs',async()=>{
  await assert.rejects(mail.mailSettings(accountant),/FORBIDDEN/);await assert.rejects(mail.saveMailRule(manager,{}),/FORBIDDEN/);
  await mail.saveMailRule(admin,{event:'factory.request.sent',warehouseId:hnWh.id,factoryMembershipId:factory.membershipId,enabled:true,recipients:{to:['factory@example.invalid','factory@example.invalid'],cc:['cc@example.invalid','factory@example.invalid'],bcc:['bcc@example.invalid']},subject:'{{type}} {{code}}',body:'{{warehouse}} {{factory}} {{status}} {{url}}',attachments:'BUNDLE',version:0});
  assert.equal((await mail.mailSettings(admin)).jobs.length,0);await flow.saveFlowDocument(admin,{kind:'REQUEST',warehouseId:hnWh.id,factoryMembershipId:factory.membershipId,lines:[{productId:product.id,quantity:'5'}],idempotencyKey:randomUUID()});assert.equal((await mail.mailSettings(admin)).jobs.length,0);await createRequest('5');assert.equal((await mail.mailSettings(admin)).jobs.length,1);await createRequest('5',hcmWh.id);assert.equal((await mail.mailSettings(admin)).jobs.length,1);
 });
 await test('Email jobs have exact recipients/files; two workers claim once; accepted differs from delivered',async()=>{
  let calls=0;const provider=async(input:import('../../lib/crm/brevo').DocumentEmail)=>{calls++;assert.deepEqual(input.recipients,{to:['factory@example.invalid'],cc:['cc@example.invalid'],bcc:['bcc@example.invalid']});assert.equal(input.attachments.length,1);assert.ok(Buffer.from(input.attachments[0].content,'base64').subarray(0,5).toString()==='%PDF-');return '<local-qa-message>';};
  await Promise.all([mail.runDocumentMailOutbox(provider),mail.runDocumentMailOutbox(provider)]);assert.equal(calls,1);const jobs=(await mail.mailSettings(admin)).jobs;assert.equal(jobs[0].status,'ACCEPTED');
  const ts=Math.floor(Date.now()/1000);for(const email of ['factory@example.invalid','cc@example.invalid','bcc@example.invalid'])await mail.receiveBrevoWebhook({event:'delivered',email,'message-id':'local-qa-message',ts_event:ts});assert.equal((await mail.mailSettings(admin)).jobs[0].status,'DELIVERED');await mail.receiveBrevoWebhook({event:'deferred',email:'factory@example.invalid','message-id':'local-qa-message',ts_event:ts-10});assert.equal((await mail.mailSettings(admin)).jobs[0].status,'DELIVERED');
  const duplicate=await mail.receiveBrevoWebhook({event:'delivered',email:'factory@example.invalid','message-id':'local-qa-message',ts_event:ts});assert.equal(duplicate.duplicate,true);
 });
 await test('Provider timeout stays UNKNOWN, worker crash does not auto-send, retry is audited',async()=>{
  await createRequest('5');await mail.runDocumentMailOutbox(async()=>{const {CrmError}=await import('../../lib/crm/permissions');throw new CrmError('EMAIL_RESULT_UNKNOWN',503);});const job=(await mail.mailSettings(admin)).jobs[0];assert.equal(job.status,'UNKNOWN');let calls=0;await mail.runDocumentMailOutbox(async()=>{calls++;return 'bad';});assert.equal(calls,0);await assert.rejects(mail.retryDocumentMail(admin,{id:job.id,reason:'Try again'}),/MAIL_EXPLICIT_RESEND_REQUIRED/);await mail.retryDocumentMail(admin,{id:job.id,reason:'Đã kiểm tra nhà cung cấp, gửi lại có chủ đích',resend:true});await assert.rejects(mail.retryDocumentMail(accountant,{id:job.id,reason:'Try again',resend:true}),/FORBIDDEN/);
 });
 await test('All nine core notification events use real committed services and immutable exact files',async()=>{
  const {coreMailEvents}=await import('../../lib/crm/document-mail-model'),rules=new Map<string,string>();
  for(const event of coreMailEvents){const saved=await mail.saveMailRule(admin,{event:event.event,warehouseId:null,factoryMembershipId:null,enabled:true,recipients:{to:[event.event+'@core-events.invalid'],cc:['cc@core-events.invalid'],bcc:['bcc@core-events.invalid']},subject:'{{type}} {{code}} {{revision}}',body:'{{status}} {{warehouse}} {{factory}} {{source}} {{url}}',attachments:'BUNDLE',version:0});rules.set(event.event,saved.id);}
  const r=await createRequest('10'),d=await dispatch(r.id,'10'),received=await receipt(d.id,'8');
  await flow.amendFlowDocument(admin,{id:received.id,kind:'RECEIPT',version:1,lines:[{productId:product.id,quantity:'7'}],note:'LOCAL QA correction',reason:'Core amendment event has immutable snapshot',idempotencyKey:randomUUID()});
  const content=Buffer.from('%PDF-1.4\n% CORE EVENTS VAT\n%%EOF');
  await workspace.uploadDocument(accountant,{entityType:'factory-invoice',entityId:d.id,title:'Core VAT original',docCategory:'VAT_ORIGINAL',filename:'CORE-VAT.pdf',mime:'application/pdf',content});
  await workspace.uploadDocument(admin,{entityType:'factory-invoice',entityId:d.id,title:'Core VAT replacement',docCategory:'VAT_ORIGINAL',filename:'CORE-VAT-REPLACEMENT.pdf',mime:'application/pdf',content:Buffer.concat([content,Buffer.from('\n% Admin corrected file')]),reason:'Admin deliberately replaces VAT with history'});
  await flow.saveFlowDocument(hn,{kind:'ISSUE',warehouseId:hnWh.id,lines:[{productId:product.id,quantity:'1'}],delivery:{giver:'QA sender',recipient:'QA receiver',recipientPhone:'0900000000',address:'QA address',deliveryDate:'2026-10-23',carrier:'QA carrier',customer:'QA independent recipient'},confirm:true,idempotencyKey:randomUUID()});
  for(const [event,ruleId] of rules){const jobs=(await db.query<{id:string;files:import('../../lib/crm/document-mail-model').MailFile[];recipients:{to:string[]}}> ('SELECT id,files,recipients FROM cohamy_crm.document_mail_outbox WHERE event=$1 AND rule_id=$2',[event,ruleId])).rows;assert.ok(jobs.length>0,event+' event missing');for(const job of jobs){assert.ok(job.recipients.to.includes(event+'@core-events.invalid'));assert.ok(job.files.length>0);const files=await mail.mailFiles(db,job.files);assert.equal(files.length,job.files.length);}}
 });
 await fs.writeFile('.local/crm-document-flow-run.json',JSON.stringify({dataDir:process.env.CRM_LOCAL_DATA_DIR,mode:pg?'postgres':'pglite',emails:{admin:admin.email,factory:factory.email,hn:hn.email,hcm:hcm.email,accountant:accountant.email},requestId:req!.id,dispatchId:disp!.id,receiptId:rec!.id,vatVersionId:vat!.versionId},null,2));
 await fs.writeFile('docs/crm/test-results/document-flow/integration-'+(pg?'postgres':'pglite')+'.json',JSON.stringify({environment:pg?'LOCAL native PostgreSQL 17.11 / isolated DML role':'LOCAL PGlite',provider:'FAKE_ONLY',tests:result},null,2));
 }finally{await close();await owner.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
