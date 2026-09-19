-- Sample stock is posted only when an authorized warehouse user confirms the
-- physical issue. Requests and feedback never invent stock or sales orders.

CREATE TABLE cohamy_crm.sample_issues (
 id uuid PRIMARY KEY,code text NOT NULL UNIQUE,
 organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 warehouse_id uuid NOT NULL REFERENCES cohamy_crm.warehouses(id),
 recipient_name text NOT NULL,recipient_phone text NOT NULL DEFAULT '',purpose text NOT NULL,
 status text NOT NULL DEFAULT 'REQUESTED' CHECK(status IN('REQUESTED','SENT','RECEIVED','FEEDBACK','CONVERTED','CLOSED')),
 inventory_document_id uuid UNIQUE REFERENCES cohamy_crm.inventory_documents(id),
 sales_order_id uuid REFERENCES cohamy_crm.sales_orders(id),
 requested_by uuid NOT NULL REFERENCES cohamy_crm.users(id),received_at timestamptz,
 feedback_text text NOT NULL DEFAULT '',feedback_outcome text CHECK(feedback_outcome IS NULL OR feedback_outcome IN('INTERESTED','NOT_INTERESTED','FOLLOW_UP')),
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sample_issues_organization_status ON cohamy_crm.sample_issues(organization_id,status,updated_at DESC);
CREATE INDEX sample_issues_warehouse_status ON cohamy_crm.sample_issues(warehouse_id,status,updated_at DESC);

CREATE TABLE cohamy_crm.sample_issue_lines (
 id uuid PRIMARY KEY,issue_id uuid NOT NULL REFERENCES cohamy_crm.sample_issues(id),
 product_id uuid NOT NULL REFERENCES cohamy_crm.products(id),quantity numeric(30,6) NOT NULL CHECK(quantity>0),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(issue_id,product_id)
);

CREATE TABLE cohamy_crm.sample_allocations (
 id uuid PRIMARY KEY,line_id uuid NOT NULL REFERENCES cohamy_crm.sample_issue_lines(id),
 warehouse_id uuid NOT NULL REFERENCES cohamy_crm.warehouses(id),location_id uuid NOT NULL REFERENCES cohamy_crm.warehouse_locations(id),
 product_id uuid NOT NULL REFERENCES cohamy_crm.products(id),lot_id uuid NOT NULL REFERENCES cohamy_crm.inventory_lots(id),
 quantity numeric(30,6) NOT NULL CHECK(quantity>0),movement_id uuid NOT NULL UNIQUE REFERENCES cohamy_crm.inventory_movements(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER sample_allocations_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.sample_allocations
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

CREATE TABLE cohamy_crm.sample_events (
 id uuid PRIMARY KEY,issue_id uuid NOT NULL REFERENCES cohamy_crm.sample_issues(id),action text NOT NULL,
 payload jsonb NOT NULL DEFAULT '{}',actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,
 idempotency_key uuid NOT NULL,request_hash text NOT NULL,result jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE INDEX sample_events_issue_time ON cohamy_crm.sample_events(issue_id,created_at,id);
CREATE TRIGGER sample_events_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.sample_events
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
