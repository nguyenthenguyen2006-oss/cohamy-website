'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {send} from './UpgradeForms';

export function TicketForm({id,internalAllowed=false}:{id?:string;internalAllowed?:boolean}){
  const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState(''),key=useRef<string|null>(null);
  return (
    <form className="work-form" onSubmit={async e=>{
      e.preventDefault();
      if(busy)return;
      setBusy(true);
      setError('');
      const form=e.currentTarget,fd=new FormData(form);
      key.current??=crypto.randomUUID();
      try{
        const r=await send('/api/crm/portal/'+(id?'reply':'ticket'),id?{id,body:fd.get('body'),internal:fd.get('internal')==='on',idempotencyKey:key.current}:{title:fd.get('title'),body:fd.get('body'),idempotencyKey:key.current});
        key.current=null;
        form.reset();
        if(!id)router.push('/portal/support/'+r.id);
        router.refresh();
      }catch(err){
        setError((err as Error).message);
      }finally{
        setBusy(false);
      }
    }}>
      {!id&&<label>Chủ đề hỗ trợ<input name="title" required minLength={2} maxLength={240}/></label>}
      <label>{id?'Nội dung phản hồi':'Nội dung cần hỗ trợ'}<textarea name="body" required minLength={id?1:5} maxLength={4000}/></label>
      {internalAllowed&&<label className="upgrade-inline"><input type="checkbox" name="internal"/>Ghi chú nội bộ (đại lý không đọc được)</label>}
      <button className="button button--primary" disabled={busy}>{busy?'Đang lưu…':id?'Gửi phản hồi':'Tạo phiếu hỗ trợ'}</button>
      {error&&<p role="alert" className="form-error">{error}</p>}
    </form>
  );
}
