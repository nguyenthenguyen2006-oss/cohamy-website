import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createQaFixture} from './qa-fixture';
import {installQaRuntime} from './qa-runtime';
import {database} from '../../lib/crm/db';
import {getPublicStorefront} from '../../lib/crm/storefront';
import {STOREFRONT_PRODUCTS} from '../../lib/storefront-pricing';

async function main(){
 const target=new URL(process.env.CRM_DATABASE_URL??'');
 assert.equal(process.env.CRM_DATABASE_MODE,'postgres');
 assert.equal(process.env.CRM_ENVIRONMENT,'STAGING');
 assert.ok(['localhost','127.0.0.1'].includes(target.hostname));
 assert.equal(target.port,'55432');
 assert.match(target.pathname,/^\/cohamy_qa_homepage_[a-f0-9]{32}$/);
 process.env.CRM_EMAIL_ENABLED='false';
 await createQaFixture();
 const owner=await database();
 for(const item of STOREFRONT_PRODUCTS)await owner.query(`INSERT INTO cohamy_crm.products(id,website_id,sku,name,category,weight_label,retail_price,vat_rate,translations)
  VALUES($1,$2,$3,'QA homepage package','pouch',$4,79000,8,'{}'::jsonb)
  ON CONFLICT(website_id) DO UPDATE SET retail_price=79000,vat_rate=8,active=true,weight_label=EXCLUDED.weight_label`,[randomUUID(),item.crmWebsiteId,'WEB-'+item.crmWebsiteId,item.weight]);
 const close=await installQaRuntime(owner);
 try{
  const quote=await getPublicStorefront();
  assert.equal(quote.items.length,8);assert.ok(quote.items.every(item=>item.available&&item.salePrice===59724));
  const orderCount=Number((await (await database()).query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.website_orders')).rows[0].n);
  assert.equal(orderCount,0);
  await fs.mkdir('docs/crm/test-results/homepage-refinement',{recursive:true});
  await fs.writeFile('docs/crm/test-results/homepage-refinement/fixture-staging.json',JSON.stringify({status:'PASS',environment:'STAGING isolated PostgreSQL; restricted runtime role',catalogItems:8,available:8,fictitiousUniformPrice:59724,websiteOrders:orderCount,workerInvoked:false,externalEmails:0,productionWrites:0},null,2)+'\n');
  console.log('PASS isolated eight-product display fixture; no orders or worker');
 }finally{await close();await owner.close();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'HOMEPAGE_QA_PREPARE_FAILED');process.exitCode=1;});
