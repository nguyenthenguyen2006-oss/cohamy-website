import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium,expect} from '@playwright/test';

const base='http://localhost:4368',origin='https://cohamy.vn';
const qaPassword='Local-QA-Only-2026!',qaEmail='admin@crm-qa.invalid';
const folder='docs/crm/test-results/storefront';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
const page=await context.newPage();page.setDefaultTimeout(45000);
const buyerEmail='retry-'+randomUUID()+'@crm-qa.invalid',attempts=[],cases=[];
let receipt,finalReceipt,cookie,complete=false,orderCount=0;
await page.route(origin+'/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  try{
    const url=new URL(route.request().url()),headers={...route.request().headers()};
    delete headers['if-none-match'];delete headers['if-modified-since'];
    if(path==='/api/orders'&&route.request().method()==='POST'){
      const body=route.request().postDataJSON();attempts.push({key:body.idempotencyKey,quoteVersion:body.quoteVersion,body});
      if(attempts.length===2){
        // Inject the wrapper's real pre-service rate-limit response. No service
        // replay has run, so this response cannot prove the first order absent.
        return route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({error:'ORDER_RATE_LIMITED'})});
      }
      const response=await route.fetch({url:base+url.pathname+url.search,headers,maxRedirects:0,maxRetries:0});
      assert.equal(response.status(),201);const data=await response.json();
      if(attempts.length===1){receipt=data;return route.abort('failed');}
      finalReceipt=data;return route.fulfill({response});
    }
    return route.fulfill({response:await route.fetch({url:base+url.pathname+url.search,headers,maxRedirects:0,maxRetries:route.request().method()==='GET'?2:0})});
  }catch{await route.abort().catch(()=>{});}
});
async function metadata(){return page.evaluate(()=>JSON.parse(localStorage.getItem('cohamy-order-request')??'null'));}
try{
  await page.goto(origin+'/vi/san-pham/cohamy-socola-hat-dieu-80g');
  await page.getByRole('button',{name:'Mua ngay',exact:true}).first().click();await expect(page).toHaveURL(/\/vi\/thanh-toan$/);
  for(const [name,value]of Object.entries({fullName:'QA Lost Response Buyer',email:buyerEmail,phone:'0900000000',address:'QA fictitious delivery address',city:'QA city',note:'Fictitious lost-response retry test. No delivery.'}))await page.locator('[name="'+name+'"]').fill(value);
  await page.locator('input[name="policyConsent"]').check();
  const submit=page.getByRole('button',{name:'Gửi yêu cầu',exact:true});
  await submit.click();await expect(page.locator('form [role="alert"]')).toContainText('Chưa xác nhận lưu được đơn.');
  assert.ok(receipt);assert.equal(receipt.paid,false);assert.equal(receipt.status,'PENDING_REVIEW');assert.equal(receipt.subtotal,'59724');
  const first=await metadata();assert.equal(first.key,attempts[0].key);
  cases.push('First actual STAGING request commits one pending order; proxy drops only the response and client retains its request key');
  const limited=page.waitForResponse(response=>response.url().endsWith('/api/orders')&&response.request().method()==='POST');
  await submit.click();assert.equal((await limited).status(),429);await expect(submit).toBeEnabled();
  const second=await metadata();assert.ok(second,'Pre-service429 must not discard an uncertain original request key');assert.deepEqual(second,first);
  cases.push('Injected pre-service429 leaves the existing uncertain request key and original quote unchanged');
  const retry=page.waitForResponse(response=>response.url().endsWith('/api/orders')&&response.request().method()==='POST');
  await submit.click();assert.equal((await retry).status(),201);await expect(page.getByRole('heading',{name:'Đã lưu yêu cầu đặt hàng',exact:true})).toBeVisible();
  assert.equal(attempts.length,3);assert.ok(attempts.every(attempt=>attempt.key===first.key));assert.deepEqual(attempts[0].body,attempts[1].body);assert.deepEqual(attempts[0].body,attempts[2].body);assert.deepEqual(finalReceipt,receipt);assert.equal(await metadata(),null);
  cases.push('Third actual STAGING request replays the original receipt; all3requests carry the same key and payload; success clears pending metadata');
  const login=await context.request.post(base+'/api/crm/auth/login',{headers:{origin},data:{email:qaEmail,password:qaPassword}});assert.equal(login.status(),200);cookie=login.headers()['set-cookie'].match(/cohamy_crm_session=([^;]+)/)[1];
  const orders=await context.request.get(base+'/api/crm/work/orders?q='+encodeURIComponent(buyerEmail),{headers:{origin,cookie:'cohamy_crm_session='+cookie}});assert.equal(orders.status(),200);
  const data=await orders.json();assert.equal(data.total,1);assert.equal(data.items.length,1);assert.equal(data.items[0].contact.email,buyerEmail);assert.equal(data.items[0].code,receipt.code);assert.equal(data.items[0].paid,false);assert.equal(String(data.items[0].subtotal),receipt.subtotal);orderCount=data.total;
  cases.push('Authenticated native Admin order view finds exactly1saved order for the unique fictitious email after all3attempts');
  complete=true;console.log(JSON.stringify({status:'PASS',attempts:attempts.length,sameKey:attempts.every(attempt=>attempt.key===first.key),orderCount,receiptCode:receipt.code,cases},null,2));
}catch(error){console.error(String(error.stack??error).replaceAll(qaPassword,'[QA CREDENTIAL]'));process.exitCode=1;}
finally{
  if(cookie)await context.request.post(base+'/api/crm/auth/logout',{headers:{origin,cookie:'cohamy_crm_session='+cookie}}).catch(()=>{});
  await browser.close();await fs.mkdir(folder,{recursive:true});await fs.writeFile(folder+'/client-retry-staging.json',JSON.stringify({status:complete?'PASS':'FAIL',testedAt:new Date().toISOString(),environment:'STAGING isolated fakebuyer; firstcommit+finalreplay useactualservice;429injected atproxy to model actual pre-service wrapperlimit',cases,attempts:attempts.length,sameKey:attempts.length===3&&attempts.every(attempt=>attempt.key===attempts[0].key),orderCount,productionWrites:0,externalEmails:0},null,2)+'\n');
}
