'use client';

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {ProductThumbZoom, resolveProductImage} from './CommercialForms';
import type {
  AccountantWorkspaceData,
  CustomerTaxProfileRecord,
  FactoryInvoiceRecord,
  OrderClearanceRecord,
  VatInvoiceRecord,
  WarehouseHandoverInvoiceRecord,
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
        label: 'Chưa thanh toán · Sẵn sàng xuất kho',
        bg: '#FEF3C7',
        color: '#92400E',
        border: '#F59E0B',
      };
    case 'STAFF_SUBMITTED':
      return {
        label: 'Chờ Kế toán xác nhận thanh toán',
        bg: '#DBEAFE',
        color: '#1E40AF',
        border: '#3B82F6',
      };
    case 'ACCOUNTANT_CLEARED':
      return {
        label: 'Đã xác nhận thanh toán đủ',
        bg: '#D1FAE5',
        color: '#065F46',
        border: '#10B981',
      };
    case 'ACCOUNTANT_REJECTED':
      return {
        label: 'Còn công nợ / Cần bổ sung thanh toán',
        bg: '#FEE2E2',
        color: '#991B1B',
        border: '#EF4444',
      };
    case 'PICKED_UP_DELIVERED':
      return {
        label: 'Đã xuất kho giao khách',
        bg: '#E0E7FF',
        color: '#3730A3',
        border: '#6366F1',
      };
  }
}

function reconciliationBadge(status?: FactoryInvoiceRecord['reconciliationStatus']) {
  switch (status) {
    case 'MATCHED':
      return {label: 'Đã khớp', bg: '#D1FAE5', color: '#065F46'};
    case 'DISCREPANCY':
      return {label: 'Có chênh lệch', bg: '#FEE2E2', color: '#991B1B'};
    case 'RESOLVING_DISCREPANCY':
      return {label: 'Đang xử lý chênh lệch', bg: '#FEF3C7', color: '#92400E'};
    case 'COMPLETED':
      return {label: 'Hoàn tất', bg: '#E0E7FF', color: '#3730A3'};
    case 'PENDING_RECEIPT':
    default:
      return {label: 'Chờ kho nhận', bg: '#DBEAFE', color: '#1E40AF'};
  }
}

function vatBadge(status?: VatInvoiceRecord['status'] | OrderClearanceRecord['vatInvoiceStatus']) {
  switch (status) {
    case 'ISSUED':
      return {label: 'Đã phát hành (Đủ PDF/XML)', bg: '#D1FAE5', color: '#065F46'};
    case 'ISSUED_MISSING_FILES':
      return {label: 'Thiếu tài liệu hóa đơn (PDF/XML)', bg: '#FEF3C7', color: '#92400E'};
    case 'ADJUSTMENT_REQUESTED':
      return {label: 'Chờ điều chỉnh / thay thế', bg: '#FEE2E2', color: '#991B1B'};
    case 'ADJUSTED':
      return {label: 'Hóa đơn điều chỉnh', bg: '#E0E7FF', color: '#3730A3'};
    case 'REPLACED':
      return {label: 'Hóa đơn thay thế', bg: '#EDE9FE', color: '#5B21B6'};
    case 'UNISSUED':
    default:
      return {label: 'Chưa phát hành', bg: '#F1F5F9', color: '#475569'};
  }
}

function factoryStageBadge(stage: FactoryInvoiceRecord['stage']) {
  switch (stage) {
    case 'FACTORY_ORDER':
      return {
        label: 'Lệnh Đặt hàng Nhà máy (Admin)',
        bg: '#FEF3C7',
        color: '#92400E',
      };
    case 'FACTORY_DISPATCH':
      return {
        label: 'Phiếu xuất Nhà máy → Kho',
        bg: '#DBEAFE',
        color: '#1E40AF',
      };
    case 'WAREHOUSE_RECONCILIATION':
      return {
        label: 'Phiếu nhập kho (Thủ kho xác nhận)',
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
  initialTab?: 'orders' | 'factory' | 'vat' | 'warehouses' | 'notifications';
  userRole?: string;
}) {
  const [data, setData] = useState<AccountantWorkspaceData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [tab, setTab] = useState<'orders' | 'factory' | 'vat' | 'warehouses' | 'notifications'>(initialTab);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setTab(initialTab);
  }

  const [search, setSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [factoryStageFilter, setFactoryStageFilter] = useState<string>('ALL');
  const [reconcileStatusFilter, setReconcileStatusFilter] = useState<string>('ALL');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');
  const [factorySubView, setFactorySubView] = useState<'COMPARE' | 'VOUCHERS' | 'STOCK_MOVEMENTS'>('COMPARE');
  const [ordersSubView, setOrdersSubView] = useState<'ORDERS' | 'ISSUE_VOUCHERS' | 'PAYMENTS'>('ORDERS');
  const [vatSubView, setVatSubView] = useState<'INVOICES' | 'UNINVOICED' | 'TAX_PROFILES'>('INVOICES');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{type: 'ok' | 'err'; text: string} | null>(null);

  // Expanded / selected order clearance for inspection or modal action
  const [selectedClearance, setSelectedClearance] = useState<OrderClearanceRecord | null>(null);
  const [clearanceModalMode, setClearanceModalMode] = useState<
    'VIEW' | 'STAFF_SUBMIT' | 'ACCOUNTANT_VERIFY' | 'PICKUP' | null
  >(null);
  const [previewHandover, setPreviewHandover] = useState<WarehouseHandoverInvoiceRecord | null>(null);

  // Multi-payment modal state
  const [paymentModalOrder, setPaymentModalOrder] = useState<OrderClearanceRecord | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payBankAccount, setPayBankAccount] = useState('VCB - 0011009998888 - COHAMY VN');
  const [payRef, setPayRef] = useState('');
  const [payMethod, setPayMethod] = useState<'BANK_TRANSFER' | 'CASH' | 'COMBINED'>('BANK_TRANSFER');
  const [payTransferContent, setPayTransferContent] = useState('');

  // VAT Invoice modal state
  const [vatModalTarget, setVatModalTarget] = useState<{
    clearance?: OrderClearanceRecord;
    existingVat?: VatInvoiceRecord;
  } | null>(null);
  const [vatNumber, setVatNumber] = useState('');
  const [vatSymbol, setVatSymbol] = useState('1C26TAA');
  const [vatIssuedDate, setVatIssuedDate] = useState('');
  const [vatType, setVatType] = useState<'ORIGINAL' | 'ADJUSTMENT' | 'REPLACEMENT'>('ORIGINAL');
  const [vatBuyerName, setVatBuyerName] = useState('');
  const [vatBuyerTaxCode, setVatBuyerTaxCode] = useState('');
  const [vatBuyerAddress, setVatBuyerAddress] = useState('');
  const [vatBuyerEmail, setVatBuyerEmail] = useState('');
  const [vatAdjustmentReason, setVatAdjustmentReason] = useState('');
  const [vatNote, setVatNote] = useState('');
  const [vatPdfDocId, setVatPdfDocId] = useState<string | null>(null);
  const [vatPdfFilename, setVatPdfFilename] = useState<string | null>(null);
  const [vatXmlDocId, setVatXmlDocId] = useState<string | null>(null);
  const [vatXmlFilename, setVatXmlFilename] = useState<string | null>(null);

  // Customer Legal/Tax Profile modal state
  const [editingTaxProfile, setEditingTaxProfile] = useState<CustomerTaxProfileRecord | null>(null);
  const [taxBuyerType, setTaxBuyerType] = useState<'COMPANY' | 'INDIVIDUAL'>('COMPANY');
  const [taxLegalName, setTaxLegalName] = useState('');
  const [taxCodeInput, setTaxCodeInput] = useState('');
  const [taxAddressInput, setTaxAddressInput] = useState('');
  const [taxEmailInput, setTaxEmailInput] = useState('');
  const [taxRepInput, setTaxRepInput] = useState('');
  const [taxPersonalIdInput, setTaxPersonalIdInput] = useState('');
  const [taxConsentInput, setTaxConsentInput] = useState('');
  const [taxContractInput, setTaxContractInput] = useState('');
  const [taxNoteInput, setTaxNoteInput] = useState('');

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
  const [factoryVoucherType, setFactoryVoucherType] = useState<'INTERNAL_TRANSFER' | 'SUPPLIER_PURCHASE'>('INTERNAL_TRANSFER');
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
  const canCreateFactoryDispatch = ['FACTORY', 'ADMIN', 'MANAGER'].includes(role);
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
        (c.salesOrderCode ?? '').toLowerCase().includes(q) ||
        (c.contractCode ?? '').toLowerCase().includes(q) ||
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
      if (reconcileStatusFilter !== 'ALL' && f.reconciliationStatus !== reconcileStatusFilter) return false;
      if (voucherTypeFilter !== 'ALL' && (f.voucherType ?? 'INTERNAL_TRANSFER') !== voucherTypeFilter) return false;
      if (warehouseFilter !== 'ALL' && f.warehouseCode !== warehouseFilter) return false;
      if (!q) return true;
      return (
        f.code.toLowerCase().includes(q) ||
        f.warehouseName.toLowerCase().includes(q) ||
        f.note.toLowerCase().includes(q) ||
        (f.parentCode ?? '').toLowerCase().includes(q)
      );
    });
  }, [data, search, factoryStageFilter, reconcileStatusFilter, voucherTypeFilter, warehouseFilter]);

  // Side-by-Side Comparison Pairs: Factory Dispatch <-> Warehouse Receipt (Section 4.3)
  const dispatchReceiptPairs = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const dispatches = data.factoryInvoices.filter(f => f.stage === 'FACTORY_DISPATCH');
    const receiptsByParent = new Map<string, FactoryInvoiceRecord>();
    for (const r of data.factoryInvoices) {
      if (r.stage === 'WAREHOUSE_RECONCILIATION' && r.parentId) {
        receiptsByParent.set(r.parentId, r);
      }
    }
    return dispatches
      .map(d => ({
        dispatch: d,
        receipt: receiptsByParent.get(d.id) ?? null,
      }))
      .filter(({dispatch, receipt}) => {
        if (warehouseFilter !== 'ALL' && dispatch.warehouseCode !== warehouseFilter) return false;
        const recStatus = receipt?.reconciliationStatus ?? dispatch.reconciliationStatus ?? 'PENDING_RECEIPT';
        if (reconcileStatusFilter !== 'ALL' && recStatus !== reconcileStatusFilter) return false;
        const vType = dispatch.voucherType ?? 'INTERNAL_TRANSFER';
        if (voucherTypeFilter !== 'ALL' && vType !== voucherTypeFilter) return false;
        if (!q) return true;
        return (
          dispatch.code.toLowerCase().includes(q) ||
          (receipt?.code ?? '').toLowerCase().includes(q) ||
          dispatch.warehouseName.toLowerCase().includes(q) ||
          dispatch.lines.some(l => l.sku.toLowerCase().includes(q) || l.name.toLowerCase().includes(q))
        );
      });
  }, [data, search, warehouseFilter, reconcileStatusFilter, voucherTypeFilter]);

  const filteredVatInvoices = useMemo(() => {
    if (!data?.vatInvoices) return [];
    const q = search.trim().toLowerCase();
    return data.vatInvoices.filter(v => {
      if (warehouseFilter !== 'ALL' && v.warehouseCode !== warehouseFilter) return false;
      if (!q) return true;
      return (
        v.code.toLowerCase().includes(q) ||
        (v.invoiceNumber ?? '').toLowerCase().includes(q) ||
        (v.orderCode ?? '').toLowerCase().includes(q) ||
        v.organizationName.toLowerCase().includes(q) ||
        (v.buyerTaxCode ?? '').toLowerCase().includes(q)
      );
    });
  }, [data, search, warehouseFilter]);

  const uninvoicedOrders = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.orderClearances.filter(c => {
      if (c.vatInvoiceStatus === 'ISSUED') return false;
      if (warehouseFilter !== 'ALL' && c.warehouseCode !== warehouseFilter) return false;
      if (!q) return true;
      return (
        c.documentCode.toLowerCase().includes(q) ||
        c.organizationName.toLowerCase().includes(q)
      );
    });
  }, [data, search, warehouseFilter]);

  const filteredTaxProfiles = useMemo(() => {
    if (!data?.customerTaxProfiles) return [];
    const q = search.trim().toLowerCase();
    return data.customerTaxProfiles.filter(tp => {
      if (!q) return true;
      return (
        tp.organizationName.toLowerCase().includes(q) ||
        tp.organizationCode.toLowerCase().includes(q) ||
        tp.taxCode.toLowerCase().includes(q) ||
        tp.legalName.toLowerCase().includes(q)
      );
    });
  }, [data, search]);

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
        const hnInTransit = Number(hn?.inTransit ?? 0);
        const hnInbound = Number(hn?.totalInbound ?? 0);
        const hnOutbound = Number(hn?.totalOutbound ?? 0);
        const hcmOnHand = Number(hcm?.onHand ?? 0);
        const hcmReserved = Number(hcm?.reserved ?? 0);
        const hcmAvail = Number(hcm?.available ?? 0);
        const hcmInTransit = Number(hcm?.inTransit ?? 0);
        const hcmInbound = Number(hcm?.totalInbound ?? 0);
        const hcmOutbound = Number(hcm?.totalOutbound ?? 0);
        return {
          ...p,
          imageUrl: resolveProductImage(p.sku),
          hnOnHand,
          hnReserved,
          hnAvail,
          hnInTransit,
          hnInbound,
          hnOutbound,
          hcmOnHand,
          hcmReserved,
          hcmAvail,
          hcmInTransit,
          hcmInbound,
          hcmOutbound,
          totalOnHand: hnOnHand + hcmOnHand,
          totalAvailable: hnAvail + hcmAvail,
        };
      });
  }, [data, search]);

  function openPaymentModal(c: OrderClearanceRecord) {
    setPaymentModalOrder(c);
    const remaining = Math.max(
      0,
      Number(c.grossTotal || c.netTotal || 0) - Number(c.paidAmount || c.staffSubmittedAmount || 0)
    );
    setPayAmount(String(remaining > 0 ? remaining : c.netTotal));
    setPayBankAccount('VCB - 0011009998888 - COHAMY VN');
    setPayRef(`UNC-${c.documentCode}`);
    setPayMethod('BANK_TRANSFER');
    setPayTransferContent(`Thanh toán đơn hàng ${c.documentCode} - ${c.organizationName}`);
  }

  function openVatModal(clearance?: OrderClearanceRecord, existingVat?: VatInvoiceRecord) {
    setVatModalTarget({clearance, existingVat});
    if (existingVat) {
      setVatNumber(existingVat.invoiceNumber || '');
      setVatSymbol(existingVat.invoiceSymbol || '1C26TAA');
      setVatIssuedDate(existingVat.issuedDate ? existingVat.issuedDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setVatType(existingVat.invoiceType || 'ORIGINAL');
      setVatBuyerName(existingVat.buyerName || existingVat.organizationName);
      setVatBuyerTaxCode(existingVat.buyerTaxCode || '');
      setVatBuyerAddress(existingVat.buyerAddress || '');
      setVatBuyerEmail(existingVat.buyerEmail || '');
      setVatAdjustmentReason(existingVat.adjustmentReason || '');
      setVatNote(existingVat.note || '');
      setVatPdfDocId(existingVat.pdfDocumentId);
      setVatPdfFilename(existingVat.pdfFilename);
      setVatXmlDocId(existingVat.xmlDocumentId);
      setVatXmlFilename(existingVat.xmlFilename);
    } else if (clearance) {
      const profile = data?.customerTaxProfiles?.find(tp => tp.organizationId === clearance.organizationId);
      setVatNumber(clearance.vatInvoiceNumber || '');
      setVatSymbol(clearance.vatInvoiceSymbol || '1C26TAA');
      setVatIssuedDate(new Date().toISOString().slice(0, 10));
      setVatType('ORIGINAL');
      setVatBuyerName(profile?.legalName || clearance.organizationName);
      setVatBuyerTaxCode(profile?.taxCode || clearance.organizationTaxCode || '');
      setVatBuyerAddress(profile?.invoiceAddress || clearance.organizationAddress || '');
      setVatBuyerEmail(profile?.invoiceEmail || '');
      setVatAdjustmentReason('');
      setVatNote(`Hóa đơn GTGT cho đơn hàng ${clearance.documentCode}`);
      setVatPdfDocId(null);
      setVatPdfFilename(null);
      setVatXmlDocId(null);
      setVatXmlFilename(null);
    }
  }

  function openTaxProfileModal(tp: CustomerTaxProfileRecord) {
    setEditingTaxProfile(tp);
    setTaxBuyerType(tp.buyerType || 'COMPANY');
    setTaxLegalName(tp.legalName || tp.organizationName);
    setTaxCodeInput(tp.taxCode || '');
    setTaxAddressInput(tp.invoiceAddress || '');
    setTaxEmailInput(tp.invoiceEmail || tp.email || '');
    setTaxRepInput(tp.representativeName || '');
    setTaxPersonalIdInput(tp.personalIdNumber || '');
    setTaxConsentInput(tp.personalIdConsentBasis || '');
    setTaxContractInput(tp.contractCode || '');
    setTaxNoteInput(tp.note || '');
  }

  async function uploadDocumentFile(
    entityType: string,
    entityId: string,
    title: string,
    docCategory: string,
    file: File
  ): Promise<{id: string; filename: string} | null> {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('entityType', entityType);
      fd.set('entityId', entityId);
      fd.set('title', title);
      fd.set('docCategory', docCategory);
      fd.set('file', file);
      const res = await fetch('/api/crm/documents', {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setBanner({type: 'err', text: json?.error?.message || 'Không thể tải tệp lên.'});
        return null;
      }
      await reloadWorkspace();
      return {id: json.id, filename: file.name};
    } catch {
      setBanner({type: 'err', text: 'Lỗi tải tệp lên máy chủ.'});
      return null;
    } finally {
      setBusy(false);
    }
  }

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
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
        }}
      >
        <div
          onClick={() => setTab('factory')}
          style={{
            cursor: 'pointer',
            padding: '8px 12px',
            borderLeft: '4px solid #2563EB',
            background: '#EFF6FF',
          }}
        >
          <div style={{fontSize: 11, fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase'}}>
            MỤC 1 · NHÀ MÁY → KHO (HN & HCM)
          </div>
          <div style={{fontSize: 20, fontWeight: 800, color: '#142338', marginTop: 2}}>
            {dispatchReceiptPairs.length} cặp phiếu đối chiếu
          </div>
          <div style={{fontSize: 11, color: '#1E3A8A'}}>
            So sánh Phiếu xuất Nhà máy & Phiếu nhập Kho thực nhận
          </div>
        </div>

        <div
          onClick={() => {
            setTab('orders');
            setOrderStatusFilter('ALL');
          }}
          style={{
            cursor: 'pointer',
            padding: '8px 12px',
            borderLeft: '4px solid #F59E0B',
            background: '#FFFBEB',
          }}
        >
          <div style={{fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase'}}>
            MỤC 2 · KHO → KHÁCH HÀNG & CÔNG NỢ
          </div>
          <div style={{fontSize: 20, fontWeight: 800, color: '#142338', marginTop: 2}}>
            {data.orderClearances.length} đơn · {(data.handoverInvoices ?? []).length} phiếu xuất
          </div>
          <div style={{fontSize: 11, color: '#78350F'}}>
            Thủ kho xuất hàng độc lập · Kế toán đối chiếu công nợ
          </div>
        </div>

        <div
          onClick={() => setTab('vat')}
          style={{
            cursor: 'pointer',
            padding: '8px 12px',
            borderLeft: '4px solid #10B981',
            background: '#ECFDF5',
          }}
        >
          <div style={{fontSize: 11, fontWeight: 700, color: '#065F46', textTransform: 'uppercase'}}>
            MỤC 3 · HÓA ĐƠN VAT & CHỨNG TỪ PHÁP LÝ
          </div>
          <div style={{fontSize: 20, fontWeight: 800, color: '#142338', marginTop: 2}}>
            {(data.vatInvoices ?? []).length} HĐ VAT · {uninvoicedOrders.length} đơn chờ xuất HĐ
          </div>
          <div style={{fontSize: 11, color: '#047857'}}>
            Lấy dữ liệu từ đơn đã khóa · Lưu PDF/XML & điều chỉnh
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
            TỒN KHO HN & HCM · CÔNG NỢ NHÀ MÁY
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
            Theo dõi tồn thực tế, đang giữ, đang vận chuyển & lịch sử
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
              🏭 1. NHÀ MÁY → KHO ({data.factoryInvoices.length})
            </button>
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
              📦 2. KHO → KHÁCH HÀNG ({data.orderClearances.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('vat')}
              style={{
                padding: '7px 12px',
                fontWeight: 700,
                fontSize: 12.5,
                border: '1px solid',
                borderColor: tab === 'vat' ? '#C84B11' : '#CBD5E1',
                background: tab === 'vat' ? '#C84B11' : '#FFFFFF',
                color: tab === 'vat' ? '#FFFFFF' : '#1E293B',
                cursor: 'pointer',
              }}
            >
              🧾 3. HÓA ĐƠN VAT ({(data.vatInvoices ?? []).length})
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
              📊 Tồn kho HN & HCM + Lịch sử
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
              🔔 Thông báo ({data.notifications.length})
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
              placeholder="Tìm mã HĐ, khách hàng, MST, nhân viên, SKU..."
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

        {/* MỤC 2: KHO → KHÁCH HÀNG (ĐƠN HÀNG, PHIẾU XUẤT KHO, ĐỐI CHIẾU THANH TOÁN & CÔNG NỢ) */}
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
                {[
                  {id: 'ORDERS' as const, label: `Danh sách Đơn hàng & Công nợ (${data.orderClearances.length})`},
                  {
                    id: 'ISSUE_VOUCHERS' as const,
                    label: `Phiếu xuất kho cho Khách / Đại lý (${(data.handoverInvoices ?? []).length})`,
                  },
                  {
                    id: 'PAYMENTS' as const,
                    label: `Sổ giao dịch thanh toán (${(data.paymentTransactions ?? []).length})`,
                  },
                ].map(sv => (
                  <button
                    key={sv.id}
                    type="button"
                    onClick={() => setOrdersSubView(sv.id)}
                    style={{
                      padding: '5px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      border: '1px solid',
                      borderColor: ordersSubView === sv.id ? '#C84B11' : '#CBD5E1',
                      background: ordersSubView === sv.id ? '#FFF7ED' : '#FFFFFF',
                      color: ordersSubView === sv.id ? '#C84B11' : '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    {sv.label}
                  </button>
                ))}
              </div>
              <div style={{fontSize: 12, color: '#475569'}}>
                Quy trình chuẩn:{' '}
                <strong>
                  Đối tác tạo đơn → Quản lý duyệt → Thủ kho xác nhận xuất hàng (trừ tồn kho 1 lần, không cần Kế toán duyệt lệnh xuất) → Kế toán đối chiếu công nợ & lập Hóa đơn VAT
                </strong>
              </div>
            </div>

            {ordersSubView === 'ORDERS' && (
              <>
                <div
                  style={{
                    padding: '6px 12px',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    alignItems: 'center',
                  }}
                >
                  <span style={{fontSize: 12, fontWeight: 700, color: '#475569'}}>Lọc trạng thái:</span>
                  {[
                    {id: 'ALL', label: `Tất cả (${data.orderClearances.length})`},
                    {id: 'NEW_ORDER', label: `Chưa thanh toán (${pendingStaffCount})`},
                    {id: 'STAFF_SUBMITTED', label: `Chờ KT đối soát (${waitingAccountantCount})`},
                    {id: 'ACCOUNTANT_CLEARED', label: `Đã thanh toán đủ (${clearedForPickupCount})`},
                    {
                      id: 'PICKED_UP_DELIVERED',
                      label: `Đã xuất kho giao hàng (${
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
                        <th style={{padding: '8px 10px', whiteSpace: 'nowrap'}}>Mã Đơn / HĐ</th>
                        <th style={{padding: '8px 10px'}}>Khách hàng / Đối tác</th>
                        <th style={{padding: '8px 10px'}}>Kho xuất</th>
                        <th style={{padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap'}}>
                          Giá niêm yết
                        </th>
                        <th style={{padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap'}}>
                          % CK
                        </th>
                        <th style={{padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap'}}>
                          Phải thu (Sau CK)
                        </th>
                        <th style={{padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap'}}>
                          Đã thanh toán
                        </th>
                        <th style={{padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap'}}>
                          Công nợ còn lại
                        </th>
                        <th style={{padding: '8px 10px'}}>Trạng thái Xuất kho & Công nợ</th>
                        <th style={{padding: '8px 10px'}}>Trạng thái Hóa đơn VAT</th>
                        <th style={{padding: '8px 10px', whiteSpace: 'nowrap'}}>Thao tác Kế toán</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={11} style={{padding: 24, textAlign: 'center', color: '#64748B'}}>
                            Chưa có đơn hàng nào khớp bộ lọc.
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map(c => {
                          const badge = clearanceBadge(c.status);
                          const vBadge = vatBadge(c.vatInvoiceStatus);
                          const paidVal = Number(c.paidAmount ?? c.staffSubmittedAmount ?? 0);
                          const receivableVal = Number(c.grossTotal || c.netTotal || 0);
                          const debtVal = Math.max(0, receivableVal - paidVal);
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
                                {c.contractCode && (
                                  <div style={{fontSize: 11, color: '#0369A1'}}>HĐ: {c.contractCode}</div>
                                )}
                                <div style={{fontSize: 11, color: '#64748B'}}>{dt(c.updatedAt)}</div>
                              </td>
                              <td style={{padding: '8px 10px'}}>
                                <div style={{fontWeight: 600, color: '#0F172A'}}>{c.organizationName}</div>
                                <div style={{fontSize: 11, color: '#64748B'}}>
                                  {c.lines.length} mặt hàng · NV: {c.creatorName}
                                </div>
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
                                <div style={{fontSize: 11, color: '#475569', marginTop: 2}}>
                                  {c.warehouseIssueStatus === 'DELIVERED' || c.warehouseIssueStatus === 'ISSUED'
                                    ? '✓ Đã xuất kho'
                                    : c.warehouseIssueStatus === 'PARTIAL_ISSUED'
                                    ? 'Xuất một phần'
                                    : 'Chờ xuất kho'}
                                </div>
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
                                  fontWeight: 800,
                                  color: paidVal >= receivableVal ? '#047857' : paidVal > 0 ? '#B45309' : '#64748B',
                                }}
                              >
                                {vnd(paidVal)}
                              </td>
                              <td
                                style={{
                                  padding: '8px 10px',
                                  textAlign: 'right',
                                  fontVariantNumeric: 'tabular-nums',
                                  fontWeight: 800,
                                  color: debtVal > 0 ? '#DC2626' : '#047857',
                                }}
                              >
                                {vnd(debtVal)}
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
                              </td>
                              <td style={{padding: '8px 10px'}}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '3px 8px',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    background: vBadge.bg,
                                    color: vBadge.color,
                                  }}
                                >
                                  {vBadge.label}
                                </span>
                                {c.vatInvoiceNumber && (
                                  <div style={{fontSize: 11, color: '#0F172A', fontWeight: 600, marginTop: 2}}>
                                    Số HĐ: {c.vatInvoiceNumber} ({c.vatInvoiceSymbol})
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
                                    👁️ Chi tiết đơn
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => openPaymentModal(c)}
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
                                    💵 Thanh toán / Công nợ
                                  </button>

                                  {canAccountantApprove && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const existing = (data.vatInvoices ?? []).find(
                                          v => v.clearanceId === c.id
                                        );
                                        openVatModal(c, existing);
                                      }}
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: 11.5,
                                        fontWeight: 700,
                                        border: '1px solid #059669',
                                        background: '#ECFDF5',
                                        color: '#065F46',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      🧾 Hóa đơn VAT
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
                                    🖨️ In
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
              </>
            )}

            {ordersSubView === 'ISSUE_VOUCHERS' && (
              <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12.5}}>
                  <thead>
                    <tr style={{background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left'}}>
                      <th style={{padding: '8px 10px'}}>Mã Phiếu xuất kho</th>
                      <th style={{padding: '8px 10px'}}>Mã đơn hàng</th>
                      <th style={{padding: '8px 10px'}}>Khách hàng / Đối tác</th>
                      <th style={{padding: '8px 10px'}}>Kho xuất</th>
                      <th style={{padding: '8px 10px'}}>Thủ kho thực hiện</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Tổng SL xuất</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Giá niêm yết</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Chiết khấu</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Thuế VAT</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Tổng phải thu</th>
                      <th style={{padding: '8px 10px'}}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.handoverInvoices ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{padding: 24, textAlign: 'center', color: '#64748B'}}>
                          Chưa có phiếu xuất kho nào.
                        </td>
                      </tr>
                    ) : (
                      (data.handoverInvoices ?? []).map(h => (
                        <tr key={h.id} style={{borderBottom: '1px solid #E2E8F0'}}>
                          <td style={{padding: '8px 10px', fontWeight: 700, fontFamily: 'monospace'}}>
                            {h.code}
                            <div style={{fontSize: 11, color: '#64748B'}}>{dt(h.createdAt)}</div>
                          </td>
                          <td style={{padding: '8px 10px', fontWeight: 700, color: '#2563EB'}}>
                            {h.orderCode || '—'}
                          </td>
                          <td style={{padding: '8px 10px', fontWeight: 600}}>{h.organizationName}</td>
                          <td style={{padding: '8px 10px'}}>{h.warehouseName} ({h.warehouseCode})</td>
                          <td style={{padding: '8px 10px'}}>{h.createdByName}</td>
                          <td style={{padding: '8px 10px', textAlign: 'right', fontWeight: 700}}>
                            {Number(h.totalQuantity).toLocaleString('vi-VN')} gói
                          </td>
                          <td style={{padding: '8px 10px', textAlign: 'right'}}>
                            {vnd(h.listSubtotal || h.totalAmount)}
                          </td>
                          <td style={{padding: '8px 10px', textAlign: 'right', color: '#DC2626'}}>
                            -{vnd(h.discountAmount || 0)} ({h.discountPercent || 0}%)
                          </td>
                          <td style={{padding: '8px 10px', textAlign: 'right'}}>
                            {vnd(h.vatAmount || 0)}
                          </td>
                          <td style={{padding: '8px 10px', textAlign: 'right', fontWeight: 800}}>
                            {vnd(h.totalAmount)}
                          </td>
                          <td style={{padding: '8px 10px'}}>
                            <button
                              type="button"
                              onClick={() => setPreviewHandover(h)}
                              style={{
                                padding: '4px 8px',
                                fontSize: 11.5,
                                fontWeight: 700,
                                border: '1px solid #CBD5E1',
                                background: '#FFFFFF',
                                cursor: 'pointer',
                              }}
                            >
                              👁️ Xem Phiếu xuất kho
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {ordersSubView === 'PAYMENTS' && (
              <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12.5}}>
                  <thead>
                    <tr style={{background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left'}}>
                      <th style={{padding: '8px 10px'}}>Mã GD / Ngày</th>
                      <th style={{padding: '8px 10px'}}>Đơn hàng</th>
                      <th style={{padding: '8px 10px'}}>Khách hàng</th>
                      <th style={{padding: '8px 10px'}}>Tài khoản nhận / Hình thức</th>
                      <th style={{padding: '8px 10px'}}>Mã tham chiếu / Nội dung CK</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Số tiền thanh toán</th>
                      <th style={{padding: '8px 10px'}}>Trạng thái xác nhận</th>
                      <th style={{padding: '8px 10px'}}>Thao tác Kế toán</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.paymentTransactions ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{padding: 24, textAlign: 'center', color: '#64748B'}}>
                          Chưa có giao dịch thanh toán nào.
                        </td>
                      </tr>
                    ) : (
                      (data.paymentTransactions ?? []).map(p => (
                        <tr key={p.id} style={{borderBottom: '1px solid #E2E8F0'}}>
                          <td style={{padding: '8px 10px', fontWeight: 700}}>
                            {p.code}
                            <div style={{fontSize: 11, color: '#64748B'}}>{p.paymentDate}</div>
                          </td>
                          <td style={{padding: '8px 10px', fontWeight: 700, color: '#2563EB'}}>
                            {p.documentCode}
                          </td>
                          <td style={{padding: '8px 10px', fontWeight: 600}}>{p.organizationName}</td>
                          <td style={{padding: '8px 10px'}}>
                            <div>{p.paymentMethod}</div>
                            <div style={{fontSize: 11, color: '#64748B'}}>{p.bankAccount}</div>
                          </td>
                          <td style={{padding: '8px 10px'}}>
                            <div style={{fontWeight: 600}}>{p.referenceCode}</div>
                            <div style={{fontSize: 11, color: '#64748B'}}>{p.transferContent}</div>
                          </td>
                          <td style={{padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#047857'}}>
                            {vnd(p.amount)}
                          </td>
                          <td style={{padding: '8px 10px'}}>
                            <span
                              style={{
                                padding: '3px 8px',
                                fontSize: 11.5,
                                fontWeight: 700,
                                background:
                                  p.status === 'CONFIRMED'
                                    ? '#D1FAE5'
                                    : p.status === 'REJECTED'
                                    ? '#FEE2E2'
                                    : '#FEF3C7',
                                color:
                                  p.status === 'CONFIRMED'
                                    ? '#065F46'
                                    : p.status === 'REJECTED'
                                    ? '#991B1B'
                                    : '#92400E',
                              }}
                            >
                              {p.status === 'CONFIRMED'
                                ? `Đã xác nhận (${p.confirmedByName})`
                                : p.status === 'REJECTED'
                                ? 'Đã từ chối'
                                : 'Chờ KT xác nhận'}
                            </span>
                          </td>
                          <td style={{padding: '8px 10px'}}>
                            {canAccountantApprove && p.status === 'PENDING' && (
                              <div style={{display: 'flex', gap: 4}}>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void submitAction('confirm-order-payment', {
                                      paymentId: p.id,
                                      decision: 'CONFIRM',
                                    })
                                  }
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    background: '#059669',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    cursor: 'pointer',
                                  }}
                                >
                                  ✓ Xác nhận
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void submitAction('confirm-order-payment', {
                                      paymentId: p.id,
                                      decision: 'REJECT',
                                    })
                                  }
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    background: '#DC2626',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    cursor: 'pointer',
                                  }}
                                >
                                  ✕ Từ chối
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MỤC 1: NHÀ MÁY → KHO (SO SÁNH SONG SONG PHIẾU XUẤT NHÀ MÁY & PHIẾU NHẬP KHO + THEO DÕI CHÊNH LỆCH) */}
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
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center'}}>
                {[
                  {id: 'COMPARE' as const, label: `🔄 Đối chiếu Song song Xuất NM ↔ Nhập Kho (${dispatchReceiptPairs.length})`},
                  {id: 'VOUCHERS' as const, label: `📋 Toàn bộ Chứng từ NM & Kho (${data.factoryInvoices.length})`},
                  {id: 'STOCK_MOVEMENTS' as const, label: `📦 Lịch sử Biến động Tồn kho (${(data.movementHistory ?? []).length})`},
                ].map(sv => (
                  <button
                    key={sv.id}
                    type="button"
                    onClick={() => setFactorySubView(sv.id)}
                    style={{
                      padding: '5px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      border: '1px solid',
                      borderColor: factorySubView === sv.id ? '#C84B11' : '#CBD5E1',
                      background: factorySubView === sv.id ? '#FFF7ED' : '#FFFFFF',
                      color: factorySubView === sv.id ? '#C84B11' : '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    {sv.label}
                  </button>
                ))}

                <select
                  value={reconcileStatusFilter}
                  onChange={e => setReconcileStatusFilter(e.target.value)}
                  style={{height: 30, padding: '0 8px', border: '1px solid #CBD5E1', fontSize: 12}}
                >
                  <option value="ALL">Mọi trạng thái đối chiếu</option>
                  <option value="PENDING_RECEIPT">1. Chờ kho nhận</option>
                  <option value="MATCHED">2. Đã khớp</option>
                  <option value="DISCREPANCY">3. Có chênh lệch</option>
                  <option value="RESOLVING_DISCREPANCY">4. Đang xử lý chênh lệch</option>
                  <option value="COMPLETED">5. Hoàn tất</option>
                </select>

                <select
                  value={voucherTypeFilter}
                  onChange={e => setVoucherTypeFilter(e.target.value)}
                  style={{height: 30, padding: '0 8px', border: '1px solid #CBD5E1', fontSize: 12}}
                >
                  <option value="ALL">Mọi loại giao dịch</option>
                  <option value="INTERNAL_TRANSFER">Điều chuyển nội bộ (NM → Kho)</option>
                  <option value="SUPPLIER_PURCHASE">Mua hàng từ NCC độc lập</option>
                </select>
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
                    + Lệnh Đặt hàng Nhà máy
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
                    + Nhà máy lập Phiếu xuất đẩy về Kho
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
                    + Thủ kho xác nhận Phiếu nhập kho
                  </button>
                )}
              </div>
            </div>

            {factorySubView === 'COMPARE' && (
              <div style={{padding: 12}}>
                <div style={{fontSize: 12, color: '#475569', marginBottom: 10}}>
                  Quy trình chuẩn:{' '}
                  <strong>
                    Nhà máy lập phiếu xuất hàng (KHÔNG tự động cộng tồn kho) → Kho nhận thông báo → Thủ kho kiểm tra thực tế & xác nhận phiếu nhập → Hệ thống cộng tồn kho theo số lượng thực nhận → Kế toán đối chiếu song song.
                  </strong>
                </div>
                <div style={{overflowX: 'auto', border: '1px solid #CBD5E1'}}>
                  <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12.5}}>
                    <thead>
                      <tr style={{background: '#142338', color: '#FFFFFF', textAlign: 'left'}}>
                        <th colSpan={5} style={{padding: '8px 10px', borderRight: '2px solid #94A3B8', background: '#1E3A8A'}}>
                          🏭 PHIẾU XUẤT NHÀ MÁY (NHÀ MÁY LẬP)
                        </th>
                        <th colSpan={5} style={{padding: '8px 10px', borderRight: '2px solid #94A3B8', background: '#065F46'}}>
                          📦 PHIẾU NHẬP KHO (THỦ KHO XÁC NHẬN THỰC NHẬN)
                        </th>
                        <th colSpan={3} style={{padding: '8px 10px'}}>
                          ⚖️ ĐỐI CHIẾU & XỬ LÝ CHÊNH LỆCH
                        </th>
                      </tr>
                      <tr style={{background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left'}}>
                        <th style={{padding: '6px 8px'}}>Mã phiếu xuất</th>
                        <th style={{padding: '6px 8px'}}>Ngày xuất</th>
                        <th style={{padding: '6px 8px'}}>Kho nhận</th>
                        <th style={{padding: '6px 8px', textAlign: 'right'}}>SL xuất</th>
                        <th style={{padding: '6px 8px', textAlign: 'right', borderRight: '2px solid #CBD5E1'}}>Thành tiền xuất</th>
                        <th style={{padding: '6px 8px'}}>Mã phiếu nhập</th>
                        <th style={{padding: '6px 8px'}}>Ngày nhập</th>
                        <th style={{padding: '6px 8px'}}>Kho thực nhận</th>
                        <th style={{padding: '6px 8px', textAlign: 'right'}}>SL thực nhận</th>
                        <th style={{padding: '6px 8px', textAlign: 'right', borderRight: '2px solid #CBD5E1'}}>Giá trị nhập</th>
                        <th style={{padding: '6px 8px', textAlign: 'right'}}>Chênh lệch SL</th>
                        <th style={{padding: '6px 8px'}}>Trạng thái đối chiếu</th>
                        <th style={{padding: '6px 8px'}}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dispatchReceiptPairs.length === 0 ? (
                        <tr>
                          <td colSpan={13} style={{padding: 24, textAlign: 'center', color: '#64748B'}}>
                            Chưa có cặp Phiếu xuất Nhà máy ↔ Phiếu nhập Kho nào khớp bộ lọc.
                          </td>
                        </tr>
                      ) : (
                        dispatchReceiptPairs.map(({dispatch, receipt}) => {
                          const dispQty = Number(dispatch.totalDispatchedQty || 0);
                          const recQty = receipt ? Number(receipt.totalReceivedQty || 0) : 0;
                          const diffQty = receipt ? recQty - dispQty : 0;
                          const recState = receipt?.reconciliationStatus ?? dispatch.reconciliationStatus ?? 'PENDING_RECEIPT';
                          const rBadge = reconciliationBadge(recState);
                          const isExpanded = expandedFactoryId === dispatch.id;
                          return (
                            <React.Fragment key={dispatch.id}>
                              <tr style={{borderBottom: '1px solid #E2E8F0', background: '#FFFFFF'}}>
                                <td style={{padding: '8px', fontWeight: 700, fontFamily: 'monospace', color: '#1E40AF'}}>
                                  {dispatch.code}
                                  <div style={{fontSize: 10.5, color: '#64748B'}}>
                                    {dispatch.voucherType === 'SUPPLIER_PURCHASE' ? 'Mua NCC độc lập' : 'Điều chuyển nội bộ'}
                                  </div>
                                </td>
                                <td style={{padding: '8px', fontSize: 12}}>{dispatch.dispatchedDate || dt(dispatch.createdAt)}</td>
                                <td style={{padding: '8px', fontWeight: 600}}>{dispatch.warehouseName} ({dispatch.warehouseCode})</td>
                                <td style={{padding: '8px', textAlign: 'right', fontWeight: 800, color: '#1D4ED8'}}>
                                  {dispQty.toLocaleString('vi-VN')} gói
                                </td>
                                <td style={{padding: '8px', textAlign: 'right', fontWeight: 700, borderRight: '2px solid #CBD5E1'}}>
                                  {vnd(dispatch.totalAmount)}
                                </td>

                                <td style={{padding: '8px', fontWeight: 700, fontFamily: 'monospace', color: '#065F46'}}>
                                  {receipt ? receipt.code : '— Chưa lập phiếu nhập'}
                                </td>
                                <td style={{padding: '8px', fontSize: 12}}>
                                  {receipt ? receipt.receivedDate || dt(receipt.createdAt) : '—'}
                                </td>
                                <td style={{padding: '8px', fontWeight: 600}}>
                                  {receipt ? `${receipt.warehouseName} (${receipt.warehouseCode})` : '—'}
                                </td>
                                <td style={{padding: '8px', textAlign: 'right', fontWeight: 800, color: '#047857'}}>
                                  {receipt ? `${recQty.toLocaleString('vi-VN')} gói` : 'Chờ nhận'}
                                </td>
                                <td style={{padding: '8px', textAlign: 'right', fontWeight: 700, borderRight: '2px solid #CBD5E1'}}>
                                  {receipt ? vnd(receipt.totalAmount) : '—'}
                                </td>

                                <td
                                  style={{
                                    padding: '8px',
                                    textAlign: 'right',
                                    fontWeight: 800,
                                    color: !receipt ? '#64748B' : diffQty === 0 ? '#047857' : '#DC2626',
                                  }}
                                >
                                  {!receipt ? '—' : diffQty === 0 ? '0 (Khớp)' : diffQty > 0 ? `+${diffQty}` : `${diffQty}`}
                                </td>
                                <td style={{padding: '8px'}}>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      padding: '3px 8px',
                                      fontSize: 11.5,
                                      fontWeight: 700,
                                      background: rBadge.bg,
                                      color: rBadge.color,
                                    }}
                                  >
                                    {rBadge.label}
                                  </span>
                                </td>
                                <td style={{padding: '8px', whiteSpace: 'nowrap'}}>
                                  <div style={{display: 'flex', gap: 4, flexWrap: 'wrap'}}>
                                    <button
                                      type="button"
                                      onClick={() => setExpandedFactoryId(isExpanded ? null : dispatch.id)}
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: 11.5,
                                        border: '1px solid #CBD5E1',
                                        background: '#FFFFFF',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {isExpanded ? '▲ Ẩn SKU' : '▼ So sánh SKU'}
                                    </button>
                                    {!receipt && canCreateWarehouseReconcile && (
                                      <button
                                        type="button"
                                        onClick={() => openFactoryModal('CREATE_RECONCILIATION', dispatch)}
                                        style={{
                                          padding: '4px 8px',
                                          fontSize: 11.5,
                                          fontWeight: 700,
                                          background: '#059669',
                                          color: '#FFFFFF',
                                          border: 'none',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        + Nhập kho
                                      </button>
                                    )}
                                    {canAccountantApprove && (
                                      <select
                                        value={recState}
                                        disabled={busy}
                                        onChange={e =>
                                          void submitAction('update-reconciliation-status', {
                                            invoiceId: (receipt ?? dispatch).id,
                                            reconciliationStatus: e.target.value,
                                          })
                                        }
                                        style={{height: 26, fontSize: 11, border: '1px solid #CBD5E1'}}
                                      >
                                        <option value="PENDING_RECEIPT">Chờ kho nhận</option>
                                        <option value="MATCHED">Đã khớp</option>
                                        <option value="DISCREPANCY">Có chênh lệch</option>
                                        <option value="RESOLVING_DISCREPANCY">Đang xử lý CL</option>
                                        <option value="COMPLETED">Hoàn tất</option>
                                      </select>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr style={{background: '#F8FAFC', borderBottom: '1px solid #CBD5E1'}}>
                                  <td colSpan={13} style={{padding: 12}}>
                                    <div style={{fontWeight: 700, marginBottom: 6, color: '#142338'}}>
                                      So sánh chi tiết từng SKU giữa Phiếu xuất {dispatch.code} và Phiếu nhập {receipt?.code ?? '(Chưa nhập)'}
                                    </div>
                                    <table style={{width: '100%', borderCollapse: 'collapse', background: '#FFF', border: '1px solid #CBD5E1', fontSize: 12}}>
                                      <thead>
                                        <tr style={{background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left'}}>
                                          <th style={{padding: 6}}>Mã SKU</th>
                                          <th style={{padding: 6}}>Tên sản phẩm</th>
                                          <th style={{padding: 6}}>Quy cách / ĐVT</th>
                                          <th style={{padding: 6, textAlign: 'right'}}>SL Nhà máy xuất</th>
                                          <th style={{padding: 6, textAlign: 'right'}}>Thành tiền xuất</th>
                                          <th style={{padding: 6, textAlign: 'right'}}>SL Kho thực nhận</th>
                                          <th style={{padding: 6, textAlign: 'right'}}>Giá trị nhập</th>
                                          <th style={{padding: 6, textAlign: 'right'}}>Chênh lệch</th>
                                          <th style={{padding: 6, textAlign: 'right'}}>SL Hư hỏng</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {dispatch.lines.map((dl, idx) => {
                                          const rl = receipt?.lines.find(x => x.productId === dl.productId || x.sku === dl.sku);
                                          const dQty = Number(dl.dispatchedQty || 0);
                                          const rQty = rl ? Number(rl.receivedQty || 0) : 0;
                                          const diff = rl ? rQty - dQty : 0;
                                          return (
                                            <tr key={idx} style={{borderBottom: '1px solid #E2E8F0'}}>
                                              <td style={{padding: 6, fontWeight: 700, fontFamily: 'monospace'}}>{dl.sku}</td>
                                              <td style={{padding: 6}}>{dl.name}</td>
                                              <td style={{padding: 6}}>{dl.weightLabel || dl.unitLabel}</td>
                                              <td style={{padding: 6, textAlign: 'right', fontWeight: 700, color: '#1D4ED8'}}>
                                                {dQty.toLocaleString('vi-VN')}
                                              </td>
                                              <td style={{padding: 6, textAlign: 'right'}}>{vnd(dl.lineTotal)}</td>
                                              <td style={{padding: 6, textAlign: 'right', fontWeight: 700, color: '#047857'}}>
                                                {rl ? rQty.toLocaleString('vi-VN') : 'Chờ nhận'}
                                              </td>
                                              <td style={{padding: 6, textAlign: 'right'}}>
                                                {rl ? vnd(rl.receivedTotal || rl.lineTotal) : '—'}
                                              </td>
                                              <td style={{padding: 6, textAlign: 'right', fontWeight: 800, color: diff === 0 ? '#047857' : '#DC2626'}}>
                                                {rl ? diff : '—'}
                                              </td>
                                              <td style={{padding: 6, textAlign: 'right', color: '#B45309'}}>
                                                {rl ? Number(rl.damagedQty ?? 0) : 0}
                                              </td>
                                            </tr>
                                          );
                                        })}
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

            {factorySubView === 'STOCK_MOVEMENTS' && (
              <div style={{padding: 12}}>
                <div style={{fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#142338'}}>
                  Lịch sử biến động tồn kho Hà Nội (KHO-HN) & TP.HCM (KHO-HCM) theo từng chứng từ nhập/xuất
                </div>
                <div style={{overflowX: 'auto', border: '1px solid #CBD5E1'}}>
                  <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12.5}}>
                    <thead>
                      <tr style={{background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left'}}>
                        <th style={{padding: '8px 10px'}}>Thời gian</th>
                        <th style={{padding: '8px 10px'}}>Mã chứng từ</th>
                        <th style={{padding: '8px 10px'}}>Loại nghiệp vụ</th>
                        <th style={{padding: '8px 10px'}}>Kho</th>
                        <th style={{padding: '8px 10px'}}>Mã SKU / Sản phẩm</th>
                        <th style={{padding: '8px 10px', textAlign: 'right'}}>Biến động SL</th>
                        <th style={{padding: '8px 10px', textAlign: 'right'}}>Giá trị</th>
                        <th style={{padding: '8px 10px'}}>Người thực hiện</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.movementHistory ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{padding: 24, textAlign: 'center', color: '#64748B'}}>
                            Chưa có lịch sử biến động tồn kho.
                          </td>
                        </tr>
                      ) : (
                        (data.movementHistory ?? []).map(m => (
                          <tr key={m.id} style={{borderBottom: '1px solid #E2E8F0'}}>
                            <td style={{padding: '8px 10px', fontSize: 12}}>{dt(m.createdAt)}</td>
                            <td style={{padding: '8px 10px', fontWeight: 700, fontFamily: 'monospace'}}>{m.documentCode}</td>
                            <td style={{padding: '8px 10px'}}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  background: m.documentKind === 'FACTORY_RECEIPT' ? '#D1FAE5' : '#FEE2E2',
                                  color: m.documentKind === 'FACTORY_RECEIPT' ? '#065F46' : '#991B1B',
                                }}
                              >
                                {m.documentKind === 'FACTORY_RECEIPT' ? 'Nhập kho từ Nhà máy' : 'Xuất kho giao Khách'}
                              </span>
                            </td>
                            <td style={{padding: '8px 10px', fontWeight: 600}}>{m.warehouseName} ({m.warehouseCode})</td>
                            <td style={{padding: '8px 10px'}}>{m.sku} — {m.productName}</td>
                            <td
                              style={{
                                padding: '8px 10px',
                                textAlign: 'right',
                                fontWeight: 800,
                                color: m.quantityDelta.startsWith('+') ? '#047857' : '#DC2626',
                              }}
                            >
                              {m.quantityDelta} {m.unitLabel}
                            </td>
                            <td style={{padding: '8px 10px', textAlign: 'right', fontWeight: 700}}>{vnd(m.totalAmount)}</td>
                            <td style={{padding: '8px 10px'}}>{m.actorName}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {factorySubView === 'VOUCHERS' && (
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
            )}
          </div>
        )}

        {/* MỤC 3: HÓA ĐƠN VAT & HỒ SƠ PHÁP LÝ KHÁCH HÀNG */}
        {tab === 'vat' && (
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
                  {id: 'INVOICES' as const, label: `🧾 Danh sách Hóa đơn VAT (${filteredVatInvoices.length})`},
                  {id: 'UNINVOICED' as const, label: `⏳ Đơn hàng chờ xuất Hóa đơn VAT (${uninvoicedOrders.length})`},
                  {id: 'TAX_PROFILES' as const, label: `🏛️ Hồ sơ Pháp lý & MST Khách hàng (${filteredTaxProfiles.length})`},
                ].map(sv => (
                  <button
                    key={sv.id}
                    type="button"
                    onClick={() => setVatSubView(sv.id)}
                    style={{
                      padding: '5px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      border: '1px solid',
                      borderColor: vatSubView === sv.id ? '#C84B11' : '#CBD5E1',
                      background: vatSubView === sv.id ? '#FFF7ED' : '#FFFFFF',
                      color: vatSubView === sv.id ? '#C84B11' : '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    {sv.label}
                  </button>
                ))}
              </div>
              <div style={{fontSize: 12, color: '#475569'}}>
                Lưu ý: Hóa đơn VAT lấy dữ liệu trực tiếp từ đơn hàng đã khóa giá, độc lập với trạng thái thanh toán (có thể phát hành cho đơn mua trả chậm/công nợ). Chỉ ghi nhận <strong>&ldquo;Đã phát hành&rdquo;</strong> khi có đủ Số HĐ, Ngày phát hành và file PDF/XML.
              </div>
            </div>

            {vatSubView === 'INVOICES' && (
              <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12.5}}>
                  <thead>
                    <tr style={{background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left'}}>
                      <th style={{padding: '8px 10px'}}>Số HĐ / Ký hiệu</th>
                      <th style={{padding: '8px 10px'}}>Ngày phát hành</th>
                      <th style={{padding: '8px 10px'}}>Mã đơn / Phiếu xuất</th>
                      <th style={{padding: '8px 10px'}}>Khách hàng & Mã số thuế</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Tiền trước thuế</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Tiền thuế VAT</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Tổng thanh toán</th>
                      <th style={{padding: '8px 10px'}}>Trạng thái Hóa đơn</th>
                      <th style={{padding: '8px 10px'}}>Tài liệu PDF / XML</th>
                      <th style={{padding: '8px 10px'}}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVatInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{padding: 24, textAlign: 'center', color: '#64748B'}}>
                          Chưa có hóa đơn VAT nào. Chuyển sang mục &ldquo;Đơn hàng chờ xuất Hóa đơn VAT&rdquo; để lập hóa đơn từ đơn hàng.
                        </td>
                      </tr>
                    ) : (
                      filteredVatInvoices.map(v => {
                        const vb = vatBadge(v.status);
                        const linkedOrder = data.orderClearances.find(c => c.id === v.clearanceId);
                        return (
                          <tr key={v.id} style={{borderBottom: '1px solid #E2E8F0'}}>
                            <td style={{padding: '8px 10px', fontWeight: 800, fontFamily: 'monospace'}}>
                              {v.invoiceNumber || '(Chưa cấp số)'}
                              <div style={{fontSize: 11, color: '#64748B'}}>
                                KH: {v.invoiceSymbol || '—'} · {v.invoiceType}
                              </div>
                            </td>
                            <td style={{padding: '8px 10px'}}>{v.issuedDate || '—'}</td>
                            <td style={{padding: '8px 10px'}}>
                              <div style={{fontWeight: 700, color: '#2563EB'}}>{v.orderCode}</div>
                              {v.handoverCode && (
                                <div style={{fontSize: 11, color: '#047857'}}>PXK: {v.handoverCode}</div>
                              )}
                            </td>
                            <td style={{padding: '8px 10px'}}>
                              <div style={{fontWeight: 700}}>{v.buyerName || v.organizationName}</div>
                              <div style={{fontSize: 11, color: '#475569'}}>MST: {v.buyerTaxCode || 'Chưa có'}</div>
                            </td>
                            <td style={{padding: '8px 10px', textAlign: 'right', fontWeight: 600}}>{vnd(v.netAmount)}</td>
                            <td style={{padding: '8px 10px', textAlign: 'right', color: '#B45309'}}>{vnd(v.vatAmount)}</td>
                            <td style={{padding: '8px 10px', textAlign: 'right', fontWeight: 800}}>{vnd(v.totalAmount)}</td>
                            <td style={{padding: '8px 10px'}}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  background: vb.bg,
                                  color: vb.color,
                                }}
                              >
                                {vb.label}
                              </span>
                            </td>
                            <td style={{padding: '8px 10px', fontSize: 11.5}}>
                              {v.pdfVersionId ? (
                                <a
                                  href={`/api/crm/documents/${v.pdfVersionId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{color: '#2563EB', fontWeight: 700, marginRight: 8}}
                                >
                                  📄 PDF ({v.pdfFilename})
                                </a>
                              ) : (
                                <span style={{color: '#DC2626', marginRight: 8}}>Thiếu PDF</span>
                              )}
                              {v.xmlVersionId ? (
                                <a
                                  href={`/api/crm/documents/${v.xmlVersionId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{color: '#059669', fontWeight: 700}}
                                >
                                  🧾 XML ({v.xmlFilename})
                                </a>
                              ) : (
                                <span style={{color: '#DC2626'}}>Thiếu XML</span>
                              )}
                            </td>
                            <td style={{padding: '8px 10px'}}>
                              <button
                                type="button"
                                onClick={() => openVatModal(linkedOrder, v)}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  border: '1px solid #C84B11',
                                  background: '#FFF7ED',
                                  color: '#C84B11',
                                  cursor: 'pointer',
                                }}
                              >
                                ✏️ Cập nhật / Upload PDF-XML
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {vatSubView === 'UNINVOICED' && (
              <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12.5}}>
                  <thead>
                    <tr style={{background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left'}}>
                      <th style={{padding: '8px 10px'}}>Mã đơn hàng</th>
                      <th style={{padding: '8px 10px'}}>Khách hàng / Đối tác</th>
                      <th style={{padding: '8px 10px'}}>Kho xuất</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Tiền sau chiết khấu</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Thuế VAT dự kiến</th>
                      <th style={{padding: '8px 10px', textAlign: 'right'}}>Tổng cộng</th>
                      <th style={{padding: '8px 10px'}}>Trạng thái hiện tại</th>
                      <th style={{padding: '8px 10px'}}>Thao tác Kế toán</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uninvoicedOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{padding: 24, textAlign: 'center', color: '#64748B'}}>
                          Tất cả đơn hàng đều đã phát hành đủ Hóa đơn VAT.
                        </td>
                      </tr>
                    ) : (
                      uninvoicedOrders.map(c => {
                        const vb = vatBadge(c.vatInvoiceStatus);
                        const existing = (data.vatInvoices ?? []).find(v => v.clearanceId === c.id);
                        return (
                          <tr key={c.id} style={{borderBottom: '1px solid #E2E8F0'}}>
                            <td style={{padding: '8px 10px', fontWeight: 700}}>{c.documentCode}</td>
                            <td style={{padding: '8px 10px', fontWeight: 600}}>{c.organizationName}</td>
                            <td style={{padding: '8px 10px'}}>{c.warehouseName || '—'}</td>
                            <td style={{padding: '8px 10px', textAlign: 'right', fontWeight: 700}}>{vnd(c.netTotal)}</td>
                            <td style={{padding: '8px 10px', textAlign: 'right'}}>{vnd(c.vatAmount || 0)}</td>
                            <td style={{padding: '8px 10px', textAlign: 'right', fontWeight: 800}}>
                              {vnd(c.grossTotal || c.netTotal)}
                            </td>
                            <td style={{padding: '8px 10px'}}>
                              <span style={{padding: '3px 8px', fontSize: 11.5, fontWeight: 700, background: vb.bg, color: vb.color}}>
                                {vb.label}
                              </span>
                            </td>
                            <td style={{padding: '8px 10px'}}>
                              <button
                                type="button"
                                onClick={() => openVatModal(c, existing)}
                                style={{
                                  padding: '5px 10px',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  background: '#C84B11',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  cursor: 'pointer',
                                }}
                              >
                                + Chuẩn bị & Ghi nhận Hóa đơn VAT
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {vatSubView === 'TAX_PROFILES' && (
              <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12.5}}>
                  <thead>
                    <tr style={{background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left'}}>
                      <th style={{padding: '8px 10px'}}>Mã KH / ĐL</th>
                      <th style={{padding: '8px 10px'}}>Tên Pháp lý xuất Hóa đơn</th>
                      <th style={{padding: '8px 10px'}}>Loại</th>
                      <th style={{padding: '8px 10px'}}>Mã số thuế</th>
                      <th style={{padding: '8px 10px'}}>Địa chỉ xuất HĐ & Email nhận HĐ</th>
                      <th style={{padding: '8px 10px'}}>Mã Hợp đồng</th>
                      <th style={{padding: '8px 10px'}}>Hồ sơ pháp lý đính kèm</th>
                      <th style={{padding: '8px 10px'}}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTaxProfiles.map(tp => (
                      <tr key={tp.organizationId} style={{borderBottom: '1px solid #E2E8F0'}}>
                        <td style={{padding: '8px 10px', fontWeight: 700, fontFamily: 'monospace'}}>
                          {tp.organizationCode}
                        </td>
                        <td style={{padding: '8px 10px', fontWeight: 700}}>{tp.legalName}</td>
                        <td style={{padding: '8px 10px'}}>
                          {tp.buyerType === 'INDIVIDUAL' ? 'Cá nhân' : 'Doanh nghiệp'}
                        </td>
                        <td style={{padding: '8px 10px', fontWeight: 700, color: '#1E40AF'}}>
                          {tp.taxCode || 'Chưa cập nhật'}
                        </td>
                        <td style={{padding: '8px 10px', fontSize: 12}}>
                          <div>{tp.invoiceAddress || '—'}</div>
                          <div style={{color: '#64748B'}}>{tp.invoiceEmail || '—'}</div>
                        </td>
                        <td style={{padding: '8px 10px', fontWeight: 600}}>{tp.contractCode || '—'}</td>
                        <td style={{padding: '8px 10px', fontSize: 11.5}}>
                          {tp.documents.length === 0 ? (
                            <span style={{color: '#64748B'}}>Chưa có tài liệu</span>
                          ) : (
                            tp.documents.map(d => (
                              <a
                                key={d.versionId}
                                href={`/api/crm/documents/${d.versionId}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{display: 'block', color: '#2563EB', fontWeight: 600}}
                              >
                                📎 {d.title} ({d.filename})
                              </a>
                            ))
                          )}
                        </td>
                        <td style={{padding: '8px 10px'}}>
                          <button
                            type="button"
                            onClick={() => openTaxProfileModal(tp)}
                            style={{
                              padding: '4px 8px',
                              fontSize: 11.5,
                              fontWeight: 700,
                              border: '1px solid #CBD5E1',
                              background: '#FFFFFF',
                              cursor: 'pointer',
                            }}
                          >
                            ✏️ Cập nhật MST & Tài liệu pháp lý
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: 10}}>
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
                    <span style={{fontWeight: 700}}>Loại chứng từ (Điều chuyển / Mua NCC):</span>
                    <select
                      value={factoryVoucherType}
                      onChange={e =>
                        setFactoryVoucherType(
                          e.target.value as 'INTERNAL_TRANSFER' | 'SUPPLIER_PURCHASE'
                        )
                      }
                      style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8', fontWeight: 700}}
                    >
                      <option value="INTERNAL_TRANSFER">Điều chuyển nội bộ (Phiếu xuất kho kiêm vận chuyển nội bộ)</option>
                      <option value="SUPPLIER_PURCHASE">Mua từ Nhà cung cấp độc lập (Hóa đơn GTGT đầu vào)</option>
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
                        voucherType: factoryVoucherType,
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

      {/* ================================================================= */}
      {/* MODAL 3: PREVIEW WAREHOUSE HANDOVER / ISSUE VOUCHER               */}
      {/* ================================================================= */}
      {previewHandover && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #142338',
              maxWidth: 980,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                <div style={{fontSize: 11, fontWeight: 800, color: '#C84B11', textTransform: 'uppercase'}}>
                  CHI TIẾT PHIẾU XUẤT KHO GIAO KHÁCH HÀNG / ĐỐI TÁC
                </div>
                <h3 style={{margin: '2px 0 0', fontSize: 17, fontWeight: 800, color: '#142338'}}>
                  {previewHandover.code} · Đơn hàng: {previewHandover.orderCode}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewHandover(null)}
                style={{
                  padding: '5px 12px',
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ✕ Đóng
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: 8,
                background: '#F8FAFC',
                padding: 12,
                border: '1px solid #CBD5E1',
                fontSize: 12,
              }}
            >
              <div>
                <div style={{color: '#64748B', fontSize: 11}}>Kho xuất hàng</div>
                <div style={{fontWeight: 800, color: '#142338'}}>
                  {previewHandover.warehouseName} ({previewHandover.warehouseCode})
                </div>
              </div>
              <div>
                <div style={{color: '#64748B', fontSize: 11}}>Khách hàng / Đối tác</div>
                <div style={{fontWeight: 800, color: '#142338'}}>{previewHandover.organizationName}</div>
              </div>
              <div>
                <div style={{color: '#64748B', fontSize: 11}}>Thủ kho xuất / Người nhận</div>
                <div style={{fontWeight: 700}}>
                  {previewHandover.createdByName || 'Thủ kho'} → {previewHandover.recipientName || 'NV Giao hàng'}
                </div>
              </div>
              <div>
                <div style={{color: '#64748B', fontSize: 11}}>Thời gian xác nhận xuất</div>
                <div style={{fontWeight: 700}}>{dt(previewHandover.issuedDate || previewHandover.createdAt)}</div>
              </div>
            </div>

            <div style={{overflowX: 'auto', border: '1px solid #CBD5E1'}}>
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12}}>
                <thead>
                  <tr style={{background: '#142338', color: '#FFFFFF', textAlign: 'left'}}>
                    <th style={{padding: 8}}>Mã SKU</th>
                    <th style={{padding: 8}}>Sản phẩm / Quy cách</th>
                    <th style={{padding: 8, textAlign: 'right'}}>SL Đặt</th>
                    <th style={{padding: 8, textAlign: 'right'}}>SL Xuất</th>
                    <th style={{padding: 8, textAlign: 'right'}}>Còn lại</th>
                    <th style={{padding: 8, textAlign: 'right'}}>Đơn giá gốc</th>
                    <th style={{padding: 8, textAlign: 'right'}}>CK (%)</th>
                    <th style={{padding: 8, textAlign: 'right'}}>Đơn giá sau CK</th>
                    <th style={{padding: 8, textAlign: 'right'}}>VAT</th>
                    <th style={{padding: 8, textAlign: 'right'}}>Tổng cộng</th>
                  </tr>
                </thead>
                <tbody>
                  {previewHandover.lines.map((line, i) => (
                    <tr key={i} style={{borderBottom: '1px solid #E2E8F0'}}>
                      <td style={{padding: 8, fontWeight: 800, color: '#142338'}}>{line.sku}</td>
                      <td style={{padding: 8}}>
                        <div style={{fontWeight: 700}}>{line.name}</div>
                        <div style={{fontSize: 11, color: '#64748B'}}>
                          {line.weightLabel || '—'} · ĐVT: {line.unitLabel}
                        </div>
                      </td>
                      <td style={{padding: 8, textAlign: 'right'}}>
                        {Number(line.orderedQuantity ?? line.quantity).toLocaleString('vi-VN')}
                      </td>
                      <td style={{padding: 8, textAlign: 'right', fontWeight: 800, color: '#047857'}}>
                        {Number(line.quantity).toLocaleString('vi-VN')}
                      </td>
                      <td style={{padding: 8, textAlign: 'right', color: '#64748B'}}>
                        {Number(line.remainingQuantity ?? 0).toLocaleString('vi-VN')}
                      </td>
                      <td style={{padding: 8, textAlign: 'right'}}>{vnd(line.listUnitPrice ?? line.unitPrice)}</td>
                      <td style={{padding: 8, textAlign: 'right', color: '#B45309', fontWeight: 700}}>
                        {Number(line.discountPercent ?? 0) > 0 ? `-${line.discountPercent}%` : '0%'}
                      </td>
                      <td style={{padding: 8, textAlign: 'right', fontWeight: 700}}>{vnd(line.unitPrice)}</td>
                      <td style={{padding: 8, textAlign: 'right'}}>
                        {line.vatRate ?? 8}% ({vnd(line.vatAmount ?? 0)})
                      </td>
                      <td style={{padding: 8, textAlign: 'right', fontWeight: 800, color: '#142338'}}>
                        {vnd(line.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 8,
                background: '#FFFDF9',
                border: '1px solid #FDE68A',
                padding: 12,
                fontSize: 12,
              }}
            >
              <div>
                <div style={{fontSize: 11, color: '#64748B'}}>Tổng tiền hàng niêm yết</div>
                <div style={{fontWeight: 800, fontSize: 14}}>
                  {vnd(previewHandover.listSubtotal || previewHandover.totalAmount)}
                </div>
              </div>
              <div>
                <div style={{fontSize: 11, color: '#64748B'}}>Tổng chiết khấu</div>
                <div style={{fontWeight: 800, fontSize: 14, color: '#B45309'}}>
                  -{vnd(previewHandover.discountAmount || 0)}
                </div>
              </div>
              <div>
                <div style={{fontSize: 11, color: '#64748B'}}>Tổng tiền trước thuế</div>
                <div style={{fontWeight: 800, fontSize: 14}}>
                  {vnd(previewHandover.netSubtotal || previewHandover.totalAmount)}
                </div>
              </div>
              <div>
                <div style={{fontSize: 11, color: '#64748B'}}>Tổng thuế GTGT (VAT)</div>
                <div style={{fontWeight: 800, fontSize: 14, color: '#1D4ED8'}}>
                  +{vnd(previewHandover.vatAmount || 0)}
                </div>
              </div>
              <div>
                <div style={{fontSize: 11, color: '#64748B'}}>Tổng phải thu (Sau thuế)</div>
                <div style={{fontWeight: 800, fontSize: 15, color: '#C84B11'}}>
                  {vnd(previewHandover.totalAmount)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 4: MULTI-PAYMENT RECONCILIATION MODAL                       */}
      {/* ================================================================= */}
      {paymentModalOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #142338',
              maxWidth: 680,
              width: '100%',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                <div style={{fontSize: 11, fontWeight: 800, color: '#059669', textTransform: 'uppercase'}}>
                  GHI NHẬN & ĐỐI CHIẾU GIAO DỊCH THANH TOÁN ĐƠN HÀNG
                </div>
                <h3 style={{margin: '2px 0 0', fontSize: 16, fontWeight: 800, color: '#142338'}}>
                  Đơn hàng {paymentModalOrder.documentCode} — {paymentModalOrder.organizationName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOrder(null)}
                style={{
                  padding: '5px 12px',
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ✕ Đóng
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 8,
                background: '#F8FAFC',
                padding: 10,
                border: '1px solid #CBD5E1',
                fontSize: 12,
              }}
            >
              <div>
                <div style={{color: '#64748B', fontSize: 11}}>Tổng phải thu</div>
                <div style={{fontWeight: 800, fontSize: 14, color: '#142338'}}>
                  {vnd(
                    Number(paymentModalOrder.grossTotal || 0) > 0
                      ? paymentModalOrder.grossTotal
                      : paymentModalOrder.netTotal
                  )}
                </div>
              </div>
              <div>
                <div style={{color: '#64748B', fontSize: 11}}>Đã thanh toán</div>
                <div style={{fontWeight: 800, fontSize: 14, color: '#047857'}}>
                  {vnd(paymentModalOrder.paidAmount || paymentModalOrder.staffSubmittedAmount)}
                </div>
              </div>
              <div>
                <div style={{color: '#64748B', fontSize: 11}}>Công nợ còn lại</div>
                <div style={{fontWeight: 800, fontSize: 14, color: '#B91C1C'}}>
                  {vnd(paymentModalOrder.remainingDebt || 0)}
                </div>
              </div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>Số tiền thanh toán đợt này (VND):</span>
                <input
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8', fontWeight: 800}}
                />
              </label>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>Hình thức thanh toán:</span>
                <select
                  value={payMethod}
                  onChange={e =>
                    setPayMethod(e.target.value as 'BANK_TRANSFER' | 'CASH' | 'COMBINED')
                  }
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8', fontWeight: 700}}
                >
                  <option value="BANK_TRANSFER">Chuyển khoản ngân hàng</option>
                  <option value="CASH">Tiền mặt</option>
                  <option value="COMBINED">Kết hợp</option>
                </select>
              </label>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>Tài khoản nhận tiền:</span>
                <input
                  type="text"
                  value={payBankAccount}
                  onChange={e => setPayBankAccount(e.target.value)}
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8'}}
                />
              </label>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>Mã giao dịch ngân hàng (Ref):</span>
                <input
                  type="text"
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8'}}
                />
              </label>
            </div>

            <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
              <span style={{fontWeight: 700}}>Nội dung chuyển khoản / Ghi chú đối soát:</span>
              <input
                type="text"
                value={payTransferContent}
                onChange={e => setPayTransferContent(e.target.value)}
                style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8'}}
              />
            </label>

            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4}}>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const ok = await submitAction('record-order-payment', {
                    clearanceId: paymentModalOrder.id,
                    orderId: paymentModalOrder.orderId,
                    requestId: paymentModalOrder.requestId,
                    amount: Number(payAmount || 0),
                    paymentMethod: payMethod,
                    bankAccount: payBankAccount,
                    referenceCode: payRef,
                    transferContent: payTransferContent,
                    autoConfirm: canAccountantApprove,
                  });
                  if (ok) setPaymentModalOrder(null);
                }}
                style={{
                  padding: '8px 16px',
                  background: '#059669',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {busy
                  ? 'Đang lưu giao dịch...'
                  : canAccountantApprove
                  ? '✅ Ghi nhận & Xác nhận Đã thu tiền'
                  : '💵 Gửi thông tin thanh toán cho Kế toán'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 5: VAT INVOICE PREPARATION, STORAGE & ADJUSTMENT MODAL      */}
      {/* ================================================================= */}
      {vatModalTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #142338',
              maxWidth: 820,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                <div style={{fontSize: 11, fontWeight: 800, color: '#C84B11', textTransform: 'uppercase'}}>
                  CHUẨN BỊ DỮ LIỆU, GHI NHẬN & LƯU TRỮ HÓA ĐƠN VAT (GTGT)
                </div>
                <h3 style={{margin: '2px 0 0', fontSize: 16, fontWeight: 800, color: '#142338'}}>
                  Đơn hàng:{' '}
                  {vatModalTarget.clearance?.documentCode ||
                    vatModalTarget.existingVat?.orderCode ||
                    '—'}{' '}
                  · Khách hàng:{' '}
                  {vatModalTarget.clearance?.organizationName ||
                    vatModalTarget.existingVat?.buyerName ||
                    vatModalTarget.existingVat?.organizationName ||
                    '—'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVatModalTarget(null)}
                style={{
                  padding: '5px 12px',
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ✕ Đóng
              </button>
            </div>

            <div
              style={{
                padding: 10,
                background: '#EFF6FF',
                border: '1px solid #93C5FD',
                fontSize: 12,
                color: '#1E3A8A',
              }}
            >
              <strong>Lưu ý pháp lý:</strong> Hệ thống tự động lấy dữ liệu sản phẩm, số lượng, đơn giá,
              chiết khấu và thuế VAT từ đơn hàng đã khóa (không phải nhập lại thủ công). Hóa đơn chỉ được
              xác nhận trạng thái <strong>Đã phát hành</strong> khi Kế toán nhập đầy đủ{' '}
              <strong>Số hóa đơn + Ký hiệu + Ngày phát hành</strong> và đính kèm file{' '}
              <strong>PDF/XML</strong> từ nhà cung cấp hóa đơn điện tử.
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10}}>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>Số hóa đơn VAT:</span>
                <input
                  type="text"
                  placeholder="VD: 00001258"
                  value={vatNumber}
                  onChange={e => setVatNumber(e.target.value)}
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8', fontWeight: 800}}
                />
              </label>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>Ký hiệu hóa đơn:</span>
                <input
                  type="text"
                  placeholder="VD: 1C26TAA"
                  value={vatSymbol}
                  onChange={e => setVatSymbol(e.target.value)}
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8', fontWeight: 700}}
                />
              </label>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>Ngày phát hành:</span>
                <input
                  type="date"
                  value={vatIssuedDate}
                  onChange={e => setVatIssuedDate(e.target.value)}
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8'}}
                />
              </label>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>Loại hóa đơn:</span>
                <select
                  value={vatType}
                  onChange={e =>
                    setVatType(e.target.value as 'ORIGINAL' | 'ADJUSTMENT' | 'REPLACEMENT')
                  }
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8', fontWeight: 700}}
                >
                  <option value="ORIGINAL">Hóa đơn gốc</option>
                  <option value="ADJUSTMENT">Hóa đơn điều chỉnh</option>
                  <option value="REPLACEMENT">Hóa đơn thay thế</option>
                </select>
              </label>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>Tên đơn vị / Người mua trên HĐ:</span>
                <input
                  type="text"
                  value={vatBuyerName}
                  onChange={e => setVatBuyerName(e.target.value)}
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8', fontWeight: 700}}
                />
              </label>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>Mã số thuế / CCCD:</span>
                <input
                  type="text"
                  value={vatBuyerTaxCode}
                  onChange={e => setVatBuyerTaxCode(e.target.value)}
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8', fontWeight: 700}}
                />
              </label>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>Địa chỉ xuất hóa đơn:</span>
                <input
                  type="text"
                  value={vatBuyerAddress}
                  onChange={e => setVatBuyerAddress(e.target.value)}
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8'}}
                />
              </label>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>Email nhận hóa đơn điện tử:</span>
                <input
                  type="email"
                  value={vatBuyerEmail}
                  onChange={e => setVatBuyerEmail(e.target.value)}
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8'}}
                />
              </label>
            </div>

            {/* Upload PDF & XML */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                background: '#F8FAFC',
                padding: 12,
                border: '1px solid #CBD5E1',
              }}
            >
              <div>
                <div style={{fontSize: 12, fontWeight: 800, color: '#142338', marginBottom: 4}}>
                  📄 File Hóa đơn bản thể hiện (PDF):
                </div>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const entityId =
                      vatModalTarget.existingVat?.id ||
                      vatModalTarget.clearance?.orderId ||
                      vatModalTarget.clearance?.id ||
                      'vat-draft';
                    const uploaded = await uploadDocumentFile(
                      'vat-invoice',
                      entityId,
                      `Hóa đơn VAT PDF ${vatNumber || ''}`.trim(),
                      'VAT_INVOICE_PDF',
                      file
                    );
                    if (uploaded) {
                      setVatPdfDocId(uploaded.id);
                      setVatPdfFilename(uploaded.filename);
                    }
                  }}
                  style={{fontSize: 11.5}}
                />
                {vatPdfFilename && (
                  <div style={{fontSize: 11.5, color: '#047857', fontWeight: 700, marginTop: 4}}>
                    ✓ Đã đính kèm: {vatPdfFilename}
                  </div>
                )}
              </div>

              <div>
                <div style={{fontSize: 12, fontWeight: 800, color: '#142338', marginBottom: 4}}>
                  🧾 File Dữ liệu gốc Hóa đơn điện tử (XML):
                </div>
                <input
                  type="file"
                  accept=".xml,application/xml,text/xml"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const entityId =
                      vatModalTarget.existingVat?.id ||
                      vatModalTarget.clearance?.orderId ||
                      vatModalTarget.clearance?.id ||
                      'vat-draft';
                    const uploaded = await uploadDocumentFile(
                      'vat-invoice',
                      entityId,
                      `Hóa đơn VAT XML ${vatNumber || ''}`.trim(),
                      'VAT_INVOICE_XML',
                      file
                    );
                    if (uploaded) {
                      setVatXmlDocId(uploaded.id);
                      setVatXmlFilename(uploaded.filename);
                    }
                  }}
                  style={{fontSize: 11.5}}
                />
                {vatXmlFilename && (
                  <div style={{fontSize: 11.5, color: '#047857', fontWeight: 700, marginTop: 4}}>
                    ✓ Đã đính kèm: {vatXmlFilename}
                  </div>
                )}
              </div>
            </div>

            {(vatType !== 'ORIGINAL' || vatModalTarget.existingVat) && (
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>Lý do điều chỉnh / thay thế hóa đơn (nếu có):</span>
                <input
                  type="text"
                  value={vatAdjustmentReason}
                  placeholder="Nhập lý do biên bản điều chỉnh / thay thế hóa đơn..."
                  onChange={e => setVatAdjustmentReason(e.target.value)}
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8'}}
                />
              </label>
            )}

            <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
              <span style={{fontWeight: 700}}>Ghi chú kế toán thuế:</span>
              <input
                type="text"
                value={vatNote}
                onChange={e => setVatNote(e.target.value)}
                style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8'}}
              />
            </label>

            <div style={{display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4}}>
              {vatModalTarget.existingVat ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    const ok = await submitAction('request-vat-adjustment', {
                      vatInvoiceId: vatModalTarget.existingVat!.id,
                      reason: vatAdjustmentReason || 'Yêu cầu kiểm tra điều chỉnh thông tin hóa đơn VAT',
                    });
                    if (ok) setVatModalTarget(null);
                  }}
                  style={{
                    padding: '8px 14px',
                    background: '#FFFBEB',
                    color: '#B45309',
                    border: '1px solid #F59E0B',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ⚠️ Đánh dấu Cần điều chỉnh / Thay thế
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const ok = await submitAction('save-vat-invoice', {
                    vatInvoiceId: vatModalTarget.existingVat?.id,
                    clearanceId: vatModalTarget.clearance?.id,
                    orderId:
                      vatModalTarget.clearance?.orderId || vatModalTarget.existingVat?.orderId,
                    requestId:
                      vatModalTarget.clearance?.requestId || vatModalTarget.existingVat?.requestId,
                    invoiceNumber: vatNumber,
                    invoiceSymbol: vatSymbol,
                    issuedDate: vatIssuedDate,
                    invoiceType: vatType,
                    buyerName: vatBuyerName,
                    buyerLegalName: vatBuyerName,
                    buyerTaxCode: vatBuyerTaxCode,
                    buyerAddress: vatBuyerAddress,
                    buyerEmail: vatBuyerEmail,
                    adjustmentReason: vatAdjustmentReason,
                    note: vatNote,
                    pdfDocumentId: vatPdfDocId,
                    pdfFilename: vatPdfFilename,
                    xmlDocumentId: vatXmlDocId,
                    xmlFilename: vatXmlFilename,
                  });
                  if (ok) setVatModalTarget(null);
                }}
                style={{
                  padding: '8px 18px',
                  background: '#C84B11',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {busy ? 'Đang lưu hóa đơn VAT...' : '💾 Lưu thông tin & Chứng từ Hóa đơn VAT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 6: CUSTOMER LEGAL & TAX PROFILE MODAL                       */}
      {/* ================================================================= */}
      {editingTaxProfile && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #142338',
              maxWidth: 720,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                <div style={{fontSize: 11, fontWeight: 800, color: '#142338', textTransform: 'uppercase'}}>
                  HỒ SƠ PHÁP LÝ, MÃ SỐ THUẾ & TÀI LIỆU KHÁCH HÀNG / ĐỐI TÁC
                </div>
                <h3 style={{margin: '2px 0 0', fontSize: 16, fontWeight: 800, color: '#142338'}}>
                  {editingTaxProfile.legalName || editingTaxProfile.organizationName || 'Thêm mới Hồ sơ Pháp lý & Thuế'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTaxProfile(null)}
                style={{
                  padding: '5px 12px',
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ✕ Đóng
              </button>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10}}>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>Phân loại đối tượng:</span>
                <select
                  value={taxBuyerType}
                  onChange={e => setTaxBuyerType(e.target.value as 'COMPANY' | 'INDIVIDUAL')}
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8', fontWeight: 700}}
                >
                  <option value="COMPANY">Doanh nghiệp / Công ty / Siêu thị</option>
                  <option value="INDIVIDUAL">Khách hàng Cá nhân / Hộ kinh doanh</option>
                </select>
              </label>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>
                  {taxBuyerType === 'COMPANY'
                    ? 'Tên pháp lý công ty trên GPKD:'
                    : 'Họ và tên khách hàng cá nhân:'}
                </span>
                <input
                  type="text"
                  value={taxLegalName}
                  onChange={e => setTaxLegalName(e.target.value)}
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8', fontWeight: 700}}
                />
              </label>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>Mã số thuế (MST):</span>
                <input
                  type="text"
                  value={taxCodeInput}
                  onChange={e => setTaxCodeInput(e.target.value)}
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8', fontWeight: 700}}
                />
              </label>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>
                  {taxBuyerType === 'COMPANY' ? 'Người đại diện pháp luật:' : 'Số CCCD / Định danh cá nhân:'}
                </span>
                <input
                  type="text"
                  value={taxBuyerType === 'COMPANY' ? taxRepInput : taxPersonalIdInput}
                  onChange={e =>
                    taxBuyerType === 'COMPANY'
                      ? setTaxRepInput(e.target.value)
                      : setTaxPersonalIdInput(e.target.value)
                  }
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8'}}
                />
              </label>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>Địa chỉ xuất hóa đơn VAT:</span>
                <input
                  type="text"
                  value={taxAddressInput}
                  onChange={e => setTaxAddressInput(e.target.value)}
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8'}}
                />
              </label>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>Email nhận hóa đơn điện tử:</span>
                <input
                  type="email"
                  value={taxEmailInput}
                  onChange={e => setTaxEmailInput(e.target.value)}
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8'}}
                />
              </label>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>Hợp đồng nguyên tắc / Mua bán:</span>
                <input
                  type="text"
                  value={taxContractInput}
                  placeholder="Số hợp đồng / Phụ lục thương mại..."
                  onChange={e => setTaxContractInput(e.target.value)}
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8'}}
                />
              </label>
              <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
                <span style={{fontWeight: 700}}>Biên bản đồng thuận cung cấp thông tin (Cá nhân):</span>
                <input
                  type="text"
                  value={taxConsentInput}
                  placeholder="Mã biên bản đồng thuận sử dụng thông tin xuất HĐ..."
                  onChange={e => setTaxConsentInput(e.target.value)}
                  style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8'}}
                />
              </label>
            </div>

            <div
              style={{
                background: '#F8FAFC',
                padding: 10,
                border: '1px solid #CBD5E1',
                fontSize: 12,
              }}
            >
              <div style={{fontWeight: 800, color: '#142338', marginBottom: 4}}>
                📎 Tải lên Giấy phép kinh doanh / Hợp đồng / Biên bản đồng thuận (PDF/Ảnh):
              </div>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const uploaded = await uploadDocumentFile(
                    'partner',
                    editingTaxProfile.organizationId || 'tax-profile',
                    `Tài liệu pháp lý ${taxLegalName || editingTaxProfile.organizationName}`,
                    'LEGAL_CONTRACT',
                    file
                  );
                  if (uploaded) {
                    setTaxContractInput(prev =>
                      prev ? `${prev} (${uploaded.filename})` : uploaded.filename
                    );
                  }
                }}
                style={{fontSize: 11.5}}
              />
            </div>

            <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12}}>
              <span style={{fontWeight: 700}}>Ghi chú hồ sơ pháp lý:</span>
              <input
                type="text"
                value={taxNoteInput}
                onChange={e => setTaxNoteInput(e.target.value)}
                style={{height: 34, padding: '0 8px', border: '1px solid #94A3B8'}}
              />
            </label>

            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4}}>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const ok = await submitAction('save-customer-tax-profile', {
                    organizationId: editingTaxProfile.organizationId,
                    buyerType: taxBuyerType,
                    legalName: taxLegalName,
                    taxCode: taxCodeInput,
                    invoiceAddress: taxAddressInput,
                    invoiceEmail: taxEmailInput,
                    representativeName: taxRepInput,
                    personalIdNumber: taxPersonalIdInput,
                    personalIdConsentBasis: taxConsentInput,
                    contractCode: taxContractInput,
                    note: taxNoteInput,
                  });
                  if (ok) setEditingTaxProfile(null);
                }}
                style={{
                  padding: '8px 18px',
                  background: '#142338',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {busy ? 'Đang lưu hồ sơ...' : '💾 Lưu Hồ sơ Pháp lý & Mã số thuế'}
              </button>
            </div>
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
