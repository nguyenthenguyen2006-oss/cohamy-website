'use client';

import {useRef, useState} from 'react';
import {productArrivals} from '@/data/product-arrivals';
import {STORE_POLICIES} from '@/data/store-policies';
import {calculateStorefrontPrice, type PublicStorefront} from '@/lib/storefront-pricing';
import './storefront-settings.css';

const money = (value:number) => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(value);
const labels:Record<string,string> = {
  VERSION_CONFLICT: 'Cấu hình đã được thay đổi. Tải lại rồi kiểm tra mức giảm trước khi lưu.',
  FORBIDDEN: 'Chỉ Admin được thay đổi giá bán website.',
  INVALID_FIELDS: 'Nhập phần trăm giảm là số nguyên từ 0 đến 99.',
  IDEMPOTENCY_CONFLICT: 'Lần lưu này có dữ liệu khác. Tải lại cấu hình trước khi thử lại.'
};

export function StorefrontSettings({initial}:{initial:PublicStorefront}) {
  const [state,setState]=useState(initial),[percent,setPercent]=useState(String(initial.discountPercent));
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const intent=useRef<{signature:string;key:string}|null>(null);
  const parsed=Number(percent),valid=percent.trim()!==''&&Number.isInteger(parsed)&&parsed>=0&&parsed<=99;
  async function reload() {
    const response=await fetch('/api/crm/storefront',{cache:'no-store'});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error??'LOAD_FAILED');
    setState(result);setPercent(String(result.discountPercent));intent.current=null;
  }
  return <div className="storefront-admin">
    <header className="work-section"><h1>Giá bán website</h1><p>Giá niêm yết lấy từ danh mục Hàng hóa trong CRM. Mức giảm dưới đây áp dụng cho khách mua trên website.</p></header>
    <section className="work-section">
      <form onSubmit={async event=>{
        event.preventDefault();if(busy||!valid)return;setBusy(true);setError('');setMessage('');
        const signature=JSON.stringify([state.version,parsed]);
        if(intent.current?.signature!==signature)intent.current={signature,key:crypto.randomUUID()};
        try {
          const response=await fetch('/api/crm/storefront',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:state.version,discountPercent:parsed,idempotencyKey:intent.current.key})});
          const result=await response.json();if(!response.ok)throw new Error(result.error??'SAVE_FAILED');
          setMessage(`Đã lưu mức giảm ${result.discountPercent}% cho website.`);
          try{await reload();}catch{setError('Đã lưu, nhưng chưa tải được giá mới. Bấm Tải lại cấu hình để kiểm tra.');}
        } catch(failure) {setError(labels[failure instanceof Error?failure.message:'']??'Chưa xác nhận được lần lưu. Giữ nguyên nội dung và bấm Lưu lại để kiểm tra an toàn.');}
        finally{setBusy(false);}
      }}>
        <div className="storefront-discount-control">
          <label htmlFor="website-discount">Giảm giá website (%)<input id="website-discount" type="number" min="0" max="99" step="1" value={percent} onChange={event=>setPercent(event.target.value)} required disabled={busy} aria-describedby="website-discount-help"/></label>
          <button className="btn-primary" disabled={busy||!valid} type="submit">{busy?'Đang lưu…':'Lưu mức giảm'}</button>
          <button disabled={busy} type="button" onClick={async()=>{setBusy(true);setError('');setMessage('');try{await reload();setMessage('Đã tải cấu hình hiện tại.');}catch{setError('Không tải được cấu hình. Vui lòng thử lại.');}finally{setBusy(false);}}}>Tải lại cấu hình</button>
        </div>
        <p id="website-discount-help">Giảm trên giá chưa VAT, sau đó cộng VAT theo từng sản phẩm. Giá hiển thị và tổng giỏ hàng đã gồm VAT. Đơn đã gửi giữ giá tại thời điểm tiếp nhận.</p>
        <p>Đang áp dụng: <strong>{state.discountPercent}%</strong> · Phiên bản {state.version} · {state.intakeEnabled?'Đang nhận yêu cầu đặt hàng':'Chức năng nhận đơn đang tắt trên server'}</p>
        {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
      </form>
    </section>
    <section className="work-section">
      <h2>Xem trước giá khách hàng thấy</h2><p>Mức giảm xem trước: {valid?`${parsed}%`:'chưa hợp lệ'}. Chỉ thay đổi sau khi bấm Lưu mức giảm.</p>
      <div className="storefront-price-scroll"><table><thead><tr><th>Sản phẩm</th><th>Giá niêm yết chưa VAT</th><th>Sau giảm chưa VAT</th><th>VAT</th><th>Giá gốc đã VAT</th><th>Giá mua đã VAT</th></tr></thead>
        <tbody>{state.items.map(item=>{
          const product=productArrivals.find(product=>product.id===item.productId);
          const price=valid&&item.basePrice!==null&&item.vatRate!==null?calculateStorefrontPrice(item.basePrice,parsed,String(item.vatRate)):null;
          return <tr key={item.productId}><td><a href={`/vi/san-pham/${product?.slug.vi??''}`} target="_blank" rel="noopener noreferrer">{product?.name.vi??item.productId}</a></td><td>{price?money(price.basePrice):'Chưa có giá'}</td><td>{price?money(price.netSalePrice):'—'}</td><td>{price?`${price.vatRate}%`:'—'}</td><td>{price?money(price.listPrice):'—'}</td><td>{price?<strong>{money(price.salePrice)}</strong>:'Chưa thể đặt mua'}</td></tr>;
        })}</tbody></table></div>
    </section>
    <section className="work-section"><h2>Chính sách mua hàng</h2><p>Nội dung đang được gắn tại chân trang website.</p><ul>{STORE_POLICIES.map(policy=><li key={policy.slug}><a href={`/vi/chinh-sach/${policy.slug}`} target="_blank" rel="noopener noreferrer">{policy.title}</a></li>)}</ul></section>
  </div>;
}
