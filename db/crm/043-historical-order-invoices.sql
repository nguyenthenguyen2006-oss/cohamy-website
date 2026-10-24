-- Historical invoices are an archive, independent of live stock and money ledgers.
CREATE TABLE cohamy_crm.historical_order_invoices (
  id uuid PRIMARY KEY,
  owner_organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
  warehouse_id uuid NOT NULL REFERENCES cohamy_crm.warehouses(id),
  seller_tax_id text NOT NULL,
  series text NOT NULL,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
  snapshot_checksum text NOT NULL CHECK (snapshot_checksum ~ '^[a-f0-9]{64}$'),
  source_filename text NOT NULL CHECK (length(source_filename) BETWEEN 1 AND 180),
  source_mime text NOT NULL CHECK (source_mime='image/png'),
  source_size integer NOT NULL CHECK (source_size BETWEEN 1 AND 20971520),
  source_checksum text NOT NULL CHECK (source_checksum ~ '^[a-f0-9]{64}$'),
  source_content bytea NOT NULL CHECK (octet_length(source_content)=source_size),
  batch_checksum text NOT NULL CHECK (batch_checksum ~ '^[a-f0-9]{64}$'),
  imported_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_organization_id,seller_tax_id,series,invoice_number)
);
CREATE INDEX historical_invoices_warehouse_date_idx ON cohamy_crm.historical_order_invoices(warehouse_id,invoice_date DESC,id);
CREATE TRIGGER historical_invoices_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.historical_order_invoices
FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
