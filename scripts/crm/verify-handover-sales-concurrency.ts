import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import type {FlowSnapshot} from '../../lib/crm/document-flow-model';
import type {Principal} from '../../lib/crm/types';

// This test never accepts an application URL, production host or an existing
// fixture. The owner connection is used only to create the isolated fixture and
// install its restricted DML runtime before any concurrency checks.
const target=process.env.CRM_QA_HANDOVER_CONCURRENCY_DATABASE_URL;
if(!target)throw Error('CRM_QA_HANDOVER_CONCURRENCY_DATABASE_URL_REQUIRED');
const url=new URL(target);
if(!['localhost','127.0.0.1'].includes(url.hostname)||url.port!=='55432'||!/^\/cohamy_qa_handover_[a-z0-9_]+$/u.test(url.pathname))throw Error('NEW_ISOLATED_HANDOVER_POSTGRES_REQUIRED');
process.env.CRM_DATABASE_MODE='postgres';process.env.CRM_ENVIRONMENT='STAGING';process.env.CRM_DATABASE_URL=target;process.env.CRM_EMAIL_ENABLED='false';process.env.CRM_QA_DOCUMENT_MAIL='false';
const cases:{name:string;status:'PASS'|'FAIL';error?:string}[]=[];
async function check(name:string,run:()=>Promise<void>){try{await run();cases.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){cases.push({name,status:'FAIL',error:e instanceof Error?e.message:String(e)});throw e;}}
async function main(){
 const {createQaFixture,qaPassword}=await import('./qa-fixture'),{database}=await import('../../lib/crm/db'),{installQaRuntime}=await import('./qa-runtime'),auth=await import('../../lib/crm/auth'),repo=await import('../../lib/crm/repository'),policy=await import('../../lib/crm/order-policy'),sales=await import('../../lib/crm/handover-sales'),finance=await import('../../lib/crm/finance'),correction=await import('../../lib/crm/invoice-admin-finance'),pricing=await import('../../lib/crm/handover-sale-pricing');
 const ids=await createQaFixture(),owner=await database(),close=await installQaRuntime(owner),db=await database();
 try{
  const admin=(await auth.login('admin@crm-qa.invalid',qaPassword)).user,accountant=(await auth.login('accountant@crm-qa.invalid',qaPassword)).user,keeper=(await auth.login('warehouse@crm-qa.invalid',qaPassword)).user;
  const wh=await repo.createWarehouse(admin,{code:'QA-HANDOVER-CONCURRENT',name:'STAGING QA concurrency warehouse',organizationId:admin.organizationId,region:'NORTH'});
  await db.query('INSERT INTO cohamy_crm.warehouse_assignments(membership_id,warehouse_id) VALUES($1,$2)',[keeper.membershipId,wh.id]);
  await policy.saveOrderPolicy(admin,{version:0,definition:{enabled:true,requireOwnerApproval:false,alwaysManagerApproval:false,managerApprovalAmount:null,creditRequiresApproval:false,nonSelfApproval:true,acceptedQuotePrice:'UNTIL_QUOTE_EXPIRY',pendingPrice:'UNTIL_REQUEST_EXPIRY',requiredPartnerFields:[],approvalRoles:['ADMIN','MANAGER'],confirmationRoles:['ADMIN','MANAGER','SALES']},reason:'STAGING QA concurrency only',idempotencyKey:randomUUID()});
  const product=randomUUID();await db.query("INSERT INTO cohamy_crm.products(id,website_id,sku,name,category,weight_label,retail_price,stock_unit,active,vat_rate,translations) VALUES($1,$2,'QA-CONCURRENT','QA concurrent product','QA','QA',90000,'Gói',true,8,'{}'::jsonb)",[product,'qa-concurrency-'+product]);
  async function draft():Promise<FlowSnapshot>{
   const id=randomUUID(),line={productId:product,sku:'QA-CONCURRENT',name:'QA concurrent product',unit:'Gói',quantity:'2',ordered:'2',shipped:'0',received:'0',difference:'0',note:'',catalogVatRate:'8',...pricing.calculateHandoverSaleLine({listUnitPrice:'90000',quantity:'2',discountPercent:'10',vatRate:'8',includeVat:false})};
   const snapshot:FlowSnapshot={id,code:'QA-CONCURRENT-'+id,kind:'ISSUE',revision:1,state:'CONFIRMED',warehouseId:wh.id,warehouseName:'QA concurrency',warehouseCode:'QA-CONCURRENT',factoryMembershipId:null,factoryName:'',sourceId:null,sourceCode:'',sourceRevision:null,requestId:null,requestCode:'',salesOrderId:null,issuePurpose:'SALE',sale:{version:1,customerOrganizationId:ids.dealerA,customerName:'QA fictional customer',shippingFee:'0',includeVat:false},createdAt:new Date().toISOString(),createdBy:'QA actor',confirmedAt:new Date().toISOString(),confirmedBy:'QA actor',dueDate:'',note:'STAGING QA concurrency only',delivery:{recipient:'QA recipient',recipientPhone:'0900000000',address:'QA fictional address'},lines:[line],totals:pricing.calculateHandoverSaleTotals([line],'0')};
   await db.query("INSERT INTO cohamy_crm.warehouse_handover_invoices(id,code,warehouse_id,created_by,workflow_state,flow_payload) VALUES($1,$2,$3,$4,'DRAFT',$5::jsonb)",[id,snapshot.code,wh.id,admin.id,JSON.stringify(snapshot)]);return snapshot;
  }
  // The production caller locks its draft before invoking the helper. Keep that
  // exact boundary here; these checks do not pretend to exercise stock/PDF code.
  const finalize=(user:Principal,s:FlowSnapshot,hold=false)=>db.transaction(async tx=>{await tx.query("SET LOCAL statement_timeout='8s'");await tx.query('SELECT id FROM cohamy_crm.warehouse_handover_invoices WHERE id=$1 FOR UPDATE',[s.id]);const out=await sales.finalizeHandoverSale(tx,user,s);if(hold)await tx.query('SELECT pg_sleep(0.15)');return out;});
  await check('Different actors can finalize two slips on one warehouse without SHARE lock upgrade deadlock',async()=>{
   const a=await draft(),b=await draft(),results=await Promise.all([finalize(admin,a,true),finalize(keeper,b,true)]);assert.notEqual(results[0].salesOrderId,results[1].salesOrderId);assert.equal((await db.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.warehouse_sale_links WHERE handover_id=ANY($1::uuid[])',[[a.id,b.id]])).rows[0].n,'2');
  });
  await check('Concurrent retries of one locked slip create exactly one order and receivable',async()=>{
   const s=await draft(),result=await Promise.all([finalize(admin,s,true),finalize(keeper,s,true)]);assert.equal(result[0].salesOrderId,result[1].salesOrderId);assert.equal((await db.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.receivables WHERE order_id=$1',[result[0].salesOrderId])).rows[0].n,'1');
  });
  await check('Concurrent canonical payments cannot allocate more than the remaining balance',async()=>{
   const sale=await finalize(admin,await draft()),run=(actor:Principal)=>db.transaction(async tx=>{await tx.query("SET LOCAL statement_timeout='8s'");return sales.recordHandoverSalePayment(tx,actor,{clearanceId:sale.sourceId!,amount:'120000',referenceCode:'QA concurrent transfer',idempotencyKey:randomUUID()});}),result=await Promise.allSettled([run(admin),run(accountant)]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);const rejected=result.find(r=>r.status==='rejected') as PromiseRejectedResult;assert.match(String(rejected.reason),/RECEIVABLE_OVERALLOCATED/);const state=(await sales.getHandoverSaleSettlement(db,sale.id))!;assert.equal(state.paid,'120000');assert.equal(state.remaining,'42000');
  });
  await check('Confirmed payment racing Admin recall preserves real money and ends with no allocated debt',async()=>{
   const sale=await finalize(admin,await draft()),result=await Promise.allSettled([db.transaction(async tx=>{await tx.query("SET LOCAL statement_timeout='8s'");return sales.recordHandoverSalePayment(tx,accountant,{clearanceId:sale.sourceId!,amount:'10000',referenceCode:'QA payment recall race',idempotencyKey:randomUUID()});}),db.transaction(async tx=>{await tx.query("SET LOCAL statement_timeout='8s'");return correction.reviseInvoiceReceivables(tx,admin,sale.salesOrderId!,null,'QA concurrent recall finance only');})]);
   assert.equal(result[1].status,'fulfilled');if(result[0].status==='rejected')assert.match(String(result[0].reason),/RECEIVABLE_OVERALLOCATED/);const state=(await sales.getHandoverSaleSettlement(db,sale.id))!;assert.equal(state.paid,'0');assert.equal(state.remaining,'0');const allocations=(await db.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.payment_allocations a WHERE a.receivable_id=$1 AND NOT EXISTS(SELECT 1 FROM cohamy_crm.invoice_allocation_reversals r WHERE r.allocation_id=a.id)',[state.receivableId])).rows[0];assert.equal(allocations.n,'0');
  });
  await check('Native finance allocation racing recall uses the same order lock and never decrements unrelated credit',async()=>{
   const sale=await finalize(admin,await draft()),state=(await sales.getHandoverSaleSettlement(db,sale.id))!;await db.query('INSERT INTO cohamy_crm.credit_accounts(organization_id,limit_amount,used_amount,enabled) VALUES($1,100000,999,true)',[ids.dealerA]);
   const receipt=await finance.createPaymentReceipt(accountant,{organizationId:ids.dealerA,amount:'2500',kind:'PAYMENT',paidAt:new Date().toISOString(),reference:'QA native allocation race',documentVersionId:null,reason:'QA isolated receipt',idempotencyKey:randomUUID()}) as {id:string};await finance.reviewPaymentReceipt(accountant,{id:receipt.id,version:1,decision:'CONFIRM',reason:'QA verified receipt',idempotencyKey:randomUUID()});
   const result=await Promise.allSettled([finance.allocatePayment(accountant,{paymentId:receipt.id,paymentVersion:2,allocations:[{receivableId:state.receivableId!,amount:'2500'}],reason:'QA native allocation',idempotencyKey:randomUUID()}),db.transaction(tx=>correction.reviseInvoiceReceivables(tx,admin,sale.salesOrderId!,null,'QA native payment recall race'))]);assert.equal(result[1].status,'fulfilled');if(result[0].status==='rejected')assert.match(String(result[0].reason),/RECEIVABLE_NOT_ALLOCATABLE|RECEIVABLE_OVERALLOCATED/);assert.equal((await sales.getHandoverSaleSettlement(db,sale.id))!.paid,'0');assert.equal((await db.query<{used_amount:string}>('SELECT used_amount::text FROM cohamy_crm.credit_accounts WHERE organization_id=$1',[ids.dealerA])).rows[0].used_amount,'999');
  });
 }finally{
  await fs.mkdir('docs/crm/test-results/handover-sales',{recursive:true});await fs.writeFile('docs/crm/test-results/handover-sales/finance-concurrency-postgres.json',JSON.stringify({environment:'STAGING isolated PostgreSQL localhost:55432; restricted DML runtime; email disabled',database:url.pathname.slice(1),status:cases.length===5&&cases.every(c=>c.status==='PASS')?'PASS':'INCOMPLETE',scope:'Native finance linkage, allocation and correction concurrency only. No production, stock, PDF or browser coverage claimed.',cases},null,2)+'\n');await close();await owner.close();
 }
}
main().catch(e=>{console.error(e instanceof Error?e.stack:e);process.exitCode=1;});
