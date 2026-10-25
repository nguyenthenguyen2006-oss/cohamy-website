import 'server-only';
import {database,type Sql} from './db';
import {assertCurrentPrincipal,membershipPrincipal} from './auth';
import {CrmError} from './permissions';
import {commercialDigest} from './commercial-common';
import {flowAccess,legacyFlowSnapshot} from './document-flow';
import {flowLabels} from './document-flow-model';
import {salesOrderAccess,salesVersionAccess} from './sales-orders';
import {lineAmount,fixed,fixedText} from './decimal';
import type {Principal} from './types';
import {invoiceKindLabels,invoiceKinds,type AdminInvoice,type InvoiceContent,type InvoiceEditLine,type InvoiceKind} from './invoice-admin-model';
import {invoiceStockCells,type InvoiceStockCell} from './invoice-admin-stock';
type Row=Record<string,unknown>;
const str=(value:unknown)=>value===null||value===undefined?'':value instanceof Date?value.toISOString():String(value);
const obj=(value:unknown)=>value&&typeof value==='object'?value as Row:{};
const lines=(value:unknown)=>(Array.isArray(value)?value:[]).map(obj);
export function assertInvoiceAdmin(user:Principal){if(user.area!=='crm'||user.role!=='ADMIN')throw new CrmError('FORBIDDEN',403);}
export function invoiceLineAmount(line:InvoiceEditLine){const gross=BigInt(lineAmount(line.unitPrice,line.quantity,'HALF_UP')),discount=BigInt(line.discount);if(discount>gross)throw new CrmError('INVOICE_DISCOUNT_EXCEEDS_LINE',400);return (gross-discount+BigInt(line.tax)).toString();}
export const invoiceTotal=(content:InvoiceContent)=>(content.lines.reduce((n,l)=>n+BigInt(invoiceLineAmount(l)),0n)+BigInt(content.fee)).toString();
const normalized=(value:object):InvoiceEditLine=>{const l=value as Row,quantity=str(l.baseQuantity??l.quantity??l.receivedQuantity??'0'),unitPrice=str(l.unitPrice??l.listUnitPrice??l.netUnitPrice??'0')||'0',gross=BigInt(lineAmount(unitPrice,quantity,'HALF_UP')),amount=l.amount===undefined?gross:BigInt(str(l.amount)||'0');return {productId:str(l.productId)||null,name:str(l.name??l.productName)||'Mặt hàng',unit:str(l.stockUnit??l.unit??l.unitLabel)||'Gói',quantity,unitPrice,discount:str(l.discount??(amount<gross?gross-amount:0n)),tax:str(l.tax??(amount>gross?amount-gross:0n)),note:str(l.note)};};
const empty=():InvoiceContent=>({warehouseId:null,buyerName:'',buyerAddress:'',buyerTaxId:'',recipient:'',recipientPhone:'',issuedDate:'',invoiceNumber:'',invoiceSymbol:'',note:'',fee:'0',lines:[]});

export async function loadAdminInvoice(sql:Sql,user:Principal,kind:InvoiceKind,id:string,lock=false):Promise<AdminInvoice>{
 assertInvoiceAdmin(user);let original:Row,content=empty(),code='',status='',label=invoiceKindLabels[kind],linkedOrderId:string|null=null,sourceId:string|null=null;
 if(kind==='FLOW'){
  const row=await flowAccess(sql,user,id,undefined,lock),snapshot=row.flow_payload??await legacyFlowSnapshot(sql,row);original={...row,snapshot};code=row.code;status=row.workflow_state;label=flowLabels[snapshot.kind];linkedOrderId=snapshot.salesOrderId??null;sourceId=snapshot.sourceId;
  content={...content,warehouseId:snapshot.warehouseId,buyerName:snapshot.delivery.customer??snapshot.factoryName,buyerAddress:snapshot.delivery.address??'',recipient:snapshot.delivery.recipient??'',recipientPhone:snapshot.delivery.recipientPhone??'',issuedDate:snapshot.delivery.deliveryDate??snapshot.dueDate,note:snapshot.note,invoiceNumber:snapshot.code,lines:snapshot.lines.map(l=>normalized(l))};
 }else if(kind==='SALES'){
  const row=await salesOrderAccess(sql,user,id,lock),version=await salesVersionAccess(sql,row,row.confirmed_version_id??row.latest_version_id),q=version.snapshot.quote;
  const clearance=(await sql.query<{warehouse_id:string|null}>('SELECT warehouse_id FROM cohamy_crm.accounting_order_clearances WHERE order_id=$1 OR request_id=$2 ORDER BY id LIMIT 1',[id,row.request_id])).rows[0];
  original={...row,salesVersion:version};code=row.code;status=row.status;sourceId=row.request_id;linkedOrderId=id;
  content={...content,warehouseId:clearance?.warehouse_id??null,buyerName:q.organization.name,buyerAddress:q.organization.address,buyerTaxId:q.organization.businessId??'',recipient:q.delivery.recipient,recipientPhone:q.delivery.phone,issuedDate:q.issuedAt.slice(0,10),invoiceNumber:row.code,note:q.note,fee:q.calculation.fee,lines:q.calculation.lines.map(l=>normalized(l))};
 }else if(kind==='HISTORICAL'){
  const row=(await sql.query<Row>('SELECT h.id,h.owner_organization_id,h.warehouse_id,h.invoice_date::text,h.snapshot,h.snapshot_checksum,h.source_filename,h.source_checksum FROM cohamy_crm.historical_order_invoices h WHERE h.id=$1 AND h.owner_organization_id=$2',[id,user.organizationId])).rows[0];if(!row)throw new CrmError('NOT_FOUND',404);
  const snapshot=obj(row.snapshot),event=(await sql.query<{order_id:string}>("SELECT payload->>'orderId' AS order_id FROM cohamy_crm.audit_events WHERE action='historical-invoice.reconciled' AND entity_id=$1 ORDER BY created_at DESC LIMIT 1",[id])).rows[0];
  linkedOrderId=event?.order_id??null;if(commercialDigest(snapshot)!==row.snapshot_checksum)throw new CrmError('HISTORICAL_INVOICE_INTEGRITY_FAILED',503);original=row;code=str(snapshot.series)+' · '+str(snapshot.number);status='ARCHIVED';
  content={...content,warehouseId:str(row.warehouse_id),buyerName:str(snapshot.buyerName),buyerAddress:str(snapshot.buyerAddress),buyerTaxId:str(snapshot.buyerTaxId),recipient:str(snapshot.buyerContact),issuedDate:str(snapshot.date),invoiceNumber:str(snapshot.number),invoiceSymbol:str(snapshot.series),note:str(snapshot.note),lines:lines(snapshot.lines).map(l=>normalized(l))};
  // Historical source VAT is an aggregate. Retain it exactly as a line amount.
  if(content.lines.length)content.lines[content.lines.length-1].tax=str(snapshot.vatAmount??'0');
 }else if(kind==='VAT'){
  const row=(await sql.query<Row>(`SELECT * FROM cohamy_crm.vat_invoices v WHERE v.id=$1 AND EXISTS(SELECT 1 FROM cohamy_crm.organizations o WHERE o.id=v.organization_id) AND (v.warehouse_id IS NULL OR EXISTS(SELECT 1 FROM cohamy_crm.warehouses w WHERE w.id=v.warehouse_id AND w.organization_id=$2)) ${lock?'FOR UPDATE OF v':''}`,[id,user.organizationId])).rows[0];if(!row)throw new CrmError('NOT_FOUND',404);
  original=row;code=str(row.code);status=str(row.status);linkedOrderId=str(row.order_id)||null;sourceId=str(row.handover_invoice_id)||null;
  content={...content,warehouseId:str(row.warehouse_id)||null,buyerName:str(row.buyer_name),buyerAddress:str(row.buyer_address),buyerTaxId:str(row.buyer_tax_code),recipientPhone:'',issuedDate:str(row.issued_date).slice(0,10),invoiceNumber:str(row.invoice_number),invoiceSymbol:str(row.invoice_symbol),note:str(row.note),lines:lines(row.lines).map(normalized)};
  if(content.lines.length){
   const discount=BigInt(str(row.discount_amount)||'0'),tax=BigInt(str(row.vat_amount)||'0'),gross=content.lines.map(l=>BigInt(lineAmount(l.unitPrice,l.quantity,'HALF_UP'))),sumGross=gross.reduce((n,v)=>n+v,0n);
   if(discount>sumGross)throw new CrmError('INVOICE_DISCOUNT_EXCEEDS_LINE',409);
   if(content.lines.reduce((n,l)=>n+BigInt(l.discount),0n)!==discount){let remaining=discount;content.lines.forEach((l,i)=>{const amount=i===content.lines.length-1?remaining:sumGross?gross[i]*discount/sumGross:0n;l.discount=amount.toString();remaining-=amount;});}
   const net=sumGross-discount;if(content.lines.reduce((n,l)=>n+BigInt(l.tax),0n)!==tax){let remaining=tax;content.lines.forEach((l,i)=>{const amount=i===content.lines.length-1?remaining:net?(gross[i]-BigInt(l.discount))*tax/net:0n;l.tax=amount.toString();remaining-=amount;});}
   const subtotal=content.lines.reduce((n,l)=>n+BigInt(invoiceLineAmount(l)),0n),total=BigInt(str(row.total_amount)||'0');content.fee=total>subtotal?(total-subtotal).toString():'0';
  }
 }else{
  const row=(await sql.query<Row>(`SELECT t.* FROM cohamy_crm.inventory_transfers t JOIN cohamy_crm.warehouses w ON w.id=t.source_warehouse_id WHERE t.id=$1 AND w.organization_id=$2 ${lock?'FOR UPDATE OF t':''}`,[id,user.organizationId])).rows[0];if(!row)throw new CrmError('NOT_FOUND',404);const snapshot=obj(row.snapshot);original=row;code=str(row.code);status=str(row.status);sourceId=str(row.destination_warehouse_id);
  content={...content,warehouseId:str(row.source_warehouse_id),note:str(row.reason),invoiceNumber:code,issuedDate:str(row.created_at).slice(0,10),lines:lines(snapshot.lines).map(l=>{const unit=obj(l.unit);return normalized({...l,name:unit.name??l.name,unit:unit.stockUnit??l.unit,unitPrice:'0'});})};
 }
 const head=(await sql.query<{version:number;content:InvoiceContent|null;cancelled_at:string|null;current_content?:InvoiceContent|null}>('SELECT version,content,cancelled_at FROM cohamy_crm.invoice_admin_heads WHERE kind=$1 AND entity_id=$2 AND organization_id=$3',[kind,id,user.organizationId])).rows[0];
 if(head?.content&&kind==='HISTORICAL'){content=head.content;code=content.invoiceSymbol+' · '+content.invoiceNumber;}
 const cancelled=Boolean(head?.cancelled_at)||['CANCELLED','VOID'].includes(status);
 return {kind,id,code,label,status:cancelled?'CANCELLED':status,version:commercialDigest({native:original,head:head?.version??0}),content,total:invoiceTotal(content),cancelled,linkedOrderId,sourceId,original};
}

const sources=`
 SELECT 'FLOW'::text AS kind,f.id,f.code,f.workflow_state AS status,f.created_at,w.organization_id,COALESCE(f.flow_payload->>'kind',f.stage) AS subtype FROM cohamy_crm.factory_invoices f JOIN cohamy_crm.warehouses w ON w.id=f.warehouse_id
 UNION ALL SELECT 'FLOW',f.id,f.code,f.workflow_state,f.created_at,w.organization_id,'ISSUE' FROM cohamy_crm.warehouse_handover_invoices f JOIN cohamy_crm.warehouses w ON w.id=f.warehouse_id
 UNION ALL SELECT 'SALES',s.id,s.code,s.status,s.created_at,COALESCE(s.seller_organization_id,(SELECT id FROM cohamy_crm.organizations WHERE kind='COHAMY' LIMIT 1)),'SALES' FROM cohamy_crm.sales_orders s
 UNION ALL SELECT 'HISTORICAL',h.id,h.series||' · '||h.invoice_number,'ARCHIVED',h.imported_at,h.owner_organization_id,'HISTORICAL' FROM cohamy_crm.historical_order_invoices h
 UNION ALL SELECT 'VAT',v.id,v.code,v.status,v.created_at,COALESCE(w.organization_id,(SELECT id FROM cohamy_crm.organizations WHERE kind='COHAMY' LIMIT 1)),'VAT' FROM cohamy_crm.vat_invoices v LEFT JOIN cohamy_crm.warehouses w ON w.id=v.warehouse_id
 UNION ALL SELECT 'TRANSFER',t.id,t.code,t.status,t.created_at,w.organization_id,'TRANSFER' FROM cohamy_crm.inventory_transfers t JOIN cohamy_crm.warehouses w ON w.id=t.source_warehouse_id`;
export async function adminInvoices(user:Principal,query:{kind?:string;q?:string;offset?:number;includeCancelled?:boolean}={}){
 assertInvoiceAdmin(user);const kind=query.kind&&invoiceKinds.includes(query.kind as InvoiceKind)?query.kind:'',offset=Math.max(0,query.offset??0),q=(query.q??'').trim().slice(0,120);
 return(await database()).transaction(async sql=>{await sql.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');const current=await membershipPrincipal(user.membershipId,sql);if(!current||current.id!==user.id||current.membershipVersion!==user.membershipVersion)throw new CrmError('FORBIDDEN',403);assertInvoiceAdmin(current);const where="x.organization_id=$1 AND ($2='' OR x.kind=$2) AND ($3='' OR x.code ILIKE '%'||$3||'%' OR h.content->>'invoiceNumber' ILIKE '%'||$3||'%') AND ($4 OR (h.cancelled_at IS NULL AND x.status NOT IN('CANCELLED','VOID')))";
  const params=[user.organizationId,kind,q,Boolean(query.includeCancelled)],join='FROM ('+sources+') x LEFT JOIN cohamy_crm.invoice_admin_heads h ON h.kind=x.kind AND h.entity_id=x.id';
  const total=Number((await sql.query<{n:string}>('SELECT count(*)::text AS n '+join+' WHERE '+where,params)).rows[0].n);
  const rows=(await sql.query<{kind:InvoiceKind;id:string;code:string;status:string;subtype:string;created_at:string;cancelled_at:string|null;current_content?:InvoiceContent|null}>('SELECT x.kind,x.id,x.code,x.status,x.subtype,x.created_at::text,h.cancelled_at,h.content AS current_content '+join+' WHERE '+where+' ORDER BY x.created_at DESC,x.kind,x.id LIMIT 50 OFFSET $5',[...params,offset])).rows;
  const products=(await sql.query<{id:string;name:string;sku:string;stock_unit:string}>("SELECT id,name,sku,stock_unit FROM cohamy_crm.products WHERE active AND stock_unit<>'' ORDER BY name")).rows;
  const warehouses=(await sql.query<{id:string;name:string}>('SELECT id,name FROM cohamy_crm.warehouses WHERE organization_id=$1 AND active ORDER BY name',[user.organizationId])).rows;
  return {items:rows.map(({current_content,...row})=>({...row,code:row.kind==='HISTORICAL'&&current_content?current_content.invoiceSymbol+' · '+current_content.invoiceNumber:row.code})),total,offset,pageSize:50,nextOffset:offset+rows.length<total?offset+rows.length:null,products,warehouses};
 });
}
export async function previewInvoiceCancellation(sql:Sql,user:Principal,invoice:AdminInvoice){
 const cells:InvoiceStockCell[]=[],related:{code:string;label:string}[]=[],seen=new Set<string>(),orders=new Set<string>(),notes:string[]=[];
 async function visit(row:AdminInvoice){
  const key=row.kind+':'+row.id;if(seen.has(key)||row.cancelled)return;seen.add(key);related.push({code:row.code,label:row.label});
  if(row.kind==='HISTORICAL'&&row.linkedOrderId){await visit(await loadAdminInvoice(sql,user,'SALES',row.linkedOrderId));return;}
  if(row.kind==='VAT'){const id=row.linkedOrderId??row.sourceId;if(id)await visit(await loadAdminInvoice(sql,user,row.linkedOrderId?'SALES':'FLOW',id));return;}
  cells.push(...await invoiceStockCells(sql,row.kind,row.id));
  if(row.kind==='SALES'){orders.add(row.id);const issues=(await sql.query<{code:string}>("SELECT code FROM cohamy_crm.warehouse_handover_invoices WHERE flow_payload->>'salesOrderId'=$1 AND workflow_state='CONFIRMED'",[row.id])).rows;related.push(...issues.map(r=>({code:r.code,label:'Phiếu giao hàng liên quan'})));}
  if(row.kind==='FLOW'){
   if(row.linkedOrderId){orders.add(row.linkedOrderId);const sale=await loadAdminInvoice(sql,user,'SALES',row.linkedOrderId);related.push({code:sale.code,label:'Điều chỉnh đơn bán theo phần thu hồi'});}
   const children=(await sql.query<{id:string}>("SELECT id FROM cohamy_crm.factory_invoices WHERE parent_id=$1 AND workflow_state<>'CANCELLED' ORDER BY id",[row.id])).rows;for(const child of children)await visit(await loadAdminInvoice(sql,user,'FLOW',child.id));
  }
  if(row.kind==='TRANSFER'){const unclassified=(row.original.snapshot as {unclassifiedLines?:{quantity:number}[]}).unclassifiedLines??[],quantity=unclassified.reduce((n,l)=>n+Number(l.quantity),0);if(quantity)notes.push(quantity+' gói chưa xác định sản phẩm chưa được ghi kho; thu hồi giữ nguyên phần lịch sử này và không tạo số tồn giả.');}
 }
 await visit(invoice);const totals=new Map<string,{warehouseId:string;productId:string;quantity:bigint}>();for(const cell of cells){const key=cell.warehouse_id+':'+cell.product_id,old=totals.get(key);totals.set(key,{warehouseId:cell.warehouse_id,productId:cell.product_id,quantity:(old?.quantity??0n)-fixed(cell.quantity,6,true)});}
 const stock=[] as {warehouseId:string;productId:string;warehouseName:string;name:string;unit:string;quantity:string}[];
 for(const r of totals.values()){if(r.quantity===0n)continue;const detail=(await sql.query<{warehouseName:string;name:string;unit:string}>('SELECT w.name AS "warehouseName",p.name,p.stock_unit AS unit FROM cohamy_crm.warehouses w CROSS JOIN cohamy_crm.products p WHERE w.id=$1 AND p.id=$2',[r.warehouseId,r.productId])).rows[0];stock.push({...r,...detail,quantity:fixedText(r.quantity)});}
 const receivables=orders.size?(await sql.query<{code:string;remainingAmount:string}>("SELECT code,remaining_amount::text AS \"remainingAmount\" FROM cohamy_crm.receivables WHERE order_id=ANY($1::uuid[]) AND status<>'VOID' ORDER BY code",[[...orders]])).rows:[];
 return {stock,related,receivables,notes};
}
export async function adminInvoiceDetail(user:Principal,kind:InvoiceKind,id:string){assertInvoiceAdmin(user);return(await database()).transaction(async sql=>{await assertCurrentPrincipal(sql,user);const row=await loadAdminInvoice(sql,user,kind,id),history=(await sql.query('SELECT version,action,before_snapshot,after_snapshot,impact,reason,created_at::text FROM cohamy_crm.invoice_admin_revisions WHERE kind=$1 AND entity_id=$2 ORDER BY version DESC',[kind,id])).rows,impact=await previewInvoiceCancellation(sql,user,row);const {original:_,...invoice}=row;void _;return {invoice,history,impact};});}
