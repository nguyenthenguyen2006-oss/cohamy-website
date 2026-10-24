import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {chromium,expect} from '@playwright/test';

const fixture=JSON.parse(await fs.readFile('.local/historical-invoices-qa.json','utf8'));
assert.match(fixture.dataDir,/^\.local\/crm-qa-historical-[a-f0-9-]+$/);
const base='http://localhost:4337',cases=[],errors=[],screens=[];
const log=await fs.open('.local/historical-invoices-browser-server.log','w');
const server=spawn(process.execPath,[path.resolve('node_modules/next/dist/bin/next'),'dev','--hostname','localhost','--port','4337'],{windowsHide:true,stdio:['ignore',log.fd,log.fd],env:{...process.env,CRM_QA_BUILD:'true',CRM_QA_BUILD_VARIANT:'upgrade',CRM_DATABASE_MODE:'pglite',CRM_ENVIRONMENT:'LOCAL',CRM_LOCAL_DATA_DIR:fixture.dataDir,CRM_PUBLIC_ORIGIN:base,BLOG_SOURCE:'legacy',CRM_EMAIL_ENABLED:'false'}});
let browser;
async function check(name,run){await run();cases.push({name,status:'PASS'});console.log('PASS '+name);}
try {
  let ready=false;
  for(let i=0;i<90;i++){assert.equal(server.exitCode,null);try{ready=(await fetch(base+'/crm/login',{signal:AbortSignal.timeout(2000)})).ok;}catch{}if(ready)break;await new Promise(resolve=>setTimeout(resolve,500));}
  assert.ok(ready,'QA_SERVER_NOT_READY');
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(15000);
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  const signIn=async email=>{const response=await context.request.post(base+'/api/crm/auth/login',{headers:{origin:base},data:{email,password:'Local-QA-Only-2026!'}});assert.equal(response.status(),200,email);};
  const source=base+'/api/crm/historical-orders/'+fixture.ids[0];
  await check('Anonymous archive and source-image requests require authentication',async()=>{
    assert.equal((await context.request.get(base+'/api/crm/historical-orders')).status(),401);assert.equal((await context.request.get(source)).status(),401);
  });
  await signIn('admin@crm-qa.invalid');
  await check('Administrator sees structured historical invoices and mobile layout contains table scrolling',async()=>{
    await fs.mkdir('docs/crm/test-results/screenshots',{recursive:true});
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:1000});assert.equal((await page.goto(base+'/crm/historical-orders')).status(),200);
      await expect(page.getByRole('heading',{name:'Đơn hàng cũ',exact:true})).toBeVisible();
      await expect(page.getByText('Đã thanh toán đủ',{exact:true})).toHaveCount(4);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      const file='docs/crm/test-results/screenshots/historical-orders-'+width+'.png';await page.screenshot({path:file,fullPage:true});screens.push(file);
    }
  });
  await check('Detail displays source lines, original rounded VAT and a real private image; downloads preserve bytes',async()=>{
    assert.equal((await page.goto(base+'/crm/historical-orders/'+fixture.ids[0])).status(),200);
    await expect(page.getByRole('cell',{name:'LOCAL QA product',exact:true})).toBeVisible();
    const image=page.getByRole('img',{name:'Ảnh hóa đơn 1C26QA số 1',exact:true});
    await expect(image).toBeVisible();await expect.poll(()=>image.evaluate(img=>img.naturalWidth)).toBe(40);
    const response=await context.request.get(source);assert.equal(response.status(),200);assert.match(response.headers()['cache-control'],/no-store/);assert.match(response.headers()['content-disposition'],/^attachment/);
    assert.equal(createHash('sha256').update(await response.body()).digest('hex'),fixture.checksum);
    const inline=await context.request.get(source+'?inline=1');assert.match(inline.headers()['content-type'],/image\/png/);assert.match(inline.headers()['content-disposition'],/^inline/);
  });
  await check('Accountant, HCM warehouse and explicitly assigned generic warehouse can read; HN cannot read South records',async()=>{
    for(const role of ['ACCOUNTANT','WAREHOUSE_HCM','WAREHOUSE']){
      await signIn(role.toLowerCase()+'@crm-qa.invalid');assert.equal((await context.request.get(source)).status(),200);
      await page.goto(base+'/crm/historical-orders');await expect(page.getByText('Đã thanh toán đủ',{exact:true})).toHaveCount(4);
    }
    await signIn('warehouse_hn@crm-qa.invalid');const list=await context.request.get(base+'/api/crm/historical-orders');assert.equal(list.status(),200);assert.equal((await list.json()).total,0);
    assert.equal((await context.request.get(source)).status(),404);assert.equal((await page.goto(base+'/crm/historical-orders/'+fixture.ids[0])).status(),404);
  });
  await check('Sales, factory and dealer roles cannot access archive APIs or a direct source URL',async()=>{
    for(const email of ['sales@crm-qa.invalid','factory@crm-qa.invalid','a@crm-qa.invalid','dealer_staff@crm-qa.invalid']){
      await signIn(email);assert.equal((await context.request.get(base+'/api/crm/historical-orders')).status(),403,email);assert.equal((await context.request.get(source)).status(),403,email);
      if(!['a@crm-qa.invalid','dealer_staff@crm-qa.invalid'].includes(email))assert.equal((await page.goto(base+'/crm/historical-orders')).status(),404);
    }
  });
  await check('Archive has no public mutation endpoint; retired modules remain removed',async()=>{
    await signIn('admin@crm-qa.invalid');
    for(const method of ['post','put','delete'])assert.equal((await context.request[method](base+'/api/crm/historical-orders',{headers:{origin:base},data:{}})).status(),405);
    for(const slug of ['library','support','articles','automation','consignment','procurement','invitations','network'])assert.equal((await context.request.get(base+'/crm/'+slug)).status(),404);
  });
  assert.deepEqual(errors,[]);
} finally {
  await browser?.close();
  if(process.platform==='win32')spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else server.kill('SIGTERM');
  await log.close();
  await fs.writeFile('docs/crm/test-results/historical-invoices-browser-local.json',JSON.stringify({environment:'LOCAL isolated PGlite and Microsoft Edge, synthetic records',testedAt:new Date().toISOString(),status:cases.length===6&&errors.length===0?'PASS':'FAIL',cases,errors,screens},null,2)+'\n');
}
