'use client';
import {useRef,useState,useSyncExternalStore,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {accountAssignableRoles,roleLabels,roleOrganizationKind,type Role,type Organization} from '@/lib/crm/types';
import {accountStateLabels} from '@/lib/crm/account-provision-model';
const messages:Record<string,string>={ACCOUNT_ALREADY_EXISTS:'Email đã có tài khoản. Mở tài khoản hiện có để quản lý.',DUPLICATE_RECORD:'Email đã tồn tại.',ROLE_ORGANIZATION_MISMATCH:'Chọn tổ chức đang hoạt động và đúng loại với vai trò.',BUYER_ROLE_CONFLICT:'Hồ sơ này đã được cấp loại tài khoản khách hàng/siêu thị khác.',INVITATION_RATE_LIMITED:'Chờ ít nhất 60 giây trước khi gửi lại; tối đa 5 lời mời/tài khoản/giờ.',INVITATION_EXISTS_USE_RESEND:'Đã phát hành lời mời. Chọn gửi lại để thay liên kết cũ.',FORBIDDEN:'Bạn không có quyền cấp tài khoản.',INVALID_FIELDS:'Kiểm tra email, tên, vai trò và tổ chức.'};
async function post(url:string,input:unknown){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}),data=await r.json();if(!r.ok)throw new Error(messages[data.error]??'Chưa thực hiện được. Tải lại để kiểm tra trạng thái trước khi thử lại.');return data;}
export function AccountProvisionForm({organizations}:{organizations:Pick<Organization,'id'|'name'|'kind'>[]}){
 const ready=useSyncExternalStore(()=>()=>{},()=>true,()=>false),router=useRouter(),busy=useRef(false),key=useRef(''),last=useRef('');
 const [role,setRole]=useState<Role>('CUSTOMER'),[loginMethod,setLoginMethod]=useState<'INVITATION'|'GENERATED'>('INVITATION');
 const [pending,setPending]=useState(false),[error,setError]=useState(''),[created,setCreated]=useState<{membershipId:string;email:string;generatedPassword?:string;loginPath:string}|null>(null);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy.current||created)return;busy.current=true;setPending(true);setError('');
  const f=new FormData(e.currentTarget),input={email:String(f.get('email')),displayName:String(f.get('displayName')),role,organizationId:String(f.get('organizationId')),loginMethod},fingerprint=JSON.stringify(input);
  if(last.current!==fingerprint){key.current=crypto.randomUUID();last.current=fingerprint;}
  try{
   const account=await post('/api/crm/accounts/provision',{...input,idempotencyKey:key.current});
   if(loginMethod==='GENERATED'){setCreated({membershipId:account.membershipId,email:account.email,generatedPassword:account.generatedPassword,loginPath:account.loginPath});return;}
   if(f.get('invite')==='on'){
    try{await post('/api/crm/accounts/invitations',{membershipId:account.membershipId,action:'SEND',idempotencyKey:crypto.randomUUID()});}
    catch{router.push('/crm/accounts/'+account.membershipId);router.refresh();return;}
   }
   router.push('/crm/accounts/'+account.membershipId);router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Chưa lưu được.');}finally{busy.current=false;setPending(false);}
 }
 if(created)return <section className="form-card"><h2>Tài khoản đã sẵn sàng đăng nhập</h2><p>Email: <strong>{created.email}</strong> · Đăng nhập tại {created.loginPath}</p>{created.generatedPassword?<><label className="field">Mật khẩu tự sinh<input readOnly autoComplete="off" value={created.generatedPassword}/></label><p>Mật khẩu chỉ hiển thị trong lần cấp này. Người nhận dùng được ngay, có thể giữ hoặc tự đổi sau.</p></>:<p>Lần cấp trước đã hoàn tất. Mật khẩu không được trả lại khi thử lại. Nếu chưa lưu, người nhận có thể dùng chức năng Quên mật khẩu.</p>}<button type="button" className="button button--primary" onClick={()=>{const id=created.membershipId;setCreated(null);router.push('/crm/accounts/'+id);router.refresh();}}>Đã lưu, mở tài khoản</button></section>;
 return <form className="crm-record-form form-card" method="post" action="/api/crm/accounts/provision" onSubmit={submit}>
  <div className="crm-form-grid">
   <div className="field"><label htmlFor="provision-name">Tên hiển thị</label><input id="provision-name" name="displayName" minLength={2} maxLength={120} required/></div>
   <div className="field"><label htmlFor="provision-email">Email</label><input id="provision-email" name="email" type="email" required/></div>
   <div className="field"><label htmlFor="provision-role">Vai trò</label><select id="provision-role" value={role} onChange={e=>setRole(e.target.value as Role)}>{accountAssignableRoles.map(r=><option key={r} value={r}>{roleLabels[r]}</option>)}</select></div>
   <div className="field"><label htmlFor="provision-org">Tổ chức sở hữu</label><select id="provision-org" name="organizationId" key={role} required><option value="">Chọn tổ chức</option>{organizations.filter(o=>o.kind===roleOrganizationKind(role)).map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
   <div className="field"><label htmlFor="provision-login-method">Cách cấp đăng nhập</label><select id="provision-login-method" value={loginMethod} onChange={e=>setLoginMethod(e.target.value as 'INVITATION'|'GENERATED')}><option value="INVITATION">Lời mời tự đặt mật khẩu</option><option value="GENERATED">Tự sinh mật khẩu, dùng ngay</option></select></div>
  </div>
  {loginMethod==='INVITATION'?<><p>Tài khoản chờ kích hoạt chưa thể đăng nhập. Người nhận tự đặt mật khẩu qua liên kết dùng một lần, có hiệu lực 24 giờ.</p><label className="work-check"><input type="checkbox" name="invite" defaultChecked/>Tạo và gửi lời mời kích hoạt qua email</label></>:<p>Hệ thống sinh mật khẩu ngẫu nhiên riêng, hiển thị một lần sau khi cấp. Tài khoản dùng được ngay, không bắt buộc đổi mật khẩu và không gửi email trong chế độ này.</p>}
  <p className="work-help">Tài khoản nội bộ thuộc Cohamy; khách hàng và siêu thị chọn hồ sơ Khách hàng tương ứng, đăng nhập tại /portal và chỉ xem dữ liệu của mình.</p>
  {error&&<p role="alert">{error}</p>}<button type="submit" className="button button--primary" disabled={!ready||pending}>{pending?'Đang xử lý…':'Tạo tài khoản'}</button>
 </form>;
}
export function AccountInvitationTools({membershipId,hasInvitation}:{membershipId:string;hasInvitation:boolean}){
 const router=useRouter(),busy=useRef(false),retry=useRef<{action:string;key:string}|null>(null),[pending,setPending]=useState(false),[message,setMessage]=useState('');
 async function perform(action:string){if(busy.current)return;busy.current=true;setPending(true);if(retry.current?.action!==action)retry.current={action,key:crypto.randomUUID()};try{const r=await post('/api/crm/accounts/invitations',{membershipId,action,idempotencyKey:retry.current!.key});setMessage(accountStateLabels[r.status]??r.status);retry.current=null;router.refresh();}catch(e){setMessage(e instanceof Error?e.message:'Chưa xử lý được.');}finally{busy.current=false;setPending(false);}}
 return <div><button type="button" className="button button--primary" disabled={pending} onClick={()=>perform(hasInvitation?'RESEND':'SEND')}>{hasInvitation?'Gửi lại lời mời':'Gửi lời mời kích hoạt'}</button>{hasInvitation&&<button type="button" className="button button--secondary" disabled={pending} onClick={()=>perform('REVOKE')}>Thu hồi lời mời</button>}<p role="status">{message}</p></div>;
}
