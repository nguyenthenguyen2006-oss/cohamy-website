'use client';
import {Fragment,useEffect,useRef,useState,type FormEvent} from 'react';
import type {mailSettings} from '@/lib/crm/document-mail';
import type {flowWorkspace} from '@/lib/crm/document-flow';
import './document-flow.css';

type Settings=Awaited<ReturnType<typeof mailSettings>>;
const blank={event:'factory.request.sent',warehouseId:null as string|null,factoryMembershipId:null as string|null,enabled:false,recipients:{to:[] as string[],cc:[] as string[],bcc:[] as string[]},subject:'{{type}} · {{code}}',body:'{{type}} {{code}}\nTrạng thái: {{status}}\nKho: {{warehouse}}\nNhà máy: {{factory}}\nNguồn: {{source}}\n{{url}}',attachments:'EVENT' as 'EVENT'|'BUNDLE',version:0,id:undefined as string|undefined};
const errorLabels:Record<string,string>={MAIL_SCOPE_NOT_SUPPORTED:'Loại chứng từ này chưa có dữ liệu để lọc theo phạm vi đã chọn.',MAIL_RECIPIENTS_REQUIRED:'Cần ít nhất một email To trước khi bật.',FORBIDDEN:'Tài khoản không có quyền thực hiện.',VERSION_CONFLICT:'Quy tắc đã thay đổi. Vui lòng tải lại.'};
const providerErrorLabels:Record<string,string>={FORBIDDEN:'Chỉ Admin được đổi cấu hình Brevo.',VERSION_CONFLICT:'Cấu hình Brevo đã được thay đổi ở nơi khác. Tải lại cấu hình trước khi lưu.',INVALID_FIELDS:'Kiểm tra lại email người gửi và API key.',BREVO_KEY_REQUIRED:'Chưa có API key. Nhập key để hoàn tất cấu hình gửi.',BREVO_ENCRYPTION_NOT_CONFIGURED:'Máy chủ chưa có khóa mã hóa hợp lệ để lưu API key. Cần quản trị máy chủ bổ sung trước khi lưu.',BREVO_SECRET_UNREADABLE:'Không đọc được API key đã lưu. Cần kiểm tra khóa mã hóa trên máy chủ hoặc nhập key mới.',BREVO_SETTINGS_UNAVAILABLE:'Không tải được cấu hình Brevo đã lưu. Tải lại cấu hình hoặc liên hệ quản trị máy chủ.'};

export function DocumentMailSettings({initialSettings,workspace}:{initialSettings:Settings;workspace:Awaited<ReturnType<typeof flowWorkspace>>}){
 const [settings,setSettings]=useState(initialSettings),[rule,setRule]=useState({...blank}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[testEmail,setTestEmail]=useState(''),[q,setQ]=useState(''),[status,setStatus]=useState(''),[event,setEvent]=useState(''),[previewDocument,setPreviewDocument]=useState(''),[preview,setPreview]=useState<Record<string,unknown>|null>(null);
 const [openRow,setOpenRow]=useState<string|null>(null),[ruleMessage,setRuleMessage]=useState(''),drafts=useRef(new Map<string,typeof blank>()),activeRow=useRef<HTMLTableRowElement|null>(null);
 const [providerSender,setProviderSender]=useState(initialSettings.provider.sender),[providerKey,setProviderKey]=useState(''),[removeProviderKey,setRemoveProviderKey]=useState(false),[providerVersion,setProviderVersion]=useState(initialSettings.provider.version),[providerMessage,setProviderMessage]=useState('');
 const definition=settings.events.find(e=>e.event===rule.event),scopes=definition?.scopes??{warehouse:false,factory:false};
 const notificationOnly=!!definition&&'notificationOnly' in definition&&definition.notificationOnly===true;
 const call=async(action:string,input:unknown)=>{const r=await fetch(`/api/crm/document-flow/${action}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}),data=await r.json();if(!r.ok)throw Error(errorLabels[data.error]??data.error);return data;};
 const act=async(fn:()=>Promise<void>,afterRefresh?:()=>void,inline=false)=>{const report=inline?setRuleMessage:setMessage;setBusy(true);report('');try{await fn();const r=await fetch('/api/crm/document-flow/mail-settings');if(!r.ok)throw Error('Không tải được cài đặt đã lưu.');setSettings(await r.json());afterRefresh?.();report('Đã lưu.');}catch(e){report(e instanceof Error?e.message:'Không thể thực hiện.');}finally{setBusy(false);}};
 const toggleRule=(key:string,event:string,existing?:Settings['rules'][number])=>{
  if(busy||!settings.events.find(e=>e.event===event)?.available)return;
  if(openRow)drafts.current.set(openRow,rule);
  setPreviewDocument('');setPreview(null);setRuleMessage('');
  if(openRow===key){setOpenRow(null);return;}
  const initial=existing?{id:existing.id,event:existing.event,warehouseId:existing.warehouse_id,factoryMembershipId:existing.factory_membership_id,enabled:existing.enabled,recipients:existing.recipients,subject:existing.subject,body:existing.body,attachments:existing.attachments,version:existing.version}:{...blank,event};
  setRule(drafts.current.get(key)??initial);setOpenRow(key);
 };
 const closeRule=()=>{if(openRow)drafts.current.set(openRow,rule);setOpenRow(null);setPreviewDocument('');setPreview(null);};
 useEffect(()=>{if(openRow)activeRow.current?.scrollIntoView({block:'start',inline:'nearest'});},[openRow]);
 const saveRule=(e:FormEvent)=>{
  e.preventDefault();const oldKey=openRow;let saved:typeof blank|null=null;
  void act(async()=>{const result=await call('save-mail-rule',{...rule,recipients:Object.fromEntries(Object.entries(rule.recipients).map(([k,v])=>[k,v.filter(Boolean)]))});saved={...rule,id:result.id,version:result.version};setRule(saved);if(oldKey)drafts.current.set(oldKey,saved);},()=>{
   if(saved){const key=`rule:${saved.id}`;if(oldKey)drafts.current.delete(oldKey);drafts.current.set(key,saved);setOpenRow(key);}
  },true);
 };
 const refreshProvider=async()=>{const r=await fetch('/api/crm/document-flow/mail-settings',{cache:'no-store'});if(!r.ok)throw Error('BREVO_REFRESH_FAILED');const fresh:Settings=await r.json();setSettings(fresh);setProviderSender(fresh.provider.sender);setProviderVersion(fresh.provider.version);return fresh.provider;};
 const saveProvider=async()=>{
  if(busy||!settings.provider.storageReady)return;
  setBusy(true);setProviderMessage('');
  try{
   const r=await fetch('/api/crm/document-flow/save-provider',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({version:providerVersion,senderEmail:providerSender.trim(),apiKey:removeProviderKey?'':providerKey,removeKey:removeProviderKey})}),result=await r.json().catch(()=>null);
   if(!r.ok)throw Error(typeof result?.error==='string'?result.error:'BREVO_SAVE_FAILED');
   // Drop the submitted secret before any follow-up request can fail.
   setProviderKey('');setRemoveProviderKey(false);setProviderVersion(typeof result?.version==='number'?result.version:providerVersion+1);
   try{await refreshProvider();setProviderMessage('Đã lưu cấu hình Brevo. Việc lưu không gửi email hoặc tự bật gửi.');}
   catch{setProviderMessage('Đã lưu cấu hình Brevo; chưa tải được trạng thái mới. Bấm Tải lại cấu hình để kiểm tra.');}
  }catch(e){setProviderMessage(providerErrorLabels[e instanceof Error?e.message:'']??'Không lưu được cấu hình Brevo. Vui lòng thử lại.');}
  finally{setBusy(false);}
 };
 const ruleEditor=openRow?(
<section className="crm-mail-rule-editor">
   <h3>Cài đặt email · {definition?.label}</h3>
   <form onSubmit={saveRule}><fieldset className="crm-mail-rule-fields" disabled={busy}>
    <div className="work-fields">
     <label>Kho<select aria-label="Kho áp dụng" disabled={!scopes.warehouse} value={rule.warehouseId??''} onChange={e=>setRule({...rule,warehouseId:e.target.value||null})}><option value="">{scopes.warehouse?'Tất cả kho':'Chưa hỗ trợ lọc kho cho loại này'}</option>{scopes.warehouse&&workspace.warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
     <label>Nhà máy<select aria-label="Nhà máy áp dụng" disabled={!scopes.factory} value={rule.factoryMembershipId??''} onChange={e=>setRule({...rule,factoryMembershipId:e.target.value||null})}><option value="">{scopes.factory?'Tất cả nhà máy':'Loại này không có phạm vi nhà máy'}</option>{scopes.factory&&workspace.factories.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
     <label>Trạng thái<select aria-label="Trạng thái quy tắc" value={String(rule.enabled)} onChange={e=>setRule({...rule,enabled:e.target.value==='true'})}><option value="false">Tắt</option><option value="true">Bật</option></select></label>
     {(['to','cc','bcc'] as const).map(group=><label key={group}>{group.toUpperCase()} (phân cách bằng dấu phẩy)<input aria-label={group.toUpperCase()} value={rule.recipients[group].join(', ')} onChange={e=>setRule({...rule,recipients:{...rule.recipients,[group]:e.target.value.split(',').map(s=>s.trim())}})}/></label>)}
     <label>File đính kèm<select aria-label="File đính kèm" disabled={notificationOnly} value={rule.attachments} onChange={e=>setRule({...rule,attachments:e.target.value as 'EVENT'|'BUNDLE'})}><option value="EVENT">{notificationOnly?'Thông báo và liên kết, không đính kèm':'Phiếu của sự kiện'}</option><option value="BUNDLE">Kèm bộ phiếu liên quan</option></select></label>
    </div>
    <label>Tiêu đề<input required maxLength={200} value={rule.subject} onChange={e=>setRule({...rule,subject:e.target.value})}/></label><label>Mẫu nội dung<textarea rows={7} required value={rule.body} onChange={e=>setRule({...rule,body:e.target.value})}/></label><p>{'Biến: {{type}}, {{code}}, {{status}}, {{warehouse}}, {{factory}}, {{source}}, {{request}}, {{date}}, {{revision}}, {{url}}'}</p>
    {notificationOnly&&<p>Sự kiện này gửi nội dung và liên kết tới hồ sơ hoặc đơn hàng. PDF giao hàng vẫn được gửi theo sự kiện xác nhận phiếu xuất / giao hàng.</p>}
    <div className="work-actions"><button className="button button--primary" disabled={busy}>Lưu cài đặt</button><button type="button" disabled={busy} onClick={closeRule}>Thu gọn cài đặt</button>
     {!notificationOnly&&<><label>Chứng từ dùng xem trước<select aria-label="Chứng từ dùng xem trước" value={previewDocument} onChange={e=>setPreviewDocument(e.target.value)}><option value="">Chọn phiên bản đã lưu</option>
      <optgroup label="Phiếu đề nghị / nhà máy / kho">{workspace.documents.filter(d=>d.state==='CONFIRMED').map(d=><option key={d.id} value={`FLOW:${d.id}`}>{d.code} · v{d.revision}</option>)}</optgroup>
      <optgroup label="Chứng từ nghiệp vụ đã chốt">{settings.businessSnapshots.filter(s=>s.event===rule.event).map(s=><option key={s.id} value={`BUSINESS:${s.id}`}>{s.code} · v{s.revision} · {s.label}</option>)}</optgroup>
     </select></label>
     <button type="button" disabled={!rule.id||!previewDocument||busy} onClick={()=>void act(async()=>{const [kind,id]=previewDocument.split(':');setPreview(await call('preview-mail-rule',{ruleId:rule.id,...(kind==='BUSINESS'?{businessSnapshotId:id}:{documentId:id})}));})}>Xem trước quy tắc email</button></>}
    </div><small>Chứng từ nghiệp vụ chỉ hiện khi đã lưu snapshot của đúng sự kiện. Xem trước không tạo email hoặc thay đổi chứng từ.</small>
   </fieldset></form>
   {ruleMessage&&<p role="status">{ruleMessage}</p>}
  </section>
 ):null;
 const renderRuleRow=(e:Settings['events'][number],r?:Settings['rules'][number])=>{
  const key=r?`rule:${r.id}`:`new:${e.event}`,expanded=openRow===key,id=`mail-rule-${key.replace(/[^a-z0-9_-]/gi,'-')}`;
  return <Fragment key={key}>
   <tr ref={expanded?activeRow:undefined} className={`crm-mail-rule-summary${expanded?' is-open':''}`} data-mail-rule={key} aria-disabled={!e.available} onClick={click=>{if(!(click.target as HTMLElement).closest('button,a,input,select,textarea'))toggleRule(key,e.event,r);}}>
    <td data-label="Luồng / Sự kiện">{e.label}</td><td data-label="Bật / Tắt">{r?.enabled?'Bật':'Tắt'}</td>
    <td data-label="Phạm vi">{r?(workspace.warehouses.find(w=>w.id===r.warehouse_id)?.name??'Tất cả kho'):(e.scopes.warehouse?'Có thể lọc kho':'Chưa hỗ trợ lọc kho')}<small>{r?(workspace.factories.find(f=>f.id===r.factory_membership_id)?.name??'Tất cả nhà máy'):(e.scopes.factory?'Có thể lọc nhà máy':'Không có phạm vi nhà máy')}</small></td>
    <td data-label="To / CC / BCC">{r?<>To: {r.recipients.to.join(', ')||'Chưa cấu hình'}<small>CC: {r.recipients.cc.join(', ')||'—'} · BCC: {r.recipients.bcc.join(', ')||'—'}</small></>:'Chưa cấu hình'}</td>
    <td data-label="Đính kèm">{r?(r.attachments==='BUNDLE'?'Bộ phiếu liên quan':'Phiếu sự kiện'):'Phiếu đã chốt'}</td>
    <td data-label="Cài đặt" className="crm-mail-rule-actions"><button type="button" id={`${id}-toggle`} aria-label={`${expanded?'Thu gọn':'Cài đặt'} ${e.label}`} aria-expanded={expanded} aria-controls={expanded?id:undefined} disabled={busy||!e.available} onClick={()=>toggleRule(key,e.event,r)}>{expanded?'Thu gọn':'Cài đặt'}<svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true"><path d={expanded?'m5 12 5-5 5 5':'m5 8 5 5 5-5'} fill="none" stroke="currentColor" strokeWidth="1.6"/></svg></button>
     {r&&<><button type="button" disabled={busy} onClick={()=>void act(async()=>{await call('remove-mail-rule',{id:r.id,version:r.version});},()=>{drafts.current.delete(key);if(openRow===key)setOpenRow(null);})}>Xóa địa chỉ & Tắt</button>{(e.scopes.warehouse||e.scopes.factory)&&<button type="button" disabled={busy} onClick={()=>toggleRule(`new:${e.event}`,e.event)}>Thêm phạm vi</button>}</>}
    </td>
   </tr>
   {expanded&&<tr className="crm-mail-rule-detail"><td colSpan={6}><div id={id} role="region" aria-labelledby={`${id}-toggle`}>{ruleEditor}</div></td></tr>}
  </Fragment>;
 };
 const p=settings.provider;
 return <div className="crm-document-flow">
  <header className="work-page-header"><h1>Thông báo hóa đơn & chứng từ</h1><p>Quy tắc áp dụng cho sự kiện tương lai. Lưu cài đặt không gửi email.</p></header>
  <section className="work-section">
   <h2>Brevo</h2><p>{p.configured?'Đã có cấu hình server':'Chưa cấu hình key / sender'} · {p.enabled?'Cho phép gửi':'Đang tắt gửi'} · {p.demo?'DEMO: mô phỏng':'Chế độ thông thường'} · Webhook: {p.webhookConfigured?'Đã cấu hình':'Chưa cấu hình'}</p><p>Địa chỉ gửi: {p.sender||'Chưa cấu hình'}</p>
   <p>{p.source==='DATABASE'?'Nguồn: cấu hình đã lưu trong CRM':p.source==='ENVIRONMENT'?'Nguồn: cấu hình môi trường máy chủ':'Chưa có cấu hình người gửi'} · {p.keyConfigured?'Đã có API key':'Chưa có API key'}</p>
   {(!p.storageReady||p.storageError)&&<p role="status">{providerErrorLabels[p.storageError??'']??'Máy chủ chưa sẵn sàng lưu cấu hình Brevo. Cần quản trị máy chủ kiểm tra khóa mã hóa.'}</p>}
   <form autoComplete="off" onSubmit={e=>{e.preventDefault();void saveProvider();}}>
    <div className="work-fields">
     <label>Email người gửi Brevo<input aria-label="Email người gửi Brevo" name="senderEmail" type="email" autoComplete="email" required maxLength={320} disabled={busy||!p.storageReady} value={providerSender} onChange={e=>setProviderSender(e.target.value)}/></label>
     <label>API key Brevo<input aria-label="API key Brevo" name="apiKey" type="password" autoComplete="new-password" spellCheck={false} autoCapitalize="none" maxLength={1024} disabled={busy||!p.storageReady||removeProviderKey} placeholder={p.keyConfigured?'Đã lưu — để trống để giữ nguyên':'Nhập API key Brevo'} value={providerKey} onChange={e=>setProviderKey(e.target.value)}/></label>
    </div>
    <label className="crm-brevo-remove-key"><input type="checkbox" checked={removeProviderKey} disabled={busy||!p.storageReady||!p.keyConfigured} onChange={e=>{setRemoveProviderKey(e.target.checked);if(e.target.checked)setProviderKey('');}}/>Xóa API key đã lưu</label>
    <p>Để trống API key để giữ nguyên key đang dùng. Cấu hình này dùng chung cho email hệ thống và RFQ; địa chỉ gửi cần được xác minh tại Brevo.</p>
    <div className="work-actions"><button className="button button--primary" disabled={busy||!p.storageReady}>Lưu cấu hình Brevo</button><button type="button" disabled={busy} onClick={()=>{setBusy(true);setProviderMessage('');void refreshProvider().then(()=>{setProviderKey('');setRemoveProviderKey(false);setProviderMessage('Đã tải lại cấu hình Brevo.');}).catch(()=>setProviderMessage('Không tải được cấu hình Brevo. Vui lòng thử lại.')).finally(()=>setBusy(false));}}>Tải lại cấu hình</button><small>Lưu cấu hình không gửi email hoặc thay đổi trạng thái cho phép gửi trên máy chủ.</small></div>
   </form>
   {providerMessage&&<p role="status">{providerMessage}</p>}
   <form className="work-actions" onSubmit={e=>{e.preventDefault();void act(async()=>{await call('test-mail',{email:testEmail});});}}><label>Email thử do Admin chọn<input aria-label="Email gửi thử" type="email" required value={testEmail} onChange={e=>setTestEmail(e.target.value)}/></label><button disabled={busy}>Gửi thử</button><small>Email thử được xếp hàng; xem lịch sử để biết kết quả.</small></form>
  </section>
  {message&&<p role="status">{message}</p>}
  <section className="work-section crm-mail-rules">
   <h2>Quy tắc người nhận</h2><div className="crm-document-scroll"><table className="work-table crm-mail-rules-table"><thead><tr><th>Luồng / Sự kiện</th><th>Bật / Tắt</th><th>Phạm vi</th><th>To / CC / BCC</th><th>Đính kèm</th><th>Cài đặt</th></tr></thead><tbody>
    {settings.events.map(e=>{
     const rules=settings.rules.filter(r=>r.event===e.event);
     return <Fragment key={e.event}>{rules.length?rules.map(r=>renderRuleRow(e,r)):renderRuleRow(e)}{rules.length>0&&openRow===`new:${e.event}`&&renderRuleRow(e)}</Fragment>;
    })}
   </tbody></table></div>
  </section>
  <section className="work-section">
   <h2>Lịch sử gửi</h2><p>Brevo đã nhận yêu cầu chưa phải thư đã giao. Kết quả không rõ được giữ lại để Admin kiểm tra trước khi gửi lại.</p>
   <div className="work-fields"><label>Tìm mã phiếu / kho / người nhận<input value={q} onChange={e=>setQ(e.target.value)}/></label><label>Loại phiếu<select value={event} onChange={e=>setEvent(e.target.value)}><option value="">Tất cả</option>{settings.events.map(e=><option disabled={!e.available} key={e.event} value={e.event}>{e.label}</option>)}</select></label><label>Trạng thái<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tất cả</option>{['PENDING','SENDING','ACCEPTED','DELIVERED','FAILED','RETRY','DEFERRED','UNKNOWN','BOUNCED','PROVIDER_DEFERRED','SIMULATED','SUPERSEDED'].map(s=><option key={s}>{s}</option>)}</select></label></div>
   <div className="crm-document-scroll"><table className="work-table"><thead><tr><th>Phiếu / Sự kiện</th><th>To / CC / BCC</th><th>Trạng thái / Số lần</th><th>File / Phiên bản</th><th>Thời gian / messageId</th><th>Lỗi / Thao tác</th></tr></thead><tbody>
    {settings.jobs.filter(j=>(!status||j.status===status)&&(!event||j.event===event)&&JSON.stringify(j).toLowerCase().includes(q.toLowerCase())).map(j=><tr key={String(j.id)}><td>{String(j.code)}<small>{String(j.event)}</small></td><td><pre>{JSON.stringify(j.recipients,null,2)}</pre></td><td>{String(j.status)}<small>Lần thử: {String(j.attempts)}</small></td><td><pre>{JSON.stringify(j.files,null,2)}</pre>v{String(j.revision)}</td><td>{String(j.created_at)}<small>{String(j.message_id??'Chưa có messageId')}</small></td><td>{String(j.last_error)}<div className="work-actions"><button onClick={()=>void act(async()=>setPreview(await call('preview-mail',{id:j.id})))}>Xem trước email</button>{j.status!=='SENDING'&&<button onClick={()=>{const reason=window.prompt('Lý do thử lại / gửi lại có chủ đích (ít nhất 5 ký tự)');if(reason&&reason.length>=5)void act(async()=>{await call('retry-mail',{id:j.id,reason,resend:!['FAILED','RETRY','DEFERRED'].includes(String(j.status))});});}}>Thử lại / Gửi lại</button>}</div></td></tr>)}
   </tbody></table></div>
  </section>
  {preview&&<div className="crm-document-modal" role="dialog" aria-modal="true" aria-label="Xem trước email"><section className="work-section"><h2>{String(preview.subject)}</h2>{typeof preview.applies==='boolean'&&<p>{preview.applies?'Đúng loại chứng từ và phạm vi quy tắc.':'Chứng từ không khớp loại hoặc phạm vi; quy tắc này sẽ không gửi.'} {preview.enabled===false?'Quy tắc đang tắt.':''}</p>}<p>{JSON.stringify(preview.recipients)}</p><pre style={{whiteSpace:'pre-wrap'}}>{String(preview.body)}</pre><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(preview.files,null,2)}</pre><button onClick={()=>setPreview(null)}>Đóng</button></section></div>}
 </div>;
}
