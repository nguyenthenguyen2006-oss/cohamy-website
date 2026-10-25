import 'server-only';
import {z} from 'zod';
import {database} from '../db';
import {CrmError} from '../permissions';
import {requireMcpAdmin} from './oauth';
import type {Principal} from '../types';

// Auth material is never business data. Status is available through native settings/account APIs.
const privateTables=/^(mcp_|account_invitations$|account_activation_attempts$|account_provision_actions$|sessions$|login_attempts$|password_reset_tokens$|mfa_|migrations$)/i;
const privateColumns=/(password|token|secret|credential|ciphertext|api.?key|authorization|cookie|registration_hash|approval_hash|storage.?path|absolute.?path|file.?path)/i;
const ident=(value:string)=>'"'+value.replaceAll('"','""')+'"';
export function redactMcp(value:unknown,depth=0):unknown{
 if(depth>35)return '[depth limit]';
 if(Array.isArray(value))return value.map(v=>redactMcp(v,depth+1));
 if(value&&typeof value==='object'&&!(value instanceof Date))return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,privateColumns.test(k)?'[redacted]':redactMcp(v,depth+1)]));
 return value;
}
export async function dataCatalog(user:Principal){
 requireMcpAdmin(user);
 const rows=(await(await database()).query<{table_name:string;column_name:string;data_type:string}>("SELECT c.table_name,c.column_name,c.data_type FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name WHERE c.table_schema='cohamy_crm' AND t.table_type='BASE TABLE' ORDER BY c.table_name,c.ordinal_position")).rows;
 const tables:Record<string,{column:string;type:string}[]>={};
 for(const r of rows)if(!privateTables.test(r.table_name)&&!privateColumns.test(r.column_name)&&r.data_type!=='bytea')(tables[r.table_name]??=[]).push({column:r.column_name,type:r.data_type});
 return {tables,excluded:'Authentication tokens, passwords, MFA secrets, encrypted API keys and physical storage paths. Binary attachments use the authenticated document API.'};
}
const browseSchema=z.object({table:z.string().regex(/^[a-z][a-z0-9_]*$/),offset:z.number().int().min(0).max(10000000).default(0),limit:z.number().int().min(1).max(200).default(50),filters:z.array(z.object({column:z.string(),op:z.enum(['eq','contains','gte','lte','is_null']),value:z.union([z.string().max(4000),z.number(),z.boolean()]).optional()})).max(12).default([]),orderBy:z.string().optional(),descending:z.boolean().default(false)}).strict();
export async function browseData(user:Principal,input:unknown){
 requireMcpAdmin(user);const parsed=browseSchema.safeParse(input);if(!parsed.success)throw new CrmError('INVALID_FIELDS',400);const d=parsed.data;
 const {tables}=await dataCatalog(user),cols=tables[d.table];if(!cols?.length)throw new CrmError('MCP_TABLE_NOT_AVAILABLE',403);
 const allowed=new Set(cols.map(c=>c.column)),params:unknown[]=[],conditions:string[]=[];
 for(const f of d.filters){if(!allowed.has(f.column))throw new CrmError('MCP_COLUMN_NOT_AVAILABLE',400);const c=ident(f.column);if(f.op==='is_null'){conditions.push(c+' IS NULL');continue;}if(f.value===undefined)throw new CrmError('INVALID_FIELDS',400);params.push(String(f.value));const p='$'+params.length;conditions.push(f.op==='contains'?`${c}::text ILIKE '%' || ${p} || '%'`:f.op==='eq'?`${c}::text = ${p}`:`${c} ${f.op==='gte'?'>=':'<='} ${p}`);}
 const sort=d.orderBy??(allowed.has('id')?'id':cols[0].column);if(!allowed.has(sort))throw new CrmError('MCP_COLUMN_NOT_AVAILABLE',400);
 const where=conditions.length?' WHERE '+conditions.join(' AND '):'',db=await database();
 return db.transaction(async tx=>{
  // Counts and page are one consistent source snapshot, independent of UI row caps.
  await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
  await tx.exec("SET LOCAL statement_timeout='10s'");
  const total=Number((await tx.query<{n:string}>(`SELECT count(*)::text AS n FROM cohamy_crm.${ident(d.table)}${where}`,params)).rows[0].n);
  const rows=(await tx.query(`SELECT ${cols.map(c=>ident(c.column)).join(',')} FROM cohamy_crm.${ident(d.table)}${where} ORDER BY ${ident(sort)} ${d.descending?'DESC':'ASC'}${sort!=='id'&&allowed.has('id')?',id ASC':''} LIMIT $${params.length+1} OFFSET $${params.length+2}`,[...params,d.limit,d.offset])).rows;
  return {table:d.table,total,offset:d.offset,limit:d.limit,nextOffset:d.offset+rows.length<total?d.offset+rows.length:null,items:redactMcp(rows)};
 });
}
