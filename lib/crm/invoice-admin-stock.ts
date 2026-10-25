import 'server-only';
import {randomUUID} from 'node:crypto';
import type {Sql} from './db';
import type {Principal} from './types';
import {CrmError} from './permissions';
import {fixed,fixedText} from './decimal';
import {commercialDigest} from './commercial-common';
import type {InvoiceKind} from './invoice-admin-model';

export type InvoiceStockCell={warehouse_id:string;location_id:string;product_id:string;lot_id:string;quantity:string;unit_snapshot:unknown;source_order_id:string|null;owner:string};
export type InvoiceStockTarget={warehouseId:string;productId:string;quantity:bigint};
export async function invoiceStockCells(sql:Sql,kind:InvoiceKind,id:string,orderId?:string|null):Promise<InvoiceStockCell[]>{
 if(!['FLOW','SALES','TRANSFER'].includes(kind))return [];
 const where=kind==='SALES'?'m.source_order_id=$1':kind==='TRANSFER'?"d.reference_type='inventory-transfer' AND d.reference_id=$1":kind==='FLOW'?"d.reference_type IN('factory-invoice','warehouse-reconciliation','warehouse-handover') AND d.reference_id=$1":'false';
 const rows=(await sql.query<InvoiceStockCell&{reference_type:string;reference_id:string}>(`SELECT m.warehouse_id,m.location_id,m.product_id,m.lot_id,m.quantity::text,m.unit_snapshot,m.source_order_id,d.reference_type,d.reference_id FROM cohamy_crm.inventory_movements m JOIN cohamy_crm.inventory_documents d ON d.id=m.document_id WHERE (${where}) OR (d.reference_type='admin-invoice' AND d.reference_id=$2) ORDER BY m.created_at,m.id`,[orderId??id,kind+':'+id])).rows;
 const cells=new Map<string,InvoiceStockCell>();
 for(const r of rows){const owner=r.reference_type==='admin-invoice'?r.reference_id:r.reference_type==='warehouse-handover'?'FLOW:'+r.reference_id:kind+':'+id,key=[r.warehouse_id,r.location_id,r.product_id,r.lot_id,owner].join(':');const old=cells.get(key);cells.set(key,{...r,owner,quantity:fixedText(fixed(old?.quantity??'0',6,true)+fixed(r.quantity,6,true))});}
 return [...cells.values()].filter(r=>fixed(r.quantity,6,true)!==0n);
}

// All compensation entries retain the exact warehouse/location/lot and invoice
// ownership. Nothing deletes or edits an original inventory movement.
export async function adjustInvoiceStock(sql:Sql,user:Principal,kind:InvoiceKind,id:string,cells:InvoiceStockCell[],targets:InvoiceStockTarget[],reason:string,orderId?:string|null){
 const warehouses=[...new Set([...cells.map(c=>c.warehouse_id),...targets.map(t=>t.warehouseId)])].sort();
 for(const warehouseId of warehouses){const w=(await sql.query<{id:string}>('SELECT id FROM cohamy_crm.warehouses WHERE id=$1 AND organization_id=$2 FOR UPDATE',[warehouseId,user.organizationId])).rows[0];if(!w)throw new CrmError('NOT_FOUND',404);}
 const groups=new Map<string,{warehouseId:string;productId:string;before:bigint;after:bigint;cells:InvoiceStockCell[]}>();
 for(const c of cells){const key=c.warehouse_id+':'+c.product_id,row=groups.get(key)??{warehouseId:c.warehouse_id,productId:c.product_id,before:0n,after:0n,cells:[]};row.before+=fixed(c.quantity,6,true);row.cells.push(c);groups.set(key,row);}
 for(const t of targets){const key=t.warehouseId+':'+t.productId,row=groups.get(key)??{...t,before:0n,after:0n,cells:[]};row.after+=t.quantity;groups.set(key,row);}
 const documents=new Map<string,string>(),changes:{warehouseId:string;productId:string;quantity:string}[]=[];
 async function move(cell:InvoiceStockCell,delta:bigint){
  if(delta===0n)return;
  const balance=(await sql.query<{on_hand:string;reserved:string}>('SELECT on_hand::text,reserved::text FROM cohamy_crm.inventory_balances WHERE warehouse_id=$1 AND location_id=$2 AND product_id=$3 AND lot_id=$4 FOR UPDATE',[cell.warehouse_id,cell.location_id,cell.product_id,cell.lot_id])).rows[0];
  if(!balance||fixed(balance.on_hand)+delta<fixed(balance.reserved))throw new CrmError('INVOICE_STOCK_ALREADY_USED',409);
  let documentId=documents.get(cell.owner);
  if(!documentId){documentId=randomUUID();documents.set(cell.owner,documentId);await sql.query("INSERT INTO cohamy_crm.inventory_documents(id,code,kind,organization_id,reference_type,reference_id,actor_id,reason,idempotency_key,request_hash,result) VALUES($1,$2,'ADJUSTMENT',$3,'admin-invoice',$4,$5,$6,$7,$8,$9::jsonb)",[documentId,'KHO-DC-'+documentId.slice(0,8).toUpperCase(),user.organizationId,cell.owner,user.id,reason,randomUUID(),commercialDigest({kind,id,reason}),JSON.stringify({kind,id})]);}
  const next=fixed(balance.on_hand)+delta;
  await sql.query('UPDATE cohamy_crm.inventory_balances SET on_hand=$1,version=version+1,updated_at=now() WHERE warehouse_id=$2 AND location_id=$3 AND product_id=$4 AND lot_id=$5',[fixedText(next),cell.warehouse_id,cell.location_id,cell.product_id,cell.lot_id]);
  await sql.query('INSERT INTO cohamy_crm.inventory_movements(id,document_id,warehouse_id,location_id,product_id,lot_id,quantity,balance_after,unit_snapshot,source_order_id,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)',[randomUUID(),documentId,cell.warehouse_id,cell.location_id,cell.product_id,cell.lot_id,fixedText(delta),fixedText(next),JSON.stringify(cell.unit_snapshot),orderId??cell.source_order_id,user.id]);
 }
 for(const row of [...groups.values()].sort((a,b)=>(a.warehouseId+a.productId).localeCompare(b.warehouseId+b.productId))){
  let delta=row.after-row.before;if(delta===0n)continue;const requested=delta;
  // Reverse existing effects first, at their original physical location/lot.
  for(const cell of row.cells){const q=fixed(cell.quantity,6,true);if(delta===0n||q===0n||(q>0n)===(delta>0n))continue;let amount=q>0n?-delta:delta;const cap=q>0n?q:-q;if(amount>cap)amount=cap;const change=delta>0n?amount:-amount;await move(cell,change);delta-=change;}
  if(delta<0n){
   const free=(await sql.query<{location_id:string;lot_id:string;on_hand:string;reserved:string}>("SELECT b.location_id,b.lot_id,b.on_hand::text,b.reserved::text FROM cohamy_crm.inventory_balances b JOIN cohamy_crm.warehouse_locations l ON l.id=b.location_id JOIN cohamy_crm.inventory_lots t ON t.id=b.lot_id WHERE b.warehouse_id=$1 AND b.product_id=$2 AND l.active AND l.kind='PICK' AND t.status='AVAILABLE' AND (t.expires_on IS NULL OR t.expires_on>=CURRENT_DATE) AND ($3::uuid IS NULL OR b.lot_id=$3::uuid) AND ($4::uuid IS NULL OR b.location_id=$4::uuid) ORDER BY t.expires_on NULLS LAST,b.location_id,b.lot_id FOR UPDATE OF b",[row.warehouseId,row.productId,kind==='TRANSFER'?row.cells[0]?.lot_id??null:null,kind==='TRANSFER'?row.cells[0]?.location_id??null:null])).rows;
   for(const b of free){if(delta===0n)break;let take=fixed(b.on_hand)-fixed(b.reserved);if(take>-delta)take=-delta;if(take<=0n)continue;await move({warehouse_id:row.warehouseId,location_id:b.location_id,product_id:row.productId,lot_id:b.lot_id,quantity:'0',unit_snapshot:row.cells[0]?.unit_snapshot??{productId:row.productId},source_order_id:orderId??null,owner:row.cells[0]?.owner??kind+':'+id},-take);delta+=take;}
   if(delta!==0n)throw new CrmError('INVENTORY_INSUFFICIENT',409);
  }
  if(delta>0n){
   let template=row.cells[0];
   if(!template){
    const location=(await sql.query<{id:string}>("SELECT id FROM cohamy_crm.warehouse_locations WHERE warehouse_id=$1 AND active AND kind='PICK' ORDER BY id LIMIT 1",[row.warehouseId])).rows[0];if(!location)throw new CrmError('INVOICE_PICK_LOCATION_REQUIRED',409);
    const product=(await sql.query<{id:string;stock_unit:string}>('SELECT id,stock_unit FROM cohamy_crm.products WHERE id=$1 AND active',[row.productId])).rows[0];if(!product?.stock_unit)throw new CrmError('PRODUCT_STOCK_UNIT_REQUIRED',409);
    const code='ADMIN-'+kind+'-'+id;let lot=(await sql.query<{id:string}>('SELECT id FROM cohamy_crm.inventory_lots WHERE product_id=$1 AND code=$2',[row.productId,code])).rows[0];if(!lot){lot={id:randomUUID()};await sql.query("INSERT INTO cohamy_crm.inventory_lots(id,product_id,code,status) VALUES($1,$2,$3,'AVAILABLE')",[lot.id,row.productId,code]);}
    await sql.query('INSERT INTO cohamy_crm.inventory_balances(warehouse_id,location_id,product_id,lot_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[row.warehouseId,location.id,row.productId,lot.id]);
    template={warehouse_id:row.warehouseId,location_id:location.id,product_id:row.productId,lot_id:lot.id,quantity:'0',unit_snapshot:{productId:row.productId,stockUnit:product.stock_unit},source_order_id:orderId??null,owner:kind+':'+id};
   }
   await move(template,delta);
  }
  changes.push({warehouseId:row.warehouseId,productId:row.productId,quantity:fixedText(requested)});
 }
 return {changes,inventoryDocumentIds:[...documents.values()]};
}
