import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

// Run only after the dev server has stopped. These are fictitious QA records.
const relative=process.env.CRM_LOCAL_DATA_DIR;
if(!relative?.startsWith('.local/crm-qa')||path.isAbsolute(relative))throw new Error('SEPARATE_QA_DIRECTORY_REQUIRED');
const source=path.resolve(relative),root=path.resolve('.local')+path.sep;
if(!source.startsWith(root))throw new Error('PATH_OUTSIDE_LOCAL');
const restore=path.resolve('.local','crm-qa-restore-'+randomUUID());
if(!restore.startsWith(root))throw new Error('RESTORE_PATH_OUTSIDE_LOCAL');
async function snapshot(directory){
 const db=new PGlite(directory);await db.waitReady;
 try {
  const tables={
   organizations:'id,code,name,kind,active,version',
   products:'id,website_id,sku,retail_price::text,translations',
   warehouses:'id,code,name,organization_id',
   website_orders:'id,code,request_hash,subtotal::text,status,paid,shipping_quote_pending',
   audit_events:'id,action,entity_id,payload',
  };
  const data={},counts={};
  for(const [table,fields] of Object.entries(tables)){
   const {rows}=await db.query(`SELECT ${fields} FROM cohamy_crm.${table} ORDER BY id`);
   data[table]=rows;counts[table]=rows.length;
  }
  assert.equal(counts.products,10);assert.ok(counts.website_orders>0,'Run successful browser checkout before restart/restore test');
  assert.ok(data.website_orders.every(order=>order.status==='PENDING_REVIEW'&&order.paid===false&&order.shipping_quote_pending===true));
  return {counts,logicalSha256:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
 }finally{await db.close();}
}
const before=await snapshot(source),reopened=await snapshot(source);
assert.deepEqual(reopened,before);
// Closed physical database copy, no overwrite, no deletion and no live file copy.
await fs.cp(source,restore,{recursive:true,errorOnExist:true,force:false});
const restored=await snapshot(restore);assert.deepEqual(restored,before);
const report={environment:'LOCAL',engine:'PGlite, single-process QA only',testedAt:new Date().toISOString(),source:relative,retainedRestore:path.relative(process.cwd(),restore),snapshot:before,cases:[{name:'Closed database reopen preserves records and unpaid order intake',status:'PASS'},{name:'Restore closed QA copy preserves logical digest and record totals',status:'PASS'}],limits:['Stop all owners before running; no concurrent-process safety claim','Not pg_dump/pg_restore or a standalone PostgreSQL server backup exercise','No stock, debt or financial ledgers exist in this snapshot','Hashes exclude credentials, session tokens and customer contacts']};
await fs.writeFile('docs/crm/test-results/durability-local.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
