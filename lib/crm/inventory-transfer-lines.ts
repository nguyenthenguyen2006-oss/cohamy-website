import {fixed,fixedText} from './decimal';
import {CrmError} from './permissions';

export type TransferBalance={warehouse_id:string;location_id:string;location_kind?:string;product_id:string;lot_id:string;sku:string;product_name:string;stock_unit?:string;available:string;lot_status:string;lot_code:string;expires_on?:string|Date|null};
const expiry=(value:string|Date|null|undefined)=>value instanceof Date?value.toISOString().slice(0,10):value??'9999-12-31';
export function transferQuantity(value:string){const text=fixedText(fixed(value)),[whole,fraction]=text.split('.');return new Intl.NumberFormat('vi-VN').format(BigInt(whole))+(fraction?','+fraction:'');}
export function transferProductRows<T extends TransferBalance>(balances:T[],sourceId?:string){
 const groups=new Map<string,{key:string;product_id:string;location_id:string;warehouse_id:string;sku:string;name:string;unit?:string;available:string;lots:T[]}>();
 for(const b of balances){if(sourceId!==undefined&&b.location_id!==sourceId||b.location_kind&&b.location_kind!=='PICK'||b.lot_status!=='AVAILABLE'||fixed(b.available)<=0n)continue;const key=b.location_id+':'+b.product_id;let row=groups.get(key);if(!row){row={key,product_id:b.product_id,location_id:b.location_id,warehouse_id:b.warehouse_id,sku:b.sku,name:b.product_name,unit:b.stock_unit,available:'0',lots:[]};groups.set(key,row);}row.available=fixedText(fixed(row.available)+fixed(b.available));row.lots.push(b);}
 for(const row of groups.values())row.lots.sort((a,b)=>expiry(a.expires_on).localeCompare(expiry(b.expires_on))||a.lot_code.localeCompare(b.lot_code)||a.lot_id.localeCompare(b.lot_id));
 return [...groups.values()].sort((a,b)=>a.sku.localeCompare(b.sku)||a.key.localeCompare(b.key));
}
export function allocateTransferProduct(row:ReturnType<typeof transferProductRows>[number],quantity:string,destinationLocationId:string){
 let remaining=fixed(quantity);if(remaining<=0n||remaining>fixed(row.available))throw new CrmError('INVENTORY_INSUFFICIENT',409);const lines=[];
 for(const lot of row.lots){if(remaining===0n)break;const available=fixed(lot.available),take=remaining<available?remaining:available;lines.push({productId:row.product_id,lotId:lot.lot_id,quantity:fixedText(take),destinationLocationId});remaining-=take;}
 if(remaining!==0n)throw new CrmError('INVENTORY_INSUFFICIENT',409);return lines;
}
type ReceiptLine={productId?:string;quantity:string;unit?:{name?:string;sku?:string;stockUnit?:string}};
export function transferReceiptRows(transfer:{snapshot:{lines:ReceiptLine[]};receipts?:{index:number;quantity:string;shortage:string}[][]}){
 const processed=new Map<number,bigint>();for(const r of (transfer.receipts??[]).flat())processed.set(r.index,(processed.get(r.index)??0n)+fixed(r.quantity)+fixed(r.shortage));
 const groups=new Map<string,{key:string;name:string;sku?:string;unit?:string;quantity:string;remaining:string;parts:{index:number;remaining:string}[]}>();
 transfer.snapshot.lines.forEach((line,index)=>{const key=line.productId??'line:'+index;let row=groups.get(key);if(!row){row={key,name:line.unit?.name??`Sản phẩm dòng ${index+1}`,sku:line.unit?.sku,unit:line.unit?.stockUnit,quantity:'0',remaining:'0',parts:[]};groups.set(key,row);}row.quantity=fixedText(fixed(row.quantity)+fixed(line.quantity));const remaining=fixed(line.quantity)-(processed.get(index)??0n);if(remaining>0n){row.remaining=fixedText(fixed(row.remaining)+remaining);row.parts.push({index,remaining:fixedText(remaining)});}});
 return [...groups.values()].filter(row=>fixed(row.remaining)>0n);
}
export function allocateTransferReceipt(row:ReturnType<typeof transferReceiptRows>[number],quantity:string,shortage:string){
 let actual=fixed(quantity),missing=fixed(shortage);if(actual+missing>fixed(row.remaining))throw new CrmError('TRANSFER_OVER_RECEIPT',409);const lines=[];
 for(const part of row.parts){const remaining=fixed(part.remaining),take=actual<remaining?actual:remaining,space=remaining-take,lost=missing<space?missing:space;actual-=take;missing-=lost;if(take+lost>0n)lines.push({index:part.index,quantity:fixedText(take),shortage:fixedText(lost)});}
 if(!lines.length)lines.push({index:row.parts[0].index,quantity:'0',shortage:'0'});return lines;
}
