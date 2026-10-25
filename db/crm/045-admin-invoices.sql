-- Admin corrections retain every original invoice and ledger entry.
CREATE TABLE cohamy_crm.invoice_admin_heads (
 kind text NOT NULL CHECK(kind IN('FLOW','SALES','HISTORICAL','VAT','TRANSFER')),
 entity_id uuid NOT NULL, organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 version integer NOT NULL DEFAULT 1, content jsonb, total_amount numeric(30,0) NOT NULL DEFAULT 0,
 paid_amount numeric(30,0) NOT NULL DEFAULT 0,cancelled_at timestamptz,
 updated_by uuid NOT NULL REFERENCES cohamy_crm.users(id),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(kind,entity_id)
);
CREATE TABLE cohamy_crm.invoice_admin_revisions (
 id uuid PRIMARY KEY,kind text NOT NULL,entity_id uuid NOT NULL,version integer NOT NULL,
 action text NOT NULL CHECK(action IN('EDIT','CANCEL')),before_snapshot jsonb NOT NULL,after_snapshot jsonb NOT NULL,
 impact jsonb NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,
 idempotency_key uuid NOT NULL,request_hash text NOT NULL,result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(kind,entity_id,version),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER invoice_admin_revisions_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.invoice_admin_revisions
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.invoice_allocation_reversals (
 id uuid PRIMARY KEY,allocation_id uuid NOT NULL UNIQUE REFERENCES cohamy_crm.payment_allocations(id),
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER invoice_allocation_reversals_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.invoice_allocation_reversals
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
ALTER TABLE cohamy_crm.vat_invoices DROP CONSTRAINT vat_invoices_status_check;
ALTER TABLE cohamy_crm.vat_invoices ADD CONSTRAINT vat_invoices_status_check
 CHECK(status IN('UNISSUED','ISSUED_MISSING_FILES','ISSUED','ADJUSTMENT_REQUESTED','ADJUSTED','REPLACED','CANCELLED'));
ALTER TABLE cohamy_crm.inventory_transfers DROP CONSTRAINT inventory_transfers_status_check;
ALTER TABLE cohamy_crm.inventory_transfers ADD CONSTRAINT inventory_transfers_status_check
 CHECK(status IN('IN_TRANSIT','PARTIAL','RECEIVED','SHORT','CANCELLED'));
