import {type Sql} from '../../lib/crm/db';
export interface DatabaseManifest{tables:{name:string;rows:string;sha256:string}[];fileIntegrityErrors:string;documentSourceErrors:string}
export async function databaseManifest(sql:Sql):Promise<DatabaseManifest>{
 const tables=(await sql.query<{name:string}>("SELECT tablename AS name FROM pg_tables WHERE schemaname='cohamy_crm' ORDER BY tablename")).rows,result:DatabaseManifest={tables:[],fileIntegrityErrors:'0',documentSourceErrors:'0'};
 for(const {name} of tables){
  if(!/^[a-z][a-z0-9_]*$/.test(name))throw new Error('UNEXPECTED_TABLE_NAME');
  // Hash each full row including bytea, then a sorted sequence of row hashes.
  // The aggregate holds 64 bytes per row, rather than all file contents.
  const record=(await sql.query<{rows:string;sha256:string}>(`SELECT count(*)::text AS rows,encode(sha256(convert_to(coalesce(string_agg(row_hash,E'\n' ORDER BY row_hash),''),'UTF8')),'hex') AS sha256 FROM (SELECT encode(sha256(convert_to(row_to_json(r)::text,'UTF8')),'hex') AS row_hash FROM cohamy_crm."${name}" r) h`)).rows[0];
  result.tables.push({name,...record});
 }
 const names=new Set(tables.map(t=>t.name));
 if(names.has('document_versions')){
  result.fileIntegrityErrors=(await sql.query<{count:string}>("SELECT count(*)::text AS count FROM cohamy_crm.document_versions WHERE octet_length(content)<>size OR checksum<>encode(sha256(convert_to(replace(encode(content,'base64'),E'\n',''),'UTF8')),'hex')")).rows[0].count;
  const sources:{type:string;table:string}[]=[{type:'partner',table:'organizations'},{type:'order',table:'website_orders'},{type:'ticket',table:'support_tickets'},{type:'library',table:'partner_library'},{type:'visit',table:'partner_visits'}];
  const missing=sources.filter(s=>names.has(s.table)).map(s=>`(d.entity_type='${s.type}' AND NOT EXISTS(SELECT 1 FROM cohamy_crm.${s.table} p WHERE p.id=d.entity_id))`);
  if(missing.length)result.documentSourceErrors=(await sql.query<{count:string}>(`SELECT count(*)::text AS count FROM cohamy_crm.private_documents d WHERE ${missing.join(' OR ')}`)).rows[0].count;
 }
 if(result.fileIntegrityErrors!=='0'||result.documentSourceErrors!=='0')throw new Error('DATABASE_SOURCE_OR_FILE_INTEGRITY_FAILED');
 return result;
}
