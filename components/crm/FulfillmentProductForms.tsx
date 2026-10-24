'use client';
import {useState} from 'react';
import {Form} from './CommercialForms';
import {ProductEntryGrid,ProductQuantityInput} from './ProductEntryGrid';
import {enteredFormRows,productField,productValue} from '@/lib/crm/product-entry';
type Line={id:string;sku:string;product_name?:string;stock_unit?:string;lot_code:string;location_code?:string;planned?:string;picked?:string;packed?:string;delivered?:string;quantity?:string;return_available?:string};
type Reservation={id:string;sku:string;product_name?:string;stock_unit?:string;lot_code:string;location_code:string;status:string;quantity:string;consumed:string;released:string;available_for_delivery?:string};
type Location={id:string;warehouse_code:string;code:string;kind?:string;active:boolean};
const str=(f:FormData,k:string)=>String(f.get(k)??''),iso=(v:string)=>v?new Date(v+':00+07:00').toISOString():null;
const rowsFor=(lines:Line[])=>lines.map(l=>({...l,key:l.id,name:l.product_name??'Sản phẩm trong chứng từ nguồn',unit:l.stock_unit,detail:`${l.location_code?l.location_code+' · ':''}Lô ${l.lot_code}`}));

export function BackorderForm({orderId,products}:{orderId:string;products:{productId:string;sku:string;name?:string;stockUnit?:string;remaining:string}[]}){
 const rows=products.map(p=>({...p,key:p.productId,name:p.name??'Sản phẩm trong đơn',unit:p.stockUnit}));
 return <Form endpoint="/api/crm/fulfillment/backorder" label="Ghi hàng chờ bổ sung" payload={f=>({orderId,lines:enteredFormRows(f,rows).map(p=>({productId:p.productId,quantity:productValue(f,p.key,'quantity'),expectedOn:productValue(f,p.key,'expectedOn')||null,ownerMembershipId:null})),reason:str(f,'reason')})}>
  <ProductEntryGrid rows={rows} label="Sản phẩm còn thiếu của đơn" help="Chỉ gồm phần đơn chưa được giữ hàng. Ngày dự kiến dùng để theo dõi bổ sung." columns={[
   {key:'remaining',label:'Chưa được giữ hàng',render:p=>p.remaining},
   {key:'quantity',label:'Lượng chờ bổ sung',render:p=><ProductQuantityInput name={productField(p.key,'quantity')} aria-label={`Chờ bổ sung ${p.name}`} max={p.remaining}/>},
   {key:'date',label:'Ngày dự kiến',render:p=><input type="date" name={productField(p.key,'expectedOn')} aria-label={`Ngày bổ sung ${p.name}`}/>},
  ]}/><label>Người / ghi chú xử lý<input name="reason" required minLength={3}/></label>
 </Form>;
}

export function PickForm({delivery}:{delivery:{id:string;version:number;lines:Line[]}}){
 const rows=rowsFor(delivery.lines).map(l=>({...l,remaining:String(Number(l.planned??0)-Number(l.picked??0))})).filter(l=>Number(l.remaining)>0);
 return <Form endpoint="/api/crm/fulfillment/pick" label="Xác nhận soạn" payload={f=>({id:delivery.id,version:delivery.version,lines:enteredFormRows(f,rows).map(l=>({lineId:l.id,quantity:productValue(f,l.key,'quantity'),scannerCode:productValue(f,l.key,'scannerCode'),manual:f.has(productField(l.key,'manual'))})),reason:str(f,'reason')})}>
  <ProductEntryGrid rows={rows} label="Sản phẩm cần soạn của đợt giao" help="Quét sản phẩm hoặc mã lô vào đúng dòng. Chỉ các dòng có số lượng được xác nhận trong một lần lưu." columns={[
   {key:'remaining',label:'Còn phải soạn',render:l=>l.remaining},
   {key:'quantity',label:'Lượng soạn lần này',render:l=><ProductQuantityInput name={productField(l.key,'quantity')} aria-label={`Soạn ${l.name} lô ${l.lot_code}`} max={l.remaining}/>},
   {key:'scanner',label:'Mã quét sản phẩm / lô',render:l=><input aria-label={`Mã quét ${l.name} lô ${l.lot_code}`} name={productField(l.key,'scannerCode')} maxLength={120}/>},
   {key:'manual',label:'Nhập thủ công',render:l=><label><input type="checkbox" name={productField(l.key,'manual')}/>Thiết bị không có camera</label>},
  ]}/><label>Lý do / thiết bị<input name="reason" required minLength={3}/></label>
 </Form>;
}

export function DeliveryCreateForm({orderId,reservations}:{orderId:string;reservations:Reservation[]}){
 const rows=reservations.filter(r=>['ACTIVE','PARTIAL'].includes(r.status)).map(r=>({...r,key:r.id,name:r.product_name??'Sản phẩm đã giữ cho đơn',unit:r.stock_unit,detail:`${r.location_code} · Lô ${r.lot_code}`,remaining:r.available_for_delivery??String(Number(r.quantity)-Number(r.consumed)-Number(r.released))})).filter(r=>Number(r.remaining)>0);
 return <Form endpoint="/api/crm/fulfillment/delivery-create" label="Lập đợt giao" payload={f=>({orderId,lines:enteredFormRows(f,rows).map(r=>({reservationId:r.id,quantity:productValue(f,r.key,'quantity')})),windowStart:iso(str(f,'windowStart')),windowEnd:iso(str(f,'windowEnd')),requirements:str(f,'requirements'),reason:str(f,'reason')})}>
  <ProductEntryGrid rows={rows} label="Hàng đã giữ còn có thể lập đợt giao" help="Chỉ gồm hàng đã giữ cho đơn này, sau khi trừ phần đã lên kế hoạch giao." columns={[
   {key:'remaining',label:'Còn có thể giao',render:r=>r.remaining},
   {key:'quantity',label:'Số lượng đợt này',render:r=><ProductQuantityInput aria-label={`Giao ${r.name} lô ${r.lot_code}`} name={productField(r.key,'quantity')} max={r.remaining}/>},
  ]}/><div className="work-fields"><label>Từ (giờ Việt Nam)<input name="windowStart" type="datetime-local"/></label><label>Đến (giờ Việt Nam)<input name="windowEnd" type="datetime-local"/></label><label>Yêu cầu nhận hàng<textarea name="requirements" maxLength={1000}/></label><label>Lý do lập đợt<input name="reason" required minLength={3}/></label></div>
 </Form>;
}

export function PackForm({delivery}:{delivery:{id:string;version:number;lines:Line[]}}){
 const rows=rowsFor(delivery.lines).map(l=>({...l,remaining:String(Number(l.picked??0)-Number(l.packed??0))})).filter(l=>Number(l.remaining)>0);
 return <Form endpoint="/api/crm/fulfillment/pack" label="Đóng kiện" payload={f=>({id:delivery.id,version:delivery.version,label:str(f,'label'),lines:enteredFormRows(f,rows).map(l=>({lineId:l.id,quantity:productValue(f,l.key,'quantity')})),reason:str(f,'reason')})}>
  <ProductEntryGrid rows={rows} label="Hàng đã soạn còn chờ đóng kiện" columns={[
   {key:'picked',label:'Đã soạn',render:l=>l.picked},{key:'remaining',label:'Còn chờ đóng',render:l=>l.remaining},
   {key:'quantity',label:'Số lượng vào kiện',render:l=><ProductQuantityInput aria-label={`Đóng kiện ${l.name} lô ${l.lot_code}`} name={productField(l.key,'quantity')} max={l.remaining}/>},
  ]}/><div className="work-fields"><label>Nhãn kiện<input name="label" required maxLength={200}/></label><label>Lý do đóng kiện<input name="reason" required minLength={3}/></label></div>
 </Form>;
}

export function ReturnRequestForm({orderId,lines}:{orderId:string;lines:Line[]}){
 const rows=rowsFor(lines).map(l=>({...l,eligible:l.return_available??l.delivered??'0'})).filter(l=>Number(l.eligible)>0);
 return <Form endpoint="/api/crm/fulfillment/return-request" label="Gửi yêu cầu đổi trả" payload={f=>({orderId,lines:enteredFormRows(f,rows).map(l=>({deliveryLineId:l.id,quantity:productValue(f,l.key,'quantity'),reason:productValue(f,l.key,'lineReason'),photoDocumentId:null})),reason:str(f,'reason')})}>
  <ProductEntryGrid rows={rows} label="Sản phẩm đã giao có thể đổi trả" columns={[
   {key:'eligible',label:'Còn được yêu cầu trả',render:l=>l.eligible},
   {key:'quantity',label:'Số lượng trả',render:l=><ProductQuantityInput aria-label={`Trả ${l.name} lô ${l.lot_code}`} name={productField(l.key,'quantity')} max={l.eligible}/>},
   {key:'reason',label:'Lý do từng dòng',render:l=><input aria-label={`Lý do trả ${l.name}`} name={productField(l.key,'lineReason')} maxLength={1000}/>},
  ]}/><label>Lý do phiếu<input name="reason" required minLength={3}/></label>
 </Form>;
}

export function ReturnReceiveForm({item,locations}:{item:{id:string;version:number;lines:Line[]};locations:Location[]}){
 const rows=rowsFor(item.lines);
 const [dispositions,setDispositions]=useState<Record<string,string>>({});
 return <Form endpoint="/api/crm/fulfillment/return-receive" label="Ghi thực nhận và phân loại" payload={f=>({id:item.id,version:item.version,lines:enteredFormRows(f,rows).map(l=>({requestLineId:l.id,quantity:productValue(f,l.key,'quantity'),disposition:productValue(f,l.key,'disposition'),locationId:productValue(f,l.key,'locationId'),reason:productValue(f,l.key,'lineReason')})),reason:str(f,'reason')})}>
  <ProductEntryGrid rows={rows} label="Nhận và phân loại hàng trả" help="Chọn vị trí phù hợp với phân loại hàng. Server kiểm tra loại vị trí trước khi ghi nhập." columns={[
   {key:'requested',label:'Đề nghị trả',render:l=>l.quantity},
   {key:'quantity',label:'Thực nhận',render:l=><ProductQuantityInput aria-label={`Nhận trả ${l.name} lô ${l.lot_code}`} name={productField(l.key,'quantity')} max={l.quantity}/>},
   {key:'disposition',label:'Phân loại',render:l=><select aria-label={`Phân loại ${l.name}`} name={productField(l.key,'disposition')} value={dispositions[l.key]??'RESALE'} onChange={e=>setDispositions({...dispositions,[l.key]:e.target.value})}><option value="RESALE">Bán lại</option><option value="QUARANTINE">Cách ly</option><option value="DAMAGED">Hỏng</option></select>},
   {key:'location',label:'Vị trí nhận',render:l=><select aria-label={`Vị trí nhận ${l.name}`} name={productField(l.key,'locationId')} key={dispositions[l.key]??'RESALE'}><option value="">Chọn vị trí</option>{locations.filter(loc=>loc.active&&(loc.kind??'PICK')===((dispositions[l.key]??'RESALE')==='RESALE'?'PICK':dispositions[l.key])).map(loc=><option key={loc.id} value={loc.id}>{loc.warehouse_code}/{loc.code} · {loc.kind??'PICK'}</option>)}</select>},
   {key:'reason',label:'Lý do phân loại',render:l=><input aria-label={`Lý do nhận trả ${l.name}`} name={productField(l.key,'lineReason')} maxLength={1000}/>},
  ]}/><label>Lý do nhận phiếu<input name="reason" required minLength={3}/></label><p>Phân loại kho không tự tạo hoàn tiền.</p>
 </Form>;
}
