'use client';
import React, {useState, useMemo} from 'react';
import Link from 'next/link';
import {CrmSpreadsheet, type SpreadsheetColumn} from './CrmSpreadsheet';
import type {
 SalesReconciliationResult,
 ReconciliationOrderRow,
 ReconciliationLineRow,
 InventoryMatrixResult,
 MatrixProductRow,
 MatrixMovementItem,
} from '@/lib/crm/reconciliation';

function money(v: string | number | null | undefined): string {
 const n = Number(v ?? 0);
 if (!Number.isFinite(n)) return '0 ₫';
 return `${new Intl.NumberFormat('vi-VN').format(n)} ₫`;
}

function statusVi(status: string): string {
 const map: Record<string, string> = {
  CONFIRMED: 'Đã xác nhận',
  PENDING_APPROVAL: 'Chờ duyệt',
  CANCEL_REQUESTED: 'Chờ duyệt hủy',
  CANCELLED: 'Đã hủy',
  REJECTED: 'Đã từ chối',
  DELIVERED: 'Đã giao đủ',
  PARTIAL: 'Giao/Thu một phần',
  IN_TRANSIT: 'Đang vận chuyển',
  PACKED: 'Đã đóng kiện',
  PICKING: 'Đang soạn',
  PLANNED: 'Đã lên lịch',
  UNSCHEDULED: 'Chưa xếp giao',
  OPEN: 'Còn nợ',
  PAID: 'Đã tất toán',
  DISPUTED: 'Đang tranh chấp',
  UNPOSTED: 'Chưa ghi sổ nợ',
  RECEIPT: 'Nhập kho',
  ISSUE: 'Xuất kho bán',
  TRANSFER: 'Chuyển kho',
  COUNT: 'Kiểm kê',
  RETURN: 'Trả hàng',
  REVERSAL: 'Đảo phiếu',
  POSTED: 'Đã ghi sổ',
  REVERSED: 'Đã đảo',
 };
 return map[status] ?? status;
}

export function SalesReconciliationSheet({
 initialData,
 basePath = '/crm',
 defaultMode = 'orders',
}: {
 initialData: SalesReconciliationResult;
 basePath?: string;
 defaultMode?: 'orders' | 'lines';
}) {
 const [data, setData] = useState<SalesReconciliationResult>(initialData);
 const [mode, setMode] = useState<'orders' | 'lines'>(defaultMode);
 const [orgFilter, setOrgFilter] = useState('');
 const [whFilter, setWhFilter] = useState('');
 const [skuFilter, setSkuFilter] = useState('');
 const [statusFilter, setStatusFilter] = useState('');
 const [fromDate, setFromDate] = useState('');
 const [toDate, setToDate] = useState('');
 const [loading, setLoading] = useState(false);

 const reloadFromServer = async (overrides?: Record<string, string>) => {
  setLoading(true);
  try {
   const params = new URLSearchParams();
   const nextOrg = overrides?.organizationId ?? orgFilter;
   const nextWh = overrides?.warehouseId ?? whFilter;
   const nextSku = overrides?.sku ?? skuFilter;
   const nextStatus = overrides?.orderStatus ?? statusFilter;
   const nextFrom = overrides?.from ?? fromDate;
   const nextTo = overrides?.to ?? toDate;
   if (nextOrg) params.set('organizationId', nextOrg);
   if (nextWh) params.set('warehouseId', nextWh);
   if (nextSku) params.set('sku', nextSku);
   if (nextStatus) params.set('orderStatus', nextStatus);
   if (nextFrom) params.set('from', nextFrom);
   if (nextTo) params.set('to', nextTo);
   const res = await fetch(`/api/crm/spreadsheet/reconciliation?${params.toString()}`);
   if (res.ok) {
    setData((await res.json()) as SalesReconciliationResult);
   }
  } finally {
   setLoading(false);
  }
 };

 const orderColumns = useMemo<SpreadsheetColumn<ReconciliationOrderRow>[]>(
  () => [
   {
    key: 'orderCode',
    label: 'Mã đơn bán',
    type: 'code',
    width: 165,
    sticky: true,
    getValue: r => r.orderCode,
    renderCell: (r, {openDrawer}) => (
     <div className="crm-cell-code-group">
      <button type="button" className="crm-cell-link-btn" onClick={openDrawer}>
       {r.orderCode}
      </button>
      <span className="crm-mini-tag">V{r.versionNumber}</span>
     </div>
    ),
   },
   {
    key: 'orderDate',
    label: 'Ngày chứng từ',
    type: 'date',
    width: 112,
    sticky: true,
    getValue: r => r.orderDate,
   },
   {
    key: 'organizationName',
    label: 'Khách hàng / Đại lý',
    type: 'text',
    width: 190,
    sticky: true,
    groupable: true,
    getValue: r => `${r.organizationName} (${r.organizationCode})`,
    renderCell: r => (
     <div className="crm-cell-partner">
      <Link href={`${basePath}/${r.partnerKind === 'DEALER' ? 'dealers' : 'customers'}/${r.organizationId}`} className="crm-cell-strong-link">
       {r.organizationName}
      </Link>
      <span className="crm-cell-sub">{r.organizationCode}</span>
     </div>
    ),
   },
   {
    key: 'skuSummary',
    label: 'Mặt hàng & Quy cách đặt',
    type: 'text',
    width: 260,
    getValue: r => r.skuSummary,
    renderCell: (r, {openDrawer}) => (
     <div className="crm-cell-multiline" onClick={openDrawer}>
      <strong>{r.lineCount} SKU</strong> · {r.skuSummary}
     </div>
    ),
   },
   {
    key: 'totalBaseQty',
    label: 'Tổng SL (Gói)',
    type: 'number',
    unitGroup: 'BASE_QTY',
    summable: true,
    width: 115,
    getValue: r => r.totalBaseQty,
    renderCell: r => <strong>{r.totalBaseQty}</strong>,
   },
   {
    key: 'listSubtotal',
    label: 'Tiền hàng gốc (VND)',
    type: 'money',
    unitGroup: 'VND',
    summable: true,
    width: 148,
    getValue: r => r.listSubtotal,
    renderCell: r => money(r.listSubtotal),
   },
   {
    key: 'discountPercentLabel',
    label: '% CK',
    type: 'text',
    align: 'right',
    groupable: true,
    width: 82,
    getValue: r => r.discountPercentLabel,
    renderCell: r => (
     <span className={r.discountPercentLabel !== '0%' ? 'crm-badge-discount' : 'muted'}>{r.discountPercentLabel}</span>
    ),
   },
   {
    key: 'discountAmount',
    label: 'Tiền chiết khấu (VND)',
    type: 'money',
    unitGroup: 'VND',
    summable: true,
    width: 148,
    getValue: r => r.discountAmount,
    renderCell: r => <span className={Number(r.discountAmount) > 0 ? 'crm-text-discount' : 'muted'}>-{money(r.discountAmount)}</span>,
   },
   {
    key: 'netTotal',
    label: 'Thành tiền sau CK (VND)',
    type: 'money',
    unitGroup: 'VND',
    summable: true,
    width: 158,
    getValue: r => r.netTotal,
    renderCell: r => <strong className="crm-text-net">{money(r.netTotal)}</strong>,
   },
   {
    key: 'issueDocCodes',
    label: 'Phiếu xuất / Giao hàng',
    type: 'code',
    width: 175,
    groupable: true,
    getValue: r => [...r.issueDocCodes, ...r.deliveryCodes].join(', ') || 'Chưa xuất',
    renderCell: r => (
     <div className="crm-cell-codes">
      {r.issueDocCodes.length > 0 ? (
       r.issueDocCodes.map(c => (
        <span key={c} className="crm-code-chip">
         {c}
        </span>
       ))
      ) : r.deliveryCodes.length > 0 ? (
       r.deliveryCodes.map(c => (
        <span key={c} className="crm-code-chip">
         {c}
        </span>
       ))
      ) : (
       <span className="muted">Chưa xuất kho</span>
      )}
      {r.warehouseCodes.length > 0 && <span className="crm-cell-sub">Kho: {r.warehouseCodes.join(', ')}</span>}
     </div>
    ),
   },
   {
    key: 'deliveredQty',
    label: 'SL đã giao',
    type: 'number',
    unitGroup: 'BASE_QTY',
    summable: true,
    width: 105,
    getValue: r => r.deliveredQty,
   },
   {
    key: 'receivableCodes',
    label: 'Mã phải thu',
    type: 'code',
    width: 150,
    getValue: r => r.receivableCodes.join(', ') || 'Chưa ghi sổ',
    renderCell: r =>
     r.receivableCodes.length > 0 ? (
      <Link href={`${basePath}/finance`} className="crm-code-chip">
       {r.receivableCodes.join(', ')}
      </Link>
     ) : (
      <span className="muted">Chưa ghi sổ</span>
     ),
   },
   {
    key: 'receivableOriginal',
    label: 'Phải thu gốc (VND)',
    type: 'money',
    unitGroup: 'VND',
    summable: true,
    width: 145,
    getValue: r => r.receivableOriginal,
    renderCell: r => money(r.receivableOriginal),
   },
   {
    key: 'paidAmount',
    label: 'Đã thanh toán (VND)',
    type: 'money',
    unitGroup: 'VND',
    summable: true,
    width: 148,
    getValue: r => r.paidAmount,
    renderCell: r => <span className={Number(r.paidAmount) > 0 ? 'crm-text-positive' : 'muted'}>{money(r.paidAmount)}</span>,
   },
   {
    key: 'remainingDebt',
    label: 'Còn nợ phải thu (VND)',
    type: 'money',
    unitGroup: 'VND',
    summable: true,
    width: 156,
    getValue: r => r.remainingDebt,
    renderCell: r => (
     <strong className={Number(r.remainingDebt) > 0 ? 'crm-text-debt' : 'crm-text-positive'}>
      {money(r.remainingDebt)}
     </strong>
    ),
   },
   {
    key: 'receivableStatus',
    label: 'Trạng thái đối soát',
    type: 'status',
    width: 140,
    groupable: true,
    getValue: r => statusVi(r.receivableStatus),
    renderCell: r => (
     <span
      className={`status-badge ${
       r.receivableStatus === 'PAID'
        ? 'status-ready'
        : r.receivableStatus === 'OPEN' || r.receivableStatus === 'PARTIAL'
          ? 'status-pending_review'
          : 'status-in_progress'
      }`}
     >
      {statusVi(r.receivableStatus)}
     </span>
    ),
   },
  ],
  [basePath]
 );

 const lineColumns = useMemo<SpreadsheetColumn<ReconciliationLineRow>[]>(
  () => [
   {
    key: 'orderCode',
    label: 'Mã đơn bán',
    type: 'code',
    width: 158,
    sticky: true,
    groupable: true,
    getValue: r => r.orderCode,
    renderCell: (r, {openDrawer}) => (
     <button type="button" className="crm-cell-link-btn" onClick={openDrawer}>
      {r.orderCode}
     </button>
    ),
   },
   {
    key: 'orderDate',
    label: 'Ngày',
    type: 'date',
    width: 106,
    sticky: true,
    getValue: r => r.orderDate,
   },
   {
    key: 'organizationName',
    label: 'Khách hàng / Đại lý',
    type: 'text',
    width: 165,
    sticky: true,
    groupable: true,
    getValue: r => r.organizationName,
   },
   {
    key: 'sku',
    label: 'Mã SKU',
    type: 'code',
    width: 170,
    groupable: true,
    getValue: r => r.sku,
   },
   {
    key: 'productName',
    label: 'Tên sản phẩm',
    type: 'text',
    width: 220,
    groupable: true,
    getValue: r => r.productName,
    renderCell: r => <strong>{r.productName}</strong>,
   },
   {
    key: 'unitLabel',
    label: 'ĐVT',
    type: 'text',
    align: 'center',
    width: 82,
    getValue: r => r.unitLabel,
   },
   {
    key: 'baseQuantity',
    label: 'Số lượng (Gói)',
    type: 'number',
    unitGroup: 'BASE_QTY',
    summable: true,
    width: 115,
    getValue: r => r.baseQuantity,
    renderCell: r => <strong>{r.baseQuantity}</strong>,
   },
   {
    key: 'listUnitPrice',
    label: 'Đơn giá niêm yết',
    type: 'money',
    unitGroup: 'VND_UNIT',
    summable: false,
    width: 132,
    getValue: r => r.listUnitPrice,
    renderCell: r => money(r.listUnitPrice),
   },
   {
    key: 'listAmount',
    label: 'Thành tiền gốc (VND)',
    type: 'money',
    unitGroup: 'VND',
    summable: true,
    width: 148,
    getValue: r => r.listAmount,
    renderCell: r => money(r.listAmount),
   },
   {
    key: 'discountPercent',
    label: '% CK',
    type: 'text',
    align: 'right',
    groupable: true,
    width: 82,
    getValue: r => r.discountPercent,
    renderCell: r => <span className={r.discountPercent !== '0%' ? 'crm-badge-discount' : 'muted'}>{r.discountPercent}</span>,
   },
   {
    key: 'discountAmount',
    label: 'Tiền chiết khấu (VND)',
    type: 'money',
    unitGroup: 'VND',
    summable: true,
    width: 148,
    getValue: r => r.discountAmount,
    renderCell: r => <span className={Number(r.discountAmount) > 0 ? 'crm-text-discount' : 'muted'}>-{money(r.discountAmount)}</span>,
   },
   {
    key: 'unitPriceAfterDiscount',
    label: 'Đơn giá sau CK',
    type: 'money',
    unitGroup: 'VND_UNIT',
    summable: false,
    width: 132,
    getValue: r => r.unitPriceAfterDiscount,
    renderCell: r => money(r.unitPriceAfterDiscount),
   },
   {
    key: 'lineTotal',
    label: 'Thành tiền sau CK (VND)',
    type: 'money',
    unitGroup: 'VND',
    summable: true,
    width: 156,
    getValue: r => r.lineTotal,
    renderCell: r => <strong className="crm-text-net">{money(r.lineTotal)}</strong>,
   },
   {
    key: 'issueDocCodes',
    label: 'Phiếu xuất kho',
    type: 'code',
    width: 155,
    getValue: r => r.issueDocCodes.join(', ') || r.deliveryCodes.join(', ') || '—',
   },
   {
    key: 'receivableCode',
    label: 'Chứng từ phải thu',
    type: 'code',
    width: 150,
    getValue: r => r.receivableCode ?? '—',
   },
  ],
  []
 );

 const renderOrderDrawer = (order: ReconciliationOrderRow) => (
  <div className="crm-drawer-stack">
   <div className="crm-drawer-kv-grid">
    <div>
     <span>Đối tác</span>
     <strong>
      {order.organizationName} ({order.organizationCode})
     </strong>
    </div>
    <div>
     <span>Ngày chứng từ</span>
     <strong>{order.orderDate}</strong>
    </div>
    <div>
     <span>Phiếu xuất kho</span>
     <strong>{order.issueDocCodes.join(', ') || order.deliveryCodes.join(', ') || 'Chưa xuất'}</strong>
    </div>
    <div>
     <span>Chứng từ phải thu</span>
     <strong>{order.receivableCodes.join(', ') || 'Chưa ghi sổ'}</strong>
    </div>
    <div>
     <span>Tiền hàng trước CK</span>
     <strong>{money(order.listSubtotal)}</strong>
    </div>
    <div>
     <span>Chiết khấu ({order.discountPercentLabel})</span>
     <strong className="crm-text-discount">-{money(order.discountAmount)}</strong>
    </div>
    <div>
     <span>Thành tiền sau CK</span>
     <strong className="crm-text-net">{money(order.netTotal)}</strong>
    </div>
    <div>
     <span>Còn nợ phải thu</span>
     <strong className="crm-text-debt">{money(order.remainingDebt)}</strong>
    </div>
   </div>

   {order.note && (
    <div className="crm-drawer-note">
     <strong>Ghi chú chứng từ:</strong> {order.note}
    </div>
   )}

   <div className="crm-drawer-section">
    <h4>Bảng dòng hàng & Chiết khấu trong đơn ({order.lines.length} dòng)</h4>
    <div className="crm-table-wrap">
     <table className="data-table crm-spreadsheet-table">
      <thead>
       <tr>
        <th>Sản phẩm</th>
        <th className="align-right">SL (Gói)</th>
        <th className="align-right">Đơn giá gốc</th>
        <th className="align-right">% CK</th>
        <th className="align-right">Tiền CK</th>
        <th className="align-right">Thành tiền sau CK</th>
       </tr>
      </thead>
      <tbody>
       {order.lines.map(l => (
        <tr key={l.rowKey}>
         <td>
          <strong>{l.productName}</strong>
          <div className="crm-cell-sub">{l.sku}</div>
         </td>
         <td className="align-right crm-nowrap">{l.baseQuantity}</td>
         <td className="align-right crm-nowrap">{money(l.listUnitPrice)}</td>
         <td className="align-right crm-nowrap">{l.discountPercent}</td>
         <td className="align-right crm-nowrap crm-text-discount">-{money(l.discountAmount)}</td>
         <td className="align-right crm-nowrap">
          <strong>{money(l.lineTotal)}</strong>
         </td>
        </tr>
       ))}
      </tbody>
     </table>
    </div>
   </div>

   <div className="crm-drawer-links">
    <Link href={`${basePath}/sales/${order.orderId}`} className="btn primary">
     Mở chứng từ Đơn bán ↗
    </Link>
    <Link href={`${basePath}/${order.partnerKind === 'DEALER' ? 'dealers' : 'customers'}/${order.organizationId}`} className="btn secondary">
     Mở hồ sơ Đối tác ↗
    </Link>
    <Link href={`${basePath}/finance`} className="btn secondary">
     Mở sổ Công nợ ↗
    </Link>
   </div>
  </div>
 );

 return (
  <section className="crm-reconciliation-container" aria-label="Bảng tính đối chiếu bán hàng - giao hàng - công nợ">
   {/* Compact KPI Strip */}
   <div className="crm-compact-kpi-strip">
    <div className="crm-compact-kpi">
     <span>Số đơn / Dòng SKU</span>
     <strong>
      {data.totals.orderCount} đơn · {data.totals.lineCount} dòng
     </strong>
    </div>
    <div className="crm-compact-kpi">
     <span>Tổng SL xuất bán</span>
     <strong>{data.totals.totalBaseQty} gói</strong>
    </div>
    <div className="crm-compact-kpi">
     <span>Tiền hàng niêm yết</span>
     <strong>{money(data.totals.listSubtotal)}</strong>
    </div>
    <div className="crm-compact-kpi">
     <span>Tổng chiết khấu</span>
     <strong className="crm-text-discount">-{money(data.totals.discountAmount)}</strong>
    </div>
    <div className="crm-compact-kpi">
     <span>Thành tiền sau CK</span>
     <strong className="crm-text-net">{money(data.totals.netTotal)}</strong>
    </div>
    <div className="crm-compact-kpi">
     <span>Đã thanh toán</span>
     <strong className="crm-text-positive">{money(data.totals.paidAmount)}</strong>
    </div>
    <div className="crm-compact-kpi accent">
     <span>Còn nợ phải thu</span>
     <strong className="crm-text-debt">{money(data.totals.remainingDebt)}</strong>
    </div>
   </div>

   {/* Server Filter Bar */}
   <div className="crm-sheet-server-filters">
    <label>
     <span>Đối tác:</span>
     <select
      value={orgFilter}
      onChange={e => {
       setOrgFilter(e.target.value);
       void reloadFromServer({organizationId: e.target.value});
      }}
     >
      <option value="">Tất cả Khách hàng / Đại lý</option>
      {data.filterOptions.organizations.map(o => (
       <option key={o.id} value={o.id}>
        {o.name} ({o.code})
       </option>
      ))}
     </select>
    </label>

    {data.filterOptions.warehouses.length > 0 && (
     <label>
      <span>Kho xuất:</span>
      <select
       value={whFilter}
       onChange={e => {
        setWhFilter(e.target.value);
        void reloadFromServer({warehouseId: e.target.value});
       }}
      >
       <option value="">Tất cả kho</option>
       {data.filterOptions.warehouses.map(w => (
        <option key={w.id} value={w.id}>
         {w.name} ({w.code})
        </option>
       ))}
      </select>
     </label>
    )}

    <label>
     <span>Mặt hàng:</span>
     <select
      value={skuFilter}
      onChange={e => {
       setSkuFilter(e.target.value);
       void reloadFromServer({sku: e.target.value});
      }}
     >
      <option value="">Tất cả SKU</option>
      {data.filterOptions.skus.map(s => (
       <option key={s.sku} value={s.sku}>
        {s.name} ({s.sku})
       </option>
      ))}
     </select>
    </label>

    <label>
     <span>Trạng thái đơn:</span>
     <select
      value={statusFilter}
      onChange={e => {
       setStatusFilter(e.target.value);
       void reloadFromServer({orderStatus: e.target.value});
      }}
     >
      <option value="">Tất cả</option>
      <option value="CONFIRMED">Đã xác nhận</option>
      <option value="PENDING_APPROVAL">Chờ duyệt</option>
      <option value="CANCELLED">Đã hủy</option>
     </select>
    </label>

    <label>
     <span>Từ ngày:</span>
     <input
      type="date"
      value={fromDate}
      onChange={e => {
       setFromDate(e.target.value);
       void reloadFromServer({from: e.target.value});
      }}
     />
    </label>

    <label>
     <span>Đến ngày:</span>
     <input
      type="date"
      value={toDate}
      onChange={e => {
       setToDate(e.target.value);
       void reloadFromServer({to: e.target.value});
      }}
     />
    </label>

    {(orgFilter || whFilter || skuFilter || statusFilter || fromDate || toDate) && (
     <button
      type="button"
      className="crm-sheet-tool-btn"
      onClick={() => {
       setOrgFilter('');
       setWhFilter('');
       setSkuFilter('');
       setStatusFilter('');
       setFromDate('');
       setToDate('');
       void reloadFromServer({organizationId: '', warehouseId: '', sku: '', orderStatus: '', from: '', to: ''});
      }}
     >
      Xóa bộ lọc
     </button>
    )}
    {loading && <span className="muted">Đang tải...</span>}
   </div>

   {mode === 'orders' ? (
    <CrmSpreadsheet
     sheetKey="reconciliation_orders"
     title="Sổ Đối Chiếu Bán Hàng – Giao Hàng – Công Nợ"
     subtitle="Mỗi đơn bán là 1 dòng tổng hợp (không nhân bản số tiền khi có nhiều dòng hàng, nhiều lần giao hoặc nhiều lần thanh toán)"
     tabs={[
      {key: 'orders', label: '1. Tổng hợp theo Đơn bán & Công nợ', count: data.orders.length},
      {key: 'lines', label: '2. Bảng kê chi tiết từng dòng SKU & Chiết khấu', count: data.lineItems.length},
     ]}
     activeTab={mode}
     onTabChange={k => setMode(k as 'orders' | 'lines')}
     columns={orderColumns}
     rows={data.orders}
     getRowKey={r => r.orderId}
     renderDrawer={order => renderOrderDrawer(order)}
     drawerTitle={order => `Đơn bán ${order.orderCode} · ${order.organizationName}`}
     drawerFullPageHref={order => `${basePath}/sales/${order.orderId}`}
     totalDatasetCount={data.totals.orderCount}
     datasetTotals={[
      {label: 'Tiền gốc', value: money(data.totals.listSubtotal)},
      {label: 'Chiết khấu', value: `-${money(data.totals.discountAmount)}`, tone: 'warning'},
      {label: 'Thành tiền', value: money(data.totals.netTotal), tone: 'accent'},
      {label: 'Phải thu', value: money(data.totals.receivableOriginal)},
      {label: 'Đã thu', value: money(data.totals.paidAmount), tone: 'positive'},
      {label: 'Còn nợ', value: money(data.totals.remainingDebt), tone: 'danger'},
     ]}
    />
   ) : (
    <CrmSpreadsheet
     sheetKey="reconciliation_lines"
     title="Bảng Kê Chi Tiết Dòng Hàng, Đơn Giá & Chiết Khấu"
     subtitle="Đối chiếu từng mặt hàng SKU, số lượng, đơn giá niêm yết, tỷ lệ chiết khấu (VD: 40% đại lý) và thành tiền sau chiết khấu"
     tabs={[
      {key: 'orders', label: '1. Tổng hợp theo Đơn bán & Công nợ', count: data.orders.length},
      {key: 'lines', label: '2. Bảng kê chi tiết từng dòng SKU & Chiết khấu', count: data.lineItems.length},
     ]}
     activeTab={mode}
     onTabChange={k => setMode(k as 'orders' | 'lines')}
     columns={lineColumns}
     rows={data.lineItems}
     getRowKey={r => r.rowKey}
     renderDrawer={line => {
      const parent = data.orders.find(o => o.orderId === line.orderId);
      return parent ? renderOrderDrawer(parent) : <p>Không tìm thấy đơn hàng gốc.</p>;
     }}
     drawerTitle={line => `Đơn ${line.orderCode} · ${line.productName}`}
     drawerFullPageHref={line => `${basePath}/sales/${line.orderId}`}
     totalDatasetCount={data.totals.lineCount}
     datasetTotals={[
      {label: 'Tổng SL', value: `${data.totals.totalBaseQty} gói`},
      {label: 'Tổng tiền gốc', value: money(data.totals.listSubtotal)},
      {label: 'Tổng chiết khấu', value: `-${money(data.totals.discountAmount)}`, tone: 'warning'},
      {label: 'Tổng thành tiền sau CK', value: money(data.totals.netTotal), tone: 'accent'},
      {label: 'Công nợ đơn (không cộng trùng dòng)', value: money(data.totals.remainingDebt), tone: 'danger'},
     ]}
    />
   )}
  </section>
 );
}

export function InventoryMatrixSheet({
 initialData,
 basePath = '/crm',
 defaultTab = 'matrix',
}: {
 initialData: InventoryMatrixResult;
 basePath?: string;
 defaultTab?: 'matrix' | 'movements';
}) {
 const [data, setData] = useState<InventoryMatrixResult>(initialData);
 const [tab, setTab] = useState<'matrix' | 'movements'>(defaultTab);
 const [whFilter, setWhFilter] = useState('');
 const [partnerFilter, setPartnerFilter] = useState('');
 const [fromDate, setFromDate] = useState('');
 const [toDate, setToDate] = useState('');
 const [loading, setLoading] = useState(false);
 const [focusedColKey, setFocusedColKey] = useState<string | null>(null);

 const reloadMatrix = async (overrides?: Record<string, string>) => {
  setLoading(true);
  try {
   const params = new URLSearchParams();
   const nextWh = overrides?.warehouseId ?? whFilter;
   const nextPartner = overrides?.partnerId ?? partnerFilter;
   const nextFrom = overrides?.from ?? fromDate;
   const nextTo = overrides?.to ?? toDate;
   if (nextWh) params.set('warehouseId', nextWh);
   if (nextPartner) params.set('partnerId', nextPartner);
   if (nextFrom) params.set('from', nextFrom);
   if (nextTo) params.set('to', nextTo);
   const res = await fetch(`/api/crm/spreadsheet/inventory-matrix?${params.toString()}`);
   if (res.ok) {
    setData((await res.json()) as InventoryMatrixResult);
   }
  } finally {
   setLoading(false);
  }
 };

 const matrixColumns = useMemo<SpreadsheetColumn<MatrixProductRow>[]>(() => {
  const dynamicCols: SpreadsheetColumn<MatrixProductRow>[] = data.dynamicColumns.map(col => ({
   key: `dyn_${col.key}`,
   label: `Xuất: ${col.label} (${col.subLabel.split(' · ')[0]})`,
   type: 'number',
   unitGroup: 'BASE_QTY',
   summable: true,
   width: 144,
   getValue: r => r.dynamicOutbounds[col.key]?.qty ?? '0',
   renderCell: (r, {openDrawer}) => {
    const cell = r.dynamicOutbounds[col.key];
    const q = Number(cell?.qty ?? 0);
    if (!q) return <span className="muted">0</span>;
    return (
     <button
      type="button"
      className="crm-matrix-cell-btn"
      onClick={() => {
       setFocusedColKey(col.key);
       openDrawer();
      }}
      title={`Bấm để xem phiếu xuất ${col.documentCode} (${col.partnerName})`}
     >
      -{cell.qty}
     </button>
    );
   },
  }));

  return [
   {
    key: 'sku',
    label: 'Mã SKU',
    type: 'code',
    width: 175,
    sticky: true,
    getValue: r => r.sku,
   },
   {
    key: 'productName',
    label: 'Tên sản phẩm',
    type: 'text',
    width: 225,
    sticky: true,
    groupable: true,
    getValue: r => r.productName,
    renderCell: (r, {openDrawer}) => (
     <button
      type="button"
      className="crm-cell-link-btn"
      onClick={() => {
       setFocusedColKey(null);
       openDrawer();
      }}
     >
      {r.productName}
     </button>
    ),
   },
   {
    key: 'caseRuleLabel',
    label: 'Quy cách chuẩn',
    type: 'text',
    width: 138,
    groupable: true,
    getValue: r => r.caseRuleLabel,
   },
   {
    key: 'retailPrice',
    label: 'Đơn giá niêm yết',
    type: 'money',
    unitGroup: 'VND_UNIT',
    summable: false,
    width: 128,
    getValue: r => r.retailPrice,
    renderCell: r => money(r.retailPrice),
   },
   {
    key: 'openingQty',
    label: 'Tồn đầu kỳ',
    type: 'number',
    unitGroup: 'BASE_QTY',
    summable: true,
    width: 105,
    getValue: r => r.openingQty,
   },
   {
    key: 'receiptQty',
    label: 'Nhập trong kỳ',
    type: 'number',
    unitGroup: 'BASE_QTY',
    summable: true,
    width: 120,
    getValue: r => r.receiptQty,
    renderCell: r => (
     <div>
      <strong className={Number(r.receiptQty) > 0 ? 'crm-text-positive' : 'muted'}>+{r.receiptQty}</strong>
      {Number(r.receiptQty) > 0 && <div className="crm-cell-sub">{r.receiptCasesLabel}</div>}
     </div>
    ),
   },
   ...dynamicCols,
   {
    key: 'totalOutboundQty',
    label: 'Tổng xuất',
    type: 'number',
    unitGroup: 'BASE_QTY',
    summable: true,
    width: 112,
    getValue: r => r.totalOutboundQty,
    renderCell: r => (
     <strong className={Number(r.totalOutboundQty) > 0 ? 'crm-text-discount' : 'muted'}>
      {Number(r.totalOutboundQty) > 0 ? `-${r.totalOutboundQty}` : '0'}
     </strong>
    ),
   },
   {
    key: 'returnAndAdjustQty',
    label: 'Trả / Điều chỉnh',
    type: 'number',
    unitGroup: 'BASE_QTY',
    summable: true,
    width: 118,
    getValue: r => r.returnAndAdjustQty,
   },
   {
    key: 'closingOnHand',
    label: 'Tồn cuối kỳ (Thực tế)',
    type: 'number',
    unitGroup: 'BASE_QTY',
    summable: true,
    width: 145,
    getValue: r => r.closingOnHand,
    renderCell: r => (
     <div>
      <strong className="crm-text-net">{r.closingOnHand}</strong>
      <div className="crm-cell-sub">{r.closingCasesLabel}</div>
     </div>
    ),
   },
   {
    key: 'reservedQty',
    label: 'Đang giữ đơn',
    type: 'number',
    unitGroup: 'BASE_QTY',
    summable: true,
    width: 108,
    getValue: r => r.reservedQty,
   },
   {
    key: 'availableQty',
    label: 'Khả dụng xuất',
    type: 'number',
    unitGroup: 'BASE_QTY',
    summable: true,
    width: 118,
    getValue: r => r.availableQty,
    renderCell: r => <strong className="crm-text-positive">{r.availableQty}</strong>,
   },
   {
    key: 'retailStockValue',
    label: 'Giá trị tồn niêm yết',
    type: 'money',
    unitGroup: 'VND',
    summable: true,
    width: 152,
    getValue: r => r.retailStockValue,
    renderCell: r => money(r.retailStockValue),
   },
  ];
 }, [data.dynamicColumns]);

 const movementColumns = useMemo<SpreadsheetColumn<MatrixMovementItem>[]>(
  () => [
   {
    key: 'documentCode',
    label: 'Mã phiếu kho',
    type: 'code',
    width: 175,
    sticky: true,
    getValue: r => r.documentCode,
   },
   {
    key: 'date',
    label: 'Ngày giờ',
    type: 'date',
    width: 112,
    sticky: true,
    getValue: r => r.date,
   },
   {
    key: 'kind',
    label: 'Loại nghiệp vụ',
    type: 'status',
    width: 128,
    groupable: true,
    getValue: r => statusVi(r.kind),
    renderCell: r => (
     <span className={`status-badge ${r.kind === 'RECEIPT' ? 'status-ready' : 'status-in_progress'}`}>
      {statusVi(r.kind)}
     </span>
    ),
   },
   {
    key: 'partnerName',
    label: 'Đối tác / Nguồn',
    type: 'text',
    width: 165,
    groupable: true,
    getValue: r => r.partnerName,
    renderCell: r => <strong>{r.partnerName}</strong>,
   },
   {
    key: 'orderCode',
    label: 'Đơn hàng gắn kèm',
    type: 'code',
    width: 160,
    groupable: true,
    getValue: r => r.orderCode ?? '—',
    renderCell: r =>
     r.sourceOrderId && r.orderCode ? (
      <Link href={`${basePath}/sales/${r.sourceOrderId}`} className="crm-code-chip">
       {r.orderCode}
      </Link>
     ) : (
      <span className="muted">—</span>
     ),
   },
   {
    key: 'warehouseCode',
    label: 'Kho / Vị trí',
    type: 'code',
    width: 138,
    groupable: true,
    getValue: r => `${r.warehouseCode} / ${r.locationCode}`,
   },
   {
    key: 'productName',
    label: 'Mặt hàng SKU',
    type: 'text',
    width: 220,
    groupable: true,
    getValue: r => `${r.productName} (${r.sku})`,
    renderCell: r => (
     <div>
      <strong>{r.productName}</strong>
      <div className="crm-cell-sub">{r.sku}</div>
     </div>
    ),
   },
   {
    key: 'lotCode',
    label: 'Mã lô / HSD',
    type: 'code',
    width: 145,
    groupable: true,
    getValue: r => r.lotCode,
    renderCell: r => (
     <div>
      <span>{r.lotCode}</span>
      {r.expiresOn && <div className="crm-cell-sub">HSD: {r.expiresOn}</div>}
     </div>
    ),
   },
   {
    key: 'signedQuantity',
    label: 'Biến động (Gói)',
    type: 'number',
    unitGroup: 'BASE_QTY',
    summable: true,
    width: 125,
    getValue: r => r.signedQuantity,
    renderCell: r => (
     <strong className={r.signedQuantity.startsWith('-') ? 'crm-text-discount' : 'crm-text-positive'}>
      {r.signedQuantity}
     </strong>
    ),
   },
   {
    key: 'balanceAfter',
    label: 'Tồn sau phiếu',
    type: 'number',
    unitGroup: 'BALANCE_SNAPSHOT',
    summable: false,
    width: 118,
    getValue: r => r.balanceAfter,
   },
   {
    key: 'reason',
    label: 'Diễn giải chứng từ',
    type: 'text',
    width: 260,
    getValue: r => r.reason,
   },
  ],
  [basePath]
 );

 return (
  <section className="crm-reconciliation-container" aria-label="Bảng tính Nhập - Xuất - Tồn dạng ma trận">
   {/* Compact KPI Strip */}
   <div className="crm-compact-kpi-strip">
    <div className="crm-compact-kpi">
     <span>Số mặt hàng SKU</span>
     <strong>{data.totals.skuCount} SKU</strong>
    </div>
    <div className="crm-compact-kpi">
     <span>Tồn đầu kỳ</span>
     <strong>{data.totals.openingQty} gói</strong>
    </div>
    <div className="crm-compact-kpi">
     <span>Tổng nhập kho</span>
     <strong className="crm-text-positive">+{data.totals.receiptQty} gói</strong>
    </div>
    <div className="crm-compact-kpi">
     <span>Tổng xuất kho</span>
     <strong className="crm-text-discount">-{data.totals.totalOutboundQty} gói</strong>
    </div>
    <div className="crm-compact-kpi accent">
     <span>Tồn cuối kỳ (Thực tế)</span>
     <strong className="crm-text-net">{data.totals.closingOnHand} gói</strong>
    </div>
    <div className="crm-compact-kpi">
     <span>Khả dụng xuất</span>
     <strong className="crm-text-positive">{data.totals.availableQty} gói</strong>
    </div>
    <div className="crm-compact-kpi">
     <span>Giá trị tồn (Niêm yết)</span>
     <strong>{money(data.totals.retailStockValue)}</strong>
    </div>
   </div>

   {/* Server Filter Bar */}
   <div className="crm-sheet-server-filters">
    <label>
     <span>Kho:</span>
     <select
      value={whFilter}
      onChange={e => {
       setWhFilter(e.target.value);
       void reloadMatrix({warehouseId: e.target.value});
      }}
     >
      <option value="">Tất cả kho được phân quyền</option>
      {data.warehouses.map(w => (
       <option key={w.id} value={w.id}>
        {w.name} ({w.code})
       </option>
      ))}
     </select>
    </label>

    <label>
     <span>Đối tác nhận hàng:</span>
     <select
      value={partnerFilter}
      onChange={e => {
       setPartnerFilter(e.target.value);
       void reloadMatrix({partnerId: e.target.value});
      }}
     >
      <option value="">Tất cả đối tác</option>
      {data.partners.map(p => (
       <option key={p.id} value={p.id}>
        {p.name}
       </option>
      ))}
     </select>
    </label>

    <label>
     <span>Từ ngày:</span>
     <input
      type="date"
      value={fromDate}
      onChange={e => {
       setFromDate(e.target.value);
       void reloadMatrix({from: e.target.value});
      }}
     />
    </label>

    <label>
     <span>Đến ngày:</span>
     <input
      type="date"
      value={toDate}
      onChange={e => {
       setToDate(e.target.value);
       void reloadMatrix({to: e.target.value});
      }}
     />
    </label>

    {(whFilter || partnerFilter || fromDate || toDate) && (
     <button
      type="button"
      className="crm-sheet-tool-btn"
      onClick={() => {
       setWhFilter('');
       setPartnerFilter('');
       setFromDate('');
       setToDate('');
       void reloadMatrix({warehouseId: '', partnerId: '', from: '', to: ''});
      }}
     >
      Xóa bộ lọc
     </button>
    )}
    {loading && <span className="muted">Đang tải...</span>}
   </div>

   {tab === 'matrix' ? (
    <CrmSpreadsheet
     sheetKey="inventory_matrix_sheet"
     title="Bảng Nhập – Xuất – Tồn Dạng Ma Trận (Cột Động Theo Đợt Xuất & Đối Tác)"
     subtitle="Đối chiếu trực tiếp số lượng nhập kho, từng đợt xuất cho khách/đại lý và tồn thực tế còn lại trên cùng một mặt bảng"
     tabs={[
      {key: 'matrix', label: '1. Ma trận Nhập – Xuất – Tồn (Theo SKU & Cột xuất động)', count: data.rows.length},
      {key: 'movements', label: '2. Sổ chi tiết phiếu kho & Biến động lô', count: data.movements.length},
     ]}
     activeTab={tab}
     onTabChange={k => setTab(k as 'matrix' | 'movements')}
     columns={matrixColumns}
     rows={data.rows}
     getRowKey={r => r.productId}
     drawerTitle={r => `${r.productName} (${r.sku})`}
     drawerFullPageHref={() => `${basePath}/inventory`}
     renderDrawer={row => {
      const filteredMoves = focusedColKey
       ? row.dynamicOutbounds[focusedColKey]?.movements ?? []
       : row.allMovements;
      const focusedCol = focusedColKey ? data.dynamicColumns.find(c => c.key === focusedColKey) : null;
      return (
       <div className="crm-drawer-stack">
        <div className="crm-drawer-kv-grid">
         <div>
          <span>Mã SKU</span>
          <strong>{row.sku}</strong>
         </div>
         <div>
          <span>Quy cách đóng gói</span>
          <strong>{row.caseRuleLabel}</strong>
         </div>
         <div>
          <span>Tổng nhập trong kỳ</span>
          <strong className="crm-text-positive">
           +{row.receiptQty} ({row.receiptCasesLabel})
          </strong>
         </div>
         <div>
          <span>Tổng xuất trong kỳ</span>
          <strong className="crm-text-discount">-{row.totalOutboundQty} gói</strong>
         </div>
         <div>
          <span>Tồn thực tế cuối kỳ</span>
          <strong className="crm-text-net">
           {row.closingOnHand} ({row.closingCasesLabel})
          </strong>
         </div>
         <div>
          <span>Khả dụng xuất ngay</span>
          <strong className="crm-text-positive">{row.availableQty} gói</strong>
         </div>
        </div>

        <div className="crm-drawer-section">
         <div className="crm-drawer-section-head">
          <h4>
           {focusedCol
            ? `Chứng từ của cột "${focusedCol.label} (${focusedCol.subLabel})"`
            : `Toàn bộ chứng từ nhập/xuất của ${row.productName} (${filteredMoves.length} dòng)`}
          </h4>
          {focusedCol && (
           <button type="button" className="crm-sheet-tool-btn" onClick={() => setFocusedColKey(null)}>
            Xem tất cả các đợt ({row.allMovements.length})
           </button>
          )}
         </div>
         <div className="crm-table-wrap">
          <table className="data-table crm-spreadsheet-table">
           <thead>
            <tr>
             <th>Ngày</th>
             <th>Phiếu kho</th>
             <th>Đối tác / Đơn</th>
             <th className="align-right">Biến động</th>
             <th className="align-right">Tồn sau phiếu</th>
            </tr>
           </thead>
           <tbody>
            {filteredMoves.map(mv => (
             <tr key={mv.id}>
              <td className="crm-nowrap">{mv.date}</td>
              <td className="crm-nowrap">
               <strong>{mv.documentCode}</strong>
               <div className="crm-cell-sub">Lô: {mv.lotCode}</div>
              </td>
              <td>
               <strong>{mv.partnerName}</strong>
               {mv.sourceOrderId && mv.orderCode && (
                <div>
                 <Link href={`${basePath}/sales/${mv.sourceOrderId}`} className="crm-code-chip">
                  {mv.orderCode} ↗
                 </Link>
                </div>
               )}
              </td>
              <td className={`align-right crm-nowrap ${mv.signedQuantity.startsWith('-') ? 'crm-text-discount' : 'crm-text-positive'}`}>
               <strong>{mv.signedQuantity}</strong>
              </td>
              <td className="align-right crm-nowrap">{mv.balanceAfter}</td>
             </tr>
            ))}
           </tbody>
          </table>
         </div>
        </div>
       </div>
      );
     }}
     totalDatasetCount={data.totals.skuCount}
     datasetTotals={[
      {label: 'Tổng nhập', value: `+${data.totals.receiptQty} gói`, tone: 'positive'},
      ...data.dynamicColumns.map(c => ({
       label: `Xuất ${c.label}`,
       value: `-${data.totals.columnTotals[c.key] ?? '0'} gói`,
       tone: 'warning' as const,
      })),
      {label: 'Tổng xuất', value: `-${data.totals.totalOutboundQty} gói`, tone: 'warning'},
      {label: 'Tồn thực tế', value: `${data.totals.closingOnHand} gói`, tone: 'accent'},
      {label: 'Khả dụng', value: `${data.totals.availableQty} gói`, tone: 'positive'},
     ]}
    />
   ) : (
    <CrmSpreadsheet
     sheetKey="inventory_movements_ledger"
     title="Sổ Chi Tiết Phiếu Nhập – Xuất – Biến Động Tồn Kho"
     subtitle="Mỗi dòng là một bút toán xuất/nhập gắn liền với mã phiếu kho, lô hàng, vị trí và đơn hàng gốc"
     tabs={[
      {key: 'matrix', label: '1. Ma trận Nhập – Xuất – Tồn (Theo SKU & Cột xuất động)', count: data.rows.length},
      {key: 'movements', label: '2. Sổ chi tiết phiếu kho & Biến động lô', count: data.movements.length},
     ]}
     activeTab={tab}
     onTabChange={k => setTab(k as 'matrix' | 'movements')}
     columns={movementColumns}
     rows={data.movements}
     getRowKey={r => r.id}
     totalDatasetCount={data.movements.length}
     datasetTotals={[
      {label: 'Tổng nhập', value: `+${data.totals.receiptQty} gói`, tone: 'positive'},
      {label: 'Tổng xuất', value: `-${data.totals.totalOutboundQty} gói`, tone: 'warning'},
      {label: 'Tồn cuối kỳ', value: `${data.totals.closingOnHand} gói`, tone: 'accent'},
     ]}
    />
   )}
  </section>
 );
}
