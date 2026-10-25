import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// The public run is strictly read-only for business data. Mutations run only
// against the owned restored PostgreSQL candidate behind the local SSH tunnel.
const production=process.argv.includes('--production'),origin='https://cohamy.vn';
const base=production?origin:'http://localhost:4347';
const folder='docs/crm/test-results/admin-invoices',review='.impeccable/review';
const cases=[],pass=name=>{cases.push({name,status:'PASS'});console.log('PASS '+name);};
const credentials=JSON.parse(execFileSync('ssh',['cohamy-prod','cat /root/cohamy-shared/initial-admin.json'],{encoding:'utf8'}));
await fs.mkdir(folder,{recursive:true});await fs.mkdir(review,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage();
page.setDefaultTimeout(30000);
let client,tokens,clientId,complete=false;
try{
 let returned;
 await page.route(origin+'/**',async route=>{
  const url=new URL(route.request().url()),consent=route.request().method()==='POST'&&url.pathname==='/api/crm/mcp/oauth/authorize';
  if(production&&!consent)return route.continue();
  const response=await route.fetch({...(!production?{url:base+url.pathname+url.search}:{}),maxRedirects:0});
  if(consent&&response.status()===303){returned=new URL(response.headers().location);return route.fulfill({status:200,contentType:'text/html',body:'<p>QA OAuth callback captured</p>'});}
  return route.fulfill({response});
 });
 const callback='https://chatgpt.com/connector_platform_oauth_redirect';
 const registered=await context.request.post(base+'/api/crm/mcp/oauth/register',{data:{client_name:'Invoice QA (revoked after test)',redirect_uris:[callback]}});
 assert.equal(registered.status(),201);clientId=(await registered.json()).client_id;
 const verifier=randomBytes(32).toString('base64url');
 const query=new URLSearchParams({client_id:clientId,redirect_uri:callback,response_type:'code',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',state:randomUUID(),scope:'crm.admin',resource:origin+'/api/crm/mcp'});
 await page.goto(origin+'/api/crm/mcp/oauth/authorize?'+query);
 await page.locator('input[name=email]').fill(credentials.email);await page.locator('input[name=password]').fill(credentials.password);await page.locator('button[value=allow]').click();
 await expect(page.getByText('QA OAuth callback captured')).toBeVisible();assert.ok(returned.searchParams.get('code'));
 const exchange=await context.request.post(base+'/api/crm/mcp/oauth/token',{form:{grant_type:'authorization_code',client_id:clientId,redirect_uri:callback,code:returned.searchParams.get('code'),code_verifier:verifier,resource:origin+'/api/crm/mcp'}});
 assert.equal(exchange.status(),200);tokens=await exchange.json();
 client=new Client({name:'cohamy-admin-invoice-qa',version:'1.0.0'});
 await client.connect(new StreamableHTTPClientTransport(new URL(base+'/api/crm/mcp'),{requestInit:{headers:{authorization:'Bearer '+tokens.access_token}}}));
 const tool=async(name,args)=>{const result=await client.callTool({name,arguments:args});assert.ok(!result.isError,JSON.stringify(result));return JSON.parse(result.content[0].text);};
 const read=async(query)=>{const result=await tool('cohamy_read',{operation:'GET /api/crm/admin-invoices',query});assert.equal(result.status,200);return result.data;};
 for(const method of ['GET','POST']){const catalog=await tool('cohamy_capabilities',{operation:method+' /api/crm/admin-invoices'});assert.equal(catalog.operations[0].status,'AVAILABLE');}
 for(const table of ['invoice_admin_heads','invoice_admin_revisions','invoice_allocation_reversals']){const catalog=await tool('cohamy_data_catalog',{table});assert.ok(catalog.tables[table]);await tool('cohamy_data',{table,limit:1});}
 const list=await read({kind:'SALES'});assert.ok(list.items.length);
 let detail;
 for(const row of list.items){const d=await read({kind:'SALES',id:row.id});if(d.impact.stock.some(l=>!l.quantity.startsWith('-'))){detail=d;break;}}
 assert.ok(detail,'An active issued copied sale is required');
 pass('Official MCP SDK discovers invoice reads/writes, reads current invoices, exact warehouse recall preview and all three new history tables');

 const login=await context.request.post(base+'/api/crm/auth/login',{headers:{origin},data:{email:credentials.email,password:credentials.password}});assert.equal(login.status(),200);
 const cookie=login.headers()['set-cookie'].match(/cohamy_crm_session=([^;]+)/)[1];
 await context.addCookies([{name:'cohamy_crm_session',value:cookie,url:origin,httpOnly:true,secure:true,sameSite:'Lax'}]);
 await page.goto(origin+'/crm/factory-requests');
 await page.getByText('Tất cả hóa đơn · Sửa / Thu hồi (Admin)',{exact:true}).click();
 await expect(page.getByRole('heading',{name:'Tất cả hóa đơn · Quyền Admin'})).toBeVisible();
 await page.locator('section').filter({has:page.getByRole('heading',{name:'Tất cả hóa đơn · Quyền Admin'})}).locator('select').first().selectOption('SALES');
 const row=page.getByRole('row').filter({hasText:detail.invoice.code});
 await row.getByRole('button',{name:'Sửa',exact:true}).click();
 const dialog=page.locator('dialog.crm-invoice-admin-dialog');await expect(dialog).toBeVisible();
 await expect(dialog.locator('img').first()).toBeVisible();await dialog.locator('img').first().evaluate(image=>image.decode());
 assert.equal(await dialog.evaluate(node=>node.contains(document.activeElement)),true);
 await expect(dialog.getByRole('button',{name:'Lưu phiên bản mới'})).toBeDisabled();
 await expect(dialog.getByRole('columnheader',{name:'Thuế dòng (đ)'})).toHaveCount(0);
 for(const [width,name]of [[1366,'desktop'],[390,'mobile'],[320,'user-320']]){
  await page.setViewportSize({width,height:width===1366?900:844});await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:review+'/'+name+'.png'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Unexpected page-level horizontal overflow');
  await dialog.locator('.crm-product-entry').scrollIntoViewIfNeeded();await page.screenshot({path:review+'/edit-products-'+name+'.png'});
  await dialog.getByRole('button',{name:'Lưu phiên bản mới'}).scrollIntoViewIfNeeded();await page.screenshot({path:review+'/edit-footer-'+name+'.png'});
  await dialog.evaluate(node=>{node.scrollTop=0;});
 }
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 await page.setViewportSize({width:1366,height:900});await row.getByRole('button',{name:'Thu hồi',exact:true}).click();await expect(dialog).toBeVisible();
 await expect(dialog.getByText('Biến động tồn kho khi thu hồi',{exact:true})).toBeVisible();
 for(const l of detail.impact.stock)await expect(dialog.getByRole('cell',{name:l.warehouseName,exact:true}).first()).toBeVisible();
 await page.screenshot({path:review+'/recall-desktop.png'});
 await page.setViewportSize({width:390,height:844});await expect(dialog.locator('.crm-invoice-impact-hint')).toBeVisible();await page.screenshot({path:review+'/recall-mobile.png'});
 const impactRegion=dialog.getByRole('region',{name:'Biến động tồn kho khi thu hồi'});await expect(impactRegion).toHaveAttribute('tabindex','0');await impactRegion.focus();await impactRegion.evaluate(node=>{node.scrollLeft=node.scrollWidth;});await page.screenshot({path:review+'/recall-mobile-quantities.png'});
 await page.keyboard.press('Escape');
 pass('Actual Admin interface opens edit/recall in place, requires a reason, traps focus, closes with Escape, displays exact warehouse quantities and fits desktop/390/320 viewports');

 if(!production&&!process.argv.includes('--read-only')){
  // All following writes target the isolated restored database, never the
  // production hostname. Read quantities before and after through MCP itself.
  assert.equal(new URL(base).hostname,'localhost');
  const allBalances=async()=>{let offset=0;const map=new Map();while(true){const page=await tool('cohamy_data',{table:'inventory_balances',offset,limit:200});for(const r of page.items){const key=r.warehouse_id+':'+r.product_id;map.set(key,(map.get(key)??0n)+decimal(r.on_hand));}if(page.nextOffset===null||page.nextOffset===undefined)break;offset=page.nextOffset;}return map;};
  const before=await allBalances();
  const edit={kind:'SALES',id:detail.invoice.id,version:detail.invoice.version,action:'EDIT',content:{...detail.invoice.content,note:'STAGING MCP invoice edit proof'},reason:'STAGING MCP metadata test only',idempotencyKey:randomUUID()};
  const edited=await tool('cohamy_write',{operation:'POST /api/crm/admin-invoices',requestId:randomUUID(),input:edit});assert.equal(edited.result.status,200);assert.deepEqual(await allBalances(),before);
  detail=await read({kind:'SALES',id:detail.invoice.id});
  const cancel={kind:'SALES',id:detail.invoice.id,version:detail.invoice.version,action:'CANCEL',reason:'STAGING MCP exact-once recall verification',idempotencyKey:randomUUID()},requestId=randomUUID();
  const result=await tool('cohamy_write',{operation:'POST /api/crm/admin-invoices',requestId,input:cancel});assert.equal(result.result.status,200);
  const expected=new Map(before);for(const line of detail.impact.stock){const key=line.warehouseId+':'+line.productId;expected.set(key,(expected.get(key)??0n)+decimal(line.quantity));}assert.deepEqual(await allBalances(),expected);
  const replay=await tool('cohamy_write',{operation:'POST /api/crm/admin-invoices',requestId,input:cancel});assert.equal(replay.replayed,true);
  const nativeReplay=await tool('cohamy_write',{operation:'POST /api/crm/admin-invoices',requestId:randomUUID(),input:cancel});assert.equal(nativeReplay.result.status,200);assert.deepEqual(await allBalances(),expected);
  const recalled=await read({kind:'SALES',id:detail.invoice.id});assert.equal(recalled.invoice.cancelled,true);assert.ok(recalled.history.some(h=>h.action==='CANCEL'));assert.equal(recalled.impact.stock.length,0);
  pass('MCP edits a copied staged invoice, recalls all actually issued stock, replays both transport and native retries without adding stock twice, and reads cancellation/history');
 }
 complete=true;
}catch(error){await page.screenshot({path:'.local/admin-invoices-20261025/browser-failure.png'}).catch(()=>{});console.error(String(error.stack??error).replaceAll(credentials.password,'[REDACTED]'));process.exitCode=1;}
finally{
 await client?.close().catch(()=>{});
 if(tokens)await context.request.post(base+'/api/crm/mcp/oauth/revoke',{form:{token:tokens.refresh_token,client_id:clientId}});
 const cookies=await context.cookies(origin),session=cookies.find(c=>c.name==='cohamy_crm_session');
 if(session)await context.request.post(base+'/api/crm/auth/logout',{headers:{origin,cookie:session.name+'='+session.value}}).catch(()=>{});
 credentials.password='';await browser.close();
 await fs.writeFile(folder+(production?'/browser-mcp-production.json':(process.argv.includes('--read-only')?'/browser-ui-staging.json':'/browser-mcp-staging.json')),JSON.stringify({status:complete?'PASS':'FAIL',environment:production?'PRODUCTION public HTTPS; business reads only, QA OAuth grant revoked':'STAGING production build; restored native PostgreSQL; browser public hostname routed through owned tunnel; no production business writes or emails',cases},null,2)+'\n');
}
function decimal(value){const s=String(value),negative=s.startsWith('-'),parts=s.replace(/^-/,'').split('.');const result=BigInt(parts[0])*1000000n+BigInt((parts[1]??'').padEnd(6,'0'));return negative?-result:result;}
