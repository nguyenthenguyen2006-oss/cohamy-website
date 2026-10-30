import 'server-only';
import {randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {database,type Sql} from './db';
import {assertCurrentPrincipal,audit} from './auth';
import {CrmError} from './permissions';
import {parseCommercial as parse} from './commercial-common';
import {flowLabels,type FlowSnapshot} from './document-flow-model';
import {coreMailEvents,type MailFile,type MailRecipients} from './document-mail-model';
import {businessMailEvents} from './document-business-registry';
import {brevoStatus,sendDocumentEmail,type DocumentEmail} from './brevo';
import type {Principal} from './types';
import {isBrevoDemo} from './brevo-settings';

type Rule={id:string;event:string;warehouse_id:string|null;factory_membership_id:string|null;enabled:boolean;recipients:MailRecipients;subject:string;body:string;attachments:'EVENT'|'BUNDLE';version:number};
type Job={id:string;event_key:string;event:string;entity_id:string;revision:number;rule_id:string|null;warehouse_id:string|null;factory_membership_id:string|null;code:string;recipients:MailRecipients;subject:string;body:string;files:MailFile[];status:string;attempts:number;message_id:string|null;claim_token:string};
type BusinessPreview={id:string;event:string;entity_id:string;revision:number;filename:string;checksum:string;created_at:string;snapshot:{record?:Record<string,unknown>;version?:Record<string,unknown>;result?:Record<string,unknown>;label?:string;envelope?:FlowSnapshot;context?:Partial<FlowSnapshot>;files?:MailFile[];excludeRecipients?:string[]}};
export function mailAdmin(user:Principal){if(user.area!=='crm'||user.role!=='ADMIN')throw new CrmError('FORBIDDEN',403);}
// Only expose dimensions that the event envelope can derive from its real source.
export function documentMailScopes(event:string){
  if(coreMailEvents.some(e=>e.event===event))return {warehouse:true,factory:event!=='warehouse.issue.confirmed'};
  const definition=businessMailEvents.find(e=>e.event===event&&e.available);
  const warehouseTables=new Set(['commercial_requests','sales_orders','goods_receipts','supplier_claims','consignment_agreements','consignment_shipments','consignment_sale_reports','consignment_returns','deliveries','return_requests','inventory_transfers','stock_counts','inventory_documents']);
  return {warehouse:!!definition&&(warehouseTables.has(definition.table)||!!definition.warehouseField),factory:false};
}
const recipientsSchema=z.object({to:z.array(z.email()).max(50),cc:z.array(z.email()).max(50),bcc:z.array(z.email()).max(50)}).strict();
function normalizedRecipients(v:MailRecipients){const seen=new Set<string>();const clean=(items:string[])=>items.map(s=>s.trim().toLowerCase()).filter(s=>{if(seen.has(s))return false;seen.add(s);return true;});return {to:clean(v.to),cc:clean(v.cc),bcc:clean(v.bcc)};}
function takeRecipients(v:MailRecipients,seen:Set<string>){const recipients=normalizedRecipients(v);for(const group of ['to','cc','bcc'] as const)recipients[group]=recipients[group].filter(email=>{if(seen.has(email))return false;seen.add(email);return true;});if(!recipients.to.length){const first=recipients.cc.shift()??recipients.bcc.shift();if(first)recipients.to.push(first);}return recipients;}
function mailUrl(s:FlowSnapshot,event?:string){
  const base=(process.env.CRM_PUBLIC_BASE_URL??process.env.CRM_PUBLIC_ORIGIN??process.env.NEXT_PUBLIC_SITE_URL??'http://localhost:3000').replace(/\/$/,'');
  if(!event||coreMailEvents.some(e=>e.event===event))return `${base}/api/crm/document-flow/pdf?id=${encodeURIComponent(s.id)}&revision=${s.revision}`;
  const route=event.startsWith('audit:commercial-request.')?`requests/${s.id}`:event.startsWith('audit:quotation.')?`quotations/${s.id}`:event.startsWith('audit:sales-order.')?`sales/${s.id}`:event.startsWith('finance:')?'cash':event.startsWith('inventory:')?'inventory':`search?q=${encodeURIComponent(s.code)}`;
  return `${base}/crm/${route}`;
}
function interpolate(text:string,s:FlowSnapshot,label?:string,url=mailUrl(s)){
  const values:Record<string,string>={type:label??flowLabels[s.kind],code:s.code,status:s.state,date:s.confirmedAt??s.createdAt,warehouse:s.warehouseName,factory:s.factoryName,source:s.sourceCode,request:s.requestCode,url,revision:String(s.revision)};
  return text.replace(/\{\{(\w+)\}\}/g,(_,k:string)=>values[k]??'');
}
async function previewRecipients(sql:Sql,rule:Rule,s:FlowSnapshot,excluded:string[]=[]){
  const seen=new Set(excluded.map(email=>email.trim().toLowerCase()));
  const preceding=(await sql.query<Rule>('SELECT * FROM cohamy_crm.document_mail_rules WHERE event=$1 AND enabled AND id<$2 AND (warehouse_id IS NULL OR warehouse_id=$3) AND (factory_membership_id IS NULL OR factory_membership_id=$4) ORDER BY id',[rule.event,rule.id,s.warehouseId||null,s.factoryMembershipId])).rows;
  for(const earlier of preceding)takeRecipients(earlier.recipients,seen);
  return takeRecipients(rule.recipients,seen);
}
export async function enqueueDocumentMail(sql:Sql,input:{event:string;snapshot:FlowSnapshot;files:MailFile[];label?:string;eventIdentity?:string;jobRevision?:number;excludeRecipients?:string[];url?:string}){
  const s=input.snapshot;
  const rules=(await sql.query<Rule>('SELECT * FROM cohamy_crm.document_mail_rules WHERE event=$1 AND enabled AND (warehouse_id IS NULL OR warehouse_id=$2) AND (factory_membership_id IS NULL OR factory_membership_id=$3) ORDER BY id',[input.event,s.warehouseId||null,s.factoryMembershipId])).rows;
  // Overlapping rules cannot mail the same person twice for one event/version.
  const sentTo=new Set<string>((input.excludeRecipients??[]).map(email=>email.trim().toLowerCase()));
  for(const rule of rules){
    const recipients=takeRecipients(rule.recipients,sentTo);
    if(!recipients.to.length)continue;
    const files=[...input.files];
    if(rule.attachments==='BUNDLE'){
      const refs=[{id:s.sourceId,revision:s.sourceRevision},{id:s.requestId,revision:s.requestRevision}];
      if(input.event.startsWith('vat.'))refs.push({id:s.id,revision:s.revision});
      for(const ref of refs.filter(r=>r.id)){
        const r=(await sql.query<{id:string;filename:string;checksum:string}>('SELECT id,filename,checksum FROM cohamy_crm.document_flow_revisions WHERE entity_id=$1 AND ($2::integer IS NULL OR revision=$2) ORDER BY revision DESC LIMIT 1',[ref.id,ref.revision??null])).rows[0];
        if(r&&!files.some(f=>f.id===r.id))files.push({type:'FLOW',...r});
      }
    }
    await sql.query('INSERT INTO cohamy_crm.document_mail_outbox(id,event_key,event,entity_id,revision,rule_id,warehouse_id,factory_membership_id,code,recipients,subject,body,files) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13::jsonb) ON CONFLICT(event_key,rule_id) DO NOTHING',[randomUUID(),`${input.event}:${s.id}:${input.eventIdentity??s.revision}`,input.event,s.id,input.jobRevision??s.revision,rule.id,s.warehouseId||null,s.factoryMembershipId,s.code,JSON.stringify(recipients),interpolate(rule.subject,s,input.label,input.url??mailUrl(s,input.event)),interpolate(rule.body,s,input.label,input.url??mailUrl(s,input.event)),JSON.stringify(files)]);
  }
}
export async function mailSettings(user:Principal){mailAdmin(user);const db=await database();await assertCurrentPrincipal(db,user);return {events:[...coreMailEvents.map(e=>({...e,available:true})),...businessMailEvents].map(e=>({...e,scopes:documentMailScopes(e.event)})),rules:(await db.query<Rule>('SELECT * FROM cohamy_crm.document_mail_rules ORDER BY event,id')).rows,provider:await brevoStatus(),businessSnapshots:(await db.query<{id:string;event:string;entity_id:string;revision:number;code:string;label:string;created_at:string}>("SELECT id,event,entity_id,revision,COALESCE(snapshot->'record'->>'code',entity_id::text) AS code,COALESCE(snapshot->>'label',event) AS label,created_at FROM cohamy_crm.document_business_snapshots ORDER BY created_at DESC LIMIT 500")).rows,jobs:(await db.query('SELECT id,event,entity_id,revision,code,warehouse_id,recipients,subject,files,status,attempts,message_id,last_error,created_at,updated_at,parent_job_id FROM cohamy_crm.document_mail_outbox ORDER BY created_at DESC LIMIT 500')).rows};}
export async function saveMailRule(user:Principal,input:unknown){
  mailAdmin(user);const d=parse(z.object({id:z.uuid().optional(),event:z.enum([...coreMailEvents.map(x=>x.event),...businessMailEvents.filter(e=>e.available).map(e=>e.event)]),warehouseId:z.uuid().nullable(),factoryMembershipId:z.uuid().nullable(),enabled:z.boolean(),recipients:recipientsSchema,subject:z.string().trim().min(1).max(200),body:z.string().trim().min(1).max(10000),attachments:z.enum(['EVENT','BUNDLE']),version:z.number().int().min(0)}).strict(),input);
  const scopes=documentMailScopes(d.event);if((d.warehouseId&&!scopes.warehouse)||(d.factoryMembershipId&&!scopes.factory))throw new CrmError('MAIL_SCOPE_NOT_SUPPORTED',400);
  return(await database()).transaction(async sql=>{await assertCurrentPrincipal(sql,user);
    if(d.warehouseId&&!(await sql.query('SELECT id FROM cohamy_crm.warehouses WHERE id=$1 AND organization_id=$2',[d.warehouseId,user.organizationId])).rows.length)throw new CrmError('NOT_FOUND',404);
    if(d.factoryMembershipId&&!(await sql.query("SELECT id FROM cohamy_crm.memberships WHERE id=$1 AND organization_id=$2 AND role='FACTORY' AND active",[d.factoryMembershipId,user.organizationId])).rows.length)throw new CrmError('NOT_FOUND',404);
    const recipients=normalizedRecipients(d.recipients);if(d.enabled&&!recipients.to.length)throw new CrmError('MAIL_RECIPIENTS_REQUIRED',400);
    const id=d.id??randomUUID(),before=d.id?(await sql.query<Rule>('SELECT * FROM cohamy_crm.document_mail_rules WHERE id=$1 FOR UPDATE',[id])).rows[0]:null;
    if(d.id&&(!before||before.version!==d.version))throw new CrmError('VERSION_CONFLICT',409);
    if(before)await sql.query('UPDATE cohamy_crm.document_mail_rules SET event=$1,warehouse_id=$2,factory_membership_id=$3,enabled=$4,recipients=$5::jsonb,subject=$6,body=$7,attachments=$8,version=version+1,updated_by=$9,updated_at=now() WHERE id=$10',[d.event,d.warehouseId,d.factoryMembershipId,d.enabled,JSON.stringify(recipients),d.subject,d.body,d.attachments,user.id,id]);
    else await sql.query('INSERT INTO cohamy_crm.document_mail_rules(id,event,warehouse_id,factory_membership_id,enabled,recipients,subject,body,attachments,updated_by) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)',[id,d.event,d.warehouseId,d.factoryMembershipId,d.enabled,JSON.stringify(recipients),d.subject,d.body,d.attachments,user.id]);
    await audit(sql,user.id,'document-mail.rule-saved',id,{before,after:{...d,recipients}});return {id,version:(before?.version??0)+1};
  });
}
export async function removeMailRule(user:Principal,input:unknown){mailAdmin(user);const d=parse(z.object({id:z.uuid(),version:z.number().int().positive()}).strict(),input);return(await database()).transaction(async sql=>{await assertCurrentPrincipal(sql,user);const before=(await sql.query<Rule>('SELECT * FROM cohamy_crm.document_mail_rules WHERE id=$1 FOR UPDATE',[d.id])).rows[0];if(!before||before.version!==d.version)throw new CrmError('VERSION_CONFLICT',409);await sql.query('UPDATE cohamy_crm.document_mail_rules SET enabled=false,recipients=$1::jsonb,version=version+1,updated_by=$2,updated_at=now() WHERE id=$3',[JSON.stringify({to:[],cc:[],bcc:[]}),user.id,d.id]);await audit(sql,user.id,'document-mail.rule-cleared',d.id,{before});return {ok:true};});}
export async function mailFiles(sql:Sql,files:MailFile[]){
  const result:{name:string;content:string}[]=[];
  for(const file of files){
    const r=file.type==='FLOW'?(await sql.query<{content:Uint8Array;checksum:string;filename:string}>('SELECT pdf AS content,checksum,filename FROM cohamy_crm.document_flow_revisions WHERE id=$1',[file.id])).rows[0]:file.type==='BUSINESS'?(await sql.query<{content:Uint8Array;checksum:string;filename:string}>('SELECT pdf AS content,checksum,filename FROM cohamy_crm.document_business_snapshots WHERE id=$1',[file.id])).rows[0]:(await sql.query<{content:Uint8Array;checksum:string;filename:string}>('SELECT content,checksum,filename FROM cohamy_crm.document_versions WHERE id=$1',[file.id])).rows[0];
    if(!r||r.checksum!==file.checksum||r.filename!==file.filename)throw new CrmError('MAIL_FILE_NOT_READY',409);
    const bytes=Buffer.from(r.content);const actual=createHash('sha256').update(file.type==='PRIVATE'?bytes.toString('base64'):bytes).digest('hex');const legacyVat=file.type==='VAT'&&createHash('sha256').update(bytes.toString('base64')).digest('hex')===file.checksum;if(actual!==file.checksum&&!legacyVat)throw new CrmError('MAIL_FILE_CHECKSUM_INVALID',409);
    result.push({name:file.filename,content:bytes.toString('base64')});
  }
  return result;
}
export async function previewMail(user:Principal,input:unknown){mailAdmin(user);const d=parse(z.object({id:z.uuid()}).strict(),input);const db=await database();await assertCurrentPrincipal(db,user);const job=(await db.query<Job>('SELECT * FROM cohamy_crm.document_mail_outbox WHERE id=$1',[d.id])).rows[0];if(!job)throw new CrmError('NOT_FOUND',404);return {recipients:job.recipients,subject:job.subject,body:job.body,files:job.files};}
export async function previewMailRule(user:Principal,input:unknown){
  mailAdmin(user);const d=parse(z.object({ruleId:z.uuid(),documentId:z.uuid().optional(),businessSnapshotId:z.uuid().optional()}).strict().refine(v=>!!v.documentId!==!!v.businessSnapshotId),input);const sql=await database();await assertCurrentPrincipal(sql,user);
  const rule=(await sql.query<Rule>('SELECT * FROM cohamy_crm.document_mail_rules WHERE id=$1',[d.ruleId])).rows[0];if(!rule)throw new CrmError('NOT_FOUND',404);
  if(d.businessSnapshotId){
    const saved=(await sql.query<BusinessPreview>('SELECT id,event,entity_id,revision,filename,checksum,created_at,snapshot FROM cohamy_crm.document_business_snapshots WHERE id=$1',[d.businessSnapshotId])).rows[0];if(!saved)throw new CrmError('NOT_FOUND',404);
    const record=saved.snapshot.record??{},context=saved.snapshot.context??{},s:FlowSnapshot=saved.snapshot.envelope??{id:saved.entity_id,code:String(record.code??saved.entity_id),kind:'REQUEST',revision:saved.revision,state:String(saved.snapshot.result?.status??record.status??saved.event),warehouseId:context.warehouseId??String(record.warehouse_id??''),warehouseName:context.warehouseName??'',warehouseCode:context.warehouseCode??'',factoryMembershipId:context.factoryMembershipId??null,factoryName:context.factoryName??'',sourceId:null,sourceCode:String(record.order_id??record.request_id??''),sourceRevision:null,requestId:null,requestCode:'',createdAt:String(record.created_at??saved.created_at),createdBy:'',confirmedAt:saved.created_at,confirmedBy:'',dueDate:'',note:'',lines:[],delivery:{},totals:{}};
    const applies=rule.event===saved.event&&(!rule.warehouse_id||rule.warehouse_id===s.warehouseId)&&(!rule.factory_membership_id||rule.factory_membership_id===s.factoryMembershipId);
    const files:MailFile[]=[{type:'BUSINESS',id:saved.id,filename:saved.filename,checksum:saved.checksum}];
    if(saved.snapshot.files){for(const file of saved.snapshot.files)if(!files.some(f=>f.type===file.type&&f.id===file.id))files.push(file);}
    else {
      const privateIds=new Set<string>();const findFiles=(value:unknown)=>{if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(['document_version_id','documentVersionId','photo_document_id','signature_document_id'].includes(key)&&typeof item==='string')privateIds.add(item);else if(typeof item==='object')findFiles(item);}};findFiles(saved.snapshot);
      for(const id of privateIds){const file=(await sql.query<{id:string;filename:string;checksum:string}>('SELECT id,filename,checksum FROM cohamy_crm.document_versions WHERE id=$1',[id])).rows[0];if(file)files.push({type:'PRIVATE',...file});}
    }
    const recipients=await previewRecipients(sql,rule,s,saved.snapshot.excludeRecipients);
    return {recipients:applies?recipients:{to:[],cc:[],bcc:[]},subject:interpolate(rule.subject,s,saved.snapshot.label,mailUrl(s,saved.event)),body:interpolate(rule.body,s,saved.snapshot.label,mailUrl(s,saved.event)),files:applies&&recipients.to.length?files:[],applies,enabled:rule.enabled};
  }
  const {viewFlowDocument}=await import('./document-flow');let s=await viewFlowDocument(user,d.documentId!);if(s.state!=='CONFIRMED')throw new CrmError('SOURCE_NOT_CONFIRMED',409);
  const vat=rule.event.startsWith('vat.')?(await sql.query<{id:string;filename:string;checksum:string;source_revision:number|null}>('SELECT v.id,v.filename,v.checksum,l.source_revision FROM cohamy_crm.document_vat_links l JOIN cohamy_crm.document_versions v ON v.id=l.version_id WHERE l.entity_id=$1 ORDER BY l.revision DESC LIMIT 1',[s.id])).rows[0]:undefined;
  if(vat?.source_revision&&vat.source_revision!==s.revision)s=await viewFlowDocument(user,d.documentId!,vat.source_revision);
  if(rule.event==='factory.request.accepted')s={...s,state:'ACCEPTED'};
  const eventKinds:Record<string,string[]>={'factory.request.sent':['REQUEST'],'factory.request.accepted':['REQUEST'],'factory.dispatch.confirmed':['DISPATCH'],'factory.receipt.confirmed':['RECEIPT'],'factory.receipt.discrepancy':['RECEIPT'],'warehouse.issue.confirmed':['ISSUE'],'vat.saved':['DISPATCH','ISSUE'],'vat.replaced':['DISPATCH','ISSUE'],'document.amended':['REQUEST','DISPATCH','RECEIPT','ISSUE']};
  const applies=!!eventKinds[rule.event]?.includes(s.kind)&&(!rule.event.startsWith('vat.')||!!vat)&&(!rule.warehouse_id||rule.warehouse_id===s.warehouseId)&&(!rule.factory_membership_id||rule.factory_membership_id===s.factoryMembershipId);
  const files:MailFile[]=[];
  if(rule.event.startsWith('vat.')){if(vat)files.push({type:'VAT',id:vat.id,filename:vat.filename,checksum:vat.checksum});}
  else {const file=(await sql.query<{id:string;filename:string;checksum:string}>('SELECT id,filename,checksum FROM cohamy_crm.document_flow_revisions WHERE entity_id=$1 AND revision=$2',[s.id,s.revision])).rows[0];if(file)files.push({type:'FLOW',...file});}
  if(rule.attachments==='BUNDLE')for(const ref of [{id:s.sourceId,revision:s.sourceRevision},{id:s.requestId,revision:s.requestRevision},...(rule.event.startsWith('vat.')?[{id:s.id,revision:s.revision}]:[])]){if(!ref.id)continue;const f=(await sql.query<{id:string;filename:string;checksum:string}>('SELECT id,filename,checksum FROM cohamy_crm.document_flow_revisions WHERE entity_id=$1 AND ($2::integer IS NULL OR revision=$2) ORDER BY revision DESC LIMIT 1',[ref.id,ref.revision??null])).rows[0];if(f&&!files.some(x=>x.id===f.id))files.push({type:'FLOW',...f});}
  const recipients=await previewRecipients(sql,rule,s);
  return {recipients:applies?recipients:{to:[],cc:[],bcc:[]},subject:interpolate(rule.subject,s),body:interpolate(rule.body,s),files:applies&&recipients.to.length?files:[],applies,enabled:rule.enabled};
}
export async function retryDocumentMail(user:Principal,input:unknown){
  mailAdmin(user);const d=parse(z.object({id:z.uuid(),reason:z.string().trim().min(5).max(1000),resend:z.boolean().default(false)}).strict(),input);
  return(await database()).transaction(async sql=>{await assertCurrentPrincipal(sql,user);const old=(await sql.query<Job>('SELECT * FROM cohamy_crm.document_mail_outbox WHERE id=$1 FOR UPDATE',[d.id])).rows[0];if(!old)throw new CrmError('NOT_FOUND',404);if(old.status==='SENDING'||(!d.resend&&!['RETRY','FAILED','DEFERRED'].includes(old.status)))throw new CrmError('MAIL_EXPLICIT_RESEND_REQUIRED',409);
    const id=randomUUID();await sql.query("INSERT INTO cohamy_crm.document_mail_outbox(id,event_key,event,entity_id,revision,rule_id,warehouse_id,factory_membership_id,code,recipients,subject,body,files,parent_job_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13::jsonb,$14,$15)",[id,`${old.event_key}:resend:${id}`,old.event,old.entity_id,old.revision,old.rule_id,old.warehouse_id,old.factory_membership_id,old.code,JSON.stringify(old.recipients),old.subject,old.body,JSON.stringify(old.files),old.id,user.id]);
    if(['PENDING','RETRY','FAILED','DEFERRED'].includes(old.status))await sql.query("UPDATE cohamy_crm.document_mail_outbox SET status='SUPERSEDED',updated_at=now() WHERE id=$1",[old.id]);
    await audit(sql,user.id,'document-mail.manual-retry',old.entity_id,{jobId:old.id,newJobId:id,previousStatus:old.status,reason:d.reason,explicitResend:d.resend});return {id};
  });
}
export async function testDocumentMail(user:Principal,input:unknown){
  mailAdmin(user);const d=parse(z.object({email:z.email()}).strict(),input);const db=await database();await assertCurrentPrincipal(db,user);
  const id=randomUUID();await db.transaction(async sql=>{await sql.query("INSERT INTO cohamy_crm.document_mail_outbox(id,event_key,event,entity_id,revision,code,recipients,subject,body,files,created_by) VALUES($1,$2,'mail.test',$3,1,'TEST',$4::jsonb,'Cohamy · Kiểm tra thông báo chứng từ','Email thử do Admin chủ động yêu cầu. Không phát sinh giao dịch kho hoặc tiền.','[]'::jsonb,$3)",[id,`test:${id}`,user.id,JSON.stringify({to:[d.email],cc:[],bcc:[]})]);await audit(sql,user.id,'document-mail.test-requested',id,{recipient:d.email});});return {id};
}
export async function runDocumentMailOutbox(provider:(input:DocumentEmail)=>Promise<string>=sendDocumentEmail){
  const db=await database();
  // A crashed request may already have reached Brevo. Never automatically resend it.
  await db.query("UPDATE cohamy_crm.document_mail_outbox SET status='UNKNOWN',last_error='WORKER_CRASH_RESULT_UNKNOWN',claim_token=NULL,updated_at=now() WHERE status='SENDING' AND claimed_at<now()-interval '2 minutes'");
  const rows=(await db.query<{id:string}>("SELECT id FROM cohamy_crm.document_mail_outbox WHERE status IN('PENDING','RETRY','DEFERRED') AND attempts<5 AND available_at<=now() ORDER BY available_at,id LIMIT 20")).rows;
  let accepted=0,failed=0;
  for(const r of rows){
    const token=randomUUID(),job=(await db.query<Job>("UPDATE cohamy_crm.document_mail_outbox SET status='SENDING',claim_token=$2,claimed_at=now(),attempts=attempts+1,updated_at=now() WHERE id=$1 AND status IN('PENDING','RETRY','DEFERRED') AND available_at<=now() RETURNING *",[r.id,token])).rows[0];if(!job)continue;
    try{
      const attachments=await mailFiles(db,job.files);if(job.event!=='mail.test'&&!businessMailEvents.some(e=>e.event===job.event&&e.available&&e.notificationOnly)&&!attachments.length)throw new CrmError('MAIL_FILE_NOT_READY',409);
      const messageId=await provider({recipients:job.recipients,subject:job.subject,textContent:job.body,attachments,jobId:job.id});
      await db.transaction(async sql=>{
        const state=provider===sendDocumentEmail&&isBrevoDemo()?'SIMULATED':'ACCEPTED';
        await sql.query("UPDATE cohamy_crm.document_mail_outbox SET status=$4,message_id=$1,last_error='',claim_token=NULL,updated_at=now() WHERE id=$2 AND claim_token=$3",[messageId,job.id,token,state]);
        if(state==='ACCEPTED')await reconcileProviderStatus(sql,{...job,message_id:messageId});
      });accepted++;
    }catch(e){
      const code=e instanceof CrmError?e.code:'EMAIL_RESULT_UNKNOWN';
      const retry=['EMAIL_RATE_LIMITED','EMAIL_PROVIDER_UNAVAILABLE'].includes(code),deferred=['EMAIL_NOT_CONFIGURED','EMAIL_DISABLED','MAIL_FILE_NOT_READY','BREVO_ENCRYPTION_NOT_CONFIGURED','BREVO_SECRET_UNREADABLE','BREVO_SETTINGS_UNAVAILABLE'].includes(code),unknown=code==='EMAIL_RESULT_UNKNOWN';
      const status=unknown?'UNKNOWN':deferred?'DEFERRED':retry&&job.attempts<5?'RETRY':'FAILED';
      await db.query("UPDATE cohamy_crm.document_mail_outbox SET status=$1,last_error=$2,available_at=now()+($3::integer*interval '1 second'),claim_token=NULL,attempts=GREATEST(attempts-$6,0),updated_at=now() WHERE id=$4 AND claim_token=$5",[status,code,Math.min(3600,30*2**job.attempts),job.id,token,deferred?1:0]);failed++;
    }
  }return {processed:accepted+failed,accepted,failed};
}
export function verifyBrevoWebhook(authorization:string|null){
  const secret=process.env.CRM_BREVO_WEBHOOK_TOKEN;if(!secret||secret.length<24)throw new CrmError('WEBHOOK_NOT_CONFIGURED',503);
  const expected=Buffer.from(`Bearer ${secret}`),actual=Buffer.from(authorization??'');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new CrmError('FORBIDDEN',403);
}
export async function receiveBrevoWebhook(input:unknown){
  const d=parse(z.object({event:z.string().max(80),email:z.email(),'message-id':z.string().min(1).max(500),ts_event:z.number().optional(),ts:z.number().optional(),id:z.union([z.string(),z.number()]).optional()}).passthrough(),input);
  const ts=d.ts_event??d.ts;if(!ts||!Number.isFinite(ts)||ts<0||ts>Date.now()/1000+300)throw new CrmError('WEBHOOK_TIMESTAMP_INVALID',400);
  const messageId=d['message-id'].replace(/^<|>$/g,''),at=new Date(ts*1000),eventKey=createHash('sha256').update(`${messageId}:${d.email.toLowerCase()}:${d.event}:${ts}`).digest('hex');
  return(await database()).transaction(async sql=>{
    const inserted=await sql.query('INSERT INTO cohamy_crm.document_mail_webhooks(event_key,message_id,recipient,event,occurred_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING event_key',[eventKey,messageId,d.email.toLowerCase(),d.event,at]);if(!inserted.rows.length)return {duplicate:true};
    const jobs=(await sql.query<Job>("SELECT * FROM cohamy_crm.document_mail_outbox WHERE trim(both '<>' from message_id)=$1 FOR UPDATE",[messageId])).rows;
    for(const job of jobs){
      const recipients=[...job.recipients.to,...job.recipients.cc,...job.recipients.bcc].map(x=>x.toLowerCase());if(!recipients.includes(d.email.toLowerCase()))continue;
      await reconcileProviderStatus(sql,job);
    }return {ok:true};
  });
}
async function reconcileProviderStatus(sql:Sql,job:Job){
  if(!job.message_id)return;
  const id=job.message_id.replace(/^<|>$/g,''),recipients=[...job.recipients.to,...job.recipients.cc,...job.recipients.bcc].map(x=>x.toLowerCase());
  const states=(await sql.query<{recipient:string;event:string}>("SELECT DISTINCT ON(recipient) recipient,event FROM cohamy_crm.document_mail_webhooks WHERE message_id=$1 AND event IN('delivered','hard_bounce','soft_bounce','blocked','invalid','error','deferred') AND recipient=ANY($2::text[]) ORDER BY recipient,occurred_at DESC,CASE event WHEN 'delivered' THEN 2 ELSE 1 END DESC",[id,recipients])).rows;
  const delivered=recipients.length>0&&recipients.every(email=>states.some(x=>x.recipient===email&&x.event==='delivered')),bounce=states.some(x=>['hard_bounce','blocked','invalid','error'].includes(x.event));
  const status=delivered?'DELIVERED':bounce?'BOUNCED':states.some(x=>['soft_bounce','deferred'].includes(x.event))?'PROVIDER_DEFERRED':'ACCEPTED';
  await sql.query('UPDATE cohamy_crm.document_mail_outbox SET status=$1,updated_at=now() WHERE id=$2',[status,job.id]);
}
