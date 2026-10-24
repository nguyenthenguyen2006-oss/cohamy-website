'use client';
import {useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {Form} from './CommercialForms';
import {OrderInvoiceTrigger} from './OrderInvoiceModal';
import type {PriceCalculation} from '@/lib/crm/pricing-model';
import type {OrderInvoicePayload} from '@/lib/crm/order-invoice-model';
import {availabilityLabels,badgeLabels,percentText,promotionScopeLabels,regionLabels,rewardLabels,periodLabels} from '@/lib/crm/channel-labels';

/** Meeting 12/10 — client forms for network, levels, promotions, transfers, KPI, invoices, shortages and the order catalog. */
type Choice={id:string;name:string;code?:string};
const str=(f:FormData,k:string)=>String(f.get(k)??'').trim();
const num=(f:FormData,k:string)=>{const v=str(f,k);return v===''?null:Number(v);};
const iso=(value:string)=>new Date(value+':00+07:00').toISOString();
const localInput=(d:Date)=>new Date(d.getTime()+7*3600000).toISOString().slice(0,16);
const money=(v:string|bigint|null|undefined)=>v===null||v===undefined||v===''?'—':BigInt(String(v).split('.')[0]).toLocaleString('vi-VN')+' đ';
/** Tiers typed as one line per tier: "từ;đến;%" (đến để trống = không giới hạn). */
function parseTiers(text:string){return text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>{const [min,max,pct]=l.split(';').map(s=>s.trim());return {minQuantity:min,maxQuantity:max?max:null,discountPercent:Number(pct)};});}
const tiersText=(tiers:{minQuantity:string;maxQuantity:string|null;discountPercent:number}[])=>tiers.map(t=>`${t.minQuantity};${t.maxQuantity??''};${t.discountPercent}`).join('\n');
function TierFields({method,setMethod,fixedDefault,tiersDefault}:{method:string;setMethod:(v:string)=>void;fixedDefault?:string;tiersDefault?:string}){
 return <><label>Cách tính<select name="method" value={method} onChange={e=>setMethod(e.target.value)}><option value="FIXED_PERCENT">Cố định % (fix)</option><option value="QUANTITY_TIER">Theo bậc số lượng</option></select></label>
  {method==='FIXED_PERCENT'?<label>Chiết khấu (%)<input name="fixedPercent" type="number" min={0} max={100} step="0.01" defaultValue={fixedDefault}/></label>
  :<label>Bậc số lượng (mỗi dòng: từ;đến;%)<textarea name="tiers" rows={3} required defaultValue={tiersDefault} placeholder={'0;100;30\n100;;35'}/></label>}</>;
}

export function LevelForm({level}:{level:{id:string;version:number;code:string;name:string;rank:number;method:string;fixed_percent_bp:number|null;tiers:{minQuantity:string;maxQuantity:string|null;discountPercent:number}[];color:string;description:string;active:boolean}}){
 const [method,setMethod]=useState(level.method);
 return <Form endpoint="/api/crm/channel/level" label={'Lưu hạng '+level.name} payload={f=>({id:level.id,version:level.version,code:level.code,name:str(f,'name'),rank:level.rank,method,fixedPercent:method==='FIXED_PERCENT'?num(f,'fixedPercent'):null,tiers:method==='QUANTITY_TIER'?parseTiers(str(f,'tiers')):[],color:str(f,'color')||level.color,description:str(f,'description'),active:f.has('active'),reason:str(f,'reason')})}>
  <div className="work-fields"><label>Tên hạng<input name="name" required maxLength={80} defaultValue={level.name}/></label><TierFields method={method} setMethod={setMethod} fixedDefault={level.fixed_percent_bp===null?'':String(level.fixed_percent_bp/100)} tiersDefault={tiersText(level.tiers)}/>
  <label>Màu<input name="color" type="color" defaultValue={level.color}/></label><label>Mô tả<input name="description" maxLength={500} defaultValue={level.description}/></label><label>Lý do<input name="reason" required minLength={3} maxLength={500}/></label></div>
  <label className="work-check"><input name="active" type="checkbox" defaultChecked={level.active}/>Đang áp dụng</label>
 </Form>;
}

export function PartnerProfileForm({organizationId,partnerType,levelId,region,levels}:{organizationId:string;partnerType:string;levelId:string|null;region:string|null;levels:Choice[]}){
 return <Form endpoint="/api/crm/channel/profile" label="Lưu hồ sơ kênh" payload={f=>({organizationId,partnerType:str(f,'partnerType'),membershipLevelId:str(f,'levelId')||null,region:str(f,'region')||null,reason:str(f,'reason')})}>
  <div className="work-fields"><label>Loại đối tác<select name="partnerType" defaultValue={partnerType==='COHAMY'?'DEALER_L1':partnerType}><option value="SHAREHOLDER">Cổ đông / đầu mối</option><option value="DEALER_L1">Tổng đại lý / đại lý cấp 1</option><option value="DEALER_L2">Đại lý cấp 2</option><option value="STORE">Cửa hàng / điểm bán</option><option value="END_CUSTOMER">Khách lẻ</option></select></label>
  <label>Hạng thành viên<select name="levelId" defaultValue={levelId??''}><option value="">Chưa xếp hạng</option>{levels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
  <label>Vùng (kho gần nhất)<select name="region" defaultValue={region??''}><option value="">Chưa xác định</option><option value="NORTH">{regionLabels.NORTH}</option><option value="SOUTH">{regionLabels.SOUTH}</option></select></label>
  <label>Lý do<input name="reason" required minLength={3} maxLength={500} placeholder="VD: Nâng hạng theo quyết định ban giám đốc"/></label></div>
  <p className="work-help">Nâng hạng có hiệu lực ngay cho các yêu cầu tính giá mới; lịch sử nâng/hạ hạng được lưu lại.</p>
 </Form>;
}

export function ChildDiscountForm({organizationId,label='Lưu chiết khấu tài khoản',ceilingText}:{organizationId:string;label?:string;ceilingText?:string}){
 const [method,setMethod]=useState('FIXED_PERCENT');
 return <Form endpoint="/api/crm/channel/child-discount" label={label} payload={f=>({organizationId,method,...(method==='FIXED_PERCENT'?{fixedPercent:Number(str(f,'fixedPercent'))}:{tiers:parseTiers(str(f,'tiers'))}),reason:str(f,'reason')})}>
  <div className="work-fields"><TierFields method={method} setMethod={setMethod}/><label>Lý do<input name="reason" required minLength={3} maxLength={500}/></label></div>
  {ceilingText&&<p className="work-help">{ceilingText}</p>}
 </Form>;
}

export function PromotionForm({products,levels,partners}:{products:{sku:string;name:string}[];levels:Choice[];partners:Choice[]}){
 const [scope,setScope]=useState('ALL');const now=new Date();
 return <Form endpoint="/api/crm/channel/promotion" label="Tạo khuyến mãi" payload={f=>({version:0,sku:str(f,'sku'),name:str(f,'name'),campaign:str(f,'campaign'),percent:Number(str(f,'percent')),scope,targetOrganizationIds:scope==='DESIGNATED'?f.getAll('targetOrganizationIds').map(String):[],targetLevelIds:scope==='DESIGNATED'?f.getAll('targetLevelIds').map(String):[],minBaseQuantity:scope==='QUANTITY'?str(f,'minBaseQuantity'):'0',badge:str(f,'badge')||null,startsAt:iso(str(f,'startsAt')),endsAt:iso(str(f,'endsAt')),active:true,reason:str(f,'reason')})}>
  <div className="work-fields"><label>Sản phẩm<select name="sku" required><option value="">Chọn sản phẩm</option>{products.map(p=><option key={p.sku} value={p.sku}>{p.name}</option>)}</select></label>
  <label>Tên khuyến mãi<input name="name" required minLength={2} maxLength={160} placeholder="VD: Mừng sản phẩm mới"/></label><label>Chiến dịch<input name="campaign" maxLength={160} placeholder="VD: Khai trương tháng 11"/></label>
  <label>Giảm (%)<input name="percent" type="number" min={0} max={100} step="0.01" required/></label>
  <label>Cơ chế<select value={scope} onChange={e=>setScope(e.target.value)}>{Object.entries(promotionScopeLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
  {scope==='QUANTITY'&&<label>Số lượng tối thiểu (đơn vị cơ sở)<input name="minBaseQuantity" required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,6})?"/></label>}
  <label>Nhãn<select name="badge" defaultValue=""><option value="">Không</option>{Object.entries(badgeLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
  <label>Bắt đầu<input name="startsAt" type="datetime-local" required defaultValue={localInput(now)}/></label><label>Kết thúc<input name="endsAt" type="datetime-local" required defaultValue={localInput(new Date(now.getTime()+10*86400000))}/></label>
  <label>Lý do<input name="reason" required minLength={3} maxLength={500}/></label></div>
  {scope==='DESIGNATED'&&<fieldset className="upgrade-columns"><legend>Chỉ định hạng hoặc đối tác được hưởng</legend>{levels.map(l=><label key={l.id}><input type="checkbox" name="targetLevelIds" value={l.id}/>Hạng {l.name}</label>)}{partners.map(p=><label key={p.id}><input type="checkbox" name="targetOrganizationIds" value={p.id}/>{p.name}</label>)}</fieldset>}
  <p className="work-help">Giá sau khuyến mãi tính trước, sau đó mới trừ chiết khấu tài khoản (cộng dồn tuần tự). Đơn đã gửi giữ nguyên giá cũ.</p>
 </Form>;
}
export function PromotionToggle({id,version,active}:{id:string;version:number;active:boolean}){
 return <Form endpoint="/api/crm/channel/promotion-active" label={active?'Tạm dừng':'Bật lại'} payload={f=>({id,version,active:!active,reason:str(f,'reason')})}><label>Lý do<input name="reason" required minLength={3} maxLength={500}/></label></Form>;
}

export function TransferRequestForm({organizations,parents}:{organizations:Choice[];parents:Choice[]}){
 return <Form endpoint="/api/crm/channel/transfer-request" label="Gửi yêu cầu chuyển cây" payload={f=>({organizationId:str(f,'organizationId'),toParentId:str(f,'toParentId'),reason:str(f,'reason')})}>
  <div className="work-fields"><label>Đơn vị cần chuyển<select name="organizationId" required><option value="">Chọn</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
  <label>Chuyển sang quản lý mới<select name="toParentId" required><option value="">Chọn</option>{parents.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
  <label>Lý do<input name="reason" required minLength={3} maxLength={500}/></label></div>
  <p className="work-help">Không tự đổi cây. Yêu cầu được quản trị Cohamy duyệt tập trung; đơn cũ giữ nguyên lịch sử.</p>
 </Form>;
}
export function TransferDecisionForm({id}:{id:string}){
 const [decision,setDecision]=useState('APPROVE');
 return <Form endpoint="/api/crm/channel/transfer-decision" label={decision==='APPROVE'?'Duyệt chuyển':'Từ chối'} payload={f=>({id,decision,reason:str(f,'reason')})}><div className="work-fields"><label>Quyết định<select value={decision} onChange={e=>setDecision(e.target.value)}><option value="APPROVE">Duyệt</option><option value="REJECT">Từ chối</option></select></label><label>Lý do<input name="reason" required minLength={3} maxLength={500}/></label></div></Form>;
}

export function IncentiveForm({levels,shareholders,products,defaultKey}:{levels:Choice[];shareholders:Choice[];products:{sku:string;name:string}[];defaultKey:string}){
 const [metric,setMetric]=useState('REVENUE'),[audience,setAudience]=useState('ALL'),[reward,setReward]=useState('UPGRADE_LEVEL'),[periodType,setPeriodType]=useState('QUARTER');
 return <Form endpoint="/api/crm/channel/incentive" label="Tạo chương trình KPI" payload={f=>({version:0,name:str(f,'name'),description:str(f,'description'),periodType,periodKey:str(f,'periodKey'),metric,target:str(f,'target'),sku:metric==='QUANTITY'?str(f,'sku'):null,audience,audienceRef:audience==='ALL'?null:str(f,'audienceRef'),rewardType:reward,rewardLevelId:reward==='UPGRADE_LEVEL'?str(f,'rewardLevelId'):null,rewardPercent:reward==='DISCOUNT_PERCENT'?Number(str(f,'rewardPercent')):null,rewardAmount:reward==='GIFT_AMOUNT'?str(f,'rewardAmount'):null,status:'ACTIVE',reason:str(f,'reason')})}>
  <div className="work-fields"><label>Tên chương trình<input name="name" required minLength={3} maxLength={160} placeholder="VD: Quý đạt 300 triệu lên Kim cương"/></label>
  <label>Kỳ<select value={periodType} onChange={e=>setPeriodType(e.target.value)}>{Object.entries(periodLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
  <label>Mã kỳ<input name="periodKey" required defaultValue={defaultKey} placeholder="2026-10 · 2026-Q4 · 2026" pattern="[0-9]{4}(-(0[1-9]|1[0-2])|-Q[1-4])?"/></label>
  <label>Chỉ tiêu<select value={metric} onChange={e=>setMetric(e.target.value)}><option value="REVENUE">Doanh số (đ)</option><option value="QUANTITY">Số lượng một SKU</option></select></label>
  {metric==='QUANTITY'&&<label>SKU<select name="sku" required><option value="">Chọn</option>{products.map(p=><option key={p.sku} value={p.sku}>{p.name}</option>)}</select></label>}
  <label>Mục tiêu<input name="target" required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,6})?" placeholder="300000000"/></label>
  <label>Áp dụng cho<select value={audience} onChange={e=>setAudience(e.target.value)}><option value="ALL">Tất cả đối tác</option><option value="SHAREHOLDER_BRANCH">Nhánh của một cổ đông</option><option value="LEVEL">Một hạng thành viên</option></select></label>
  {audience==='SHAREHOLDER_BRANCH'&&<label>Cổ đông<select name="audienceRef" required><option value="">Chọn</option>{shareholders.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
  {audience==='LEVEL'&&<label>Hạng<select name="audienceRef" required><option value="">Chọn</option>{levels.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
  <label>Phần thưởng<select value={reward} onChange={e=>setReward(e.target.value)}>{Object.entries(rewardLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
  {reward==='UPGRADE_LEVEL'&&<label>Lên hạng<select name="rewardLevelId" required><option value="">Chọn</option>{levels.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
  {reward==='DISCOUNT_PERCENT'&&<label>Chiết khấu mới (%)<input name="rewardPercent" type="number" min={0} max={100} step="0.01" required/></label>}
  {reward==='GIFT_AMOUNT'&&<label>Giá trị quà (đ)<input name="rewardAmount" required inputMode="numeric" pattern="[0-9]+"/></label>}
  <label>Mô tả<input name="description" maxLength={1000}/></label><label>Lý do<input name="reason" required minLength={3} maxLength={500}/></label></div>
 </Form>;
}
export function AwardForm({programId,organizationId}:{programId:string;organizationId:string}){
 return <Form endpoint="/api/crm/channel/incentive-award" label="Duyệt trao thưởng" payload={f=>({programId,organizationId,reason:str(f,'reason')})}><label>Lý do<input name="reason" required minLength={3} maxLength={500} defaultValue="Đạt chỉ tiêu chương trình"/></label></Form>;
}

export function InvoiceRecipientForm({orderId,current}:{orderId:string;current:{kind?:string;companyName?:string;taxCode?:string;address?:string;email?:string}}){
 const [kind,setKind]=useState(current.kind==='COMPANY'?'COMPANY':'BUYER');
 return <Form endpoint="/api/crm/channel/invoice-recipient" label="Lưu thông tin xuất hoá đơn" payload={f=>({orderId,kind,...(kind==='COMPANY'?{companyName:str(f,'companyName'),taxCode:str(f,'taxCode'),address:str(f,'address'),email:str(f,'email')}:{}),reason:str(f,'reason')})}>
  <div className="work-fields"><label>Xuất hoá đơn cho<select value={kind} onChange={e=>setKind(e.target.value)}><option value="BUYER">Chính đơn vị mua</option><option value="COMPANY">Công ty thương mại khác</option></select></label>
  {kind==='COMPANY'&&<><label>Tên công ty<input name="companyName" required minLength={2} maxLength={200} defaultValue={current.companyName}/></label><label>Mã số thuế<input name="taxCode" required minLength={6} maxLength={40} defaultValue={current.taxCode}/></label><label>Địa chỉ<input name="address" required minLength={3} maxLength={500} defaultValue={current.address}/></label><label>Email nhận hoá đơn<input name="email" type="email" maxLength={200} defaultValue={current.email}/></label></>}
  <label>Lý do<input name="reason" required minLength={3} maxLength={500} defaultValue="Cập nhật thông tin hoá đơn"/></label></div>
 </Form>;
}
export function ShortageForm({orderId,lines}:{orderId:string;lines:{sku:string;name:string;baseQuantity:string}[]}){
 const [sku,setSku]=useState(lines[0]?.sku??'');const needed=lines.find(l=>l.sku===sku)?.baseQuantity??'';
 return <Form endpoint="/api/crm/channel/shortage" label="Báo thiếu hàng cho quản lý trực tiếp" payload={f=>({orderId,sku,needed:str(f,'needed'),available:str(f,'available'),note:str(f,'note')})}>
  <div className="work-fields"><label>SKU<select value={sku} onChange={e=>setSku(e.target.value)}>{lines.map(l=><option key={l.sku} value={l.sku}>{l.sku} · {l.name}</option>)}</select></label>
  <label>Cần (đơn vị cơ sở)<input name="needed" key={sku} required defaultValue={needed} inputMode="decimal" pattern="[0-9]+([.][0-9]{1,6})?"/></label>
  <label>Kho đang có<input name="available" required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,6})?" defaultValue="0"/></label>
  <label>Ghi chú<input name="note" maxLength={500} placeholder="Không ghi ngày dự kiến nếu chưa chắc chắn"/></label></div>
  <p className="work-help">Hệ thống gửi thông báo cho đơn vị đặt (quản lý trực tiếp) kèm tồn ở kho miền còn lại nếu có; không tự đặt ngày giao.</p>
 </Form>;
}

// ---------------------------------------------------------------------------
// Catalog đặt hàng: lưới sản phẩm (ảnh, giá, % KM, HOT, số lượng) → bảng giá gốc / sau KM / sau chiết khấu → lưu nháp
// ---------------------------------------------------------------------------
export interface CatalogItemView {sku:string;name:string;category:string;weightLabel:string;image:string|null;stockUnit:string;listUnitPrice:string;promotion:{percentBp:number;name:string;badge:string|null;minBaseQuantity:string}|null;accountPercentBp:number;estimatedUnitPrice:string;availability:'IN_STOCK'|'LOW'|'OUT'|'UNKNOWN'}
export function OrderCatalog({organizationId,items,levelName,delivery,legacyHref}:{organizationId:string;items:CatalogItemView[];levelName:string|null;delivery:{recipient:string;phone:string;address:string};legacyHref:string}){
 const router=useRouter(),formRef=useRef<HTMLFormElement>(null);const [qty,setQty]=useState<Record<string,string>>({}),[filter,setFilter]=useState(''),[calc,setCalc]=useState<PriceCalculation|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[key]=useState(()=>typeof crypto!=='undefined'?crypto.randomUUID():'');
 const lines=useMemo(()=>Object.entries(qty).filter(([,v])=>/^\d+$/.test(v)&&Number(v)>0).map(([sku,quantity])=>({sku,unitCode:'BASE',quantity})),[qty]);
 const shown=items.filter(i=>!filter||(i.name+' '+i.sku+' '+i.category).toLowerCase().includes(filter.toLowerCase()));
 const set=(sku:string,v:string)=>{setCalc(null);setQty(q=>({...q,[sku]:v.replace(/[^0-9]/g,'').slice(0,9)}));};
 async function post(endpoint:string,body:unknown){const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw Error(j.error==='ORDER_MINIMUM_NOT_MET'?'Chưa đạt mức đặt tối thiểu.':j.error==='PRICE_UNAVAILABLE'?'Chưa có bảng giá hiệu lực.':'Chưa xử lý được ('+(j.error??r.status)+').');return j;}
 async function review(){setError('');setBusy(true);try{const r=await post('/api/crm/pricing/preview',{organizationId,basket:{lines,discountBasisPoints:0,creditTerms:false}});setCalc(r.calculation as PriceCalculation);}catch(e){setError(e instanceof Error?e.message:'Lỗi');}finally{setBusy(false);}}
 async function save(form:HTMLFormElement){setError('');setBusy(true);try{const f=new FormData(form);const r=await post('/api/crm/commerce/save-request',{version:0,organizationId,channel:'PORTAL',basket:{lines,discountBasisPoints:0,creditTerms:false},delivery:{recipient:str(f,'recipient'),phone:str(f,'phone'),address:str(f,'address')},note:str(f,'note'),idempotencyKey:key});router.push('/portal/requests/'+r.id);router.refresh();}catch(e){setError(e instanceof Error?e.message:'Lỗi');setBusy(false);}}
 async function loadDraftInvoice():Promise<OrderInvoicePayload>{
  if(!lines.length)throw new Error('Vui lòng chọn ít nhất 1 sản phẩm và nhập số lượng > 0 trước khi xem hóa đơn.');
  const f=formRef.current?new FormData(formRef.current):null;
  const r=await post('/api/crm/commerce/invoice-preview',{
   organizationId,
   basket:{lines,discountBasisPoints:0,creditTerms:false},
   delivery:{
    recipient:f?str(f,'recipient'):delivery.recipient,
    phone:f?str(f,'phone'):delivery.phone,
    address:f?str(f,'address'):delivery.address,
   },
   note:f?str(f,'note'):'',
  });
  return r as OrderInvoicePayload;
 }
 const badge=(b:string|null)=>b?<span className={'channel-badge channel-badge--'+b.toLowerCase()}>{badgeLabels[b]??b}</span>:null;
 return <section className="channel-catalog">
  <div className="table-toolbar"><div className="field"><label htmlFor="catalog-filter">Tìm sản phẩm</label><input id="catalog-filter" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Tên, SKU hoặc nhóm"/></div>{levelName&&<p className="work-help">Hạng của bạn: <strong>{levelName}</strong></p>}<Link className="button button--secondary" href={legacyHref}>Nhập theo SKU / Excel</Link></div>
  {!items.length?<p className="crm-status-note">Chưa có sản phẩm trong bảng giá đang phát hành.</p>:<ul className="channel-grid">{shown.map(i=><li key={i.sku} className="channel-card">
   <div className="channel-card__media">{i.image?(
      // eslint-disable-next-line @next/next/no-img-element -- product images are local static files of mixed sizes
      <img src={i.image} alt={i.name} loading="lazy"/>
    ):<span aria-hidden="true">{i.name.slice(0,1)}</span>}{badge(i.promotion?.badge??null)}</div>
   <div className="channel-card__body"><h3>{i.name}</h3><p className="work-help">{i.sku}{i.weightLabel?' · '+i.weightLabel:''}</p>
   <p className="channel-price">{i.estimatedUnitPrice!==i.listUnitPrice&&<s>{money(i.listUnitPrice)}</s>} <strong>{money(i.estimatedUnitPrice)}</strong> / {i.stockUnit||'đv'}</p>
   {i.promotion&&<p className="channel-promo">KM {percentText(i.promotion.percentBp)} · {i.promotion.name}{i.promotion.minBaseQuantity!=='0'&&Number(i.promotion.minBaseQuantity)>0?` (từ ${i.promotion.minBaseQuantity})`:''}</p>}
   {i.accountPercentBp>0&&<p className="work-help">Chiết khấu tài khoản {percentText(i.accountPercentBp)}</p>}
   <p className={'channel-stock channel-stock--'+i.availability.toLowerCase()}>{availabilityLabels[i.availability]}</p>
   <label className="channel-qty">Số lượng<input inputMode="numeric" value={qty[i.sku]??''} onChange={e=>set(i.sku,e.target.value)} placeholder="0" aria-label={'Số lượng '+i.name} disabled={i.availability==='OUT'}/></label></div></li>)}</ul>}
  <form ref={formRef} className="work-form" onSubmit={e=>{e.preventDefault();void save(e.currentTarget);}}>
   <h2>Giỏ đặt hàng ({lines.length} sản phẩm)</h2>
   <div className="crm-inline-actions"><button type="button" className="button button--secondary" disabled={!lines.length||busy} onClick={()=>void review()}>Xem giá chi tiết</button><OrderInvoiceTrigger onLoadDraft={loadDraftInvoice} buttonClassName="button button--secondary" buttonLabel="🧾 Xem trước & Xuất Hóa đơn (PDF)"/></div>
   {calc&&<div className="crm-table-wrap" role="region" aria-label="Bảng giá đơn" tabIndex={0}><table className="data-table"><thead><tr><th scope="col">Sản phẩm</th><th scope="col">SL</th><th scope="col">Giá gốc</th><th scope="col">KM</th><th scope="col">Giá sau KM</th><th scope="col">CK tài khoản</th><th scope="col">Đơn giá cuối</th><th scope="col">Thành tiền</th></tr></thead>
    <tbody>{calc.lines.map((l,n)=><tr key={l.sku+n}><td>{l.name}{l.gift?' (tặng)':''}</td><td>{l.quantity}</td><td>{money(l.listUnitPrice??l.unitPrice)}</td><td>{l.promoPercentBp?percentText(l.promoPercentBp):'—'}</td><td>{money(l.priceAfterPromo??l.unitPrice)}</td><td>{l.accountPercentBp?percentText(l.accountPercentBp):'—'}</td><td>{money(l.unitPrice)}</td><td>{money(l.total)}</td></tr>)}</tbody>
    <tfoot>{calc.channel&&<tr><th scope="row" colSpan={7}>Tổng giá gốc</th><td>{money(calc.channel.listSubtotal)}</td></tr>}<tr><th scope="row" colSpan={7}>Tổng thanh toán</th><td><strong>{money(calc.total)}</strong></td></tr>{calc.channel&&BigInt(calc.channel.listSubtotal)>BigInt(calc.subtotal)&&<tr><th scope="row" colSpan={7}>Tiết kiệm</th><td>{money(BigInt(calc.channel.listSubtotal)-BigInt(calc.subtotal))}</td></tr>}</tfoot></table></div>}
   {calc?.minimumShortfalls.length?<p className="work-error">Chưa đạt mức đặt tối thiểu: {calc.minimumShortfalls.map(s=>s.kind==='AMOUNT'?'thiếu '+money(s.missing):s.kind==='CASES'?'thiếu '+s.missing+' thùng':s.sku+' thiếu '+s.missing).join('; ')}</p>:null}
   <div className="work-fields"><label>Người nhận<input name="recipient" required minLength={2} maxLength={120} defaultValue={delivery.recipient}/></label><label>Điện thoại<input name="phone" required minLength={5} maxLength={40} defaultValue={delivery.phone}/></label><label>Địa chỉ giao<input name="address" required minLength={3} maxLength={500} defaultValue={delivery.address}/></label><label>Ghi chú<input name="note" maxLength={2000}/></label></div>
   <div className="work-form-footer"><button className="button button--primary" disabled={!lines.length||busy}>{busy?'Đang xử lý…':'Lưu nháp đề nghị'}</button><p className="work-help">Sau khi lưu, mở đề nghị để đề xuất/gửi lên quản lý trực tiếp.</p></div>
   {error&&<p role="alert" className="work-error">{error}</p>}
  </form>
 </section>;
}
