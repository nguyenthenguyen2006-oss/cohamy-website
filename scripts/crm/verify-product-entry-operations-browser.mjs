import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
const base='http://127.0.0.1:4341',run=JSON.parse(await fs.readFile('.local/product-entry/fulfillment-run.json','utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),cases=[],errors=[];
page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
const folder='docs/crm/test-results/product-entry';await fs.mkdir(folder,{recursive:true});
const test=async(name,fn)=>{await fn();cases.push({name,status:'PASS'});console.log('PASS '+name);};
const capture=async(group,name)=>{await group.scrollIntoViewIfNeeded();await group.screenshot({path:'.impeccable/review/'+name+'.png',caret:'initial'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));};
const submit=async(label,action)=>{const response=page.waitForResponse(r=>r.request().method()==='POST'&&r.url()===base+'/api/crm/'+action);await page.getByRole('button',{name:label,exact:true}).click();const r=await response;assert.ok(r.ok(),await r.text());return r.json();};
try{
 await page.goto(base+'/crm/login');await page.getByLabel('Email',{exact:true}).fill('admin@crm-qa.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('Local-QA-Only-2026!');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page).toHaveURL(base+'/crm');
 await test('Picking shows every eligible source lot with names, unit, scan and quantity; saves both in one transaction',async()=>{
  await page.goto(base+'/crm/sales/'+run.orderId);const grid=page.getByRole('group',{name:'Sản phẩm cần soạn của đợt giao',exact:true});await expect(grid.locator('tbody tr')).toHaveCount(2);
  for(const line of run.lines){await grid.getByLabel(`Soạn ${line.name} lô ${line.lot}`,{exact:true}).fill('1');await grid.getByLabel(`Mã quét ${line.name} lô ${line.lot}`,{exact:true}).fill(line.lot);}
  await capture(grid,'picking-desktop');await page.setViewportSize({width:390,height:844});await capture(grid,'picking-mobile');await page.setViewportSize({width:1440,height:1000});
  await page.getByLabel('Lý do / thiết bị',{exact:true}).fill('LOCAL QA bulk scan actual form');const result=await submit('Xác nhận soạn','fulfillment/pick');assert.equal(result.lines.length,2);
 });
 await test('Backorder grid contains only shortage products and submits named rows in one save',async()=>{
  await page.goto(base+'/crm/sales/'+run.shortageOrderId);await page.getByText('Ghi hàng chờ bổ sung',{exact:true}).first().click();const grid=page.getByRole('group',{name:'Sản phẩm còn thiếu của đơn',exact:true});await expect(grid.locator('tbody tr')).toHaveCount(1);
  await grid.getByLabel('Chờ bổ sung '+run.productName,{exact:true}).fill('2');await capture(grid,'backorder-desktop');await page.setViewportSize({width:390,height:844});await capture(grid,'backorder-mobile');await page.setViewportSize({width:1440,height:1000});
  await page.getByLabel('Người / ghi chú xử lý',{exact:true}).fill('LOCAL QA shortage actual form');const result=await submit('Ghi hàng chờ bổ sung','fulfillment/backorder');assert.equal(result.ids.length,1);
 });
 await test('Commercial request opens prefilled catalogue by name; untouched products are omitted from saved request',async()=>{
  await page.goto(base+'/crm/requests/new');const grid=page.getByRole('group',{name:'Sản phẩm, đơn vị và số lượng',exact:true});assert.ok(await grid.locator('tbody tr').count()>2);
  await grid.getByLabel('Số lượng '+run.productName,{exact:true}).fill('2');await grid.getByLabel('Đơn vị '+run.productName,{exact:true}).selectOption('BASE');
  await capture(grid,'commercial-desktop');await page.setViewportSize({width:390,height:844});await capture(grid,'commercial-mobile');await page.setViewportSize({width:1440,height:1000});
  await page.locator('select[name=organizationId]').selectOption({label:'LOCAL QA · Đại lý A · QA_A'});await page.getByLabel('Người nhận hàng',{exact:true}).fill('LOCAL QA receiver');await page.getByLabel('Số điện thoại nhận hàng',{exact:true}).fill('0900000000');await page.getByLabel('Địa chỉ giao',{exact:true}).fill('LOCAL QA address');
  const response=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/crm/commerce/save-request'));await page.getByRole('button',{name:'Lưu bản nháp và tính giá',exact:true}).click();const r=await response;assert.ok(r.ok(),await r.text());assert.equal(r.request().postDataJSON().basket.lines.length,1);
 });
 assert.deepEqual(errors,[]);
}finally{await browser.close();await fs.writeFile(folder+'/operations-browser-local.json',JSON.stringify({environment:'LOCAL Edge / isolated PGlite',mail:'DISABLED',cases,errors},null,2)+'\n');}
