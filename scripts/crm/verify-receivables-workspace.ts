import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {database,type Database} from '../../lib/crm/db';
import {membershipPrincipal} from '../../lib/crm/auth';
import {financeOverview} from '../../lib/crm/finance';
import {receivablesWorkspaceSummary} from '../../lib/crm/receivables-workspace';

async function main(){
 const [membershipId,output]=process.argv.slice(2);assert.ok(membershipId&&output);assert.equal(process.env.CRM_ENVIRONMENT,'STAGING');
 const target=new URL(process.env.CRM_DATABASE_URL??'');assert.equal(process.env.CRM_DATABASE_MODE,'postgres');assert.ok(['localhost','127.0.0.1'].includes(target.hostname)&&target.port==='55432'&&/^\/cohamy_restore_[a-z0-9_]+$/.test(target.pathname));
 const db=await database(),cases:{name:string;status:string}[]=[],cache=globalThis as unknown as {cohamyCrmDatabase?:Promise<Database>};
 const pass=(name:string)=>cases.push({name,status:'PASS'});
 try{
  const admin=await membershipPrincipal(membershipId,db);assert.ok(admin&&admin.role==='ADMIN');
  const baseline=await receivablesWorkspaceSummary(admin),native=await financeOverview(admin);
  assert.equal(baseline.rows.reduce((sum,r)=>sum+BigInt(r.remainingAmount),0n),native.receivables.filter(r=>!['PAID','VOID'].includes(r.status)).reduce((sum,r)=>sum+BigInt(r.remaining_amount),0n));pass('Current full-ledger totals agree with the native posted receivable source');
  await assert.rejects(receivablesWorkspaceSummary({...admin,area:'portal',role:'DEALER_OWNER'}),e=>(e as {status:number}).status===403);pass('Internal summary rejects a portal principal before reading ledger data');
  const prefix='QA_FINANCE_UI_'+randomUUID().slice(0,8),orgId=randomUUID();
  try{
   await db.transaction(async sql=>{
    await sql.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    cache.cohamyCrmDatabase=Promise.resolve({...sql,transaction:run=>run(sql),close:async()=>{}});
    try{
     await sql.query("INSERT INTO cohamy_crm.organizations(id,code,name,kind) VALUES($1,$2,'LOCAL QA finance aggregation partner','CUSTOMER')",[orgId,prefix]);
     await sql.query('INSERT INTO cohamy_crm.credit_accounts(organization_id,limit_amount,used_amount,terms_days,enabled) VALUES($1,100000,5000,30,true)',[orgId]);
     for(let index=0;index<201;index++)await sql.query("INSERT INTO cohamy_crm.receivables(id,code,organization_id,source_type,source_id,original_amount,remaining_amount,due_on,terms_snapshot,status) VALUES($1,$2,$3,'QA',$4,100,100,$5::date+($6::integer),'{\"source\":\"ROLLBACK_ONLY\"}','OPEN')",[randomUUID(),prefix+'_'+index,orgId,String(index),baseline.asOf,index<100?-1:index===100?0:1]);
     for(let index=0;index<3;index++)await sql.query("INSERT INTO cohamy_crm.payment_receipts(id,code,organization_id,amount,allocated_amount,kind,status,paid_at,reference,actor_id) VALUES($1,$2,$3,$4,$5,'PAYMENT',$6,now(),'QA rollback-only',$7)",[randomUUID(),prefix+'_PAY_'+index,orgId,index===2?777:1000,index===2?0:400,index===2?'PENDING':'CONFIRMED',admin.id]);
     const summary=await receivablesWorkspaceSummary(admin),row=summary.rows.find(r=>r.organizationId===orgId);assert.ok(row);assert.equal(row.receivableCount,201);assert.equal(row.remainingAmount,'20100');assert.equal((await financeOverview(admin)).receivables.length,200);pass('Summary includes records beyond the 200-row detail cap');
     assert.equal(row.overdueAmount,'10000');assert.equal(row.outstandingCount,201);pass('Due-today and future rows are not mislabeled overdue');
     assert.equal(row.usedAmount,'5000');assert.equal(row.availableCredit,'95000');assert.equal(row.remainingAmount,'20100');pass('Credit exposure stays separate from posted debt');
     assert.equal(row.unallocatedPaymentAmount,'1200');assert.equal(row.pendingPaymentCount,1);pass('Confirmed unallocated funds exclude pending proofs and do not multiply across receivables');
     const held=(await sql.query<{order_id:string;receivable_id:string;receivable_status:string;hold_status:string}>("SELECT h.order_id,r.id AS receivable_id,r.status AS receivable_status,h.status AS hold_status FROM cohamy_crm.credit_holds h JOIN cohamy_crm.sales_orders s ON s.id=h.order_id JOIN cohamy_crm.receivables r ON r.order_id=s.id WHERE s.status='CONFIRMED' AND r.status<>'VOID' LIMIT 1")).rows[0];assert.ok(held,'Native held order fixture required');
     await sql.query("UPDATE cohamy_crm.receivables SET status='VOID' WHERE id=$1",[held.receivable_id]);await sql.query("UPDATE cohamy_crm.credit_holds SET status='ACTIVE' WHERE order_id=$1",[held.order_id]);assert.ok((await receivablesWorkspaceSummary(admin)).postableOrders.some(order=>order.id===held.order_id));
     await sql.query("UPDATE cohamy_crm.credit_holds SET status='POSTED' WHERE order_id=$1",[held.order_id]);assert.ok(!(await receivablesWorkspaceSummary(admin)).postableOrders.some(order=>order.id===held.order_id));
     await sql.query("UPDATE cohamy_crm.credit_holds SET status='ACTIVE' WHERE order_id=$1",[held.order_id]);await sql.query('UPDATE cohamy_crm.receivables SET status=$1 WHERE id=$2',[held.receivable_status,held.receivable_id]);assert.ok(!(await receivablesWorkspaceSummary(admin)).postableOrders.some(order=>order.id===held.order_id));pass('Posting picker accepts active held confirmed orders and excludes posted debt or inactive holds');
     throw Error('ROLLBACK_QA_FINANCE_ROWS');
    }finally{cache.cohamyCrmDatabase=Promise.resolve(db);}
   });
  }catch(error){if(!(error instanceof Error&&error.message==='ROLLBACK_QA_FINANCE_ROWS'))throw error;}
  assert.equal((await db.query('SELECT id FROM cohamy_crm.organizations WHERE id=$1',[orgId])).rows.length,0);assert.deepEqual(await receivablesWorkspaceSummary(admin),baseline);pass('Every synthetic finance row rolls back and original totals remain unchanged');
  const report={environment:'STAGING isolated restore of native production PostgreSQL',status:'PASS',testedAt:new Date().toISOString(),cases,baseline:{remaining:baseline.rows.reduce((sum,r)=>sum+BigInt(r.remainingAmount),0n).toString(),unposted:baseline.rows.reduce((sum,r)=>sum+BigInt(r.unpostedAmount),0n).toString(),usedCredit:baseline.rows.reduce((sum,r)=>sum+BigInt(r.usedAmount),0n).toString(),postableOrders:baseline.postableOrders.length},writes:'STAGING synthetic rows rolled back; no production finance mutation or outbound message'};
  await fs.writeFile(output,JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({status:report.status,checks:cases.length,baseline:report.baseline}));
 }finally{await db.close();}
}
main().catch(e=>{console.error(e instanceof Error?e.message:'FINANCE_UI_QA_FAILED');process.exitCode=1;});
