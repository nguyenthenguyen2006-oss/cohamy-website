import Link from 'next/link';
import {database} from '@/lib/crm/db';
import {can} from '@/lib/crm/permissions';
import {listCatalog} from '@/lib/crm/repository';
import {listMembershipLevels,listPromotions,listTransferRequests,networkOverview,networkRequests,orderCatalog,partnerChannelProfile,receivedMaxBp,regionWarehouses,requestManagementChain} from '@/lib/crm/channel';
import {currentPeriodKey,incentiveProgress,listIncentivePrograms,periodSalesReport,type PeriodType,type PeriodView} from '@/lib/crm/period-reports';
import {partnerTypeLabels,percentText,promotionScopeLabels,badgeLabels,regionLabels,rewardLabels,periodLabels,transferStatusLabels} from '@/lib/crm/channel-labels';
import type {Principal} from '@/lib/crm/types';
import {AwardForm,ChildDiscountForm,IncentiveForm,InvoiceRecipientForm,LevelForm,OrderCatalog,PartnerProfileForm,PromotionForm,PromotionToggle,ShortageForm,TransferDecisionForm,TransferRequestForm} from './ChannelForms';

/** Meeting 12/10 — server pages and panels for the distribution channel. */
function Header({title,description}:{title:string;description:string}){return <header className="portal-page-header"><div><h1>{title}</h1><p>{description}</p></div></header>;}
const money=(v:string|null|undefined)=>v?BigInt(v.split('.')[0]).toLocaleString('vi-VN')+' đ':'—';
const date=(v:string|null)=>v?new Date(v).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—';
const qty=(v:string)=>v.replace(/\.?0+$/,'')||'0';
function Table({caption,head,rows}:{caption:string;head:string[];rows:React.ReactNode[][]}){
 return <div className="crm-table-wrap" role="region" aria-label={caption} tabIndex={0}><table className="data-table"><caption className="sr-only">{caption}</caption><thead><tr>{head.map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div>;
}

// ---------------------------------------------------------------------------
// CRM: Mạng lưới, hạng & khuyến mãi
// ---------------------------------------------------------------------------
export async function NetworkPage({user,query}:{user:Principal;query:Record<string,string>}){
 const [network,levels,promotions,transfers,products]=await Promise.all([networkOverview(user),listMembershipLevels(),listPromotions(user),listTransferRequests(user),listCatalog(user)]);
 const levelChoices=levels.filter(l=>l.active).map(l=>({id:l.id,name:l.name})),partnerChoices=network.partners.filter(p=>p.partnerType!=='END_CUSTOMER').map(p=>({id:p.id,name:p.name}));
 const anchorFilter=query.anchor??'';const list=network.partners.filter(p=>!anchorFilter||(anchorFilter==='none'?!p.anchorId:p.anchorId===anchorFilter));
 return <><Header title="Mạng lưới, hạng & khuyến mãi" description="Cổ đông / đầu mối và cây phân phối, hạng thành viên, chính sách khuyến mãi và yêu cầu chuyển cây. Quản trị thấy toàn bộ."/>
  <section className="work-section"><h2>Cổ đông / đầu mối</h2>
   {network.shareholders.length?<Table caption="Cổ đông" head={['Cổ đông','Hạng','Vùng','Thành viên trong cây','']} rows={network.shareholders.map(s=>[<Link key="n" href={'/crm/dealers/'+s.id}>{s.name}</Link>,s.levelName??'—',s.region?regionLabels[s.region]:'—',String(s.members),<Link key="f" href={'/crm/network?anchor='+s.id}>Xem cây</Link>])}/>
   :<p className="crm-status-note">Chưa có cổ đông. Mở hồ sơ đại lý, chọn “Cổ đông / đầu mối” ở mục Hồ sơ kênh. Mỗi cổ đông có chính sách chiết khấu riêng (VD: 50% về công ty) do doanh nghiệp tự nhập.</p>}
   <p className="work-help">{network.unanchored} đối tác chưa thuộc cây cổ đông nào. <Link href="/crm/network?anchor=none">Xem danh sách</Link> · <Link href="/crm/period-sales?view=NETWORK">Xếp hạng doanh số theo đầu mối</Link></p>
  </section>
  <section className="work-section"><h2>Đối tác trong mạng lưới{anchorFilter?' (đang lọc)':''}</h2>{anchorFilter&&<Link className="work-back" href="/crm/network">Bỏ lọc</Link>}
   <Table caption="Đối tác" head={['Đối tác','Loại','Hạng','Vùng','Quản lý trực tiếp','Cổ đông']} rows={list.slice(0,300).map(p=>[<Link key="n" href={'/crm/'+(p.partnerType==='END_CUSTOMER'?'customers':'dealers')+'/'+p.id}>{p.name}</Link>,partnerTypeLabels[p.partnerType]??p.partnerType,p.levelName??'—',p.region?regionLabels[p.region]:'—',p.parentName??'Cohamy',p.anchorName??'—'])}/>
  </section>
  <section className="work-section"><h2>Hạng thành viên</h2><p className="work-help">Chiết khấu mặc định theo hạng áp dụng khi đối tác chưa có chiết khấu riêng. Để trống = chưa cấu hình (không giảm).</p>
   <Table caption="Hạng" head={['Hạng','Cách tính','Chiết khấu','Trạng thái']} rows={levels.map(l=>[<span key="n" style={{color:l.color,fontWeight:600}}>{l.name}</span>,l.method==='FIXED_PERCENT'?'Cố định':'Theo bậc số lượng',l.method==='FIXED_PERCENT'?percentText(l.fixed_percent_bp):l.tiers.map(t=>`${t.minQuantity}–${t.maxQuantity??'∞'}: ${t.discountPercent}%`).join('; ')||'Chưa cấu hình',l.active?'Đang dùng':'Tạm dừng'])}/>
   {levels.map(l=><details key={l.id} className="work-disclosure"><summary>Cấu hình hạng {l.name}</summary><LevelForm level={l}/></details>)}
  </section>
  <section className="work-section"><h2>Khuyến mãi theo sản phẩm</h2>
   {promotions.length?<Table caption="Khuyến mãi" head={['Sản phẩm','Tên / chiến dịch','Giảm','Cơ chế','Nhãn','Hiệu lực','Trạng thái','']} rows={promotions.map(p=>[p.sku+' · '+p.product_name,p.name+(p.campaign?' · '+p.campaign:''),percentText(p.promo_percent_bp),promotionScopeLabels[p.scope]+(p.scope==='QUANTITY'?' ≥ '+qty(p.min_base_quantity):p.scope==='DESIGNATED'?` (${p.target_level_ids.length} hạng, ${p.target_organization_ids.length} đối tác)`:''),p.badge?badgeLabels[p.badge]:'—',date(p.starts_at)+' → '+date(p.ends_at),p.active?'Đang bật':'Tạm dừng',<details key="t" className="work-disclosure"><summary>{p.active?'Tạm dừng':'Bật lại'}</summary><PromotionToggle id={p.id} version={p.version} active={p.active}/></details>])}/>:<p>Chưa có khuyến mãi.</p>}
   <details className="work-disclosure"><summary>Tạo khuyến mãi mới</summary><PromotionForm products={products.filter(p=>p.active).map(p=>({sku:p.sku,name:p.name}))} levels={levelChoices} partners={partnerChoices}/></details>
  </section>
  <section className="work-section"><h2>Yêu cầu chuyển cây</h2>
   {transfers.length?<ul className="work-task-list">{transfers.map(t=><li key={t.id}><div><strong>{t.organization_name}</strong>: {t.from_name??'Cohamy'} → {t.to_name}<p>{transferStatusLabels[t.status]} · {t.requester_name} ({t.requested_by_name}) · {date(t.created_at)} · {t.reason}{t.decision_reason?' · Quyết định: '+t.decision_reason:''}</p>{t.status==='PENDING'&&<TransferDecisionForm id={t.id}/>}</div></li>)}</ul>:<p>Chưa có yêu cầu.</p>}
   <details className="work-disclosure"><summary>Tạo yêu cầu chuyển cây</summary><TransferRequestForm organizations={partnerChoices} parents={[{id:(await cohamyChoice()).id,name:'Cohamy (trực thuộc nhà máy)'},...network.partners.filter(p=>p.partnerType!=='STORE'&&p.partnerType!=='END_CUSTOMER').map(p=>({id:p.id,name:p.name}))]}/></details>
  </section></>;
}
async function cohamyChoice(){return(await(await database()).query<{id:string}>("SELECT id FROM cohamy_crm.organizations WHERE kind='COHAMY' ORDER BY created_at LIMIT 1")).rows[0]??{id:''};}

/** Panel on the CRM dealer/customer detail page: type, level, region, anchor, account discount. */
export async function PartnerChannelPanel({user,id}:{user:Principal;id:string}){
 if(!can(user,'partners.read'))return null;
 const p=await partnerChannelProfile(user,id).catch(()=>null);if(!p)return null;const manager=can(user,'channel.manage');
 return <section className="work-section"><h2>Hồ sơ kênh phân phối</h2>
  <dl className="work-facts"><dt>Loại</dt><dd>{partnerTypeLabels[p.organization.partner_type]??p.organization.partner_type}</dd><dt>Hạng</dt><dd>{p.level?.name??'Chưa xếp hạng'}</dd><dt>Vùng</dt><dd>{p.organization.region?regionLabels[p.organization.region]:'Chưa xác định'}</dd><dt>Quản lý trực tiếp</dt><dd>{p.parent?.name??'Cohamy'}</dd><dt>Thuộc cổ đông</dt><dd>{p.anchor?.name??'—'}</dd>
  <dt>Chiết khấu tài khoản</dt><dd>{p.policy?(p.policy.method==='FIXED_PERCENT'?percentText(p.policy.fixed_percent_bp)+' (cố định)':'Theo bậc: '+p.policy.tiers.map(t=>`${t.minQuantity}–${t.maxQuantity??'∞'}: ${t.discountPercent}%`).join('; ')):p.level?'Theo hạng '+p.level.name+': '+(p.level.method==='FIXED_PERCENT'?percentText(p.level.fixed_percent_bp):'theo bậc'):'Chưa cấu hình'}</dd>
  {p.pendingTransfer&&<><dt>Chuyển cây</dt><dd>Đang chờ duyệt</dd></>}</dl>
  {p.children.length>0&&<p className="work-help">Cấp dưới trực tiếp: {p.children.map(c=>c.name).join(', ')}</p>}
  {manager&&<><details className="work-disclosure"><summary>Sửa loại / hạng / vùng</summary><PartnerProfileForm organizationId={id} partnerType={p.organization.partner_type} levelId={p.organization.membership_level_id} region={p.organization.region} levels={p.levels.filter(l=>l.active).map(l=>({id:l.id,name:l.name}))}/></details>
   <details className="work-disclosure"><summary>Đặt chiết khấu cố định cho tài khoản này</summary><ChildDiscountForm organizationId={id} ceilingText={p.organization.partner_type==='SHAREHOLDER'?'Cổ đông: nhập phần trăm theo chính sách (VD: 50% mang về công ty) — áp dụng cố định cho mọi đơn.':undefined}/></details></>}
  {p.events.length>0&&<details className="work-disclosure"><summary>Lịch sử hạng ({p.events.length})</summary><ul>{p.events.map(e=><li key={e.id}>{date(e.created_at)}: {e.from_name??'Chưa xếp hạng'} → {e.to_name??'Chưa xếp hạng'} · {e.source==='INCENTIVE'?'KPI':'Thủ công'} · {e.actor} · {e.reason}</li>)}</ul></details>}
 </section>;
}

// ---------------------------------------------------------------------------
// Portal: Mạng lưới của tôi
// ---------------------------------------------------------------------------
export async function PortalNetworkPage({user}:{user:Principal}){
 const [profile,network,requests,ceiling,incentives]=await Promise.all([partnerChannelProfile(user,user.organizationId),networkOverview(user),networkRequests(user),(async()=>receivedMaxBp(await database(),user.organizationId))(),listIncentivePrograms(user)]);
 const own=network.partners.filter(p=>p.id!==user.organizationId);
 return <><Header title="Mạng lưới của tôi" description="Hạng, chiết khấu bạn đang nhận, cấp dưới trực tiếp và đơn của toàn nhánh. Bạn không thấy thông tin phía trên mình."/>
  <section className="work-section"><h2>Tài khoản của tôi</h2><dl className="work-facts"><dt>Hạng thành viên</dt><dd>{profile.level?.name??'Chưa xếp hạng'}</dd><dt>Chiết khấu đang nhận</dt><dd>{ceiling===null?'Chưa cấu hình':percentText(ceiling)+(profile.policy?' (chính sách riêng)':' (theo hạng)')}</dd><dt>Vùng</dt><dd>{profile.organization.region?regionLabels[profile.organization.region]:'Chưa xác định'}</dd></dl></section>
  <section className="work-section"><h2>Cấp dưới trực tiếp ({profile.children.length})</h2>
   {profile.children.length?<ul className="work-task-list">{profile.children.map(c=><li key={c.id}><div><strong>{c.name}</strong> · {partnerTypeLabels[c.partnerType]??c.partnerType}<details className="work-disclosure"><summary>Đặt chiết khấu cố định cho đơn vị này</summary><ChildDiscountForm organizationId={c.id} ceilingText={ceiling===null?'Bạn chưa có chiết khấu từ cấp trên nên chưa thể đặt chiết khấu cho cấp dưới.':'Tối đa '+percentText(ceiling)+' (bằng mức bạn đang nhận).'}/></details></div></li>)}</ul>:<p>Chưa có cấp dưới. Dùng “Mời nhân viên / đối tác” để mở rộng nhánh.</p>}
   {own.length>profile.children.length&&<p className="work-help">Toàn nhánh: {own.length} đơn vị.</p>}
  </section>
  <section className="work-section"><h2>Đơn của toàn nhánh (chỉ xem)</h2>{requests.length?<Table caption="Đơn nhánh" head={['Mã','Đơn vị đặt','Gửi đến','Tổng tiền','Cập nhật']} rows={requests.map(r=>[r.code,r.organization_name,r.seller_name??'—',money(r.total),date(r.updated_at)])}/>:<p>Chưa có đơn nào đã gửi trong nhánh.</p>}</section>
  {own.length>0&&<section className="work-section"><h2>Xin chuyển cây</h2><TransferRequestForm organizations={own.map(o=>({id:o.id,name:o.name}))} parents={[{id:user.organizationId,name:user.organizationName+' (tôi)'},...own.filter(o=>o.partnerType!=='STORE'&&o.partnerType!=='END_CUSTOMER').map(o=>({id:o.id,name:o.name}))]}/></section>}
  <section className="work-section"><h2>Chương trình thưởng đang áp dụng</h2>{incentives.programs.length?<ul className="work-task-list">{incentives.programs.map(p=>{const o=incentives.own.find(x=>x.programId===p.id);return <li key={p.id}><div><strong>{p.name}</strong><p>{periodLabels[p.period_type]} {p.period_key} · Mục tiêu {p.metric==='REVENUE'?money(p.target):qty(p.target)+' '+p.sku} · Thưởng: {rewardLabels[p.reward_type]}{p.reward_type==='DISCOUNT_PERCENT'?' '+percentText(p.reward_percent_bp):p.reward_type==='GIFT_AMOUNT'?' '+money(p.reward_amount):''}</p><p>Đã đạt: {p.metric==='REVENUE'?money(o?.achieved??'0'):qty(o?.achieved??'0')}{o?.awarded?' · Đã nhận thưởng':o?.reached?' · Đạt chỉ tiêu, chờ Cohamy duyệt':''}</p></div></li>;})}</ul>:<p>Chưa có chương trình.</p>}</section></>;
}

// ---------------------------------------------------------------------------
// Doanh số tháng / quý / năm
// ---------------------------------------------------------------------------
export async function PeriodSalesPage({user,query}:{user:Principal;query:Record<string,string>}){
 const periodType=(['MONTH','QUARTER','YEAR'].includes(query.periodType)?query.periodType:'MONTH') as PeriodType,periodKey=query.periodKey||currentPeriodKey(periodType);
 const views:PeriodView[]=user.area==='portal'?['SALES','PURCHASES','NETWORK']:['DIRECT','NETWORK'],view=(views.includes(query.view as PeriodView)?query.view:views[0]) as PeriodView;
 const viewLabels:Record<PeriodView,string>={DIRECT:'Cohamy bán trực tiếp',NETWORK:'Toàn mạng lưới',SALES:'Tôi bán cho cấp dưới',PURCHASES:'Tôi mua từ cấp trên'};
 const report=await periodSalesReport(user,{periodType,periodKey,view}).catch(()=>null);
 return <><Header title="Doanh số tháng / quý / năm" description="Tổng hợp đơn đã xác nhận theo kỳ: theo đối tác, theo cổ đông/đầu mối, theo sản phẩm và ma trận đối tác × sản phẩm để đánh giá KPI."/>
  <form className="work-filters" method="get"><label>Kỳ<select name="periodType" defaultValue={periodType}>{Object.entries(periodLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Mã kỳ<input name="periodKey" defaultValue={periodKey} placeholder="2026-10 · 2026-Q4 · 2026" pattern="[0-9]{4}(-(0[1-9]|1[0-2])|-Q[1-4])?"/></label><label>Phạm vi<select name="view" defaultValue={view}>{views.map(v=><option key={v} value={v}>{viewLabels[v]}</option>)}</select></label><button className="button button--primary">Xem</button></form>
  {!report?<p className="work-error">Mã kỳ không hợp lệ. Dùng dạng 2026-10 (tháng), 2026-Q4 (quý) hoặc 2026 (năm) đúng với loại kỳ.</p>:<>
  <dl className="work-facts commercial-summary"><dt>Số đơn</dt><dd>{report.totals.orders}</dd><dt>Doanh số</dt><dd>{money(report.totals.revenue)}</dd><dt>Số lượng (đv cơ sở)</dt><dd>{qty(report.totals.quantity)}</dd></dl>
  {report.monthly.length>1&&<section className="work-section"><h2>Theo tháng</h2><Table caption="Theo tháng" head={['Tháng','Số đơn','Doanh số']} rows={report.monthly.map(m=>[m.month,String(m.orders),money(m.revenue)])}/></section>}
  {user.area==='crm'&&<section className="work-section"><h2>Xếp hạng cổ đông / đầu mối</h2>{report.anchors.length?<Table caption="Đầu mối" head={['#','Đầu mối','Đối tác có đơn','Số đơn','Doanh số']} rows={report.anchors.map((a,i)=>[String(i+1),a.name,String(a.partners),String(a.orders),money(a.revenue)])}/>:<p>Chưa có đơn trong kỳ.</p>}</section>}
  <section className="work-section"><h2>Theo đối tác</h2>{report.partners.length?<Table caption="Đối tác" head={['Đối tác','Cổ đông','Hạng','Vùng','Số đơn','Số lượng','Doanh số']} rows={report.partners.map(p=>[p.name,p.anchorName??'—',p.level??'—',p.region?regionLabels[p.region]:'—',String(p.orders),qty(p.quantity),money(p.revenue)])}/>:<p>Chưa có đơn đã xác nhận trong kỳ.</p>}</section>
  <section className="work-section"><h2>Theo sản phẩm</h2>{report.products.length?<Table caption="Sản phẩm" head={['SKU','Sản phẩm','Số lượng','Doanh số']} rows={report.products.map(p=>[p.sku,p.name,qty(p.quantity),money(p.revenue)])}/>:<p>—</p>}</section>
  {report.matrix.rows.length>0&&<section className="work-section"><h2>Ma trận đối tác × sản phẩm (số lượng)</h2><p className="work-help">So sánh điểm bán mạnh/yếu theo từng sản phẩm (VD: bán tốt ca cao nhưng ít kẹo màu).</p><Table caption="Ma trận" head={['Đối tác',...report.matrix.skus.map(s=>s.sku)]} rows={report.matrix.rows.map(r=>[r.name,...r.cells.map(qty)])}/></section>}
  </>}</>;
}

// ---------------------------------------------------------------------------
// KPI & thưởng
// ---------------------------------------------------------------------------
export async function KpiPage({user,query}:{user:Principal;query:Record<string,string>}){
 const [{programs},levels,network,products]=await Promise.all([listIncentivePrograms(user),listMembershipLevels(),networkOverview(user),listCatalog(user)]);
 const selected=query.program?await incentiveProgress(user,query.program).catch(()=>null):null;
 return <><Header title="Chương trình KPI & thưởng" description="Đặt mục tiêu theo tháng/quý/năm (VD: quý mua 300 triệu → lên Kim cương, chiết khấu 40% hoặc quà tặng). Hệ thống đo tiến độ; quản lý duyệt trao thưởng."/>
  <section className="work-section"><h2>Chương trình</h2>{programs.length?<ul className="work-task-list">{programs.map(p=><li key={p.id}><div><Link href={'/crm/kpi?program='+p.id}>{p.name}</Link><p>{periodLabels[p.period_type]} {p.period_key} · Mục tiêu {p.metric==='REVENUE'?money(p.target):qty(p.target)+' × '+p.sku} · {rewardLabels[p.reward_type]}{p.reward_type==='UPGRADE_LEVEL'?' '+(levels.find(l=>l.id===p.reward_level_id)?.name??''):p.reward_type==='DISCOUNT_PERCENT'?' '+percentText(p.reward_percent_bp):' '+money(p.reward_amount)} · {p.status}</p></div></li>)}</ul>:<p>Chưa có chương trình.</p>}
   <details className="work-disclosure"><summary>Tạo chương trình mới</summary><IncentiveForm levels={levels.filter(l=>l.active).map(l=>({id:l.id,name:l.name}))} shareholders={network.shareholders.map(s=>({id:s.id,name:s.name}))} products={products.filter(p=>p.active).map(p=>({sku:p.sku,name:p.name}))} defaultKey={currentPeriodKey('QUARTER')}/></details></section>
  {selected&&<section className="work-section"><h2>Tiến độ: {selected.program.name}</h2><Table caption="Tiến độ" head={['Đối tác','Đã đạt','% mục tiêu','Trạng thái','']} rows={selected.rows.map(r=>[r.name,selected.program.metric==='REVENUE'?money(r.achieved):qty(r.achieved),r.percent.toLocaleString('vi-VN')+'%',r.awardedAt?'Đã trao '+date(r.awardedAt):r.reached?'Đạt':'Chưa đạt',r.reached&&!r.awardedAt?<AwardForm key="a" programId={selected.program.id} organizationId={r.organizationId}/>:''])}/></section>}
 </>;
}

// ---------------------------------------------------------------------------
// Panels trên chi tiết đề nghị và đơn bán
// ---------------------------------------------------------------------------
export async function ManagementChainPanel({user,requestId}:{user:Principal;requestId:string}){
 const chain=await requestManagementChain(user,requestId).catch(()=>null);if(!chain||chain.nodes.length<2&&!chain.nearestManager)return null;
 return <section className="work-section"><h2>Chuỗi quản lý của đơn</h2><ol className="channel-chain">{chain.nodes.map(n=><li key={n.organizationId+(n.requestId??'')} aria-current={n.viewer?'true':undefined}><strong>{n.label}</strong>: {n.organizationName}{n.requestCode?` · ${n.requestCode}`:''}{n.viewer?' (bạn)':''}</li>)}</ol>
  {chain.nearestManager&&<p className="work-help">Liên hệ quản lý gần nhất: <strong>{chain.nearestManager.organizationName}</strong>{chain.nearestManager.requestCode?' · '+chain.nearestManager.requestCode:''}</p>}
  {chain.pendingAt&&<p className="work-help">Đang chờ: {chain.pendingAt}</p>}</section>;
}
export async function OrderChannelPanel({user,orderId,lines}:{user:Principal;orderId:string;lines:{sku:string;name:string;baseQuantity:string;gift:boolean}[]}){
 const db=await database();
 const order=(await db.query<{organization_id:string;seller_organization_id:string|null;invoice_recipient:{kind?:string;companyName?:string;taxCode?:string;address?:string;email?:string};status:string}>('SELECT organization_id,seller_organization_id,invoice_recipient,status FROM cohamy_crm.sales_orders WHERE id=$1',[orderId])).rows[0];if(!order)return null;
 const seller=order.seller_organization_id??(await cohamyChoice()).id,wh=await regionWarehouses(db,seller,order.organization_id);
 const canInvoice=!['CANCELLED','REJECTED'].includes(order.status)&&(user.area==='crm'?['ADMIN','MANAGER','SALES','ACCOUNTANT'].includes(user.role):user.role==='DEALER_OWNER'&&order.organization_id===user.organizationId);
 const canShortage=order.status==='CONFIRMED'&&(user.area==='crm'?['ADMIN','MANAGER','WAREHOUSE'].includes(user.role):user.role==='DEALER_OWNER'&&seller===user.organizationId);
 const r=order.invoice_recipient??{};const merged=[...new Map(lines.filter(l=>!l.gift).map(l=>[l.sku,l])).values()];
 return <section className="work-section"><h2>Hoá đơn & kho xuất</h2>
  <dl className="work-facts"><dt>Xuất hoá đơn cho</dt><dd>{r.kind==='COMPANY'?`${r.companyName} · MST ${r.taxCode} · ${r.address}`:'Chính đơn vị mua'}</dd>
  <dt>Kho gợi ý</dt><dd>{wh.warehouses.length?wh.warehouses.map(w=>w.name+(w.region?' ('+regionLabels[w.region]+')':'')+(w.suggested?' · gần nhất':'')).join('; '):'Chưa khai báo kho cho đơn vị bán'}{!wh.buyerRegion&&' · Đơn vị mua chưa khai báo vùng'}</dd></dl>
  {canInvoice&&<details className="work-disclosure"><summary>Cập nhật thông tin xuất hoá đơn</summary><InvoiceRecipientForm orderId={orderId} current={r}/></details>}
  {canShortage&&merged.length>0&&<details className="work-disclosure"><summary>Báo thiếu hàng</summary><ShortageForm orderId={orderId} lines={merged}/></details>}
 </section>;
}

/** Portal "Đặt hàng": visual catalog with images, price, promotion, HOT badge and quantity. */
export async function PortalOrderCatalogPage({user}:{user:Principal}){
 const [catalog,org]=await Promise.all([orderCatalog(user),(async()=>(await(await database()).query<{name:string;contact_name:string|null;phone:string;address:string}>('SELECT name,contact_name,phone,address FROM cohamy_crm.organizations WHERE id=$1',[user.organizationId])).rows[0])()]);
 return <><Header title="Đặt hàng" description="Chọn sản phẩm, nhập số lượng, xem giá gốc · giá sau khuyến mãi · giá sau chiết khấu, rồi lưu nháp và gửi lên quản lý trực tiếp."/>
  {catalog.message&&<p className="crm-status-note">{catalog.message}</p>}
  <OrderCatalog organizationId={user.organizationId} items={catalog.items} levelName={catalog.level?.name??null} delivery={{recipient:org.contact_name||org.name,phone:org.phone,address:org.address}} legacyHref="/portal/requests/new"/></>;
}
