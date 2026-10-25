import 'server-only';
import {randomUUID} from 'node:crypto';
import {database, type Sql} from './db';
import {audit as baseAudit} from './auth';
import {CrmError, warehouseRoleRegion} from './permissions';
import {enqueueNotification} from './workspace';
import {commercialDigest, vietnamBusinessDate} from './commercial-common';
import type {Principal} from './types';

async function audit(
  sql: Sql,
  actorId: string | null,
  action: string,
  entityTypeOrId: string,
  entityIdOrPayload: unknown = {},
  maybePayload?: unknown
) {
  if (maybePayload !== undefined && typeof entityIdOrPayload === 'string') {
    await baseAudit(sql, actorId, action, entityIdOrPayload, {
      entityType: entityTypeOrId,
      ...(typeof maybePayload === 'object' && maybePayload !== null
        ? (maybePayload as Record<string, unknown>)
        : {}),
    });
    return;
  }
  await baseAudit(sql, actorId, action, entityTypeOrId, entityIdOrPayload);
}

export interface AttachedDocumentSummary {
  id: string;
  versionId: string;
  title: string;
  docCategory: string;
  filename: string;
  mime: string;
  size: number;
  createdAt: string;
}

export interface OrderClearanceLine {
  productId?: string;
  sku: string;
  name: string;
  weightLabel?: string;
  unitLabel: string;
  quantity: number;
  baseQuantity: number;
  costUnitPrice?: number;
  listUnitPrice: number;
  discountPercent: number;
  netUnitPrice: number;
  listLineTotal: number;
  discountLineAmount: number;
  netLineTotal: number;
  vatRate?: number;
  vatLineAmount?: number;
  grossLineTotal?: number;
}

export interface OrderPaymentTransactionRecord {
  id: string;
  code: string;
  clearanceId: string;
  orderId: string | null;
  documentCode: string;
  organizationId: string;
  organizationName: string;
  paymentDate: string;
  amount: string;
  bankAccount: string;
  referenceCode: string;
  transferContent: string;
  paymentMethod: string;
  proofDocumentId: string | null;
  proofVersionId?: string | null;
  proofFilename?: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  confirmedByName: string;
  confirmedAt: string | null;
  createdByName: string;
  createdAt: string;
}

export interface OrderClearanceRecord {
  id: string;
  requestId: string;
  orderId: string | null;
  documentCode: string;
  salesOrderCode: string | null;
  contractCode?: string;
  organizationId: string;
  organizationCode?: string;
  organizationName: string;
  organizationTaxCode?: string;
  organizationAddress?: string;
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
  vatRate?: string;
  vatAmount?: string;
  grossTotal?: string;
  paidAmount?: string;
  remainingDebt?: string;
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
  warehouseIssueStatus?: 'NOT_ISSUED' | 'PARTIAL_ISSUED' | 'ISSUED' | 'DELIVERED';
  vatInvoiceStatus?: 'UNISSUED' | 'ISSUED_MISSING_FILES' | 'ISSUED' | 'ADJUSTMENT_REQUESTED' | 'ADJUSTED' | 'REPLACED';
  vatInvoiceId?: string | null;
  vatInvoiceNumber?: string;
  vatInvoiceSymbol?: string;
  vatIssuedDate?: string | null;
  handoverCount?: number;
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
  payments?: OrderPaymentTransactionRecord[];
  documents?: AttachedDocumentSummary[];
}

export interface WarehouseHandoverLine {
  productId: string;
  sku: string;
  name: string;
  weightLabel?: string;
  unitLabel: string;
  orderedQuantity?: number;
  previouslyIssuedQuantity?: number;
  quantity: number;
  remainingQuantity?: number;
  costUnitPrice?: number;
  listUnitPrice?: number;
  discountPercent?: number;
  discountAmount?: number;
  unitPrice: number;
  netLineTotal?: number;
  vatRate?: number;
  vatAmount?: number;
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
  salesOrderId?: string | null;
  organizationId?: string | null;
  organizationCode?: string;
  orderCode: string;
  contractCode?: string;
  issuedDate?: string;
  recipientType: 'STAFF' | 'CUSTOMER';
  recipientName: string;
  recipientPhone: string;
  organizationName: string;
  status: 'HANDED_OVER' | 'CONFIRMED';
  deliveryStatus?: 'ISSUED' | 'PARTIAL_ISSUED' | 'IN_TRANSIT' | 'DELIVERED';
  lines: WarehouseHandoverLine[];
  totalQuantity: string;
  listSubtotal?: string;
  discountPercent?: string;
  discountAmount?: string;
  netSubtotal?: string;
  vatAmount?: string;
  totalAmount: string;
  costTotal?: string;
  inventoryDocumentId?: string | null;
  note: string;
  createdByName: string;
  createdByRole: string;
  createdAt: string;
  documents?: AttachedDocumentSummary[];
}

export interface PartnerOptionRecord {
  id: string;
  code: string;
  name: string;
  kind: string;
  phone: string;
  email?: string;
  businessId?: string;
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
  weightLabel?: string;
  unitLabel: string;
  orderedQty: number;
  dispatchedQty: number;
  receivedQty: number;
  missingQty?: number;
  excessQty?: number;
  damagedQty?: number;
  discrepancyQty: number;
  factoryUnitPrice: number;
  discountPercent?: number;
  discountAmount?: number;
  lineTotal: number;
  receivedTotal: number;
  note: string;
}

export interface FactoryInvoiceRecord {
  id: string;
  code: string;
  stage: 'FACTORY_ORDER' | 'FACTORY_DISPATCH' | 'WAREHOUSE_RECONCILIATION';
  voucherType?: 'INTERNAL_TRANSFER' | 'SUPPLIER_PURCHASE';
  supplierId?: string | null;
  supplierName?: string | null;
  parentId: string | null;
  parentCode: string | null;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseRegion: string | null;
  factoryName: string;
  dispatchedDate?: string;
  receivedDate?: string | null;
  status: 'ISSUED' | 'DISPATCHED' | 'RECONCILED' | 'DISCREPANCY' | 'PARTIAL_PAID' | 'PAID';
  reconciliationStatus?: 'PENDING_RECEIPT' | 'MATCHED' | 'DISCREPANCY' | 'RESOLVING_DISCREPANCY' | 'COMPLETED';
  lines: FactoryInvoiceLine[];
  totalOrderedQty: string;
  totalDispatchedQty: string;
  totalReceivedQty: string;
  subtotalAmount?: string;
  discountAmount?: string;
  totalAmount: string;
  paidAmount: string;
  remainingDebt: string;
  inventoryDocumentId?: string | null;
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
  documents?: AttachedDocumentSummary[];
}

export interface VatInvoiceRecord {
  id: string;
  code: string;
  clearanceId: string | null;
  orderId: string | null;
  requestId: string | null;
  orderCode: string;
  contractCode: string;
  handoverInvoiceId: string | null;
  handoverCode: string | null;
  organizationId: string;
  organizationCode: string;
  organizationName: string;
  warehouseId: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  issuedWarehouseDate: string | null;
  invoiceNumber: string;
  invoiceSymbol: string;
  issuedDate: string | null;
  invoiceType: 'ORIGINAL' | 'ADJUSTMENT' | 'REPLACEMENT';
  parentVatInvoiceId: string | null;
  parentInvoiceNumber: string | null;
  sellerInfo: Record<string, string>;
  buyerName: string;
  buyerTaxCode: string;
  buyerAddress: string;
  buyerEmail: string;
  lines: WarehouseHandoverLine[];
  listSubtotal: string;
  discountAmount: string;
  netAmount: string;
  vatAmount: string;
  totalAmount: string;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  paidAmount: string;
  remainingDebt: string;
  status: 'UNISSUED' | 'ISSUED_MISSING_FILES' | 'ISSUED' | 'ADJUSTMENT_REQUESTED' | 'ADJUSTED' | 'REPLACED';
  pdfDocumentId: string | null;
  pdfVersionId: string | null;
  pdfFilename: string | null;
  xmlDocumentId: string | null;
  xmlVersionId: string | null;
  xmlFilename: string | null;
  extraDocuments: AttachedDocumentSummary[];
  adjustmentReason: string;
  note: string;
  createdByName: string;
  updatedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerTaxProfileRecord {
  organizationId: string;
  organizationCode: string;
  organizationName: string;
  organizationKind: string;
  phone: string;
  email: string;
  buyerType: 'COMPANY' | 'INDIVIDUAL';
  legalName: string;
  taxCode: string;
  invoiceAddress: string;
  invoiceEmail: string;
  representativeName: string;
  personalIdNumber: string;
  personalIdConsentBasis: string;
  contractCode: string;
  note: string;
  updatedByName: string;
  updatedAt: string | null;
  documents: AttachedDocumentSummary[];
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
  costPrice?: string;
  vatRate?: string;
  onHand: string;
  reserved: string;
  available: string;
  inTransit?: string;
  totalInbound?: string;
  totalOutbound?: string;
  stockValue: string;
  costStockValue?: string;
}

export interface WarehouseMovementHistoryRow {
  id: string;
  documentCode: string;
  documentKind: 'FACTORY_RECEIPT' | 'CUSTOMER_ISSUE' | 'INVENTORY_DOC';
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  sku: string;
  productName: string;
  quantityDelta: string;
  unitLabel: string;
  unitAmount: string;
  totalAmount: string;
  actorName: string;
  referenceCode: string;
  createdAt: string;
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
      ALTER TABLE cohamy_crm.memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
      ALTER TABLE cohamy_crm.memberships ADD CONSTRAINT memberships_role_check
        CHECK (role IN ('ADMIN','MANAGER','SALES','FACTORY','WAREHOUSE','WAREHOUSE_HCM','WAREHOUSE_HN','ACCOUNTANT','DEALER_OWNER','DEALER_STAFF'));

      ALTER TABLE cohamy_crm.notifications DROP CONSTRAINT IF EXISTS notifications_entity_type_check;
      ALTER TABLE cohamy_crm.notifications ADD CONSTRAINT notifications_entity_type_check
        CHECK (entity_type IN (
          'partner','order','product','account','ticket','commercial-request','sales-order',
          'delivery','return-request','receivable','payment','cash-request','report','deal','request',
          'factory-invoice','warehouse-reconciliation','order-clearance','vat-invoice','warehouse-handover'
        ));

      ALTER TABLE cohamy_crm.private_documents DROP CONSTRAINT IF EXISTS private_documents_entity_type_check;
      ALTER TABLE cohamy_crm.private_documents ADD CONSTRAINT private_documents_entity_type_check
        CHECK (entity_type IN (
          'partner','order','ticket','library','visit','payment','deal',
          'factory-invoice','warehouse-reconciliation','warehouse-handover','vat-invoice','order-clearance'
        ));

      ALTER TABLE cohamy_crm.private_documents
        ADD COLUMN IF NOT EXISTS doc_category text NOT NULL DEFAULT 'GENERAL';

      ALTER TABLE cohamy_crm.products
        ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) NOT NULL DEFAULT 8.00,
        ADD COLUMN IF NOT EXISTS cost_price numeric(30,0) NOT NULL DEFAULT 0;

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

      ALTER TABLE cohamy_crm.factory_invoices
        ADD COLUMN IF NOT EXISTS voucher_type text NOT NULL DEFAULT 'INTERNAL_TRANSFER',
        ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES cohamy_crm.organizations(id),
        ADD COLUMN IF NOT EXISTS dispatched_date date NOT NULL DEFAULT CURRENT_DATE,
        ADD COLUMN IF NOT EXISTS received_date date,
        ADD COLUMN IF NOT EXISTS subtotal_amount numeric(30,0) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS discount_amount numeric(30,0) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS reconciliation_status text NOT NULL DEFAULT 'PENDING_RECEIPT',
        ADD COLUMN IF NOT EXISTS inventory_document_id uuid REFERENCES cohamy_crm.inventory_documents(id),
        ADD COLUMN IF NOT EXISTS idempotency_key text;

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
        ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS contract_code text NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) NOT NULL DEFAULT 8.00,
        ADD COLUMN IF NOT EXISTS vat_amount numeric(30,0) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS gross_total numeric(30,0) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS paid_amount numeric(30,0) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS remaining_debt numeric(30,0) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'UNPAID',
        ADD COLUMN IF NOT EXISTS warehouse_issue_status text NOT NULL DEFAULT 'NOT_ISSUED',
        ADD COLUMN IF NOT EXISTS vat_invoice_status text NOT NULL DEFAULT 'UNISSUED',
        ADD COLUMN IF NOT EXISTS immutable_lines jsonb NOT NULL DEFAULT '[]'::jsonb;

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

      ALTER TABLE cohamy_crm.warehouse_handover_invoices
        ADD COLUMN IF NOT EXISTS sales_order_id uuid REFERENCES cohamy_crm.sales_orders(id),
        ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES cohamy_crm.organizations(id),
        ADD COLUMN IF NOT EXISTS contract_code text NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS issued_date date NOT NULL DEFAULT CURRENT_DATE,
        ADD COLUMN IF NOT EXISTS list_subtotal numeric(30,0) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS discount_percent numeric(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS discount_amount numeric(30,0) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS net_subtotal numeric(30,0) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS vat_amount numeric(30,0) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cost_total numeric(30,0) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'ISSUED',
        ADD COLUMN IF NOT EXISTS inventory_document_id uuid REFERENCES cohamy_crm.inventory_documents(id),
        ADD COLUMN IF NOT EXISTS idempotency_key text;

      CREATE TABLE IF NOT EXISTS cohamy_crm.order_payment_transactions (
        id uuid PRIMARY KEY,
        code text NOT NULL UNIQUE,
        clearance_id uuid NOT NULL REFERENCES cohamy_crm.accounting_order_clearances(id),
        order_id uuid REFERENCES cohamy_crm.sales_orders(id),
        organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
        payment_date timestamptz NOT NULL DEFAULT now(),
        amount numeric(30,0) NOT NULL CHECK (amount > 0),
        bank_account text NOT NULL DEFAULT '',
        reference_code text NOT NULL DEFAULT '',
        transfer_content text NOT NULL DEFAULT '',
        payment_method text NOT NULL DEFAULT 'BANK_TRANSFER',
        proof_document_id uuid REFERENCES cohamy_crm.private_documents(id),
        status text NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED')),
        confirmed_by uuid REFERENCES cohamy_crm.users(id),
        confirmed_by_name text NOT NULL DEFAULT '',
        confirmed_at timestamptz,
        created_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
        created_by_name text NOT NULL DEFAULT '',
        idempotency_key text UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS cohamy_crm.vat_invoices (
        id uuid PRIMARY KEY,
        code text NOT NULL UNIQUE,
        clearance_id uuid REFERENCES cohamy_crm.accounting_order_clearances(id),
        order_id uuid REFERENCES cohamy_crm.sales_orders(id),
        request_id uuid REFERENCES cohamy_crm.commercial_requests(id),
        handover_invoice_id uuid REFERENCES cohamy_crm.warehouse_handover_invoices(id),
        organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
        warehouse_id uuid REFERENCES cohamy_crm.warehouses(id),
        invoice_number text NOT NULL DEFAULT '',
        invoice_symbol text NOT NULL DEFAULT '',
        issued_date date,
        invoice_type text NOT NULL DEFAULT 'ORIGINAL' CHECK (invoice_type IN ('ORIGINAL', 'ADJUSTMENT', 'REPLACEMENT')),
        parent_vat_invoice_id uuid REFERENCES cohamy_crm.vat_invoices(id),
        seller_info jsonb NOT NULL DEFAULT '{}'::jsonb,
        buyer_name text NOT NULL DEFAULT '',
        buyer_tax_code text NOT NULL DEFAULT '',
        buyer_address text NOT NULL DEFAULT '',
        buyer_email text NOT NULL DEFAULT '',
        lines jsonb NOT NULL DEFAULT '[]'::jsonb,
        list_subtotal numeric(30,0) NOT NULL DEFAULT 0,
        discount_amount numeric(30,0) NOT NULL DEFAULT 0,
        net_amount numeric(30,0) NOT NULL DEFAULT 0,
        vat_amount numeric(30,0) NOT NULL DEFAULT 0,
        total_amount numeric(30,0) NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'UNISSUED' CHECK (status IN (
          'UNISSUED','ISSUED_MISSING_FILES','ISSUED','ADJUSTMENT_REQUESTED','ADJUSTED','REPLACED'
        )),
        pdf_document_id uuid REFERENCES cohamy_crm.private_documents(id),
        xml_document_id uuid REFERENCES cohamy_crm.private_documents(id),
        adjustment_reason text NOT NULL DEFAULT '',
        note text NOT NULL DEFAULT '',
        created_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
        created_by_name text NOT NULL DEFAULT '',
        updated_by uuid REFERENCES cohamy_crm.users(id),
        updated_by_name text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS cohamy_crm.customer_tax_profiles (
        organization_id uuid PRIMARY KEY REFERENCES cohamy_crm.organizations(id),
        buyer_type text NOT NULL DEFAULT 'COMPANY' CHECK (buyer_type IN ('COMPANY', 'INDIVIDUAL')),
        legal_name text NOT NULL DEFAULT '',
        tax_code text NOT NULL DEFAULT '',
        invoice_address text NOT NULL DEFAULT '',
        invoice_email text NOT NULL DEFAULT '',
        representative_name text NOT NULL DEFAULT '',
        personal_id_number text NOT NULL DEFAULT '',
        personal_id_consent_basis text NOT NULL DEFAULT '',
        contract_code text NOT NULL DEFAULT '',
        note text NOT NULL DEFAULT '',
        updated_by uuid REFERENCES cohamy_crm.users(id),
        updated_by_name text NOT NULL DEFAULT '',
        updated_at timestamptz NOT NULL DEFAULT now()
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
    entityType:
      | 'commercial-request'
      | 'sales-order'
      | 'factory-invoice'
      | 'warehouse-reconciliation'
      | 'order-clearance'
      | 'delivery'
      | 'vat-invoice'
      | 'warehouse-handover'
      | 'payment';
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

export function extractSnapshotTotals(snapshot: Record<string, unknown> | null | undefined) {
  const calc = (snapshot?.calculation ?? {}) as {
    subtotal?: string;
    discount?: string;
    total?: string;
    channel?: {listSubtotal?: string};
    lines?: Array<{
      productId?: string;
      sku?: string;
      name?: string;
      weightLabel?: string;
      unitLabel?: string;
      quantity?: string;
      baseQuantity?: string;
      costUnitPrice?: string | number;
      listUnitPrice?: string;
      unitPrice?: string;
      discount?: string;
      vatRate?: string | number;
      total?: string;
    }>;
  };
  const basket = (snapshot?.basket ?? {}) as {discountBasisPoints?: number};
  const vatRateSnap = Math.max(0, Number((snapshot as {vatRate?: number})?.vatRate ?? 0));
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
  const lines: OrderClearanceLine[] = (calc.lines ?? []).map(l => {
    const qty = Number(l.quantity ?? 0);
    const baseQty = Number(l.baseQuantity ?? l.quantity ?? 0);
    const listUnit = Number(l.listUnitPrice ?? l.unitPrice ?? 0);
    const listLine = Math.round(baseQty * listUnit);
    const netLine = Number(l.total ?? 0);
    const discLine = Math.max(Number(l.discount ?? 0), listLine > netLine ? listLine - netLine : 0);
    const lineDiscPct = listLine > 0 ? Number(((discLine / listLine) * 100).toFixed(2)) : discountPct;
    const netUnit = baseQty > 0 ? Math.round(netLine / baseQty) : listUnit;
    const lineVatRate = l.vatRate !== undefined ? Number(l.vatRate) : vatRateSnap;
    const lineVatAmt = Math.round((netLine * lineVatRate) / 100);
    const costUnit = Number(l.costUnitPrice ?? Math.round(listUnit * 0.7));
    return {
      productId: l.productId ? String(l.productId) : undefined,
      sku: String(l.sku ?? ''),
      name: String(l.name ?? l.sku ?? ''),
      weightLabel: String(l.weightLabel ?? ''),
      unitLabel: String(l.unitLabel ?? 'Gói'),
      quantity: qty,
      baseQuantity: baseQty,
      costUnitPrice: costUnit,
      listUnitPrice: listUnit,
      discountPercent: lineDiscPct,
      netUnitPrice: netUnit,
      listLineTotal: listLine,
      discountLineAmount: discLine,
      netLineTotal: netLine,
      vatRate: lineVatRate,
      vatLineAmount: lineVatAmt,
      grossLineTotal: netLine + lineVatAmt,
    };
  });
  const netRounded = Math.round(netTotalNum);
  const vatAmountRounded = lines.reduce((s, x) => s + (x.vatLineAmount ?? 0), 0);
  const grossTotalRounded = netRounded + vatAmountRounded;
  return {
    listSubtotal: Math.round(listSubtotalNum),
    discountPercent: discountPct,
    discountAmount: Math.round(totalDiscountNum),
    netTotal: netRounded,
    vatRate: vatRateSnap,
    vatAmount: vatAmountRounded,
    grossTotal: grossTotalRounded,
    lines,
  };
}

export async function recalculateClearancePaymentTotals(sql: Sql, clearanceId: string) {
  const cRow = (
    await sql.query<{
      id: string;
      net_total: string;
      vat_amount: string;
      gross_total: string;
      staff_submitted_amount: string;
      status: OrderClearanceRecord['status'];
      warehouse_issue_status: string;
    }>(
      `SELECT id, net_total::text, vat_amount::text, gross_total::text,
              staff_submitted_amount::text, status, warehouse_issue_status
       FROM cohamy_crm.accounting_order_clearances
       WHERE id = $1 FOR UPDATE`,
      [clearanceId]
    )
  ).rows[0];
  if (!cRow) throw new CrmError('NOT_FOUND', 404);

  const txAgg = (
    await sql.query<{confirmed_sum: string; tx_count: string}>(
      `SELECT COALESCE(SUM(CASE WHEN status = 'CONFIRMED' THEN amount ELSE 0 END), 0)::numeric(30,0)::text AS confirmed_sum,
              COUNT(*)::text AS tx_count
       FROM cohamy_crm.order_payment_transactions
       WHERE clearance_id = $1`,
      [clearanceId]
    )
  ).rows[0];

  const netTotal = BigInt(cRow.net_total || '0');
  const vatAmount = BigInt(cRow.vat_amount || '0');
  const rawGross = BigInt(cRow.gross_total || '0');
  const receivableTotal = rawGross > 0n ? rawGross : netTotal + vatAmount;
  const txCount = Number(txAgg?.tx_count ?? 0);
  const confirmedTxSum = BigInt(txAgg?.confirmed_sum || '0');
  const legacyPaid =
    txCount === 0 && (cRow.status === 'ACCOUNTANT_CLEARED' || cRow.status === 'PICKED_UP_DELIVERED')
      ? BigInt(cRow.staff_submitted_amount || '0')
      : 0n;
  const paidAmount = txCount > 0 ? confirmedTxSum : legacyPaid;
  const remainingDebt = receivableTotal > paidAmount ? receivableTotal - paidAmount : 0n;
  const paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' =
    paidAmount <= 0n ? 'UNPAID' : paidAmount >= receivableTotal ? 'PAID' : 'PARTIAL';

  const nextStatus: OrderClearanceRecord['status'] =
    cRow.status === 'PICKED_UP_DELIVERED' || cRow.warehouse_issue_status === 'ISSUED'
      ? 'PICKED_UP_DELIVERED'
      : paymentStatus === 'PAID'
        ? 'ACCOUNTANT_CLEARED'
        : paidAmount > 0n
          ? 'STAFF_SUBMITTED'
          : cRow.status;

  await sql.query(
    `UPDATE cohamy_crm.accounting_order_clearances
     SET gross_total = $1,
         paid_amount = $2,
         remaining_debt = $3,
         payment_status = $4,
         staff_submitted_amount = CASE WHEN $5::numeric > 0 THEN $2::numeric ELSE staff_submitted_amount END,
         status = $6,
         updated_at = now()
     WHERE id = $7`,
    [
      receivableTotal.toString(),
      paidAmount.toString(),
      remainingDebt.toString(),
      paymentStatus,
      txCount > 0 ? paidAmount.toString() : '0',
      nextStatus,
      clearanceId,
    ]
  );

  return {
    receivableTotal: receivableTotal.toString(),
    paidAmount: paidAmount.toString(),
    remainingDebt: remainingDebt.toString(),
    paymentStatus,
    status: nextStatus,
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
      sales_order_status: string | null;
    }>(
      `SELECT r.id, r.code, r.organization_id, o.name AS organization_name,
              o.region AS organization_region, COALESCE(o.address, '') AS organization_address,
              r.creator_id, COALESCE(r.creator_role, '') AS creator_role,
              v.snapshot, s.id AS sales_order_id, s.code AS sales_order_code, s.status AS sales_order_status
       FROM cohamy_crm.commercial_requests r
       JOIN cohamy_crm.organizations o ON o.id = r.organization_id
       JOIN cohamy_crm.commercial_request_versions v ON v.id = r.latest_version_id
       LEFT JOIN cohamy_crm.sales_orders s ON s.request_id = r.id
       WHERE r.id = $1`,
      [input.requestId]
    )
  ).rows[0];
  if (!row) return;

  const existing = (
    await sql.query<{
      id: string;
      warehouse_issue_status: string;
      status: string;
      paid_amount: string;
      immutable_lines: OrderClearanceLine[];
    }>(
      `SELECT id, warehouse_issue_status, status, paid_amount::text, immutable_lines
       FROM cohamy_crm.accounting_order_clearances
       WHERE request_id = $1 LIMIT 1`,
      [row.id]
    )
  ).rows[0];

  const isLocked =
    existing &&
    Array.isArray(existing.immutable_lines) &&
    existing.immutable_lines.length > 0 &&
    (existing.warehouse_issue_status !== 'NOT_ISSUED' ||
      existing.status === 'PICKED_UP_DELIVERED' ||
      row.sales_order_status === 'CONFIRMED');

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

  if (isLocked && existing) {
    await sql.query(
      `UPDATE cohamy_crm.accounting_order_clearances
       SET order_id = COALESCE($1, order_id),
           document_code = $2,
           updated_at = now()
       WHERE id = $3`,
      [row.sales_order_id, row.sales_order_code ?? row.code, existing.id]
    );
    return;
  }

  const paidAmt = BigInt(existing?.paid_amount || '0');
  const grossBig = BigInt(totals.grossTotal);
  const remDebt = grossBig > paidAmt ? grossBig - paidAmt : 0n;
  const clearanceId = existing?.id ?? randomUUID();

  await sql.query(
    `INSERT INTO cohamy_crm.accounting_order_clearances(
       id, request_id, order_id, document_code, organization_id, warehouse_id,
       list_subtotal, discount_percent, discount_amount, net_total,
       vat_rate, vat_amount, gross_total, remaining_debt, immutable_lines
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
     ON CONFLICT (request_id) DO UPDATE SET
       order_id = COALESCE(EXCLUDED.order_id, cohamy_crm.accounting_order_clearances.order_id),
       document_code = EXCLUDED.document_code,
       list_subtotal = EXCLUDED.list_subtotal,
       discount_percent = EXCLUDED.discount_percent,
       discount_amount = EXCLUDED.discount_amount,
       net_total = EXCLUDED.net_total,
       vat_rate = EXCLUDED.vat_rate,
       vat_amount = EXCLUDED.vat_amount,
       gross_total = EXCLUDED.gross_total,
       remaining_debt = EXCLUDED.remaining_debt,
       immutable_lines = EXCLUDED.immutable_lines,
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
      String(totals.vatRate),
      String(totals.vatAmount),
      String(totals.grossTotal),
      remDebt.toString(),
      JSON.stringify(totals.lines),
    ]
  );

  const whRoles = warehouseNotifyRolesForRegion(defaultWh?.region, defaultWh?.code);
  const msg = `[Hóa đơn khách đặt hàng] ${row.sales_order_code ?? row.code} · Khách: ${row.organization_name} · Giá gốc: ${totals.listSubtotal.toLocaleString('vi-VN')} đ · Chiết khấu: ${totals.discountPercent}% · Phải thu: ${totals.grossTotal.toLocaleString('vi-VN')} đ (Đã gửi cho Kho, Nhân viên & Kế toán).`;
  await notifyRoles(sql, {
    roles: ['ACCOUNTANT', 'ADMIN', 'MANAGER', 'SALES', ...whRoles],
    eventKey: `cust_order_invoice:${row.id}:${totals.grossTotal}:${input.isNew ? 'new' : 'upd'}`,
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

  const managedRegion = warehouseRoleRegion(user.role);

  const [
    clearanceRows,
    factoryRows,
    handoverRows,
    warehouses,
    products,
    stockRows,
    notifRows,
    partnerRows,
    staffRows,
    paymentRows,
    vatRows,
    taxProfileRows,
    docRows,
  ] = await Promise.all([
    db.query<{
      id: string;
      request_id: string;
      order_id: string | null;
      document_code: string;
      sales_order_code: string | null;
      contract_code: string;
      organization_id: string;
      organization_code: string;
      organization_name: string;
      organization_address: string;
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
      vat_rate: string;
      vat_amount: string;
      gross_total: string;
      paid_amount: string;
      remaining_debt: string;
      payment_status: 'UNPAID' | 'PARTIAL' | 'PAID';
      warehouse_issue_status: 'NOT_ISSUED' | 'PARTIAL_ISSUED' | 'ISSUED' | 'DELIVERED';
      vat_invoice_status: 'UNISSUED' | 'ISSUED_MISSING_FILES' | 'ISSUED' | 'ADJUSTMENT_REQUESTED' | 'ADJUSTED' | 'REPLACED';
      immutable_lines: OrderClearanceLine[];
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
              COALESCE(c.contract_code, '') AS contract_code,
              c.organization_id, o.code AS organization_code, o.name AS organization_name,
              COALESCE(o.address, '') AS organization_address,
              c.warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name, w.region AS warehouse_region,
              COALESCE(u.display_name, 'Nhân viên') AS creator_name,
              COALESCE(c.orderer_type, 'CUSTOMER') AS orderer_type,
              COALESCE(c.orderer_name, '') AS orderer_name,
              COALESCE(c.orderer_phone, '') AS orderer_phone,
              COALESCE(c.note, '') AS note,
              r.channel, r.status AS request_status,
              c.list_subtotal::text, c.discount_percent::text, c.discount_amount::text, c.net_total::text,
              COALESCE(c.vat_rate, 0)::text AS vat_rate,
              COALESCE(c.vat_amount, 0)::text AS vat_amount,
              COALESCE(NULLIF(c.gross_total, 0), c.net_total + COALESCE(c.vat_amount, 0))::text AS gross_total,
              COALESCE(c.paid_amount, 0)::text AS paid_amount,
              COALESCE(c.remaining_debt, GREATEST(0, COALESCE(NULLIF(c.gross_total, 0), c.net_total) - COALESCE(c.paid_amount, 0)))::text AS remaining_debt,
              COALESCE(c.payment_status, 'UNPAID') AS payment_status,
              COALESCE(c.warehouse_issue_status, 'NOT_ISSUED') AS warehouse_issue_status,
              COALESCE(c.vat_invoice_status, 'UNISSUED') AS vat_invoice_status,
              COALESCE(c.immutable_lines, '[]'::jsonb) AS immutable_lines,
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
       WHERE NOT EXISTS (SELECT 1 FROM cohamy_crm.invoice_admin_heads ia WHERE ia.kind='SALES' AND ia.entity_id=COALESCE(c.order_id,s.id) AND ia.cancelled_at IS NOT NULL)
       ORDER BY c.updated_at DESC, c.created_at DESC
       LIMIT 200`
    ),
    db.query<{
      id: string;
      code: string;
      stage: FactoryInvoiceRecord['stage'];
      voucher_type: 'INTERNAL_TRANSFER' | 'SUPPLIER_PURCHASE';
      supplier_id: string | null;
      supplier_name: string | null;
      parent_id: string | null;
      parent_code: string | null;
      warehouse_id: string;
      warehouse_code: string;
      warehouse_name: string;
      warehouse_region: string | null;
      factory_name: string;
      dispatched_date: string;
      received_date: string | null;
      status: FactoryInvoiceRecord['status'];
      reconciliation_status: FactoryInvoiceRecord['reconciliationStatus'];
      lines: FactoryInvoiceLine[];
      total_ordered_qty: string;
      total_dispatched_qty: string;
      total_received_qty: string;
      subtotal_amount: string;
      discount_amount: string;
      total_amount: string;
      paid_amount: string;
      inventory_document_id: string | null;
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
      `SELECT f.id, f.code, f.stage,
              COALESCE(f.voucher_type, 'INTERNAL_TRANSFER') AS voucher_type,
              f.supplier_id, sup.name AS supplier_name,
              f.parent_id, p.code AS parent_code,
              f.warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name, w.region AS warehouse_region,
              f.factory_name,
              COALESCE(f.dispatched_date::text, f.created_at::date::text) AS dispatched_date,
              f.received_date::text AS received_date,
              f.status,
              COALESCE(f.reconciliation_status,
                CASE
                  WHEN f.status = 'RECONCILED' OR f.status = 'PAID' THEN 'MATCHED'
                  WHEN f.status = 'DISCREPANCY' THEN 'DISCREPANCY'
                  ELSE 'PENDING_RECEIPT'
                END
              ) AS reconciliation_status,
              f.lines,
              f.total_ordered_qty::text, f.total_dispatched_qty::text, f.total_received_qty::text,
              COALESCE(NULLIF(f.subtotal_amount, 0), f.total_amount)::text AS subtotal_amount,
              COALESCE(f.discount_amount, 0)::text AS discount_amount,
              f.total_amount::text, f.paid_amount::text,
              f.inventory_document_id,
              f.note,
              f.created_by_name, f.created_by_role,
              f.reconciled_by_name, f.reconciled_at::text,
              f.accountant_verified, f.accountant_verified_by_name, f.accountant_verified_at::text,
              f.created_at::text, f.updated_at::text
       FROM cohamy_crm.factory_invoices f
       JOIN cohamy_crm.warehouses w ON w.id = f.warehouse_id
       LEFT JOIN cohamy_crm.factory_invoices p ON p.id = f.parent_id
       LEFT JOIN cohamy_crm.organizations sup ON sup.id = f.supplier_id
       WHERE f.workflow_state<>'CANCELLED'
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
      sales_order_id: string | null;
      organization_id: string | null;
      order_code: string;
      contract_code: string;
      issued_date: string;
      recipient_type: 'STAFF' | 'CUSTOMER';
      recipient_name: string;
      recipient_phone: string;
      organization_name: string;
      status: 'HANDED_OVER' | 'CONFIRMED';
      delivery_status: 'ISSUED' | 'PARTIAL_ISSUED' | 'IN_TRANSIT' | 'DELIVERED';
      lines: WarehouseHandoverLine[];
      total_quantity: string;
      list_subtotal: string;
      discount_percent: string;
      discount_amount: string;
      net_subtotal: string;
      vat_amount: string;
      total_amount: string;
      cost_total: string;
      inventory_document_id: string | null;
      note: string;
      created_by_name: string;
      created_by_role: string;
      created_at: string;
    }>(
      `SELECT h.id, h.code, h.warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name, w.region AS warehouse_region,
              h.clearance_id, h.request_id, h.sales_order_id, h.organization_id,
              h.order_code, COALESCE(h.contract_code, '') AS contract_code,
              COALESCE(h.issued_date::text, h.created_at::date::text) AS issued_date,
              h.recipient_type, h.recipient_name, h.recipient_phone, h.organization_name,
              h.status, COALESCE(h.delivery_status, 'ISSUED') AS delivery_status,
              h.lines,
              h.total_quantity::text,
              COALESCE(NULLIF(h.list_subtotal, 0), h.total_amount)::text AS list_subtotal,
              COALESCE(h.discount_percent, 0)::text AS discount_percent,
              COALESCE(h.discount_amount, 0)::text AS discount_amount,
              COALESCE(NULLIF(h.net_subtotal, 0), h.total_amount)::text AS net_subtotal,
              COALESCE(h.vat_amount, 0)::text AS vat_amount,
              h.total_amount::text,
              COALESCE(h.cost_total, 0)::text AS cost_total,
              h.inventory_document_id,
              h.note,
              h.created_by_name, h.created_by_role, h.created_at::text
       FROM cohamy_crm.warehouse_handover_invoices h
       JOIN cohamy_crm.warehouses w ON w.id = h.warehouse_id
       WHERE h.workflow_state<>'CANCELLED'
       ORDER BY h.created_at DESC
       LIMIT 200`
    ),
    db.query<{id: string; code: string; name: string; region: string | null}>(
      'SELECT id, code, name, region FROM cohamy_crm.warehouses WHERE active ORDER BY code'
    ),
    db.query<{
      id: string;
      sku: string;
      name: string;
      weight_label: string;
      stock_unit: string;
      retail_price: string;
      cost_price: string;
      vat_rate: string;
    }>(
      `SELECT id, sku, name, weight_label, COALESCE(stock_unit, 'Gói') AS stock_unit,
              retail_price::text,
              COALESCE(NULLIF(cost_price, 0), ROUND(retail_price * 0.7))::numeric(30,0)::text AS cost_price,
              COALESCE(vat_rate, 8)::text AS vat_rate
       FROM cohamy_crm.products WHERE active ORDER BY sku`
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
      cost_price: string;
      vat_rate: string;
      on_hand: string;
      reserved: string;
      available: string;
    }>(
      `SELECT w.id AS warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name, w.region,
              p.id AS product_id, p.sku, p.name AS product_name, p.weight_label,
              COALESCE(p.stock_unit, 'Gói') AS stock_unit, p.retail_price::text,
              COALESCE(NULLIF(p.cost_price, 0), ROUND(p.retail_price * 0.7))::numeric(30,0)::text AS cost_price,
              COALESCE(p.vat_rate, 8)::text AS vat_rate,
              COALESCE(SUM(b.on_hand), 0)::numeric(30,0)::text AS on_hand,
              COALESCE(SUM(b.reserved), 0)::numeric(30,0)::text AS reserved,
              COALESCE(SUM(b.on_hand - b.reserved), 0)::numeric(30,0)::text AS available
       FROM cohamy_crm.warehouses w
       CROSS JOIN cohamy_crm.products p
       LEFT JOIN cohamy_crm.inventory_balances b ON b.warehouse_id = w.id AND b.product_id = p.id
       WHERE w.active AND p.active
       GROUP BY w.id, w.code, w.name, w.region, p.id, p.sku, p.name, p.weight_label, p.stock_unit, p.retail_price, p.cost_price, p.vat_rate
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
      email: string;
      address: string;
      region: string | null;
    }>(
      `SELECT id, code, name, kind, COALESCE(phone, '') AS phone, COALESCE(email, '') AS email, COALESCE(address, '') AS address, region
       FROM cohamy_crm.organizations
       WHERE active AND merged_into_id IS NULL AND kind IN ('CUSTOMER', 'DEALER', 'SUPPLIER')
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
       WHERE u.active AND m.active AND m.role IN ('SALES', 'MANAGER', 'ADMIN', 'ACCOUNTANT', 'FACTORY', 'WAREHOUSE_HCM', 'WAREHOUSE_HN', 'WAREHOUSE')
       ORDER BY u.display_name LIMIT 100`
    ),
    db.query<{
      id: string;
      code: string;
      clearance_id: string;
      order_id: string | null;
      document_code: string;
      organization_id: string;
      organization_name: string;
      payment_date: string;
      amount: string;
      bank_account: string;
      reference_code: string;
      transfer_content: string;
      payment_method: string;
      proof_document_id: string | null;
      status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
      confirmed_by_name: string;
      confirmed_at: string | null;
      created_by_name: string;
      created_at: string;
    }>(
      `SELECT pt.id, pt.code, pt.clearance_id, pt.order_id,
              c.document_code, pt.organization_id, o.name AS organization_name,
              pt.payment_date::text, pt.amount::text,
              pt.bank_account, pt.reference_code, pt.transfer_content, pt.payment_method,
              pt.proof_document_id, pt.status,
              pt.confirmed_by_name, pt.confirmed_at::text,
              pt.created_by_name, pt.created_at::text
       FROM cohamy_crm.order_payment_transactions pt
       JOIN cohamy_crm.accounting_order_clearances c ON c.id = pt.clearance_id
       JOIN cohamy_crm.organizations o ON o.id = pt.organization_id
       ORDER BY pt.payment_date DESC, pt.created_at DESC
       LIMIT 300`
    ),
    db.query<{
      id: string;
      code: string;
      clearance_id: string | null;
      order_id: string | null;
      request_id: string | null;
      order_code: string;
      contract_code: string;
      handover_invoice_id: string | null;
      handover_code: string | null;
      organization_id: string;
      organization_code: string;
      organization_name: string;
      warehouse_id: string | null;
      warehouse_code: string | null;
      warehouse_name: string | null;
      issued_warehouse_date: string | null;
      invoice_number: string;
      invoice_symbol: string;
      issued_date: string | null;
      invoice_type: 'ORIGINAL' | 'ADJUSTMENT' | 'REPLACEMENT';
      parent_vat_invoice_id: string | null;
      parent_invoice_number: string | null;
      seller_info: Record<string, string>;
      buyer_name: string;
      buyer_tax_code: string;
      buyer_address: string;
      buyer_email: string;
      lines: WarehouseHandoverLine[];
      list_subtotal: string;
      discount_amount: string;
      net_amount: string;
      vat_amount: string;
      total_amount: string;
      status: VatInvoiceRecord['status'];
      pdf_document_id: string | null;
      xml_document_id: string | null;
      adjustment_reason: string;
      note: string;
      created_by_name: string;
      updated_by_name: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT v.id, v.code, v.clearance_id, v.order_id, v.request_id,
              COALESCE(c.document_code, h.order_code, '') AS order_code,
              COALESCE(NULLIF(c.contract_code, ''), h.contract_code, '') AS contract_code,
              v.handover_invoice_id, h.code AS handover_code,
              v.organization_id, o.code AS organization_code, o.name AS organization_name,
              COALESCE(v.warehouse_id, c.warehouse_id, h.warehouse_id) AS warehouse_id,
              w.code AS warehouse_code, w.name AS warehouse_name,
              COALESCE(h.issued_date::text, c.picked_up_at::date::text) AS issued_warehouse_date,
              v.invoice_number, v.invoice_symbol, v.issued_date::text,
              v.invoice_type, v.parent_vat_invoice_id, pv.invoice_number AS parent_invoice_number,
              v.seller_info, v.buyer_name, v.buyer_tax_code, v.buyer_address, v.buyer_email,
              v.lines,
              v.list_subtotal::text, v.discount_amount::text, v.net_amount::text, v.vat_amount::text, v.total_amount::text,
              v.status, v.pdf_document_id, v.xml_document_id,
              v.adjustment_reason, v.note,
              v.created_by_name, v.updated_by_name,
              v.created_at::text, v.updated_at::text
       FROM cohamy_crm.vat_invoices v
       JOIN cohamy_crm.organizations o ON o.id = v.organization_id
       LEFT JOIN cohamy_crm.accounting_order_clearances c ON c.id = v.clearance_id
       LEFT JOIN cohamy_crm.warehouse_handover_invoices h ON h.id = v.handover_invoice_id
       LEFT JOIN cohamy_crm.warehouses w ON w.id = COALESCE(v.warehouse_id, c.warehouse_id, h.warehouse_id)
       LEFT JOIN cohamy_crm.vat_invoices pv ON pv.id = v.parent_vat_invoice_id
       WHERE v.status<>'CANCELLED'
       ORDER BY v.updated_at DESC, v.created_at DESC
       LIMIT 200`
    ),
    db.query<{
      organization_id: string;
      buyer_type: 'COMPANY' | 'INDIVIDUAL';
      legal_name: string;
      tax_code: string;
      invoice_address: string;
      invoice_email: string;
      representative_name: string;
      personal_id_number: string;
      personal_id_consent_basis: string;
      contract_code: string;
      note: string;
      updated_by_name: string;
      updated_at: string;
    }>(
      `SELECT organization_id, buyer_type, legal_name, tax_code, invoice_address, invoice_email,
              representative_name, personal_id_number, personal_id_consent_basis, contract_code,
              note, updated_by_name, updated_at::text
       FROM cohamy_crm.customer_tax_profiles`
    ),
    db.query<{
      id: string;
      entity_type: string;
      entity_id: string;
      title: string;
      doc_category: string;
      version_id: string;
      filename: string;
      mime: string;
      size: number;
      created_at: string;
    }>(
      `SELECT d.id, d.entity_type, d.entity_id, d.title,
              COALESCE(d.doc_category, 'GENERAL') AS doc_category,
              dv.id AS version_id, dv.filename, dv.mime, dv.size, dv.created_at::text
       FROM cohamy_crm.private_documents d
       JOIN cohamy_crm.document_versions dv ON dv.document_id = d.id
         AND dv.number = (SELECT max(x.number) FROM cohamy_crm.document_versions x WHERE x.document_id = d.id)
       WHERE d.entity_type IN ('partner','order','payment','factory-invoice','warehouse-reconciliation','warehouse-handover','vat-invoice','order-clearance')
       ORDER BY dv.created_at DESC
       LIMIT 500`
    ),
  ]);

  const docsByEntity = new Map<string, AttachedDocumentSummary[]>();
  const docsById = new Map<string, AttachedDocumentSummary>();
  for (const d of docRows.rows) {
    const summary: AttachedDocumentSummary = {
      id: d.id,
      versionId: d.version_id,
      title: d.title,
      docCategory: d.doc_category,
      filename: d.filename,
      mime: d.mime,
      size: Number(d.size || 0),
      createdAt: d.created_at,
    };
    docsById.set(d.id, summary);
    const key = `${d.entity_type}:${d.entity_id}`;
    const arr = docsByEntity.get(key) ?? [];
    arr.push(summary);
    docsByEntity.set(key, arr);
  }

  const taxProfileByOrg = new Map(taxProfileRows.rows.map(tp => [tp.organization_id, tp]));

  const paymentTransactions: OrderPaymentTransactionRecord[] = paymentRows.rows.map(pt => {
    const proofDoc = pt.proof_document_id ? docsById.get(pt.proof_document_id) : undefined;
    return {
      id: pt.id,
      code: pt.code,
      clearanceId: pt.clearance_id,
      orderId: pt.order_id,
      documentCode: pt.document_code,
      organizationId: pt.organization_id,
      organizationName: pt.organization_name,
      paymentDate: pt.payment_date,
      amount: pt.amount,
      bankAccount: pt.bank_account,
      referenceCode: pt.reference_code,
      transferContent: pt.transfer_content,
      paymentMethod: pt.payment_method,
      proofDocumentId: pt.proof_document_id,
      proofVersionId: proofDoc?.versionId ?? null,
      proofFilename: proofDoc?.filename ?? null,
      status: pt.status,
      confirmedByName: pt.confirmed_by_name,
      confirmedAt: pt.confirmed_at,
      createdByName: pt.created_by_name,
      createdAt: pt.created_at,
    };
  });

  const paymentsByClearance = new Map<string, OrderPaymentTransactionRecord[]>();
  for (const pt of paymentTransactions) {
    const arr = paymentsByClearance.get(pt.clearanceId) ?? [];
    arr.push(pt);
    paymentsByClearance.set(pt.clearanceId, arr);
  }

  const vatByClearance = new Map<string, (typeof vatRows.rows)[number]>();
  for (const v of vatRows.rows) {
    if (v.clearance_id && !vatByClearance.has(v.clearance_id)) {
      vatByClearance.set(v.clearance_id, v);
    }
  }

  const handoversByClearance = new Map<string, number>();
  for (const h of handoverRows.rows) {
    if (h.clearance_id) {
      handoversByClearance.set(h.clearance_id, (handoversByClearance.get(h.clearance_id) ?? 0) + 1);
    }
  }

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
    const immutableLines =
      Array.isArray(r.immutable_lines) && r.immutable_lines.length > 0 ? r.immutable_lines : parsed.lines;
    const tp = taxProfileByOrg.get(r.organization_id);
    const snapOrg = (r.snapshot?.organization ?? {}) as {businessId?: string; address?: string};
    const linkedVat = vatByClearance.get(r.id);
    const orderDocs = [
      ...(docsByEntity.get(`order-clearance:${r.id}`) ?? []),
      ...(r.order_id ? docsByEntity.get(`order:${r.order_id}`) ?? [] : []),
      ...(docsByEntity.get(`order:${r.request_id}`) ?? []),
    ];
    const hc = handoversByClearance.get(r.id) ?? 0;
    const issueStatus: OrderClearanceRecord['warehouseIssueStatus'] =
      r.warehouse_issue_status !== 'NOT_ISSUED'
        ? r.warehouse_issue_status
        : hc > 0 || r.status === 'PICKED_UP_DELIVERED'
          ? 'ISSUED'
          : 'NOT_ISSUED';

    return {
      id: r.id,
      requestId: r.request_id,
      orderId: r.order_id,
      documentCode: r.sales_order_code ?? r.document_code,
      salesOrderCode: r.sales_order_code,
      contractCode: r.contract_code || tp?.contract_code || '',
      organizationId: r.organization_id,
      organizationCode: r.organization_code,
      organizationName: r.organization_name,
      organizationTaxCode: tp?.tax_code || snapOrg.businessId || '',
      organizationAddress: tp?.invoice_address || r.organization_address || snapOrg.address || '',
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
      vatRate: r.vat_rate,
      vatAmount: r.vat_amount,
      grossTotal: r.gross_total,
      paidAmount: r.paid_amount,
      remainingDebt: r.remaining_debt,
      paymentStatus: r.payment_status,
      warehouseIssueStatus: issueStatus,
      vatInvoiceStatus: linkedVat?.status ?? r.vat_invoice_status,
      vatInvoiceId: linkedVat?.id ?? null,
      vatInvoiceNumber: linkedVat?.invoice_number ?? '',
      vatInvoiceSymbol: linkedVat?.invoice_symbol ?? '',
      vatIssuedDate: linkedVat?.issued_date ?? null,
      handoverCount: hc,
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
      lines: immutableLines,
      payments: paymentsByClearance.get(r.id) ?? [],
      documents: orderDocs,
    };
  });

  const clearanceById = new Map(allOrderClearances.map(c => [c.id, c]));

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
    const fDocs = [
      ...(docsByEntity.get(`factory-invoice:${f.id}`) ?? []),
      ...(docsByEntity.get(`warehouse-reconciliation:${f.id}`) ?? []),
    ];
    return {
      id: f.id,
      code: f.code,
      stage: f.stage,
      voucherType: f.voucher_type,
      supplierId: f.supplier_id,
      supplierName: f.supplier_name,
      parentId: f.parent_id,
      parentCode: f.parent_code,
      warehouseId: f.warehouse_id,
      warehouseCode: f.warehouse_code,
      warehouseName: f.warehouse_name,
      warehouseRegion: f.warehouse_region,
      factoryName: f.factory_name,
      dispatchedDate: f.dispatched_date,
      receivedDate: f.received_date,
      status: f.status,
      reconciliationStatus: f.reconciliation_status,
      lines: Array.isArray(f.lines) ? f.lines : [],
      totalOrderedQty: f.total_ordered_qty,
      totalDispatchedQty: f.total_dispatched_qty,
      totalReceivedQty: f.total_received_qty,
      subtotalAmount: f.subtotal_amount,
      discountAmount: f.discount_amount,
      totalAmount: f.total_amount,
      paidAmount: f.paid_amount,
      remainingDebt: rem.toString(),
      inventoryDocumentId: f.inventory_document_id,
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
      documents: fDocs,
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
    salesOrderId: h.sales_order_id,
    organizationId: h.organization_id,
    orderCode: h.order_code,
    contractCode: h.contract_code,
    issuedDate: h.issued_date,
    recipientType: h.recipient_type,
    recipientName: h.recipient_name,
    recipientPhone: h.recipient_phone,
    organizationName: h.organization_name,
    status: h.status,
    deliveryStatus: h.delivery_status,
    lines: Array.isArray(h.lines) ? h.lines : [],
    totalQuantity: h.total_quantity,
    listSubtotal: h.list_subtotal,
    discountPercent: h.discount_percent,
    discountAmount: h.discount_amount,
    netSubtotal: h.net_subtotal,
    vatAmount: h.vat_amount,
    totalAmount: h.total_amount,
    costTotal: h.cost_total,
    inventoryDocumentId: h.inventory_document_id,
    note: h.note,
    createdByName: h.created_by_name,
    createdByRole: h.created_by_role,
    createdAt: h.created_at,
    documents: docsByEntity.get(`warehouse-handover:${h.id}`) ?? [],
  }));

  const handoverInvoices = managedRegion
    ? allHandoverInvoices.filter(
        h => visibleWarehouseIds.has(h.warehouseId) || matchesManagedRegion(h.warehouseRegion, h.warehouseCode)
      )
    : allHandoverInvoices;

  // Compute inTransit, totalInbound, totalOutbound per warehouse + product, plus movementHistory
  const inTransitMap = new Map<string, number>();
  const inboundMap = new Map<string, number>();
  const outboundMap = new Map<string, number>();
  const movementHistory: WarehouseMovementHistoryRow[] = [];

  for (const f of allFactoryInvoices) {
    if (f.stage === 'FACTORY_DISPATCH' && f.reconciliationStatus === 'PENDING_RECEIPT') {
      for (const l of f.lines) {
        const k = `${f.warehouseId}:${l.productId || l.sku}`;
        inTransitMap.set(k, (inTransitMap.get(k) ?? 0) + Number(l.dispatchedQty || 0));
      }
    }
    if (f.stage === 'WAREHOUSE_RECONCILIATION') {
      for (const l of f.lines) {
        const recQty = Number(l.receivedQty || 0);
        if (recQty <= 0) continue;
        const kId = `${f.warehouseId}:${l.productId}`;
        const kSku = `${f.warehouseId}:${l.sku}`;
        inboundMap.set(kId, (inboundMap.get(kId) ?? 0) + recQty);
        inboundMap.set(kSku, (inboundMap.get(kSku) ?? 0) + recQty);
        movementHistory.push({
          id: `${f.id}:${l.sku}`,
          documentCode: f.code,
          documentKind: 'FACTORY_RECEIPT',
          warehouseId: f.warehouseId,
          warehouseCode: f.warehouseCode,
          warehouseName: f.warehouseName,
          sku: l.sku,
          productName: l.name,
          quantityDelta: `+${recQty}`,
          unitLabel: l.unitLabel || 'Gói',
          unitAmount: String(l.factoryUnitPrice || 0),
          totalAmount: String(l.receivedTotal || l.lineTotal || 0),
          actorName: f.reconciledByName || f.createdByName,
          referenceCode: f.parentCode || f.factoryName,
          createdAt: f.reconciledAt || f.createdAt,
        });
      }
    }
  }

  for (const h of allHandoverInvoices) {
    for (const l of h.lines) {
      const qty = Number(l.quantity || 0);
      if (qty <= 0) continue;
      const kId = `${h.warehouseId}:${l.productId}`;
      const kSku = `${h.warehouseId}:${l.sku}`;
      outboundMap.set(kId, (outboundMap.get(kId) ?? 0) + qty);
      outboundMap.set(kSku, (outboundMap.get(kSku) ?? 0) + qty);
      movementHistory.push({
        id: `${h.id}:${l.sku}`,
        documentCode: h.code,
        documentKind: 'CUSTOMER_ISSUE',
        warehouseId: h.warehouseId,
        warehouseCode: h.warehouseCode,
        warehouseName: h.warehouseName,
        sku: l.sku,
        productName: l.name,
        quantityDelta: `-${qty}`,
        unitLabel: l.unitLabel || 'Gói',
        unitAmount: String(l.unitPrice || 0),
        totalAmount: String(l.lineTotal || 0),
        actorName: h.createdByName,
        referenceCode: h.orderCode || h.organizationName,
        createdAt: h.createdAt,
      });
    }
  }

  movementHistory.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const allWarehouseStocks: WarehouseStockSummaryRow[] = stockRows.rows.map(s => {
    const onHandNum = BigInt(s.on_hand || '0');
    const priceNum = BigInt(s.retail_price || '0');
    const costNum = BigInt(s.cost_price || '0');
    const kId = `${s.warehouse_id}:${s.product_id}`;
    const kSku = `${s.warehouse_id}:${s.sku}`;
    const inTransit = inTransitMap.get(kId) ?? inTransitMap.get(kSku) ?? 0;
    const totalInbound = inboundMap.get(kId) ?? 0;
    const totalOutbound = outboundMap.get(kId) ?? 0;
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
      costPrice: s.cost_price,
      vatRate: s.vat_rate,
      onHand: s.on_hand,
      reserved: s.reserved,
      available: s.available,
      inTransit: String(inTransit),
      totalInbound: String(totalInbound),
      totalOutbound: String(totalOutbound),
      stockValue: (onHandNum * priceNum).toString(),
      costStockValue: (onHandNum * costNum).toString(),
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

  const vatInvoices: VatInvoiceRecord[] = vatRows.rows.map(v => {
    const linkedClearance = v.clearance_id ? clearanceById.get(v.clearance_id) : undefined;
    const pdfDoc = v.pdf_document_id ? docsById.get(v.pdf_document_id) : undefined;
    const xmlDoc = v.xml_document_id ? docsById.get(v.xml_document_id) : undefined;
    const extraDocs = docsByEntity.get(`vat-invoice:${v.id}`) ?? [];
    return {
      id: v.id,
      code: v.code,
      clearanceId: v.clearance_id,
      orderId: v.order_id,
      requestId: v.request_id,
      orderCode: v.order_code || linkedClearance?.documentCode || '',
      contractCode: v.contract_code || linkedClearance?.contractCode || '',
      handoverInvoiceId: v.handover_invoice_id,
      handoverCode: v.handover_code,
      organizationId: v.organization_id,
      organizationCode: v.organization_code,
      organizationName: v.organization_name,
      warehouseId: v.warehouse_id,
      warehouseCode: v.warehouse_code,
      warehouseName: v.warehouse_name,
      issuedWarehouseDate: v.issued_warehouse_date,
      invoiceNumber: v.invoice_number,
      invoiceSymbol: v.invoice_symbol,
      issuedDate: v.issued_date,
      invoiceType: v.invoice_type,
      parentVatInvoiceId: v.parent_vat_invoice_id,
      parentInvoiceNumber: v.parent_invoice_number,
      sellerInfo: v.seller_info ?? {},
      buyerName: v.buyer_name,
      buyerTaxCode: v.buyer_tax_code,
      buyerAddress: v.buyer_address,
      buyerEmail: v.buyer_email,
      lines: Array.isArray(v.lines) ? v.lines : [],
      listSubtotal: v.list_subtotal,
      discountAmount: v.discount_amount,
      netAmount: v.net_amount,
      vatAmount: v.vat_amount,
      totalAmount: v.total_amount,
      paymentStatus: linkedClearance?.paymentStatus ?? 'UNPAID',
      paidAmount: linkedClearance?.paidAmount ?? '0',
      remainingDebt: linkedClearance?.remainingDebt ?? v.total_amount,
      status: v.status,
      pdfDocumentId: v.pdf_document_id,
      pdfVersionId: pdfDoc?.versionId ?? null,
      pdfFilename: pdfDoc?.filename ?? null,
      xmlDocumentId: v.xml_document_id,
      xmlVersionId: xmlDoc?.versionId ?? null,
      xmlFilename: xmlDoc?.filename ?? null,
      extraDocuments: extraDocs,
      adjustmentReason: v.adjustment_reason,
      note: v.note,
      createdByName: v.created_by_name,
      updatedByName: v.updated_by_name,
      createdAt: v.created_at,
      updatedAt: v.updated_at,
    };
  });

  const customerTaxProfiles: CustomerTaxProfileRecord[] = partnerRows.rows.map(p => {
    const tp = taxProfileByOrg.get(p.id);
    const partnerDocs = docsByEntity.get(`partner:${p.id}`) ?? [];
    return {
      organizationId: p.id,
      organizationCode: p.code,
      organizationName: p.name,
      organizationKind: p.kind,
      phone: p.phone,
      email: p.email,
      buyerType: tp?.buyer_type ?? 'COMPANY',
      legalName: tp?.legal_name || p.name,
      taxCode: tp?.tax_code ?? '',
      invoiceAddress: tp?.invoice_address || p.address || '',
      invoiceEmail: tp?.invoice_email || p.email || '',
      representativeName: tp?.representative_name ?? '',
      personalIdNumber: tp?.personal_id_number ?? '',
      personalIdConsentBasis: tp?.personal_id_consent_basis ?? '',
      contractCode: tp?.contract_code ?? '',
      note: tp?.note ?? '',
      updatedByName: tp?.updated_by_name ?? '',
      updatedAt: tp?.updated_at ?? null,
      documents: partnerDocs,
    };
  });

  const partners: PartnerOptionRecord[] = partnerRows.rows.map(p => {
    const tp = taxProfileByOrg.get(p.id);
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      kind: p.kind,
      phone: p.phone,
      email: tp?.invoice_email || p.email,
      businessId: tp?.tax_code || '',
      address: tp?.invoice_address || p.address,
      region: p.region,
    };
  });

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
    vatInvoices,
    paymentTransactions,
    customerTaxProfiles,
    movementHistory: managedRegion
      ? movementHistory.filter(m => visibleWarehouseIds.has(m.warehouseId))
      : movementHistory,
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
  if (['create-factory-order','create-factory-dispatch','create-warehouse-reconciliation','create-handover-invoice'].includes(action)) {
    const {saveFlowDocument,assertFlowRole}=await import('./document-flow');
    const kind=action==='create-factory-order'?'REQUEST':action==='create-factory-dispatch'?'DISPATCH':action==='create-warehouse-reconciliation'?'RECEIPT':'ISSUE';
    assertFlowRole(user,kind);
    const lines=Array.isArray(input.lines)?input.lines as Record<string,unknown>[]:[];
    return saveFlowDocument(user,{
      kind,warehouseId:input.warehouseId||undefined,factoryMembershipId:input.factoryMembershipId||undefined,
      parentId:input.parentId||input.parentInvoiceId||input.dispatchInvoiceId||undefined,clearanceId:input.clearanceId||undefined,
      lines:lines.map(l=>({productId:l.productId,quantity:String(l.quantity??(kind==='REQUEST'?l.orderedQty:kind==='DISPATCH'?l.dispatchedQty:l.receivedQty)??''),note:String(l.note??'')})),
      note:String(input.note??''),delivery:input.delivery??{},confirm:input.confirm!==false,
      idempotencyKey:input.idempotencyKey||randomUUID(),
    });
  }
  if(user.role!=='ADMIN'&&['accountant-clear-order','accountant-verify-factory-invoice','update-reconciliation-status','save-vat-invoice','update-handover-delivery'].includes(action))throw new CrmError('FORBIDDEN',403);
  if (['ACCOUNTANT','FACTORY'].includes(user.role)||(['WAREHOUSE','WAREHOUSE_HN','WAREHOUSE_HCM'].includes(user.role)&&action!=='register-warehouse-order')) throw new CrmError('FORBIDDEN',403);
  if (['WAREHOUSE','WAREHOUSE_HN','WAREHOUSE_HCM'].includes(user.role)&&action==='register-warehouse-order') throw new CrmError('FORBIDDEN',403);
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
      const contractCode = String(input.contractCode ?? '').trim();
      const note = String(input.note ?? '').trim();
      const discountPercent = Math.max(0, Math.min(90, Number(input.discountPercent ?? 0)));
      const vatRate = Math.max(0, Math.min(30, Number(input.vatRate ?? 0)));
      const paymentSubmitted = Boolean(input.paymentSubmitted);
      const paymentMethod = String(input.paymentMethod ?? 'BANK_TRANSFER');
      const rawLines = Array.isArray(input.lines) ? (input.lines as Array<Record<string, unknown>>) : [];

      let orgId = String(input.organizationId ?? '').trim();
      let orgRow: {id: string; code: string; name: string; phone: string; email: string; address: string} | undefined;
      if (orgId) {
        orgRow = (
          await sql.query<{id: string; code: string; name: string; phone: string; email: string; address: string}>(
            "SELECT id, code, name, COALESCE(phone, '') AS phone, COALESCE(email, '') AS email, COALESCE(address, '') AS address FROM cohamy_crm.organizations WHERE id = $1 LIMIT 1",
            [orgId]
          )
        ).rows[0];
      }
      if (!orgRow && customOrgName) {
        orgRow = (
          await sql.query<{id: string; code: string; name: string; phone: string; email: string; address: string}>(
            "SELECT id, code, name, COALESCE(phone, '') AS phone, COALESCE(email, '') AS email, COALESCE(address, '') AS address FROM cohamy_crm.organizations WHERE LOWER(name) = LOWER($1) AND merged_into_id IS NULL LIMIT 1",
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
        weightLabel: string;
        unitCode: string;
        unitLabel: string;
        quantity: string;
        baseQuantity: string;
        costUnitPrice: string;
        listUnitPrice: string;
        unitPrice: string;
        discount: string;
        vatRate: string;
        total: string;
      }> = [];
      const immutableLines: OrderClearanceLine[] = [];
      let listSubtotal = 0;
      let totalDiscount = 0;
      let netTotal = 0;
      let totalVat = 0;

      for (const item of rawLines) {
        const qty = Math.max(0, Math.round(Number(item.quantity ?? 0)));
        if (qty <= 0) continue;
        const prod = (
          await sql.query<{
            id: string;
            sku: string;
            name: string;
            weight_label: string;
            stock_unit: string;
            retail_price: string;
            cost_price: string;
          }>(
            `SELECT id, sku, name, weight_label, COALESCE(stock_unit, 'Gói') AS stock_unit,
                    retail_price::text,
                    COALESCE(NULLIF(cost_price, 0), ROUND(retail_price * 0.7))::numeric(30,0)::text AS cost_price
             FROM cohamy_crm.products WHERE id::text = $1 OR sku = $1 LIMIT 1`,
            [String(item.productId ?? item.sku ?? '')]
          )
        ).rows[0];
        if (!prod) continue;
        const listUnitPrice = Math.max(
          0,
          Math.round(Number(item.unitPrice ?? item.listUnitPrice ?? prod.retail_price ?? 0))
        );
        const costUnitPrice = Math.max(
          0,
          Math.round(Number(item.costUnitPrice ?? prod.cost_price ?? Math.round(listUnitPrice * 0.7)))
        );
        const lineDiscPct =
          item.discountPercent !== undefined ? Math.max(0, Math.min(90, Number(item.discountPercent))) : discountPercent;
        const lineVatRate = item.vatRate !== undefined ? Math.max(0, Number(item.vatRate)) : vatRate;
        const lineSubtotal = qty * listUnitPrice;
        const lineDiscount = Math.round((lineSubtotal * lineDiscPct) / 100);
        const lineNet = lineSubtotal - lineDiscount;
        const netUnit = qty > 0 ? Math.round(lineNet / qty) : listUnitPrice;
        const lineVat = Math.round((lineNet * lineVatRate) / 100);

        listSubtotal += lineSubtotal;
        totalDiscount += lineDiscount;
        netTotal += lineNet;
        totalVat += lineVat;

        calcLines.push({
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          weightLabel: prod.weight_label,
          unitCode: 'UNIT',
          unitLabel: prod.stock_unit,
          quantity: String(qty),
          baseQuantity: String(qty),
          costUnitPrice: String(costUnitPrice),
          listUnitPrice: String(listUnitPrice),
          unitPrice: String(netUnit),
          discount: String(lineDiscount),
          vatRate: String(lineVatRate),
          total: String(lineNet),
        });

        immutableLines.push({
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          weightLabel: prod.weight_label,
          unitLabel: prod.stock_unit,
          quantity: qty,
          baseQuantity: qty,
          costUnitPrice,
          listUnitPrice,
          discountPercent: lineDiscPct,
          netUnitPrice: netUnit,
          listLineTotal: lineSubtotal,
          discountLineAmount: lineDiscount,
          netLineTotal: lineNet,
          vatRate: lineVatRate,
          vatLineAmount: lineVat,
          grossLineTotal: lineNet + lineVat,
        });
      }

      if (!calcLines.length) throw new CrmError('INVALID_FIELDS', 400);

      const grossTotal = netTotal + totalVat;
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
          businessId: String(input.taxCode ?? ''),
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
        vatRate,
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
           id, request_id, document_code, contract_code, organization_id, warehouse_id,
           orderer_type, orderer_name, orderer_phone, note,
           list_subtotal, discount_percent, discount_amount, net_total,
           vat_rate, vat_amount, gross_total, paid_amount, remaining_debt,
           payment_status, warehouse_issue_status, vat_invoice_status, immutable_lines,
           staff_submitted_amount, staff_payment_method, staff_reference,
           staff_submitted_by, staff_submitted_by_name, staff_submitted_at, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,0,$17,'UNPAID','NOT_ISSUED','UNISSUED',$18::jsonb,$19,$20,$21,$22,$23,$24,$25)`,
        [
          clearanceId,
          requestId,
          docCode,
          contractCode,
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
          String(vatRate),
          String(totalVat),
          String(grossTotal),
          JSON.stringify(immutableLines),
          paymentSubmitted ? String(grossTotal) : '0',
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
        message: `[Đăng ký Hóa đơn đặt hàng tại ${wh.name}] Mã HĐ: ${docCode} · Người đặt: ${whoLabel} · Giá gốc: ${listSubtotal.toLocaleString('vi-VN')} đ · Chiết khấu: ${discountPercent}% · Phải thu: ${grossTotal.toLocaleString('vi-VN')} đ.`,
      });

      return {
        ok: true,
        id: clearanceId,
        requestId,
        documentCode: docCode,
        listSubtotal: String(listSubtotal),
        discountAmount: String(totalDiscount),
        netTotal: String(netTotal),
        vatAmount: String(totalVat),
        grossTotal: String(grossTotal),
      };
    }

    if (action === 'create-handover-invoice') {
      if (!['ADMIN', 'MANAGER', 'WAREHOUSE', 'WAREHOUSE_HCM', 'WAREHOUSE_HN'].includes(user.role)) {
        throw new CrmError('FORBIDDEN', 403);
      }

      const idempotencyKey = input.idempotencyKey ? String(input.idempotencyKey).trim() : null;
      if (idempotencyKey) {
        const dup = (
          await sql.query<{id: string; code: string}>(
            'SELECT id, code FROM cohamy_crm.warehouse_handover_invoices WHERE idempotency_key = $1 LIMIT 1',
            [idempotencyKey]
          )
        ).rows[0];
        if (dup) {
          throw new CrmError('DUPLICATE_WAREHOUSE_ISSUE', 409);
        }
      }

      const clearanceId = input.clearanceId ? String(input.clearanceId).trim() : null;
      const requestIdInput = input.requestId ? String(input.requestId).trim() : null;
      const orderIdInput = input.orderId ? String(input.orderId).trim() : null;

      let linkedClearance: {
        id: string;
        request_id: string;
        order_id: string | null;
        document_code: string;
        contract_code: string;
        organization_id: string;
        organization_name: string;
        warehouse_id: string | null;
        orderer_type: string;
        orderer_name: string;
        orderer_phone: string;
        discount_percent: string;
        vat_rate: string;
        warehouse_issue_status: string;
        immutable_lines: OrderClearanceLine[];
        snapshot: Record<string, unknown>;
      } | null = null;

      if (clearanceId || requestIdInput || orderIdInput) {
        linkedClearance =
          (
            await sql.query<{
              id: string;
              request_id: string;
              order_id: string | null;
              document_code: string;
              contract_code: string;
              organization_id: string;
              organization_name: string;
              warehouse_id: string | null;
              orderer_type: string;
              orderer_name: string;
              orderer_phone: string;
              discount_percent: string;
              vat_rate: string;
              warehouse_issue_status: string;
              immutable_lines: OrderClearanceLine[];
              snapshot: Record<string, unknown>;
            }>(
              `SELECT c.id, c.request_id, COALESCE(c.order_id, s.id) AS order_id,
                      COALESCE(s.code, c.document_code) AS document_code,
                      COALESCE(c.contract_code, '') AS contract_code,
                      c.organization_id, o.name AS organization_name, c.warehouse_id,
                      COALESCE(c.orderer_type, 'CUSTOMER') AS orderer_type,
                      COALESCE(c.orderer_name, '') AS orderer_name,
                      COALESCE(c.orderer_phone, '') AS orderer_phone,
                      c.discount_percent::text,
                      COALESCE(c.vat_rate, 0)::text AS vat_rate,
                      COALESCE(c.warehouse_issue_status, 'NOT_ISSUED') AS warehouse_issue_status,
                      COALESCE(c.immutable_lines, '[]'::jsonb) AS immutable_lines,
                      v.snapshot
               FROM cohamy_crm.accounting_order_clearances c
               JOIN cohamy_crm.commercial_requests r ON r.id = c.request_id
               JOIN cohamy_crm.commercial_request_versions v ON v.id = r.latest_version_id
               JOIN cohamy_crm.organizations o ON o.id = c.organization_id
               LEFT JOIN cohamy_crm.sales_orders s ON s.request_id = r.id
               WHERE ($1::uuid IS NOT NULL AND c.id = $1)
                  OR ($2::uuid IS NOT NULL AND c.request_id = $2)
                  OR ($3::uuid IS NOT NULL AND (c.order_id = $3 OR s.id = $3))
               LIMIT 1
               FOR UPDATE OF c`,
              [clearanceId || null, requestIdInput || null, orderIdInput || null]
            )
          ).rows[0] ?? null;
      }

      const userRegion = warehouseRoleRegion(user.role);
      const requestedWarehouseId = String(input.warehouseId ?? linkedClearance?.warehouse_id ?? '').trim();
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

      // Check previous warehouse handovers for this clearance to prevent duplicate issue
      const prevIssuedMap = new Map<string, number>();
      if (linkedClearance) {
        const prevHandovers = (
          await sql.query<{lines: WarehouseHandoverLine[]}>(
            'SELECT lines FROM cohamy_crm.warehouse_handover_invoices WHERE clearance_id = $1',
            [linkedClearance.id]
          )
        ).rows;
        for (const ph of prevHandovers) {
          for (const pl of Array.isArray(ph.lines) ? ph.lines : []) {
            if (pl.productId) {
              prevIssuedMap.set(pl.productId, (prevIssuedMap.get(pl.productId) ?? 0) + Number(pl.quantity || 0));
            }
            if (pl.sku) {
              prevIssuedMap.set(pl.sku, (prevIssuedMap.get(pl.sku) ?? 0) + Number(pl.quantity || 0));
            }
          }
        }
      }

      const snapTotals = linkedClearance ? extractSnapshotTotals(linkedClearance.snapshot) : null;
      const lockedOrderLines: OrderClearanceLine[] =
        linkedClearance && Array.isArray(linkedClearance.immutable_lines) && linkedClearance.immutable_lines.length > 0
          ? linkedClearance.immutable_lines
          : snapTotals?.lines ?? [];

      let rawLines = Array.isArray(input.lines) ? (input.lines as Array<Record<string, unknown>>) : [];
      if (rawLines.length === 0 && lockedOrderLines.length > 0) {
        rawLines = lockedOrderLines.map(ol => {
          const prevQty = (ol.productId ? prevIssuedMap.get(ol.productId) : undefined) ?? prevIssuedMap.get(ol.sku) ?? 0;
          const rem = Math.max(0, Number(ol.baseQuantity || ol.quantity || 0) - prevQty);
          return {
            productId: ol.productId,
            sku: ol.sku,
            quantity: rem,
            unitPrice: ol.netUnitPrice,
            listUnitPrice: ol.listUnitPrice,
            discountPercent: ol.discountPercent,
            vatRate: ol.vatRate,
          };
        });
      }

      const recipientType =
        String(input.recipientType ?? linkedClearance?.orderer_type ?? 'CUSTOMER') === 'STAFF' ? 'STAFF' : 'CUSTOMER';
      const recipientName =
        String(input.recipientName ?? '').trim() ||
        linkedClearance?.orderer_name ||
        linkedClearance?.organization_name ||
        'Khách hàng';
      const recipientPhone = String(input.recipientPhone ?? '').trim() || linkedClearance?.orderer_phone || '';
      const organizationName =
        String(input.organizationName ?? '').trim() || linkedClearance?.organization_name || recipientName;
      const orderCodeInput = String(input.orderCode ?? '').trim();
      const contractCodeInput = String(input.contractCode ?? '').trim() || linkedClearance?.contract_code || '';
      const note = String(input.note ?? '').trim();

      const handoverLines: WarehouseHandoverLine[] = [];
      let totalQty = 0;
      let listSubtotal = 0;
      let totalDiscountAmount = 0;
      let netSubtotal = 0;
      let totalVatAmount = 0;
      let totalAmount = 0;
      let costTotal = 0;
      let allOrderLinesFullyIssued = lockedOrderLines.length > 0;

      for (const item of rawLines) {
        const qty = Math.max(0, Math.round(Number(item.quantity ?? 0)));
        const prodKey = String(item.productId ?? item.sku ?? '');
        const prod = (
          await sql.query<{
            id: string;
            sku: string;
            name: string;
            weight_label: string;
            stock_unit: string;
            retail_price: string;
            cost_price: string;
            vat_rate: string;
          }>(
            `SELECT id, sku, name, weight_label, COALESCE(stock_unit, 'Gói') AS stock_unit,
                    retail_price::text,
                    COALESCE(NULLIF(cost_price, 0), ROUND(retail_price * 0.7))::numeric(30,0)::text AS cost_price,
                    COALESCE(vat_rate, 8)::text AS vat_rate
             FROM cohamy_crm.products WHERE id::text = $1 OR sku = $1 LIMIT 1`,
            [prodKey]
          )
        ).rows[0];
        if (!prod) continue;

        const lockedLine = lockedOrderLines.find(
          l => (l.productId && l.productId === prod.id) || l.sku === prod.sku
        );
        const orderedQty = lockedLine ? Number(lockedLine.baseQuantity || lockedLine.quantity || 0) : qty;
        const prevQty = prevIssuedMap.get(prod.id) ?? prevIssuedMap.get(prod.sku) ?? 0;

        if (linkedClearance && lockedLine && prevQty >= orderedQty) {
          throw new CrmError('ORDER_ALREADY_ISSUED', 409);
        }
        if (linkedClearance && lockedLine && prevQty + qty > orderedQty && !input.allowOverIssue) {
          throw new CrmError('ISSUE_EXCEEDS_ORDERED_QTY', 409);
        }
        if (qty <= 0) {
          if (prevQty < orderedQty) allOrderLinesFullyIssued = false;
          continue;
        }

        const remQty = Math.max(0, orderedQty - prevQty - qty);
        if (remQty > 0) allOrderLinesFullyIssued = false;

        // Preserve historical price from locked order line if available
        const listUnitPrice = lockedLine
          ? Number(lockedLine.listUnitPrice)
          : Math.max(0, Math.round(Number(item.listUnitPrice ?? item.unitPrice ?? prod.retail_price ?? 0)));
        const lineDiscPct = lockedLine
          ? Number(lockedLine.discountPercent)
          : item.discountPercent !== undefined
            ? Math.max(0, Number(item.discountPercent))
            : Number(linkedClearance?.discount_percent ?? 0);
        const costUnitPrice = lockedLine?.costUnitPrice
          ? Number(lockedLine.costUnitPrice)
          : Math.max(0, Math.round(Number(item.costUnitPrice ?? prod.cost_price ?? Math.round(listUnitPrice * 0.7))));
        const lineVatRate =
          lockedLine?.vatRate !== undefined
            ? Number(lockedLine.vatRate)
            : item.vatRate !== undefined
              ? Math.max(0, Number(item.vatRate))
              : Number(linkedClearance?.vat_rate ?? 0);

        const lineListTotal = qty * listUnitPrice;
        const lineDiscAmt = Math.round((lineListTotal * lineDiscPct) / 100);
        const lineNetTotal = lineListTotal - lineDiscAmt;
        const netUnitPrice = qty > 0 ? Math.round(lineNetTotal / qty) : listUnitPrice;
        const lineVatAmt = Math.round((lineNetTotal * lineVatRate) / 100);
        const lineGrossTotal = lineNetTotal + lineVatAmt;
        const lineCostTotal = qty * costUnitPrice;

        totalQty += qty;
        listSubtotal += lineListTotal;
        totalDiscountAmount += lineDiscAmt;
        netSubtotal += lineNetTotal;
        totalVatAmount += lineVatAmt;
        totalAmount += lineGrossTotal;
        costTotal += lineCostTotal;

        handoverLines.push({
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          weightLabel: prod.weight_label,
          unitLabel: prod.stock_unit,
          orderedQuantity: orderedQty,
          previouslyIssuedQuantity: prevQty,
          quantity: qty,
          remainingQuantity: remQty,
          costUnitPrice,
          listUnitPrice,
          discountPercent: lineDiscPct,
          discountAmount: lineDiscAmt,
          unitPrice: netUnitPrice,
          netLineTotal: lineNetTotal,
          vatRate: lineVatRate,
          vatAmount: lineVatAmt,
          lineTotal: lineGrossTotal,
          note: String(item.note ?? ''),
        });
      }

      if (!handoverLines.length) {
        if (linkedClearance && lockedOrderLines.length > 0) {
          throw new CrmError('ORDER_ALREADY_ISSUED', 409);
        }
        throw new CrmError('INVALID_FIELDS', 400);
      }

      // Check and deduct handed-over quantities from warehouse inventory_balances
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
            `SELECT warehouse_id, location_id, product_id, lot_id,
                    on_hand::numeric(30,0)::text AS on_hand,
                    reserved::numeric(30,0)::text AS reserved
             FROM cohamy_crm.inventory_balances
             WHERE warehouse_id = $1 AND product_id = $2
             ORDER BY (on_hand - reserved) DESC, on_hand DESC
             FOR UPDATE`,
            [wh.id, hl.productId]
          )
        ).rows;

        const totalFree = balRows.reduce((acc, b) => {
          const oh = BigInt(b.on_hand || '0');
          const rs = BigInt(b.reserved || '0');
          return acc + (oh > rs ? oh - rs : 0n);
        }, 0n);

        if ((balRows.length > 0 || input.strictStock === true) && totalFree < remainingToDeduct) {
          throw new CrmError('INSUFFICIENT_STOCK', 409);
        }

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
      const deliveryStatus: 'ISSUED' | 'PARTIAL_ISSUED' = allOrderLinesFullyIssued ? 'ISSUED' : 'PARTIAL_ISSUED';
      const overallDiscPct =
        listSubtotal > 0 ? Number(((totalDiscountAmount / listSubtotal) * 100).toFixed(2)) : 0;

      await sql.query(
        `INSERT INTO cohamy_crm.warehouse_handover_invoices(
           id, code, warehouse_id, clearance_id, request_id, sales_order_id, organization_id,
           order_code, contract_code, issued_date,
           recipient_type, recipient_name, recipient_phone, organization_name,
           status, delivery_status, lines, total_quantity,
           list_subtotal, discount_percent, discount_amount, net_subtotal, vat_amount, total_amount, cost_total,
           idempotency_key, note, created_by, created_by_name, created_by_role
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_DATE,
           $10,$11,$12,$13,'HANDED_OVER',$14,$15::jsonb,$16,
           $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28
         )`,
        [
          id,
          code,
          wh.id,
          linkedClearance?.id ?? null,
          linkedClearance?.request_id ?? null,
          linkedClearance?.order_id ?? null,
          linkedClearance?.organization_id ?? null,
          finalOrderCode,
          contractCodeInput,
          recipientType,
          recipientName,
          recipientPhone,
          finalOrgName,
          deliveryStatus,
          JSON.stringify(handoverLines),
          String(totalQty),
          String(listSubtotal),
          String(overallDiscPct),
          String(totalDiscountAmount),
          String(netSubtotal),
          String(totalVatAmount),
          String(totalAmount),
          String(costTotal),
          idempotencyKey,
          note,
          user.id,
          user.displayName,
          user.role,
        ]
      );

      if (linkedClearance) {
        await sql.query(
          `UPDATE cohamy_crm.accounting_order_clearances
           SET status = $1,
               warehouse_issue_status = $2,
               warehouse_id = $3,
               picked_up_at = now(),
               picked_up_by_name = $4,
               updated_at = now()
           WHERE id = $5`,
          [
            allOrderLinesFullyIssued ? 'PICKED_UP_DELIVERED' : 'STAFF_SUBMITTED',
            deliveryStatus,
            wh.id,
            recipientName,
            linkedClearance.id,
          ]
        );
      }

      await audit(sql, user.id, 'warehouse.issue.created', 'warehouse-handover', id, {
        code,
        warehouseCode: wh.code,
        orderCode: finalOrderCode,
        totalQuantity: totalQty,
        listSubtotal,
        discountAmount: totalDiscountAmount,
        netSubtotal,
        vatAmount: totalVatAmount,
        totalAmount,
        deliveryStatus,
      });

      const whRoles = warehouseNotifyRolesForRegion(wh.region, wh.code);
      const targetTypeLabel = recipientType === 'STAFF' ? 'Nhân viên' : 'Khách hàng/Đối tác';
      await notifyRoles(sql, {
        roles: ['ACCOUNTANT', 'ADMIN', 'MANAGER', 'SALES', ...whRoles],
        eventKey: `wh_handover:${id}`,
        entityType: 'warehouse-handover',
        entityId: id,
        message: `[Phiếu xuất kho - ${wh.name}] Mã phiếu: ${code} · Thủ kho ${user.displayName} đã xuất ${totalQty.toLocaleString('vi-VN')} gói (Giá niêm yết: ${listSubtotal.toLocaleString('vi-VN')} đ · CK: ${totalDiscountAmount.toLocaleString('vi-VN')} đ · VAT: ${totalVatAmount.toLocaleString('vi-VN')} đ · Tổng TT: ${totalAmount.toLocaleString('vi-VN')} đ) cho ${targetTypeLabel}: ${recipientName}${finalOrderCode ? ` (Theo ĐH: ${finalOrderCode})` : ''}.`,
      });

      return {
        ok: true,
        id,
        code,
        deliveryStatus,
        totalQuantity: String(totalQty),
        listSubtotal: String(listSubtotal),
        discountAmount: String(totalDiscountAmount),
        netSubtotal: String(netSubtotal),
        vatAmount: String(totalVatAmount),
        totalAmount: String(totalAmount),
      };
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

      await audit(sql, user.id, 'warehouse.stock.adjusted', 'product', productId, {
        warehouseId: wh.id,
        warehouseCode: wh.code,
        newOnHand,
      });

      return {ok: true, warehouseId: wh.id, productId, onHand: String(newOnHand)};
    }

    if (action === 'record-order-payment' || action === 'staff-submit-payment') {
      if (!['ACCOUNTANT', 'ADMIN', 'MANAGER', 'SALES', 'WAREHOUSE', 'WAREHOUSE_HN', 'WAREHOUSE_HCM'].includes(user.role)) {
        throw new CrmError('FORBIDDEN', 403);
      }
      const clearanceId = String(input.clearanceId ?? '').trim();
      const amount = Math.max(
        0,
        Math.round(Number(input.amount ?? input.submittedAmount ?? 0))
      );
      const paymentMethod = String(input.paymentMethod ?? 'BANK_TRANSFER').trim();
      const bankAccount = String(input.bankAccount ?? '').trim();
      const referenceCode = String(input.referenceCode ?? input.reference ?? '').trim();
      const transferContent = String(input.transferContent ?? input.note ?? '').trim();
      const proofDocumentId = input.proofDocumentId ? String(input.proofDocumentId).trim() : null;
      const warehouseId = input.warehouseId ? String(input.warehouseId).trim() : null;
      const idempotencyKey = input.idempotencyKey ? String(input.idempotencyKey).trim() : null;
      if (!clearanceId || amount <= 0) throw new CrmError('INVALID_FIELDS', 400);

      if (idempotencyKey) {
        const dup = (
          await sql.query<{id: string}>(
            'SELECT id FROM cohamy_crm.order_payment_transactions WHERE idempotency_key = $1 LIMIT 1',
            [idempotencyKey]
          )
        ).rows[0];
        if (dup) throw new CrmError('DUPLICATE_PAYMENT_TRANSACTION', 409);
      }

      const row = (
        await sql.query<{
          id: string;
          request_id: string;
          order_id: string | null;
          organization_id: string;
          document_code: string;
          organization_name: string;
          list_subtotal: string;
          discount_percent: string;
          net_total: string;
          gross_total: string;
        }>(
          `SELECT c.id, c.request_id, c.order_id, c.organization_id, c.document_code, o.name AS organization_name,
                  c.list_subtotal::text, c.discount_percent::text, c.net_total::text, c.gross_total::text
           FROM cohamy_crm.accounting_order_clearances c
           JOIN cohamy_crm.organizations o ON o.id = c.organization_id
           WHERE c.id = $1 FOR UPDATE OF c`,
          [clearanceId]
        )
      ).rows[0];
      if (!row) throw new CrmError('NOT_FOUND', 404);

      const isAccountantOrManager = ['ACCOUNTANT', 'ADMIN', 'MANAGER'].includes(user.role);
      const txStatus: 'CONFIRMED' | 'PENDING' =
        action === 'record-order-payment' && isAccountantOrManager
          ? 'CONFIRMED'
          : input.autoConfirm === true && isAccountantOrManager
            ? 'CONFIRMED'
            : isAccountantOrManager
              ? 'CONFIRMED'
              : 'PENDING';

      const txId = randomUUID();
      const txCode = `TT-${vietnamBusinessDate(new Date())}-${txId.slice(0, 6).toUpperCase()}`;

      await sql.query(
        `INSERT INTO cohamy_crm.order_payment_transactions(
           id, code, clearance_id, order_id, organization_id, payment_date,
           amount, bank_account, reference_code, transfer_content, payment_method,
           proof_document_id, status, confirmed_by, confirmed_by_name, confirmed_at,
           created_by, created_by_name, idempotency_key
         ) VALUES ($1,$2,$3,$4,$5,COALESCE($6::timestamptz, now()),$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          txId,
          txCode,
          row.id,
          row.order_id,
          row.organization_id,
          input.paymentDate ? String(input.paymentDate) : null,
          String(amount),
          bankAccount,
          referenceCode,
          transferContent,
          paymentMethod,
          proofDocumentId,
          txStatus,
          txStatus === 'CONFIRMED' ? user.id : null,
          txStatus === 'CONFIRMED' ? user.displayName : '',
          txStatus === 'CONFIRMED' ? new Date().toISOString() : null,
          user.id,
          user.displayName,
          idempotencyKey,
        ]
      );

      if (warehouseId) {
        await sql.query(
          'UPDATE cohamy_crm.accounting_order_clearances SET warehouse_id = COALESCE($1, warehouse_id) WHERE id = $2',
          [warehouseId, row.id]
        );
      }

      const totals = await recalculateClearancePaymentTotals(sql, row.id);

      await audit(sql, user.id, 'order.payment.recorded', 'payment', txId, {
        clearanceId: row.id,
        documentCode: row.document_code,
        amount,
        paymentMethod,
        referenceCode,
        txStatus,
        paidAmount: totals.paidAmount,
        remainingDebt: totals.remainingDebt,
        paymentStatus: totals.paymentStatus,
      });

      await notifyRoles(sql, {
        roles: ['ACCOUNTANT', 'ADMIN', 'MANAGER'],
        eventKey: `order_payment:${txId}`,
        entityType: 'payment',
        entityId: txId,
        message: `[Ghi nhận thanh toán đơn hàng] ${user.displayName} đã ghi nhận ${amount.toLocaleString('vi-VN')} đ (${paymentMethod}) cho đơn ${row.document_code} (${row.organization_name}) · Đã thu: ${Number(totals.paidAmount).toLocaleString('vi-VN')} đ · Còn nợ: ${Number(totals.remainingDebt).toLocaleString('vi-VN')} đ (${totals.paymentStatus}).`,
      });

      return {
        ok: true,
        id: row.id,
        transactionId: txId,
        transactionCode: txCode,
        transactionStatus: txStatus,
        paidAmount: totals.paidAmount,
        remainingDebt: totals.remainingDebt,
        paymentStatus: totals.paymentStatus,
        status: totals.status,
      };
    }

    if (action === 'confirm-order-payment') {
      if (!['ACCOUNTANT', 'ADMIN', 'MANAGER'].includes(user.role)) {
        throw new CrmError('FORBIDDEN', 403);
      }
      const transactionId = String(input.transactionId ?? '').trim();
      const decision = String(input.decision ?? 'CONFIRM') === 'REJECT' ? 'REJECTED' : 'CONFIRMED';
      if (!transactionId) throw new CrmError('INVALID_FIELDS', 400);

      const tx = (
        await sql.query<{id: string; clearance_id: string; amount: string}>(
          'SELECT id, clearance_id, amount::text FROM cohamy_crm.order_payment_transactions WHERE id = $1 FOR UPDATE',
          [transactionId]
        )
      ).rows[0];
      if (!tx) throw new CrmError('NOT_FOUND', 404);

      await sql.query(
        `UPDATE cohamy_crm.order_payment_transactions
         SET status = $1, confirmed_by = $2, confirmed_by_name = $3, confirmed_at = now()
         WHERE id = $4`,
        [decision, user.id, user.displayName, transactionId]
      );

      const totals = await recalculateClearancePaymentTotals(sql, tx.clearance_id);

      await audit(sql, user.id, 'order.payment.confirmed', 'payment', transactionId, {
        clearanceId: tx.clearance_id,
        decision,
        paidAmount: totals.paidAmount,
        remainingDebt: totals.remainingDebt,
        paymentStatus: totals.paymentStatus,
      });

      return {
        ok: true,
        transactionId,
        decision,
        paidAmount: totals.paidAmount,
        remainingDebt: totals.remainingDebt,
        paymentStatus: totals.paymentStatus,
      };
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
          order_id: string | null;
          organization_id: string;
          document_code: string;
          organization_name: string;
          discount_percent: string;
          net_total: string;
          gross_total: string;
          staff_submitted_amount: string;
          staff_payment_method: string;
          staff_reference: string;
          staff_submitted_by: string | null;
        }>(
          `SELECT c.id, c.request_id, c.order_id, c.organization_id, c.document_code, o.name AS organization_name,
                  c.discount_percent::text, c.net_total::text, c.gross_total::text,
                  c.staff_submitted_amount::text, c.staff_payment_method, c.staff_reference, c.staff_submitted_by
           FROM cohamy_crm.accounting_order_clearances c
           JOIN cohamy_crm.organizations o ON o.id = c.organization_id
           WHERE c.id = $1 FOR UPDATE OF c`,
          [clearanceId]
        )
      ).rows[0];
      if (!row) throw new CrmError('NOT_FOUND', 404);

      if (decision === 'ACCOUNTANT_CLEARED') {
        await sql.query(
          `UPDATE cohamy_crm.order_payment_transactions
           SET status = 'CONFIRMED', confirmed_by = $1, confirmed_by_name = $2, confirmed_at = now()
           WHERE clearance_id = $3 AND status = 'PENDING'`,
          [user.id, user.displayName, clearanceId]
        );
        const existingTxCount = Number(
          (
            await sql.query<{n: string}>(
              'SELECT COUNT(*)::text AS n FROM cohamy_crm.order_payment_transactions WHERE clearance_id = $1',
              [clearanceId]
            )
          ).rows[0]?.n ?? 0
        );
        const payAmt =
          submittedOverride !== null
            ? submittedOverride
            : Number(row.staff_submitted_amount || row.gross_total || row.net_total || 0);
        if (existingTxCount === 0 && payAmt > 0) {
          const txId = randomUUID();
          const txCode = `TT-${vietnamBusinessDate(new Date())}-${txId.slice(0, 6).toUpperCase()}`;
          await sql.query(
            `INSERT INTO cohamy_crm.order_payment_transactions(
               id, code, clearance_id, order_id, organization_id, amount,
               payment_method, reference_code, transfer_content,
               status, confirmed_by, confirmed_by_name, confirmed_at,
               created_by, created_by_name
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'CONFIRMED',$10,$11,now(),$10,$11)`,
            [
              txId,
              txCode,
              row.id,
              row.order_id,
              row.organization_id,
              String(payAmt),
              row.staff_payment_method || 'BANK_TRANSFER',
              row.staff_reference || '',
              note || 'Kế toán đối chiếu xác nhận thanh toán',
              user.id,
              user.displayName,
            ]
          );
        }
      }

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

      const totals = await recalculateClearancePaymentTotals(sql, clearanceId);

      await notifyRoles(sql, {
        roles: ['SALES', 'WAREHOUSE', 'WAREHOUSE_HN', 'WAREHOUSE_HCM', 'ADMIN', 'MANAGER'],
        eventKey: `kt_verify_clearance:${clearanceId}:${Date.now()}`,
        entityType: 'order-clearance',
        entityId: clearanceId,
        message:
          decision === 'ACCOUNTANT_CLEARED'
            ? `[Kế toán đối chiếu thanh toán] Kế toán ${user.displayName} đã xác nhận thanh toán (${Number(totals.paidAmount).toLocaleString('vi-VN')} đ · Còn nợ: ${Number(totals.remainingDebt).toLocaleString('vi-VN')} đ) cho đơn ${row.document_code} (${row.organization_name}).`
            : `[Kế toán ghi chú công nợ] Đơn ${row.document_code} (${row.organization_name}): ${note || 'Cần kiểm tra lại chứng từ thanh toán'}.`,
        extraUserIds: row.staff_submitted_by ? [row.staff_submitted_by] : [],
      });

      return {
        ok: true,
        id: clearanceId,
        status: decision,
        paidAmount: totals.paidAmount,
        remainingDebt: totals.remainingDebt,
        paymentStatus: totals.paymentStatus,
      };
    }

    if (action === 'confirm-warehouse-pickup') {
      // ONLY Warehouse Keepers, Admin, Manager can confirm warehouse issue/pickup.
      // NO Accountant clearance required before warehouse issue!
      if (!['ADMIN', 'MANAGER', 'WAREHOUSE', 'WAREHOUSE_HCM', 'WAREHOUSE_HN'].includes(user.role)) {
        throw new CrmError('FORBIDDEN', 403);
      }
      const clearanceId = String(input.clearanceId ?? '').trim();
      const warehouseId = input.warehouseId ? String(input.warehouseId).trim() : null;
      const row = (
        await sql.query<{
          id: string;
          status: string;
          warehouse_issue_status: string;
          warehouse_id: string | null;
          document_code: string;
          organization_name: string;
          orderer_name: string;
          orderer_phone: string;
        }>(
          `SELECT c.id, c.status, COALESCE(c.warehouse_issue_status, 'NOT_ISSUED') AS warehouse_issue_status,
                  c.warehouse_id, c.document_code, o.name AS organization_name,
                  COALESCE(c.orderer_name, '') AS orderer_name, COALESCE(c.orderer_phone, '') AS orderer_phone
           FROM cohamy_crm.accounting_order_clearances c
           JOIN cohamy_crm.organizations o ON o.id = c.organization_id
           WHERE c.id = $1 FOR UPDATE OF c`,
          [clearanceId]
        )
      ).rows[0];
      if (!row) throw new CrmError('NOT_FOUND', 404);
      if (row.warehouse_issue_status === 'ISSUED' || row.status === 'PICKED_UP_DELIVERED') {
        throw new CrmError('ORDER_ALREADY_ISSUED', 409);
      }

      await sql.query(
        `UPDATE cohamy_crm.accounting_order_clearances
         SET status = 'PICKED_UP_DELIVERED',
             warehouse_issue_status = 'ISSUED',
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
        message: `[Đã xuất kho giao khách] Thủ kho ${user.displayName} đã xác nhận xuất kho đơn hàng ${row.document_code} (${row.organization_name}).`,
      });

      return {ok: true, id: clearanceId, status: 'PICKED_UP_DELIVERED', warehouseIssueStatus: 'ISSUED'};
    }

    if (action === 'create-factory-order' || action === 'create-factory-dispatch') {
      if (!['ADMIN', 'MANAGER', 'FACTORY', 'ACCOUNTANT'].includes(user.role)) {
        throw new CrmError('FORBIDDEN', 403);
      }
      const stage = action === 'create-factory-order' ? 'FACTORY_ORDER' : 'FACTORY_DISPATCH';
      const voucherType =
        String(input.voucherType ?? 'INTERNAL_TRANSFER') === 'SUPPLIER_PURCHASE'
          ? 'SUPPLIER_PURCHASE'
          : 'INTERNAL_TRANSFER';
      const supplierId = input.supplierId ? String(input.supplierId).trim() : null;
      const warehouseId = String(input.warehouseId ?? '').trim();
      const parentId =
        input.parentId || input.parentInvoiceId
          ? String(input.parentId ?? input.parentInvoiceId)
          : null;
      const factoryName = String(input.factoryName ?? 'Nhà máy Sản xuất Cohamy').trim() || 'Nhà máy Sản xuất Cohamy';
      const dispatchedDate = input.dispatchedDate ? String(input.dispatchedDate).trim() : null;
      const note = String(input.note ?? '').trim();
      const idempotencyKey = input.idempotencyKey ? String(input.idempotencyKey).trim() : null;
      const rawLines = Array.isArray(input.lines) ? (input.lines as Array<Record<string, unknown>>) : [];

      if (idempotencyKey) {
        const dup = (
          await sql.query<{id: string}>(
            'SELECT id FROM cohamy_crm.factory_invoices WHERE idempotency_key = $1 LIMIT 1',
            [idempotencyKey]
          )
        ).rows[0];
        if (dup) throw new CrmError('DUPLICATE_FACTORY_DISPATCH', 409);
      }

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
      let subtotalAmt = 0;
      let totalDiscountAmt = 0;
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
          await sql.query<{id: string; sku: string; name: string; weight_label: string; stock_unit: string; retail_price: string; cost_price: string}>(
            `SELECT id, sku, name, weight_label, COALESCE(stock_unit, 'Gói') AS stock_unit,
                    retail_price::text,
                    COALESCE(NULLIF(cost_price, 0), ROUND(retail_price * 0.7))::numeric(30,0)::text AS cost_price
             FROM cohamy_crm.products WHERE id::text = $1 OR sku = $1 LIMIT 1`,
            [String(item.productId ?? item.productIdOrSku ?? item.sku ?? '')]
          )
        ).rows[0];
        if (!prod) continue;
        const unitPrice = Math.max(
          0,
          Math.round(Number(item.factoryUnitPrice ?? item.unitCost ?? prod.cost_price ?? prod.retail_price ?? 0))
        );
        const lineDiscPct = Math.max(0, Math.min(90, Number(item.discountPercent ?? input.discountPercent ?? 0)));
        const grossLine = Math.round(qty * unitPrice);
        const discLine = Math.round((grossLine * lineDiscPct) / 100);
        const lineTotal = grossLine - discLine;
        totalOrd += ordQty;
        totalDisp += dispQty;
        subtotalAmt += grossLine;
        totalDiscountAmt += discLine;
        totalAmt += lineTotal;
        lines.push({
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          weightLabel: prod.weight_label,
          unitLabel: prod.stock_unit,
          orderedQty: ordQty,
          dispatchedQty: dispQty,
          receivedQty: 0,
          missingQty: 0,
          excessQty: 0,
          damagedQty: 0,
          discrepancyQty: 0,
          factoryUnitPrice: unitPrice,
          discountPercent: lineDiscPct,
          discountAmount: discLine,
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

      // IMPORTANT: Factory dispatch NEVER increments warehouse inventory_balances.
      // Stock is only incremented when Warehouse Keeper confirms receipt (create-warehouse-reconciliation).
      await sql.query(
        `INSERT INTO cohamy_crm.factory_invoices(
           id, code, stage, voucher_type, supplier_id, parent_id, warehouse_id, factory_name,
           dispatched_date, status, reconciliation_status, lines,
           total_ordered_qty, total_dispatched_qty, total_received_qty,
           subtotal_amount, discount_amount, total_amount,
           idempotency_key, note, created_by, created_by_name, created_by_role
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,
           COALESCE($9::date, CURRENT_DATE),$10,'PENDING_RECEIPT',$11::jsonb,
           $12,$13,0,
           $14,$15,$16,
           $17,$18,$19,$20,$21
         )`,
        [
          id,
          code,
          stage,
          voucherType,
          supplierId,
          parentId,
          wh.id,
          factoryName,
          dispatchedDate,
          status,
          JSON.stringify(lines),
          String(totalOrd),
          String(totalDisp),
          String(subtotalAmt),
          String(totalDiscountAmt),
          String(totalAmt),
          idempotencyKey,
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

      await audit(sql, user.id, `factory.${stage.toLowerCase()}.created`, 'factory-invoice', id, {
        code,
        stage,
        voucherType,
        warehouseCode: wh.code,
        totalDispatchedQty: totalDisp,
        totalAmount: totalAmt,
      });

      const whRoles = warehouseNotifyRolesForRegion(wh.region, wh.code);
      const msg =
        stage === 'FACTORY_ORDER'
          ? `[Hóa đơn đặt hàng Nhà máy] ${code} · Kho nhận: ${wh.name} (${wh.code}) · Số lượng: ${totalOrd.toLocaleString('vi-VN')} gói · Tổng giá trị: ${totalAmt.toLocaleString('vi-VN')} đ.`
          : `[Phiếu xuất Nhà máy → Kho] ${code} · Đẩy về: ${wh.name} (${wh.code}) · Số lượng xuất: ${totalDisp.toLocaleString('vi-VN')} gói · Giá trị: ${totalAmt.toLocaleString('vi-VN')} đ (Chờ Thủ kho nhận thực tế & Kế toán đối chiếu).`;

      await notifyRoles(sql, {
        roles: ['ACCOUNTANT', 'ADMIN', 'MANAGER', 'FACTORY', ...whRoles],
        eventKey: `factory_inv:${id}:${stage}`,
        entityType: 'factory-invoice',
        entityId: id,
        message: msg,
      });

      return {ok: true, id, code, stage, reconciliationStatus: 'PENDING_RECEIPT'};
    }

    if (action === 'create-warehouse-reconciliation') {
      // ONLY Warehouse Keepers, Admin, Manager can confirm receipt of factory dispatch.
      // Accountant and Factory CANNOT confirm warehouse receipt!
      if (!['ADMIN', 'MANAGER', 'WAREHOUSE', 'WAREHOUSE_HN', 'WAREHOUSE_HCM'].includes(user.role)) {
        throw new CrmError('FORBIDDEN', 403);
      }
      const dispatchInvoiceId = String(input.dispatchInvoiceId ?? input.parentInvoiceId ?? '').trim();
      const note = String(input.note ?? '').trim();
      const idempotencyKey = input.idempotencyKey ? String(input.idempotencyKey).trim() : null;
      const rawInputLines = Array.isArray(input.lines)
        ? (input.lines as Array<Record<string, unknown>>)
        : Array.isArray(input.receivedLines)
          ? (input.receivedLines as Array<Record<string, unknown>>)
          : [];

      if (idempotencyKey) {
        const dup = (
          await sql.query<{id: string}>(
            'SELECT id FROM cohamy_crm.factory_invoices WHERE idempotency_key = $1 LIMIT 1',
            [idempotencyKey]
          )
        ).rows[0];
        if (dup) throw new CrmError('ALREADY_RECONCILED', 409);
      }

      let parent: {
        id: string;
        code: string;
        voucher_type: 'INTERNAL_TRANSFER' | 'SUPPLIER_PURCHASE';
        supplier_id: string | null;
        warehouse_id: string;
        factory_name: string;
        status: string;
        reconciliation_status: string;
        lines: FactoryInvoiceLine[];
      } | null = null;

      if (dispatchInvoiceId) {
        parent =
          (
            await sql.query<{
              id: string;
              code: string;
              voucher_type: 'INTERNAL_TRANSFER' | 'SUPPLIER_PURCHASE';
              supplier_id: string | null;
              warehouse_id: string;
              factory_name: string;
              status: string;
              reconciliation_status: string;
              lines: FactoryInvoiceLine[];
            }>(
              `SELECT id, code, COALESCE(voucher_type, 'INTERNAL_TRANSFER') AS voucher_type,
                      supplier_id, warehouse_id, factory_name, status,
                      COALESCE(reconciliation_status, 'PENDING_RECEIPT') AS reconciliation_status, lines
               FROM cohamy_crm.factory_invoices WHERE id = $1 FOR UPDATE`,
              [dispatchInvoiceId]
            )
          ).rows[0] ?? null;

        if (!parent) throw new CrmError('NOT_FOUND', 404);

        const existingChild = (
          await sql.query<{id: string}>(
            "SELECT id FROM cohamy_crm.factory_invoices WHERE parent_id = $1 AND stage = 'WAREHOUSE_RECONCILIATION' LIMIT 1",
            [parent.id]
          )
        ).rows[0];
        if (existingChild || (parent.status !== 'DISPATCHED' && parent.status !== 'ISSUED')) {
          throw new CrmError('ALREADY_RECONCILED', 409);
        }
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
          const missingQty =
            match?.missingQty !== undefined
              ? Math.max(0, Number(match.missingQty))
              : diff < 0
                ? Math.abs(diff)
                : 0;
          const excessQty =
            match?.excessQty !== undefined
              ? Math.max(0, Number(match.excessQty))
              : diff > 0
                ? diff
                : 0;
          const damagedQty = Math.max(0, Number(match?.damagedQty ?? 0));
          if (diff !== 0 || damagedQty > 0) hasDiscrepancy = true;
          const unitCost = Number(
            match?.unitCost ?? match?.factoryUnitPrice ?? line.factoryUnitPrice ?? 0
          );
          const discPct = Number(line.discountPercent ?? 0);
          const grossRec = Math.round(recQty * unitCost);
          const discRec = Math.round((grossRec * discPct) / 100);
          const recTotal = grossRec - discRec;
          totalOrd += Number(line.orderedQty || dispQty);
          totalDisp += dispQty;
          totalRec += recQty;
          totalAmt += recTotal;
          return {
            ...line,
            factoryUnitPrice: unitCost,
            dispatchedQty: dispQty,
            receivedQty: recQty,
            missingQty,
            excessQty,
            damagedQty,
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
            await sql.query<{id: string; sku: string; name: string; weight_label: string; stock_unit: string; retail_price: string}>(
              "SELECT id, sku, name, weight_label, COALESCE(stock_unit, 'Gói') AS stock_unit, retail_price::text FROM cohamy_crm.products WHERE id::text = $1 OR sku = $1 LIMIT 1",
              [String(item.productId ?? item.productIdOrSku ?? item.sku ?? '')]
            )
          ).rows[0];
          if (!prod) continue;
          const unitCost = Math.max(
            0,
            Math.round(Number(item.unitCost ?? item.factoryUnitPrice ?? prod.retail_price ?? 0))
          );
          const diff = recQty - dispQty;
          const missingQty = diff < 0 ? Math.abs(diff) : 0;
          const excessQty = diff > 0 ? diff : 0;
          const damagedQty = Math.max(0, Number(item.damagedQty ?? 0));
          if (diff !== 0 || damagedQty > 0) hasDiscrepancy = true;
          const recTotal = Math.round(recQty * unitCost);
          totalOrd += ordQty;
          totalDisp += dispQty;
          totalRec += recQty;
          totalAmt += recTotal;
          reconciledLines.push({
            productId: prod.id,
            sku: prod.sku,
            name: prod.name,
            weightLabel: prod.weight_label,
            unitLabel: prod.stock_unit,
            orderedQty: ordQty,
            dispatchedQty: dispQty,
            receivedQty: recQty,
            missingQty,
            excessQty,
            damagedQty,
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
      const reconciliationStatus = hasDiscrepancy ? 'DISCREPANCY' : 'MATCHED';

      await sql.query(
        `INSERT INTO cohamy_crm.factory_invoices(
           id, code, stage, voucher_type, supplier_id, parent_id, warehouse_id, factory_name,
           received_date, status, reconciliation_status, lines,
           total_ordered_qty, total_dispatched_qty, total_received_qty,
           subtotal_amount, total_amount, idempotency_key,
           note, created_by, created_by_name, created_by_role,
           reconciled_by, reconciled_by_name, reconciled_at
         ) VALUES (
           $1,$2,'WAREHOUSE_RECONCILIATION',$3,$4,$5,$6,$7,
           CURRENT_DATE,$8,$9,$10::jsonb,
           $11,$12,$13,$14,$14,$15,
           $16,$17,$18,$19,$17,$18,now()
         )`,
        [
          id,
          code,
          parent?.voucher_type ?? 'INTERNAL_TRANSFER',
          parent?.supplier_id ?? null,
          parent?.id ?? null,
          wh.id,
          parent?.factory_name ?? 'Nhà máy Sản xuất Cohamy',
          status,
          reconciliationStatus,
          JSON.stringify(reconciledLines),
          String(totalOrd),
          String(totalDisp),
          String(totalRec),
          String(totalAmt),
          idempotencyKey,
          note,
          user.id,
          user.displayName,
          user.role,
        ]
      );

      // Update parent dispatch status WITHOUT modifying parent's original dispatched quantities or lines!
      if (parent) {
        await sql.query(
          `UPDATE cohamy_crm.factory_invoices
           SET status = $1,
               reconciliation_status = $2,
               received_date = CURRENT_DATE,
               reconciled_by = $3,
               reconciled_by_name = $4,
               reconciled_at = now(),
               updated_at = now()
           WHERE id = $5`,
          [status, reconciliationStatus, user.id, user.displayName, parent.id]
        );
      }

      // Increment warehouse inventory_balances ONLY by the actual receivedQty
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

      await audit(sql, user.id, 'warehouse.receipt.reconciled', 'warehouse-reconciliation', id, {
        code,
        parentDispatchId: parent?.id ?? null,
        parentDispatchCode: parent?.code ?? null,
        warehouseCode: wh.code,
        totalDispatchedQty: totalDisp,
        totalReceivedQty: totalRec,
        discrepancyQty: totalRec - totalDisp,
        status,
        reconciliationStatus,
      });

      await notifyRoles(sql, {
        roles: ['ACCOUNTANT', 'ADMIN', 'MANAGER', 'FACTORY'],
        eventKey: `wh_reconcile:${id}`,
        entityType: 'warehouse-reconciliation',
        entityId: id,
        message: `[Phiếu nhập kho & Đối chiếu Nhà máy] Thủ kho ${wh.name} (${user.displayName}) đã lập phiếu nhập ${code}${parent ? ` (từ ${parent.code})` : ''}: Nhà máy xuất ${totalDisp.toLocaleString('vi-VN')} gói / Kho thực nhận ${totalRec.toLocaleString('vi-VN')} gói (${hasDiscrepancy ? `CHÊNH LỆCH ${totalRec - totalDisp}` : 'Khớp 100%'}) · Giá trị nhập: ${totalAmt.toLocaleString('vi-VN')} đ.`,
      });

      return {
        ok: true,
        id,
        code,
        status,
        reconciliationStatus,
        totalDispatchedQty: String(totalDisp),
        totalReceivedQty: String(totalRec),
        discrepancyQty: totalRec - totalDisp,
      };
    }

    if (action === 'update-reconciliation-status') {
      if (!['ACCOUNTANT', 'ADMIN', 'MANAGER'].includes(user.role)) {
        throw new CrmError('FORBIDDEN', 403);
      }
      const invoiceId = String(input.invoiceId ?? '').trim();
      const reconciliationStatus = String(input.reconciliationStatus ?? 'COMPLETED') as FactoryInvoiceRecord['reconciliationStatus'];
      const resolutionNote = String(input.note ?? '').trim();
      if (
        !invoiceId ||
        !['PENDING_RECEIPT', 'MATCHED', 'DISCREPANCY', 'RESOLVING_DISCREPANCY', 'COMPLETED'].includes(
          reconciliationStatus ?? ''
        )
      ) {
        throw new CrmError('INVALID_FIELDS', 400);
      }

      const inv = (
        await sql.query<{id: string; parent_id: string | null; note: string}>(
          'SELECT id, parent_id, note FROM cohamy_crm.factory_invoices WHERE id = $1 FOR UPDATE',
          [invoiceId]
        )
      ).rows[0];
      if (!inv) throw new CrmError('NOT_FOUND', 404);

      const mergedNote = resolutionNote ? (inv.note ? `${inv.note} | ${resolutionNote}` : resolutionNote) : inv.note;
      await sql.query(
        `UPDATE cohamy_crm.factory_invoices
         SET reconciliation_status = $1,
             note = $2,
             accountant_verified = CASE WHEN $1 = 'COMPLETED' THEN true ELSE accountant_verified END,
             accountant_verified_by = CASE WHEN $1 = 'COMPLETED' THEN $3 ELSE accountant_verified_by END,
             accountant_verified_by_name = CASE WHEN $1 = 'COMPLETED' THEN $4 ELSE accountant_verified_by_name END,
             accountant_verified_at = CASE WHEN $1 = 'COMPLETED' THEN now() ELSE accountant_verified_at END,
             updated_at = now()
         WHERE id = $5 OR ($6::uuid IS NOT NULL AND id = $6) OR parent_id = $5`,
        [reconciliationStatus, mergedNote, user.id, user.displayName, inv.id, inv.parent_id]
      );

      await audit(sql, user.id, 'factory.reconciliation.status_updated', 'factory-invoice', inv.id, {
        reconciliationStatus,
        note: resolutionNote,
      });

      return {ok: true, id: inv.id, reconciliationStatus};
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
             reconciliation_status = CASE WHEN $4 = 'PAID' THEN 'COMPLETED' ELSE reconciliation_status END,
             updated_at = now()
         WHERE id = $5`,
        [user.id, user.displayName, nextPaid.toString(), nextStatus, invoiceId]
      );

      return {ok: true, id: invoiceId, paidAmount: nextPaid.toString(), status: nextStatus};
    }

    if (action === 'save-vat-invoice' || action === 'attach-vat-document' || action === 'request-vat-adjustment') {
      // ONLY Accountant, Admin, Manager can manage VAT invoices!
      if (!['ACCOUNTANT', 'ADMIN', 'MANAGER'].includes(user.role)) {
        throw new CrmError('FORBIDDEN', 403);
      }

      if (action === 'request-vat-adjustment') {
        const vatInvoiceId = String(input.vatInvoiceId ?? input.id ?? '').trim();
        const adjustmentReason = String(input.adjustmentReason ?? input.reason ?? '').trim();
        if (!vatInvoiceId || !adjustmentReason) throw new CrmError('INVALID_FIELDS', 400);

        const existingVat = (
          await sql.query<{id: string; clearance_id: string | null}>(
            'SELECT id, clearance_id FROM cohamy_crm.vat_invoices WHERE id = $1 FOR UPDATE',
            [vatInvoiceId]
          )
        ).rows[0];
        if (!existingVat) throw new CrmError('NOT_FOUND', 404);

        await sql.query(
          `UPDATE cohamy_crm.vat_invoices
           SET status = 'ADJUSTMENT_REQUESTED',
               adjustment_reason = $1,
               updated_by = $2,
               updated_by_name = $3,
               updated_at = now()
           WHERE id = $4`,
          [adjustmentReason, user.id, user.displayName, vatInvoiceId]
        );

        if (existingVat.clearance_id) {
          await sql.query(
            "UPDATE cohamy_crm.accounting_order_clearances SET vat_invoice_status = 'ADJUSTMENT_REQUESTED', updated_at = now() WHERE id = $1",
            [existingVat.clearance_id]
          );
        }

        await audit(sql, user.id, 'vat.invoice.adjustment_requested', 'vat-invoice', vatInvoiceId, {
          adjustmentReason,
        });

        return {ok: true, id: vatInvoiceId, status: 'ADJUSTMENT_REQUESTED'};
      }

      if (action === 'attach-vat-document') {
        const vatInvoiceId = String(input.vatInvoiceId ?? input.id ?? '').trim();
        const pdfDocumentId = input.pdfDocumentId ? String(input.pdfDocumentId).trim() : null;
        const xmlDocumentId = input.xmlDocumentId ? String(input.xmlDocumentId).trim() : null;
        if (!vatInvoiceId || (!pdfDocumentId && !xmlDocumentId)) {
          throw new CrmError('INVALID_FIELDS', 400);
        }

        const existingVat = (
          await sql.query<{
            id: string;
            clearance_id: string | null;
            invoice_number: string;
            issued_date: string | null;
            pdf_document_id: string | null;
            xml_document_id: string | null;
            status: VatInvoiceRecord['status'];
          }>(
            `SELECT id, clearance_id, invoice_number, issued_date::text, pdf_document_id, xml_document_id, status
             FROM cohamy_crm.vat_invoices WHERE id = $1 FOR UPDATE`,
            [vatInvoiceId]
          )
        ).rows[0];
        if (!existingVat) throw new CrmError('NOT_FOUND', 404);

        const nextPdf = pdfDocumentId ?? existingVat.pdf_document_id;
        const nextXml = xmlDocumentId ?? existingVat.xml_document_id;
        const hasNumberAndDate = Boolean(existingVat.invoice_number.trim() && existingVat.issued_date);
        const nextStatus: VatInvoiceRecord['status'] =
          hasNumberAndDate && (nextPdf || nextXml)
            ? 'ISSUED'
            : hasNumberAndDate
              ? 'ISSUED_MISSING_FILES'
              : 'UNISSUED';

        await sql.query(
          `UPDATE cohamy_crm.vat_invoices
           SET pdf_document_id = $1,
               xml_document_id = $2,
               status = $3,
               updated_by = $4,
               updated_by_name = $5,
               updated_at = now()
           WHERE id = $6`,
          [nextPdf, nextXml, nextStatus, user.id, user.displayName, vatInvoiceId]
        );

        if (existingVat.clearance_id) {
          await sql.query(
            'UPDATE cohamy_crm.accounting_order_clearances SET vat_invoice_status = $1, updated_at = now() WHERE id = $2',
            [nextStatus, existingVat.clearance_id]
          );
        }

        await audit(sql, user.id, 'vat.invoice.document_attached', 'vat-invoice', vatInvoiceId, {
          pdfDocumentId: nextPdf,
          xmlDocumentId: nextXml,
          status: nextStatus,
        });

        return {ok: true, id: vatInvoiceId, status: nextStatus, pdfDocumentId: nextPdf, xmlDocumentId: nextXml};
      }

      // action === 'save-vat-invoice'
      const vatInvoiceId = input.id || input.vatInvoiceId ? String(input.id ?? input.vatInvoiceId).trim() : null;
      const clearanceIdInput = input.clearanceId ? String(input.clearanceId).trim() : null;
      const handoverInvoiceIdInput = input.handoverInvoiceId ? String(input.handoverInvoiceId).trim() : null;
      const invoiceNumber = String(input.invoiceNumber ?? '').trim();
      const invoiceSymbol = String(input.invoiceSymbol ?? '1C26TAA').trim();
      const issuedDate = input.issuedDate ? String(input.issuedDate).trim() : null;
      const invoiceType = (
        ['ORIGINAL', 'ADJUSTMENT', 'REPLACEMENT'].includes(String(input.invoiceType ?? 'ORIGINAL'))
          ? String(input.invoiceType ?? 'ORIGINAL')
          : 'ORIGINAL'
      ) as 'ORIGINAL' | 'ADJUSTMENT' | 'REPLACEMENT';
      const parentVatInvoiceId = input.parentVatInvoiceId ? String(input.parentVatInvoiceId).trim() : null;
      const adjustmentReason = String(input.adjustmentReason ?? '').trim();
      const note = String(input.note ?? '').trim();
      const pdfDocumentId = input.pdfDocumentId ? String(input.pdfDocumentId).trim() : null;
      const xmlDocumentId = input.xmlDocumentId ? String(input.xmlDocumentId).trim() : null;

      let clRow: {
        id: string;
        request_id: string;
        order_id: string | null;
        organization_id: string;
        warehouse_id: string | null;
        document_code: string;
        contract_code: string;
        list_subtotal: string;
        discount_percent: string;
        discount_amount: string;
        net_total: string;
        vat_rate: string;
        vat_amount: string;
        gross_total: string;
        immutable_lines: OrderClearanceLine[];
        snapshot: Record<string, unknown>;
      } | null = null;

      if (clearanceIdInput) {
        clRow =
          (
            await sql.query<{
              id: string;
              request_id: string;
              order_id: string | null;
              organization_id: string;
              warehouse_id: string | null;
              document_code: string;
              contract_code: string;
              list_subtotal: string;
              discount_percent: string;
              discount_amount: string;
              net_total: string;
              vat_rate: string;
              vat_amount: string;
              gross_total: string;
              immutable_lines: OrderClearanceLine[];
              snapshot: Record<string, unknown>;
            }>(
              `SELECT c.id, c.request_id, COALESCE(c.order_id, s.id) AS order_id,
                      c.organization_id, c.warehouse_id,
                      COALESCE(s.code, c.document_code) AS document_code,
                      COALESCE(c.contract_code, '') AS contract_code,
                      c.list_subtotal::text, c.discount_percent::text, c.discount_amount::text, c.net_total::text,
                      COALESCE(c.vat_rate, 8)::text AS vat_rate,
                      COALESCE(c.vat_amount, 0)::text AS vat_amount,
                      COALESCE(c.gross_total, c.net_total)::text AS gross_total,
                      COALESCE(c.immutable_lines, '[]'::jsonb) AS immutable_lines,
                      v.snapshot
               FROM cohamy_crm.accounting_order_clearances c
               JOIN cohamy_crm.commercial_requests r ON r.id = c.request_id
               JOIN cohamy_crm.commercial_request_versions v ON v.id = r.latest_version_id
               LEFT JOIN cohamy_crm.sales_orders s ON s.request_id = r.id
               WHERE c.id = $1 LIMIT 1`,
              [clearanceIdInput]
            )
          ).rows[0] ?? null;
      }

      let handoverRow: {
        id: string;
        clearance_id: string | null;
        warehouse_id: string;
        organization_id: string | null;
        lines: WarehouseHandoverLine[];
        list_subtotal: string;
        discount_amount: string;
        net_subtotal: string;
        vat_amount: string;
        total_amount: string;
      } | null = null;

      if (handoverInvoiceIdInput || clRow?.id) {
        handoverRow =
          (
            await sql.query<{
              id: string;
              clearance_id: string | null;
              warehouse_id: string;
              organization_id: string | null;
              lines: WarehouseHandoverLine[];
              list_subtotal: string;
              discount_amount: string;
              net_subtotal: string;
              vat_amount: string;
              total_amount: string;
            }>(
              `SELECT id, clearance_id, warehouse_id, organization_id, lines,
                      list_subtotal::text, discount_amount::text, net_subtotal::text, vat_amount::text, total_amount::text
               FROM cohamy_crm.warehouse_handover_invoices
               WHERE ($1::uuid IS NOT NULL AND id = $1)
                  OR ($2::uuid IS NOT NULL AND clearance_id = $2)
               ORDER BY created_at DESC LIMIT 1`,
              [handoverInvoiceIdInput, clRow?.id ?? null]
            )
          ).rows[0] ?? null;
      }

      const orgId =
        String(input.organizationId ?? '').trim() ||
        clRow?.organization_id ||
        handoverRow?.organization_id ||
        '';
      if (!orgId) throw new CrmError('INVALID_FIELDS', 400);

      const orgRow = (
        await sql.query<{id: string; name: string; address: string; email: string}>(
          "SELECT id, name, COALESCE(address, '') AS address, COALESCE(email, '') AS email FROM cohamy_crm.organizations WHERE id = $1 LIMIT 1",
          [orgId]
        )
      ).rows[0];
      if (!orgRow) throw new CrmError('NOT_FOUND', 404);

      const taxProfile = (
        await sql.query<{
          legal_name: string;
          tax_code: string;
          invoice_address: string;
          invoice_email: string;
        }>(
          'SELECT legal_name, tax_code, invoice_address, invoice_email FROM cohamy_crm.customer_tax_profiles WHERE organization_id = $1 LIMIT 1',
          [orgId]
        )
      ).rows[0];

      const buyerName = String(input.buyerName ?? '').trim() || taxProfile?.legal_name || orgRow.name;
      const buyerTaxCode = String(input.buyerTaxCode ?? '').trim() || taxProfile?.tax_code || '';
      const buyerAddress = String(input.buyerAddress ?? '').trim() || taxProfile?.invoice_address || orgRow.address;
      const buyerEmail = String(input.buyerEmail ?? '').trim() || taxProfile?.invoice_email || orgRow.email;

      const defaultVatRate = Number(input.vatRate ?? clRow?.vat_rate ?? 8);
      let vatLines: WarehouseHandoverLine[] = [];

      if (Array.isArray(input.lines) && input.lines.length > 0) {
        vatLines = (input.lines as Array<Record<string, unknown>>).map(l => {
          const qty = Math.max(0, Number(l.quantity ?? 0));
          const listUnit = Math.max(0, Number(l.listUnitPrice ?? l.unitPrice ?? 0));
          const discPct = Math.max(0, Number(l.discountPercent ?? 0));
          const listTotal = Math.round(qty * listUnit);
          const discAmt = Math.round((listTotal * discPct) / 100);
          const netTotal = listTotal - discAmt;
          const netUnit = qty > 0 ? Math.round(netTotal / qty) : listUnit;
          const vr = l.vatRate !== undefined ? Number(l.vatRate) : defaultVatRate;
          const vAmt = Math.round((netTotal * vr) / 100);
          return {
            productId: String(l.productId ?? ''),
            sku: String(l.sku ?? ''),
            name: String(l.name ?? ''),
            weightLabel: String(l.weightLabel ?? ''),
            unitLabel: String(l.unitLabel ?? 'Gói'),
            quantity: qty,
            listUnitPrice: listUnit,
            discountPercent: discPct,
            discountAmount: discAmt,
            unitPrice: netUnit,
            netLineTotal: netTotal,
            vatRate: vr,
            vatAmount: vAmt,
            lineTotal: netTotal + vAmt,
            note: String(l.note ?? ''),
          };
        });
      } else if (handoverRow && Array.isArray(handoverRow.lines) && handoverRow.lines.length > 0) {
        vatLines = handoverRow.lines.map(hl => {
          const qty = Number(hl.quantity || 0);
          const listUnit = Number(hl.listUnitPrice ?? hl.unitPrice ?? 0);
          const discPct = Number(hl.discountPercent ?? 0);
          const listTotal = Math.round(qty * listUnit);
          const discAmt = Number(hl.discountAmount ?? Math.round((listTotal * discPct) / 100));
          const netTotal = Number(hl.netLineTotal ?? listTotal - discAmt);
          const vr = Number(hl.vatRate ?? defaultVatRate);
          const vAmt = Number(hl.vatAmount ?? Math.round((netTotal * vr) / 100));
          return {
            ...hl,
            listUnitPrice: listUnit,
            discountPercent: discPct,
            discountAmount: discAmt,
            netLineTotal: netTotal,
            vatRate: vr,
            vatAmount: vAmt,
            lineTotal: netTotal + vAmt,
          };
        });
      } else if (clRow) {
        const snapLines =
          Array.isArray(clRow.immutable_lines) && clRow.immutable_lines.length > 0
            ? clRow.immutable_lines
            : extractSnapshotTotals(clRow.snapshot).lines;
        vatLines = snapLines.map(sl => {
          const qty = Number(sl.baseQuantity || sl.quantity || 0);
          const listUnit = Number(sl.listUnitPrice || 0);
          const discPct = Number(sl.discountPercent || 0);
          const listTotal = Number(sl.listLineTotal || Math.round(qty * listUnit));
          const discAmt = Number(sl.discountLineAmount || Math.round((listTotal * discPct) / 100));
          const netTotal = Number(sl.netLineTotal || listTotal - discAmt);
          const vr = Number(sl.vatRate ?? defaultVatRate);
          const vAmt = Math.round((netTotal * vr) / 100);
          return {
            productId: String(sl.productId ?? ''),
            sku: sl.sku,
            name: sl.name,
            weightLabel: sl.weightLabel ?? '',
            unitLabel: sl.unitLabel || 'Gói',
            quantity: qty,
            listUnitPrice: listUnit,
            discountPercent: discPct,
            discountAmount: discAmt,
            unitPrice: Number(sl.netUnitPrice || 0),
            netLineTotal: netTotal,
            vatRate: vr,
            vatAmount: vAmt,
            lineTotal: netTotal + vAmt,
            note: '',
          };
        });
      }

      const listSubtotal = vatLines.reduce(
        (s, l) => s + Math.round(Number(l.quantity || 0) * Number(l.listUnitPrice ?? l.unitPrice ?? 0)),
        0
      );
      const discountAmount = vatLines.reduce((s, l) => s + Number(l.discountAmount ?? 0), 0);
      const netAmount = vatLines.reduce((s, l) => s + Number(l.netLineTotal ?? l.lineTotal ?? 0), 0);
      const vatAmount = vatLines.reduce((s, l) => s + Number(l.vatAmount ?? 0), 0);
      const totalAmount = netAmount + vatAmount;

      const existingVat =
        vatInvoiceId || (clRow?.id && invoiceType === 'ORIGINAL')
          ? (
              await sql.query<{
                id: string;
                code: string;
                pdf_document_id: string | null;
                xml_document_id: string | null;
              }>(
                `SELECT id, code, pdf_document_id, xml_document_id
                 FROM cohamy_crm.vat_invoices
                 WHERE ($1::uuid IS NOT NULL AND id = $1)
                    OR ($1::uuid IS NULL AND $2::uuid IS NOT NULL AND clearance_id = $2 AND invoice_type = 'ORIGINAL')
                 LIMIT 1 FOR UPDATE`,
                [vatInvoiceId, clRow?.id ?? null]
              )
            ).rows[0] ?? null
          : null;

      const finalPdfId = pdfDocumentId ?? existingVat?.pdf_document_id ?? null;
      const finalXmlId = xmlDocumentId ?? existingVat?.xml_document_id ?? null;

      // Enforce VAT invoice status rule (Test 7 & Test 8):
      // - Cannot be ISSUED unless invoiceNumber + issuedDate AND at least 1 valid file (PDF or XML) are present.
      // - If invoiceNumber is entered without PDF/XML -> ISSUED_MISSING_FILES ("Thiếu tài liệu hóa đơn").
      let status: VatInvoiceRecord['status'] = 'UNISSUED';
      if (invoiceNumber) {
        if (issuedDate && (finalPdfId || finalXmlId)) {
          status = 'ISSUED';
        } else {
          status = 'ISSUED_MISSING_FILES';
        }
      }

      const sellerInfo = {
        name: 'CÔNG TY CỔ PHẦN SẢN XUẤT & THƯƠNG MẠI COHAMY',
        taxCode: '0109988776',
        address: 'Khu Công Nghiệp Hà Nội & Chi Nhánh TP.HCM',
      };

      const finalId = existingVat?.id ?? randomUUID();
      const finalCode =
        existingVat?.code ?? `VAT-${vietnamBusinessDate(new Date())}-${finalId.slice(0, 6).toUpperCase()}`;

      if (existingVat) {
        await sql.query(
          `UPDATE cohamy_crm.vat_invoices
           SET handover_invoice_id = COALESCE($1, handover_invoice_id),
               warehouse_id = COALESCE($2, warehouse_id),
               invoice_number = $3,
               invoice_symbol = $4,
               issued_date = $5::date,
               invoice_type = $6,
               parent_vat_invoice_id = $7,
               buyer_name = $8,
               buyer_tax_code = $9,
               buyer_address = $10,
               buyer_email = $11,
               lines = $12::jsonb,
               list_subtotal = $13,
               discount_amount = $14,
               net_amount = $15,
               vat_amount = $16,
               total_amount = $17,
               status = $18,
               pdf_document_id = $19,
               xml_document_id = $20,
               adjustment_reason = $21,
               note = $22,
               updated_by = $23,
               updated_by_name = $24,
               updated_at = now()
           WHERE id = $25`,
          [
            handoverRow?.id ?? null,
            clRow?.warehouse_id ?? handoverRow?.warehouse_id ?? null,
            invoiceNumber,
            invoiceSymbol,
            issuedDate,
            invoiceType,
            parentVatInvoiceId,
            buyerName,
            buyerTaxCode,
            buyerAddress,
            buyerEmail,
            JSON.stringify(vatLines),
            String(listSubtotal),
            String(discountAmount),
            String(netAmount),
            String(vatAmount),
            String(totalAmount),
            status,
            finalPdfId,
            finalXmlId,
            adjustmentReason,
            note,
            user.id,
            user.displayName,
            finalId,
          ]
        );
      } else {
        await sql.query(
          `INSERT INTO cohamy_crm.vat_invoices(
             id, code, clearance_id, order_id, request_id, handover_invoice_id,
             organization_id, warehouse_id,
             invoice_number, invoice_symbol, issued_date, invoice_type, parent_vat_invoice_id,
             seller_info, buyer_name, buyer_tax_code, buyer_address, buyer_email,
             lines, list_subtotal, discount_amount, net_amount, vat_amount, total_amount,
             status, pdf_document_id, xml_document_id, adjustment_reason, note,
             created_by, created_by_name, updated_by, updated_by_name
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12,$13,$14::jsonb,$15,$16,$17,$18,
             $19::jsonb,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$30,$31
           )`,
          [
            finalId,
            finalCode,
            clRow?.id ?? null,
            clRow?.order_id ?? null,
            clRow?.request_id ?? null,
            handoverRow?.id ?? null,
            orgId,
            clRow?.warehouse_id ?? handoverRow?.warehouse_id ?? null,
            invoiceNumber,
            invoiceSymbol,
            issuedDate,
            invoiceType,
            parentVatInvoiceId,
            JSON.stringify(sellerInfo),
            buyerName,
            buyerTaxCode,
            buyerAddress,
            buyerEmail,
            JSON.stringify(vatLines),
            String(listSubtotal),
            String(discountAmount),
            String(netAmount),
            String(vatAmount),
            String(totalAmount),
            status,
            finalPdfId,
            finalXmlId,
            adjustmentReason,
            note,
            user.id,
            user.displayName,
          ]
        );
      }

      if (parentVatInvoiceId && (invoiceType === 'ADJUSTMENT' || invoiceType === 'REPLACEMENT')) {
        const parentNextStatus = invoiceType === 'REPLACEMENT' ? 'REPLACED' : 'ADJUSTED';
        await sql.query(
          'UPDATE cohamy_crm.vat_invoices SET status = $1, updated_by = $2, updated_by_name = $3, updated_at = now() WHERE id = $4',
          [parentNextStatus, user.id, user.displayName, parentVatInvoiceId]
        );
      }

      if (clRow?.id) {
        await sql.query(
          'UPDATE cohamy_crm.accounting_order_clearances SET vat_invoice_status = $1, updated_at = now() WHERE id = $2',
          [status, clRow.id]
        );
      }

      await audit(sql, user.id, 'vat.invoice.saved', 'vat-invoice', finalId, {
        code: finalCode,
        invoiceNumber,
        invoiceSymbol,
        issuedDate,
        invoiceType,
        status,
        netAmount,
        vatAmount,
        totalAmount,
        hasPdf: Boolean(finalPdfId),
        hasXml: Boolean(finalXmlId),
      });

      return {
        ok: true,
        id: finalId,
        code: finalCode,
        invoiceNumber,
        invoiceSymbol,
        issuedDate,
        status,
        buyerName,
        buyerTaxCode,
        buyerAddress,
        listSubtotal: String(listSubtotal),
        discountAmount: String(discountAmount),
        netAmount: String(netAmount),
        vatAmount: String(vatAmount),
        totalAmount: String(totalAmount),
        lines: vatLines,
      };
    }

    if (action === 'save-customer-tax-profile') {
      if (!['ACCOUNTANT', 'ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
        throw new CrmError('FORBIDDEN', 403);
      }
      const organizationId = String(input.organizationId ?? '').trim();
      if (!organizationId) throw new CrmError('INVALID_FIELDS', 400);

      const buyerType = String(input.buyerType ?? 'COMPANY') === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'COMPANY';
      const legalName = String(input.legalName ?? '').trim();
      const taxCode = String(input.taxCode ?? '').trim();
      const invoiceAddress = String(input.invoiceAddress ?? '').trim();
      const invoiceEmail = String(input.invoiceEmail ?? '').trim();
      const representativeName = String(input.representativeName ?? '').trim();
      const personalIdNumber = String(input.personalIdNumber ?? '').trim();
      const personalIdConsentBasis = String(input.personalIdConsentBasis ?? '').trim();
      const contractCode = String(input.contractCode ?? '').trim();
      const note = String(input.note ?? '').trim();

      if (personalIdNumber && !personalIdConsentBasis) {
        throw new CrmError('PERSONAL_ID_CONSENT_REQUIRED', 400);
      }

      await sql.query(
        `INSERT INTO cohamy_crm.customer_tax_profiles(
           organization_id, buyer_type, legal_name, tax_code, invoice_address, invoice_email,
           representative_name, personal_id_number, personal_id_consent_basis, contract_code,
           note, updated_by, updated_by_name, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
         ON CONFLICT (organization_id) DO UPDATE SET
           buyer_type = EXCLUDED.buyer_type,
           legal_name = EXCLUDED.legal_name,
           tax_code = EXCLUDED.tax_code,
           invoice_address = EXCLUDED.invoice_address,
           invoice_email = EXCLUDED.invoice_email,
           representative_name = EXCLUDED.representative_name,
           personal_id_number = EXCLUDED.personal_id_number,
           personal_id_consent_basis = EXCLUDED.personal_id_consent_basis,
           contract_code = EXCLUDED.contract_code,
           note = EXCLUDED.note,
           updated_by = EXCLUDED.updated_by,
           updated_by_name = EXCLUDED.updated_by_name,
           updated_at = now()`,
        [
          organizationId,
          buyerType,
          legalName,
          taxCode,
          invoiceAddress,
          invoiceEmail,
          representativeName,
          personalIdNumber,
          personalIdConsentBasis,
          contractCode,
          note,
          user.id,
          user.displayName,
        ]
      );

      await audit(sql, user.id, 'customer.tax_profile.saved', 'partner', organizationId, {
        buyerType,
        legalName,
        taxCode,
        contractCode,
        hasPersonalId: Boolean(personalIdNumber),
      });

      return {ok: true, organizationId, taxCode, legalName, contractCode};
    }

    if (action === 'update-product-price') {
      if (!['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(user.role)) {
        throw new CrmError('FORBIDDEN', 403);
      }
      const productId = String(input.productId ?? input.sku ?? '').trim();
      const newRetailPrice = Math.max(0, Math.round(Number(input.retailPrice ?? 0)));
      const newCostPrice =
        input.costPrice !== undefined ? Math.max(0, Math.round(Number(input.costPrice))) : null;
      const newVatRate =
        input.vatRate !== undefined ? Math.max(0, Math.min(30, Number(input.vatRate))) : null;
      if (!productId || newRetailPrice <= 0) throw new CrmError('INVALID_FIELDS', 400);

      const prod = (
        await sql.query<{id: string; sku: string}>(
          'SELECT id, sku FROM cohamy_crm.products WHERE id::text = $1 OR sku = $1 LIMIT 1',
          [productId]
        )
      ).rows[0];
      if (!prod) throw new CrmError('NOT_FOUND', 404);

      await sql.query(
        `UPDATE cohamy_crm.products
         SET retail_price = $1,
             cost_price = COALESCE($2, cost_price),
             vat_rate = COALESCE($3, vat_rate),
             updated_at = now()
         WHERE id = $4`,
        [String(newRetailPrice), newCostPrice !== null ? String(newCostPrice) : null, newVatRate !== null ? String(newVatRate) : null, prod.id]
      );

      await audit(sql, user.id, 'product.price.updated', 'product', prod.id, {
        sku: prod.sku,
        retailPrice: newRetailPrice,
        costPrice: newCostPrice,
        vatRate: newVatRate,
      });

      return {ok: true, productId: prod.id, sku: prod.sku, retailPrice: String(newRetailPrice)};
    }

    throw new CrmError('INVALID_ACTION', 400);
  });
}
