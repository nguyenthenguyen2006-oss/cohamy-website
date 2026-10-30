import 'server-only';
import type {Sql} from './db';
import type {Principal} from './types';
import type {DocumentCreator,CreatorEntity} from './document-creator-model';

// Call only after the native query has scoped these rows to the current viewer.
export async function documentCreators(sql:Sql,user:Principal,entity:CreatorEntity,rows:{id:string;userId:string;savedName?:string}[]):Promise<Map<string,DocumentCreator>>{
 const result=new Map<string,DocumentCreator>();if(!rows.length)return result;
 const stored=(await sql.query<{entity_id:string;user_id:string;display_name:string;email:string;captured_at:string}>('SELECT entity_id,user_id,display_name,email,captured_at::text FROM cohamy_crm.document_creators WHERE entity_table=$1 AND entity_id=ANY($2::uuid[])',[entity,rows.map(r=>r.id)])).rows;
 const missing=rows.filter(r=>!stored.some(s=>s.entity_id===r.id)&&!r.savedName),users=missing.length?(await sql.query<{id:string;display_name:string}>('SELECT id,display_name FROM cohamy_crm.users WHERE id=ANY($1::uuid[])',[missing.map(r=>r.userId)])).rows:[];
 for(const r of rows){const s=stored.find(s=>s.entity_id===r.id),current=users.find(u=>u.id===r.userId);result.set(r.id,s?{userId:s.user_id,displayName:s.display_name,email:user.area==='crm'||s.user_id===user.id?s.email:null,capturedAt:s.captured_at,source:'SNAPSHOT'}:{userId:r.userId||null,displayName:r.savedName||current?.display_name||'Chưa ghi nhận',email:null,capturedAt:null,source:r.savedName?'SAVED_NAME':current?'CURRENT_ACCOUNT':'UNKNOWN'});}
 return result;
}
export async function withDocumentCreators<T extends {id:string;creator_id:string}>(sql:Sql,user:Principal,entity:CreatorEntity,rows:T[]){const creators=await documentCreators(sql,user,entity,rows.map(r=>({id:r.id,userId:r.creator_id})));return rows.map(r=>({...r,creator:creators.get(r.id)!}));}
