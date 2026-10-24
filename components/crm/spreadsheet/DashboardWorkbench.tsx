'use client';
import React, {useId,useRef,useState} from 'react';
import Link from 'next/link';
import {Table,Warehouse,ListChecks} from '@phosphor-icons/react';
import './dashboard-workbench.css';
import {SalesReconciliationSheet, InventoryMatrixSheet} from './ReconciliationViews';
import {CrmSpreadsheet, type SpreadsheetColumn} from './CrmSpreadsheet';
import type {SalesReconciliationResult, InventoryMatrixResult} from '@/lib/crm/reconciliation';
import type {OrderRecord, TaskRecord} from '@/lib/crm/work-types';

const orderStatusLabel: Record<string, string> = {
 PENDING_REVIEW: 'Chờ tiếp nhận',
 IN_PROGRESS: 'Đang tư vấn',
 READY: 'Sẵn sàng chốt',
 REJECTED: 'Từ chối',
 CANCELLED: 'Đã hủy',
};

function money(v: string | number | null | undefined): string {
 const n = Number(v ?? 0);
 if (!Number.isFinite(n)) return '0 ₫';
 return `${new Intl.NumberFormat('vi-VN').format(n)} ₫`;
}

export function DashboardWorkbench({
 reconciliation,
 inventoryMatrix,
 pendingOrders,
 tasks,
 overdueTasks,
}: {
 reconciliation: SalesReconciliationResult | null;
 inventoryMatrix: InventoryMatrixResult | null;
 pendingOrders: OrderRecord[];
 tasks: TaskRecord[];
 overdueTasks: TaskRecord[];
}) {
 const defaultSheet =
  reconciliation && reconciliation.orders.length > 0
   ? 'reconciliation'
   : inventoryMatrix && inventoryMatrix.rows.length > 0
     ? 'matrix'
     : 'queues';

 type Sheet='reconciliation'|'matrix'|'queues';
 const [activeSheet,setActiveSheet]=useState<Sheet>(defaultSheet),[visited,setVisited]=useState<Set<Sheet>>(()=>new Set([defaultSheet]));
 const tabsId=useId(),tabRefs=useRef(new Map<Sheet,HTMLButtonElement>());
 const selectSheet=(key:Sheet)=>{setActiveSheet(key);setVisited(current=>new Set([...current,key]));};
 const websiteOrderCols: SpreadsheetColumn<OrderRecord>[] = [
  {
   key: 'code',
   label: 'Mã yêu cầu',
   type: 'code',
   width: 155,
   sticky: true,
   getValue: r => r.code,
   renderCell: r => (
    <Link href={`/crm/orders/${r.id}`} className="crm-cell-strong-link">
     {r.code}
    </Link>
   ),
  },
  {
   key: 'customer',
   label: 'Khách hàng / Điểm bán',
   type: 'text',
   width: 210,
   sticky: true,
   getValue: r => r.contact.fullName,
   renderCell: r => (
    <div>
     <strong>{r.contact.fullName}</strong>
     {r.organization_name && <div className="crm-cell-sub">{r.organization_name}</div>}
    </div>
   ),
  },
  {
   key: 'phone',
   label: 'Điện thoại',
   type: 'phone',
   width: 128,
   getValue: r => r.contact.phone,
  },
  {
   key: 'items',
   label: 'Số mặt hàng',
   type: 'number',
   summable: true,
   width: 105,
   getValue: r => r.lines?.length ?? 0,
   renderCell: r => `${r.lines?.length ?? 0} SP`,
  },
  {
   key: 'subtotal',
   label: 'Tạm tính (VND)',
   type: 'money',
   unitGroup: 'VND',
   summable: true,
   width: 145,
   getValue: r => r.subtotal,
   renderCell: r => <strong>{money(r.subtotal)}</strong>,
  },
  {
   key: 'assignee_name',
   label: 'Người phụ trách',
   type: 'text',
   groupable: true,
   width: 150,
   getValue: r => r.assignee_name ?? 'Chưa phân công',
  },
  {
   key: 'status',
   label: 'Trạng thái',
   type: 'status',
   groupable: true,
   width: 135,
   getValue: r => orderStatusLabel[r.status] ?? r.status,
   renderCell: r => <span className={`status-badge status-${r.status.toLowerCase()}`}>{orderStatusLabel[r.status] ?? r.status}</span>,
  },
  {
   key: 'created_at',
   label: 'Ngày gửi',
   type: 'date',
   width: 115,
   getValue: r => String(r.created_at).slice(0, 10),
  },
 ];

 const allTasks = [...overdueTasks, ...tasks.filter(t => !overdueTasks.some(o => o.id === t.id))];
 const taskCols: SpreadsheetColumn<TaskRecord>[] = [
  {
   key: 'title',
   label: 'Nội dung công việc',
   type: 'text',
   width: 260,
   sticky: true,
   getValue: r => r.title,
   renderCell: r => <strong>{r.title}</strong>,
  },
  {
   key: 'entity_label',
   label: 'Hồ sơ / Chứng từ liên quan',
   type: 'code',
   width: 185,
   groupable: true,
   getValue: r => r.entity_label ?? r.entity_id,
   renderCell: r => (
    <Link
     href={r.entity_type === 'order' ? `/crm/orders/${r.entity_id}` : `/crm/customers/${r.entity_id}`}
     className="crm-code-chip"
    >
     {r.entity_label ?? r.entity_id} ↗
    </Link>
   ),
  },
  {
   key: 'assignee_name',
   label: 'Phụ trách',
   type: 'text',
   groupable: true,
   width: 150,
   getValue: r => r.assignee_name,
  },
  {
   key: 'due_at',
   label: 'Hạn xử lý',
   type: 'date',
   width: 128,
   getValue: r => String(r.due_at).slice(0, 10),
  },
  {
   key: 'state',
   label: 'Tình trạng',
   type: 'status',
   width: 130,
   getValue: r => (r.done_at ? 'Hoàn thành' : overdueTasks.some(o => o.id === r.id) ? 'Quá hạn' : 'Trong hạn'),
   renderCell: r => {
    const isOver = !r.done_at && overdueTasks.some(o => o.id === r.id);
    return (
     <span className={`status-badge ${r.done_at ? 'status-ready' : isOver ? 'status-rejected' : 'status-pending_review'}`}>
      {r.done_at ? 'Hoàn thành' : isOver ? 'Quá hạn' : 'Trong ngày'}
     </span>
    );
   },
  },
 ];

 const sheets:{key:Sheet;label:string;count:string;icon:typeof Table}[]=[
  ...(reconciliation?[{key:'reconciliation' as const,label:'Bán hàng & công nợ',count:`${reconciliation.orders.length} đơn`,icon:Table}]:[]),
  ...(inventoryMatrix?[{key:'matrix' as const,label:'Nhập – xuất – tồn',count:`${inventoryMatrix.rows.length} mặt hàng`,icon:Warehouse}]:[]),
  {key:'queues',label:'Việc cần xử lý',count:`${pendingOrders.length+allTasks.length} mục`,icon:ListChecks},
 ];
 return (
  <div className="crm-dashboard-sheets">
   <div className="crm-dash-sheet-switcher" role="tablist" aria-label="Các sổ bảng tính điều hành">
    {sheets.map(({key,label,count,icon:Icon},index)=><button key={key} ref={element=>{if(element)tabRefs.current.set(key,element);else tabRefs.current.delete(key);}} type="button" role="tab" id={`${tabsId}-${key}-tab`} aria-controls={`${tabsId}-${key}-panel`} aria-selected={activeSheet===key} tabIndex={activeSheet===key?0:-1} className={`crm-sheet-tab ${activeSheet===key?'active':''}`} onClick={()=>selectSheet(key)} onKeyDown={event=>{
     const next=event.key==='Home'?0:event.key==='End'?sheets.length-1:event.key==='ArrowRight'?(index+1)%sheets.length:event.key==='ArrowLeft'?(index+sheets.length-1)%sheets.length:-1;
     if(next>=0){event.preventDefault();selectSheet(sheets[next].key);tabRefs.current.get(sheets[next].key)?.focus();}
    }}><Icon size={18} aria-hidden="true"/><span>{label}</span><span className="crm-sheet-tab-badge">{count}</span></button>)}
   </div>
   {reconciliation&&<div className="crm-dash-panel" role="tabpanel" id={`${tabsId}-reconciliation-panel`} aria-labelledby={`${tabsId}-reconciliation-tab`} hidden={activeSheet!=='reconciliation'}>{visited.has('reconciliation')&&<SalesReconciliationSheet initialData={reconciliation} basePath="/crm" workbench/>}</div>}
   {inventoryMatrix&&<div className="crm-dash-panel" role="tabpanel" id={`${tabsId}-matrix-panel`} aria-labelledby={`${tabsId}-matrix-tab`} hidden={activeSheet!=='matrix'}>{visited.has('matrix')&&<InventoryMatrixSheet initialData={inventoryMatrix} basePath="/crm" workbench/>}</div>}
   <div className="crm-dash-panel" role="tabpanel" id={`${tabsId}-queues-panel`} aria-labelledby={`${tabsId}-queues-tab`} hidden={activeSheet!=='queues'}>{visited.has('queues')&&(
    <div className="crm-dash-queues-stack">
     <CrmSpreadsheet
      sheetKey="dashboard_website_orders_queue"
      presentation="workbench"
      defaultDensity="comfortable"
      emptyMessage={pendingOrders.length?undefined:"Chưa có yêu cầu website cần tiếp nhận."}
      title="Yêu cầu website cần tiếp nhận"
      columns={websiteOrderCols}
      rows={pendingOrders}
      getRowKey={r => r.id}
      drawerTitle={r => `Yêu cầu ${r.code} · ${r.contact.fullName}`}
      drawerFullPageHref={r => `/crm/orders/${r.id}`}
      renderDrawer={r => (
       <div className="crm-drawer-stack">
        <div className="crm-drawer-kv-grid">
         <div>
          <span>Khách hàng</span>
          <strong>{r.contact.fullName}</strong>
         </div>
         <div>
          <span>Điện thoại</span>
          <strong>{r.contact.phone}</strong>
         </div>
         <div>
          <span>Địa chỉ giao</span>
          <strong>{r.contact.address}</strong>
         </div>
         <div>
          <span>Tổng tiền tạm tính</span>
          <strong className="crm-text-net">{money(r.subtotal)}</strong>
         </div>
        </div>
        {r.contact.note && (
         <div className="crm-drawer-note">
          <strong>Ghi chú khách hàng:</strong> {r.contact.note}
         </div>
        )}
        <div className="crm-drawer-links">
         <Link href={`/crm/orders/${r.id}`} className="btn primary">
          Mở xử lý Yêu cầu {r.code} ↗
         </Link>
        </div>
       </div>
      )}
      toolbarActions={
       <Link href="/crm/orders" className="btn secondary">
        Mở toàn bộ Yêu cầu Website →
       </Link>
      }
     />

     <CrmSpreadsheet
      sheetKey="dashboard_tasks_queue"
      presentation="workbench"
      defaultDensity="comfortable"
      emptyMessage={allTasks.length?undefined:"Không có việc quá hạn hoặc đến hạn hôm nay."}
      title="Việc quá hạn & hôm nay"
      columns={taskCols}
      rows={allTasks}
      getRowKey={r => r.id}
      toolbarActions={
       <Link href="/crm/tasks" className="btn secondary">
        Mở bảng Công việc →
       </Link>
      }
     />
    </div>
   )}</div>
  </div>
 );
}
