import 'server-only';
import {randomUUID} from 'node:crypto';
import {database, type Sql} from './db';
import {CrmError, warehouseRoleRegion} from './permissions';
import {enqueueNotification} from './workspace';
import {commercialDigest, vietnamBusinessDate} from './commercial-common';
import type {Principal} from './types';

export interface OrderClearanceLine {
  sku: string;
  name: string;
  unitLabel: string;
  quantity: number;
  baseQuantity: number;
  listUnitPrice: number;
  discountPercent: number;
  netUnitPrice: number;
  listLineTotal: number;
  discountLineAmount: number;
  netLineTotal: number;
}

export interface OrderClearanceRecord {
  id: string;
  requestId: string;
  orderId: string | null;
  documentCode: string;
  salesOrderCode: string | null;
  organizationId: string;
  organizationName: string;
  warehouseId: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  warehouseRegion?: string | null;
  creatorName: string;
  ordererType?: 'CUSTOMER' | 'STAFF';
  ordererName?: string;
  ordererPhone?: string;
  note?: string;
  channel: string;
  requestStatus: string;
  listSubtotal: string;
  discountPercent: string;
  discountAmount: string;
  netTotal: string;
  staffSubmittedAmount: string;
  staffPaymentMethod: string;
  staffReference: string;
  staffSubmittedByName: string;
  staffSubmittedAt: string | null;
  status: 'NEW_ORDER' | 'STAFF_SUBMITTED' | 'ACCOUNTANT_CLEARED' | 'ACCOUNTANT_REJECTED' | 'PICKED_UP_DELIVERED';
  accountantName: string;
  accountantNote: string;
  accountantClearedAt: string | null;
  pickedUpAt: string | null;
  pickedUpByName: string;
  createdAt: string;
  updatedAt: string;
  lines: OrderClearanceLine[];
}

export interface WarehouseHandoverLine {
  productId: string;
  sku: string;
  name: string;
  unitLabel: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  note: string;
}

export interface WarehouseHandoverInvoiceRecord {
  id: string;
  code: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseRegion: string | null;
  clearanceId: string | null;
  requestId: string | null;
  orderCode: string;
  recipientType: 'STAFF' | 'CUSTOMER';
  recipientName: string;
  recipientPhone: string;
  organizationName: string;
  status: 'HANDED_OVER' | 'CONFIRMED';
  lines: WarehouseHandoverLine[];
  totalQuantity: string;
  totalAmount: string;
  note: string;
  createdByName: string;
  createdByRole: string;
  createdAt: string;
}

export interface PartnerOptionRecord {
  id: string;
  code: string;
  name: string;
  kind: string;
  phone: string;
  address: string;
  region: string | null;
}

export interface StaffOptionRecord {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

export interface FactoryInvoiceLine {
  productId: string;
  sku: string;
  name: string;
  unitLabel: string;
  orderedQty: number;
  dispatchedQty: number;
  receivedQty: number;
  discrepancyQty: number;
  factoryUnitPrice: number;
  lineTotal: number;
  receivedTotal: number;
  note: string;
}

export interface FactoryInvoiceRecord {
  id: string;
  code: string;
  stage: 'FACTORY_ORDER' | 'FACTORY_DISPATCH' | 'WAREHOUSE_RECONCILIATION';
  parentId: string | null;
  parentCode: string | null;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseRegion: string | null;
  factoryName: string;
  status: 'ISSUED' | 'DISPATCHED' | 'RECONCILED' | 'DISCREPANCY' | 'PARTIAL_PAID' | 'PAID';
  lines: FactoryInvoiceLine[];
  totalOrderedQty: string;
  totalDispatchedQty: string;
  totalReceivedQty: string;
  totalAmount: string;
  paidAmount: string;
  remainingDebt: string;
  note: string;
  createdByName: string;
  createdByRole: string;
  reconciledByName: string | null;
  reconciledAt: string | null;
  accountantVerified: boolean;
  accountantVerifiedByName: string | null;
  accountantVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseStockSummaryRow {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  region: string | null;
  productId: string;
  sku: string;
  productName: string;
  weightLabel: string;
  stockUnit: string;
  retailPrice: string;
  onHand: string;
  reserved: string;
  available: string;
  stockValue: string;
}

export interface WarehouseFactoryDebtRow {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  region: string | null;
  factoryOrderCount: number;
  factoryDispatchCount: number;
  reconciledCount: number;
  totalOrderedPackages: number;
  totalDispatchedPackages: number;
  totalReceivedPackages: number;
  totalDispatchedAmount: string;
  totalReconciledAmount: string;
  totalPaidAmount: string;
  remainingFactoryDebt: string;
}

let schemaEnsured = false;

export async function ensureAccountantWorkflowSchema(sql: Sql) {
  if (schemaEnsured) return;
  if (process.env.CRM_DATABASE_MODE !== 'postgres') {
    await sql.exec(`
      ALTER TABLE cohamy_crm.notifications DROP CONSTRAINT IF EXISTS notifications_entity_type_check;
      ALTER TABLE cohamy_crm.notifications ADD CONSTRAINT notifications_entity_type_check
        CHECK (entity_type IN (
          'partner','order','product','account','ticket','commercial-request','sales-order',
          'delivery','return-request','factory-invoice','warehouse-reconciliation','order-clearance'
        ));

      CREATE TABLE IF NOT EXISTS cohamy_crm.factory_invoices (
        id uuid PRIMARY KEY,
        code text NOT NULL UNIQUE,
        stage text NOT NULL CHECK (stage IN ('FACTORY_ORDER', 'FACTORY_DISPATCH', 'WAREHOUSE_RECONCILIATION')),
        parent_id uuid REFERENCES cohamy_crm.factory_invoices(id),
        warehouse_id uuid NOT NULL REFERENCES cohamy_crm.warehouses(id),
        factory_name text NOT NULL DEFAULT 'Nhà máy Sản xuất Cohamy',
        status text NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'DISPATCHED', 'RECONCILED', 'DISCREPANCY', 'PARTIAL_PAID', 'PAID')),
        lines jsonb NOT NULL DEFAULT '[]'::jsonb,
        total_ordered_qty numeric(30,2) NOT NULL DEFAULT 0,
        total_dispatched_qty numeric(30,2) NOT NULL DEFAULT 0,
        total_received_qty numeric(30,2) NOT NULL DEFAULT 0,
        total_amount numeric(30,0) NOT NULL DEFAULT 0,
        paid_amount numeric(30,0) NOT NULL DEFAULT 0,
        note text NOT NULL DEFAULT '',
        created_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
        created_by_name text NOT NULL DEFAULT '',
        created_by_role text NOT NULL DEFAULT '',
        reconciled_by uuid REFERENCES cohamy_crm.users(id),
        reconciled_by_name text,
        reconciled_at timestamptz,
        accountant_verified boolean NOT NULL DEFAULT false,
        accountant_verified_by uuid REFERENCES cohamy_crm.users(id),
        accountant_verified_by_name text,
        accountant_verified_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS cohamy_crm.accounting_order_clearances (
        id uuid PRIMARY KEY,
        request_id uuid UNIQUE REFERENCES cohamy_crm.commercial_requests(id),
        order_id uuid REFERENCES cohamy_crm.sales_orders(id),
        document_code text NOT NULL,
        organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
        warehouse_id uuid REFERENCES cohamy_crm.warehouses(id),
        orderer_type text NOT NULL DEFAULT 'CUSTOMER',
        orderer_name text NOT NULL DEFAULT '',
        orderer_phone text NOT NULL DEFAULT '',
        note text NOT NULL DEFAULT '',
        list_subtotal numeric(30,0) NOT NULL DEFAULT 0,
        discount_percent numeric(10,2) NOT NULL DEFAULT 0,
        discount_amount numeric(30,0) NOT NULL DEFAULT 0,
        net_total numeric(30,0) NOT NULL DEFAULT 0,
        staff_submitted_amount numeric(30,0) NOT NULL DEFAULT 0,
        staff_payment_method text NOT NULL DEFAULT 'BANK_TRANSFER',
        staff_reference text NOT NULL DEFAULT '',
        staff_submitted_by uuid REFERENCES cohamy_crm.users(id),
        staff_submitted_by_name text NOT NULL DEFAULT '',
        staff_submitted_at timestamptz,
        status text NOT NULL DEFAULT 'NEW_ORDER' CHECK (status IN (
          'NEW_ORDER','STAFF_SUBMITTED','ACCOUNTANT_CLEARED','ACCOUNTANT_REJECTED','PICKED_UP_DELIVERED'
        )),
        accountant_id uuid REFERENCES cohamy_crm.users(id),
        accountant_name text NOT NULL DEFAULT '',
        accountant_note text NOT NULL DEFAULT '',
        accountant_cleared_at timestamptz,
        picked_up_at timestamptz,
        picked_up_by_name text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      ALTER TABLE cohamy_crm.accounting_order_clearances
        ADD COLUMN IF NOT EXISTS orderer_type text NOT NULL DEFAULT 'CUSTOMER',
        ADD COLUMN IF NOT EXISTS orderer_name text NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS orderer_phone text NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '';

      CREATE TABLE IF NOT EXISTS cohamy_crm.warehouse_handover_invoices (
        id uuid PRIMARY KEY,
        code text NOT NULL UNIQUE,
        warehouse_id uuid NOT NULL REFERENCES cohamy_crm.warehouses(id),
        clearance_id uuid REFERENCES cohamy_crm.accounting_order_clearances(id),
        request_id uuid REFERENCES cohamy_crm.commercial_requests(id),
        order_code text NOT NULL DEFAULT '',
        recipient_type text NOT NULL DEFAULT 'CUSTOMER' CHECK (recipient_type IN ('STAFF', 'CUSTOMER')),
        recipient_name text NOT NULL DEFAULT '',
        recipient_phone text NOT NULL DEFAULT '',
        organization_name text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT 'HANDED_OVER' CHECK (status IN ('HANDED_OVER', 'CONFIRMED')),
        lines jsonb NOT NULL DEFAULT '[]'::jsonb,
        total_quantity numeric(30,2) NOT NULL DEFAULT 0,
        total_amount numeric(30,0) NOT NULL DEFAULT 0,
        note text NOT NULL DEFAULT '',
        created_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
        created_by_name text NOT NULL DEFAULT '',
        created_by_role text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  // Ensure both KHO-HN (Kho Hà Nội) and KHO-HCM (Kho TP.HCM) exist under Cohamy
  const cohamyOrg = (
    await sql.query<{id: string}>("SELECT id FROM cohamy_crm.organizations WHERE kind='COHAMY' ORDER BY created_at LIMIT 1")
  ).rows[0];
  if (cohamyOrg) {
    await sql.query("UPDATE cohamy_crm.warehouses SET region='SOUTH' WHERE region IS NULL AND (code ILIKE '%HCM%' OR name ILIKE '%HCM%' OR name ILIKE '%Hồ Chí Minh%' OR name ILIKE '%Miền Nam%')");
    await sql.query("UPDATE cohamy_crm.warehouses SET region='NORTH' WHERE region IS NULL AND (code ILIKE '%HN%' OR name ILIKE '%Hà Nội%' OR name ILIKE '%Miền Bắc%')");
    const existingWh = (
      await sql.query<{id: string; code: string; region: string | null}>('SELECT id, code, region FROM cohamy_crm.warehouses')
    ).rows;
    const hasHn = existingWh.some(w => w.code.toUpperCase().includes('HN') || w.region === 'NORTH');
    const hasHcm = existingWh.some(w => w.code.toUpperCase().includes('HCM') || w.region === 'SOUTH');
    if (!hasHn) {
      const hnId = randomUUID();
      await sql.query(
        "INSERT INTO cohamy_crm.warehouses(id, code, name, organization_id, region, active) VALUES ($1, 'KHO-HN', 'Kho Tổng Hà Nội', $2, 'NORTH', true) ON CONFLICT (code) DO NOTHING",
        [hnId, cohamyOrg.id]
      );
    }
    if (!hasHcm) {
      const hcmId = randomUUID();
      await sql.query(
        "INSERT INTO cohamy_crm.warehouses(id, code, name, organization_id, region, active) VALUES ($1, 'KHO-HCM', 'Kho Chi Nhánh TP.HCM', $2, 'SOUTH', true) ON CONFLICT (code) DO NOTHING",
        [hcmId, cohamyOrg.id]
      );
      const createdHcm = (
        await sql.query<{id: string}>("SELECT id FROM cohamy_crm.warehouses WHERE code='KHO-HCM' LIMIT 1")
      ).rows[0];
      if (createdHcm) {
        await sql.query(
          "INSERT INTO cohamy_crm.warehouse_locations(id, warehouse_id, code, name, kind, active) VALUES ($1, $2, 'KE-HCM-01', 'Kệ chính Kho TP.HCM', 'PICK', true) ON CONFLICT DO NOTHING",
          [randomUUID(), createdHcm.id]
        );
      }
    }
  }
  schemaEnsured = true;
}

export async function notifyRoles(
  sql: Sql,
  input: {
    roles: string[];
    eventKey: string;
    entityType: 'commercial-request' | 'sales-order' | 'factory-invoice' | 'warehouse-reconciliation' | 'order-clearance' | 'delivery';
    entityId: string;
    message: string;
    extraUserIds?: string[];
  }
) {
  const rows = (
    await sql.query<{user_id: string}>(
      `SELECT DISTINCT m.user_id
       FROM cohamy_crm.memberships m
       JOIN cohamy_crm.users u ON u.id = m.user_id
       WHERE m.active AND u.active AND m.role = ANY($1::text[])`,
      [input.roles]
    )
  ).rows;
  const userIds = new Set(rows.map(r => r.user_id));
  for (const uid of input.extraUserIds ?? []) {
    if (uid) userIds.add(uid);
  }
  for (const userId of userIds) {
    await enqueueNotification(sql, userId, input.eventKey, 'SYSTEM', input.entityType, input.entityId, input.message);
  }
}

function warehouseNotifyRolesForRegion(region: string | null | undefined, code?: string | null): string[] {
  const r = (region ?? '').toUpperCase();
  const c = (code ?? '').toUpperCase();
  if (r === 'SOUTH' || c.includes('HCM')) return ['WAREHOUSE_HCM', 'WAREHOUSE'];
  if (r === 'NORTH' || c.includes('HN')) return ['WAREHOUSE_HN', 'WAREHOUSE'];
  return ['WAREHOUSE_HCM', 'WAREHOUSE_HN', 'WAREHOUSE'];
}

function extractSnapshotTotals(snapshot: Record<string, unknown> | null | undefined) {
  const calc = (snapshot?.calculation ?? {}) as {
    subtotal?: string;
    discount?: string;
    total?: string;
    channel?: {listSubtotal?: string};
    lines?: Array<{
      sku?: string;
      name?: string;
      unitLabel?: string;
      quantity?: string;
      baseQuantity?: string;
      listUnitPrice?: string;
      unitPrice?: string;
      discount?: string;
      total?: string;
    }>;
  };
  const basket = (snapshot?.basket ?? {}) as {discountBasisPoints?: number};
  const listSubtotalNum = Number(calc.channel?.listSubtotal ?? calc.subtotal ?? 0);
  const netTotalNum = Number(calc.total ?? 0);
  const explicitDiscountNum = Number(calc.discount ?? 0);
  const totalDiscountNum = Math.max(explicitDiscountNum, listSubtotalNum > netTotalNum ? listSubtotalNum - netTotalNum : 0);
  const discountPct =
    typeof basket.discountBasisPoints === 'number' && basket.discountBasisPoints > 0
      ? Number((basket.discountBasisPoints / 100).toFixed(2))
      : listSubtotalNum > 0
        ? Number(((totalDiscountNum / listSubtotalNum) * 100).toFixed(2))
        : 0;
  return {
    listSubtotal: Math.round(listSubtotalNum),
    discountPercent: discountPct,
    discountAmount: Math.round(totalDiscountNum),
    netTotal: Math.round(netTotalNum),
    lines: (calc.lines ?? []).map(l => {
      const qty = Number(l.quantity ?? 0);
      const baseQty = Number(l.baseQuantity ?? l.quantity ?? 0);
      const listUnit = Number(l.listUnitPrice ?? l.unitPrice ?? 0);
      const listLine = Math.round(baseQty * listUnit);
      const netLine = Number(l.total ?? 0);
      const discLine = Math.max(Number(l.discount ?? 0), listLine > netLine ? listLine - netLine : 0);
      const lineDiscPct = listLine > 0 ? Number(((discLine / listLine) * 100).toFixed(2)) : discountPct;
      const netUnit = baseQty > 0 ? Math.round(netLine / baseQty) : listUnit;
      return {
        sku: String(l.sku ?? ''),
        name: String(l.name ?? l.sku ?? ''),
        unitLabel: String(l.unitLabel ?? 'Gói'),
        quantity: qty,
        baseQuantity: baseQty,
        listUnitPrice: listUnit,
        discountPercent: lineDiscPct,
        netUnitPrice: netUnit,
        listLineTotal: listLine,
        discountLineAmount: discLine,
        netLineTotal: netLine,
      };
    }),
  };
}

export async function syncOrderClearanceOnRequestSave(
  sql: Sql,
  input: {
    requestId: string;
    actorId: string;
    isNew: boolean;
  }
) {
  await ensureAccountantWorkflowSchema(sql);
  const row = (
    await sql.query<{
      id: string;
      code: string;
      organization_id: string;
      organization_name: string;
      organization_region: string | null;
      organization_address: string;
      creator_id: string;
      creator_role: string;
      snapshot: Record<string, unknown>;
      sales_order_id: string | null;
      sales_order_code: string | null;
    }>(
      `SELECT r.id, r.code, r.organization_id, o.name AS organization_name,
              o.region AS organization_region, COALESCE(o.address, '') AS organization_address,
              r.creator_id, COALESCE(r.creator_role, '') AS creator_role,
              v.snapshot, s.id AS sales_order_id, s.code AS sales_order_code
       FROM cohamy_crm.commercial_requests r
       JOIN cohamy_crm.organizations o ON o.id = r.organization_id
       JOIN cohamy_crm.commercial_request_versions v ON v.id = r.latest_version_id
       LEFT JOIN cohamy_crm.sales_orders s ON s.request_id = r.id
       WHERE r.id = $1`,
      [input.requestId]
    )
  ).rows[0];
  if (!row) return;

  const isSouth =
    row.creator_role === 'WAREHOUSE_HCM' ||
    row.organization_region === 'SOUTH' ||
    /hcm|hồ chí minh|miền nam|sài gòn|bình dương|đồng nai/i.test(row.organization_address || row.organization_name);

  const defaultWh = (
    await sql.query<{id: string; code: string; region: string | null}>(
      isSouth
        ? "SELECT id, code, region FROM cohamy_crm.warehouses WHERE (region='SOUTH' OR code ILIKE '%HCM%') AND active ORDER BY created_at LIMIT 1"
        : "SELECT id, code, region FROM cohamy_crm.warehouses WHERE (region='NORTH' OR code ILIKE '%HN%') AND active ORDER BY created_at LIMIT 1"
    )
  ).rows[0];

  const totals = extractSnapshotTotals(row.snapshot);
  const clearanceId = randomUUID();
  await sql.query(
    `INSERT INTO cohamy_crm.accounting_order_clearances(
       id, request_id, order_id, document_code, organization_id, warehouse_id,
       list_subtotal, discount_percent, discount_amount, net_total
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (request_id) DO UPDATE SET
       order_id = COALESCE(EXCLUDED.order_id, cohamy_crm.accounting_order_clearances.order_id),
       document_code = EXCLUDED.document_code,
       list_subtotal = EXCLUDED.list_subtotal,
       discount_percent = EXCLUDED.discount_percent,
       discount_amount = EXCLUDED.discount_amount,
       net_total = EXCLUDED.net_total,
       updated_at = now()`,
    [
      clearanceId,
      row.id,
      row.sales_order_id,
      row.sales_order_code ?? row.code,
      row.organization_id,
      defaultWh?.id ?? null,
      String(totals.listSubtotal),
      String(totals.discountPercent),
      String(totals.discountAmount),
      String(totals.netTotal),
    ]
  );

  const whRoles = warehouseNotifyRolesForRegion(defaultWh?.region, defaultWh?.code);
  const msg = `[Hóa đơn khách đặt hàng] ${row.sales_order_code ?? row.code} · Khách: ${row.organization_name} · Giá gốc: ${totals.listSubtotal.toLocaleString('vi-VN')} đ · Chiết khấu: ${totals.discountPercent}% · Phải thu: ${totals.netTotal.toLocaleString('vi-VN')} đ (Đã gửi cho Kho, Nhân viên & Kế toán).`;
  await notifyRoles(sql, {
    roles: ['ACCOUNTANT', 'ADMIN', 'MANAGER', 'SALES', ...whRoles],
    eventKey: `cust_order_invoice:${row.id}:${totals.netTotal}:${input.isNew ? 'new' : 'upd'}`,
    entityType: 'commercial-request',
    entityId: row.id,
    message: msg,
    extraUserIds: [row.creator_id],
  });
}

async function backfillExistingOrders(sql: Sql) {
  await ensureAccountantWorkflowSchema(sql);
  const missing = (
    await sql.query<{id: string; creator_id: string}>(
      `SELECT r.id, r.creator_id
       FROM cohamy_crm.commercial_requests r
       LEFT JOIN cohamy_crm.accounting_order_clearances c ON c.request_id = r.id
       WHERE c.id IS NULL AND r.latest_version_id IS NOT NULL`
    )
  ).rows;
  for (const m of missing) {
    await syncOrderClearanceOnRequestSave(sql, {
      requestId: m.id,
      actorId: m.creator_id,
      isNew: true,
    });
  }
}

export async function getAccountantWorkspaceData(user: Principal) {
  if (user.area !== 'crm') throw new CrmError('FORBIDDEN', 403);
  const db = await database();
  await backfillExistingOrders(db);

  const managedRegion = warehouseRoleRegion(user.role); // 'SOUTH' for WAREHOUSE_HCM, 'NORTH' for WAREHOUSE_HN, null otherwise

  const [clearanceRows, factoryRows, handoverRows, warehouses, products, stockRows, notifRows, partnerRows, staffRows] = await Promise.all([
    db.query<{
      id: string;
      request_id: string;
      order_id: string | null;
      document_code: string;
      sales_order_code: string | null;
      organization_id: string;
      organization_name: string;
      warehouse_id: string | null;
      warehouse_code: string | null;
      warehouse_name: string | null;
      warehouse_region: string | null;
      creator_name: string;
      orderer_type: string;
      orderer_name: string;
      orderer_phone: string;
      note: string;
      channel: string;
      request_status: string;
      list_subtotal: string;
      discount_percent: string;
      discount_amount: string;
      net_total: string;
      staff_submitted_amount: string;
      staff_payment_method: string;
      staff_reference: string;
      staff_submitted_by_name: string;
      staff_submitted_at: string | null;
      status: OrderClearanceRecord['status'];
      accountant_name: string;
      accountant_note: string;
      accountant_cleared_at: string | null;
      picked_up_at: string | null;
      picked_up_by_name: string;
      created_at: string;
      updated_at: string;
      snapshot: Record<string, unknown>;
    }>(
      `SELECT c.id, c.request_id, COALESCE(c.order_id, s.id) AS order_id,
              c.document_code, s.code AS sales_order_code,
              c.organization_id, o.name AS organization_name,
              c.warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name, w.region AS warehouse_region,
              COALESCE(u.display_name, 'Nhân viên') AS creator_name,
              COALESCE(c.orderer_type, 'CUSTOMER') AS orderer_type,
              COALESCE(c.orderer_name, '') AS orderer_name,
              COALESCE(c.orderer_phone, '') AS orderer_phone,
              COALESCE(c.note, '') AS note,
              r.channel, r.status AS request_status,
              c.list_subtotal::text, c.discount_percent::text, c.discount_amount::text, c.net_total::text,
              c.staff_submitted_amount::text, c.staff_payment_method, c.staff_reference,
              c.staff_submitted_by_name, c.staff_submitted_at::text,
              c.status, c.accountant_name, c.accountant_note, c.accountant_cleared_at::text,
              c.picked_up_at::text, c.picked_up_by_name,
              c.created_at::text, c.updated_at::text,
              v.snapshot
       FROM cohamy_crm.accounting_order_clearances c
       JOIN cohamy_crm.commercial_requests r ON r.id = c.request_id
       JOIN cohamy_crm.organizations o ON o.id = c.organization_id
       JOIN cohamy_crm.commercial_request_versions v ON v.id = r.latest_version_id
       LEFT JOIN cohamy_crm.sales_orders s ON s.request_id = r.id
       LEFT JOIN cohamy_crm.warehouses w ON w.id = c.warehouse_id
       LEFT JOIN cohamy_crm.users u ON u.id = r.creator_id
       ORDER BY c.updated_at DESC, c.created_at DESC
       LIMIT 200`
    ),
    db.query<{
      id: string;
      code: string;
      stage: FactoryInvoiceRecord['stage'];
      parent_id: string | null;
      parent_code: string | null;
      warehouse_id: string;
      warehouse_code: string;
      warehouse_name: string;
      warehouse_region: string | null;
      factory_name: string;
      status: FactoryInvoiceRecord['status'];
      lines: FactoryInvoiceLine[];
      total_ordered_qty: string;
      total_dispatched_qty: string;
      total_received_qty: string;
      total_amount: string;
      paid_amount: string;
      note: string;
      created_by_name: string;
      created_by_role: string;
      reconciled_by_name: string | null;
      reconciled_at: string | null;
      accountant_verified: boolean;
      accountant_verified_by_name: string | null;
      accountant_verified_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT f.id, f.code, f.stage, f.parent_id, p.code AS parent_code,
              f.warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name, w.region AS warehouse_region,
              f.factory_name, f.status, f.lines,
              f.total_ordered_qty::text, f.total_dispatched_qty::text, f.total_received_qty::text,
              f.total_amount::text, f.paid_amount::text, f.note,
              f.created_by_name, f.created_by_role,
              f.reconciled_by_name, f.reconciled_at::text,
              f.accountant_verified, f.accountant_verified_by_name, f.accountant_verified_at::text,
              f.created_at::text, f.updated_at::text
       FROM cohamy_crm.factory_invoices f
       JOIN cohamy_crm.warehouses w ON w.id = f.warehouse_id
       LEFT JOIN cohamy_crm.factory_invoices p ON p.id = f.parent_id
       ORDER BY f.created_at DESC
       LIMIT 200`
    ),
    db.query<{
      id: string;
      code: string;
      warehouse_id: string;
      warehouse_code: string;
      warehouse_name: string;
      warehouse_region: string | null;
      clearance_id: string | null;
      request_id: string | null;
      order_code: string;
      recipient_type: 'STAFF' | 'CUSTOMER';
      recipient_name: string;
      recipient_phone: string;
      organization_name: string;
      status: 'HANDED_OVER' | 'CONFIRMED';
      lines: WarehouseHandoverLine[];
      total_quantity: string;
      total_amount: string;
      note: string;
      created_by_name: string;
      created_by_role: string;
      created_at: string;
    }>(
      `SELECT h.id, h.code, h.warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name, w.region AS warehouse_region,
              h.clearance_id, h.request_id, h.order_code, h.recipient_type,
              h.recipient_name, h.recipient_phone, h.organization_name, h.status, h.lines,
              h.total_quantity::text, h.total_amount::text, h.note,
              h.created_by_name, h.created_by_role, h.created_at::text
       FROM cohamy_crm.warehouse_handover_invoices h
       JOIN cohamy_crm.warehouses w ON w.id = h.warehouse_id
       ORDER BY h.created_at DESC
       LIMIT 200`
    ),
    db.query<{id: string; code: string; name: string; region: string | null}>(
      'SELECT id, code, name, region FROM cohamy_crm.warehouses WHERE active ORDER BY code'
    ),
    db.query<{id: string; sku: string; name: string; weight_label: string; stock_unit: string; retail_price: string}>(
      "SELECT id, sku, name, weight_label, COALESCE(stock_unit, 'Gói') AS stock_unit, retail_price::text FROM cohamy_crm.products WHERE active ORDER BY sku"
    ),
    db.query<{
      warehouse_id: string;
      warehouse_code: string;
      warehouse_name: string;
      region: string | null;
      product_id: string;
      sku: string;
      product_name: string;
      weight_label: string;
      stock_unit: string;
      retail_price: string;
      on_hand: string;
      reserved: string;
      available: string;
    }>(
      `SELECT w.id AS warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name, w.region,
              p.id AS product_id, p.sku, p.name AS product_name, p.weight_label,
              COALESCE(p.stock_unit, 'Gói') AS stock_unit, p.retail_price::text,
              COALESCE(SUM(b.on_hand), 0)::numeric(30,0)::text AS on_hand,
              COALESCE(SUM(b.reserved), 0)::numeric(30,0)::text AS reserved,
              COALESCE(SUM(b.on_hand - b.reserved), 0)::numeric(30,0)::text AS available
       FROM cohamy_crm.warehouses w
       CROSS JOIN cohamy_crm.products p
       LEFT JOIN cohamy_crm.inventory_balances b ON b.warehouse_id = w.id AND b.product_id = p.id
       WHERE w.active AND p.active
       GROUP BY w.id, w.code, w.name, w.region, p.id, p.sku, p.name, p.weight_label, p.stock_unit, p.retail_price
       ORDER BY w.code, p.sku`
    ),
    db.query<{
      id: string;
      entity_type: string;
      entity_id: string;
      message: string;
      read_at: string | null;
      created_at: string;
    }>(
      `SELECT id, entity_type, entity_id, message, read_at::text, created_at::text
       FROM cohamy_crm.notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 60`,
      [user.id]
    ),
    db.query<{
      id: string;
      code: string;
      name: string;
      kind: string;
      phone: string;
      address: string;
      region: string | null;
    }>(
      `SELECT id, code, name, kind, COALESCE(phone, '') AS phone, COALESCE(address, '') AS address, region
       FROM cohamy_crm.organizations
       WHERE active AND merged_into_id IS NULL AND kind IN ('CUSTOMER', 'DEALER')
       ORDER BY name LIMIT 200`
    ),
    db.query<{
      id: string;
      display_name: string;
      email: string;
      role: string;
    }>(
      `SELECT DISTINCT u.id, u.display_name, u.email, m.role
       FROM cohamy_crm.users u
       JOIN cohamy_crm.memberships m ON m.user_id = u.id
       WHERE u.active AND m.active AND m.role IN ('SALES', 'MANAGER', 'ADMIN', 'ACCOUNTANT', 'WAREHOUSE_HCM', 'WAREHOUSE_HN', 'WAREHOUSE')
       ORDER BY u.display_name LIMIT 100`
    ),
  ]);

  const matchesManagedRegion = (region: string | null | undefined, code: string | null | undefined) => {
    if (!managedRegion) return true;
    if (region === managedRegion) return true;
    const c = (code ?? '').toUpperCase();
    if (managedRegion === 'SOUTH' && c.includes('HCM')) return true;
    if (managedRegion === 'NORTH' && c.includes('HN')) return true;
    return false;
  };

  const visibleWarehouses = warehouses.rows.filter(w => matchesManagedRegion(w.region, w.code));
  const visibleWarehouseIds = new Set(visibleWarehouses.map(w => w.id));

  const allOrderClearances: OrderClearanceRecord[] = clearanceRows.rows.map(r => {
    const parsed = extractSnapshotTotals(r.snapshot);
    return {
      id: r.id,
      requestId: r.request_id,
      orderId: r.order_id,
      documentCode: r.sales_order_code ?? r.document_code,
      salesOrderCode: r.sales_order_code,
      organizationId: r.organization_id,
      organizationName: r.organization_name,
      warehouseId: r.warehouse_id,
      warehouseCode: r.warehouse_code,
      warehouseName: r.warehouse_name,
      warehouseRegion: r.warehouse_region,
      creatorName: r.creator_name,
      ordererType: (r.orderer_type === 'STAFF' ? 'STAFF' : 'CUSTOMER') as 'CUSTOMER' | 'STAFF',
      ordererName: r.orderer_name || r.creator_name,
      ordererPhone: r.orderer_phone || '',
      note: r.note || String((r.snapshot as {note?: string})?.note ?? ''),
      channel: r.channel,
      requestStatus: r.request_status,
      listSubtotal: r.list_subtotal,
      discountPercent: r.discount_percent,
      discountAmount: r.discount_amount,
      netTotal: r.net_total,
      staffSubmittedAmount: r.staff_submitted_amount,
      staffPaymentMethod: r.staff_payment_method,
      staffReference: r.staff_reference,
      staffSubmittedByName: r.staff_submitted_by_name,
      staffSubmittedAt: r.staff_submitted_at,
      status: r.status,
      accountantName: r.accountant_name,
      accountantNote: r.accountant_note,
      accountantClearedAt: r.accountant_cleared_at,
      pickedUpAt: r.picked_up_at,
      pickedUpByName: r.picked_up_by_name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      lines: parsed.lines,
    };
  });

  const orderClearances = managedRegion
    ? allOrderClearances.filter(
        c =>
          !c.warehouseId ||
          visibleWarehouseIds.has(c.warehouseId) ||
          matchesManagedRegion(c.warehouseRegion, c.warehouseCode)
      )
    : allOrderClearances;

  const allFactoryInvoices: FactoryInvoiceRecord[] = factoryRows.rows.map(f => {
    const totalAmt = BigInt(f.total_amount || '0');
    const paidAmt = BigInt(f.paid_amount || '0');
    const rem = totalAmt > paidAmt ? totalAmt - paidAmt : 0n;
    return {
      id: f.id,
      code: f.code,
      stage: f.stage,
      parentId: f.parent_id,
      parentCode: f.parent_code,
      warehouseId: f.warehouse_id,
      warehouseCode: f.warehouse_code,
      warehouseName: f.warehouse_name,
      warehouseRegion: f.warehouse_region,
      factoryName: f.factory_name,
      status: f.status,
      lines: Array.isArray(f.lines) ? f.lines : [],
      totalOrderedQty: f.total_ordered_qty,
      totalDispatchedQty: f.total_dispatched_qty,
      totalReceivedQty: f.total_received_qty,
      totalAmount: f.total_amount,
      paidAmount: f.paid_amount,
      remainingDebt: rem.toString(),
      note: f.note,
      createdByName: f.created_by_name,
      createdByRole: f.created_by_role,
      reconciledByName: f.reconciled_by_name,
      reconciledAt: f.reconciled_at,
      accountantVerified: f.accountant_verified,
      accountantVerifiedByName: f.accountant_verified_by_name,
      accountantVerifiedAt: f.accountant_verified_at,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    };
  });

  const factoryInvoices = managedRegion
    ? allFactoryInvoices.filter(
        f => visibleWarehouseIds.has(f.warehouseId) || matchesManagedRegion(f.warehouseRegion, f.warehouseCode)
      )
    : allFactoryInvoices;

  const allHandoverInvoices: WarehouseHandoverInvoiceRecord[] = handoverRows.rows.map(h => ({
    id: h.id,
    code: h.code,
    warehouseId: h.warehouse_id,
    warehouseCode: h.warehouse_code,
    warehouseName: h.warehouse_name,
    warehouseRegion: h.warehouse_region,
    clearanceId: h.clearance_id,
    requestId: h.request_id,
    orderCode: h.order_code,
    recipientType: h.recipient_type,
    recipientName: h.recipient_name,
    recipientPhone: h.recipient_phone,
    organizationName: h.organization_name,
    status: h.status,
    lines: Array.isArray(h.lines) ? h.lines : [],
    totalQuantity: h.total_quantity,
    totalAmount: h.total_amount,
    note: h.note,
    createdByName: h.created_by_name,
    createdByRole: h.created_by_role,
    createdAt: h.created_at,
  }));

  const handoverInvoices = managedRegion
    ? allHandoverInvoices.filter(
        h => visibleWarehouseIds.has(h.warehouseId) || matchesManagedRegion(h.warehouseRegion, h.warehouseCode)
      )
    : allHandoverInvoices;

  const allWarehouseStocks: WarehouseStockSummaryRow[] = stockRows.rows.map(s => {
    const onHandNum = BigInt(s.on_hand || '0');
    const priceNum = BigInt(s.retail_price || '0');
    return {
      warehouseId: s.warehouse_id,
      warehouseCode: s.warehouse_code,
      warehouseName: s.warehouse_name,
      region: s.region,
      productId: s.product_id,
      sku: s.sku,
      productName: s.product_name,
      weightLabel: s.weight_label,
      stockUnit: s.stock_unit,
      retailPrice: s.retail_price,
      onHand: s.on_hand,
      reserved: s.reserved,
      available: s.available,
      stockValue: (onHandNum * priceNum).toString(),
    };
  });

  const warehouseStocks = managedRegion
    ? allWarehouseStocks.filter(
        s => visibleWarehouseIds.has(s.warehouseId) || matchesManagedRegion(s.region, s.warehouseCode)
      )
    : allWarehouseStocks;

  const warehouseFactoryDebts: WarehouseFactoryDebtRow[] = visibleWarehouses.map(w => {
    const whInvoices = factoryInvoices.filter(f => f.warehouseId === w.id);
    const orders = whInvoices.filter(f => f.stage === 'FACTORY_ORDER');
    const dispatches = whInvoices.filter(f => f.stage === 'FACTORY_DISPATCH');
    const reconciliations = whInvoices.filter(f => f.stage === 'WAREHOUSE_RECONCILIATION');

    const totalOrderedPackages = orders.reduce((s, x) => s + Number(x.totalOrderedQty || 0), 0);
    const totalDispatchedPackages = dispatches.reduce((s, x) => s + Number(x.totalDispatchedQty || 0), 0);
    const totalReceivedPackages = reconciliations.reduce((s, x) => s + Number(x.totalReceivedQty || 0), 0);

    const totalDispatchedAmount = dispatches.reduce((s, x) => s + BigInt(x.totalAmount || '0'), 0n);
    const totalReconciledAmount = reconciliations.reduce((s, x) => s + BigInt(x.totalAmount || '0'), 0n);
    const debtSourceInvoices = reconciliations.length > 0 ? reconciliations : dispatches;
    const debtBase = debtSourceInvoices.reduce((s, x) => s + BigInt(x.totalAmount || '0'), 0n);
    const totalPaid = whInvoices.reduce((s, x) => s + BigInt(x.paidAmount || '0'), 0n);
    const remaining = debtBase > totalPaid ? debtBase - totalPaid : 0n;

    return {
      warehouseId: w.id,
      warehouseCode: w.code,
      warehouseName: w.name,
      region: w.region,
      factoryOrderCount: orders.length,
      factoryDispatchCount: dispatches.length,
      reconciledCount: reconciliations.length,
      totalOrderedPackages,
      totalDispatchedPackages,
      totalReceivedPackages,
      totalDispatchedAmount: totalDispatchedAmount.toString(),
      totalReconciledAmount: totalReconciledAmount.toString(),
      totalPaidAmount: totalPaid.toString(),
      remainingFactoryDebt: remaining.toString(),
    };
  });

  const partners: PartnerOptionRecord[] = partnerRows.rows;
  const staffMembers: StaffOptionRecord[] = staffRows.rows.map(s => ({
    id: s.id,
    displayName: s.display_name,
    email: s.email,
    role: s.role,
  }));

  return {
    managedRegion,
    orderClearances,
    factoryInvoices,
    handoverInvoices,
    warehouseStocks,
    warehouseFactoryDebts,
    warehouses: visibleWarehouses,
    products: products.rows,
    notifications: notifRows.rows,
    partners,
    staffMembers,
  };
}

export type AccountantWorkspaceData = Awaited<ReturnType<typeof getAccountantWorkspaceData>>;

function assertUserWarehouseAccess(
  user: Principal,
  wh: {id: string; code: string; region: string | null}
) {
  const userRegion = warehouseRoleRegion(user.role);
  if (!userRegion) return;
  const whCode = (wh.code ?? '').toUpperCase();
  const isMatch =
    wh.region === userRegion ||
    (userRegion === 'SOUTH' && whCode.includes('HCM')) ||
    (userRegion === 'NORTH' && whCode.includes('HN'));
  if (!isMatch) {
    throw new CrmError('FORBIDDEN', 403);
  }
}

export async function handleAccountantWorkflowAction(
  user: Principal,
  action: string,
  input: Record<string, unknown>
) {
  if (user.area !== 'crm') throw new CrmError('FORBIDDEN', 403);
  const db = await database();
  return db.transaction(async sql => {
    await ensureAccountantWorkflowSchema(sql);

    if (action === 'register-warehouse-order') {
      if (!['ADMIN', 'MANAGER', 'SALES', 'ACCOUNTANT', 'WAREHOUSE', 'WAREHOUSE_HCM', 'WAREHOUSE_HN'].includes(user.role)) {
        throw new CrmError('FORBIDDEN', 403);
      }
      const userRegion = warehouseRoleRegion(user.role);
      const requestedWarehouseId = String(input.warehouseId ?? '').trim();
      const wh = (
        await sql.query<{id: string; code: string; name: string; region: string | null}>(
          requestedWarehouseId
            ? 'SELECT id, code, name, region FROM cohamy_crm.warehouses WHERE id = $1 AND active LIMIT 1'
            : userRegion === 'SOUTH'
              ? "SELECT id, code, name, region FROM cohamy_crm.warehouses WHERE (region = 'SOUTH' OR code ILIKE '%HCM%') AND active ORDER BY created_at LIMIT 1"
              : "SELECT id, code, name, region FROM cohamy_crm.warehouses WHERE (region = 'NORTH' OR code ILIKE '%HN%') AND active ORDER BY created_at LIMIT 1",
          requestedWarehouseId ? [requestedWarehouseId] : []
        )
      ).rows[0];
      if (!wh) throw new CrmError('INVALID_FIELDS', 400);
      assertUserWarehouseAccess(user, wh);

      const ordererType = String(input.ordererType ?? 'CUSTOMER') === 'STAFF' ? 'STAFF' : 'CUSTOMER';
      const ordererName = String(input.ordererName ?? '').trim() || user.displayName;
      const ordererPhone = String(input.ordererPhone ?? '').trim() || '0900000000';
      const customOrgName = String(input.organizationName ?? '').trim();
      const customAddress = String(input.address ?? '').trim() || `Nhận từ ${wh.name}`;
      const note = String(input.note ?? '').trim();
      const discountPercent = Math.max(0, Math.min(90, Number(input.discountPercent ?? 0)));
      const paymentSubmitted = Boolean(input.paymentSubmitted);
      const paymentMethod = String(input.paymentMethod ?? 'BANK_TRANSFER');
      const rawLines = Array.isArray(input.lines) ? (input.lines as Array<Record<string, unknown>>) : [];

      let orgId = String(input.organizationId ?? '').trim();
      let orgRow: {id: string; code: string; name: string; phone: string; email: string; address: string} | undefined;
      if (orgId) {
        orgRow = (
          await sql.query<{id: string; code: string; name: string; phone: string; email: string; address: string}>(
            'SELECT id, code, name, COALESCE(phone, \'\') AS phone, COALESCE(email, \'\') AS email, COALESCE(address, \'\') AS address FROM cohamy_crm.organizations WHERE id = $1 LIMIT 1',
            [orgId]
          )
        ).rows[0];
      }
      if (!orgRow && customOrgName) {
        orgRow = (
          await sql.query<{id: string; code: string; name: string; phone: string; email: string; address: string}>(
            'SELECT id, code, name, COALESCE(phone, \'\') AS phone, COALESCE(email, \'\') AS email, COALESCE(address, \'\') AS address FROM cohamy_crm.organizations WHERE LOWER(name) = LOWER($1) AND merged_into_id IS NULL LIMIT 1',
            [customOrgName]
          )
        ).rows[0];
        if (!orgRow) {
          const newOrgId = randomUUID();
          const newOrgCode = `KH-${vietnamBusinessDate(new Date())}-${newOrgId.slice(0, 4).toUpperCase()}`;
          await sql.query(
            `INSERT INTO cohamy_crm.organizations(id, code, name, kind, phone, email, address, partner_type, stage, region, active)
             VALUES ($1, $2, $3, 'CUSTOMER', $4, '', $5, 'END_CUSTOMER', 'ACTIVE', $6, true)`,
            [newOrgId, newOrgCode, customOrgName, ordererPhone, customAddress, wh.region]
          );
          orgRow = {
            id: newOrgId,
            code: newOrgCode,
            name: customOrgName,
            phone: ordererPhone,
            email: '',
            address: customAddress,
          };
        }
      }
      if (!orgRow) {
        orgRow = (
          await sql.query<{id: string; code: string; name: string; phone: string; email: string; address: string}>(
            "SELECT id, code, name, COALESCE(phone, '') AS phone, COALESCE(email, '') AS email, COALESCE(address, '') AS address FROM cohamy_crm.organizations WHERE active AND merged_into_id IS NULL AND kind IN ('CUSTOMER', 'DEALER') ORDER BY created_at LIMIT 1"
          )
        ).rows[0];
      }
      if (!orgRow) throw new CrmError('INVALID_FIELDS', 400);
      orgId = orgRow.id;

      const calcLines: Array<{
        productId: string;
        sku: string;
        name: string;
        unitCode: string;
        unitLabel: string;
        quantity: string;
        baseQuantity: string;
        listUnitPrice: string;
        unitPrice: string;
        discount: string;
        total: string;
      }> = [];
      let listSubtotal = 0;
      let totalDiscount = 0;
      let netTotal = 0;

      for (const item of rawLines) {
        const qty = Math.max(0, Math.round(Number(item.quantity ?? 0)));
        if (qty <= 0) continue;
        const prod = (
          await sql.query<{id: string; sku: string; name: string; stock_unit: string; retail_price: string}>(
            "SELECT id, sku, name, COALESCE(stock_unit, 'Gói') AS stock_unit, retail_price::text FROM cohamy_crm.products WHERE id::text = $1 OR sku = $1 LIMIT 1",
            [String(item.productId ?? item.sku ?? '')]
          )
        ).rows[0];
        if (!prod) continue;
        const listUnitPrice = Math.max(
          0,
          Math.round(Number(item.unitPrice ?? prod.retail_price ?? 0))
        );
        const lineSubtotal = qty * listUnitPrice;
        const lineDiscount = Math.round((lineSubtotal * discountPercent) / 100);
        const lineNet = lineSubtotal - lineDiscount;
        const netUnit = qty > 0 ? Math.round(lineNet / qty) : listUnitPrice;

        listSubtotal += lineSubtotal;
        totalDiscount += lineDiscount;
        netTotal += lineNet;

        calcLines.push({
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          unitCode: 'UNIT',
          unitLabel: prod.stock_unit,
          quantity: String(qty),
          baseQuantity: String(qty),
          listUnitPrice: String(listUnitPrice),
          unitPrice: String(netUnit),
          discount: String(lineDiscount),
          total: String(lineNet),
        });
      }

      if (!calcLines.length) throw new CrmError('INVALID_FIELDS', 400);

      const now = new Date();
      const requestId = randomUUID();
      const versionId = randomUUID();
      const docCode = `HD-${wh.code.replace('KHO-', '')}-${vietnamBusinessDate(now)}-${requestId.slice(0, 5).toUpperCase()}`;
      const cohamyOrg = (
        await sql.query<{id: string}>("SELECT id FROM cohamy_crm.organizations WHERE kind='COHAMY' LIMIT 1")
      ).rows[0];

      const snapshot = {
        organization: {
          id: orgRow.id,
          code: orgRow.code,
          name: orgRow.name,
          phone: orgRow.phone || ordererPhone,
          email: orgRow.email || '',
          businessId: '',
          address: orgRow.address || customAddress,
        },
        delivery: {
          recipient: ordererName,
          phone: ordererPhone,
          address: orgRow.address || customAddress,
        },
        basket: {
          lines: calcLines.map(l => ({
            productId: l.productId,
            unitCode: 'UNIT',
            quantity: l.quantity,
          })),
          discountBasisPoints: Math.round(discountPercent * 100),
          creditTerms: false,
        },
        calculation: {
          lines: calcLines,
          subtotal: String(listSubtotal),
          discount: String(totalDiscount),
          total: String(netTotal),
          channel: {
            listSubtotal: String(listSubtotal),
          },
          approvalReasons: [],
          minimumShortfalls: [],
        },
        note,
        currency: 'VND',
        issuedAt: now.toISOString(),
        validUntil: new Date(now.getTime() + 7 * 24 * 3600000).toISOString(),
      };

      await sql.query(
        `INSERT INTO cohamy_crm.commercial_requests(
           id, code, organization_id, creator_id, creator_membership_id,
           creator_area, creator_role, channel, status, seller_organization_id, assigned_approver_org_id
         ) VALUES ($1, $2, $3, $4, $5, 'crm', $6, 'VISIT', 'SUBMITTED', $7, $7)`,
        [
          requestId,
          docCode,
          orgRow.id,
          user.id,
          user.membershipId,
          user.role,
          cohamyOrg?.id ?? user.organizationId,
        ]
      );

      await sql.query(
        `INSERT INTO cohamy_crm.commercial_request_versions(
           id, request_id, number, snapshot, checksum, actor_id, idempotency_key, request_hash
         ) VALUES ($1, $2, 1, $3::jsonb, $4, $5, $6, $4)`,
        [
          versionId,
          requestId,
          JSON.stringify(snapshot),
          commercialDigest(snapshot),
          user.id,
          randomUUID(),
        ]
      );

      await sql.query(
        'UPDATE cohamy_crm.commercial_requests SET latest_version_id = $1, version = 1 WHERE id = $2',
        [versionId, requestId]
      );

      const clearanceId = randomUUID();
      const initialStatus = paymentSubmitted ? 'STAFF_SUBMITTED' : 'NEW_ORDER';
      await sql.query(
        `INSERT INTO cohamy_crm.accounting_order_clearances(
           id, request_id, document_code, organization_id, warehouse_id,
           orderer_type, orderer_name, orderer_phone, note,
           list_subtotal, discount_percent, discount_amount, net_total,
           staff_submitted_amount, staff_payment_method, staff_reference,
           staff_submitted_by, staff_submitted_by_name, staff_submitted_at, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          clearanceId,
          requestId,
          docCode,
          orgRow.id,
          wh.id,
          ordererType,
          ordererName,
          ordererPhone,
          note,
          String(listSubtotal),
          String(discountPercent),
          String(totalDiscount),
          String(netTotal),
          paymentSubmitted ? String(netTotal) : '0',
          paymentMethod,
          paymentSubmitted ? `Đăng ký tại ${wh.name}` : '',
          paymentSubmitted ? user.id : null,
          paymentSubmitted ? user.displayName : '',
          paymentSubmitted ? now.toISOString() : null,
          initialStatus,
        ]
      );

      const whRoles = warehouseNotifyRolesForRegion(wh.region, wh.code);
      const whoLabel = ordererType === 'STAFF' ? `Nhân viên ${ordererName}` : `Khách hàng ${orgRow.name} (${ordererName})`;
      await notifyRoles(sql, {
        roles: ['ACCOUNTANT', 'ADMIN', 'MANAGER', ...whRoles],
        eventKey: `wh_reg_order:${clearanceId}`,
        entityType: 'order-clearance',
        entityId: clearanceId,
        message: `[Đăng ký Hóa đơn đặt hàng tại ${wh.name}] Mã HĐ: ${docCode} · Người đặt: ${whoLabel} · Giá gốc: ${listSubtotal.toLocaleString('vi-VN')} đ · Chiết khấu: ${discountPercent}% · Phải thu: ${netTotal.toLocaleString('vi-VN')} đ.`,
      });

      return {ok: true, id: clearanceId, requestId, documentCode: docCode};
    }

    if (action === 'create-handover-invoice') {
      if (!['ADMIN', 'MANAGER', 'WAREHOUSE', 'WAREHOUSE_HCM', 'WAREHOUSE_HN'].includes(user.role)) {
        throw new CrmError('FORBIDDEN', 403);
      }
      const userRegion = warehouseRoleRegion(user.role);
      const requestedWarehouseId = String(input.warehouseId ?? '').trim();
      const wh = (
        await sql.query<{id: string; code: string; name: string; region: string | null}>(
          requestedWarehouseId
            ? 'SELECT id, code, name, region FROM cohamy_crm.warehouses WHERE id = $1 AND active LIMIT 1'
            : userRegion === 'SOUTH'
              ? "SELECT id, code, name, region FROM cohamy_crm.warehouses WHERE (region = 'SOUTH' OR code ILIKE '%HCM%') AND active ORDER BY created_at LIMIT 1"
              : "SELECT id, code, name, region FROM cohamy_crm.warehouses WHERE (region = 'NORTH' OR code ILIKE '%HN%') AND active ORDER BY created_at LIMIT 1",
          requestedWarehouseId ? [requestedWarehouseId] : []
        )
      ).rows[0];
      if (!wh) throw new CrmError('INVALID_FIELDS', 400);
      assertUserWarehouseAccess(user, wh);

      const clearanceId = input.clearanceId ? String(input.clearanceId).trim() : null;
      const recipientType = String(input.recipientType ?? 'CUSTOMER') === 'STAFF' ? 'STAFF' : 'CUSTOMER';
      const recipientName = String(input.recipientName ?? '').trim();
      const recipientPhone = String(input.recipientPhone ?? '').trim();
      const organizationName = String(input.organizationName ?? '').trim() || recipientName;
      const orderCodeInput = String(input.orderCode ?? '').trim();
      const note = String(input.note ?? '').trim();
      const rawLines = Array.isArray(input.lines) ? (input.lines as Array<Record<string, unknown>>) : [];

      if (!recipientName) throw new CrmError('INVALID_FIELDS', 400);

      let linkedClearance: {
        id: string;
        request_id: string;
        document_code: string;
        organization_name: string;
      } | null = null;
      if (clearanceId) {
        linkedClearance =
          (
            await sql.query<{
              id: string;
              request_id: string;
              document_code: string;
              organization_name: string;
            }>(
              `SELECT c.id, c.request_id, c.document_code, o.name AS organization_name
               FROM cohamy_crm.accounting_order_clearances c
               JOIN cohamy_crm.organizations o ON o.id = c.organization_id
               WHERE c.id = $1 FOR UPDATE OF c`,
              [clearanceId]
            )
          ).rows[0] ?? null;
      }

      const handoverLines: WarehouseHandoverLine[] = [];
      let totalQty = 0;
      let totalAmount = 0;

      for (const item of rawLines) {
        const qty = Math.max(0, Math.round(Number(item.quantity ?? 0)));
        if (qty <= 0) continue;
        const prod = (
          await sql.query<{id: string; sku: string; name: string; stock_unit: string; retail_price: string}>(
            "SELECT id, sku, name, COALESCE(stock_unit, 'Gói') AS stock_unit, retail_price::text FROM cohamy_crm.products WHERE id::text = $1 OR sku = $1 LIMIT 1",
            [String(item.productId ?? item.sku ?? '')]
          )
        ).rows[0];
        if (!prod) continue;
        const unitPrice = Math.max(
          0,
          Math.round(Number(item.unitPrice ?? prod.retail_price ?? 0))
        );
        const lineTotal = qty * unitPrice;
        totalQty += qty;
        totalAmount += lineTotal;
        handoverLines.push({
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          unitLabel: prod.stock_unit,
          quantity: qty,
          unitPrice,
          lineTotal,
          note: String(item.note ?? ''),
        });
      }

      if (!handoverLines.length) throw new CrmError('INVALID_FIELDS', 400);

      // Safely deduct handed-over quantities from warehouse inventory_balances
      for (const hl of handoverLines) {
        let remainingToDeduct = BigInt(hl.quantity);
        const balRows = (
          await sql.query<{
            warehouse_id: string;
            location_id: string;
            product_id: string;
            lot_id: string;
            on_hand: string;
            reserved: string;
          }>(
            `SELECT warehouse_id, location_id, product_id, lot_id, on_hand::numeric(30,0)::text AS on_hand, reserved::numeric(30,0)::text AS reserved
             FROM cohamy_crm.inventory_balances
             WHERE warehouse_id = $1 AND product_id = $2 AND on_hand > reserved
             ORDER BY on_hand DESC
             FOR UPDATE`,
            [wh.id, hl.productId]
          )
        ).rows;

        for (const b of balRows) {
          if (remainingToDeduct <= 0n) break;
          const onHand = BigInt(b.on_hand || '0');
          const reserved = BigInt(b.reserved || '0');
          const free = onHand > reserved ? onHand - reserved : 0n;
          if (free <= 0n) continue;
          const deduct = free < remainingToDeduct ? free : remainingToDeduct;
          const nextOnHand = onHand - deduct;
          await sql.query(
            `UPDATE cohamy_crm.inventory_balances
             SET on_hand = $1, version = version + 1, updated_at = now()
             WHERE warehouse_id = $2 AND location_id = $3 AND product_id = $4 AND lot_id = $5`,
            [nextOnHand.toString(), b.warehouse_id, b.location_id, b.product_id, b.lot_id]
          );
          remainingToDeduct -= deduct;
        }
      }

      const id = randomUUID();
      const shortWh = wh.code.replace('KHO-', '');
      const code = `BG-${shortWh}-${vietnamBusinessDate(new Date())}-${id.slice(0, 5).toUpperCase()}`;
      const finalOrderCode = orderCodeInput || linkedClearance?.document_code || '';
      const finalOrgName = organizationName || linkedClearance?.organization_name || recipientName;

      await sql.query(
        `INSERT INTO cohamy_crm.warehouse_handover_invoices(
           id, code, warehouse_id, clearance_id, request_id, order_code,
           recipient_type, recipient_name, recipient_phone, organization_name,
           status, lines, total_quantity, total_amount, note,
           created_by, created_by_name, created_by_role
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'HANDED_OVER',$11::jsonb,$12,$13,$14,$15,$16,$17)`,
        [
          id,
          code,
          wh.id,
          linkedClearance?.id ?? null,
          linkedClearance?.request_id ?? null,
          finalOrderCode,
          recipientType,
          recipientName,
          recipientPhone,
          finalOrgName,
          JSON.stringify(handoverLines),
          String(totalQty),
          String(totalAmount),
          note,
          user.id,
          user.displayName,
          user.role,
        ]
      );

      if (linkedClearance) {
        await sql.query(
          `UPDATE cohamy_crm.accounting_order_clearances
           SET status = 'PICKED_UP_DELIVERED',
               warehouse_id = $1,
               picked_up_at = now(),
               picked_up_by_name = $2,
               updated_at = now()
           WHERE id = $3`,
          [wh.id, recipientName, linkedClearance.id]
        );
      }

      const whRoles = warehouseNotifyRolesForRegion(wh.region, wh.code);
      const targetTypeLabel = recipientType === 'STAFF' ? 'Nhân viên' : 'Khách hàng';
      await notifyRoles(sql, {
        roles: ['ACCOUNTANT', 'ADMIN', 'MANAGER', 'SALES', ...whRoles],
        eventKey: `wh_handover:${id}`,
        entityType: 'delivery',
        entityId: id,
        message: `[Hóa đơn Bàn giao Sản phẩm - ${wh.name}] Mã phiếu: ${code} · Thủ kho ${user.displayName} đã bàn giao ${totalQty.toLocaleString('vi-VN')} gói (${totalAmount.toLocaleString('vi-VN')} đ) cho ${targetTypeLabel}: ${recipientName}${finalOrderCode ? ` (Theo HĐ: ${finalOrderCode})` : ''}.`,
      });

      return {ok: true, id, code};
    }

    if (action === 'adjust-warehouse-stock') {
      if (!['ADMIN', 'MANAGER', 'WAREHOUSE', 'WAREHOUSE_HCM', 'WAREHOUSE_HN'].includes(user.role)) {
        throw new CrmError('FORBIDDEN', 403);
      }
      const warehouseId = String(input.warehouseId ?? '').trim();
      const productId = String(input.productId ?? '').trim();
      const newOnHand = Math.max(0, Math.round(Number(input.newOnHand ?? 0)));
      const wh = (
        await sql.query<{id: string; code: string; name: string; region: string | null}>(
          'SELECT id, code, name, region FROM cohamy_crm.warehouses WHERE id = $1 AND active LIMIT 1',
          [warehouseId]
        )
      ).rows[0];
      if (!wh || !productId) throw new CrmError('INVALID_FIELDS', 400);
      assertUserWarehouseAccess(user, wh);

      let loc = (
        await sql.query<{id: string}>(
          "SELECT id FROM cohamy_crm.warehouse_locations WHERE warehouse_id = $1 AND active AND kind = 'PICK' ORDER BY created_at LIMIT 1",
          [wh.id]
        )
      ).rows[0];
      if (!loc) {
        const locId = randomUUID();
        await sql.query(
          "INSERT INTO cohamy_crm.warehouse_locations(id, warehouse_id, code, name, kind, active) VALUES ($1, $2, $3, $4, 'PICK', true)",
          [locId, wh.id, `KE-${wh.code}-01`, `Kệ chính ${wh.name}`]
        );
        loc = {id: locId};
      }

      let lot = (
        await sql.query<{id: string}>(
          "SELECT id FROM cohamy_crm.inventory_lots WHERE product_id = $1 AND status = 'AVAILABLE' ORDER BY created_at LIMIT 1",
          [productId]
        )
      ).rows[0];
      if (!lot) {
        const lotId = randomUUID();
        await sql.query(
          "INSERT INTO cohamy_crm.inventory_lots(id, product_id, code, status) VALUES ($1, $2, $3, 'AVAILABLE')",
          [lotId, productId, `LOT-INIT-${productId.slice(0, 6).toUpperCase()}`]
        );
        lot = {id: lotId};
      }

      const existingRows = (
        await sql.query<{location_id: string; lot_id: string; reserved: string}>(
          'SELECT location_id, lot_id, reserved::numeric(30,0)::text AS reserved FROM cohamy_crm.inventory_balances WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
          [wh.id, productId]
        )
      ).rows;

      if (existingRows.length === 0) {
        await sql.query(
          'INSERT INTO cohamy_crm.inventory_balances(warehouse_id, location_id, product_id, lot_id, on_hand, reserved) VALUES ($1, $2, $3, $4, $5, 0)',
          [wh.id, loc.id, productId, lot.id, String(newOnHand)]
        );
      } else {
        const first = existingRows[0];
        const minFirst = Math.max(newOnHand, Number(first.reserved || 0));
        await sql.query(
          'UPDATE cohamy_crm.inventory_balances SET on_hand = $1, version = version + 1, updated_at = now() WHERE warehouse_id = $2 AND location_id = $3 AND product_id = $4 AND lot_id = $5',
          [String(minFirst), wh.id, first.location_id, productId, first.lot_id]
        );
        for (let i = 1; i < existingRows.length; i++) {
          const r = existingRows[i];
          await sql.query(
            'UPDATE cohamy_crm.inventory_balances SET on_hand = reserved, version = version + 1, updated_at = now() WHERE warehouse_id = $1 AND location_id = $2 AND product_id = $3 AND lot_id = $4',
            [wh.id, r.location_id, productId, r.lot_id]
          );
        }
      }

      return {ok: true, warehouseId: wh.id, productId, onHand: String(newOnHand)};
    }

    if (action === 'staff-submit-payment') {
      const clearanceId = String(input.clearanceId ?? '');
      const amount = Math.max(
        0,
        Math.round(Number(input.amount ?? input.submittedAmount ?? 0))
      );
      const paymentMethod = String(input.paymentMethod ?? 'BANK_TRANSFER');
      const reference = String(input.reference ?? '').trim();
      const warehouseId = input.warehouseId ? String(input.warehouseId) : null;
      if (!clearanceId || amount <= 0) throw new CrmError('INVALID_FIELDS', 400);

      const row = (
        await sql.query<{
          id: string;
          request_id: string;
          document_code: string;
          organization_name: string;
          list_subtotal: string;
          discount_percent: string;
          net_total: string;
        }>(
          `SELECT c.id, c.request_id, c.document_code, o.name AS organization_name,
                  c.list_subtotal::text, c.discount_percent::text, c.net_total::text
           FROM cohamy_crm.accounting_order_clearances c
           JOIN cohamy_crm.organizations o ON o.id = c.organization_id
           WHERE c.id = $1 FOR UPDATE OF c`,
          [clearanceId]
        )
      ).rows[0];
      if (!row) throw new CrmError('NOT_FOUND', 404);

      await sql.query(
        `UPDATE cohamy_crm.accounting_order_clearances
         SET staff_submitted_amount = $1,
             staff_payment_method = $2,
             staff_reference = $3,
             staff_submitted_by = $4,
             staff_submitted_by_name = $5,
             staff_submitted_at = now(),
             warehouse_id = COALESCE($6, warehouse_id),
             status = 'STAFF_SUBMITTED',
             updated_at = now()
         WHERE id = $7`,
        [
          String(amount),
          paymentMethod,
          reference,
          user.id,
          user.displayName,
          warehouseId,
          clearanceId,
        ]
      );

      await notifyRoles(sql, {
        roles: ['ACCOUNTANT', 'ADMIN', 'MANAGER'],
        eventKey: `staff_submit_payment:${clearanceId}:${Date.now()}`,
        entityType: 'order-clearance',
        entityId: clearanceId,
        message: `[Nhân viên hoàn thiện tiền đơn hàng] ${user.displayName} đã nộp ${amount.toLocaleString('vi-VN')} đ cho đơn ${row.document_code} (${row.organization_name}) · Giá gốc: ${Number(row.list_subtotal).toLocaleString('vi-VN')} đ · Giảm ${row.discount_percent}% · Phải thu: ${Number(row.net_total).toLocaleString('vi-VN')} đ. Chờ Kế toán kiểm tra để xuất kho.`,
      });

      return {ok: true, id: clearanceId, status: 'STAFF_SUBMITTED'};
    }

    if (action === 'accountant-verify-clearance') {
      if (!['ACCOUNTANT', 'ADMIN', 'MANAGER'].includes(user.role)) {
        throw new CrmError('FORBIDDEN', 403);
      }
      const clearanceId = String(input.clearanceId ?? '');
      const decision = String(input.decision ?? 'APPROVE') === 'REJECT' ? 'ACCOUNTANT_REJECTED' : 'ACCOUNTANT_CLEARED';
      const note = String(input.note ?? '').trim();
      const submittedOverride =
        input.submittedAmountOverride !== undefined
          ? Math.max(0, Math.round(Number(input.submittedAmountOverride || 0)))
          : null;

      const row = (
        await sql.query<{
          id: string;
          request_id: string;
          document_code: string;
          organization_name: string;
          discount_percent: string;
          net_total: string;
          staff_submitted_by: string | null;
        }>(
          `SELECT c.id, c.request_id, c.document_code, o.name AS organization_name,
                  c.discount_percent::text, c.net_total::text, c.staff_submitted_by
           FROM cohamy_crm.accounting_order_clearances c
           JOIN cohamy_crm.organizations o ON o.id = c.organization_id
           WHERE c.id = $1 FOR UPDATE OF c`,
          [clearanceId]
        )
      ).rows[0];
      if (!row) throw new CrmError('NOT_FOUND', 404);

      await sql.query(
        `UPDATE cohamy_crm.accounting_order_clearances
         SET status = $1,
             accountant_id = $2,
             accountant_name = $3,
             accountant_note = $4,
             staff_submitted_amount = COALESCE($6, staff_submitted_amount),
             accountant_cleared_at = now(),
             updated_at = now()
         WHERE id = $5`,
        [
          decision,
          user.id,
          user.displayName,
          note,
          clearanceId,
          submittedOverride !== null ? String(submittedOverride) : null,
        ]
      );

      await notifyRoles(sql, {
        roles: ['SALES', 'WAREHOUSE', 'WAREHOUSE_HN', 'WAREHOUSE_HCM', 'ADMIN', 'MANAGER'],
        eventKey: `kt_verify_clearance:${clearanceId}:${Date.now()}`,
        entityType: 'order-clearance',
        entityId: clearanceId,
        message:
          decision === 'ACCOUNTANT_CLEARED'
            ? `[Kế toán đã duyệt hoàn thiện đơn] Kế toán ${user.displayName} đã kiểm tra giá gốc, mức giảm ${row.discount_percent}% và xác nhận đủ tiền (${Number(row.net_total).toLocaleString('vi-VN')} đ) cho hóa đơn ${row.document_code} (${row.organization_name}). Nhân viên được phép lấy hàng ra khỏi kho đi giao khách!`
            : `[Kế toán yêu cầu bổ sung tiền] Hóa đơn ${row.document_code} (${row.organization_name}) chưa đủ điều kiện xuất kho: ${note || 'Cần kiểm tra lại số tiền nộp'}.`,
        extraUserIds: row.staff_submitted_by ? [row.staff_submitted_by] : [],
      });

      return {ok: true, id: clearanceId, status: decision};
    }

    if (action === 'confirm-warehouse-pickup') {
      const clearanceId = String(input.clearanceId ?? '');
      const warehouseId = input.warehouseId ? String(input.warehouseId) : null;
      const row = (
        await sql.query<{
          id: string;
          status: string;
          document_code: string;
          organization_name: string;
        }>(
          `SELECT c.id, c.status, c.document_code, o.name AS organization_name
           FROM cohamy_crm.accounting_order_clearances c
           JOIN cohamy_crm.organizations o ON o.id = c.organization_id
           WHERE c.id = $1 FOR UPDATE OF c`,
          [clearanceId]
        )
      ).rows[0];
      if (!row) throw new CrmError('NOT_FOUND', 404);
      if (row.status !== 'ACCOUNTANT_CLEARED') {
        throw new CrmError('ACCOUNTANT_CLEARANCE_REQUIRED', 409);
      }

      await sql.query(
        `UPDATE cohamy_crm.accounting_order_clearances
         SET status = 'PICKED_UP_DELIVERED',
             warehouse_id = COALESCE($1, warehouse_id),
             picked_up_at = now(),
             picked_up_by_name = $2,
             updated_at = now()
         WHERE id = $3`,
        [warehouseId, user.displayName, clearanceId]
      );

      await notifyRoles(sql, {
        roles: ['ACCOUNTANT', 'ADMIN', 'MANAGER'],
        eventKey: `pickup_delivered:${clearanceId}:${Date.now()}`,
        entityType: 'order-clearance',
        entityId: clearanceId,
        message: `[Đã lấy hàng khỏi kho & đi giao] Nhân viên ${user.displayName} đã lấy hàng khỏi kho và đi giao hóa đơn ${row.document_code} (${row.organization_name}).`,
      });

      return {ok: true, id: clearanceId, status: 'PICKED_UP_DELIVERED'};
    }

    if (action === 'create-factory-order' || action === 'create-factory-dispatch') {
      if (!['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(user.role)) {
        throw new CrmError('FORBIDDEN', 403);
      }
      const stage = action === 'create-factory-order' ? 'FACTORY_ORDER' : 'FACTORY_DISPATCH';
      const warehouseId = String(input.warehouseId ?? '');
      const parentId =
        input.parentId || input.parentInvoiceId
          ? String(input.parentId ?? input.parentInvoiceId)
          : null;
      const factoryName = String(input.factoryName ?? 'Nhà máy Sản xuất Cohamy').trim() || 'Nhà máy Sản xuất Cohamy';
      const note = String(input.note ?? '').trim();
      const rawLines = Array.isArray(input.lines) ? (input.lines as Array<Record<string, unknown>>) : [];

      const wh = (
        await sql.query<{id: string; code: string; name: string; region: string | null}>(
          'SELECT id, code, name, region FROM cohamy_crm.warehouses WHERE id = $1',
          [warehouseId]
        )
      ).rows[0];
      if (!wh) throw new CrmError('INVALID_FIELDS', 400);

      const lines: FactoryInvoiceLine[] = [];
      let totalOrd = 0;
      let totalDisp = 0;
      let totalAmt = 0;

      for (const item of rawLines) {
        const ordQty = Math.max(0, Number(item.orderedQty ?? item.quantity ?? 0));
        const dispQty =
          stage === 'FACTORY_DISPATCH'
            ? Math.max(0, Number(item.dispatchedQty ?? item.quantity ?? ordQty))
            : 0;
        const qty = stage === 'FACTORY_ORDER' ? ordQty : dispQty;
        if (qty <= 0) continue;
        const prod = (
          await sql.query<{id: string; sku: string; name: string; stock_unit: string; retail_price: string}>(
            "SELECT id, sku, name, COALESCE(stock_unit, 'Gói') AS stock_unit, retail_price::text FROM cohamy_crm.products WHERE id::text = $1 OR sku = $1 LIMIT 1",
            [String(item.productId ?? item.productIdOrSku ?? '')]
          )
        ).rows[0];
        if (!prod) continue;
        const unitPrice = Math.max(
          0,
          Math.round(Number(item.factoryUnitPrice ?? item.unitCost ?? prod.retail_price ?? 0))
        );
        const lineTotal = Math.round(qty * unitPrice);
        totalOrd += ordQty;
        totalDisp += dispQty;
        totalAmt += lineTotal;
        lines.push({
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          unitLabel: prod.stock_unit,
          orderedQty: ordQty,
          dispatchedQty: dispQty,
          receivedQty: 0,
          discrepancyQty: 0,
          factoryUnitPrice: unitPrice,
          lineTotal,
          receivedTotal: 0,
          note: String(item.note ?? ''),
        });
      }

      if (!lines.length) throw new CrmError('INVALID_FIELDS', 400);

      const id = randomUUID();
      const prefix = stage === 'FACTORY_ORDER' ? 'NM-DAT' : 'NM-XUAT';
      const code = `${prefix}-${vietnamBusinessDate(new Date())}-${id.slice(0, 6).toUpperCase()}`;
      const status = stage === 'FACTORY_ORDER' ? 'ISSUED' : 'DISPATCHED';

      await sql.query(
        `INSERT INTO cohamy_crm.factory_invoices(
           id, code, stage, parent_id, warehouse_id, factory_name, status, lines,
           total_ordered_qty, total_dispatched_qty, total_received_qty, total_amount,
           note, created_by, created_by_name, created_by_role
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,0,$11,$12,$13,$14,$15)`,
        [
          id,
          code,
          stage,
          parentId,
          wh.id,
          factoryName,
          status,
          JSON.stringify(lines),
          String(totalOrd),
          String(totalDisp),
          String(totalAmt),
          note,
          user.id,
          user.displayName,
          user.role,
        ]
      );

      if (parentId && stage === 'FACTORY_DISPATCH') {
        await sql.query(
          "UPDATE cohamy_crm.factory_invoices SET status = 'DISPATCHED', updated_at = now() WHERE id = $1",
          [parentId]
        );
      }

      const whRoles = warehouseNotifyRolesForRegion(wh.region, wh.code);
      const msg =
        stage === 'FACTORY_ORDER'
          ? `[Hóa đơn Admin đặt hàng Nhà máy] ${code} · Kho nhận: ${wh.name} (${wh.code}) · Số lượng: ${totalOrd.toLocaleString('vi-VN')} gói · Tổng giá trị: ${totalAmt.toLocaleString('vi-VN')} đ (Gửi Kế toán & Kho theo dõi).`
          : `[Hóa đơn Nhà máy xuất hàng đẩy về Kho] ${code} · Đẩy về: ${wh.name} (${wh.code}) · Số lượng xuất: ${totalDisp.toLocaleString('vi-VN')} gói · Giá trị: ${totalAmt.toLocaleString('vi-VN')} đ (Chờ Thủ kho đối chiếu & Kế toán kiểm tra).`;

      await notifyRoles(sql, {
        roles: ['ACCOUNTANT', 'ADMIN', 'MANAGER', ...whRoles],
        eventKey: `factory_inv:${id}:${stage}`,
        entityType: 'factory-invoice',
        entityId: id,
        message: msg,
      });

      return {ok: true, id, code, stage};
    }

    if (action === 'create-warehouse-reconciliation') {
      if (!['ADMIN', 'MANAGER', 'WAREHOUSE', 'WAREHOUSE_HN', 'WAREHOUSE_HCM'].includes(user.role)) {
        throw new CrmError('FORBIDDEN', 403);
      }
      const dispatchInvoiceId = String(input.dispatchInvoiceId ?? input.parentInvoiceId ?? '');
      const note = String(input.note ?? '').trim();
      const rawInputLines = Array.isArray(input.lines)
        ? (input.lines as Array<Record<string, unknown>>)
        : Array.isArray(input.receivedLines)
        ? (input.receivedLines as Array<Record<string, unknown>>)
        : [];

      let parent: {
        id: string;
        code: string;
        warehouse_id: string;
        factory_name: string;
        lines: FactoryInvoiceLine[];
      } | null = null;

      if (dispatchInvoiceId) {
        parent =
          (
            await sql.query<{
              id: string;
              code: string;
              warehouse_id: string;
              factory_name: string;
              lines: FactoryInvoiceLine[];
            }>(
              'SELECT id, code, warehouse_id, factory_name, lines FROM cohamy_crm.factory_invoices WHERE id = $1 FOR UPDATE',
              [dispatchInvoiceId]
            )
          ).rows[0] ?? null;
      }

      const targetWarehouseId = parent?.warehouse_id ?? String(input.warehouseId ?? '');
      const wh = (
        await sql.query<{id: string; code: string; name: string; region: string | null}>(
          'SELECT id, code, name, region FROM cohamy_crm.warehouses WHERE id = $1',
          [targetWarehouseId]
        )
      ).rows[0];
      if (!wh) throw new CrmError('INVALID_FIELDS', 400);
      assertUserWarehouseAccess(user, wh);

      let totalOrd = 0;
      let totalDisp = 0;
      let totalRec = 0;
      let totalAmt = 0;
      let hasDiscrepancy = false;

      let reconciledLines: FactoryInvoiceLine[] = [];
      if (parent && Array.isArray(parent.lines) && parent.lines.length > 0) {
        reconciledLines = parent.lines.map(line => {
          const match = rawInputLines.find(
            x =>
              String(x.productId ?? '') === line.productId ||
              String(x.sku ?? '') === line.sku
          );
          const dispQty = Number(line.dispatchedQty || line.orderedQty || 0);
          const recQty = match
            ? Math.max(0, Number(match.receivedQty ?? dispQty))
            : dispQty;
          const diff = recQty - dispQty;
          if (diff !== 0) hasDiscrepancy = true;
          const unitCost = Number(
            match?.unitCost ?? match?.factoryUnitPrice ?? line.factoryUnitPrice ?? 0
          );
          const recTotal = Math.round(recQty * unitCost);
          totalOrd += Number(line.orderedQty || dispQty);
          totalDisp += dispQty;
          totalRec += recQty;
          totalAmt += recTotal;
          return {
            ...line,
            factoryUnitPrice: unitCost,
            dispatchedQty: dispQty,
            receivedQty: recQty,
            discrepancyQty: diff,
            receivedTotal: recTotal,
            lineTotal: recTotal,
            note: String(match?.note ?? line.note ?? ''),
          };
        });
      } else {
        for (const item of rawInputLines) {
          const recQty = Math.max(0, Number(item.receivedQty ?? item.quantity ?? 0));
          const dispQty = Math.max(0, Number(item.dispatchedQty ?? recQty));
          const ordQty = Math.max(0, Number(item.orderedQty ?? dispQty));
          if (recQty <= 0 && dispQty <= 0) continue;
          const prod = (
            await sql.query<{id: string; sku: string; name: string; stock_unit: string; retail_price: string}>(
              "SELECT id, sku, name, COALESCE(stock_unit, 'Gói') AS stock_unit, retail_price::text FROM cohamy_crm.products WHERE id::text = $1 OR sku = $1 LIMIT 1",
              [String(item.productId ?? item.productIdOrSku ?? '')]
            )
          ).rows[0];
          if (!prod) continue;
          const unitCost = Math.max(
            0,
            Math.round(Number(item.unitCost ?? item.factoryUnitPrice ?? prod.retail_price ?? 0))
          );
          const diff = recQty - dispQty;
          if (diff !== 0) hasDiscrepancy = true;
          const recTotal = Math.round(recQty * unitCost);
          totalOrd += ordQty;
          totalDisp += dispQty;
          totalRec += recQty;
          totalAmt += recTotal;
          reconciledLines.push({
            productId: prod.id,
            sku: prod.sku,
            name: prod.name,
            unitLabel: prod.stock_unit,
            orderedQty: ordQty,
            dispatchedQty: dispQty,
            receivedQty: recQty,
            discrepancyQty: diff,
            factoryUnitPrice: unitCost,
            lineTotal: recTotal,
            receivedTotal: recTotal,
            note: String(item.note ?? ''),
          });
        }
      }

      if (!reconciledLines.length) throw new CrmError('INVALID_FIELDS', 400);

      const id = randomUUID();
      const code = `KHO-DC-${vietnamBusinessDate(new Date())}-${id.slice(0, 6).toUpperCase()}`;
      const status = hasDiscrepancy ? 'DISCREPANCY' : 'RECONCILED';

      await sql.query(
        `INSERT INTO cohamy_crm.factory_invoices(
           id, code, stage, parent_id, warehouse_id, factory_name, status, lines,
           total_ordered_qty, total_dispatched_qty, total_received_qty, total_amount,
           note, created_by, created_by_name, created_by_role,
           reconciled_by, reconciled_by_name, reconciled_at
         ) VALUES ($1,$2,'WAREHOUSE_RECONCILIATION',$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$13,$14,now())`,
        [
          id,
          code,
          parent?.id ?? null,
          wh.id,
          parent?.factory_name ?? 'Nhà máy Sản xuất Cohamy',
          status,
          JSON.stringify(reconciledLines),
          String(totalOrd),
          String(totalDisp),
          String(totalRec),
          String(totalAmt),
          note,
          user.id,
          user.displayName,
          user.role,
        ]
      );

      if (parent) {
        await sql.query(
          'UPDATE cohamy_crm.factory_invoices SET status = $1, reconciled_by = $2, reconciled_by_name = $3, reconciled_at = now(), updated_at = now() WHERE id = $4',
          [status, user.id, user.displayName, parent.id]
        );
      }

      // Update warehouse inventory balance for received quantities if location exists
      let loc = (
        await sql.query<{id: string}>(
          "SELECT id FROM cohamy_crm.warehouse_locations WHERE warehouse_id = $1 AND active AND kind = 'PICK' ORDER BY created_at LIMIT 1",
          [wh.id]
        )
      ).rows[0];
      if (!loc) {
        const locId = randomUUID();
        await sql.query(
          "INSERT INTO cohamy_crm.warehouse_locations(id, warehouse_id, code, name, kind, active) VALUES ($1, $2, $3, $4, 'PICK', true)",
          [locId, wh.id, `KE-${wh.code}-01`, `Kệ chính ${wh.name}`]
        );
        loc = {id: locId};
      }

      for (const rl of reconciledLines) {
        if (rl.receivedQty <= 0) continue;
        let lot = (
          await sql.query<{id: string}>(
            "SELECT id FROM cohamy_crm.inventory_lots WHERE product_id = $1 AND status = 'AVAILABLE' ORDER BY created_at LIMIT 1",
            [rl.productId]
          )
        ).rows[0];
        if (!lot) {
          const lotId = randomUUID();
          await sql.query(
            "INSERT INTO cohamy_crm.inventory_lots(id, product_id, code, status) VALUES ($1, $2, $3, 'AVAILABLE')",
            [lotId, rl.productId, `LOT-${code}`]
          );
          lot = {id: lotId};
        }
        await sql.query(
          `INSERT INTO cohamy_crm.inventory_balances(warehouse_id, location_id, product_id, lot_id, on_hand, reserved)
           VALUES ($1, $2, $3, $4, $5, 0)
           ON CONFLICT (warehouse_id, location_id, product_id, lot_id)
           DO UPDATE SET on_hand = cohamy_crm.inventory_balances.on_hand + EXCLUDED.on_hand, version = cohamy_crm.inventory_balances.version + 1, updated_at = now()`,
          [wh.id, loc.id, rl.productId, lot.id, String(rl.receivedQty)]
        );
      }

      await notifyRoles(sql, {
        roles: ['ACCOUNTANT', 'ADMIN', 'MANAGER'],
        eventKey: `wh_reconcile:${id}`,
        entityType: 'warehouse-reconciliation',
        entityId: id,
        message: `[Hóa đơn Đối chiếu Kho - Nhà máy] Quản lý ${wh.name} (${user.displayName}) đã lập hóa đơn đối chiếu ${code}${parent ? ` (từ ${parent.code})` : ''}: Nhà máy xuất ${totalDisp.toLocaleString('vi-VN')} gói / Kho thực nhận ${totalRec.toLocaleString('vi-VN')} gói (${hasDiscrepancy ? 'CÓ CHÊNH LỆCH' : 'Khớp 100%'}) · Công nợ Kho với Nhà máy: ${totalAmt.toLocaleString('vi-VN')} đ.`,
      });

      return {ok: true, id, code, status};
    }

    if (action === 'accountant-verify-factory-invoice') {
      if (!['ACCOUNTANT', 'ADMIN', 'MANAGER'].includes(user.role)) {
        throw new CrmError('FORBIDDEN', 403);
      }
      const invoiceId = String(input.invoiceId ?? '');
      const paidAdd = Math.max(0, Math.round(Number(input.paidAmount ?? 0)));
      const inv = (
        await sql.query<{id: string; code: string; total_amount: string; paid_amount: string; status: string}>(
          'SELECT id, code, total_amount::text, paid_amount::text, status FROM cohamy_crm.factory_invoices WHERE id = $1 FOR UPDATE',
          [invoiceId]
        )
      ).rows[0];
      if (!inv) throw new CrmError('NOT_FOUND', 404);

      const nextPaid = BigInt(inv.paid_amount || '0') + BigInt(paidAdd);
      const totalAmt = BigInt(inv.total_amount || '0');
      const nextStatus =
        paidAdd > 0
          ? nextPaid >= totalAmt
            ? 'PAID'
            : 'PARTIAL_PAID'
          : inv.status;

      await sql.query(
        `UPDATE cohamy_crm.factory_invoices
         SET accountant_verified = true,
             accountant_verified_by = $1,
             accountant_verified_by_name = $2,
             accountant_verified_at = now(),
             paid_amount = $3,
             status = $4,
             updated_at = now()
         WHERE id = $5`,
        [user.id, user.displayName, nextPaid.toString(), nextStatus, invoiceId]
      );

      return {ok: true, id: invoiceId, paidAmount: nextPaid.toString(), status: nextStatus};
    }

    throw new CrmError('INVALID_ACTION', 400);
  });
}
