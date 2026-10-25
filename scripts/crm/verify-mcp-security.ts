import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {database} from '../../lib/crm/db';
import {membershipPrincipal,digest} from '../../lib/crm/auth';
import {authorizationRequest,approveAuthorization,exchangeToken,bearerPrincipal,registerClient,requireMcpAdmin} from '../../lib/crm/mcp/oauth';
import {browseData,dataCatalog} from '../../lib/crm/mcp/data';

async function main(){
const [membershipId,output]=process.argv.slice(2),url=new URL(process.env.CRM_DATABASE_URL??'');
assert.equal(process.env.CRM_ENVIRONMENT,'STAGING');assert.equal(process.env.CRM_DATABASE_MODE,'postgres');assert.match(url.pathname,/^\/cohamy_restore_[a-f0-9]{32}$/);assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.port==='55432');assert.ok(output);
const db=await database(),cases:{name:string;status:string}[]=[],pass=(name:string)=>cases.push({name,status:'PASS'});
let complete=false;
try{
 const user=await membershipPrincipal(membershipId);assert.ok(user&&user.role==='ADMIN');
 for(const role of ['ACCOUNTANT','SALES','MANAGER','FACTORY','WAREHOUSE_HN','DEALER_OWNER'] as const)assert.throws(()=>requireMcpAdmin({...user,role}),/FORBIDDEN/);assert.throws(()=>requireMcpAdmin({...user,area:'portal'}),/FORBIDDEN/);pass('Only current internal Admin identity may authorize or use the Admin MCP');
 const client=await registerClient({client_name:'STAGING security test',redirect_uris:['https://chatgpt.com/connector_platform_oauth_redirect']});
 const verifier=randomBytes(32).toString('base64url'),request={client_id:client.client_id,redirect_uri:client.redirect_uris[0],response_type:'code',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',state:randomUUID(),resource:'https://cohamy.vn/api/crm/mcp'};
 await assert.rejects(authorizationRequest({...request,redirect_uri:'https://attacker.invalid'}));await assert.rejects(authorizationRequest({...request,resource:'https://attacker.invalid'}));await assert.rejects(authorizationRequest({...request,code_challenge_method:'plain'}));pass('Unregistered redirects, different resource audiences and plain PKCE are rejected');
 const pending=await authorizationRequest(request);await assert.rejects(approveAuthorization(user,pending.id,randomBytes(32).toString('base64url'),true));
 const deniedRequest=await authorizationRequest(request),denied=new URL(await approveAuthorization(null,deniedRequest.id,deniedRequest.nonce,false));assert.equal(denied.searchParams.get('error'),'access_denied');assert.equal(denied.searchParams.get('iss'),'https://cohamy.vn');assert.equal(denied.searchParams.has('code'),false);pass('Denying consent needs no login and never issues an authorization code');
 const redirected=new URL(await approveAuthorization(user,pending.id,pending.nonce,true));await assert.rejects(approveAuthorization(user,pending.id,pending.nonce,true));pass('Authorization nonce is bound to the pending request and can be consumed only once');
 const exchange={grant_type:'authorization_code',client_id:client.client_id,redirect_uri:request.redirect_uri,code:redirected.searchParams.get('code')!,code_verifier:verifier,resource:request.resource};
 await assert.rejects(exchangeToken({...exchange,resource:'https://attacker.invalid'}));await assert.rejects(exchangeToken({...exchange,client_id:'different_client'}));
 const tokens=await exchangeToken(exchange),identity=await bearerPrincipal(tokens.access_token);assert.equal(identity.user.membershipId,user.membershipId);pass('Codes and bearer credentials remain bound to the client, audience and Admin membership');
 await db.query("UPDATE cohamy_crm.mcp_tokens SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[digest(tokens.access_token)]);await assert.rejects(bearerPrincipal(tokens.access_token));pass('Expired access credentials cannot read any MCP tools or records');
 const renewed=await exchangeToken({grant_type:'refresh_token',client_id:client.client_id,refresh_token:tokens.refresh_token});
 await db.query('UPDATE cohamy_crm.memberships SET version=version+1 WHERE id=$1',[user.membershipId]);
 try{await assert.rejects(bearerPrincipal(renewed.access_token));await assert.rejects(exchangeToken({grant_type:'refresh_token',client_id:client.client_id,refresh_token:renewed.refresh_token}));}finally{await db.query('UPDATE cohamy_crm.memberships SET version=$2 WHERE id=$1',[user.membershipId,user.membershipVersion]);}pass('Membership changes invalidate access and refresh credentials immediately');
 const original=(await db.query<{password_hash:string}>('SELECT password_hash FROM cohamy_crm.users WHERE id=$1',[user.id])).rows[0];
 try{await db.query('UPDATE cohamy_crm.users SET password_hash=$2 WHERE id=$1',[user.id,original.password_hash+'-STAGING-revocation-test']);await assert.rejects(bearerPrincipal(renewed.access_token));}finally{await db.query('UPDATE cohamy_crm.users SET password_hash=$2 WHERE id=$1',[user.id,original.password_hash]);}pass('A password change revokes all delegated MCP connections through the database trigger');
 const catalog=await dataCatalog(user);for(const table of Object.keys(catalog.tables))assert.ok(!/^(mcp_|mfa_|sessions$|password_reset_tokens$)/.test(table));
 for(const table of ['sales_orders','stock_movements','receivables','payment_receipts','historical_order_invoices','document_flow_documents'])if(catalog.tables[table])assert.ok((await browseData(user,{table,limit:1})).items);
 await assert.rejects(browseData(user,{table:'organizations; DROP TABLE users'}));await assert.rejects(browseData(user,{table:'users',orderBy:'password_hash'}));await assert.rejects(browseData(user,{table:'users',filters:[{column:'password_hash',op:'contains',value:'x'}]}));pass('All business domains can be paged while SQL identifiers and sensitive columns fail closed');
 complete=true;
}finally{await fs.writeFile(output,JSON.stringify({environment:'STAGING native restored PostgreSQL',status:complete?'PASS':'FAIL',cases},null,2)+'\n');await db.close();}
}
main().catch(e=>{console.error(e instanceof Error?e.message:'MCP_SECURITY_QA_FAILED');process.exitCode=1;});
