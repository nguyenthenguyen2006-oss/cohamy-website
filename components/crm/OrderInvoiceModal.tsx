'use client';

import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {
 resolveInvoiceProductImage,
 vndToVietnameseWords,
 type OrderInvoicePayload,
} from '@/lib/crm/order-invoice-model';

function formatVnd(value:string):string{
 const clean=String(value??'0').replace(/[^0-9-]/g,'');
 if(!clean)return '0';
 try{
  return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(BigInt(clean));
 }catch{
  return value;
 }
}

function formatVietnameseDateParts(isoOrText:string):{day:string;month:string;year:string;time:string}{
 const d=new Date(isoOrText);
 if(Number.isNaN(d.getTime())){
  const now=new Date();
  return formatVietnameseDateParts(now.toISOString());
 }
 const parts=new Intl.DateTimeFormat('vi-VN',{
  timeZone:'Asia/Ho_Chi_Minh',
  day:'2-digit',
  month:'2-digit',
  year:'numeric',
  hour:'2-digit',
  minute:'2-digit',
  hour12:false,
 }).formatToParts(d);
 const get=(t:string)=>parts.find(p=>p.type===t)?.value??'';
 return {
  day:get('day')||'01',
  month:get('month')||'01',
  year:get('year')||'2026',
  time:`${get('hour')||'00'}:${get('minute')||'00'}`,
 };
}

export interface OrderInvoiceTriggerProps {
 initialPayload?:OrderInvoicePayload;
 fetchParams?:{requestId?:string;orderId?:string;versionId?:string};
 onLoadDraft?:()=>Promise<OrderInvoicePayload>;
 buttonLabel?:string;
 buttonClassName?:string;
 autoOpen?:boolean;
}

export function OrderInvoiceTrigger({
 initialPayload,
 fetchParams,
 onLoadDraft,
 buttonLabel='🧾 Xem trước & Xuất Hóa đơn (PDF)',
 buttonClassName='button button--primary',
 autoOpen=false,
}:OrderInvoiceTriggerProps){
 const [open,setOpen]=useState(false);
 const [loading,setLoading]=useState(false);
 const [downloading,setDownloading]=useState(false);
 const [error,setError]=useState('');
 const [payload,setPayload]=useState<OrderInvoicePayload|null>(initialPayload??null);
 const [prevInitial,setPrevInitial]=useState<OrderInvoicePayload|undefined>(initialPayload);
 if(initialPayload!==prevInitial){
  setPrevInitial(initialPayload);
  if(initialPayload)setPayload(initialPayload);
 }

 useEffect(()=>{
  if(autoOpen&&!open){
   void handleOpen();
  }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[autoOpen]);

 async function handleOpen(){
  setError('');
  if(onLoadDraft){
   setLoading(true);
   try{
    const built=await onLoadDraft();
    setPayload(built);
    setOpen(true);
   }catch(e){
    setError(e instanceof Error?e.message:'Chưa đủ thông tin để tạo bản xem trước hóa đơn.');
   }finally{
    setLoading(false);
   }
   return;
  }
  if(!payload&&fetchParams){
   setLoading(true);
   try{
    const qs=new URLSearchParams();
    if(fetchParams.requestId)qs.set('requestId',fetchParams.requestId);
    if(fetchParams.orderId)qs.set('orderId',fetchParams.orderId);
    if(fetchParams.versionId)qs.set('versionId',fetchParams.versionId);
    const res=await fetch(`/api/crm/commerce/invoice-data?${qs.toString()}`);
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||'Không tải được dữ liệu hóa đơn.');
    setPayload(data as OrderInvoicePayload);
    setOpen(true);
   }catch(e){
    setError(e instanceof Error?e.message:'Không tải được dữ liệu hóa đơn.');
   }finally{
    setLoading(false);
   }
   return;
  }
  setOpen(true);
 }

 async function handleDownloadPdf(){
  if(!payload||downloading)return;
  setDownloading(true);
  setError('');
  try{
   const res=await fetch('/api/crm/commerce/invoice-pdf',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload),
   });
   if(!res.ok){
    const errJson=await res.json().catch(()=>({}));
    throw new Error(errJson.error||'Chưa xuất được file PDF.');
   }
   const blob=await res.blob();
   const url=URL.createObjectURL(blob);
   const a=document.createElement('a');
   const safeCode=payload.invoiceCode.replace(/[^A-Za-z0-9_-]/g,'-')||'Hoa-don-Cohamy';
   a.href=url;
   a.download=`${safeCode}.pdf`;
   document.body.appendChild(a);
   a.click();
   a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),5000);
  }catch(e){
   setError(e instanceof Error?e.message:'Lỗi khi tải PDF.');
  }finally{
   setDownloading(false);
  }
 }

 const dt=payload?formatVietnameseDateParts(payload.issuedAt):null;

 return (
  <>
   <div style={{display:'inline-flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
    <button
     type="button"
     className={buttonClassName}
     onClick={()=>void handleOpen()}
     disabled={loading}
    >
     {loading?'Đang tạo bản xem trước…':buttonLabel}
    </button>
    {error&&!open&&<span role="alert" className="work-error" style={{fontSize:'13px'}}>{error}</span>}
   </div>

   {open&&payload&&typeof document!=='undefined'&&createPortal(
    <div
     role="dialog"
     aria-modal="true"
     aria-label="Xem trước Hóa đơn đặt hàng"
     style={{
      position:'fixed',
      inset:0,
      zIndex:9999,
      backgroundColor:'rgba(15, 23, 42, 0.72)',
      display:'flex',
      flexDirection:'column',
      alignItems:'center',
      overflowY:'auto',
      padding:'20px 12px 40px',
     }}
     onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}
    >
     {/* Top Toolbar & Quick Edit Bar */}
     <div
      style={{
       width:'100%',
       maxWidth:'860px',
       background:'#ffffff',
       borderRadius:'10px',
       padding:'14px 18px',
       marginBottom:'14px',
       boxShadow:'0 10px 25px rgba(0,0,0,0.2)',
       border:'1px solid #cbd5e1',
      }}
     >
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'10px',marginBottom:'12px'}}>
       <div>
        <strong style={{fontSize:'16px',color:'#172b43'}}>Xem trước Hóa đơn Đặt hàng & Tải PDF</strong>
        <p style={{margin:'2px 0 0',fontSize:'12.5px',color:'#475569'}}>
         Thông tin đã được điền tự động từ yêu cầu đặt hàng. Bạn có thể bổ sung Ngày dự kiến nhận hàng hoặc sửa nhanh thông tin bên dưới trước khi tải PDF.
        </p>
       </div>
       <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
        <button
         type="button"
         className="button button--primary"
         onClick={()=>void handleDownloadPdf()}
         disabled={downloading}
        >
         {downloading?'Đang xuất PDF…':'📥 Tải về PDF'}
        </button>
        <button
         type="button"
         className="button button--secondary"
         onClick={()=>window.print()}
        >
         🖨️ In hóa đơn
        </button>
        <button
         type="button"
         className="button button--secondary"
         onClick={()=>setOpen(false)}
        >
         Đóng ✕
        </button>
       </div>
      </div>

      {error&&<p role="alert" className="work-error" style={{margin:'0 0 10px'}}>{error}</p>}

      <details style={{fontSize:'13px',background:'#f8fafc',padding:'8px 12px',borderRadius:'6px',border:'1px solid #e2e8f0'}} open={!payload.delivery.expectedDeliveryDate}>
       <summary style={{cursor:'pointer',fontWeight:600,color:'#172b43'}}>
        ✏️ Chỉnh sửa nhanh thông tin trên Hóa đơn (Ngày dự kiến nhận, Đơn vị xuất HĐ, Người ký)
       </summary>
       <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',gap:'10px',marginTop:'10px'}}>
        <label style={{display:'flex',flexDirection:'column',gap:'3px'}}>
         <span>Ngày dự kiến nhận hàng</span>
         <input
          type="text"
          placeholder="VD: 25/10/2026"
          value={payload.delivery.expectedDeliveryDate}
          onChange={e=>setPayload({...payload,delivery:{...payload.delivery,expectedDeliveryDate:e.target.value}})}
          style={{padding:'6px 8px',border:'1px solid #cbd5e1',borderRadius:'4px'}}
         />
        </label>
        <label style={{display:'flex',flexDirection:'column',gap:'3px'}}>
         <span>Số hóa đơn</span>
         <input
          type="text"
          value={payload.invoiceCode}
          onChange={e=>setPayload({...payload,invoiceCode:e.target.value})}
          style={{padding:'6px 8px',border:'1px solid #cbd5e1',borderRadius:'4px'}}
         />
        </label>
        <label style={{display:'flex',flexDirection:'column',gap:'3px'}}>
         <span>Đơn vị ghi trên HĐ</span>
         <input
          type="text"
          value={payload.buyer.invoiceCompanyName}
          onChange={e=>setPayload({...payload,buyer:{...payload.buyer,invoiceCompanyName:e.target.value}})}
          style={{padding:'6px 8px',border:'1px solid #cbd5e1',borderRadius:'4px'}}
         />
        </label>
        <label style={{display:'flex',flexDirection:'column',gap:'3px'}}>
         <span>Mã số thuế / ĐKKD</span>
         <input
          type="text"
          value={payload.buyer.taxCode}
          onChange={e=>setPayload({...payload,buyer:{...payload.buyer,taxCode:e.target.value}})}
          style={{padding:'6px 8px',border:'1px solid #cbd5e1',borderRadius:'4px'}}
         />
        </label>
        <label style={{display:'flex',flexDirection:'column',gap:'3px'}}>
         <span>Địa chỉ xuất HĐ</span>
         <input
          type="text"
          value={payload.buyer.invoiceAddress}
          onChange={e=>setPayload({...payload,buyer:{...payload.buyer,invoiceAddress:e.target.value}})}
          style={{padding:'6px 8px',border:'1px solid #cbd5e1',borderRadius:'4px'}}
         />
        </label>
        <label style={{display:'flex',flexDirection:'column',gap:'3px'}}>
         <span>Người nhận hàng</span>
         <input
          type="text"
          value={payload.delivery.recipient}
          onChange={e=>setPayload({...payload,delivery:{...payload.delivery,recipient:e.target.value}})}
          style={{padding:'6px 8px',border:'1px solid #cbd5e1',borderRadius:'4px'}}
         />
        </label>
        <label style={{display:'flex',flexDirection:'column',gap:'3px'}}>
         <span>Đại diện bên mua (ký tên)</span>
         <input
          type="text"
          value={payload.signatures.buyerRepresentative}
          onChange={e=>setPayload({...payload,signatures:{...payload.signatures,buyerRepresentative:e.target.value}})}
          style={{padding:'6px 8px',border:'1px solid #cbd5e1',borderRadius:'4px'}}
         />
        </label>
        <label style={{display:'flex',flexDirection:'column',gap:'3px'}}>
         <span>Đại diện phụ trách (ký tên)</span>
         <input
          type="text"
          value={payload.signatures.managerRepresentative}
          onChange={e=>setPayload({...payload,signatures:{...payload.signatures,managerRepresentative:e.target.value}})}
          style={{padding:'6px 8px',border:'1px solid #cbd5e1',borderRadius:'4px'}}
         />
        </label>
       </div>
      </details>
     </div>

     {/* A4 Sheet Live Preview */}
     <div
      className="crm-invoice-a4-preview"
      style={{
       width:'100%',
       maxWidth:'860px',
       background:'#ffffff',
       color:'#1e293b',
       padding:'28px 32px',
       borderRadius:'6px',
       boxShadow:'0 16px 40px rgba(0,0,0,0.32)',
       fontFamily:'"Be Vietnam Pro", "Times New Roman", serif',
       fontSize:'13px',
       lineHeight:1.45,
      }}
     >
      {/* 1. Header Table: Logo & Company Info */}
      <table style={{width:'100%',borderCollapse:'collapse',border:'2px solid #172b43',marginBottom:'10px'}}>
       <tbody>
        <tr>
         <td style={{width:'26%',background:'#172b43',padding:'14px',textAlign:'center',verticalAlign:'middle'}}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
           src="/images/logo/cohamy-brand-logo.png"
           alt="Cohamy"
           style={{maxWidth:'150px',maxHeight:'52px',objectFit:'contain',display:'inline-block'}}
          />
         </td>
         <td style={{width:'74%',background:'#f8fafc',padding:'10px 16px',verticalAlign:'middle'}}>
          <div style={{fontSize:'16px',fontWeight:700,color:'#172b43',marginBottom:'4px'}}>
           CÔNG TY TNHH COHAMY
           {payload.sellerName&&payload.sellerName!=='CÔNG TY TNHH COHAMY'?` (${payload.sellerName})`:''}
          </div>
          <div style={{fontSize:'12.5px',color:'#1e293b'}}>
           <strong>Trụ sở Hà Nội:</strong> Tầng 3, tháp A, Tòa T608, Phường Nghĩa Đô, TP. Hà Nội<br/>
           <strong>VP TP.HCM:</strong> Tổ 7, Cầu Mới, P. Tân Thành, TP Hồ Chí Minh<br/>
           <strong>Điện thoại:</strong> 0981 956 111 &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Email:</strong> Cohamyvietnam@gmail.com
          </div>
         </td>
        </tr>
       </tbody>
      </table>

      {/* 2. Title & Meta Table */}
      <table style={{width:'100%',borderCollapse:'collapse',border:'1px solid #cbd4df',marginBottom:'10px'}}>
       <tbody>
        <tr>
         <td style={{width:'62%',padding:'10px 14px',borderRight:'1px solid #cbd4df',verticalAlign:'top'}}>
          <div style={{fontSize:'19px',fontWeight:700,color:'#172b43'}}>HÓA ĐƠN ĐẶT HÀNG</div>
          <div style={{fontSize:'12px',fontStyle:'italic',color:'#46566a',marginBottom:'4px'}}>
           (Kiêm Phiếu xác nhận yêu cầu đặt hàng & đối chiếu thanh toán)
          </div>
          {dt&&(
           <div style={{fontSize:'12.5px',fontStyle:'italic'}}>
            Ngày lập: Ngày {dt.day} tháng {dt.month} năm {dt.year} ({dt.time})
           </div>
          )}
         </td>
         <td style={{width:'38%',padding:'10px 14px',verticalAlign:'middle',fontSize:'13px'}}>
          <div style={{marginBottom:'6px'}}>
           <strong>Số hóa đơn: </strong>
           <strong style={{color:'#b9420c',fontSize:'14px'}}>{payload.invoiceCode}</strong>
          </div>
          <div>
           <strong>Mã YC đặt hàng: </strong>
           <span>{payload.requestCode}</span>
          </div>
         </td>
        </tr>
       </tbody>
      </table>

      {/* 3. Buyer & Delivery Table (2 Columns) */}
      <table style={{width:'100%',borderCollapse:'collapse',border:'1px solid #cbd4df',marginBottom:'12px'}}>
       <thead>
        <tr style={{background:'#edf1f5'}}>
         <th style={{width:'50%',padding:'7px 12px',textAlign:'left',color:'#172b43',fontSize:'12.5px',border:'1px solid #cbd4df'}}>
          I. THÔNG TIN ĐƠN VỊ MUA & XUẤT HÓA ĐƠN
         </th>
         <th style={{width:'50%',padding:'7px 12px',textAlign:'left',color:'#172b43',fontSize:'12.5px',border:'1px solid #cbd4df'}}>
          II. THÔNG TIN NHẬN HÀNG & THANH TOÁN
         </th>
        </tr>
       </thead>
       <tbody>
        <tr>
         <td style={{padding:'10px 12px',verticalAlign:'top',border:'1px solid #cbd4df',fontSize:'12.5px'}}>
          <div><strong>Đơn vị đặt mua:</strong> {payload.buyer.partnerName}{payload.buyer.partnerCode&&payload.buyer.partnerCode!=='—'?` (Mã: ${payload.buyer.partnerCode})`:''}</div>
          <div><strong>Đơn vị ghi trên HĐ:</strong> {payload.buyer.invoiceCompanyName||'—'}</div>
          <div><strong>Mã số thuế / ĐKKD:</strong> {payload.buyer.taxCode||'—'}</div>
          <div><strong>Địa chỉ xuất HĐ:</strong> {payload.buyer.invoiceAddress||'—'}</div>
          <div><strong>Điện thoại / Email:</strong> {payload.buyer.phone||'—'} &nbsp;|&nbsp; {payload.buyer.email||'—'}</div>
         </td>
         <td style={{padding:'10px 12px',verticalAlign:'top',border:'1px solid #cbd4df',fontSize:'12.5px'}}>
          <div><strong>Người nhận hàng:</strong> {payload.delivery.recipient||'—'}</div>
          <div><strong>SĐT người nhận:</strong> {payload.delivery.phone||'—'}</div>
          <div><strong>Địa chỉ giao hàng:</strong> {payload.delivery.address||'—'}</div>
          <div>
           <strong>Ngày dự kiến nhận hàng:</strong>{' '}
           <span style={{color:payload.delivery.expectedDeliveryDate?'#1e293b':'#94a3b8'}}>
            {payload.delivery.expectedDeliveryDate||'................................................'}
           </span>
          </div>
         </td>
        </tr>
       </tbody>
      </table>

      {/* 4. Section III: Product Lines Table */}
      <div style={{fontWeight:700,color:'#172b43',fontSize:'13.5px',marginBottom:'6px'}}>
       III. CHI TIẾT HÀNG HÓA ĐẶT MUA
      </div>
      <table style={{width:'100%',borderCollapse:'collapse',border:'1px solid #cbd4df',marginBottom:'10px',fontSize:'12.5px'}}>
       <thead>
        <tr style={{background:'#172b43',color:'#ffffff'}}>
         <th style={{width:'5%',padding:'8px 4px',border:'1px solid #cbd4df',textAlign:'center'}}>STT</th>
         <th style={{width:'9%',padding:'8px 4px',border:'1px solid #cbd4df',textAlign:'center'}}>PNG</th>
         <th style={{width:'31%',padding:'8px 8px',border:'1px solid #cbd4df',textAlign:'left'}}>Tên hàng hóa / Quy cách</th>
         <th style={{width:'8%',padding:'8px 4px',border:'1px solid #cbd4df',textAlign:'center'}}>ĐVT</th>
         <th style={{width:'9%',padding:'8px 6px',border:'1px solid #cbd4df',textAlign:'right'}}>Số lượng</th>
         <th style={{width:'12%',padding:'8px 6px',border:'1px solid #cbd4df',textAlign:'right'}}>Đơn giá gốc</th>
         <th style={{width:'13%',padding:'8px 6px',border:'1px solid #cbd4df',textAlign:'right'}}>Đơn giá sau KM/CK</th>
         <th style={{width:'13%',padding:'8px 6px',border:'1px solid #cbd4df',textAlign:'right'}}>Thành tiền (VND)</th>
        </tr>
       </thead>
       <tbody>
        {payload.lines.map((line,idx)=>{
         const imgSrc=line.imagePath||resolveInvoiceProductImage(line.sku);
         return (
          <tr key={`${line.sku}-${idx}`} style={{background:idx%2===1?'#f8fafc':'#ffffff'}}>
           <td style={{padding:'6px 4px',border:'1px solid #cbd4df',textAlign:'center'}}>{idx+1}</td>
           <td style={{padding:'4px',border:'1px solid #cbd4df',textAlign:'center'}}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
             src={imgSrc}
             alt={line.name}
             style={{width:'42px',height:'42px',objectFit:'contain',borderRadius:'4px',border:'1px solid #e2e8f0',background:'#fff',display:'inline-block'}}
            />
           </td>
           <td style={{padding:'6px 8px',border:'1px solid #cbd4df'}}>
            <div style={{fontWeight:700,color:'#1e293b'}}>{line.name}</div>
            <div style={{fontSize:'11.5px',color:line.gift?'#b9420c':'#46566a'}}>{line.conversionNote}</div>
           </td>
           <td style={{padding:'6px 4px',border:'1px solid #cbd4df',textAlign:'center'}}>{line.unitLabel}</td>
           <td style={{padding:'6px 6px',border:'1px solid #cbd4df',textAlign:'right',fontWeight:600}}>{line.quantity}</td>
           <td style={{padding:'6px 6px',border:'1px solid #cbd4df',textAlign:'right'}}>{formatVnd(line.listUnitPrice)}</td>
           <td style={{padding:'6px 6px',border:'1px solid #cbd4df',textAlign:'right'}}>
            <div style={{fontWeight:600}}>{formatVnd(line.appliedUnitPrice)}</div>
            {line.discountNote&&<div style={{fontSize:'11px',color:'#b9420c'}}>{line.discountNote}</div>}
           </td>
           <td style={{padding:'6px 6px',border:'1px solid #cbd4df',textAlign:'right',fontWeight:700}}>
            {formatVnd(line.lineTotal)}
           </td>
          </tr>
         );
        })}
       </tbody>
      </table>

      {/* 5. Totals Summary Table */}
      <table style={{width:'100%',borderCollapse:'collapse',border:'1px solid #cbd4df',marginBottom:'10px',fontSize:'12.5px'}}>
       <tbody>
        <tr>
         <td style={{width:'65%',padding:'6px 12px',border:'1px solid #cbd4df'}}>
          Tổng số lượng hàng hóa (quy đổi đơn vị gốc):
         </td>
         <td style={{width:'35%',padding:'6px 12px',border:'1px solid #cbd4df',textAlign:'right'}}>
          {payload.summary.totalBaseQuantityText} · Số thùng: {payload.summary.totalCasesText}
         </td>
        </tr>
        <tr>
         <td style={{padding:'6px 12px',border:'1px solid #cbd4df'}}>
          1. Tổng tiền hàng theo giá niêm yết (trước KM/CK):
         </td>
         <td style={{padding:'6px 12px',border:'1px solid #cbd4df',textAlign:'right'}}>
          {formatVnd(payload.summary.listSubtotal)} VND
         </td>
        </tr>
        <tr>
         <td style={{padding:'6px 12px',border:'1px solid #cbd4df'}}>
          2. Tiền hàng sau khuyến mãi / chiết khấu cấp bậc:
         </td>
         <td style={{padding:'6px 12px',border:'1px solid #cbd4df',textAlign:'right'}}>
          {formatVnd(payload.summary.subtotalAfterTier)} VND
         </td>
        </tr>
        <tr>
         <td style={{padding:'6px 12px',border:'1px solid #cbd4df'}}>
          3. Chiết khấu bổ sung trên đơn ({payload.summary.extraDiscountPercent||'0'}%):
         </td>
         <td style={{padding:'6px 12px',border:'1px solid #cbd4df',textAlign:'right'}}>
          - {formatVnd(payload.summary.extraDiscountAmount)} VND
         </td>
        </tr>
        <tr style={{background:'#edf1f5'}}>
         <td style={{padding:'8px 12px',border:'1px solid #cbd4df',fontWeight:700,color:'#172b43',fontSize:'13.5px'}}>
          TỔNG CỘNG TIỀN THANH TOÁN (2 - 3):
         </td>
         <td style={{padding:'8px 12px',border:'1px solid #cbd4df',textAlign:'right',fontWeight:700,color:'#b9420c',fontSize:'15px'}}>
          {formatVnd(payload.summary.totalPayable)} VND
         </td>
        </tr>
       </tbody>
      </table>

      {/* Amount in words */}
      <div style={{marginBottom:'20px',fontSize:'13px',fontStyle:'italic'}}>
       <strong>Số tiền viết bằng chữ: </strong>
       <strong style={{color:'#172b43'}}>
        {payload.summary.amountInWords||vndToVietnameseWords(payload.summary.totalPayable)}
       </strong>
      </div>

      {/* 6. Signatures (2 Columns) */}
      <table style={{width:'100%',borderCollapse:'collapse',marginTop:'8px'}}>
       <tbody>
        <tr>
         <td style={{width:'50%',textAlign:'center',verticalAlign:'top',padding:'4px 12px 54px'}}>
          <div style={{fontWeight:700,color:'#172b43',fontSize:'13px'}}>ĐẠI DIỆN BÊN MUA / ĐẠI LÝ</div>
          <div style={{fontSize:'11.5px',fontStyle:'italic',color:'#46566a'}}>(Ký, ghi rõ họ tên)</div>
          {payload.signatures.buyerRepresentative&&(
           <div style={{marginTop:'48px',fontWeight:700,color:'#1e293b'}}>{payload.signatures.buyerRepresentative}</div>
          )}
         </td>
         <td style={{width:'50%',textAlign:'center',verticalAlign:'top',padding:'4px 12px 54px'}}>
          <div style={{fontWeight:700,color:'#172b43',fontSize:'13px'}}>ĐẠI DIỆN PHỤ TRÁCH</div>
          <div style={{fontSize:'11.5px',fontStyle:'italic',color:'#46566a'}}>(Ký, ghi rõ họ tên)</div>
          {payload.signatures.managerRepresentative&&(
           <div style={{marginTop:'48px',fontWeight:700,color:'#1e293b'}}>{payload.signatures.managerRepresentative}</div>
          )}
         </td>
        </tr>
       </tbody>
      </table>
     </div>
    </div>,
    document.body
   )}
  </>
 );
}
