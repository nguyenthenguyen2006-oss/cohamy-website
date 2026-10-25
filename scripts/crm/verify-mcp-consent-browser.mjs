import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const production=process.env.CRM_MCP_PRODUCTION==='true';
const origin='https://cohamy.vn',base=production?origin:'http://localhost:4347';
const folder='.local/mcp-origin-20261025',callback= 'https://chatgpt.com/connector_platform_oauth_redirect';
const cases=[],pass=name=>{cases.push({name,status:'PASS'});console.log('PASS '+name);};
await fs.mkdir(folder,{recursive:true});
const credentials=production?JSON.parse(execFileSync('ssh',['cohamy-prod','cat /root/cohamy-shared/initial-admin.json'],{encoding:'utf8'})):{email:'mcp-consent@crm-qa.invalid',password:'Mcp-Consent-QA-Only-2026!'};
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext(),page=await context.newPage();
page.setDefaultTimeout(30000);
let tokens,clientId,client,finished=false;
try{
 let returned;
 await page.route(origin+'/**',async route=>{
  const request=route.request(),url=new URL(request.url());
  const submitted=request.method()==='POST'&&url.pathname==='/api/crm/mcp/oauth/authorize';
  if(production&&!submitted)return route.continue();
  // Preserve actual browser headers and body. The staging transport alone is
  // proxied; capture the server's 303 without navigating into a ChatGPT account.
  const response=await route.fetch({...(!production?{url:base+url.pathname+url.search}:{}),maxRedirects:0});
  if(submitted&&response.status()===303){returned=new URL(response.headers().location);return route.fulfill({status:200,contentType:'text/html',body:'<p>OAuth callback captured by QA</p>'});}
  await route.fulfill({response});
 });
 await page.route('https://chatgpt.com/**',async route=>{returned=new URL(route.request().url());await route.fulfill({status:200,contentType:'text/html',body:'<p>OAuth callback captured by QA</p>'});});
 const registration=await context.request.post(base+'/api/crm/mcp/oauth/register',{data:{client_name:'Cohamy consent regression (revoked after QA)',redirect_uris:[callback]}});
 assert.equal(registration.status(),201);clientId=(await registration.json()).client_id;
 const verifier=randomBytes(32).toString('base64url'),state=randomUUID(),query=new URLSearchParams({client_id:clientId,redirect_uri:callback,response_type:'code',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',state,scope:'crm.admin',resource:origin+'/api/crm/mcp'});
 async function consent(){const response=await page.goto(origin+'/api/crm/mcp/oauth/authorize?'+query);assert.equal(response.status(),200);assert.equal(response.headers()['referrer-policy'],'same-origin');await expect(page.locator('input[name=secondFactor]')).toHaveCount(0);return (await page.locator('input[name=id]').inputValue());}
 const id=await consent();await page.screenshot({path:folder+(production?'/consent-production.png':'/consent-staging.png')});
 const proof=(await context.cookies(origin+'/api/crm/mcp/oauth/authorize')).find(c=>c.name==='cohamy_mcp_authorization');assert.ok(proof);
 const form={id,decision:'deny'};
 for(const badOrigin of ['null','https://attacker.invalid','']){
  const response=await context.request.post(base+'/api/crm/mcp/oauth/authorize',{headers:{origin:badOrigin,cookie:proof.name+'='+proof.value},form,maxRedirects:0});
  assert.equal(response.status(),403);assert.match(await response.text(),/INVALID_ORIGIN/);
 }
 const missingNonce=await context.request.post(base+'/api/crm/mcp/oauth/authorize',{headers:{origin,cookie:''},form,maxRedirects:0});assert.equal(missingNonce.status(),400);
 pass('Consent preserves strict Origin and browser nonce checks; opaque, foreign, missing origins and missing proof are rejected');
 const deniedRequest=page.waitForRequest(r=>r.method()==='POST'&&new URL(r.url()).pathname==='/api/crm/mcp/oauth/authorize');
 const [denial]=await Promise.all([deniedRequest,page.locator('button[value=deny]').click()]);
 assert.equal((await denial.allHeaders()).origin,origin);
 await expect(page.getByText('OAuth callback captured by QA')).toBeVisible();assert.equal(returned.searchParams.get('error'),'access_denied');assert.equal(returned.searchParams.has('code'),false);
 pass('Real Edge form denial sends the correct Origin without injected headers and returns access_denied');
 await consent();
 await page.locator('input[name=email]').fill(credentials.email);await page.locator('input[name=password]').fill('QA-intentionally-wrong');await page.locator('button[value=allow]').click();
 await expect(page.getByText('INVALID_CREDENTIALS',{exact:true})).toBeVisible();
 pass('Anonymous consent rejects an incorrect password before granting any access');
 await consent();await page.locator('input[name=email]').fill(credentials.email);await page.locator('input[name=password]').fill(credentials.password);
 const posted=page.waitForRequest(r=>r.method()==='POST'&&new URL(r.url()).pathname==='/api/crm/mcp/oauth/authorize');
 await page.locator('button[value=allow]').click();
 assert.equal((await(await posted).allHeaders()).origin,origin);
 await expect(page.getByText('OAuth callback captured by QA')).toBeVisible();assert.equal(returned.searchParams.get('state'),state);assert.ok(returned.searchParams.get('code'));
 assert.equal((await context.cookies(origin)).some(c=>c.name==='cohamy_crm_session'),false);
 pass(production?'Public HTTPS anonymous Admin password consent succeeds in Edge, without OTP or a CRM browser session':'Restored PostgreSQL Admin with active MFA approves in Edge using only the password, without a CRM browser session');
 const exchanged=await context.request.post(base+'/api/crm/mcp/oauth/token',{form:{grant_type:'authorization_code',client_id:clientId,redirect_uri:callback,code:returned.searchParams.get('code'),code_verifier:verifier,resource:origin+'/api/crm/mcp'}});assert.equal(exchanged.status(),200);tokens=await exchanged.json();
 client=new Client({name:'cohamy-consent-regression',version:'1.0.0'});await client.connect(new StreamableHTTPClientTransport(new URL(base+'/api/crm/mcp'),{requestInit:{headers:{authorization:'Bearer '+tokens.access_token}}}));
 assert.equal((await client.listTools()).tools.length,5);
 for(const operation of ['GET /api/crm/finance/receivables-workspace','GET /api/crm/inventory/balances']){const result=await client.callTool({name:'cohamy_read',arguments:{operation}});assert.ok(!result.isError);assert.equal(JSON.parse(result.content[0].text).status,200);}
 const catalog=await client.callTool({name:'cohamy_data_catalog',arguments:{table:'audit_events'}});assert.ok(!catalog.isError);
 const events=await client.callTool({name:'cohamy_data',arguments:{table:'audit_events',filters:[{column:'action',op:'eq',value:'mcp.password-verified'}],limit:1}});assert.ok(!events.isError);assert.ok(JSON.parse(events.content[0].text).items.length);
 pass('The password-authorized connection exposes all five tools and reads real native debt, stock, and the new authentication audit data');
 finished=true;
}catch(error){console.error('MCP_CONSENT_BROWSER_FAILED: '+(error instanceof assert.AssertionError?error.message:error?.name??'ERROR'));process.exitCode=1;}
finally{
 await client?.close().catch(()=>{});
 if(tokens){const revoked=await context.request.post(base+'/api/crm/mcp/oauth/revoke',{form:{token:tokens.refresh_token,client_id:clientId}});assert.equal(revoked.status(),200);}
 credentials.password='';await browser.close();
 await fs.writeFile(folder+(production?'/browser-production.json':'/browser-staging.json'),JSON.stringify({status:finished?'PASS':'FAIL',environment:production?'PRODUCTION public HTTPS, real Edge, official MCP SDK':'STAGING production build, restored native PostgreSQL; browser public hostname proxied to owned candidate without altering request headers',scope:'Authentication and business reads only; QA grant revoked; no stock, finance or email writes',cases},null,2)+'\n');
}
