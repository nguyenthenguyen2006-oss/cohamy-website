import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {chromium,expect as baseExpect} from '@playwright/test';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const base=process.env.BUYER_QA_ORIGIN??'http://localhost:4351',run=JSON.parse(await fs.readFile(process.env.BUYER_QA_FIXTURE??'.local/buyer-qa.json','utf8')),folder='docs/crm/test-results/buyer';
const expect=baseExpect.configure({timeout:60000});
const browser=await chromium.launch({channel:'msedge',headless:true}),contexts=[],cases=[],pageErrors=[];
let mcp,refresh,clientId,complete=false;
const pass=name=>{cases.push({test:name,status:'PASS'});console.log('PASS',name);};
const tool=result=>{assert.equal(result.isError,undefined,JSON.stringify(result));return JSON.parse(result.content.find(c=>c.type==='text').text);};
async function session(email){
 const context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(context);const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>pageErrors.push(e.message));page.on('request',r=>{if(new URL(r.url()).searchParams.has('password'))pageErrors.push('A form sent a password in its URL');});
 if(email==='customer@buyer-qa.invalid'){
  const response=await context.request.get(base+'/portal/login'),html=await response.text(),form=html.match(/<form[^>]*class="auth-form crm-login-form"[^>]*>/)?.[0]??'';
  assert.match(form,/method="post"/);assert.match(form,/action="\/api\/crm\/auth\/login"/);
  const submit=html.match(/<button[^>]*aria-label="Đăng nhập"[^>]*>/)?.[0]??'';assert.match(submit,/disabled=""/);
 }
 await page.goto(base+'/portal/login');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Mật khẩu',{exact:true}).fill('Local-QA-Only-2026!');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page).toHaveURL(/\/(portal|crm)$/);return {page,context};
}
async function click(page,label,action){
 const wait=page.waitForResponse(r=>r.url()===base+'/api/crm/buyer/'+action&&r.request().method()==='POST');
 await page.getByRole('button',{name:label,exact:true}).click();const r=await wait;assert.ok(r.ok(),action+' '+r.status()+' '+await r.text());return r.json();
}
async function screenshot(page,name){await page.evaluate(async()=>{await document.fonts.ready;const imgs=[...document.images];for(const i of imgs)i.loading='eager';await Promise.all(imgs.map(i=>i.decode().catch(()=>{})));});await page.screenshot({path:folder+'/'+name+'.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' horizontal overflow');const logo=page.locator('.buyer-shell .work-brand img');if(await logo.count())assert.ok((await logo.boundingBox()).height<=48,name+' logo is oversized');}
try{
 const customer=await session('customer@buyer-qa.invalid'),market=await session('market@buyer-qa.invalid'),sales=await session('sales@crm-qa.invalid'),admin=await session('admin@crm-qa.invalid'),accountant=await session('accountant@crm-qa.invalid');
 await customer.page.goto(base+'/portal/goods');await expect(customer.page.getByRole('heading',{name:'Danh mục sản phẩm & yêu cầu báo giá',exact:true})).toBeVisible();
 assert.equal(await customer.page.getByRole('columnheader',{name:/giá/i}).count(),0);assert.ok(await customer.page.locator('tbody img').count());
 for(const path of ['/api/crm/catalog','/api/crm/commerce/products','/api/crm/finance/receivables-workspace','/api/crm/partners','/api/crm/documents/'+run.vatId]){
  const r=await customer.context.request.get(base+path);assert.ok([403,404].includes(r.status()),path+' '+r.status());
 }
 pass('Actual customer login reaches own portal; price-free image catalog and legacy pricing/finance/document API isolation');
 await customer.page.getByLabel('Kho xuất dự kiến',{exact:true}).selectOption(run.warehouseId);await customer.page.getByLabel('Số lượng '+run.productName,{exact:true}).fill('3');
 const created=await click(customer.page,'Gửi yêu cầu báo giá','create');await expect(customer.page).toHaveURL(base+'/portal/orders/'+created.id);await expect(customer.page.getByText('Chờ Sales báo giá',{exact:false}).first()).toBeVisible();
 await sales.page.goto(base+'/crm/buyer-orders/'+created.id);await sales.page.getByLabel('Đơn giá '+run.productName,{exact:true}).fill('50000');await sales.page.getByLabel('VAT '+run.productName,{exact:true}).fill('8');await sales.page.getByLabel('Báo giá có hiệu lực đến',{exact:true}).fill('2099-12-31');await click(sales.page,'Gửi báo giá cho khách','quote');
 await customer.page.reload();await click(customer.page,'Xác nhận báo giá & gửi kho','confirm');await expect(customer.page.getByText('Đã chuyển kho xử lý',{exact:false}).first()).toBeVisible();pass('Actual forms create request → assigned Sales quote → customer accepts and sends to warehouse');
 await customer.page.goto(base+'/portal/orders/'+run.marketOrderId);await expect(customer.page.getByRole('heading',{name:'Trang không tồn tại',exact:true})).toBeVisible();
 await market.page.goto(base+'/portal/orders/'+run.marketOrderId);await expect(market.page.getByText('Đã báo thiếu hàng',{exact:true})).toBeVisible();
 const pdf=await market.context.request.get(base+'/api/crm/buyer/download?'+new URLSearchParams({orderId:run.marketOrderId,type:'delivery',id:run.issueId}));assert.equal(pdf.status(),200);assert.equal((await pdf.body()).subarray(0,5).toString(),'%PDF-');
 const vat=await market.context.request.get(base+'/api/crm/buyer/download?'+new URLSearchParams({orderId:run.marketOrderId,type:'vat',id:run.vatId}));assert.equal(vat.status(),200);assert.deepEqual(await vat.body(),await pdf.body());
 const orderPdf=await customer.context.request.get(base+'/api/crm/buyer/download?'+new URLSearchParams({orderId:run.customerOrderId,type:'order'}));assert.equal(orderPdf.status(),200);const orderBytes=await orderPdf.body();assert.equal((orderBytes.toString('latin1').match(/\/Type\s*\/Page\b/g)??[]).length,1);await fs.writeFile(folder+'/customer-order.pdf',orderBytes);
 await accountant.page.goto(base+'/crm/buyer-orders/'+run.marketOrderId);await expect(accountant.page.getByText('Đã báo thiếu hàng',{exact:true})).toBeVisible();pass('Supermarket and accountant see the matching shortage; exact delivery/VAT PDF bytes and other-customer page denial');
 await market.page.goto(base+'/portal/branches');await market.page.getByLabel('Mã chi nhánh',{exact:true}).first().fill('UI_'+randomUUID().slice(0,8));await market.page.getByLabel('Tên chi nhánh',{exact:true}).first().fill('Chi nhánh QA giao diện');await market.page.getByLabel('Địa chỉ chi nhánh',{exact:true}).first().fill('Địa chỉ QA giao diện');await market.page.getByLabel('Người nhận tại chi nhánh',{exact:true}).first().fill('Người nhận QA');await market.page.getByLabel('Điện thoại chi nhánh',{exact:true}).first().fill('0900000003');await click(market.page,'Thêm chi nhánh','branch');
 await market.page.goto(base+'/portal/contracts');await expect(market.page.getByRole('heading',{name:'Bảng giá B2B theo hợp đồng',exact:true})).toBeVisible();
 await market.page.goto(base+'/portal/goods');await market.page.getByLabel('Kho xuất dự kiến',{exact:true}).selectOption(run.warehouseId);await market.page.getByLabel('Chi nhánh nhận hàng',{exact:true}).selectOption(run.branchId);await market.page.getByLabel('Hợp đồng / bảng giá B2B',{exact:true}).selectOption(run.contractId);await market.page.getByLabel('Số lượng '+run.productName,{exact:true}).fill('1');await market.page.getByLabel('Đơn vị '+run.productName,{exact:true}).selectOption('CASE');
 const b2b=await click(market.page,'Đặt hàng theo hợp đồng & gửi kho','create');await expect(market.page).toHaveURL(base+'/portal/orders/'+b2b.id);await expect(market.page.getByText('Đã chuyển kho xử lý',{exact:false}).first()).toBeVisible();pass('Supermarket uses real branch form, own contract catalog and case-order form');
 await market.page.goto(base+'/portal/purchases');await expect(market.page.getByRole('heading',{name:'Mua hàng & đối soát tháng',exact:true})).toBeVisible();
 const csv=await market.context.request.get(base+await market.page.getByRole('link',{name:'Tải báo cáo CSV',exact:true}).getAttribute('href'));assert.equal(csv.status(),200);assert.match(await csv.text(),/Thiếu đã báo/);await click(market.page,'Xác nhận đối soát tháng','acknowledge');pass('Monthly report downloads actual order/receipt quantities and records fingerprint-bound reconciliation');
 await admin.page.goto(base+'/crm/accounts/new');await admin.page.getByLabel('Vai trò',{exact:true}).selectOption('CUSTOMER');assert.equal(await admin.page.getByLabel('Tổ chức sở hữu',{exact:true}).locator('option').count(),4);await admin.page.getByLabel('Vai trò',{exact:true}).selectOption('SUPERMARKET');await expect(admin.page.getByText('Tài khoản đăng nhập tại /portal',{exact:false})).toBeVisible();pass('Admin account form offers both roles and only matching customer organizations');
 for(const width of [1440,390,320]){
  for(const [s,path,name]of [[customer,'/portal/goods','customer-catalog'],[market,'/portal/orders/'+run.marketOrderId,'market-order'],[sales,'/crm/buyer-orders/'+created.id,'sales-order']]){
   await s.page.setViewportSize({width,height:900});await s.page.goto(base+path);await screenshot(s.page,name+'-'+width);
  }
 }
 pass('Customer catalog, supermarket delivery and staff screens fit desktop and 390/320 px phones');
 // Test the actual remote protocol with the official SDK, not direct service calls.
 const callback=base+'/buyer-qa-callback',registration=await admin.context.request.post(base+'/api/crm/mcp/oauth/register',{data:{client_name:'Buyer isolated runtime verification',redirect_uris:[callback]}});assert.equal(registration.status(),201);clientId=(await registration.json()).client_id;
 const verifier=randomBytes(32).toString('base64url'),query=new URLSearchParams({client_id:clientId,redirect_uri:callback,response_type:'code',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',state:randomUUID(),resource:base+'/api/crm/mcp'});
 await admin.page.route(callback+'*',route=>route.fulfill({status:200,contentType:'text/html',body:'<p>Isolated OAuth callback captured.</p>'}));await admin.page.goto(base+'/api/crm/mcp/oauth/authorize?'+query);await admin.page.getByRole('button',{name:'Cho phép kết nối',exact:true}).click();await expect(admin.page).toHaveURL(new RegExp('/buyer-qa-callback'));
 const code=new URL(admin.page.url()).searchParams.get('code'),exchange=await admin.context.request.post(base+'/api/crm/mcp/oauth/token',{form:{grant_type:'authorization_code',client_id:clientId,code,redirect_uri:callback,code_verifier:verifier,resource:base+'/api/crm/mcp'}});assert.equal(exchange.status(),200);
 const tokens=await exchange.json();refresh=tokens.refresh_token;
 mcp=new Client({name:'cohamy-buyer-qa',version:'1.0.0'});await mcp.connect(new StreamableHTTPClientTransport(new URL(base+'/api/crm/mcp'),{requestInit:{headers:{authorization:'Bearer '+tokens.access_token}}}));
 const capabilities=tool(await mcp.callTool({name:'cohamy_capabilities',arguments:{filter:'buyer'}}));assert.ok(capabilities.operations.some(o=>o.id==='POST /api/crm/buyer/quote'));assert.ok(!capabilities.operations.some(o=>o.id.endsWith('/password')));
 const data=tool(await mcp.callTool({name:'cohamy_data',arguments:{table:'buyer_orders',limit:1}}));assert.equal(data.items.length,1);assert.ok(data.nextOffset);const second=tool(await mcp.callTool({name:'cohamy_data',arguments:{table:'buyer_orders',limit:1,offset:data.nextOffset}}));assert.notEqual(second.items[0].id,data.items[0].id);
 const read=tool(await mcp.callTool({name:'cohamy_read',arguments:{operation:'GET /api/crm/buyer/order',query:{id:run.marketOrderId}}}));assert.equal(read.status,200);assert.equal(read.data.order.id,run.marketOrderId);assert.equal(read.data.receipts[0].shortage,true);
 const mcpPdf=tool(await mcp.callTool({name:'cohamy_read',arguments:{operation:'GET /api/crm/buyer/download',query:{orderId:run.marketOrderId,type:'delivery',id:run.issueId}}}));assert.equal(mcpPdf.status,200);assert.deepEqual(Buffer.from(mcpPdf.file.base64,'base64'),await pdf.body());
 const input={operation:'POST /api/crm/buyer/branch',requestId:randomUUID(),input:{organizationId:run.marketOrgId,version:0,code:'MCP_'+randomUUID().slice(0,8),name:'MCP QA branch',address:'MCP QA isolated address',recipient:'MCP QA recipient',phone:'0900000004',idempotencyKey:randomUUID()}};
 const written=tool(await mcp.callTool({name:'cohamy_write',arguments:input}));assert.equal(written.result.status,200);const replay=tool(await mcp.callTool({name:'cohamy_write',arguments:input}));assert.equal(replay.replayed,true);assert.deepEqual(replay.result,written.result);
 const mcpOrder=tool(await mcp.callTool({name:'cohamy_write',arguments:{operation:'POST /api/crm/buyer/create',requestId:randomUUID(),input:{organizationId:run.customerOrgId,buyerRole:'CUSTOMER',warehouseId:run.warehouseId,delivery:{recipient:'MCP QA customer',phone:'0900000005',address:'MCP QA isolated address'},lines:[{productId:run.productId,quantity:1,unit:'PACK'}],idempotencyKey:randomUUID()}}}));assert.equal(mcpOrder.result.status,201);
 const mcpQuote=tool(await mcp.callTool({name:'cohamy_write',arguments:{operation:'POST /api/crm/buyer/quote',requestId:randomUUID(),input:{id:mcpOrder.result.data.id,version:mcpOrder.result.data.version,expiresOn:'2099-12-31',lines:[{productId:run.productId,unitPrice:'50000',vatRate:8}],idempotencyKey:randomUUID()}}}));assert.equal(mcpQuote.result.status,200);
 const deniedReceipt=tool(await mcp.callTool({name:'cohamy_write',arguments:{operation:'POST /api/crm/buyer/receive',requestId:randomUUID(),input:{id:run.marketOrderId,issueId:run.issueId,issueRevision:1,lines:[{productId:run.productId,received:24}],idempotencyKey:randomUUID()}}}));assert.equal(deniedReceipt.result.status,403);
 const statement=tool(await mcp.callTool({name:'cohamy_read',arguments:{operation:'GET /api/crm/buyer/statement',query:{organizationId:run.marketOrgId,month:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit'}).format(new Date())}}}));assert.equal(statement.status,200);assert.ok(statement.data.items.length>=2);
 pass('Official MCP OAuth/client reads new records with pagination, shortage and exact PDF; creates branch, deduplicates retry and reads monthly reconciliation');
 assert.deepEqual(pageErrors,[]);complete=true;
}finally{
 await mcp?.close().catch(()=>{});if(refresh&&clientId)await contexts[3]?.request.post(base+'/api/crm/mcp/oauth/revoke',{form:{token:refresh,client_id:clientId}}).catch(()=>{});
 await browser.close();await fs.writeFile(folder+'/browser-mcp-'+(process.env.BUYER_QA_STAGING==='true'?'staging':'local')+'.json',JSON.stringify({environment:process.env.BUYER_QA_STAGING==='true'?'STAGING PostgreSQL; real Edge and official MCP SDK':'LOCAL isolated PGlite; real Edge and official MCP SDK',status:complete?'PASS':'FAIL',cases,pageErrors,externalEmailSends:0},null,2)+'\n');
}
