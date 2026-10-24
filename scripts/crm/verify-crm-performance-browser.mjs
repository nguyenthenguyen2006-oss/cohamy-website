import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';

// Start run-document-local.mjs after test-document-flow.ts. Never targets production.
const base='http://127.0.0.1:4341',run=JSON.parse(await fs.readFile('.local/crm-document-flow-run.json','utf8'));
assert.match(run.dataDir,/^\.local\/crm-qa-documentflow-[a-f0-9-]+$/);
const browser=await chromium.launch({channel:'msedge',headless:true}),contexts=[],cases=[];
const context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(context);
const page=await context.newPage();page.setDefaultTimeout(30000);
const check=async(name,fn)=>{await fn();cases.push({name,status:'PASS'});console.log('PASS '+name);};
const signIn=async(ctx,email)=>{const r=await ctx.request.post(base+'/api/crm/auth/login',{headers:{origin:base},data:{email,password:'Local-QA-Only-2026!'}});assert.equal(r.status(),200);};
try{
  await signIn(context,run.emails.admin);
  await check('Changing sidebar routes selects the requested workspace tab instead of retaining the previous tab',async()=>{
    await page.goto(base+'/crm/accounting-factory');
    await expect(page.getByRole('button',{name:'Nhà máy → Kho',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.locator('.crm-nav a[href="/crm/accounting-orders"]').click();await page.waitForURL(base+'/crm/accounting-orders');
    await expect(page.getByRole('button',{name:'Xuất / giao hàng',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.locator('.crm-nav a[href="/crm/factory-requests"]').click();await page.waitForURL(base+'/crm/factory-requests');
    await expect(page.getByRole('button',{name:'Phiếu đề nghị',exact:true})).toHaveAttribute('aria-pressed','true');
  });
  const response=await context.request.get(base+'/api/crm/document-flow/workspace'),data=await response.json();assert.equal(response.status(),200);
  await check('Workspace sends only required delivery fields while retaining source lines and authoritative prices on the server',async()=>{
    for(const order of data.orders){assert.deepEqual(Object.keys(order.snapshot),['delivery']);assert.ok(Array.isArray(order.immutable_lines));}
  });
  await check('Saving a bulk product draft makes one write and exactly one workspace refresh, then opens its preview',async()=>{
    await page.getByRole('button',{name:'Lập phiếu đề nghị',exact:true}).click();
    await page.getByLabel('Nhà máy',{exact:true}).selectOption(data.factories[0].id);await page.getByLabel('Kho nhận dự kiến',{exact:true}).selectOption(data.warehouses.find(w=>w.code.includes('HN')).id);
    await page.getByLabel('Số lượng '+data.products[0].name,{exact:true}).fill('2');
    const calls=[];const listener=r=>{if(r.url()===base+'/api/crm/document-flow/workspace'||r.url()===base+'/api/crm/document-flow/save')calls.push({url:r.url(),method:r.method()});};page.on('request',listener);
    await page.getByRole('button',{name:'Lưu nháp & Xem trước',exact:true}).click();await expect(page.getByRole('dialog',{name:'Xem chứng từ'})).toBeVisible();await page.waitForTimeout(300);page.off('request',listener);
    assert.equal(calls.filter(r=>r.method==='POST').length,1);assert.equal(calls.filter(r=>r.method==='GET').length,1);
    await page.getByRole('button',{name:'Đóng',exact:true}).click();
  });
  await check('Separate warehouse sessions retain their own stock/document scope after request-scoped identity deduplication',async()=>{
    const ids=[];
    for(const email of [run.emails.hn,run.emails.hcm]){const ctx=await browser.newContext();contexts.push(ctx);await signIn(ctx,email);const r=await ctx.request.get(base+'/api/crm/document-flow/workspace');assert.equal(r.status(),200);const value=await r.json();const p=await ctx.newPage();await p.goto(base+'/crm/warehouse-stock');await expect(p.getByRole('button',{name:'Tồn kho',exact:true})).toHaveAttribute('aria-pressed','true');ids.push(new Set(value.warehouses.map(w=>w.id)));}
    assert.ok(ids[0].size&&ids[1].size);assert.equal([...ids[0]].some(id=>ids[1].has(id)),false);
  });
  await check('Private APIs still require authentication and retired CRM routes retain real HTTP 404 responses',async()=>{
    const anonymous=await browser.newContext();contexts.push(anonymous);assert.equal((await anonymous.request.get(base+'/api/crm/document-flow/workspace')).status(),401);
    for(const slug of ['library','support','articles','automation','consignment','procurement','invitations','network'])assert.equal((await context.request.get(base+'/crm/'+slug)).status(),404);
  });
}finally{
  await browser.close();await fs.mkdir('docs/crm/test-results/performance',{recursive:true});await fs.writeFile('docs/crm/test-results/performance/browser-local.json',JSON.stringify({environment:'LOCAL Microsoft Edge and isolated PGlite; no real provider sends',status:cases.length===5?'PASS':'FAIL',testedAt:new Date().toISOString(),cases},null,2)+'\n');
}
