import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:30000}),base='http://127.0.0.1:4343',folder='.local/dashboard-workbench';
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),cases=[],errors=[],writes=[];
page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&!r.url().includes('/auth/'))writes.push(r.url());});
await fs.mkdir(folder,{recursive:true});const captureOnly=process.argv.includes('--capture-only');
const pane=()=>page.locator('.crm-dash-panel:not([hidden])'),tabs=()=>page.getByRole('tablist',{name:'Các sổ bảng tính điều hành'});
const choose=async name=>{await tabs().getByRole('tab',{name:new RegExp(name)}).click();};
const get=async path=>{const r=await context.request.get(base+path);assert.ok(r.ok(),path+' '+r.status());return r.json();};
const money=v=>Number(v).toLocaleString('vi-VN')+' ₫';
const total=(label)=>pane().locator('.crm-workbench-primary>div').filter({has:page.getByText(label,{exact:true})}).locator('dd');
const capture=async name=>{await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));await page.screenshot({path:folder+'/'+name+'.png',fullPage:false,caret:'initial'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' page overflow');
 const clipped=await pane().locator('.crm-sheet-server-filters select,.crm-sheet-server-filters input,.crm-sheet-toolbar button,.crm-sheet-toolbar input').evaluateAll(nodes=>nodes.filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1);}).map(e=>e.getAttribute('aria-label')||e.textContent));assert.deepEqual(clipped,[],name+' clipped controls');};
const test=async(name,fn)=>{await fn();cases.push({name,status:'PASS'});console.log('PASS '+name);};
try{
 await page.goto(base+'/crm/login');await page.getByLabel('Email',{exact:true}).fill('admin@crm-qa.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('Local-QA-Only-2026!');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page).toHaveURL(base+'/crm');
 const sales=await get('/api/crm/spreadsheet/reconciliation'),stock=await get('/api/crm/spreadsheet/inventory-matrix');
 if(!captureOnly){
 await test('Readable dashboard totals match the server and important order columns open by default',async()=>{
  await expect(tabs().getByRole('tab')).toHaveCount(3);await choose('Bán hàng');await expect(total('Thành tiền sau CK')).toHaveText(money(sales.totals.netTotal));await expect(total('Còn nợ phải thu')).toHaveText(money(sales.totals.remainingDebt));
  await expect(pane().getByRole('button',{name:'Hiển thị (7/16)',exact:true})).toBeVisible();await expect(pane().getByRole('button',{name:'Nhóm hàng theo cột'})).toHaveCount(0);
  await capture('sales-desktop');
 });
 await test('Switching workbooks retains quick search and date-filter controls; keyboard navigation follows tabs',async()=>{
  await pane().getByLabel('Tìm nhanh trên bảng tính').fill('QA');await pane().getByRole('button',{name:/Lọc thêm/}).click();await expect(pane().getByLabel('Từ ngày:')).toBeVisible();
  await choose('Nhập');await expect(pane().getByRole('button',{name:/Hiển thị \(8\//})).toBeVisible();await choose('Bán hàng');await expect(pane().getByLabel('Tìm nhanh trên bảng tính')).toHaveValue('QA');await expect(pane().getByLabel('Từ ngày:')).toBeVisible();
  await tabs().getByRole('tab',{name:/Bán hàng/}).press('ArrowRight');await expect(tabs().getByRole('tab',{name:/Nhập/})).toBeFocused();await expect(tabs().getByRole('tab',{name:/Nhập/})).toHaveAttribute('aria-selected','true');await choose('Bán hàng');await pane().getByLabel('Tìm nhanh trên bảng tính').fill('');
 });
 await test('All columns remain available, display preferences survive refresh, and summaries/detail views keep distinct columns',async()=>{
  await pane().getByRole('button',{name:/^Hiển thị/}).click();await pane().getByRole('button',{name:'Tất cả cột',exact:true}).click();await expect(pane().getByRole('button',{name:'Hiển thị (16/16)',exact:true})).toBeVisible();
  await page.reload();await choose('Bán hàng');await expect(pane().getByRole('button',{name:'Hiển thị (16/16)',exact:true})).toBeVisible();
  await pane().getByRole('button',{name:/^Hiển thị/}).click();await pane().getByRole('button',{name:'Cột chính',exact:true}).click();await pane().getByRole('button',{name:/^Hiển thị/}).click();
  await pane().getByRole('tab',{name:/Từng mặt hàng/}).click();await expect(pane().getByRole('columnheader',{name:/Tên sản phẩm/})).toBeVisible();await expect(pane().getByRole('button',{name:/^Hiển thị \(7\//})).toBeVisible();await pane().getByRole('tab',{name:/Theo đơn bán/}).click();
 });
 await test('Server filter errors are visible and retry replaces totals with the selected server result',async()=>{
  const org=sales.filterOptions.organizations[0];assert.ok(org);await page.route('**/api/crm/spreadsheet/reconciliation?**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"QA_UNAVAILABLE"}'}));
  await pane().getByLabel('Đối tác',{exact:true}).selectOption(org.id);await expect(pane().getByRole('alert')).toContainText('Chưa tải được dữ liệu');await page.unroute('**/api/crm/spreadsheet/reconciliation?**');
  await pane().getByRole('button',{name:'Thử lại',exact:true}).click();await expect(pane().getByRole('alert')).toHaveCount(0);await expect(pane().locator('section[aria-busy]')).toHaveAttribute('aria-busy','false');
  const filtered=await get('/api/crm/spreadsheet/reconciliation?organizationId='+org.id);await expect(total('Thành tiền sau CK')).toHaveText(money(filtered.totals.netTotal));
  await pane().getByRole('button',{name:'Xóa bộ lọc',exact:true}).click();await expect(total('Thành tiền sau CK')).toHaveText(money(sales.totals.netTotal));
 });
 await test('Inventory overview, document ledger and operational queues remain available without writes',async()=>{
  await choose('Nhập');await expect(total('Tồn cuối kỳ')).toHaveText(stock.totals.closingOnHand+' gói');await expect(pane().getByRole('columnheader',{name:/Tên sản phẩm/})).toBeVisible();await expect(pane().getByRole('columnheader',{name:'Mã SKU'})).toHaveCount(0);await capture('inventory-desktop');
  await pane().getByRole('tab',{name:/Sổ chứng từ/}).click();await expect(pane().locator('.crm-spreadsheet-table')).toBeVisible();await pane().getByRole('tab',{name:/Tổng hợp tồn kho/}).click();
  await choose('Việc cần xử lý');await expect(pane().getByRole('heading',{name:'Yêu cầu website cần tiếp nhận'})).toBeVisible();await expect(pane().getByRole('heading',{name:'Việc quá hạn & hôm nay'})).toBeVisible();await capture('queues-desktop');assert.deepEqual(writes,[]);
 });
 }
 await test('Desktop and phone layouts stay within the viewport while tables retain horizontal scrolling',async()=>{
  await choose('Bán hàng');
  for(const width of [1865,1440,390,320]){await page.setViewportSize({width,height:width>1000?1000:844});await capture('dashboard-'+width);}
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 });
 await test('Long fictitious read responses remain readable on desktop and phone without database writes',async()=>{
  const common={createdAt:'2026-10-25',orderDate:'2026-10-25',organizationId:sales.filterOptions.organizations[0].id,partnerKind:'DEALER',orderStatus:'CONFIRMED',deliveryStatus:'UNSCHEDULED',paymentStatus:'OPEN',versionNumber:1,lineCount:2,skuSummary:'Socola hạnh nhân dâu tây (80g), Socola đen bọc hạnh nhân (80g)',totalBaseQty:'120',listSubtotal:'9480000',discountPercentLabel:'40%',discountAmount:'3792000',taxAndFee:'0',netTotal:'5688000',deliveryIds:[],deliveryCodes:[],issueDocIds:[],issueDocCodes:[],warehouseCodes:[],deliveredQty:'0',dispatchedQty:'0',receivableIds:[],receivableCodes:[],receivableStatus:'OPEN',receivableOriginal:'5688000',paidAmount:'0',remainingDebt:'5688000',unpostedAmount:'0',dueOn:'2026-10-30',note:'LOCAL fictitious display fixture only',lines:[]};
  const visual={...sales,orders:['Đại lý kiểm thử tên rất dài để kiểm tra bố cục trên điện thoại','Đối tác kiểm thử số 2','Đối tác kiểm thử số 3'].map((name,i)=>({...common,orderId:'visual-'+i,orderCode:'QA-20261025-1234567'+i,organizationName:name,organizationCode:'QA_DISPLAY_'+i})),totals:{...sales.totals,orderCount:3,lineCount:6,totalBaseQty:'360',listSubtotal:'28440000',discountAmount:'11376000',netTotal:'17064000',paidAmount:'0',remainingDebt:'17064000'}};
  await page.route('**/api/crm/spreadsheet/reconciliation?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(visual)}));await pane().getByLabel('Đối tác',{exact:true}).selectOption(common.organizationId);await expect(total('Thành tiền sau CK')).toHaveText(money(visual.totals.netTotal));
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await capture('populated-fictitious-'+width);}
  await page.unroute('**/api/crm/spreadsheet/reconciliation?**');assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 });
}finally{await browser.close();await fs.writeFile(folder+(captureOnly?'/visual-local.json':'/browser-local.json'),JSON.stringify({environment:'LOCAL Edge / isolated PGlite',cases,errors,writes},null,2)+'\n');}
