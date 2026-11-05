import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {database} from '../../lib/crm/db';
import {login} from '../../lib/crm/auth';
import {CrmError} from '../../lib/crm/permissions';
import {getPublicStorefront} from '../../lib/crm/storefront';
import {createWebsiteOrder} from '../../lib/crm/website-orders';
import {listOnlineOrders,getOnlineOrder,assignOnlineOrder} from '../../lib/crm/online-orders';
import {qaPassword} from './qa-fixture';

async function main(){
  assert.equal(process.env.CRM_DATABASE_MODE,'postgres');assert.equal(process.env.CRM_ENVIRONMENT,'STAGING');
  const target=new URL(process.env.CRM_DATABASE_URL??'');
  assert.ok(['localhost','127.0.0.1'].includes(target.hostname));assert.equal(target.port,'55432');assert.match(target.pathname,/^\/cohamy_qa_online_[a-z0-9_]+$/);
  process.env.CRM_EMAIL_ENABLED='false';process.env.CRM_WEBSITE_ORDER_INTAKE='true';
  const db=await database(),admin=(await login('admin@crm-qa.invalid',qaPassword)).user;
  const cases:{name:string;status:'PASS'|'FAIL';error?:string}[]=[],createdOrderIds:string[]=[];
  let complete=false;
  const test=async(name:string,run:()=>Promise<void>)=>{try{await run();cases.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){cases.push({name,status:'FAIL',error:error instanceof Error?error.message:'UNKNOWN'});throw error;}};
  const snapshot=async(id:string)=>(await db.query<{row:unknown}>('SELECT to_jsonb(o) AS row FROM cohamy_crm.website_orders o WHERE id=$1',[id])).rows[0].row;
  try{
    await test('Existing main-suite history pages contain every immutable action once',async()=>{
      const row=(await db.query<{id:string;n:string}>('SELECT website_order_id AS id,count(*)::text AS n FROM cohamy_crm.website_order_dispatch_actions GROUP BY website_order_id ORDER BY count(*) DESC,website_order_id LIMIT 1')).rows[0];
      assert.ok(row&&Number(row.n)>20,'Existing main fixture must have more than twenty actions; never reset it');
      const first=await getOnlineOrder(admin,row.id,{historyPage:'1'}),ids:string[]=[];
      assert.equal(first.history.items.length,20);
      for(let page=1;page<=Math.ceil(first.history.total/first.history.pageSize);page++){
        const detail=page===1?first:await getOnlineOrder(admin,row.id,{historyPage:String(page)});
        assert.equal(detail.history.total,first.history.total);ids.push(...detail.history.items.map(item=>item.id));
      }
      assert.equal(ids.length,first.history.total);assert.equal(new Set(ids).size,first.history.total);
    });
    const warehouses=(await listOnlineOrders(admin,{})).warehouses;
    assert.ok(warehouses.length>=2,'Existing isolated fixture must have two active Cohamy warehouses');
    const quote=await getPublicStorefront(),item=quote.items.find(product=>product.available&&product.salePrice!==null);assert.ok(item);
    await test('Two fresh isolated checkouts keep current quoted receipts and one notification each',async()=>{
      for(let index=0;index<2;index++){
        const key=randomUUID();
        const receipt=await createWebsiteOrder({idempotencyKey:key,locale:'vi',payment:'cod',quoteVersion:quote.quoteVersion,acceptedPolicyVersion:'2026-11-05',contact:{fullName:'LOCAL QA PG collision '+index,email:'pg-collision@crm-qa.invalid',phone:'0991234567',address:'LOCAL QA only; never ship',city:'QA city',district:'',ward:'',note:'Targeted isolated PostgreSQL key-race extension'},items:[{productId:item.productId,quantity:1}]});
        const row=(await db.query<{id:string;subtotal:string}>('SELECT id,subtotal::text FROM cohamy_crm.website_orders WHERE idempotency_key=$1',[key])).rows[0];
        assert.equal(receipt.subtotal,String(item.salePrice));assert.equal(row.subtotal,receipt.subtotal);createdOrderIds.push(row.id);
        const jobs=(await db.query<{recipients:{to:string[];cc:string[];bcc:string[]}}>("SELECT recipients FROM cohamy_crm.document_mail_outbox WHERE event='website.order.received' AND entity_id=$1",[row.id])).rows;
        assert.equal(jobs.length,1);assert.deepEqual(jobs[0].recipients,{to:['kangminamhd@gmail.com','nguyenptkthd@gmail.com'],cc:[],bcc:[]});
      }
    });
    const before=await Promise.all(createdOrderIds.map(snapshot)),key=randomUUID();
    const commands=createdOrderIds.map((id,index)=>({id,input:{version:1,warehouseId:warehouses[index].id,reason:'LOCAL QA shared UUID across distinct orders',idempotencyKey:key}}));
    let winner=-1;
    let winnerResult:Awaited<ReturnType<typeof assignOnlineOrder>>|undefined;
    await test('Concurrent cross-order use of one idempotency UUID produces one success and one 409',async()=>{
      const outcomes=await Promise.allSettled(commands.map(command=>assignOnlineOrder(admin,command.id,command.input)));
      assert.equal(outcomes.filter(result=>result.status==='fulfilled').length,1);assert.equal(outcomes.filter(result=>result.status==='rejected').length,1);
      winner=outcomes.findIndex(result=>result.status==='fulfilled');const successful=outcomes[winner],failed=outcomes[1-winner];
      assert.equal(successful.status,'fulfilled');if(successful.status==='fulfilled')winnerResult=successful.value;
      assert.equal(failed.status,'rejected');if(failed.status==='rejected'){assert.ok(failed.reason instanceof CrmError);assert.equal(failed.reason.status,409);}
      assert.equal((await db.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.website_order_dispatch_actions WHERE id=$1',[key])).rows[0].n,'1');
    });
    await test('Losing order and history stay unchanged; exact winner replay creates no mutation',async()=>{
      assert.ok(winner===0||winner===1);const loser=1-winner;
      assert.deepEqual(await snapshot(createdOrderIds[loser]),before[loser]);
      assert.equal((await getOnlineOrder(admin,createdOrderIds[loser],{})).history.total,0);
      const winnerBefore=await snapshot(createdOrderIds[winner]);
      assert.deepEqual(await assignOnlineOrder(admin,commands[winner].id,commands[winner].input),winnerResult);
      assert.deepEqual(await snapshot(createdOrderIds[winner]),winnerBefore);
      assert.equal((await getOnlineOrder(admin,createdOrderIds[winner],{})).history.total,1);
    });
    complete=true;
  }finally{
    await fs.mkdir('docs/crm/test-results/online-orders',{recursive:true});
    const hash=async(path:string)=>createHash('sha256').update(await fs.readFile(path)).digest('hex');
    await fs.writeFile('docs/crm/test-results/online-orders/pg-race-extension.json',JSON.stringify({status:complete?'PASS':'FAIL',environment:'STAGING existing isolated PostgreSQL fixture; restricted runtime role; no reset or new fixture',testedAt:new Date().toISOString(),cases,sourceScriptSha256:await hash(fileURLToPath(import.meta.url)),existingMainScriptSha256:await hash('scripts/crm/verify-online-orders.ts'),createdQaOrderIds:createdOrderIds,externalEmails:0,productionWrites:0,workerInvoked:false},null,2)+'\n');
    await db.close();
  }
}
main().catch(error=>{console.error(error instanceof Error?error.message:'ONLINE_PG_EXTENSION_FAILED');process.exitCode=1;});
