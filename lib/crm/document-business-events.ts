import 'server-only';
import {randomUUID,createHash} from 'node:crypto';
import type {Sql} from './db';
import {businessMailEvents} from './document-business-registry';
import {enqueueDocumentMail} from './document-mail';
import {renderBusinessPdf} from './document-flow-pdf';
import type {FlowSnapshot} from './document-flow-model';
import type {MailFile} from './document-mail-model';

export async function businessDocumentEvent(sql:Sql,source:string,action:string,id:string,result:unknown={},eventIdentity?:string){
 if(source==='finance'&&['PAYMENT_CREATED','PAYMENT_REVIEWED'].includes(action)){
   const proof=(await sql.query('SELECT id FROM cohamy_crm.bank_transfer_proofs WHERE payment_id=$1 LIMIT 1',[id])).rows.length>0;
   const state=String((result as Record<string,unknown>)?.status??'');
   if(action==='PAYMENT_CREATED')await businessDocumentEvent(sql,source,proof?'PAYMENT_PROOF_SUBMITTED':'PAYMENT_RECEIPT_CREATED',id,result,eventIdentity);
   else {if(proof)await businessDocumentEvent(sql,source,state==='CONFIRMED'?'PAYMENT_PROOF_CONFIRMED':'PAYMENT_PROOF_REJECTED',id,result,eventIdentity);if(state==='CONFIRMED')await businessDocumentEvent(sql,source,'PAYMENT_RECEIPT_CONFIRMED',id,result,eventIdentity);}
   return;
 }
 if(source==='finance'&&['CASH_REQUESTED','CASH_APPROVE','CASH_REJECT','CASH_EXECUTE','CASH_REVERSE'].includes(action)){
   const row=(await sql.query<{kind:string}>('SELECT kind FROM cohamy_crm.cash_requests WHERE id=$1',[id])).rows[0];if(!row)return;
   const deposit=(await sql.query('SELECT id FROM cohamy_crm.deposit_refund_requests WHERE cash_request_id=$1',[id])).rows.length>0;
   return businessDocumentEvent(sql,source,`CASH_${deposit?'DEPOSIT_REFUND':row.kind}_${action.slice(5)}`,id,result,eventIdentity);
 }
 const definition=businessMailEvents.find(e=>e.source===source&&e.action===action&&e.available);
 if(!definition||!/^[0-9a-f-]{36}$/i.test(id))return;
 const event=definition.event;
 if(!(await sql.query('SELECT id FROM cohamy_crm.document_mail_rules WHERE event=$1 AND enabled LIMIT 1',[event])).rows.length)return;
 const row=(await sql.query<Record<string,unknown>>(`SELECT to_jsonb(t) AS data FROM cohamy_crm.${definition.table} t WHERE id=$1`,[id])).rows[0]?.data as Record<string,unknown>|undefined;
 if(!row)throw Error('DOCUMENT_EVENT_SOURCE_MISSING:'+event);
 let version:Record<string,unknown>|null=null;
 const versionTable=definition.table==='commercial_requests'?'commercial_request_versions':definition.table==='sales_orders'?'sales_order_versions':definition.table==='quotations'?'quotation_versions':definition.table==='consignment_agreements'?'consignment_agreement_versions':definition.table==='supplier_rfqs'?'supplier_rfq_versions':null;
 if(versionTable){
   const detail=(result&&typeof result==='object'?'after' in result?(result as {after?:Record<string,unknown>}).after:undefined:undefined);
   const versionId=detail?.versionId??row.confirmed_version_id??row.accepted_version_id??row.sent_version_id??row.current_version_id??row.latest_version_id;
   if(versionId)version=(await sql.query<{data:Record<string,unknown>}>(`SELECT to_jsonb(v) AS data FROM cohamy_crm.${versionTable} v WHERE id=$1`,[versionId])).rows[0]?.data??null;
   else if(definition.table==='supplier_rfqs')version=(await sql.query<{data:Record<string,unknown>}>('SELECT to_jsonb(v) AS data FROM cohamy_crm.supplier_rfq_versions v WHERE rfq_id=$1 ORDER BY number DESC LIMIT 1',[id])).rows[0]?.data??null;
 }
 const children:Record<string,unknown[]>={};for(const [child,column] of definition.children??[])children[child]=(await sql.query<{data:Record<string,unknown>}>(`SELECT to_jsonb(c) AS data FROM cohamy_crm.${child} c WHERE ${column}=$1`,[id])).rows.map(x=>x.data);
 let warehouseId=String(row[definition.warehouseField??'warehouse_id']??'');
 if(!warehouseId){
  const warehouseIds=new Set<string>(),locationIds=new Set<string>(),reservationIds=new Set<string>(),batchIds=new Set<string>();
  const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f-]{36}$/i.test(v);
  const collect=(v:unknown)=>{if(!v||typeof v!=='object')return;for(const [key,value] of Object.entries(v)){
   if(uuid(value)&&['warehouse_id','warehouseId','custodian_warehouse_id','custodianWarehouseId'].includes(key))warehouseIds.add(String(value));
   else if(uuid(value)&&['location_id','locationId','source_location_id','sourceLocationId','destinationLocationId'].includes(key))locationIds.add(String(value));
   else if(uuid(value)&&key==='reservation_id')reservationIds.add(String(value));else if(uuid(value)&&key==='batch_id')batchIds.add(String(value));
   else if(typeof value==='object')collect(value);
  }};collect(row);collect(version);collect(children);
  let inventoryDocumentId=row.inventory_document_id;
  if(definition.table==='supplier_claims'&&row.receipt_line_id)inventoryDocumentId=(await sql.query<{inventory_document_id:string}>('SELECT g.inventory_document_id FROM cohamy_crm.goods_receipt_lines l JOIN cohamy_crm.goods_receipts g ON g.id=l.receipt_id WHERE l.id=$1',[row.receipt_line_id])).rows[0]?.inventory_document_id;
  if(inventoryDocumentId)for(const r of(await sql.query<{warehouse_id:string}>('SELECT DISTINCT warehouse_id FROM cohamy_crm.inventory_movements WHERE document_id=$1',[inventoryDocumentId])).rows)warehouseIds.add(r.warehouse_id);
  if(['commercial_requests','sales_orders'].includes(definition.table))for(const r of(await sql.query<{warehouse_id:string}>(`SELECT DISTINCT warehouse_id FROM cohamy_crm.accounting_order_clearances WHERE ${definition.table==='commercial_requests'?'request_id':'order_id'}=$1`,[id])).rows)warehouseIds.add(r.warehouse_id);
  if(batchIds.size)for(const r of(await sql.query<{warehouse_id:string}>('SELECT DISTINCT custodian_warehouse_id AS warehouse_id FROM cohamy_crm.consignment_batches WHERE id=ANY($1::uuid[])',[[...batchIds]])).rows)warehouseIds.add(r.warehouse_id);
  if(reservationIds.size)for(const r of(await sql.query<{warehouse_id:string}>('SELECT DISTINCT warehouse_id FROM cohamy_crm.inventory_reservations WHERE id=ANY($1::uuid[])',[[...reservationIds]])).rows)warehouseIds.add(r.warehouse_id);
  if(locationIds.size)for(const r of(await sql.query<{warehouse_id:string}>('SELECT DISTINCT warehouse_id FROM cohamy_crm.warehouse_locations WHERE id=ANY($1::uuid[])',[[...locationIds]])).rows)warehouseIds.add(r.warehouse_id);
  // A warehouse-specific rule never receives a combined multi-warehouse document.
  if(warehouseIds.size===1)warehouseId=[...warehouseIds][0];
 }
 const warehouse=warehouseId?(await sql.query<{name:string;code:string}>('SELECT name,code FROM cohamy_crm.warehouses WHERE id=$1',[warehouseId])).rows[0]:null;
 const revision=Number((result as Record<string,unknown>)?.version??row.version??version?.number??1),code=String(row.code??id),state=String((result as Record<string,unknown>)?.status??row.status??action);
 const eventKey=`${event}:${id}:${eventIdentity??revision}`;
 const existing=(await sql.query('SELECT id FROM cohamy_crm.document_business_snapshots WHERE event_key=$1',[eventKey])).rows[0];if(existing)return;
 const snapshot={event,label:definition.label,record:row,version,children,result},pdf=await renderBusinessPdf(definition.label,code,state,snapshot),revisionId=randomUUID(),checksum=createHash('sha256').update(pdf).digest('hex'),filename=`${code.replace(/[^a-zA-Z0-9_-]/g,'-')}-${action.replace(/[^a-zA-Z0-9_-]/g,'-')}-v${revision}.pdf`;
 const envelope:FlowSnapshot={id,code,kind:'REQUEST',revision,state,warehouseId,warehouseName:warehouse?.name??'',warehouseCode:warehouse?.code??'',factoryMembershipId:null,factoryName:'',sourceId:null,sourceCode:String(row.order_id??row.request_id??''),sourceRevision:null,requestId:null,requestCode:'',createdAt:String(row.created_at??new Date().toISOString()),createdBy:'',confirmedAt:new Date().toISOString(),confirmedBy:'',dueDate:'',note:'',lines:[],delivery:{},totals:{}};
 const files:MailFile[]=[{type:'BUSINESS',id:revisionId,filename,checksum}];
 const privateIds=new Set<string>();const findFiles=(v:unknown)=>{if(!v||typeof v!=='object')return;for(const [key,value] of Object.entries(v)){if(['document_version_id','documentVersionId','photo_document_id','signature_document_id'].includes(key)&&typeof value==='string')privateIds.add(value);else if(typeof value==='object')findFiles(value);}};findFiles(snapshot);
 for(const fileId of privateIds){const f=(await sql.query<{id:string;filename:string;checksum:string}>('SELECT id,filename,checksum FROM cohamy_crm.document_versions WHERE id=$1',[fileId])).rows[0];if(f)files.push({type:'PRIVATE',...f});}
 const excludeRecipients=definition.table==='supplier_rfq_dispatches'&&row.channel==='EMAIL'&&row.status==='SENT'?[String(row.recipient)]:[];
 const persisted={...snapshot,envelope,files,excludeRecipients};
 await sql.query('INSERT INTO cohamy_crm.document_business_snapshots(id,event_key,event,entity_id,revision,snapshot,filename,pdf,checksum) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)',[revisionId,eventKey,event,id,revision,JSON.stringify(persisted),filename,pdf,checksum]);
 await enqueueDocumentMail(sql,{event,snapshot:envelope,label:definition.label,eventIdentity,files,excludeRecipients});
}
