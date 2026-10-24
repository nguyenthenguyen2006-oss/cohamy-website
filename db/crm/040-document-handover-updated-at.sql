ALTER TABLE cohamy_crm.warehouse_handover_invoices ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
