'use client';

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {ProductThumbZoom, resolveProductImage} from './CommercialForms';
import type {
  AccountantWorkspaceData,
  FactoryInvoiceRecord,
  OrderClearanceRecord,
} from '@/lib/crm/accountant-workflow';

function vnd(v: string | number | bigint | null | undefined) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return '0 ₫';
  return n.toLocaleString('vi-VN') + ' ₫';
}

function dt(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function clearanceBadge(status: OrderClearanceRecord['status']) {
  switch (status) {
    case 'NEW_ORDER':
      return {
        label: '1. Mới đặt — Chờ NV hoàn thiện tiền',
        bg: '#FEF3C7',
        color: '#92400E',
        border: '#F59E0B',
      };
    case 'STAFF_SUBMITTED':
      return {
        label: '2. NV đã nộp tiền — Chờ KT kiểm tra giá gốc & % giảm',
        bg: '#DBEAFE',
        color: '#1E40AF',
        border: '#3B82F6',
      };
    case 'ACCOUNTANT_CLEARED':
      return {
        label: '3. KT đã duyệt đủ tiền — Được lấy hàng khỏi kho',
        bg: '#D1FAE5',
        color: '#065F46',
        border: '#10B981',
      };
    case 'ACCOUNTANT_REJECTED':
      return {
        label: 'Cần bổ sung tiền — Chưa được xuất kho',
        bg: '#FEE2E2',
        color: '#991B1B',
        border: '#EF4444',
      };
    case 'PICKED_UP_DELIVERED':
      return {
        label: '4. Đã lấy hàng khỏi kho & Giao khách',
        bg: '#E0E7FF',
        color: '#3730A3',
        border: '#6366F1',
      };
  }
}

function factoryStageBadge(stage: FactoryInvoiceRecord['stage']) {
  switch (stage) {
    case 'FACTORY_ORDER':
      return {
        label: 'Bước 1 · HĐ Đặt hàng Nhà máy (Admin)',
        bg: '#FEF3C7',
        color: '#92400E',
      };
    case 'FACTORY_DISPATCH':
      return {
        label: 'Bước 2 · HĐ Xuất Nhà máy đẩy về Kho',
        bg: '#DBEAFE',
        color: '#1E40AF',
      };
    case 'WAREHOUSE_RECONCILIATION':
      return {
        label: 'Bước 3 · HĐ Đối chiếu của Quản lý Kho',
        bg: '#D1FAE5',
        color: '#065F46',
      };
  }
}

export function AccountantWorkspace({
  initialData,
  initialTab = 'orders',
  userRole,
}: {
  initialData?: AccountantWorkspaceData | null;
  initialTab?: 'orders' | 'factory' | 'warehouses' | 'notifications';
  userRole?: string;
}) {
  const [data, setData] = useState<AccountantWorkspaceData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [tab, setTab] = useState<'orders' | 'factory' | 'warehouses' | 'notifications'>(initialTab);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setTab(initialTab);
  }

  const [search, setSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [factoryStageFilter, setFactoryStageFilter] = useState<string>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{type: 'ok' | 'err'; text: string} | null>(null);

  // Expanded / selected order clearance for inspection or modal action
  const [selectedClearance, setSelectedClearance] = useState<OrderClearanceRecord | null>(null);
  const [clearanceModalMode, setClearanceModalMode] = useState<
    'VIEW' | 'STAFF_SUBMIT' | 'ACCOUNTANT_VERIFY' | 'PICKUP' | null
  >(null);

  // Staff submit payment form state
  const [submitAmount, setSubmitAmount] = useState('');
  const [submitMethod, setSubmitMethod] = useState<'BANK_TRANSFER' | 'CASH' | 'COMBINED'>('BANK_TRANSFER');
  const [submitRef, setSubmitRef] = useState('');
  const [submitWarehouseId, setSubmitWarehouseId] = useState('');

  // Accountant verify form state
  const [verifyNote, setVerifyNote] = useState('');
  const [verifyOverrideAmount, setVerifyOverrideAmount] = useState('');

  // Factory invoice creation modal state
  const [factoryModal, setFactoryModal] = useState<
    null | {
      mode: 'CREATE_ORDER' | 'CREATE_DISPATCH' | 'CREATE_RECONCILIATION' | 'VERIFY_DEBT';
      sourceInvoice?: FactoryInvoiceRecord;
    }
  >(null);
  const [factoryWarehouseId, setFactoryWarehouseId] = useState('');
  const [factoryNote, setFactoryNote] = useState('');
  const [factoryLines, setFactoryLines] = useState<
    Array<{
      productId: string;
      orderedQty: number;
      dispatchedQty: number;
      receivedQty: number;
      unitCost: number;
      note: string;
    }>
  >([]);
  const [debtPayAmount, setDebtPayAmount] = useState('');
  const [expandedFactoryId, setExpandedFactoryId] = useState<string | null>(null);

  const reloadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/crm/accountant/workspace', {cache: 'no-store'});
      const json = (await res.json()) as AccountantWorkspaceData;
      if (res.ok) {
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialData) return;
    let active = true;
    fetch('/api/crm/accountant/workspace', {cache: 'no-store'})
      .then(r => (r.ok ? r.json() : null))
      .then((json: AccountantWorkspaceData | null) => {
        if (active && json) setData(json);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialData]);

  const role = userRole ?? 'ACCOUNTANT';
  const canAccountantApprove = ['ACCOUNTANT', 'ADMIN', 'MANAGER'].includes(role);
  const canCreateFactoryOrder = ['ADMIN', 'MANAGER'].includes(role);
  const canCreateFactoryDispatch = ['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(role);
  const canCreateWarehouseReconcile = [
    'ADMIN',
    'MANAGER',
    'WAREHOUSE',
    'WAREHOUSE_HN',
    'WAREHOUSE_HCM',
  ].includes(role);

  const filteredOrders = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.orderClearances.filter((c: OrderClearanceRecord) => {
      if (orderStatusFilter !== 'ALL' && c.status !== orderStatusFilter) return false;
      if (warehouseFilter !== 'ALL' && c.warehouseCode !== warehouseFilter) return false;
      if (!q) return true;
      return (
        c.documentCode.toLowerCase().includes(q) ||
        c.organizationName.toLowerCase().includes(q) ||
        c.creatorName.toLowerCase().includes(q)
      );
    });
  }, [data, search, orderStatusFilter, warehouseFilter]);

  const filteredFactoryInvoices = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.factoryInvoices.filter((f: FactoryInvoiceRecord) => {
      if (factoryStageFilter !== 'ALL' && f.stage !== factoryStageFilter) return false;
      if (warehouseFilter !== 'ALL' && f.warehouseCode !== warehouseFilter) return false;
      if (!q) return true;
      return (
        f.code.toLowerCase().includes(q) ||
        f.warehouseName.toLowerCase().includes(q) ||
        f.note.toLowerCase().includes(q) ||
        (f.parentCode ?? '').toLowerCase().includes(q)
      );
    });
  }, [data, search, factoryStageFilter, warehouseFilter]);

  // Stock comparison matrix across Kho HN and Kho HCM per product
  const productWarehouseMatrix = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.products
      .filter(p => !q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .map(p => {
        const hn = data.warehouseStocks.find(
          s => s.productId === p.id && s.warehouseCode === 'KHO-HN'
        );
        const hcm = data.warehouseStocks.find(
          s => s.productId === p.id && s.warehouseCode === 'KHO-HCM'
        );
        const hnOnHand = Number(hn?.onHand ?? 0);
        const hnReserved = Number(hn?.reserved ?? 0);
        const hnAvail = Number(hn?.available ?? 0);
        const hcmOnHand = Number(hcm?.onHand ?? 0);
        const hcmReserved = Number(hcm?.reserved ?? 0);
        const hcmAvail = Number(hcm?.available ?? 0);
        return {
          ...p,
          imageUrl: resolveProductImage(p.sku),
          hnOnHand,
          hnReserved,
          hnAvail,
          hcmOnHand,
          hcmReserved,
          hcmAvail,
          totalOnHand: hnOnHand + hcmOnHand,
          totalAvailable: hnAvail + hcmAvail,
        };
      });
  }, [data, search]);

  function openClearanceModal(
    c: OrderClearanceRecord,
    mode: 'VIEW' | 'STAFF_SUBMIT' | 'ACCOUNTANT_VERIFY' | 'PICKUP'
  ) {
    setSelectedClearance(c);
    setClearanceModalMode(mode);
    setSubmitAmount(
      Number(c.staffSubmittedAmount) > 0 ? c.staffSubmittedAmount : c.netTotal
    );
    setSubmitMethod(
      (c.staffPaymentMethod as 'BANK_TRANSFER' | 'CASH' | 'COMBINED') || 'BANK_TRANSFER'
    );
    setSubmitRef(c.staffReference || `Nộp tiền đơn ${c.documentCode}`);
    setSubmitWarehouseId(
      c.warehouseId || data?.warehouses[0]?.id || ''
    );
    setVerifyNote(
      c.accountantNote ||
        `Đã kiểm tra giá gốc ${vnd(c.listSubtotal)}, giảm ${c.discountPercent}% còn ${vnd(c.netTotal)}. Nhân viên đã hoàn thiện đủ tiền.`
    );
    setVerifyOverrideAmount(
      Number(c.staffSubmittedAmount) > 0 ? c.staffSubmittedAmount : c.netTotal
    );
  }

  function openFactoryModal(
    mode: 'CREATE_ORDER' | 'CREATE_DISPATCH' | 'CREATE_RECONCILIATION' | 'VERIFY_DEBT',
    source?: FactoryInvoiceRecord
  ) {
    if (!data) return;
    setFactoryModal({mode, sourceInvoice: source});
    setFactoryWarehouseId(source?.warehouseId ?? data.warehouses[0]?.id ?? '');
    setFactoryNote(
      mode === 'CREATE_ORDER'
        ? 'Đặt hàng Nhà máy bổ sung tồn kho'
        : mode === 'CREATE_DISPATCH'
        ? `Xuất hàng từ Nhà máy về kho${source ? ` theo ${source.code}` : ''}`
        : mode === 'CREATE_RECONCILIATION'
        ? `Quản lý kho đối chiếu thực nhận với hóa đơn Nhà máy ${source?.code ?? ''}`
        : ''
    );
    setDebtPayAmount(source?.remainingDebt ?? '0');

    if (source && source.lines.length > 0) {
      setFactoryLines(
        source.lines.map(l => ({
          productId: l.productId,
          orderedQty: Number(l.orderedQty || 0),
          dispatchedQty:
            mode === 'CREATE_DISPATCH'
              ? Number(l.orderedQty || l.dispatchedQty || 0)
              : Number(l.dispatchedQty || 0),
          receivedQty:
            mode === 'CREATE_RECONCILIATION'
              ? Number(l.dispatchedQty || l.orderedQty || 0)
              : Number(l.receivedQty || 0),
          unitCost: Number(l.factoryUnitPrice || 0),
          note: l.note || '',
        }))
      );
    } else {
      setFactoryLines(
        data.products.slice(0, 8).map(p => ({
          productId: p.id,
          orderedQty: 100,
          dispatchedQty: 100,
          receivedQty: 100,
          unitCost: Math.round(Number(p.retail_price || 0) * 0.65),
          note: '',
        }))
      );
    }
  }

  async function submitAction(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/crm/accountant/${action}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setBanner({
          type: 'err',
          text: json?.error?.message || json?.message || 'Không thể thực hiện thao tác.',
        });
        return false;
      }
      setBanner({
        type: 'ok',
        text: 'Đã cập nhật chứng từ & gửi thông báo cho các bộ phận liên quan thành công.',
      });
      await reloadWorkspace();
      return true;
    } catch (e) {
      setBanner({
        type: 'err',
        text: e instanceof Error ? e.message : 'Lỗi kết nối máy chủ.',
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) {
    return (
      <div style={{padding: 24, background: '#fff', border: '1px solid #DBE2E8'}}>
        Đang tải dữ liệu Bàn làm việc Kế toán & Đối soát Nhà máy - Kho...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{padding: 24, background: '#fff', border: '1px solid #DBE2E8'}}>
        Không tải được dữ liệu Kế toán.{' '}
        <button type="button" className="btn" onClick={() => void reloadWorkspace()}>
          Thử lại
        </button>
      </div>
    );
  }

  // Summary metrics
  const pendingStaffCount = data.orderClearances.filter(
    c => c.status === 'NEW_ORDER' || c.status === 'ACCOUNTANT_REJECTED'
  ).length;
  const waitingAccountantCount = data.orderClearances.filter(
    c => c.status === 'STAFF_SUBMITTED'
  ).length;
  const clearedForPickupCount = data.orderClearances.filter(
    c => c.status === 'ACCOUNTANT_CLEARED'
  ).length;
  const totalFactoryDebt = data.warehouseFactoryDebts.reduce(
    (sum, w) => sum + Number(w.remainingFactoryDebt || 0),
    0
  );

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
      {/* Top Workflow Process Strip */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #DBE2E8',
          padding: '10px 14px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 10,
        }}
      >
        <div
          onClick={() => {
            setTab('orders');
            setOrderStatusFilter('NEW_ORDER');
          }}
          style={{
            cursor: 'pointer',
            padding: '8px 12px',
            borderLeft: '4px solid #F59E0B',
            background: '#FFFBEB',
          }}
        >
          <div style={{fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase'}}>
            1. HĐ Khách đặt · Chờ NV hoàn thiện tiền
          </div>
          <div style={{fontSize: 20, fontWeight: 800, color: '#142338', marginTop: 2}}>
            {pendingStaffCount} hóa đơn
          </div>
          <div style={{fontSize: 11, color: '#78350F'}}>
            Gửi đồng thời cho Nhân viên & Kế toán
          </div>
        </div>

        <div
          onClick={() => {
            setTab('orders');
            setOrderStatusFilter('STAFF_SUBMITTED');
          }}
          style={{
            cursor: 'pointer',
            padding: '8px 12px',
            borderLeft: '4px solid #2563EB',
            background: '#EFF6FF',
          }}
        >
          <div style={{fontSize: 11, fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase'}}>
            2. Chờ KT kiểm tra Giá gốc & % Giảm
          </div>
          <div style={{fontSize: 20, fontWeight: 800, color: '#142338', marginTop: 2}}>
            {waitingAccountantCount} hóa đơn
          </div>
          <div style={{fontSize: 11, color: '#1E3A8A'}}>
            Kiểm tra NV đã hoàn thiện đủ tiền chưa
          </div>
        </div>

        <div
          onClick={() => {
            setTab('orders');
            setOrderStatusFilter('ACCOUNTANT_CLEARED');
          }}
          style={{
            cursor: 'pointer',
            padding: '8px 12px',
            borderLeft: '4px solid #10B981',
            background: '#ECFDF5',
          }}
        >
          <div style={{fontSize: 11, fontWeight: 700, color: '#065F46', textTransform: 'uppercase'}}>
            3. KT Đã duyệt · Cho phép lấy hàng khỏi kho
          </div>
          <div style={{fontSize: 20, fontWeight: 800, color: '#142338', marginTop: 2}}>
            {clearedForPickupCount} đơn sẵn sàng giao
          </div>
          <div style={{fontSize: 11, color: '#047857'}}>
            NV nhận hàng từ kho đi giao khách
          </div>
        </div>

        <div
          onClick={() => setTab('warehouses')}
          style={{
            cursor: 'pointer',
            padding: '8px 12px',
            borderLeft: '4px solid #C84B11',
            background: '#FFF7ED',
          }}
        >
          <div style={{fontSize: 11, fontWeight: 700, color: '#9A3412', textTransform: 'uppercase'}}>
            4. Công nợ Kho (HN & HCM) với Nhà máy
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: '#C84B11',
              marginTop: 2,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {vnd(totalFactoryDebt)}
          </div>
          <div style={{fontSize: 11, color: '#9A3412'}}>
            Đối chiếu HĐ xuất Nhà máy & tồn 2 kho
          </div>
        </div>
      </div>

      {banner && (
        <div
          style={{
            padding: '10px 14px',
            background: banner.type === 'ok' ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${banner.type === 'ok' ? '#10B981' : '#EF4444'}`,
            color: banner.type === 'ok' ? '#065F46' : '#991B1B',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            style={{background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700}}
          >
            ✕
          </button>
        </div>
      )}

      {/* Sheet Tabs + Toolbar */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #DBE2E8',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '8px 12px',
            borderBottom: '1px solid #DBE2E8',
            background: '#F8FAFC',
          }}
        >
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
            <button
              type="button"
              onClick={() => setTab('orders')}
              style={{
                padding: '7px 12px',
                fontWeight: 700,
                fontSize: 12.5,
                border: '1px solid',
                borderColor: tab === 'orders' ? '#C84B11' : '#CBD5E1',
                background: tab === 'orders' ? '#C84B11' : '#FFFFFF',
                color: tab === 'orders' ? '#FFFFFF' : '#1E293B',
                cursor: 'pointer',
              }}
            >
              📋 1. Hóa đơn Khách đặt & NV Bàn giao ({data.orderClearances.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('factory')}
              style={{
                padding: '7px 12px',
                fontWeight: 700,
                fontSize: 12.5,
                border: '1px solid',
                borderColor: tab === 'factory' ? '#C84B11' : '#CBD5E1',
                background: tab === 'factory' ? '#C84B11' : '#FFFFFF',
                color: tab === 'factory' ? '#FFFFFF' : '#1E293B',
                cursor: 'pointer',
              }}
            >
              🏭 2. HĐ Nhà máy & Đối chiếu Kho ({data.factoryInvoices.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('warehouses')}
              style={{
                padding: '7px 12px',
                fontWeight: 700,
                fontSize: 12.5,
                border: '1px solid',
                borderColor: tab === 'warehouses' ? '#C84B11' : '#CBD5E1',
                background: tab === 'warehouses' ? '#C84B11' : '#FFFFFF',
                color: tab === 'warehouses' ? '#FFFFFF' : '#1E293B',
                cursor: 'pointer',
              }}
            >
              📦 3. Tồn kho HN & HCM + Công nợ Nhà máy
            </button>
            <button
              type="button"
              onClick={() => setTab('notifications')}
              style={{
                padding: '7px 12px',
                fontWeight: 700,
                fontSize: 12.5,
                border: '1px solid',
                borderColor: tab === 'notifications' ? '#C84B11' : '#CBD5E1',
                background: tab === 'notifications' ? '#C84B11' : '#FFFFFF',
                color: tab === 'notifications' ? '#FFFFFF' : '#1E293B',
                cursor: 'pointer',
              }}
            >
              🔔 4. Thông báo Hóa đơn ({data.notifications.length})
            </button>
          </div>

          <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8}}>
            <select
              value={warehouseFilter}
              onChange={e => setWarehouseFilter(e.target.value)}
              style={{
                height: 32,
                padding: '0 8px',
                border: '1px solid #CBD5E1',
                fontSize: 12.5,
                background: '#fff',
              }}
            >
              <option value="ALL">Tất cả kho (Kho HN + Kho HCM)</option>
              {data.warehouses.map(w => (
                <option key={w.id} value={w.code}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>

            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm mã HĐ, khách hàng, nhân viên, SKU..."
              style={{
                height: 32,
                width: 240,
                padding: '0 10px',
                border: '1px solid #CBD5E1',
                fontSize: 12.5,
              }}
            />

            <button
              type="button"
              onClick={() => void reloadWorkspace()}
              style={{
                height: 32,
                padding: '0 10px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ↻ Làm mới
            </button>
          </div>
        </div>

        {/* TAB 1: CUSTOMER ORDER INVOICES & STAFF HANDOVER CLEARANCE */}
        {tab === 'orders' && (
          <div>
            <div
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid #E2E8F0',
                background: '#FFFDF9',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center'}}>
                <span style={{fontSize: 12, fontWeight: 700, color: '#475569'}}>Lọc trạng thái:</span>
                {[
                  {id: 'ALL', label: `Tất cả (${data.orderClearances.length})`},
                  {id: 'NEW_ORDER', label: `Chờ NV hoàn thiện tiền (${pendingStaffCount})`},
                  {id: 'STAFF_SUBMITTED', label: `Chờ KT kiểm tra (${waitingAccountantCount})`},
                  {id: 'ACCOUNTANT_CLEARED', label: `KT đã duyệt xuất kho (${clearedForPickupCount})`},
                  {
                    id: 'PICKED_UP_DELIVERED',
                    label: `Đã lấy hàng & giao khách (${
                      data.orderClearances.filter(c => c.status === 'PICKED_UP_DELIVERED').length
                    })`,
                  },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setOrderStatusFilter(f.id)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 12,
                      fontWeight: orderStatusFilter === f.id ? 700 : 500,
                      border: '1px solid',
                      borderColor: orderStatusFilter === f.id ? '#142338' : '#CBD5E1',
                      background: orderStatusFilter === f.id ? '#142338' : '#FFFFFF',
                      color: orderStatusFilter === f.id ? '#FFFFFF' : '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div style={{fontSize: 12, color: '#475569'}}>
                Quy tắc: <strong>Khách đặt hàng → Hóa đơn gửi NV & Kế toán → NV hoàn thiện tiền cho KT → KT kiểm tra Giá gốc & % Giảm → Lấy hàng khỏi kho giao khách</strong>
              </div>
            </div>

            <div style={{overflowX: 'auto'}}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 12.5,
                }}
              >
                <thead>
                  <tr style={{background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left'}}>
                    <th style={{padding: '8px 10px', whiteSpace: 'nowrap'}}>Mã HĐ / Ngày</th>
                    <th style={{padding: '8px 10px'}}>Khách hàng / Đại lý</th>
                    <th style={{padding: '8px 10px'}}>Nhân viên phụ trách</th>
                    <th style={{padding: '8px 10px'}}>Kho bàn giao</th>
                    <th style={{padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap'}}>
                      Giá gốc (100%)
                    </th>
                    <th style={{padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap'}}>
                      % Giảm CK
                    </th>
                    <th style={{padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap'}}>
                      Tiền giảm
                    </th>
                    <th style={{padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap'}}>
                      Phải thu (Sau giảm)
                    </th>
                    <th style={{padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap'}}>
                      NV Đã hoàn thiện
                    </th>
                    <th style={{padding: '8px 10px'}}>Trạng thái KT Kiểm tra & Xuất kho</th>
                    <th style={{padding: '8px 10px', whiteSpace: 'nowrap'}}>Thao tác nghiệp vụ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{padding: 24, textAlign: 'center', color: '#64748B'}}>
                        Chưa có hóa đơn đặt hàng nào khớp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(c => {
                      const badge = clearanceBadge(c.status);
                      const diff = Number(c.netTotal) - Number(c.staffSubmittedAmount);
                      return (
                        <tr
                          key={c.id}
                          style={{
                            borderBottom: '1px solid #E2E8F0',
                            background:
                              selectedClearance?.id === c.id ? '#FFFBEB' : '#FFFFFF',
                          }}
                        >
                          <td style={{padding: '8px 10px', whiteSpace: 'nowrap'}}>
                            <div style={{fontWeight: 700, color: '#142338'}}>{c.documentCode}</div>
                            <div style={{fontSize: 11, color: '#64748B'}}>{dt(c.updatedAt)}</div>
                          </td>
                          <td style={{padding: '8px 10px'}}>
                            <div style={{fontWeight: 600, color: '#0F172A'}}>{c.organizationName}</div>
                            <div style={{fontSize: 11, color: '#64748B'}}>
                              {c.lines.length} mặt hàng · Kênh {c.channel}
                            </div>
                          </td>
                          <td style={{padding: '8px 10px'}}>
                            <div style={{fontWeight: 600}}>{c.creatorName}</div>
                            {c.staffSubmittedByName && (
                              <div style={{fontSize: 11, color: '#0369A1'}}>
                                Nộp: {c.staffSubmittedByName}
                              </div>
                            )}
                          </td>
                          <td style={{padding: '8px 10px', whiteSpace: 'nowrap'}}>
                            <span
                              style={{
                                padding: '2px 6px',
                                background: '#F1F5F9',
                                border: '1px solid #CBD5E1',
                                fontSize: 11.5,
                                fontWeight: 600,
                              }}
                            >
                              {c.warehouseName || 'Chưa chọn kho'}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: '8px 10px',
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              fontWeight: 600,
                              color: '#334155',
                            }}
                          >
                            {vnd(c.listSubtotal)}
                          </td>
                          <td style={{padding: '8px 10px', textAlign: 'center'}}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                background: '#FEF3C7',
                                color: '#B45309',
                                border: '1px solid #F59E0B',
                                fontWeight: 800,
                                fontSize: 12,
                              }}
                            >
                              -{Number(c.discountPercent).toFixed(2).replace(/\.00$/, '')}%
                            </span>
                          </td>
                          <td
                            style={{
                              padding: '8px 10px',
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              color: '#B45309',
                              fontWeight: 600,
                            }}
                          >
                            -{vnd(c.discountAmount)}
                          </td>
                          <td
                            style={{
                              padding: '8px 10px',
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              fontWeight: 800,
                              color: '#142338',
                            }}
                          >
                            {vnd(c.netTotal)}
                          </td>
                          <td
                            style={{
                              padding: '8px 10px',
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 800,
                                color:
                                  Number(c.staffSubmittedAmount) >= Number(c.netTotal)
                                    ? '#047857'
                                    : Number(c.staffSubmittedAmount) > 0
                                    ? '#B45309'
                                    : '#64748B',
                              }}
                            >
                              {vnd(c.staffSubmittedAmount)}
                            </div>
                            {diff > 0 && (
                              <div style={{fontSize: 11, color: '#DC2626', fontWeight: 600}}>
                                Còn thiếu: {vnd(diff)}
                              </div>
                            )}
                          </td>
                          <td style={{padding: '8px 10px'}}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                fontSize: 11.5,
                                fontWeight: 700,
                                background: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                              }}
                            >
                              {badge.label}
                            </span>
                            {c.accountantName && (
                              <div style={{fontSize: 11, color: '#475569', marginTop: 2}}>
                                KT: {c.accountantName} ({dt(c.accountantClearedAt)})
                              </div>
                            )}
                          </td>
                          <td style={{padding: '8px 10px', whiteSpace: 'nowrap'}}>
                            <div style={{display: 'flex', flexWrap: 'wrap', gap: 4}}>
                              <button
                                type="button"
                                onClick={() => openClearanceModal(c, 'VIEW')}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  border: '1px solid #CBD5E1',
                                  background: '#FFFFFF',
                                  cursor: 'pointer',
                                }}
                              >
                                👁️ Xem HĐ gốc
                              </button>

                              {c.status !== 'PICKED_UP_DELIVERED' && (
                                <button
                                  type="button"
                                  onClick={() => openClearanceModal(c, 'STAFF_SUBMIT')}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    border: '1px solid #2563EB',
                                    background: '#EFF6FF',
                                    color: '#1D4ED8',
                                    cursor: 'pointer',
                                  }}
                                >
                                  💵 NV Hoàn thiện tiền
                                </button>
                              )}

                              {canAccountantApprove && c.status !== 'PICKED_UP_DELIVERED' && (
                                <button
                                  type="button"
                                  onClick={() => openClearanceModal(c, 'ACCOUNTANT_VERIFY')}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    border: '1px solid #C84B11',
                                    background: '#C84B11',
                                    color: '#FFFFFF',
                                    cursor: 'pointer',
                                  }}
                                >
                                  ✅ KT Kiểm tra & Duyệt
                                </button>
                              )}

                              {c.status === 'ACCOUNTANT_CLEARED' && (
                                <button
                                  type="button"
                                  onClick={() => openClearanceModal(c, 'PICKUP')}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    border: '1px solid #059669',
                                    background: '#059669',
                                    color: '#FFFFFF',
                                    cursor: 'pointer',
                                  }}
                                >
                                  🚚 Lấy hàng & Giao khách
                                </button>
                              )}

                              <Link
                                href={`/crm/invoice-print?${
                                  c.orderId ? `orderId=${c.orderId}` : `requestId=${c.requestId}`
                                }`}
                                target="_blank"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  border: '1px solid #CBD5E1',
                                  background: '#F8FAFC',
                                  color: '#1E293B',
                                  textDecoration: 'none',
                                }}
                              >
                                🖨️ Xuất HĐ
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: FACTORY ORDERS, FACTORY DISPATCH & WAREHOUSE RECONCILIATION */}
        {tab === 'factory' && (
          <div>
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid #E2E8F0',
                background: '#FFFDF9',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
                {[
                  {id: 'ALL', label: `Tất cả (${data.factoryInvoices.length})`},
                  {
                    id: 'FACTORY_ORDER',
                    label: `1. HĐ Đặt Nhà máy (${
                      data.factoryInvoices.filter(f => f.stage === 'FACTORY_ORDER').length
                    })`,
                  },
                  {
                    id: 'FACTORY_DISPATCH',
                    label: `2. HĐ Xuất Nhà máy về Kho (${
                      data.factoryInvoices.filter(f => f.stage === 'FACTORY_DISPATCH').length
                    })`,
                  },
                  {
                    id: 'WAREHOUSE_RECONCILIATION',
                    label: `3. HĐ Đối chiếu Quản lý Kho (${
                      data.factoryInvoices.filter(
                        f => f.stage === 'WAREHOUSE_RECONCILIATION'
                      ).length
                    })`,
                  },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFactoryStageFilter(f.id)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 12,
                      fontWeight: factoryStageFilter === f.id ? 700 : 500,
                      border: '1px solid',
                      borderColor: factoryStageFilter === f.id ? '#142338' : '#CBD5E1',
                      background: factoryStageFilter === f.id ? '#142338' : '#FFFFFF',
                      color: factoryStageFilter === f.id ? '#FFFFFF' : '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
                {canCreateFactoryOrder && (
                  <button
                    type="button"
                    onClick={() => openFactoryModal('CREATE_ORDER')}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      background: '#142338',
                      color: '#FFFFFF',
                      border: '1px solid #142338',
                      cursor: 'pointer',
                    }}
                  >
                    + 1. Admin Tạo HĐ Đặt hàng Nhà máy
                  </button>
                )}
                {canCreateFactoryDispatch && (
                  <button
                    type="button"
                    onClick={() => openFactoryModal('CREATE_DISPATCH')}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      background: '#2563EB',
                      color: '#FFFFFF',
                      border: '1px solid #2563EB',
                      cursor: 'pointer',
                    }}
                  >
                    + 2. Nhà máy Xuất HĐ đẩy về Kho
                  </button>
                )}
                {canCreateWarehouseReconcile && (
                  <button
                    type="button"
                    onClick={() => openFactoryModal('CREATE_RECONCILIATION')}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      background: '#059669',
                      color: '#FFFFFF',
                      border: '1px solid #059669',
                      cursor: 'pointer',
                    }}
                  >
                    + 3. Quản lý Kho lập HĐ Đối chiếu Nhà máy
                  </button>
                )}
              </div>
            </div>

            <div style={{overflowX: 'auto'}}>
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12.5}}>
                <thead>
                  <tr style={{background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left'}}>
                    <th style={{padding: '8px 10px'}}>Mã HĐ / Ngày</th>
                    <th style={{padding: '8px 10px'}}>Loại chứng từ (Quy trình 3 bước)</th>
                    <th style={{padding: '8px 10px'}}>Kho nhận (HN / HCM)</th>
                    <th style={{padding: '8px 10px'}}>Chứng từ gốc</th>
                    <th style={{padding: '8px 10px', textAlign: 'right'}}>SL Đặt (gói)</th>
                    <th style={{padding: '8px 10px', textAlign: 'right'}}>SL Nhà máy Xuất</th>
                    <th style={{padding: '8px 10px', textAlign: 'right'}}>SL Kho Thực nhận</th>
                    <th style={{padding: '8px 10px', textAlign: 'right'}}>Tổng tiền (VND)</th>
                    <th style={{padding: '8px 10px', textAlign: 'right'}}>Còn nợ Nhà máy</th>
                    <th style={{padding: '8px 10px'}}>Trạng thái & KT Kiểm tra</th>
                    <th style={{padding: '8px 10px'}}>Thao tác tiếp theo</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFactoryInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{padding: 24, textAlign: 'center', color: '#64748B'}}>
                        Chưa có hóa đơn Nhà máy / Đối chiếu kho nào. Bấm các nút phía trên để tạo Hóa đơn đặt hàng Nhà máy, Hóa đơn xuất Nhà máy hoặc Hóa đơn đối chiếu Kho.
                      </td>
                    </tr>
                  ) : (
                    filteredFactoryInvoices.map(f => {
                      const tb = factoryStageBadge(f.stage);
                      const isExpanded = expandedFactoryId === f.id;
                      return (
                        <React.Fragment key={f.id}>
                          <tr style={{borderBottom: '1px solid #E2E8F0', background: '#FFFFFF'}}>
                            <td style={{padding: '8px 10px', whiteSpace: 'nowrap'}}>
                              <div style={{fontWeight: 700, color: '#142338'}}>{f.code}</div>
                              <div style={{fontSize: 11, color: '#64748B'}}>
                                {dt(f.createdAt)} · {f.createdByName}
                              </div>
                            </td>
                            <td style={{padding: '8px 10px'}}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  background: tb.bg,
                                  color: tb.color,
                                }}
                              >
                                {tb.label}
                              </span>
                            </td>
                            <td style={{padding: '8px 10px', fontWeight: 700}}>
                              {f.warehouseName} ({f.warehouseCode})
                            </td>
                            <td style={{padding: '8px 10px', color: '#475569'}}>
                              {f.parentCode || '—'}
                            </td>
                            <td
                              style={{
                                padding: '8px 10px',
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                                fontWeight: 600,
                              }}
                            >
                              {Number(f.totalOrderedQty).toLocaleString('vi-VN')}
                            </td>
                            <td
                              style={{
                                padding: '8px 10px',
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                                fontWeight: 700,
                                color: '#1D4ED8',
                              }}
                            >
                              {Number(f.totalDispatchedQty).toLocaleString('vi-VN')}
                            </td>
                            <td
                              style={{
                                padding: '8px 10px',
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                                fontWeight: 700,
                                color: '#047857',
                              }}
                            >
                              {Number(f.totalReceivedQty).toLocaleString('vi-VN')}
                            </td>
                            <td
                              style={{
                                padding: '8px 10px',
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                                fontWeight: 800,
                              }}
                            >
                              {vnd(f.totalAmount)}
                            </td>
                            <td
                              style={{
                                padding: '8px 10px',
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                                fontWeight: 800,
                                color: Number(f.remainingDebt) > 0 ? '#C84B11' : '#047857',
                              }}
                            >
                              {f.stage === 'FACTORY_ORDER' ? '—' : vnd(f.remainingDebt)}
                            </td>
                            <td style={{padding: '8px 10px'}}>
                              <div style={{fontWeight: 700, fontSize: 11.5}}>
                                {f.status === 'DISCREPANCY' ? (
                                  <span style={{color: '#DC2626'}}>⚠️ Có chênh lệch SL</span>
                                ) : f.status === 'RECONCILED' ? (
                                  <span style={{color: '#047857'}}>✓ Đã đối chiếu khớp</span>
                                ) : f.status === 'PAID' ? (
                                  <span style={{color: '#047857'}}>✓ Đã tất toán Nhà máy</span>
                                ) : (
                                  <span>{f.status}</span>
                                )}
                              </div>
                              {f.accountantVerified && (
                                <div style={{fontSize: 11, color: '#047857'}}>
                                  KT đã xác nhận: {f.accountantVerifiedByName}
                                </div>
                              )}
                            </td>
                            <td style={{padding: '8px 10px', whiteSpace: 'nowrap'}}>
                              <div style={{display: 'flex', flexWrap: 'wrap', gap: 4}}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedFactoryId(isExpanded ? null : f.id)
                                  }
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: 11.5,
                                    border: '1px solid #CBD5E1',
                                    background: '#FFFFFF',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {isExpanded ? '▲ Thu gọn' : `▼ Chi tiết (${f.lines.length} SP)`}
                                </button>

                                {f.stage === 'FACTORY_ORDER' && canCreateFactoryDispatch && (
                                  <button
                                    type="button"
                                    onClick={() => openFactoryModal('CREATE_DISPATCH', f)}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: 11.5,
                                      fontWeight: 700,
                                      background: '#2563EB',
                                      color: '#FFFFFF',
                                      border: '1px solid #2563EB',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    → Xuất HĐ Nhà máy đẩy về Kho
                                  </button>
                                )}

                                {f.stage === 'FACTORY_DISPATCH' &&
                                  canCreateWarehouseReconcile && (
                                    <button
                                      type="button"
                                      onClick={() => openFactoryModal('CREATE_RECONCILIATION', f)}
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: 11.5,
                                        fontWeight: 700,
                                        background: '#059669',
                                        color: '#FFFFFF',
                                        border: '1px solid #059669',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      → Quản lý Kho lập HĐ Đối chiếu
                                    </button>
                                  )}

                                {canAccountantApprove && (
                                  <button
                                    type="button"
                                    onClick={() => openFactoryModal('VERIFY_DEBT', f)}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: 11.5,
                                      fontWeight: 700,
                                      background: '#C84B11',
                                      color: '#FFFFFF',
                                      border: '1px solid #C84B11',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    ✅ KT Đối chiếu & Trả nợ NM
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr style={{background: '#F8FAFC', borderBottom: '1px solid #CBD5E1'}}>
                              <td colSpan={11} style={{padding: 12}}>
                                <div style={{fontWeight: 700, marginBottom: 6, color: '#142338'}}>
                                  Chi tiết mặt hàng trong chứng từ {f.code} ({f.warehouseName}) — Ghi chú: {f.note || 'Không có'}
                                </div>
                                <table
                                  style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    background: '#FFFFFF',
                                    border: '1px solid #CBD5E1',
                                    fontSize: 12,
                                  }}
                                >
                                  <thead>
                                    <tr style={{background: '#F1F5F9', borderBottom: '1px solid #CBD5E1'}}>
                                      <th style={{padding: 6}}>Mã SKU</th>
                                      <th style={{padding: 6}}>Tên sản phẩm</th>
                                      <th style={{padding: 6}}>Đơn vị</th>
                                      <th style={{padding: 6, textAlign: 'right'}}>SL Đặt</th>
                                      <th style={{padding: 6, textAlign: 'right'}}>SL Nhà máy Xuất</th>
                                      <th style={{padding: 6, textAlign: 'right'}}>SL Kho Thực nhận</th>
                                      <th style={{padding: 6, textAlign: 'right'}}>Chênh lệch</th>
                                      <th style={{padding: 6, textAlign: 'right'}}>Đơn giá Nhà máy</th>
                                      <th style={{padding: 6, textAlign: 'right'}}>Thành tiền</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {f.lines.map((l, idx) => (
                                      <tr key={`${l.productId}-${idx}`} style={{borderBottom: '1px solid #E2E8F0'}}>
                                        <td style={{padding: 6, fontWeight: 600}}>{l.sku}</td>
                                        <td style={{padding: 6}}>{l.name}</td>
                                        <td style={{padding: 6}}>{l.unitLabel}</td>
                                        <td style={{padding: 6, textAlign: 'right'}}>
                                          {Number(l.orderedQty).toLocaleString('vi-VN')}
                                        </td>
                                        <td style={{padding: 6, textAlign: 'right', color: '#1D4ED8', fontWeight: 600}}>
                                          {Number(l.dispatchedQty).toLocaleString('vi-VN')}
                                        </td>
                                        <td style={{padding: 6, textAlign: 'right', color: '#047857', fontWeight: 600}}>
                                          {Number(l.receivedQty).toLocaleString('vi-VN')}
                                        </td>
                                        <td
                                          style={{
                                            padding: 6,
                                            textAlign: 'right',
                                            fontWeight: 700,
                                            color:
                                              Number(l.discrepancyQty) !== 0 ? '#DC2626' : '#64748B',
                                          }}
                                        >
                                          {Number(l.discrepancyQty)}
                                        </td>
                                        <td style={{padding: 6, textAlign: 'right'}}>
                                          {vnd(l.factoryUnitPrice)}
                                        </td>
                                        <td style={{padding: 6, textAlign: 'right', fontWeight: 700}}>
                                          {vnd(l.lineTotal)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: WAREHOUSE STOCK (HN & HCM) + WAREHOUSE DEBT TO FACTORY */}
        {tab === 'warehouses' && (
          <div style={{display: 'flex', flexDirection: 'column', gap: 16, padding: 12}}>
            {/* Section A: Debt of each Warehouse (HN & HCM) to Factory */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <div>
                  <h3 style={{margin: 0, fontSize: 14, fontWeight: 800, color: '#142338'}}>
                    A. BẢNG ĐỐI CHIẾU CÔNG NỢ CỦA CÁC KHO (HÀ NỘI & TP.HCM) ĐỐI VỚI NHÀ MÁY
                  </h3>
                  <div style={{fontSize: 12, color: '#475569'}}>
                    Kế toán theo dõi tổng lượng hàng từ Nhà máy xuất ra cho từng kho, số lượng Quản lý kho đối chiếu thực nhận và công nợ còn phải trả Nhà máy.
                  </div>
                </div>
              </div>

              <div style={{overflowX: 'auto', border: '1px solid #CBD5E1'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12.5}}>
                  <thead>
                    <tr style={{background: '#142338', color: '#FFFFFF', textAlign: 'left'}}>
                      <th style={{padding: '8px 10px'}}>Mã Kho</th>
                      <th style={{padding: '8px 10px'}}>Tên Kho</th>
                      <th style={{padding: '8px 10px'}}>Khu vực</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Số HĐ Đặt NM</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Số HĐ NM Xuất</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Số HĐ Kho Đối chiếu</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Tổng SL NM Xuất (gói)</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Tổng SL Kho Nhận (gói)</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Tổng Giá trị Nhận từ NM</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Đã Thanh toán NM</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Công nợ Kho nợ Nhà máy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.warehouseFactoryDebts.map(w => (
                      <tr key={w.warehouseId} style={{borderBottom: '1px solid #E2E8F0', background: '#FFFFFF'}}>
                        <td style={{padding: '8px 10px', fontWeight: 800, color: '#142338'}}>
                          {w.warehouseCode}
                        </td>
                        <td style={{padding: '8px 10px', fontWeight: 700}}>{w.warehouseName}</td>
                        <td style={{padding: '8px 10px'}}>
                          {w.region === 'NORTH' ? 'Miền Bắc (Hà Nội)' : 'Miền Nam (TP.HCM)'}
                        </td>
                        <td style={{padding: '8px 10px', textAlign: 'right', fontWeight: 600}}>
                          {w.factoryOrderCount}
                        </td>
                        <td style={{padding: '8px 10px', textAlign: 'right', fontWeight: 600}}>
                          {w.factoryDispatchCount}
                        </td>
                        <td style={{padding: '8px 10px', textAlign: 'right', fontWeight: 600}}>
                          {w.reconciledCount}
                        </td>
                        <td
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 700,
                            color: '#1D4ED8',
                          }}
                        >
                          {Number(w.totalDispatchedPackages).toLocaleString('vi-VN')}
                        </td>
                        <td
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 700,
                            color: '#047857',
                          }}
                        >
                          {Number(w.totalReceivedPackages).toLocaleString('vi-VN')}
                        </td>
                        <td
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 700,
                          }}
                        >
                          {vnd(
                            Number(w.totalReconciledAmount) > 0
                              ? w.totalReconciledAmount
                              : w.totalDispatchedAmount
                          )}
                        </td>
                        <td
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            color: '#047857',
                            fontWeight: 700,
                          }}
                        >
                          {vnd(w.totalPaidAmount)}
                        </td>
                        <td
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 800,
                            color: '#C84B11',
                            background: '#FFF7ED',
                          }}
                        >
                          {vnd(w.remainingFactoryDebt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section B: Stock comparison table across Kho HN and Kho HCM */}
            <div>
              <h3 style={{margin: '0 0 4px 0', fontSize: 14, fontWeight: 800, color: '#142338'}}>
                B. BẢNG TÍNH SỐ LƯỢNG HÀNG TỒN TRONG KHO HÀ NỘI (KHO-HN) & KHO TP.HCM (KHO-HCM)
              </h3>
              <div style={{fontSize: 12, color: '#475569', marginBottom: 8}}>
                Di chuột vào ảnh để phóng to sản phẩm. Kế toán đối chiếu trực tiếp tồn kho thực tế tại Hà Nội và TP.HCM với các hóa đơn xuất từ Nhà máy.
              </div>

              <div style={{overflowX: 'auto', border: '1px solid #CBD5E1'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12.5}}>
                  <thead>
                    <tr style={{background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left'}}>
                      <th style={{padding: '8px 10px', width: 56}}>Hình ảnh</th>
                      <th style={{padding: '8px 10px'}}>Mã SKU</th>
                      <th style={{padding: '8px 10px'}}>Tên sản phẩm đang sản xuất</th>
                      <th style={{padding: '8px 10px'}}>Quy cách</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Giá gốc niêm yết</th>
                      <th
                        style={{
                          padding: '8px 10px',
                          textAlign: 'right',
                          background: '#EFF6FF',
                          color: '#1E40AF',
                        }}
                      >
                        Tồn Kho Hà Nội (gói)
                      </th>
                      <th
                        style={{
                          padding: '8px 10px',
                          textAlign: 'right',
                          background: '#EFF6FF',
                          color: '#1E40AF',
                        }}
                      >
                        Khả dụng Kho HN
                      </th>
                      <th
                        style={{
                          padding: '8px 10px',
                          textAlign: 'right',
                          background: '#ECFDF5',
                          color: '#065F46',
                        }}
                      >
                        Tồn Kho TP.HCM (gói)
                      </th>
                      <th
                        style={{
                          padding: '8px 10px',
                          textAlign: 'right',
                          background: '#ECFDF5',
                          color: '#065F46',
                        }}
                      >
                        Khả dụng Kho HCM
                      </th>
                      <th
                        style={{
                          padding: '8px 10px',
                          textAlign: 'right',
                          background: '#FFFBEB',
                          color: '#92400E',
                        }}
                      >
                        Tổng Tồn 2 Kho (HN + HCM)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {productWarehouseMatrix.map((p, idx) => (
                      <tr key={p.id} style={{borderBottom: '1px solid #E2E8F0', background: '#FFFFFF'}}>
                        <td style={{padding: '6px 10px'}}>
                          <ProductThumbZoom
                            src={p.imageUrl}
                            name={p.name}
                            sku={p.sku}
                            weightLabel={p.weight_label}
                            retailPrice={p.retail_price}
                            stockUnit={p.stock_unit}
                            rowIndex={idx}
                          />
                        </td>
                        <td style={{padding: '8px 10px', fontWeight: 700, color: '#142338'}}>
                          {p.sku}
                        </td>
                        <td style={{padding: '8px 10px', fontWeight: 600}}>{p.name}</td>
                        <td style={{padding: '8px 10px', color: '#475569'}}>{p.weight_label}</td>
                        <td
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 600,
                          }}
                        >
                          {vnd(p.retail_price)}
                        </td>
                        <td
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 800,
                            background: '#F8FAFC',
                            color: '#1E40AF',
                          }}
                        >
                          {p.hnOnHand.toLocaleString('vi-VN')}
                        </td>
                        <td
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            color: '#1E40AF',
                          }}
                        >
                          {p.hnAvail.toLocaleString('vi-VN')}
                        </td>
                        <td
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 800,
                            background: '#F8FAFC',
                            color: '#065F46',
                          }}
                        >
                          {p.hcmOnHand.toLocaleString('vi-VN')}
                        </td>
                        <td
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            color: '#065F46',
                          }}
                        >
                          {p.hcmAvail.toLocaleString('vi-VN')}
                        </td>
                        <td
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 800,
                            background: '#FFFBEB',
                            color: '#92400E',
                          }}
                        >
                          {p.totalOnHand.toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: INVOICE NOTIFICATIONS */}
        {tab === 'notifications' && (
          <div style={{padding: 12}}>
            <div style={{fontSize: 12.5, color: '#475569', marginBottom: 8}}>
              Tất cả thông báo hóa đơn gửi trực tiếp về tài khoản Kế toán (Hóa đơn khách đặt hàng, Hóa đơn Admin đặt Nhà máy, Hóa đơn Nhà máy xuất về Kho, Hóa đơn Quản lý kho đối chiếu, Nhân viên hoàn thiện số tiền).
            </div>
            <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12.5}}>
              <thead>
                <tr style={{background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left'}}>
                  <th style={{padding: '8px 10px', width: 150}}>Thời gian</th>
                  <th style={{padding: '8px 10px', width: 190}}>Phân loại hóa đơn</th>
                  <th style={{padding: '8px 10px'}}>Nội dung thông báo chi tiết</th>
                  <th style={{padding: '8px 10px', width: 120}}>Mở nhanh</th>
                </tr>
              </thead>
              <tbody>
                {data.notifications.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{padding: 20, textAlign: 'center', color: '#64748B'}}>
                      Chưa có thông báo nào.
                    </td>
                  </tr>
                ) : (
                  data.notifications.map(n => (
                    <tr key={n.id} style={{borderBottom: '1px solid #E2E8F0'}}>
                      <td style={{padding: '8px 10px', whiteSpace: 'nowrap', color: '#475569'}}>
                        {dt(n.created_at)}
                      </td>
                      <td style={{padding: '8px 10px', fontWeight: 700, color: '#142338'}}>
                        {n.entity_type === 'factory-invoice'
                          ? '🏭 HĐ Nhà máy'
                          : n.entity_type === 'warehouse-reconciliation'
                          ? '📦 HĐ Đối chiếu Kho'
                          : n.entity_type === 'order-clearance'
                          ? '💵 NV Hoàn thiện tiền'
                          : '🧾 HĐ Khách đặt hàng'}
                      </td>
                      <td style={{padding: '8px 10px', fontWeight: 500}}>{n.message}</td>
                      <td style={{padding: '8px 10px'}}>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              n.entity_type === 'factory-invoice' ||
                              n.entity_type === 'warehouse-reconciliation'
                            ) {
                              setTab('factory');
                            } else {
                              setTab('orders');
                            }
                          }}
                          style={{
                            padding: '4px 8px',
                            fontSize: 11.5,
                            fontWeight: 700,
                            border: '1px solid #CBD5E1',
                            background: '#FFFFFF',
                            cursor: 'pointer',
                          }}
                        >
                          Mở bảng →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: ORDER INVOICE INSPECTION / STAFF PAYMENT SUBMISSION / ACCOUNTANT CLEARANCE */}
      {selectedClearance && clearanceModalMode && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #142338',
              maxWidth: 920,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 18,
              boxShadow: '0 20px 45px rgba(0,0,0,0.25)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid #CBD5E1',
                paddingBottom: 10,
                marginBottom: 12,
              }}
            >
              <div>
                <div style={{fontSize: 11, fontWeight: 700, color: '#C84B11', textTransform: 'uppercase'}}>
                  HÓA ĐƠN ĐẶT HÀNG BAN ĐẦU CỦA KHÁCH & ĐỐI SOÁT KHO BÀN GIAO CHO NHÂN VIÊN
                </div>
                <h3 style={{margin: '2px 0 0 0', fontSize: 17, fontWeight: 800, color: '#142338'}}>
                  {selectedClearance.documentCode} — {selectedClearance.organizationName}
                </h3>
                <div style={{fontSize: 12, color: '#475569', marginTop: 2}}>
                  Nhân viên phụ trách: <strong>{selectedClearance.creatorName}</strong> · Kho xuất hàng:{' '}
                  <strong>{selectedClearance.warehouseName || 'Kho Tổng Hà Nội'}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedClearance(null);
                  setClearanceModalMode(null);
                }}
                style={{
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  padding: '4px 10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Đóng ✕
              </button>
            </div>

            {/* Summary Box of List Price, % Discount, Discount Amount, Net Total */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 8,
                marginBottom: 14,
                background: '#F8FAFC',
                padding: 10,
                border: '1px solid #CBD5E1',
              }}
            >
              <div>
                <div style={{fontSize: 11, color: '#64748B'}}>Tổng Giá gốc (100%)</div>
                <div style={{fontSize: 16, fontWeight: 800, color: '#0F172A'}}>
                  {vnd(selectedClearance.listSubtotal)}
                </div>
              </div>
              <div>
                <div style={{fontSize: 11, color: '#64748B'}}>Tỷ lệ chiết khấu (% Giảm)</div>
                <div style={{fontSize: 16, fontWeight: 800, color: '#B45309'}}>
                  Giảm {Number(selectedClearance.discountPercent).toFixed(2).replace(/\.00$/, '')}% (-
                  {vnd(selectedClearance.discountAmount)})
                </div>
              </div>
              <div>
                <div style={{fontSize: 11, color: '#64748B'}}>Phải thu sau giảm</div>
                <div style={{fontSize: 16, fontWeight: 800, color: '#142338'}}>
                  {vnd(selectedClearance.netTotal)}
                </div>
              </div>
              <div>
                <div style={{fontSize: 11, color: '#64748B'}}>Số tiền NV đã hoàn thiện cho KT</div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color:
                      Number(selectedClearance.staffSubmittedAmount) >=
                      Number(selectedClearance.netTotal)
                        ? '#047857'
                        : '#DC2626',
                  }}
                >
                  {vnd(selectedClearance.staffSubmittedAmount)}
                </div>
              </div>
            </div>

            {/* Line items table */}
            <div style={{marginBottom: 14}}>
              <div style={{fontWeight: 700, fontSize: 12.5, marginBottom: 6, color: '#142338'}}>
                Bảng chi tiết sản phẩm trong Hóa đơn đặt hàng ban đầu của khách:
              </div>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 12,
                  border: '1px solid #CBD5E1',
                }}
              >
                <thead>
                  <tr style={{background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left'}}>
                    <th style={{padding: 6}}>Mã SKU</th>
                    <th style={{padding: 6}}>Tên sản phẩm</th>
                    <th style={{padding: 6}}>Đơn vị</th>
                    <th style={{padding: 6, textAlign: 'right'}}>Số lượng</th>
                    <th style={{padding: 6, textAlign: 'right'}}>Đơn giá gốc</th>
                    <th style={{padding: 6, textAlign: 'right'}}>Thành tiền Giá gốc</th>
                    <th style={{padding: 6, textAlign: 'center'}}>% Giảm</th>
                    <th style={{padding: 6, textAlign: 'right'}}>Thành tiền sau giảm</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedClearance.lines.map((l, idx) => (
                    <tr key={idx} style={{borderBottom: '1px solid #E2E8F0'}}>
                      <td style={{padding: 6, fontWeight: 700}}>{l.sku}</td>
                      <td style={{padding: 6}}>{l.name}</td>
                      <td style={{padding: 6}}>{l.unitLabel}</td>
                      <td style={{padding: 6, textAlign: 'right', fontWeight: 700}}>
                        {Number(l.quantity).toLocaleString('vi-VN')}
                      </td>
                      <td style={{padding: 6, textAlign: 'right'}}>{vnd(l.listUnitPrice)}</td>
                      <td style={{padding: 6, textAlign: 'right', fontWeight: 600}}>
                        {vnd(l.listLineTotal)}
                      </td>
                      <td style={{padding: 6, textAlign: 'center', color: '#B45309', fontWeight: 700}}>
                        -{Number(selectedClearance.discountPercent).toFixed(2).replace(/\.00$/, '')}%
                      </td>
                      <td style={{padding: 6, textAlign: 'right', fontWeight: 800}}>
                        {vnd(l.netLineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Action section depending on mode */}
            {clearanceModalMode === 'STAFF_SUBMIT' && (
              <div
                style={{
                  background: '#EFF6FF',
                  border: '1px solid #3B82F6',
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{fontWeight: 800, color: '#1E40AF', fontSize: 13.5}}>
                  💵 BƯỚC DÀNH CHO NHÂN VIÊN: Hoàn thiện số tiền cho Kế toán trước khi lấy hàng ra khỏi kho
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 10,
                  }}
                >
                  <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                    <span style={{fontWeight: 700}}>Kho lấy hàng đi giao khách:</span>
                    <select
                      value={submitWarehouseId}
                      onChange={e => setSubmitWarehouseId(e.target.value)}
                      style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8'}}
                    >
                      {data.warehouses.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                    <span style={{fontWeight: 700}}>
                      Số tiền hoàn thiện nộp cho Kế toán (VND):
                    </span>
                    <input
                      type="number"
                      value={submitAmount}
                      onChange={e => setSubmitAmount(e.target.value)}
                      style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8', fontWeight: 700}}
                    />
                  </label>
                  <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                    <span style={{fontWeight: 700}}>Hình thức thanh toán:</span>
                    <select
                      value={submitMethod}
                      onChange={e =>
                        setSubmitMethod(
                          e.target.value as 'BANK_TRANSFER' | 'CASH' | 'COMBINED'
                        )
                      }
                      style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8'}}
                    >
                      <option value="BANK_TRANSFER">Chuyển khoản về TK Kế toán</option>
                      <option value="CASH">Nộp tiền mặt cho Kế toán</option>
                      <option value="COMBINED">Kết hợp CK & Tiền mặt</option>
                    </select>
                  </label>
                  <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                    <span style={{fontWeight: 700}}>Mã giao dịch / Ghi chú nộp tiền:</span>
                    <input
                      type="text"
                      value={submitRef}
                      onChange={e => setSubmitRef(e.target.value)}
                      style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8'}}
                    />
                  </label>
                </div>
                <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8}}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const ok = await submitAction('staff-submit-payment', {
                        clearanceId: selectedClearance.id,
                        submittedAmount: Number(submitAmount || 0),
                        paymentMethod: submitMethod,
                        reference: submitRef,
                        warehouseId: submitWarehouseId,
                      });
                      if (ok) {
                        setSelectedClearance(null);
                        setClearanceModalMode(null);
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#2563EB',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {busy ? 'Đang gửi...' : '💵 Xác nhận Hoàn thiện số tiền & Gửi thông báo cho Kế toán'}
                  </button>
                </div>
              </div>
            )}

            {clearanceModalMode === 'ACCOUNTANT_VERIFY' && (
              <div
                style={{
                  background: '#FFFBEB',
                  border: '1px solid #F59E0B',
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{fontWeight: 800, color: '#92400E', fontSize: 13.5}}>
                  ✅ BƯỚC DÀNH CHO KẾ TOÁN: Kiểm tra Giá gốc ({vnd(selectedClearance.listSubtotal)}) & Giảm{' '}
                  {Number(selectedClearance.discountPercent).toFixed(2).replace(/\.00$/, '')}% — Xác nhận nhân viên đã hoàn thiện đơn hàng hay chưa
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 10,
                  }}
                >
                  <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                    <span style={{fontWeight: 700}}>
                      Số tiền thực nhận từ Nhân viên (VND) (Phải thu: {vnd(selectedClearance.netTotal)}):
                    </span>
                    <input
                      type="number"
                      value={verifyOverrideAmount}
                      onChange={e => setVerifyOverrideAmount(e.target.value)}
                      style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8', fontWeight: 700}}
                    />
                  </label>
                  <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                    <span style={{fontWeight: 700}}>Ghi chú kiểm tra của Kế toán:</span>
                    <input
                      type="text"
                      value={verifyNote}
                      onChange={e => setVerifyNote(e.target.value)}
                      style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8'}}
                    />
                  </label>
                </div>
                <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8}}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const ok = await submitAction('accountant-verify-clearance', {
                        clearanceId: selectedClearance.id,
                        decision: 'REJECT',
                        submittedAmountOverride: Number(verifyOverrideAmount || 0),
                        note: verifyNote || 'Chưa hoàn thiện đủ số tiền sau chiết khấu.',
                      });
                      if (ok) {
                        setSelectedClearance(null);
                        setClearanceModalMode(null);
                      }
                    }}
                    style={{
                      padding: '8px 14px',
                      background: '#DC2626',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ⚠️ Chưa hoàn thiện — Yêu cầu NV bổ sung tiền
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const ok = await submitAction('accountant-verify-clearance', {
                        clearanceId: selectedClearance.id,
                        decision: 'APPROVE',
                        submittedAmountOverride: Number(verifyOverrideAmount || 0),
                        note: verifyNote,
                      });
                      if (ok) {
                        setSelectedClearance(null);
                        setClearanceModalMode(null);
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#059669',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✅ Xác nhận NV Đã hoàn thiện đơn — Cho phép lấy hàng khỏi kho
                  </button>
                </div>
              </div>
            )}

            {clearanceModalMode === 'PICKUP' && (
              <div
                style={{
                  background: '#ECFDF5',
                  border: '1px solid #10B981',
                  padding: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{fontWeight: 800, color: '#065F46'}}>
                    🚚 Kế toán ({selectedClearance.accountantName}) đã xác nhận hoàn thiện đủ tiền ({vnd(selectedClearance.staffSubmittedAmount)}).
                  </div>
                  <div style={{fontSize: 12, color: '#047857'}}>
                    Nhân viên được phép lấy hàng ra khỏi {selectedClearance.warehouseName || 'kho'} để đi giao cho khách hàng.
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    const ok = await submitAction('confirm-warehouse-pickup', {
                      clearanceId: selectedClearance.id,
                    });
                    if (ok) {
                      setSelectedClearance(null);
                      setClearanceModalMode(null);
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#059669',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  🚚 Xác nhận Đã lấy hàng khỏi kho & Đi giao khách
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: FACTORY ORDER / FACTORY DISPATCH / WAREHOUSE RECONCILIATION / DEBT VERIFY */}
      {factoryModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #142338',
              maxWidth: 960,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 18,
              boxShadow: '0 20px 45px rgba(0,0,0,0.25)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #CBD5E1',
                paddingBottom: 10,
                marginBottom: 12,
              }}
            >
              <h3 style={{margin: 0, fontSize: 16, fontWeight: 800, color: '#142338'}}>
                {factoryModal.mode === 'CREATE_ORDER' &&
                  '1. Admin Trung tâm: Tạo Hóa đơn Đặt hàng cho Nhà máy (Gửi thông báo về Kế toán)'}
                {factoryModal.mode === 'CREATE_DISPATCH' &&
                  '2. Nhà máy hoàn thành SP: Lập Hóa đơn Xuất Nhà máy đẩy về Kho (Báo Kế toán & Kho)'}
                {factoryModal.mode === 'CREATE_RECONCILIATION' &&
                  '3. Quản lý Kho: Lập Hóa đơn Đối chiếu thực nhận với Nhà máy (Cập nhật tồn kho & Báo Kế toán)'}
                {factoryModal.mode === 'VERIFY_DEBT' &&
                  `Kế toán Kiểm tra Đối chiếu & Thanh toán Công nợ Nhà máy (${factoryModal.sourceInvoice?.code})`}
              </h3>
              <button
                type="button"
                onClick={() => setFactoryModal(null)}
                style={{
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  padding: '4px 10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Đóng ✕
              </button>
            </div>

            {factoryModal.mode === 'VERIFY_DEBT' && factoryModal.sourceInvoice ? (
              <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                <div style={{fontSize: 13}}>
                  Chứng từ: <strong>{factoryModal.sourceInvoice.code}</strong> · Kho:{' '}
                  <strong>{factoryModal.sourceInvoice.warehouseName}</strong> · Tổng giá trị:{' '}
                  <strong>{vnd(factoryModal.sourceInvoice.totalAmount)}</strong> · Đã thanh toán:{' '}
                  <strong>{vnd(factoryModal.sourceInvoice.paidAmount)}</strong> · Còn nợ Nhà máy:{' '}
                  <strong style={{color: '#C84B11'}}>
                    {vnd(factoryModal.sourceInvoice.remainingDebt)}
                  </strong>
                </div>
                <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5}}>
                  <span style={{fontWeight: 700}}>
                    Số tiền thanh toán thêm cho Nhà máy đợt này (VND) (Nhập 0 nếu chỉ xác nhận đối chiếu):
                  </span>
                  <input
                    type="number"
                    value={debtPayAmount}
                    onChange={e => setDebtPayAmount(e.target.value)}
                    style={{height: 36, padding: '0 10px', border: '1px solid #94A3B8', fontWeight: 700}}
                  />
                </label>
                <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8}}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const ok = await submitAction('accountant-verify-factory-invoice', {
                        invoiceId: factoryModal.sourceInvoice!.id,
                        paidAmount: Number(debtPayAmount || 0),
                      });
                      if (ok) setFactoryModal(null);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#C84B11',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✅ Xác nhận Đối chiếu & Cập nhật Công nợ Kho với Nhà máy
                  </button>
                </div>
              </div>
            ) : (
              <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10}}>
                  <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                    <span style={{fontWeight: 700}}>Kho nhận hàng (Kho Hà Nội / Kho TP.HCM):</span>
                    <select
                      value={factoryWarehouseId}
                      disabled={Boolean(factoryModal.sourceInvoice)}
                      onChange={e => setFactoryWarehouseId(e.target.value)}
                      style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8', fontWeight: 700}}
                    >
                      {data.warehouses.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                    <span style={{fontWeight: 700}}>Ghi chú hóa đơn:</span>
                    <input
                      type="text"
                      value={factoryNote}
                      onChange={e => setFactoryNote(e.target.value)}
                      style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8'}}
                    />
                  </label>
                </div>

                <div style={{overflowX: 'auto', border: '1px solid #CBD5E1'}}>
                  <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12}}>
                    <thead>
                      <tr style={{background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left'}}>
                        <th style={{padding: 6}}>Sản phẩm</th>
                        <th style={{padding: 6, width: 110}}>SL Đặt (gói)</th>
                        {factoryModal.mode !== 'CREATE_ORDER' && (
                          <th style={{padding: 6, width: 120}}>SL Nhà máy Xuất</th>
                        )}
                        {factoryModal.mode === 'CREATE_RECONCILIATION' && (
                          <th style={{padding: 6, width: 120}}>SL Kho Thực nhận</th>
                        )}
                        <th style={{padding: 6, width: 130}}>Đơn giá NM (VND)</th>
                        <th style={{padding: 6, textAlign: 'right'}}>Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {factoryLines.map((line, idx) => {
                        const prod = data.products.find(p => p.id === line.productId);
                        const qty =
                          factoryModal.mode === 'CREATE_ORDER'
                            ? line.orderedQty
                            : factoryModal.mode === 'CREATE_DISPATCH'
                            ? line.dispatchedQty
                            : line.receivedQty;
                        return (
                          <tr key={idx} style={{borderBottom: '1px solid #E2E8F0'}}>
                            <td style={{padding: 6, fontWeight: 600}}>
                              {prod ? `${prod.sku} — ${prod.name}` : line.productId}
                            </td>
                            <td style={{padding: 6}}>
                              <input
                                type="number"
                                min={0}
                                value={line.orderedQty}
                                disabled={factoryModal.mode !== 'CREATE_ORDER'}
                                onChange={e => {
                                  const v = Number(e.target.value || 0);
                                  setFactoryLines(prev =>
                                    prev.map((item, i) =>
                                      i === idx
                                        ? {...item, orderedQty: v, dispatchedQty: v, receivedQty: v}
                                        : item
                                    )
                                  );
                                }}
                                style={{width: '100%', height: 28, padding: '0 6px'}}
                              />
                            </td>
                            {factoryModal.mode !== 'CREATE_ORDER' && (
                              <td style={{padding: 6}}>
                                <input
                                  type="number"
                                  min={0}
                                  value={line.dispatchedQty}
                                  disabled={factoryModal.mode === 'CREATE_RECONCILIATION'}
                                  onChange={e => {
                                    const v = Number(e.target.value || 0);
                                    setFactoryLines(prev =>
                                      prev.map((item, i) =>
                                        i === idx ? {...item, dispatchedQty: v, receivedQty: v} : item
                                      )
                                    );
                                  }}
                                  style={{width: '100%', height: 28, padding: '0 6px', fontWeight: 700}}
                                />
                              </td>
                            )}
                            {factoryModal.mode === 'CREATE_RECONCILIATION' && (
                              <td style={{padding: 6}}>
                                <input
                                  type="number"
                                  min={0}
                                  value={line.receivedQty}
                                  onChange={e => {
                                    const v = Number(e.target.value || 0);
                                    setFactoryLines(prev =>
                                      prev.map((item, i) =>
                                        i === idx ? {...item, receivedQty: v} : item
                                      )
                                    );
                                  }}
                                  style={{
                                    width: '100%',
                                    height: 28,
                                    padding: '0 6px',
                                    fontWeight: 800,
                                    border: '1px solid #059669',
                                    background: '#ECFDF5',
                                  }}
                                />
                              </td>
                            )}
                            <td style={{padding: 6}}>
                              <input
                                type="number"
                                min={0}
                                value={line.unitCost}
                                onChange={e => {
                                  const v = Number(e.target.value || 0);
                                  setFactoryLines(prev =>
                                    prev.map((item, i) =>
                                      i === idx ? {...item, unitCost: v} : item
                                    )
                                  );
                                }}
                                style={{width: '100%', height: 28, padding: '0 6px'}}
                              />
                            </td>
                            <td style={{padding: 6, textAlign: 'right', fontWeight: 700}}>
                              {vnd(qty * line.unitCost)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8}}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const actionName =
                        factoryModal.mode === 'CREATE_ORDER'
                          ? 'create-factory-order'
                          : factoryModal.mode === 'CREATE_DISPATCH'
                          ? 'create-factory-dispatch'
                          : 'create-warehouse-reconciliation';
                      const ok = await submitAction(actionName, {
                        warehouseId: factoryWarehouseId,
                        parentInvoiceId: factoryModal.sourceInvoice?.id,
                        dispatchInvoiceId: factoryModal.sourceInvoice?.id,
                        note: factoryNote,
                        lines: factoryLines,
                      });
                      if (ok) setFactoryModal(null);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#C84B11',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {busy ? 'Đang lưu & gửi thông báo...' : '💾 Phát hành Hóa đơn & Gửi thông báo cho Kế toán'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact embedded panel for `/crm/requests/[id]` and `/crm/sales/[id]`
 * so Staff (`SALES`) and Accountant (`ACCOUNTANT`) can perform handover & payment clearance directly on the order screen.
 */
export function OrderClearanceInlineCard({
  requestId,
  orderId,
  userRole,
}: {
  requestId?: string;
  orderId?: string;
  userRole?: string;
}) {
  const [clearance, setClearance] = useState<OrderClearanceRecord | null>(null);
  const [warehouses, setWarehouses] = useState<Array<{id: string; code: string; name: string}>>([]);
  const [amount, setAmount] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [method, setMethod] = useState<'BANK_TRANSFER' | 'CASH' | 'COMBINED'>('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (requestId) q.set('requestId', requestId);
    if (orderId) q.set('orderId', orderId);
    const res = await fetch(`/api/crm/accountant/order-clearance?${q.toString()}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const json = (await res.json()) as {
        clearance: OrderClearanceRecord | null;
        warehouses: Array<{id: string; code: string; name: string}>;
      };
      setClearance(json.clearance);
      setWarehouses(json.warehouses || []);
      if (json.clearance) {
        setAmount(
          Number(json.clearance.staffSubmittedAmount) > 0
            ? json.clearance.staffSubmittedAmount
            : json.clearance.netTotal
        );
        setWarehouseId(
          json.clearance.warehouseId || json.warehouses?.[0]?.id || ''
        );
      }
    }
  }, [requestId, orderId]);

  useEffect(() => {
    let active = true;
    const q = new URLSearchParams();
    if (requestId) q.set('requestId', requestId);
    if (orderId) q.set('orderId', orderId);
    fetch(`/api/crm/accountant/order-clearance?${q.toString()}`, {cache: 'no-store'})
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        if (!active || !json) return;
        setClearance(json.clearance);
        setWarehouses(json.warehouses || []);
        if (json.clearance) {
          setAmount(
            Number(json.clearance.staffSubmittedAmount) > 0
              ? json.clearance.staffSubmittedAmount
              : json.clearance.netTotal
          );
          setWarehouseId(
            json.clearance.warehouseId || json.warehouses?.[0]?.id || ''
          );
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [requestId, orderId]);

  if (!clearance) return null;

  const badge = clearanceBadge(clearance.status);
  const isAccountantOrAdmin = ['ACCOUNTANT', 'ADMIN', 'MANAGER'].includes(userRole ?? '');

  async function runAction(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/crm/accountant/${action}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json?.error?.message || 'Lỗi thao tác');
      } else {
        setMsg('Đã cập nhật & thông báo cho Kế toán thành công.');
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        background: '#FFFDF9',
        border: '2px solid #C84B11',
        padding: 12,
        marginBottom: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8}}>
        <div>
          <div style={{fontSize: 11, fontWeight: 800, color: '#C84B11', textTransform: 'uppercase'}}>
            ĐỐI SOÁT KẾ TOÁN & BÀN GIAO KHO CHO NHÂN VIÊN ĐI GIAO KHÁCH
          </div>
          <div style={{fontSize: 13, fontWeight: 700, color: '#142338', marginTop: 2}}>
            Giá gốc: <strong>{vnd(clearance.listSubtotal)}</strong> · Giảm chiết khấu:{' '}
            <strong style={{color: '#B45309'}}>
              -{Number(clearance.discountPercent).toFixed(2).replace(/\.00$/, '')}% (-
              {vnd(clearance.discountAmount)})
            </strong>{' '}
            · Phải thu sau giảm: <strong>{vnd(clearance.netTotal)}</strong> · NV đã hoàn thiện:{' '}
            <strong style={{color: '#047857'}}>{vnd(clearance.staffSubmittedAmount)}</strong>
          </div>
        </div>
        <span
          style={{
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 700,
            background: badge.bg,
            color: badge.color,
            border: `1px solid ${badge.border}`,
            alignSelf: 'flex-start',
          }}
        >
          {badge.label}
        </span>
      </div>

      {msg && (
        <div style={{fontSize: 12, fontWeight: 700, color: '#047857'}}>{msg}</div>
      )}

      {clearance.status !== 'PICKED_UP_DELIVERED' && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'flex-end',
            paddingTop: 6,
            borderTop: '1px dashed #CBD5E1',
          }}
        >
          <label style={{display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11.5}}>
            <span style={{fontWeight: 700}}>Kho lấy hàng:</span>
            <select
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              style={{height: 30, padding: '0 6px', border: '1px solid #CBD5E1'}}
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </label>
          <label style={{display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11.5}}>
            <span style={{fontWeight: 700}}>Số tiền NV hoàn thiện cho KT:</span>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{height: 30, width: 140, padding: '0 6px', border: '1px solid #CBD5E1', fontWeight: 700}}
            />
          </label>
          <label style={{display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11.5}}>
            <span style={{fontWeight: 700}}>Hình thức:</span>
            <select
              value={method}
              onChange={e =>
                setMethod(e.target.value as 'BANK_TRANSFER' | 'CASH' | 'COMBINED')
              }
              style={{height: 30, padding: '0 6px', border: '1px solid #CBD5E1'}}
            >
              <option value="BANK_TRANSFER">Chuyển khoản</option>
              <option value="CASH">Tiền mặt</option>
              <option value="COMBINED">Kết hợp</option>
            </select>
          </label>
          <label style={{display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11.5, flex: 1}}>
            <span style={{fontWeight: 700}}>Ghi chú / Mã GD:</span>
            <input
              type="text"
              value={reference}
              placeholder="Nội dung nộp tiền cho Kế toán..."
              onChange={e => setReference(e.target.value)}
              style={{height: 30, padding: '0 6px', border: '1px solid #CBD5E1'}}
            />
          </label>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void runAction('staff-submit-payment', {
                clearanceId: clearance.id,
                submittedAmount: Number(amount || 0),
                paymentMethod: method,
                reference: reference || `Hoàn thiện tiền đơn ${clearance.documentCode}`,
                warehouseId,
              })
            }
            style={{
              height: 30,
              padding: '0 12px',
              background: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            💵 NV Hoàn thiện tiền cho KT
          </button>

          {isAccountantOrAdmin && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void runAction('accountant-verify-clearance', {
                  clearanceId: clearance.id,
                  decision: 'APPROVE',
                  submittedAmountOverride: Number(amount || 0),
                  note: `KT đã kiểm tra giá gốc ${vnd(clearance.listSubtotal)}, giảm ${clearance.discountPercent}%`,
                })
              }
              style={{
                height: 30,
                padding: '0 12px',
                background: '#C84B11',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              ✅ KT Duyệt đã hoàn thiện đơn
            </button>
          )}

          {clearance.status === 'ACCOUNTANT_CLEARED' && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void runAction('confirm-warehouse-pickup', {
                  clearanceId: clearance.id,
                })
              }
              style={{
                height: 30,
                padding: '0 12px',
                background: '#059669',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              🚚 Lấy hàng khỏi kho & Giao khách
            </button>
          )}
        </div>
      )}
    </div>
  );
}
