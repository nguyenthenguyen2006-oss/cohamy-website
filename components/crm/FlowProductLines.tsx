'use client';

import type {flowWorkspace} from '@/lib/crm/document-flow';
import type {Draft} from './DocumentFlowWorkspace';
import {fixed,fixedText,lineAmount,roundRatio} from '@/lib/crm/decimal';
import {ProductEntryGrid,ProductQuantityInput} from './ProductEntryGrid';
import {withProductCatalogue,enteredProductLines} from '@/lib/crm/product-entry';
import {calculateHandoverSaleLine,calculateHandoverSaleTotals} from '@/lib/crm/handover-sale-pricing';

type Data=Awaited<ReturnType<typeof flowWorkspace>>;
export const flowMoney=(value:string|undefined)=>value===undefined||!/^\d+$/u.test(value)?'—':BigInt(value).toLocaleString('vi-VN')+' đ';
export const manualSale=(draft:Draft)=>draft.kind==='ISSUE'&&!draft.clearanceId&&draft.issuePurpose==='SALE';
const calculationErrors:Record<string,string>={INVALID_DISCOUNT_PERCENT:'Chiết khấu phải từ 0 đến 100%, tối đa 4 chữ số thập phân.',INVALID_VAT_RATE:'Sản phẩm có VAT không hợp lệ. Cần kiểm tra danh mục.',INVALID_SALE_QUANTITY:'Nhập số lượng dương hợp lệ cho sản phẩm.',INVALID_MONEY:'Giá bán hoặc phí vận chuyển không hợp lệ.',MONEY_LIMIT:'Số tiền vượt giới hạn cho phép.'};
export function draftSaleCalculation(data:Data,draft:Draft){
 if(!manualSale(draft))return {totals:null,error:''};
 try{
  const lines=enteredProductLines(draft.lines).map(line=>{
   const product=data.products.find(p=>p.id===line.productId);
   const listUnitPrice=line.listUnitPrice??product?.retailPrice;
   if(listUnitPrice===undefined||listUnitPrice===null)throw Error('INVALID_MONEY');
   return calculateHandoverSaleLine({listUnitPrice,quantity:line.quantity,discountPercent:line.discountPercent||'0',vatRate:line.catalogVatRate??product?.vatRate??'0',includeVat:draft.includeVat??false});
  });
  return {totals:calculateHandoverSaleTotals(lines,draft.shippingFee||'0'),error:''};
 }catch(error){const key=error instanceof Error?error.message:'';return {totals:null,error:calculationErrors[key]??'Kiểm tra lại số lượng, chiết khấu và giá bán của các dòng đã nhập.'};}
}

export function FlowProductLines({data,draft,onChange}:{data:Data;draft:Draft;onChange:(draft:Draft)=>void}){
 const source=data.documents.find(s=>s.id===draft.parentId);
 const order=data.orders.find(o=>o.id===draft.clearanceId);
 const catalogue=draft.kind==='REQUEST'||draft.kind==='ISSUE'&&!draft.clearanceId;
 const sale=manualSale(draft),priced=sale||draft.kind==='ISSUE'&&Boolean(order);
 const eligible=data.products.filter(p=>p.stock_unit&&(draft.kind==='REQUEST'||data.stocks.some(s=>s.warehouse_id===draft.warehouseId&&s.product_id===p.id&&fixed(s.on_hand)>fixed(s.reserved))));
 const lines=catalogue?withProductCatalogue(draft.lines,eligible,l=>l.productId,id=>({productId:id,quantity:'',note:'',...(sale?{discountPercent:'0'}:{})})):draft.lines;
 const change=(productId:string,patch:Partial<Draft['lines'][number]>)=>onChange({...draft,lines:lines.map(l=>l.productId===productId?{...l,...patch}:l)});
 const rows=lines.map(line=>{
  const product=data.products.find(p=>p.id===line.productId),original=source?.lines.find(l=>l.productId===line.productId),ordered=order?.immutable_lines.find(l=>l.productId===line.productId);
  const stock=data.stocks.find(s=>s.warehouse_id===draft.warehouseId&&s.product_id===line.productId);
  let remaining:string|undefined;
  if(draft.kind==='DISPATCH'&&original){const used=data.documents.filter(s=>s.kind==='DISPATCH'&&s.sourceId===source?.id&&s.state==='CONFIRMED').flatMap(s=>s.lines).filter(l=>l.productId===line.productId).reduce((n,l)=>n+fixed(l.quantity),0n);remaining=fixedText(fixed(original.quantity)-used);}
  if(draft.kind==='ISSUE'&&ordered){const used=data.documents.filter(s=>s.kind==='ISSUE'&&s.sourceId===order?.id&&s.state==='CONFIRMED').flatMap(s=>s.lines).filter(l=>l.productId===line.productId).reduce((n,l)=>n+fixed(l.quantity),0n);remaining=fixedText(fixed(String(ordered.baseQuantity??ordered.quantity))-used);}
  let financial:{listUnitPrice?:string;unitPrice?:string;amount?:string}={};
  try{
   if(sale){
    const listUnitPrice=line.listUnitPrice??product?.retailPrice;
    if(listUnitPrice!==undefined&&listUnitPrice!==null){const selected=line.quantity.trim()!==''&&Number(line.quantity)!==0;const calculated=calculateHandoverSaleLine({listUnitPrice,quantity:selected?line.quantity:'1',discountPercent:line.discountPercent||'0',vatRate:line.catalogVatRate??product?.vatRate??'0',includeVat:draft.includeVat??false});financial={listUnitPrice,unitPrice:calculated.unitPrice,amount:selected?calculated.amount:undefined};}
   }else if(ordered){
    const unitPrice=String(ordered.netUnitPrice??ordered.listUnitPrice??''),quantity=String(ordered.baseQuantity??ordered.quantity??'0');
    const amount=line.quantity&&fixed(line.quantity)>0n&&unitPrice!==''?(ordered.netLineTotal!==undefined?roundRatio(BigInt(String(ordered.netLineTotal))*fixed(line.quantity),fixed(quantity),'HALF_UP').toString():lineAmount(unitPrice,line.quantity,'HALF_UP')):undefined;
    financial={listUnitPrice:ordered.listUnitPrice===undefined?undefined:String(ordered.listUnitPrice),unitPrice,amount};
   }
  }catch{financial={listUnitPrice:line.listUnitPrice??product?.retailPrice??undefined};}
  const discountPercent=sale?line.discountPercent??'0':ordered?.discountPercent===undefined?line.discountPercent:String(ordered.discountPercent);
  return {...line,...financial,discountPercent,key:line.productId,name:original?.name??String(ordered?.name??product?.name??'Sản phẩm trong chứng từ nguồn'),sku:original?.sku??String(ordered?.sku??product?.sku??''),unit:original?.unit??String(ordered?.stockUnit??product?.stock_unit??''),selected:line.quantity.trim()!==''&&(draft.kind==='RECEIPT'||Number(line.quantity)!==0),remaining,shipped:original?.quantity,available:stock?fixedText(fixed(stock.on_hand)-fixed(stock.reserved)):'0'};
 });
 return <div className={priced?'crm-flow-priced-lines':undefined}><ProductEntryGrid rows={rows} label="Sản phẩm trong phiếu" help={sale?'Giá gốc lấy từ bảng giá bán. Mỗi dòng có chiết khấu riêng; để trống CK là 0%. Chỉ các dòng có số lượng mới được đưa vào phiếu.':draft.kind==='RECEIPT'?'Nhập thực nhận từng mặt hàng, kể cả 0. Ghi lý do khi khác số chuyển.':catalogue?'Nhập số lượng ngay trong bảng. Dòng để trống hoặc bằng 0 không đưa vào phiếu.':'Chỉ gồm hàng còn phải xử lý từ chứng từ nguồn. Giá và chiết khấu giữ theo đơn đã chốt.'} columns={[
  ...(draft.kind==='RECEIPT'?[{key:'shipped',label:'Số chuyển',render:(row:typeof rows[number])=>row.shipped}]:[]),
  ...(['DISPATCH','ISSUE'].includes(draft.kind)&&!catalogue?[{key:'remaining',label:'Còn phải giao',render:(row:typeof rows[number])=>row.remaining}]:[]),
  ...(draft.kind==='ISSUE'?[{key:'available',label:'Khả dụng tại kho',render:(row:typeof rows[number])=>row.available}]:[]),
  {key:'quantity',label:draft.kind==='RECEIPT'?'Thực nhận':draft.kind==='DISPATCH'?'Thực gửi':draft.kind==='ISSUE'?'Thực xuất':'Số lượng đề nghị',render:row=><ProductQuantityInput aria-label={`Số lượng ${row.name}`} value={row.quantity} required={draft.kind==='RECEIPT'} step={sale?'0.01':undefined} max={draft.kind==='RECEIPT'?undefined:row.remaining} quick={catalogue} onChange={e=>change(row.productId,{quantity:e.target.value})}/>},
  ...(priced?[
   {key:'listUnitPrice',label:'Đơn giá gốc',render:(row:typeof rows[number])=><output aria-label={`Đơn giá gốc ${row.name}`}>{flowMoney(row.listUnitPrice)}</output>},
   {key:'discountPercent',label:'Chiết khấu (%)',render:(row:typeof rows[number])=>sale?<input aria-label={`Chiết khấu (%) ${row.name}`} type="number" inputMode="decimal" min="0" max="100" step="any" value={row.discountPercent??'0'} onChange={e=>change(row.productId,{discountPercent:e.target.value})}/>:<output>{row.discountPercent===undefined?'—':row.discountPercent+'%'}</output>},
   {key:'unitPrice',label:'Đơn giá sau CK',render:(row:typeof rows[number])=><output aria-label={`Đơn giá sau CK ${row.name}`}>{flowMoney(row.unitPrice)}</output>},
   {key:'amount',label:'Thành tiền',render:(row:typeof rows[number])=><output aria-label={`Thành tiền ${row.name}`}>{flowMoney(row.amount)}</output>},
  ]:[]),
  {key:'note',label:'Ghi chú dòng',render:row=><input aria-label={`Ghi chú ${row.name}`} maxLength={500} value={row.note} onChange={e=>change(row.productId,{note:e.target.value})}/>},
 ]}/></div>;
}
