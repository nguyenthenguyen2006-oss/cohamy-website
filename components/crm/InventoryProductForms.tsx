'use client';
import {useState} from 'react';
import {Form} from './CommercialForms';
import {ProductEntryGrid,ProductQuantityInput} from './ProductEntryGrid';
import {enteredFormRows,productField,productValue} from '@/lib/crm/product-entry';
import {transferProductRows,allocateTransferProduct,transferReceiptRows,allocateTransferReceipt,transferQuantity} from '@/lib/crm/inventory-transfer-lines';

type Product={id:string;sku:string;name:string;stock_unit:string};
type Location={id:string;warehouse_id:string;warehouse_code:string;code:string;name:string;kind:string;active:boolean;organization_id:string};
type Balance={warehouse_id:string;location_id:string;product_id:string;lot_id:string;warehouse_code:string;location_code:string;sku:string;product_name:string;stock_unit?:string;location_kind?:string;expires_on?:string|null;lot_code:string;on_hand:string;available:string;lot_status:string};
const str=(f:FormData,k:string)=>String(f.get(k)??'');
const balanceRows=(balances:Balance[])=>balances.map(b=>({...b,key:b.location_id+':'+b.lot_id,name:b.product_name,unit:b.stock_unit,detail:`${b.warehouse_code}/${b.location_code} · Lô ${b.lot_code}`}));

export function ReceiptForm({locations,products}:{locations:Location[];products:Product[]}){
 const rows=products.filter(p=>p.stock_unit).map(p=>({...p,key:p.id,unit:p.stock_unit}));
 return <Form endpoint="/api/crm/inventory/receipt" label="Ghi nhận thực nhập" payload={f=>({locationId:str(f,'locationId'),lines:enteredFormRows(f,rows).map(p=>({productId:p.id,lotCode:productValue(f,p.key,'lotCode'),manufacturedOn:productValue(f,p.key,'manufacturedOn')||null,expiresOn:productValue(f,p.key,'expiresOn')||null,quantity:productValue(f,p.key,'quantity')})),referenceType:str(f,'referenceType'),referenceId:str(f,'referenceId'),reason:str(f,'reason')})}>
  <p>Ghi theo hàng thực nhận và chứng từ nguồn. Mỗi dòng dùng đơn vị gốc của sản phẩm.</p><div className="work-fields"><label>Vị trí nhận<select name="locationId" required><option value="">Chọn vị trí</option>{locations.filter(l=>l.active).map(l=><option key={l.id} value={l.id}>{l.warehouse_code}/{l.code} · {l.name}</option>)}</select></label><label>Loại chứng từ<input name="referenceType" required defaultValue="supplier-receipt" maxLength={80}/></label><label>Số chứng từ nguồn<input name="referenceId" required maxLength={120}/></label></div>
  <ProductEntryGrid rows={rows} label="Hàng thực nhập" help="Nhập số lượng và mã lô cho từng hàng nhận. Dòng trống hoặc bằng 0 không được ghi nhập." columns={[
   {key:'quantity',label:'Thực nhập',render:p=><ProductQuantityInput name={productField(p.key,'quantity')} aria-label={`Thực nhập ${p.name}`} quick/>},
   {key:'lot',label:'Mã lô',render:p=><input name={productField(p.key,'lotCode')} aria-label={`Mã lô ${p.name}`} maxLength={80}/>},
   {key:'made',label:'Ngày sản xuất',render:p=><input type="date" name={productField(p.key,'manufacturedOn')} aria-label={`Ngày sản xuất ${p.name}`}/>},
   {key:'expires',label:'Hạn dùng',render:p=><input type="date" name={productField(p.key,'expiresOn')} aria-label={`Hạn dùng ${p.name}`}/>},
  ]}/><label>Lý do / ghi chú<input name="reason" required minLength={3} maxLength={2000}/></label>
 </Form>;
}

export function TransferForm({locations,destinationLocations,balances,onSaved}:{locations:Location[];destinationLocations?:Location[];balances:Balance[];onSaved?:()=>void}){
 const [sourceId,setSourceId]=useState(''),source=locations.find(l=>l.id===sourceId);
 const rows=transferProductRows(balances,sourceId);
 return <Form endpoint="/api/crm/inventory/transfer-ship" onSuccess={onSaved?()=>onSaved():undefined} label="Xuất chuyển kho" payload={f=>({sourceLocationId:sourceId,lines:enteredFormRows(f,rows).flatMap(b=>allocateTransferProduct(b,productValue(f,b.key,'quantity'),str(f,'destinationLocationId'))),reason:str(f,'reason')})}>
  <div className="work-fields"><label>Vị trí nguồn<select aria-label="Vị trí nguồn" required value={sourceId} onChange={e=>setSourceId(e.target.value)}><option value="">Chọn vị trí có hàng</option>{locations.filter(l=>l.active&&l.kind==='PICK'&&balances.some(b=>b.location_id===l.id&&Number(b.available)>0)).map(l=><option key={l.id} value={l.id}>{l.warehouse_code}/{l.code} · {l.name}</option>)}</select></label><label>Vị trí đích<select aria-label="Vị trí đích" name="destinationLocationId" key={sourceId} required><option value="">Chọn kho khác cùng chủ sở hữu</option>{(destinationLocations??locations).filter(l=>l.active&&l.kind==='PICK'&&source&&l.warehouse_id!==source.warehouse_id&&l.organization_id===source.organization_id).map(l=><option key={l.id} value={l.id}>{l.warehouse_code}/{l.code} · {l.name}</option>)}</select></label></div>
  <ProductEntryGrid key={sourceId} rows={rows} label="Hàng xuất chuyển kho" help="Mỗi sản phẩm một dòng. Nhập số gói cần chuyển; khả dụng là tổng số gói có thể xuất." columns={[
   {key:'available',label:'Khả dụng (gói)',render:b=>transferQuantity(b.available)},
   {key:'quantity',label:'Số gói chuyển',render:b=><ProductQuantityInput name={productField(b.key,'quantity')} aria-label={`Chuyển ${b.name}`} max={b.available}/>},
  ]}/><label>Lý do chuyển<input name="reason" required minLength={3} maxLength={2000}/></label><p>Hàng ở trạng thái đang chuyển cho đến khi kho đích ghi thực nhận hoặc thiếu hụt.</p>
 </Form>;
}

export function TransferReceiptForm({transfer,onSaved}:{onSaved?:()=>void;transfer:{id:string;version:number;receipts?:{index:number;quantity:string;shortage:string}[][];snapshot:{lines:{productId?:string;quantity:string;unit?:{name?:string;sku?:string;stockUnit?:string}}[]}}}){
 const rows=transferReceiptRows(transfer);
 return <Form endpoint="/api/crm/inventory/transfer-receive" onSuccess={onSaved?()=>onSaved():undefined} label="Xác nhận thực nhận" payload={f=>({id:transfer.id,version:transfer.version,lines:enteredFormRows(f,rows,true).flatMap(l=>allocateTransferReceipt(l,productValue(f,l.key,'quantity'),productValue(f,l.key,'shortage')||'0')),final:f.has('final'),reason:str(f,'reason')})}>
  <ProductEntryGrid rows={rows} label="Nhận hàng chuyển kho" help="Nhập thực nhận, kể cả 0, cho các dòng xử lý lần này; bỏ trống dòng chưa xử lý." columns={[
   {key:'sent',label:'Đã xuất',render:l=>transferQuantity(l.quantity)},{key:'remaining',label:'Còn chờ nhận',render:l=>transferQuantity(l.remaining)},
   {key:'quantity',label:'Thực nhận lần này',render:l=><ProductQuantityInput name={productField(l.key,'quantity')} aria-label={`Thực nhận ${l.name}`} max={l.remaining}/>},
   {key:'shortage',label:'Thiếu lần này',render:l=><ProductQuantityInput name={productField(l.key,'shortage')} aria-label={`Thiếu ${l.name}`} defaultValue="0" max={l.remaining}/>},
  ]}/><label>Lý do nhận / thiếu<input name="reason" required minLength={3}/></label><label className="work-check"><input name="final" type="checkbox"/>Chốt toàn bộ phần còn lại của phiếu chuyển</label>
 </Form>;
}

export function RecordCountForm({count,balances}:{count:{id:string;version:number;warehouse_code:string};balances:Balance[]}){
 const rows=balanceRows(balances.filter(b=>b.warehouse_code===count.warehouse_code));
 return <Form endpoint="/api/crm/inventory/count-record" label="Lưu lần đếm" payload={f=>({id:count.id,version:count.version,lines:enteredFormRows(f,rows,true).map(b=>({locationId:b.location_id,productId:b.product_id,lotId:b.lot_id,quantity:productValue(f,b.key,'quantity')})),reason:str(f,'reason')})}>
  <ProductEntryGrid rows={rows} label="Số lượng kiểm kê theo lô và vị trí" help="Nhập lượng đếm thực tế, kể cả 0. Bỏ trống các dòng chưa đếm." columns={[
   {key:'book',label:'Tồn theo sổ',render:b=>transferQuantity(b.on_hand)},
   {key:'quantity',label:'Thực đếm',render:b=><ProductQuantityInput name={productField(b.key,'quantity')} aria-label={`Thực đếm ${b.name} ${b.location_code} lô ${b.lot_code}`}/>},
  ]}/><label>Lý do ghi đếm<input name="reason" required minLength={3}/></label>
 </Form>;
}
