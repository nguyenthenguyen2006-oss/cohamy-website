import 'server-only';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { database, type Sql } from '../db';
import { audit, digest, membershipPrincipal, assertCurrentPrincipal } from '../auth';
import { CrmError } from '../permissions';
import type { Principal } from '../types';

export const MCP_SCOPE = 'crm.admin';
const secret = () => randomBytes(32).toString('base64url');
export function mcpOrigin() {
  const value = process.env.CRM_PUBLIC_ORIGIN;
  if (!value || new URL(value).origin !== value || (!value.startsWith('https://') && process.env.CRM_ENVIRONMENT !== 'LOCAL')) throw new CrmError('MCP_ORIGIN_REQUIRED',503);
  return value;
}
export const mcpResource = () => mcpOrigin() + '/api/crm/mcp';
export function requireMcpAdmin(user: Principal) {
  if (user.area !== 'crm' || user.role !== 'ADMIN') throw new CrmError('FORBIDDEN',403);
}
export function resourceMetadata() {return {resource:mcpResource(),authorization_servers:[mcpOrigin()],scopes_supported:[MCP_SCOPE],bearer_methods_supported:['header'],resource_name:'Cohamy CRM Admin'};}
export function authorizationMetadata() {const root=mcpResource()+'/oauth';return {issuer:mcpOrigin(),authorization_endpoint:root+'/authorize',token_endpoint:root+'/token',registration_endpoint:root+'/register',revocation_endpoint:root+'/revoke',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],token_endpoint_auth_methods_supported:['none'],code_challenge_methods_supported:['S256'],scopes_supported:[MCP_SCOPE],authorization_response_iss_parameter_supported:true};}
export function validRedirect(value:string) {
  try {const u=new URL(value);return !u.username&&!u.password&&!u.hash&&u.href.length<=2000&&((u.protocol==='https:'&&!u.port&&['chatgpt.com','chat.openai.com'].includes(u.hostname))||(process.env.CRM_ENVIRONMENT==='LOCAL'&&u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)));}catch{return false;}
}
export async function registerClient(input:unknown) {
  const parsed=z.object({client_name:z.string().min(1).max(100).default('ChatGPT Cohamy'),redirect_uris:z.array(z.string().refine(validRedirect)).min(1).max(5),token_endpoint_auth_method:z.literal('none').optional(),grant_types:z.array(z.enum(['authorization_code','refresh_token'])).optional(),response_types:z.array(z.literal('code')).optional()}).passthrough().safeParse(input);
  if(!parsed.success)throw new CrmError('invalid_client_metadata',400);
  const db=await database();
  // Bound unauthenticated registration growth; no supplied URL is fetched.
  const count=(await db.query<{n:string}>("SELECT count(*)::text AS n FROM cohamy_crm.mcp_clients WHERE created_at>now()-interval '1 hour'")).rows[0];
  if(Number(count.n)>=50)throw new CrmError('registration_rate_limited',429);
  const id='cohamy_'+secret();
  await db.query('INSERT INTO cohamy_crm.mcp_clients(id,name,redirect_uris) VALUES($1,$2,$3::jsonb)',[id,parsed.data.client_name,JSON.stringify(parsed.data.redirect_uris)]);
  return {client_id:id,client_name:parsed.data.client_name,redirect_uris:parsed.data.redirect_uris,token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']};
}
const authorizeSchema=z.object({client_id:z.string().max(100),redirect_uri:z.string().max(2000),response_type:z.literal('code'),code_challenge:z.string().regex(/^[A-Za-z0-9_-]{43}$/),code_challenge_method:z.literal('S256'),state:z.string().min(1).max(2000),scope:z.string().optional(),resource:z.string().optional()});
export async function authorizationRequest(input:unknown) {
  const d=authorizeSchema.safeParse(input);if(!d.success)throw new CrmError('invalid_request',400);
  const p=d.data,db=await database(),client=(await db.query<{name:string;redirect_uris:string[]}>('SELECT name,redirect_uris FROM cohamy_crm.mcp_clients WHERE id=$1',[p.client_id])).rows[0];
  if(!client||!client.redirect_uris.includes(p.redirect_uri)||!validRedirect(p.redirect_uri))throw new CrmError('invalid_client',400);
  if(p.resource&&p.resource!==mcpResource())throw new CrmError('invalid_target',400);
  if(p.scope&&p.scope!==MCP_SCOPE)throw new CrmError('invalid_scope',400);
  const n=(await db.query<{n:string}>("SELECT count(*)::text AS n FROM cohamy_crm.mcp_authorizations WHERE expires_at>now() AND consumed_at IS NULL")).rows[0];
  if(Number(n.n)>=200)throw new CrmError('authorization_rate_limited',429);
  const id=randomUUID(),nonce=secret();
  await db.query("INSERT INTO cohamy_crm.mcp_authorizations(id,nonce_hash,request,expires_at) VALUES($1,$2,$3::jsonb,now()+interval '10 minutes')",[id,digest(nonce),JSON.stringify({...p,scope:MCP_SCOPE,resource:mcpResource()})]);
  return {id,nonce,clientName:client.name};
}
export async function approveAuthorization(user:Principal|null,id:string,nonce:string,allow:boolean) {
  if(allow){if(!user)throw new CrmError('FORBIDDEN',403);requireMcpAdmin(user);}
  if(!z.uuid().safeParse(id).success||!/^[A-Za-z0-9_-]{43}$/.test(nonce))throw new CrmError('invalid_request',400);
  return(await database()).transaction(async tx=>{
    if(user)await assertCurrentPrincipal(tx,user);
    const row=(await tx.query<{request:z.infer<typeof authorizeSchema>}>('UPDATE cohamy_crm.mcp_authorizations SET consumed_at=now() WHERE id=$1 AND nonce_hash=$2 AND consumed_at IS NULL AND expires_at>now() RETURNING request',[id,digest(nonce)])).rows[0];
    if(!row)throw new CrmError('authorization_expired',400);
    const p=row.request,target=new URL(p.redirect_uri);target.searchParams.set('state',p.state);target.searchParams.set('iss',mcpOrigin());
    if(!allow){target.searchParams.set('error','access_denied');return target.href;}
    if(!user)throw new CrmError('FORBIDDEN',403);
    const code=secret(),grant=randomUUID();
    await tx.query("INSERT INTO cohamy_crm.mcp_grants(id,client_id,membership_id,membership_version,code_hash,code_expires_at,redirect_uri,challenge,resource,scope) VALUES($1,$2,$3,$4,$5,now()+interval '2 minutes',$6,$7,$8,$9)",[grant,p.client_id,user.membershipId,user.membershipVersion,digest(code),p.redirect_uri,p.code_challenge,mcpResource(),MCP_SCOPE]);
    await audit(tx,user.id,'mcp.authorized',grant,{clientId:p.client_id,scope:MCP_SCOPE});
    target.searchParams.set('code',code);return target.href;
  });
}
type Grant={id:string;membership_id:string;membership_version:number;client_id:string;resource:string;scope:string;revoked_at:string|null};
async function currentGrant(tx:Sql,grant:Grant){
  const user=await membershipPrincipal(grant.membership_id,tx);
  if(!user||user.role!=='ADMIN'||user.area!=='crm'||user.membershipVersion!==grant.membership_version||grant.resource!==mcpResource()||grant.scope!==MCP_SCOPE||grant.revoked_at)throw new CrmError('invalid_grant',400);
  await assertCurrentPrincipal(tx,user);return user;
}
async function issueTokens(tx:Sql,grant:string){
  const access=secret(),refresh=secret();
  await tx.query("INSERT INTO cohamy_crm.mcp_tokens(token_hash,grant_id,kind,expires_at) VALUES($1,$2,'access',now()+interval '1 hour'),($3,$2,'refresh',now()+interval '30 days')",[digest(access),grant,digest(refresh)]);
  return {access_token:access,token_type:'Bearer',expires_in:3600,refresh_token:refresh,scope:MCP_SCOPE};
}
export async function exchangeToken(input:Record<string,string>){
  if(input.resource&&input.resource!==mcpResource())throw new CrmError('invalid_target',400);
  if(!input.client_id||input.scope&&input.scope!==MCP_SCOPE)throw new CrmError('invalid_request',400);
  return(await database()).transaction(async tx=>{
    if(input.grant_type==='authorization_code'){
      if(!/^[A-Za-z0-9._~-]{43,128}$/.test(input.code_verifier??''))throw new CrmError('invalid_grant',400);
      const row=(await tx.query<Grant&{challenge:string;redirect_uri:string}>("SELECT * FROM cohamy_crm.mcp_grants WHERE code_hash=$1 AND code_used_at IS NULL AND code_expires_at>now() FOR UPDATE",[digest(input.code??'')])).rows[0];
      if(!row||row.client_id!==input.client_id||row.redirect_uri!==input.redirect_uri)throw new CrmError('invalid_grant',400);
      const expected=Buffer.from(row.challenge),actual=Buffer.from(Buffer.from(digest(input.code_verifier),'hex').toString('base64url'));
      if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw new CrmError('invalid_grant',400);
      await currentGrant(tx,row);
      await tx.query('UPDATE cohamy_crm.mcp_grants SET code_used_at=now() WHERE id=$1',[row.id]);
      return issueTokens(tx,row.id);
    }
    if(input.grant_type==='refresh_token'){
      const row=(await tx.query<Grant&{used_at:string|null}>("SELECT g.*,t.used_at FROM cohamy_crm.mcp_tokens t JOIN cohamy_crm.mcp_grants g ON g.id=t.grant_id WHERE t.token_hash=$1 AND t.kind='refresh' AND t.expires_at>now() FOR UPDATE OF t,g",[digest(input.refresh_token??'')])).rows[0];
      if(!row||row.client_id!==input.client_id||row.used_at)throw new CrmError('invalid_grant',400);
      await currentGrant(tx,row);
      await tx.query('UPDATE cohamy_crm.mcp_tokens SET used_at=now() WHERE token_hash=$1',[digest(input.refresh_token)]);
      return issueTokens(tx,row.id);
    }
    throw new CrmError('unsupported_grant_type',400);
  });
}
export async function bearerPrincipal(token:string){
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new CrmError('UNAUTHORIZED',401);
  const row=(await(await database()).query<Grant>("SELECT g.* FROM cohamy_crm.mcp_tokens t JOIN cohamy_crm.mcp_grants g ON g.id=t.grant_id WHERE t.token_hash=$1 AND t.kind='access' AND t.expires_at>now() AND t.used_at IS NULL AND g.revoked_at IS NULL",[digest(token)])).rows[0];
  const user=row?await membershipPrincipal(row.membership_id):null;
  if(!row||!user||user.role!=='ADMIN'||user.area!=='crm'||user.membershipVersion!==row.membership_version||row.resource!==mcpResource()||row.scope!==MCP_SCOPE)throw new CrmError('UNAUTHORIZED',401);
  return {user,grantId:row.id};
}
export async function revokeToken(token:string,clientId:string){await(await database()).query('UPDATE cohamy_crm.mcp_grants SET revoked_at=now() WHERE client_id=$1 AND id IN (SELECT grant_id FROM cohamy_crm.mcp_tokens WHERE token_hash=$2)',[clientId,digest(token)]);}
export async function listConnections(user:Principal){requireMcpAdmin(user);return(await(await database()).query("SELECT g.id,c.name,g.scope,g.created_at,g.revoked_at,g.membership_id FROM cohamy_crm.mcp_grants g JOIN cohamy_crm.mcp_clients c ON c.id=g.client_id WHERE g.code_used_at IS NOT NULL OR g.revoked_at IS NOT NULL ORDER BY g.created_at DESC LIMIT 100")).rows;}
export async function revokeConnection(user:Principal,id:string){requireMcpAdmin(user);if(!z.uuid().safeParse(id).success)throw new CrmError('INVALID_FIELDS',400);return(await database()).transaction(async tx=>{await assertCurrentPrincipal(tx,user);await tx.query('UPDATE cohamy_crm.mcp_grants SET revoked_at=now() WHERE id=$1',[id]);await audit(tx,user.id,'mcp.revoked',id);return {revoked:true};});}
