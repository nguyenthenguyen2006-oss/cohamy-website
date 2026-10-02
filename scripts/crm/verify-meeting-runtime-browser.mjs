import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
const base='http://localhost:4336',fixture=JSON.parse(await fs.readFile('.local/meeting-runtime-ui.json','utf8'));
assert.match(fixture.directory,/^\.local[\\/]crm-qa-meeting-ui-/);
const browser=await chromium.launch({channel:'msedge',headless:true}),contexts=[],cases=[],screens=[],pageErrors=[];
async function session(email,area){const context=await browser.newContext({viewport:{width:1366,height:900}});contexts.push(context);context.setDefaultTimeout(45000);const page=await context.newPage();page.on('pageerror',error=>pageErrors.push(error.message));await page.goto(base+'/'+area+'/login');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Mật khẩu',{exact:true}).fill('Local-QA-Only-2026!');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page).toHaveURL(base+'/'+area);return {context,page};}
async function post(s,path,data){const response=await s.context.request.post(base+path,{headers:{origin:base},data});assert.ok(response.ok(),path+' '+response.status()+' '+await response.text());return response.json();}
async function get(s,path){const response=await s.context.request.get(base+path);assert.ok(response.ok(),path+' '+response.status());return response.json();}
async function click(s,path,name){const response=s.page.waitForResponse(r=>r.url()===base+path&&r.request().method()==='POST');await s.page.getByRole('button',{name,exact:true}).click();const result=await response;assert.ok(result.ok(),path+' '+result.status()+' '+await result.text());return result.json();}
async function capture(page,name){await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' horizontal overflow');const path='.local/meeting-runtime-browser/'+name+'.png';await page.screenshot({path,fullPage:true});screens.push({name,path,viewport:page.viewportSize()});}
async function test(name,run){try{await run();cases.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){cases.push({name,status:'FAIL'});throw error;}}
await fs.mkdir('.local/meeting-runtime-browser',{recursive:true});
let article,downstream,upstream,originalTitle;
try{
  const admin=await session('admin@crm-qa.invalid','crm'),dealer=await session('a@crm-qa.invalid','portal'),buyer=await session('b@crm-qa.invalid','portal');
  if(process.argv.includes('--after-restart')){
    const saved=JSON.parse(await fs.readFile('.local/meeting-runtime-browser/state.json','utf8'));
    await test('Published CRM content survives a complete Next/PGlite process restart',async()=>{const response=await buyer.context.request.get(base+saved.publicPath);assert.equal(response.status(),200);assert.ok((await response.text()).includes(saved.title));const row=await get(admin,'/api/crm/articles/get?id='+saved.articleId);assert.equal(row.title,saved.title);});
  }else{
    await test('CRM form saves a long article, sanitizes HTML, and publishes to the actual public route',async()=>{
      await admin.page.goto(base+'/crm/articles/new');await admin.page.getByLabel('Tiêu đề bài viết',{exact:true}).fill('QA meeting durable article '+randomUUID().slice(0,8));await admin.page.getByLabel('Đường dẫn (Slug)',{exact:true}).fill('qa-meeting-durable-'+randomUUID().slice(0,8));await admin.page.getByLabel('Mô tả ngắn (Trích dẫn)',{exact:true}).fill('QA public article description');await admin.page.getByLabel('Nội dung (HTML / Văn bản)',{exact:true}).fill('<h2>QA long content</h2>'+'<p>Kiểm chứng nội dung được lưu đầy đủ.</p>'.repeat(1000)+'<script>alert("bad")</script>');
      article=await click(admin,'/api/crm/articles/save','Lưu bản nháp');originalTitle=article.title;assert.ok(article.content_html.length>20000);assert.ok(!article.content_html.includes('<script>'));
      await admin.page.goto(base+'/crm/articles/'+article.id);await click(admin,'/api/crm/articles/publish','Xuất bản lên website');
      const response=await buyer.context.request.get(base+'/vi/bai-viet/'+article.slug);assert.equal(response.status(),200);assert.ok((await response.text()).includes(article.title));
    });
    await test('Draft edits preserve the public snapshot; stale edits conflict; unpublish removes the public page',async()=>{
      await admin.page.reload();await admin.page.getByLabel('Tiêu đề bài viết',{exact:true}).fill(originalTitle+' revised');article=await click(admin,'/api/crm/articles/save','Lưu bản nháp mới');
      const publicResponse=await buyer.context.request.get(base+'/vi/bai-viet/'+article.slug);const html=await publicResponse.text();assert.ok(html.includes(originalTitle));assert.ok(!html.includes(article.title));
      const stale=await admin.context.request.post(base+'/api/crm/articles/save',{headers:{origin:base},data:{id:article.id,expectedUpdatedAt:'2000-01-01T00:00:00.000Z',slug:article.slug,title:'stale edit',contentHtml:'<p>stale</p>'}});assert.equal(stale.status(),409);
      await admin.page.reload();await click(admin,'/api/crm/articles/unpublish','Hủy xuất bản (Chuyển về nháp)');assert.equal((await buyer.context.request.get(base+'/vi/bai-viet/'+article.slug)).status(),404);
      await admin.page.reload();await click(admin,'/api/crm/articles/publish','Xuất bản lên website');
    });
    await test('Portal UI formally submits a draft and displays the seller stock allocation',async()=>{
      const draft=await post(buyer,'/api/crm/commerce/save-request',{version:0,organizationId:fixture.dealerB,channel:'PORTAL',basket:{lines:[{sku:'QA_PRICE_A',unitCode:'BASE',quantity:'2'}],discountBasisPoints:0,creditTerms:false},delivery:{recipient:'QA buyer',phone:'0901234567',address:'QA address'},note:'Browser meeting flow',idempotencyKey:randomUUID()});
      await buyer.page.goto(base+'/portal/requests/'+draft.id);await buyer.page.getByLabel('Lý do thao tác',{exact:true}).fill('QA formal proposal');await click(buyer,'/api/crm/commerce/request-action','Xác nhận thao tác đề nghị');await expect(buyer.page.getByRole('button',{name:'Gửi đề nghị đến bên bán',exact:true})).toBeVisible();await buyer.page.getByLabel('Lý do thao tác',{exact:true}).fill('QA send to legal seller');
      downstream=await click(buyer,'/api/crm/commerce/submit-request','Gửi đề nghị đến bên bán');assert.equal(downstream.reservation.status,'PROVISIONAL');assert.equal(downstream.reservation.reservationIds.length,1);await expect(buyer.page).toHaveURL(base+'/portal/orders/'+downstream.id);await expect(buyer.page.getByRole('heading',{name:'Tình trạng giữ hàng',exact:true})).toBeVisible();
    });
    await test('Seller portal exposes upstream action, creates a linked draft, and confirms only its own sale',async()=>{
      await dealer.page.goto(base+'/portal/requests/'+downstream.requestId);await dealer.page.getByLabel('Lý do chuyển lên cấp trên',{exact:true}).fill('QA replenishment from Cohamy');upstream=await click(dealer,'/api/crm/commerce/escalate-request','Tạo yêu cầu mua lên cấp trên');await expect(dealer.page).toHaveURL(base+'/portal/requests/'+upstream.id);
      const head=await get(dealer,'/api/crm/commerce/request?id='+upstream.id);assert.equal(head.status,'DRAFT');assert.equal(head.organization_id,fixture.dealerA);assert.equal(head.parent_request_id,downstream.requestId);
      await dealer.page.goto(base+'/portal/orders/'+downstream.id);await dealer.page.getByLabel('Thao tác đơn bán',{exact:true}).selectOption('CONFIRM');await dealer.page.getByLabel('Lý do thao tác đơn',{exact:true}).fill('QA dealer confirms own legal sale');await click(dealer,'/api/crm/commerce/order-action','Xác nhận thao tác đơn bán');
      const sale=await get(buyer,'/api/crm/commerce/order?id='+downstream.id);assert.equal(sale.status,'CONFIRMED');const unauthorized=await buyer.context.request.post(base+'/api/crm/commerce/order-action',{headers:{origin:base},data:{id:sale.id,version:sale.version,versionId:sale.latest_version_id,action:'CONFIRM',reason:'Buyer cannot confirm own purchase',idempotencyKey:randomUUID()}});assert.ok([403,409].includes(unauthorized.status()));
    });
    await test('Real desktop and 390px pages render articles, seller requests, order stock and policy without overflow',async()=>{
      for(const width of [1366,390]){for(const [s,path,name] of [[admin,'/crm/articles/'+article.id,'article'],[admin,'/crm/requests/policy','policy'],[dealer,'/portal/requests/'+upstream.id,'upstream'],[buyer,'/portal/orders/'+downstream.id,'order']]){await s.page.setViewportSize({width,height:900});const response=await s.page.goto(base+path);assert.equal(response.status(),200);await expect(s.page.locator('h1')).toBeVisible();await capture(s.page,name+'-'+width);}}
    });
    await fs.writeFile('.local/meeting-runtime-browser/state.json',JSON.stringify({articleId:article.id,title:article.title,publicPath:'/vi/bai-viet/'+article.slug,downstreamId:downstream.id,upstreamId:upstream.id},null,2));
  }
  assert.deepEqual(pageErrors,[]);
}finally{
  for(const context of contexts)await context.close();await browser.close();
  await fs.writeFile('docs/crm/test-results/meeting-runtime-browser'+(process.argv.includes('--after-restart')?'-restart':'')+'-local.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'LOCAL real Edge browser and running Next APIs; isolated fictitious PGlite',status:cases.length&&cases.every(row=>row.status==='PASS')&&!pageErrors.length?'PASS':'FAIL',cases,screens,pageErrors},null,2));
}
