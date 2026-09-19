'use client';
import {useState} from 'react';
import {Form} from './CommercialForms';

type Choice={id:string;name:string;code?:string};
type Product={id:string;sku:string;name:string;stock_unit:string};
type Warehouse={id:string;code:string;name:string};
type Order={id:string;code:string;organization_id:string;status:string};
type Line={productId:string;quantity:string};
const str=(f:FormData,key:string)=>String(f.get(key)??'');
const blank=():Line=>({productId:'',quantity:''});

export function SampleCreateForm({owner,partners,products,warehouses}:{owner:string;partners:Choice[];products:Product[];warehouses:Warehouse[]}){
 const [lines,setLines]=useState<Line[]>([blank()]);
 return <Form endpoint="/api/crm/samples/create" label="Lập yêu cầu hàng mẫu" destination={r=>'/crm/samples/'+r.id} payload={f=>({organizationId:str(f,'organizationId'),warehouseId:str(f,'warehouseId'),recipientName:str(f,'recipientName'),recipientPhone:str(f,'recipientPhone'),purpose:str(f,'purpose'),lines,reason:str(f,'reason')})} offlineDraft={{owner,key:'sample-create',snapshot:()=>({lines}),restore:s=>{const value=(s as {lines?:Line[]}|undefined)?.lines;if(Array.isArray(value)&&value.length)setLines(value.slice(0,50));}}}>
  <p>Phiếu yêu cầu chỉ giữ thông tin người nhận và hàng cần gửi. Tồn kho chỉ giảm khi thủ kho xác nhận xuất.</p>
  <div className="work-fields"><label>Đối tác nhận mẫu<select name="organizationId" required><option value="">Chọn đối tác trong phạm vi</option>{partners.map(p=><option key={p.id} value={p.id}>{p.name} · {p.code}</option>)}</select></label><label>Kho dự kiến xuất<select name="warehouseId" required><option value="">Chọn kho Cohamy</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label><label>Người nhận<input name="recipientName" required minLength={2} maxLength={120}/></label><label>Điện thoại người nhận<input name="recipientPhone" maxLength={40}/></label></div>
  <fieldset><legend>SKU và số lượng mẫu</legend>{lines.map((line,index)=><div className="commercial-inline" key={index}><label>SKU mẫu {index+1}<select required value={line.productId} onChange={e=>setLines(v=>v.map((x,i)=>i===index?{...x,productId:e.target.value}:x))}><option value="">Chọn SKU</option>{products.filter(p=>p.stock_unit).map(p=><option key={p.id} value={p.id}>{p.sku} · {p.name} ({p.stock_unit})</option>)}</select></label><label>Số lượng gốc {index+1}<input required inputMode="decimal" value={line.quantity} onChange={e=>setLines(v=>v.map((x,i)=>i===index?{...x,quantity:e.target.value}:x))}/></label><button type="button" className="button button--secondary" disabled={lines.length===1} onClick={()=>setLines(v=>v.filter((_,i)=>i!==index))}>Bỏ dòng {index+1}</button></div>)}<button type="button" className="button button--secondary" disabled={lines.length>=50} onClick={()=>setLines(v=>[...v,blank()])}>Thêm SKU mẫu</button></fieldset>
  <div className="work-fields"><label>Mục đích gửi mẫu<textarea name="purpose" required minLength={3} maxLength={1000}/></label><label>Lý do lập phiếu<textarea name="reason" required minLength={3} maxLength={2000}/></label></div>
 </Form>;
}

export function SampleIssueForm({id,version}:{id:string;version:number}){return <Form endpoint="/api/crm/samples/issue" label="Xác nhận xuất mẫu theo FEFO" payload={f=>({id,version,minimumShelfLifeDays:Number(str(f,'minimumShelfLifeDays')),reason:str(f,'reason')})}><div className="work-fields"><label>Hạn dùng còn lại tối thiểu (ngày)<input name="minimumShelfLifeDays" type="number" min={0} max={3650} defaultValue={0}/></label><label>Lý do xuất kho<textarea name="reason" required minLength={3} maxLength={2000}/></label></div><p>Hệ thống khóa tồn và xuất đủ toàn bộ phiếu trong một giao dịch. Nếu thiếu bất kỳ SKU nào, tồn không thay đổi.</p></Form>;}

export function SampleActionForm({id,version,status,organizationId,orders}:{id:string;version:number;status:string;organizationId:string;orders:Order[]}){
 const options=[...(status==='SENT'?[{value:'RECEIVE',label:'Xác nhận người nhận đã nhận mẫu'}]:[]),...(['RECEIVED','FEEDBACK'].includes(status)?[{value:'FEEDBACK',label:'Ghi phản hồi'},{value:'CONVERT',label:'Liên kết đơn bán phát sinh'}]:[]),...(!['CONVERTED','CLOSED'].includes(status)?[{value:'CLOSE',label:'Đóng phiếu'}]:[])],[action,setAction]=useState(options[0]?.value??'');
 if(!options.length)return null;
 return <Form endpoint="/api/crm/samples/act" label="Lưu tiến độ hàng mẫu" payload={f=>({id,version,action,feedback:action==='FEEDBACK'?str(f,'feedback'):'',outcome:action==='FEEDBACK'?str(f,'outcome'):null,salesOrderId:action==='CONVERT'?str(f,'salesOrderId'):null,reason:str(f,'reason')})}><div className="work-fields"><label>Tiến độ<select value={action} onChange={e=>setAction(e.target.value)}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>{action==='FEEDBACK'&&<><label>Kết quả<select name="outcome"><option value="INTERESTED">Quan tâm</option><option value="FOLLOW_UP">Cần chăm sóc tiếp</option><option value="NOT_INTERESTED">Chưa quan tâm</option></select></label><label>Nội dung phản hồi<textarea name="feedback" required minLength={2} maxLength={4000}/></label></>}{action==='CONVERT'&&<label>Đơn bán cùng đối tác<select name="salesOrderId" required><option value="">Chọn đơn bán</option>{orders.filter(o=>o.organization_id===organizationId).map(o=><option key={o.id} value={o.id}>{o.code} · {o.status}</option>)}</select></label>}<label>Lý do / bằng chứng<textarea name="reason" required minLength={3} maxLength={2000}/></label></div></Form>;
}
