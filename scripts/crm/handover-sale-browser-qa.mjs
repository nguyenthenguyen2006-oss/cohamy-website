import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,expect as baseExpect} from '@playwright/test';

// This harness only creates fictitious drafts on the local staging instance.
// Stock/receivable confirmation and MCP verification are separate service tests.
const expect=baseExpect.configure({timeout:45000});
const base=new URL(process.env.CRM_BROWSER_BASE_URL??'http://127.0.0.1:4373');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(base.hostname),'Browser QA is restricted to a loopback staging server.');
const origin=new URL(process.env.CRM_BROWSER_ORIGIN??base.origin).origin;
const fixturePath=process.env.CRM_HANDOVER_BROWSER_FIXTURE??'.local/handover-sale-release/browser-fixture.json';
const fixture=JSON.parse(await fs.readFile(fixturePath,'utf8'));
const password=process.env.CRM_QA_PASSWORD??fixture.qaPassword;
assert.ok(password,'Set CRM_QA_PASSWORD to the local QA credential.');
const email=process.env.CRM_QA_EMAIL??fixture.adminEmail??'admin@crm-qa.invalid';
assert.match(email,/@[^@]*\.invalid$/u,'A fictitious QA account is required.');
const folder=process.env.CRM_HANDOVER_BROWSER_OUTPUT??'docs/crm/test-results/handover-sale/browser';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
const page=await context.newPage();page.setDefaultTimeout(45000);
const cases=[],errors=[],externalRequests=[],savedDrafts=[],assetFailures=[];
let complete=false,activeCase='',saveRequests=0,cookie='';
const clean=value=>String(value).replaceAll(password,'[QA CREDENTIAL]');
page.on('pageerror',error=>errors.push(clean(error.message)));
page.on('response',response=>{const url=new URL(response.url());if(response.status()>=400&&url.pathname.startsWith('/_next/'))assetFailures.push({path:url.pathname,status:response.status()});});
page.on('request',request=>{if(new URL(request.url()).pathname==='/api/crm/document-flow/save'&&request.method()==='POST')saveRequests++;});

await context.route('**/*',async route=>{
 try{
  const url=new URL(route.request().url());
  if(url.origin===origin&&origin!==base.origin){
   const response=await route.fetch({url:base.origin+url.pathname+url.search,maxRedirects:0});
   return route.fulfill({response});
  }
  if(url.origin===origin||url.origin===base.origin||['data:','blob:'].includes(url.protocol))return route.continue();
  externalRequests.push({host:url.hostname,path:url.pathname});return route.abort();
 }catch(error){
  errors.push('Staging route failed: '+clean(error.message));await route.abort().catch(()=>{});
 }
});

async function api(path){const response=await context.request.get(base.origin+path,{headers:{origin,cookie}});assert.ok(response.ok(),path+' '+response.status());return response.json();}
async function test(name,fn){activeCase=name;await fn();cases.push({name,status:'PASS'});console.log('PASS '+name);activeCase='';}
const amount=value=>BigInt(value).toLocaleString('vi-VN')+' đ';
async function total(key,value){await expect(page.locator('[data-flow-sale-totals] [data-flow-total="'+key+'"]')).toHaveText(amount(value));}
async function capture(name){
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:folder+'/'+name+'.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' causes page overflow');
}
async function captureNames(name){
 const scroll=page.locator('.crm-flow-priced-lines .crm-product-entry-scroll');
 await scroll.evaluate(element=>{
  if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
  element.scrollLeft=0;
  const modal=element.closest('.crm-document-modal')?.querySelector('.work-section');
  if(modal)modal.scrollTop+=element.getBoundingClientRect().top-modal.getBoundingClientRect().top-20;
 });
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await capture(name);
}
async function save(){
 const pending=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/crm/document-flow/save'&&response.request().method()==='POST');
 await page.getByRole('button',{name:'Lưu nháp & Xem trước',exact:true}).click();
 const response=await pending;assert.ok(response.ok(),'Draft save '+response.status()+' '+await response.text());
 const result=await response.json();savedDrafts.push({id:result.id,code:result.code,version:result.version});
 await expect(page.getByRole('dialog',{name:'Xem chứng từ',exact:true})).toBeVisible();
 return result;
}
async function issuesTab(){
 const tab=page.getByRole('button',{name:'Xuất / giao hàng',exact:true});
 // A server-rendered tab is visible before React finishes hydrating over the tunnel.
 // This action is idempotent; wait for its visible pressed state before continuing.
 await expect(async()=>{if(await tab.getAttribute('aria-pressed')!=='true')await tab.click();await expect(tab).toHaveAttribute('aria-pressed','true',{timeout:2000});}).toPass({timeout:20000,intervals:[500,1000,2000]});
}
async function reopen(code){
 await page.reload();await issuesTab();
 const row=page.locator('.work-table tbody tr').filter({hasText:code});await expect(row).toHaveCount(1);
 await row.getByRole('button',{name:'Sửa nháp',exact:true}).click();
 await expect(page.getByLabel('Mục đích xuất kho',{exact:true})).toHaveValue('SALE');
}

try{
 await fs.mkdir(folder,{recursive:true});
 await page.goto(origin+'/crm/login');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Mật khẩu',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page).toHaveURL(origin+'/crm');
 cookie=(await context.cookies(origin)).map(entry=>entry.name+'='+entry.value).join('; ');assert.ok(cookie,'The browser login must create a session.');
 const workspace=await api('/api/crm/document-flow/workspace');
 const warehouseId=fixture.warehouseId??fixture.warehouse?.id;
 const customerId=fixture.customerId??fixture.customer?.id;
 const products=(fixture.products??fixture.productIds??[fixture.productAId,fixture.productBId,fixture.productCId]).map(product=>workspace.products.find(row=>row.id===(typeof product==='string'?product:product.id)));
 assert.ok(warehouseId&&workspace.warehouses.some(row=>row.id===warehouseId),'Missing fixture warehouse.');
 assert.ok(customerId&&workspace.customers.some(row=>row.id===customerId),'Missing fixture customer.');
 assert.equal(products.length,3);assert.ok(products.every(Boolean),'Missing fixture products.');
 assert.deepEqual(products.map(product=>product.retailPrice),['90000','50000','80000']);
 const quantity=index=>page.getByLabel('Số lượng '+products[index].name,{exact:true});
 const discount=index=>page.getByLabel('Chiết khấu (%) '+products[index].name,{exact:true});
 const output=(label,index)=>page.getByLabel(label+' '+products[index].name,{exact:true});
 const stockFor=rows=>Object.fromEntries(products.map(product=>[product.id,rows.stocks.filter(stock=>stock.warehouse_id===warehouseId&&stock.product_id===product.id).reduce((sum,stock)=>sum+Number(stock.on_hand),0)]));
 const stockBefore=stockFor(workspace);

 if(process.argv.includes('--recapture-names')){
  const prior=JSON.parse(await fs.readFile(folder+'/browser-staging.json','utf8'));
  assert.equal(prior.status,'PASS','Recapture requires an already passing business run.');
  await page.goto(origin+'/crm/factory-requests');await issuesTab();
  const row=page.locator('.work-table tbody tr').filter({hasText:prior.savedDrafts[0].code});await row.getByRole('button',{name:'Sửa nháp',exact:true}).click();
  await expect(discount(1)).toHaveValue('12.5');await page.setViewportSize({width:390,height:844});await captureNames('narrow-390-names');
  assert.equal(saveRequests,0);assert.deepEqual(errors,[]);assert.deepEqual(assetFailures,[]);
  console.log('PASS recaptured narrow-390-names; zero saves or confirmations');complete=true;
 }else{

 await test('Real sales form has independent percent inputs, read-only prices and immediate ABC totals',async()=>{
  await page.goto(origin+'/crm/factory-requests');await issuesTab();
  await page.getByRole('button',{name:'Lập phiếu xuất / giao hàng',exact:true}).click();
  await expect(page.getByLabel('Mục đích xuất kho',{exact:true})).toHaveValue('SALE');
  await page.getByLabel('Kho xuất',{exact:true}).selectOption(warehouseId);await page.getByLabel('Khách hàng bán hàng',{exact:true}).selectOption(customerId);
  const grid=page.getByRole('group',{name:'Sản phẩm trong phiếu',exact:true});
  const rowCount=await grid.locator('tbody tr').count();
  assert.equal(await grid.locator('input[aria-label^="Chiết khấu (%) "]').count(),rowCount);
  assert.equal(await page.locator('input[aria-label^="Chiết khấu (%) "]').count(),rowCount,'There must be no global discount field.');
  assert.equal(await grid.locator('input[type="number"]').count(),rowCount*2,'Only quantity and percentage are numeric row inputs.');
  assert.equal(await page.locator('input[aria-label^="Đơn giá"],input[aria-label*="Số tiền giảm"]').count(),0);
  for(let index=0;index<3;index++){
   assert.equal(await output('Đơn giá gốc',index).evaluate(element=>element.tagName),'OUTPUT');
   assert.equal(await output('Đơn giá sau CK',index).evaluate(element=>element.tagName),'OUTPUT');
   await expect(discount(index)).toHaveValue('0');await quantity(index).fill(['2','3','1'][index]);await discount(index).fill(['10','20','5'][index]);
  }
  await total('goods','410000');await total('discount','52000');await total('net','358000');await total('total','358000');
  for(const [index,unit,line] of [[0,'81000','162000'],[1,'40000','120000'],[2,'76000','76000']]){await expect(output('Đơn giá sau CK',index)).toHaveText(amount(unit));await expect(output('Thành tiền',index)).toHaveText(amount(line));}
  assert.equal(saveRequests,0,'Changing percentages must not save or mutate stock.');
 });

 await test('Each percentage and decimal edit recomputes locally; invalid values disable saving',async()=>{
  await discount(1).fill('50');await total('discount','97000');await total('total','313000');
  await expect(output('Thành tiền',0)).toHaveText(amount('162000'));await expect(output('Thành tiền',2)).toHaveText(amount('76000'));
  await discount(1).fill('12.5');await total('total','369250');await expect(output('Thành tiền',1)).toHaveText(amount('131250'));
  await discount(1).fill('100.1');await expect(page.locator('[data-flow-sale-totals] [role="alert"]')).toContainText('0 đến 100%');
  await expect(page.getByRole('button',{name:'Lưu nháp & Xem trước',exact:true})).toBeDisabled();assert.ok(!(await page.locator('[data-flow-sale-totals]').innerText()).includes('NaN'));
  await discount(1).fill('');await total('total','388000');await discount(1).fill('20');await total('total','358000');
  assert.equal(saveRequests,0);
 });

 await test('Optional VAT and shipping add to the line net totals without payment entry',async()=>{
  assert.ok(products.every(product=>Number(product.vatRate)===8),'Fixture products require VAT 8%.');
  await page.getByLabel('Tính VAT theo sản phẩm',{exact:true}).check();await page.getByLabel('Phí vận chuyển (đ)',{exact:true}).fill('20000');
  await total('vat','28640');await total('shipping','20000');await total('total','406640');await total('paid','0');
  assert.equal(await page.locator('input[aria-label*="Đã thanh toán"],input[aria-label*="Đã thu"]').count(),0);
  await page.getByLabel('Tính VAT theo sản phẩm',{exact:true}).uncheck();await page.getByLabel('Phí vận chuyển (đ)',{exact:true}).fill('0');await total('total','358000');
 });

 await test('Dense grid stays usable on desktop, 390px and 320px with scrolling confined to the table',async()=>{
  const scroll=page.locator('.crm-flow-priced-lines .crm-product-entry-scroll');
  await discount(0).scrollIntoViewIfNeeded();await capture('desktop-1440-prices');
  const height=await discount(0).evaluate(element=>element.getBoundingClientRect().height);assert.ok(height>=44,'Percentage touch target must be at least 44px.');
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});await captureNames('narrow-'+width+'-names');
   await discount(1).scrollIntoViewIfNeeded();await capture('narrow-'+width+'-prices');
   await page.locator('[data-flow-sale-totals]').scrollIntoViewIfNeeded();await capture('narrow-'+width+'-totals');
   assert.ok(await scroll.evaluate(element=>element.scrollWidth>element.clientWidth),'Narrow grid needs its own horizontal scrollbar.');
   await expect(discount(1)).toHaveValue('20');
  }
  await page.setViewportSize({width:1440,height:1000});
 });

 let draft;
 await test('Native save stores exactly three independent percentages and preview is a real PDF without stock mutation',async()=>{
  for(const [label,value] of [['Người giao','QA staging sender'],['Người nhận','QA staging recipient'],['SĐT nhận hàng','0900000000'],['Địa chỉ giao','QA fictitious address'],['Ngày giao','2026-11-06'],['Hình thức / đơn vị giao','QA staging carrier']])await page.getByLabel(label,{exact:true}).fill(value);
  draft=await save();const snapshot=await api('/api/crm/document-flow/view?id='+draft.id);
  assert.equal(snapshot.state,'DRAFT');assert.equal(snapshot.lines.length,3);assert.equal(snapshot.issuePurpose,'SALE');
  for(let index=0;index<3;index++)assert.equal(snapshot.lines.find(line=>line.productId===products[index].id).discountPercent,['10','20','5'][index]);
  assert.equal(snapshot.totals.total,'358000');assert.deepEqual(stockFor(await api('/api/crm/document-flow/workspace')),stockBefore);
  const frame=page.getByTitle('Bản xem trước chứng từ',{exact:true});await expect(frame).toHaveAttribute('src',new RegExp('id='+draft.id));
  const response=await context.request.get(base.origin+await frame.getAttribute('src'),{headers:{origin,cookie}});assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/application\/pdf/u);
  const bytes=await response.body();assert.equal(bytes.subarray(0,5).toString(),'%PDF-');await fs.writeFile(folder+'/browser-preview.pdf',bytes);await fs.writeFile(folder+'/browser-snapshot.json',JSON.stringify(snapshot,null,2)+'\n');
  await capture('saved-pdf-preview');
 });

 await test('Reload restores frozen original prices and independent percentages; decimal edit round trips',async()=>{
  await reopen(draft.code);
  for(let index=0;index<3;index++){await expect(discount(index)).toHaveValue(['10','20','5'][index]);await expect(output('Đơn giá gốc',index)).toHaveText(amount(['90000','50000','80000'][index]));}
  await total('total','358000');
  await page.getByLabel('Tính VAT theo sản phẩm',{exact:true}).check();await total('vat','28640');await total('total','386640');
  await page.getByLabel('Tính VAT theo sản phẩm',{exact:true}).uncheck();await total('total','358000');
  await discount(1).fill('12.5');await total('total','369250');
  const changed=await save(),snapshot=await api('/api/crm/document-flow/view?id='+changed.id);assert.equal(changed.id,draft.id);assert.equal(snapshot.lines.find(line=>line.productId===products[1].id).discountPercent,'12.5');assert.equal(snapshot.totals.total,'369250');
  await reopen(draft.code);await expect(discount(1)).toHaveValue('12.5');await total('total','369250');
  assert.deepEqual(stockFor(await api('/api/crm/document-flow/workspace')),stockBefore);await capture('reloaded-decimal-draft');
  await page.getByRole('button',{name:'Hủy',exact:true}).click();
 });
 assert.deepEqual(errors,[],'Unexpected browser runtime errors.');assert.deepEqual(assetFailures,[],'All staging JS/CSS chunks must load.');complete=true;
 }
}catch(error){
 cases.push({name:activeCase||'Setup',status:'FAIL',message:clean(error.stack??error)});console.error(clean(error.stack??error));process.exitCode=1;
 await fs.mkdir(folder,{recursive:true});await page.screenshot({path:folder+'/failure.png',fullPage:true}).catch(()=>{});
}finally{
 await browser.close();await fs.mkdir(folder,{recursive:true});
 if(!process.argv.includes('--recapture-names'))await fs.writeFile(folder+'/browser-staging.json',JSON.stringify({status:complete?'PASS':'FAIL',environment:'Loopback staging; fictitious .invalid account and QA products; actual Edge browser',base:base.origin,cases,errors,assetFailures,externalRequests,savedDrafts,saveRequests,confirmedDocuments:0,externalEmails:0},null,2)+'\n');
}
