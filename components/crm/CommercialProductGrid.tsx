'use client';

import type {Basket} from '@/lib/crm/pricing-model';
import {defaultUnitForProduct,type ProductChoice} from './CommercialForms';
import {ProductEntryGrid,ProductQuantityInput} from './ProductEntryGrid';

export function commercialCatalogueLines(products:ProductChoice[],lines:Basket['lines']):Basket['lines']{
 const selected=lines.filter(l=>l.sku),used=new Set(selected.map(l=>l.sku));
 return [...selected,...products.filter(p=>!used.has(p.sku)).map(p=>({sku:p.sku,unitCode:defaultUnitForProduct(p),quantity:''}))];
}

export function CommercialProductGrid({products,lines,setLines,discountPercent=0}:{products:ProductChoice[];lines:Basket['lines'];setLines:(lines:Basket['lines'])=>void;discountPercent?:number}){
 const all=commercialCatalogueLines(products,lines);
 const change=(index:number,patch:Partial<Basket['lines'][number]>)=>setLines(all.map((l,i)=>i===index?{...l,...patch}:l));
 const rows=all.map((line,i)=>{
  const p=products.find(p=>p.sku===line.sku),units=p?.units.filter(u=>u.active)??[],unit=units.find(u=>u.code===line.unitCode);
  const base=Number(line.quantity)>0?Number(line.quantity)*(unit?Number(unit.numerator)/Number(unit.denominator):1):0;
  const total=Math.round(base*Number(line.requestedUnitPrice||p?.retail_price||0)*(1-Math.min(100,Math.max(0,discountPercent))/100));
  return {...line,key:`${line.sku}:${i}`,name:p?.name??'Sản phẩm đã lưu (cần kiểm tra danh mục)',image:p?.image,unit:p?.stock_unit,detail:p?.weight_label,selected:Number(line.quantity)>0,units,total,product:p};
 });
 const total=rows.reduce((n,r)=>n+r.total,0);
 return <><ProductEntryGrid rows={rows} label="Sản phẩm, đơn vị và số lượng" help="Danh mục đã điền sẵn. Nhập số lượng cho các hàng cần đặt; dòng trống hoặc bằng 0 không đưa vào phiếu. Giá và quy đổi được kiểm tra lại khi xem trước." columns={[
  {key:'unit',label:'Đơn vị đặt',render:(row,i)=><select aria-label={`Đơn vị ${row.name}`} value={row.unitCode} onChange={e=>change(i,{unitCode:e.target.value})}><option value="">Chọn đơn vị</option>{row.units.map(u=><option key={u.code} value={u.code}>{u.label}</option>)}</select>},
  {key:'quantity',label:'Số lượng',render:(row,i)=><ProductQuantityInput aria-label={`Số lượng ${row.name}`} value={row.quantity} quick step={row.units.find(u=>u.code===row.unitCode)?.allow_fractional?'0.000001':'1'} onChange={e=>change(i,{quantity:e.target.value})}/>},
  {key:'price',label:'Đơn giá / đơn vị gốc',render:(row,i)=><>{row.product?.retail_price&&<small>Giá bảng: {Number(row.product.retail_price).toLocaleString('vi-VN')} ₫/{row.unit}</small>}<input aria-label={`Giá riêng ${row.name}`} inputMode="numeric" pattern="[0-9]+" maxLength={24} placeholder="Để trống = giá bảng" value={row.requestedUnitPrice??''} onChange={e=>change(i,{requestedUnitPrice:e.target.value||undefined})}/></>},
  {key:'total',label:'Tạm tính sau chiết khấu',render:row=>row.total>0?`${row.total.toLocaleString('vi-VN')} ₫`:'—'},
 ]}/>{total>0&&<p className="work-note">Tổng tạm tính sau chiết khấu: <strong>{total.toLocaleString('vi-VN')} ₫</strong>. Số chính thức hiển thị ở bước xem trước.</p>}</>;
}
