'use client';

import {useEffect,useRef,useState} from 'react';
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
 const [extraProductId,setExtraProductId]=useState('');
 const [addedExtra,setAddedExtra]=useState<{productId:string;revision:number}|null>(null);
 const gridRoot=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!addedExtra)return;
  const input=gridRoot.current?.querySelector<HTMLInputElement>(`input[data-flow-line-product="${CSS.escape(addedExtra.productId)}"]`);
  input?.focus();
 },[addedExtra]);
 const source=data.documents.find(s=>s.id===draft.parentId);
 const order=data.orders.find(o=>o.id===draft.clearanceId);
 const catalogue=draft.kind==='REQUEST'||draft.kind==='ISSUE'&&!draft.clearanceId;
 const sale=manualSale(draft),priced=sale||draft.kind==='ISSUE'&&Boolean(order);
 const eligible=data.products.filter(p=>p.stock_unit&&(draft.kind==='REQUEST'||data.stocks.some(s=>s.warehouse_id===draft.warehouseId&&s.product_id===p.id&&fixed(s.on_hand)>fixed(s.reserved))));
 const lines=catalogue?withProductCatalogue(draft.lines,eligible,l=>l.productId,id=>({productId:id,quantity:'',note:'',...(sale?{discountPercent:'0'}:{})})):draft.lines;
 const change=(productId:string,patch:Partial<Draft['lines'][number]>)=>onChange({...draft,lines:lines.map(l=>l.productId===productId?{...l,...patch}:l)});
 const dispatch=draft.kind==='DISPATCH';
 const receipt=draft.kind==='RECEIPT';
 const showCost=dispatch||receipt;
 const excludedProducts=new Set([...draft.lines,...(source?.lines??[])].map(line=>line.productId));
 const extraProducts=dispatch&&source?data.products.filter(p=>p.stock_unit?.trim()&&!excludedProducts.has(p.id)).sort((a,b)=>a.name.localeCompare(b.name,'vi')):[];
 const selectedExtra=extraProducts.find(product=>product.id===extraProductId);
 const addExtra=()=>{
  if(!selectedExtra||draft.lines.length>=300)return;
  onChange({...draft,lines:[...draft.lines,{productId:selectedExtra.id,quantity:'',note:'',extra:true}]});
  setExtraProductId('');
  setAddedExtra({productId:selectedExtra.id,revision:(addedExtra?.revision??0)+1});
 };
 const removeExtra=(productId:string)=>onChange({...draft,lines:draft.lines.filter(line=>line.productId!==productId)});
 const rows=lines.map(line=>{
  const product=data.products.find(p=>p.id===line.productId),original=source?.lines.find(l=>l.productId===line.productId),ordered=order?.immutable_lines.find(l=>l.productId===line.productId);
  const stock=data.stocks.find(s=>s.warehouse_id===draft.warehouseId&&s.product_id===line.productId);
  const extra=line.extra===true||original?.extra===true;
  let remaining:string|undefined;
  if(dispatch&&original){const used=data.documents.filter(s=>s.kind==='DISPATCH'&&s.sourceId===source?.id&&s.state==='CONFIRMED').flatMap(s=>s.lines).filter(l=>!l.extra&&l.productId===line.productId).reduce((n,l)=>n+fixed(l.quantity),0n);remaining=fixedText(fixed(original.quantity)-used);}
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
  const name=original?.name??String(ordered?.name??product?.name??'Sản phẩm trong chứng từ nguồn');
  const unit=original?.unit??String(ordered?.stockUnit??product?.stock_unit??'');
  let costUnitPrice:string|null=null;
  let costAmount:string|undefined;
  if(showCost){
   const sourceCost=receipt?original?.costUnitPrice:undefined;
   const currentCost=product?.stock_unit===unit?product?.costUnitPrice??null:null;
   costUnitPrice=sourceCost!==undefined?sourceCost:line.costUnitPrice!==undefined?line.costUnitPrice:currentCost;
   if(line.quantity.trim()!==''){
    try{
     if(fixed(line.quantity)===0n)costAmount='0';
     else if(costUnitPrice!==null)costAmount=lineAmount(costUnitPrice,line.quantity,'HALF_UP');
    }catch{/* The amount is unavailable while the quantity is invalid. */}
   }
  }
  return {...line,...financial,discountPercent,key:line.productId,name,extra,detail:extra?<span className="crm-flow-extra-row"><span>Gửi bổ sung</span>{dispatch&&<button type="button" className="button button--secondary" aria-label={`Bỏ ${name} khỏi phiếu`} onClick={()=>removeExtra(line.productId)}>Bỏ khỏi phiếu</button>}</span>:undefined,sku:original?.sku??String(ordered?.sku??product?.sku??''),unit,selected:line.quantity.trim()!==''&&(receipt||Number(line.quantity)!==0),remaining,shipped:original?.quantity,available:stock?fixedText(fixed(stock.on_hand)-fixed(stock.reserved)):'0',costUnitPrice,costAmount};
 });
 return <div className={priced?'crm-flow-priced-lines':undefined} ref={gridRoot}>
  {dispatch&&<div className="work-actions crm-flow-extra-picker">
   <label>Chọn sản phẩm bổ sung
    <select aria-label="Chọn sản phẩm bổ sung" value={selectedExtra?.id??''} disabled={!extraProducts.length||draft.lines.length>=300} onChange={e=>setExtraProductId(e.target.value)}>
     <option value="">{draft.lines.length>=300?'Phiếu đã đủ 300 dòng':!source?'Chưa tải được phiếu đề nghị':extraProducts.length?'Chọn theo tên sản phẩm':'Không còn sản phẩm để thêm'}</option>
     {extraProducts.map(product=><option key={product.id} value={product.id}>{product.name} · {product.stock_unit}</option>)}
    </select>
   </label>
   <button className="button button--secondary" type="button" disabled={!selectedExtra||draft.lines.length>=300} onClick={addExtra}>Thêm sản phẩm</button>
  </div>}
  <ProductEntryGrid key={addedExtra?.revision??0} rows={rows} label="Sản phẩm trong phiếu" help={sale?'Giá gốc lấy từ bảng giá bán. Mỗi dòng có chiết khấu riêng; để trống CK là 0%. Chỉ các dòng có số lượng mới được đưa vào phiếu.':draft.kind==='RECEIPT'?'Nhập thực nhận từng mặt hàng, kể cả 0. Ghi lý do khi khác số chuyển.':dispatch?'Nhập số thực gửi. Hàng bổ sung được ghi riêng trên phiếu chuyển.':catalogue?'Nhập số lượng ngay trong bảng. Dòng để trống hoặc bằng 0 không đưa vào phiếu.':'Chỉ gồm hàng còn phải xử lý từ chứng từ nguồn. Giá và chiết khấu giữ theo đơn đã chốt.'} columns={[
  ...(draft.kind==='RECEIPT'?[{key:'shipped',label:'Số chuyển',render:(row:typeof rows[number])=>row.shipped}]:[]),
  ...(['DISPATCH','ISSUE'].includes(draft.kind)&&!catalogue?[{key:'remaining',label:'Còn phải giao',render:(row:typeof rows[number])=>row.extra?'—':row.remaining}]:[]),
  ...(draft.kind==='ISSUE'?[{key:'available',label:'Khả dụng tại kho',render:(row:typeof rows[number])=>row.available}]:[]),
  {key:'quantity',label:draft.kind==='RECEIPT'?'Thực nhận':draft.kind==='DISPATCH'?'Thực gửi':draft.kind==='ISSUE'?'Thực xuất':'Số lượng đề nghị',render:row=><ProductQuantityInput aria-label={`Số lượng ${row.name}`} data-flow-line-product={dispatch?row.productId:undefined} value={row.quantity} required={draft.kind==='RECEIPT'} step={sale?'0.01':undefined} max={draft.kind==='RECEIPT'?undefined:row.remaining} quick={catalogue} onChange={e=>change(row.productId,{quantity:e.target.value})}/>},
  ...(showCost?[
   {key:'costUnitPrice',label:'Giá vốn / ĐVT',render:(row:typeof rows[number])=><span className="crm-flow-cost-number">{row.costUnitPrice===null?'Chưa có giá vốn':flowMoney(row.costUnitPrice)}</span>},
   {key:'costAmount',label:'Thành tiền vốn',render:(row:typeof rows[number])=><output className="crm-flow-cost-number" aria-label={`Thành tiền vốn ${row.name}`}>{flowMoney(row.costAmount)}</output>},
  ]:[]),
  ...(priced?[
   {key:'listUnitPrice',label:'Đơn giá gốc',render:(row:typeof rows[number])=><output aria-label={`Đơn giá gốc ${row.name}`}>{flowMoney(row.listUnitPrice)}</output>},
   {key:'discountPercent',label:'Chiết khấu (%)',render:(row:typeof rows[number])=>sale?<input aria-label={`Chiết khấu (%) ${row.name}`} type="number" inputMode="decimal" min="0" max="100" step="any" value={row.discountPercent??'0'} onChange={e=>change(row.productId,{discountPercent:e.target.value})}/>:<output>{row.discountPercent===undefined?'—':row.discountPercent+'%'}</output>},
   {key:'unitPrice',label:'Đơn giá sau CK',render:(row:typeof rows[number])=><output aria-label={`Đơn giá sau CK ${row.name}`}>{flowMoney(row.unitPrice)}</output>},
   {key:'amount',label:'Thành tiền',render:(row:typeof rows[number])=><output aria-label={`Thành tiền ${row.name}`}>{flowMoney(row.amount)}</output>},
  ]:[]),
  {key:'note',label:'Ghi chú dòng',render:row=><input aria-label={`Ghi chú ${row.name}`} maxLength={500} value={row.note} onChange={e=>change(row.productId,{note:e.target.value})}/>},
 ]}/></div>;
}
