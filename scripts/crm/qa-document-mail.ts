import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {Database} from '../../lib/crm/db';
import {businessMailEvents} from '../../lib/crm/document-business-registry';
import {coreMailEvents} from '../../lib/crm/document-mail-model';
import {businessDocumentEvent} from '../../lib/crm/document-business-events';
import {mailFiles} from '../../lib/crm/document-mail';
export async function instrumentDocumentMailQa(db:Database,adminId:string){
 if(process.env.CRM_QA_DOCUMENT_MAIL!=='true')return;
 process.env.CRM_EMAIL_ENABLED='false';
 for(const e of [...coreMailEvents,...businessMailEvents.filter(e=>e.available)])await db.query("INSERT INTO cohamy_crm.document_mail_rules(id,event,enabled,recipients,updated_by) VALUES($1,$2,true,$3::jsonb,$4)",[randomUUID(),e.event,JSON.stringify({to:['documents@qa.invalid'],cc:['cc@qa.invalid'],bcc:['bcc@qa.invalid']}),adminId]);
 const original=db.close.bind(db);
 db.close=async()=>{try{
   const rows=(await db.query<{event:string;jobs:string}>("SELECT event,count(*)::text AS jobs FROM cohamy_crm.document_mail_outbox GROUP BY event ORDER BY event")).rows;
   const jobs=(await db.query<{files:{type:string;id:string;filename:string;checksum:string}[]}>('SELECT files FROM cohamy_crm.document_mail_outbox')).rows;
   let fileCount=0;for(const job of jobs)for(const f of job.files){const table=f.type==='BUSINESS'?'document_business_snapshots':f.type==='FLOW'?'document_flow_revisions':'document_versions';const r=(await db.query<{filename:string;checksum:string}>(`SELECT filename,checksum FROM cohamy_crm.${table} WHERE id=$1`,[f.id])).rows[0];if(!r||r.filename!==f.filename||r.checksum!==f.checksum)throw Error('QA_DOCUMENT_MAIL_FILE_MISMATCH');fileCount++;}
   const script=path.basename(process.argv[1]??'suite').replace(/\.[^.]+$/,'');await fs.mkdir('docs/crm/test-results/document-flow',{recursive:true});await fs.writeFile(`docs/crm/test-results/document-flow/events-${script}.json`,JSON.stringify({environment:process.env.CRM_DATABASE_MODE==='postgres'?'LOCAL native PostgreSQL':'LOCAL PGlite',provider:'DISABLED',evidence:'ACTUAL_SERVICE_EVENT: captured before synthetic source-mapping probes',events:rows,validatedFiles:fileCount},null,2));
   // These probes validate registry/table/file wiring, never claim execution of
   // an unvisited business transition. Keep them out of actual-service captures.
   const mappings:{event:string;table:string;status:string;entityId?:string;files?:number}[]=[];
   for(const definition of businessMailEvents.filter(event=>event.available)){
     const exists=(await db.query<{name:string|null}>('SELECT to_regclass($1)::text AS name',['cohamy_crm.'+definition.table])).rows[0]?.name;
     if(!exists){mappings.push({event:definition.event,table:definition.table,status:'NO_TABLE'});continue;}
     const source=(await db.query<{id:string}>(`SELECT id FROM cohamy_crm.${definition.table} ORDER BY id LIMIT 1`)).rows[0];
     if(!source){mappings.push({event:definition.event,table:definition.table,status:'NO_SOURCE_IN_FIXTURE'});continue;}
     const identity='source-mapping-'+randomUUID();
     await db.transaction(sql=>businessDocumentEvent(sql,definition.source,definition.action,source.id,{sourceMappingOnly:true},identity));
     const generated=(await db.query<{files:Parameters<typeof mailFiles>[1]}>('SELECT files FROM cohamy_crm.document_mail_outbox WHERE event_key=$1',[`${definition.event}:${source.id}:${identity}`])).rows;
     if(!generated.length)throw Error('QA_SOURCE_MAPPING_JOB_MISSING:'+definition.event);
     let files=0;for(const job of generated){const attachments=await mailFiles(db,job.files);if(!attachments.length)throw Error('QA_SOURCE_MAPPING_FILE_MISSING:'+definition.event);files+=attachments.length;}
     mappings.push({event:definition.event,table:definition.table,status:'SOURCE_MAPPING_PASS',entityId:source.id,files});
   }
   await fs.writeFile(`docs/crm/test-results/document-flow/source-mapping-${script}.json`,JSON.stringify({environment:process.env.CRM_DATABASE_MODE==='postgres'?'LOCAL native PostgreSQL':'LOCAL PGlite',provider:'DISABLED',evidence:'SOURCE_MAPPING only: registry action replayed against existing fixture row, not proof the actual transition/service branch executed',mappings},null,2));
 }finally{await original();}};
}
