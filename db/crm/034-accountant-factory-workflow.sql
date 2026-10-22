-- Migration 034: Accountant workflow, Factory-to-Warehouse invoices & reconciliation, and Staff-to-Accountant order payment clearance

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
    'factory-invoice',
    'warehouse-reconciliation',
    'order-clearance'
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

CREATE INDEX IF NOT EXISTS factory_invoices_warehouse_idx
  ON cohamy_crm.factory_invoices(warehouse_id, stage, created_at DESC);

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
    'NEW_ORDER',
    'STAFF_SUBMITTED',
    'ACCOUNTANT_CLEARED',
    'ACCOUNTANT_REJECTED',
    'PICKED_UP_DELIVERED'
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

CREATE INDEX IF NOT EXISTS accounting_order_clearances_status_idx
  ON cohamy_crm.accounting_order_clearances(status, updated_at DESC);
