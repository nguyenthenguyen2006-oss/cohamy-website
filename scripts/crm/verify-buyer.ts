import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const pg=process.env.CRM_DATABASE_MODE==='postgres';
if(!pg){process.env.CRM_ENVIRONMENT='LOCAL';process.env.CRM_DATABASE_MODE='pglite';process.env.CRM_LOCAL_DATA_DIR='.local/crm-qa-buyer-'+randomUUID();}
process.env.CRM_EMAIL_ENABLED='false';
const cases:{test:string;status:string}[]=[];
async function test(name:string,fn:()=>Promise<void>){await fn();cases.push({test:name,status:'PASS'});console.log('PASS',name);}
async function main(){
 await fs.mkdir('.local',{recursive:true});
 const {createQaFixture,qaPassword}=await import('./qa-fixture'),{database}=await import('../../lib/crm/db'),auth=await import('../../lib/crm/auth'),repo=await import('../../lib/crm/repository'),buyer=await import('../../lib/crm/buyer'),flow=await import('../../lib/crm/document-flow'),inv=await import('../../lib/crm/inventory'),files=await import('../../lib/crm/workspace');
 await createQaFixture();const owner=await database(),close=await(await import('./qa-runtime')).installQaRuntime(owner),db=await database();
 const admin=(await auth.login('admin@crm-qa.invalid',qaPassword)).user,sales=(await auth.login('sales@crm-qa.invalid',qaPassword)).user,accountant=(await auth.login('accountant@crm-qa.invalid',qaPassword)).user;
 const customerOrg=await repo.createOrganization(admin,{code:'BUYER_CUSTOMER',name:'LOCAL QA Khách hàng A',kind:'CUSTOMER',phone:'0900000000',address:'Địa chỉ QA A'});
 const otherOrg=await repo.createOrganization(admin,{code:'BUYER_OTHER',name:'LOCAL QA Khách hàng B',kind:'CUSTOMER',phone:'0900000001',address:'Địa chỉ QA B'});
 const marketOrg=await repo.createOrganization(admin,{code:'BUYER_SUPERMARKET',name:'LOCAL QA Siêu thị',kind:'CUSTOMER',phone:'0900000002',address:'Địa chỉ QA siêu thị'});
 for(const [role,email,org]of [['CUSTOMER','customer@buyer-qa.invalid',customerOrg.id],['CUSTOMER','other@buyer-qa.invalid',otherOrg.id],['SUPERMARKET','market@buyer-qa.invalid',marketOrg.id],['WAREHOUSE_HN','hn@buyer-qa.invalid',admin.organizationId],['WAREHOUSE_HCM','hcm@buyer-qa.invalid',admin.organizationId]] as const)await repo.createAccount(admin,{email,role,organizationId:org,displayName:'LOCAL QA '+role,password:qaPassword});
 const customer=(await auth.login('customer@buyer-qa.invalid',qaPassword)).user,other=(await auth.login('other@buyer-qa.invalid',qaPassword)).user,market=(await auth.login('market@buyer-qa.invalid',qaPassword)).user,hn=(await auth.login('hn@buyer-qa.invalid',qaPassword)).user,hcm=(await auth.login('hcm@buyer-qa.invalid',qaPassword)).user;
 await db.query('INSERT INTO cohamy_crm.partner_assignments(membership_id,organization_id) VALUES($1,$2),($1,$3)',[sales.membershipId,customerOrg.id,marketOrg.id]);
 await db.query("UPDATE cohamy_crm.products SET stock_unit='Gói',units_per_case=12 WHERE active");
 const products=await repo.listCatalog(admin),p=products[0],w=(await repo.listWarehouses(admin)).find(w=>w.region==='NORTH'&&w.organization_id===admin.organizationId)!;
 const loc=(await inv.listLocations(admin)).find(l=>l.warehouse_id===w.id&&l.kind==='PICK')!;
 await inv.postReceipt(admin,{locationId:loc.id,lines:[{productId:p.id,lotCode:'QA-BUYER-LOT',manufacturedOn:null,expiresOn:null,quantity:'1000'}],referenceType:'QA_OPENING',referenceId:'QA_BUYER',reason:'Isolated test opening stock only',idempotencyKey:randomUUID()});
 const stock=async()=>Number((await db.query<{n:string}>('SELECT sum(on_hand)::text AS n FROM cohamy_crm.inventory_balances WHERE product_id=$1 AND warehouse_id=$2',[p.id,w.id])).rows[0].n);
 let customerOrder:{id:string;code:string;version:number;status:string},marketOrder:{id:string;code:string;version:number;status:string},contractId:string,branchId:string,issue:{id:string;version:number;code:string},vatId:string;
 const folder='docs/crm/test-results/buyer';await fs.mkdir(folder,{recursive:true});
 let complete=false;
 try{
 await test('Native Admin creates both roles; login selects portal and rejects mismatched organization',async()=>{
  assert.equal(customer.area,'portal');assert.equal(market.area,'portal');
  await assert.rejects(repo.createAccount(admin,{email:'wrong@buyer-qa.invalid',role:'CUSTOMER',organizationId:admin.organizationId,displayName:'Wrong organization',password:qaPassword}),/ROLE_ORGANIZATION_MISMATCH/);
  await assert.rejects(repo.createAccount(admin,{email:'wrong-role@buyer-qa.invalid',role:'SUPERMARKET',organizationId:customerOrg.id,displayName:'Wrong type',password:qaPassword}),/BUYER_ROLE_CONFLICT/);
 });
 await test('Customer catalog returns actual images/names/units and no retail, cost, contracts or prices',async()=>{
  const setup=await buyer.buyerSetup(customer);assert.ok(setup.products.length);assert.ok(setup.products[0].image);assert.deepEqual(setup.contracts,[]);
  assert.ok(!/retail_price|cost_price|unitPrice|vat_rate/.test(JSON.stringify(setup)));await assert.rejects(buyer.buyerSetup(customer,marketOrg.id),/NOT_FOUND/);
  await assert.rejects(repo.listCatalog(customer),/FORBIDDEN/);
 });
 await test('Unpriced customer request is exact-once and does not create clearance or alter stock',async()=>{
  const input={warehouseId:w.id,delivery:{recipient:'Khách QA A',phone:'0900000000',address:'Địa chỉ giao QA A'},lines:[{productId:p.id,quantity:12,unit:'PACK'}],note:'LOCAL QA customer request',idempotencyKey:randomUUID()};
  customerOrder=await buyer.createBuyerOrder(customer,input);assert.equal(customerOrder.status,'WAITING_QUOTE');assert.equal((await buyer.createBuyerOrder(customer,input)).id,customerOrder.id);assert.equal(await stock(),1000);
  const d=await buyer.buyerOrderDetail(customer,customerOrder.id);assert.equal(d.order.clearance_id,null);
  await assert.rejects(buyer.confirmBuyerOrder(customer,{id:customerOrder.id,version:1,idempotencyKey:randomUUID()}),/QUOTE_REQUIRED/);
  await assert.rejects(buyer.createBuyerOrder(customer,{...input,unitPrice:'1',idempotencyKey:randomUUID()}),/INVALID_FIELDS/);
  await assert.rejects(buyer.createBuyerOrder(customer,{...input,organizationId:marketOrg.id,idempotencyKey:randomUUID()}),/NOT_FOUND/);
 });
 await test('Other customers, dealers and wrong warehouse cannot inspect the request',async()=>{
  await assert.rejects(buyer.buyerOrderDetail(other,customerOrder.id),/NOT_FOUND/);
  await assert.rejects(buyer.buyerOrderDetail(hcm,customerOrder.id),/NOT_FOUND/);
  const dealer=(await auth.login('a@crm-qa.invalid',qaPassword)).user;await assert.rejects(buyer.listBuyerOrders(dealer),/FORBIDDEN/);
  assert.equal((await buyer.listBuyerOrders(hn)).items[0].id,customerOrder.id);
  await assert.rejects(buyer.quoteBuyerOrder(hn,{id:customerOrder.id,version:1,expiresOn:'2099-12-31',lines:[{productId:p.id,unitPrice:'50000',vatRate:8}],idempotencyKey:randomUUID()}),/FORBIDDEN/);
 });
 await test('Assigned Sales quotes; customer confirmation creates one native clearance in chosen warehouse',async()=>{
  const quoted=await buyer.quoteBuyerOrder(sales,{id:customerOrder.id,version:1,expiresOn:'2099-12-31',lines:[{productId:p.id,unitPrice:'50000',vatRate:8}],idempotencyKey:randomUUID()});
  assert.equal((await buyer.buyerOrderDetail(customer,customerOrder.id)).order.lines[0].total,'648000');
  const input={id:customerOrder.id,version:quoted.version,idempotencyKey:randomUUID()},confirmed=await buyer.confirmBuyerOrder(customer,input);assert.equal((await buyer.confirmBuyerOrder(customer,input)).version,confirmed.version);
  const b=(await buyer.buyerOrderDetail(customer,customerOrder.id)).order,c=(await db.query<{warehouse_id:string;gross_total:string}>('SELECT warehouse_id,gross_total::text FROM cohamy_crm.accounting_order_clearances WHERE id=$1',[b.clearance_id])).rows[0];
  assert.equal(c.warehouse_id,w.id);assert.equal(c.gross_total,'648000');assert.equal(await stock(),1000);
  assert.ok((await flow.flowWorkspace(hn)).orders.some(o=>o.id===b.clearance_id));
  await assert.rejects(buyer.quoteBuyerOrder(sales,{id:b.id,version:b.version,expiresOn:'2099-12-31',lines:[{productId:p.id,unitPrice:'1',vatRate:0}],idempotencyKey:randomUUID()}),/ORDER_LOCKED/);
 });
 await test('Supermarket manages own branches; contract prices are Admin/Manager only and scoped',async()=>{
  const branch=await buyer.saveBuyerBranch(market,{version:0,code:'QA_BRANCH',name:'Chi nhánh QA 1',address:'Địa chỉ QA chi nhánh',recipient:'Người nhận QA',phone:'0900000002',idempotencyKey:randomUUID()});branchId=branch.id;
  const contract=await buyer.saveBuyerContract(admin,{version:0,organizationId:marketOrg.id,code:'QA-HOP-DONG',startsOn:'2026-01-01',endsOn:'2099-12-31',lines:[{productId:p.id,unitPrice:'40000',vatRate:8}],idempotencyKey:randomUUID()});contractId=contract.id;
  await assert.rejects(buyer.saveBuyerBranch(market,{version:0,organizationId:customerOrg.id,code:'WRONG',name:'Wrong branch',address:'Wrong address',recipient:'Wrong recipient',phone:'0900000000',idempotencyKey:randomUUID()}),/NOT_FOUND/);
  await assert.rejects(buyer.saveBuyerContract(market,{version:0,organizationId:marketOrg.id,code:'BAD',startsOn:'2026-01-01',endsOn:'2099-12-31',lines:[{productId:p.id,unitPrice:'1',vatRate:0}],idempotencyKey:randomUUID()}),/FORBIDDEN/);
  assert.equal((await buyer.buyerSetup(market)).contracts[0].lines[0].unitPrice,'40000');
 });
 await test('Case order snapshots exact contract, branch and conversion; later changes do not reprice it',async()=>{
  const input={warehouseId:w.id,branchId,contractId,lines:[{productId:p.id,quantity:2,unit:'CASE'}],idempotencyKey:randomUUID()};
  marketOrder=await buyer.createBuyerOrder(market,input);assert.equal(marketOrder.status,'CONFIRMED');assert.equal((await buyer.createBuyerOrder(market,input)).id,marketOrder.id);
  const before=(await buyer.buyerOrderDetail(market,marketOrder.id)).order;assert.equal(before.lines[0].baseQuantity,24);assert.equal(before.lines[0].total,'1036800');assert.equal(before.delivery.branchName,'Chi nhánh QA 1');
  await buyer.saveBuyerContract(admin,{id:contractId,version:1,organizationId:marketOrg.id,code:'QA-HOP-DONG',startsOn:'2026-01-01',endsOn:'2099-12-31',lines:[{productId:p.id,unitPrice:'45000',vatRate:8}],idempotencyKey:randomUUID()});
  assert.equal((await buyer.buyerOrderDetail(market,marketOrder.id)).order.lines[0].unitPrice,'40000');assert.equal(await stock(),1000);
 });
 await test('Native warehouse issue posts stock once and retains quoted VAT totals',async()=>{
  const b=(await buyer.buyerOrderDetail(market,marketOrder.id)).order;
  const input={kind:'ISSUE',warehouseId:w.id,clearanceId:b.clearance_id,lines:[{productId:p.id,quantity:'24'}],delivery:{giver:hn.displayName,recipient:b.delivery.recipient,recipientPhone:b.delivery.phone,address:b.delivery.address,deliveryDate:'2026-10-25',carrier:'LOCAL QA carrier'},confirm:true,idempotencyKey:randomUUID()};
  issue=await flow.saveFlowDocument(hn,input);assert.equal((await flow.saveFlowDocument(hn,input)).id,issue.id);assert.equal(await stock(),976);
  const s=await flow.viewFlowDocument(hn,issue.id);assert.equal(s.totals.total,'1036800');assert.equal(s.totals.vat,'76800');
  await assert.rejects(buyer.receiveBuyerDelivery(customer,{id:customerOrder.id,issueId:issue.id,issueRevision:issue.version,lines:[{productId:p.id,received:24}],idempotencyKey:randomUUID()}),/FORBIDDEN/);
 });
 await test('Receipt requires a matching confirmed issue, complete lines and reason for shortage; no stock side effects',async()=>{
  const input={id:marketOrder.id,issueId:issue.id,issueRevision:issue.version,lines:[{productId:p.id,received:23}],idempotencyKey:randomUUID()};
  await assert.rejects(buyer.receiveBuyerDelivery(market,input),/DISCREPANCY_NOTE_REQUIRED/);
  await assert.rejects(buyer.receiveBuyerDelivery(market,{...input,issueId:randomUUID(),note:'QA shortage'}),/DELIVERY_REQUIRED/);
  const receipt=await buyer.receiveBuyerDelivery(market,{...input,note:'Thiếu một gói khi kiểm đếm QA'});assert.equal(receipt.shortage,true);assert.equal((await buyer.receiveBuyerDelivery(market,{...input,note:'Thiếu một gói khi kiểm đếm QA'})).id,receipt.id);assert.equal(await stock(),976);
  const d=await buyer.buyerOrderDetail(accountant,marketOrder.id);assert.equal(d.receipts[0].shortage,true);assert.equal((await flow.viewFlowDocument(hn,issue.id)).lines[0].quantity,'24');
 });
 await test('Own order/delivery PDF and VAT are byte-preserving; cross-customer download denied',async()=>{
  const vat=await files.uploadDocument(accountant,{entityType:'warehouse-handover',entityId:issue.id,title:'VAT QA',filename:'buyer-qa-vat.pdf',mime:'application/pdf',content:(await flow.downloadFlowPdf(hn,issue.id)).bytes,docCategory:'VAT_PDF'});vatId=vat.versionId;
  const source=await flow.downloadFlowPdf(hn,issue.id),actual=await buyer.buyerDownload(market,marketOrder.id,'delivery',issue.id,issue.version);assert.deepEqual(actual.bytes,source.bytes);
  assert.deepEqual((await buyer.buyerDownload(market,marketOrder.id,'vat',vatId)).bytes,source.bytes);
  const order=await buyer.buyerDownload(customer,customerOrder.id,'order');assert.equal(order.bytes.subarray(0,5).toString(),'%PDF-');await fs.writeFile(folder+'/customer-order.pdf',order.bytes);
  await fs.writeFile(folder+'/market-delivery.pdf',source.bytes);
  await assert.rejects(buyer.buyerDownload(other,marketOrder.id,'vat',vatId),/NOT_FOUND/);
 });
 await test('Monthly purchase/receipt/VAT reconciliation can be acknowledged only against current fingerprint',async()=>{
  const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit'}).format(new Date()),s=await buyer.buyerMonthlyStatement(market,month);
  assert.equal(s.items.length,1);assert.equal(s.total,'1036800');assert.ok(s.items[0].receipts[0].shortage);
  await assert.rejects(buyer.acknowledgeBuyerStatement(market,{month,checksum:'0'.repeat(64),idempotencyKey:randomUUID()}),/STATEMENT_CHANGED/);
  const ack={month,checksum:s.checksum,idempotencyKey:randomUUID()};await buyer.acknowledgeBuyerStatement(market,ack);assert.ok((await buyer.buyerMonthlyStatement(market,month)).acknowledgement);
  await assert.rejects(buyer.buyerMonthlyStatement(customer,month),/FORBIDDEN/);
 });
 await test('Partial deliveries allocate the quoted VAT exactly, including rounding remainders',async()=>{
  const created=await buyer.createBuyerOrder(customer,{warehouseId:w.id,delivery:{recipient:'QA partial',phone:'0900000000',address:'QA partial address'},lines:[{productId:p.id,quantity:3,unit:'PACK'}],idempotencyKey:randomUUID()});
  const quoted=await buyer.quoteBuyerOrder(sales,{id:created.id,version:1,expiresOn:'2099-12-31',lines:[{productId:p.id,unitPrice:'7',vatRate:8}],idempotencyKey:randomUUID()});
  await buyer.confirmBuyerOrder(customer,{id:created.id,version:quoted.version,idempotencyKey:randomUUID()});
  const b=(await buyer.buyerOrderDetail(customer,created.id)).order;let vat=0n,gross=0n;
  for(let n=0;n<3;n++){
   const issue=await flow.saveFlowDocument(hn,{kind:'ISSUE',warehouseId:w.id,clearanceId:b.clearance_id,lines:[{productId:p.id,quantity:'1'}],delivery:{giver:hn.displayName,recipient:b.delivery.recipient,recipientPhone:b.delivery.phone,address:b.delivery.address,deliveryDate:'2026-10-25',carrier:'QA partial'},confirm:true,idempotencyKey:randomUUID()});
   const s=await flow.viewFlowDocument(hn,issue.id);vat+=BigInt(s.totals.vat);gross+=BigInt(s.totals.total);
  }
  assert.equal(vat,2n);assert.equal(gross,23n);
 });
 await test('Immutable events/receipts and revoked sessions fail closed; no email delivery attempted',async()=>{
  await assert.rejects(db.query("UPDATE cohamy_crm.buyer_delivery_receipts SET note='changed' WHERE order_id=$1",[marketOrder.id]));
  await repo.setAccountActive(admin,other.membershipId,{active:false});await assert.rejects(buyer.buyerSetup(other),/FORBIDDEN/);
  assert.equal(Number((await db.query<{n:string}>("SELECT count(*)::text AS n FROM cohamy_crm.document_mail_outbox WHERE status IN('SENDING','ACCEPTED','DELIVERED') OR attempts>0")).rows[0].n),0);
 });
 complete=true;
 await fs.mkdir('.local',{recursive:true});await fs.writeFile('.local/buyer-qa.json',JSON.stringify({dataDir:process.env.CRM_LOCAL_DATA_DIR,productId:p.id,productName:p.name,warehouseId:w.id,customerOrderId:customerOrder!.id,marketOrderId:marketOrder!.id,issueId:issue!.id,vatId:vatId!,customerOrgId:customerOrg.id,marketOrgId:marketOrg.id,branchId:branchId!,contractId:contractId!}));
 }finally{
  await fs.writeFile(folder+(pg?'/services-staging.json':'/services-local.json'),JSON.stringify({environment:pg?'STAGING native PostgreSQL runtime role':'LOCAL isolated PGlite',status:complete?'PASS':'FAIL',provider:'Disabled; no external sends',cases},null,2)+'\n');
  await close();await owner.close();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
