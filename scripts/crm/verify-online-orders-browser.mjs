import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {chromium,expect} from '@playwright/test';

const production=process.argv.includes('--production'),origin='https://cohamy.vn',base=production?origin:'http://localhost:4371';
const recaptureWarehouse=process.argv.includes('--recapture-warehouse');
const captureLists=process.argv.includes('--capture-lists');
assert.ok(!production||!recaptureWarehouse&&!captureLists,'Evidence recapture uses isolated staging only');
const output='docs/crm/test-results/online-orders',mode=production?'production':'staging',shots=`${output}/browser-${mode}`;
const modulePath='/crm/online-customers',password='Local-QA-Only-2026!',productPath='/vi/san-pham/cohamy-socola-hat-dieu-80g';
const recipients=['kangminamhd@gmail.com','nguyenptkthd@gmail.com'];
const require=createRequire(import.meta.url),axe=await fs.readFile(require.resolve('axe-core/axe.min.js'),'utf8');
const cases=[],screenshots=[],measurements=[],accessibility=[],errors=[],expectedEvents=[],blockedRequests=[],notes=[],contexts=[],pendingRoutes=new Set();
let phase='initialization',complete=false,publicPayload=null,receipt=null,orderId=null,dropNext=null,dropDone=null,dispatchBodies=[];
let browser,admin,publicBuyer,liveHasOrders=false,droppedResponse=false,privacyValues=[],lastRouteActivity=Date.now();
const textMoney=value=>BigInt(value).toLocaleString('vi-VN')+' đ';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const pass=(name,details={})=>{cases.push({name,status:'PASS',...details});console.log('PASS '+name);};
const failure=error=>{let result=String(error?.stack??error).replaceAll(password,'[QA PASSWORD]');for(const value of privacyValues)if(typeof value==='string'&&value.length>2)result=result.replaceAll(value,'[REDACTED]');return result;};
const safePath=value=>production?value.replace(/\/online-orders\/[0-9a-f-]{36}/gi,'/online-orders/[id]'):value;

async function session(name,{stateFile}={}){
 const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',reducedMotion:'reduce',...(stateFile?{storageState:stateFile}:{})});
 const page=await context.newPage(),state={context,page,name,expectedPaths:new Map(),expectedTransport:new Set()};contexts.push(state);page.setDefaultTimeout(30000);
 page.on('console',message=>{if(message.type()!=='error')return;const path=new URL(message.location().url||origin).pathname;const expected=state.expectedPaths.has(path)||state.expectedTransport.has(path);(expected?expectedEvents:errors).push({type:'console',actor:name,path:safePath(path),message:message.text(),phase});});
 page.on('pageerror',error=>errors.push({type:'pageerror',actor:name,message:error.message,phase}));
 page.on('requestfailed',request=>{if(request.failure()?.errorText==='net::ERR_ABORTED')return;const url=new URL(request.url());if(url.origin!==origin)return;const expected=state.expectedTransport.has(url.pathname);(expected?expectedEvents:errors).push({type:'requestfailed',actor:name,path:safePath(url.pathname),message:request.failure()?.errorText,phase});});
 page.on('response',response=>{const url=new URL(response.url());if(url.origin!==origin||response.status()<400)return;const expected=state.expectedPaths.get(url.pathname)?.includes(response.status());(expected?expectedEvents:errors).push({type:'http',actor:name,path:safePath(url.pathname),status:response.status(),phase});});
 await context.route('**/*',route=>{
  const task=(async()=>{
   const request=route.request(),url=new URL(request.url());lastRouteActivity=Date.now();
   if(url.origin!==origin){if(['http:','https:'].includes(url.protocol)){blockedRequests.push({type:'external',origin:url.origin,path:url.pathname});return route.abort('blockedbyclient');}return route.continue();}
   const write=!['GET','HEAD','OPTIONS'].includes(request.method());
   if(production){if(write){blockedRequests.push({type:'production-write',path:safePath(url.pathname),method:request.method()});return route.abort('blockedbyclient');}return route.continue();}
   const auth=['/api/crm/auth/login','/api/crm/auth/logout'].includes(url.pathname);
   const intake=url.pathname==='/api/orders'&&name==='public-buyer';
   const action=orderId&&new RegExp('^/api/crm/online-orders/'+orderId+'/(dispatch|accept)$').test(url.pathname);
   if(write&&!auth&&!intake&&!action){blockedRequests.push({type:'unexpected-stage-write',path:url.pathname,method:request.method()});return route.abort('blockedbyclient');}
   const headers={...request.headers()};delete headers['if-none-match'];delete headers['if-modified-since'];
   try{
    const response=await route.fetch({url:base+url.pathname+url.search,headers,maxRedirects:0,maxRetries:write?0:1});
    if(intake&&request.method()==='POST'){publicPayload=request.postDataJSON();if(response.status()===201)receipt=await response.json();}
    if(action&&url.pathname.endsWith('/dispatch'))dispatchBodies.push(request.postDataJSON());
    if(dropNext===url.pathname&&response.status()===200){droppedResponse=true;dropNext=null;state.expectedTransport.add(url.pathname);dropDone?.resolve({status:response.status(),result:await response.json()});return route.abort('failed');}
    return route.fulfill({response});
   }catch(error){const expected=state.expectedTransport.has(url.pathname);(expected?expectedEvents:errors).push({type:'proxy',actor:name,path:url.pathname,message:failure(error),phase});await route.abort('failed').catch(()=>{});}
  })();pendingRoutes.add(task);task.finally(()=>{pendingRoutes.delete(task);lastRouteActivity=Date.now();}).catch(()=>{});return task;
 });
 return state;
}

async function native(actor,method,path,data,expected=200){
 assert.ok(path.startsWith('/api/'),'Only native API paths');
 if(production)assert.ok(method==='GET'&&path.startsWith('/api/crm/online-orders'),'Production native calls are online-order reads only');
 const cookies=await actor.context.cookies(origin),cookie=cookies.filter(value=>value.name==='cohamy_crm_session').map(value=>value.name+'='+value.value).join('; ');
 const response=await actor.context.request.fetch(base+path,{method,headers:{origin,...(cookie?{cookie}:{})},...(data?{data}:{})});
 assert.ok((Array.isArray(expected)?expected:[expected]).includes(response.status()),`${method} ${safePath(path)} returned unexpected HTTP ${response.status()}`);
 return response.status()===204?null:response.json();
}
async function settle(page){
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('link[rel="stylesheet"]')).every(link=>link.sheet));await page.evaluate(()=>document.fonts.ready);
 await page.waitForFunction(()=>Array.from(document.images).filter(image=>{const r=image.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0;}).every(image=>image.complete&&image.naturalWidth>0));
}
async function noOverflow(page,label){const result=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth}));measurements.push({label,...result});assert.ok(result.documentWidth<=result.width+1&&result.bodyWidth<=result.width+1,'Document overflow at '+label);}
async function capture(actor,label,{fullPage=false,selector}={}){
 await actor.page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();window.scrollTo({top:0,left:0,behavior:'instant'});});
 await actor.page.waitForFunction(()=>window.scrollY===0);
 await settle(actor.page);await noOverflow(actor.page,label);const file=`${shots}/${label}.png`;
 if(selector)await actor.page.locator(selector).screenshot({path:file,animations:'disabled'});else await actor.page.screenshot({path:file,fullPage,animations:'disabled'});
 screenshots.push(file);
}
async function audit(actor,label,selector){await actor.page.addScriptTag({content:axe});const result=await actor.page.evaluate(async selector=>{const r=await window.axe.run(document.querySelector(selector),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return {violations:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})),incomplete:r.incomplete.map(v=>v.id),passes:r.passes.length};},selector);accessibility.push({label,...result});assert.equal(result.violations.length,0,'Axe violations at '+label);}
async function login(name,email,area='crm'){
 assert.equal(production,false,'No production password login');const actor=await session(name);await actor.page.goto(origin+`/${area}/login`);await actor.page.locator('[name=email]').fill(email);await actor.page.locator('[name=password]').fill(password);
 await Promise.all([actor.page.waitForURL(url=>!url.pathname.endsWith('/login')),actor.page.getByRole('button',{name:'Đăng nhập',exact:true}).click()]);return actor;
}
async function list(actor,query=''){await actor.page.goto(origin+modulePath+(query?'?q='+encodeURIComponent(query):''));await expect(actor.page.locator('[data-online-orders-page]')).toBeVisible();await settle(actor.page);}
const detailSelector=()=>`[data-online-order-detail="${orderId}"]`;
const handover=actor=>actor.page.locator('.work-section').filter({has:actor.page.getByRole('heading',{name:'Điều phối về kho',exact:true})});
async function detail(actor){await actor.page.goto(origin+modulePath+'/'+orderId);await expect(actor.page.locator(detailSelector())).toBeVisible();await settle(actor.page);}
async function submit(actor,action,warehouseId,reason,expected=200){
 const path=`/api/crm/online-orders/${orderId}/${action}`,form=actor.page.locator(action==='dispatch'?'[data-online-dispatch-form]':'[data-online-accept-form]');
 if(warehouseId)await form.locator('[name=warehouseId]').selectOption(warehouseId);await form.locator('[name=reason]').fill(reason);
 if(expected!==200)actor.expectedPaths.set(path,[expected]);
 const responsePromise=actor.page.waitForResponse(response=>new URL(response.url()).pathname===path&&response.request().method()==='POST');await form.getByRole('button',{name:action==='accept'?'Tiếp nhận đơn tại kho':/Điều phối/}).click();const response=await responsePromise;assert.equal(response.status(),expected);return response.json();
}
async function denyPage(actor,path){actor.expectedPaths.set(path,[403,404]);const response=await actor.page.goto(origin+path);assert.ok([200,403,404].includes(response.status()),'Unexpected forbidden UI response');await expect(actor.page.locator('[data-online-orders-page], [data-online-order-detail]')).toHaveCount(0);if(response.status()===200){await expect(actor.page.getByRole('heading',{name:/404|Không tìm thấy|Trang không tồn tại/i}).first()).toBeVisible();notes.push('Next.js streamed not-found response verified by absent module and not-found heading; native API denial verified separately.');}}
async function drain(){const started=Date.now();while(Date.now()-started<20000){await Promise.allSettled([...pendingRoutes]);if(pendingRoutes.size===0&&Date.now()-lastRouteActivity>=1000)return {milliseconds:Date.now()-started,pending:0,quietMs:1000};await pause(100);}throw new Error('Route handler drain did not settle');}

let teardown=null;
try{
 await fs.mkdir(shots,{recursive:true});browser=await chromium.launch({channel:'msedge',headless:true});
 if(captureLists){
  phase='list readability confirmation';admin=await login('capture-admin','admin@crm-qa.invalid');
  const data=await native(admin,'GET','/api/crm/online-orders?q='+encodeURIComponent('QA Online Browser'));assert.ok(data.items.length,'Existing fictitious browser order required');
  for(const [width,label] of [[1366,'admin-list-desktop'],[390,'admin-list-mobile'],[320,'admin-list-narrow']]){
   await admin.page.setViewportSize({width,height:width===1366?900:844});await list(admin,data.items[0].code);
   const region=admin.page.getByRole('region',{name:'Danh sách đơn bán online',exact:true});
   const sizing=await region.evaluate(element=>{const table=element.querySelector('table'),cells=Array.from(table.querySelectorAll('tbody tr:first-child td'));const code=cells[0].querySelector('a');return {regionWidth:element.clientWidth,scrollWidth:element.scrollWidth,tableLayout:getComputedStyle(table).tableLayout,columnWidths:cells.map(cell=>cell.getBoundingClientRect().width),codeHeight:code.getBoundingClientRect().height,codeLineHeight:parseFloat(getComputedStyle(code).lineHeight),codeWhiteSpace:getComputedStyle(code).whiteSpace};});
   measurements.push({label,...sizing});assert.equal(sizing.tableLayout,'fixed');assert.ok(sizing.columnWidths[0]>=175&&sizing.columnWidths[1]>=220&&sizing.columnWidths[9]>=90);assert.equal(sizing.codeWhiteSpace,'nowrap');assert.ok(sizing.codeHeight<=sizing.codeLineHeight+2,'Order ID fragmented across lines');
   await region.evaluate(element=>element.scrollLeft=0);await capture(admin,label,{fullPage:true});
   await region.evaluate(element=>element.scrollLeft=element.scrollWidth);await capture(admin,label+'-right',{fullPage:true});
  }
  notes.push('One scoped confirmation batch for list-column fix, left/right local-scroll evidence at three widths; no business mutation.');pass('Explicit list columns retain readable IDs/status/action text and local scrolling at1366/390/320');
 }else if(recaptureWarehouse){
  phase='neutral warehouse mobile evidence recapture';admin=await login('recapture-admin','admin@crm-qa.invalid');
  const listData=await native(admin,'GET','/api/crm/online-orders?q='+encodeURIComponent('QA Online Browser'));
  const selected=listData.items.find(row=>row.dispatch.warehouseCode==='QA_ONLINE_HCM'&&row.dispatch.status==='ACCEPTED');assert.ok(selected,'No existing fictitious accepted southern browser order');orderId=selected.id;
  const hcm=await login('recapture-south','online-hcm@crm-qa.invalid');await detail(hcm);await hcm.page.setViewportSize({width:390,height:844});
  await capture(hcm,'warehouse-detail-mobile',{fullPage:true});notes.push('Required warehouse mobile evidence recaptured at scroll zero and neutral focus; no application or business data change.');pass('Warehouse mobile full-page capture has neutral focus and header at top');
 }else if(production){
  phase='production secure authenticated read-only setup';const stateFile=process.env.CRM_BROWSER_AUTH_STATE_FILE;assert.ok(stateFile,'CRM_BROWSER_AUTH_STATE_FILE is required');const state=JSON.parse(await fs.readFile(stateFile,'utf8'));assert.ok(state.cookies?.some(c=>c.name==='cohamy_crm_session'&&/cohamy\.vn$/.test(c.domain)),'Secure state lacks CRM session');
  admin=await session('production-admin',{stateFile});const data=await native(admin,'GET','/api/crm/online-orders');assert.equal(data.canDispatch,true);assert.ok(Array.isArray(data.items)&&data.items.length<=20&&typeof data.total==='number');liveHasOrders=data.items.length>0;
  if(liveHasOrders){const row=data.items[0];privacyValues=Object.values(row.contact??{}).filter(v=>typeof v==='string');const selected=await native(admin,'GET','/api/crm/online-orders/'+row.id);assert.ok(selected.order&&Array.isArray(selected.order.lines)&&Array.isArray(selected.history.items)&&Array.isArray(selected.mailJobs.items));}
  pass('Production Admin API reads actual paginated data without exposing customer values',{hasLiveOrders:liveHasOrders});
  const q='READONLY-NOMATCH-'+randomUUID();await list(admin,q);await expect(admin.page.locator('[data-online-orders-page]')).toContainText('Chưa có đơn online phù hợp');assert.equal((await native(admin,'GET','/api/crm/online-orders?q='+encodeURIComponent(q))).total,0);
  await expect(admin.page.locator('.crm-sidebar a[href="/crm/online-customers"]').filter({visible:true})).toHaveCount(1);await capture(admin,'admin-empty-filter-desktop',{selector:'[data-online-orders-page]'});await audit(admin,'production-admin-desktop','[data-online-orders-page]');pass('Production sidebar and real no-match filter render Admin module with zero customer PII');
  await admin.page.setViewportSize({width:390,height:844});await capture(admin,'admin-empty-filter-mobile',{selector:'[data-online-orders-page]'});await audit(admin,'production-admin-mobile','[data-online-orders-page]');await admin.page.setViewportSize({width:320,height:844});await capture(admin,'admin-empty-filter-narrow',{selector:'[data-online-orders-page]'});pass('Production390and320 screens keep document within viewport');
  notes.push('Production screenshots use an actual unique empty search filter, not hidden or fabricated rows. Live contact/code/address values are retained only in memory. Rich detail, actions, warehouse scope and queued email were exercised only in isolated staging.');
 }else{
  phase='staging fixture safety preflight';admin=await login('admin','admin@crm-qa.invalid');const initial=await native(admin,'GET','/api/crm/online-orders');const north=initial.warehouses.find(w=>w.code==='QA_ONLINE_HN'),south=initial.warehouses.find(w=>w.code==='QA_ONLINE_HCM');assert.ok(north&&south,'QA warehouse fixture required before any public order write');pass('Authenticated fictitious Admin and both QA warehouses confirm isolated staging');
  phase='actual public checkout';publicBuyer=await session('public-buyer');await publicBuyer.page.goto(origin+productPath);await publicBuyer.page.getByRole('spinbutton',{name:'Số lượng',exact:true}).fill('2');await publicBuyer.page.getByRole('button',{name:'Mua ngay',exact:true}).click();await expect(publicBuyer.page).toHaveURL(/\/vi\/thanh-toan$/);
  const contact={fullName:'QA Online Browser '+randomUUID().slice(0,8),email:'online-browser-'+randomUUID()+'@crm-qa.invalid',phone:'0900000022',address:'Địa chỉ giao hàng hư cấu QA',city:'Thành phố QA',district:'Quận QA',ward:'Phường QA',note:'Đơn kiểm thử riêng, không giao hàng hoặc gửi email thật.'};
  for(const [key,value] of Object.entries(contact))await publicBuyer.page.locator(`[name="${key}"]`).fill(value);await publicBuyer.page.locator('[name=policyConsent]').check();await publicBuyer.page.getByRole('button',{name:'Gửi yêu cầu',exact:true}).click();await expect.poll(()=>receipt?.code).toBeTruthy();assert.ok(publicPayload&&receipt.paid===false);
  const replay=await native(publicBuyer,'POST','/api/orders',publicPayload,201);assert.equal(replay.code,receipt.code);const found=await native(admin,'GET','/api/crm/online-orders?q='+receipt.code);assert.equal(found.total,1);orderId=found.items[0].id;let current=await native(admin,'GET','/api/crm/online-orders/'+orderId);const frozen=JSON.stringify({contact:current.order.contact,lines:current.order.lines,subtotal:current.order.subtotal,payment:current.order.paymentRequested,paid:current.order.paid});
  assert.equal(current.mailJobs.total,1);assert.deepEqual(current.mailJobs.items[0].recipients,{to:recipients,cc:[],bcc:[]});assert.equal(current.mailJobs.items[0].status,'PENDING');assert.equal(current.mailJobs.items[0].attempts,0);pass('Public checkout and exact retry create one order and one queued two-recipient email',{fictitious:true,unitQuantity:2});
  phase='Admin list and detail';await list(admin);await admin.page.getByRole('textbox',{name:'Tìm đơn / khách hàng'}).fill(receipt.code);await admin.page.getByRole('button',{name:'Lọc đơn',exact:true}).click();await expect(admin.page).toHaveURL(new RegExp('q='+receipt.code));await expect(admin.page.locator('tbody tr')).toHaveCount(1);await capture(admin,'admin-list-desktop');await audit(admin,'admin-list-desktop','[data-online-orders-page]');
  await admin.page.getByRole('link',{name:receipt.code,exact:true}).click();await expect(admin.page.locator(detailSelector())).toBeVisible();await expect(admin.page.locator(detailSelector())).toContainText(contact.fullName);await expect(admin.page.locator(detailSelector())).toContainText(contact.address);await expect(admin.page.locator(detailSelector())).toContainText(textMoney(current.order.subtotal));await capture(admin,'admin-detail-desktop',{fullPage:true});await audit(admin,'admin-detail-desktop',detailSelector());pass('Admin navigation, search, frozen amounts, customer details and product images render');
  phase='Admin dispatch north';await submit(admin,'dispatch',north.id,'QA điều phối về kho miền Bắc');await expect(handover(admin).locator('dl dd').nth(1)).toHaveText(north.name);current=await native(admin,'GET','/api/crm/online-orders/'+orderId);assert.equal(current.order.dispatch.status,'ASSIGNED');assert.equal(current.history.total,1);
  const hn=await login('warehouse-hn','online-hn@crm-qa.invalid'),hcm=await login('warehouse-hcm','online-hcm@crm-qa.invalid');await list(hn,receipt.code);await expect(hn.page.locator('tbody tr')).toHaveCount(1);await expect(hn.page.locator('.crm-sidebar a[href="/crm/online-customers"]').filter({visible:true})).toHaveCount(1);await detail(hn);await expect(hn.page.getByRole('heading',{name:'Thông báo email đơn mới'})).toHaveCount(0);await capture(hn,'warehouse-hn-assigned-desktop');
  await list(hcm,receipt.code);await expect(hcm.page.locator('[data-online-orders-page]')).toContainText('Chưa có đơn online phù hợp');await native(hcm,'GET','/api/crm/online-orders/'+orderId,undefined,404);await denyPage(hcm,modulePath+'/'+orderId);pass('Only the assigned northern warehouse sees the order; southern warehouse is denied');
  phase='warehouse north accepts';await submit(hn,'accept',null,'QA kho Hà Nội tiếp nhận thông tin');await expect(handover(hn).getByText('Kho đã tiếp nhận',{exact:true})).toBeVisible();current=await native(admin,'GET','/api/crm/online-orders/'+orderId);assert.equal(current.history.total,2);assert.equal(current.order.dispatch.status,'ACCEPTED');
  phase='stale Admin view';await submit(admin,'dispatch',south.id,'QA thử ghi từ phiên dữ liệu cũ',409);await expect(admin.page.locator('[data-online-dispatch-form]').getByRole('alert')).toContainText('Đơn vừa được cập nhật');await admin.page.getByRole('button',{name:'Tải lại dữ liệu',exact:true}).click();await expect(handover(admin).getByText('Kho đã tiếp nhận',{exact:true})).toBeVisible();admin.expectedPaths.delete(`/api/crm/online-orders/${orderId}/dispatch`);pass('Warehouse acceptance updates native state and stale Admin form requires reload');
  phase='lost response and exact retry';const form=admin.page.locator('[data-online-dispatch-form]');await form.locator('[name=warehouseId]').selectOption(south.id);await form.locator('[name=reason]').fill('QA điều phối lại về kho miền Nam');const dropping=`/api/crm/online-orders/${orderId}/dispatch`;dropNext=dropping;let resolveDrop;const dropped=new Promise(resolve=>{resolveDrop=resolve;});dropDone={resolve:resolveDrop};await form.getByRole('button',{name:'Điều phối lại về kho',exact:true}).click();await Promise.race([dropped,pause(30000).then(()=>{throw new Error('Dropped-response forward did not finish');})]);await expect(admin.page.locator('[data-online-dispatch-form]').getByRole('alert')).toContainText('Chưa nhận được kết quả');const firstBody=dispatchBodies.at(-1);await form.getByRole('button',{name:'Điều phối lại về kho',exact:true}).click();await expect(handover(admin).locator('dl dd').nth(1)).toHaveText(south.name);assert.deepEqual(dispatchBodies.at(-1),firstBody);admin.expectedTransport.delete(dropping);current=await native(admin,'GET','/api/crm/online-orders/'+orderId);assert.equal(current.history.total,3);assert.equal(current.order.dispatch.status,'ASSIGNED');pass('Lost actual POST response retries identical key/body with one reassignment history record');
  phase='warehouse scope moves south';await native(hn,'GET','/api/crm/online-orders/'+orderId,undefined,404);await list(hn,receipt.code);await expect(hn.page.locator('[data-online-orders-page]')).toContainText('Chưa có đơn online phù hợp');await detail(hcm);await submit(hcm,'accept',null,'QA kho Hồ Chí Minh tiếp nhận');await expect(handover(hcm).getByText('Kho đã tiếp nhận',{exact:true})).toBeVisible();await capture(hcm,'warehouse-hcm-accepted-desktop');current=await native(admin,'GET','/api/crm/online-orders/'+orderId);assert.equal(current.history.total,4);assert.equal(JSON.stringify({contact:current.order.contact,lines:current.order.lines,subtotal:current.order.subtotal,payment:current.order.paymentRequested,paid:current.order.paid}),frozen);assert.equal(current.order.linkedSalesOrder,null);assert.equal(current.mailJobs.total,1);pass('Reassignment removes northern access and southern acceptance preserves frozen intake and unpaid state');
  phase='other role denials';for(const [name,email,area] of [['sales','sales@crm-qa.invalid','crm'],['manager','online-manager@crm-qa.invalid','crm'],['accountant','accountant@crm-qa.invalid','crm'],['portal','a@crm-qa.invalid','portal']]){const actor=await login(name,email,area);await native(actor,'GET','/api/crm/online-orders',undefined,403);await denyPage(actor,`/${area}/online-customers`);}pass('Sales, Manager, Accountant and portal roles cannot open or read the Admin/warehouse inbox');
  phase='responsive and keyboard';await detail(admin);await admin.page.setViewportSize({width:390,height:844});await capture(admin,'admin-detail-mobile',{fullPage:true});await audit(admin,'admin-detail-mobile',detailSelector());await list(admin,receipt.code);await capture(admin,'admin-list-mobile',{fullPage:true});await admin.page.getByRole('textbox',{name:'Tìm đơn / khách hàng'}).focus();await admin.page.keyboard.press('Tab');await expect(admin.page.locator('[name=dispatchStatus]')).toBeFocused();await admin.page.setViewportSize({width:320,height:844});await capture(admin,'admin-list-narrow',{fullPage:true});await hcm.page.setViewportSize({width:390,height:844});await capture(hcm,'warehouse-detail-mobile',{fullPage:true});pass('Desktop1366andmobile390/320 keep the document within viewport with usable table scrolling and keyboard filters');
 }
 phase='teardown';teardown=await drain();await browser.close();browser=null;assert.equal(errors.length,0,'Unexpected first-party browser errors');assert.equal(blockedRequests.filter(r=>r.type!=='external').length,0,'Unexpected write requests');complete=true;pass('Route handling settles and final first-party errors/write guards remain clear');
}catch(error){cases.push({name:phase,status:'FAIL',error:failure(error)});console.error('FAIL '+phase+' '+failure(error));process.exitCode=1;}
finally{
 if(browser){try{await drain();await browser.close();}catch(error){errors.push({type:'teardown',message:failure(error)});}}
 await fs.mkdir(output,{recursive:true});
 const report={status:complete?'PASS':'FAIL',environment:production?'PRODUCTION direct HTTPS authenticated reads only; unique empty-filter screenshots contain no customer PII':'STAGING isolated PostgreSQL via fixed localhost4371→VPS4335; fictitious contacts only; no worker or external emails',testedAt:new Date().toISOString(),cases,screenshots,measurements,accessibility,errors,expectedEvents,blockedRequests,teardown,notes,productionWrites:0,realEmailsSent:0,productionOrderSubmissions:0,stageOrderCreated:production?0:receipt?1:0,stageDroppedResponse:droppedResponse,liveOrderAvailableForReadOnlyShapeCheck:production?liveHasOrders:null,mcp:'Not invoked in browser suite. Parent verifies native remote MCP separately.',scope:'UI navigation, role scope, actual browser headers, warehouse handoff/acceptance, version conflicts, exact retry, snapshot display and responsive/accessibility sampling. Stock and finance ledger fingerprints are verified separately by service tests. No exhaustive screen-reader or pixel-baseline claim.'};
 await fs.writeFile(`${output}/browser-${mode}${captureLists?'-list-confirmation':recaptureWarehouse?'-recapture':''}.json`,JSON.stringify(report,null,2)+'\n');
}
