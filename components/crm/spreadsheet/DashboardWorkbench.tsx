'use client';
import React, {useState} from 'react';
import Link from 'next/link';
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
 showTasks = true,
}: {
 reconciliation: SalesReconciliationResult | null;
 inventoryMatrix: InventoryMatrixResult | null;
 pendingOrders: OrderRecord[];
 tasks: TaskRecord[];
 overdueTasks: TaskRecord[];
 showTasks?: boolean;
}) {
 const defaultSheet =
  reconciliation && reconciliation.orders.length > 0
   ? 'reconciliation'
   : inventoryMatrix && inventoryMatrix.rows.length > 0
     ? 'matrix'
     : 'queues';

 const [activeSheet, setActiveSheet] = useState<'reconciliation' | 'matrix' | 'queues'>(defaultSheet);

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

 return (
  <div className="crm-dashboard-sheets">
   {/* Top Sheet Switcher Strip */}
   <div className="crm-dash-sheet-switcher" role="tablist" aria-label="Các sổ bảng tính điều hành">
    {reconciliation && (
     <button
      type="button"
      role="tab"
      aria-selected={activeSheet === 'reconciliation'}
      className={`crm-sheet-tab ${activeSheet === 'reconciliation' ? 'active' : ''}`}
      onClick={() => setActiveSheet('reconciliation')}
     >
      <span>📊 Sheet 1: Đối chiếu Bán hàng – Giao hàng – Công nợ</span>
      <span className="crm-sheet-tab-badge tone-warning">{reconciliation.orders.length} đơn</span>
     </button>
    )}
    {inventoryMatrix && (
     <button
      type="button"
      role="tab"
      aria-selected={activeSheet === 'matrix'}
      className={`crm-sheet-tab ${activeSheet === 'matrix' ? 'active' : ''}`}
      onClick={() => setActiveSheet('matrix')}
     >
      <span>📦 Sheet 2: Ma trận Nhập – Xuất – Tồn Kho</span>
      <span className="crm-sheet-tab-badge tone-positive">{inventoryMatrix.rows.length} SKU</span>
     </button>
    )}
    <button
     type="button"
     role="tab"
     aria-selected={activeSheet === 'queues'}
     className={`crm-sheet-tab ${activeSheet === 'queues' ? 'active' : ''}`}
     onClick={() => setActiveSheet('queues')}
    >
      <span>{showTasks ? '⚡ Sheet 3: Hàng đợi Yêu cầu Website & Việc cần xử lý' : '⚡ Sheet 3: Yêu cầu Website'}</span>
     <span className="crm-sheet-tab-badge tone-default">{pendingOrders.length + allTasks.length} mục</span>
    </button>
   </div>

   {activeSheet === 'reconciliation' && reconciliation && (
    <SalesReconciliationSheet initialData={reconciliation} basePath="/crm" />
   )}

   {activeSheet === 'matrix' && inventoryMatrix && (
    <InventoryMatrixSheet initialData={inventoryMatrix} basePath="/crm" />
   )}

   {activeSheet === 'queues' && (
    <div className="crm-dash-queues-stack">
     <CrmSpreadsheet
      sheetKey="dashboard_website_orders_queue"
      title="Yêu cầu Đặt hàng từ Website cần tiếp nhận"
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

     {showTasks&&<CrmSpreadsheet
      sheetKey="dashboard_tasks_queue"
      title="Việc Quá Hạn & Đến Hạn Hôm Nay"
      columns={taskCols}
      rows={allTasks}
      getRowKey={r => r.id}
      toolbarActions={
       <Link href="/crm/tasks" className="btn secondary">
        Mở bảng Công việc →
       </Link>
      }
     />}
    </div>
   )}
  </div>
 );
}
