import type {MergeManifest} from '@/lib/crm/partner-merge';
import {stages as stageLabels} from '@/lib/crm/work-types';

export const mergeLabels:Record<string,string>={name:'Tên đơn vị',phone:'Điện thoại',email:'Email',business_id:'Mã doanh nghiệp',address:'Địa chỉ',source:'Nguồn khách',segment:'Nhóm khách',contact_name:'Người liên hệ',stage:'Giai đoạn',contactPreferences:'Cách liên hệ và sở thích',primaryContact:'Liên hệ chính',defaultAddress:'Địa chỉ mặc định'};
const stages:Record<string,string>=stageLabels;
const channels:Record<string,string>={PHONE:'Điện thoại',EMAIL:'Email',ZALO:'Zalo',IN_PERSON:'Gặp trực tiếp'};
const tableLabels:Record<string,string>={memberships:'Tài khoản đại lý',partner_assignments:'Phân công Sales',partner_tags:'Nhãn khách',partner_contacts:'Người liên hệ',dealer_addresses:'Địa chỉ',dealer_carts:'Giỏ nháp',support_tickets:'Phiếu hỗ trợ',website_orders:'Yêu cầu website',opportunities:'Cơ hội',private_documents:'Tài liệu',document_versions:'Phiên bản tài liệu',tasks:'Công việc',care_schedules:'Lịch chăm sóc',partner_library:'Thư viện riêng',partner_applications:'Hồ sơ đăng ký',partner_invitations:'Link mời',activities:'Ghi chú',partner_visits:'Nhật ký thăm',opportunity_history:'Lịch sử cơ hội',audit_events:'Lịch sử thao tác',contact_preferences:'Sở thích cũ',custom_values:'Giá trị trường bổ sung',custom_value_history:'Lịch sử trường bổ sung',workspace_drafts:'Nháp cá nhân',workspace_bookmarks:'Hồ sơ ghim',notifications:'Thông báo',support_messages:'Trao đổi hỗ trợ',care_rule_runs:'Lịch sử quy tắc',care_schedule_runs:'Lịch sử lịch chăm sóc',activity_mentions:'Lượt nhắc',task_checklist:'Checklist',task_dependencies:'Việc phụ thuộc',task_watchers:'Người theo dõi',care_escalations:'Lịch sử chuyển cấp',application_history:'Lịch sử xét duyệt'};
Object.assign(tableLabels,{quotations:'Báo giá hiện hành',quotation_versions:'Phiên bản báo giá',quotation_events:'Lịch sử báo giá',quotation_pdfs:'PDF báo giá',organization_pricing:'Cấp giá nguồn'});
const value=(field:string,text:string)=>text?(field==='stage'?stages[text]??text:text):'Chưa ghi nhận';
function preferences(row:Record<string,unknown>|null) {
 if(!row)return 'Chưa có cách liên hệ hoặc sở thích';
 return (channels[String(row.channel)]??String(row.channel))+' · '+(String(row.preferred_time)||'Chưa chọn giờ')+' · '+(String(row.notes)||'Chưa có ghi chú')+' · SKU quan tâm: '+(Array.isArray(row.interested_skus)&&row.interested_skus.length?row.interested_skus.join(', '):'Chưa chọn');
}
const address=(row:Record<string,unknown>|null)=>row?String(row.label)+' · '+String(row.recipient)+' · '+String(row.address):'Không có địa chỉ mặc định sau gộp';
export function PartnerMergeDetails({manifest,choices,historical=false}:{manifest:MergeManifest;choices?:Record<string,string>;historical?:boolean}) {
 const s=manifest.settings;
 return <>
  {historical&&<p>Giá trị được lưu tại thời điểm gộp; thông tin hiện tại của hồ sơ có thể đã thay đổi.</p>}
  {choices&&<dl className="work-facts">{Object.entries(choices).map(([field,choice])=><div key={field}><dt>{mergeLabels[field]??field} · Lựa chọn đã lưu</dt><dd>{choice==='SOURCE'?'Lấy từ hồ sơ nguồn':'Giữ từ hồ sơ đích'}</dd></div>)}</dl>}
  <dl className="work-facts">{manifest.fields.map(f=><div key={f.field}><dt>{mergeLabels[f.field]}</dt><dd>{value(f.field,f.before)} → {value(f.field,f.after)}</dd></div>)}</dl>
  <h4>Kết quả liên hệ và mặc định sau gộp</h4>
  <dl className="work-facts">
   <div><dt>Cách liên hệ và sở thích</dt><dd>{preferences(s.outcome.preferences)}</dd></div>
   <div><dt>Liên hệ chính</dt><dd>{s.outcome.primaryContact?String(s.outcome.primaryContact.name):'Không có liên hệ chính sau gộp; các dấu liên hệ chính trước đó được bỏ'}</dd></div>
   <div><dt>Địa chỉ mặc định</dt><dd>{address(s.outcome.defaultAddress)}</dd></div>
  </dl>
  {s.outcome.preferenceFallback&&<p>Hồ sơ nguồn chưa có cách liên hệ và sở thích: giữ thông tin đích hiện có, không xóa thông tin đích.</p>}
  <details className="work-disclosure"><summary>Thông tin liên hệ và mặc định trước khi gộp</summary>
   {s.preferences.map((p,i)=><p key={'prefs-'+i}>{p.organization_id===manifest.source.id?'Hồ sơ nguồn':'Hồ sơ đích'}: {preferences(p)}</p>)}
   {s.primaryContacts.map((c,i)=><p key={'primary-'+i}>Liên hệ chính {c.organization_id===manifest.source.id?'nguồn':'đích'}: {String(c.name)}</p>)}
   {s.defaultAddresses.map((a,i)=><p key={'address-'+i}>Địa chỉ mặc định {a.organization_id===manifest.source.id?'nguồn':'đích'}: {address(a)}</p>)}
  </details>
  <h4>Liên kết bị ảnh hưởng</h4>
  {manifest.groups.length?manifest.groups.map(g=><details className="work-disclosure" key={g.table}><summary>{tableLabels[g.table]??'Liên kết nguồn'} · {g.count} · {g.retained?'Giữ nguyên nguồn lịch sử':'Theo hồ sơ đích'}</summary><ul>{g.items.map((item,i)=><li key={item.id+'-'+i}>{item.label}</li>)}</ul></details>):<p>Chưa có liên kết.</p>}
 </>;
}
