import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {chromium,expect} from '@playwright/test';

// Both modes permit reads only. Staging proxies the public origin to the fixed
// owned tunnel; --production visits the real website and never authenticates.
const production=process.argv.includes('--production');
const userCaptureOnly=process.argv.includes('--capture-user-2378');
const recaptureMobile=process.argv.includes('--recapture-mobile');
const origin='https://cohamy.vn',base=production?origin:'http://localhost:4370';
const folder='docs/crm/test-results/footer-unification/'+(production?'production':'staging');
const footerSelector='footer[data-site-footer]';
const expectedColumns=['brand','policies','contact','company'];
const registration={taxId:'0111549388',firstIssuedAt:'2026-06-25',date:'25/06/2026',authority:'Phòng Đăng ký kinh doanh và Tài chính doanh nghiệp, Sở Tài chính Thành phố Hà Nội',address:'Tầng 3, Tháp A, Tòa nhà T608, KĐT mới Cổ Nhuế, Đường Tôn Quang Phiệt, Phường Nghĩa Đô, Thành phố Hà Nội, Việt Nam'};
const bank={display:'9139 8888 6666',number:'913988886666',name:'MB Bank',holder:'CÔNG TY TNHH COHAMY'};
const policies=[
  ['bao-mat-thong-tin','Chính sách bảo mật thông tin'],
  ['van-chuyen-kiem-tra-doi-tra','Chính sách vận chuyển - kiểm tra - đổi trả hàng'],
  ['thanh-toan','Chính sách thanh toán'],
  ['gia','Chính sách giá'],
  ['tiep-nhan-giai-quyet-khieu-nai','Phương thức tiếp nhận và giải quyết yêu cầu phản ánh khiếu nại'],
  ['dieu-kien-cung-cap-hang-hoa','Các điều kiện hạn chế trong việc cung cấp hàng hóa'],
  ['quyen-nghia-vu-cac-ben','Quyền và nghĩa vụ 2 bên'],
];
const paymentPath='/vi/chinh-sach/thanh-toan';
const productPath='/vi/san-pham/cohamy-socola-hat-dieu-80g';
const viRoutes=['/vi','/vi/san-pham',productPath,'/vi/ve-chung-toi','/vi/hoat-dong','/vi/lien-he','/vi/doi-tac','/vi/bai-viet','/vi/gio-hang','/vi/thanh-toan',...policies.map(([slug])=>'/vi/chinh-sach/'+slug)];
const otherRoutes=['en','zh','ko','ja'].flatMap(locale=>['/'+locale,'/'+locale+'/products']);
const require=createRequire(import.meta.url),axeSource=await fs.readFile(require.resolve('axe-core/axe.min.js'),'utf8');
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
const page=await context.newPage();page.setDefaultTimeout(25000);
const cdp=await context.newCDPSession(page);
const cases=[],routes=[],screenshots=[],accessibility=[],errors=[],blockedRequests=[],coverageNotes=[],externalNetwork=[];
const pendingRoutes=new Set();
const lifecycle=[];let lifecyclePhase='running';
const signatures=new Map();let activeCase='initialization',complete=false,navigations=0,adminRequests=0;
const footer=page.locator(footerSelector);
const normalize=text=>String(text??'').replace(/\s+/gu,' ').trim();
const hash=text=>createHash('sha256').update(text).digest('hex');
const pass=(name,details={})=>{cases.push({name,status:'PASS',...details});console.log('PASS '+name);};
page.on('pageerror',error=>errors.push({type:'pageerror',path:new URL(page.url()).pathname,message:error.message}));
page.on('console',message=>{if(message.type()!=='error')return;const source=message.location().url;const record={type:'console',message:message.text(),source};if(source&&new URL(source).origin!==origin)externalNetwork.push(record);else errors.push(record);});
page.on('requestfailed',request=>{const error=request.failure()?.errorText,url=new URL(request.url());if(error!=='net::ERR_ABORTED')(url.origin===origin?errors:externalNetwork).push({type:'requestfailed',path:url.pathname,origin:url.origin,error});});

await context.route('**/*',async route=>{
  const task=(async()=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===origin&&/^\/api\/crm(?:\/|$)/u.test(url.pathname))adminRequests++;
  if(!['GET','HEAD','OPTIONS'].includes(request.method())){(url.origin===origin?blockedRequests:externalNetwork).push({type:'write-blocked',method:request.method(),origin:url.origin,path:url.pathname});return route.abort('blockedbyclient');}
  if(production)return route.continue();
  if(url.origin!==origin){
    // Contact-page maps remain real external reads. They are outside the footer
    // audit; no iframe or GET response is replaced with a fixture.
    return route.continue();
  }
  try{
    const headers={...request.headers()};delete headers['if-none-match'];delete headers['if-modified-since'];
    const response=await route.fetch({url:base+url.pathname+url.search,maxRedirects:0,maxRetries:2,headers});
    return route.fulfill({response});
  }catch(error){
    errors.push({type:'proxy',phase:lifecyclePhase,path:url.pathname,message:String(error)});
    return route.abort().catch(abortError=>errors.push({type:'proxy-abort',phase:lifecyclePhase,path:url.pathname,message:String(abortError)}));
  }
  })();
  pendingRoutes.add(task);try{await task;}finally{pendingRoutes.delete(task);}
});

async function drainRouteHandlers(){
  const started=Date.now(),deadline=started+20000;let quietSince=null;
  while(Date.now()<deadline){
    // The API-backed staging proxy must finish before its context is disposed.
    // Native browser streams/prefetch may remain open across navigation and are
    // cancelled by browser close; do not wait on a global Request-object set.
    if(pendingRoutes.size)quietSince=null;
    else if(quietSince===null)quietSince=Date.now();
    else if(Date.now()-quietSince>=1000)return {status:'PASS',elapsedMs:Date.now()-started,pendingRouteHandlers:0,quietMs:1000,scope:'Actual route-handler/API-proxy operations drained. Native browser streams are closed normally; first-party errors still fail the report.'};
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw new Error('Route-handler drain timed out: '+JSON.stringify({pendingRoutes:pendingRoutes.size}));
}

async function settle(){
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('link[rel="stylesheet"]')).every(link=>link.sheet));
  await page.evaluate(()=>document.fonts.ready);
  await expect(footer).toHaveCount(1);
  const image=footer.locator('img');await expect(image).toHaveCount(1);
  await image.scrollIntoViewIfNeeded();
  await expect(image).toBeVisible();
  await expect.poll(()=>image.evaluate(node=>node.complete&&node.naturalWidth>0)).toBe(true);
}
async function visit(path){
  const response=await page.goto(origin+path,{waitUntil:'domcontentloaded'});navigations++;
  assert.equal(response?.status(),200,'HTTP '+path);await settle();
}
async function inspect(path,label=path){
  const data=await footer.evaluate(node=>{
    const box=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right};};
    const norm=text=>(text??'').replace(/\s+/gu,' ').trim();
    const columns=Array.from(node.querySelectorAll('[data-footer-column]')).map(column=>({name:column.getAttribute('data-footer-column'),text:norm(column.textContent),headings:Array.from(column.querySelectorAll('h2')).map(h=>norm(h.textContent)),...box(column)}));
    const links=Array.from(node.querySelectorAll('a')).map(a=>({text:norm(a.textContent),href:a.getAttribute('href'),target:a.getAttribute('target'),rel:a.getAttribute('rel')}));
    const styles=Array.from(node.querySelectorAll('h2,p,a,dt,dd,time,address,li')).map(element=>{const s=getComputedStyle(element);return {tag:element.tagName,font:s.fontFamily,size:s.fontSize,lineHeight:s.lineHeight,weight:s.fontWeight};});
    const grid=node.querySelector('[data-footer-column]')?.parentElement;
    return {columns,links,styles,navCount:node.querySelectorAll('nav').length,text:norm(node.textContent),tax:node.querySelector('[data-company-tax-id]')?.textContent,date:node.querySelector('time')?.getAttribute('datetime'),dateText:node.querySelector('time')?.textContent,footer:box(node),gridColumns:getComputedStyle(grid).gridTemplateColumns,viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth};
  });
  assert.deepEqual(data.columns.map(column=>column.name),expectedColumns,label+' four columns/order');
  assert.equal(data.navCount,1,label+' only policy navigation');
  assert.ok(!/Liên kết nhanh|Quick links|快速链接|クイックリンク|빠른 링크/iu.test(data.text),label+' no quick links');
  assert.equal(data.tax,registration.taxId);assert.equal(data.date,registration.firstIssuedAt);assert.equal(data.dateText,registration.date);
  assert.ok(data.text.includes(registration.authority));assert.ok(data.text.includes(registration.address));
  assert.ok(data.styles.length>25);assert.ok(data.styles.every(style=>style.size==='16px'),label+' font sizes: '+JSON.stringify(data.styles.filter(style=>style.size!=='16px')));
  const fonts=[...new Set(data.styles.map(style=>style.font))];assert.equal(fonts.length,1,label+' uniform family');assert.match(fonts[0],/manrope/iu,label+' Manrope');
  assert.ok(data.documentWidth<=data.viewport+1,label+' page overflow: '+JSON.stringify(data));
  assert.ok(data.footer.right<=data.viewport+1&&data.footer.x>=-1,label+' footer bounds');
  assert.ok(data.columns.every(column=>column.x>=data.footer.x-1&&column.right<=data.viewport+1),label+' column bounds');
  const actualPolicyLinks=await footer.locator('[data-footer-column="policies"] a').evaluateAll(nodes=>nodes.map(a=>({href:a.getAttribute('href'),text:a.textContent})));
  assert.deepEqual(actualPolicyLinks.map(a=>({href:a.href,text:normalize(a.text)})),policies.map(([slug,title])=>({href:'/vi/chinh-sach/'+slug,text:title})));
  const hrefs=data.links.map(link=>link.href);assert.equal(hrefs.length,13,label+' no surplus quick links');
  assert.ok(hrefs.includes('tel:+84981956111'));assert.ok(hrefs.includes('mailto:Cohamyvietnam@gmail.com'));assert.ok(hrefs.includes('https://zalo.me/0981956111'));
  const maps=data.links.filter(link=>link.href?.startsWith('https://www.google.com/maps/search/?api=1&query='));assert.equal(maps.length,2);
  for(const link of [...maps,...data.links.filter(link=>link.href==='https://zalo.me/0981956111')]){assert.equal(link.target,'_blank');assert.match(link.rel??'',/noopener/u);assert.match(link.rel??'',/noreferrer/u);}
  const locale=path.split('/')[1],key=locale+'_'+data.viewport;
  const signature=hash(JSON.stringify({columns:data.columns.map(({name,text,headings})=>({name,text,headings})),links:data.links,fonts,sizes:[...new Set(data.styles.map(style=>style.size))]}));
  if(signatures.has(key))assert.equal(signature,signatures.get(key),label+' matches same locale shared footer');else signatures.set(key,signature);
  const record={label,path,viewport:data.viewport,signature,font:fonts[0],fontSize:'16px',columns:data.columns.map(({name,x,y,width,height})=>({name,x,y,width,height})),gridColumns:data.gridColumns,documentWidth:data.documentWidth,footer:data.footer};routes.push(record);return record;
}
async function capture(name,locator=footer){
  await settle();const path=folder+'/'+name+'.png';
  if(locator===footer){
    // Element screenshots scroll a tall mobile footer under the sticky header.
    // Capture its real document coordinates from scroll0 instead; do not hide,
    // restyle or detach any UI while producing review evidence.
    const clip=await footer.evaluate(node=>{const r=node.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};});
    await page.evaluate(()=>scrollTo({left:0,top:0,behavior:'instant'}));
    await page.evaluate(()=>document.fonts.ready);
    const result=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:true,clip});
    await fs.writeFile(path,Buffer.from(result.data,'base64'));
  }else await locator.screenshot({path});
  screenshots.push(path);
}
async function audit(name){
  await page.addScriptTag({content:axeSource});
  const result=await page.evaluate(async selector=>{const result=await window.axe.run({include:[[selector]]},{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return {violations:result.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.map(n=>({target:n.target,failureSummary:n.failureSummary}))})),incomplete:result.incomplete.map(v=>({id:v.id,impact:v.impact,help:v.help})),passes:result.passes.length};},footerSelector);
  accessibility.push({name,...result});assert.deepEqual(result.violations,[],name+' '+JSON.stringify(result.violations));
}

try{
  await fs.mkdir(folder,{recursive:true});
  if(recaptureMobile){
    activeCase='mobile evidence recapture without sticky-header overlay or application changes';
    for(const [width,path,name] of [[390,'/vi','mobile-home-footer'],[390,paymentPath,'mobile-payment-footer'],[320,'/vi','narrow-home-footer']]){
      await page.setViewportSize({width,height:844});await visit(path);await inspect(path,name);await capture(name);
    }
    assert.deepEqual(blockedRequests,[]);assert.deepEqual(errors,[]);assert.equal(adminRequests,0);pass(activeCase);complete=true;
  }else if(userCaptureOnly){
    activeCase='user 2378px viewport shared footer capture and overflow';
    await page.setViewportSize({width:2378,height:1378});await visit('/vi');await inspect('/vi','user-2378-home');await capture('user-2378-footer');
    assert.deepEqual(blockedRequests,[]);assert.deepEqual(errors,[]);assert.equal(adminRequests,0);pass(activeCase);complete=true;
  }else{
  activeCase='shared footer, facts, typography, contact targets and policy links across Vietnamese page types';
  let discoveredBlog=null,discoveredPage=null;
  for(const path of viRoutes){
    await visit(path);const geometry=await inspect(path);
    assert.equal(new Set(geometry.columns.map(column=>Math.round(column.y))).size,1,'four desktop columns share top row');
    if(path==='/vi'){await capture('desktop-home-footer');await audit('desktop-home-footer');}
    if(path==='/vi/san-pham')await capture('desktop-products-footer');
    const blogLink=page.locator('main a[href^="/vi/bai-viet/"]');
    if(path==='/vi/bai-viet'&&await blogLink.count())discoveredBlog=await blogLink.first().getAttribute('href');
    const contentLink=page.locator('a[href^="/vi/noi-dung/"],a[href^="/vi/pages/"]');
    if(!discoveredPage&&await contentLink.count())discoveredPage=await contentLink.first().getAttribute('href');
    const policy=policies.find(([slug])=>path==='/vi/chinh-sach/'+slug);
    if(policy)await expect(page.getByRole('heading',{level:1,name:policy[1],exact:true})).toBeVisible();
    if(path===paymentPath){
      const body=normalize(await page.locator('.store-policy-body').textContent());
      for(const literal of [bank.display,bank.name,bank.holder])assert.ok(body.includes(literal),'payment policy includes '+literal);
      assert.ok(body.replace(/\s/gu,'').includes(bank.number));
      await capture('desktop-payment-footer');await capture('desktop-payment-bank-section',page.locator('#phuong-thuc'));
    }
  }
  pass(activeCase,{routes:viRoutes.length,policyDestinations:7,bankAccount:bank.display});
  activeCase='dynamic blog and CMS page inherit the shared footer when discoverable';
  for(const [kind,path] of [['blog detail',discoveredBlog],['CMS page',discoveredPage]]){
    if(path){await visit(path);await inspect(path);pass(kind+' shared footer',{path});}
    else coverageNotes.push(kind+': no discoverable public link in inspected pages; shared LocaleLayout source coverage, no invented fixture');
  }
  pass(activeCase,{discoveredBlog,discoveredPage});
  activeCase='same footer across home and products for each additional locale';
  for(const path of otherRoutes){await visit(path);await inspect(path);}
  pass(activeCase,{routes:otherRoutes.length,locales:['en','zh','ko','ja']});
  activeCase='keyboard policy link retains visible focus';
  const firstPolicy=footer.locator('[data-footer-column="policies"] a').first();await firstPolicy.focus();
  const focus=await firstPolicy.evaluate(node=>({focused:document.activeElement===node,outline:getComputedStyle(node).outlineStyle,width:parseFloat(getComputedStyle(node).outlineWidth)}));
  assert.ok(focus.focused&&focus.outline!=='none'&&focus.width>=2);pass(activeCase,focus);
  activeCase='tablet layout uses two columns without overflow';
  await page.setViewportSize({width:900,height:900});await visit('/vi');const tablet=await inspect('/vi','tablet-home');
  assert.equal(Math.round(tablet.columns[0].y),Math.round(tablet.columns[1].y));assert.equal(Math.round(tablet.columns[2].y),Math.round(tablet.columns[3].y));assert.ok(tablet.columns[2].y>tablet.columns[0].y);pass(activeCase);
  activeCase='390px mobile home and payment footer stack consistently with matching type';
  await page.setViewportSize({width:390,height:844});
  for(const [path,name] of [['/vi','mobile-home-footer'],[paymentPath,'mobile-payment-footer']]){
    await visit(path);const mobile=await inspect(path,name);assert.ok(mobile.columns.every((column,index)=>index===0||column.y>mobile.columns[index-1].y));
    assert.ok(mobile.columns.every(column=>Math.abs(column.x-mobile.columns[0].x)<=1));await capture(name);
  }
  await audit('mobile-payment-footer');pass(activeCase,{width:390});
  activeCase='320px narrow mobile retains all content without horizontal overflow';
  await page.setViewportSize({width:320,height:844});await visit('/vi');await inspect('/vi','narrow-home');await capture('narrow-home-footer');pass(activeCase,{width:320});
  activeCase='user 2378px viewport shared footer capture and overflow';
  await page.setViewportSize({width:2378,height:1378});await visit('/vi');await inspect('/vi','user-2378-home');await capture('user-2378-footer');pass(activeCase,{width:2378});
  activeCase='no first-party browser runtime errors or attempted business writes';
  assert.deepEqual(blockedRequests,[]);assert.deepEqual(errors,[]);assert.equal(adminRequests,0);pass(activeCase,{navigations,attemptedWrites:0,ordersSubmitted:0,adminRequests});
  complete=true;
  }
}catch(error){
  cases.push({name:activeCase,status:'FAIL',error:String(error?.stack??error)});console.error(String(error?.stack??error));process.exitCode=1;
  await capture('failure').catch(()=>{});
}finally{
  lifecyclePhase='draining';
  try{lifecycle.push(await drainRouteHandlers());}
  catch(error){lifecycle.push({status:'FAIL',message:String(error)});complete=false;process.exitCode=1;}
  lifecyclePhase='closing';await browser.close();lifecyclePhase='closed';
  // Errors arriving during drain/close still fail the run. A successful visual
  // assertion must not conceal a late application or harness failure.
  if(errors.length||blockedRequests.length||adminRequests){complete=false;process.exitCode=1;}
  await fs.mkdir(folder,{recursive:true});
  const report={status:complete?'PASS':'FAIL',environment:production?'PRODUCTION direct public website reads':'STAGING public-origin routing to fixed owned tunnel4370 and VPS4334',testedAt:new Date().toISOString(),cases,routes,screenshots,accessibility,errors,blockedRequests,externalNetwork,lifecycle,coverageNotes,productionWrites:0,adminRequests,orderSubmissions:0,mocks:0,registration,bank,scope:'Shared public footer route-family and locale sampling, seven actual policy destinations, bank-copy verification, CSS/font/image settling, responsive measurements and footer-scoped axe. Real third-party contact-page map reads are outside the footer audit and separately reported; all non-read requests are blocked. Not exhaustive screen-reader testing or a pixel-regression baseline.',mcp:'Not invoked by this browser suite. Release owner separately verifies authenticated companyProfile and policy data through native remote MCP.'};
  const reportPath=folder+(recaptureMobile?'/browser-mobile-recapture.json':userCaptureOnly?'/browser-user-2378.json':'/browser-'+(production?'production':'staging')+'.json');
  await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  if(recaptureMobile&&complete){
    const originalPath=folder+'/browser-'+(production?'production':'staging')+'.json';
    const original=JSON.parse(await fs.readFile(originalPath,'utf8'));
    original.screenshotRecapture={testedAt:report.testedAt,status:'PASS',screenshots,method:'Native CDP document-coordinate footer clip, captureBeyondViewport at scroll0. No CSS, layout or application mutation. Original functional suite was not rerun.',report:reportPath};
    await fs.writeFile(originalPath,JSON.stringify(original,null,2)+'\n');
  }
}
