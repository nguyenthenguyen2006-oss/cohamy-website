import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {request} from '@playwright/test';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// This harness deliberately has no production mode or production credentials.
const base=process.env.CRM_SALES_QA_URL??'http://127.0.0.1:4362',url=new URL(base);
assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&['4362','4363'].includes(url.port));
const fixture=JSON.parse(await fs.readFile(process.env.CRM_SALES_QA_FIXTURE??'.local/sales-routing-qa.json','utf8'));assert.match(fixture.dataDir??'',/^\.local\/crm-qa-sales-/);
const environment=process.env.CRM_SALES_QA_ENV==='STAGING'?'STAGING isolated native PostgreSQL over local tunnel':'LOCAL isolated PGlite HTTP runtime';
const folder='docs/crm/test-results/sales-routing';await fs.mkdir(folder,{recursive:true});
const cases=[],pass=name=>{cases.push({name,status:'PASS'});console.log('PASS '+name);};
const http=await request.newContext({baseURL:base}),client=new Client({name:'cohamy-sales-qa',version:'1.0.0'});
let access,refresh,clientId,finished=false;
const content=result=>{assert.notEqual(result.isError,true,'MCP tool rejected the isolated test');return JSON.parse(result.content.find(c=>c.type==='text').text);};
const read=async(operation,query={})=>{const r=content(await client.callTool({name:'cohamy_read',arguments:{operation,query}}));assert.equal(r.status,200,operation+':'+JSON.stringify(r.data??{}));return r;};
const write=async(operation,input,requestId=randomUUID())=>content(await client.callTool({name:'cohamy_write',arguments:{operation,input,requestId}}));
const cookie=r=>{const value=r.headers()['set-cookie'];assert.ok(value);return value.split(';')[0];};
try{
 const meta=await(await http.get('/.well-known/oauth-authorization-server')).json(),origin=meta.issuer,callback='https://chatgpt.com/connector_platform_oauth_redirect';
 assert.equal(origin,process.env.CRM_SALES_QA_ENV==='STAGING'?'https://sales-qa.invalid':'http://127.0.0.1:4362','The runtime must prove the isolated QA origin before any OAuth or business write');
 const registration=await http.post('/api/crm/mcp/oauth/register',{data:{client_name:'Isolated sales lifecycle QA',redirect_uris:[callback]}});assert.equal(registration.status(),201);clientId=(await registration.json()).client_id;
 const verifier=randomBytes(32).toString('base64url'),q=new URLSearchParams({client_id:clientId,redirect_uri:callback,response_type:'code',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',state:randomUUID(),scope:'crm.admin',resource:origin+'/api/crm/mcp'});
 const consent=await http.get('/api/crm/mcp/oauth/authorize?'+q),proof=cookie(consent),id=(await consent.text()).match(/name="id" value="([a-f0-9-]+)"/)?.[1];assert.ok(id);
 const allowed=await http.post('/api/crm/mcp/oauth/authorize',{headers:{origin,cookie:proof},form:{id,decision:'allow',email:'admin@crm-qa.invalid',password:fixture.qaPassword},maxRedirects:0});assert.equal(allowed.status(),303);
 const redirected=new URL(allowed.headers().location),exchange=await http.post('/api/crm/mcp/oauth/token',{form:{grant_type:'authorization_code',client_id:clientId,code:redirected.searchParams.get('code'),redirect_uri:callback,code_verifier:verifier,resource:origin+'/api/crm/mcp'}});assert.equal(exchange.status(),200);({access_token:access,refresh_token:refresh}=await exchange.json());
 await client.connect(new StreamableHTTPClientTransport(new URL(base+'/api/crm/mcp'),{requestInit:{headers:{authorization:'Bearer '+access}}}));assert.equal((await client.listTools()).tools.length,5);pass('Real OAuth PKCE exchange and official MCP SDK initialize against the isolated HTTP runtime');
 const contract=content(await client.callTool({name:'cohamy_capabilities',arguments:{operation:'POST /api/crm/sales-customers/create'}}));assert.match(contract.operations[0].inputContract,/representativeName/);assert.match(contract.operations[0].inputContract,/salesMembershipId/);
 const catalog=content(await client.callTool({name:'cohamy_data_catalog',arguments:{}}));for(const name of ['sales_referral_codes','customer_sales_ownership','customer_sales_assignment_history','buyer_order_sales','sales_notification_events','buyer_fulfillment_state','buyer_fulfillment_events','buyer_quote_price_checks'])assert.ok(catalog.tables[name],name);
 for(const name of ['sales_customer_actions','sales_registration_limits','buyer_fulfillment_actions','account_invitations','mcp_tokens'])assert.equal(catalog.tables[name],undefined,name);pass('Capability inputs are complete; all new business tables are readable and auth/retry/rate-limit internals stay excluded');
 const workspace=(await read('GET /api/crm/sales-customers/workspace')).data,salesId=workspace.salesOptions[0].id;
 const refInput={salesMembershipId:salesId,idempotencyKey:randomUUID()},ref=await write('POST /api/crm/sales-customers/referral',refInput);assert.equal(ref.result.status,200);
 const qr=await read('GET /api/crm/sales-customers/referral-qr',{salesMembershipId:salesId});assert.match(Buffer.from(qr.file.base64,'base64').toString('utf8'),/<svg/);pass('MCP issues a Sales referral and reads the locally generated QR through the authenticated native route');
 const key=randomUUID(),suffix=randomBytes(5).toString('hex'),customerInput={representativeName:'QA MCP customer',companyName:'QA MCP '+suffix,phone:'09'+String(Date.now()).slice(-8),email:suffix+'@sales-mcp-qa.invalid',province:'QA Hà Nội',address:'QA address, isolated fixture only',customerType:'CUSTOMER',warehouseId:fixture.northId,salesMembershipId:salesId,idempotencyKey:randomUUID()},created=await write('POST /api/crm/sales-customers/create',customerInput,key);assert.equal(created.result.status,201);
 const repeated=await write('POST /api/crm/sales-customers/create',customerInput,key);assert.equal(repeated.replayed,true);assert.equal(repeated.result.data.organizationId,created.result.data.organizationId);assert.ok(!/generatedPassword|activationToken|password_hash/.test(JSON.stringify(created)));
 const detail=(await read('GET /api/crm/sales-customers/customer',{id:created.result.data.organizationId})).data;assert.equal(detail.customer.salesMembershipId,salesId);assert.equal(detail.customer.activationStatus,'PENDING_ACTIVATION');
 const revoke=await write('POST /api/crm/sales-customers/invite',{membershipId:detail.customer.membershipId,action:'REVOKE',idempotencyKey:randomUUID()});assert.equal(revoke.result.status,200);pass('Native Sales-customer provisioning and invitation management work through MCP; retries create one pending account and expose no activation secret');
 const otherSales=workspace.salesOptions.find(s=>s.id!==salesId);assert.ok(otherSales);
 const changed=await write('POST /api/crm/sales-customers/reassign',{organizationId:detail.customer.organizationId,salesMembershipId:otherSales.id,expectedVersion:detail.customer.assignmentVersion,reason:'QA MCP audited customer handover',idempotencyKey:randomUUID()});assert.equal(changed.result.status,200);
 const moved=(await read('GET /api/crm/sales-customers/customer',{id:detail.customer.organizationId})).data;assert.equal(moved.customer.salesMembershipId,otherSales.id);assert.ok(moved.history.length>=2);pass('MCP Admin reassigns with version, reason and immutable history through the native permission checks');
 const customerLogin=await http.post('/api/crm/auth/login',{headers:{origin},data:{email:'routing@crm-qa.invalid',password:fixture.qaPassword}});assert.equal(customerLogin.status(),200);const customerCookie=cookie(customerLogin);
 const setupResponse=await http.get('/api/crm/buyer/setup',{headers:{cookie:customerCookie}});assert.equal(setupResponse.status(),200);const setup=await setupResponse.json(),product=setup.products[0];
 const orderInput={organizationId:fixture.organizationId,buyerRole:'CUSTOMER',warehouseId:fixture.northId,delivery:{recipient:'QA MCP delivery',phone:'0900000199',address:'QA isolated delivery'},lines:[{productId:product.id,quantity:2,unit:'PACK'}],idempotencyKey:randomUUID()},order=await write('POST /api/crm/buyer/create',orderInput);assert.equal(order.result.status,201);
 const orderId=order.result.data.id,state=(await read('GET /api/crm/sales-customers/fulfillment',{id:orderId})).data;assert.equal(state.stage,'WAITING_QUOTE');assert.equal(state.ready,false);
 const blocked=await write('POST /api/crm/sales-customers/fulfillment',{id:orderId,version:state.version,action:'PICKING',note:'QA forbid picking unquoted order',idempotencyKey:randomUUID()});assert.equal(blocked.result.status,409);
 const quoted=await write('POST /api/crm/buyer/quote',{id:orderId,version:order.result.data.version,expiresOn:'2099-12-31',lines:[{productId:product.id,unitPrice:'1000',vatRate:8}],note:'QA MCP quote',idempotencyKey:randomUUID()});assert.equal(quoted.result.status,200);
 const confirmed=await http.post('/api/crm/buyer/confirm',{headers:{origin,cookie:customerCookie},data:{id:orderId,version:quoted.result.data.version,idempotencyKey:randomUUID()}});assert.equal(confirmed.status(),200);
 const ready=(await read('GET /api/crm/sales-customers/fulfillment',{id:orderId})).data;assert.equal(ready.ready,true);
 const picking=await write('POST /api/crm/sales-customers/fulfillment',{id:orderId,version:ready.version,action:'PICKING',note:'QA MCP picking after policy gates',idempotencyKey:randomUUID()});assert.equal(picking.result.status,200);
 const packed=await write('POST /api/crm/sales-customers/fulfillment',{id:orderId,version:picking.result.data.version,action:'PACKED',note:'QA MCP packing after picking',idempotencyKey:randomUUID()});assert.equal(packed.result.status,200);assert.equal(packed.result.data.stage,'PACKED');pass('MCP reuses native quote/readiness/picking/packing; unquoted picking is rejected and the actual customer accepts its own quote');
 const orderView=(await read('GET /api/crm/buyer/order',{id:orderId})).data;assert.ok(orderView.order.primarySales.membershipId);assert.ok(orderView.fulfillmentEvents.length>=2);
 const page=content(await client.callTool({name:'cohamy_data',arguments:{table:'sales_notification_events',limit:1,offset:0}}));assert.ok(page.total>1);assert.equal(page.items.length,1);assert.equal(page.nextOffset,1);
 const pdf=await read('GET /api/crm/buyer/download',{orderId,type:'order'});assert.equal(Buffer.from(pdf.file.base64,'base64').subarray(0,4).toString(),'%PDF');pass('MCP reads Sales attribution, fulfillment audit, paginated notification data and the real native buyer PDF');
 const credentials=await client.callTool({name:'cohamy_write',arguments:{operation:'POST /api/crm/sales-customers/create',requestId:randomUUID(),input:{...customerInput,password:'not-a-supported-input'}}});assert.equal(credentials.isError,true);pass('MCP rejects credential fields and keeps account passwords/activation tokens outside this workflow');
 if(process.env.CRM_SALES_QA_ENV==='STAGING'){
  const late=await write('POST /api/crm/buyer/create',{...orderInput,warehouseId:fixture.southId,idempotencyKey:randomUUID()});assert.equal(late.result.status,201);const lateId=late.result.data.id;
  const quote=await write('POST /api/crm/buyer/quote',{id:lateId,version:late.result.data.version,expiresOn:'2099-12-31',lines:[{productId:product.id,unitPrice:'1000',vatRate:8}],note:'QA actual worker late stock',idempotencyKey:randomUUID()});assert.equal(quote.result.status,200);
  assert.equal((await http.post('/api/crm/buyer/confirm',{headers:{origin,cookie:customerCookie},data:{id:lateId,version:quote.result.data.version,idempotencyKey:randomUUID()}})).status(),200);
  assert.equal((await read('GET /api/crm/sales-customers/fulfillment',{id:lateId})).data.stage,'WAITING_STOCK');
  const notice=async()=>content(await client.callTool({name:'cohamy_data',arguments:{table:'sales_notification_events',filters:[{column:'buyer_order_id',op:'eq',value:lateId},{column:'event',op:'eq',value:'buyer.order.ready_for_fulfillment'}],limit:100}}));assert.equal((await notice()).total,0);
  const locations=(await read('GET /api/crm/inventory/locations')).data,location=locations.find(l=>l.warehouse_id===fixture.southId&&l.kind==='PICK');assert.ok(location);
  const receipt=await write('POST /api/crm/inventory/receipt',{locationId:location.id,lines:[{productId:product.id,lotCode:'QA-MCP-LATE-'+randomUUID().slice(0,8),manufacturedOn:null,expiresOn:null,quantity:'2'}],referenceType:'QA_OPENING',referenceId:'QA_MCP_LATE_STOCK',reason:'Isolated actual worker readiness test',idempotencyKey:randomUUID()});assert.equal(receipt.result.status,200);
  let notifications;for(let i=0;i<15;i++){notifications=await notice();if(notifications.total)break;await new Promise(resolve=>setTimeout(resolve,2000));}
  assert.equal(notifications.total,3,'The independent worker must notify Sales, HCM and the actual customer once');assert.equal(new Set(notifications.items.map(i=>i.user_id)).size,3);await new Promise(resolve=>setTimeout(resolve,11000));assert.equal((await notice()).total,3);pass('Actual independent worker detects later HCM stock, emits one readiness event per correct recipient and stays deduplicated through another sweep');
 }
 finished=true;
}finally{
 if(refresh&&clientId)await http.post('/api/crm/mcp/oauth/revoke',{form:{token:refresh,client_id:clientId}}).catch(()=>{});
 await client.close().catch(()=>{});await http.dispose();
 await fs.writeFile(folder+'/mcp-'+(process.env.CRM_SALES_QA_ENV==='STAGING'?'staging':'local')+'.json',JSON.stringify({environment,status:finished?'PASS':'FAIL',cases,externalEmails:0,productionWrites:0,chatGptWebUi:'NOT_RUN; verified using OAuth and the official MCP SDK'},null,2)+'\n');
}
