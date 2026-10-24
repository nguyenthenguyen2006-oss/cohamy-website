import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { database, type Database, type Sql } from '../../lib/crm/db';
import { membershipPrincipal } from '../../lib/crm/auth';
import { importHistoricalInvoices } from '../../lib/crm/historical-orders';

async function ledgerFingerprint(sql:Sql) {
  const tables=(await sql.query<{name:string}>("SELECT tablename AS name FROM pg_tables WHERE schemaname='cohamy_crm' AND tablename NOT IN('migrations','audit_events','historical_order_invoices') ORDER BY tablename")).rows;
  const manifest=[];
  for(const {name} of tables) {
    assert.match(name,/^[a-z][a-z0-9_]*$/);
    const hash=(await sql.query<{rows:string;sha256:string}>(`SELECT count(*)::text AS rows,encode(sha256(convert_to(coalesce(string_agg(row_hash,E'\n' ORDER BY row_hash),''),'UTF8')),'hex') AS sha256 FROM (SELECT encode(sha256(convert_to(row_to_json(r)::text,'UTF8')),'hex') AS row_hash FROM cohamy_crm."${name}" r) h`)).rows[0];
    manifest.push({table:name,...hash});
  }
  return manifest;
}

async function main() {
  const [manifestPath,membershipId,warehouseId,output,applyDigest]=process.argv.slice(2);
  assert.ok(manifestPath&&membershipId&&warehouseId&&output,'Usage: manifest.json adminMembershipId warehouseId report.json [reviewedPreviewChecksum]');
  assert.ok(['LOCAL','PRODUCTION','STAGING'].includes(process.env.CRM_ENVIRONMENT??''),'EXPLICIT_ENVIRONMENT_REQUIRED');
  if(process.env.CRM_ENVIRONMENT==='PRODUCTION') {
    const target=new URL(process.env.CRM_DATABASE_URL??'');
    assert.ok(process.env.CRM_DATABASE_MODE==='postgres'&&['localhost','127.0.0.1'].includes(target.hostname)&&target.port==='55432'&&target.pathname==='/cohamy_crm','VERIFIED_COHAMY_DATABASE_REQUIRED');
  }
  const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8')) as {invoices:{snapshot:unknown;filename:string;sourceFile:string;sourceSha256?:string}[]};
  assert.ok(Array.isArray(manifest.invoices)&&manifest.invoices.length>0&&manifest.invoices.length<=50,'INVALID_MANIFEST');
  const directory=path.dirname(path.resolve(manifestPath));
  const invoices:{snapshot:unknown;filename:string;content:Buffer}[]=[];
  for(const file of manifest.invoices) {
    assert.ok(typeof file.sourceFile==='string'&&!path.isAbsolute(file.sourceFile),'RELATIVE_SOURCE_REQUIRED');
    const target=path.resolve(directory,file.sourceFile),relative=path.relative(directory,target);
    assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'SOURCE_MUST_STAY_IN_IMPORT_DIRECTORY');
    const stat=await fs.stat(target);assert.ok(stat.size>0&&stat.size<=20971520,'SOURCE_SIZE_INVALID');
    const content=await fs.readFile(target);
    if(file.sourceSha256)assert.equal(createHash('sha256').update(content).digest('hex'),file.sourceSha256,'ORIGINAL_SOURCE_CHANGED');
    invoices.push({snapshot:file.snapshot,filename:file.filename,content});
  }
  const db=await database();
  try {
    const user=await membershipPrincipal(membershipId,db);assert.ok(user,'ACTIVE_ADMIN_MEMBERSHIP_REQUIRED');
    let unchangedTables:Awaited<ReturnType<typeof ledgerFingerprint>>|undefined;
    const cache=globalThis as unknown as {cohamyCrmDatabase?:Promise<Database>};
    const report=applyDigest?await db.transaction(async tx=>{
      // One stable database snapshot proves this import itself does not rewrite
      // existing business tables, even while other users legitimately work.
      await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      const scoped:Database={...tx,transaction:run=>run(tx),close:async()=>{}};
      cache.cohamyCrmDatabase=Promise.resolve(scoped);
      try {
        const before=await ledgerFingerprint(tx);
        const result=await importHistoricalInvoices(user,{warehouseId,invoices},applyDigest);
        assert.deepEqual(await ledgerFingerprint(tx),before,'EXISTING_BUSINESS_TABLES_CHANGED_ABORTING_IMPORT');
        unchangedTables=before;
        return result;
      } finally {cache.cohamyCrmDatabase=Promise.resolve(db);}
    }):await importHistoricalInvoices(user,{warehouseId,invoices});
    await fs.mkdir(path.dirname(output),{recursive:true});
    await fs.writeFile(output,JSON.stringify({environment:process.env.CRM_ENVIRONMENT,testedAt:new Date().toISOString(),...report,unchangedTables},null,2)+'\n',{mode:0o600});
    console.log(JSON.stringify({environment:process.env.CRM_ENVIRONMENT,mode:report.mode,warehouse:report.warehouse.name,invoiceCount:report.results.length,total:report.total,checksum:report.checksum,report:output}));
  } finally {await db.close();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'IMPORT_FAILED');process.exitCode=1;});
