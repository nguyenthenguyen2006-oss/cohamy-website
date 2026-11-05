import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createQaFixture, qaPassword} from './qa-fixture';
import {installQaRuntime} from './qa-runtime';
import {database, type Sql} from '../../lib/crm/db';
import {digest, login} from '../../lib/crm/auth';
import {CrmError} from '../../lib/crm/permissions';
import type {Role} from '../../lib/crm/types';
import {getPublicStorefront} from '../../lib/crm/storefront';
import {STOREFRONT_PRODUCTS} from '../../lib/storefront-pricing';
import {createWebsiteOrder} from '../../lib/crm/website-orders';
import {listOnlineOrders, getOnlineOrder, assignOnlineOrder, acceptOnlineOrder} from '../../lib/crm/online-orders';
import {runDocumentMailOutbox,retryDocumentMail} from '../../lib/crm/document-mail';
import {invokeOperation, operationCatalog} from '../../lib/crm/mcp/bridge';

const mailEvent='website.order.received';
const recipients=['kangminamhd@gmail.com','nguyenptkthd@gmail.com'];
const output='docs/crm/test-results/online-orders';
const invariantTables=[
  'organizations','commercial_requests','commercial_request_versions','sales_orders','sales_order_versions',
  'inventory_lots','inventory_documents','inventory_balances','inventory_movements','inventory_reservations',
  'inventory_reservation_events','inventory_actions','inventory_transfers','inventory_transfer_receipts',
  'credit_accounts','credit_events','credit_holds','receivables','receivable_events','payment_receipts',
  'payment_allocations','payment_allocation_records','finance_actions','accounting_order_clearances','order_payment_transactions',
] as const;
type Case={name:string;status:'PASS'|'FAIL';error?:string};
async function rejectsStatus(promise:Promise<unknown>,allowed:number|number[]){
  await assert.rejects(promise,error=>error instanceof CrmError&&(Array.isArray(allowed)?allowed:[allowed]).includes(error.status));
}
async function fingerprints(sql:Sql){
  const result:Record<string,{rows:number;sha256:string}>={};
  for(const table of invariantTables){
    const rows=(await sql.query<{row:unknown}>(`SELECT to_jsonb(t) AS row FROM cohamy_crm.${table} t ORDER BY to_jsonb(t)::text`)).rows;
    result[table]={rows:rows.length,sha256:digest(JSON.stringify(rows))};
  }
  return result;
}
async function frozen(sql:Sql,id:string){
  return (await sql.query('SELECT contact,lines,subtotal::text,payment_requested,paid,locale,request_hash,idempotency_key FROM cohamy_crm.website_orders WHERE id=$1',[id])).rows[0];
}

async function main(){
  const postgres=process.env.CRM_DATABASE_MODE==='postgres';
  if(postgres){
    const target=new URL(process.env.CRM_DATABASE_URL??'');
    assert.equal(process.env.CRM_ENVIRONMENT,'STAGING');
    assert.ok(['localhost','127.0.0.1'].includes(target.hostname));assert.equal(target.port,'55432');
    assert.match(target.pathname,/^\/cohamy_qa_online_[a-z0-9_]+$/);
  }else{
    delete process.env.CRM_DATABASE_URL;process.env.CRM_DATABASE_MODE='pglite';process.env.CRM_ENVIRONMENT='LOCAL';
    process.env.CRM_LOCAL_DATA_DIR='.local/crm-qa-online-'+randomUUID();
  }
  process.env.CRM_EMAIL_ENABLED='false';process.env.CRM_WEBSITE_ORDER_INTAKE='true';
  process.env.CRM_PUBLIC_ORIGIN='https://online-orders-qa.invalid';delete process.env.CRM_QA_DOCUMENT_MAIL;
  const ids=await createQaFixture(),owner=await database();
  for(const mapping of STOREFRONT_PRODUCTS)await owner.query(`INSERT INTO cohamy_crm.products(id,website_id,sku,name,category,weight_label,retail_price,vat_rate,translations)
    VALUES($1,$2,$3,$4,'pouch',$5,79000,8,'{}'::jsonb) ON CONFLICT(website_id) DO UPDATE SET weight_label=EXCLUDED.weight_label,retail_price=79000,vat_rate=8,active=true`,
    [randomUUID(),mapping.crmWebsiteId,'WEB-'+mapping.crmWebsiteId,'QA online package',mapping.weight]);
  const admin=(await login('admin@crm-qa.invalid',qaPassword)).user;
  const sales=(await login('sales@crm-qa.invalid',qaPassword)).user;
  const accountant=(await login('accountant@crm-qa.invalid',qaPassword)).user;
  const dealer=(await login('a@crm-qa.invalid',qaPassword)).user;
  const wh={north:randomUUID(),south:randomUUID(),inactive:randomUUID()};
  for(const [id,code,region,active] of [[wh.north,'QA_ONLINE_HN','NORTH',true],[wh.south,'QA_ONLINE_HCM','SOUTH',true],[wh.inactive,'QA_ONLINE_OFF','NORTH',false]] as const){
    await owner.query('INSERT INTO cohamy_crm.warehouses(id,code,name,organization_id,region,active) VALUES($1,$2,$3,$4,$5,$6)',[id,code,'LOCAL QA · '+code,admin.organizationId,region,active]);
  }
  async function staff(email:string,role:Role){
    await owner.query(`INSERT INTO cohamy_crm.users(id,email,display_name,password_hash) SELECT $1,$2,$3,password_hash FROM cohamy_crm.users WHERE id=$4`,[randomUUID(),email,'LOCAL QA · '+role,admin.id]);
    const user=(await owner.query<{id:string}>('SELECT id FROM cohamy_crm.users WHERE email=$1',[email])).rows[0];
    await owner.query('INSERT INTO cohamy_crm.memberships(id,user_id,organization_id,role) VALUES($1,$2,$3,$4)',[randomUUID(),user.id,admin.organizationId,role]);
    return (await login(email,qaPassword)).user;
  }
  const north=await staff('online-hn@crm-qa.invalid','WAREHOUSE_HN'),south=await staff('online-hcm@crm-qa.invalid','WAREHOUSE_HCM');
  const manager=await staff('online-manager@crm-qa.invalid','MANAGER');
  const generic=(await login('warehouse@crm-qa.invalid',qaPassword)).user;
  await owner.query('INSERT INTO cohamy_crm.warehouse_assignments(membership_id,warehouse_id) VALUES($1,$2)',[generic.membershipId,wh.north]);
  const product=(await owner.query<{id:string}>('SELECT id FROM cohamy_crm.products WHERE website_id=$1',[STOREFRONT_PRODUCTS[0].crmWebsiteId])).rows[0];
  const location=randomUUID(),lot=randomUUID();
  await owner.query("INSERT INTO cohamy_crm.warehouse_locations(id,warehouse_id,code,name,kind) VALUES($1,$2,'PICK','LOCAL QA PICK','PICK')",[location,wh.north]);
  await owner.query("INSERT INTO cohamy_crm.inventory_lots(id,product_id,code) VALUES($1,$2,'QA_ONLINE_LOT')",[lot,product.id]);
  await owner.query('INSERT INTO cohamy_crm.inventory_balances(warehouse_id,location_id,product_id,lot_id,on_hand,reserved) VALUES($1,$2,$3,$4,50,0)',[wh.north,location,product.id,lot]);
  await owner.query('INSERT INTO cohamy_crm.credit_accounts(organization_id,limit_amount,enabled) VALUES($1,100000,false)',[ids.dealerA]);
  await owner.query("INSERT INTO cohamy_crm.payment_receipts(id,code,organization_id,amount,kind,paid_at,reference,actor_id) VALUES($1,'QA_ONLINE_PENDING_PAYMENT',$2,100000,'PAYMENT',now(),'QA only',$3)",[randomUUID(),ids.dealerA,admin.id]);
  const close=await installQaRuntime(owner),db=await database(),cases:Case[]=[];
  let complete=false,baseline:Awaited<ReturnType<typeof fingerprints>>|undefined;
  const test=async(name:string,run:()=>Promise<void>)=>{try{await run();cases.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){cases.push({name,status:'FAIL',error:error instanceof Error?error.message:'UNKNOWN'});throw error;}};
  const quote=await getPublicStorefront();
  const input={idempotencyKey:randomUUID(),locale:'vi',payment:'bank',quoteVersion:quote.quoteVersion,acceptedPolicyVersion:'2026-11-05',contact:{fullName:'LOCAL QA Online Buyer',email:'online-buyer@crm-qa.invalid',phone:'0901234567',address:'LOCAL QA delivery address only',city:'QA city',district:'',ward:'',note:'Fictitious; no shipment'},items:[{productId:STOREFRONT_PRODUCTS[0].productId,quantity:2}]};
  const receipt=await createWebsiteOrder(input);
  const orderId=(await db.query<{id:string}>('SELECT id FROM cohamy_crm.website_orders WHERE idempotency_key=$1',[input.idempotencyKey])).rows[0].id;
  const original=await frozen(db,orderId);
  const legacyId=randomUUID(),closedId=randomUUID(),linkedId=randomUUID(),linkedRequestId=randomUUID();
  for(const [id,code,status] of [[legacyId,'CH-QA-LEGACY-ONLINE','PENDING_REVIEW'],[closedId,'CH-QA-CLOSED-ONLINE','CANCELLED'],[linkedId,'CH-QA-LINKED-ONLINE','READY']] as const){
    await owner.query(`INSERT INTO cohamy_crm.website_orders(id,code,idempotency_key,request_hash,locale,contact,lines,subtotal,payment_requested,status)
      VALUES($1,$2,$3,$4,'vi',$5::jsonb,$6::jsonb,100,'cod',$7)`,[id,code,randomUUID(),digest(code),JSON.stringify({...input.contact,phone:'0990000000',email:'legacy-online@crm-qa.invalid'}),JSON.stringify([{websiteId:'discontinued-qa-item',name:'LOCAL QA frozen legacy item',quantity:2,unitPrice:'50',lineTotal:'100'}]),status]);
  }
  await owner.query(`INSERT INTO cohamy_crm.commercial_requests(id,code,organization_id,creator_id,creator_membership_id,creator_area,creator_role,channel,source_website_id)
    VALUES($1,'QA_ONLINE_LINKED_REQUEST',$2,$3,$4,'crm','ADMIN','WEBSITE',$5)`,[linkedRequestId,ids.dealerA,admin.id,admin.membershipId,linkedId]);
  await owner.query("INSERT INTO cohamy_crm.sales_orders(id,code,organization_id,request_id,creator_id,source_website_id) VALUES($1,'QA_ONLINE_LINKED_SALE',$2,$3,$4,$5)",[randomUUID(),ids.dealerA,linkedRequestId,admin.id,linkedId]);
  try{
    baseline=await fingerprints(db);
    await test('New checkout appears with frozen customer/price and one explicit two-recipient notification',async()=>{
      const detail=await getOnlineOrder(admin,orderId,{});
      assert.equal(detail.order.code,receipt.code);assert.equal(detail.order.subtotal,receipt.subtotal);assert.equal(detail.order.dispatch.status,'UNASSIGNED');
      assert.equal(detail.order.contact.email,input.contact.email);assert.equal(detail.order.lines[0].quantity,2);assert.equal(detail.order.paid,false);
      const jobs=(await db.query<{recipients:{to:string[];cc:string[];bcc:string[]};body:string;files:unknown[]}>('SELECT recipients,body,files FROM cohamy_crm.document_mail_outbox WHERE event=$1 AND entity_id=$2',[mailEvent,orderId])).rows;
      assert.equal(jobs.length,1);assert.deepEqual(jobs[0].recipients,{to:recipients,cc:[],bcc:[]});assert.equal(jobs[0].files.length,0);
      assert.ok(jobs[0].body.includes('/crm/online-customers/'+orderId));assert.ok(jobs[0].body.includes(receipt.code));
    });
    await test('Exact checkout replay returns the original receipt and does not enqueue another notification',async()=>{
      assert.deepEqual(await createWebsiteOrder(input),receipt);
      await rejectsStatus(createWebsiteOrder({...input,items:[{...input.items[0],quantity:1}]}),409);
      assert.equal((await db.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.document_mail_outbox WHERE event=$1 AND entity_id=$2',[mailEvent,orderId])).rows[0].n,'1');
    });
    await test('Notification-only worker accepts exactly one fake-provider message and never makes an outbound request',async()=>{
      const sent:unknown[]=[];
      const result=await runDocumentMailOutbox(async message=>{sent.push(message);assert.deepEqual(message.recipients,{to:recipients,cc:[],bcc:[]});assert.equal(message.attachments.length,0);return 'QA_FAKE_PROVIDER_'+message.jobId;});
      assert.equal(result.accepted,1);assert.equal(result.failed,0);assert.equal(sent.length,1);
      assert.equal((await runDocumentMailOutbox(async()=>{throw Error('DUPLICATE_FAKE_SEND');})).processed,0);
    });
    await test('Admin notification history pages every explicit QA resend without any real delivery',async()=>{
      const originalJob=(await db.query<{id:string}>('SELECT id FROM cohamy_crm.document_mail_outbox WHERE event=$1 AND entity_id=$2',[mailEvent,orderId])).rows[0];
      for(let i=0;i<21;i++)await retryDocumentMail(admin,{id:originalJob.id,reason:'LOCAL QA history pagination only '+i,resend:true});
      const firstPage=await getOnlineOrder(admin,orderId,{mailPage:'1'}),secondPage=await getOnlineOrder(admin,orderId,{mailPage:'2'});
      assert.equal(firstPage.mailJobs.total,22);assert.equal(firstPage.mailJobs.items.length,20);assert.equal(secondPage.mailJobs.items.length,2);
      assert.equal(new Set([...firstPage.mailJobs.items,...secondPage.mailJobs.items].map(row=>row.id)).size,22);
    });
    await test('Only current Admin and warehouse actors can read the queue; global customer data stays out of other roles',async()=>{
      for(const user of [sales,accountant,manager,dealer]){await rejectsStatus(listOnlineOrders(user,{}),403);await rejectsStatus(getOnlineOrder(user,orderId,{}),[403,404]);}
      await rejectsStatus(listOnlineOrders({...admin,membershipVersion:admin.membershipVersion+1},{}),403);
      assert.equal((await listOnlineOrders(north,{})).total,0);assert.equal((await listOnlineOrders(south,{})).total,0);
      await rejectsStatus(getOnlineOrder(north,orderId,{}),[403,404]);
    });
    await test('Legacy unknown products remain readable; cancelled and already converted orders cannot be rerouted',async()=>{
      const legacy=await getOnlineOrder(admin,legacyId,{});assert.equal(legacy.order.lines[0].name,'LOCAL QA frozen legacy item');assert.equal(legacy.order.subtotal,'100');
      for(const id of [closedId,linkedId])await rejectsStatus(assignOnlineOrder(admin,id,{version:1,warehouseId:wh.north,reason:'LOCAL QA invalid routing',idempotencyKey:randomUUID()}),409);
      await rejectsStatus(listOnlineOrders(admin,{page:'0'}),400);await rejectsStatus(listOnlineOrders(admin,{from:'2026-02-30'}),400);
    });
    const first={version:1,warehouseId:wh.north,reason:'LOCAL QA dispatch to north',idempotencyKey:randomUUID()};
    let assigned:Awaited<ReturnType<typeof assignOnlineOrder>>;
    await test('Admin dispatch checks ownership, active warehouse, input and identity before changing an order',async()=>{
      for(const user of [sales,accountant,manager,north,dealer])await rejectsStatus(assignOnlineOrder(user,orderId,first),403);
      await rejectsStatus(assignOnlineOrder(admin,orderId,{...first,warehouseId:ids.warehouseA}),[400,403,404]);
      await rejectsStatus(assignOnlineOrder(admin,orderId,{...first,warehouseId:wh.inactive}),[400,403,404]);
      await rejectsStatus(assignOnlineOrder(admin,orderId,{...first,paid:true}),400);
      await rejectsStatus(assignOnlineOrder(admin,orderId,{...first,reason:''}),400);
      assigned=await assignOnlineOrder(admin,orderId,first);assert.equal(assigned.version,2);assert.equal(assigned.dispatchStatus,'ASSIGNED');
      assert.deepEqual(await assignOnlineOrder(admin,orderId,first),assigned);
      await rejectsStatus(assignOnlineOrder(admin,orderId,{...first,warehouseId:wh.south}),409);
      await rejectsStatus(assignOnlineOrder(admin,orderId,{...first,idempotencyKey:randomUUID()}),409);
    });
    await test('Assigned warehouse sees and accepts only its own dispatch; retries retain their original action receipt',async()=>{
      assert.equal((await listOnlineOrders(north,{})).total,1);assert.equal((await listOnlineOrders(generic,{})).total,1);
      assert.equal((await getOnlineOrder(north,orderId,{})).mailJobs.total,0);
      assert.equal((await listOnlineOrders(south,{})).total,0);await rejectsStatus(getOnlineOrder(south,orderId,{}),[403,404]);
      await rejectsStatus(acceptOnlineOrder(south,orderId,{version:2,reason:'wrong scope',idempotencyKey:randomUUID()}),[403,404]);
      const action={version:2,reason:'LOCAL QA warehouse accepted',idempotencyKey:randomUUID()};const result=await acceptOnlineOrder(north,orderId,action);
      assert.equal(result.version,3);assert.equal(result.dispatchStatus,'ACCEPTED');assert.deepEqual(await acceptOnlineOrder(north,orderId,action),result);
      await rejectsStatus(acceptOnlineOrder(north,orderId,{...action,reason:'changed retry'}),409);
      assert.deepEqual(await frozen(db,orderId),original);
    });
    await test('Reassignment resets acceptance and removes previous warehouse visibility without repricing or posting money',async()=>{
      await db.query('UPDATE cohamy_crm.products SET retail_price=90000,version=version+1 WHERE id=$1',[product.id]);
      const action={version:3,warehouseId:wh.south,reason:'LOCAL QA customer delivery moved',idempotencyKey:randomUUID()};const result=await assignOnlineOrder(admin,orderId,action);
      assert.equal(result.dispatchStatus,'ASSIGNED');assert.equal(result.version,4);assert.equal((await getOnlineOrder(admin,orderId,{})).order.dispatch.warehouseId,wh.south);
      assert.equal((await listOnlineOrders(north,{})).total,0);await rejectsStatus(getOnlineOrder(north,orderId,{}),[403,404]);
      assert.equal((await listOnlineOrders(south,{})).total,1);const accepted=await acceptOnlineOrder(admin,orderId,{version:4,reason:'LOCAL QA Admin override',idempotencyKey:randomUUID()});assert.equal(accepted.version,5);
      assert.deepEqual(await createWebsiteOrder(input),receipt);assert.deepEqual(await frozen(db,orderId),original);
    });
    await test('Dispatch action history is append-only for the production-equivalent runtime role',async()=>{
      assert.ok((await getOnlineOrder(admin,orderId,{})).history.total>=4);
      await assert.rejects(db.query('UPDATE cohamy_crm.website_order_dispatch_actions SET request_hash=$1',['tamper']),postgres?/permission denied/:/AUDIT_APPEND_ONLY/);
      await assert.rejects(db.query('DELETE FROM cohamy_crm.website_order_dispatch_actions'),postgres?/permission denied/:/AUDIT_APPEND_ONLY/);
    });
    await test('Order and action history pagination exposes every row without duplicates',async()=>{
      let state=(await getOnlineOrder(admin,orderId,{})).order;
      for(let i=0;i<19;i++){await assignOnlineOrder(admin,orderId,{version:state.version,warehouseId:i%2?wh.south:wh.north,reason:'LOCAL QA history page '+i,idempotencyKey:randomUUID()});state=(await getOnlineOrder(admin,orderId,{})).order;}
      const firstPage=await getOnlineOrder(admin,orderId,{historyPage:'1'}),secondPage=await getOnlineOrder(admin,orderId,{historyPage:'2'});
      assert.equal(firstPage.history.items.length,20);assert.ok(secondPage.history.items.length>0);assert.equal(firstPage.history.total,secondPage.history.total);
      assert.equal(new Set([...firstPage.history.items,...secondPage.history.items].map(row=>row.id)).size,firstPage.history.total);
      const fresh=await getPublicStorefront();for(let i=0;i<21;i++)await createWebsiteOrder({...input,quoteVersion:fresh.quoteVersion,idempotencyKey:randomUUID(),contact:{...input.contact,fullName:'LOCAL QA page '+i}});
      const a=await listOnlineOrders(admin,{page:'1'}),b=await listOnlineOrders(admin,{page:'2'});assert.equal(a.items.length,20);assert.equal(a.total,25);assert.equal(b.items.length,5);assert.equal(new Set([...a.items,...b.items].map(row=>row.id)).size,25);
      assert.equal((await listOnlineOrders(admin,{q:input.contact.phone})).total,22);
    });
    await test('Native MCP discovers and invokes the same scoped read/dispatch service on isolated data',async()=>{
      const operation='GET /api/crm/online-orders';const catalog=operationCatalog('',operation);assert.ok('operations' in catalog);assert.equal(catalog.operations[0].status,'AVAILABLE');
      const read=await invokeOperation(admin,{operation,query:{q:receipt.code}},false);assert.equal(read.status,200);assert.ok('data' in read);
      const detail=await invokeOperation(admin,{operation:'GET /api/crm/online-orders/[id]',params:{id:orderId}},false);assert.equal(detail.status,200);
      const state=(await getOnlineOrder(admin,orderId,{})).order;
      const command={operation:'POST /api/crm/online-orders/[id]/dispatch',params:{id:orderId},input:{version:state.version,warehouseId:state.dispatch.warehouseId===wh.north?wh.south:wh.north,reason:'LOCAL QA MCP dispatch',idempotencyKey:randomUUID()}};
      const result=await invokeOperation(admin,command,true);assert.equal(result.status,200);assert.deepEqual(await invokeOperation(admin,command,true),result);
      assert.ok(!/password_hash|access_token|api_key|claim_token/.test(JSON.stringify(detail)));
    });
    if(postgres)await test('Concurrent same-key checkout and same-version routing have single winners without duplicate notifications',async()=>{
      const fresh=await getPublicStorefront(),race={...input,quoteVersion:fresh.quoteVersion,idempotencyKey:randomUUID()};
      const receipts=await Promise.all([createWebsiteOrder(race),createWebsiteOrder(race)]);assert.deepEqual(receipts[0],receipts[1]);
      const row=(await db.query<{id:string}>('SELECT id FROM cohamy_crm.website_orders WHERE idempotency_key=$1',[race.idempotencyKey])).rows[0];
      assert.equal((await db.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.document_mail_outbox WHERE event=$1 AND entity_id=$2',[mailEvent,row.id])).rows[0].n,'1');
      const outcomes=await Promise.allSettled([wh.north,wh.south].map(warehouseId=>assignOnlineOrder(admin,row.id,{version:1,warehouseId,reason:'LOCAL QA parallel dispatch',idempotencyKey:randomUUID()})));
      assert.equal(outcomes.filter(result=>result.status==='fulfilled').length,1);assert.equal(outcomes.filter(result=>result.status==='rejected').length,1);
      const other=await createWebsiteOrder({...race,idempotencyKey:randomUUID()}),otherId=(await db.query<{id:string}>('SELECT id FROM cohamy_crm.website_orders WHERE code=$1',[other.code])).rows[0].id;
      const state=(await getOnlineOrder(admin,row.id,{})).order,key=randomUUID();
      const collision=await Promise.allSettled([
        assignOnlineOrder(admin,row.id,{version:state.version,warehouseId:state.dispatch.warehouseId===wh.north?wh.south:wh.north,reason:'LOCAL QA global key collision',idempotencyKey:key}),
        assignOnlineOrder(admin,otherId,{version:1,warehouseId:wh.north,reason:'LOCAL QA global key collision',idempotencyKey:key}),
      ]);
      assert.equal(collision.filter(result=>result.status==='fulfilled').length,1);assert.equal(collision.filter(result=>result.status==='rejected').length,1);
      assert.equal((await db.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.website_order_dispatch_actions WHERE id=$1',[key])).rows[0].n,'1');
    });
    await test('Online routing leaves all stock, reservation, finance, partner and commercial records unchanged',async()=>{
      assert.deepEqual(await fingerprints(db),baseline);assert.deepEqual(await frozen(db,orderId),original);
      assert.equal((await db.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.website_orders WHERE paid')).rows[0].n,'0');
    });
    complete=true;
  }finally{
    await fs.mkdir(output,{recursive:true});await fs.writeFile(output+'/services-'+(postgres?'staging':'local')+'.json',JSON.stringify({status:complete?'PASS':'FAIL',environment:postgres?'STAGING isolated PostgreSQL, restricted runtime role':'LOCAL isolated PGlite',testedAt:new Date().toISOString(),cases,invariantTables:baseline,provider:'FAKE_PROVIDER lambda; CRM_EMAIL_ENABLED=false; no live delivery claim',externalEmails:0,productionWrites:0,mcpScope:'Native invokeOperation on isolated fixtures, not production connector verification'},null,2)+'\n');
    await close();if(postgres)await owner.close();
  }
}
main().catch(error=>{console.error(error instanceof Error?error.message:'ONLINE_ORDER_QA_FAILED');process.exitCode=1;});
