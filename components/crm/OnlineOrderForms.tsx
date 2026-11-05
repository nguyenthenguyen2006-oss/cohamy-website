'use client';

import {useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import styles from './OnlineOrders.module.css';

type WarehouseOption={id:string;code:string;name:string};
type ActionProps={id:string;version:number;warehouseId:string|null;warehouses:WarehouseOption[];canDispatch:boolean;canAccept:boolean;dispatchStatus:string;closed:boolean;linked:boolean};
const errors:Record<string,string>={
  VERSION_CONFLICT:'Đơn vừa được cập nhật. Tải lại dữ liệu trước khi tiếp tục.',
  IDEMPOTENCY_CONFLICT:'Lần gửi trước có nội dung khác. Tải lại dữ liệu và kiểm tra lịch sử của đơn.',
  INVALID_FIELDS:'Kiểm tra kho và nội dung bắt buộc trước khi gửi.',
  INVALID_WAREHOUSE:'Kho đã chọn không còn hoạt động hoặc không phù hợp. Tải lại danh sách kho.',
  WAREHOUSE_NOT_FOUND:'Không tìm thấy kho phù hợp. Tải lại danh sách kho.',
  FORBIDDEN:'Bạn không có quyền thực hiện thao tác này.',
  NOT_FOUND:'Đơn không còn nằm trong phạm vi của bạn. Tải lại danh sách.',
  ORDER_CLOSED:'Đơn đã hủy hoặc bị từ chối nên không thể điều phối.',
  ORDER_NOT_DISPATCHABLE:'Đơn không còn ở trạng thái cho phép điều phối. Tải lại dữ liệu.',
  ORDER_LINKED:'Đơn đã gắn với đơn bán. Kiểm tra đơn bán trước khi tiếp tục.',
  ORDER_NOT_ASSIGNED:'Đơn chưa được giao về kho của bạn hoặc đã đổi kho. Tải lại dữ liệu.',
  ORDER_NOT_ROUTABLE:'Đơn đã hủy hoặc bị từ chối nên không thể điều phối hoặc tiếp nhận.',
  ORDER_ALREADY_CONVERTED:'Đơn đã chuyển sang đơn bán. Kiểm tra đơn bán liên quan trước khi tiếp tục.',
  ORDER_NOT_AWAITING_WAREHOUSE:'Đơn không còn chờ kho tiếp nhận. Tải lại để xem trạng thái mới.',
  WAREHOUSE_REQUIRED:'Đơn chưa có kho nhận. Admin cần điều phối trước khi kho tiếp nhận.',
  WAREHOUSE_UNCHANGED:'Chọn kho khác kho đang nhận đơn để điều phối lại.',
};

function useOrderAction(id:string,version:number,action:'dispatch'|'accept'){
  const router=useRouter(),busy=useRef(false),request=useRef<{fingerprint:string;key:string}|null>(null);
  const [pending,setPending]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[stale,setStale]=useState(false);
  async function submit(values:Record<string,string>){
    if(busy.current)return;
    busy.current=true;setPending(true);setError('');setMessage('');
    const payload={version,...values},fingerprint=JSON.stringify(payload);
    const key=request.current?.fingerprint===fingerprint?request.current.key:crypto.randomUUID();
    request.current={fingerprint,key};
    try{
      const response=await fetch(`/api/crm/online-orders/${id}/${action}`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,idempotencyKey:key})});
      const result=await response.json().catch(()=>null);
      if(!response.ok){
        const code=typeof result?.error==='string'?result.error:'';
        if(code==='VERSION_CONFLICT'||code==='IDEMPOTENCY_CONFLICT')setStale(true);
        setError(errors[code]??'Chưa thực hiện được thao tác. Tải lại dữ liệu để kiểm tra trạng thái rồi thử lại.');
        return;
      }
      request.current=null;
      setMessage(action==='dispatch'?'Đã lưu điều phối. Đang tải trạng thái mới…':'Đã ghi nhận kho tiếp nhận. Đang tải trạng thái mới…');
      router.refresh();
    }catch{
      setError('Chưa nhận được kết quả từ máy chủ. Giữ nguyên nội dung và thử lại để kiểm tra lần gửi này.');
    }finally{busy.current=false;setPending(false);}
  }
  return {submit,pending,error,message,stale,reload:()=>router.refresh()};
}

function ActionFeedback({state}:{state:ReturnType<typeof useOrderAction>}){
  return <>{state.message&&<p className="work-success" role="status">{state.message}</p>}{state.error&&<div className={styles.error} role="alert"><p>{state.error}</p><button className="button button--secondary" type="button" disabled={state.pending} onClick={state.reload}>Tải lại dữ liệu</button></div>}</>;
}

function DispatchForm({id,version,warehouseId,warehouses}:{id:string;version:number;warehouseId:string|null;warehouses:WarehouseOption[]}){
  const state=useOrderAction(id,version,'dispatch'),[selected,setSelected]=useState(warehouseId??'');
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);await state.submit({warehouseId:selected,reason:String(data.get('reason')??'').trim()});}
  return <form className={`work-form ${styles.actionForm}`} onSubmit={submit} data-online-dispatch-form>
    <fieldset disabled={state.pending||state.stale}>
      <label>Kho nhận đơn<select name="warehouseId" value={selected} onChange={event=>setSelected(event.target.value)} required><option value="">Chọn kho</option>{warehouses.map(warehouse=><option key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.code})</option>)}</select></label>
      <label>{warehouseId?'Lý do điều phối lại':'Ghi chú điều phối'}<textarea name="reason" required minLength={5} maxLength={1000} rows={3} placeholder="Thông tin cần bàn giao cho kho"/></label>
      <button className="button button--primary" disabled={!selected||selected===warehouseId||!warehouses.length} type="submit">{state.pending?'Đang lưu…':warehouseId?'Điều phối lại về kho':'Điều phối về kho'}</button>
    </fieldset>
    {!warehouses.length&&<p className="work-help">Chưa có kho đang hoạt động phù hợp để điều phối.</p>}
    <ActionFeedback state={state}/>
  </form>;
}

function AcceptForm({id,version}:{id:string;version:number}){
  const state=useOrderAction(id,version,'accept');
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();await state.submit({reason:String(new FormData(event.currentTarget).get('reason')??'').trim()});}
  return <form className={`work-form ${styles.actionForm}`} onSubmit={submit} data-online-accept-form>
    <fieldset disabled={state.pending||state.stale}>
      <label>Ghi chú tiếp nhận<textarea name="reason" maxLength={1000} rows={3} placeholder="Ghi chú cho Admin nếu cần"/></label>
      <button className="button button--primary" type="submit">{state.pending?'Đang lưu…':'Tiếp nhận đơn tại kho'}</button>
    </fieldset>
    <ActionFeedback state={state}/>
  </form>;
}

export function OnlineOrderActions(props:ActionProps){
  if(props.linked)return <p>Đơn đã gắn với đơn bán. Theo dõi xử lý trong đơn bán liên quan.</p>;
  if(props.closed)return <p>Đơn đã hủy hoặc bị từ chối, không thể điều phối hoặc tiếp nhận.</p>;
  return <div className={styles.actions}>
    {props.canDispatch&&<div><h3>{props.warehouseId?'Đổi kho nhận đơn':'Giao đơn về kho'}</h3><DispatchForm key={`dispatch-${props.version}`} {...props}/></div>}
    {props.canAccept&&props.dispatchStatus==='ASSIGNED'&&<div><h3>Xác nhận tiếp nhận</h3><AcceptForm key={`accept-${props.version}`} id={props.id} version={props.version}/></div>}
    {!props.canDispatch&&props.dispatchStatus!=='ASSIGNED'&&<p>{props.dispatchStatus==='ACCEPTED'?'Kho đã tiếp nhận thông tin đơn.':'Chưa có thao tác tiếp nhận phù hợp.'}</p>}
  </div>;
}
