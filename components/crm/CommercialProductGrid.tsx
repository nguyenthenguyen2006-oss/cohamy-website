'use client';

import {useEffect,useRef,useState} from 'react';
import type {OrderInvoicePayload} from '@/lib/crm/order-invoice-model';
import {fixed} from '@/lib/crm/decimal';
import {estimateOrderBasket} from '@/lib/crm/order-basket-estimate';
import {formatInvoiceMoney} from '@/lib/crm/order-invoice-pricing';
import type {Basket} from '@/lib/crm/pricing-model';
import {defaultUnitForProduct,type ProductChoice} from './CommercialForms';
import {ProductEntryGrid,ProductQuantityInput} from './ProductEntryGrid';

export function commercialCatalogueLines(products:ProductChoice[],lines:Basket['lines']):Basket['lines']{
 const selected=lines.filter(l=>l.sku),used=new Set(selected.map(l=>l.sku));
 return [...selected,...products.filter(p=>!used.has(p.sku)).map(p=>({sku:p.sku,unitCode:defaultUnitForProduct(p),quantity:''}))];
}

export function CommercialProductGrid({products,lines,setLines,discountPercent=0,organizationId}:{products:ProductChoice[];lines:Basket['lines'];setLines:(lines:Basket['lines'])=>void;discountPercent?:number|string;organizationId?:string}){
 const wrap=useRef<HTMLDivElement>(null),[formOrg,setFormOrg]=useState(''),[credit,setCredit]=useState(false),[server,setServer]=useState<{key:string;payload:OrderInvoicePayload}|null>(null);
 useEffect(()=>{const form=wrap.current?.closest('form');if(!form)return;const read=()=>{const f=new FormData(form);setFormOrg(String(f.get('organizationId')??''));setCredit(f.get('creditTerms')==='on');};read();form.addEventListener('change',read);return()=>form.removeEventListener('change',read);},[]);
 const all=commercialCatalogueLines(products,lines);
 let requestKey='';try{const chosen=all.filter(l=>l.sku&&l.quantity&&fixed(l.quantity)>0n),org=organizationId||formOrg,bp=fixed(String(discountPercent||'0'),2);if(org&&chosen.length&&bp>=0n&&bp<=10000n)requestKey=JSON.stringify({organizationId:org,basket:{lines:chosen,discountBasisPoints:Number(bp),creditTerms:credit},delivery:{recipient:'',phone:'',address:''},note:''});}catch{}
 useEffect(()=>{if(!requestKey)return;const controller=new AbortController(),timer=setTimeout(()=>{fetch('/api/crm/commerce/invoice-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:requestKey,signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('PRICE_PREVIEW_UNAVAILABLE');const payload=await r.json();if(!controller.signal.aborted)setServer({key:requestKey,payload});}).catch(()=>{if(!controller.signal.aborted)setServer(null);});},350);return()=>{clearTimeout(timer);controller.abort();};},[requestKey]);
 const authoritative=server?.key===requestKey?server.payload:null;
 const change=(index:number,patch:Partial<Basket['lines'][number]>)=>setLines(all.map((l,i)=>i===index?{...l,...patch}:l));
 const estimate=estimateOrderBasket(products,all,discountPercent);
 const rows=all.map((line,i)=>{
  const p=products.find(p=>p.sku===line.sku),units=p?.units.filter(u=>u.active)??[];
  const selectedIndex=all.slice(0,i).filter(l=>l.quantity&&Number(l.quantity)>0).length;
  const total=Number(line.quantity)>0?(authoritative?.lines[selectedIndex]?.lineTotal??estimate?.lines[selectedIndex]?.net):undefined;
  return {...line,key:`${line.sku}:${i}`,name:p?.name??'Sản phẩm đã lưu (cần kiểm tra danh mục)',image:p?.image,unit:p?.stock_unit,detail:p?.weight_label,selected:Number(line.quantity)>0,units,total,product:p};
 });
 const total=authoritative?.summary.totalPayable??estimate?.total??'0';
 return <div ref={wrap}><ProductEntryGrid rows={rows} label="Sản phẩm, đơn vị và số lượng" help="Danh mục đã điền sẵn. Nhập số lượng cho các hàng cần đặt; dòng trống hoặc bằng 0 không đưa vào phiếu. Giá và quy đổi được kiểm tra lại khi xem trước." columns={[
  {key:'unit',label:'Đơn vị đặt',render:(row,i)=><select aria-label={`Đơn vị ${row.name}`} value={row.unitCode} onChange={e=>change(i,{unitCode:e.target.value})}><option value="">Chọn đơn vị</option>{row.units.map(u=><option key={u.code} value={u.code}>{u.label}</option>)}</select>},
  {key:'quantity',label:'Số lượng',render:(row,i)=><ProductQuantityInput aria-label={`Số lượng ${row.name}`} value={row.quantity} quick step={row.units.find(u=>u.code===row.unitCode)?.allow_fractional?'0.000001':'1'} onChange={e=>change(i,{quantity:e.target.value})}/>},
  {key:'price',label:'Đơn giá / đơn vị gốc',render:(row,i)=><>{row.product?.retail_price&&<small>Giá bảng: {formatInvoiceMoney(row.product.retail_price)} ₫/{row.unit}</small>}<input aria-label={`Giá riêng ${row.name}`} inputMode="numeric" pattern="[0-9]+" maxLength={24} placeholder="Để trống = giá bảng" value={row.requestedUnitPrice??''} onChange={e=>change(i,{requestedUnitPrice:e.target.value||undefined})}/></>},
  {key:'total',label:'Tạm tính sau chiết khấu',render:row=>row.total!==undefined?`${formatInvoiceMoney(row.total)} ₫`:'—'},
 ]}/>{BigInt(total)>0n&&<p className="work-note">Tổng tạm tính sau chiết khấu: <strong>{formatInvoiceMoney(total)} ₫</strong>. {authoritative?'Giá đã được backend tính; tổng gồm thuế/phí nếu có.':'Đang tạm tính theo danh mục; xem trước để xác nhận giá và ưu đãi.'}</p>}</div>;
}
