import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:30000}),base='http://127.0.0.1:4342';
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage(),cases=[],errors=[],unexpectedWrites=[];
const captureOnly=process.argv.includes('--capture-only');
const output='.local/inline-mail-rules';await fs.mkdir(output,{recursive:true});
page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(r.method()==='POST'&&/\/(save-provider|test-mail|retry-mail)$/.test(r.url()))unexpectedWrites.push(r.url());});
const settings=async()=>{const r=await context.request.get(base+'/api/crm/document-flow/mail-settings');assert.ok(r.ok());return r.json();};
const row=key=>page.locator(`tr[data-mail-rule="${key}"]`),editor=()=>page.locator('.crm-mail-rule-editor');
const toggle=async key=>{await row(key).locator('button[aria-expanded]').click();};
const test=async(name,fn)=>{await fn();cases.push({name,status:'PASS'});console.log('PASS '+name);};
const save=async()=>{const response=page.waitForResponse(r=>r.url()===base+'/api/crm/document-flow/save-mail-rule'&&r.request().method()==='POST');await editor().getByRole('button',{name:'Lưu cài đặt',exact:true}).click();const r=await response;assert.ok(r.ok(),await r.text());return r.json();};
const capture=async name=>{await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running')); await page.screenshot({path:output+'/'+name+'.png',fullPage:false,caret:'initial'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' overflow');};
try{
 await page.goto(base+'/crm/login');await page.getByLabel('Email',{exact:true}).fill('admin@crm-qa.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('Local-QA-Only-2026!');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page).toHaveURL(base+'/crm');
 await page.goto(base+'/crm/document-notifications');const initial=await settings(),workspaceResponse=await context.request.get(base+'/api/crm/document-flow/workspace'),workspace=await workspaceResponse.json();
 const a=initial.events.find(e=>e.available&&e.scopes.warehouse&&e.scopes.factory);
 const b=initial.events.find(e=>e.available&&!e.scopes.factory);assert.ok(a&&b);const existingA=initial.rules.find(r=>r.event===a.event),existingB=initial.rules.find(r=>r.event===b.event),aKey=existingA?'rule:'+existingA.id:'new:'+a.event,bKey=existingB?'rule:'+existingB.id:'new:'+b.event;let savedId,secondId;
 if(captureOnly){
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:width===1440?1100:844});await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));
   await toggle(aKey);await expect(editor()).toHaveCount(1);await capture(width===1440?'desktop-inline':'mobile-'+width);await toggle(aKey);await expect(editor()).toHaveCount(0);
   cases.push({name:`Inline layout at ${width}px`,status:'PASS'});
  }
 }else{
 await test('Clicking an event expands its editor immediately beneath that row; other editors stay closed',async()=>{
  await expect(editor()).toHaveCount(0);await row(aKey).getByText(a.label,{exact:true}).click();await expect(editor()).toHaveCount(1);
  assert.ok(await row(aKey).evaluate(el=>el.nextElementSibling.classList.contains('crm-mail-rule-detail')));await expect(editor().getByRole('heading')).toContainText(a.label);
  await expect(page.getByText('Loại chứng từ / thời điểm gửi',{exact:true})).toHaveCount(0);
  await editor().getByLabel('Trạng thái quy tắc',{exact:true}).selectOption('false');await editor().getByLabel('TO',{exact:true}).fill('inline-a@crm-qa.invalid');await editor().getByLabel('Tiêu đề',{exact:true}).fill('Inline A {{code}}');
  await editor().getByLabel('Kho áp dụng',{exact:true}).selectOption(workspace.warehouses[0].id);await editor().getByLabel('Nhà máy áp dụng',{exact:true}).selectOption(workspace.factories[0].id);
  await capture('desktop-inline');
 });
 await test('Switching events retains unsaved fields per row and applies the selected event scopes',async()=>{
  await toggle(bKey);await expect(editor()).toHaveCount(1);await expect(editor().getByRole('heading')).toContainText(b.label);await expect(editor().getByLabel('TO',{exact:true})).toHaveValue(existingB?.recipients.to.join(', ')??'');await expect(editor().getByLabel('Nhà máy áp dụng',{exact:true})).toBeDisabled();
  await editor().getByLabel('TO',{exact:true}).fill('inline-b@crm-qa.invalid');await toggle(aKey);
  await expect(editor().getByLabel('TO',{exact:true})).toHaveValue('inline-a@crm-qa.invalid');await expect(editor().getByLabel('Tiêu đề',{exact:true})).toHaveValue('Inline A {{code}}');await expect(editor().getByLabel('Kho áp dụng',{exact:true})).toHaveValue(workspace.warehouses[0].id);
  await toggle(aKey);await expect(editor()).toHaveCount(0);await row(aKey).locator('button[aria-expanded]').focus();await row(aKey).locator('button[aria-expanded]').press('Enter');await expect(editor()).toHaveCount(1);
 });
 await test('Saving stays beside the correct row, refreshes its version and retains multiple warehouse scopes',async()=>{
  const result=await save();savedId=result.id;await expect(row('rule:'+savedId).locator('button[aria-expanded]')).toHaveAttribute('aria-expanded','true');
  assert.ok(await row('rule:'+savedId).evaluate(el=>el.nextElementSibling.classList.contains('crm-mail-rule-detail')));await expect(editor().getByRole('status')).toHaveText('Đã lưu.');
  const stored=(await settings()).rules.find(r=>r.id===savedId);assert.equal(stored.event,a.event);assert.deepEqual(stored.recipients.to,['inline-a@crm-qa.invalid']);assert.equal(stored.enabled,false);
  await row('rule:'+savedId).getByRole('button',{name:'Thêm phạm vi',exact:true}).click();await expect(editor().getByLabel('TO',{exact:true})).toHaveValue('');
  await editor().getByLabel('TO',{exact:true}).fill('inline-scope@crm-qa.invalid');await editor().getByLabel('Kho áp dụng',{exact:true}).selectOption(workspace.warehouses[1].id);
  secondId=(await save()).id;await expect(row('rule:'+secondId).locator('button[aria-expanded]')).toHaveAttribute('aria-expanded','true');
  await toggle('rule:'+savedId);await expect(editor().getByLabel('TO',{exact:true})).toHaveValue('inline-a@crm-qa.invalid');await expect(editor()).toHaveCount(1);
 });
 await test('Inline editors fit desktop/mobile and keyboard closing works without triggering email or provider writes',async()=>{
  for(const width of [390,320]){await page.setViewportSize({width,height:844});await row('rule:'+savedId).scrollIntoViewIfNeeded();await capture('mobile-'+width);assert.ok(await editor().evaluate(el=>el.getBoundingClientRect().width<=innerWidth));}
  await page.setViewportSize({width:1440,height:1100});await editor().getByRole('button',{name:'Thu gọn cài đặt',exact:true}).click();await expect(editor()).toHaveCount(0);
  await page.reload();await toggle('rule:'+savedId);await expect(editor().getByLabel('TO',{exact:true})).toHaveValue('inline-a@crm-qa.invalid');await capture('desktop-saved-inline');
  const after=await settings();assert.equal(after.jobs.length,initial.jobs.length);assert.deepEqual(unexpectedWrites,[]);assert.deepEqual(errors,[]);
 });
 }
}finally{await browser.close();await fs.writeFile(output+(captureOnly?'/visual-local.json':'/browser-local.json'),JSON.stringify({environment:'LOCAL Edge / isolated PGlite',cases,errors,unexpectedWrites},null,2)+'\n');}
