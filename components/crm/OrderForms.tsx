'use client';
import {useId,useState} from 'react';
import Link from 'next/link';
import {percentText} from '@/lib/crm/channel-labels';
import {Form,resolveProductImage,defaultUnitForProduct,type ProductChoice} from './CommercialForms';
import {fixed} from '@/lib/crm/decimal';
import type {Basket,PriceCalculation} from '@/lib/crm/pricing-model';
import type {CommercialRequest,RequestVersion,RequestViewVersion} from '@/lib/crm/order-requests';
import type {SalesOrder,SalesVersion} from '@/lib/crm/sales-orders';
import type {OrderPolicy,OrderPolicyDefinition} from '@/lib/crm/order-policy';
import type {ExcelRequestRow} from '@/lib/crm/request-excel';
type Choice={id:string;name:string;code?:string};
const value=(f:FormData,k:string)=>String(f.get(k)??'');
export const commercialMoney=(v:string)=>new Intl.NumberFormat('vi-VN').format(BigInt(v))+' VND';
function filterActiveRequestLines(lines:Basket['lines']){
 const filled=lines.filter(l=>l.sku.trim()!==''&&l.unitCode.trim()!==''&&l.quantity.trim()!==''&&Number(l.quantity)>0);
 return filled.length>0?filled:lines;
}
const basket=(f:FormData,lines:Basket['lines']):Basket=>({lines:filterActiveRequestLines(lines),discountBasisPoints:Number(fixed(value(f,'discount'),2)),creditTerms:f.has('creditTerms')});
function PartnerField({self,partners}:{self?:string;partners:Choice[]}){return self?<p>Đối tác: {partners.find(p=>p.id===self)?.name??'Tổ chức của bạn'}.</p>:<label>Đối tác yêu cầu<select name="organizationId" required><option value="">Chọn đối tác trong phạm vi</option>{partners.map(p=><option key={p.id} value={p.id}>{p.name} · {p.code}</option>)}</select></label>;}
function DeliveryFields({initial}:{initial?:Pick<RequestVersion['snapshot'],'delivery'|'note'>}){const delivery=initial?.delivery;return <fieldset><legend>Thông tin giao hàng</legend><div className="work-fields"><label>Người nhận hàng<input name="recipient" required minLength={2} maxLength={120} defaultValue={delivery?.recipient}/></label><label>Số điện thoại nhận hàng<input name="phone" required minLength={5} maxLength={40} defaultValue={delivery?.phone}/></label><label>Địa chỉ giao<textarea aria-label="Địa chỉ giao" name="address" required minLength={3} maxLength={500} defaultValue={delivery?.address}/></label><label>Ghi chú gửi đối tác<textarea aria-label="Ghi chú gửi đối tác" name="note" maxLength={2000} defaultValue={initial?.note}/></label></div></fieldset>;}
export function CalculationView({calculation:c,approvalNotice=true}:{calculation:PriceCalculation;approvalNotice?:boolean}){return <><div className="work-table-wrap crm-basket-sheet-wrap" tabIndex={0} aria-label="Dòng hàng và giá; cuộn ngang để xem đủ"><table className="work-table crm-basket-sheet-table"><caption>Dòng hàng và quy đổi đã tính</caption><thead><tr><th className="col-img">Hình ảnh</th><th className="col-product">Tên sản phẩm</th><th className="col-unit">Đơn vị</th><th className="col-qty">Gói (Số lượng)</th><th className="col-price">Giá gốc / giảm / thuế</th><th className="col-total">Tổng dòng</th></tr></thead><tbody>{c.lines.map((l,i)=><tr key={i}><td className="col-img"><div className="crm-basket-thumb-box"><span className="crm-basket-row-idx">#{i+1}</span><img src={resolveProductImage(l.sku)} alt={l.name} className="crm-basket-thumb" loading="lazy"/></div></td><td className="col-product"><strong>{l.name}</strong><br/><span className="crm-basket-sku-badge">{l.sku}</span>{l.gift&&<p>Hàng tặng · {l.giftRule}</p>}</td><td className="col-unit"><span className="status-badge">{l.unitLabel}</span></td><td className="col-qty"><strong>{l.quantity} {l.unitLabel}</strong><br/><small>{l.baseQuantity} {l.stockUnit}</small></td><td className="col-price">{l.listUnitPrice&&l.listUnitPrice!==l.unitPrice&&<><s>{commercialMoney(l.listUnitPrice)}</s>{l.promoPercentBp?' · KM '+percentText(l.promoPercentBp)+(l.promotionBadge?' '+l.promotionBadge:''):''}{l.accountPercentBp?' · CK '+percentText(l.accountPercentBp):''}<br/></>}{commercialMoney(l.unitPrice)} / {l.stockUnit}<br/>Giảm {commercialMoney(l.discount)}<br/>Thuế {commercialMoney(l.tax)}</td><td className="col-total"><strong>{commercialMoney(l.total)}</strong></td></tr>)}</tbody></table></div><dl className="work-facts commercial-summary">{c.channel&&<><dt>Tổng giá gốc (trước KM/CK)</dt><dd>{commercialMoney(c.channel.listSubtotal)}</dd>{c.channel.levelName&&<><dt>Hạng thành viên</dt><dd>{c.channel.levelName}</dd></>}</>}<dt>Tiền hàng trước giảm</dt><dd>{commercialMoney(c.subtotal)}</dd><dt>Giảm giá</dt><dd>{commercialMoney(c.discount)}</dd><dt>Thuế</dt><dd>{commercialMoney(c.tax)}</dd><dt>Phí</dt><dd>{commercialMoney(c.fee)}</dd><dt>Tổng thanh toán</dt><dd><strong>{commercialMoney(c.total)}</strong></dd><dt>Điều kiện giao</dt><dd>{c.deliveryTerms}</dd></dl>{c.minimumShortfalls.length>0&&<p role="status">Chưa đạt mức tối thiểu: {c.minimumShortfalls.map(s=>s.missing+' '+(s.kind==='AMOUNT'?'VND tiền hàng sau giảm':s.kind==='CASES'?'thùng nguyên':s.sku+' đơn vị gốc')).join('; ')}.</p>}{approvalNotice&&c.approvalRequired&&<p>Ngoại lệ cần được duyệt trước khi xác nhận đơn.</p>}</>;}
function FastBasket({products,lines,setLines,initial}:{products:ProductChoice[];lines:Basket['lines'];setLines:(l:Basket['lines'])=>void;initial?:Basket}){
 const options=useId();
 const [discountPct,setDiscountPct]=useState<number>((initial?.discountBasisPoints??0)/100);
 const hasValidLine=lines.some(l=>l.sku.trim()!==''&&l.unitCode.trim()!==''&&l.quantity.trim()!==''&&Number(l.quantity)>0);
 const fillCatalog=()=>{
  const existingBySku=new Map(lines.filter(l=>l.sku).map(l=>[l.sku,l]));
  const next=products.slice(0,200).map(p=>{
   const prev=existingBySku.get(p.sku);
   return prev?{...prev,unitCode:prev.unitCode||defaultUnitForProduct(p)}:{sku:p.sku,unitCode:defaultUnitForProduct(p),quantity:''};
  });
  if(next.length)setLines(next);
 };
 const compactFilled=()=>{
  const filled=lines.filter(l=>l.quantity.trim()!==''&&Number(l.quantity)>0);
  setLines(filled.length?filled:[{sku:'',unitCode:'',quantity:''}]);
 };
 let totalPackages=0;
 let estimatedGross=0;
 lines.forEach(l=>{
  const p=products.find(x=>x.sku===l.sku);
  const unit=p?.units.find(u=>u.code===l.unitCode);
  const qty=Number(l.quantity);
  if(qty>0){
   const ratio=unit&&Number(unit.denominator)>0?Number(unit.numerator)/Number(unit.denominator):1;
   const baseQty=qty*ratio;
   totalPackages+=baseQty;
   const unitPrice=Number(l.requestedUnitPrice||p?.retail_price||0);
   if(unitPrice>0)estimatedGross+=Math.round(baseQty*unitPrice);
  }
 });
 const estimatedNet=Math.round(estimatedGross*(1-Math.min(Math.max(discountPct,0),100)/100));
 return <><datalist id={options}>{products.map(p=><option key={p.id} value={p.sku}>{p.name}</option>)}</datalist>
  <fieldset className="crm-basket-sheet-fieldset">
   <legend>Nhập SKU, đơn vị và số lượng</legend>
   <div className="crm-basket-sheet-toolbar">
    <div className="crm-basket-sheet-summary">
     <span>Đã chọn: <strong>{lines.filter(l=>l.sku&&Number(l.quantity)>0).length}</strong>/{lines.length} mặt hàng</span>
     <span>· Tổng gói: <strong>{totalPackages.toLocaleString('vi-VN')}</strong> gói</span>
     {estimatedGross>0&&<span>· Tạm tính sau CK ({discountPct}%): <strong className="crm-basket-net-highlight">{estimatedNet.toLocaleString('vi-VN')} ₫</strong></span>}
    </div>
    <div className="crm-basket-sheet-actions">
     {products.length>1&&<button type="button" className="button button--secondary crm-btn-compact" onClick={fillCatalog}>⚡ Điền sẵn bảng tất cả sản phẩm (Chỉ việc gõ số gói)</button>}
     {lines.length>1&&hasValidLine&&<button type="button" className="button button--secondary crm-btn-compact" onClick={compactFilled}>Lọc giữ dòng đã nhập số gói</button>}
     <button type="button" className="button button--secondary crm-btn-compact" disabled={lines.length>=200} onClick={()=>setLines([...lines,{sku:'',unitCode:'',quantity:''}])}>Thêm hàng</button>
    </div>
   </div>
   <div className="crm-basket-sheet-wrap" role="region" aria-label="Bảng nhập sản phẩm theo hàng và cột" tabIndex={0}>
    <table className="crm-basket-sheet-table">
     <thead>
      <tr>
       <th className="col-img">1. Hình ảnh SP</th>
       <th className="col-product">2. Tên sản phẩm</th>
       <th className="col-unit">3. Đơn vị</th>
       <th className="col-qty">4. Gói (Số lượng)</th>
       <th className="col-price">Đơn giá / Giá riêng</th>
       <th className="col-total">Thành tiền tạm tính</th>
       <th className="col-action">Xóa</th>
      </tr>
     </thead>
     <tbody>
      {lines.map((l,i)=>{
       const p=products.find(x=>x.sku===l.sku);
       const rowRequired=!hasValidLine&&i===0;
       const imgSrc=l.sku?resolveProductImage(l.sku,p?.image):'';
       const activeUnits=p?.units.filter(u=>u.active)??[];
       const selectedUnit=activeUnits.find(u=>u.code===l.unitCode);
       const unitLabel=selectedUnit?.label||(p?.stock_unit||'Gói');
       const qty=Number(l.quantity);
       const ratio=selectedUnit&&Number(selectedUnit.denominator)>0?Number(selectedUnit.numerator)/Number(selectedUnit.denominator):1;
       const baseQty=qty>0?qty*ratio:0;
       const unitPrice=Number(l.requestedUnitPrice||p?.retail_price||0);
       const lineGross=baseQty>0&&unitPrice>0?Math.round(baseQty*unitPrice):0;
       const lineNet=lineGross>0?Math.round(lineGross*(1-Math.min(Math.max(discountPct,0),100)/100)):0;
       return <tr key={i} className={qty>0?'is-filled':''}>
        <td className="col-img">
         <div className="crm-basket-thumb-box">
          <span className="crm-basket-row-idx">#{i+1}</span>
          {imgSrc?<img src={imgSrc} alt={p?.name||l.sku} className="crm-basket-thumb" loading="lazy"/>:<div className="crm-basket-thumb-placeholder">SP</div>}
         </div>
        </td>
        <td className="col-product">
         <select aria-label={'Chọn tên sản phẩm '+(i+1)} className="crm-basket-product-select" value={p?p.sku:''} onChange={e=>{const sku=e.target.value,prod=products.find(x=>x.sku===sku);setLines(lines.map((r,n)=>n===i?{...r,sku,unitCode:defaultUnitForProduct(prod)}:r));}}>
          <option value="">-- Chọn nhanh theo tên sản phẩm --</option>
          {products.map(prod=><option key={prod.id} value={prod.sku}>{prod.name}{prod.weight_label?' ('+prod.weight_label+')':''}{prod.retail_price?' — '+Number(prod.retail_price).toLocaleString('vi-VN')+' ₫':''}</option>)}
         </select>
         <div className="crm-basket-sku-row">
          <input aria-label={'SKU đặt '+(i+1)} list={options} required={rowRequired} maxLength={80} placeholder="Hoặc gõ mã SKU..." className="crm-basket-sku-input" value={l.sku} onChange={e=>{const sku=e.target.value,prod=products.find(x=>x.sku===sku);setLines(lines.map((r,n)=>n===i?{...r,sku,unitCode:prod?defaultUnitForProduct(prod):''}:r));}}/>
          {p?.weight_label&&<span className="crm-basket-weight-badge">{p.weight_label}</span>}
         </div>
        </td>
        <td className="col-unit">
         <select aria-label={'Đơn vị đặt '+(i+1)} required={rowRequired} value={l.unitCode} onChange={e=>setLines(lines.map((r,n)=>n===i?{...r,unitCode:e.target.value}:r))}>
          <option value="">Chọn đơn vị</option>
          {activeUnits.map(u=><option key={u.code} value={u.code}>{u.label}</option>)}
         </select>
         {p&&<div className="crm-basket-unit-hint">Đơn vị gốc: <strong>{p.stock_unit||'Gói'}</strong></div>}
        </td>
        <td className="col-qty">
         <div className="crm-basket-qty-cell">
          <input aria-label={'Số lượng đặt '+(i+1)} required={rowRequired} inputMode="decimal" placeholder="0" className="crm-basket-qty-input" value={l.quantity} onChange={e=>setLines(lines.map((r,n)=>n===i?{...r,quantity:e.target.value}:r))} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='Enter'){if(i+1<lines.length){e.preventDefault();const nextEl=e.currentTarget.closest('tbody')?.querySelector<HTMLInputElement>(`input[aria-label="Số lượng đặt ${i+2}"]`);nextEl?.focus();nextEl?.select();}}else if(e.key==='ArrowUp'&&i>0){e.preventDefault();const prevEl=e.currentTarget.closest('tbody')?.querySelector<HTMLInputElement>(`input[aria-label="Số lượng đặt ${i}"]`);prevEl?.focus();prevEl?.select();}}}/>
          <span className="crm-basket-qty-unit">{unitLabel}</span>
         </div>
         <div className="crm-basket-qty-chips">
          {[10,20,50,100].map(step=><button key={step} type="button" tabIndex={-1} className="crm-qty-chip" onClick={()=>setLines(lines.map((r,n)=>n===i?{...r,quantity:String((Number(r.quantity)>0?Number(r.quantity):0)+step)}:r))}>+{step}</button>)}
          {qty>0&&<button type="button" tabIndex={-1} className="crm-qty-chip is-clear" onClick={()=>setLines(lines.map((r,n)=>n===i?{...r,quantity:''}:r))}>Xóa số</button>}
         </div>
        </td>
        <td className="col-price">
         {p?.retail_price&&<div className="crm-basket-ref-price">Giá bảng: <strong>{Number(p.retail_price).toLocaleString('vi-VN')} ₫</strong>/{p.stock_unit||'Gói'}</div>}
         <input aria-label={'Giá khác bảng / đơn vị gốc '+(i+1)} inputMode="numeric" maxLength={24} pattern="[0-9]+" placeholder="Bỏ trống = giá bảng" value={l.requestedUnitPrice??''} onChange={e=>setLines(lines.map((r,n)=>n===i?{...r,requestedUnitPrice:e.target.value||undefined}:r))}/>
        </td>
        <td className="col-total">
         {lineGross>0?<>
          <div className="crm-basket-line-net">{lineNet.toLocaleString('vi-VN')} ₫</div>
          {discountPct>0&&<div className="crm-basket-line-gross">Trước CK: {lineGross.toLocaleString('vi-VN')} ₫</div>}
         </>:<span className="crm-basket-line-empty">—</span>}
        </td>
        <td className="col-action">
         <button type="button" className="button button--secondary crm-btn-compact" disabled={lines.length===1} onClick={()=>setLines(lines.filter((_,n)=>n!==i))}>Bỏ hàng {i+1}</button>
        </td>
       </tr>;
      })}
     </tbody>
     {estimatedGross>0&&<tfoot>
      <tr>
       <td colSpan={3}><strong>Tổng cộng tạm tính ({lines.filter(l=>l.sku&&Number(l.quantity)>0).length} mặt hàng)</strong></td>
       <td className="col-qty"><strong>{totalPackages.toLocaleString('vi-VN')} gói</strong></td>
       <td className="col-price">Trước CK: <strong>{estimatedGross.toLocaleString('vi-VN')} ₫</strong></td>
       <td className="col-total"><strong className="crm-basket-net-highlight">{estimatedNet.toLocaleString('vi-VN')} ₫</strong></td>
       <td></td>
      </tr>
     </tfoot>}
    </table>
   </div>
  </fieldset>
  <div className="crm-basket-bottom-controls">
   <label>Chiết khấu yêu cầu (%)<input name="discount" type="number" required min={0} max={100} step="0.01" defaultValue={(initial?.discountBasisPoints??0)/100} onChange={e=>setDiscountPct(Number(e.target.value)||0)}/></label>
   <label className="work-check"><input name="creditTerms" type="checkbox" defaultChecked={initial?.creditTerms}/>Yêu cầu mua công nợ</label>
  </div>
 </>;
}
export function RequestForm({products,partners,draftOwner,self,head,latest,source,initialBasket}:{products:ProductChoice[];partners:Choice[];draftOwner:string;self?:string;head?:CommercialRequest;latest?:RequestViewVersion;initialBasket?:Basket;source?:{channel:'WEBSITE'|'QUOTATION'|'REORDER';id:string;basket?:Basket;delivery?:RequestVersion['snapshot']['delivery'];note?:string}}){const initial=latest?.snapshot,[lines,setLines]=useState<Basket['lines']>(initial?.basket.lines??initialBasket?.lines??source?.basket?.lines??[{sku:'',unitCode:'',quantity:''}]);const area=self?'portal':'crm',restore=(snapshot:unknown)=>{const value=snapshot as {lines?:Basket['lines']}|null;if(value?.lines?.length&&value.lines.length<=200&&value.lines.every(line=>typeof line.sku==='string'&&typeof line.unitCode==='string'&&typeof line.quantity==='string'))setLines(value.lines);};return <Form endpoint="/api/crm/commerce/save-request" offlineDraft={{owner:draftOwner,key:'commercial-request-'+(head?.id??source?.id??'new'),snapshot:()=>({lines}),restore}} label="Lưu bản nháp và tính giá" destination={r=>'/'+area+'/requests/'+r.id} payload={f=>{const channel=head?.channel??source?.channel??(self?'PORTAL':value(f,'channel'));return {...(head?{id:head.id}:{}),version:head?.version??0,organizationId:head?.organization_id??self??value(f,'organizationId'),channel,...(channel==='WEBSITE'?{sourceWebsiteId:head?.source_website_id??source?.id}:{}),...(channel==='QUOTATION'?{sourceQuotationId:head?.source_quotation_id??source?.id}:{}),...(channel==='REORDER'?{sourceOrderId:head?.source_order_id??source?.id}:{}),basket:basket(f,lines),delivery:{recipient:value(f,'recipient'),phone:value(f,'phone'),address:value(f,'address')},note:value(f,'note')};}}>{!head&&<PartnerField self={self} partners={partners}/>}<p>Lưu bản nháp sẽ tính giá hiện tại và ghi bản mới. Kiểm tra giá, hàng tặng, địa chỉ và mức tối thiểu trước khi đề nghị.</p>{!self&&!head&&!source&&<label>Kênh tiếp nhận<select name="channel"><option value="PHONE">Điện thoại</option><option value="VISIT">Lần thăm</option><option value="OTHER">Khác</option></select></label>}<FastBasket products={products} lines={lines} setLines={setLines} initial={initial?.basket??initialBasket??source?.basket}/><DeliveryFields initial={initial??(source?.delivery?{delivery:source.delivery,note:source.note??''} as RequestVersion['snapshot']:undefined)}/></Form>;}
const actionLabels:Record<string,string>={PROPOSE:'Đề nghị bản này',OWNER_APPROVE:'Chủ đại lý duyệt bản này',OWNER_REJECT:'Chủ đại lý từ chối bản này',APPROVE:'Duyệt ngoại lệ',REJECT:'Từ chối ngoại lệ',CONFIRM:'Xác nhận đơn bán'};
export function RequestActionForm({head,actions,submit=false,area}:{head:CommercialRequest;actions:string[];submit?:boolean;area:string}){return <Form endpoint={'/api/crm/commerce/'+(submit?'submit-request':'request-action')} label={submit?'Gửi đề nghị đến bên bán':'Xác nhận thao tác đề nghị'} destination={submit?r=>'/'+area+'/'+(area==='portal'?'orders':'sales')+'/'+r.id:undefined} payload={f=>({id:head.id,version:head.version,versionId:head.latest_version_id,...(!submit?{action:value(f,'action')}:{}),reason:value(f,'reason')})}>{!submit&&<label>Thao tác đề nghị<select aria-label="Thao tác đề nghị" name="action">{actions.map(a=><option key={a} value={a}>{actionLabels[a]}</option>)}</select></label>}<label>Lý do thao tác<textarea aria-label="Lý do thao tác" name="reason" required minLength={3} maxLength={submit?1000:2000}/></label>{submit&&<p>Gửi tạo một đơn để bên bán kiểm tra và xác nhận. Đơn này chưa xuất kho hoặc ghi công nợ.</p>}</Form>;}
export function EscalateRequestForm({requestId,area}:{requestId:string;area:string}){return <Form endpoint="/api/crm/commerce/escalate-request" label="Tạo yêu cầu mua lên cấp trên" destination={r=>'/'+area+'/requests/'+r.id} payload={f=>({requestId,reason:value(f,'reason')})}><label>Lý do chuyển lên cấp trên<textarea name="reason" required minLength={3} maxLength={1000}/></label><p>Yêu cầu mới dùng giá mua của đại lý, lưu thành nháp để kiểm tra trước khi gửi.</p></Form>;}
export function SalesActionForm({head,version,actions}:{head:SalesOrder;version:Pick<SalesVersion,'id'|'number'>;actions:string[]}){return <Form endpoint="/api/crm/commerce/order-action" label="Xác nhận thao tác đơn bán" payload={f=>({id:head.id,version:head.version,versionId:version.id,action:value(f,'action'),reason:value(f,'reason')})}><label>Thao tác đơn bán<select aria-label="Thao tác đơn bán" name="action">{actions.map(a=><option key={a} value={a}>{actionLabels[a]}</option>)}</select></label><label>Lý do thao tác đơn<textarea aria-label="Lý do thao tác đơn" name="reason" required minLength={3} maxLength={1000}/></label><p>Quyết định gắn với bản {version.number}. Trạng thái giao hàng và thanh toán được theo dõi riêng.</p></Form>;}
export function DuplicateForm({organizationId,basket:b,area}:{organizationId:string;basket:Basket;area:string}){const [rows,setRows]=useState<{id:string;code:string;total:string}[]|null>(null);return <><Form endpoint="/api/crm/commerce/duplicates" label="Kiểm tra đơn có thể trùng" payload={f=>({organizationId,basket:b,hours:Number(value(f,'hours'))})} preview={r=>setRows(Array.isArray(r.candidates)?r.candidates as typeof rows:null)}><label>Khoảng kiểm tra (giờ)<input name="hours" type="number" min={1} max={168} required defaultValue={24}/></label></Form>{rows&&<div role="status">{rows.length?<><p>Có đơn cùng đối tác và lượng hàng sau quy đổi. Kiểm tra trước khi gửi; hệ thống giữ các đơn để bạn quyết định.</p><ul>{rows.map(r=><li key={r.id}><Link href={'/'+area+'/'+(area==='portal'?'orders':'sales')+'/'+r.id}>{r.code} · {commercialMoney(r.total)}</Link></li>)}</ul></>:<p>Không thấy đơn cùng lượng hàng trong khoảng đã chọn.</p>}</div>}</>;}
export function ExcelRequestForm({partners,self}:{partners:Choice[];self?:string}){const [generation,setGeneration]=useState(0),[result,setResult]=useState<{id:string;rows:ExcelRequestRow[];calculation:PriceCalculation|null;expiresAt:string}|null>(null);return <><Link className="button button--secondary" href="/api/crm/commerce/excel-template">Tải mẫu Excel</Link><Form endpoint="/api/crm/commerce/excel-preview" label="Xem preview Excel" multipart retryScope={generation} payload={f=>({organizationId:self??value(f,'organizationId'),mapping:{sku:Number(value(f,'skuColumn')),unit:Number(value(f,'unitColumn')),quantity:Number(value(f,'quantityColumn'))},delivery:{recipient:value(f,'recipient'),phone:value(f,'phone'),address:value(f,'address')},discountBasisPoints:Number(fixed(value(f,'discount'),2)),creditTerms:f.has('creditTerms'),note:value(f,'note')})} preview={r=>setResult(typeof r.id==='string'?r as unknown as typeof result:null)}><PartnerField self={self} partners={partners}/><label>File XLSX<input name="file" type="file" accept=".xlsx" required/></label><p>Dòng 1 là tiêu đề. Tối đa 200 dòng hàng, 50 cột và 2 MB; ô công thức và liên kết được báo lỗi.</p><div className="work-fields">{[['skuColumn','Cột SKU',1],['unitColumn','Cột mã đơn vị',2],['quantityColumn','Cột số lượng',3]].map(([name,label,n])=><label key={name}>{label}<input name={String(name)} type="number" required min={1} max={50} defaultValue={n}/></label>)}</div><label>Chiết khấu yêu cầu (%)<input name="discount" type="number" min={0} max={100} step="0.01" required defaultValue={0}/></label><label className="work-check"><input name="creditTerms" type="checkbox"/>Yêu cầu mua công nợ</label><DeliveryFields/></Form>{result&&<section className="work-section" aria-live="polite"><h2>Preview {result.rows.length} dòng Excel</h2><button type="button" className="button button--secondary" onClick={()=>{setResult(null);setGeneration(n=>n+1);}}>Tạo preview mới với thông tin đang nhập</button><p>Hạn xác nhận: {new Date(result.expiresAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} (giờ Việt Nam).</p><div className="work-table-wrap" tabIndex={0} aria-label="Preview dòng Excel; có thể cuộn ngang"><table className="work-table"><caption>Kiểm tra từng dòng trước khi xác nhận</caption><thead><tr><th>Dòng Excel</th><th>SKU</th><th>Số lượng và quy đổi</th><th>Kết quả</th></tr></thead><tbody>{result.rows.map(r=><tr key={r.row}><td>{r.row}</td><td>{r.sku}</td><td>{r.quantity} {r.unitCode}<br/>{r.baseQuantity&&r.baseQuantity+' đơn vị gốc'}</td><td>{r.errors.length?r.errors.join(' '):'Hợp lệ'}</td></tr>)}</tbody></table></div>{result.calculation?<><CalculationView calculation={result.calculation}/><Form endpoint="/api/crm/commerce/excel-confirm" label="Xác nhận tạo bản nháp từ Excel" payload={()=>({id:result.id})} destination={r=>'/'+(self?'portal':'crm')+'/requests/'+r.id}><p>Tạo đầy đủ các dòng thành bản nháp. Bạn cần đề nghị và gửi riêng sau khi kiểm tra.</p><label className="work-check"><input type="checkbox" required/>Tôi đã kiểm tra các dòng, giá và địa chỉ.</label></Form></>:<p role="alert" className="work-error">Sửa toàn bộ dòng lỗi trong file, rồi tạo preview mới.</p>}</section>}</>;}
export function OrderPolicyForm({current}:{current:(OrderPolicy&{version:number})|null}){const d=current?.definition;const fields:Record<OrderPolicyDefinition['requiredPartnerFields'][number],string>={phone:'Điện thoại',email:'Email',business_id:'Mã doanh nghiệp',address:'Địa chỉ',contact_name:'Người liên hệ'};return <Form endpoint="/api/crm/commerce/save-policy" label="Lưu phiên bản quy tắc đơn hàng" payload={f=>({version:current?.version??0,definition:{enabled:f.has('enabled'),requireOwnerApproval:f.has('requireOwnerApproval'),alwaysManagerApproval:f.has('alwaysManagerApproval'),managerApprovalAmount:value(f,'managerApprovalAmount')||null,creditRequiresApproval:f.has('creditRequiresApproval'),nonSelfApproval:f.has('nonSelfApproval'),acceptedQuotePrice:value(f,'acceptedQuotePrice'),pendingPrice:'UNTIL_REQUEST_EXPIRY',requiredPartnerFields:Object.keys(fields).filter(k=>f.has('field-'+k)),approvalRoles:['ADMIN','MANAGER'].filter(k=>f.has('approval-'+k)),confirmationRoles:['ADMIN','MANAGER','SALES'].filter(k=>f.has('confirm-'+k)),provisionalReservation:{mode:value(f,'reservationMode'),ttlMinutes:Number(value(f,'reservationTtl')),allowPartial:f.has('reservationPartial')}},reason:value(f,'reason')})}><p>Kích hoạt chỉ khi Cohamy đã xác nhận quy tắc. Bản đã xác nhận giữ giá đến hạn ghi trong bản đó; yêu cầu chưa gửi được kiểm tra lại theo giá hiện tại.</p>{[['enabled','Kích hoạt tiếp nhận và xác nhận đơn',false],['requireOwnerApproval','Chủ đại lý phải duyệt đề nghị của nhân viên',true],['alwaysManagerApproval','Mọi đơn cần duyệt ngoại lệ',false],['creditRequiresApproval','Mua công nợ cần duyệt',true],['nonSelfApproval','Người lập không tự duyệt ngoại lệ',true]].map(([k,label,fallback])=><label className="work-check" key={String(k)}><input name={String(k)} type="checkbox" defaultChecked={d?Boolean(d[k as keyof OrderPolicyDefinition]):Boolean(fallback)}/>{label}</label>)}<div className="work-fields"><label>Ngưỡng tổng tiền cần duyệt (VND)<input name="managerApprovalAmount" inputMode="numeric" pattern="[0-9]+" maxLength={24} defaultValue={d?.managerApprovalAmount??''}/><small>Bỏ trống nếu không đặt ngưỡng theo tổng tiền.</small></label><label>Giá báo giá đã chấp nhận<select name="acceptedQuotePrice" defaultValue={d?.acceptedQuotePrice??'UNTIL_QUOTE_EXPIRY'}><option value="UNTIL_QUOTE_EXPIRY">Giữ đến hạn báo giá</option><option value="REPRICE">Tính lại khi lập đề nghị</option></select></label></div><fieldset><legend>Giữ hàng khi gửi chính thức</legend><label>Thời điểm giữ hàng<select name="reservationMode" defaultValue={d?.provisionalReservation?.mode??'ON_SUBMIT'}><option value="ON_SUBMIT">Giữ tạm khi gửi chính thức</option><option value="AFTER_APPROVAL">Kho giữ sau khi xác nhận</option></select></label><label>Thời hạn giữ tạm (phút)<input name="reservationTtl" type="number" required min={1} max={10080} defaultValue={d?.provisionalReservation?.ttlMinutes??120}/></label><label className="work-check"><input name="reservationPartial" type="checkbox" defaultChecked={d?.provisionalReservation?.allowPartial??true}/>Cho phép giữ một phần và báo rõ lượng thiếu</label></fieldset><fieldset><legend>Hồ sơ đối tác bắt buộc</legend>{Object.entries(fields).map(([k,label])=><label className="work-check" key={k}><input name={'field-'+k} type="checkbox" defaultChecked={d?.requiredPartnerFields.includes(k as keyof typeof fields)}/>{label}</label>)}</fieldset><fieldset><legend>Vai trò được duyệt ngoại lệ</legend>{[['ADMIN','Quản trị'],['MANAGER','Quản lý']].map(([k,label])=><label className="work-check" key={k}><input name={'approval-'+k} type="checkbox" defaultChecked={d?d.approvalRoles.includes(k as 'ADMIN'|'MANAGER'):true}/>{label}</label>)}</fieldset><fieldset><legend>Vai trò được xác nhận đơn</legend>{[['ADMIN','Quản trị'],['MANAGER','Quản lý'],['SALES','Kinh doanh']].map(([k,label])=><label className="work-check" key={k}><input name={'confirm-'+k} type="checkbox" defaultChecked={d?d.confirmationRoles.includes(k as 'ADMIN'|'MANAGER'|'SALES'):true}/>{label}</label>)}</fieldset><label>Lý do lưu quy tắc<textarea aria-label="Lý do lưu quy tắc" name="reason" required minLength={3} maxLength={1000}/></label><label className="work-check"><input type="checkbox" required/>Tôi đã xác nhận quy tắc này với Cohamy.</label></Form>;}
