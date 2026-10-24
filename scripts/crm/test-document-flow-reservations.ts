import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import type {OrderPolicyDefinition} from '../../lib/crm/order-policy';

// Always create our own database. Never load crm-document-flow-run.json or an app URL.
const postgres=process.argv.includes('--postgres');
const runId=randomUUID().replaceAll('-','');
process.env.CRM_DATABASE_MODE=postgres?'postgres':'pglite';
process.env.CRM_ENVIRONMENT=postgres?'STAGING':'LOCAL';
process.env.CRM_LOCAL_DATA_DIR='.local/crm-qa-flow-reservations-'+runId;
process.env.CRM_DATABASE_URL=postgres?'postgresql://cohamy_qa_owner@127.0.0.1:55432/cohamy_qa_flow_reservations_'+runId:'';
process.env.CRM_EMAIL_ENABLED='false';
process.env.CRM_QA_DOCUMENT_MAIL='false';

type Check={test:string;status:'PASS'|'FAIL';error?:string};
const cases:Check[]=[];
const references:Record<string,string>={};
const evidence:Record<string,unknown>={};
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
async function test(name:string,fn:()=>Promise<void>,independent=false){
 try{await fn();cases.push({test:name,status:'PASS'});console.log('PASS '+name);}
 catch(error){cases.push({test:name,status:'FAIL',error:error instanceof Error?error.message:String(error)});if(!independent)throw error;console.error('FAIL '+name+': '+(error instanceof Error?error.message:String(error)));process.exitCode=1;}
}

async function main(){
 if(postgres){
  const {Client}=await import('pg');
  const admin=new Client({connectionString:'postgresql://cohamy_qa_owner@127.0.0.1:55432/postgres'});
  await admin.connect();
  try{await admin.query('CREATE DATABASE cohamy_qa_flow_reservations_'+runId);}
  finally{await admin.end();}
 }
 const {createQaFixture,qaPassword}=await import('./qa-fixture');
 const {database}=await import('../../lib/crm/db');
 const auth=await import('../../lib/crm/auth');
 const repo=await import('../../lib/crm/repository');
 const fixture=await import('./pricing-fixture');
 const prices=await import('../../lib/crm/pricing');
 const policy=await import('../../lib/crm/order-policy');
 const requests=await import('../../lib/crm/order-requests');
 const orders=await import('../../lib/crm/sales-orders');
 const inventory=await import('../../lib/crm/inventory');
 const fulfillment=await import('../../lib/crm/fulfillment');
 const flow=await import('../../lib/crm/document-flow');
 const ids=await createQaFixture(),owner=await database();
 const {installQaRuntime}=await import('./qa-runtime');
 const close=await installQaRuntime(owner),db=await database();
 const admin=(await auth.login('admin@crm-qa.invalid',qaPassword)).user;
 const sales=(await auth.login('sales@crm-qa.invalid',qaPassword)).user;
 const dealer=(await auth.login('a@crm-qa.invalid',qaPassword)).user;
 await repo.createAccount(admin,{email:'reservation-hn@crm-qa.invalid',role:'WAREHOUSE_HN',displayName:'LOCAL QA · Thủ kho dự trữ HN',password:qaPassword,organizationId:admin.organizationId});
 const keeper=(await auth.login('reservation-hn@crm-qa.invalid',qaPassword)).user;
 const wh=(await repo.listWarehouses(admin)).find(w=>w.region==='NORTH')??await repo.createWarehouse(admin,{code:'KHO-HN',name:'LOCAL QA · Kho dự trữ HN',organizationId:admin.organizationId,region:'NORTH'});
 assert.ok(wh);
 const definition:OrderPolicyDefinition={enabled:true,requireOwnerApproval:false,alwaysManagerApproval:false,managerApprovalAmount:null,creditRequiresApproval:false,nonSelfApproval:true,acceptedQuotePrice:'UNTIL_QUOTE_EXPIRY',pendingPrice:'UNTIL_REQUEST_EXPIRY',requiredPartnerFields:[],approvalRoles:['ADMIN','MANAGER'],confirmationRoles:['ADMIN','MANAGER','SALES'],provisionalReservation:{mode:'AFTER_APPROVAL',ttlMinutes:120,allowPartial:false}};
 const delivery={giver:'LOCAL QA · Người giao',recipient:'LOCAL QA · Người nhận',recipientPhone:'0900000123',address:'LOCAL QA · Địa chỉ kiểm thử',deliveryDate:'2026-10-23',carrier:'LOCAL QA · Xe kiểm thử'};
 let productId='',productB='',locationId='',orderA='',orderB='',clearanceB='',issueId='',reservationA='',reservationB='';
 let originalPdf:Buffer|undefined;
 const makeOrder=async()=>{
  const request=await requests.saveCommercialRequest(dealer,{version:0,organizationId:ids.dealerA,channel:'PORTAL',basket:fixture.qaBasket,delivery:{recipient:delivery.recipient,phone:delivery.recipientPhone,address:delivery.address},note:'QA fictitious reservation integration',idempotencyKey:randomUUID()});
  let head=await requests.commercialRequestAccess(db,dealer,request.id);
  await requests.requestAction(dealer,{id:head.id,version:head.version,versionId:head.latest_version_id,action:'PROPOSE',reason:'QA propose reservation order',idempotencyKey:randomUUID()});
  head=await requests.commercialRequestAccess(db,dealer,head.id);
  const made=await orders.submitSalesRequest(dealer,{id:head.id,version:head.version,versionId:head.latest_version_id,reason:'QA submit reservation order',idempotencyKey:randomUUID()}) as {id:string};
  const sale=await orders.salesOrderAccess(db,sales,made.id);
  await orders.salesOrderAction(sales,{id:sale.id,version:sale.version,versionId:sale.latest_version_id,action:'CONFIRM',reason:'QA confirm reservation order',idempotencyKey:randomUUID()});
  const clearance=(await db.query<{id:string;warehouse_id:string;order_id:string}>('SELECT id,warehouse_id,order_id FROM cohamy_crm.accounting_order_clearances WHERE request_id=$1',[request.id])).rows[0];
  assert.equal(clearance.order_id,made.id);assert.equal(clearance.warehouse_id,wh.id);
  await inventory.reserveOrder(admin,{orderId:made.id,warehouseId:wh.id,minimumShelfLifeDays:0,reason:'QA reserve exact confirmed order',idempotencyKey:randomUUID()});
  const reservation=(await inventory.orderInventoryState(admin,made.id)).rows;
  assert.equal(reservation.length,1);assert.equal(Number(reservation[0].quantity),24);
  return {orderId:made.id,clearanceId:clearance.id,reservationId:reservation[0].id};
 };
 const packLegacyTrip=async(orderId:string,reservationId:string)=>{
  const planned=await fulfillment.createDelivery(admin,{orderId,lines:[{reservationId,quantity:'12'}],windowStart:null,windowEnd:null,requirements:'QA existing partial plan',reason:'QA delivery planned before new issue',idempotencyKey:randomUUID()}) as {id:string};
  let current=(await fulfillment.orderFulfillment(admin,orderId)).deliveries.find(d=>d.id===planned.id)!;
  await fulfillment.pickDelivery(admin,{id:current.id,version:current.version,lineId:current.lines[0].id,quantity:'12',scannerCode:'QA-FLOW-RESERVATION-LOT',manual:false,reason:'QA existing picked plan',idempotencyKey:randomUUID()});
  current=(await fulfillment.orderFulfillment(admin,orderId)).deliveries.find(d=>d.id===planned.id)!;
  const parcel=await fulfillment.packParcel(admin,{id:current.id,version:current.version,label:'QA existing parcel',lines:[{lineId:current.lines[0].id,quantity:'12'}],reason:'QA existing packed plan',idempotencyKey:randomUUID()}) as {id:string};
  return await fulfillment.createTrip(admin,{parcelIds:[parcel.id],driverName:'QA Driver',driverPhone:'0900000123',routeNote:'QA only',reason:'QA old planned trip',idempotencyKey:randomUUID()}) as {id:string;version:number};
 };
 const state=async()=>({
  balances:(await db.query<{location_id:string;lot_id:string;on_hand:string;reserved:string}>('SELECT location_id,lot_id,on_hand::text,reserved::text FROM cohamy_crm.inventory_balances WHERE warehouse_id=$1 AND product_id=$2 ORDER BY location_id,lot_id',[wh.id,productId])).rows,
  reservations:(await db.query<{id:string;quantity:string;consumed:string;released:string;status:string}>('SELECT id,quantity::text,consumed::text,released::text,status FROM cohamy_crm.inventory_reservations WHERE warehouse_id=$1 AND product_id=$2 ORDER BY id',[wh.id,productId])).rows,
  movements:(await db.query<{n:string;q:string}>('SELECT count(*)::text AS n,COALESCE(sum(quantity),0)::text AS q FROM cohamy_crm.inventory_movements WHERE warehouse_id=$1 AND product_id=$2',[wh.id,productId])).rows[0],
 });
 const check=async(onHand:number,reserved:number,consumedA:number)=>{
  const current=await state();assert.equal(current.balances.length,1,'Corrections must restore the original reservation lot');
  assert.equal(Number(current.balances[0].on_hand),onHand);assert.equal(Number(current.balances[0].reserved),reserved);
  const a=current.reservations.find(r=>r.id===reservationA)!,b=current.reservations.find(r=>r.id===reservationB)!;
  assert.equal(Number(a.consumed),consumedA);assert.equal(Number(a.released),0);assert.equal(a.status,consumedA===24?'CONSUMED':consumedA===0?'ACTIVE':'PARTIAL');
  assert.equal(Number(b.consumed),0);assert.equal(Number(b.released),0);assert.equal(Number(b.quantity),24);assert.equal(b.status,'ACTIVE');
  assert.equal(current.reservations.reduce((n,r)=>n+Number(r.quantity)-Number(r.consumed)-Number(r.released),0),reserved);
  assert.equal(Number(current.movements.q),onHand);assert.ok(reserved>=0&&onHand>=reserved);
  const linked=(await db.query<{q:string}>('SELECT COALESCE(sum(consumed),0)::text AS q FROM cohamy_crm.document_flow_reservation_links WHERE entity_id=$1',[issueId])).rows[0];
  assert.equal(Number(linked.q),consumedA);return current;
 };
 const amend=(version:number,quantity:string)=>flow.amendFlowDocument(admin,{id:issueId,kind:'ISSUE',version,lines:[{productId,quantity}],note:'QA stock correction '+quantity,reason:'QA independent warehouse quantity correction',idempotencyKey:randomUUID()});
 try{
  let a:{orderId:string;clearanceId:string;reservationId:string};
  await test('Two real confirmed sales orders reserve their own 24 units from one 60-unit lot',async()=>{
   [productId,productB]=await fixture.createPriceProducts(admin);
   const book=await prices.savePriceBook(admin,{version:0,name:'QA document-flow reservations',definition:fixture.qaPriceDefinition,idempotencyKey:randomUUID()});
   await prices.publishPriceBook(admin,{id:book.id,version:book.version,versionId:book.versionId,action:'PUBLISH',reason:'QA only price definition',idempotencyKey:randomUUID()});
   await policy.saveOrderPolicy(admin,{version:0,definition,reason:'QA explicit reservation policy',idempotencyKey:randomUUID()});
   locationId=(await inventory.createLocation(admin,{warehouseId:wh.id,code:'QA_FLOW_RESERVED',name:'LOCAL QA · Kệ dự trữ',kind:'PICK',idempotencyKey:randomUUID()}) as {id:string}).id;
   await inventory.postReceipt(admin,{locationId,lines:[{productId,lotCode:'QA-FLOW-RESERVATION-LOT',manufacturedOn:null,expiresOn:null,quantity:'60'}],referenceType:'qa-flow-reservations',referenceId:runId,reason:'QA fictitious initial inventory',idempotencyKey:randomUUID()});
   a=await makeOrder();const b=await makeOrder();orderA=a.orderId;orderB=b.orderId;clearanceB=b.clearanceId;reservationA=a.reservationId;reservationB=b.reservationId;
   Object.assign(references,{orderA,orderB,reservationA,reservationB,warehouseId:wh.id,productId});
   const current=await state();assert.equal(Number(current.balances[0].on_hand),60);assert.equal(Number(current.balances[0].reserved),48);
  });
  await test('Partial ISSUE consumes its own reservation and retry posts no second movement',async()=>{
   const input={kind:'ISSUE',warehouseId:wh.id,clearanceId:a!.clearanceId,lines:[{productId,quantity:'12'}],delivery,confirm:true,idempotencyKey:randomUUID()};
   const issue=await flow.saveFlowDocument(keeper,input);issueId=issue.id;references.issueId=issueId;
   const before=await check(48,36,12);assert.deepEqual(await flow.saveFlowDocument(keeper,input),issue);assert.deepEqual(await check(48,36,12),before);
   originalPdf=Buffer.from((await flow.downloadFlowPdf(admin,issueId,1)).bytes);assert.equal(originalPdf.subarray(0,5).toString(),'%PDF-');evidence.originalPdfSha256=digest(originalPdf);
  });
  await test('ADMIN decrease restores original lot and reservation; increase consumes only the extra quantity',async()=>{
   const down=await amend(1,'8');assert.equal(down.version,2);await check(52,40,8);
   const up=await amend(2,'16');assert.equal(up.version,3);await check(44,32,16);
   const adjustments=(await db.query<{revision:number;delta:string}>('SELECT revision,delta::text FROM cohamy_crm.document_flow_reservation_adjustments WHERE entity_id=$1 ORDER BY revision',[issueId])).rows;
   assert.deepEqual(adjustments.map(r=>[r.revision,Number(r.delta)]),[[1,12],[2,-4],[3,8]]);evidence.reservationAdjustments=adjustments;
  });
  await test('Correction retains original PDF bytes and rejects excess/stale revisions atomically',async()=>{
   const old=await flow.downloadFlowPdf(admin,issueId,1);assert.deepEqual(old.bytes,originalPdf);assert.equal(old.snapshot.lines[0].quantity,'12');assert.equal(digest(old.bytes),evidence.originalPdfSha256);
   await assert.rejects(flow.downloadFlowPdf(admin,issueId,99),/NOT_FOUND/);
   const before=await state();await assert.rejects(amend(3,'25'),/ORDER_QUANTITY_EXCEEDED/);assert.deepEqual(await state(),before);
   await assert.rejects(amend(1,'10'),/VERSION_CONFLICT/);assert.deepEqual(await state(),before);
   const now=await flow.downloadFlowPdf(admin,issueId,3);assert.equal(now.snapshot.lines[0].quantity,'16');assert.notEqual(digest(now.bytes),evidence.originalPdfSha256);
  });
  await test('Other order reservations block unrelated ISSUE; legacy consume cannot deduct the issued order again',async()=>{
   const before=await state();
   await assert.rejects(flow.saveFlowDocument(keeper,{kind:'ISSUE',warehouseId:wh.id,lines:[{productId,quantity:'13'}],delivery:{...delivery,customer:'LOCAL QA · Unrelated customer'},confirm:true,idempotencyKey:randomUUID()}),/INVENTORY_INSUFFICIENT/);
   assert.deepEqual(await state(),before);
   await assert.rejects(inventory.consumeOrderReservations(admin,{orderId:orderA,reason:'QA old consume must not double-issue',idempotencyKey:randomUUID()}),/ORDER_ISSUED_BY_DOCUMENT_FLOW/);
   assert.deepEqual(await state(),before);
  });
  await test('Final correction consumes own remaining reservation without taking the other order stock',async()=>{
   const full=await amend(3,'24');assert.equal(full.version,4);evidence.finalState=await check(36,24,24);
   const old=await flow.downloadFlowPdf(admin,issueId,1);assert.deepEqual(old.bytes,originalPdf);
   await assert.rejects(flow.saveFlowDocument(keeper,{kind:'ISSUE',warehouseId:wh.id,clearanceId:a!.clearanceId,lines:[{productId,quantity:'1'}],delivery,confirm:true,idempotencyKey:randomUUID()}),/ORDER_QUANTITY_EXCEEDED/);
   await check(36,24,24);
  });
  await test('Prepacked legacy partial fulfillment cannot dispatch the same order after ISSUE takes ownership',async()=>{
   await inventory.postReceipt(admin,{locationId,lines:[{productId,lotCode:'QA-FLOW-RESERVATION-LOT',manufacturedOn:null,expiresOn:null,quantity:'24'}],referenceType:'qa-flow-reservations',referenceId:runId+'-partial',reason:'QA stock for mixed-flow guard',idempotencyKey:randomUUID()});
   const c=await makeOrder();references.mixedFlowOrder=c.orderId;
   const trip=await packLegacyTrip(c.orderId,c.reservationId);
   const issue=await flow.saveFlowDocument(keeper,{kind:'ISSUE',warehouseId:wh.id,clearanceId:c.clearanceId,lines:[{productId,quantity:'12'}],delivery,confirm:true,idempotencyKey:randomUUID()});references.mixedFlowIssue=issue.id;
   const before=await state();
   try{await assert.rejects(fulfillment.dispatchTrip(admin,{id:trip.id,version:trip.version,reason:'QA legacy trip cannot issue overlap',idempotencyKey:randomUUID()}),/ORDER_ISSUED_BY_DOCUMENT_FLOW/);}
   finally{evidence.mixedFlowGuard={before,after:await state(),reservation:await inventory.orderInventoryState(admin,c.orderId)};}
   assert.deepEqual(await state(),before);
   const reserved=(await inventory.orderInventoryState(admin,c.orderId));assert.equal(Number(reserved.consumed),12);
   assert.equal(Number((await db.query<{q:string}>("SELECT COALESCE(sum(m.quantity),0)::text AS q FROM cohamy_crm.inventory_movements m WHERE m.source_order_id=$1",[c.orderId])).rows[0].q),-12);
  },true);
  if(postgres)await test('Concurrent PostgreSQL ISSUE and legacy dispatch serialize and only one deducts stock',async()=>{
   await inventory.postReceipt(admin,{locationId,lines:[{productId,lotCode:'QA-FLOW-RESERVATION-LOT',manufacturedOn:null,expiresOn:null,quantity:'24'}],referenceType:'qa-flow-reservations',referenceId:runId+'-race',reason:'QA stock for mixed-flow race',idempotencyKey:randomUUID()});
   const d=await makeOrder(),trip=await packLegacyTrip(d.orderId,d.reservationId),before=await state();references.raceOrder=d.orderId;
   const outcomes=await Promise.allSettled([
    flow.saveFlowDocument(keeper,{kind:'ISSUE',warehouseId:wh.id,clearanceId:d.clearanceId,lines:[{productId,quantity:'12'}],delivery,confirm:true,idempotencyKey:randomUUID()}),
    fulfillment.dispatchTrip(admin,{id:trip.id,version:trip.version,reason:'QA race legacy dispatch against new issue',idempotencyKey:randomUUID()}),
   ]);
   const after=await state();evidence.concurrentGuard={outcomes:outcomes.map(r=>r.status==='fulfilled'?{status:r.status,value:r.value}:{status:r.status,error:r.reason instanceof Error?r.reason.message:String(r.reason)}),before,after};
   assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
   const rejected=outcomes.find(r=>r.status==='rejected') as PromiseRejectedResult;
   assert.match(rejected.reason instanceof Error?rejected.reason.message:String(rejected.reason),/ORDER_ISSUED_BY_DOCUMENT_FLOW|ORDER_ALREADY_ISSUED_BY_OTHER_FLOW/);
   assert.equal(Number(before.balances[0].on_hand)-Number(after.balances[0].on_hand),12);
   assert.equal(Number(before.balances[0].reserved)-Number(after.balances[0].reserved),12);
   assert.equal(Number((await inventory.orderInventoryState(admin,d.orderId)).consumed),12);
   assert.equal(Number((await db.query<{q:string}>('SELECT sum(quantity)::text AS q FROM cohamy_crm.inventory_movements WHERE source_order_id=$1',[d.orderId])).rows[0].q),-12);
  },true);
  await test('Standalone ISSUE excludes physically present stock held in quarantine',async()=>{
   const quarantine=await inventory.createLocation(admin,{warehouseId:wh.id,code:'QA_FLOW_QUARANTINE',name:'LOCAL QA · Cách ly',kind:'QUARANTINE',idempotencyKey:randomUUID()}) as {id:string};
   await inventory.postReceipt(admin,{locationId:quarantine.id,lines:[{productId:productB,lotCode:'QA-FLOW-QUARANTINE',manufacturedOn:null,expiresOn:null,quantity:'10'}],referenceType:'qa-flow-reservations',referenceId:runId+'-quarantine',reason:'QA isolated unsellable stock',idempotencyKey:randomUUID()});
   const quarantineState=async()=>({balances:(await db.query('SELECT on_hand::text,reserved::text FROM cohamy_crm.inventory_balances WHERE product_id=$1',[productB])).rows,movements:(await db.query('SELECT quantity::text FROM cohamy_crm.inventory_movements WHERE product_id=$1 ORDER BY id',[productB])).rows,issues:(await db.query('SELECT id FROM cohamy_crm.warehouse_handover_invoices ORDER BY id')).rows});
   const before=await quarantineState();
   try{await assert.rejects(flow.saveFlowDocument(keeper,{kind:'ISSUE',warehouseId:wh.id,lines:[{productId:productB,quantity:'1'}],delivery:{...delivery,customer:'LOCAL QA · Quarantine guard'},confirm:true,idempotencyKey:randomUUID()}),/INVENTORY_INSUFFICIENT/);}
   finally{evidence.quarantineGuard={before,after:await quarantineState()};}
   assert.deepEqual(await quarantineState(),before);
  },true);
  await test('A later lot recall blocks consumption of an earlier valid order reservation',async()=>{
   const lotId=(await state()).balances[0].lot_id;
   await inventory.openRecall(admin,{lotId,reason:'QA recalled after a valid reservation',idempotencyKey:randomUUID()});
   const before=await state();
   try{await assert.rejects(flow.saveFlowDocument(keeper,{kind:'ISSUE',warehouseId:wh.id,clearanceId:clearanceB,lines:[{productId,quantity:'12'}],delivery,confirm:true,idempotencyKey:randomUUID()}),/LOT_BLOCKED|INVENTORY_INSUFFICIENT|RESERVATION_NOT_ISSUABLE|RESERVATION_STOCK_UNAVAILABLE|RESERVATION_STOCK_INELIGIBLE/);}
   finally{evidence.recalledReservationGuard={before,after:await state()};}
   assert.deepEqual(await state(),before);assert.equal(Number((await inventory.orderInventoryState(admin,orderB)).consumed),0);
  },true);
 }finally{
  await fs.mkdir('docs/crm/test-results/document-flow',{recursive:true});
  await fs.writeFile('docs/crm/test-results/document-flow/reservations-'+(postgres?'postgres':'pglite')+'.json',JSON.stringify({testedAt:new Date().toISOString(),environment:postgres?'LOCAL isolated native PostgreSQL / DML runtime role':'LOCAL isolated PGlite',database:postgres?new URL(process.env.CRM_DATABASE_URL!).pathname:process.env.CRM_LOCAL_DATA_DIR,emailProvider:'DISABLED; no mail worker invoked',status:cases.length===(postgres?10:9)&&cases.every(c=>c.status==='PASS')?'PASS':'FAIL',references,evidence,cases},null,2));
  await close();await owner.close();
 }
}
main().catch(error=>{console.error(error instanceof Error?error.stack??error.message:String(error));process.exitCode=1;});
