import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {chromium,expect} from '@playwright/test';

// Default: fixed tunnel to isolated cart-drawer QA DB, with real-origin routing.
// --production: direct public reads/local browser cart only; no Admin or mocks.
// Both modes block service workers and refuse browser write requests to orders.
const production=process.argv.includes('--production'),origin='https://cohamy.vn';
const base=production?origin:'http://localhost:4369';
const folder='docs/crm/test-results/cart-drawer'+(production?'/production':'');
const unitPrice=production?61992:59724,pairTotal=unitPrice*2;
const qaEmail='admin@crm-qa.invalid',qaPassword='Local-QA-Only-2026!';
const productId='cohamy-cashew-chocolate-80g',productName='Cohamy Socola Hạt Điều 80g';
const productPath='/vi/san-pham/cohamy-socola-hat-dieu-80g',listingPath='/vi/san-pham';
const require=createRequire(import.meta.url),axeSource=await fs.readFile(require.resolve('axe-core/axe.min.js'),'utf8');
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
const page=await context.newPage();
page.setDefaultTimeout(30000);
const cases=[],screenshots=[],measurements=[],accessibility=[],assets=[],browserErrors=[],blockedRequests=[],pendingAssetReads=[];
let cookie,complete=false,activeCase='initialization',mockMode=null,originalDiscount,restoredDiscount=false;
let priceReadResponses=0,orderSubmissionAttempts=0;
const dialog=page.getByRole('dialog',{name:'Giỏ hàng',exact:true});
const headerCart=page.getByRole('button',{name:'Giỏ hàng',exact:true});
const card=page.locator(`[data-product-card="${productId}"]`).first();
const cardAdd=card.getByRole('button',{name:'Thêm vào giỏ',exact:true});
const drawerQuantity=()=>dialog.locator('.cart-drawer-item').filter({hasText:productName}).getByRole('spinbutton');
const checkout=()=>dialog.locator('.cart-drawer-checkout');
const pass=(name,details={})=>{cases.push({name,status:'PASS',...details});console.log('PASS '+name);};
const failure=error=>String(error?.stack??error).replaceAll(qaPassword,'[QA CREDENTIAL]');

page.on('console',message=>{
  if(message.type()!=='error')return;
  const source=message.location().url;
  const expectedMock=mockMode==='error'&&source?.split(/[?#]/)[0]===origin+'/api/storefront'&&/503/.test(message.text());
  browserErrors.push({type:'console',message:message.text(),source,mockMode,expectedMock:Boolean(expectedMock)});
});
page.on('pageerror',error=>browserErrors.push({type:'pageerror',message:error.message,mockMode}));
page.on('requestfailed',request=>{if(!['net::ERR_ABORTED'].includes(request.failure()?.errorText))browserErrors.push({type:'requestfailed',path:new URL(request.url()).pathname,message:request.failure()?.errorText,mockMode});});
page.on('response',response=>{
  if(!production)return;
  const url=new URL(response.url());
  if(url.pathname==='/api/storefront'&&response.request().method()==='GET')priceReadResponses++;
  if(response.status()>=400)browserErrors.push({type:'http',path:url.pathname,status:response.status(),mockMode:null});
  if(url.pathname.endsWith('.css'))pendingAssetReads.push((async()=>{const body=await response.body();assets.push({path:url.pathname,status:response.status(),bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')});})().catch(error=>browserErrors.push({type:'asset-read',path:url.pathname,message:String(error)})));
});

async function native(method,path,data){
  assert.ok(path.startsWith('/api/'),'QA_NATIVE_API_PATH_ONLY');
  if(production)assert.ok(method==='GET'&&path==='/api/storefront','Production QA permits only the public storefront read API');
  const response=await context.request.fetch(base+path,{method,headers:{origin,...(cookie?{cookie:'cohamy_crm_session='+cookie}:{})},...(data?{data}:{})});
  assert.ok(response.ok(),method+' '+path+' HTTP '+response.status());
  return response.json();
}
async function discount(value){
  assert.equal(production,false,'Production QA cannot write settings');
  const settings=await native('GET','/api/crm/storefront');
  if(settings.discountPercent!==value)await native('POST','/api/crm/storefront',{version:settings.version,discountPercent:value,idempotencyKey:randomUUID()});
}
async function settle(){
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('link[rel="stylesheet"]')).every(link=>link.sheet),{},{timeout:20000});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>Array.from(document.images).filter(image=>{const box=image.getBoundingClientRect();return box.width&&box.height&&box.top<innerHeight&&box.bottom>0&&box.left<innerWidth&&box.right>0;}).every(image=>image.complete&&image.naturalWidth>0),{},{timeout:25000});
}
async function loadFullPageImages(){
  const position=await page.evaluate(()=>({x:scrollX,y:scrollY}));
  for(let top=0,step=0;step<40;step++){
    const height=await page.evaluate(()=>document.documentElement.scrollHeight);
    if(top>=height)break;
    await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),top);await settle();
    top+=Math.max(300,Math.floor((await page.evaluate(()=>innerHeight))*.75));
  }
  await page.evaluate(value=>scrollTo({left:value.x,top:value.y,behavior:'instant'}),position);await settle();
}
async function capture(name,{fullPage=false,locator=null}={}){
  if(fullPage)await loadFullPageImages();
  await settle();
  const path=folder+'/'+name+'.png';
  if(locator)await locator.screenshot({path});else await page.screenshot({path,fullPage});
  screenshots.push(path);
}
async function noOverflow(label){
  await settle();
  const result=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,url:location.pathname}));
  measurements.push({name:label,...result});
  assert.ok(result.document<=result.viewport+1,`${label} document overflow: ${JSON.stringify(result)}`);
}
async function drawerGeometry(label,mobile=false){
  await settle();
  const result=await dialog.evaluate(node=>{
    const rect=element=>{const box=element.getBoundingClientRect();return {x:box.x,y:box.y,width:box.width,height:box.height,bottom:box.bottom};};
    return {drawer:rect(node),main:rect(node.querySelector('.cart-drawer-main')),rail:rect(node.querySelector('.cart-recommendations')),footer:rect(node.querySelector('.cart-drawer-footer')),viewport:{width:innerWidth,height:innerHeight},overflow:getComputedStyle(document.documentElement).overflow};
  });
  measurements.push({name:label,...result});
  assert.ok(Math.abs(result.drawer.width-(mobile?390:670))<=1,JSON.stringify(result));
  assert.ok(Math.abs(result.main.width-(mobile?390:450))<=1,JSON.stringify(result));
  assert.ok(Math.abs(result.rail.width-(mobile?0:220))<=1,JSON.stringify(result));
  assert.ok(result.footer.bottom<=result.viewport.height+1&&result.footer.y>=0,JSON.stringify(result));
  assert.equal(result.overflow,'hidden');
  await noOverflow(label);
}
async function expectTotal(value){await expect(checkout()).toContainText(new Intl.NumberFormat('vi-VN').format(value));}
async function auditDrawer(label){
  await page.addScriptTag({content:axeSource});
  const result=await page.evaluate(async()=>{
    const result=await window.axe.run({include:[['.cart-drawer']]},{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});
    return {violations:result.violations.map(row=>({id:row.id,impact:row.impact,help:row.help,nodes:row.nodes.map(node=>({target:node.target,failureSummary:node.failureSummary}))})),incomplete:result.incomplete.map(row=>({id:row.id,impact:row.impact,help:row.help})),passes:result.passes.length};
  });
  accessibility.push({name:label,...result});
  assert.deepEqual(result.violations,[],`${label}: ${JSON.stringify(result.violations)}`);
}
async function openFromHeader(){await headerCart.click();await expect(dialog).toBeVisible();await settle();}
async function closeByButton(){await dialog.getByRole('button',{name:'Đóng giỏ hàng',exact:true}).click();await expect(dialog).not.toBeVisible();}
async function cartItems(){return page.evaluate(()=>JSON.parse(localStorage.getItem('cohamy-cart')??'{"state":{"items":[]}}').state.items);}
async function focusRefresh(){const received=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/storefront');await page.evaluate(()=>dispatchEvent(new Event('focus')));await received;}
async function emptyCart(){
  while(await dialog.locator('.cart-drawer-remove').count())await dialog.locator('.cart-drawer-remove').first().click();
  await expect(dialog.getByRole('heading',{name:'Giỏ hàng đang trống',exact:true})).toBeVisible();
}

try{
  await fs.mkdir(folder,{recursive:true});
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(production){
      if(!['GET','HEAD','OPTIONS'].includes(request.method())){
        if(url.pathname==='/api/orders')orderSubmissionAttempts++;
        blockedRequests.push({type:'production-write-guard',method:request.method(),origin:url.origin,path:url.pathname});
        return route.abort('blockedbyclient');
      }
      return route.continue();
    }
    if(url.origin!==origin){
      if(url.protocol==='http:'||url.protocol==='https:'){blockedRequests.push({origin:url.origin,path:url.pathname});return route.abort('blockedbyclient');}
      return route.continue();
    }
    if(url.pathname==='/api/orders'&&request.method()!=='GET'){
      orderSubmissionAttempts++;return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'QA_ORDER_SUBMISSION_DISABLED'})});
    }
    try{
      if(url.pathname==='/api/storefront'&&request.method()==='GET'){
        priceReadResponses++;
        if(mockMode==='error')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'QA_MOCK_PRICE_UNAVAILABLE'})});
        if(mockMode==='paused'){
          const quote=await native('GET','/api/storefront');
          return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...quote,intakeEnabled:false})});
        }
      }
      const headers={...request.headers()};delete headers['if-none-match'];delete headers['if-modified-since'];
      const response=await route.fetch({url:base+url.pathname+url.search,maxRedirects:0,headers,maxRetries:request.method()==='GET'?2:0});
      if(url.pathname.endsWith('.css')){const body=await response.body();assets.push({path:url.pathname,status:response.status(),bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')});}
      if(response.status()>=400)browserErrors.push({type:'http',path:url.pathname,status:response.status(),mockMode});
      return route.fulfill({response});
    }catch(error){browserErrors.push({type:'proxy',path:url.pathname,message:String(error).slice(0,200),mockMode});await route.abort().catch(()=>{});}
  });

  activeCase=production?'public production price read without authentication':'isolated staging fixture and native price guard';
  if(!production){
    const login=await context.request.post(base+'/api/crm/auth/login',{headers:{origin},data:{email:qaEmail,password:qaPassword}});
    assert.equal(login.status(),200,'Fictitious isolated QA account must exist before browser actions');
    cookie=login.headers()['set-cookie']?.match(/cohamy_crm_session=([^;]+)/)?.[1];assert.ok(cookie);
    const settings=await native('GET','/api/crm/storefront');originalDiscount=settings.discountPercent;
    assert.equal(originalDiscount,30,'QA stage must begin with the standard30percent fixture');
  }
  const quote=await native('GET','/api/storefront'),item=quote.items.find(row=>row.productId===productId);
  assert.equal(quote.intakeEnabled,true);assert.equal(item.salePrice,unitPrice);assert.equal(item.vatRate,8);
  if(!production){assert.equal(quote.discountPercent,30);assert.equal(item.basePrice,79000);}
  pass(activeCase,{unitPrice,basePrice:item.basePrice,vatRate:item.vatRate,discountPercent:quote.discountPercent});

  activeCase=`desktop card quantity2 opens drawer with${pairTotal}VND VAT total`;
  await page.goto(origin+listingPath);await expect(card).toBeVisible();await card.scrollIntoViewIfNeeded();await card.hover();
  await card.getByRole('spinbutton').fill('2');await expect(card.getByRole('spinbutton')).toHaveValue('2');
  await noOverflow('desktop-product-card');await capture('desktop-card-hover');await capture('desktop-card-hover-crop',{locator:card});
  await cardAdd.click();await expect(dialog).toBeVisible();await expectTotal(pairTotal);await expect(drawerQuantity()).toHaveValue('2');
  await expect(dialog.locator('.cart-drawer-vat')).toHaveText('Tiền hàng đã gồm VAT');
  await drawerGeometry('desktop-drawer-geometry');await capture('desktop-drawer');await auditDrawer('desktop-drawer');pass(activeCase);

  activeCase='native dialog keyboard containment background lock and close focus restoration';
  const before=await page.evaluate(()=>scrollY);
  await page.mouse.move(10,450);await page.mouse.wheel(0,600);await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>scrollY),before,'Background must not scroll while drawer is modal');
  const focusSteps=[];
  for(const direction of ['Tab','Shift+Tab'])for(let index=0;index<30;index++){
    await page.keyboard.press(direction);
    const step=await dialog.evaluate((node,{index,direction})=>({index,direction,inDialog:node.contains(document.activeElement),documentHasFocus:document.hasFocus(),tag:document.activeElement?.tagName,className:document.activeElement?.className,label:document.activeElement?.getAttribute('aria-label'),text:document.activeElement?.textContent?.trim().slice(0,100)}),{index,direction});
    step.nativeDocumentBlur=!step.inDialog&&step.tag==='BODY'&&!step.documentHasFocus;
    focusSteps.push(step);
    if(step.nativeDocumentBlur){
      // Native dialogs can yield focus to user-agent UI. Observe the document
      // blur, permit no background page control, and verify the next same key
      // returns to the modal. Browser-chrome focus is an inference only.
      await page.keyboard.press(direction);
      focusSteps.push(await dialog.evaluate((node,{index,direction})=>({index,direction,recovery:true,inDialog:node.contains(document.activeElement),documentHasFocus:document.hasFocus(),tag:document.activeElement?.tagName,className:document.activeElement?.className,label:document.activeElement?.getAttribute('aria-label'),text:document.activeElement?.textContent?.trim().slice(0,100)}),{index,direction}));
    }
  }
  const nativeDocumentBlurSteps=focusSteps.filter(step=>step.nativeDocumentBlur);
  measurements.push({name:'keyboard-focus-sequence',steps:focusSteps,observation:'BODY with document.hasFocus() false is a document blur; focus entering browser chrome is an inference. The next identical Tab direction must return inside, and no background page control may receive focus.'});
  const escapedSteps=focusSteps.filter(step=>!step.inDialog&&!step.nativeDocumentBlur);
  if(escapedSteps.length){cases.push({name:activeCase,status:'FAIL',error:'Background page control or recovery step escaped dialog',escapedSteps});await capture('keyboard-focus-gap');}
  await dialog.getByRole('button',{name:'Đóng giỏ hàng',exact:true}).focus();await cardAdd.evaluate(node=>node.focus());
  assert.ok(await dialog.evaluate(node=>node.contains(document.activeElement)),'Modal background control must remain inert to focus attempts');
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(cardAdd).toBeFocused();
  assert.notEqual(await page.evaluate(()=>getComputedStyle(document.documentElement).overflow),'hidden');
  await openFromHeader();await closeByButton();await expect(headerCart).toBeFocused();
  await openFromHeader();await page.mouse.click(10,450);await expect(dialog).not.toBeVisible();await expect(headerCart).toBeFocused();
  if(!escapedSteps.length)pass(activeCase,{tabSteps:60,nativeDocumentBlurSteps:nativeDocumentBlurSteps.length,backgroundFocusAttempts:1,closeMethods:['Escape','close button','backdrop']});
  else pass('Escape close button and backdrop restore focus and background scrolling',{closeMethods:['Escape','close button','backdrop']});

  activeCase='drawer stepper increment decrement and inclusive1to100bounds';
  await openFromHeader();
  const quantityGroup=dialog.getByRole('group',{name:'Số lượng: '+productName,exact:true});
  await quantityGroup.getByRole('button',{name:/^Tăng /}).click();await expect(drawerQuantity()).toHaveValue('3');await expectTotal(unitPrice*3);
  await quantityGroup.getByRole('button',{name:/^Giảm /}).click();await expect(drawerQuantity()).toHaveValue('2');
  await drawerQuantity().fill('0');await drawerQuantity().blur();await expect(drawerQuantity()).toHaveValue('1');await expect(quantityGroup.getByRole('button',{name:/^Giảm /})).toBeDisabled();
  await drawerQuantity().fill('101');await drawerQuantity().blur();await expect(drawerQuantity()).toHaveValue('100');await expect(quantityGroup.getByRole('button',{name:/^Tăng /})).toBeDisabled();
  await expectTotal(unitPrice*100);await drawerQuantity().fill('2');await drawerQuantity().blur();pass(activeCase);

  activeCase='recommendation adds product and updates total and header count';
  await dialog.locator('.cart-recommendations .cart-suggestion button').first().click();
  await expect(dialog.locator('.cart-drawer-item')).toHaveCount(2);
  const recommendedItem=(await cartItems()).find(item=>item.productId!==productId),recommendationQuote=(await native('GET','/api/storefront')).items.find(item=>item.productId===recommendedItem.productId);
  assert.equal(recommendedItem.quantity,1);assert.equal(recommendedItem.price,recommendationQuote.salePrice);await expectTotal(pairTotal+recommendationQuote.salePrice);
  await closeByButton();await expect(headerCart.locator('.cart-header-count')).toHaveText('3');await openFromHeader();
  pass(activeCase);

  activeCase='removing all items shows empty cart and removes checkout';
  await emptyCart();await expect(checkout()).toHaveCount(0);assert.equal((await cartItems()).length,0);
  await capture('desktop-drawer-empty');pass(activeCase);await closeByButton();

  activeCase='cart persists after reload while presentation drawer remains closed';
  await card.hover();await cardAdd.click();await expectTotal(pairTotal);await page.reload();await settle();
  await expect(dialog).not.toBeVisible();await expect(headerCart.locator('.cart-header-count')).toHaveText('2');
  await openFromHeader();await expectTotal(pairTotal);assert.equal((await cartItems())[0].quantity,2);pass(activeCase);

  activeCase='checkout navigation closes drawer and retains matching VAT total without order submission';
  await checkout().click();await expect(page).toHaveURL(/\/vi\/thanh-toan$/);await expect(dialog).not.toBeVisible();
  await expect(page.getByText(new Intl.NumberFormat('vi-VN').format(pairTotal),{exact:false}).first()).toBeVisible();await expect(page.locator('input[name="policyConsent"]')).not.toBeChecked();
  await noOverflow('desktop-checkout');await capture('desktop-checkout');assert.equal(orderSubmissionAttempts,0);pass(activeCase);

  if(!production){
  activeCase='real price update requires explicit acceptance and existing add preserves old price snapshot';
  await page.goto(origin+listingPath);await openFromHeader();await discount(25);await focusRefresh();
  const changedItem=(await native('GET','/api/storefront')).items.find(row=>row.productId===productId);assert.equal(changedItem.salePrice,63990);
  await expect(dialog.getByRole('button',{name:'Cập nhật theo giá mới',exact:true})).toBeVisible();await expect(checkout()).toBeDisabled();await expectTotal(127980);
  assert.equal((await cartItems())[0].price,59724);await capture('desktop-drawer-price-changed');
  await closeByButton();await card.scrollIntoViewIfNeeded();await card.hover();await card.getByRole('spinbutton').fill('1');await cardAdd.click();
  assert.equal((await cartItems())[0].price,59724,'Adding an existing product must not silently accept a new price');
  await expect(drawerQuantity()).toHaveValue('3');await expect(checkout()).toBeDisabled();await expectTotal(191970);
  await dialog.getByRole('button',{name:'Cập nhật theo giá mới',exact:true}).click();await expect(checkout()).toHaveAttribute('href','/vi/thanh-toan');assert.equal((await cartItems())[0].price,63990);
  await discount(30);await focusRefresh();await expect(checkout()).toBeDisabled();await dialog.getByRole('button',{name:'Cập nhật theo giá mới',exact:true}).click();
  await drawerQuantity().fill('2');await drawerQuantity().blur();await expectTotal(119448);pass(activeCase,{nativeDiscounts:[30,25,30]});

  activeCase='mocked public price error disables checkout and retry restores real quote';
  mockMode='error';await focusRefresh();await expect(dialog.getByText('Chưa lấy được giá bán. Vui lòng tải lại giá hoặc liên hệ Cohamy.',{exact:true})).toBeVisible();await expect(checkout()).toBeDisabled();
  await capture('desktop-drawer-price-error-mocked');mockMode=null;
  await dialog.getByRole('button',{name:'Tải lại giá',exact:true}).click();await expect(checkout()).toHaveAttribute('href','/vi/thanh-toan');await expectTotal(119448);pass(activeCase,{mocked:true,scope:'GET /api/storefront only'});

  activeCase='mocked intake pause disables checkout without changing native settings';
  mockMode='paused';await focusRefresh();await expect(dialog.getByText('Website đang tạm ngừng nhận yêu cầu đặt hàng. Vui lòng liên hệ Cohamy.',{exact:true})).toBeVisible();await expect(checkout()).toBeDisabled();
  await capture('desktop-drawer-intake-paused-mocked');assert.equal((await native('GET','/api/storefront')).intakeEnabled,true);
  mockMode=null;await focusRefresh();await expect(checkout()).toHaveAttribute('href','/vi/thanh-toan');pass(activeCase,{mocked:true,scope:'GET /api/storefront only'});
  }else{
    await page.goto(origin+listingPath);await openFromHeader();
  }

  activeCase='mobile390card drawer footer and checkout remain usable without horizontal overflow';
  await closeByButton();await page.setViewportSize({width:390,height:844});await page.goto(origin+listingPath);await card.scrollIntoViewIfNeeded();
  await noOverflow('mobile-product-card');await capture('mobile-card');await capture('mobile-card-crop',{locator:card});
  await openFromHeader();await drawerGeometry('mobile-drawer-geometry',true);await expectTotal(pairTotal);await capture('mobile-drawer');await auditDrawer('mobile-drawer');
  const mobileRecommendation=dialog.locator('.cart-mobile-recommendations');await mobileRecommendation.scrollIntoViewIfNeeded();await settle();await capture('mobile-drawer-recommendations');
  await checkout().click();await expect(page).toHaveURL(/\/vi\/thanh-toan$/);await expect(dialog).not.toBeVisible();await expect(page.getByText(new Intl.NumberFormat('vi-VN').format(pairTotal),{exact:false}).first()).toBeVisible();
  await noOverflow('mobile-checkout');await capture('mobile-checkout-full',{fullPage:true});
  await page.goto(origin+productPath);await noOverflow('mobile-product-detail');await capture('mobile-product-detail-full',{fullPage:true});
  await page.locator('footer').last().scrollIntoViewIfNeeded();await settle();await capture('mobile-site-footer',{locator:page.locator('footer').last()});
  pass(activeCase,{viewport:{width:390,height:844}});

  activeCase='product detail buy now retains checkout journey';
  await page.getByRole('spinbutton',{name:'Số lượng',exact:true}).fill('1');await page.getByRole('button',{name:'Mua ngay',exact:true}).first().click();
  await expect(page).toHaveURL(/\/vi\/thanh-toan$/);await expect(dialog).not.toBeVisible();assert.equal((await cartItems())[0].quantity,3);pass(activeCase);

  activeCase='browser runtime safety and visible asset checks';
  await Promise.allSettled(pendingAssetReads);
  assert.equal(orderSubmissionAttempts,0);assert.equal(blockedRequests.length,0,JSON.stringify(blockedRequests));
  const critical=browserErrors.filter(error=>!error.expectedMock);assert.deepEqual(critical,[],JSON.stringify(critical));
  assert.ok(priceReadResponses>0);assert.ok(assets.length>0);pass(activeCase,{priceReadResponses,orderSubmissionAttempts,unmockedBrowserErrors:critical.length});
  complete=!cases.some(row=>row.status==='FAIL');if(!complete)process.exitCode=1;
}catch(error){
  cases.push({name:activeCase,status:'FAIL',error:failure(error)});console.error(failure(error));process.exitCode=1;
  await capture('failure').catch(()=>{});
}finally{
  mockMode=null;
  if(cookie){
    try{await discount(originalDiscount??30);restoredDiscount=(await native('GET','/api/crm/storefront')).discountPercent===(originalDiscount??30);assert.equal(restoredDiscount,true,'Staging discount restoration must be verified');}catch(error){cases.push({name:'restore staging discount',status:'FAIL',error:failure(error)});complete=false;process.exitCode=1;}
    await context.request.post(base+'/api/crm/auth/logout',{headers:{origin,cookie:'cohamy_crm_session='+cookie}}).catch(()=>{});
  }
  await browser.close();await fs.mkdir(folder,{recursive:true});
  const report={status:complete?'PASS':'FAIL',environment:production?'PRODUCTION direct https://cohamy.vn public reads and local browser cart only; no Admin login, writes, order submission or GET mocks; service workers blocked':'STAGING isolated PostgreSQL production build; fixed local tunnel4369; real-origin routing; service workers blocked',testedAt:new Date().toISOString(),cases,screenshots,measurements,accessibility,assets,browserErrors,blockedRequests,restoredDiscount:production?null:restoredDiscount,externalEmails:0,productionWrites:0,orderSubmissionAttempts,ordersCreated:0,mockedRequests:production?0:'GET /api/storefront error and intake states only',visualBaseline:'INCONCLUSIVE for automated pixel regression: no Cohamy golden image. Visual review separately uses the user-pinned Maison Marou reference screenshots; current screenshots and measured widths support that review.',accessibilityScope:'Drawer-scoped axe WCAG2A/AA/2.1AA/2.2AA plus native dialog keyboard containment, Escape, labels and focus restoration. Document blur to browser UI is inferred, verified to return inside on next Tab; no background control can receive focus. No screen-reader audit or exhaustive WCAG claim.',mcp:'Not invoked by this browser suite. Existing server pricing/settings coverage is verified separately. Anonymous unsent cart and drawer presentation are browser-local and are not readable through remote MCP.'};
  await fs.writeFile(folder+(production?'/browser-production.json':'/browser-staging.json'),JSON.stringify(report,null,2)+'\n');
}
