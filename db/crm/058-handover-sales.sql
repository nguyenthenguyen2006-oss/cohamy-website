-- New, explicitly priced warehouse sales only. Historical handovers are not linked
-- or repriced. One immutable provenance row prevents a retry from creating a second
-- order or receivable; stock remains the document-flow transaction's responsibility.
CREATE TABLE cohamy_crm.warehouse_sale_links (
 handover_id uuid PRIMARY KEY REFERENCES cohamy_crm.warehouse_handover_invoices(id),
 request_id uuid NOT NULL UNIQUE REFERENCES cohamy_crm.commercial_requests(id),
 order_id uuid NOT NULL UNIQUE REFERENCES cohamy_crm.sales_orders(id),
 clearance_id uuid NOT NULL UNIQUE REFERENCES cohamy_crm.accounting_order_clearances(id),
 receivable_id uuid UNIQUE REFERENCES cohamy_crm.receivables(id),
 warehouse_id uuid NOT NULL REFERENCES cohamy_crm.warehouses(id),
 seller_organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 customer_organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 source_checksum text NOT NULL,
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX warehouse_sale_links_warehouse_idx ON cohamy_crm.warehouse_sale_links(warehouse_id,created_at DESC);
CREATE TRIGGER warehouse_sale_links_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.warehouse_sale_links
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

-- Associates a pending or confirmed canonical receipt with its intended sale.
-- It is provenance, never a second payment ledger.
CREATE TABLE cohamy_crm.warehouse_sale_payment_links (
 payment_id uuid PRIMARY KEY REFERENCES cohamy_crm.payment_receipts(id),
 handover_id uuid NOT NULL REFERENCES cohamy_crm.warehouse_sale_links(handover_id),
 receivable_id uuid NOT NULL REFERENCES cohamy_crm.receivables(id),
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 idempotency_key uuid NOT NULL,
 request_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER warehouse_sale_payment_links_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.warehouse_sale_payment_links
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
