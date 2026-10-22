'use client';

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ProductThumbZoom, resolveProductImage} from './CommercialForms';
import type {
  AccountantWorkspaceData,
  FactoryInvoiceRecord,
  OrderClearanceRecord,
  WarehouseHandoverInvoiceRecord,
  WarehouseStockSummaryRow,
} from '@/lib/crm/accountant-workflow';

export type WarehouseKeeperTab =
  | 'stock'
  | 'orders'
  | 'factory'
  | 'handover'
  | 'notifications';

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

function orderStatusBadge(status: OrderClearanceRecord['status']) {
  switch (status) {
    case 'NEW_ORDER':
      return {
        label: 'Mới đăng ký — Chờ nộp tiền',
        bg: '#FEF3C7',
        color: '#92400E',
        border: '#F59E0B',
      };
    case 'STAFF_SUBMITTED':
      return {
        label: 'Đã nộp tiền — Chờ Kế toán duyệt',
        bg: '#DBEAFE',
        color: '#1E40AF',
        border: '#3B82F6',
      };
    case 'ACCOUNTANT_CLEARED':
      return {
        label: 'KT đã duyệt — Sẵn sàng bàn giao',
        bg: '#D1FAE5',
        color: '#065F46',
        border: '#10B981',
      };
    case 'ACCOUNTANT_REJECTED':
      return {
        label: 'KT yêu cầu bổ sung tiền',
        bg: '#FEE2E2',
        color: '#991B1B',
        border: '#EF4444',
      };
    case 'PICKED_UP_DELIVERED':
      return {
        label: 'Đã bàn giao sản phẩm',
        bg: '#E0E7FF',
        color: '#3730A3',
        border: '#6366F1',
      };
  }
}

export function WarehouseKeeperWorkspace({
  initialData,
  initialTab = 'stock',
  userRole = 'WAREHOUSE_HCM',
  userName = 'Thủ kho',
}: {
  initialData?: AccountantWorkspaceData | null;
  initialTab?: WarehouseKeeperTab;
  userRole?: string;
  userName?: string;
}) {
  const [data, setData] = useState<AccountantWorkspaceData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [tab, setTab] = useState<WarehouseKeeperTab>(initialTab);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setTab(initialTab);
  }

  const [search, setSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [ordererTypeFilter, setOrdererTypeFilter] = useState<'ALL' | 'CUSTOMER' | 'STAFF'>('ALL');
  const [handoverRecipientFilter, setHandoverRecipientFilter] = useState<'ALL' | 'CUSTOMER' | 'STAFF'>('ALL');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{type: 'ok' | 'err'; text: string} | null>(null);

  // Stock adjustment modal
  const [adjustStockRow, setAdjustStockRow] = useState<WarehouseStockSummaryRow | null>(null);
  const [adjustNewOnHand, setAdjustNewOnHand] = useState('');

  // Order Registration modal ("Đăng ký hóa đơn khách hàng hoặc nhân viên đã đặt")
  const [showRegisterOrderModal, setShowRegisterOrderModal] = useState(false);
  const [regOrdererType, setRegOrdererType] = useState<'CUSTOMER' | 'STAFF'>('CUSTOMER');
  const [regOrgId, setRegOrgId] = useState('');
  const [regCustomOrgName, setRegCustomOrgName] = useState('');
  const [regOrdererName, setRegOrdererName] = useState('');
  const [regOrdererPhone, setRegOrdererPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regDiscountPercent, setRegDiscountPercent] = useState('0');
  const [regPaymentSubmitted, setRegPaymentSubmitted] = useState(false);
  const [regPaymentMethod, setRegPaymentMethod] = useState<'BANK_TRANSFER' | 'CASH'>('BANK_TRANSFER');
  const [regNote, setRegNote] = useState('');
  const [regLines, setRegLines] = useState<
    Array<{productId: string; quantity: number; unitPrice: number}>
  >([]);

  // Order Invoice View / Print modal
  const [previewOrderInvoice, setPreviewOrderInvoice] = useState<OrderClearanceRecord | null>(null);

  // Factory Reconciliation modal ("Tạo hóa đơn đối chiếu với nhà máy")
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [reconcileSourceInvoice, setReconcileSourceInvoice] = useState<FactoryInvoiceRecord | null>(null);
  const [reconcileNote, setReconcileNote] = useState('');
  const [reconcileLines, setReconcileLines] = useState<
    Array<{
      productId: string;
      sku: string;
      name: string;
      orderedQty: number;
      dispatchedQty: number;
      receivedQty: number;
      unitCost: number;
      note: string;
    }>
  >([]);
  const [previewFactoryInvoice, setPreviewFactoryInvoice] = useState<FactoryInvoiceRecord | null>(null);

  // Handover Invoice modal ("Tạo hóa đơn bàn giao sản phẩm cho nhân viên hoặc khách hàng")
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverClearanceId, setHandoverClearanceId] = useState('');
  const [handoverRecipientType, setHandoverRecipientType] = useState<'STAFF' | 'CUSTOMER'>('CUSTOMER');
  const [handoverRecipientName, setHandoverRecipientName] = useState('');
  const [handoverRecipientPhone, setHandoverRecipientPhone] = useState('');
  const [handoverOrgName, setHandoverOrgName] = useState('');
  const [handoverOrderCode, setHandoverOrderCode] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [handoverLines, setHandoverLines] = useState<
    Array<{productId: string; quantity: number; unitPrice: number; note: string}>
  >([]);
  const [previewHandoverInvoice, setPreviewHandoverInvoice] =
    useState<WarehouseHandoverInvoiceRecord | null>(null);

  const reloadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/crm/accountant/workspace', {cache: 'no-store'});
      if (res.ok) {
        const json = (await res.json()) as AccountantWorkspaceData;
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

  const managedWarehouse = useMemo(() => {
    if (!data?.warehouses?.length) return null;
    if (userRole === 'WAREHOUSE_HCM') {
      return (
        data.warehouses.find(w => w.region === 'SOUTH' || w.code.toUpperCase().includes('HCM')) ??
        data.warehouses[0]
      );
    }
    if (userRole === 'WAREHOUSE_HN') {
      return (
        data.warehouses.find(w => w.region === 'NORTH' || w.code.toUpperCase().includes('HN')) ??
        data.warehouses[0]
      );
    }
    return data.warehouses[0];
  }, [data, userRole]);

  const regionLabel =
    userRole === 'WAREHOUSE_HCM' || managedWarehouse?.region === 'SOUTH'
      ? 'Khu vực Miền Nam — Kho TP. Hồ Chí Minh (KHO-HCM)'
      : userRole === 'WAREHOUSE_HN' || managedWarehouse?.region === 'NORTH'
      ? 'Khu vực Miền Bắc — Kho Hà Nội (KHO-HN)'
      : managedWarehouse
      ? `${managedWarehouse.name} (${managedWarehouse.code})`
      : 'Kho khu vực';

  const myStocks = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.warehouseStocks.filter(s => {
      if (managedWarehouse && s.warehouseId !== managedWarehouse.id) return false;
      if (!q) return true;
      return (
        s.sku.toLowerCase().includes(q) ||
        s.productName.toLowerCase().includes(q)
      );
    });
  }, [data, managedWarehouse, search]);

  const stockTotals = useMemo(() => {
    let totalOnHand = 0;
    let totalReserved = 0;
    let totalAvailable = 0;
    let totalValue = 0n;
    for (const s of myStocks) {
      totalOnHand += Number(s.onHand || 0);
      totalReserved += Number(s.reserved || 0);
      totalAvailable += Number(s.available || 0);
      totalValue += BigInt(s.stockValue || '0');
    }
    return {
      skuCount: myStocks.length,
      totalOnHand,
      totalReserved,
      totalAvailable,
      totalValue: totalValue.toString(),
    };
  }, [myStocks]);

  const myOrders = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.orderClearances.filter(c => {
      if (orderStatusFilter !== 'ALL' && c.status !== orderStatusFilter) return false;
      if (ordererTypeFilter !== 'ALL' && (c.ordererType ?? 'CUSTOMER') !== ordererTypeFilter) return false;
      if (!q) return true;
      return (
        c.documentCode.toLowerCase().includes(q) ||
        c.organizationName.toLowerCase().includes(q) ||
        c.creatorName.toLowerCase().includes(q) ||
        (c.ordererName ?? '').toLowerCase().includes(q)
      );
    });
  }, [data, search, orderStatusFilter, ordererTypeFilter]);

  const pendingFactoryDispatches = useMemo(() => {
    if (!data) return [];
    return data.factoryInvoices.filter(
      f => f.stage === 'FACTORY_DISPATCH' && f.status === 'DISPATCHED'
    );
  }, [data]);

  const myFactoryInvoices = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.factoryInvoices.filter(f => {
      if (!q) return true;
      return (
        f.code.toLowerCase().includes(q) ||
        (f.parentCode ?? '').toLowerCase().includes(q) ||
        f.note.toLowerCase().includes(q)
      );
    });
  }, [data, search]);

  const myHandoverInvoices = useMemo(() => {
    if (!data?.handoverInvoices) return [];
    const q = search.trim().toLowerCase();
    return data.handoverInvoices.filter(h => {
      if (handoverRecipientFilter !== 'ALL' && h.recipientType !== handoverRecipientFilter) {
        return false;
      }
      if (!q) return true;
      return (
        h.code.toLowerCase().includes(q) ||
        h.recipientName.toLowerCase().includes(q) ||
        h.organizationName.toLowerCase().includes(q) ||
        h.orderCode.toLowerCase().includes(q)
      );
    });
  }, [data, search, handoverRecipientFilter]);

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
        return null;
      }
      await reloadWorkspace();
      return json;
    } catch {
      setBanner({type: 'err', text: 'Lỗi kết nối máy chủ.'});
      return null;
    } finally {
      setBusy(false);
    }
  }

  function openRegisterOrderModal() {
    if (!data) return;
    const defaultPartner = data.partners?.[0];
    setRegOrdererType('CUSTOMER');
    setRegOrgId(defaultPartner?.id ?? '');
    setRegCustomOrgName('');
    setRegOrdererName(defaultPartner?.name ?? '');
    setRegOrdererPhone(defaultPartner?.phone ?? '0909123456');
    setRegAddress(defaultPartner?.address ?? '');
    setRegDiscountPercent('0');
    setRegPaymentSubmitted(false);
    setRegPaymentMethod('BANK_TRANSFER');
    setRegNote('');
    setRegLines(
      data.products.slice(0, 3).map(p => ({
        productId: p.id,
        quantity: 20,
        unitPrice: Number(p.retail_price || 0),
      }))
    );
    setShowRegisterOrderModal(true);
  }

  function openReconcileModalForInvoice(dispatchInv?: FactoryInvoiceRecord) {
    if (!data) return;
    const source = dispatchInv ?? pendingFactoryDispatches[0] ?? null;
    setReconcileSourceInvoice(source);
    setReconcileNote(
      source
        ? `Thủ kho ${managedWarehouse?.name ?? ''} đối chiếu số lượng thực nhận theo HĐ xuất Nhà máy ${source.code}`
        : `Thủ kho ${managedWarehouse?.name ?? ''} lập hóa đơn đối chiếu hàng nhận từ Nhà máy`
    );
    if (source && source.lines.length > 0) {
      setReconcileLines(
        source.lines.map(l => ({
          productId: l.productId,
          sku: l.sku,
          name: l.name,
          orderedQty: Number(l.orderedQty || l.dispatchedQty || 0),
          dispatchedQty: Number(l.dispatchedQty || l.orderedQty || 0),
          receivedQty: Number(l.dispatchedQty || l.orderedQty || 0),
          unitCost: Number(l.factoryUnitPrice || 0),
          note: l.note || '',
        }))
      );
    } else {
      setReconcileLines(
        data.products.slice(0, 5).map(p => ({
          productId: p.id,
          sku: p.sku,
          name: p.name,
          orderedQty: 100,
          dispatchedQty: 100,
          receivedQty: 100,
          unitCost: Math.round(Number(p.retail_price || 0) * 0.65),
          note: '',
        }))
      );
    }
    setShowReconcileModal(true);
  }

  function openHandoverModalFromOrder(order?: OrderClearanceRecord) {
    if (!data) return;
    if (order) {
      setHandoverClearanceId(order.id);
      setHandoverRecipientType(order.ordererType === 'STAFF' ? 'STAFF' : 'CUSTOMER');
      setHandoverRecipientName(order.ordererName || order.organizationName || order.creatorName);
      setHandoverRecipientPhone(order.ordererPhone || '0909000111');
      setHandoverOrgName(order.organizationName);
      setHandoverOrderCode(order.documentCode);
      setHandoverNote(`Bàn giao sản phẩm xuất kho theo hóa đơn ${order.documentCode}`);
      const mapped = order.lines
        .map(l => {
          const prod = data.products.find(p => p.sku === l.sku);
          return {
            productId: prod?.id ?? data.products[0]?.id ?? '',
            quantity: Number(l.baseQuantity || l.quantity || 1),
            unitPrice: Number(l.netUnitPrice || l.listUnitPrice || 0),
            note: '',
          };
        })
        .filter(x => x.productId);
      setHandoverLines(
        mapped.length > 0
          ? mapped
          : data.products.slice(0, 2).map(p => ({
              productId: p.id,
              quantity: 10,
              unitPrice: Number(p.retail_price || 0),
              note: '',
            }))
      );
    } else {
      setHandoverClearanceId('');
      setHandoverRecipientType('CUSTOMER');
      setHandoverRecipientName('');
      setHandoverRecipientPhone('');
      setHandoverOrgName('');
      setHandoverOrderCode('');
      setHandoverNote(`Bàn giao sản phẩm xuất từ ${managedWarehouse?.name ?? 'kho'}`);
      setHandoverLines(
        data.products.slice(0, 2).map(p => ({
          productId: p.id,
          quantity: 10,
          unitPrice: Number(p.retail_price || 0),
          note: '',
        }))
      );
    }
    setShowHandoverModal(true);
  }

  const regTotals = useMemo(() => {
    const subtotal = regLines.reduce(
      (s, l) => s + Math.max(0, Number(l.quantity || 0)) * Math.max(0, Number(l.unitPrice || 0)),
      0
    );
    const pct = Math.max(0, Math.min(90, Number(regDiscountPercent || 0)));
    const disc = Math.round((subtotal * pct) / 100);
    const net = subtotal - disc;
    return {subtotal, pct, disc, net};
  }, [regLines, regDiscountPercent]);

  if (loading && !data) {
    return (
      <div className="crm-card" style={{padding: 32, textAlign: 'center'}}>
        Đang tải dữ liệu Kho khu vực...
      </div>
    );
  }

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 18}}>
      {/* HEADER BÀN ĐIỀU HÀNH THỦ KHO KHU VỰC */}
      <div
        className="crm-card"
        style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          color: '#FFFFFF',
          borderRadius: 14,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div>
          <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6}}>
            <span
              style={{
                background: userRole === 'WAREHOUSE_HCM' ? '#F59E0B' : '#3B82F6',
                color: '#0F172A',
                fontWeight: 800,
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 999,
                letterSpacing: 0.4,
              }}
            >
              {userRole === 'WAREHOUSE_HCM'
                ? 'THỦ KHO TP.HCM (MIỀN NAM)'
                : userRole === 'WAREHOUSE_HN'
                ? 'THỦ KHO HÀ NỘI (MIỀN BẮC)'
                : 'THỦ KHO KHU VỰC'}
            </span>
            <span style={{fontSize: 13, color: '#94A3B8'}}>
              Tài khoản: <strong style={{color: '#F8FAFC'}}>{userName}</strong>
            </span>
          </div>
          <h2 style={{margin: 0, fontSize: 22, fontWeight: 800, color: '#FFFFFF'}}>
            Bàn làm việc {regionLabel}
          </h2>
          <p style={{margin: '6px 0 0', fontSize: 13.5, color: '#CBD5E1'}}>
            Quản lý độc lập tồn kho {managedWarehouse?.name ?? 'khu vực'}, đăng ký & kiểm tra hóa đơn đặt hàng, nhận thông báo HĐ xuất Nhà máy, lập HĐ đối chiếu Nhà máy và lập HĐ bàn giao sản phẩm.
          </p>
        </div>

        <div style={{display: 'flex', flexWrap: 'wrap', gap: 10}}>
          <button
            type="button"
            className="crm-btn"
            style={{
              background: '#10B981',
              color: '#FFFFFF',
              fontWeight: 700,
              border: 'none',
              padding: '10px 16px',
              borderRadius: 8,
              cursor: 'pointer',
            }}
            onClick={openRegisterOrderModal}
          >
            + Đăng ký Hóa đơn KH / NV đặt
          </button>
          <button
            type="button"
            className="crm-btn"
            style={{
              background: '#3B82F6',
              color: '#FFFFFF',
              fontWeight: 700,
              border: 'none',
              padding: '10px 16px',
              borderRadius: 8,
              cursor: 'pointer',
            }}
            onClick={() => openReconcileModalForInvoice()}
          >
            + Tạo HĐ Đối chiếu Nhà máy
          </button>
          <button
            type="button"
            className="crm-btn"
            style={{
              background: '#F59E0B',
              color: '#0F172A',
              fontWeight: 800,
              border: 'none',
              padding: '10px 16px',
              borderRadius: 8,
              cursor: 'pointer',
            }}
            onClick={() => openHandoverModalFromOrder()}
          >
            + Tạo HĐ Bàn giao Sản phẩm
          </button>
        </div>
      </div>

      {/* CẢNH BÁO NỔI BẬT KHI CÓ HÓA ĐƠN XUẤT TỪ NHÀ MÁY VỀ KHO */}
      {pendingFactoryDispatches.length > 0 && (
        <div
          style={{
            background: '#EFF6FF',
            border: '2px solid #2563EB',
            borderRadius: 12,
            padding: '14px 18px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <span
              style={{
                background: '#2563EB',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: 12,
                padding: '6px 12px',
                borderRadius: 8,
              }}
            >
              THÔNG BÁO HÓA ĐƠN NHÀ MÁY ({pendingFactoryDispatches.length})
            </span>
            <div>
              <div style={{fontWeight: 700, color: '#1E3A8A', fontSize: 14.5}}>
                Nhà máy vừa tạo {pendingFactoryDispatches.length} Hóa đơn xuất Nhà máy đẩy về {managedWarehouse?.name ?? 'kho của bạn'}!
              </div>
              <div style={{fontSize: 13, color: '#1D4ED8'}}>
                Mã hóa đơn:{' '}
                {pendingFactoryDispatches.map(d => `${d.code} (${Number(d.totalDispatchedQty).toLocaleString('vi-VN')} gói)`).join(' · ')}
              </div>
            </div>
          </div>
          <div style={{display: 'flex', gap: 8}}>
            <button
              type="button"
              className="crm-btn crm-btn-primary"
              onClick={() => {
                setTab('factory');
                openReconcileModalForInvoice(pendingFactoryDispatches[0]);
              }}
            >
              Đối chiếu & Nhập kho ngay
            </button>
          </div>
        </div>
      )}

      {banner && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            fontWeight: 600,
            background: banner.type === 'ok' ? '#D1FAE5' : '#FEE2E2',
            color: banner.type === 'ok' ? '#065F46' : '#991B1B',
            border: `1px solid ${banner.type === 'ok' ? '#10B981' : '#EF4444'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            style={{background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 800}}
          >
            ✕
          </button>
        </div>
      )}

      {/* 5 TABS CHỨC NĂNG CHÍNH CỦA THỦ KHO */}
      <div
        className="crm-card"
        style={{
          padding: 8,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          background: '#F8FAFC',
          borderRadius: 12,
        }}
      >
        {[
          {
            id: 'stock' as const,
            label: `1. Kiểm tra Số lượng Hàng trong Kho (${stockTotals.totalAvailable.toLocaleString('vi-VN')} gói)`,
          },
          {
            id: 'orders' as const,
            label: `2. Đăng ký & Kiểm tra HĐ Khách / NV đặt (${myOrders.length})`,
          },
          {
            id: 'factory' as const,
            label: `3. HĐ Đối chiếu với Nhà máy (${myFactoryInvoices.length})`,
          },
          {
            id: 'handover' as const,
            label: `4. HĐ Bàn giao SP cho NV / Khách (${myHandoverInvoices.length})`,
          },
          {
            id: 'notifications' as const,
            label: `5. Thông báo Hóa đơn về Kho (${
              pendingFactoryDispatches.length + (data?.notifications?.length ?? 0)
            })`,
          },
        ].map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 16px',
                borderRadius: 9,
                border: active ? '1px solid #0F172A' : '1px solid #E2E8F0',
                background: active ? '#0F172A' : '#FFFFFF',
                color: active ? '#FFFFFF' : '#334155',
                fontWeight: active ? 700 : 600,
                fontSize: 13.5,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* THANH TÌM KIẾM CHUNG */}
      <div
        className="crm-card"
        style={{
          padding: '12px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <input
          type="text"
          className="crm-input"
          placeholder="Tìm theo mã SKU, tên sản phẩm, mã hóa đơn, tên khách hàng hoặc nhân viên..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{maxWidth: 460, flex: 1}}
        />
        <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
          <span style={{fontSize: 13, color: '#64748B', fontWeight: 600}}>
            Kho quản lý:{' '}
            <strong style={{color: '#0F172A'}}>
              {managedWarehouse ? `${managedWarehouse.name} (${managedWarehouse.code})` : '—'}
            </strong>
          </span>
          <button type="button" className="crm-btn crm-btn-ghost" onClick={reloadWorkspace}>
            Làm mới dữ liệu
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: KIỂM TRA SỐ LƯỢNG HÀNG TRONG KHO MÌNH QUẢN LÝ ==================== */}
      {tab === 'stock' && (
        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 14,
            }}
          >
            <div className="crm-card" style={{padding: 16, borderLeft: '4px solid #0F172A'}}>
              <div style={{fontSize: 12.5, color: '#64748B', fontWeight: 600}}>
                KHO ĐANG QUẢN LÝ
              </div>
              <div style={{fontSize: 18, fontWeight: 800, color: '#0F172A', marginTop: 4}}>
                {managedWarehouse?.name ?? 'Kho Khu vực'}
              </div>
              <div style={{fontSize: 12, color: '#475569', marginTop: 2}}>
                Mã kho: {managedWarehouse?.code ?? '—'} · {stockTotals.skuCount} mặt hàng
              </div>
            </div>

            <div className="crm-card" style={{padding: 16, borderLeft: '4px solid #2563EB'}}>
              <div style={{fontSize: 12.5, color: '#64748B', fontWeight: 600}}>
                TỒN KHO THỰC TẾ (TRONG KHO)
              </div>
              <div style={{fontSize: 22, fontWeight: 800, color: '#1E40AF', marginTop: 4}}>
                {stockTotals.totalOnHand.toLocaleString('vi-VN')} gói
              </div>
              <div style={{fontSize: 12, color: '#475569', marginTop: 2}}>
                Tổng số lượng thực tế tại kệ kho
              </div>
            </div>

            <div className="crm-card" style={{padding: 16, borderLeft: '4px solid #F59E0B'}}>
              <div style={{fontSize: 12.5, color: '#64748B', fontWeight: 600}}>
                ĐANG GIỮ CHO ĐƠN ĐẶT
              </div>
              <div style={{fontSize: 22, fontWeight: 800, color: '#B45309', marginTop: 4}}>
                {stockTotals.totalReserved.toLocaleString('vi-VN')} gói
              </div>
              <div style={{fontSize: 12, color: '#475569', marginTop: 2}}>
                Hàng đang giữ chờ xuất giao
              </div>
            </div>

            <div className="crm-card" style={{padding: 16, borderLeft: '4px solid #10B981'}}>
              <div style={{fontSize: 12.5, color: '#64748B', fontWeight: 600}}>
                KHẢ DỤNG CÓ THỂ XUẤT NGAY
              </div>
              <div style={{fontSize: 22, fontWeight: 800, color: '#065F46', marginTop: 4}}>
                {stockTotals.totalAvailable.toLocaleString('vi-VN')} gói
              </div>
              <div style={{fontSize: 12, color: '#475569', marginTop: 2}}>
                Giá trị tồn: {vnd(stockTotals.totalValue)}
              </div>
            </div>
          </div>

          <div className="crm-card" style={{padding: 20}}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div>
                <h3 style={{margin: 0, fontSize: 17, fontWeight: 800}}>
                  Bảng kiểm tra số lượng hàng tồn tại {managedWarehouse?.name ?? 'Kho của bạn'}
                </h3>
                <p style={{margin: '4px 0 0', fontSize: 13, color: '#64748B'}}>
                  Chỉ hiển thị duy nhất số lượng hàng thuộc kho khu vực bạn quản lý ({managedWarehouse?.code}).
                </p>
              </div>
            </div>

            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Ảnh</th>
                    <th>Mã SKU</th>
                    <th>Tên sản phẩm</th>
                    <th>Quy cách</th>
                    <th style={{textAlign: 'right'}}>Giá niêm yết</th>
                    <th style={{textAlign: 'right'}}>Tồn thực tế</th>
                    <th style={{textAlign: 'right'}}>Đang giữ</th>
                    <th style={{textAlign: 'right'}}>Khả dụng xuất</th>
                    <th style={{textAlign: 'right'}}>Giá trị tồn</th>
                    <th>Trạng thái</th>
                    <th style={{textAlign: 'right'}}>Thao tác kho</th>
                  </tr>
                </thead>
                <tbody>
                  {myStocks.map(row => {
                    const avail = Number(row.available || 0);
                    const onHand = Number(row.onHand || 0);
                    const reserved = Number(row.reserved || 0);
                    const img = resolveProductImage(row.sku);
                    return (
                      <tr key={`${row.warehouseId}-${row.productId}`}>
                        <td>
                          <ProductThumbZoom
                            src={img}
                            name={row.productName}
                            sku={row.sku}
                            weightLabel={row.weightLabel}
                            retailPrice={row.retailPrice}
                            stockUnit={row.stockUnit}
                          />
                        </td>
                        <td style={{fontWeight: 700, fontFamily: 'monospace'}}>{row.sku}</td>
                        <td style={{fontWeight: 600}}>{row.productName}</td>
                        <td>{row.weightLabel || row.stockUnit || 'Gói'}</td>
                        <td style={{textAlign: 'right'}}>{vnd(row.retailPrice)}</td>
                        <td style={{textAlign: 'right', fontWeight: 700, fontSize: 14}}>
                          {onHand.toLocaleString('vi-VN')} {row.stockUnit}
                        </td>
                        <td style={{textAlign: 'right', color: '#B45309', fontWeight: 600}}>
                          {reserved.toLocaleString('vi-VN')}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 800,
                            fontSize: 14.5,
                            color: avail > 20 ? '#065F46' : avail > 0 ? '#D97706' : '#DC2626',
                          }}
                        >
                          {avail.toLocaleString('vi-VN')} {row.stockUnit}
                        </td>
                        <td style={{textAlign: 'right', fontWeight: 600}}>{vnd(row.stockValue)}</td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              background:
                                avail > 20 ? '#D1FAE5' : avail > 0 ? '#FEF3C7' : '#FEE2E2',
                              color:
                                avail > 20 ? '#065F46' : avail > 0 ? '#92400E' : '#991B1B',
                            }}
                          >
                            {avail > 20 ? 'Đủ hàng' : avail > 0 ? 'Sắp hết' : 'Hết hàng'}
                          </span>
                        </td>
                        <td style={{textAlign: 'right'}}>
                          <button
                            type="button"
                            className="crm-btn crm-btn-ghost"
                            style={{fontSize: 12.5, padding: '5px 10px'}}
                            onClick={() => {
                              setAdjustStockRow(row);
                              setAdjustNewOnHand(String(onHand));
                            }}
                          >
                            Cập nhật SL tồn
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {myStocks.length === 0 && (
                    <tr>
                      <td colSpan={11} style={{textAlign: 'center', padding: 28, color: '#64748B'}}>
                        Không tìm thấy mặt hàng phù hợp trong kho của bạn.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: ĐĂNG KÝ & KIỂM TRA HÓA ĐƠN CỦA KHÁCH HÀNG HOẶC NHÂN VIÊN ĐÃ ĐẶT ==================== */}
      {tab === 'orders' && (
        <div className="crm-card" style={{padding: 20}}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <h3 style={{margin: 0, fontSize: 17, fontWeight: 800}}>
                Đăng ký & Kiểm tra Hóa đơn Khách hàng / Nhân viên đã đặt ({managedWarehouse?.name})
              </h3>
              <p style={{margin: '4px 0 0', fontSize: 13, color: '#64748B'}}>
                Thủ kho đăng ký đơn đặt hàng mới hoặc kiểm tra chi tiết hóa đơn khách hàng / nhân viên đã đặt tại kho mình quản lý.
              </p>
            </div>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
              <select
                className="crm-input"
                style={{width: 'auto'}}
                value={ordererTypeFilter}
                onChange={e => setOrdererTypeFilter(e.target.value as 'ALL' | 'CUSTOMER' | 'STAFF')}
              >
                <option value="ALL">Tất cả đối tượng đặt (KH & NV)</option>
                <option value="CUSTOMER">Khách hàng / Đại lý đặt</option>
                <option value="STAFF">Nhân viên đặt</option>
              </select>
              <select
                className="crm-input"
                style={{width: 'auto'}}
                value={orderStatusFilter}
                onChange={e => setOrderStatusFilter(e.target.value)}
              >
                <option value="ALL">Tất cả trạng thái hóa đơn</option>
                <option value="NEW_ORDER">Mới đăng ký — Chờ nộp tiền</option>
                <option value="STAFF_SUBMITTED">Đã nộp tiền — Chờ KT duyệt</option>
                <option value="ACCOUNTANT_CLEARED">KT đã duyệt — Sẵn sàng bàn giao</option>
                <option value="PICKED_UP_DELIVERED">Đã bàn giao sản phẩm</option>
              </select>
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                onClick={openRegisterOrderModal}
              >
                + Đăng ký Hóa đơn KH / NV đặt
              </button>
            </div>
          </div>

          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Mã hóa đơn</th>
                  <th>Đối tượng đặt</th>
                  <th>Khách hàng / Người đặt</th>
                  <th>Mặt hàng & Số lượng</th>
                  <th style={{textAlign: 'right'}}>Giá gốc</th>
                  <th style={{textAlign: 'right'}}>Chiết khấu</th>
                  <th style={{textAlign: 'right'}}>Phải thu</th>
                  <th>Trạng thái Hóa đơn</th>
                  <th>Ngày đặt</th>
                  <th style={{textAlign: 'right'}}>Thao tác Thủ kho</th>
                </tr>
              </thead>
              <tbody>
                {myOrders.map(order => {
                  const badge = orderStatusBadge(order.status);
                  const totalQty = order.lines.reduce(
                    (s, l) => s + Number(l.baseQuantity || l.quantity || 0),
                    0
                  );
                  const isStaff = order.ordererType === 'STAFF';
                  return (
                    <tr key={order.id}>
                      <td style={{fontWeight: 800, fontFamily: 'monospace', color: '#0F172A'}}>
                        {order.documentCode}
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            borderRadius: 999,
                            fontSize: 11.5,
                            fontWeight: 700,
                            background: isStaff ? '#EDE9FE' : '#E0F2FE',
                            color: isStaff ? '#5B21B6' : '#0369A1',
                          }}
                        >
                          {isStaff ? 'Nhân viên đặt' : 'Khách hàng đặt'}
                        </span>
                      </td>
                      <td>
                        <div style={{fontWeight: 700}}>{order.organizationName}</div>
                        <div style={{fontSize: 12, color: '#64748B'}}>
                          Người đặt: {order.ordererName || order.creatorName}
                          {order.ordererPhone ? ` · ${order.ordererPhone}` : ''}
                        </div>
                      </td>
                      <td>
                        <div style={{fontWeight: 600}}>
                          {order.lines.length} mã SP · Tổng {totalQty.toLocaleString('vi-VN')} gói
                        </div>
                        <div style={{fontSize: 12, color: '#64748B'}}>
                          {order.lines
                            .slice(0, 2)
                            .map(l => `${l.sku} (${l.baseQuantity || l.quantity})`)
                            .join(', ')}
                          {order.lines.length > 2 ? '...' : ''}
                        </div>
                      </td>
                      <td style={{textAlign: 'right'}}>{vnd(order.listSubtotal)}</td>
                      <td style={{textAlign: 'right', color: '#DC2626', fontWeight: 600}}>
                        -{order.discountPercent}% ({vnd(order.discountAmount)})
                      </td>
                      <td style={{textAlign: 'right', fontWeight: 800, color: '#0F172A'}}>
                        {vnd(order.netTotal)}
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td style={{fontSize: 12.5, color: '#475569'}}>{dt(order.createdAt)}</td>
                      <td style={{textAlign: 'right'}}>
                        <div style={{display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap'}}>
                          <button
                            type="button"
                            className="crm-btn crm-btn-ghost"
                            style={{fontSize: 12, padding: '5px 9px'}}
                            onClick={() => setPreviewOrderInvoice(order)}
                          >
                            Kiểm tra / In HĐ
                          </button>
                          {order.status !== 'PICKED_UP_DELIVERED' && (
                            <button
                              type="button"
                              className="crm-btn crm-btn-primary"
                              style={{fontSize: 12, padding: '5px 10px'}}
                              onClick={() => openHandoverModalFromOrder(order)}
                            >
                              Bàn giao SP
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {myOrders.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{textAlign: 'center', padding: 28, color: '#64748B'}}>
                      Chưa có hóa đơn khách hàng hoặc nhân viên đặt tại kho này. Bấm &ldquo;+ Đăng ký Hóa đơn KH / NV đặt&rdquo; để tạo mới.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: TẠO HÓA ĐƠN ĐỐI CHIẾU VỚI NHÀ MÁY ==================== */}
      {tab === 'factory' && (
        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          <div className="crm-card" style={{padding: 20}}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <h3 style={{margin: 0, fontSize: 17, fontWeight: 800}}>
                  Hóa đơn xuất Nhà máy về Kho & Hóa đơn Đối chiếu với Nhà máy ({managedWarehouse?.name})
                </h3>
                <p style={{margin: '4px 0 0', fontSize: 13, color: '#64748B'}}>
                  Kiểm tra các hóa đơn xuất từ Nhà máy đẩy về kho của bạn và lập Hóa đơn đối chiếu thực nhận (tự động cộng tồn kho).
                </p>
              </div>
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                onClick={() => openReconcileModalForInvoice()}
              >
                + Tạo Hóa đơn Đối chiếu với Nhà máy
              </button>
            </div>

            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Mã hóa đơn</th>
                    <th>Loại hóa đơn</th>
                    <th>HĐ gốc liên kết</th>
                    <th style={{textAlign: 'right'}}>SL Nhà máy xuất</th>
                    <th style={{textAlign: 'right'}}>SL Kho thực nhận</th>
                    <th style={{textAlign: 'right'}}>Giá trị HĐ</th>
                    <th>Trạng thái đối chiếu</th>
                    <th>Người lập / Ngày lập</th>
                    <th style={{textAlign: 'right'}}>Thao tác Thủ kho</th>
                  </tr>
                </thead>
                <tbody>
                  {myFactoryInvoices.map(inv => {
                    const isDispatch = inv.stage === 'FACTORY_DISPATCH';
                    const isReconcile = inv.stage === 'WAREHOUSE_RECONCILIATION';
                    return (
                      <tr key={inv.id}>
                        <td style={{fontWeight: 800, fontFamily: 'monospace'}}>{inv.code}</td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              background: isReconcile
                                ? '#D1FAE5'
                                : isDispatch
                                ? '#DBEAFE'
                                : '#FEF3C7',
                              color: isReconcile
                                ? '#065F46'
                                : isDispatch
                                ? '#1E40AF'
                                : '#92400E',
                            }}
                          >
                            {isReconcile
                              ? 'HĐ Đối chiếu của Thủ kho'
                              : isDispatch
                              ? 'HĐ Xuất Nhà máy về Kho'
                              : 'HĐ Đặt hàng Nhà máy'}
                          </span>
                        </td>
                        <td style={{fontFamily: 'monospace', color: '#475569'}}>
                          {inv.parentCode || '—'}
                        </td>
                        <td style={{textAlign: 'right', fontWeight: 700}}>
                          {Number(inv.totalDispatchedQty || inv.totalOrderedQty || 0).toLocaleString('vi-VN')} gói
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 800,
                            color: isReconcile ? '#065F46' : '#64748B',
                          }}
                        >
                          {isReconcile
                            ? `${Number(inv.totalReceivedQty || 0).toLocaleString('vi-VN')} gói`
                            : 'Chờ đối chiếu'}
                        </td>
                        <td style={{textAlign: 'right', fontWeight: 700}}>{vnd(inv.totalAmount)}</td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              background:
                                inv.status === 'RECONCILED' || inv.status === 'PAID'
                                  ? '#D1FAE5'
                                  : inv.status === 'DISCREPANCY'
                                  ? '#FEE2E2'
                                  : '#FEF3C7',
                              color:
                                inv.status === 'RECONCILED' || inv.status === 'PAID'
                                  ? '#065F46'
                                  : inv.status === 'DISCREPANCY'
                                  ? '#991B1B'
                                  : '#92400E',
                            }}
                          >
                            {inv.status === 'DISPATCHED'
                              ? 'Mới về Kho — Chờ Thủ kho đối chiếu'
                              : inv.status === 'RECONCILED'
                              ? 'Đã đối chiếu khớp 100%'
                              : inv.status === 'DISCREPANCY'
                              ? 'Đã đối chiếu — Có chênh lệch'
                              : inv.status}
                          </span>
                        </td>
                        <td style={{fontSize: 12.5}}>
                          <div style={{fontWeight: 600}}>{inv.reconciledByName || inv.createdByName}</div>
                          <div style={{color: '#64748B'}}>{dt(inv.reconciledAt || inv.createdAt)}</div>
                        </td>
                        <td style={{textAlign: 'right'}}>
                          <div style={{display: 'flex', gap: 6, justifyContent: 'flex-end'}}>
                            <button
                              type="button"
                              className="crm-btn crm-btn-ghost"
                              style={{fontSize: 12, padding: '5px 9px'}}
                              onClick={() => setPreviewFactoryInvoice(inv)}
                            >
                              Xem / In HĐ
                            </button>
                            {isDispatch && inv.status === 'DISPATCHED' && (
                              <button
                                type="button"
                                className="crm-btn crm-btn-primary"
                                style={{fontSize: 12, padding: '5px 10px'}}
                                onClick={() => openReconcileModalForInvoice(inv)}
                              >
                                Lập HĐ Đối chiếu
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {myFactoryInvoices.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{textAlign: 'center', padding: 28, color: '#64748B'}}>
                        Chưa có hóa đơn xuất nhà máy hoặc hóa đơn đối chiếu nào tại kho này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 4: TẠO HÓA ĐƠN BÀN GIAO SẢN PHẨM CHO NHÂN VIÊN HOẶC KHÁCH HÀNG ==================== */}
      {tab === 'handover' && (
        <div className="crm-card" style={{padding: 20}}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <h3 style={{margin: 0, fontSize: 17, fontWeight: 800}}>
                Hóa đơn Bàn giao Sản phẩm cho Nhân viên hoặc Khách hàng ({managedWarehouse?.name})
              </h3>
              <p style={{margin: '4px 0 0', fontSize: 13, color: '#64748B'}}>
                Lập hóa đơn bàn giao sản phẩm xuất kho cho Nhân viên đi giao hoặc Khách hàng nhận trực tiếp, tự động trừ tồn kho và in biên bản bàn giao.
              </p>
            </div>
            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
              <select
                className="crm-input"
                style={{width: 'auto'}}
                value={handoverRecipientFilter}
                onChange={e =>
                  setHandoverRecipientFilter(e.target.value as 'ALL' | 'CUSTOMER' | 'STAFF')
                }
              >
                <option value="ALL">Tất cả người nhận (NV & Khách hàng)</option>
                <option value="CUSTOMER">Bàn giao cho Khách hàng</option>
                <option value="STAFF">Bàn giao cho Nhân viên</option>
              </select>
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                onClick={() => openHandoverModalFromOrder()}
              >
                + Tạo Hóa đơn Bàn giao Sản phẩm
              </button>
            </div>
          </div>

          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Mã HĐ bàn giao</th>
                  <th>Đối tượng nhận</th>
                  <th>Người nhận & SĐT</th>
                  <th>Đơn vị / Khách hàng</th>
                  <th>HĐ đặt hàng liên kết</th>
                  <th style={{textAlign: 'right'}}>Tổng SL bàn giao</th>
                  <th style={{textAlign: 'right'}}>Tổng giá trị</th>
                  <th>Thủ kho xuất / Ngày</th>
                  <th style={{textAlign: 'right'}}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {myHandoverInvoices.map(h => {
                  const isStaff = h.recipientType === 'STAFF';
                  return (
                    <tr key={h.id}>
                      <td style={{fontWeight: 800, fontFamily: 'monospace'}}>{h.code}</td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            background: isStaff ? '#EDE9FE' : '#D1FAE5',
                            color: isStaff ? '#5B21B6' : '#065F46',
                          }}
                        >
                          {isStaff ? 'Bàn giao Nhân viên' : 'Bàn giao Khách hàng'}
                        </span>
                      </td>
                      <td>
                        <div style={{fontWeight: 700}}>{h.recipientName}</div>
                        <div style={{fontSize: 12, color: '#64748B'}}>{h.recipientPhone || '—'}</div>
                      </td>
                      <td style={{fontWeight: 600}}>{h.organizationName || '—'}</td>
                      <td style={{fontFamily: 'monospace', color: '#2563EB', fontWeight: 700}}>
                        {h.orderCode || 'Bàn giao trực tiếp'}
                      </td>
                      <td style={{textAlign: 'right', fontWeight: 800}}>
                        {Number(h.totalQuantity || 0).toLocaleString('vi-VN')} gói
                      </td>
                      <td style={{textAlign: 'right', fontWeight: 700}}>{vnd(h.totalAmount)}</td>
                      <td style={{fontSize: 12.5}}>
                        <div style={{fontWeight: 600}}>{h.createdByName}</div>
                        <div style={{color: '#64748B'}}>{dt(h.createdAt)}</div>
                      </td>
                      <td style={{textAlign: 'right'}}>
                        <button
                          type="button"
                          className="crm-btn crm-btn-ghost"
                          style={{fontSize: 12, padding: '5px 10px'}}
                          onClick={() => setPreviewHandoverInvoice(h)}
                        >
                          Xem / In HĐ Bàn giao
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {myHandoverInvoices.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{textAlign: 'center', padding: 28, color: '#64748B'}}>
                      Chưa có hóa đơn bàn giao sản phẩm nào. Bấm &ldquo;+ Tạo Hóa đơn Bàn giao Sản phẩm&rdquo; để lập phiếu bàn giao cho nhân viên hoặc khách hàng.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TAB 5: THÔNG BÁO HÓA ĐƠN KHI NHÀ MÁY XUẤT VỀ KHO ==================== */}
      {tab === 'notifications' && (
        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          <div className="crm-card" style={{padding: 20}}>
            <h3 style={{margin: '0 0 6px', fontSize: 17, fontWeight: 800}}>
              Thông báo Hóa đơn Nhà máy xuất về {managedWarehouse?.name ?? 'Kho của bạn'}
            </h3>
            <p style={{margin: '0 0 16px', fontSize: 13, color: '#64748B'}}>
              Khi Nhà máy tạo hóa đơn xuất nhà máy đẩy về kho của bạn, thông báo sẽ hiển thị tại đây để bạn kiểm tra và lập Hóa đơn đối chiếu.
            </p>

            <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
              {myFactoryInvoices
                .filter(f => f.stage === 'FACTORY_DISPATCH')
                .map(disp => (
                  <div
                    key={disp.id}
                    style={{
                      padding: 16,
                      borderRadius: 10,
                      border:
                        disp.status === 'DISPATCHED'
                          ? '2px solid #2563EB'
                          : '1px solid #CBD5E1',
                      background: disp.status === 'DISPATCHED' ? '#EFF6FF' : '#F8FAFC',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4}}>
                        <span
                          style={{
                            background: disp.status === 'DISPATCHED' ? '#2563EB' : '#10B981',
                            color: '#FFFFFF',
                            fontSize: 11.5,
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 6,
                          }}
                        >
                          {disp.status === 'DISPATCHED'
                            ? 'HĐ NHÀ MÁY MỚI XUẤT VỀ KHO'
                            : 'ĐÃ ĐỐI CHIẾU NHẬP KHO'}
                        </span>
                        <strong style={{fontFamily: 'monospace', fontSize: 14}}>{disp.code}</strong>
                        <span style={{fontSize: 12.5, color: '#64748B'}}>{dt(disp.createdAt)}</span>
                      </div>
                      <div style={{fontSize: 13.5, color: '#1E293B', fontWeight: 600}}>
                        Nhà máy xuất về <strong>{disp.warehouseName}</strong>:{' '}
                        <strong>{Number(disp.totalDispatchedQty).toLocaleString('vi-VN')} gói</strong> · Giá trị:{' '}
                        <strong>{vnd(disp.totalAmount)}</strong>
                      </div>
                      {disp.note && (
                        <div style={{fontSize: 12.5, color: '#475569', marginTop: 2}}>
                          Ghi chú: {disp.note}
                        </div>
                      )}
                    </div>
                    <div style={{display: 'flex', gap: 8}}>
                      <button
                        type="button"
                        className="crm-btn crm-btn-ghost"
                        onClick={() => setPreviewFactoryInvoice(disp)}
                      >
                        Xem hóa đơn xuất NM
                      </button>
                      {disp.status === 'DISPATCHED' && (
                        <button
                          type="button"
                          className="crm-btn crm-btn-primary"
                          onClick={() => openReconcileModalForInvoice(disp)}
                        >
                          Tạo HĐ Đối chiếu ngay
                        </button>
                      )}
                    </div>
                  </div>
                ))}

              {(data?.notifications ?? []).map(n => (
                <div
                  key={n.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 10,
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{fontSize: 13.5, fontWeight: 600, color: '#0F172A'}}>
                      {n.message}
                    </div>
                    <div style={{fontSize: 12, color: '#64748B', marginTop: 3}}>
                      Thời gian: {dt(n.created_at)}
                    </div>
                  </div>
                </div>
              ))}

              {myFactoryInvoices.filter(f => f.stage === 'FACTORY_DISPATCH').length === 0 &&
                (data?.notifications?.length ?? 0) === 0 && (
                  <div style={{padding: 28, textAlign: 'center', color: '#64748B'}}>
                    Hiện chưa có thông báo hóa đơn mới cho kho của bạn.
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 1: CẬP NHẬT SỐ LƯỢNG TỒN KHO ==================== */}
      {adjustStockRow && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div className="crm-card" style={{width: '100%', maxWidth: 460, padding: 24, background: '#FFF'}}>
            <h3 style={{margin: '0 0 8px', fontSize: 18, fontWeight: 800}}>
              Cập nhật Số lượng Tồn kho ({adjustStockRow.warehouseCode})
            </h3>
            <p style={{margin: '0 0 16px', fontSize: 13, color: '#64748B'}}>
              Mặt hàng: <strong>{adjustStockRow.productName}</strong> ({adjustStockRow.sku})
            </p>
            <div style={{marginBottom: 16}}>
              <label style={{display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6}}>
                Số lượng tồn thực tế tại kho ({adjustStockRow.stockUnit})
              </label>
              <input
                type="number"
                min={0}
                className="crm-input"
                value={adjustNewOnHand}
                onChange={e => setAdjustNewOnHand(e.target.value)}
              />
            </div>
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8}}>
              <button
                type="button"
                className="crm-btn crm-btn-ghost"
                onClick={() => setAdjustStockRow(null)}
              >
                Đóng
              </button>
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                disabled={busy}
                onClick={async () => {
                  const res = await submitAction('adjust-warehouse-stock', {
                    warehouseId: adjustStockRow.warehouseId,
                    productId: adjustStockRow.productId,
                    newOnHand: Number(adjustNewOnHand || 0),
                  });
                  if (res?.ok) {
                    setBanner({
                      type: 'ok',
                      text: `Đã cập nhật tồn kho ${adjustStockRow.sku} thành ${Number(adjustNewOnHand || 0).toLocaleString('vi-VN')} gói.`,
                    });
                    setAdjustStockRow(null);
                  }
                }}
              >
                Lưu số lượng tồn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: ĐĂNG KÝ HÓA ĐƠN KHÁCH HÀNG / NHÂN VIÊN ĐẶT ==================== */}
      {showRegisterOrderModal && data && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            overflowY: 'auto',
          }}
        >
          <div
            className="crm-card"
            style={{
              width: '100%',
              maxWidth: 840,
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: 24,
              background: '#FFFFFF',
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
              <div>
                <h3 style={{margin: 0, fontSize: 19, fontWeight: 800}}>
                  Đăng ký Hóa đơn Khách hàng / Nhân viên đặt tại {managedWarehouse?.name}
                </h3>
                <p style={{margin: '4px 0 0', fontSize: 13, color: '#64748B'}}>
                  Hóa đơn được tạo trực tiếp cho kho {managedWarehouse?.code} và đồng bộ sang bộ phận Kế toán.
                </p>
              </div>
              <button
                type="button"
                className="crm-btn crm-btn-ghost"
                onClick={() => setShowRegisterOrderModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12, marginBottom: 16}}>
              <div>
                <label style={{display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>
                  Đối tượng đặt hàng
                </label>
                <select
                  className="crm-input"
                  value={regOrdererType}
                  onChange={e => {
                    const nextType = e.target.value as 'CUSTOMER' | 'STAFF';
                    setRegOrdererType(nextType);
                    if (nextType === 'STAFF' && data.staffMembers?.[0]) {
                      setRegOrdererName(data.staffMembers[0].displayName);
                    }
                  }}
                >
                  <option value="CUSTOMER">Khách hàng / Đại lý đặt hàng</option>
                  <option value="STAFF">Nhân viên đặt hàng</option>
                </select>
              </div>

              <div>
                <label style={{display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>
                  Chọn Khách hàng / Đại lý có sẵn
                </label>
                <select
                  className="crm-input"
                  value={regOrgId}
                  onChange={e => {
                    const id = e.target.value;
                    setRegOrgId(id);
                    const found = data.partners?.find(p => p.id === id);
                    if (found) {
                      if (regOrdererType === 'CUSTOMER') setRegOrdererName(found.name);
                      if (found.phone) setRegOrdererPhone(found.phone);
                      if (found.address) setRegAddress(found.address);
                    }
                  }}
                >
                  <option value="">-- Hoặc nhập tên khách hàng mới bên dưới --</option>
                  {(data.partners ?? []).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              {!regOrgId && (
                <div>
                  <label style={{display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>
                    Tên Khách hàng / Đơn vị mới
                  </label>
                  <input
                    type="text"
                    className="crm-input"
                    placeholder="VD: Đại lý Minh Anh / Khách lẻ..."
                    value={regCustomOrgName}
                    onChange={e => setRegCustomOrgName(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label style={{display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>
                  {regOrdererType === 'STAFF' ? 'Tên Nhân viên đặt hàng' : 'Tên Người đặt / Người nhận'}
                </label>
                {regOrdererType === 'STAFF' && (data.staffMembers?.length ?? 0) > 0 ? (
                  <select
                    className="crm-input"
                    value={regOrdererName}
                    onChange={e => setRegOrdererName(e.target.value)}
                  >
                    {data.staffMembers.map(s => (
                      <option key={s.id} value={s.displayName}>
                        {s.displayName} ({s.email})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="crm-input"
                    value={regOrdererName}
                    onChange={e => setRegOrdererName(e.target.value)}
                    placeholder="Nhập họ tên người đặt..."
                  />
                )}
              </div>

              <div>
                <label style={{display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>
                  Số điện thoại liên hệ
                </label>
                <input
                  type="text"
                  className="crm-input"
                  value={regOrdererPhone}
                  onChange={e => setRegOrdererPhone(e.target.value)}
                />
              </div>

              <div>
                <label style={{display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>
                  Chiết khấu đơn hàng (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={90}
                  className="crm-input"
                  value={regDiscountPercent}
                  onChange={e => setRegDiscountPercent(e.target.value)}
                />
              </div>

              <div>
                <label style={{display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>
                  Trạng thái nộp tiền
                </label>
                <select
                  className="crm-input"
                  value={regPaymentSubmitted ? 'SUBMITTED' : 'NEW'}
                  onChange={e => setRegPaymentSubmitted(e.target.value === 'SUBMITTED')}
                >
                  <option value="NEW">Chưa nộp tiền (Mới đăng ký)</option>
                  <option value="SUBMITTED">Đã thu/nộp tiền (Chờ KT duyệt)</option>
                </select>
              </div>

              {regPaymentSubmitted && (
                <div>
                  <label style={{display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>
                    Hình thức thanh toán
                  </label>
                  <select
                    className="crm-input"
                    value={regPaymentMethod}
                    onChange={e => setRegPaymentMethod(e.target.value as 'BANK_TRANSFER' | 'CASH')}
                  >
                    <option value="BANK_TRANSFER">Chuyển khoản ngân hàng</option>
                    <option value="CASH">Tiền mặt tại kho</option>
                  </select>
                </div>
              )}
            </div>

            <div style={{marginBottom: 14}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                <label style={{fontSize: 13, fontWeight: 800}}>
                  Danh sách sản phẩm đặt tại {managedWarehouse?.name}
                </label>
                <button
                  type="button"
                  className="crm-btn crm-btn-ghost"
                  style={{fontSize: 12}}
                  onClick={() => {
                    const first = data.products[0];
                    if (!first) return;
                    setRegLines(prev => [
                      ...prev,
                      {
                        productId: first.id,
                        quantity: 10,
                        unitPrice: Number(first.retail_price || 0),
                      },
                    ]);
                  }}
                >
                  + Thêm dòng sản phẩm
                </button>
              </div>

              <div className="crm-table-wrap">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>Sản phẩm</th>
                      <th style={{textAlign: 'right'}}>Tồn khả dụng</th>
                      <th style={{textAlign: 'right'}}>Số lượng đặt</th>
                      <th style={{textAlign: 'right'}}>Đơn giá gốc (₫)</th>
                      <th style={{textAlign: 'right'}}>Thành tiền gốc</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {regLines.map((line, idx) => {
                      const st = myStocks.find(s => s.productId === line.productId);
                      return (
                        <tr key={idx}>
                          <td>
                            <select
                              className="crm-input"
                              value={line.productId}
                              onChange={e => {
                                const pid = e.target.value;
                                const prod = data.products.find(p => p.id === pid);
                                setRegLines(prev =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          productId: pid,
                                          unitPrice: Number(prod?.retail_price || x.unitPrice),
                                        }
                                      : x
                                  )
                                );
                              }}
                            >
                              {data.products.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.sku} — {p.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{textAlign: 'right', fontWeight: 700, color: '#065F46'}}>
                            {Number(st?.available ?? 0).toLocaleString('vi-VN')} gói
                          </td>
                          <td style={{textAlign: 'right', width: 120}}>
                            <input
                              type="number"
                              min={1}
                              className="crm-input"
                              style={{textAlign: 'right'}}
                              value={line.quantity}
                              onChange={e => {
                                const q = Math.max(0, Number(e.target.value || 0));
                                setRegLines(prev =>
                                  prev.map((x, i) => (i === idx ? {...x, quantity: q} : x))
                                );
                              }}
                            />
                          </td>
                          <td style={{textAlign: 'right', width: 150}}>
                            <input
                              type="number"
                              min={0}
                              className="crm-input"
                              style={{textAlign: 'right'}}
                              value={line.unitPrice}
                              onChange={e => {
                                const up = Math.max(0, Number(e.target.value || 0));
                                setRegLines(prev =>
                                  prev.map((x, i) => (i === idx ? {...x, unitPrice: up} : x))
                                );
                              }}
                            />
                          </td>
                          <td style={{textAlign: 'right', fontWeight: 700}}>
                            {vnd(line.quantity * line.unitPrice)}
                          </td>
                          <td style={{textAlign: 'right'}}>
                            {regLines.length > 1 && (
                              <button
                                type="button"
                                className="crm-btn crm-btn-ghost"
                                onClick={() => setRegLines(prev => prev.filter((_, i) => i !== idx))}
                              >
                                Xóa
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              style={{
                background: '#F8FAFC',
                padding: 14,
                borderRadius: 10,
                marginBottom: 16,
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{flex: 1, minWidth: 240}}>
                <input
                  type="text"
                  className="crm-input"
                  placeholder="Ghi chú hóa đơn đặt hàng (nếu có)..."
                  value={regNote}
                  onChange={e => setRegNote(e.target.value)}
                />
              </div>
              <div style={{textAlign: 'right'}}>
                <div style={{fontSize: 13, color: '#475569'}}>
                  Tổng giá gốc: <strong>{vnd(regTotals.subtotal)}</strong> · Giảm {regTotals.pct}%:{' '}
                  <strong style={{color: '#DC2626'}}>-{vnd(regTotals.disc)}</strong>
                </div>
                <div style={{fontSize: 17, fontWeight: 800, color: '#0F172A', marginTop: 2}}>
                  Tổng phải thu: {vnd(regTotals.net)}
                </div>
              </div>
            </div>

            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 10}}>
              <button
                type="button"
                className="crm-btn crm-btn-ghost"
                onClick={() => setShowRegisterOrderModal(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                disabled={busy}
                onClick={async () => {
                  const res = await submitAction('register-warehouse-order', {
                    warehouseId: managedWarehouse?.id,
                    ordererType: regOrdererType,
                    organizationId: regOrgId || undefined,
                    organizationName: regCustomOrgName || regOrdererName,
                    ordererName: regOrdererName,
                    ordererPhone: regOrdererPhone,
                    address: regAddress,
                    discountPercent: Number(regDiscountPercent || 0),
                    paymentSubmitted: regPaymentSubmitted,
                    paymentMethod: regPaymentMethod,
                    note: regNote,
                    lines: regLines,
                  });
                  if (res?.ok) {
                    setBanner({
                      type: 'ok',
                      text: `Đã đăng ký thành công hóa đơn đặt hàng ${res.documentCode} tại ${managedWarehouse?.name}!`,
                    });
                    setShowRegisterOrderModal(false);
                    setTab('orders');
                  }
                }}
              >
                Xác nhận Đăng ký Hóa đơn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 3: TẠO HÓA ĐƠN ĐỐI CHIẾU VỚI NHÀ MÁY ==================== */}
      {showReconcileModal && data && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            overflowY: 'auto',
          }}
        >
          <div
            className="crm-card"
            style={{
              width: '100%',
              maxWidth: 880,
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: 24,
              background: '#FFFFFF',
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
              <div>
                <h3 style={{margin: 0, fontSize: 19, fontWeight: 800}}>
                  Tạo Hóa đơn Đối chiếu với Nhà máy ({managedWarehouse?.name})
                </h3>
                <p style={{margin: '4px 0 0', fontSize: 13, color: '#64748B'}}>
                  Kiểm đếm số lượng thực nhận tại {managedWarehouse?.code} so với Hóa đơn xuất Nhà máy, tự động cộng tồn kho và gửi đối chiếu cho Kế toán.
                </p>
              </div>
              <button
                type="button"
                className="crm-btn crm-btn-ghost"
                onClick={() => setShowReconcileModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 16}}>
              <div>
                <label style={{display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>
                  Chọn Hóa đơn xuất Nhà máy cần đối chiếu
                </label>
                <select
                  className="crm-input"
                  value={reconcileSourceInvoice?.id ?? ''}
                  onChange={e => {
                    const id = e.target.value;
                    const found = myFactoryInvoices.find(f => f.id === id) ?? null;
                    setReconcileSourceInvoice(found);
                    if (found && found.lines.length > 0) {
                      setReconcileLines(
                        found.lines.map(l => ({
                          productId: l.productId,
                          sku: l.sku,
                          name: l.name,
                          orderedQty: Number(l.orderedQty || l.dispatchedQty || 0),
                          dispatchedQty: Number(l.dispatchedQty || l.orderedQty || 0),
                          receivedQty: Number(l.dispatchedQty || l.orderedQty || 0),
                          unitCost: Number(l.factoryUnitPrice || 0),
                          note: l.note || '',
                        }))
                      );
                    }
                  }}
                >
                  <option value="">-- Lập phiếu đối chiếu độc lập (không chọn HĐ cũ) --</option>
                  {myFactoryInvoices
                    .filter(f => f.stage === 'FACTORY_DISPATCH')
                    .map(f => (
                      <option key={f.id} value={f.id}>
                        {f.code} · Xuất {Number(f.totalDispatchedQty).toLocaleString('vi-VN')} gói ({f.status})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label style={{display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>
                  Ghi chú đối chiếu với Nhà máy
                </label>
                <input
                  type="text"
                  className="crm-input"
                  value={reconcileNote}
                  onChange={e => setReconcileNote(e.target.value)}
                  placeholder="Ghi chú tình trạng kiện hàng, biên bản nhận hàng..."
                />
              </div>
            </div>

            <div className="crm-table-wrap" style={{marginBottom: 16}}>
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Mã SKU / Sản phẩm</th>
                    <th style={{textAlign: 'right'}}>SL Nhà máy xuất</th>
                    <th style={{textAlign: 'right'}}>SL Kho thực nhận</th>
                    <th style={{textAlign: 'right'}}>Chênh lệch</th>
                    <th>Ghi chú dòng</th>
                  </tr>
                </thead>
                <tbody>
                  {reconcileLines.map((line, idx) => {
                    const diff = line.receivedQty - line.dispatchedQty;
                    return (
                      <tr key={idx}>
                        <td style={{fontWeight: 700}}>
                          {line.sku} — {line.name}
                        </td>
                        <td style={{textAlign: 'right', width: 140}}>
                          <input
                            type="number"
                            min={0}
                            className="crm-input"
                            style={{textAlign: 'right'}}
                            value={line.dispatchedQty}
                            disabled={Boolean(reconcileSourceInvoice)}
                            onChange={e => {
                              const v = Math.max(0, Number(e.target.value || 0));
                              setReconcileLines(prev =>
                                prev.map((x, i) => (i === idx ? {...x, dispatchedQty: v} : x))
                              );
                            }}
                          />
                        </td>
                        <td style={{textAlign: 'right', width: 140}}>
                          <input
                            type="number"
                            min={0}
                            className="crm-input"
                            style={{textAlign: 'right', fontWeight: 800}}
                            value={line.receivedQty}
                            onChange={e => {
                              const v = Math.max(0, Number(e.target.value || 0));
                              setReconcileLines(prev =>
                                prev.map((x, i) => (i === idx ? {...x, receivedQty: v} : x))
                              );
                            }}
                          />
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 800,
                            color: diff === 0 ? '#065F46' : '#DC2626',
                          }}
                        >
                          {diff === 0 ? 'Khớp (0)' : diff > 0 ? `+${diff} (Thừa)` : `${diff} (Thiếu)`}
                        </td>
                        <td>
                          <input
                            type="text"
                            className="crm-input"
                            placeholder="Ghi chú thực nhận..."
                            value={line.note}
                            onChange={e => {
                              const val = e.target.value;
                              setReconcileLines(prev =>
                                prev.map((x, i) => (i === idx ? {...x, note: val} : x))
                              );
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 10}}>
              <button
                type="button"
                className="crm-btn crm-btn-ghost"
                onClick={() => setShowReconcileModal(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                disabled={busy}
                onClick={async () => {
                  const res = await submitAction('create-warehouse-reconciliation', {
                    warehouseId: managedWarehouse?.id,
                    dispatchInvoiceId: reconcileSourceInvoice?.id ?? undefined,
                    note: reconcileNote,
                    lines: reconcileLines,
                  });
                  if (res?.ok) {
                    setBanner({
                      type: 'ok',
                      text: `Đã tạo Hóa đơn Đối chiếu ${res.code} và cộng số lượng thực nhận vào ${managedWarehouse?.name}!`,
                    });
                    setShowReconcileModal(false);
                    setTab('factory');
                  }
                }}
              >
                Xác nhận Tạo HĐ Đối chiếu & Nhập kho
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 4: TẠO HÓA ĐƠN BÀN GIAO SẢN PHẨM CHO NHÂN VIÊN / KHÁCH HÀNG ==================== */}
      {showHandoverModal && data && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            overflowY: 'auto',
          }}
        >
          <div
            className="crm-card"
            style={{
              width: '100%',
              maxWidth: 860,
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: 24,
              background: '#FFFFFF',
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
              <div>
                <h3 style={{margin: 0, fontSize: 19, fontWeight: 800}}>
                  Tạo Hóa đơn Bàn giao Sản phẩm ({managedWarehouse?.name})
                </h3>
                <p style={{margin: '4px 0 0', fontSize: 13, color: '#64748B'}}>
                  Lập biên bản / hóa đơn bàn giao sản phẩm từ {managedWarehouse?.code} cho Nhân viên hoặc Khách hàng.
                </p>
              </div>
              <button
                type="button"
                className="crm-btn crm-btn-ghost"
                onClick={() => setShowHandoverModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12, marginBottom: 16}}>
              <div>
                <label style={{display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>
                  Chọn theo Hóa đơn đặt hàng (Tùy chọn)
                </label>
                <select
                  className="crm-input"
                  value={handoverClearanceId}
                  onChange={e => {
                    const cid = e.target.value;
                    const found = myOrders.find(o => o.id === cid);
                    if (found) {
                      openHandoverModalFromOrder(found);
                    } else {
                      setHandoverClearanceId('');
                      setHandoverOrderCode('');
                    }
                  }}
                >
                  <option value="">-- Bàn giao trực tiếp (Không chọn đơn cũ) --</option>
                  {myOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.documentCode} — {o.organizationName} ({o.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>
                  Bàn giao sản phẩm cho đối tượng
                </label>
                <select
                  className="crm-input"
                  value={handoverRecipientType}
                  onChange={e => {
                    const nextType = e.target.value as 'STAFF' | 'CUSTOMER';
                    setHandoverRecipientType(nextType);
                    if (nextType === 'STAFF' && data.staffMembers?.[0] && !handoverRecipientName) {
                      setHandoverRecipientName(data.staffMembers[0].displayName);
                    }
                  }}
                >
                  <option value="CUSTOMER">Khách hàng nhận sản phẩm</option>
                  <option value="STAFF">Nhân viên nhận sản phẩm (đi giao / điều phối)</option>
                </select>
              </div>

              <div>
                <label style={{display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>
                  {handoverRecipientType === 'STAFF'
                    ? 'Họ tên Nhân viên nhận bàn giao'
                    : 'Họ tên Khách hàng nhận bàn giao'}
                </label>
                {handoverRecipientType === 'STAFF' && (data.staffMembers?.length ?? 0) > 0 ? (
                  <select
                    className="crm-input"
                    value={handoverRecipientName}
                    onChange={e => setHandoverRecipientName(e.target.value)}
                  >
                    <option value="">-- Chọn nhân viên nhận hàng --</option>
                    {data.staffMembers.map(s => (
                      <option key={s.id} value={s.displayName}>
                        {s.displayName} ({s.email})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="crm-input"
                    placeholder="Nhập họ tên người nhận hàng..."
                    value={handoverRecipientName}
                    onChange={e => setHandoverRecipientName(e.target.value)}
                  />
                )}
              </div>

              <div>
                <label style={{display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>
                  Số điện thoại người nhận
                </label>
                <input
                  type="text"
                  className="crm-input"
                  placeholder="VD: 0909123456"
                  value={handoverRecipientPhone}
                  onChange={e => setHandoverRecipientPhone(e.target.value)}
                />
              </div>

              <div>
                <label style={{display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>
                  Đơn vị / Tên Khách hàng
                </label>
                <input
                  type="text"
                  className="crm-input"
                  placeholder="Tên cửa hàng / đại lý / khách hàng..."
                  value={handoverOrgName}
                  onChange={e => setHandoverOrgName(e.target.value)}
                />
              </div>

              <div>
                <label style={{display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>
                  Ghi chú bàn giao
                </label>
                <input
                  type="text"
                  className="crm-input"
                  value={handoverNote}
                  onChange={e => setHandoverNote(e.target.value)}
                />
              </div>
            </div>

            <div style={{marginBottom: 16}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                <label style={{fontSize: 13, fontWeight: 800}}>
                  Danh mục sản phẩm bàn giao xuất kho ({managedWarehouse?.code})
                </label>
                <button
                  type="button"
                  className="crm-btn crm-btn-ghost"
                  style={{fontSize: 12}}
                  onClick={() => {
                    const first = data.products[0];
                    if (!first) return;
                    setHandoverLines(prev => [
                      ...prev,
                      {
                        productId: first.id,
                        quantity: 10,
                        unitPrice: Number(first.retail_price || 0),
                        note: '',
                      },
                    ]);
                  }}
                >
                  + Thêm sản phẩm bàn giao
                </button>
              </div>

              <div className="crm-table-wrap">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>Sản phẩm bàn giao</th>
                      <th style={{textAlign: 'right'}}>Tồn kho hiện tại</th>
                      <th style={{textAlign: 'right'}}>SL bàn giao</th>
                      <th style={{textAlign: 'right'}}>Đơn giá (₫)</th>
                      <th style={{textAlign: 'right'}}>Thành tiền</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {handoverLines.map((line, idx) => {
                      const st = myStocks.find(s => s.productId === line.productId);
                      return (
                        <tr key={idx}>
                          <td>
                            <select
                              className="crm-input"
                              value={line.productId}
                              onChange={e => {
                                const pid = e.target.value;
                                const prod = data.products.find(p => p.id === pid);
                                setHandoverLines(prev =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          productId: pid,
                                          unitPrice: Number(prod?.retail_price || x.unitPrice),
                                        }
                                      : x
                                  )
                                );
                              }}
                            >
                              {data.products.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.sku} — {p.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{textAlign: 'right', fontWeight: 700, color: '#065F46'}}>
                            {Number(st?.available ?? 0).toLocaleString('vi-VN')} gói
                          </td>
                          <td style={{textAlign: 'right', width: 120}}>
                            <input
                              type="number"
                              min={1}
                              className="crm-input"
                              style={{textAlign: 'right', fontWeight: 800}}
                              value={line.quantity}
                              onChange={e => {
                                const q = Math.max(0, Number(e.target.value || 0));
                                setHandoverLines(prev =>
                                  prev.map((x, i) => (i === idx ? {...x, quantity: q} : x))
                                );
                              }}
                            />
                          </td>
                          <td style={{textAlign: 'right', width: 140}}>
                            <input
                              type="number"
                              min={0}
                              className="crm-input"
                              style={{textAlign: 'right'}}
                              value={line.unitPrice}
                              onChange={e => {
                                const up = Math.max(0, Number(e.target.value || 0));
                                setHandoverLines(prev =>
                                  prev.map((x, i) => (i === idx ? {...x, unitPrice: up} : x))
                                );
                              }}
                            />
                          </td>
                          <td style={{textAlign: 'right', fontWeight: 700}}>
                            {vnd(line.quantity * line.unitPrice)}
                          </td>
                          <td style={{textAlign: 'right'}}>
                            {handoverLines.length > 1 && (
                              <button
                                type="button"
                                className="crm-btn crm-btn-ghost"
                                onClick={() =>
                                  setHandoverLines(prev => prev.filter((_, i) => i !== idx))
                                }
                              >
                                Xóa
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 10}}>
              <button
                type="button"
                className="crm-btn crm-btn-ghost"
                onClick={() => setShowHandoverModal(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                disabled={busy}
                onClick={async () => {
                  if (!handoverRecipientName.trim()) {
                    setBanner({type: 'err', text: 'Vui lòng nhập họ tên người nhận bàn giao.'});
                    return;
                  }
                  const res = await submitAction('create-handover-invoice', {
                    warehouseId: managedWarehouse?.id,
                    clearanceId: handoverClearanceId || undefined,
                    recipientType: handoverRecipientType,
                    recipientName: handoverRecipientName,
                    recipientPhone: handoverRecipientPhone,
                    organizationName: handoverOrgName || handoverRecipientName,
                    orderCode: handoverOrderCode,
                    note: handoverNote,
                    lines: handoverLines,
                  });
                  if (res?.ok) {
                    setBanner({
                      type: 'ok',
                      text: `Đã tạo Hóa đơn Bàn giao Sản phẩm ${res.code} và trừ tồn kho ${managedWarehouse?.name}!`,
                    });
                    setShowHandoverModal(false);
                    setTab('handover');
                  }
                }}
              >
                Xác nhận Tạo HĐ Bàn giao Sản phẩm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL XEM & IN HÓA ĐƠN KHÁCH / NHÂN VIÊN ĐẶT ==================== */}
      {previewOrderInvoice && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="crm-card"
            style={{
              width: '100%',
              maxWidth: 780,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 28,
              background: '#FFFFFF',
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18}}>
              <div>
                <div style={{fontSize: 12, fontWeight: 800, color: '#2563EB'}}>
                  COHAMY VIỆT NAM — {managedWarehouse?.name?.toUpperCase()}
                </div>
                <h3 style={{margin: '4px 0', fontSize: 20, fontWeight: 800}}>
                  HÓA ĐƠN ĐẶT HÀNG ({previewOrderInvoice.documentCode})
                </h3>
                <div style={{fontSize: 13, color: '#475569'}}>
                  Khách hàng / Đơn vị: <strong>{previewOrderInvoice.organizationName}</strong> · Người đặt:{' '}
                  <strong>{previewOrderInvoice.ordererName || previewOrderInvoice.creatorName}</strong>
                </div>
              </div>
              <div style={{display: 'flex', gap: 8}}>
                <button
                  type="button"
                  className="crm-btn crm-btn-primary"
                  onClick={() => window.print()}
                >
                  In / Xuất PDF Hóa đơn
                </button>
                <button
                  type="button"
                  className="crm-btn crm-btn-ghost"
                  onClick={() => setPreviewOrderInvoice(null)}
                >
                  Đóng
                </button>
              </div>
            </div>

            <table className="crm-table" style={{marginBottom: 16}}>
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Mã SKU</th>
                  <th>Tên sản phẩm</th>
                  <th style={{textAlign: 'right'}}>Số lượng</th>
                  <th style={{textAlign: 'right'}}>Đơn giá gốc</th>
                  <th style={{textAlign: 'right'}}>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {previewOrderInvoice.lines.map((l, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td style={{fontFamily: 'monospace', fontWeight: 700}}>{l.sku}</td>
                    <td>{l.name}</td>
                    <td style={{textAlign: 'right', fontWeight: 700}}>
                      {Number(l.baseQuantity || l.quantity).toLocaleString('vi-VN')} {l.unitLabel}
                    </td>
                    <td style={{textAlign: 'right'}}>{vnd(l.listUnitPrice)}</td>
                    <td style={{textAlign: 'right', fontWeight: 700}}>{vnd(l.listLineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{textAlign: 'right', fontSize: 14, lineHeight: 1.8}}>
              <div>
                Tổng tiền hàng (giá gốc): <strong>{vnd(previewOrderInvoice.listSubtotal)}</strong>
              </div>
              <div>
                Chiết khấu ({previewOrderInvoice.discountPercent}%):{' '}
                <strong style={{color: '#DC2626'}}>-{vnd(previewOrderInvoice.discountAmount)}</strong>
              </div>
              <div style={{fontSize: 17, fontWeight: 800, color: '#0F172A'}}>
                Tổng cộng thanh toán: {vnd(previewOrderInvoice.netTotal)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL XEM & IN HÓA ĐƠN NHÀ MÁY / ĐỐI CHIẾU ==================== */}
      {previewFactoryInvoice && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="crm-card"
            style={{
              width: '100%',
              maxWidth: 800,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 28,
              background: '#FFFFFF',
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18}}>
              <div>
                <div style={{fontSize: 12, fontWeight: 800, color: '#065F46'}}>
                  {previewFactoryInvoice.factoryName} ↔ {previewFactoryInvoice.warehouseName}
                </div>
                <h3 style={{margin: '4px 0', fontSize: 20, fontWeight: 800}}>
                  {previewFactoryInvoice.stage === 'WAREHOUSE_RECONCILIATION'
                    ? `HÓA ĐƠN ĐỐI CHIẾU NHÀ MÁY (${previewFactoryInvoice.code})`
                    : `HÓA ĐƠN XUẤT NHÀ MÁY VỀ KHO (${previewFactoryInvoice.code})`}
                </h3>
                <div style={{fontSize: 13, color: '#475569'}}>
                  Kho nhận: <strong>{previewFactoryInvoice.warehouseName}</strong> · Ngày lập:{' '}
                  {dt(previewFactoryInvoice.createdAt)}
                </div>
              </div>
              <div style={{display: 'flex', gap: 8}}>
                <button
                  type="button"
                  className="crm-btn crm-btn-primary"
                  onClick={() => window.print()}
                >
                  In / Xuất PDF
                </button>
                <button
                  type="button"
                  className="crm-btn crm-btn-ghost"
                  onClick={() => setPreviewFactoryInvoice(null)}
                >
                  Đóng
                </button>
              </div>
            </div>

            <table className="crm-table" style={{marginBottom: 16}}>
              <thead>
                <tr>
                  <th>Mã SKU</th>
                  <th>Tên sản phẩm</th>
                  <th style={{textAlign: 'right'}}>SL Nhà máy xuất</th>
                  <th style={{textAlign: 'right'}}>SL Kho thực nhận</th>
                  <th style={{textAlign: 'right'}}>Chênh lệch</th>
                  <th style={{textAlign: 'right'}}>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {previewFactoryInvoice.lines.map((l, idx) => (
                  <tr key={idx}>
                    <td style={{fontFamily: 'monospace', fontWeight: 700}}>{l.sku}</td>
                    <td>{l.name}</td>
                    <td style={{textAlign: 'right'}}>
                      {Number(l.dispatchedQty || l.orderedQty || 0).toLocaleString('vi-VN')}
                    </td>
                    <td style={{textAlign: 'right', fontWeight: 800}}>
                      {Number(l.receivedQty || l.dispatchedQty || 0).toLocaleString('vi-VN')}
                    </td>
                    <td style={{textAlign: 'right', fontWeight: 700}}>
                      {Number(l.discrepancyQty || 0)}
                    </td>
                    <td style={{textAlign: 'right', fontWeight: 700}}>{vnd(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== MODAL XEM & IN HÓA ĐƠN BÀN GIAO SẢN PHẨM ==================== */}
      {previewHandoverInvoice && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="crm-card"
            style={{
              width: '100%',
              maxWidth: 780,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 28,
              background: '#FFFFFF',
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18}}>
              <div>
                <div style={{fontSize: 12, fontWeight: 800, color: '#0F172A'}}>
                  COHAMY VIỆT NAM — {previewHandoverInvoice.warehouseName.toUpperCase()}
                </div>
                <h3 style={{margin: '4px 0', fontSize: 20, fontWeight: 800}}>
                  HÓA ĐƠN BÀN GIAO SẢN PHẨM ({previewHandoverInvoice.code})
                </h3>
                <div style={{fontSize: 13.5, color: '#334155'}}>
                  Bàn giao cho{' '}
                  <strong>
                    {previewHandoverInvoice.recipientType === 'STAFF' ? 'Nhân viên' : 'Khách hàng'}
                  </strong>
                  : <strong>{previewHandoverInvoice.recipientName}</strong>
                  {previewHandoverInvoice.recipientPhone
                    ? ` (${previewHandoverInvoice.recipientPhone})`
                    : ''}{' '}
                  · Đơn vị: <strong>{previewHandoverInvoice.organizationName}</strong>
                </div>
                <div style={{fontSize: 12.5, color: '#64748B', marginTop: 2}}>
                  Thủ kho lập: {previewHandoverInvoice.createdByName} · Ngày bàn giao:{' '}
                  {dt(previewHandoverInvoice.createdAt)}
                </div>
              </div>
              <div style={{display: 'flex', gap: 8}}>
                <button
                  type="button"
                  className="crm-btn crm-btn-primary"
                  onClick={() => window.print()}
                >
                  In / Xuất PDF HĐ Bàn giao
                </button>
                <button
                  type="button"
                  className="crm-btn crm-btn-ghost"
                  onClick={() => setPreviewHandoverInvoice(null)}
                >
                  Đóng
                </button>
              </div>
            </div>

            <table className="crm-table" style={{marginBottom: 20}}>
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Mã SKU</th>
                  <th>Tên sản phẩm</th>
                  <th style={{textAlign: 'right'}}>Số lượng bàn giao</th>
                  <th style={{textAlign: 'right'}}>Đơn giá</th>
                  <th style={{textAlign: 'right'}}>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {previewHandoverInvoice.lines.map((l, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td style={{fontFamily: 'monospace', fontWeight: 700}}>{l.sku}</td>
                    <td>{l.name}</td>
                    <td style={{textAlign: 'right', fontWeight: 800}}>
                      {Number(l.quantity).toLocaleString('vi-VN')} {l.unitLabel}
                    </td>
                    <td style={{textAlign: 'right'}}>{vnd(l.unitPrice)}</td>
                    <td style={{textAlign: 'right', fontWeight: 700}}>{vnd(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 12,
                borderTop: '1px solid #E2E8F0',
                marginBottom: 28,
              }}
            >
              <div style={{fontSize: 13, color: '#475569'}}>
                Ghi chú: {previewHandoverInvoice.note || 'Đã kiểm đếm đủ số lượng và tình trạng nguyên vẹn.'}
              </div>
              <div style={{textAlign: 'right'}}>
                <div style={{fontSize: 14}}>
                  Tổng số lượng bàn giao:{' '}
                  <strong>{Number(previewHandoverInvoice.totalQuantity).toLocaleString('vi-VN')} gói</strong>
                </div>
                <div style={{fontSize: 17, fontWeight: 800, color: '#0F172A'}}>
                  Tổng giá trị bàn giao: {vnd(previewHandoverInvoice.totalAmount)}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                textAlign: 'center',
                paddingTop: 12,
                paddingBottom: 36,
              }}
            >
              <div>
                <div style={{fontWeight: 800, fontSize: 13.5}}>THỦ KHO XUẤT BÀN GIAO</div>
                <div style={{fontSize: 12, color: '#64748B', marginTop: 4}}>
                  ({previewHandoverInvoice.createdByName})
                </div>
              </div>
              <div>
                <div style={{fontWeight: 800, fontSize: 13.5}}>
                  NGƯỜI NHẬN BÀN GIAO ({previewHandoverInvoice.recipientType === 'STAFF' ? 'NHÂN VIÊN' : 'KHÁCH HÀNG'})
                </div>
                <div style={{fontSize: 12, color: '#64748B', marginTop: 4}}>
                  ({previewHandoverInvoice.recipientName})
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
