'use client';

import type {flowWorkspace} from '@/lib/crm/document-flow';
import type {Draft} from './DocumentFlowWorkspace';
import {fixed,fixedText} from '@/lib/crm/decimal';
import {ProductEntryGrid,ProductQuantityInput} from './ProductEntryGrid';
import {withProductCatalogue} from '@/lib/crm/product-entry';

type Data=Awaited<ReturnType<typeof flowWorkspace>>;
export function FlowProductLines({data,draft,onChange}:{data:Data;draft:Draft;onChange:(draft:Draft)=>void}){
 const source=data.documents.find(s=>s.id===draft.parentId);
 const order=data.orders.find(o=>o.id===draft.clearanceId);
 const catalogue=draft.kind==='REQUEST'||draft.kind==='ISSUE'&&!draft.clearanceId;
 const eligible=data.products.filter(p=>p.stock_unit&&(draft.kind==='REQUEST'||data.stocks.some(s=>s.warehouse_id===draft.warehouseId&&s.product_id===p.id&&fixed(s.on_hand)>fixed(s.reserved))));
 const lines=catalogue?withProductCatalogue(draft.lines,eligible,l=>l.productId,id=>({productId:id,quantity:'',note:''})):draft.lines;
 const change=(productId:string,patch:Partial<Draft['lines'][number]>)=>onChange({...draft,lines:lines.map(l=>l.productId===productId?{...l,...patch}:l)});
 const rows=lines.map(line=>{
  const product=data.products.find(p=>p.id===line.productId),original=source?.lines.find(l=>l.productId===line.productId),ordered=order?.immutable_lines.find(l=>l.productId===line.productId);
  const stock=data.stocks.find(s=>s.warehouse_id===draft.warehouseId&&s.product_id===line.productId);
  let remaining:string|undefined;
  if(draft.kind==='DISPATCH'&&original){const used=data.documents.filter(s=>s.kind==='DISPATCH'&&s.sourceId===source?.id&&s.state==='CONFIRMED').flatMap(s=>s.lines).filter(l=>l.productId===line.productId).reduce((n,l)=>n+fixed(l.quantity),0n);remaining=fixedText(fixed(original.quantity)-used);}
  if(draft.kind==='ISSUE'&&ordered){const used=data.documents.filter(s=>s.kind==='ISSUE'&&s.sourceId===order?.id&&s.state==='CONFIRMED').flatMap(s=>s.lines).filter(l=>l.productId===line.productId).reduce((n,l)=>n+fixed(l.quantity),0n);remaining=fixedText(fixed(String(ordered.baseQuantity??ordered.quantity))-used);}
  return {...line,key:line.productId,name:original?.name??String(ordered?.name??product?.name??'Sản phẩm trong chứng từ nguồn'),sku:original?.sku??String(ordered?.sku??product?.sku??''),unit:original?.unit??String(ordered?.stockUnit??product?.stock_unit??''),selected:line.quantity.trim()!==''&&(draft.kind==='RECEIPT'||Number(line.quantity)!==0),remaining,shipped:original?.quantity,available:stock?fixedText(fixed(stock.on_hand)-fixed(stock.reserved)):'0'};
 });
 return <ProductEntryGrid rows={rows} label="Sản phẩm trong phiếu" help={draft.kind==='RECEIPT'?'Nhập thực nhận từng mặt hàng, kể cả 0. Ghi lý do khi khác số chuyển.':catalogue?'Nhập số lượng ngay trong bảng. Dòng để trống hoặc bằng 0 không đưa vào phiếu.':'Chỉ gồm hàng còn phải xử lý từ chứng từ nguồn. Để trống hoặc nhập 0 nếu chưa giao trong đợt này.'} columns={[
  ...(draft.kind==='RECEIPT'?[{key:'shipped',label:'Số chuyển',render:(row:typeof rows[number])=>row.shipped}]:[]),
  ...(['DISPATCH','ISSUE'].includes(draft.kind)&&!catalogue?[{key:'remaining',label:'Còn phải giao',render:(row:typeof rows[number])=>row.remaining}]:[]),
  ...(draft.kind==='ISSUE'?[{key:'available',label:'Khả dụng tại kho',render:(row:typeof rows[number])=>row.available}]:[]),
  {key:'quantity',label:draft.kind==='RECEIPT'?'Thực nhận':draft.kind==='DISPATCH'?'Thực gửi':draft.kind==='ISSUE'?'Thực xuất':'Số lượng đề nghị',render:row=><ProductQuantityInput aria-label={`Số lượng ${row.name}`} value={row.quantity} required={draft.kind==='RECEIPT'} max={draft.kind==='RECEIPT'?undefined:row.remaining} quick={catalogue} onChange={e=>change(row.productId,{quantity:e.target.value})}/>},
  {key:'note',label:'Ghi chú dòng',render:row=><input aria-label={`Ghi chú ${row.name}`} maxLength={500} value={row.note} onChange={e=>change(row.productId,{note:e.target.value})}/>},
 ]}/>;
}
