'use client';
import {useRef,useState,useSyncExternalStore,type FormEvent,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import Image from 'next/image';
import type {buyerSetup} from '@/lib/crm/buyer';
import type {BuyerOrder,BuyerContract,BuyerBranch} from '@/lib/crm/buyer-model';
import {buyerMoney} from '@/lib/crm/buyer-model';
import type {BuyerQuotePricing} from '@/lib/crm/buyer-quote-pricing';

type Setup=Awaited<ReturnType<typeof buyerSetup>>;
const subscribeReady=()=>()=>{};
const errors:Record<string,string>={
 FORBIDDEN:'Bạn không có quyền thực hiện thao tác này.',VERSION_CONFLICT:'Dữ liệu đã thay đổi. Tải lại trang để xem phiên bản mới.',
 INVALID_FIELDS:'Kiểm tra lại các trường bắt buộc và số lượng.',QUOTE_REQUIRED:'Đơn cần Sales báo giá trước khi xác nhận.',
 QUOTE_EXPIRED:'Báo giá đã hết hạn. Vui lòng liên hệ Sales báo lại giá.',ORDER_LOCKED:'Đơn đã khóa hoặc đã chuyển kho xử lý.',
 CONTRACT_NOT_ACTIVE:'Hợp đồng chưa có hiệu lực hoặc đã hết hạn.',PRODUCT_OUTSIDE_CONTRACT:'Có sản phẩm chưa có giá trong hợp đồng.',
 BRANCH_AND_CONTRACT_REQUIRED:'Chọn chi nhánh và hợp đồng trước khi đặt hàng.',CASE_CONVERSION_REQUIRED:'Sản phẩm chưa được cấu hình số gói/thùng. Liên hệ Cohamy.',
 DISCREPANCY_NOTE_REQUIRED:'Nhập lý do khi nhận thiếu hàng.',RECEIVED_EXCEEDS_SENT:'Số thực nhận không được vượt số gửi trên phiếu.',
 DELIVERY_ALREADY_RECEIVED:'Phiếu này đã được xác nhận nhận hàng.',SOURCE_REVISION_CHANGED:'Phiếu giao đã được Admin cập nhật. Tải lại để kiểm tra.',
 STATEMENT_CHANGED:'Dữ liệu tháng đã thay đổi. Tải lại báo cáo trước khi đối soát.',IDEMPOTENCY_CONFLICT:'Nội dung đã đổi so với lần gửi trước. Tải lại để kiểm tra.',
 BUYER_ROLE_CONFLICT:'Hồ sơ này đang có loại tài khoản khách hàng/siêu thị khác.',DUPLICATE_RECORD:'Mã đã tồn tại hoặc thao tác này đã được ghi nhận.',
 ORDER_MINIMUM_NOT_MET:'Đơn chưa đáp ứng số lượng hoặc giá trị tối thiểu của bảng giá. Kiểm tra phần điều kiện báo giá.',
};
function CommandForm({action,build,label,children,next}:{action:string;build:(f:FormData)=>Record<string,unknown>;label:string;children?:ReactNode;next?:string}){
 const ready=useSyncExternalStore(subscribeReady,()=>true,()=>false);
 const router=useRouter(),busy=useRef(false),last=useRef({payload:'',key:''}),[pending,setPending]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy.current)return;busy.current=true;setPending(true);setError('');setMessage('');
  try{
   const input=build(new FormData(e.currentTarget)),payload=JSON.stringify(input);
   if(payload!==last.current.payload)last.current={payload,key:crypto.randomUUID()};
   const response=await fetch('/api/crm/buyer/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,...(action==='password'?{}:{idempotencyKey:last.current.key})})}),result=await response.json();
   if(!response.ok)throw new Error(errors[result.error]??'Chưa lưu được. Kiểm tra kết nối và dữ liệu rồi thử lại.');
   if(action==='password'){router.replace('/portal/login');router.refresh();return;}
   setMessage('Đã lưu thành công.');
   if(next)router.push(next.replace('{id}',result.id));router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Không kết nối được server. Giữ nguyên nội dung để thử lại.');}
  finally{busy.current=false;setPending(false);}
 }
 return <form className="buyer-form" method="post" action={'/api/crm/buyer/'+action} onSubmit={submit}>{children}<div className="buyer-actions"><button className="button button--primary" disabled={pending||!ready}>{pending?'Đang xử lý…':label}</button>{error&&<p role="alert" className="form-status--error">{error}</p>}{message&&<p role="status">{message}</p>}</div></form>;
}
export function BuyerOrderForm({setup,supermarket}:{setup:Setup;supermarket:boolean}){
 const [filter,setFilter]=useState('');const shown=setup.products.filter(p=>(p.name+' '+p.sku).toLocaleLowerCase('vi').includes(filter.toLocaleLowerCase('vi')));
 return <CommandForm action="create" label={supermarket?'Đặt hàng theo hợp đồng & gửi kho':'Gửi yêu cầu báo giá'} next="/portal/orders/{id}" build={f=>{
  const lines=setup.products.filter(p=>Number(f.get('quantity:'+p.id))>0).map(p=>({productId:p.id,quantity:Number(f.get('quantity:'+p.id)),unit:String(f.get('unit:'+p.id)||'PACK')}));
  return {warehouseId:String(f.get('warehouseId')),note:String(f.get('note')??''),lines,...(supermarket?{branchId:String(f.get('branchId')),contractId:String(f.get('contractId'))}:{delivery:{recipient:String(f.get('recipient')),phone:String(f.get('phone')),address:String(f.get('address'))}})};
 }}>
  <div className="buyer-fields"><label>Kho xuất dự kiến<select aria-label="Kho xuất dự kiến" name="warehouseId" required><option value="">Chọn kho</option>{setup.warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
  {supermarket?<><label>Chi nhánh nhận hàng<select aria-label="Chi nhánh nhận hàng" name="branchId" required><option value="">Chọn chi nhánh</option>{setup.branches.filter(b=>b.active).map(b=><option key={b.id} value={b.id}>{b.name} · {b.address}</option>)}</select></label><label>Hợp đồng / bảng giá B2B<select aria-label="Hợp đồng / bảng giá B2B" name="contractId" required><option value="">Chọn hợp đồng</option>{setup.contracts.filter(c=>c.active).map(c=><option key={c.id} value={c.id}>{c.code} · {c.starts_on} → {c.ends_on}</option>)}</select></label></>:<><label>Người nhận<input name="recipient" required minLength={2} maxLength={120} defaultValue={setup.organization.name}/></label><label>Điện thoại nhận hàng<input name="phone" required minLength={5} maxLength={40} defaultValue={setup.organization.phone}/></label><label className="buyer-wide">Địa chỉ giao hàng<textarea name="address" required minLength={3} maxLength={500} defaultValue={setup.organization.address}/></label></>}</div>
  <label className="buyer-filter">Tìm sản phẩm<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Tên sản phẩm hoặc mã hàng"/></label>
  <div className="buyer-table" tabIndex={0} role="region" aria-label="Danh mục đặt hàng"><table className="data-table"><thead><tr><th>Ảnh</th><th>Sản phẩm</th><th>Quy cách</th><th>Đơn vị đặt</th><th>Số lượng đặt</th></tr></thead><tbody>{setup.products.map(p=><tr key={p.id} hidden={!shown.includes(p)}><td>{p.image?<Image unoptimized src={p.image} alt={p.name} width={64} height={64} loading="lazy"/>:<span className="buyer-image-empty">Chưa có ảnh</span>}</td><td><strong>{p.name}</strong><small>{p.sku}</small></td><td>{p.units_per_case?p.units_per_case+' '+p.stock_unit+'/thùng':p.stock_unit||'Chưa cấu hình đơn vị'}</td><td><select aria-label={'Đơn vị '+p.name} name={'unit:'+p.id} defaultValue={supermarket&&p.units_per_case?'CASE':'PACK'}><option value="PACK">{p.stock_unit||'Gói'}</option>{p.units_per_case&&<option value="CASE">Thùng</option>}</select></td><td><input aria-label={'Số lượng '+p.name} name={'quantity:'+p.id} type="number" min="0" max="1000000" step="1" defaultValue="0" disabled={!p.stock_unit}/></td></tr>)}</tbody></table></div>
  <p>{supermarket?'Giá và VAT lấy từ hợp đồng đã chọn tại thời điểm gửi đơn. Quy đổi thùng theo cấu hình của sản phẩm.':'Danh mục không hiển thị giá. Sales gửi báo giá; bạn xác nhận báo giá thì đơn mới chuyển đến kho.'}</p>
  <label>Ghi chú đặt hàng<textarea name="note" maxLength={2000}/></label>
 </CommandForm>;
}
export function BuyerQuoteForm({order,pricing}:{order:BuyerOrder;pricing:BuyerQuotePricing|null}){
 const [draft,setDraft]=useState(()=>Object.fromEntries(order.lines.map(l=>{const reference=pricing?.lines.find(p=>p.productId===l.productId);return [l.productId,{price:l.unitPrice??reference?.recommendedUnitPrice??'',vat:String(l.vatRate??reference?.vatRate??0)}];})));
 const reasonLabels:Record<string,string>={SPECIAL_PRICE:'Đơn giá khác giá khuyến nghị',SPECIAL_VAT:'VAT khác bảng giá',AMOUNT:'Tổng giá trị vượt ngưỡng duyệt',DISCOUNT:'Chiết khấu vượt quyền Sales'};
 const reasons=new Set(pricing?.approvalReasons??[]);
 if(pricing?.configured)for(const line of pricing.lines){const input=draft[line.productId];if(input&&/^\d+$/.test(input.price)){const actual=BigInt(input.price),recommended=BigInt(line.recommendedUnitPrice);if(actual!==recommended)reasons.add('SPECIAL_PRICE');if(pricing.maxSalesDiscountBasisPoints!==null&&recommended>0n&&(recommended-actual)*10000n>recommended*BigInt(pricing.maxSalesDiscountBasisPoints))reasons.add('DISCOUNT');}if(input&&input.vat!==''&&Number(input.vat)!==line.vatRate)reasons.add('SPECIAL_VAT');}
 const update=(id:string,field:'price'|'vat',value:string)=>setDraft(current=>({...current,[id]:{...current[id],[field]:value}}));
 return <CommandForm action="quote" label="Gửi báo giá cho khách" build={f=>({id:order.id,version:order.version,expiresOn:String(f.get('expiresOn')),note:String(f.get('note')??''),lines:order.lines.map(l=>({productId:l.productId,unitPrice:String(f.get('price:'+l.productId)),vatRate:Number(f.get('vat:'+l.productId))}))})}>
  {pricing&&<><dl className="sales-facts"><dt>Bảng giá tham chiếu</dt><dd>{pricing.bookName}{pricing.bookVersion!==null&&' · v'+pricing.bookVersion}</dd><dt>Giới hạn chiết khấu Sales</dt><dd>{pricing.maxSalesDiscountBasisPoints===null?'Chưa cấu hình giới hạn trong bảng giá':new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(pricing.maxSalesDiscountBasisPoints/100)+'%'}</dd>{BigInt(pricing.feeAmount??'0')>0n&&<><dt>Phí theo bảng giá</dt><dd>{buyerMoney(pricing.feeAmount??'0')}</dd></>}</dl><p>Giá theo đơn vị gốc, chưa VAT. Hệ thống kiểm tra bảng giá, khuyến mãi sản phẩm, số lượng và chính sách khi gửi báo giá; giá riêng cần duyệt theo quyền.</p>{pricing.nonSelfApproval&&<p>Người lập hoặc báo giá không được tự duyệt ngoại lệ giá theo chính sách đang áp dụng.</p>}{reasons.size>0&&<div className="crm-status-note"><strong>Điều kiện cần duyệt theo chính sách</strong><ul>{[...reasons].map(reason=><li key={reason}>{reasonLabels[reason]??'Yêu cầu duyệt theo chính sách bảng giá'}</li>)}</ul></div>}{pricing.minimumShortfalls.length>0&&<div className="crm-status-note"><strong>Điều kiện tối thiểu chưa đáp ứng</strong><ul>{pricing.minimumShortfalls.map((shortfall,index)=><li key={index}>{shortfall.sku?'Sản phẩm '+shortfall.sku:'Đơn hàng'}: thiếu {shortfall.kind==='AMOUNT'?buyerMoney(shortfall.missing):shortfall.missing+' đơn vị theo quy tắc số lượng'}</li>)}</ul></div>}</>}
  <div className="buyer-table"><table className="data-table"><thead><tr><th>Sản phẩm</th><th>Số lượng gốc</th><th>Giá niêm yết</th><th>Giá khuyến nghị</th><th>Đơn giá / ĐVT gốc (VND)</th><th>VAT (%)</th></tr></thead><tbody>{order.lines.map(l=>{const reference=pricing?.lines.find(p=>p.productId===l.productId);return <tr key={l.productId}><td>{l.name}</td><td>{l.baseQuantity} {l.unitLabel}</td><td>{reference?buyerMoney(reference.listUnitPrice):'Chưa có dữ liệu'}</td><td>{reference?buyerMoney(reference.recommendedUnitPrice):'Chưa có dữ liệu'}</td><td><input aria-label={'Đơn giá '+l.name} name={'price:'+l.productId} type="number" min="0" max="9999999999" step="1" required defaultValue={l.unitPrice??reference?.recommendedUnitPrice??''} onChange={e=>update(l.productId,'price',e.target.value)}/></td><td><input aria-label={'VAT '+l.name} name={'vat:'+l.productId} type="number" min="0" max="100" step="0.01" required defaultValue={l.vatRate??reference?.vatRate??0} onChange={e=>update(l.productId,'vat',e.target.value)}/></td></tr>;})}</tbody></table></div>
  <div className="buyer-fields"><label>Báo giá có hiệu lực đến<input type="date" name="expiresOn" required defaultValue={order.quote_expires_on??''}/></label><label>Ghi chú báo giá<textarea name="note" maxLength={2000}/></label></div>
 </CommandForm>;
}
export function BuyerQuoteRevisionForm({order}:{order:BuyerOrder}){
 return <CommandForm action="quote-revision" label="Gửi yêu cầu sửa báo giá" build={f=>({id:order.id,version:order.version,note:String(f.get('note')).trim()})}><label>Nội dung cần điều chỉnh<textarea name="note" required minLength={3} maxLength={2000}/></label><p>Sales sẽ nhận yêu cầu và gửi lại báo giá. Đơn chưa được xuất kho trong lúc chờ.</p></CommandForm>;
}
export function BuyerOrderAction({action,order,label}:{action:'confirm'|'cancel';order:BuyerOrder;label:string}){
 return <CommandForm action={action} label={label} build={()=>({id:order.id,version:order.version})}/>;
}
export function BuyerBranchForm({branch,organizationId}:{branch?:BuyerBranch;organizationId?:string}){
 return <CommandForm action="branch" label={branch?'Lưu chi nhánh':'Thêm chi nhánh'} build={f=>({...branch?{id:branch.id}:{},version:branch?.version??0,...organizationId?{organizationId}:{},code:String(f.get('code')),name:String(f.get('name')),address:String(f.get('address')),recipient:String(f.get('recipient')),phone:String(f.get('phone')),active:f.get('active')==='on'})}>
  <div className="buyer-fields">{[['code','Mã chi nhánh',40],['name','Tên chi nhánh',200],['address','Địa chỉ chi nhánh',500],['recipient','Người nhận tại chi nhánh',120],['phone','Điện thoại chi nhánh',40]].map(([key,label,max])=><label key={String(key)}>{label}<input name={String(key)} required minLength={key==='phone'?5:2} maxLength={Number(max)} defaultValue={branch?.[key as keyof BuyerBranch] as string??''}/></label>)}<label><input name="active" type="checkbox" defaultChecked={branch?.active??true}/> Đang hoạt động</label></div>
 </CommandForm>;
}
export function BuyerContractForm({setup,contract}:{setup:Setup;contract?:BuyerContract}){
 return <CommandForm action="contract" label={contract?'Lưu phiên bản hợp đồng':'Lưu bảng giá hợp đồng'} build={f=>({...contract?{id:contract.id}:{},version:contract?.version??0,organizationId:setup.organization.id,code:String(f.get('code')),startsOn:String(f.get('startsOn')),endsOn:String(f.get('endsOn')),note:String(f.get('note')??''),active:f.get('active')==='on',lines:setup.products.filter(p=>String(f.get('price:'+p.id)??'').trim()!=='').map(p=>({productId:p.id,unitPrice:String(f.get('price:'+p.id)),vatRate:Number(f.get('vat:'+p.id))}))})}>
  <div className="buyer-fields"><label>Mã hợp đồng<input name="code" required maxLength={80} defaultValue={contract?.code}/></label><label>Hiệu lực từ<input name="startsOn" type="date" required defaultValue={contract?.starts_on}/></label><label>Hiệu lực đến<input name="endsOn" type="date" required defaultValue={contract?.ends_on}/></label><label><input name="active" type="checkbox" defaultChecked={contract?.active??true}/> Đang hoạt động</label></div>
  <p>Đơn giá áp dụng cho một đơn vị gốc. Bỏ trống giá nếu sản phẩm không thuộc hợp đồng. Đơn đã gửi giữ nguyên giá tại thời điểm đặt.</p>
  <div className="buyer-table"><table className="data-table"><thead><tr><th>Sản phẩm</th><th>ĐVT gốc</th><th>Đơn giá VND</th><th>VAT (%)</th></tr></thead><tbody>{setup.products.map(p=>{const l=contract?.lines.find(l=>l.productId===p.id);return <tr key={p.id}><td>{p.name}</td><td>{p.stock_unit}</td><td><input aria-label={'Giá hợp đồng '+p.name} name={'price:'+p.id} type="number" min="0" max="9999999999" step="1" defaultValue={l?.unitPrice??''}/></td><td><input aria-label={'VAT hợp đồng '+p.name} name={'vat:'+p.id} type="number" min="0" max="100" step="1" defaultValue={l?.vatRate??0}/></td></tr>;})}</tbody></table></div>
  <label>Ghi chú hợp đồng<textarea name="note" maxLength={2000} defaultValue={contract?.note}/></label>
 </CommandForm>;
}
export function BuyerReceiveForm({orderId,issue}:{orderId:string;issue:{id:string;code:string;revision:number;lines:{productId:string;name:string;quantity:string;unit:string}[]}}){
 return <CommandForm action="receive" label="Xác nhận số thực nhận" build={f=>({id:orderId,issueId:issue.id,issueRevision:issue.revision,lines:issue.lines.map(l=>({productId:l.productId,received:Number(f.get(l.productId))})),note:String(f.get('note')??'')})}>
  <p>Phiếu {issue.code} · phiên bản {issue.revision}. Ghi số thực nhận của từng sản phẩm; bắt buộc nêu lý do nếu thiếu.</p>
  <div className="buyer-table"><table className="data-table"><thead><tr><th>Sản phẩm</th><th>Số gửi</th><th>Thực nhận</th></tr></thead><tbody>{issue.lines.map(l=><tr key={l.productId}><td>{l.name}</td><td>{l.quantity} {l.unit}</td><td><input aria-label={'Thực nhận '+l.name} name={l.productId} type="number" min="0" max={l.quantity} step="1" required defaultValue={l.quantity}/></td></tr>)}</tbody></table></div>
  <label>Lý do chênh lệch / ghi chú<textarea name="note" maxLength={2000}/></label>
 </CommandForm>;
}
export function BuyerStatementAction({month,checksum}:{month:string;checksum:string}){
 return <CommandForm action="acknowledge" label="Xác nhận đối soát tháng" build={f=>({month,checksum,note:String(f.get('note')??'')})}><label>Ý kiến đối soát<textarea name="note" maxLength={2000}/></label></CommandForm>;
}
export function BuyerPasswordForm(){
 return <CommandForm action="password" label="Đổi mật khẩu" build={f=>({currentPassword:String(f.get('currentPassword')),newPassword:String(f.get('newPassword'))})}><div className="buyer-fields"><label>Mật khẩu hiện tại<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={72}/></label><label>Mật khẩu mới<input name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={72}/></label></div></CommandForm>;
}
