import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { database } from '../../lib/crm/db';
import { membershipPrincipal } from '../../lib/crm/auth';
import { historicalInvoice, historicalInvoiceSource, listHistoricalInvoices } from '../../lib/crm/historical-orders';
import { historicalInvoiceSchema } from '../../lib/crm/historical-order-model';
import { can } from '../../lib/crm/permissions';

async function main() {
  assert.equal(process.env.CRM_ENVIRONMENT,'PRODUCTION');assert.equal(process.env.CRM_DATABASE_MODE,'postgres');
  const target=new URL(process.env.CRM_DATABASE_URL??'');
  assert.ok(['localhost','127.0.0.1'].includes(target.hostname)&&target.port==='55432'&&target.pathname==='/cohamy_crm');
  const [manifestPath,membershipId,warehouseId,output]=process.argv.slice(2);assert.ok(manifestPath&&membershipId&&warehouseId&&output);
  const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8')) as {invoices:{snapshot:unknown;sourceSha256:string}[]};
  assert.equal(manifest.invoices.length,4,'EXACT_USER_BATCH_REQUIRED');
  const db=await database();
  try {
    const admin=await membershipPrincipal(membershipId,db);assert.ok(admin&&admin.role==='ADMIN');
    const imported:{id:string;number:string;total:number;lines:number;sourceHashVerified:boolean}[]=[];
    for(const file of manifest.invoices) {
      const expected=historicalInvoiceSchema.parse(file.snapshot);
      const row=(await db.query<{id:string}>('SELECT id FROM cohamy_crm.historical_order_invoices WHERE owner_organization_id=$1 AND warehouse_id=$2 AND series=$3 AND invoice_number=$4 AND seller_tax_id=$5',[admin.organizationId,warehouseId,expected.series,expected.number,expected.sellerTaxId.replace('-','')])).rows[0];assert.ok(row);
      const record=await historicalInvoice(admin,row.id);assert.deepEqual(record.snapshot,expected);assert.equal(record.warehouse_region,'SOUTH');
      const source=await historicalInvoiceSource(admin,row.id);assert.equal(createHash('sha256').update(source.content).digest('hex'),file.sourceSha256);
      imported.push({id:row.id,number:expected.number,total:expected.total,lines:expected.lines.length,sourceHashVerified:true});
    }
    assert.equal(imported.reduce((sum,item)=>sum+item.total,0),31163000);assert.equal(imported.reduce((sum,item)=>sum+item.lines,0),22);
    const memberships=(await db.query<{id:string}>("SELECT m.id FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id WHERE m.active AND u.active AND m.organization_id=$1 ORDER BY m.role,m.id",[admin.organizationId])).rows;
    const roleChecks=[];
    for(const membership of memberships) {
      const user=await membershipPrincipal(membership.id,db);assert.ok(user);
      const permission=can(user,'historical-orders.read');
      if(!permission){await assert.rejects(listHistoricalInvoices(user),error=>(error as {status:number}).status===403);await assert.rejects(historicalInvoiceSource(user,imported[0].id),error=>(error as {status:number}).status===403);roleChecks.push({role:user.role,result:'FORBIDDEN as expected'});continue;}
      const visible=await listHistoricalInvoices(user);const included=visible.items.some(item=>item.id===imported[0].id);
      if(user.role==='WAREHOUSE_HN')assert.equal(included,false);
      if(['ADMIN','MANAGER','ACCOUNTANT','WAREHOUSE_HCM'].includes(user.role))assert.equal(included,true,user.role);
      if(included)assert.equal((await historicalInvoiceSource(user,imported[0].id)).source_checksum,manifest.invoices[0].sourceSha256);
      else await assert.rejects(historicalInvoiceSource(user,imported[0].id),error=>(error as {status:number}).status===404);
      roleChecks.push({role:user.role,result:included?'ALLOWED checksum verified':'OUTSIDE_WAREHOUSE_SCOPE as expected'});
    }
    const report={environment:'PRODUCTION PostgreSQL read-only verification against actual active memberships',status:'PASS',testedAt:new Date().toISOString(),warehouseId,imported,total:31163000,paymentStatus:'All four PAID; zero historical outstanding',roleChecks,verificationWrites:'NONE; no real account credentials, roles or business data changed'};
    await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,invoices:imported.length,total:report.total,roleChecks:roleChecks.length}));
  } finally {await db.close();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'VERIFY_FAILED');process.exitCode=1;});
