-- Customer/supermarket requests are sources for the existing warehouse/accounting flow.
-- No balances, receipts, prices, accounts or historical transactions are backfilled.
ALTER TABLE cohamy_crm.memberships DROP CONSTRAINT memberships_role_check;
ALTER TABLE cohamy_crm.memberships ADD CONSTRAINT memberships_role_check CHECK(role IN
 ('ADMIN','MANAGER','SALES','FACTORY','WAREHOUSE','WAREHOUSE_HCM','WAREHOUSE_HN','ACCOUNTANT','DEALER_OWNER','DEALER_STAFF','CUSTOMER','SUPERMARKET'));

CREATE TABLE cohamy_crm.buyer_branches (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 code text NOT NULL, name text NOT NULL, address text NOT NULL,
 recipient text NOT NULL, phone text NOT NULL, active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,code)
);
CREATE INDEX buyer_branches_org ON cohamy_crm.buyer_branches(organization_id,id);
CREATE TABLE cohamy_crm.buyer_contracts (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 code text NOT NULL, starts_on date NOT NULL, ends_on date NOT NULL,
 lines jsonb NOT NULL, note text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1, created_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_on>=starts_on), UNIQUE(organization_id,code)
);
CREATE INDEX buyer_contracts_org ON cohamy_crm.buyer_contracts(organization_id,starts_on,ends_on);
CREATE TABLE cohamy_crm.buyer_orders (
 id uuid PRIMARY KEY, code text NOT NULL UNIQUE,
 organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 buyer_role text NOT NULL CHECK(buyer_role IN('CUSTOMER','SUPERMARKET')),
 creator_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 warehouse_id uuid NOT NULL REFERENCES cohamy_crm.warehouses(id),
 branch_id uuid REFERENCES cohamy_crm.buyer_branches(id),
 delivery jsonb NOT NULL, lines jsonb NOT NULL, note text NOT NULL DEFAULT '',
 status text NOT NULL CHECK(status IN('WAITING_QUOTE','QUOTED','CONFIRMED','CANCELLED')),
 quote_expires_on date, contract_snapshot jsonb,
 request_id uuid UNIQUE REFERENCES cohamy_crm.commercial_requests(id),
 clearance_id uuid UNIQUE REFERENCES cohamy_crm.accounting_order_clearances(id),
 version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX buyer_orders_org ON cohamy_crm.buyer_orders(organization_id,created_at DESC,id);
CREATE INDEX buyer_orders_warehouse ON cohamy_crm.buyer_orders(warehouse_id,status,created_at DESC);
CREATE TABLE cohamy_crm.buyer_order_events (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES cohamy_crm.buyer_orders(id),
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id), action text NOT NULL,
 snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX buyer_order_events_order ON cohamy_crm.buyer_order_events(order_id,created_at,id);
CREATE TRIGGER buyer_order_events_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.buyer_order_events
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.buyer_actions (
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id), key uuid NOT NULL,
 request_hash text NOT NULL, result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_id,key)
);
CREATE TRIGGER buyer_actions_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.buyer_actions
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.buyer_delivery_receipts (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES cohamy_crm.buyer_orders(id),
 issue_id uuid NOT NULL REFERENCES cohamy_crm.warehouse_handover_invoices(id),
 issue_revision integer NOT NULL, actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 lines jsonb NOT NULL, note text NOT NULL DEFAULT '', shortage boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(issue_id,issue_revision)
);
CREATE TRIGGER buyer_delivery_receipts_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.buyer_delivery_receipts
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE INDEX buyer_delivery_receipts_order ON cohamy_crm.buyer_delivery_receipts(order_id,created_at,id);
CREATE INDEX buyer_confirmed_issues ON cohamy_crm.warehouse_handover_invoices(clearance_id,created_at,id) WHERE workflow_state='CONFIRMED';
CREATE TABLE cohamy_crm.buyer_statement_acknowledgements (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 month text NOT NULL, checksum text NOT NULL, snapshot jsonb NOT NULL,
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id), note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,month,checksum)
);
CREATE TRIGGER buyer_statement_acknowledgements_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.buyer_statement_acknowledgements
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
