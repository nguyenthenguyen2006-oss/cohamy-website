import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createQaFixture,qaPassword} from './qa-fixture';
import {installQaRuntime} from './qa-runtime';
import {database} from '../../lib/crm/db';
import {login} from '../../lib/crm/auth';
import {createWarehouse} from '../../lib/crm/repository';
import {saveOrderPolicy} from '../../lib/crm/order-policy';

async function main(){
 const target=new URL(process.env.CRM_DATABASE_URL??'');
 assert.equal(process.env.CRM_DATABASE_MODE,'postgres');assert.equal(process.env.CRM_ENVIRONMENT,'STAGING');assert.ok(['localhost','127.0.0.1'].includes(target.hostname));assert.equal(target.port,'55432');assert.match(target.pathname,/^\/cohamy_qa_handover_[a-f0-9]{32}$/);
 process.env.CRM_EMAIL_ENABLED='false';process.env.CRM_QA_DOCUMENT_MAIL='false';
 const ids=await createQaFixture(),owner=await database(),admin=(await login('admin@crm-qa.invalid',qaPassword)).user;
 const warehouse=await createWarehouse(admin,{code:'QA-SALE-HCM',name:'QA HCM sales',organizationId:admin.organizationId,region:'SOUTH'}),location=randomUUID();
 await owner.query("INSERT INTO cohamy_crm.warehouse_locations(id,warehouse_id,code,name,kind) VALUES($1,$2,'QA-PICK','QA Pick','PICK')",[location,warehouse.id]);
 await owner.query('DELETE FROM cohamy_crm.warehouse_assignments WHERE membership_id=$1',[ids.warehouse]);await owner.query('INSERT INTO cohamy_crm.warehouse_assignments(membership_id,warehouse_id) VALUES($1,$2)',[ids.warehouse,warehouse.id]);
 await saveOrderPolicy(admin,{version:0,definition:{enabled:true,requireOwnerApproval:false,alwaysManagerApproval:false,managerApprovalAmount:null,creditRequiresApproval:false,nonSelfApproval:true,acceptedQuotePrice:'UNTIL_QUOTE_EXPIRY',pendingPrice:'UNTIL_REQUEST_EXPIRY',requiredPartnerFields:[],approvalRoles:['ADMIN','MANAGER'],confirmationRoles:['ADMIN','MANAGER','SALES']},reason:'STAGING isolated fictitious sale policy',idempotencyKey:randomUUID()});
 const products=['90000','50000','80000'].map((retailPrice,i)=>({id:randomUUID(),name:'QA Product '+String.fromCharCode(65+i),retailPrice,vatRate:'8'}));
 for(const [i,p]of products.entries()){
  await owner.query("INSERT INTO cohamy_crm.products(id,website_id,sku,name,category,weight_label,retail_price,vat_rate,translations,stock_unit) VALUES($1,$2,$3,$4,'QA','80g',$5,8,'{}','Gói')",[p.id,'qa-sale-'+p.id,'QA-SALE-'+i,p.name,p.retailPrice]);
  const lot=randomUUID();await owner.query("INSERT INTO cohamy_crm.inventory_lots(id,product_id,code,status) VALUES($1,$2,$3,'AVAILABLE')",[lot,p.id,'QA-SALE-LOT-'+i]);await owner.query('INSERT INTO cohamy_crm.inventory_balances(warehouse_id,location_id,product_id,lot_id,on_hand,reserved) VALUES($1,$2,$3,$4,500,0)',[warehouse.id,location,p.id,lot]);
 }
 await fs.mkdir('.local/handover-sale-release',{recursive:true});await fs.writeFile('.local/handover-sale-release/browser-fixture.json',JSON.stringify({warehouseId:warehouse.id,customerId:ids.dealerA,products},null,2)+'\n');
 const close=await installQaRuntime(owner);await close();await owner.close();console.log('PASS isolated PostgreSQL fixture, fictional stock and restricted DML runtime; no worker or external sends');
}
main().catch(error=>{console.error(error instanceof Error?error.stack:'HANDOVER_QA_PREPARE_FAILED');process.exitCode=1;});
