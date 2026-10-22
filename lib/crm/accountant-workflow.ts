import 'server-only';
import {randomUUID} from 'node:crypto';
import {database, type Sql} from './db';
import {CrmError} from './permissions';
import {enqueueNotification} from './workspace';
import {vietnamBusinessDate} from './commercial-common';
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
  creatorName: string;
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
  `);

  // Ensure both KHO-HN (Kho Hà Nội) and KHO-HCM (Kho TP.HCM) exist under Cohamy
  const cohamyOrg = (
    await sql.query<{id: string}>("SELECT id FROM cohamy_crm.organizations WHERE kind='COHAMY' ORDER BY created_at LIMIT 1")
  ).rows[0];
  if (cohamyOrg) {
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
    entityType: 'commercial-request' | 'sales-order' | 'factory-invoice' | 'warehouse-reconciliation' | 'order-clearance';
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
      creator_id: string;
      snapshot: Record<string, unknown>;
      sales_order_id: string | null;
      sales_order_code: string | null;
    }>(
      `SELECT r.id, r.code, r.organization_id, o.name AS organization_name, r.creator_id,
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

  const defaultWh = (
    await sql.query<{id: string}>("SELECT id FROM cohamy_crm.warehouses WHERE code LIKE '%HN%' OR region='NORTH' ORDER BY created_at LIMIT 1")
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

  const msg = `[Hóa đơn khách đặt hàng] ${row.sales_order_code ?? row.code} · Khách: ${row.organization_name} · Giá gốc: ${totals.listSubtotal.toLocaleString('vi-VN')} đ · Chiết khấu: ${totals.discountPercent}% · Phải thu: ${totals.netTotal.toLocaleString('vi-VN')} đ (Đã gửi cho Nhân viên & Kế toán).`;
  await notifyRoles(sql, {
    roles: ['ACCOUNTANT', 'ADMIN', 'MANAGER', 'SALES'],
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

  const [clearanceRows, factoryRows, warehouses, products, stockRows, notifRows] = await Promise.all([
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
      creator_name: string;
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
              c.warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name,
              COALESCE(u.display_name, 'Nhân viên') AS creator_name,
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
  ]);

  const orderClearances: OrderClearanceRecord[] = clearanceRows.rows.map(r => {
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
      creatorName: r.creator_name,
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

  const factoryInvoices: FactoryInvoiceRecord[] = factoryRows.rows.map(f => {
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

  const warehouseStocks: WarehouseStockSummaryRow[] = stockRows.rows.map(s => {
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

  const warehouseFactoryDebts: WarehouseFactoryDebtRow[] = warehouses.rows.map(w => {
    const whInvoices = factoryInvoices.filter(f => f.warehouseId === w.id);
    const orders = whInvoices.filter(f => f.stage === 'FACTORY_ORDER');
    const dispatches = whInvoices.filter(f => f.stage === 'FACTORY_DISPATCH');
    const reconciliations = whInvoices.filter(f => f.stage === 'WAREHOUSE_RECONCILIATION');

    const totalOrderedPackages = orders.reduce((s, x) => s + Number(x.totalOrderedQty || 0), 0);
    const totalDispatchedPackages = dispatches.reduce((s, x) => s + Number(x.totalDispatchedQty || 0), 0);
    const totalReceivedPackages = reconciliations.reduce((s, x) => s + Number(x.totalReceivedQty || 0), 0);

    const totalDispatchedAmount = dispatches.reduce((s, x) => s + BigInt(x.totalAmount || '0'), 0n);
    const totalReconciledAmount = reconciliations.reduce((s, x) => s + BigInt(x.totalAmount || '0'), 0n);
    // Debt to factory is based on reconciled invoices (or dispatched invoices if not yet reconciled)
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

  return {
    orderClearances,
    factoryInvoices,
    warehouseStocks,
    warehouseFactoryDebts,
    warehouses: warehouses.rows,
    products: products.rows,
    notifications: notifRows.rows,
  };
}

export type AccountantWorkspaceData = Awaited<ReturnType<typeof getAccountantWorkspaceData>>;

export async function handleAccountantWorkflowAction(
  user: Principal,
  action: string,
  input: Record<string, unknown>
) {
  if (user.area !== 'crm') throw new CrmError('FORBIDDEN', 403);
  const db = await database();
  return db.transaction(async sql => {
    await ensureAccountantWorkflowSchema(sql);

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
        await sql.query<{id: string; code: string; name: string}>(
          'SELECT id, code, name FROM cohamy_crm.warehouses WHERE id = $1',
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

      const msg =
        stage === 'FACTORY_ORDER'
          ? `[Hóa đơn Admin đặt hàng Nhà máy] ${code} · Kho nhận: ${wh.name} (${wh.code}) · Số lượng: ${totalOrd.toLocaleString('vi-VN')} gói · Tổng giá trị: ${totalAmt.toLocaleString('vi-VN')} đ (Gửi Kế toán & Kho theo dõi).`
          : `[Hóa đơn Nhà máy xuất hàng đẩy về Kho] ${code} · Đẩy về: ${wh.name} (${wh.code}) · Số lượng xuất: ${totalDisp.toLocaleString('vi-VN')} gói · Giá trị: ${totalAmt.toLocaleString('vi-VN')} đ (Chờ Quản lý Kho đối chiếu & Kế toán kiểm tra).`;

      await notifyRoles(sql, {
        roles: ['ACCOUNTANT', 'ADMIN', 'MANAGER', 'WAREHOUSE', 'WAREHOUSE_HN', 'WAREHOUSE_HCM'],
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
        await sql.query<{id: string; code: string; name: string}>(
          'SELECT id, code, name FROM cohamy_crm.warehouses WHERE id = $1',
          [targetWarehouseId]
        )
      ).rows[0];
      if (!wh) throw new CrmError('INVALID_FIELDS', 400);

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
