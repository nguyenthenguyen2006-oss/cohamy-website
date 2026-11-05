import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {chromium,expect} from '@playwright/test';

const production=process.argv.includes('--production'),confirmation=process.argv.includes('--confirmation'),recaptureActivity=process.argv.includes('--recapture-activity');
assert.ok(!recaptureActivity||!production&&!confirmation,'Activity evidence recapture is isolated staging only');
const origin='https://cohamy.vn',base=production?origin:'http://localhost:4372';
const mode=production?'production':'staging',output='docs/crm/test-results/homepage-refinement',shots=`${output}/${mode}`;
const require=createRequire(import.meta.url),axe=await fs.readFile(require.resolve('axe-core/axe.min.js'),'utf8');
const productIds=['cohamy-almond-chocolate-80g','cohamy-cashew-chocolate-80g','cohamy-almond-matcha-chocolate-80g','cohamy-almond-strawberry-chocolate-80g','cohamy-almond-durian-chocolate-80g','cohamy-macadamia-chocolate-80g','cohamy-mango-chocolate-80g','cohamy-chocolate-candy-65g'];
const combinedBrand=/Cohamy\s*(?:và|and|&|和|与|と)\s*Jamy(?:\s*Green)?|코하미\s*(?:와|및|&)\s*자미(?:\s*그린)?/iu;
const cases=[],measurements=[],screenshots=[],accessibility=[],errors=[],blockedWrites=[],external=[],notes=[],contexts=[],routes=new Set();
let browser,page,phase='initialization',complete=false,lastRoute=Date.now(),blogPath=null;
const pass=(name,details={})=>{cases.push({name,status:'PASS',...details});console.log('PASS '+name);};
async function runCase(name,run){phase=name;try{await run();pass(name);}catch(error){cases.push({name,status:'FAIL',error:String(error?.stack??error)});console.error('FAIL '+name+' '+String(error?.message??error));}}
const pause=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

async function makePage(){
 const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',reducedMotion:'reduce'});contexts.push(context);
 const target=await context.newPage();target.setDefaultTimeout(30000);
 target.on('pageerror',error=>errors.push({type:'pageerror',message:error.message,phase}));
 target.on('console',message=>{if(message.type()!=='error')return;const source=message.location().url;let sameOrigin=false;try{sameOrigin=!source||new URL(source).origin===origin;}catch{}if(sameOrigin)errors.push({type:'console',message:message.text(),phase});});
 target.on('response',response=>{const url=new URL(response.url());if(url.origin===origin&&response.status()>=400)errors.push({type:'http',path:url.pathname,status:response.status(),phase});});
 target.on('requestfailed',request=>{const url=new URL(request.url());if(url.origin===origin&&request.failure()?.errorText!=='net::ERR_ABORTED')errors.push({type:'requestfailed',path:url.pathname,message:request.failure()?.errorText,phase});});
 await context.route('**/*',route=>{
  const task=(async()=>{
   const request=route.request(),url=new URL(request.url());lastRoute=Date.now();
   if(!['GET','HEAD','OPTIONS'].includes(request.method())){blockedWrites.push({method:request.method(),path:url.pathname,origin:url.origin,phase});return route.abort('blockedbyclient');}
   if(url.origin!==origin){if(['http:','https:'].includes(url.protocol)){external.push({origin:url.origin,path:url.pathname});return route.abort('blockedbyclient');}return route.continue();}
   if(production)return route.continue();
   try{const headers={...request.headers()};delete headers['if-none-match'];delete headers['if-modified-since'];const response=await route.fetch({url:base+url.pathname+url.search,headers,maxRedirects:0,maxRetries:1});return route.fulfill({response});}
   catch(error){errors.push({type:'proxy',path:url.pathname,message:String(error?.message??error),phase});return route.abort('failed');}
  })();routes.add(task);task.finally(()=>{routes.delete(task);lastRoute=Date.now();}).catch(()=>{});return task;
 });
 return target;
}
async function settle(target,{allImages=false}={}){
 await target.waitForFunction(()=>Array.from(document.querySelectorAll('link[rel="stylesheet"]')).every(link=>link.sheet));
 await target.evaluate(()=>document.fonts.ready);
 if(allImages){
  const images=target.locator('img');
  for(let index=0;index<await images.count();index++){
   const image=images.nth(index);if(!await image.isVisible())continue;
   await image.scrollIntoViewIfNeeded();
   await image.evaluate(async node=>{if(!node.complete)await new Promise((resolve,reject)=>{node.addEventListener('load',resolve,{once:true});node.addEventListener('error',()=>reject(new Error('IMAGE_LOAD_FAILED')),{once:true});});if(!node.naturalWidth)throw Error('IMAGE_HAS_NO_PIXELS');await node.decode();});
  }
 }
 await target.waitForFunction(()=>Array.from(document.images).filter(image=>{const rect=image.getBoundingClientRect();return rect.width&&rect.height&&rect.top<innerHeight&&rect.bottom>0;}).every(image=>image.complete&&image.naturalWidth>0));
}
async function visit(path,{allImages=false}={}){
 const response=await page.goto(origin+path,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200,path+' did not return 200');
 await expect(page.locator('[data-public-storefront]')).toBeVisible();await settle(page,{allImages});return response;
}
async function noOverflow(label){
 const result=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth}));measurements.push({label,...result});
 assert.ok(result.documentWidth<=result.viewport+1&&result.bodyWidth<=result.viewport+1,'Document overflow at '+label);
}
async function capture(label,selector){
 await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();window.scrollTo({top:0,left:0,behavior:'instant'});});await page.waitForFunction(()=>scrollY===0);await settle(page);await noOverflow(label);
 const file=`${shots}/${label}.png`;
 if(selector){
  const clip=await page.locator(selector).evaluate(node=>{const rect=node.getBoundingClientRect();return {x:rect.x+scrollX,y:rect.y+scrollY,width:rect.width,height:rect.height};});
  await page.screenshot({path:file,fullPage:true,clip,animations:'disabled'});
 }else await page.screenshot({path:file,fullPage:true,animations:'disabled'});
 screenshots.push(file);
}
async function typeAndGrid(label,expectedColumns){
 const values=await page.evaluate(()=>{
  const bySelector=selector=>{const node=document.querySelector(selector);if(!node)return null;const css=getComputedStyle(node);return {font:css.fontFamily,size:parseFloat(css.fontSize),lineHeight:css.lineHeight};};
  const cards=Array.from(document.querySelectorAll('[data-home-product]'));const grid=cards[0].parentElement;
  return {root:parseFloat(getComputedStyle(document.documentElement).fontSize),body:bySelector('body'),nav:bySelector('header>div>nav'),hero:bySelector('#cacao-hero-title'),catalog:bySelector('#cacao-catalog-title'),product:bySelector('[data-home-product] h3'),brand:bySelector('#cacao-brand-title'),gift:bySelector('#cacao-gift-title'),columns:getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,ids:cards.map(card=>card.getAttribute('data-home-product')),rowTops:[...new Set(cards.map(card=>Math.round(card.getBoundingClientRect().top)))],links:cards.map(card=>card.querySelector('a[href]').getAttribute('href'))};
 });measurements.push({label,...values});
 assert.equal(values.root,16);assert.equal(values.body.size,16);assert.equal(values.columns,expectedColumns);assert.deepEqual(values.ids,productIds);assert.equal(new Set(values.ids).size,8);assert.equal(values.rowTops.length,8/expectedColumns);
 assert.ok(values.hero.size<=64&&values.catalog.size<=36&&values.product.size<=20&&values.brand.size<=36&&values.gift.size<=36,'Public type scale exceeds scoped maximum');
 if(expectedColumns===4)assert.ok(values.nav.size<=15&&values.nav.size>=14);
 assert.ok(values.links.every(href=>href.startsWith('/vi/san-pham/')),'Product URLs do not retain localized product routes');
 await expect(page.locator('[data-home-product] [data-product-price]')).toHaveCount(8);
 await expect(page.locator('[data-home-product] input[type="number"]')).toHaveCount(8);
 await expect(page.locator('[data-home-product] .product-purchase-action--add')).toHaveCount(8);
 await noOverflow(label);
 return values;
}
async function checkHeaderControls(label){
 const result=await page.evaluate(()=>{
  const header=document.querySelector('header'),logo=header.querySelector('a[aria-label="Cohamy"]'),bounds=logo.getBoundingClientRect();
  const logoRect={x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,right:bounds.right,bottom:bounds.bottom};
  const buttons=Array.from(header.querySelectorAll('button')).map(button=>{
   const rect=button.getBoundingClientRect();return {label:button.getAttribute('aria-label')||button.textContent.trim(),width:rect.width,height:rect.height,x:rect.x,y:rect.y,overlapWidth:Math.max(0,Math.min(bounds.right,rect.right)-Math.max(bounds.left,rect.left)),overlapHeight:Math.max(0,Math.min(bounds.bottom,rect.bottom)-Math.max(bounds.top,rect.top))};
  }).filter(rect=>rect.width>0&&rect.height>0);
  return {logo:logoRect,buttons};
 });measurements.push({label,...result});
 assert.ok(result.logo.width>0&&result.logo.height>0,'Visible brand logo is required');assert.equal(result.buttons.length,3,'Mobile header should expose menu, language and cart controls');
 for(const button of result.buttons){assert.ok(button.width>=43.5&&button.height>=43.5,'Header control loses its44px target: '+button.label);assert.ok(button.overlapWidth<=1||button.overlapHeight<=1,'Header logo overlaps '+button.label);}
}
async function checkImages(selector,label,expected){
 const result=await page.locator(selector).evaluateAll(nodes=>nodes.map(image=>{
  const rect=image.getBoundingClientRect(),css=getComputedStyle(image),ratio=image.naturalWidth/image.naturalHeight,renderedRatio=rect.width/rect.height;
  const clips=[];for(let ancestor=image.parentElement;ancestor&&ancestor.tagName!=='SECTION';ancestor=ancestor.parentElement){const style=getComputedStyle(ancestor),bounds=ancestor.getBoundingClientRect();if(['hidden','clip'].includes(style.overflow)||['hidden','clip'].includes(style.overflowY)||['hidden','clip'].includes(style.overflowX)){if(rect.top<bounds.top-1||rect.bottom>bounds.bottom+1||rect.left<bounds.left-1||rect.right>bounds.right+1)clips.push(ancestor.tagName);}}
  return {src:new URL(image.currentSrc||image.src).pathname,kind:image.getAttribute('data-marketing-image'),naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,width:rect.width,height:rect.height,objectFit:css.objectFit,relativeAspectError:Math.abs(renderedRatio/ratio-1),clippingAncestors:clips};
 }));measurements.push({label,images:result});assert.equal(result.length,expected);
 for(const image of result){assert.ok(image.width>0&&image.height>0&&image.naturalWidth>0);assert.ok(['contain','scale-down'].includes(image.objectFit)||image.relativeAspectError<.02,'Image aspect/crop failure '+label+' '+image.kind);assert.equal(image.clippingAncestors.length,0,'Image extends past a clipping ancestor');}
}
async function checkBrand(label){
 const result=await page.evaluate(()=>({text:document.body.innerText,alt:Array.from(document.querySelectorAll('img')).map(node=>node.alt).join('\n'),metadata:Array.from(document.querySelectorAll('meta[content]')).map(node=>node.content).join('\n'),jsonLd:Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(node=>node.textContent).join('\n')}));
 for(const [kind,text] of Object.entries(result))assert.ok(!combinedBrand.test(text),'Combined brand remains in '+label+' '+kind);
}
async function audit(label,selector='[data-public-storefront]'){
 await page.addScriptTag({content:axe});const result=await page.evaluate(async selector=>{const report=await window.axe.run(document.querySelector(selector),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return {violations:report.violations.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.map(node=>node.target)})),incomplete:report.incomplete.map(item=>item.id),passes:report.passes.length};},selector);
 accessibility.push({label,...result});assert.equal(result.violations.length,0,'Axe violations at '+label);
}
async function drain(){for(let count=0;count<200;count++){await Promise.allSettled([...routes]);if(routes.size===0&&Date.now()-lastRoute>=700)return;await pause(100);}throw Error('Route handlers did not settle');}

try{
 await fs.mkdir(shots,{recursive:true});browser=await chromium.launch({channel:'msedge',headless:true});page=await makePage();
 if(recaptureActivity){
  await runCase('Recapture only the required mobile activity region at scroll zero with document clipping',async()=>{
   await page.setViewportSize({width:390,height:844});await visit('/vi',{allImages:true});await capture('activity-390','section[aria-labelledby="cacao-activities-title"]');
  });
 }else if(confirmation){
  for(const width of [390,320])await runCase('Confirm corrected mobile header geometry and complete catalog at '+width+'px',async()=>{
   await page.setViewportSize({width,height:844});await visit('/vi',{allImages:true});await typeAndGrid('home-'+width+'-confirmation',2);await checkHeaderControls('header-'+width+'-confirmation');await checkImages('[data-marketing-image]','home-marketing-'+width+'-confirmation',4);
   await capture('home-'+width);await capture('catalog-'+width,'section[aria-labelledby="cacao-catalog-title"]');await capture('brand-'+width,'section[aria-labelledby="cacao-brand-title"]');await capture('activity-'+width,'section[aria-labelledby="cacao-activities-title"]');
  });
  for(const width of [1366,390])await runCase('Confirm eight whole gallery frames and corrected metadata contrast at '+width+'px',async()=>{
   await page.setViewportSize({width,height:width===1366?900:844});await visit('/vi/hoat-dong',{allImages:true});await checkImages('[data-activity-gallery] img','gallery-'+width+'-confirmation',8);await checkBrand('gallery-'+width+'-confirmation');await capture('gallery-'+width);await audit('gallery-'+width+'-confirmation');
  });
  notes.push('One bounded confirmation for the two recorded material findings: mobile logo/control collision and gallery metadata contrast. Original functional/cart/localization reports remain unchanged. Only affected canonical captures and corrected document-clipped mobile region images are replaced.');
 }else{
 await runCase('Eight unique products form four columns and two desktop rows with live price/quantity controls',async()=>{
  await visit('/vi',{allImages:true});await typeAndGrid('home-1366',4);await checkImages('[data-marketing-image]','home-marketing-1366',4);await checkImages('[data-home-product] > a img','home-products-1366',8);await checkBrand('vi-home');
  const links=await page.locator('[data-home-product] > a').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')));assert.equal(new Set(links).size,8);
  const blog=await page.locator('section[aria-labelledby="cacao-blog-title"] a[href^="/vi/bai-viet/"]').first().getAttribute('href').catch(()=>null);blogPath=blog;
  await capture('home-1366');await capture('catalog-1366','section[aria-labelledby="cacao-catalog-title"]');await capture('brand-1366','section[aria-labelledby="cacao-brand-title"]');await capture('gift-1366','section[aria-labelledby="cacao-gift-title"]');await capture('activity-1366','section[aria-labelledby="cacao-activities-title"]');
 });
 await runCase('Desktop 1024px retains four columns and two rows',async()=>{await page.setViewportSize({width:1024,height:900});await visit('/vi');await typeAndGrid('home-1024',4);});
 for(const width of [390,320])await runCase('Mobile '+width+'px shows all eight products in two columns and whole marketing images',async()=>{
  await page.setViewportSize({width,height:844});await visit('/vi',{allImages:true});await typeAndGrid('home-'+width,2);await checkHeaderControls('header-'+width);await checkImages('[data-marketing-image]','home-marketing-'+width,4);await checkImages('[data-home-product] > a img','home-products-'+width,8);
  await capture('home-'+width);await capture('catalog-'+width,'section[aria-labelledby="cacao-catalog-title"]');await capture('brand-'+width,'section[aria-labelledby="cacao-brand-title"]');await capture('activity-'+width,'section[aria-labelledby="cacao-activities-title"]');
 });
 if(!confirmation){
  if(!production)await runCase('Every product adds its selected quantity to the local cart drawer without any server write',async()=>{
   await page.setViewportSize({width:1366,height:900});await visit('/vi');
   for(let index=0;index<productIds.length;index++){
    const card=page.locator(`[data-home-product="${productIds[index]}"]`),quantity=index===0?2:1;
    await card.getByRole('spinbutton').fill(String(quantity));await card.getByRole('button',{name:'Thêm vào giỏ',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('.cart-drawer-items > li')).toHaveCount(index+1);
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('cohamy-cart')).state.items);assert.equal(stored.find(item=>item.productId===productIds[index]).quantity,quantity);
    await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
   }
   const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('cohamy-cart')).state.items);assert.equal(stored.length,8);assert.equal(stored.reduce((sum,item)=>sum+item.quantity,0),9);assert.equal(blockedWrites.length,0);
   await page.evaluate(()=>localStorage.removeItem('cohamy-cart'));await page.reload();notes.push('Cart writes are isolated browser localStorage in the test context; no checkout, order or email API is invoked.');
  });
  await runCase('Five locale homepages show eight products and Cohamy-only brand text, alt and metadata',async()=>{
   await page.setViewportSize({width:1366,height:900});for(const locale of ['vi','en','zh','ko','ja']){await visit('/'+locale);await expect(page.locator('[data-home-product]')).toHaveCount(8);await checkBrand(locale+'-home');await noOverflow(locale+'-home');}
  });
 }
 for(const width of [1366,390]){
  await runCase('About photo at '+width+'px retains its original frame and compact public typography',async()=>{
   await page.setViewportSize({width,height:width===1366?900:844});await visit('/vi/ve-chung-toi',{allImages:true});await checkImages('main > div img','about-'+width,1);await checkBrand('about-'+width);
   const type=await page.locator('main h1').evaluate(node=>parseFloat(getComputedStyle(node).fontSize));measurements.push({label:'about-'+width,headingSize:type});assert.ok(type<=36);await capture('about-'+width);
  });
  await runCase('All eight activity photographs at '+width+'px retain their complete intrinsic frames',async()=>{
   await visit('/vi/hoat-dong',{allImages:true});await checkImages('[data-activity-gallery] img','gallery-'+width,8);await checkBrand('gallery-'+width);await capture('gallery-'+width);
  });
 }
 if(!confirmation){
  await runCase('Product list, product detail and a published article retain public routes and smaller reading scale',async()=>{
   await page.setViewportSize({width:1366,height:900});for(const path of ['/vi/san-pham','/vi/san-pham/cohamy-socola-hat-dieu-80g',...(blogPath?[blogPath]:[])]){await visit(path);await checkBrand(path);await noOverflow(path);assert.equal(await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize)),16);}
   assert.ok(blogPath,'No published featured article link was available to sample');
  });
  await runCase('Keyboard menu at a 200%-equivalent CSS viewport remains usable without horizontal overflow',async()=>{
   await page.setViewportSize({width:683,height:450});await visit('/vi');await noOverflow('200-percent-equivalent');const menu=page.locator('header button[aria-controls="main-mobile-menu"]');await menu.focus();await page.keyboard.press('Enter');await expect(menu).toHaveAttribute('aria-expanded','true');await expect(page.locator('#main-mobile-menu')).toBeVisible();await page.keyboard.press('Enter');await expect(menu).toHaveAttribute('aria-expanded','false');assert.ok(await menu.evaluate(node=>getComputedStyle(node).outlineStyle!=='none'));notes.push('683 CSS pixels model a 1366px desktop viewport at 200% zoom; this is a responsive/text-fit sample, not an exhaustive browser zoom or assistive technology proof.');
  });
  await runCase('Public root type scoping leaves the internal CRM login scale unchanged',async()=>{
   await page.setViewportSize({width:1366,height:900});const response=await page.goto(origin+'/crm/login');assert.equal(response.status(),200);await settle(page);assert.equal(await page.locator('[data-public-storefront]').count(),0);assert.equal(await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize)),18);
  });
  for(const width of [1366,390])await runCase('Homepage accessibility sample at '+width+'px has no axe violations',async()=>{await page.setViewportSize({width,height:width===1366?900:844});await visit('/vi');await audit('home-'+width);});
  await runCase('Activity gallery accessibility sample has no axe violations',async()=>{await page.setViewportSize({width:1366,height:900});await visit('/vi/hoat-dong');await audit('gallery-1366');});
 }
 }
 phase='final route drain';await drain();assert.equal(errors.length,0,'Unexpected first-party browser/network errors');assert.equal(blockedWrites.length,0,'A blocked write was attempted');pass('Read-only guards and settled first-party runtime remain clean');complete=cases.every(item=>item.status==='PASS');
}catch(error){cases.push({name:phase,status:'FAIL',error:String(error?.stack??error)});console.error('FAIL '+phase+' '+String(error?.message??error));}
finally{
 await Promise.allSettled(contexts.map(context=>context.close()));await browser?.close();await fs.mkdir(output,{recursive:true});
 const report={status:complete?'PASS':'FAIL',environment:production?'PRODUCTION direct HTTPS, public GET-only verification':'STAGING isolated PostgreSQL through fixed localhost4372→VPS4336 proxy; public GET-only verification',testedAt:new Date().toISOString(),confirmation,recaptureActivity,cases,measurements,screenshots,captureMethod:'Whole-document screenshots and document-coordinate region clips are taken at scroll zero with neutral focus after image scroll/load/decode. Region clips avoid the sticky-header fragment caused by automatic element scrolling in the initial batch.',accessibility,errors,blockedWrites,externalRequestsBlocked:external,productionBusinessWrites:0,orderSubmissions:0,realEmailsSent:0,notes,scope:recaptureActivity?'Capture-only replacement of the named mobile activity-region image. No application change, new orders, cart actions or other screenshot replacements.':'Public catalog completeness/grid, original marketing/photo framing, public type scale and workspace boundary, branding in sampled localized runtime pages, current routes, local cart UI, keyboard/reflow and axe samples. All requests outside GET/HEAD/OPTIONS are blocked. No claim of exhaustive accessibility or every CMS article render.'};
 await fs.writeFile(`${output}/${mode}${recaptureActivity?'-activity-recapture':confirmation?'-confirmation':''}.json`,JSON.stringify(report,null,2)+'\n');if(!complete)process.exitCode=1;
}
