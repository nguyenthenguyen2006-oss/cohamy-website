import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {chromium,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:60000});
const base='http://127.0.0.1:4341',run=JSON.parse(await fs.readFile('.local/crm-document-flow-run.json','utf8')),folder='docs/crm/test-results/document-flow',browser=await chromium.launch({channel:'msedge',headless:true}),contexts=[],cases=[],errors=[];
async function session(email){const context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(context);const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/crm/login');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Mật khẩu',{exact:true}).fill('Local-QA-Only-2026!');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page).toHaveURL(base+'/crm');return {context,page};}
async function get(s,path){const r=await s.context.request.get(base+path);assert.ok(r.ok(),`${path} ${r.status()}`);return r.json();}
async function post(s,action,payload){return s.context.request.post(base+'/api/crm/document-flow/'+action,{headers:{origin:base},data:payload});}
async function click(page,label,route){const response=page.waitForResponse(r=>r.url()===base+route&&r.request().method()==='POST');await page.getByRole('button',{name:label,exact:true}).click();const r=await response;assert.ok(r.ok(),`${label} ${r.status()} ${await r.text()}`);return r.json();}
async function capture(page,name){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`${folder}/${name}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' overflow');}
async function test(name,fn){await fn();cases.push({test:name,status:'PASS'});console.log('PASS',name);}
try{
 const admin=await session(run.emails.admin),factory=await session(run.emails.factory),hn=await session(run.emails.hn),accountant=await session(run.emails.accountant),hcm=await session(run.emails.hcm);let requestCode,dispatchCode,dispatchId,receiptId;
 const initial=await get(admin,'/api/crm/document-flow/workspace'),hnWh=initial.warehouses.find(w=>w.code.includes('HN')),product=initial.products[0];
 await test('Admin creates draft → preview → sends factory request via actual form',async()=>{
  const page=admin.page;await page.goto(base+'/crm/factory-requests');await page.getByRole('button',{name:'Lập phiếu đề nghị',exact:true}).click();await page.getByLabel('Nhà máy',{exact:true}).selectOption(initial.documents.find(s=>s.kind==='REQUEST').factoryMembershipId);await page.getByLabel('Kho nhận dự kiến',{exact:true}).selectOption(hnWh.id);await page.getByLabel('Thêm sản phẩm',{exact:true}).selectOption(product.id);await page.getByRole('button',{name:'Thêm dòng',exact:true}).click();await page.getByLabel('Số lượng dòng 1',{exact:true}).fill('100');const draft=await click(page,'Lưu nháp & Xem trước','/api/crm/document-flow/save');requestCode=draft.code;await expect(page.getByRole('dialog',{name:'Xem chứng từ'})).toBeVisible();await click(page,'Xác nhận & Gửi nhà máy','/api/crm/document-flow/confirm');await expect(page.getByRole('dialog')).toHaveCount(0);await capture(page,'admin-request');
 });
 await test('Factory accepts assigned request and creates/locks a transfer from it',async()=>{
  const page=factory.page;await page.reload();const row=page.getByRole('row').filter({hasText:requestCode});await row.getByRole('button',{name:'Xác nhận tiếp nhận'}).click();await expect(row.getByText('Nhà máy đã nhận',{exact:true})).toBeVisible();await row.getByRole('button',{name:'Lập phiếu chuyển hàng về kho'}).click();await expect(page.getByLabel('Số lượng dòng 1',{exact:true})).toHaveValue('100');const draft=await click(page,'Lưu nháp & Xem trước','/api/crm/document-flow/save');dispatchCode=draft.code;dispatchId=draft.id;await click(page,'Xác nhận gửi kho','/api/crm/document-flow/confirm');await page.getByRole('button',{name:'Phiếu chuyển & Bản nháp',exact:true}).click();await capture(page,'factory-locked');
 });
 await test('Warehouse form autofills 100; receipt 98 persists with discrepancy and locks',async()=>{
  const page=hn.page;await page.goto(base+'/crm/warehouse-factory');const row=page.getByRole('row').filter({hasText:dispatchCode});await row.getByRole('button',{name:'Lập phiếu nhập kho'}).click();await expect(page.getByLabel('Số lượng dòng 1',{exact:true})).toHaveValue('100');await capture(page,'warehouse-autofilled-receipt');await page.getByLabel('Số lượng dòng 1',{exact:true}).fill('98');await page.getByLabel('Ghi chú dòng 1',{exact:true}).fill('LOCAL QA · Giao thiếu hai gói');const draft=await click(page,'Lưu nháp & Xem trước','/api/crm/document-flow/save');receiptId=draft.id;await click(page,'Xác nhận nhập kho','/api/crm/document-flow/confirm');await expect(page.getByRole('row').filter({hasText:dispatchCode}).getByText('-2',{exact:true})).toBeVisible();await capture(page,'warehouse-received-98');
 });
 await test('Accountant has linked document columns, uploads VAT once, no legacy approval buttons',async()=>{
  const page=accountant.page;await page.reload();await expect(page.getByRole('columnheader',{name:'Phiếu nhà máy',exact:true})).toBeVisible();await expect(page.getByRole('columnheader',{name:'Phiếu nhập kho',exact:true})).toBeVisible();assert.equal(await page.getByText('KT Kiểm tra & Duyệt',{exact:true}).count(),0);assert.equal(await page.getByText('NV Hoàn thiện tiền',{exact:true}).count(),0);
  const row=page.getByRole('row').filter({hasText:dispatchCode});await row.getByRole('button',{name:'Tải VAT lên',exact:true}).click();await page.getByLabel('Chọn file VAT').setInputFiles({name:'QA-VAT-BROWSER.pdf',mimeType:'application/pdf',buffer:await fs.readFile(folder+'/receipt.pdf')});await click(page,'Lưu & Khóa VAT','/api/crm/documents');await expect(row.getByRole('link',{name:'Xem/Tải VAT',exact:true})).toBeVisible();await capture(page,'accountant-paired-documents-vat');
 });
 await test('Warehouse issues standalone delivery through real form; preview leaves stock and confirmation deducts once',async()=>{
  const page=hn.page,before=await get(hn,'/api/crm/document-flow/workspace'),stock=workspace=>workspace.stocks.filter(s=>s.warehouse_id===hnWh.id&&s.product_id===product.id).reduce((n,s)=>n+Number(s.on_hand),0),quantityBefore=stock(before);
  await page.getByRole('button',{name:'Xuất / giao hàng',exact:true}).click();await page.getByRole('button',{name:'Lập phiếu xuất / giao hàng',exact:true}).click();
  await page.getByLabel('Kho xuất',{exact:true}).selectOption(hnWh.id);await page.getByLabel('Thêm sản phẩm',{exact:true}).selectOption(product.id);await page.getByRole('button',{name:'Thêm dòng',exact:true}).click();
  for(const [label,value] of [['Khách hàng / Bên nhận','LOCAL QA browser customer'],['Người giao','LOCAL QA browser sender'],['Người nhận','LOCAL QA browser receiver'],['SĐT nhận hàng','0900000000'],['Địa chỉ giao','LOCAL QA test address'],['Ngày giao','2026-10-23'],['Hình thức / đơn vị giao','LOCAL QA carrier']])await page.getByLabel(label,{exact:true}).fill(value);
  await capture(page,'warehouse-delivery-form');const draft=await click(page,'Lưu nháp & Xem trước','/api/crm/document-flow/save');assert.equal(stock(await get(hn,'/api/crm/document-flow/workspace')),quantityBefore);
  const snapshot=await get(hn,'/api/crm/document-flow/view?id='+draft.id);assert.equal(snapshot.lines[0].unitPrice,'');assert.equal(snapshot.totals.total,'');
  await click(page,'Xác nhận xuất kho','/api/crm/document-flow/confirm');assert.equal(stock(await get(hn,'/api/crm/document-flow/workspace')),quantityBefore-1);
  await expect(page.getByRole('row').filter({hasText:draft.code}).getByText('Đã khóa',{exact:true})).toBeVisible();await capture(page,'warehouse-delivery-locked');
  const file=await hn.context.request.get(base+'/api/crm/document-flow/pdf?id='+draft.id+'&revision='+draft.version);assert.ok(file.ok());assert.equal((await file.body()).subarray(0,5).toString(),'%PDF-');await fs.writeFile(folder+'/browser-issued.pdf',await file.body());
 });
 await test('Direct API checks deny wrong warehouse, accountant/manager mutations and settings reads',async()=>{
  for(const s of [hcm]){assert.equal((await s.context.request.get(base+'/api/crm/document-flow/pdf?id='+dispatchId)).status(),404);assert.equal((await post(s,'save',{kind:'RECEIPT',parentId:dispatchId,lines:[{productId:product.id,quantity:'100'}],confirm:true,idempotencyKey:randomUUID()})).status(),404);}
  for(const action of ['accountant-clear-order','accountant-verify-factory-invoice','record-order-payment','create-factory-order','create-handover-invoice'])assert.equal((await accountant.context.request.post(base+'/api/crm/accountant/'+action,{headers:{origin:base},data:{}})).status(),403);
  assert.equal((await accountant.context.request.get(base+'/api/crm/document-flow/mail-settings')).status(),403);assert.equal((await hcm.context.request.get(base+'/api/crm/documents/'+run.vatVersionId)).status(),404);assert.equal((await accountant.context.request.get(base+'/api/crm/accountant/workspace')).status(),403);
 });
 await test('Admin mail rules UI and role screens fit desktop and mobile',async()=>{
  await admin.page.goto(base+'/crm/document-notifications');await expect(admin.page.getByRole('heading',{name:'Thông báo hóa đơn & chứng từ',exact:true})).toBeVisible();await capture(admin.page,'admin-document-notifications');
  await accountant.page.setViewportSize({width:390,height:844});await capture(accountant.page,'accountant-mobile-390');await hn.page.setViewportSize({width:390,height:844});await capture(hn.page,'warehouse-mobile-390');
 });
 assert.deepEqual(errors,[]);
 await fs.writeFile('.local/crm-document-flow-browser-records.json',JSON.stringify({requestCode,dispatchCode,dispatchId,receiptId}));
}finally{await browser.close();await fs.writeFile(folder+'/browser-local.json',JSON.stringify({environment:'LOCAL / real Edge / isolated PGlite',provider:'DISABLED; no external sends',cases,errors},null,2));}
