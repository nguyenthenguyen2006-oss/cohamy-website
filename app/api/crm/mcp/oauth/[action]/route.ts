import {cookies} from 'next/headers';
import {apiUser,readJson,json,apiError,sameOrigin} from '@/lib/crm/http';
import {authenticate,SESSION_COOKIE,verifyMcpAdminPassword} from '@/lib/crm/auth';
import {CrmError} from '@/lib/crm/permissions';
import {approveAuthorization,authorizationRequest,exchangeToken,listConnections,registerClient,requireMcpAdmin,revokeConnection,revokeToken} from '@/lib/crm/mcp/oauth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{action:string}>};
const esc=(v:string)=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
function page(content:string,status=200){return new Response(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Kết nối ChatGPT · Cohamy</title><style>body{margin:0;background:#141310;color:#f5f3eb;font:16px/1.6 system-ui,sans-serif}main{max-width:540px;margin:6vh auto;padding:28px}h1{font-size:27px}label{display:block;margin:14px 0}input{display:block;box-sizing:border-box;width:100%;padding:12px;margin-top:5px;background:#222019;border:1px solid #777064;border-radius:5px;color:inherit;font:inherit}button,a{font:inherit}button{padding:11px 18px;margin:12px 8px 0 0;border:1px solid #d97706;border-radius:5px;background:#d97706;color:#fff;cursor:pointer}button[value=deny]{background:transparent}small{color:#bdb7aa}a{color:#f59e0b}</style></head><body><main>${content}</main></body></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://chatgpt.com https://chat.openai.com; frame-ancestors 'none'; base-uri 'none'"}});}
async function boundedForm(request:Request){const type=request.headers.get('content-type')??'';if(!type.startsWith('application/x-www-form-urlencoded'))throw new CrmError('FORM_REQUIRED',415);const reader=request.body?.getReader();if(!reader)throw new CrmError('invalid_request',400);const chunks:Uint8Array[]=[];let size=0;try{while(true){const{value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();throw new CrmError('BODY_TOO_LARGE',413);}chunks.push(value);}}finally{reader.releaseLock();}return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));}
function oauthError(e:unknown){return Response.json({error:e instanceof CrmError?e.code:'server_error'},{status:e instanceof CrmError?e.status:503,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});}
export async function GET(request:Request,context:Context){try{
 const {action}=await context.params;
 if(action==='connections')return json({items:await listConnections(await apiUser())});
 if(action!=='authorize')throw new CrmError('NOT_FOUND',404);
 const pending=await authorizationRequest(Object.fromEntries(new URL(request.url).searchParams));
 const jar=await cookies(),user=await authenticate(jar.get(SESSION_COOKIE)?.value);
 jar.set('cohamy_mcp_authorization',pending.id+'.'+pending.nonce,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/api/crm/mcp/oauth',maxAge:600});
 const identity=user?`<p>Đang đăng nhập: <strong>${esc(user.email)}</strong></p>`:`<label>Email Admin<input name="email" type="email" autocomplete="username" required></label><label>Mật khẩu<input name="password" type="password" autocomplete="current-password" required maxlength="72"></label>`;
 return page(`<p>COHAMY · KẾT NỐI MCP</p><h1>Cho phép ${esc(pending.clientName)} quản trị CRM?</h1><p>Kết nối này có thể đọc dữ liệu kinh doanh và thực hiện các thao tác Admin: đơn hàng, kho, công nợ, thanh toán, chứng từ, tài khoản và cài đặt.</p><p>Mọi thao tác vẫn áp dụng quy tắc của CRM và được ghi lịch sử. Bạn có thể thu hồi kết nối tại <a href="/crm/mcp">Quản lý MCP</a>.</p><form method="post" action="/api/crm/mcp/oauth/authorize"><input type="hidden" name="id" value="${pending.id}">${identity}<button name="decision" value="allow">Cho phép kết nối</button><button name="decision" value="deny" formnovalidate>Từ chối</button></form><p><small>Chỉ tài khoản Admin nội bộ có thể cấp quyền. Mật khẩu và API key không được gửi cho ChatGPT.</small></p>`);
 }catch(e){return apiError(e);}}
export async function POST(request:Request,context:Context){
 const {action}=await context.params;
 try{
  if(action==='register')return Response.json(await registerClient(await readJson(request,16384)),{status:201,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
  if(action==='token')return Response.json(await exchangeToken(await boundedForm(request)),{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
  if(action==='revoke'){const form=await boundedForm(request);await revokeToken(form.token??'',form.client_id??'');return new Response(null,{status:200,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});}
  sameOrigin(request);
  if(action==='disconnect'){const user=await apiUser(),data=await readJson(request) as {id:string};return json(await revokeConnection(user,data.id));}
  if(action!=='authorize')throw new CrmError('NOT_FOUND',404);
  const form=await boundedForm(request),jar=await cookies(),proof=jar.get('cohamy_mcp_authorization')?.value??'';
  if(!['allow','deny'].includes(form.decision))throw new CrmError('invalid_request',400);
  const [id,nonce]=proof.split('.');if(id!==form.id||!nonce)throw new CrmError('authorization_expired',400);
  if(form.decision==='deny'){const target=await approveAuthorization(null,id,nonce,false);jar.set('cohamy_mcp_authorization','',{path:'/api/crm/mcp/oauth',maxAge:0});return Response.redirect(target,303);}
  const user=await authenticate(jar.get(SESSION_COOKIE)?.value)??await verifyMcpAdminPassword((form.email??'').trim().toLowerCase(),form.password??'');
  requireMcpAdmin(user);const redirect=await approveAuthorization(user,id,nonce,true);
  jar.set('cohamy_mcp_authorization','',{path:'/api/crm/mcp/oauth',maxAge:0});return Response.redirect(redirect,303);
 }catch(e){if(action==='authorize')return page(`<h1>Chưa kết nối được</h1><p>${e instanceof CrmError?esc(e.code):'MCP_UNAVAILABLE'}</p><p>Quay lại bước kết nối trên ChatGPT và thử lại bằng email và mật khẩu Admin. Kết nối MCP không yêu cầu mã xác thực hai bước.</p>`,e instanceof CrmError?e.status:503);return oauthError(e);}
}
export async function OPTIONS(){return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Cache-Control':'no-store'}});}
