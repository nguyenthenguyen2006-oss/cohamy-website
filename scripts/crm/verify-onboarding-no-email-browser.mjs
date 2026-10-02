import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';

const base='http://localhost:4337',cases=[],screens=[],errors=[],mailRequests=[];
const browser=await chromium.launch({channel:'msedge',headless:true});
const applicant=await browser.newContext({viewport:{width:1366,height:900}}),admin=await browser.newContext({viewport:{width:1366,height:900}});
const page=await applicant.newPage(),reviewer=await admin.newPage(),email='direct-'+Date.now()+'@crm-qa.invalid',password='Local-QA-Only-2026!';
for(const p of [page,reviewer]){p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.url().includes('/onboarding/verification-'))mailRequests.push(r.url());});}
async function action(p,path,label){const pending=p.waitForResponse(r=>r.url()===base+path&&r.request().method()==='POST');await p.getByRole('button',{name:label,exact:true}).click();const response=await pending;assert.ok(response.ok(),path+' '+response.status());return response.json();}
async function application(){const response=await applicant.request.get(base+'/api/crm/onboarding/application');assert.equal(response.status(),200);return response.json();}
async function capture(name){await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const path='.local/onboarding-no-email/'+name+'.png';await page.screenshot({path,fullPage:true});screens.push(path);}
async function test(name,run){await run();cases.push({name,status:'PASS'});console.log('PASS '+name);}
await fs.mkdir('.local/onboarding-no-email',{recursive:true});
try{
 await test('Unverified applicant registers and submits through the real UI without any email-code request',async()=>{
  await page.goto(base+'/portal/register');
  for(const [label,value] of [['Tên đơn vị','LOCAL QA Direct Application'],['Người đại diện','LOCAL QA Applicant'],['Điện thoại','0901234567'],['Email',email],['Địa chỉ','LOCAL QA saved address'],['Tỉnh/thành, khu vực','Hà Nội'],['Mật khẩu (12–72 ký tự)',password]])await page.getByLabel(label,{exact:true}).fill(value);
  await action(page,'/api/crm/onboarding/register','Tạo hồ sơ đăng ký');await expect(page).toHaveURL(base+'/portal/application');
  assert.equal((await application()).email_verified_at,null);
  await expect(page.getByRole('button',{name:'Gửi hồ sơ xét duyệt',exact:true})).toBeVisible();
  assert.equal(await page.getByRole('button',{name:'Gửi mã xác minh qua email',exact:true}).count(),0);
  assert.equal(await page.getByLabel('Mã 6 số (hiệu lực 10 phút)',{exact:true}).count(),0);
  await capture('draft-desktop');await page.setViewportSize({width:390,height:844});await capture('draft-390');
  await action(page,'/api/crm/onboarding/submit','Gửi hồ sơ xét duyệt');await page.reload();
  await expect(page.locator('.portal-page-header')).toContainText('Chờ Cohamy xét duyệt');assert.equal((await application()).email_verified_at,null);
  assert.equal((await applicant.request.post(base+'/api/crm/auth/login',{headers:{origin:base},data:{email,password}})).status(),401);
 });
 await test('An existing unverified submitted application can be supplemented and resubmitted without mail',async()=>{
  await reviewer.goto(base+'/crm/login');await reviewer.getByLabel('Email',{exact:true}).fill('admin@crm-qa.invalid');await reviewer.getByLabel('Mật khẩu',{exact:true}).fill(password);await reviewer.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(reviewer).toHaveURL(base+'/crm');
  const a=await application(),response=await admin.request.post(base+'/api/crm/onboarding/review',{headers:{origin:base},data:{id:a.id,data:{version:a.version,action:'NEEDS_INFO',message:'QA bổ sung địa chỉ',fields:['address']}}});assert.equal(response.status(),200);
  await page.reload();await page.getByLabel('Địa chỉ',{exact:true}).fill('LOCAL QA updated direct application address');await action(page,'/api/crm/onboarding/edit','Lưu thông tin hồ sơ');await page.reload();
  await action(page,'/api/crm/onboarding/submit','Gửi hồ sơ xét duyệt');await page.reload();const saved=await application();assert.equal(saved.status,'SUBMITTED');assert.equal(saved.email_verified_at,null);assert.ok(saved.history.some(h=>h.action==='NEEDS_INFO'));
 });
 await test('Cohamy approves the unverified application and only then the applicant can log in to the dealer portal',async()=>{
  const a=await application();await reviewer.goto(base+'/crm/applications/'+a.id);await action(reviewer,'/api/crm/onboarding/review','Duyệt hồ sơ');
  await page.reload();assert.equal((await application()).email_verified_at,null);await page.getByRole('link',{name:'Đăng nhập cổng đại lý',exact:true}).click();
  await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Mật khẩu',{exact:true}).fill(password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page).toHaveURL(base+'/portal');
  assert.equal((await applicant.request.get(base+'/api/crm/me')).status(),200);assert.deepEqual(mailRequests,[]);assert.deepEqual(errors,[]);
 });
}finally{
 await browser.close();await fs.mkdir('docs/crm/test-results',{recursive:true});
 await fs.writeFile('docs/crm/test-results/onboarding-no-email-browser-local.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'LOCAL real Edge and Next APIs; isolated fictitious PGlite; email OTP not used',status:cases.length===3?'PASS':'FAIL',cases,screens,pageErrors:errors,mailRequests},null,2));
}
