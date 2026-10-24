'use client';
import {useId,useMemo,useRef,useState,type ReactNode} from 'react';
import Link from 'next/link';
import type {financeOverview,receivableAging} from '@/lib/crm/finance';
import type {receivablesWorkspaceSummary,ReceivablePartnerSummary} from '@/lib/crm/receivables-workspace';
import type {SalesReconciliationResult} from '@/lib/crm/reconciliation';
import {CrmSpreadsheet,type SpreadsheetColumn} from './spreadsheet/CrmSpreadsheet';
import {SalesReconciliationSheet} from './spreadsheet/ReconciliationViews';
import {AllocationForm,BankImportForm,BankMatchForm,CreditForm,DepositRefundForm,PaymentProofCreateForm,PaymentReviewForm,ReceivableAdjustForm,ReceivablePostForm,ReminderForm} from './FinanceForms';
import './spreadsheet/dashboard-workbench.css';
import './receivables-workspace.css';

type Overview=Awaited<ReturnType<typeof financeOverview>>;
type Summary=Awaited<ReturnType<typeof receivablesWorkspaceSummary>>;
type Aging=Awaited<ReturnType<typeof receivableAging>>;
type Receivable=Overview['receivables'][number];
type Account=Overview['accounts'][number];
type Payment=Overview['payments'][number];
type Tab='partners'|'ledger'|'orders'|'limits'|'payments';
const money=(value:string)=>BigInt(value).toLocaleString('vi-VN')+' ₫';
const day=(value:string|null)=>value?value.split('-').reverse().join('/'):'—';
const sum=(rows:ReceivablePartnerSummary[],key:'remainingAmount'|'overdueAmount'|'unpostedAmount'|'usedAmount'|'unallocatedPaymentAmount')=>rows.reduce((value,row)=>value+BigInt(row[key]),0n).toString();
const receivableStatus:Record<string,string>={OPEN:'Còn nợ',PARTIAL:'Thu một phần',PAID:'Đã tất toán',DISPUTED:'Tranh chấp',VOID:'Đã hủy sổ'};
const paymentStatus:Record<string,string>={PENDING:'Chờ duyệt',CONFIRMED:'Đã xác nhận',REJECTED:'Đã từ chối',REVERSED:'Đã đảo'};
const agingLabel:Record<string,string>={NOT_DUE:'Chưa đến hạn','0_30':'Đến hạn / 0–30 ngày','31_60':'31–60 ngày','61_90':'61–90 ngày',OVER_90:'Trên 90 ngày',DISPUTED:'Tranh chấp'};

export function ReceivablesWorkspace({data,summary,aging,reconciliation,organizations,canWrite}:{
 data:Pick<Overview,'accounts'|'receivables'|'payments'|'bankTransactions'|'reminders'|'receivableEvents'>;
 summary:Summary;aging:Aging;reconciliation:SalesReconciliationResult|null;organizations:{id:string;name:string}[];canWrite:boolean;
}){
 const [tab,setTab]=useState<Tab>('partners'),[visited,setVisited]=useState<Set<Tab>>(()=>new Set(['partners']));
 const [organizationId,setOrganizationId]=useState(''),[partnerState,setPartnerState]=useState('all'),[ledgerState,setLedgerState]=useState('all');
 const [showPost,setShowPost]=useState(false),[showCredit,setShowCredit]=useState(false),[showUpload,setShowUpload]=useState(false);
 const tabsId=useId(),tabRefs=useRef(new Map<Tab,HTMLButtonElement>());
 const selectTab=(key:Tab)=>{setTab(key);setVisited(current=>new Set([...current,key]));};
 const scope=summary.rows.filter(row=>!organizationId||row.organizationId===organizationId);
 const metrics=[{label:'Còn phải thu đã ghi sổ',value:sum(scope,'remainingAmount')},{label:'Trong đó quá hạn',value:sum(scope,'overdueAmount')},{label:'Đơn chờ ghi sổ',value:sum(scope,'unpostedAmount')},{label:'Tiền chờ phân bổ',value:sum(scope,'unallocatedPaymentAmount')}];
 const partnerRows=scope.filter(row=>partnerState==='all'||(partnerState==='open'&&BigInt(row.remainingAmount)>0n)||(partnerState==='overdue'&&BigInt(row.overdueAmount)>0n)||(partnerState==='unposted'&&row.unpostedOrderCount>0));
 const receivables=data.receivables.filter(row=>(!organizationId||row.organization_id===organizationId)&&(ledgerState==='all'||(ledgerState==='open'&&BigInt(row.remaining_amount)>0n&&row.status!=='VOID')||(ledgerState==='overdue'&&BigInt(row.remaining_amount)>0n&&row.status!=='VOID'&&row.due_on<summary.asOf)||(ledgerState==='paid'&&row.status==='PAID')||(ledgerState==='disputed'&&row.status==='DISPUTED')));
 const accounts=data.accounts.filter(row=>!organizationId||row.organization_id===organizationId),payments=data.payments.filter(row=>!organizationId||row.organization_id===organizationId);
 const choices=useMemo(()=>Array.from(new Map([...organizations,...summary.rows.map(row=>({id:row.organizationId,name:row.organizationName}))].map(org=>[org.id,org])).values()).sort((a,b)=>a.name.localeCompare(b.name,'vi')),[organizations,summary.rows]);
 const orderCodes=new Map(reconciliation?.orders.map(order=>[order.orderId,order.orderCode])??[]);
 const source=(row:Receivable)=>row.order_id?<Link href={`/crm/sales/${row.order_id}`}>{orderCodes.get(row.order_id)??'Mở đơn bán'}</Link>:row.source_type==='historical-invoice'?<Link href={`/crm/historical-orders/${row.source_id}`}>Hóa đơn cũ</Link>:row.source_type;
 const partnerCols:SpreadsheetColumn<ReceivablePartnerSummary>[]=[
  {key:'organizationName',label:'Khách hàng / Đại lý',width:240,sticky:true,getValue:r=>r.organizationName,renderCell:(r,{openDrawer})=><button type="button" className="crm-cell-link-btn" onClick={openDrawer}>{r.organizationName}</button>},
  {key:'remainingAmount',label:'Còn phải thu đã ghi sổ',type:'money',width:170,getValue:r=>r.remainingAmount,renderCell:r=><strong>{money(r.remainingAmount)}</strong>},
  {key:'overdueAmount',label:'Quá hạn',type:'money',width:145,getValue:r=>r.overdueAmount,renderCell:r=><span className={BigInt(r.overdueAmount)>0n?'crm-finance-overdue':undefined}>{money(r.overdueAmount)}</span>},
  {key:'unpostedAmount',label:'Đơn chờ ghi sổ',type:'money',width:150,getValue:r=>r.unpostedAmount,renderCell:r=><span>{money(r.unpostedAmount)}{r.unpostedOrderCount>0&&<small className="crm-cell-sub">{r.unpostedOrderCount} đơn đã xác nhận</small>}</span>},
  {key:'usedAmount',label:'Hạn mức đang dùng',type:'money',width:155,getValue:r=>r.usedAmount,renderCell:r=>money(r.usedAmount)},
  {key:'unallocatedPaymentAmount',label:'Tiền chờ phân bổ',type:'money',width:155,getValue:r=>r.unallocatedPaymentAmount,renderCell:r=>money(r.unallocatedPaymentAmount)},
  {key:'nearestDueOn',label:'Hạn gần nhất',type:'date',width:120,getValue:r=>r.nearestDueOn,renderCell:r=>day(r.nearestDueOn)},
  {key:'receivableCount',label:'Khoản đã ghi sổ',type:'number',width:110,getValue:r=>r.receivableCount},
 ];
 const ledgerCols:SpreadsheetColumn<Receivable>[]=[
  {key:'code',label:'Khoản phải thu',width:200,sticky:true,getValue:r=>r.code,renderCell:(r,{openDrawer})=><button type="button" className="crm-cell-link-btn" onClick={openDrawer}>{r.code}</button>},
  {key:'organization_name',label:'Đối tác',width:220,getValue:r=>r.organization_name},
  {key:'source',label:'Chứng từ nguồn',width:190,getValue:r=>r.order_id?orderCodes.get(r.order_id)??'Đơn bán':r.source_type,renderCell:source},
  {key:'due_on',label:'Hạn thanh toán',type:'date',width:135,getValue:r=>r.due_on,renderCell:r=><span className={BigInt(r.remaining_amount)>0n&&r.due_on<summary.asOf?'crm-finance-overdue':undefined}>{day(r.due_on)}</span>},
  {key:'original_amount',label:'Giá trị ghi sổ',type:'money',width:150,getValue:r=>r.original_amount,renderCell:r=>money(r.original_amount)},
  {key:'remaining_amount',label:'Còn phải thu',type:'money',width:150,getValue:r=>r.remaining_amount,renderCell:r=><strong>{money(r.remaining_amount)}</strong>},
  {key:'status',label:'Trạng thái',type:'status',width:140,getValue:r=>receivableStatus[r.status]??r.status,renderCell:r=>receivableStatus[r.status]??r.status},
 ];
 const accountCols:SpreadsheetColumn<Account>[]=[
  {key:'organization_name',label:'Đối tác',width:240,sticky:true,getValue:r=>r.organization_name,renderCell:(r,{openDrawer})=><button type="button" className="crm-cell-link-btn" onClick={openDrawer}>{r.organization_name}</button>},
  {key:'limit_amount',label:'Hạn mức',type:'money',width:175,getValue:r=>r.limit_amount,renderCell:r=>money(r.limit_amount)},
  {key:'used_amount',label:'Đang sử dụng',type:'money',width:175,getValue:r=>r.used_amount,renderCell:r=>money(r.used_amount)},
  {key:'available',label:'Còn có thể dùng',type:'money',width:175,getValue:r=>(BigInt(r.limit_amount)-BigInt(r.used_amount)).toString(),renderCell:r=>money((BigInt(r.limit_amount)-BigInt(r.used_amount)).toString())},
  {key:'terms_days',label:'Kỳ hạn',width:100,getValue:r=>r.terms_days,renderCell:r=>`${r.terms_days} ngày`},
  {key:'enabled',label:'Mua chịu',width:110,getValue:r=>r.enabled?'Đang mở':'Đang tắt'},
 ];
 const paymentCols:SpreadsheetColumn<Payment>[]=[
  {key:'code',label:'Chứng từ thanh toán',width:205,sticky:true,getValue:r=>r.code,renderCell:(r,{openDrawer})=><button type="button" className="crm-cell-link-btn" onClick={openDrawer}>{r.code}</button>},
  {key:'organization_name',label:'Đối tác',width:210,getValue:r=>r.organization_name},
  {key:'kind',label:'Loại',width:105,getValue:r=>r.kind==='DEPOSIT'?'Ứng trước':'Thanh toán'},
  {key:'amount',label:'Số tiền',type:'money',width:155,getValue:r=>r.amount,renderCell:r=>money(r.amount)},
  {key:'allocated_amount',label:'Đã phân bổ',type:'money',width:155,getValue:r=>r.allocated_amount,renderCell:r=>money(r.allocated_amount)},
  {key:'available_amount',label:'Còn có thể phân bổ',type:'money',width:165,getValue:r=>r.available_amount,renderCell:r=>r.status==='CONFIRMED'?money(r.available_amount??'0'):'Chưa xác nhận'},
  {key:'status',label:'Trạng thái',width:140,getValue:r=>paymentStatus[r.status]??r.status},
 ];
 const tabs:{key:Tab;label:string;count?:number}[]=[{key:'partners',label:'Theo đối tác',count:summary.rows.length},{key:'ledger',label:'Sổ phải thu',count:summary.rows.reduce((n,row)=>n+row.receivableCount,0)},{key:'orders',label:'Đối chiếu đơn bán',count:reconciliation?.orders.length},{key:'limits',label:'Hạn mức',count:data.accounts.length},{key:'payments',label:'Thanh toán',count:data.payments.length}];
 const panel=(key:Tab,children:ReactNode)=><div className="crm-dash-panel" role="tabpanel" id={`${tabsId}-${key}-panel`} aria-labelledby={`${tabsId}-${key}-tab`} hidden={tab!==key}>{visited.has(key)&&children}</div>;
 const baseGrid={presentation:'workbench' as const,defaultDensity:'comfortable' as const,hideFooterSums:true};
 return <div className="crm-finance-workspace crm-workbench">
  <header className="crm-dash-compact-bar"><div className="crm-dash-compact-bar__left"><h1>Công nợ</h1><p>Theo dõi khoản phải thu, hạn thanh toán và hạn mức từng đối tác.</p></div>
   <div className="crm-finance-actions">{canWrite&&<><button type="button" className="button button--primary" aria-expanded={showPost} onClick={()=>setShowPost(!showPost)}>Ghi khoản phải thu</button>{tab!=='payments'&&<button type="button" className="button button--secondary" onClick={()=>{selectTab('payments');setShowUpload(true);}}>Tải chứng từ thanh toán</button>}</>}</div>
  </header>
  {showPost&&canWrite&&<section className="crm-finance-inline-form" aria-label="Ghi khoản phải thu từ đơn"><div className="crm-finance-section-heading"><h2>Ghi khoản phải thu từ đơn</h2><button type="button" className="crm-sheet-tool-btn" onClick={()=>setShowPost(false)}>Đóng</button></div><ReceivablePostForm orders={summary.postableOrders.filter(order=>!organizationId||order.organizationId===organizationId)}/></section>}
  {tab!=='orders'&&<>
   <div className="crm-workbench-summary"><dl className="crm-workbench-primary">{metrics.map((item,index)=><div key={item.label}><dt>{item.label}</dt><dd className={index===1&&BigInt(item.value)>0n?'crm-finance-overdue':undefined}>{money(item.value)}</dd></div>)}</dl><div className="crm-finance-summary-note"><span>Đối chiếu ngày {day(summary.asOf)}</span><span>Hạn mức đang sử dụng: <strong>{money(sum(scope,'usedAmount'))}</strong></span><span>Đơn chờ ghi sổ chưa tính vào phải thu.</span></div></div>
   <div className="crm-finance-filters"><label>Đối tác<select aria-label="Lọc công nợ theo đối tác" value={organizationId} onChange={event=>setOrganizationId(event.target.value)}><option value="">Tất cả khách hàng / đại lý</option>{choices.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select></label>{organizationId&&<button type="button" className="crm-sheet-tool-btn" onClick={()=>setOrganizationId('')}>Xóa bộ lọc đối tác</button>}<span>Số tổng hợp lấy từ toàn bộ sổ trong phạm vi được xem.</span></div>
  </>}
  <div className="crm-dashboard-sheets">
   <div className="crm-dash-sheet-switcher" role="tablist" aria-label="Các phần công nợ">{tabs.map(({key,label,count},index)=><button key={key} ref={element=>{if(element)tabRefs.current.set(key,element);else tabRefs.current.delete(key);}} type="button" role="tab" id={`${tabsId}-${key}-tab`} aria-controls={`${tabsId}-${key}-panel`} aria-selected={tab===key} tabIndex={tab===key?0:-1} className={`crm-sheet-tab ${tab===key?'active':''}`} onClick={()=>selectTab(key)} onKeyDown={event=>{const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:-1;if(next>=0){event.preventDefault();selectTab(tabs[next].key);tabRefs.current.get(tabs[next].key)?.focus();}}}><span>{label}</span>{count!==undefined&&<span className="crm-sheet-tab-badge">{count}</span>}</button>)}</div>
   {panel('partners',<>
    <div className="crm-finance-view-filter"><label>Hiện đối tác<select aria-label="Lọc tình trạng công nợ đối tác" value={partnerState} onChange={event=>setPartnerState(event.target.value)}><option value="all">Tất cả có nghiệp vụ</option><option value="open">Còn phải thu</option><option value="overdue">Có nợ quá hạn</option><option value="unposted">Có đơn chờ ghi sổ</option></select></label></div>
    <CrmSpreadsheet {...baseGrid} sheetKey="finance_receivable_partners" columns={partnerCols} defaultVisibleKeys={['organizationName','remainingAmount','overdueAmount','unpostedAmount','usedAmount']} rows={partnerRows} getRowKey={row=>row.organizationId} searchPlaceholder="Tìm tên khách hàng, đại lý…" emptyMessage="Không có đối tác khớp bộ lọc. Chọn tất cả để xem các khoản đã tất toán và hạn mức." drawerTitle={row=>row.organizationName} renderDrawer={row=><div className="crm-drawer-stack"><dl className="crm-finance-detail"><div><dt>Còn phải thu đã ghi sổ</dt><dd>{money(row.remainingAmount)}</dd></div><div><dt>Trong đó quá hạn</dt><dd>{money(row.overdueAmount)}</dd></div><div><dt>Đơn chờ ghi sổ</dt><dd>{money(row.unpostedAmount)} · {row.unpostedOrderCount} đơn</dd></div><div><dt>Hạn mức đang sử dụng</dt><dd>{money(row.usedAmount)}</dd></div><div><dt>Tiền chờ phân bổ</dt><dd>{money(row.unallocatedPaymentAmount)}</dd></div><div><dt>Khoản đã ghi sổ</dt><dd>{row.receivableCount}</dd></div></dl><div className="crm-finance-actions"><button type="button" className="crm-sheet-tool-btn" onClick={()=>{setOrganizationId(row.organizationId);selectTab('ledger');}}>Xem sổ phải thu của đối tác</button><button type="button" className="crm-sheet-tool-btn" onClick={()=>{setOrganizationId(row.organizationId);selectTab('limits');}}>Xem hạn mức của đối tác</button></div></div>}/>
   </>)}
   {panel('ledger',<>
    <div className="crm-finance-view-filter"><label>Khoản phải thu<select aria-label="Lọc trạng thái sổ phải thu" value={ledgerState} onChange={event=>setLedgerState(event.target.value)}><option value="all">Tất cả</option><option value="open">Còn phải thu</option><option value="overdue">Quá hạn</option><option value="paid">Đã tất toán</option><option value="disputed">Tranh chấp</option></select></label><span>Danh sách tối đa 200 khoản gần nhất. Tổng hợp phía trên bao gồm toàn bộ sổ.</span></div>
    <CrmSpreadsheet {...baseGrid} sheetKey="finance_receivable_ledger" columns={ledgerCols} rows={receivables} getRowKey={row=>row.id} searchPlaceholder="Tìm khoản phải thu, đối tác, chứng từ nguồn…" emptyMessage="Không có khoản phải thu trong danh sách gần nhất khớp bộ lọc. Đơn chưa ghi sổ nằm ở tab Đối chiếu đơn bán." drawerTitle={row=>`${row.code} · ${row.organization_name}`} renderDrawer={row=><div className="crm-drawer-stack"><dl className="crm-finance-detail"><div><dt>Chứng từ nguồn</dt><dd>{source(row)}</dd></div><div><dt>Hạn thanh toán</dt><dd>{day(row.due_on)}</dd></div><div><dt>Giá trị ghi sổ</dt><dd>{money(row.original_amount)}</dd></div><div><dt>Còn phải thu</dt><dd>{money(row.remaining_amount)}</dd></div><div><dt>Trạng thái</dt><dd>{receivableStatus[row.status]??row.status}</dd></div></dl>{canWrite&&<details className="work-disclosure"><summary>Điều chỉnh / tranh chấp</summary><ReceivableAdjustForm receivable={row}/></details>}{canWrite&&BigInt(row.remaining_amount)>0n&&<details className="work-disclosure"><summary>Lập lịch nhắc thanh toán</summary><ReminderForm receivable={row}/></details>}<h3>Lịch sử ghi nhận</h3><ul className="crm-finance-history">{data.receivableEvents.filter(event=>String(event.receivable_id)===row.id).map(event=><li key={String(event.id)}><strong>{String(event.action)}</strong> · {money(String(event.amount))}<p>{String(event.reason)}</p></li>)}</ul></div>}/>
    <details className="work-disclosure crm-finance-subsection"><summary>Phân tích tuổi nợ và lịch sử nhắc</summary><div className="work-table-wrap"><table className="work-table"><thead><tr><th>Đối tác</th><th>Nhóm tuổi nợ tại {day(aging.asOf)}</th><th>Dư nợ</th></tr></thead><tbody>{aging.rows.filter(row=>!organizationId||row.organization_id===organizationId).map((row,index)=><tr key={index}><td>{row.organization_name}</td><td>{agingLabel[row.bucket]??row.bucket}</td><td>{money(row.amount)}</td></tr>)}</tbody></table></div>{!aging.rows.length&&<p className="work-help">Không có dư nợ tại ngày đối chiếu.</p>}<h3>Lịch sử nhắc trong phạm vi được xem</h3>{data.reminders.length?<ul>{data.reminders.map(row=><li key={String(row.id)}>{String(row.channel)} · {String(row.status)} · {new Date(String(row.scheduled_for)).toLocaleString('vi-VN')}{row.last_error?` · ${String(row.last_error)}`:''}</li>)}</ul>:<p className="work-help">Chưa có lịch nhắc.</p>}</details>
   </>)}
   {panel('orders',reconciliation?<SalesReconciliationSheet initialData={reconciliation} basePath="/crm" workbench/>:<div role="alert" className="work-error">Chưa tải được bảng đối chiếu đơn bán. Tải lại trang để thử lại.</div>)}
   {panel('limits',<>
    <div className="crm-finance-section-heading"><p>Hạn mức đang dùng gồm cả khoản đã giữ cho đơn. Số này có thể khác nợ đã ghi sổ.</p>{canWrite&&<button type="button" className="crm-sheet-tool-btn" aria-expanded={showCredit} onClick={()=>setShowCredit(!showCredit)}>Cấu hình hạn mức đối tác</button>}</div>
    {showCredit&&canWrite&&<section className="crm-finance-inline-form" aria-label="Cấu hình hạn mức"><CreditForm key={organizationId} organizations={choices} accounts={data.accounts} initialOrganizationId={organizationId}/></section>}
    <CrmSpreadsheet {...baseGrid} sheetKey="finance_credit_accounts" columns={accountCols} rows={accounts} getRowKey={row=>row.organization_id} searchPlaceholder="Tìm đối tác có hạn mức…" emptyMessage="Đối tác chưa có cấu hình hạn mức. Mua chịu vẫn được kiểm tra trên máy chủ." drawerTitle={row=>`Hạn mức · ${row.organization_name}`} renderDrawer={row=>canWrite?<CreditForm key={row.organization_id+':'+row.version} organizations={choices} accounts={data.accounts} initialOrganizationId={row.organization_id}/>:<dl className="crm-finance-detail"><div><dt>Hạn mức</dt><dd>{money(row.limit_amount)}</dd></div><div><dt>Đang sử dụng</dt><dd>{money(row.used_amount)}</dd></div><div><dt>Kỳ hạn</dt><dd>{row.terms_days} ngày</dd></div></dl>}/>
   </>)}
   {panel('payments',<>
    <div className="crm-finance-section-heading"><p>Chỉ chứng từ đã xác nhận mới được phân bổ vào khoản phải thu.</p>{canWrite&&<button type="button" className="crm-sheet-tool-btn" aria-expanded={showUpload} onClick={()=>setShowUpload(!showUpload)}>Tải chứng từ thanh toán</button>}</div>
    {showUpload&&canWrite&&<section className="crm-finance-inline-form" aria-label="Tải chứng từ thanh toán"><PaymentProofCreateForm organizations={choices}/></section>}
    <CrmSpreadsheet {...baseGrid} sheetKey="finance_payment_receipts" columns={paymentCols} rows={payments} getRowKey={row=>row.id} searchPlaceholder="Tìm chứng từ thanh toán, đối tác…" emptyMessage="Chưa có chứng từ thanh toán trong danh sách gần nhất khớp đối tác." drawerTitle={row=>`${row.code} · ${row.organization_name}`} renderDrawer={row=><div className="crm-drawer-stack"><p>{row.kind==='DEPOSIT'?'Ứng trước':'Thanh toán'} · {money(row.amount)} · {paymentStatus[row.status]??row.status}</p><p>Tham chiếu: {row.reference}</p>{canWrite&&row.status==='PENDING'&&<PaymentReviewForm payment={row}/>} {canWrite&&row.status==='CONFIRMED'&&BigInt(row.available_amount??'0')>0n&&<><AllocationForm payment={row} receivables={data.receivables}/>{row.kind==='DEPOSIT'&&<DepositRefundForm payment={row}/>}</>}</div>}/>
    {canWrite&&<details className="work-disclosure crm-finance-subsection"><summary>Sao kê và ghép giao dịch toàn công ty</summary><p className="work-help">Phần sao kê chưa ghép chưa gắn với một đối tác; bộ lọc đối tác phía trên không áp dụng tại đây.</p><details className="work-disclosure"><summary>Nhập dòng sao kê</summary><BankImportForm/></details>{data.bankTransactions.map(row=><details className="work-disclosure" key={String(row.id)}><summary>{String(row.bank_code)} · {String(row.external_id)} · {money(String(row.amount))} · {row.payment_code?`Đã ghép ${String(row.payment_code)}`:'Chưa ghép'}</summary><p>{String(row.counterparty)} · {String(row.reference)}</p><BankMatchForm transaction={row as never} payments={data.payments} manager={canWrite}/></details>)}{!data.bankTransactions.length&&<p className="work-help">Chưa có dòng sao kê trong phạm vi được xem.</p>}</details>}
   </>)}
  </div>
 </div>;
}
