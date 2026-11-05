import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,expect as baseExpect} from '@playwright/test';

const base=process.env.SALES_QA_ORIGIN??'http://127.0.0.1:4362';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const run=JSON.parse(await fs.readFile(process.env.CRM_SALES_QA_FIXTURE??process.env.SALES_QA_FIXTURE??'.local/sales-routing-qa.json','utf8'));
assert.match(run.dataDir,/^\.local[\/]crm-qa-sales-/);
const metadataResponse=await fetch(base+'/.well-known/oauth-authorization-server',{signal:AbortSignal.timeout(60000)});assert.ok(metadataResponse.ok,'Cannot verify isolated QA runtime issuer');const metadata=await metadataResponse.json();assert.ok(['http://127.0.0.1:4362','https://sales-qa.invalid'].includes(metadata.issuer),'Refusing browser QA against a non-test runtime issuer');
const folder='docs/crm/test-results/sales-routing',expect=baseExpect.configure({timeout:60000});
await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',route=>route.request().headers()['next-router-prefetch']==='1'?route.abort():route.continue());
let complete=false,failure=null;
try{
 await page.goto(base+'/crm/login');await page.getByLabel('Email',{exact:true}).fill('accountant@crm-qa.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill(run.qaPassword);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page).toHaveURL(base+'/crm');await page.waitForLoadState('networkidle');
 const ordersResponse=await context.request.get(base+'/api/crm/buyer/orders?status=CONFIRMED',{timeout:60000});assert.ok(ordersResponse.ok());const orders=await ordersResponse.json();let selected=null;
 for(const order of orders.items.filter(o=>o.buyer_role==='CUSTOMER'&&o.clearance_id)){const pricingResponse=await context.request.get(base+'/api/crm/buyer/quote-pricing?id='+order.id,{timeout:60000});assert.ok(pricingResponse.ok());const pricing=await pricingResponse.json();if(pricing){selected=order;break;}}
 assert.ok(selected,'Fixture requires a confirmed order with an immutable quote-price check');
 const detailResponse=await context.request.get(base+'/api/crm/buyer/order?id='+selected.id,{timeout:60000});assert.ok(detailResponse.ok());const detail=await detailResponse.json();assert.ok(detail.financial);
 await page.goto(base+'/crm/buyer-orders/'+selected.id);await expect(page.getByRole('heading',{name:'Giá & điều kiện đã lưu theo báo giá',exact:true})).toBeVisible();assert.equal(await page.getByRole('button',{name:'Gửi báo giá cho khách',exact:true}).count(),0);assert.equal(await page.locator('input[name^="price:"]').count(),0);
 const financial=page.locator('section').filter({has:page.getByRole('heading',{name:'Thanh toán, công nợ & VAT theo sổ nguồn',exact:true})});
 for(const key of ['grossTotal','paidAmount','remainingDebt'])await expect(financial).toContainText(new Intl.NumberFormat('vi-VN').format(BigInt(detail.financial[key]))+' đ');
 await expect(page.getByRole('columnheader',{name:'Giá niêm yết',exact:true})).toBeVisible();await page.screenshot({path:folder+'/accounting-order-desktop.png',fullPage:true});assert.deepEqual(errors,[]);complete=true;console.log('PASS Accountant reads immutable original/recommended/quoted prices and exact source gross/paid/debt/VAT, without Sales quote inputs');
}catch(error){failure=String(error instanceof Error?error.message:error).split('Call log:')[0].trim();}finally{
 await context.request.post(base+'/api/crm/auth/logout',{headers:{origin:base},timeout:5000}).catch(()=>{});await browser.close();await fs.writeFile(folder+'/accounting-ui-local.json',JSON.stringify({status:complete?'PASS':'FAIL',environment:metadata.issuer==='https://sales-qa.invalid'?'STAGING test issuer, real Edge':'LOCAL isolated PGlite, real Edge',issuer:metadata.issuer,failure,pageErrors:errors,externalEmails:0,productionWrites:0},null,2)+'\n');
}
if(failure){console.error(failure);process.exitCode=1;}
