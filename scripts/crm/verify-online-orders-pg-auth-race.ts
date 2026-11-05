import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Pool,type PoolClient} from 'pg';
import {database} from '../../lib/crm/db';
import {login} from '../../lib/crm/auth';
import {CrmError} from '../../lib/crm/permissions';
import {getPublicStorefront} from '../../lib/crm/storefront';
import {createWebsiteOrder} from '../../lib/crm/website-orders';
import {getOnlineOrder,assignOnlineOrder,acceptOnlineOrder} from '../../lib/crm/online-orders';
import {qaPassword} from './qa-fixture';

async function main(){
  assert.equal(process.env.CRM_DATABASE_MODE,'postgres');assert.equal(process.env.CRM_ENVIRONMENT,'STAGING');
  const originalUrl=new URL(process.env.CRM_DATABASE_URL??'');
  assert.ok(['localhost','127.0.0.1'].includes(originalUrl.hostname));assert.equal(originalUrl.port,'55432');
  assert.match(originalUrl.pathname,/^\/cohamy_qa_online_[0-9a-f]{32}$/);assert.match(originalUrl.username,/^qa_commercial_[0-9a-f]{32}$/);
  const tag='qa_online_auth_'+randomUUID().replaceAll('-','').slice(0,16),serviceUrl=new URL(originalUrl);
  serviceUrl.searchParams.set('application_name',tag);serviceUrl.searchParams.set('options','-c statement_timeout=15000');
  process.env.CRM_DATABASE_URL=serviceUrl.href;process.env.CRM_EMAIL_ENABLED='false';process.env.CRM_WEBSITE_ORDER_INTAKE='true';
  const controllerUrl=new URL(originalUrl);controllerUrl.searchParams.delete('application_name');
  const controllers=new Pool({connectionString:controllerUrl.href,application_name:tag+'_control',max:5,statement_timeout:15000});
  const db=await database(),admin=(await login('admin@crm-qa.invalid',qaPassword)).user,warehouse=(await login('warehouse@crm-qa.invalid',qaPassword)).user;
  assert.equal(warehouse.role,'WAREHOUSE');
  const identity=(await controllers.query<{role:string;database:string}>('SELECT current_user AS role,current_database() AS database')).rows[0];
  assert.match(identity.role,/^qa_commercial_[0-9a-f]{32}$/);assert.match(identity.database,/^cohamy_qa_online_[0-9a-f]{32}$/);
  const target=(await controllers.query<{id:string}>(`SELECT w.id FROM cohamy_crm.warehouses w JOIN cohamy_crm.warehouse_assignments wa ON wa.warehouse_id=w.id WHERE wa.membership_id=$1 AND w.organization_id=$2 AND w.active AND w.region='NORTH' ORDER BY w.code,w.id LIMIT 1`,[warehouse.membershipId,admin.organizationId])).rows[0];
  assert.ok(target,'Existing generic QA warehouse must have an active Cohamy North grant');
  const cases:{name:string;status:'PASS'|'FAIL';error?:string}[]=[],observations:Record<string,unknown>[]=[],createdOrderIds:string[]=[];
  let complete=false;
  const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const snapshot=async(id:string)=>(await db.query<{row:unknown}>('SELECT to_jsonb(o) AS row FROM cohamy_crm.website_orders o WHERE id=$1',[id])).rows[0].row;
  const test=async(name:string,run:()=>Promise<void>)=>{try{await run();cases.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){cases.push({name,status:'FAIL',error:error instanceof Error?error.message:'UNKNOWN'});throw error;}};
  async function waitForLock(queryPattern:RegExp,pid?:number){
    const deadline=Date.now()+10000;
    while(Date.now()<deadline){
      const rows=(await controllers.query<{pid:number;query:string}>(`SELECT pid,query FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND state='active' AND ($1::integer IS NULL OR pid=$1) AND ($1::integer IS NOT NULL OR application_name=$2)`,[pid??null,tag])).rows;
      const match=rows.find(row=>queryPattern.test(row.query));if(match)return match.pid;
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    throw Error('EXPECTED_CONTROLLED_POSTGRES_LOCK_NOT_OBSERVED');
  }
  async function freshAssigned(label:string){
    const quote=await getPublicStorefront(),item=quote.items.find(row=>row.available&&row.salePrice!==null);assert.ok(item);
    const receipt=await createWebsiteOrder({idempotencyKey:randomUUID(),locale:'vi',payment:'cod',quoteVersion:quote.quoteVersion,acceptedPolicyVersion:'2026-11-05',contact:{fullName:'LOCAL QA auth race '+label,email:'auth-race@crm-qa.invalid',phone:'0980000000',address:'LOCAL QA only; never ship',city:'QA city',district:'',ward:'',note:'Controlled authorization concurrency test'},items:[{productId:item.productId,quantity:1}]});
    const id=(await db.query<{id:string}>('SELECT id FROM cohamy_crm.website_orders WHERE code=$1',[receipt.code])).rows[0].id;createdOrderIds.push(id);
    await assignOnlineOrder(admin,id,{version:1,warehouseId:target.id,reason:'LOCAL QA North authorization-race assignment',idempotencyKey:randomUUID()});return id;
  }
  async function restoreGrant(){await controllers.query('INSERT INTO cohamy_crm.warehouse_assignments(membership_id,warehouse_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[warehouse.membershipId,target.id]);}
  async function rollback(client:PoolClient){await client.query('ROLLBACK').catch(()=>{});}
  try{
    await test('Acceptance holds its generic grant while waiting for the warehouse row, and revocation waits',async()=>{
      const id=await freshAssigned('acceptance-first'),gate=await controllers.connect(),revoke=await controllers.connect();
      let accepting:ReturnType<typeof acceptOnlineOrder>|undefined;
      let acceptanceOutcome:Promise<{ok:true;value:Awaited<ReturnType<typeof acceptOnlineOrder>>}|{ok:false;error:unknown}>|undefined;
      let deleting:Promise<unknown>|undefined;
      try{
        await gate.query('BEGIN');await gate.query('SELECT id FROM cohamy_crm.warehouses WHERE id=$1 FOR UPDATE',[target.id]);
        accepting=acceptOnlineOrder(warehouse,id,{version:2,reason:'LOCAL QA acceptance wins the authorization lock',idempotencyKey:randomUUID()});
        acceptanceOutcome=accepting.then(value=>({ok:true as const,value}),error=>({ok:false as const,error}));
        const acceptPid=await waitForLock(/FOR\s+SHARE\s+OF\s+w\s*,\s*owner/i);
        await revoke.query('BEGIN');
        let nowaitCode='';
        try{await revoke.query('SELECT membership_id FROM cohamy_crm.warehouse_assignments WHERE membership_id=$1 AND warehouse_id=$2 FOR UPDATE NOWAIT',[warehouse.membershipId,target.id]);}
        catch(error){nowaitCode=(error as {code?:string}).code??'';}
        finally{await rollback(revoke);}
        assert.equal(nowaitCode,'55P03','The acceptance transaction must already hold SHARE on this exact grant');
        await revoke.query('BEGIN');const revokePid=(await revoke.query<{pid:number}>('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        let deleteFinished=false;
        deleting=revoke.query('DELETE FROM cohamy_crm.warehouse_assignments WHERE membership_id=$1 AND warehouse_id=$2 RETURNING membership_id',[warehouse.membershipId,target.id]).then(result=>{deleteFinished=true;return result;});
        const deleteOutcome=deleting.then(value=>({ok:true as const,value}),error=>({ok:false as const,error}));
        await waitForLock(/DELETE\s+FROM\s+cohamy_crm\.warehouse_assignments/i,revokePid);assert.equal(deleteFinished,false);
        await gate.query('COMMIT');const accepted=await acceptanceOutcome;
        if(!accepted.ok)throw accepted.error;assert.equal(accepted.ok,true);assert.equal(accepted.value.dispatchStatus,'ACCEPTED');assert.equal(accepted.value.version,3);
        const deletion=await deleteOutcome;if(!deletion.ok)throw deletion.error;assert.equal(deletion.ok,true);await revoke.query('COMMIT');
        assert.equal((await getOnlineOrder(admin,id,{})).order.dispatch.status,'ACCEPTED');
        await assert.rejects(getOnlineOrder(warehouse,id,{}),error=>error instanceof CrmError&&[403,404].includes(error.status));
        await assert.rejects(acceptOnlineOrder(warehouse,id,{version:3,reason:'LOCAL QA post-revocation attempt',idempotencyKey:randomUUID()}),error=>error instanceof CrmError&&[403,404].includes(error.status));
        observations.push({schedule:'acceptance-first',acceptWaitedOnWarehouseRow:true,acceptPid,grantNowaitCode:nowaitCode,revokePid,revocationWaitObserved:true,acceptCommitted:true,revokedReadAndAcceptDenied:true});
      }finally{
        await rollback(gate);await rollback(revoke);await acceptanceOutcome;await deleting?.catch(()=>{});gate.release();revoke.release();await restoreGrant();
      }
    });
    await test('Committed revocation wins a blocked grant check and acceptance rolls back without changing the order',async()=>{
      const id=await freshAssigned('revocation-first'),before=await snapshot(id),revoke=await controllers.connect(),actionKey=randomUUID();
      let outcome:Promise<{ok:true;value:Awaited<ReturnType<typeof acceptOnlineOrder>>}|{ok:false;error:unknown}>|undefined;
      try{
        await revoke.query('BEGIN');await revoke.query('DELETE FROM cohamy_crm.warehouse_assignments WHERE membership_id=$1 AND warehouse_id=$2',[warehouse.membershipId,target.id]);
        outcome=acceptOnlineOrder(warehouse,id,{version:2,reason:'LOCAL QA revocation wins the grant check',idempotencyKey:actionKey}).then(value=>({ok:true as const,value}),error=>({ok:false as const,error}));
        const acceptPid=await waitForLock(/warehouse_assignments[\s\S]*FOR\s+SHARE/i);
        await revoke.query('COMMIT');const result=await outcome;
        assert.equal(result.ok,false);if(result.ok)throw Error('Revoked generic grant must not accept');
        assert.ok(result.error instanceof CrmError);assert.ok([403,404].includes(result.error.status));
        assert.deepEqual(await snapshot(id),before);assert.equal((await getOnlineOrder(admin,id,{})).history.total,1);
        assert.equal((await db.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.website_order_dispatch_actions WHERE id=$1',[actionKey])).rows[0].n,'0');
        await assert.rejects(getOnlineOrder(warehouse,id,{}),error=>error instanceof CrmError&&[403,404].includes(error.status));
        observations.push({schedule:'revocation-first',acceptPid,waitedForGrantTransaction:true,deniedStatus:result.error.status,unchangedOrderHash:hash(before),acceptanceReceiptCount:0});
      }finally{await rollback(revoke);await outcome;revoke.release();await restoreGrant();}
    });
    complete=true;
  }finally{
    await restoreGrant();
    const restored=Number((await controllers.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.warehouse_assignments WHERE membership_id=$1 AND warehouse_id=$2',[warehouse.membershipId,target.id])).rows[0].n)===1;
    await fs.mkdir('docs/crm/test-results/online-orders',{recursive:true});
    const fileHash=async(path:string)=>createHash('sha256').update(await fs.readFile(path)).digest('hex');
    await fs.writeFile('docs/crm/test-results/online-orders/auth-scope-race-staging.json',JSON.stringify({status:complete&&restored?'PASS':'FAIL',environment:'STAGING existing isolated PostgreSQL fixture; restricted DML role; controlled transaction gates and observed pg_stat_activity locks',testedAt:new Date().toISOString(),cases,observations,sourceScriptSha256:await fileHash(fileURLToPath(import.meta.url)),serviceSourceSha256:await fileHash('lib/crm/online-orders.ts'),createdQaOrderIds:createdOrderIds,originalGrantRestored:restored,externalEmails:0,productionWrites:0,workerInvoked:false,limitations:'Generic warehouse grant revocation tested in both lock orders. Regional scope recheck is not independently raced by this helper.'},null,2)+'\n');
    await controllers.end();await db.close();
  }
}
main().catch(error=>{console.error(error instanceof Error?error.message:'ONLINE_PG_AUTH_RACE_FAILED');process.exitCode=1;});
