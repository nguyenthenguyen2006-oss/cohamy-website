-- Migration 035: Add orderer metadata columns to accounting_order_clearances and create warehouse_handover_invoices table

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

CREATE INDEX IF NOT EXISTS warehouse_handover_invoices_wh_idx
  ON cohamy_crm.warehouse_handover_invoices(warehouse_id, created_at DESC);
