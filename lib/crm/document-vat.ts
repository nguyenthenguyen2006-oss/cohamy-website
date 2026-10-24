import 'server-only';
import {randomUUID} from 'node:crypto';
import type {Sql} from './db';
import type {Principal} from './types';
import {CrmError} from './permissions';
import {flowAccess,flowEntityAccess} from './document-flow';
import {enqueueDocumentMail} from './document-mail';

const flowTypes=['factory-invoice','warehouse-reconciliation','warehouse-handover','vat-invoice','order-clearance'];
export async function guardFlowUpload(sql:Sql,user:Principal,d:{entityType:string;entityId:string;documentId?:string;docCategory?:string;reason?:string}){
  if(!flowTypes.includes(d.entityType)){
    if(user.role==='ACCOUNTANT')throw new CrmError('FORBIDDEN',403);
    return null;
  }
  await flowEntityAccess(sql,user,d.entityType,d.entityId);
  if(user.area!=='crm'||!['ADMIN','ACCOUNTANT'].includes(user.role)||!d.docCategory?.startsWith('VAT'))throw new CrmError('CONFIRMED_DOCUMENT_ATTACHMENTS_LOCKED',403);
  if(d.documentId)throw new CrmError('VAT_FILE_LOCKED',409);
  const row=await flowAccess(sql,user,d.entityId,d.entityType==='warehouse-handover'?'ISSUE':undefined,true);
  if(row.workflow_state!=='CONFIRMED'||!row.flow_payload||!['DISPATCH','RECEIPT','ISSUE'].includes(row.flow_payload.kind))throw new CrmError('VAT_CONFIRMED_SOURCE_REQUIRED',409);
  const source=row.flow_payload.kind==='RECEIPT'?await flowAccess(sql,user,row.parent_id!, 'DISPATCH',true):row;
  const type=source.flow_payload!.kind==='ISSUE'?'warehouse-handover':'factory-invoice';
  const old=(await sql.query<{revision:number}>('SELECT revision FROM cohamy_crm.document_vat_links WHERE entity_type=$1 AND entity_id=$2 ORDER BY revision DESC LIMIT 1',[type,source.id])).rows[0];
  if(old&&(user.role!=='ADMIN'||!d.reason||d.reason.trim().length<5))throw new CrmError('VAT_FILE_LOCKED',409);
  return {entityType:type,entityId:source.id,revision:(old?.revision??0)+1,snapshot:source.flow_payload!,reason:d.reason?.trim()??'Lưu tài liệu VAT gốc'};
}
export async function sealVatUpload(sql:Sql,user:Principal,seal:Awaited<ReturnType<typeof guardFlowUpload>>,file:{versionId:string;filename:string;checksum:string}){
  if(!seal)return;
  await sql.query('INSERT INTO cohamy_crm.document_vat_links(id,entity_type,entity_id,version_id,revision,actor_id,reason,source_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),seal.entityType,seal.entityId,file.versionId,seal.revision,user.id,seal.reason,seal.snapshot.revision]);
  await enqueueDocumentMail(sql,{event:seal.revision===1?'vat.saved':'vat.replaced',snapshot:seal.snapshot,eventIdentity:`vat-${seal.revision}`,jobRevision:seal.revision,files:[{type:'VAT',id:file.versionId,filename:file.filename,checksum:file.checksum}]});
}
