import 'server-only';
import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {database,type Sql} from './db';
import {assertCurrentPrincipal,audit} from './auth';
import {getOrganization} from './repository';
import {CrmError} from './permissions';
import type {Principal,Organization} from './types';

export const mergeFields=['name','phone','email','business_id','address','source','segment','contact_name','stage'] as const;
const choice=z.enum(['SOURCE','TARGET']);
const choicesSchema=z.object({name:choice,phone:choice,email:choice,business_id:choice,address:choice,source:choice,segment:choice,contact_name:choice,stage:choice,contactPreferences:choice,primaryContact:choice,defaultAddress:choice}).strict();
type Choices=z.infer<typeof choicesSchema>;
interface LinkGroup {table:string;count:number;items:{id:string;label:string}[];retained:boolean}
export interface MergeManifest {source:Organization;target:Organization;fields:{field:string;before:string;after:string}[];groups:LinkGroup[];sessionCount:number;digest:string;settings:{preferences:Record<string,unknown>[];primaryContacts:Record<string,unknown>[];defaultAddresses:Record<string,unknown>[];outcome:{preferences:Record<string,unknown>|null;primaryContact:Record<string,unknown>|null;defaultAddress:Record<string,unknown>|null;preferenceFallback:boolean}}}
function manager(user:Principal){if(user.area!=='crm'||!['ADMIN','MANAGER'].includes(user.role))throw new CrmError('FORBIDDEN',403);}
function parse<T>(schema:z.ZodType<T>,input:unknown){const d=schema.safeParse(input);if(!d.success)throw new CrmError('INVALID_FIELDS',400);return d.data;}
const mutable=new Set(['memberships','partner_assignments','partner_tags','partner_contacts','dealer_addresses','dealer_carts','support_tickets','website_orders','opportunities','quotations','commercial_requests','sales_orders','private_documents','tasks','care_schedules','partner_library','partner_applications','partner_invitations']);
// Source rows remain available for immutable history and future source ledgers.
// Current scope follows the canonical organization; ledger amounts never move.
export async function partnerFamily(sql:Sql,id:string) {return(await sql.query<{id:string}>('SELECT id FROM cohamy_crm.organizations WHERE id=$1 OR merged_into_id=$1 ORDER BY id',[id])).rows.map(r=>r.id);}
async function lockMerge(sql:Sql) {
  const tables=(await sql.query<{name:string}>(`SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='cohamy_crm' AND c.relkind='r' AND c.relname<>'migrations' ORDER BY c.relname`)).rows;
  if(tables.some(t=>!/^\w+$/.test(t.name)))throw new CrmError('MERGE_SCHEMA_UNSUPPORTED',503);
  // NOWAIT avoids holding half the table set while another writer holds rows.
  // Plain scoped reads remain available; contention rolls back the whole TX.
  try {
    await sql.query('SELECT cohamy_crm.lock_partner_merge()');
  }
  catch(e){if((e as {code?:string}).code==='55P03')throw new CrmError('MERGE_BUSY',409);throw e;}
  return tables.map(t=>t.name);
}
async function manifest(sql:Sql,user:Principal,sourceId:string,targetId:string,choices:Choices,tables:string[]):Promise<MergeManifest> {
  await assertCurrentPrincipal(sql,user);
  const source=await getOrganization(user,sourceId,sql),target=await getOrganization(user,targetId,sql);
  if(sourceId===targetId||!source.active||!target.active||source.merged_into_id||target.merged_into_id||!['CUSTOMER','DEALER','SUPPLIER'].includes(source.kind)||source.kind!==target.kind)throw new CrmError('MERGE_INVALID_PAIR',409);
  if((await sql.query(`SELECT s.id FROM cohamy_crm.memberships s JOIN cohamy_crm.memberships t ON t.user_id=s.user_id AND t.role=s.role WHERE s.organization_id=$1 AND t.organization_id=$2`,[sourceId,targetId])).rows.length)throw new CrmError('MERGE_MEMBERSHIP_CONFLICT',409);
  const sourceIds=await partnerFamily(sql,sourceId),allIds=[...sourceIds,...await partnerFamily(sql,targetId)],groups:LinkGroup[]=[],hash=createHash('sha256');
  hash.update(JSON.stringify({source,target,choices}));
  const refs=(await sql.query<{table_name:string;column_name:string}>(`SELECT t.relname AS table_name,a.attname AS column_name FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace CROSS JOIN LATERAL unnest(c.conkey) k(attnum) JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum WHERE c.contype='f' AND c.confrelid='cohamy_crm.organizations'::regclass AND n.nspname='cohamy_crm'`)).rows;
  for(const table of tables){if(['organizations','partner_merge_history','partner_merge_previews'].includes(table))continue;
    const columns=refs.filter(r=>r.table_name===table).map(r=>r.column_name),poly=['activities','tasks','private_documents','care_schedules','care_rule_runs','notifications','workspace_bookmarks','workspace_drafts','audit_events'].includes(table);
    const childSelectors:Record<string,string>={"document_versions":"t.document_id IN(SELECT d.id FROM cohamy_crm.private_documents d WHERE (d.entity_type='partner' AND d.entity_id=ANY($1::uuid[])) OR (d.entity_type='ticket' AND d.entity_id IN(SELECT id FROM cohamy_crm.support_tickets WHERE organization_id=ANY($1::uuid[]))) OR (d.entity_type='visit' AND d.entity_id IN(SELECT id FROM cohamy_crm.partner_visits WHERE organization_id=ANY($1::uuid[]))) OR (d.entity_type='library' AND d.entity_id IN(SELECT id FROM cohamy_crm.partner_library WHERE organization_id=ANY($1::uuid[]))))","task_checklist":"t.task_id IN(SELECT id FROM cohamy_crm.tasks WHERE entity_type='partner' AND entity_id=ANY($1::uuid[]))","task_dependencies":"t.task_id IN(SELECT id FROM cohamy_crm.tasks WHERE entity_type='partner' AND entity_id=ANY($1::uuid[]))","task_watchers":"t.task_id IN(SELECT id FROM cohamy_crm.tasks WHERE entity_type='partner' AND entity_id=ANY($1::uuid[]))","care_escalations":"t.task_id IN(SELECT id FROM cohamy_crm.tasks WHERE entity_type='partner' AND entity_id=ANY($1::uuid[]))","activity_mentions":"t.activity_id IN(SELECT id FROM cohamy_crm.activities WHERE entity_type='partner' AND entity_id=ANY($1::uuid[]))","support_messages":"t.ticket_id IN(SELECT id FROM cohamy_crm.support_tickets WHERE organization_id=ANY($1::uuid[]))","opportunity_history":"t.opportunity_id IN(SELECT id FROM cohamy_crm.opportunities WHERE organization_id=ANY($1::uuid[]))","care_schedule_runs":"t.schedule_id IN(SELECT id FROM cohamy_crm.care_schedules WHERE entity_type='partner' AND entity_id=ANY($1::uuid[]))","application_history":"t.application_id IN(SELECT id FROM cohamy_crm.partner_applications WHERE organization_id=ANY($1::uuid[]))"};
    for(const name of ['quotation_versions','quotation_events'])childSelectors[name]='t.quotation_id IN(SELECT id FROM cohamy_crm.quotations WHERE organization_id=ANY($1::uuid[]))';
    childSelectors.commercial_request_versions='t.request_id IN(SELECT id FROM cohamy_crm.commercial_requests WHERE organization_id=ANY($1::uuid[]))';
    childSelectors.sales_order_versions='t.order_id IN(SELECT id FROM cohamy_crm.sales_orders WHERE organization_id=ANY($1::uuid[]))';
    childSelectors.commercial_events='t.request_id IN(SELECT id FROM cohamy_crm.commercial_requests WHERE organization_id=ANY($1::uuid[])) OR t.order_id IN(SELECT id FROM cohamy_crm.sales_orders WHERE organization_id=ANY($1::uuid[]))';
    childSelectors.order_change_previews='t.order_id IN(SELECT id FROM cohamy_crm.sales_orders WHERE organization_id=ANY($1::uuid[]))';
    childSelectors.quotation_pdfs='t.version_id IN(SELECT v.id FROM cohamy_crm.quotation_versions v JOIN cohamy_crm.quotations q ON q.id=v.quotation_id WHERE q.organization_id=ANY($1::uuid[]))';
    const child=childSelectors[table];
    if(!columns.length&&!poly&&!child)continue;
    const parts=columns.map(c=>'t."'+c+'"=ANY($1::uuid[])');
    if(child)parts.push(child);
    if(poly)parts.push(table==='audit_events'?"t.entity_id=ANY($1::text[]) AND t.action NOT LIKE 'auth.%'":table==='care_rule_runs'?"t.entity_id=ANY($1::uuid[])":"t.entity_type='partner' AND t.entity_id=ANY($1::uuid[])");
    const where=parts.map(p=>'('+p+')').join(' OR '),query=`SELECT (to_jsonb(t)-'content')::text AS value FROM cohamy_crm."${table}" t WHERE ${where} ORDER BY (to_jsonb(t)-'content')::text LIMIT 4001`;
    const rows=(await sql.query<{value:string}>(query,[allIds])).rows;
    if(rows.length>4000)throw new CrmError('MERGE_LIMIT',409);
    hash.update(table);for(const row of rows)hash.update(row.value+'\n');
    const sourceParts=parts.join(' OR '),linked=(await sql.query<{value:string}>(`SELECT (to_jsonb(t)-'content')::text AS value FROM cohamy_crm."${table}" t WHERE ${sourceParts} ORDER BY (to_jsonb(t)-'content')::text LIMIT 4001`,[sourceIds])).rows;
    if(linked.length)groups.push({table,count:linked.length,retained:!mutable.has(table),items:linked.map(({value})=>{const r=JSON.parse(value);return {id:String(r.id??r.user_id??r.membership_id??r.tag_id??r.field_id??''),label:String(r.title??r.name??r.code??r.role??r.action??r.filename??r.body??r.message??r.channel??'Liên kết hồ sơ').slice(0,180)};})});
  }
  const sessionCount=Number((await sql.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.sessions WHERE membership_id IN(SELECT id FROM cohamy_crm.memberships WHERE organization_id=ANY($1::uuid[])) AND revoked_at IS NULL AND expires_at>now()',[allIds])).rows[0].n);
  const oldSettings={
    preferences:(await sql.query('SELECT * FROM cohamy_crm.contact_preferences WHERE organization_id=ANY($1::uuid[]) ORDER BY organization_id',[[sourceId,targetId]])).rows,
    primaryContacts:(await sql.query('SELECT id,organization_id,name,phone,email FROM cohamy_crm.partner_contacts WHERE organization_id=ANY($1::uuid[]) AND is_primary AND active ORDER BY organization_id',[[sourceId,targetId]])).rows,
    defaultAddresses:(await sql.query('SELECT id,organization_id,label,recipient,phone,address FROM cohamy_crm.dealer_addresses WHERE organization_id=ANY($1::uuid[]) AND is_default AND active ORDER BY organization_id',[[sourceId,targetId]])).rows,
  };
  const from=(rows:Record<string,unknown>[],selected:Choices[keyof Choices])=>rows.find(r=>r.organization_id===(selected==='SOURCE'?sourceId:targetId))??null;
  const selectedPreferences=from(oldSettings.preferences,choices.contactPreferences);
  const settings={...oldSettings,outcome:{preferences:selectedPreferences??from(oldSettings.preferences,'TARGET'),primaryContact:from(oldSettings.primaryContacts,choices.primaryContact),defaultAddress:from(oldSettings.defaultAddresses,choices.defaultAddress),preferenceFallback:choices.contactPreferences==='SOURCE'&&!selectedPreferences}};
  return {source,target,fields:mergeFields.map(field=>({field,before:String(target[field]??''),after:String((choices[field]==='SOURCE'?source:target)[field]??'')})),groups,sessionCount,digest:hash.digest('hex'),settings};
}
export async function mergePreview(user:Principal,input:unknown) {
  manager(user);const d=parse(z.object({sourceId:z.uuid(),targetId:z.uuid(),choices:choicesSchema,reason:z.string().trim().min(3).max(1000)}).strict(),input);
  return(await database()).transaction(async sql=>{const tables=await lockMerge(sql),m=await manifest(sql,user,d.sourceId,d.targetId,d.choices,tables),id=randomUUID();await sql.query('INSERT INTO cohamy_crm.partner_merge_previews(id,user_id,source_id,target_id,choices,reason,manifest) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb)',[id,user.id,d.sourceId,d.targetId,JSON.stringify(d.choices),d.reason,JSON.stringify(m)]);return {id,manifest:m};});
}
export async function mergeConfirm(user:Principal,input:unknown) {
  manager(user);const d=parse(z.object({id:z.uuid()}).strict(),input);
  return(await database()).transaction(async sql=>{
    const tables=await lockMerge(sql);await assertCurrentPrincipal(sql,user);
    const preview=(await sql.query<{user_id:string;source_id:string;target_id:string;choices:Choices;reason:string;manifest:MergeManifest;result:unknown;expired:boolean}>('SELECT *,expires_at<=now() AS expired FROM cohamy_crm.partner_merge_previews WHERE id=$1',[d.id])).rows[0];
    if(!preview||preview.user_id!==user.id)throw new CrmError('NOT_FOUND',404);if(preview.result)return preview.result;if(preview.expired)throw new CrmError('PREVIEW_EXPIRED',409);
    const current=await manifest(sql,user,preview.source_id,preview.target_id,choicesSchema.parse(preview.choices),tables);if(current.digest!==preview.manifest.digest)throw new CrmError('VERSION_CONFLICT',409);
    const sourceIds=await partnerFamily(sql,preview.source_id),target=preview.target_id;
    for(const table of ['partner_assignments','partner_tags']){const key=table==='partner_tags'?'tag_id':'membership_id';await sql.query(`INSERT INTO cohamy_crm.${table}(${key},organization_id) SELECT ${key},$2 FROM cohamy_crm.${table} WHERE organization_id=ANY($1::uuid[]) ON CONFLICT DO NOTHING`,[sourceIds,target]);}
    for(const [table,flag,selected] of [['partner_contacts','is_primary',preview.choices.primaryContact],['dealer_addresses','is_default',preview.choices.defaultAddress]]){
      const keeper=selected==='SOURCE'?preview.source_id:target;
      await sql.query(`UPDATE cohamy_crm.${table} SET ${flag}=false,version=version+1 WHERE organization_id=ANY($1::uuid[]) AND organization_id<>$2 AND ${flag}`,[ [...sourceIds,target],keeper]);
      await sql.query(`UPDATE cohamy_crm.${table} SET organization_id=$2,version=version+1 WHERE organization_id=ANY($1::uuid[])`,[sourceIds,target]);
    }
    await sql.query('UPDATE cohamy_crm.sessions SET revoked_at=now() WHERE membership_id IN(SELECT id FROM cohamy_crm.memberships WHERE organization_id=ANY($1::uuid[])) AND revoked_at IS NULL',[[...sourceIds,target]]);
    await sql.query('UPDATE cohamy_crm.memberships SET version=version+1 WHERE organization_id=$1',[target]);
    for(const table of ['memberships','dealer_carts','support_tickets','website_orders','opportunities','quotations','commercial_requests','sales_orders','partner_applications'])await sql.query(`UPDATE cohamy_crm.${table} SET organization_id=$2,version=version+1 WHERE organization_id=ANY($1::uuid[])`,[sourceIds,target]);
    await sql.query("UPDATE cohamy_crm.partner_invitations SET revoked_at=now() WHERE organization_id=ANY($1::uuid[]) AND revoked_at IS NULL",[sourceIds]);
    await sql.query('UPDATE cohamy_crm.partner_library SET organization_id=$2,version=version+1 WHERE organization_id=ANY($1::uuid[])',[sourceIds,target]);
    for(const table of ['tasks','care_schedules'])await sql.query(`UPDATE cohamy_crm.${table} SET entity_id=$2,version=version+1 WHERE entity_type='partner' AND entity_id=ANY($1::uuid[])`,[sourceIds,target]);
    await sql.query("UPDATE cohamy_crm.private_documents SET entity_id=$2 WHERE entity_type='partner' AND entity_id=ANY($1::uuid[])",[sourceIds,target]);
    if(preview.choices.contactPreferences==='SOURCE')await sql.query(`INSERT INTO cohamy_crm.contact_preferences(organization_id,channel,preferred_time,interested_skus,notes) SELECT $2,channel,preferred_time,interested_skus,notes FROM cohamy_crm.contact_preferences WHERE organization_id=$1 ON CONFLICT(organization_id) DO UPDATE SET channel=excluded.channel,preferred_time=excluded.preferred_time,interested_skus=excluded.interested_skus,notes=excluded.notes,version=cohamy_crm.contact_preferences.version+1,updated_at=now()`,[preview.source_id,target]);
    const values=current.fields.map(f=>f.after);await sql.query(`UPDATE cohamy_crm.organizations SET ${mergeFields.map((f,i)=>f+'=$'+(i+1)).join(',')},version=version+1 WHERE id=$${values.length+1}`,[...values,target]);
    await sql.query('UPDATE cohamy_crm.organizations SET merged_into_id=$2,active=false,version=version+1 WHERE id=ANY($1::uuid[])',[sourceIds,target]);
    const historyId=randomUUID();await sql.query('INSERT INTO cohamy_crm.partner_merge_history(id,source_id,target_id,actor_id,reason,choices,manifest) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)',[historyId,preview.source_id,target,user.id,preview.reason,JSON.stringify(preview.choices),JSON.stringify(current)]);
    const result={id:target,historyId,sourceId:preview.source_id};await sql.query('UPDATE cohamy_crm.partner_merge_previews SET result=$1::jsonb WHERE id=$2',[JSON.stringify(result),d.id]);
    await audit(sql,user.id,'partner.merged',target,{sourceId:preview.source_id,before:{version:current.target.version},after:{version:current.target.version+1},reason:preview.reason,historyId});return result;
  });
}
export async function mergeHistory(user:Principal,id:string) {await getOrganization(user,id);const inspect=user.area==='crm'&&['ADMIN','MANAGER'].includes(user.role);return(await(await database()).query<{id:string;source_id:string;target_id:string;reason:string;created_at:string;actor_name:string;manifest:MergeManifest|null;choices:Choices|null}>('SELECT h.id,h.source_id,h.target_id,h.reason,h.created_at,u.display_name AS actor_name,CASE WHEN $2::boolean THEN h.manifest ELSE NULL END AS manifest,CASE WHEN $2::boolean THEN h.choices ELSE NULL END AS choices FROM cohamy_crm.partner_merge_history h JOIN cohamy_crm.users u ON u.id=h.actor_id WHERE h.target_id=$1 OR h.source_id=$1 ORDER BY h.created_at DESC,h.id',[id,inspect])).rows;}

export async function mergeTargets(user:Principal,source:Organization) {manager(user);return(await(await database()).query<Pick<Organization,'id'|'name'|'kind'|'code'>>('SELECT id,name,kind,code FROM cohamy_crm.organizations WHERE kind=$1 AND active AND merged_into_id IS NULL AND id<>$2 ORDER BY name,id',[source.kind,source.id])).rows;}
