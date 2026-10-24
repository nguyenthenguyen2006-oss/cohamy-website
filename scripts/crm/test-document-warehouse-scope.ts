import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import type {Principal} from '../../lib/crm/types';
import type {OrderPolicyDefinition} from '../../lib/crm/order-policy';

// This harness always creates a fresh LOCAL fixture; it never opens the app database.
const runId=randomUUID().replaceAll('-','');
process.env.CRM_DATABASE_MODE='pglite';
process.env.CRM_ENVIRONMENT='LOCAL';
process.env.CRM_LOCAL_DATA_DIR='.local/crm-qa-document-scope-'+runId;
process.env.CRM_DATABASE_URL='';
process.env.CRM_EMAIL_ENABLED='false';
process.env.CRM_QA_DOCUMENT_MAIL='false';
const cases:{test:string;status:'PASS'|'FAIL';error?:string}[]=[];
const references:Record<string,string>={};
async function test(name:string,run:()=>Promise<void>){
 try{await run();cases.push({test:name,status:'PASS'});console.log('PASS '+name);}
 catch(error){cases.push({test:name,status:'FAIL',error:error instanceof Error?error.message:String(error)});throw error;}
}

async function main(){
 const {createQaFixture,qaPassword}=await import('./qa-fixture'),{database}=await import('../../lib/crm/db');
 const auth=await import('../../lib/crm/auth'),repo=await import('../../lib/crm/repository'),inventory=await import('../../lib/crm/inventory');
 const {warehouseScope}=await import('../../lib/crm/warehouse-scope'),orders=await import('../../lib/crm/sales-orders');
 const consignment=await import('../../lib/crm/consignment'),pricing=await import('../../lib/crm/pricing'),fixture=await import('./pricing-fixture');
 const requests=await import('../../lib/crm/order-requests'),policy=await import('../../lib/crm/order-policy');
 const ids=await createQaFixture(),db=await database();
 const admin=(await auth.login('admin@crm-qa.invalid',qaPassword)).user,dealer=(await auth.login('a@crm-qa.invalid',qaPassword)).user,sales=(await auth.login('sales@crm-qa.invalid',qaPassword)).user;
 const createWarehouse=async(code:string,organizationId=admin.organizationId,region:'NORTH'|'SOUTH'='NORTH')=>(await repo.createWarehouse(admin,{code,name:'LOCAL QA · '+code,organizationId,region})).id;
 const a=await createWarehouse('QA_SCOPE_A'),b=await createWarehouse('QA_SCOPE_B'),south=await createWarehouse('QA_SCOPE_SOUTH',admin.organizationId,'SOUTH');
 await db.query("UPDATE cohamy_crm.warehouses SET region='NORTH' WHERE id=$1",[ids.warehouseA]);
 await db.query("UPDATE cohamy_crm.organizations SET region='NORTH' WHERE id=$1",[ids.dealerA]);
 for(const [email,role] of [['scope-regional@crm-qa.invalid','WAREHOUSE_HN'],['scope-custody@crm-qa.invalid','WAREHOUSE_HN']] as const)await repo.createAccount(admin,{email,role,displayName:'LOCAL QA · '+email,password:qaPassword,organizationId:admin.organizationId});
 const keeper=(await auth.login('scope-regional@crm-qa.invalid',qaPassword)).user,custody=(await auth.login('scope-custody@crm-qa.invalid',qaPassword)).user;
 const assign=async(user:Principal,warehouses:string[])=>{await db.query('DELETE FROM cohamy_crm.warehouse_assignments WHERE membership_id=$1',[user.membershipId]);for(const id of warehouses)await db.query('INSERT INTO cohamy_crm.warehouse_assignments(membership_id,warehouse_id) VALUES($1,$2)',[user.membershipId,id]);};
 const visible=async(user:Principal,offset=0)=>{const scope=warehouseScope(user,'w',offset);return(await db.query<{id:string}>(`SELECT w.id FROM cohamy_crm.warehouses w WHERE ${offset?'w.id<>$1 AND ':''}(${scope.sql}) ORDER BY w.id`,[...(offset?[randomUUID()]:[]),...scope.params])).rows.map(x=>x.id);};
 let product='',locationA='',locationB='',lot='',orderA='',orderB='',agreementId='',agreementVersion='',shipmentA='',shipmentB='',batchA='',batchB='';
 Object.assign(references,{warehouseA:a,warehouseB:b,south,dealerCustody:ids.warehouseA});
 try{
  await test('Regional defaults apply only without assignments; explicit own/dealer custody sets win',async()=>{
   await assign(keeper,[]);const fallback=await visible(keeper);assert.ok(fallback.includes(a)&&fallback.includes(b));assert.ok(!fallback.includes(south)&&!fallback.includes(ids.warehouseA));
   await assign(keeper,[a]);assert.deepEqual(await visible(keeper),[a]);assert.deepEqual(await visible(keeper,1),[a]);
   await assign(keeper,[a,ids.warehouseA]);assert.deepEqual((await visible(keeper)).sort(),[a,ids.warehouseA].sort());
   const adminIds=await visible(admin);assert.ok(adminIds.includes(ids.warehouseA)&&adminIds.includes(a));
   assert.deepEqual(await visible(dealer),[ids.warehouseA]);await assign(keeper,[a]);
  });
  await test('Warehouse list reads and warehouse creation preserve existing explicit subsets',async()=>{
   const before=(await db.query('SELECT * FROM cohamy_crm.warehouse_assignments WHERE membership_id=$1 ORDER BY warehouse_id',[keeper.membershipId])).rows;
   assert.deepEqual((await repo.listWarehouses(keeper)).map(w=>w.id),[a]);await repo.listWarehouses(keeper);
   await createWarehouse('QA_SCOPE_NEW');assert.deepEqual((await repo.listWarehouses(keeper)).map(w=>w.id),[a]);
   assert.deepEqual((await db.query('SELECT * FROM cohamy_crm.warehouse_assignments WHERE membership_id=$1 ORDER BY warehouse_id',[keeper.membershipId])).rows,before);
  });
  await test('Inventory/location APIs filter another warehouse in the same region',async()=>{
   [product]=await fixture.createPriceProducts(admin);
   locationA=(await inventory.createLocation(admin,{warehouseId:a,code:'PICK',name:'LOCAL QA · Source A',kind:'PICK',idempotencyKey:randomUUID()}) as {id:string}).id;
   locationB=(await inventory.createLocation(admin,{warehouseId:b,code:'PICK',name:'LOCAL QA · Source B',kind:'PICK',idempotencyKey:randomUUID()}) as {id:string}).id;
   const expiresOn=new Date(Date.now()+5*86400000).toISOString().slice(0,10);
   for(const locationId of [locationA,locationB])await inventory.postReceipt(admin,{locationId,lines:[{productId:product,lotCode:'QA-SCOPE-LOT',manufacturedOn:null,expiresOn,quantity:'200'}],referenceType:'qa-scope',referenceId:runId,reason:'QA fictitious initial stock',idempotencyKey:randomUUID()});
   lot=(await inventory.listInventory(admin)).find(x=>x.location_id===locationA)!.lot_id;
   assert.ok((await inventory.listInventory(keeper)).every(x=>x.warehouse_id===a));
   assert.ok((await inventory.listLocations(keeper)).every(x=>x.warehouse_id===a));
   assert.ok((await inventory.listTransferDestinationLocations(keeper)).every(x=>x.warehouse_id===a));
  });
  const makeOrder=async()=>{
   const request=await requests.saveCommercialRequest(dealer,{version:0,organizationId:ids.dealerA,channel:'PORTAL',basket:fixture.qaBasket,delivery:{recipient:'LOCAL QA · Buyer',phone:'0900000123',address:'LOCAL QA · Buyer address'},note:'LOCAL QA · Scope order',idempotencyKey:randomUUID()});
   let head=await requests.commercialRequestAccess(db,dealer,request.id);
   await requests.requestAction(dealer,{id:head.id,version:head.version,versionId:head.latest_version_id,action:'PROPOSE',reason:'QA propose exact source',idempotencyKey:randomUUID()});
   head=await requests.commercialRequestAccess(db,dealer,head.id);
   const made=await orders.submitSalesRequest(dealer,{id:head.id,version:head.version,versionId:head.latest_version_id,reason:'QA submit exact source',idempotencyKey:randomUUID()}) as {id:string};
   const sale=await orders.salesOrderAccess(db,sales,made.id);
   await orders.salesOrderAction(sales,{id:sale.id,version:sale.version,versionId:sale.latest_version_id,action:'CONFIRM',reason:'QA confirm exact source',idempotencyKey:randomUUID()});return made.id;
  };
  await test('Sales scope uses buyer versus seller correctly and rejects other-warehouse allocations',async()=>{
   const book=await pricing.savePriceBook(admin,{version:0,name:'LOCAL QA · Scope pricing',definition:fixture.qaPriceDefinition,idempotencyKey:randomUUID()});
   await pricing.publishPriceBook(admin,{id:book.id,version:book.version,versionId:book.versionId,action:'PUBLISH',reason:'QA scope price fixture',idempotencyKey:randomUUID()});
   const definition:OrderPolicyDefinition={enabled:true,requireOwnerApproval:false,alwaysManagerApproval:false,managerApprovalAmount:null,creditRequiresApproval:false,nonSelfApproval:true,acceptedQuotePrice:'UNTIL_QUOTE_EXPIRY',pendingPrice:'UNTIL_REQUEST_EXPIRY',requiredPartnerFields:[],approvalRoles:['ADMIN','MANAGER'],confirmationRoles:['ADMIN','MANAGER','SALES'],provisionalReservation:{mode:'AFTER_APPROVAL',ttlMinutes:120,allowPartial:false}};
   await policy.saveOrderPolicy(admin,{version:0,definition,reason:'QA scope explicit reservation policy',idempotencyKey:randomUUID()});
   orderA=await makeOrder();orderB=await makeOrder();
   const head=await orders.salesOrderAccess(db,keeper,orderA);assert.equal(head.organization_id,ids.dealerA);assert.equal(head.seller_organization_id,admin.organizationId);
   for(const [orderId,warehouseId] of [[orderA,a],[orderB,b]])await inventory.reserveOrder(admin,{orderId,warehouseId,reason:'QA scope reservation',idempotencyKey:randomUUID()});
   assert.equal((await orders.salesOrderAccess(db,keeper,orderA)).id,orderA);await assert.rejects(orders.salesOrderAccess(db,keeper,orderB),/NOT_FOUND/);
   assert.ok(!(await orders.listSalesOrders(keeper)).some(x=>x.id===orderB));
   await db.query("UPDATE cohamy_crm.inventory_reservations SET consumed=quantity,status='CONSUMED' WHERE order_id=$1",[orderB]);
   await assert.rejects(orders.salesOrderAccess(db,keeper,orderB),/NOT_FOUND/);
  });
  await test('Reservation read filters mixed warehouses and whole-order transitions reject atomically',async()=>{
   const r=(await db.query<{id:string;order_version_id:string}>('SELECT id,order_version_id FROM cohamy_crm.inventory_reservations WHERE order_id=$1',[orderA])).rows[0];
   await db.query('UPDATE cohamy_crm.inventory_reservations SET quantity=12 WHERE id=$1',[r.id]);
   await db.query('UPDATE cohamy_crm.inventory_balances SET reserved=12 WHERE warehouse_id=$1 AND product_id=$2',[a,product]);
   await db.query('INSERT INTO cohamy_crm.inventory_reservations(id,order_id,order_version_id,warehouse_id,location_id,product_id,lot_id,quantity) VALUES($1,$2,$3,$4,$5,$6,$7,12)',[randomUUID(),orderA,r.order_version_id,b,locationB,product,lot]);
   await db.query('UPDATE cohamy_crm.inventory_balances SET reserved=reserved+12 WHERE warehouse_id=$1 AND product_id=$2',[b,product]);
   assert.equal((await inventory.orderInventoryState(keeper,orderA)).rows.length,1);assert.equal((await inventory.orderInventoryState(admin,orderA)).rows.length,2);
   const state=async()=>({balances:(await db.query('SELECT * FROM cohamy_crm.inventory_balances WHERE product_id=$1 ORDER BY warehouse_id,location_id',[product])).rows,reservations:(await db.query('SELECT * FROM cohamy_crm.inventory_reservations WHERE order_id=$1 ORDER BY id',[orderA])).rows});
   const before=await state();await assert.rejects(inventory.releaseOrderReservations(keeper,{orderId:orderA,reason:'QA forbidden mixed release',idempotencyKey:randomUUID()}),/NOT_FOUND/);assert.deepEqual(await state(),before);
   await assert.rejects(inventory.consumeOrderReservations(keeper,{orderId:orderA,reason:'QA forbidden mixed consume',idempotencyKey:randomUUID()}),/NOT_FOUND/);assert.deepEqual(await state(),before);
  });
  await test('Consignment keeps dealer custody distinct from assigned Cohamy source stock',async()=>{
   const custodianB=await createWarehouse('QA_SCOPE_CUSTODY_B',ids.dealerA);await assign(custody,[custodianB]);references.custodianB=custodianB;
   const made=await consignment.saveAgreement(admin,{organizationId:ids.dealerA,version:0,snapshot:{startsOn:'2026-01-01',endsOn:null,settlementDays:30,partnerBasisPoints:2000,lines:[ids.warehouseA,custodianB].map(custodianWarehouseId=>({productId:product,custodianWarehouseId,minStock:'1',replenishTo:'5',slowDays:1,nearExpiryDays:30}))},reason:'QA dual custody agreement',idempotencyKey:randomUUID()}) as {id:string;version:number;versionId:string};
   agreementId=made.id;agreementVersion=made.versionId;
   for(const user of [admin,dealer])await consignment.acceptAgreement(user,{id:made.id,version:made.version,versionId:made.versionId,reason:'QA bilateral scope agreement',idempotencyKey:randomUUID()});
   const ship=async(user:Principal,sourceLocationId:string,custodianWarehouseId:string)=>(await consignment.shipConsignment(user,{agreementId,agreementVersionId:agreementVersion,lines:[{sourceLocationId,productId:product,lotId:lot,custodianWarehouseId,quantity:'2'}],reason:'QA bounded source shipment',idempotencyKey:randomUUID()}) as {id:string}).id;
   shipmentA=await ship(keeper,locationA,ids.warehouseA);shipmentB=await ship(admin,locationB,custodianB);
   const stockBefore=(await inventory.listInventory(admin)).find(x=>x.location_id===locationB)!.on_hand;
   await assert.rejects(ship(keeper,locationB,custodianB),/SOURCE_LOCATION_INVALID/);assert.equal((await inventory.listInventory(admin)).find(x=>x.location_id===locationB)!.on_hand,stockBefore);
   const aView=await consignment.consignmentOverview(keeper),custodyView=await consignment.consignmentOverview(custody),dealerView=await consignment.consignmentOverview(dealer);
   assert.deepEqual(aView.batches.map(x=>x.shipment_id),[shipmentA]);assert.deepEqual(custodyView.batches.map(x=>x.shipment_id),[shipmentB]);assert.equal(dealerView.batches.length,2);
   assert.deepEqual(aView.shipments.map(x=>(x as {id:string}).id),[shipmentA]);assert.deepEqual(custodyView.shipments.map(x=>(x as {id:string}).id),[shipmentB]);
   batchA=dealerView.batches.find(x=>x.shipment_id===shipmentA)!.id;batchB=dealerView.batches.find(x=>x.shipment_id===shipmentB)!.id;
  });
  await test('Consignment return destination scope rejects another same-region warehouse without partial writes',async()=>{
   await consignment.receiveConsignment(dealer,{shipmentId:shipmentB,version:1,lines:[{batchId:batchB,received:'2',damaged:'0',short:'0'}],final:true,reason:'QA custody receives own shipment',idempotencyKey:randomUUID()});
   const ret=await consignment.requestConsignmentReturn(dealer,{agreementId,lines:[{batchId:batchB,quantity:'1'}],reason:'QA near-expiry return',idempotencyKey:randomUUID()}) as {id:string};
   await consignment.actConsignmentReturn(admin,{id:ret.id,version:1,action:'APPROVE',destinationLocationId:null,received:[],reason:'QA return authorized',idempotencyKey:randomUUID()});
   await consignment.actConsignmentReturn(dealer,{id:ret.id,version:2,action:'SHIP',destinationLocationId:null,received:[],reason:'QA custody ships return',idempotencyKey:randomUUID()});
   const line=(await db.query<{id:string;received:string}>('SELECT id,received::text FROM cohamy_crm.consignment_return_lines WHERE return_id=$1',[ret.id])).rows[0];
   await assert.rejects(consignment.actConsignmentReturn(keeper,{id:ret.id,version:3,action:'RECEIVE',destinationLocationId:locationB,received:[{lineId:line.id,quantity:'1'}],reason:'QA forbidden other destination',idempotencyKey:randomUUID()}),/RETURN_LOCATION_INVALID/);
   assert.equal((await db.query<{received:string}>('SELECT received::text FROM cohamy_crm.consignment_return_lines WHERE id=$1',[line.id])).rows[0].received,line.received);
   const received=await consignment.actConsignmentReturn(keeper,{id:ret.id,version:3,action:'RECEIVE',destinationLocationId:locationA,received:[{lineId:line.id,quantity:'1'}],reason:'QA physical assigned destination',idempotencyKey:randomUUID()}) as {status:string};assert.equal(received.status,'RECEIVED');assert.ok((await consignment.consignmentOverview(keeper)).returns.some(x=>(x as {id:string}).id===ret.id));assert.ok((await consignment.consignmentOperations(keeper)).returnLines.some(x=>(x as {id:string}).id===line.id));
  });
  Object.assign(references,{product,orderA,orderB,agreementId,shipmentA,shipmentB,batchA,batchB});
 }finally{
  await fs.mkdir('docs/crm/test-results/document-flow',{recursive:true});
  await fs.writeFile('docs/crm/test-results/document-flow/warehouse-scope-local.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'LOCAL separate PGlite fixture; actual services and migrations; fictitious organizations/stock/orders only; no provider calls',status:cases.length===7&&cases.every(x=>x.status==='PASS')?'PASS':'FAIL',references,cases},null,2));
  await db.close();
 }
}
main().catch(error=>{console.error(error instanceof Error?error.stack??error.message:String(error));process.exitCode=1;});
