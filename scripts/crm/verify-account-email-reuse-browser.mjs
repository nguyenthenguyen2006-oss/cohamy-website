import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const base='http://localhost:4367',origin='https://cohamy.vn',folder='docs/crm/test-results/account-email-reuse';
const fixture=JSON.parse(await fs.readFile('.local/account-email-reuse-20261030/fixture.json','utf8'));
assert.match(fixture.ui.email,/@reuse-qa\.invalid$/);assert.match(fixture.mcp.email,/@reuse-qa\.invalid$/);
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage();
page.setDefaultTimeout(45000);const cases=[],pass=name=>{cases.push({name,status:'PASS'});console.log('PASS '+name);};
let client,clientId,tokens,returned,cookie,complete=false;
try{
 await page.route(origin+'/**',async route=>{
  const url=new URL(route.request().url()),response=await route.fetch({url:base+url.pathname+url.search,maxRedirects:0});
  if(url.pathname==='/api/crm/mcp/oauth/authorize'&&route.request().method()==='POST'&&response.status()===303){returned=new URL(response.headers().location);return route.fulfill({status:200,contentType:'text/html',body:'<p>QA OAuth callback captured</p>'});}
  return route.fulfill({response});
 });
 assert.equal((await context.request.post(base+'/api/crm/accounts/provision',{headers:{origin},data:{}})).status(),401);
 const login=await context.request.post(base+'/api/crm/auth/login',{headers:{origin},data:{email:'admin@crm-qa.invalid',password:fixture.qaPassword}});assert.equal(login.status(),200);
 cookie=login.headers()['set-cookie'].match(/cohamy_crm_session=([^;]+)/)[1];await context.addCookies([{name:'cohamy_crm_session',value:cookie,url:origin,secure:true,httpOnly:true,sameSite:'Lax'}]);
 const native=async(method,path,data)=>{const response=await context.request.fetch(base+path,{method,headers:{origin,cookie:'cohamy_crm_session='+cookie},...(data?{data}:{})});assert.ok(response.ok(),path+' '+response.status());return response.json();};
 async function archived(prefix){const email=prefix+'-'+randomUUID()+'@reuse-qa.invalid',original=await native('POST','/api/crm/accounts/provision',{email,displayName:'QA archived '+prefix,role:'WAREHOUSE_HCM',organizationId:fixture.organizationId,loginMethod:'INVITATION',idempotencyKey:randomUUID()});const preview=await native('GET','/api/crm/accounts/'+original.membershipId+'/deletion-preview');await native('DELETE','/api/crm/accounts/'+original.membershipId,{expectedVersion:preview.expectedVersion,previewFingerprint:preview.previewFingerprint,confirmEmail:email,reason:'QA prepare email recreation case',idempotencyKey:randomUUID()});return {email,oldId:original.id};}
 fixture.ui=await archived('browser');fixture.mcp=await archived('mcp');
 const getAccounts=async()=>{const response=await context.request.get(base+'/api/crm/accounts',{headers:{cookie:'cohamy_crm_session='+cookie}});assert.equal(response.status(),200);const data=await response.json();return data.items??data;};
 assert.equal((await getAccounts()).filter(r=>r.email===fixture.ui.email).length,0);
 await page.goto(origin+'/crm/accounts/new');await page.getByLabel('Tên hiển thị',{exact:true}).fill('QA Cấp lại thủ kho Hà Nội');await page.getByLabel('Email',{exact:true}).fill(fixture.ui.email);
 await page.getByLabel('Vai trò',{exact:true}).selectOption('WAREHOUSE_HN');await page.getByLabel('Tổ chức sở hữu',{exact:true}).selectOption(fixture.organizationId);
 await page.getByRole('checkbox',{name:'Tạo và gửi lời mời kích hoạt qua email'}).uncheck();
 await page.getByRole('button',{name:'Tạo tài khoản',exact:true}).click();await expect(page).toHaveURL(/\/crm\/accounts\/[a-f0-9-]{36}$/);
 const current=(await getAccounts()).filter(r=>r.email===fixture.ui.email);assert.equal(current.length,1);assert.notEqual(current[0].user_id,fixture.ui.oldId);assert.equal(current[0].role,'WAREHOUSE_HN');
 await expect(page.getByText('Email đã có tài khoản. Mở tài khoản hiện có để quản lý.',{exact:true})).toHaveCount(0);
 await fs.mkdir(folder,{recursive:true});for(const width of [1366,390]){await page.setViewportSize({width,height:900});await page.screenshot({path:folder+'/recreated-account-'+width+'.png',fullPage:true});}
 pass('The exact Admin account-provisioning form recreates a deleted email in HN scope without an existing-email error or an outbound invitation');

 const callback='https://chatgpt.com/connector_platform_oauth_redirect';
 const registration=await context.request.post(base+'/api/crm/mcp/oauth/register',{data:{client_name:'Account reuse isolated QA',redirect_uris:[callback]}});assert.equal(registration.status(),201);clientId=(await registration.json()).client_id;
 const verifier=randomBytes(32).toString('base64url'),query=new URLSearchParams({client_id:clientId,redirect_uri:callback,response_type:'code',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',state:randomUUID(),scope:'crm.admin',resource:origin+'/api/crm/mcp'});
 await page.goto(origin+'/api/crm/mcp/oauth/authorize?'+query);
 if(await page.locator('input[name=email]').count()){await page.locator('input[name=email]').fill('admin@crm-qa.invalid');await page.locator('input[name=password]').fill(fixture.qaPassword);}
 await page.locator('button[value=allow]').click();await expect(page.getByText('QA OAuth callback captured')).toBeVisible();assert.ok(returned.searchParams.get('code'));
 const exchange=await context.request.post(base+'/api/crm/mcp/oauth/token',{form:{grant_type:'authorization_code',client_id:clientId,redirect_uri:callback,code:returned.searchParams.get('code'),code_verifier:verifier,resource:origin+'/api/crm/mcp'}});assert.equal(exchange.status(),200);tokens=await exchange.json();
 client=new Client({name:'email-reuse-qa',version:'1.0.0'});await client.connect(new StreamableHTTPClientTransport(new URL(base+'/api/crm/mcp'),{requestInit:{headers:{authorization:'Bearer '+tokens.access_token}}}));
 const tool=async(name,input)=>{const response=await client.callTool({name,arguments:input});assert.ok(!response.isError);return JSON.parse(response.content.find(c=>c.type==='text').text);};
 const capabilities=await tool('cohamy_capabilities',{operation:'POST /api/crm/accounts/provision'});assert.equal(capabilities.operations[0].status,'AVAILABLE');
 const catalog=await tool('cohamy_data_catalog',{table:'users'});assert.ok(catalog.tables.users.some(c=>c.column==='deleted_at'));assert.ok(!catalog.tables.users.some(c=>c.column==='password_hash'));
 const prior=await tool('cohamy_data',{table:'users',filters:[{column:'email',op:'eq',value:fixture.mcp.email}],limit:10});assert.equal(prior.total,1);assert.ok(prior.items[0].deleted_at);
 const input={email:fixture.mcp.email,displayName:'QA MCP cấp lại',role:'WAREHOUSE_HN',organizationId:fixture.organizationId,loginMethod:'INVITATION',idempotencyKey:randomUUID()};
 const command={operation:'POST /api/crm/accounts/provision',requestId:randomUUID(),input};
 const created=await tool('cohamy_write',command);assert.equal(created.result.status,201);assert.notEqual(created.result.data.id,fixture.mcp.oldId);assert.equal(created.result.data.status,'PENDING_ACTIVATION');
 assert.equal((await tool('cohamy_write',command)).replayed,true);assert.equal((await tool('cohamy_write',{...command,requestId:randomUUID()})).result.status,201);
 pass('Official MCP SDK recreates a deleted email through the native Admin API and both retry layers return the original result');
 const after=await tool('cohamy_data',{table:'users',filters:[{column:'email',op:'eq',value:fixture.mcp.email}],limit:10});assert.equal(after.total,2);assert.equal(after.items.filter(r=>!r.deleted_at).length,1);assert.equal(after.items.find(r=>r.id===fixture.mcp.oldId).active,false);
 const list=await tool('cohamy_read',{operation:'GET /api/crm/accounts'});assert.equal(list.status,200);assert.equal((list.data.items??list.data).filter(r=>r.email===fixture.mcp.email).length,1);
 assert.ok(!JSON.stringify(after).includes('password_hash'));
 const conflict=await tool('cohamy_write',{...command,requestId:randomUUID(),input:{...input,idempotencyKey:randomUUID()}});assert.equal(conflict.result.status,409);assert.equal(conflict.result.data.error,'ACCOUNT_ALREADY_EXISTS');
 pass('MCP reads retained deleted history and one current account; duplicate live emails still fail without leaking credentials');
 complete=true;
}catch(error){console.error(String(error.stack??error).replaceAll(fixture.qaPassword,'[QA CREDENTIAL]'));process.exitCode=1;}
finally{
 await client?.close().catch(()=>{});
 if(tokens){const revoked=await context.request.post(base+'/api/crm/mcp/oauth/revoke',{form:{token:tokens.refresh_token,client_id:clientId}});assert.equal(revoked.status(),200);}
 if(cookie)await context.request.post(base+'/api/crm/auth/logout',{headers:{origin,cookie:'cohamy_crm_session='+cookie}}).catch(()=>{});
 await browser.close();await fs.mkdir(folder,{recursive:true});await fs.writeFile(folder+'/browser-mcp-staging.json',JSON.stringify({status:complete?'PASS':'FAIL',environment:'STAGING production build; native PostgreSQL restricted runtime role; fictitious .invalid accounts only',cases,externalEmails:0,productionAccountWrites:0,qaGrantRevoked:Boolean(tokens)},null,2)+'\n');
}
