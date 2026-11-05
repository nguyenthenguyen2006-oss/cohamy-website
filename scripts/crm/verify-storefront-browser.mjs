import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const base='http://localhost:4368',origin='https://cohamy.vn',folder='docs/crm/test-results/storefront';
// This fixed local tunnel points only to the separately seeded storefront QA DB.
// QA credentials are fictitious and deliberately differ from production accounts.
const qaPassword='Local-QA-Only-2026!',qaEmail='admin@crm-qa.invalid';
const policies=['bao-mat-thong-tin','van-chuyen-kiem-tra-doi-tra','thanh-toan','gia','tiep-nhan-giai-quyet-khieu-nai','dieu-kien-cung-cap-hang-hoa','quyen-nghia-vu-cac-ben'];
const productId='cohamy-cashew-chocolate-80g',productPath='/vi/san-pham/cohamy-socola-hat-dieu-80g';
const browser=await chromium.launch({channel:'msedge',headless:true});
// The real-origin staging proxy must see every asset request. A service worker
// owns its own network fetches and would otherwise bypass Playwright routing to
// request staging-only chunk hashes from the separate live deployment.
const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage();
page.setDefaultTimeout(45000);
const cases=[],screenshots=[],assets=[],browserErrors=[],pass=name=>{cases.push({name,status:'PASS'});console.log('PASS '+name);};
page.on('console',message=>{if(message.type()==='error')browserErrors.push(message.text());});
page.on('pageerror',error=>browserErrors.push(error.message));
page.on('requestfailed',request=>browserErrors.push(request.url()+' '+request.failure()?.errorText));
let cookie,client,clientId,tokens,callbackUrl,complete=false,receipt;
async function native(method,path,data){
  const response=await context.request.fetch(base+path,{method,headers:{origin,...(cookie?{cookie:'cohamy_crm_session='+cookie}:{})},...(data?{data}:{})});
  assert.ok(response.ok(),method+' '+path+' HTTP '+response.status());return response.json();
}
async function resetDiscount(discountPercent){const settings=await native('GET','/api/crm/storefront');if(settings.discountPercent!==discountPercent)await native('POST','/api/crm/storefront',{version:settings.version,discountPercent,idempotencyKey:randomUUID()});}
async function settle(){await page.waitForFunction(()=>Array.from(document.querySelectorAll('link[rel="stylesheet"]')).every(link=>link.sheet),{},{timeout:15000});await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>Array.from(document.images).filter(image=>{const box=image.getBoundingClientRect();return box.width&&box.height&&box.top<innerHeight&&box.bottom>0&&box.left<innerWidth&&box.right>0;}).every(image=>image.complete&&image.naturalWidth>0),{},{timeout:20000});}
async function loadFullPageImages(){
  const original=await page.evaluate(()=>({x:scrollX,y:scrollY}));
  let top=0;
  for(let step=0;step<40;step++){
    const height=await page.evaluate(()=>document.documentElement.scrollHeight);
    if(top>=height)break;
    await page.evaluate(value=>window.scrollTo({top:value,behavior:'instant'}),top);await settle();
    top+=Math.max(300,Math.floor((await page.evaluate(()=>innerHeight))*0.75));
  }
  const images=page.locator('img');
  for(let index=0;index<await images.count();index++){
    const image=images.nth(index);
    if(await image.isVisible()){await image.scrollIntoViewIfNeeded();await image.evaluate(image=>image.complete&&image.naturalWidth>0?Promise.resolve():new Promise((resolve,reject)=>{const deadline=setTimeout(()=>reject(new Error('LAZY_IMAGE_TIMEOUT')),20000);image.addEventListener('load',()=>{clearTimeout(deadline);resolve();},{once:true});image.addEventListener('error',()=>{clearTimeout(deadline);reject(new Error('LAZY_IMAGE_ERROR'));},{once:true});}));}
  }
  await page.evaluate(position=>{for(const node of document.querySelectorAll('main *'))if(node.scrollWidth>node.clientWidth&&getComputedStyle(node).overflowX==='auto')node.scrollLeft=0;window.scrollTo({left:position.x,top:position.y,behavior:'instant'});},original);await settle();
}
async function capture(name,{fullPage=false}={}){await settle();if(fullPage)await loadFullPageImages();const path=folder+'/'+name+'.png';await page.screenshot({path,fullPage});screenshots.push(path);}
async function captureFooter(name){await page.locator('footer').scrollIntoViewIfNeeded();await settle();const path=folder+'/'+name+'.png';await page.locator('footer').screenshot({path});screenshots.push(path);}
async function noOverflow(){await settle();const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,stylesheets:Array.from(document.styleSheets).map(sheet=>sheet.href),links:Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(link=>({href:link.href,media:link.media,integrity:link.integrity,outer:link.outerHTML})),margin:getComputedStyle(document.body).margin}));if(dimensions.scroll>dimensions.width+1){const nodes=await page.evaluate(()=>Array.from(document.querySelectorAll('main *')).map(node=>({tag:node.tagName,class:node.className,width:node.getBoundingClientRect().width,left:node.getBoundingClientRect().left,right:node.getBoundingClientRect().right,display:getComputedStyle(node).display,overflow:getComputedStyle(node).overflowX})).filter(node=>node.right>innerWidth+1&&node.width>100).slice(0,30));await fs.writeFile(folder+'/overflow.json',JSON.stringify({url:page.url(),...dimensions,nodes,assets,browserErrors},null,2));await capture('overflow-mobile',{fullPage:true});}assert.ok(dimensions.scroll<=dimensions.width+1,JSON.stringify(dimensions));}
try{
  await fs.mkdir(folder,{recursive:true});
  await page.route(origin+'/**',async route=>{
    try{
    const url=new URL(route.request().url()),headers={...route.request().headers()};delete headers['if-none-match'];delete headers['if-modified-since'];
    const response=await route.fetch({url:base+url.pathname+url.search,maxRedirects:0,headers,maxRetries:route.request().method()==='GET'?2:0});
    if(url.pathname.endsWith('.css')){const body=await response.body();assets.push({path:url.pathname,status:response.status(),type:response.headers()['content-type'],bytes:body.length,sha:createHash('sha256').update(body).digest('hex'),prefix:body.toString('utf8').slice(0,60),headers:response.headers()});}
    if(url.pathname==='/api/crm/mcp/oauth/authorize'&&route.request().method()==='POST'&&response.status()===303){callbackUrl=new URL(response.headers().location);return route.fulfill({status:200,contentType:'text/html',body:'<p>QA storefront OAuth callback captured</p>'});}
    return route.fulfill({response});
    }catch{browserErrors.push('QA proxy request aborted: '+new URL(route.request().url()).pathname);await route.abort().catch(()=>{});}
  });
  const unauth=await context.request.post(base+'/api/crm/storefront',{headers:{origin},data:{}});assert.equal(unauth.status(),401);
  const login=await context.request.post(base+'/api/crm/auth/login',{headers:{origin},data:{email:qaEmail,password:qaPassword}});assert.equal(login.status(),200);
  cookie=login.headers()['set-cookie'].match(/cohamy_crm_session=([^;]+)/)[1];
  await context.addCookies([{name:'cohamy_crm_session',value:cookie,url:origin,secure:true,httpOnly:true,sameSite:'Lax'}]);
  await resetDiscount(30);
  let quote=await native('GET','/api/storefront'),item=quote.items.find(row=>row.productId===productId);
  assert.equal(quote.discountPercent,30);assert.equal(item.basePrice,79000);assert.equal(item.salePrice,59724);assert.equal(item.listPrice,85320);assert.equal(item.vatRate,8);assert.equal(quote.intakeEnabled,true);
  pass('QA public API quotes30percent discount on79000VND net plus8percent VAT; settings require authentication');

  await page.goto(origin+'/vi');await expect(page.locator('footer')).toBeVisible();
  assert.equal(await page.locator('footer a[href*="/chinh-sach/"]').count(),7);
  await page.locator('footer').scrollIntoViewIfNeeded();await noOverflow();await captureFooter('footer-desktop');
  for(const slug of policies){await page.goto(origin+'/vi/chinh-sach/'+slug);await expect(page.locator('h1')).toBeVisible();assert.ok((await page.locator('main').innerText()).length>900);await noOverflow();}
  await page.goto(origin+'/vi/chinh-sach/bao-mat-thong-tin');await capture('policy-desktop',{fullPage:true});
  pass('All7policy links occur in the public footer and resolve to complete readable policy pages');

  await page.goto(origin+productPath);await expect(page.locator('[data-product-price="'+productId+'"]')).toContainText('59.724');
  await expect(page.locator('[data-product-price="'+productId+'"] del')).toContainText('85.320');
  await expect(page.locator('[data-product-price="'+productId+'"]')).toContainText('-30%');
  await noOverflow();await capture('product-desktop');
  await page.getByRole('spinbutton',{name:'Số lượng',exact:true}).fill('2');
  await page.getByRole('button',{name:'Mua ngay',exact:true}).first().click();await expect(page).toHaveURL(/\/vi\/thanh-toan$/);
  await expect(page.getByText('119.448',{exact:false}).first()).toBeVisible();
  await expect(page.locator('input[name="policyConsent"]')).not.toBeChecked();
  pass('Buy now carries2packages to checkout with matching VATinclusive119448VND and unselected policy acknowledgement');

  const adminPage=await context.newPage();
  await adminPage.route(origin+'/**',async route=>{try{const url=new URL(route.request().url()),headers={...route.request().headers()};delete headers['if-none-match'];delete headers['if-modified-since'];return route.fulfill({response:await route.fetch({url:base+url.pathname+url.search,maxRedirects:0,headers,maxRetries:route.request().method()==='GET'?2:0})});}catch{await route.abort().catch(()=>{});}});
  await adminPage.goto(origin+'/crm/storefront');await adminPage.getByLabel('Giảm giá website (%)',{exact:true}).fill('25');
  await expect(adminPage.getByText('Mức giảm xem trước: 25%',{exact:false})).toBeVisible();
  await adminPage.getByRole('button',{name:'Lưu mức giảm',exact:true}).click();await expect(adminPage.getByRole('status')).toContainText('Đã lưu mức giảm 25%');
  quote=await native('GET','/api/storefront');item=quote.items.find(row=>row.productId===productId);assert.equal(item.salePrice,63990);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button',{name:'Cập nhật theo giá mới',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Gửi yêu cầu',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Cập nhật theo giá mới',exact:true}).click();await expect(page.getByText('127.980',{exact:false}).first()).toBeVisible();
  pass('Admin previews and saves25percent; open checkout requires explicit review and acceptance of updated127980VND total');
  await adminPage.close();

  const buyerEmail='storefront-'+randomUUID()+'@crm-qa.invalid';
  for(const [name,value]of Object.entries({fullName:'QA Storefront Buyer',email:buyerEmail,phone:'0900000000',address:'QA fictitious delivery address',city:'QA city',note:'Fictitious isolated QA request. No delivery.'}))await page.locator('[name="'+name+'"]').fill(value);
  await page.locator('input[name="policyConsent"]').check();
  const received=page.waitForResponse(response=>response.url().endsWith('/api/orders')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Gửi yêu cầu',exact:true}).click();const response=await received;assert.equal(response.status(),201);receipt=await response.json();assert.equal(receipt.subtotal,'127980');assert.equal(receipt.paid,false);assert.equal(receipt.status,'PENDING_REVIEW');
  await expect(page.getByRole('heading',{name:'Đã lưu yêu cầu đặt hàng',exact:true})).toBeVisible();
  pass('Real browser submission saves one fictitious pending request with server VATinclusive total, without posting cash or stock');

  const callback='https://chatgpt.com/connector_platform_oauth_redirect';
  const registration=await context.request.post(base+'/api/crm/mcp/oauth/register',{data:{client_name:'Storefront isolated QA',redirect_uris:[callback]}});assert.equal(registration.status(),201);clientId=(await registration.json()).client_id;
  const verifier=randomBytes(32).toString('base64url'),query=new URLSearchParams({client_id:clientId,redirect_uri:callback,response_type:'code',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',state:randomUUID(),scope:'crm.admin',resource:origin+'/api/crm/mcp'});
  await page.goto(origin+'/api/crm/mcp/oauth/authorize?'+query);
  if(await page.locator('input[name=email]').count()){await page.locator('input[name=email]').fill(qaEmail);await page.locator('input[name=password]').fill(qaPassword);}
  await page.locator('button[value=allow]').click();await expect(page.getByText('QA storefront OAuth callback captured')).toBeVisible();assert.ok(callbackUrl?.searchParams.get('code'));
  const exchange=await context.request.post(base+'/api/crm/mcp/oauth/token',{form:{grant_type:'authorization_code',client_id:clientId,redirect_uri:callback,code:callbackUrl.searchParams.get('code'),code_verifier:verifier,resource:origin+'/api/crm/mcp'}});assert.equal(exchange.status(),200);tokens=await exchange.json();
  client=new Client({name:'storefront-qa',version:'1.0.0'});await client.connect(new StreamableHTTPClientTransport(new URL(base+'/api/crm/mcp'),{requestInit:{headers:{authorization:'Bearer '+tokens.access_token}}}));
  const tool=async(name,input)=>{const response=await client.callTool({name,arguments:input});assert.ok(!response.isError);return JSON.parse(response.content.find(content=>content.type==='text').text);};
  const capabilities=await tool('cohamy_capabilities',{operation:'POST /api/crm/storefront'});assert.equal(capabilities.operations[0].status,'AVAILABLE');
  const settings=await tool('cohamy_read',{operation:'GET /api/crm/storefront'});assert.equal(settings.status,200);assert.equal(settings.data.discountPercent,25);
  const write={requestId:randomUUID(),operation:'POST /api/crm/storefront',input:{version:settings.data.version,discountPercent:30,idempotencyKey:randomUUID()}};
  const written=await tool('cohamy_write',write);assert.equal(written.result.status,200);const replay=await tool('cohamy_write',write);assert.equal(replay.replayed,true);assert.deepEqual(replay.result,written.result);
  const policyData=await tool('cohamy_read',{operation:'GET /api/crm/storefront/policies'});assert.equal(policyData.status,200);assert.ok(JSON.stringify(policyData.data).includes('bao-mat-thong-tin'));
  const orders=await tool('cohamy_data',{table:'website_orders',filters:[{column:'code',op:'eq',value:receipt.code}]});assert.equal(orders.total,1);assert.equal(orders.items[0].paid,false);assert.equal(String(orders.items[0].subtotal),receipt.subtotal);assert.equal(orders.items[0].lines[0].unitPrice,'63990');
  const savedSettings=await tool('cohamy_data',{table:'storefront_settings'});assert.equal(savedSettings.total,1);assert.equal(savedSettings.items[0].discount_percent,30);
  pass('Official MCP SDK OAuth reads policies, settings and actual browser order; writes discount with exact retry and retains original order price');

  await page.setViewportSize({width:390,height:844});
  await page.goto(origin+productPath);await expect(page.locator('[data-product-price="'+productId+'"]')).toContainText('59.724');await noOverflow();await capture('product-mobile');await capture('product-mobile-full',{fullPage:true});
  await page.getByRole('button',{name:'Mua ngay',exact:true}).first().click();await expect(page).toHaveURL(/\/vi\/thanh-toan$/);await noOverflow();await capture('checkout-mobile',{fullPage:true});
  await page.goto(origin+'/vi');await page.locator('footer').scrollIntoViewIfNeeded();await noOverflow();await captureFooter('footer-mobile');
  for(const slug of policies){await page.goto(origin+'/vi/chinh-sach/'+slug);await expect(page.locator('h1')).toBeVisible();await noOverflow();}
  await page.goto(origin+'/vi/chinh-sach/bao-mat-thong-tin');await capture('policy-mobile',{fullPage:true});
  await page.goto(origin+'/crm/storefront');await page.getByLabel('Giảm giá website (%)',{exact:true}).fill('30');await noOverflow();await capture('admin-mobile',{fullPage:true});
  await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/crm/storefront');await noOverflow();await capture('admin-desktop',{fullPage:true});
  pass('Desktop1440andmobile390 render product, checkout, Admin preview and all7policies with no horizontal document overflow');
  complete=true;
}catch(error){console.error(String(error.stack??error).replaceAll(qaPassword,'[QA CREDENTIAL]'));process.exitCode=1;}
finally{
  await client?.close().catch(()=>{});
  if(tokens){const revoked=await context.request.post(base+'/api/crm/mcp/oauth/revoke',{form:{token:tokens.refresh_token,client_id:clientId}});assert.equal(revoked.status(),200);}
  if(cookie){await resetDiscount(30).catch(()=>{});await context.request.post(base+'/api/crm/auth/logout',{headers:{origin,cookie:'cohamy_crm_session='+cookie}}).catch(()=>{});}
  await browser.close();await fs.mkdir(folder,{recursive:true});await fs.writeFile(folder+'/browser-mcp-staging.json',JSON.stringify({status:complete?'PASS':'FAIL',environment:'STAGING isolated PostgreSQL production build; local tunnel4368 only; fictitious .invalid contacts',testedAt:new Date().toISOString(),cases,screenshots,externalEmails:0,productionWrites:0,qaGrantRevoked:Boolean(tokens)},null,2)+'\n');
}
