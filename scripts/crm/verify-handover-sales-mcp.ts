import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import type {FlowSnapshot} from '../../lib/crm/document-flow-model';
import type {AdminInvoice,InvoiceContent} from '../../lib/crm/invoice-admin-model';

// Existing fictitious release fixture and restricted runtime only. This script
// never creates a database, installs users, loads a production URL or sends mail.
const target=new URL(process.env.CRM_DATABASE_URL??'');
assert.equal(process.env.CRM_ENVIRONMENT,'STAGING');assert.equal(process.env.CRM_DATABASE_MODE,'postgres');
assert.ok(['localhost','127.0.0.1'].includes(target.hostname)&&target.port==='55432');assert.match(target.pathname,/^\/cohamy_qa_handover_[a-z0-9_]+$/u);
assert.equal(process.env.CRM_PUBLIC_ORIGIN,'https://cohamy.vn');
process.env.CRM_EMAIL_ENABLED='false';process.env.CRM_QA_DOCUMENT_MAIL='false';
const fixtureFile='.local/handover-sale-release/browser-fixture.json',output='docs/crm/test-results/handover-sales/mcp-postgres.json';
const cases:{name:string;status:'PASS'|'FAIL';error?:string}[]=[],evidence:Record<string,unknown>={};
async function check(name:string,run:()=>Promise<void>){try{await run();cases.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){cases.push({name,status:'FAIL',error:e instanceof Error?e.message:String(e)});throw e;}}
function noCredentials(value:unknown,noCost=false){
 if(Array.isArray(value)){for(const item of value)noCredentials(item,noCost);return;}
 if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){
  if(/password|token|secret|api.?key|credential|ciphertext/i.test(key))assert.ok(item==='[redacted]'||item===null||item===undefined,'MCP credential field '+key);
  if(noCost)assert.ok(!/^(cost|costPrice|costUnitPrice|costTotal|cost_total|cost_price|cost_unit_price)$/i.test(key),'Customer sale exposed cost field '+key);
  noCredentials(item,noCost);
 }
}
async function main(){
 const fixture=JSON.parse(await fs.readFile(fixtureFile,'utf8')) as {warehouseId:string;customerId:string;products:{id:string;name?:string}[]};
 assert.match(fixture.warehouseId,/^[\da-f-]{36}$/iu);assert.match(fixture.customerId,/^[\da-f-]{36}$/iu);assert.ok(fixture.products.length>=2&&fixture.products.every(p=>/^[\da-f-]{36}$/iu.test(p.id)));
 const {database}=await import('../../lib/crm/db'),{qaPassword}=await import('./qa-fixture'),auth=await import('../../lib/crm/auth'),{invokeOperation,operationCatalog}=await import('../../lib/crm/mcp/bridge'),{dataCatalog,browseData}=await import('../../lib/crm/mcp/data'),{calculateHandoverSaleLine}=await import('../../lib/crm/handover-sale-pricing');
 const db=await database(),admin=(await auth.login('admin@crm-qa.invalid',qaPassword)).user;
 const created:string[]=[];
 async function invoke<T>(operation:string,write:boolean,input?:unknown,query:Record<string,string>={}){
  const result=await invokeOperation(admin,{operation,...(input===undefined?{}:{input}),query},write);
  assert.ok(result.ok,operation+' returned '+result.status+('data' in result?' '+JSON.stringify(result.data):''));
  assert.ok('data' in result,operation+' did not return JSON');noCredentials(result.data);
  return result.data as T;
 }
 const view=(id:string)=>invoke<FlowSnapshot>('GET /api/crm/document-flow/view',false,undefined,{id});
 async function downloadPdf(id:string,revision:number){
  let offset=0,total=0;const chunks:Buffer[]=[];
  while(true){const result=await invokeOperation(admin,{operation:'GET /api/crm/document-flow/pdf',query:{id,revision:String(revision)},fileOffset:offset,fileLength:4096},false),file='file' in result?result.file:undefined;assert.ok(result.ok&&file);assert.equal(file.mime,'application/pdf');assert.equal(file.offset,offset);total=file.totalBytes;chunks.push(Buffer.from(file.base64,'base64'));if(file.nextOffset===null)break;assert.ok(file.nextOffset>offset);offset=file.nextOffset;assert.ok(chunks.length<4000);}
  const bytes=Buffer.concat(chunks);assert.equal(bytes.length,total);assert.equal(bytes.subarray(0,4).toString(),'%PDF');return {bytes,chunks:chunks.length};
 }
 const detail=async(id:string)=>(await invoke<{invoice:AdminInvoice}>('GET /api/crm/admin-invoices',false,undefined,{kind:'SALES',id})).invoice;
 async function change(id:string,action:'EDIT'|'CANCEL',edit?:(content:InvoiceContent)=>void){
  const current=await detail(id),content=structuredClone(current.content);edit?.(content);
  if(action==='EDIT'&&current.warehouseSale){
   const policy=current.warehouseSale;
   // Mirror the actual Admin form: changing a percentage recalculates its
   // read-only money fields from frozen prices/VAT before the strict API call.
   content.lines=content.lines.map(line=>{const source=policy.lines.find(l=>l.productId===line.productId);assert.ok(source);const priced=calculateHandoverSaleLine({listUnitPrice:source.listUnitPrice,quantity:line.quantity,discountPercent:line.discountPercent!,vatRate:source.vatRate,includeVat:policy.includeVat});return {...line,unitPrice:source.listUnitPrice,discountPercent:priced.discountPercent,discount:priced.discountAmount,tax:priced.vatAmount};});
  }
  return invoke('POST /api/crm/admin-invoices',true,{kind:'SALES',id,version:current.version,action,...(action==='EDIT'?{content}:{}),reason:'STAGING MCP handover percentage QA only',idempotencyKey:randomUUID()});
 }
 const delivery={giver:'STAGING QA Admin',recipient:'STAGING QA Receiver',recipientPhone:'0900000000',address:'STAGING QA fictional address',deliveryDate:'2026-11-06',carrier:'STAGING QA carrier',customer:'STAGING QA fictional customer'};
 const input=()=>({kind:'ISSUE',issuePurpose:'SALE',saleCustomerId:fixture.customerId,warehouseId:fixture.warehouseId,shippingFee:'5000',includeVat:false,lines:fixture.products.slice(0,2).map((p,i)=>({productId:p.id,quantity:i?'2':'1',discountPercent:i?'7.5':'12.3456'})),delivery,note:'STAGING MCP fictitious sale; no outbound mail',confirm:false,idempotencyKey:randomUUID()});
 let mainSale:FlowSnapshot|undefined,pdfOriginal:Buffer|undefined;
 try{
  await check('MCP capability catalog exposes strict per-line percentage sale, confirmation, PDF, finance and Admin operations',async()=>{
   const sale=operationCatalog('','POST /api/crm/document-flow/save');assert.ok('operations' in sale);assert.equal(sale.operations[0].status,'AVAILABLE');const operation=sale.operations[0];assert.ok('inputContract' in operation);const contract=operation.inputContract;
   assert.match(contract,/discountPercent/);assert.match(contract,/\.strict\(\)/);assert.match(contract,/issuePurpose/);assert.match(contract,/no cash discount|percentage|percent/i);assert.doesNotMatch(contract,/(?:^|[,;{])\s*(?:unitPrice|netUnitPrice|discountAmount)\s*:/m);
   for(const op of ['GET /api/crm/document-flow/view','POST /api/crm/document-flow/confirm','GET /api/crm/document-flow/pdf','POST /api/crm/accountant/record-order-payment','GET /api/crm/spreadsheet/reconciliation','GET /api/crm/admin-invoices','POST /api/crm/admin-invoices']){const catalog=operationCatalog('',op);assert.ok('operations' in catalog&&catalog.operations[0]?.status==='AVAILABLE',op+' unavailable');}
  });
  await check('Native MCP route saves and reloads a draft with independent decimal percentages and rejects cash/price overrides',async()=>{
   const withoutKey:Record<string,unknown>={...input()};delete withoutKey.idempotencyKey;const noKey=await invokeOperation(admin,{operation:'POST /api/crm/accountant/create-handover-invoice',input:withoutKey},true);assert.equal(noKey.status,400);
   const createdDraft=await invoke<{id:string}>('POST /api/crm/document-flow/save',true,input());created.push(createdDraft.id);const draft=await view(createdDraft.id);assert.equal(draft.state,'DRAFT');assert.deepEqual(draft.lines.map(l=>l.discountPercent),['12.3456','7.5']);assert.equal(draft.totals.shipping,'5000');noCredentials(draft,true);mainSale=draft;
   for(const field of ['unitPrice','netUnitPrice','discountAmount']){const bad=input();const result=await invokeOperation(admin,{operation:'POST /api/crm/document-flow/save',input:{...bad,lines:[{...bad.lines[0],[field]:'1'}]}},true);assert.equal(result.ok,false);assert.equal(result.status,400);}
  });
  await check('Native MCP confirmation creates one stock/finance linkage and confirmed read returns exact totals',async()=>{
   assert.ok(mainSale);const key=randomUUID(),request={id:mainSale.id,kind:'ISSUE',version:mainSale.revision,idempotencyKey:key},confirmed=await invoke('POST /api/crm/document-flow/confirm',true,request);assert.deepEqual(await invoke('POST /api/crm/document-flow/confirm',true,request),confirmed);mainSale=await view(mainSale.id);assert.equal(mainSale.state,'CONFIRMED');assert.ok(mainSale.salesOrderId&&mainSale.sourceId);assert.equal(mainSale.settlement?.paid,'0');assert.equal(mainSale.settlement?.remaining,mainSale.totals.total);noCredentials(mainSale,true);evidence.orderId=mainSale.salesOrderId;evidence.handoverId=mainSale.id;
   const extra=await invoke<{id:string}>('POST /api/crm/document-flow/save',true,{...input(),lines:[{productId:fixture.products[0].id,quantity:'1',discountPercent:'0'}],confirm:true});created.push(extra.id);
  });
  await check('MCP downloads the actual immutable customer PDF in bounded chunks',async()=>{
   assert.ok(mainSale);const pdf=await downloadPdf(mainSale.id,mainSale.revision);pdfOriginal=pdf.bytes;assert.ok(pdf.chunks>1);evidence.pdf={bytes:pdf.bytes.length,chunks:pdf.chunks,sha256:createHash('sha256').update(pdfOriginal).digest('hex')};
  });
  await check('MCP data catalog exposes new business provenance with pagination while credentials stay excluded',async()=>{
   const catalog=await dataCatalog(admin);for(const table of ['warehouse_sale_links','warehouse_sale_payment_links','sales_orders','receivables','payment_receipts','payment_allocations'])assert.ok(catalog.tables[table],table+' missing');
   for(const table of ['sessions','mcp_tokens','mfa_credentials','password_reset_tokens'])assert.equal(catalog.tables[table],undefined);
   for(const columns of Object.values(catalog.tables))for(const c of columns)assert.doesNotMatch(c.column,/password|token|secret|ciphertext|api.?key/i);
   const first=await browseData(admin,{table:'warehouse_sale_links',limit:1,offset:0});assert.equal((first.items as unknown[]).length,1);assert.ok(first.nextOffset!==null);const second=await browseData(admin,{table:'warehouse_sale_links',limit:1,offset:first.nextOffset!});assert.equal((second.items as unknown[]).length,1);assert.notDeepEqual(first.items,second.items);noCredentials(first.items);
   await assert.rejects(browseData(admin,{table:'mcp_tokens'}),/MCP_TABLE_NOT_AVAILABLE/);await assert.rejects(browseData(admin,{table:'users',orderBy:'password_hash'}),/MCP_COLUMN_NOT_AVAILABLE/);
  });
  await check('MCP accountant payment writes canonical partial money and live reconciliation reports the same paid amount',async()=>{
   assert.ok(mainSale);const unsafePayment=await invokeOperation(admin,{operation:'POST /api/crm/accountant/record-order-payment',input:{clearanceId:mainSale.sourceId,amount:Number.MAX_SAFE_INTEGER+1,idempotencyKey:randomUUID()}},true);assert.equal(unsafePayment.status,400);
   assert.ok(mainSale);const amount=(BigInt(mainSale.totals.total)/3n).toString();assert.ok(BigInt(amount)>0n);const paymentInput={clearanceId:mainSale.sourceId,amount,paymentMethod:'BANK_TRANSFER',referenceCode:'STAGING QA MCP fictional transfer',paymentDate:'2026-11-06',idempotencyKey:randomUUID()},payment=await invoke<{canonicalFinance:boolean;paidAmount:string;transactionId:string}>('POST /api/crm/accountant/record-order-payment',true,paymentInput);assert.equal(payment.canonicalFinance,true);assert.equal(payment.paidAmount,amount);assert.deepEqual(await invoke('POST /api/crm/accountant/record-order-payment',true,paymentInput),payment);
   const current=await view(mainSale.id);assert.equal(current.settlement?.paid,amount);assert.equal(current.settlement?.remaining,(BigInt(mainSale.totals.total)-BigInt(amount)).toString());assert.equal(current.totals.paid,'0');
   const rec=await invoke<{orders:{orderId:string;paidAmount:string}[];lineItems:{orderId:string;discountPercent:string}[]}>('GET /api/crm/spreadsheet/reconciliation',false,undefined,{warehouseId:fixture.warehouseId});assert.equal(rec.orders.find(o=>o.orderId===mainSale!.salesOrderId)!.paidAmount,amount);assert.ok(rec.lineItems.some(l=>l.orderId===mainSale!.salesOrderId&&l.discountPercent==='12.3456%'));
   const links=await browseData(admin,{table:'warehouse_sale_payment_links',filters:[{column:'payment_id',op:'eq',value:payment.transactionId}],limit:1});assert.equal(links.total,1);noCredentials(links.items);evidence.partialPayment={amount,transactionId:payment.transactionId};
  });
  await check('MCP Admin can edit the canonical sale by percentage, recall it and retain the original PDF and actual payment history',async()=>{
   assert.ok(mainSale);const before=await detail(mainSale.salesOrderId!);assert.ok(before.warehouseSale);assert.equal(before.content.lines[0].discountPercent,'12.3456');await change(mainSale.salesOrderId!,'EDIT',content=>{content.lines[0].discountPercent='15.125';});const after=await detail(mainSale.salesOrderId!);assert.equal(after.content.lines[0].discountPercent,'15.125');
   await change(mainSale.salesOrderId!,'CANCEL');assert.equal((await detail(mainSale.salesOrderId!)).cancelled,true);const canceled=await view(mainSale.id);assert.equal(canceled.settlement?.paid,'0');assert.equal(canceled.settlement?.remaining,'0');
   const pdf=await downloadPdf(mainSale.id,mainSale.revision);assert.deepEqual(pdf.bytes,pdfOriginal);
   const payment=evidence.partialPayment as {transactionId:string;amount:string},rows=await browseData(admin,{table:'payment_receipts',filters:[{column:'id',op:'eq',value:payment.transactionId}],limit:1}),receipt=(rows.items as {amount:string;allocated_amount:string}[])[0];assert.equal(receipt.amount,payment.amount);assert.equal(receipt.allocated_amount,'0');
  });
 }finally{
  // Recall only exact documents created by this script. Preserve every history
  // row and real fixture; a failing assertion must not leave extra QA stock out.
  for(const id of created){try{const current=await view(id);if(current.state==='CONFIRMED'&&current.salesOrderId){const row=await detail(current.salesOrderId);if(!row.cancelled)await change(current.salesOrderId,'CANCEL');}else if(current.state==='DRAFT'){const row=(await invoke<{invoice:AdminInvoice}>('GET /api/crm/admin-invoices',false,undefined,{kind:'FLOW',id})).invoice;if(!row.cancelled)await invoke('POST /api/crm/admin-invoices',true,{kind:'FLOW',id,version:row.version,action:'CANCEL',reason:'STAGING MCP QA cleanup exact created draft',idempotencyKey:randomUUID()});}}catch(e){cases.push({name:'Cleanup exact created QA document '+id,status:'FAIL',error:e instanceof Error?e.message:String(e)});}}
  await fs.mkdir('docs/crm/test-results/handover-sales',{recursive:true});await fs.writeFile(output,JSON.stringify({environment:'STAGING existing isolated PostgreSQL; restricted runtime; native MCP route dispatch; email disabled',database:target.pathname.slice(1),status:cases.length===7&&cases.every(c=>c.status==='PASS')?'PASS':'FAIL',scope:'Native MCP bridge and paginated business data runtime. OAuth transport, browser and production are separate checks.',cases,evidence},null,2)+'\n');await db.close();
 }
}
main().catch(e=>{console.error(e instanceof Error?e.stack:e);process.exitCode=1;});
