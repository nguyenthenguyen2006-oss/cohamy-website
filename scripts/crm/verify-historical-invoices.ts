import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import { createQaFixture, qaPassword } from './qa-fixture';
import { database } from '../../lib/crm/db';
import { login } from '../../lib/crm/auth';
import { createAccount } from '../../lib/crm/repository';
import { roles, type Principal } from '../../lib/crm/types';
import { visibleModules } from '../../lib/crm/modules';
import { historicalInvoiceSchema } from '../../lib/crm/historical-order-model';
import { historicalInvoice, historicalInvoiceSource, listHistoricalInvoices, importHistoricalInvoices } from '../../lib/crm/historical-orders';
import { databaseManifest } from './database-manifest';

const cases:{name:string;status:'PASS'}[]=[];
const status=(value:number)=>(error:unknown)=>(error as {status:number}).status===value;
async function check(name:string,run:()=>Promise<void>) {await run();cases.push({name,status:'PASS'});console.log('PASS '+name);}
async function main() {
  process.env.CRM_DATABASE_MODE='pglite';process.env.CRM_ENVIRONMENT='LOCAL';
  process.env.CRM_LOCAL_DATA_DIR='.local/crm-qa-historical-'+randomUUID();
  const ids=await createQaFixture(),db=await database();
  const admin=(await login('admin@crm-qa.invalid',qaPassword)).user;
  const south=randomUUID(),north=randomUUID();
  for(const [id,region] of [[south,'SOUTH'],[north,'NORTH']])await db.query("INSERT INTO cohamy_crm.warehouses(id,code,name,organization_id,region) VALUES($1,$2,$3,$4,$5)",[id,'QA_HISTORY_'+region,'LOCAL QA · Kho '+region,admin.organizationId,region]);
  for(const role of ['MANAGER','WAREHOUSE_HCM','WAREHOUSE_HN','FACTORY'] as const)await createAccount(admin,{email:role.toLowerCase()+'@crm-qa.invalid',displayName:'LOCAL QA '+role,password:qaPassword,role,organizationId:admin.organizationId});
  await createAccount(admin,{email:'dealer_staff@crm-qa.invalid',displayName:'LOCAL QA dealer staff',password:qaPassword,role:'DEALER_STAFF',organizationId:ids.dealerA});
  const users=new Map<string,Principal>();
  for(const role of roles)users.set(role,(await login(role==='DEALER_OWNER'?'a@crm-qa.invalid':role.toLowerCase()+'@crm-qa.invalid',qaPassword)).user);
  const png=await sharp({create:{width:40,height:40,channels:3,background:'#f7e9cb'}}).png().toBuffer();
  const checksum=createHash('sha256').update(png).digest('hex');
  const snapshots=[1,2,4,5].map(number=>({series:'1C26QA',number:String(number),date:'2026-10-05',sellerName:'LOCAL QA seller',sellerTaxId:'0111111111',buyerName:'LOCAL QA buyer '+number,buyerContact:'',buyerTaxId:'0222222222',buyerAddress:'LOCAL QA synthetic address',lines:[{name:'LOCAL QA product',unit:'Gói' as const,quantity:12,unitPrice:41520,amount:498240}],currency:'VND' as const,subtotal:498240,vatRatePercent:8,vatAmount:39860,total:538100,paidAmount:538100,paymentStatus:'PAID' as const,paymentConfirmation:'USER_CONFIRMED_FULLY_PAID' as const,note:'Original rounded VAT retained; synthetic fixture'}));
  const input={warehouseId:south,invoices:snapshots.map(snapshot=>({snapshot,filename:'LOCAL-QA.png',content:png}))};
  let imported:Awaited<ReturnType<typeof importHistoricalInvoices>>;
  try {
    await check('Preview validates original rounded amounts without writing any business or audit rows',async()=>{
      const before=await databaseManifest(db);const preview=await importHistoricalInvoices(admin,input);
      assert.equal(preview.mode,'PREVIEW');assert.equal(preview.results.length,4);assert.ok(preview.results.every(item=>item.id===null));
      assert.deepEqual(await databaseManifest(db),before);
    });
    await check('Apply requires the exact reviewed source and warehouse digest',async()=>{
      await assert.rejects(importHistoricalInvoices(admin,input,'0'.repeat(64)),status(409));
      const preview=await importHistoricalInvoices(admin,input);
      await assert.rejects(importHistoricalInvoices(admin,{...input,warehouseId:north},preview.checksum),status(409));
      const before=await databaseManifest(db);imported=await importHistoricalInvoices(admin,input,preview.checksum);
      assert.equal(imported.mode,'APPLIED');assert.equal(imported.total,2152400);
      const after=await databaseManifest(db);
      for(const table of before.tables.filter(row=>!['historical_order_invoices','audit_events'].includes(row.name)))assert.deepEqual(after.tables.find(row=>row.name===table.name),table,table.name);
      assert.equal((await db.query("SELECT id FROM cohamy_crm.audit_events WHERE action='historical-invoice.imported'")).rows.length,4);
    });
    await check('Repeated and concurrent imports retain exactly four records',async()=>{
      const results=await Promise.all([importHistoricalInvoices(admin,input,imported.checksum),importHistoricalInvoices(admin,input,imported.checksum)]);
      assert.ok(results.every(result=>result.results.every(item=>item.action==='ALREADY_IMPORTED')));
      assert.equal((await listHistoricalInvoices(admin)).total,4);
      assert.deepEqual(results[0].results.map(r=>r.id),imported.results.map(r=>r.id));
    });
    await check('A changed duplicate rejects and rolls back the whole batch, including preceding new invoices',async()=>{
      const conflict={...input,invoices:[{...input.invoices[0],snapshot:{...snapshots[0],number:'99'}},{...input.invoices[1],snapshot:{...snapshots[1],buyerName:'Changed source'}}]};
      const before=await databaseManifest(db);
      await assert.rejects(importHistoricalInvoices(admin,conflict),status(409));
      // Use a digest from a conflict-free preview to reach the insert-then-conflict branch.
      const {commercialDigest}=await import('../../lib/crm/commercial-common');
      const digest=commercialDigest({organizationId:admin.organizationId,warehouseId:south,invoices:conflict.invoices.map(file=>({snapshot:file.snapshot,filename:file.filename,checksum}))});
      await assert.rejects(importHistoricalInvoices(admin,conflict,digest),status(409));
      assert.deepEqual(await databaseManifest(db),before);
    });
    await check('Bad totals, incomplete payments, duplicate invoice keys, traversal and invalid PNG bytes fail before persistence',async()=>{
      for(const snapshot of [{...snapshots[0],paidAmount:0},{...snapshots[0],total:1},{...snapshots[0],subtotal:1},{...snapshots[0],date:'2026-02-30'},{...snapshots[0],lines:[{...snapshots[0].lines[0],amount:5}]}])assert.equal(historicalInvoiceSchema.safeParse(snapshot).success,false);
      await assert.rejects(importHistoricalInvoices(admin,{...input,invoices:[input.invoices[0],input.invoices[0]]}),status(400));
      await assert.rejects(importHistoricalInvoices(admin,{...input,invoices:[{...input.invoices[0],filename:'../x.png'}]}),status(400));
      await assert.rejects(importHistoricalInvoices(admin,{...input,invoices:[{...input.invoices[0],content:Buffer.from('<script>bad</script>')}]}),status(400));
    });
    await check('Role matrix and regional warehouse scope protect metadata, private image bytes and imports',async()=>{
      for(const role of roles) {
        const user=users.get(role)!;const allowed=['ADMIN','MANAGER','ACCOUNTANT','WAREHOUSE_HCM'].includes(role),readPermission=['ADMIN','MANAGER','ACCOUNTANT','WAREHOUSE_HCM','WAREHOUSE_HN','WAREHOUSE'].includes(role);
        assert.equal(visibleModules(user).some(row=>row.id==='historical-orders'),readPermission);
        if(readPermission)assert.equal((await listHistoricalInvoices(user)).total,allowed?4:0);
        else await assert.rejects(listHistoricalInvoices(user),status(403));
        if(allowed){const file=await historicalInvoiceSource(user,imported.results[0].id!);assert.deepEqual(file.content,png);assert.equal(file.source_checksum,checksum);}
        else await assert.rejects(historicalInvoiceSource(user,imported.results[0].id!),status(readPermission?404:403));
        if(role!=='ADMIN')await assert.rejects(importHistoricalInvoices(user,input),status(403));
      }
      const generic=users.get('WAREHOUSE')!;
      await db.query('INSERT INTO cohamy_crm.warehouse_assignments(membership_id,warehouse_id) VALUES($1,$2)',[generic.membershipId,south]);
      assert.equal((await listHistoricalInvoices(generic)).total,4);
      assert.equal((await historicalInvoiceSource(generic,imported.results[0].id!)).source_checksum,checksum);
      await assert.rejects(listHistoricalInvoices({...admin,area:'portal'}),status(403));
    });
    await check('Search and aggregate totals follow the same access scope and metadata has no raw bytes',async()=>{
      const data=await listHistoricalInvoices(users.get('ACCOUNTANT')!,{q:'buyer 2'});
      assert.equal(data.total,1);assert.equal(data.amount,'538100');assert.equal(data.paid,'538100');assert.equal('source_content' in data.items[0],false);
      assert.equal((await listHistoricalInvoices(admin,{q:"' OR 1=1 --"})).total,0);
      await assert.rejects(historicalInvoice(admin,'not-a-uuid'),status(404));
      assert.equal((await listHistoricalInvoices(users.get('WAREHOUSE_HN')!)).amount,'0');
    });
    await check('Database prevents rewriting or deleting imported invoices; backup checks actual image hashes',async()=>{
      await assert.rejects(db.query('UPDATE cohamy_crm.historical_order_invoices SET source_content=$1 WHERE id=$2',[png,imported.results[0].id]),/AUDIT_APPEND_ONLY/);
      await assert.rejects(db.query('DELETE FROM cohamy_crm.historical_order_invoices WHERE id=$1',[imported.results[0].id]),/AUDIT_APPEND_ONLY/);
      assert.equal((await databaseManifest(db)).fileIntegrityErrors,'0');
    });
    await check('Stale, disabled and forged role principals cannot read or import',async()=>{
      await assert.rejects(listHistoricalInvoices({...admin,role:'MANAGER'}),status(403));
      const user=users.get('ACCOUNTANT')!;
      await db.query('UPDATE cohamy_crm.memberships SET version=version+1 WHERE id=$1',[user.membershipId]);
      await assert.rejects(historicalInvoiceSource(user,imported.results[0].id!),status(403));
      await db.query('UPDATE cohamy_crm.users SET active=false WHERE id=$1',[users.get('MANAGER')!.id]);
      await assert.rejects(listHistoricalInvoices(users.get('MANAGER')!),status(403));
    });
    // Refresh identities only for the isolated browser fixture after revocation tests.
    await db.query('UPDATE cohamy_crm.users SET active=true WHERE id=$1',[users.get('MANAGER')!.id]);
    await fs.mkdir('.local',{recursive:true});
    await fs.writeFile('.local/historical-invoices-qa.json',JSON.stringify({dataDir:process.env.CRM_LOCAL_DATA_DIR,warehouseId:south,ids:imported!.results.map(r=>r.id),checksum},null,2)+'\n');
    await fs.mkdir('docs/crm/test-results',{recursive:true});
    await fs.writeFile('docs/crm/test-results/historical-invoices-services-local.json',JSON.stringify({environment:'LOCAL isolated PGlite; synthetic invoices only',status:'PASS',testedAt:new Date().toISOString(),cases},null,2)+'\n');
  } finally {await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
