-- Migration 036: Comprehensive ERP Accounting, Factory-to-Warehouse, Warehouse-to-Customer Issue Vouchers with Financials, Multi-Payment Reconciliation, VAT Invoices, Customer Legal/Tax Profiles, and FACTORY Role

-- 1. Add FACTORY role to memberships_role_check
ALTER TABLE cohamy_crm.memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE cohamy_crm.memberships ADD CONSTRAINT memberships_role_check
  CHECK (role IN (
    'ADMIN',
    'MANAGER',
    'SALES',
    'FACTORY',
    'WAREHOUSE',
    'WAREHOUSE_HCM',
    'WAREHOUSE_HN',
    'ACCOUNTANT',
    'DEALER_OWNER',
    'DEALER_STAFF'
  ));

-- 2. Expand notifications and private_documents entity_type constraints safely
ALTER TABLE cohamy_crm.notifications DROP CONSTRAINT IF EXISTS notifications_entity_type_check;
ALTER TABLE cohamy_crm.notifications ADD CONSTRAINT notifications_entity_type_check
  CHECK (entity_type IN (
    'partner',
    'order',
    'product',
    'account',
    'ticket',
    'commercial-request',
    'sales-order',
    'delivery',
    'return-request',
    'receivable',
    'payment',
    'cash-request',
    'report',
    'deal',
    'request',
    'factory-invoice',
    'warehouse-reconciliation',
    'order-clearance',
    'vat-invoice',
    'warehouse-handover'
  ));

ALTER TABLE cohamy_crm.private_documents DROP CONSTRAINT IF EXISTS private_documents_entity_type_check;
ALTER TABLE cohamy_crm.private_documents ADD CONSTRAINT private_documents_entity_type_check
  CHECK (entity_type IN (
    'partner',
    'order',
    'ticket',
    'library',
    'visit',
    'payment',
    'deal',
    'factory-invoice',
    'warehouse-reconciliation',
    'warehouse-handover',
    'vat-invoice',
    'order-clearance'
  ));

ALTER TABLE cohamy_crm.private_documents
  ADD COLUMN IF NOT EXISTS doc_category text NOT NULL DEFAULT 'GENERAL';

-- 3. Add configurable VAT rate and reference cost price on products
ALTER TABLE cohamy_crm.products
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) NOT NULL DEFAULT 8.00,
  ADD COLUMN IF NOT EXISTS cost_price numeric(30,0) NOT NULL DEFAULT 0;

-- 4. Enrich factory_invoices for Factory -> Warehouse workflow & reconciliation
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

CREATE UNIQUE INDEX IF NOT EXISTS factory_invoices_idempotency_idx
  ON cohamy_crm.factory_invoices(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 5. Enrich accounting_order_clearances for Warehouse -> Customer, Multi-Payment & VAT tracking
ALTER TABLE cohamy_crm.accounting_order_clearances
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

-- 6. Enrich warehouse_handover_invoices (Phiếu xuất kho có đầy đủ giá trị tiền, chiết khấu, VAT, giá vốn, chống xuất trùng)
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

CREATE UNIQUE INDEX IF NOT EXISTS warehouse_handover_invoices_idempotency_idx
  ON cohamy_crm.warehouse_handover_invoices(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 7. Order Payment Transactions (Đối chiếu tiền hàng & hỗ trợ thanh toán nhiều lần cho 1 đơn)
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

CREATE INDEX IF NOT EXISTS order_payment_transactions_clearance_idx
  ON cohamy_crm.order_payment_transactions(clearance_id, payment_date DESC);

-- 8. VAT Invoices (Quản lý Hóa đơn VAT độc lập với trạng thái thanh toán)
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
    'UNISSUED',
    'ISSUED_MISSING_FILES',
    'ISSUED',
    'ADJUSTMENT_REQUESTED',
    'ADJUSTED',
    'REPLACED'
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

CREATE INDEX IF NOT EXISTS vat_invoices_clearance_idx
  ON cohamy_crm.vat_invoices(clearance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS vat_invoices_status_idx
  ON cohamy_crm.vat_invoices(status, issued_date DESC);

-- 9. Customer Legal & Tax Profiles (Lưu trữ thông tin xuất hóa đơn & hồ sơ khách hàng)
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
