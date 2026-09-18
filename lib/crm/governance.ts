import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {database,type Sql} from './db';
import {audit,membershipPrincipal,digest} from './auth';
import {assertPermission,CrmError,can} from './permissions';
import {getOrganization,listAccounts} from './repository';
import {roles,type Principal} from './types';
import {parse} from './workspace';

function internalWriter(user:Principal){assertPermission(user,'partners.write');if(user.area!=='crm')throw new CrmError('FORBIDDEN',403);}
export async function bulkPreview(user:Principal,input:unknown){
 internalWriter(user);
 const d=parse(z.object({ids:z.array(z.uuid()).min(1).max(50).refine(v=>new Set(v).size===v.length),action:z.enum(['DEACTIVATE','ACTIVATE','STAGE']),reason:z.string().trim().min(3).max(500),stage:z.enum(['LEAD','CONTACTED','ACTIVE','INACTIVE']).optional()}).strict(),input);
 if(d.action==='STAGE'&&!d.stage)throw new CrmError('INVALID_FIELDS',400);
 const items=[];for(const id of d.ids){const row=await getOrganization(user,id);if(row.kind==='COHAMY')throw new CrmError('ORGANIZATION_KIND_IMMUTABLE',409);items.push({id,name:row.name,version:row.version,before:{active:row.active,stage:row.stage},after:d.action==='STAGE'?{stage:d.stage}:{active:d.action==='ACTIVATE'}});}
 const id=randomUUID();await(await database()).query('INSERT INTO cohamy_crm.bulk_previews(id,user_id,action,reason,stage,items) VALUES ($1,$2,$3,$4,$5,$6::jsonb)',[id,user.id,d.action,d.reason,d.stage??null,JSON.stringify(items)]);
 return {id,items,atomic:true,expiresInMinutes:10};
}
type BulkItem={id:string;name:string;version:number;before:{active:boolean;stage:string};after:{active?:boolean;stage?:string}};
export async function getBulkPreview(user:Principal,id:string){internalWriter(user);const row=(await(await database()).query<{id:string;items:BulkItem[];action:string;reason:string;stage:string|null;expires_at:string;result:unknown}>('SELECT * FROM cohamy_crm.bulk_previews WHERE id=$1 AND user_id=$2',[parse(z.uuid(),id),user.id])).rows[0];if(!row)throw new CrmError('NOT_FOUND',404);for(const item of row.items)await getOrganization(user,item.id);return row;}
export async function bulkConfirm(user:Principal,input:unknown){
 internalWriter(user);const {id}=parse(z.object({id:z.uuid()}).strict(),input);
 return(await database()).transaction(async tx=>{
  const fresh=await membershipPrincipal(user.membershipId,tx);if(!fresh||fresh.role!==user.role)throw new CrmError('FORBIDDEN',403);
  const preview=(await tx.query<{items:BulkItem[];reason:string;expires_at:string;result:unknown}>('SELECT * FROM cohamy_crm.bulk_previews WHERE id=$1 AND user_id=$2 FOR UPDATE',[id,user.id])).rows[0];
  if(!preview)throw new CrmError('NOT_FOUND',404);if(preview.result)return preview.result;if(new Date(preview.expires_at).getTime()<=Date.now())throw new CrmError('PREVIEW_EXPIRED',409);
  const errors:{id:string;error:string}[]=[];
  // Stable lock order prevents two overlapping bulk requests taking reverse locks.
  for(const item of [...preview.items].sort((a,b)=>a.id.localeCompare(b.id))){
   try{await tx.query('SELECT id FROM cohamy_crm.organizations WHERE id=$1 FOR UPDATE',[item.id]);const current=await getOrganization(fresh,item.id,tx);if(current.version!==item.version)errors.push({id:item.id,error:'VERSION_CONFLICT'});}catch(e){if(e instanceof CrmError)errors.push({id:item.id,error:e.code});else throw e;}
  }
  if(errors.length)return {applied:0,errors,atomic:true,retry:'Refresh the impacted records and create a new preview.'};
  for(const item of preview.items){await tx.query('UPDATE cohamy_crm.organizations SET active=COALESCE($1::boolean,active),stage=COALESCE($2,stage),version=version+1 WHERE id=$3',[item.after.active??null,item.after.stage??null,item.id]);await audit(tx,user.id,'partner.bulk',item.id,{previewId:id,before:item.before,after:item.after,reason:preview.reason});}
  const result={applied:preview.items.length,errors:[],atomic:true};await tx.query('UPDATE cohamy_crm.bulk_previews SET result=$1::jsonb,completed_at=now() WHERE id=$2',[JSON.stringify(result),id]);return result;
 });
}

export interface FieldDefinition{id:string;field_key:string;label:string;kind:string;options:string[];required:boolean;read_roles:string[];write_roles:string[];active:boolean;version:number}
const definitionSchema=z.object({id:z.uuid().optional(),version:z.number().int().min(0),key:z.string().regex(/^[a-z][a-z0-9_]{1,39}$/).refine(v=>!/(password|otp|token|secret|credential)/i.test(v)),label:z.string().trim().min(2).max(120),kind:z.enum(['TEXT','NUMBER','DATE','BOOLEAN','ENUM']),options:z.array(z.string().trim().min(1).max(100)).max(50).default([]),required:z.boolean(),readRoles:z.array(z.enum(roles)).min(1).max(7),writeRoles:z.array(z.enum(roles)).max(7),active:z.boolean()}).strict();
export async function fieldDefinitions(user:Principal){assertPermission(user,'partners.read');return(await(await database()).query<FieldDefinition>('SELECT * FROM cohamy_crm.custom_field_definitions WHERE $1=ANY(read_roles) OR $2 ORDER BY label',[user.role,user.role==='ADMIN'&&user.area==='crm'])).rows;}
export async function saveFieldDefinition(user:Principal,input:unknown){
 assertPermission(user,'accounts.manage');const d=parse(definitionSchema,input);if(user.area!=='crm'||!d.writeRoles.every(role=>d.readRoles.includes(role))||d.kind==='ENUM'&&(!d.options.length||new Set(d.options).size!==d.options.length)||d.kind!=='ENUM'&&d.options.length)throw new CrmError('INVALID_FIELDS',400);
 return(await database()).transaction(async tx=>{
  const id=d.id??randomUUID();if(d.version===0){if(d.id)throw new CrmError('INVALID_FIELDS',400);await tx.query('INSERT INTO cohamy_crm.custom_field_definitions(id,field_key,label,kind,options,required,read_roles,write_roles,active,created_by) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)',[id,d.key,d.label,d.kind,JSON.stringify(d.options),d.required,d.readRoles,d.writeRoles,d.active,user.id]);}
  else{const original=(await tx.query<FieldDefinition>('SELECT * FROM cohamy_crm.custom_field_definitions WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!original)throw new CrmError('NOT_FOUND',404);if(original.version!==d.version)throw new CrmError('VERSION_CONFLICT',409);if(original.field_key!==d.key)throw new CrmError('FIELD_KEY_IMMUTABLE',409);await tx.query('UPDATE cohamy_crm.custom_field_definitions SET label=$1,kind=$2,options=$3::jsonb,required=$4,read_roles=$5,write_roles=$6,active=$7,version=version+1 WHERE id=$8',[d.label,d.kind,JSON.stringify(d.options),d.required,d.readRoles,d.writeRoles,d.active,id]);}
  await tx.query('INSERT INTO cohamy_crm.custom_field_versions(field_id,number,definition,actor_id) VALUES ($1,$2,$3::jsonb,$4)',[id,d.version+1,JSON.stringify(d),user.id]);await audit(tx,user.id,'custom-field.definition',id,{version:d.version+1,reason:'Versioned schema; earlier values retained.'});return {id,version:d.version+1};
 });
}
function fieldValue(def:FieldDefinition,value:unknown){
 let schema:z.ZodType;
 switch(def.kind){case 'TEXT':schema=z.string().max(1000);break;case 'NUMBER':schema=z.string().regex(/^-?\d{1,16}(?:\.\d{1,6})?$/);break;case 'DATE':schema=z.iso.date();break;case 'BOOLEAN':schema=z.boolean();break;case 'ENUM':schema=z.string().refine(v=>def.options.includes(v));break;default:throw new CrmError('INVALID_FIELDS',400);}
 if(value===null&&!def.required)return null;if(def.required&&(value===null||value===''))throw new CrmError('CUSTOM_FIELD_REQUIRED',400);return parse(schema,value);
}
export async function customValues(user:Principal,organizationId:string,sql?:Sql){
 await getOrganization(user,organizationId,sql);const db=sql??await database();
 return(await db.query<{field_id:string;definition_version:number;label:string;kind:string;value:unknown;version:number;current_definition_version:number}>(`SELECT v.field_id,v.definition_version,d.definition->>'label' AS label,d.definition->>'kind' AS kind,v.value,v.version,f.version AS current_definition_version
 FROM cohamy_crm.custom_field_values v JOIN cohamy_crm.custom_field_definitions f ON f.id=v.field_id
 JOIN cohamy_crm.custom_field_versions d ON d.field_id=v.field_id AND d.number=v.definition_version
 WHERE v.organization_id=$1 AND ($2=ANY(f.read_roles) OR $3) ORDER BY f.label,v.definition_version DESC`,[organizationId,user.role,user.role==='ADMIN'&&user.area==='crm'])).rows;
}
export async function saveCustomValue(user:Principal,input:unknown){
 const d=parse(z.object({organizationId:z.uuid(),fieldId:z.uuid(),definitionVersion:z.number().int().positive(),version:z.number().int().min(0),value:z.unknown()}).strict(),input);
 return(await database()).transaction(async tx=>{
  await getOrganization(user,d.organizationId,tx);const def=(await tx.query<FieldDefinition>('SELECT * FROM cohamy_crm.custom_field_definitions WHERE id=$1 FOR SHARE',[d.fieldId])).rows[0];
  if(!def||!def.active||!def.write_roles.includes(user.role)||!def.read_roles.includes(user.role))throw new CrmError('FORBIDDEN',403);if(def.version!==d.definitionVersion)throw new CrmError('VERSION_CONFLICT',409);
  const value=fieldValue(def,d.value),previous=(await tx.query<{value:unknown;version:number}>('SELECT value,version FROM cohamy_crm.custom_field_values WHERE organization_id=$1 AND field_id=$2 AND definition_version=$3 FOR UPDATE',[d.organizationId,d.fieldId,d.definitionVersion])).rows[0];
  if(previous&&previous.version!==d.version||!previous&&d.version!==0)throw new CrmError('VERSION_CONFLICT',409);
  const rows=previous?await tx.query('UPDATE cohamy_crm.custom_field_values SET value=$1::jsonb,version=version+1,updated_by=$2,updated_at=now() WHERE organization_id=$3 AND field_id=$4 AND definition_version=$5 AND version=$6 RETURNING version',[JSON.stringify(value),user.id,d.organizationId,d.fieldId,d.definitionVersion,d.version]):await tx.query('INSERT INTO cohamy_crm.custom_field_values(organization_id,field_id,definition_version,value,updated_by) VALUES ($1,$2,$3,$4::jsonb,$5) ON CONFLICT DO NOTHING RETURNING version',[d.organizationId,d.fieldId,d.definitionVersion,JSON.stringify(value),user.id]);
  if(!rows.rows.length)throw new CrmError('VERSION_CONFLICT',409);
  await tx.query('INSERT INTO cohamy_crm.custom_value_history(id,organization_id,field_id,definition_version,value,actor_id) VALUES ($1,$2,$3,$4,$5::jsonb,$6)',[randomUUID(),d.organizationId,d.fieldId,d.definitionVersion,JSON.stringify(value),user.id]);await audit(tx,user.id,'custom-field.value',d.organizationId,{fieldId:d.fieldId,definitionVersion:d.definitionVersion,before:previous?.value??null,after:value});return {version:d.version+1};
 });
}

const permissionNames:Record<string,string>={'partners.read':'Xem hồ sơ','partners.write':'Tạo/sửa hồ sơ, ghi chú và công việc','catalog.read':'Xem hàng hóa','warehouses.read':'Xem kho','warehouses.write':'Quản lý danh mục kho','orders.read':'Xem yêu cầu/đơn được cấp quyền','consignment.read':'Xem ký gửi','finance.read':'Xem tài chính','reports.read':'Xem báo cáo','accounts.manage':'Cấp tài khoản và quản trị quyền','dealer.invite':'Mời/quản lý nhân viên của đại lý','workspace.use':'Không gian riêng'};
export function permissionExplanation(user:Principal){return {role:user.role,scope:user.area==='portal'?'Tổ chức của bạn':user.role==='SALES'?'Đối tác được phân công':user.role==='WAREHOUSE'?'Kho được phân công':'Theo vai trò nội bộ',permissions:Object.entries(permissionNames).filter(([key])=>can(user,key)).map(([key,label])=>({key,label}))};}
export async function rolePreview(user:Principal,input:unknown){assertPermission(user,'accounts.manage');const d=parse(z.object({id:z.uuid(),role:z.enum(roles)}).strict(),input),accounts=await listAccounts(user),account=accounts.find(a=>a.id===d.id);if(!account)throw new CrmError('NOT_FOUND',404);if(account.user_id===user.id)throw new CrmError('SELF_ROLE_CHANGE_BLOCKED',409);const portal=['DEALER_OWNER','DEALER_STAFF'].includes(d.role);if(portal!==(account.organization_kind==='DEALER'))throw new CrmError('INVALID_ROLE_ORGANIZATION',400);const prototype={...user,role:d.role,area:portal?'portal':'crm'} as Principal;return {membershipId:d.id,membershipVersion:account.version,account:account.display_name,previousRole:account.role,nextRole:d.role,activeSessions:(await(await database()).query<{count:string}>('SELECT count(*)::text AS count FROM cohamy_crm.sessions WHERE membership_id IN(SELECT id FROM cohamy_crm.memberships WHERE user_id=(SELECT user_id FROM cohamy_crm.memberships WHERE id=$1)) AND revoked_at IS NULL AND expires_at>now()',[d.id])).rows[0].count,effect:'Đổi quyền thu hồi các phiên hiện tại; dữ liệu gốc được giữ.',permissions:permissionExplanation(prototype)};}
export async function revokeOtherSessions(user:Principal,currentToken:string){
 if(!/^[A-Za-z0-9_-]{43}$/.test(currentToken))throw new CrmError('UNAUTHORIZED',401);
 return(await database()).transaction(async tx=>{const current=(await tx.query('SELECT token_hash FROM cohamy_crm.sessions WHERE token_hash=$1 AND membership_id=$2 AND revoked_at IS NULL AND expires_at>now() FOR UPDATE',[digest(currentToken),user.membershipId])).rows[0];if(!current)throw new CrmError('UNAUTHORIZED',401);const rows=await tx.query('UPDATE cohamy_crm.sessions SET revoked_at=now() WHERE token_hash<>$1 AND membership_id IN(SELECT id FROM cohamy_crm.memberships WHERE user_id=$2) AND revoked_at IS NULL RETURNING token_hash',[digest(currentToken),user.id]);await audit(tx,user.id,'session.revoke-others',user.id,{count:rows.rows.length});return {revoked:rows.rows.length};});
}
