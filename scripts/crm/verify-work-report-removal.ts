import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium,expect} from '@playwright/test';
import {createQaFixture,qaPassword} from './qa-fixture';
import {database} from '../../lib/crm/db';
import {login} from '../../lib/crm/auth';
import {createAccount} from '../../lib/crm/repository';
import {visibleModules,getVisibleHubs} from '../../lib/crm/modules';
import {roles} from '../../lib/crm/types';
import {assertModuleAvailable} from '../../lib/crm/module-availability';
import {createTask,listTasks} from '../../lib/crm/work';
import {runNextJob} from '../../lib/crm/data-jobs';
import {runDueReportSubscriptions} from '../../lib/crm/reports';

const removed=['notifications','tasks','data','search','period-sales','kpi','reports'];
const reads=['work/tasks','care/checklist','care/dependencies','jobs/list','jobs/detail','jobs/download',
  'workspace/search?q=qa','workspace/notifications','channel/report','channel/incentives',
  'channel/incentive-progress','reports/overview','reports/subscriptions'];
const writes=['work/task','work/task-update','care/checklist','care/dependency','jobs/export','jobs/confirm',
  'jobs/preview','workspace/notification-read','channel/incentive','channel/incentive-award','reports/subscription-save'];
const cases:{name:string;status:'PASS'}[]=[];
const base=process.env.COHAMY_REMOVAL_BASE??'http://localhost:4339';
const production=process.env.COHAMY_REMOVAL_PRODUCTION==='true';
async function check(name:string,fn:()=>Promise<void>|void){await fn();cases.push({name,status:'PASS'});console.log('PASS '+name);}

async function main(){
  let ids:Awaited<ReturnType<typeof createQaFixture>>|undefined;
  if(!production){
    await fs.mkdir('.local',{recursive:true});
    process.env.CRM_DATABASE_MODE='pglite';process.env.CRM_ENVIRONMENT='LOCAL';
    process.env.CRM_LOCAL_DATA_DIR='.local/crm-qa-work-report-removal-'+randomUUID();
    ids=await createQaFixture();const db=await database();
    try{
      const {user}=await login('admin@crm-qa.invalid',qaPassword);
      for(const role of ['MANAGER','FACTORY','WAREHOUSE_HCM','WAREHOUSE_HN'] as const)
        await createAccount(user,{email:role.toLowerCase()+'@crm-qa.invalid',displayName:'LOCAL QA '+role,password:qaPassword,role,organizationId:user.organizationId});
      await check('All internal roles lose the seven modules and both empty navigation groups',()=>{
        for(const role of roles.filter(r=>!r.startsWith('DEALER_'))){
          const principal={...user,role};
          assert.ok(!visibleModules(principal).some(m=>removed.includes(m.id)),role);
          assert.ok(!getVisibleHubs(principal).some(h=>['tasks','reports'].includes(h.hub.id)),role);
          for(const id of removed)assert.throws(()=>assertModuleAvailable(principal,id),e=>(e as {status:number}).status===404);
        }
      });
      await check('Retired workers do not process historical jobs or send scheduled reports',async()=>{
        assert.equal(await runNextJob(),false);assert.deepEqual(await runDueReportSubscriptions(),{processed:0});
        await assert.rejects(listTasks(user),e=>(e as {status:number}).status===404);
        await assert.rejects(createTask(user,{}),e=>(e as {status:number}).status===404);
      });
      await check('Dealer Portal keeps its search, notifications and period-sales modules',async()=>{
        const dealer=(await login('a@crm-qa.invalid',qaPassword)).user;
        for(const id of ['search','notifications','period-sales'])assert.ok(visibleModules(dealer).some(m=>m.id===id),id);
      });
    }finally{await db.close();}
  }

  let server:ReturnType<typeof spawn>|undefined,log:Awaited<ReturnType<typeof fs.open>>|undefined;
  let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
  let authContext:Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newContext']>>|undefined;
  const pageErrors:string[]=[];
  try{
    if(!production){
      await fs.mkdir('.local',{recursive:true});log=await fs.open('.local/work-report-removal-server.log','w');
      server=spawn(process.execPath,[path.resolve('node_modules/next/dist/bin/next'),'dev','--hostname','localhost','--port',new URL(base).port],{
        windowsHide:true,stdio:['ignore',log.fd,log.fd],env:{...process.env,CRM_QA_BUILD:'true',CRM_QA_BUILD_VARIANT:'upgrade',CRM_PUBLIC_ORIGIN:base,BLOG_SOURCE:'legacy'},
      });
      let ready=false;
      for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error('QA_SERVER_EXITED');try{ready=(await fetch(base+'/crm/login')).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,500));}
      assert.ok(ready,'QA_SERVER_NOT_READY');
    }
    browser=await chromium.launch({channel:'msedge',headless:true,...(production&&process.env.COHAMY_REMOVAL_PROXY?{proxy:{server:process.env.COHAMY_REMOVAL_PROXY}}:{})});
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    authContext=context;
    const credentials=production?JSON.parse(await fs.readFile(process.env.COHAMY_VERIFY_CREDENTIAL_PATH!,'utf8')):{email:'admin@crm-qa.invalid',password:qaPassword};
    const signIn=async(target:typeof context,email:string,password=qaPassword)=>{
      assert.equal((await target.request.post(base+'/api/crm/auth/login',{headers:{origin:base},data:{email,password}})).status(),200);
    };
    await signIn(context,credentials.email,credentials.password);
    const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));
    await check('Desktop and mobile omit removed navigation, header links and dashboard task panels',async()=>{
      for(const width of [1440,390]){
        await page.setViewportSize({width,height:1000});assert.equal((await page.goto(base+'/crm'))?.status(),200);
        await expect(page.locator('h1')).toBeVisible();
        for(const id of removed)assert.equal(await page.locator(`a[href^="/crm/${id}"]`).count(),0,id);
        for(const id of ['tasks','reports'])assert.equal(await page.locator(`a[href="/crm/hub/${id}"]`).count(),0,id);
        assert.equal(await page.getByText('Việc Quá Hạn & Đến Hạn Hôm Nay',{exact:true}).count(),0);
        await fs.mkdir('docs/crm/test-results/screenshots',{recursive:true});
        await page.screenshot({path:`docs/crm/test-results/screenshots/work-report-removal-${production?'production':'local'}-${width}.png`,fullPage:true});
      }
    });
    await check('Direct, create, detail and hub URLs return 404 to the administrator',async()=>{
      for(const id of removed)for(const suffix of ['','/new','/'+randomUUID()])assert.equal((await context.request.get(base+'/crm/'+id+suffix)).status(),404,id+suffix);
      for(const id of ['tasks','reports'])assert.equal((await context.request.get(base+'/crm/hub/'+id)).status(),404,id);
    });
    await check('Removed read, write, task dependency and download APIs all return 404',async()=>{
      for(const route of reads)assert.equal((await context.request.get(base+'/api/crm/'+route)).status(),404,route);
      for(const route of writes)assert.equal((await context.request.post(base+'/api/crm/'+route,{headers:{origin:base},data:{}})).status(),404,route);
    });
    await check('Orders, stock, finance, documents, audit and profile remain accessible',async()=>{
      for(const route of ['requests','inventory','debts','cash','pricing','historical-orders','internal-documents','document-notifications','audit','profile','workspace'])
        assert.equal((await context.request.get(base+'/crm/'+route)).status(),200,route);
    });
    if(!production){
      await check('Partner details and quick-create no longer offer tasks or general export',async()=>{
        // The dealer fixture is a stable existing partner in every QA database.
        await page.goto(base+'/crm/dealers/'+ids!.dealerA);
        assert.equal(await page.getByRole('heading',{name:'Việc tiếp theo',exact:true}).count(),0);
        await page.getByRole('button',{name:'Tạo nhanh',exact:true}).click();
        assert.equal(await page.locator('option[value="task"]').count(),0);
        await page.goto(base+'/crm/dealers');assert.equal(await page.getByText('Xuất danh sách đang lọc',{exact:true}).count(),0);
      });
      await check('Warehouse, accountant and factory routes cannot restore removed features',async()=>{
        for(const email of ['warehouse@crm-qa.invalid','warehouse_hcm@crm-qa.invalid','warehouse_hn@crm-qa.invalid','accountant@crm-qa.invalid','factory@crm-qa.invalid']){
          const roleContext=await browser!.newContext();await signIn(roleContext,email);
          assert.equal((await roleContext.request.get(base+'/crm')).status(),200,email);
          for(const id of removed)assert.equal((await roleContext.request.get(base+'/crm/'+id)).status(),404,email+':'+id);
          await roleContext.close();
        }
      });
      await check('Dealer Portal pages and shared APIs remain available',async()=>{
        const dealer=await browser!.newContext();await signIn(dealer,'a@crm-qa.invalid');
        for(const route of ['search','notifications','period-sales'])assert.equal((await dealer.request.get(base+'/portal/'+route)).status(),200,route);
        for(const route of ['workspace/search?q=qa','workspace/notifications','channel/report'])assert.equal((await dealer.request.get(base+'/api/crm/'+route)).status(),200,route);
        await dealer.close();
      });
    }
    assert.deepEqual(pageErrors,[]);
  }finally{
    if(authContext)await authContext.request.post(base+'/api/crm/auth/logout',{headers:{origin:base},data:{}}).catch(()=>{});
    await browser?.close();
    if(server?.pid){if(process.platform==='win32')spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else server.kill('SIGTERM');}
    await log?.close();
    await fs.mkdir('docs/crm/test-results',{recursive:true});
    await fs.writeFile(`docs/crm/test-results/work-report-removal-${production?'production':'local'}.json`,JSON.stringify({environment:production?'PRODUCTION':'LOCAL',testedAt:new Date().toISOString(),status:cases.length===(production?4:10)&&pageErrors.length===0?'PASS':'FAIL',cases,pageErrors},null,2)+'\n');
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
