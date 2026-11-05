import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createQaFixture} from './qa-fixture';
import {database} from '../../lib/crm/db';
import {migrate} from '../../lib/crm/bootstrap';

async function main(){
 const pg=process.env.CRM_DATABASE_MODE==='postgres';
 if(pg){const u=new URL(process.env.CRM_DATABASE_URL??'');assert.equal(process.env.CRM_ENVIRONMENT,'STAGING');assert.ok(['localhost','127.0.0.1'].includes(u.hostname));assert.equal(u.port,'55432');assert.match(u.pathname,/^\/cohamy_qa_sales_[a-z0-9_]+$/);}
 else{delete process.env.CRM_DATABASE_URL;process.env.CRM_ENVIRONMENT='LOCAL';process.env.CRM_DATABASE_MODE='pglite';process.env.CRM_LOCAL_DATA_DIR='.local/crm-qa-sales-rollback-'+randomUUID();}
 process.env.CRM_EMAIL_ENABLED='false';await createQaFixture();const db=await database(),sql=await fs.readFile('db/crm/rollback/050-053-sales-empty-only.sql','utf8');let complete=false;
 try{
  const before=(await db.query('SELECT id,email,active FROM cohamy_crm.users ORDER BY id')).rows;
  await db.exec(sql);assert.equal((await db.query<{t:string|null}>("SELECT to_regclass('cohamy_crm.buyer_fulfillment_state')::text AS t")).rows[0].t,null);
  assert.ok((await db.query<{t:string|null}>("SELECT to_regclass('cohamy_sales_20261030_archive.buyer_fulfillment_state')::text AS t")).rows[0].t);
  assert.deepEqual((await db.query('SELECT id,email,active FROM cohamy_crm.users ORDER BY id')).rows,before);
  await migrate();assert.ok((await db.query<{t:string|null}>("SELECT to_regclass('cohamy_crm.buyer_fulfillment_state')::text AS t")).rows[0].t);
  assert.deepEqual((await db.query('SELECT id,email,active FROM cohamy_crm.users ORDER BY id')).rows,before);
  await db.exec('ALTER SCHEMA cohamy_sales_20261030_archive RENAME TO cohamy_sales_20261030_empty_archive');
  const actor=(await db.query<{id:string;user_id:string}>("SELECT id,user_id FROM cohamy_crm.memberships WHERE role='SALES' LIMIT 1")).rows[0];
  await db.query("INSERT INTO cohamy_crm.sales_referral_codes(id,sales_membership_id,code,created_by) VALUES($1,$2,'SALE-AABBCCDDEEFF',$3)",[randomUUID(),actor.id,actor.user_id]);
  const inner=sql.replace(/^BEGIN;\r?$/m,'').replace(/^COMMIT;\r?$/m,'');
  await assert.rejects(db.transaction(tx=>tx.exec(inner)),/SALES_ROLLBACK_HAS_HISTORY/);
  assert.equal((await db.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.sales_referral_codes')).rows[0].n,'1');
  complete=true;console.log('PASS Guarded empty-feature rollback preserves existing identities and migrates forward; non-empty history refuses rollback');
 }finally{await fs.mkdir('docs/crm/test-results/sales-routing',{recursive:true});await fs.writeFile('docs/crm/test-results/sales-routing/rollback-'+(pg?'staging':'local')+'.json',JSON.stringify({status:complete?'PASS':'FAIL',environment:pg?'STAGING isolated PostgreSQL owner migration harness':'LOCAL isolated PGlite owner migration harness',existingBusinessRowsPreserved:complete,refusesNonEmptyHistory:complete,featureDataMustBeEmpty:true,externalEmails:0,productionWrites:0},null,2)+'\n');await db.close();}
}
main().catch(e=>{console.error(e instanceof Error?e.message:'SALES_ROLLBACK_FAILED');process.exitCode=1;});
