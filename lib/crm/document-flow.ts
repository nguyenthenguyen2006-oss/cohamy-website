import 'server-only';
import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {database,type Sql} from './db';
import {assertCurrentPrincipal,audit} from './auth';
import {CrmError,isWarehouseRole} from './permissions';
import {fixed,fixedText,lineAmount,roundRatio} from './decimal';
import {commercialDigest,parseCommercial as parse,vietnamBusinessDate} from './commercial-common';
import {renderFlowPdf} from './document-flow-pdf';
import {enqueueDocumentMail} from './document-mail';
import {flowEntity,type FlowKind,type FlowLine,type FlowSnapshot,type FlowRow} from './document-flow-model';
import type {Principal} from './types';
import {warehouseScope} from './warehouse-scope';

const uuid=z.uuid();
const quantity=z.string().regex(/^\d{1,14}(?:\.\d{1,2})?$/);
const inputSchema=z.object({
  id:uuid.optional(),kind:z.enum(['REQUEST','DISPATCH','RECEIPT','ISSUE']),version:z.number().int().positive().optional(),
  warehouseId:uuid.optional(),factoryMembershipId:uuid.optional(),parentId:uuid.optional(),clearanceId:uuid.optional(),
  dueDate:z.union([z.literal(''),z.iso.date()]).default(''),note:z.string().trim().max(2000).default(''),
  lines:z.array(z.object({productId:uuid,quantity, note:z.string().trim().max(500).default('')})).min(1).max(300),
  delivery:z.record(z.string().max(60),z.string().trim().max(1000)).default({}),
  confirm:z.boolean().default(false),idempotencyKey:uuid,
}).strict();

export function assertFlowRole(user:Principal,kind:FlowKind){
  const allowed=user.role==='ADMIN'||(kind==='DISPATCH'&&user.role==='FACTORY')||((kind==='RECEIPT'||kind==='ISSUE')&&isWarehouseRole(user.role));
  if(user.area!=='crm'||!allowed)throw new CrmError('FORBIDDEN',403);
}
export function flowWarehouseScope(user:Principal,alias='w',offset=0){if(user.area!=='crm')return {sql:'false',params:[] as unknown[]};if(['ADMIN','MANAGER','ACCOUNTANT'].includes(user.role))return {sql:`${alias}.organization_id=$${offset+1}`,params:[user.organizationId] as unknown[]};return warehouseScope(user,alias,offset);}
async function warehouse(sql:Sql,user:Principal,id:string,factory=false){
  const scope=factory?{sql:'w.organization_id=$1',params:[user.organizationId]}:flowWarehouseScope(user);
  const row=(await sql.query<{id:string;code:string;name:string;organization_id:string}>(`SELECT w.* FROM cohamy_crm.warehouses w WHERE w.id=$${scope.params.length+1} AND w.active AND (${scope.sql})`,[...scope.params,id])).rows[0];
  if(!row)throw new CrmError('NOT_FOUND',404);return row;
}
function table(kind:FlowKind){return kind==='ISSUE'?'warehouse_handover_invoices':'factory_invoices';}
export async function flowAccess(sql:Sql,user:Principal,id:string,kind?:FlowKind,lock=false):Promise<FlowRow>{
  parse(uuid,id);if(user.area!=='crm')throw new CrmError('NOT_FOUND',404);
  const tables=kind?[table(kind)]:['factory_invoices','warehouse_handover_invoices'];
  for(const t of tables){
    const scope=flowWarehouseScope(user,'w',1);
    const isFactory=user.role==='FACTORY';
    const condition=isFactory?(t==='factory_invoices'?`f.factory_membership_id=$2 AND (f.workflow_state<>'DRAFT' OR f.created_by=(SELECT user_id FROM cohamy_crm.memberships WHERE id=$2))`:'false'):scope.sql;
    const params=isFactory?(t==='factory_invoices'?[id,user.membershipId]:[id]):[id,...scope.params];
    const row=(await sql.query<FlowRow>(`SELECT f.* FROM cohamy_crm.${t} f JOIN cohamy_crm.warehouses w ON w.id=f.warehouse_id WHERE f.id=$1 AND (${condition}) ${lock?'FOR UPDATE OF f':''}`,params)).rows[0];
    if(row){if(kind&&row.flow_payload&&row.flow_payload.kind!==kind)throw new CrmError('NOT_FOUND',404);return row;}
  }
  throw new CrmError('NOT_FOUND',404);
}
export async function flowEntityAccess(sql:Sql,user:Principal,type:string,id:string){
  if(type==='factory-invoice'||type==='warehouse-reconciliation')return flowAccess(sql,user,id);
  if(type==='warehouse-handover')return flowAccess(sql,user,id,'ISSUE');
  if(type==='order-clearance'){
    const scope=flowWarehouseScope(user,'w',1);
    const row=(await sql.query<{id:string;warehouse_id:string}>(`SELECT c.id,c.warehouse_id FROM cohamy_crm.accounting_order_clearances c JOIN cohamy_crm.warehouses w ON w.id=c.warehouse_id WHERE c.id=$1 AND (${scope.sql})`,[parse(uuid,id),...scope.params])).rows[0];
    if(!row)throw new CrmError('NOT_FOUND',404);return row;
  }
  if(type==='vat-invoice'){
    const row=(await sql.query<{clearance_id:string}>('SELECT clearance_id FROM cohamy_crm.vat_invoices WHERE id=$1',[parse(uuid,id)])).rows[0];
    if(!row)throw new CrmError('NOT_FOUND',404);return flowEntityAccess(sql,user,'order-clearance',row.clearance_id);
  }
  throw new CrmError('NOT_FOUND',404);
}

async function prior(sql:Sql,user:Principal,key:string,hash:string){
  // All actions of one actor serialize before reading their idempotency record.
  await sql.query('INSERT INTO cohamy_crm.document_flow_locks(actor_id) VALUES($1) ON CONFLICT DO NOTHING',[user.id]);
  await sql.query('SELECT actor_id FROM cohamy_crm.document_flow_locks WHERE actor_id=$1 FOR UPDATE',[user.id]);
  const r=(await sql.query<{request_hash:string;result:{id:string;code:string;version:number;state:string}}>('SELECT * FROM cohamy_crm.document_flow_actions WHERE actor_id=$1 AND key=$2',[user.id,key])).rows[0];
  if(r&&r.request_hash!==hash)throw new CrmError('IDEMPOTENCY_CONFLICT',409);return r?.result;
}
async function record(sql:Sql,user:Principal,key:string,hash:string,result:unknown){await sql.query('INSERT INTO cohamy_crm.document_flow_actions(actor_id,key,request_hash,result) VALUES($1,$2,$3,$4::jsonb)',[user.id,key,hash,JSON.stringify(result)]);}
async function sourceSnapshot(sql:Sql,user:Principal,id:string,kind:FlowKind){
  const source=await flowAccess(sql,user,id,kind,true);
  if(source.workflow_state!=='CONFIRMED'||!source.flow_payload)throw new CrmError('SOURCE_NOT_CONFIRMED',409);
  return source.flow_payload;
}
async function shippedQuantities(sql:Sql,requestId:string){
  const rows=(await sql.query<{flow_payload:FlowSnapshot}>("SELECT flow_payload FROM cohamy_crm.factory_invoices WHERE parent_id=$1 AND stage='FACTORY_DISPATCH' AND workflow_state='CONFIRMED' ORDER BY id",[requestId])).rows;
  const sums=new Map<string,bigint>();for(const r of rows)for(const l of r.flow_payload.lines)sums.set(l.productId,(sums.get(l.productId)??0n)+fixed(l.quantity));return sums;
}
function plainLine(p:{id:string;sku:string;name:string;stock_unit:string},q:string):FlowLine{return {productId:p.id,sku:p.sku,name:p.name,unit:p.stock_unit,quantity:q,ordered:q,shipped:'0',received:'0',difference:'0',unitPrice:'0',amount:'0',note:''};}

async function prepare(sql:Sql,user:Principal,d:z.infer<typeof inputSchema>,existing?:FlowRow):Promise<FlowSnapshot>{
  assertFlowRole(user,d.kind);
  if(new Set(d.lines.map(l=>l.productId)).size!==d.lines.length)throw new CrmError('DUPLICATE_PRODUCT',400);
  if(d.lines.some(l=>fixed(l.quantity)===0n)&&d.kind!=='RECEIPT')throw new CrmError('QUANTITY_REQUIRED',400);
  const id=existing?.id??randomUUID(),old=existing?.flow_payload;
  if(existing&&(existing.workflow_state!=='DRAFT'||old?.kind!==d.kind))throw new CrmError('DOCUMENT_LOCKED',409);
  if(existing&&d.version!==existing.workflow_version)throw new CrmError('VERSION_CONFLICT',409);
  let source:FlowSnapshot|undefined,warehouseId=d.warehouseId??old?.warehouseId, factoryMembershipId=d.factoryMembershipId??old?.factoryMembershipId??null,factoryName='';
  if(d.kind==='DISPATCH'||d.kind==='RECEIPT'){
    if(!d.parentId)throw new CrmError('SOURCE_REQUIRED',400);
    source=await sourceSnapshot(sql,user,d.parentId,d.kind==='DISPATCH'?'REQUEST':'DISPATCH');
    warehouseId=source.warehouseId;factoryMembershipId=source.factoryMembershipId;factoryName=source.factoryName;
    if(d.warehouseId&&d.warehouseId!==warehouseId)throw new CrmError('SOURCE_WAREHOUSE_MISMATCH',409);
    if(d.kind==='DISPATCH'&&user.role==='FACTORY'&&factoryMembershipId!==user.membershipId)throw new CrmError('NOT_FOUND',404);
    if(d.kind==='DISPATCH'&&user.role==='FACTORY'&&!(await sql.query("SELECT id FROM cohamy_crm.audit_events WHERE entity_id=$1 AND action='document-flow.accepted' AND payload->>'revision'=$2 LIMIT 1",[source.id,String(source.revision)])).rows.length)throw new CrmError('FACTORY_ACCEPTANCE_REQUIRED',409);
  }
  if(!warehouseId)throw new CrmError('WAREHOUSE_REQUIRED',400);
  const wh=await warehouse(sql,user,warehouseId,user.role==='FACTORY');
  const lines:FlowLine[]=[];
  const sourceRevision=source?.revision??null;let sourceId=source?.id??null,sourceCode=source?.code??'',salesOrderId=old?.salesOrderId??null,requestId=old?.requestId??null;
  let totals:Record<string,string>={},delivery:Record<string,string>={};
  if(d.kind==='REQUEST'){
    if(!factoryMembershipId)throw new CrmError('FACTORY_REQUIRED',400);
    const member=(await sql.query<{display_name:string}>("SELECT u.display_name FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id WHERE m.id=$1 AND m.organization_id=$2 AND m.active AND u.active AND m.role='FACTORY'",[factoryMembershipId,user.organizationId])).rows[0];
    if(!member)throw new CrmError('FACTORY_INVALID',400);factoryName=member.display_name;
    for(const l of d.lines){const p=(await sql.query<{id:string;sku:string;name:string;stock_unit:string}>('SELECT id,sku,name,stock_unit FROM cohamy_crm.products WHERE id=$1 AND active',[l.productId])).rows[0];if(!p)throw new CrmError('PRODUCT_INVALID',400);if(!p.stock_unit)throw new CrmError('PRODUCT_STOCK_UNIT_REQUIRED',409);lines.push({...plainLine(p,l.quantity),note:l.note});}
  }else if(source){
    const sums=d.kind==='DISPATCH'?await shippedQuantities(sql,source.id):new Map<string,bigint>();
    if(d.kind==='RECEIPT'&&(await sql.query("SELECT id FROM cohamy_crm.factory_invoices WHERE parent_id=$1 AND stage='WAREHOUSE_RECONCILIATION' AND workflow_state='CONFIRMED'",[source.id])).rows.length)throw new CrmError('ALREADY_RECEIVED',409);
    for(const l of d.lines){
      const original=source.lines.find(x=>x.productId===l.productId);if(!original)throw new CrmError('PRODUCT_OUTSIDE_REQUEST',409);
      if(d.kind==='DISPATCH'&&fixed(l.quantity)>fixed(original.quantity)-(sums.get(l.productId)??0n))throw new CrmError('REQUEST_QUANTITY_EXCEEDED',409);
      if(d.kind==='RECEIPT'&&fixed(l.quantity)!==fixed(original.quantity)&&!l.note&&!d.note)throw new CrmError('DISCREPANCY_NOTE_REQUIRED',400);
      lines.push({...original,quantity:l.quantity,shipped:d.kind==='DISPATCH'?l.quantity:original.quantity,received:d.kind==='RECEIPT'?l.quantity:'0',difference:d.kind==='RECEIPT'?fixedText(fixed(l.quantity)-fixed(original.quantity)):'0',note:l.note});
    }
    if(d.kind==='RECEIPT'&&lines.length!==source.lines.length)throw new CrmError('ALL_RECEIPT_LINES_REQUIRED',400);
  }else if(d.kind==='ISSUE'){
    if(!d.clearanceId){
      const allowed=['giver','giverPhone','recipient','recipientPhone','address','deliveryDate','deliveryTime','carrier','packages','condition','shortage','note','customer'];
      if(Object.keys(d.delivery).some(k=>!allowed.includes(k)))throw new CrmError('FINANCIAL_FIELD_FORBIDDEN',403);
      for(const l of d.lines){const p=(await sql.query<{id:string;sku:string;name:string;stock_unit:string}>('SELECT id,sku,name,stock_unit FROM cohamy_crm.products WHERE id=$1 AND active',[l.productId])).rows[0];if(!p)throw new CrmError('PRODUCT_INVALID',400);if(!p.stock_unit)throw new CrmError('PRODUCT_STOCK_UNIT_REQUIRED',409);lines.push({...plainLine(p,l.quantity),unitPrice:'',amount:'',shipped:l.quantity,note:l.note});}
      delivery={giver:user.displayName,...d.delivery};totals={goods:'',discount:'',shipping:'',total:'',paid:'',remaining:''};
    }else{
    const c=(await sql.query<{id:string;document_code:string;warehouse_id:string;order_id:string|null;request_id:string|null;immutable_lines:Array<Record<string,unknown>>;snapshot:Record<string,unknown>;organization_name:string;orderer_name:string;orderer_phone:string;paid_amount:string;discount_amount:string}>("SELECT c.*,o.name AS organization_name,COALESCE(sv.snapshot->'quote',v.snapshot) AS snapshot FROM cohamy_crm.accounting_order_clearances c JOIN cohamy_crm.organizations o ON o.id=c.organization_id LEFT JOIN cohamy_crm.commercial_requests r ON r.id=c.request_id LEFT JOIN cohamy_crm.commercial_request_versions v ON v.id=r.latest_version_id LEFT JOIN cohamy_crm.sales_orders so ON so.id=c.order_id LEFT JOIN cohamy_crm.sales_order_versions sv ON sv.id=COALESCE(so.confirmed_version_id,so.latest_version_id) WHERE c.id=$1 FOR UPDATE OF c",[d.clearanceId])).rows[0];
    if(!c||c.warehouse_id!==warehouseId)throw new CrmError('NOT_FOUND',404);
    sourceId=c.id;sourceCode=c.document_code;salesOrderId=c.order_id;requestId=c.request_id;
    if(salesOrderId){
      await sql.query('SELECT id FROM cohamy_crm.sales_orders WHERE id=$1 FOR UPDATE',[salesOrderId]);
      const otherIssue=(await sql.query("SELECT m.id FROM cohamy_crm.inventory_movements m JOIN cohamy_crm.inventory_documents i ON i.id=m.document_id WHERE m.source_order_id=$1 AND m.quantity<0 AND i.reference_type<>'warehouse-handover' AND NOT(i.reference_type='admin-invoice' AND i.reference_id LIKE 'FLOW:%') LIMIT 1",[salesOrderId])).rows[0];
      if(otherIssue)throw new CrmError('ORDER_ALREADY_ISSUED_BY_OTHER_FLOW',409);
    }
    if(!c.immutable_lines.length){const {extractSnapshotTotals}=await import('./accountant-workflow');c.immutable_lines=extractSnapshotTotals(c.snapshot).lines as unknown as Array<Record<string,unknown>>;}
    const priorIssues=(await sql.query<{flow_payload:FlowSnapshot|null;lines:Array<{productId:string;quantity:number}>}>("SELECT flow_payload,lines FROM cohamy_crm.warehouse_handover_invoices WHERE clearance_id=$1 AND id<>$2 AND workflow_state<>'DRAFT' ORDER BY id",[c.id,id])).rows;
    for(const l of d.lines){
      const original=c.immutable_lines.find(x=>x.productId===l.productId);if(!original)throw new CrmError('PRODUCT_OUTSIDE_ORDER',409);
      const ordered=String(original.baseQuantity??original.quantity??0),issued=priorIssues.reduce((sum,r)=>sum+(r.flow_payload?.lines??r.lines).filter(x=>x.productId===l.productId).reduce((n,x)=>n+fixed(String(x.quantity)),0n),0n);
      if(fixed(l.quantity)>fixed(ordered)-issued)throw new CrmError('ORDER_QUANTITY_EXCEEDED',409);
      const price=String(original.netUnitPrice??original.listUnitPrice??0);
      const productUnit=(await sql.query<{stock_unit:string}>('SELECT stock_unit FROM cohamy_crm.products WHERE id=$1',[l.productId])).rows[0]?.stock_unit??'';
      const amount=original.netLineTotal!==undefined?roundRatio(BigInt(String(original.netLineTotal))*fixed(l.quantity),fixed(ordered),'HALF_UP').toString():lineAmount(price,l.quantity,'HALF_UP');
      lines.push({productId:l.productId,sku:String(original.sku??''),name:String(original.name??''),unit:String(original.unitLabel||productUnit),quantity:l.quantity,ordered,shipped:l.quantity,received:'0',difference:'0',unitPrice:price,amount,note:l.note});
    }
    const shipping=(c.snapshot.delivery??{}) as Record<string,string>;
    // Only operational delivery fields are accepted from the warehouse.
    const allowed=['giver','giverPhone','recipient','recipientPhone','address','deliveryDate','deliveryTime','carrier','packages','condition','shortage','note'];
    if(Object.keys(d.delivery).some(k=>!allowed.includes(k)))throw new CrmError('FINANCIAL_FIELD_FORBIDDEN',403);
    delivery={giver:user.displayName,giverPhone:'',recipient:shipping.recipient??c.orderer_name??'',recipientPhone:shipping.phone??c.orderer_phone??'',address:shipping.address??'',...d.delivery,customer:c.organization_name};
    const sum=lines.reduce((n,l)=>n+BigInt(l.amount),0n),sourceTotals=(c.snapshot.totals??{}) as Record<string,string>;
    const goods=lines.reduce((n,l)=>{const src=c.immutable_lines.find(x=>x.productId===l.productId)!;return n+(src.listLineTotal!==undefined?roundRatio(BigInt(String(src.listLineTotal))*fixed(l.quantity),fixed(l.ordered),'HALF_UP'):BigInt(l.amount));},0n);
    const shippingFee=priorIssues.length?'0':sourceTotals.shippingFee??'0';
    totals={goods:goods.toString(),discount:(goods-sum).toString(),shipping:shippingFee,total:(sum+BigInt(shippingFee)).toString(),paid:String(c.paid_amount??'0')};
    if(c.snapshot?.buyerOrderId){
      // Buyer quotes store explicit VAT per product. Allocate each line's VAT
      // against its immutable order quantity, including partial deliveries.
      const vat=lines.reduce((n,l)=>{
        const src=c.immutable_lines.find(x=>x.productId===l.productId)!,sourceVat=BigInt(String(src.vatLineAmount??0));
        const before=priorIssues.reduce((sum,r)=>sum+(r.flow_payload?.lines??r.lines).filter(x=>x.productId===l.productId).reduce((q,x)=>q+fixed(String(x.quantity)),0n),0n);
        return n+roundRatio(sourceVat*(before+fixed(l.quantity)),fixed(l.ordered),'HALF_UP')-roundRatio(sourceVat*before,fixed(l.ordered),'HALF_UP');
      },0n);
      totals.vat=vat.toString();totals.total=(sum+vat+BigInt(shippingFee)).toString();
    }
    totals.remaining=(BigInt(totals.total)>BigInt(totals.paid)?BigInt(totals.total)-BigInt(totals.paid):0n).toString();
    }
  }
  return {id,code:old?.code??`${{REQUEST:'DN-NM',DISPATCH:'NM-XUAT',RECEIPT:'KHO-NHAP',ISSUE:'GH'}[d.kind]}-${vietnamBusinessDate(new Date())}-${id.slice(0,8).toUpperCase()}`,kind:d.kind,revision:existing?existing.workflow_version+1:1,state:'DRAFT',warehouseId,warehouseName:wh.name,warehouseCode:wh.code,factoryMembershipId,factoryName,sourceId,sourceCode,sourceRevision,salesOrderId,requestId:source?(d.kind==='DISPATCH'?source.id:source.requestId):requestId,requestCode:source?(d.kind==='DISPATCH'?source.code:source.requestCode):'',requestRevision:source?(d.kind==='DISPATCH'?source.revision:source.requestRevision??null):null,createdAt:old?.createdAt??new Date().toISOString(),createdBy:old?.createdBy??user.displayName,confirmedAt:null,confirmedBy:'',dueDate:d.dueDate,note:d.note,lines,delivery,totals};
}

function legacyLines(s:FlowSnapshot){return s.lines.map(l=>({productId:l.productId,sku:l.sku,name:l.name,unitLabel:l.unit,orderedQty:Number(l.ordered),dispatchedQty:Number(l.shipped),receivedQty:Number(l.received),discrepancyQty:Number(l.difference),factoryUnitPrice:0,lineTotal:0,receivedTotal:0,note:l.note,quantity:Number(l.quantity),unitPrice:Number(l.unitPrice),lineAmount:Number(l.amount)}));}
async function save(sql:Sql,user:Principal,s:FlowSnapshot,existing?:FlowRow){
  const payload=JSON.stringify(s),lines=JSON.stringify(legacyLines(s));
  if(existing){await sql.query(`UPDATE cohamy_crm.${table(s.kind)} SET flow_payload=$1::jsonb,workflow_version=$2,lines=$3::jsonb,note=$4,updated_at=now(),warehouse_id=$6 WHERE id=$5`,[payload,s.revision,lines,s.note,s.id,s.warehouseId]);
    if(s.kind==='ISSUE')await sql.query('UPDATE cohamy_crm.warehouse_handover_invoices SET clearance_id=$1,sales_order_id=$2,request_id=$3,order_code=$4 WHERE id=$5',[s.sourceId,s.salesOrderId??null,s.requestId,s.sourceCode,s.id]);
    else await sql.query('UPDATE cohamy_crm.factory_invoices SET parent_id=$1,factory_membership_id=$2,factory_name=$3 WHERE id=$4',[s.sourceId,s.factoryMembershipId,s.factoryName,s.id]);return;}
  if(s.kind==='ISSUE'){
    await sql.query("INSERT INTO cohamy_crm.warehouse_handover_invoices(id,code,warehouse_id,clearance_id,order_code,recipient_type,recipient_name,recipient_phone,organization_name,lines,note,created_by,created_by_name,created_by_role,workflow_state,workflow_version,flow_payload) VALUES($1,$2,$3,$4,$5,'CUSTOMER',$6,$7,$8,$9::jsonb,$10,$11,$12,$13,'DRAFT',$14,$15::jsonb)",[s.id,s.code,s.warehouseId,s.sourceId,s.sourceCode,s.delivery.recipient??'',s.delivery.recipientPhone??'',s.delivery.customer??'',lines,s.note,user.id,user.displayName,user.role,s.revision,payload]);
    await sql.query('UPDATE cohamy_crm.warehouse_handover_invoices SET sales_order_id=$1,request_id=$2 WHERE id=$3',[s.salesOrderId??null,s.requestId,s.id]);
  }else await sql.query("INSERT INTO cohamy_crm.factory_invoices(id,code,stage,parent_id,warehouse_id,factory_name,lines,note,created_by,created_by_name,created_by_role,workflow_state,workflow_version,factory_membership_id,flow_payload) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,'DRAFT',$12,$13,$14::jsonb)",[s.id,s.code,{REQUEST:'FACTORY_ORDER',DISPATCH:'FACTORY_DISPATCH',RECEIPT:'WAREHOUSE_RECONCILIATION'}[s.kind],s.sourceId,s.warehouseId,s.factoryName,lines,s.note,user.id,user.displayName,user.role,s.revision,s.factoryMembershipId,payload]);
}

async function moveStock(sql:Sql,user:Principal,s:FlowSnapshot,deltas?:Map<string,bigint>,reason='Xác nhận chứng từ'){
  const wh=await warehouse(sql,user,s.warehouseId);
  // Serialize balances, receipt creation and location/lot initialization for a warehouse.
  await sql.query('SELECT id FROM cohamy_crm.warehouses WHERE id=$1 FOR UPDATE',[wh.id]);
  const docId=randomUUID(),kind=deltas?'ADJUSTMENT':s.kind==='RECEIPT'?'RECEIPT':'ISSUE';
  await sql.query('INSERT INTO cohamy_crm.inventory_documents(id,code,kind,organization_id,reference_type,reference_id,actor_id,reason,idempotency_key,request_hash,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)',[docId,`KHO-${docId.slice(0,8)}`,kind,wh.organization_id,flowEntity(s.kind),s.id,user.id,reason,randomUUID(),commercialDigest(s),JSON.stringify({id:s.id,revision:s.revision})]);
  for(const l of [...s.lines].sort((a,b)=>a.productId.localeCompare(b.productId))){
    let delta=deltas?.get(l.productId)??(s.kind==='RECEIPT'?fixed(l.quantity):-fixed(l.quantity));if(delta===0n)continue;
    if(s.kind==='ISSUE'&&s.salesOrderId){delta=await adjustFlowReservations(sql,user,docId,s,l,delta,reason);if(delta===0n)continue;}
    if(delta>0n){
      let location=(await sql.query<{id:string}>("SELECT id FROM cohamy_crm.warehouse_locations WHERE warehouse_id=$1 AND active AND kind='PICK' ORDER BY id LIMIT 1",[wh.id])).rows[0];
      if(!location){location={id:randomUUID()};await sql.query("INSERT INTO cohamy_crm.warehouse_locations(id,warehouse_id,code,name,kind,active) VALUES($1,$2,'FLOW-PICK','Kệ nhận hàng','PICK',true)",[location.id,wh.id]);}
      let lot=(await sql.query<{id:string}>("SELECT id FROM cohamy_crm.inventory_lots WHERE product_id=$1 AND code=$2",[l.productId,`FLOW-${s.id}`])).rows[0];
      if(!lot){lot={id:randomUUID()};await sql.query("INSERT INTO cohamy_crm.inventory_lots(id,product_id,code,status) VALUES($1,$2,$3,'AVAILABLE')",[lot.id,l.productId,`FLOW-${s.id}`]);}
      await sql.query('INSERT INTO cohamy_crm.inventory_balances(warehouse_id,location_id,product_id,lot_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[wh.id,location.id,l.productId,lot.id]);
      const b=(await sql.query<{on_hand:string}>('SELECT on_hand::text FROM cohamy_crm.inventory_balances WHERE warehouse_id=$1 AND location_id=$2 AND product_id=$3 AND lot_id=$4 FOR UPDATE',[wh.id,location.id,l.productId,lot.id])).rows[0];
      await stockMovement(sql,user,docId,s,l,location.id,lot.id,delta,fixed(b.on_hand)+delta);
    }else{
      const balances=(await sql.query<{location_id:string;lot_id:string;on_hand:string;reserved:string}>("SELECT b.location_id,b.lot_id,b.on_hand::text,b.reserved::text FROM cohamy_crm.inventory_balances b JOIN cohamy_crm.inventory_lots t ON t.id=b.lot_id JOIN cohamy_crm.warehouse_locations loc ON loc.id=b.location_id WHERE b.warehouse_id=$1 AND b.product_id=$2 AND t.status='AVAILABLE' AND (t.expires_on IS NULL OR t.expires_on>=CURRENT_DATE) AND loc.active AND loc.kind='PICK' ORDER BY t.expires_on NULLS LAST,b.location_id,b.lot_id FOR UPDATE OF b",[wh.id,l.productId])).rows;
      const free=balances.reduce((n,b)=>n+fixed(b.on_hand)-fixed(b.reserved),0n);
      if(free < -delta)throw new CrmError('INVENTORY_INSUFFICIENT',409);
      for(const b of balances){if(delta===0n)break;const available=fixed(b.on_hand)-fixed(b.reserved),take=available < -delta?available:-delta;if(take<=0n)continue;await stockMovement(sql,user,docId,s,l,b.location_id,b.lot_id,-take,fixed(b.on_hand)-take);delta+=take;}
    }
  }return docId;
}
async function stockMovement(sql:Sql,user:Principal,documentId:string,s:FlowSnapshot,l:FlowLine,locationId:string,lotId:string,delta:bigint,next:bigint){
  await sql.query('UPDATE cohamy_crm.inventory_balances SET on_hand=$1,version=version+1,updated_at=now() WHERE warehouse_id=$2 AND location_id=$3 AND product_id=$4 AND lot_id=$5',[fixedText(next),s.warehouseId,locationId,l.productId,lotId]);
  await sql.query('INSERT INTO cohamy_crm.inventory_movements(id,document_id,warehouse_id,location_id,product_id,lot_id,quantity,balance_after,unit_snapshot,actor_id,source_order_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)',[randomUUID(),documentId,s.warehouseId,locationId,l.productId,lotId,fixedText(delta),fixedText(next),JSON.stringify(l),user.id,s.salesOrderId??null]);
}
async function adjustFlowReservations(sql:Sql,user:Principal,docId:string,s:FlowSnapshot,l:FlowLine,delta:bigint,reason:string){
  const rows=(await sql.query<{id:string;location_id:string;lot_id:string;quantity:string;consumed:string;released:string;on_hand:string;reserved:string;linked:string;eligible:boolean}>("SELECT r.id,r.location_id,r.lot_id,r.quantity::text,r.consumed::text,r.released::text,b.on_hand::text,b.reserved::text,COALESCE(link.consumed,0)::text AS linked,(t.status='AVAILABLE' AND (t.expires_on IS NULL OR t.expires_on>=CURRENT_DATE) AND loc.active AND loc.kind='PICK') AS eligible FROM cohamy_crm.inventory_reservations r JOIN cohamy_crm.inventory_balances b USING(warehouse_id,location_id,product_id,lot_id) JOIN cohamy_crm.inventory_lots t ON t.id=r.lot_id JOIN cohamy_crm.warehouse_locations loc ON loc.id=r.location_id LEFT JOIN cohamy_crm.document_flow_reservation_links link ON link.entity_id=$4 AND link.reservation_id=r.id WHERE r.order_id=$1 AND r.warehouse_id=$2 AND r.product_id=$3 ORDER BY r.id FOR UPDATE OF r,b",[s.salesOrderId,s.warehouseId,l.productId,s.id])).rows;
  for(const r of rows){
    if(delta===0n)break;const available=delta<0n?fixed(r.quantity)-fixed(r.consumed)-fixed(r.released):fixed(r.linked),take=available<(delta<0n?-delta:delta)?available:(delta<0n?-delta:delta);if(take<=0n)continue;
    if(delta<0n&&!r.eligible)throw new CrmError('RESERVATION_STOCK_INELIGIBLE',409);
    const current=(await sql.query<{on_hand:string;reserved:string}>('SELECT on_hand::text,reserved::text FROM cohamy_crm.inventory_balances WHERE warehouse_id=$1 AND location_id=$2 AND product_id=$3 AND lot_id=$4 FOR UPDATE',[s.warehouseId,r.location_id,l.productId,r.lot_id])).rows[0];
    const change=delta<0n?take:-take,consumed=fixed(r.consumed)+change,reserved=fixed(current.reserved)-change,onHand=fixed(current.on_hand)-change;
    if(reserved<0n||onHand<reserved)throw new CrmError('RESERVATION_BALANCE_CONFLICT',409);
    const state=consumed+fixed(r.released)===fixed(r.quantity)?'CONSUMED':consumed>0n?'PARTIAL':'ACTIVE';
    await sql.query('UPDATE cohamy_crm.inventory_reservations SET consumed=$1,status=$2,version=version+1,updated_at=now() WHERE id=$3',[fixedText(consumed),state,r.id]);
    await sql.query('UPDATE cohamy_crm.inventory_balances SET reserved=$1,on_hand=$6 WHERE warehouse_id=$2 AND location_id=$3 AND product_id=$4 AND lot_id=$5',[fixedText(reserved),s.warehouseId,r.location_id,l.productId,r.lot_id,fixedText(onHand)]);
    await stockMovement(sql,user,docId,s,l,r.location_id,r.lot_id,-change,onHand);
    await sql.query('INSERT INTO cohamy_crm.document_flow_reservation_links(entity_id,reservation_id,consumed) VALUES($1,$2,0) ON CONFLICT DO NOTHING',[s.id,r.id]);
    await sql.query('UPDATE cohamy_crm.document_flow_reservation_links SET consumed=consumed+$3 WHERE entity_id=$1 AND reservation_id=$2',[s.id,r.id,fixedText(change)]);
    await sql.query('INSERT INTO cohamy_crm.document_flow_reservation_adjustments(id,entity_id,revision,reservation_id,delta,actor_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),s.id,s.revision,r.id,fixedText(change),user.id,reason]);
    delta+=change;
  }return delta;
}
async function archive(sql:Sql,user:Principal,s:FlowSnapshot,reason:string){
  const pdf=await renderFlowPdf(s),id=randomUUID(),checksum=createHash('sha256').update(pdf).digest('hex');
  await sql.query('INSERT INTO cohamy_crm.document_flow_revisions(id,entity_type,entity_id,revision,snapshot,filename,pdf,checksum,actor_id,reason) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)',[id,flowEntity(s.kind),s.id,s.revision,JSON.stringify(s),`${s.code}-v${s.revision}.pdf`,pdf,checksum,user.id,reason]);
  return {revisionId:id,filename:`${s.code}-v${s.revision}.pdf`,checksum};
}
async function notifyFlowInApp(sql:Sql,user:Principal,s:FlowSnapshot,event:string){
  const users=(await sql.query<{user_id:string}>(`SELECT DISTINCT m.user_id FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id JOIN cohamy_crm.warehouses w ON w.id=$2 WHERE m.organization_id=$1 AND m.active AND u.active AND (
    m.role='ADMIN' OR (m.id=$3 AND m.role='FACTORY') OR ($4<>'REQUEST' AND (m.role='ACCOUNTANT' OR (m.role IN('WAREHOUSE','WAREHOUSE_HN','WAREHOUSE_HCM') AND (
      EXISTS(SELECT 1 FROM cohamy_crm.warehouse_assignments a WHERE a.membership_id=m.id AND a.warehouse_id=w.id) OR
      (NOT EXISTS(SELECT 1 FROM cohamy_crm.warehouse_assignments a WHERE a.membership_id=m.id) AND ((m.role='WAREHOUSE_HN' AND w.region='NORTH') OR (m.role='WAREHOUSE_HCM' AND w.region='SOUTH')))
    )))))`,[user.organizationId,s.warehouseId,s.factoryMembershipId,s.kind])).rows;
  for(const r of users)await sql.query("INSERT INTO cohamy_crm.notifications(id,user_id,event_key,kind,entity_type,entity_id,message,available_at) VALUES($1,$2,$3,'SYSTEM',$4,$5,$6,now()) ON CONFLICT(user_id,event_key) DO NOTHING",[randomUUID(),r.user_id,`${event}:${s.id}:${s.revision}`,flowEntity(s.kind),s.id,`${s.code} · ${s.warehouseName} · ${s.kind==='REQUEST'?'Đề nghị đã gửi nhà máy':s.kind==='DISPATCH'?'Nhà máy đã gửi hàng':s.kind==='RECEIPT'?'Kho đã xác nhận thực nhận':'Kho đã xác nhận xuất'}`]);
}
async function confirm(sql:Sql,user:Principal,row:FlowRow){
  const old=row.flow_payload;if(!old)throw new CrmError('LEGACY_DOCUMENT_READ_ONLY',409);assertFlowRole(user,old.kind);
  if(row.workflow_state!=='DRAFT')throw new CrmError('DOCUMENT_LOCKED',409);
  // Revalidate against the locked source, including other confirmed installments.
  const s=await prepare(sql,user,{id:row.id,kind:old.kind,version:row.workflow_version,warehouseId:old.warehouseId,factoryMembershipId:old.factoryMembershipId??undefined,parentId:old.kind==='ISSUE'?undefined:old.sourceId??undefined,clearanceId:old.kind==='ISSUE'?old.sourceId??undefined:undefined,dueDate:old.dueDate,note:old.note,lines:old.lines.map(l=>({productId:l.productId,quantity:l.quantity,note:l.note})),delivery:old.kind==='ISSUE'&&old.sourceId?Object.fromEntries(Object.entries(old.delivery).filter(([k])=>k!=='customer')):old.delivery,confirm:true,idempotencyKey:randomUUID()},row);
  s.revision=row.workflow_version;s.state='CONFIRMED';s.confirmedAt=new Date().toISOString();s.confirmedBy=user.displayName;
  if(s.kind==='ISSUE'){
    for(const k of ['giver','recipient','recipientPhone','address','deliveryDate','carrier'])if(!s.delivery[k])throw new CrmError(`DELIVERY_REQUIRED_${k}`,400);
    if(!s.sourceId&&!s.delivery.customer)throw new CrmError('DELIVERY_REQUIRED_customer',400);
  }
  let inventoryId:string|null=null;if(s.kind==='RECEIPT'||s.kind==='ISSUE')inventoryId=await moveStock(sql,user,s);
  const file=await archive(sql,user,s,'Xác nhận lần đầu');
  if(s.kind!=='ISSUE')await sql.query('UPDATE cohamy_crm.factory_invoices SET total_ordered_qty=$1,total_dispatched_qty=$2,total_received_qty=$3 WHERE id=$4',[fixedText(s.lines.reduce((n,l)=>n+fixed(l.ordered),0n)),fixedText(s.lines.reduce((n,l)=>n+fixed(l.shipped),0n)),fixedText(s.lines.reduce((n,l)=>n+fixed(l.received),0n)),s.id]);
  else await sql.query('UPDATE cohamy_crm.warehouse_handover_invoices SET total_quantity=$1,list_subtotal=$2,discount_amount=$3,total_amount=$4 WHERE id=$5',[fixedText(s.lines.reduce((n,l)=>n+fixed(l.quantity),0n)),s.totals.goods||'0',s.totals.discount||'0',s.totals.total||'0',s.id]);
  await sql.query(`UPDATE cohamy_crm.${table(s.kind)} SET workflow_state='CONFIRMED',flow_payload=$1::jsonb,confirmed_at=$2,confirmed_by=$3,inventory_document_id=$4,lines=$5::jsonb,updated_at=now() WHERE id=$6`,[JSON.stringify(s),s.confirmedAt,user.id,inventoryId,JSON.stringify(legacyLines(s)),s.id]);
  const event={REQUEST:'factory.request.sent',DISPATCH:'factory.dispatch.confirmed',RECEIPT:'factory.receipt.confirmed',ISSUE:'warehouse.issue.confirmed'}[s.kind];
  await enqueueDocumentMail(sql,{event,snapshot:s,files:[{type:'FLOW',id:file.revisionId,filename:file.filename,checksum:file.checksum}]});
  await notifyFlowInApp(sql,user,s,event);
  if(s.kind==='RECEIPT'&&s.lines.some(l=>fixed(l.difference,6,true)!==0n))await enqueueDocumentMail(sql,{event:'factory.receipt.discrepancy',snapshot:s,files:[{type:'FLOW',id:file.revisionId,filename:file.filename,checksum:file.checksum}]});
  await audit(sql,user.id,'document-flow.confirmed',s.id,{kind:s.kind,revision:s.revision,inventoryId});return s;
}
export async function saveFlowDocument(user:Principal,input:unknown){
  if(user.area!=='crm'||!['ADMIN','FACTORY','WAREHOUSE','WAREHOUSE_HN','WAREHOUSE_HCM'].includes(user.role))throw new CrmError('FORBIDDEN',403);
  const d=parse(inputSchema,input);assertFlowRole(user,d.kind);const hash=commercialDigest(d);
  return(await database()).transaction(async sql=>{
    await assertCurrentPrincipal(sql,user);const before=await prior(sql,user,d.idempotencyKey,hash);if(before)return before;
    const existing=d.id?await flowAccess(sql,user,d.id,d.kind,true):undefined;
    const s=await prepare(sql,user,d,existing);await save(sql,user,s,existing);
    const resultSnapshot=d.confirm?await confirm(sql,user,{id:s.id,code:s.code,workflow_state:'DRAFT',workflow_version:s.revision,flow_payload:s,parent_id:s.sourceId,warehouse_id:s.warehouseId,factory_membership_id:s.factoryMembershipId,created_by:user.id,confirmed_at:null}):s;
    const result={id:s.id,code:s.code,version:resultSnapshot.revision,state:resultSnapshot.state};await record(sql,user,d.idempotencyKey,hash,result);return result;
  });
}
export async function confirmFlowDocument(user:Principal,input:unknown){
  const d=parse(z.object({id:uuid,kind:z.enum(['REQUEST','DISPATCH','RECEIPT','ISSUE']),version:z.number().int().positive(),idempotencyKey:uuid}).strict(),input);assertFlowRole(user,d.kind);const hash=commercialDigest(d);
  return(await database()).transaction(async sql=>{await assertCurrentPrincipal(sql,user);const before=await prior(sql,user,d.idempotencyKey,hash);if(before)return before;const row=await flowAccess(sql,user,d.id,d.kind,true);if(row.workflow_version!==d.version)throw new CrmError('VERSION_CONFLICT',409);const s=await confirm(sql,user,row),result={id:s.id,code:s.code,version:s.revision,state:s.state};await record(sql,user,d.idempotencyKey,hash,result);return result;});
}
export async function acceptFactoryRequest(user:Principal,input:unknown){
  const d=parse(z.object({id:uuid,idempotencyKey:uuid}).strict(),input);if(user.role!=='FACTORY'||user.area!=='crm')throw new CrmError('FORBIDDEN',403);
  return(await database()).transaction(async sql=>{await assertCurrentPrincipal(sql,user);const hash=commercialDigest(d),before=await prior(sql,user,d.idempotencyKey,hash);if(before)return before;const s=await sourceSnapshot(sql,user,d.id,'REQUEST');
    const exists=(await sql.query("SELECT id FROM cohamy_crm.audit_events WHERE entity_id=$1 AND action='document-flow.accepted' AND payload->>'revision'=$2",[s.id,String(s.revision)])).rows.length;
    if(!exists){await audit(sql,user.id,'document-flow.accepted',s.id,{revision:s.revision});const file=(await sql.query<{id:string;filename:string;checksum:string}>('SELECT id,filename,checksum FROM cohamy_crm.document_flow_revisions WHERE entity_id=$1 AND revision=$2',[s.id,s.revision])).rows[0];await enqueueDocumentMail(sql,{event:'factory.request.accepted',snapshot:{...s,state:'ACCEPTED'},files:[{type:'FLOW',...file}]});}
    const result={id:s.id,code:s.code,version:s.revision,state:'ACCEPTED'};await record(sql,user,d.idempotencyKey,hash,result);return result;});
}
export async function flowWorkspace(user:Principal){
  if(user.area!=='crm'||!['ADMIN','MANAGER','FACTORY','ACCOUNTANT','WAREHOUSE','WAREHOUSE_HN','WAREHOUSE_HCM'].includes(user.role))throw new CrmError('FORBIDDEN',403);
  const db=await database();await assertCurrentPrincipal(db,user);
  const scope=flowWarehouseScope(user),isFactory=user.role==='FACTORY';
  const params=isFactory?[user.membershipId]:scope.params;
  const factoryWhere=isFactory?"f.factory_membership_id=$1 AND (f.workflow_state<>'DRAFT' OR f.created_by=(SELECT user_id FROM cohamy_crm.memberships WHERE id=$1))":scope.sql;
  const rows=async<T>(text:string,params:unknown[]=[]) => (await db.query<T>(text,params)).rows;
  // Independent scoped reads share the bounded connection pool; no cross-request cache.
  const [factory,issues,warehouses,products,factories,stocks,orders]=await Promise.all([
    rows<FlowRow>(`SELECT f.* FROM cohamy_crm.factory_invoices f JOIN cohamy_crm.warehouses w ON w.id=f.warehouse_id WHERE (${factoryWhere}) AND f.workflow_state<>'CANCELLED' ORDER BY f.created_at DESC LIMIT 500`,params),
    isFactory?[]:rows<FlowRow>(`SELECT f.* FROM cohamy_crm.warehouse_handover_invoices f JOIN cohamy_crm.warehouses w ON w.id=f.warehouse_id WHERE (${scope.sql}) AND f.workflow_state<>'CANCELLED' ORDER BY f.created_at DESC LIMIT 500`,scope.params),
    isFactory?[]:rows<{id:string;code:string;name:string}>(`SELECT w.id,w.code,w.name FROM cohamy_crm.warehouses w WHERE w.active AND (${scope.sql}) ORDER BY w.code`,scope.params),
    user.role==='ADMIN'||isWarehouseRole(user.role)?rows<{id:string;sku:string;name:string;stock_unit:string}>('SELECT id,sku,name,stock_unit FROM cohamy_crm.products WHERE active ORDER BY sku'):[],
    user.role==='ADMIN'?rows<{id:string;name:string}>("SELECT m.id,u.display_name AS name FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.role='FACTORY' AND m.active AND u.active ORDER BY u.display_name",[user.organizationId]):[],
    isFactory?[]:rows<{warehouse_id:string;product_id:string;sku:string;name:string;stock_unit:string;on_hand:string;reserved:string;opening:string;received:string;issued:string}>(`SELECT b.warehouse_id,b.product_id,p.sku,p.name,p.stock_unit,sum(b.on_hand)::text AS on_hand,sum(b.reserved)::text AS reserved,(sum(b.on_hand)-COALESCE(m.delta,0))::text AS opening,COALESCE(m.received,0)::text AS received,COALESCE(m.issued,0)::text AS issued FROM cohamy_crm.inventory_balances b JOIN cohamy_crm.warehouses w ON w.id=b.warehouse_id JOIN cohamy_crm.products p ON p.id=b.product_id LEFT JOIN (SELECT i.warehouse_id,i.product_id,sum(i.quantity) AS delta,sum(GREATEST(i.quantity,0)) AS received,sum(GREATEST(-i.quantity,0)) AS issued FROM cohamy_crm.inventory_movements i JOIN cohamy_crm.warehouses w ON w.id=i.warehouse_id WHERE (${scope.sql}) GROUP BY i.warehouse_id,i.product_id) m ON m.warehouse_id=b.warehouse_id AND m.product_id=b.product_id WHERE (${scope.sql}) GROUP BY b.warehouse_id,b.product_id,p.sku,p.name,p.stock_unit,m.delta,m.received,m.issued ORDER BY p.sku`,scope.params),
    // The client only needs delivery fields. Pricing policies/full quote versions stay server-side.
    isFactory||user.role==='ACCOUNTANT'?[]:rows<{id:string;document_code:string;warehouse_id:string;immutable_lines:Array<Record<string,unknown>>;snapshot:Record<string,unknown>;orderer_name:string;orderer_phone:string}>(`SELECT c.id,c.document_code,c.warehouse_id,c.immutable_lines,jsonb_build_object('delivery',v.snapshot->'delivery') AS snapshot,c.orderer_name,c.orderer_phone FROM cohamy_crm.accounting_order_clearances c JOIN cohamy_crm.warehouses w ON w.id=c.warehouse_id LEFT JOIN cohamy_crm.commercial_requests r ON r.id=c.request_id LEFT JOIN cohamy_crm.commercial_request_versions v ON v.id=r.latest_version_id WHERE (${scope.sql}) ORDER BY c.created_at DESC LIMIT 200`,scope.params),
  ]);
  const visible=[...factory,...issues],ids=visible.map(x=>x.id);
  const [vats,accepted,notifications,revisions]=await Promise.all([
    isFactory||!ids.length?[]:rows<{id:string;entity_id:string;version_id:string;revision:number;filename:string;mime:string;checksum:string;created_at:string}>('SELECT l.*,v.filename,v.mime,v.checksum FROM cohamy_crm.document_vat_links l JOIN cohamy_crm.document_versions v ON v.id=l.version_id WHERE l.entity_id=ANY($1::uuid[]) ORDER BY l.revision DESC',[ids]),
    !ids.length?[]:rows<{entity_id:string}>("SELECT DISTINCT a.entity_id FROM cohamy_crm.audit_events a JOIN cohamy_crm.factory_invoices f ON f.id::text=a.entity_id WHERE a.entity_id=ANY($1::text[]) AND a.action='document-flow.accepted' AND a.payload->>'revision'=f.workflow_version::text",[ids]),
    !ids.length?[]:rows<{id:string;message:string;entity_id:string;created_at:string}>("SELECT id,message,entity_id,created_at::text FROM cohamy_crm.notifications WHERE user_id=$1 AND entity_id::text=ANY($2::text[]) ORDER BY created_at DESC LIMIT 100",[user.id,ids]),
    !ids.length?[]:rows<{entity_id:string;revision:number;reason:string;created_at:string;checksum:string}>('SELECT entity_id,revision,reason,created_at::text,checksum FROM cohamy_crm.document_flow_revisions WHERE entity_id=ANY($1::uuid[]) ORDER BY revision DESC',[ids]),
  ]);
  const legacy=visible.filter(x=>!x.flow_payload).map(x=>({id:x.id,code:x.code,kind:x.stage??'ISSUE',warehouseId:x.warehouse_id,state:'LEGACY'}));
  return {documents:visible.flatMap(x=>x.flow_payload?[x.flow_payload]:[]),legacy,vats,warehouses,products,factories,stocks,orders,accepted:accepted.map(x=>x.entity_id),notifications,revisions};
}
export async function downloadFlowPdf(user:Principal,id:string,revision?:number){
  const db=await database();const row=await flowAccess(db,user,id);if(row.workflow_state==='DRAFT'&&revision===undefined&&row.flow_payload)return {bytes:await renderFlowPdf(row.flow_payload),filename:row.code+'-nhap.pdf',snapshot:row.flow_payload,checksum:''};const r=(await db.query<{pdf:Uint8Array;filename:string;checksum:string;snapshot:FlowSnapshot}>('SELECT * FROM cohamy_crm.document_flow_revisions WHERE entity_id=$1 AND ($2::integer IS NULL OR revision=$2) ORDER BY revision DESC LIMIT 1',[row.id,revision??null])).rows[0];
  if(r)return {...r,bytes:Buffer.from(r.pdf)};
  if(revision!==undefined)throw new CrmError('NOT_FOUND',404);
  if(!row.flow_payload){const snapshot=await legacyFlowSnapshot(db,row);return {bytes:await renderFlowPdf(snapshot),filename:`${row.code}-lich-su.pdf`,snapshot,checksum:''};}
  return {bytes:await renderFlowPdf(row.flow_payload),filename:`${row.code}-NHAP.pdf`,snapshot:row.flow_payload,checksum:''};
}
export async function legacyFlowSnapshot(sql:Sql,row:FlowRow):Promise<FlowSnapshot>{
  const raw=row as unknown as Record<string,unknown>,kind:FlowKind=row.stage==='FACTORY_ORDER'?'REQUEST':row.stage==='FACTORY_DISPATCH'?'DISPATCH':row.stage==='WAREHOUSE_RECONCILIATION'?'RECEIPT':'ISSUE';
  const wh=(await sql.query<{name:string;code:string}>('SELECT name,code FROM cohamy_crm.warehouses WHERE id=$1',[row.warehouse_id])).rows[0];
  const lines=((raw.lines??[]) as Record<string,unknown>[]).map(l=>({productId:String(l.productId??''),sku:String(l.sku??''),name:String(l.name??''),unit:String(l.unitLabel??''),quantity:String(kind==='RECEIPT'?l.receivedQty??0:kind==='DISPATCH'?l.dispatchedQty??0:l.quantity??l.orderedQty??0),ordered:String(l.orderedQty??l.orderedQuantity??l.quantity??0),shipped:String(l.dispatchedQty??l.quantity??0),received:String(l.receivedQty??0),difference:String(l.discrepancyQty??0),unitPrice:kind==='ISSUE'?String(l.unitPrice??''):'',amount:kind==='ISSUE'?String(l.lineAmount??l.lineTotal??''):'',note:String(l.note??'')}));
  return {id:row.id,code:row.code,kind,revision:1,state:'LEGACY',warehouseId:row.warehouse_id,warehouseName:wh?.name??'',warehouseCode:wh?.code??'',factoryMembershipId:row.factory_membership_id,factoryName:String(raw.factory_name??''),sourceId:row.parent_id,sourceCode:String(raw.order_code??''),sourceRevision:null,requestId:null,requestCode:'',createdAt:String(raw.created_at),createdBy:String(raw.created_by_name??''),confirmedAt:null,confirmedBy:'',dueDate:'',note:String(raw.note??''),lines,delivery:{recipient:String(raw.recipient_name??''),recipientPhone:String(raw.recipient_phone??''),customer:String(raw.organization_name??'')},totals:kind==='ISSUE'?{goods:String(raw.list_subtotal??''),discount:String(raw.discount_amount??''),total:String(raw.total_amount??''),paid:'',remaining:'',shipping:''}:{}};
}
export async function viewFlowDocument(user:Principal,id:string,revision?:number){
  const sql=await database(),row=await flowAccess(sql,user,id);
  if(!row.flow_payload)return legacyFlowSnapshot(sql,row);
  if(!revision||revision===row.workflow_version)return row.flow_payload;
  const r=(await sql.query<{snapshot:FlowSnapshot}>('SELECT snapshot FROM cohamy_crm.document_flow_revisions WHERE entity_id=$1 AND revision=$2',[row.id,revision])).rows[0];if(!r)throw new CrmError('NOT_FOUND',404);return r.snapshot;
}

export async function amendFlowDocument(user:Principal,input:unknown){
  if(user.area!=='crm'||user.role!=='ADMIN')throw new CrmError('FORBIDDEN',403);
  const d=parse(z.object({id:uuid,kind:z.enum(['REQUEST','DISPATCH','RECEIPT','ISSUE']),version:z.number().int().positive(),reason:z.string().trim().min(5).max(2000),note:z.string().max(2000),dueDate:z.union([z.literal(''),z.iso.date()]).optional(),delivery:z.record(z.string().max(60),z.string().trim().max(1000)).optional(),lines:z.array(z.object({productId:uuid,quantity})).min(1).max(300),idempotencyKey:uuid}).strict(),input);
  return(await database()).transaction(async sql=>{await assertCurrentPrincipal(sql,user);const hash=commercialDigest(d),before=await prior(sql,user,d.idempotencyKey,hash);if(before)return before;const row=await flowAccess(sql,user,d.id,d.kind,true),s=row.flow_payload;
    if(!s||s.state!=='CONFIRMED'||s.revision!==d.version)throw new CrmError('VERSION_CONFLICT',409);
    if(new Set(d.lines.map(l=>l.productId)).size!==s.lines.length||d.lines.length!==s.lines.length||d.lines.some(l=>!s.lines.some(x=>x.productId===l.productId)))throw new CrmError('AMEND_PRODUCT_SET_LOCKED',409);
    const sums=s.kind==='REQUEST'?await shippedQuantities(sql,s.id):new Map<string,bigint>();
    const deltas=new Map<string,bigint>();let after:FlowSnapshot={...s,revision:s.revision+1,note:d.note,dueDate:d.dueDate??s.dueDate,confirmedBy:user.displayName,confirmedAt:new Date().toISOString(),lines:s.lines.map(l=>{const q=d.lines.find(x=>x.productId===l.productId)!.quantity;if(s.kind==='REQUEST'&&fixed(q)<(sums.get(l.productId)??0n))throw new CrmError('BELOW_ALREADY_SHIPPED',409);deltas.set(l.productId,(fixed(q)-fixed(l.quantity))*(s.kind==='ISSUE'?-1n:1n));return {...l,quantity:q,ordered:s.kind==='REQUEST'?q:l.ordered,shipped:s.kind==='DISPATCH'?q:l.shipped,received:s.kind==='RECEIPT'?q:l.received,difference:s.kind==='RECEIPT'?fixedText(fixed(q)-fixed(l.shipped)):l.difference,amount:s.kind==='ISSUE'&&l.unitPrice!==''?lineAmount(l.unitPrice,q,'HALF_UP'):l.amount};})};
    if(s.kind==='DISPATCH'&&[...deltas.values()].some(x=>x!==0n)){
      const source=await sourceSnapshot(sql,user,s.sourceId!,'REQUEST'),all=await shippedQuantities(sql,source.id);
      for(const l of after.lines)if((all.get(l.productId)??0n)+(deltas.get(l.productId)??0n)>fixed(source.lines.find(x=>x.productId===l.productId)!.quantity))throw new CrmError('REQUEST_QUANTITY_EXCEEDED',409);
    }
    if(s.kind==='ISSUE'){
      const revised=await prepare(sql,user,{id:s.id,kind:'ISSUE',version:s.revision,warehouseId:s.warehouseId,clearanceId:s.sourceId!,lines:d.lines.map(l=>({...l,note:s.lines.find(x=>x.productId===l.productId)!.note})),delivery:d.delivery??(s.sourceId?Object.fromEntries(Object.entries(s.delivery).filter(([k])=>k!=='customer')):s.delivery),note:d.note,dueDate:d.dueDate??s.dueDate,confirm:false,idempotencyKey:d.idempotencyKey},{...row,workflow_state:'DRAFT'});
      after={...revised,state:'CONFIRMED',confirmedAt:after.confirmedAt,confirmedBy:user.displayName};
    }
    let inventoryId:string|null=null;if((s.kind==='RECEIPT'||s.kind==='ISSUE')&&[...deltas.values()].some(x=>x!==0n))inventoryId=await moveStock(sql,user,after,deltas,d.reason);
    await sql.query("SELECT set_config('cohamy.document_amend','on',true)");
    const file=await archive(sql,user,after,d.reason);await sql.query(`UPDATE cohamy_crm.${table(s.kind)} SET flow_payload=$1::jsonb,workflow_version=$2,lines=$3::jsonb,note=$4,updated_at=now() WHERE id=$5`,[JSON.stringify(after),after.revision,JSON.stringify(legacyLines(after)),after.note,s.id]);
    await audit(sql,user.id,'document-flow.amended',s.id,{before:s,after,reason:d.reason,inventoryId});await enqueueDocumentMail(sql,{event:'document.amended',snapshot:after,files:[{type:'FLOW',id:file.revisionId,filename:file.filename,checksum:file.checksum}]});
    const result={id:s.id,code:s.code,version:after.revision,state:after.state};await record(sql,user,d.idempotencyKey,hash,result);return result;
  });
}

export async function persistAdminFlowRevision(sql:Sql,user:Principal,before:FlowSnapshot,after:FlowSnapshot,reason:string){
  if(user.area!=='crm'||user.role!=='ADMIN')throw new CrmError('FORBIDDEN',403);
  const saved=(await sql.query('SELECT id FROM cohamy_crm.document_flow_revisions WHERE entity_id=$1 AND revision=$2',[before.id,before.revision])).rows.length;
  if(!saved)await archive(sql,user,before,'Bản trước khi Admin điều chỉnh');
  const file=after.state==='DRAFT'?null:await archive(sql,user,after,reason);
  await sql.query("SELECT set_config('cohamy.document_amend','on',true)");
  const total=after.totals.total??after.lines.reduce((n,l)=>n+BigInt(l.amount||'0'),0n).toString();
  if(after.kind==='ISSUE')await sql.query('UPDATE cohamy_crm.warehouse_handover_invoices SET flow_payload=$1::jsonb,workflow_version=$2,workflow_state=$3,lines=$4::jsonb,note=$5,warehouse_id=$6,total_quantity=$7,total_amount=$8,updated_at=now() WHERE id=$9',[JSON.stringify(after),after.revision,after.state,JSON.stringify(legacyLines(after)),after.note,after.warehouseId,fixedText(after.lines.reduce((n,l)=>n+fixed(l.quantity),0n)),total,after.id]);
  else await sql.query('UPDATE cohamy_crm.factory_invoices SET flow_payload=$1::jsonb,workflow_version=$2,workflow_state=$3,lines=$4::jsonb,note=$5,warehouse_id=$6,total_amount=$7,total_ordered_qty=$9,total_dispatched_qty=$10,total_received_qty=$11,updated_at=now() WHERE id=$8',[JSON.stringify(after),after.revision,after.state,JSON.stringify(legacyLines(after)),after.note,after.warehouseId,total,after.id,...(['ordered','shipped','received'] as const).map(key=>fixedText(after.lines.reduce((n,l)=>n+fixed(l[key]||'0'),0n)))]);
  await audit(sql,user.id,after.state==='CANCELLED'?'document-flow.cancelled':'document-flow.amended',after.id,{before,after,reason,adminInvoice:true});
  return file;
}
