'use client';
import Link from 'next/link';
import {useEffect,useId,useRef,useState,useMemo} from 'react';
import {useRouter} from 'next/navigation';
import type {Organization} from '@/lib/crm/types';
import {send} from './UpgradeForms';
import {CrmSpreadsheet, type SpreadsheetColumn} from './spreadsheet/CrmSpreadsheet';

const columnLabels:Record<string,string>={name:'Hồ sơ',code:'Mã',phone:'Điện thoại',email:'Email',active:'Trạng thái',created_at:'Tạo lúc'};
const stageLabels:Record<string,string>={LEAD:'Tiềm năng',CONTACTED:'Đã liên hệ',ACTIVE:'Đang hoạt động',INACTIVE:'Tạm dừng'};

export function PartnerTable({items,root,columns,widths={},totalCount,canWrite=true}:{items:Organization[];root:string;columns:string[];widths?:Record<string,number>;totalCount?:number;canWrite?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null),[selected,setSelected]=useState<Organization|null>(null),[error,setError]=useState('');

 const openQuickDialog=async(item:Organization)=>{
  setError('');
  try{
   const r=await fetch('/api/crm/partners/'+item.id,{cache:'no-store'});
   if(!r.ok)throw new Error();
   const fresh=await r.json();
   setSelected(fresh.item);
   dialog.current?.showModal();
  }catch{
   setError('Chưa mở được hồ sơ. Kiểm tra kết nối và quyền truy cập.');
  }
 };

 const sheetColumns=useMemo<SpreadsheetColumn<Organization>[]>(()=>{
  const baseCols:Record<string,SpreadsheetColumn<Organization>>={
   name:{
    key:'name',
    label:'Hồ sơ',
    type:'text',
    width:widths.name??240,
    sticky:true,
    editable:canWrite,
    validate:v=>v.trim().length<2?'Tên hồ sơ tối thiểu 2 ký tự':null,
    getValue:r=>r.name,
    renderCell:r=>(
     <Link className="table-primary" href={root+'/'+r.id}>
      <strong>{r.name}</strong>
      <span>{r.code}</span>
     </Link>
    ),
   },
   code:{
    key:'code',
    label:'Mã',
    type:'code',
    width:widths.code??140,
    sticky:true,
    editable:canWrite,
    validate:v=>/^[A-Za-z0-9_-]{2,40}$/.test(v.trim())?null:'Mã chỉ gồm chữ, số, gạch ngang/dưới (2–40 ký tự)',
    getValue:r=>r.code,
   },
   phone:{
    key:'phone',
    label:'Điện thoại',
    type:'phone',
    width:widths.phone??140,
    editable:canWrite,
    getValue:r=>r.phone??'',
   },
   email:{
    key:'email',
    label:'Email',
    type:'text',
    width:widths.email??190,
    editable:canWrite,
    getValue:r=>r.email??'',
   },
   contact_name:{
    key:'contact_name',
    label:'Người liên hệ',
    type:'text',
    width:155,
    editable:canWrite,
    getValue:r=>r.contact_name??'',
   },
   stage:{
    key:'stage',
    label:'Giai đoạn chăm sóc',
    type:'status',
    width:145,
    groupable:true,
    editable:canWrite,
    editorType:'select',
    editorOptions:[
     {value:'LEAD',label:'Tiềm năng (LEAD)'},
     {value:'CONTACTED',label:'Đã liên hệ (CONTACTED)'},
     {value:'ACTIVE',label:'Đang hoạt động (ACTIVE)'},
     {value:'INACTIVE',label:'Tạm dừng (INACTIVE)'},
    ],
    getValue:r=>r.stage??'ACTIVE',
    renderCell:r=><span className="status-badge status-in_progress">{stageLabels[r.stage??'ACTIVE']??r.stage??'Đang hoạt động'}</span>,
   },
   address:{
    key:'address',
    label:'Địa chỉ',
    type:'text',
    width:210,
    editable:canWrite,
    getValue:r=>r.address??'',
   },
   active:{
    key:'active',
    label:'Trạng thái',
    type:'status',
    width:widths.active??128,
    groupable:true,
    getValue:r=>r.active?'Hoạt động':'Đã khóa',
    renderCell:r=><span className={`status-badge ${r.active?'status-ready':'status-rejected'}`}>{r.active?'Hoạt động':'Đã khóa'}</span>,
   },
   created_at:{
    key:'created_at',
    label:'Tạo lúc',
    type:'date',
    width:widths.created_at??120,
    getValue:r=>new Date(r.created_at).toLocaleDateString('vi-VN'),
   },
   quick_view:{
    key:'quick_view',
    label:'Xem nhanh',
    type:'text',
    align:'center',
    width:120,
    sortable:false,
    filterable:false,
    groupable:false,
    getValue:()=>'',
    renderCell:item=>(
     <button
      className="button button--secondary"
      onClick={()=>void openQuickDialog(item)}
      type="button"
      aria-label={'Xem nhanh '+item.name}
     >
      Xem nhanh
     </button>
    ),
   },
  };

  const orderedKeys=[...columns];
  for(const extra of ['contact_name','stage','address','name','code','phone','email','active','created_at']){
   if(!orderedKeys.includes(extra))orderedKeys.push(extra);
  }
  orderedKeys.push('quick_view');
  return orderedKeys.map(k=>baseCols[k]).filter(Boolean);
 },[columns,widths,root,canWrite]);

 const visibleKeysWithQuick=useMemo(()=>[...columns,'quick_view'],[columns]);

 return (
  <>
   <CrmSpreadsheet
    key={JSON.stringify([columns,widths])}
    sheetKey={`partners_${root.replace(/\W+/g,'_')}`}
    columns={sheetColumns}
    rows={items}
    getRowKey={r=>r.id}
    getRowVersion={r=>r.version}
    controlledVisibleKeys={visibleKeysWithQuick}
    controlledColumnWidths={{...widths,quick_view:120}}
    batchSaveEndpoint={canWrite?'/api/crm/spreadsheet/partner-cells':undefined}
    totalDatasetCount={totalCount??items.length}
    drawerTitle={r=>`${r.name} (${r.code})`}
    drawerFullPageHref={r=>`${root}/${r.id}`}
    renderDrawer={r=>(
     <div className="crm-drawer-stack">
      <div className="crm-drawer-kv-grid">
       <div><span>Mã hồ sơ</span><strong>{r.code}</strong></div>
       <div><span>Phiên bản</span><strong>v{r.version}</strong></div>
       <div><span>Người liên hệ</span><strong>{r.contact_name||'Chưa ghi nhận'}</strong></div>
       <div><span>Điện thoại</span><strong>{r.phone||'Chưa ghi nhận'}</strong></div>
       <div><span>Email</span><strong>{r.email||'Chưa ghi nhận'}</strong></div>
       <div><span>Mã số thuế / ĐKKD</span><strong>{r.business_id||'Chưa ghi nhận'}</strong></div>
       <div><span>Giai đoạn</span><strong>{stageLabels[r.stage??'ACTIVE']??r.stage}</strong></div>
       <div><span>Trạng thái</span><strong>{r.active?'Đang hoạt động':'Đã khóa'}</strong></div>
      </div>
      <div className="crm-drawer-note">
       <strong>Địa chỉ giao dịch:</strong> {r.address||'Chưa ghi nhận'}
      </div>
      <div className="crm-drawer-links">
       {r.phone&&<a className="btn secondary" href={'tel:'+r.phone.replace(/[^+0-9]/g,'')}>Gọi {r.phone}</a>}
       <Link className="btn primary" href={`${root}/${r.id}`}>Mở hồ sơ đầy đủ & Lịch sử chăm sóc ↗</Link>
      </div>
     </div>
    )}
   />
   {error&&<p role="alert" className="form-error">{error}</p>}
   <dialog className="upgrade-detail-dialog" ref={dialog} aria-labelledby="quick-detail-title">
    {selected&&(
     <>
      <form method="dialog"><button className="button button--secondary">Đóng chi tiết</button></form>
      <h2 id="quick-detail-title">{selected.name}</h2>
      <p>{selected.code}</p>
      <dl className="crm-readonly">
       <dt>Điện thoại</dt><dd>{selected.phone||'Chưa ghi nhận'}</dd>
       <dt>Email</dt><dd>{selected.email||'Chưa ghi nhận'}</dd>
       <dt>Địa chỉ</dt><dd>{selected.address||'Chưa ghi nhận'}</dd>
      </dl>
      <div className="upgrade-actions">
       {selected.phone&&<a className="button button--secondary" href={'tel:'+selected.phone.replace(/[^+0-9]/g,'')}>Gọi</a>}
       <Link className="button button--primary" href={root+'/'+selected.id}>Mở hồ sơ đầy đủ</Link>
      </div>
     </>
    )}
   </dialog>
  </>
 );
}

export function ColumnPicker({pref}:{pref:Record<string,unknown>}){const router=useRouter(),[error,setError]=useState(''),[pending,setPending]=useState(false);return <details className="work-disclosure"><summary>Chọn cột hiển thị</summary><form className="work-form" onSubmit={async e=>{e.preventDefault();setPending(true);setError('');const fd=new FormData(e.currentTarget);try{await send('/api/crm/workspace/preferences',{...pref,columns:fd.getAll('columns')});router.refresh();}catch(err){setError((err as Error).message);}finally{setPending(false);}}}><fieldset className="upgrade-columns"><legend>Các cột hồ sơ</legend>{Object.entries(columnLabels).map(([key,label])=><label key={key}><input name="columns" type="checkbox" value={key} defaultChecked={(pref.columns as string[]).includes(key)}/>{label}</label>)}</fieldset><button className="button button--secondary" disabled={pending}>Lưu lựa chọn cột</button>{error&&<p role="alert" className="form-error">{error}</p>}</form></details>;}
export function SaveFilterForm({kind,q,tags=''}:{kind:string;q:string;tags?:string}){const busy=useRef(false),[pending,setPending]=useState(false),[name,setName]=useState(''),[shared,setShared]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(false);return <details className="work-disclosure"><summary>Lưu bộ lọc hiện tại</summary><form className="work-form" onSubmit={async e=>{e.preventDefault();if(busy.current)return;busy.current=true;setPending(true);setError('');setSuccess(false);try{await send('/api/crm/workspace/filter',{name,resource:'partners',value:{kind,q,tags},shared});setSuccess(true);}catch(err){setError((err as Error).message);}finally{busy.current=false;setPending(false);}}}><label>Tên bộ lọc<input required value={name} onChange={e=>{setName(e.target.value);setSuccess(false);}} minLength={2} maxLength={80}/></label><label className="upgrade-inline"><input type="checkbox" checked={shared} onChange={e=>setShared(e.target.checked)}/>Dùng chung (quản trị/quản lý)</label><button className="button button--secondary" disabled={pending}>{pending?'Đang lưu…':'Lưu bộ lọc'}</button>{error&&<p role="alert" className="form-error">{error}</p>}{success&&<p role="status" className="form-success">Đã lưu vào Không gian cá nhân.</p>}</form></details>;}
export function RecordActions({type,id,phone,address}:{type:'partner'|'order';id:string;phone?:string;address?:string}){useEffect(()=>{send('/api/crm/workspace/bookmark',{entityType:type,entityId:id}).catch(()=>{});},[type,id]);const [feedback,setFeedback]=useState('');return <div className="upgrade-actions"><button className="button button--secondary" type="button" onClick={async()=>{try{await send('/api/crm/workspace/bookmark',{entityType:type,entityId:id,pinned:true});setFeedback('Đã ghim.');}catch(err){setFeedback((err as Error).message);}}}>Ghim hồ sơ</button>{phone&&<><a className="button button--secondary" href={'tel:'+phone.replace(/[^+0-9]/g,'')}>Gọi {phone}</a><button className="button button--secondary" type="button" onClick={async()=>{try{await navigator.clipboard.writeText(phone);setFeedback('Đã sao chép điện thoại.');}catch{setFeedback('Chọn và sao chép số điện thoại: '+phone);}}}>Sao chép số</button></>}{address&&<a className="button button--secondary" href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address)} target="_blank" rel="noopener noreferrer">Bản đồ</a>}{feedback&&<p role="status">{feedback}</p>}</div>;}
export function DraftNoteForm({type,id,initial,mentions=[]}:{mentions?:{id:string;name:string}[];type:'partner'|'order';id:string;initial:{value:Record<string,string>;version:number}|null}){const fieldId=useId(),router=useRouter(),[body,setBody]=useState(initial?.value.body??''),[mentioned,setMentioned]=useState<string[]>([]),bodyRef=useRef(body),version=useRef(initial?.version??0),[message,setMessage]=useState(initial?'Đã khôi phục nháp.':''),timer=useRef<ReturnType<typeof setTimeout>|null>(null),[pending,setPending]=useState(false),saving=useRef<Promise<void>|null>(null),lastSaved=useRef(body);bodyRef.current=body;
 async function persist(){if(saving.current){await saving.current;return persist();}if(bodyRef.current===lastSaved.current)return;const text=bodyRef.current;setMessage('Đang lưu nháp…');saving.current=(async()=>{try{const r=await send('/api/crm/workspace/draft',{key:'note-'+id,entityType:type,entityId:id,version:version.current,value:{body:text}});version.current=r.version;lastSaved.current=text;setMessage('Đã lưu nháp.');}catch(err){setMessage((err as Error).message);throw err;}})();try{await saving.current;}finally{saving.current=null;}}
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 return <form className="work-form" onSubmit={async e=>{e.preventDefault();if(pending)return;setPending(true);if(timer.current)clearTimeout(timer.current);try{await persist();await send('/api/crm/work/activity',{entityType:type,entityId:id,body,mentionedMembershipIds:mentioned});setMentioned([]);setBody('');bodyRef.current='';await persist();setMessage('Đã thêm vào lịch sử chăm sóc.');router.refresh();}catch(err){setMessage((err as Error).message);}finally{setPending(false);}}}><div className="upgrade-draft-field"><label htmlFor={fieldId}>Nội dung trao đổi</label><textarea id={fieldId} name="body" value={body} maxLength={4000} rows={3} required onChange={e=>{setBody(e.target.value);bodyRef.current=e.target.value;if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{persist().catch(()=>{});},700);}}/></div>{mentions.length>0&&<fieldset className="upgrade-columns"><legend>Nhắc người có quyền xem hồ sơ</legend>{mentions.map(m=><label key={m.id}><input type="checkbox" checked={mentioned.includes(m.id)} onChange={e=>setMentioned(e.target.checked?[...mentioned,m.id]:mentioned.filter(id=>id!==m.id))}/>{m.name}</label>)}</fieldset>}<div className="work-form-footer"><button className="button button--primary" disabled={pending}>{pending?'Đang lưu…':'Thêm ghi chú'}</button>{message&&<p role="status">{message}</p>}</div></form>;}
