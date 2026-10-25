import 'server-only';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {audit,digest} from '../auth';
import {database} from '../db';
import {CrmError} from '../permissions';
import type {Principal} from '../types';
import {mcpIdentity} from './context';
import {mcpHandlers,mcpRoutes,mcpExcludedRoutes} from './routes.generated';
import {mcpOrigin,requireMcpAdmin} from './oauth';
import {redactMcp} from './data';

export function operationCatalog(filter='',operation=''){
 if(!filter&&!operation){const groups:Record<string,{available:number;retired:number}>={};for(const r of mcpRoutes){const group=groups[r.group]??={available:0,retired:0};if(r.status==='AVAILABLE')group.available++;else group.retired++;}return {total:mcpRoutes.length,available:mcpRoutes.filter(r=>r.status==='AVAILABLE').length,groups,next:'Pass filter with a group name to list its operations. Pass operation with an exact id for its native validation contract.'};}
 const selected=mcpRoutes.filter(r=>(!operation||r.id===operation)&&(!filter||(r.id+' '+r.group).toLowerCase().includes(filter.toLowerCase())));
 return {count:selected.length,total:mcpRoutes.length,available:mcpRoutes.filter(r=>r.status==='AVAILABLE').length,operations:selected.map(r=>operation?r:{id:r.id,group:r.group,status:r.status,params:r.params,multipart:r.multipart}),excluded:mcpExcludedRoutes,policy:'Current CRM permissions and retired-module restrictions apply. Read retained historical data with cohamy_data. Authentication secrets and infrastructure control are excluded.'};
}
const invokeSchema=z.object({operation:z.string().min(1).max(200),params:z.record(z.string(),z.string().max(200)).default({}),query:z.record(z.string(),z.string().max(4000)).default({}),input:z.unknown().optional(),file:z.object({name:z.string().min(1).max(200),mime:z.string().min(1).max(150),base64:z.string().max(29_000_000)}).optional(),fileOffset:z.number().int().min(0).max(100_000_000).default(0),fileLength:z.number().int().min(1).max(262144).default(131072)}).strict();
type Handler=(request:Request,context:{params:Promise<Record<string,string>>})=>Promise<Response>;
export async function invokeOperation(user:Principal,input:unknown,write:boolean){
 requireMcpAdmin(user);const parsed=invokeSchema.safeParse(input);if(!parsed.success)throw new CrmError('INVALID_FIELDS',400);const d=parsed.data,r=mcpRoutes.find(r=>r.id===d.operation);
 if(!r||write===(r.method==='GET'))throw new CrmError('MCP_OPERATION_NOT_AVAILABLE',403);
 if(r.status==='RETIRED')throw new CrmError('MCP_MODULE_RETIRED_USE_DATA_FOR_HISTORY',404);
 const containsCredential=(value:unknown):boolean=>Array.isArray(value)?value.some(containsCredential):!!value&&typeof value==='object'&&Object.entries(value).some(([k,v])=>/^(?:password|currentPassword|newPassword|password_hash|token|token_hash|secret)$/i.test(k)||containsCredential(v));
 if(containsCredential(d.input))throw new CrmError('MCP_CREDENTIAL_INPUT_NOT_ALLOWED',400);
 if(Object.keys(d.params).some(k=>!r.params.some(p=>p===k))||r.params.some(k=>!d.params[k]||/[\/\\?#\u0000]/.test(d.params[k])))throw new CrmError('MCP_INVALID_PATH_PARAMETERS',400);
 let pathname:string=r.template;for(const k of r.params)pathname=pathname.replace('['+k+']',encodeURIComponent(d.params[k]));
 const url=new URL(pathname,mcpOrigin());for(const [k,v]of Object.entries(d.query))url.searchParams.set(k,v);
 const headers=new Headers({origin:mcpOrigin(),'sec-fetch-site':'same-origin'});let body:BodyInit|undefined;
 if(r.method!=='GET'){
  if(r.multipart){
   if(!d.file||!d.file.base64||!/^[A-Za-z0-9+/]*={0,2}$/.test(d.file.base64))throw new CrmError('MCP_FILE_REQUIRED',400);
   const bytes=Buffer.from(d.file.base64,'base64');if(bytes.length>20*1024*1024)throw new CrmError('FILE_SIZE_INVALID',413);
   const form=new FormData();form.set('file',new Blob([new Uint8Array(bytes)],{type:d.file.mime}),d.file.name);
   if(['POST /api/crm/commerce/excel-preview','POST /api/crm/consignment/sale-preview'].includes(r.id))form.set('input',JSON.stringify(d.input??{}));
   else{if(!d.input||typeof d.input!=='object'||Array.isArray(d.input))throw new CrmError('INVALID_FIELDS',400);for(const[k,v]of Object.entries(d.input))form.set(k,typeof v==='object'?JSON.stringify(v):String(v));}
   body=form;
  }else{if(d.file)throw new CrmError('MCP_UNEXPECTED_FILE',400);headers.set('content-type','application/json');body=JSON.stringify(d.input??{});}
 }
 const handler=(mcpHandlers[r.source] as Record<string,Handler>)[r.method];
 const response=await mcpIdentity.run(user,()=>handler(new Request(url,{method:r.method,headers,body}),{params:Promise.resolve({...r.selector,...d.params})}));
 const mime=response.headers.get('content-type')??'application/octet-stream';
 if(mime.includes('json'))return {status:response.status,ok:response.ok,data:redactMcp(await response.json())};
 const bytes=Buffer.from(await response.arrayBuffer()),end=Math.min(bytes.length,d.fileOffset+d.fileLength);
 return {status:response.status,ok:response.ok,file:{mime,disposition:response.headers.get('content-disposition'),totalBytes:bytes.length,offset:d.fileOffset,nextOffset:end<bytes.length?end:null,base64:bytes.subarray(d.fileOffset,end).toString('base64')}};
}
export async function auditedRead(user:Principal,operation:string,fn:()=>Promise<unknown>){
 requireMcpAdmin(user);const id=randomUUID(),db=await database();await audit(db,user.id,'mcp.read',id,{operation});return fn();
}
export async function auditedWrite(user:Principal,grantId:string,requestId:string,input:unknown){
 requireMcpAdmin(user);if(!z.uuid().safeParse(requestId).success)throw new CrmError('MCP_REQUEST_ID_REQUIRED',400);
 const db=await database(),hash=digest(JSON.stringify(input)),operation=(input as {operation?:string}).operation??'';
 const inserted=(await db.query('INSERT INTO cohamy_crm.mcp_calls(grant_id,request_id,input_hash,operation) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING request_id',[grantId,requestId,hash,operation])).rows.length;
 if(!inserted){const prior=(await db.query<{input_hash:string;result:unknown}>('SELECT input_hash,result FROM cohamy_crm.mcp_calls WHERE grant_id=$1 AND request_id=$2',[grantId,requestId])).rows[0];if(prior.input_hash!==hash)throw new CrmError('MCP_REQUEST_ID_CONFLICT',409);if(prior.result===null)throw new CrmError('MCP_OUTCOME_UNKNOWN_REVIEW_BEFORE_RETRY',409);return {replayed:true,result:prior.result};}
 await audit(db,user.id,'mcp.write.requested',requestId,{operation,grantId});
 // A process crash between the native commit and this receipt never automatically repeats the command.
 const result=await invokeOperation(user,input,true);
 if(Buffer.byteLength(JSON.stringify(result))>2_000_000)throw new CrmError('MCP_OUTCOME_REQUIRES_NATIVE_REVIEW',409);
 await db.query('UPDATE cohamy_crm.mcp_calls SET result=$3::jsonb WHERE grant_id=$1 AND request_id=$2',[grantId,requestId,JSON.stringify(result)]);
 await audit(db,user.id,'mcp.write.completed',requestId,{operation,status:result.status});
 return {replayed:false,result};
}
