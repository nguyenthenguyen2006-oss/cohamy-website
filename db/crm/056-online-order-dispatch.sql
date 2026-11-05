-- Route immutable website checkout receipts to an existing warehouse.
-- This records a handoff only: no sales conversion, stock, reservation or debt.
ALTER TABLE cohamy_crm.website_orders
 ADD COLUMN assigned_warehouse_id uuid REFERENCES cohamy_crm.warehouses(id),
 ADD COLUMN dispatch_status text NOT NULL DEFAULT 'UNASSIGNED' CHECK(dispatch_status IN('UNASSIGNED','ASSIGNED','ACCEPTED')),
 ADD COLUMN dispatch_note text NOT NULL DEFAULT '' CHECK(length(dispatch_note)<=1000),
 ADD COLUMN dispatched_by uuid REFERENCES cohamy_crm.users(id),
 ADD COLUMN dispatched_at timestamptz,
 ADD COLUMN accepted_by uuid REFERENCES cohamy_crm.users(id),
 ADD COLUMN accepted_at timestamptz,
 ADD CONSTRAINT website_order_dispatch_consistent CHECK(
  (dispatch_status='UNASSIGNED' AND assigned_warehouse_id IS NULL AND dispatched_by IS NULL AND dispatched_at IS NULL AND accepted_by IS NULL AND accepted_at IS NULL)
  OR (dispatch_status='ASSIGNED' AND assigned_warehouse_id IS NOT NULL AND dispatched_by IS NOT NULL AND dispatched_at IS NOT NULL AND accepted_by IS NULL AND accepted_at IS NULL)
  OR (dispatch_status='ACCEPTED' AND assigned_warehouse_id IS NOT NULL AND dispatched_by IS NOT NULL AND dispatched_at IS NOT NULL AND accepted_by IS NOT NULL AND accepted_at IS NOT NULL)
 );
CREATE INDEX website_orders_dispatch_queue ON cohamy_crm.website_orders(assigned_warehouse_id,dispatch_status,created_at DESC,id);
CREATE TABLE cohamy_crm.website_order_dispatch_actions (
 id uuid PRIMARY KEY,
 website_order_id uuid NOT NULL REFERENCES cohamy_crm.website_orders(id),
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 actor_name text NOT NULL,
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 action text NOT NULL CHECK(action IN('ASSIGN','ACCEPT')),
 from_warehouse_id uuid REFERENCES cohamy_crm.warehouses(id),
 to_warehouse_id uuid NOT NULL REFERENCES cohamy_crm.warehouses(id),
 from_warehouse_name text NOT NULL DEFAULT '',
 to_warehouse_name text NOT NULL,
 reason text NOT NULL CHECK(length(reason)<=1000),
 version integer NOT NULL CHECK(version>1),
 result jsonb NOT NULL CHECK(jsonb_typeof(result)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(website_order_id,version)
);
CREATE INDEX website_order_dispatch_history ON cohamy_crm.website_order_dispatch_actions(website_order_id,created_at DESC,id);
CREATE TRIGGER immutable_website_order_dispatch_actions BEFORE UPDATE OR DELETE ON cohamy_crm.website_order_dispatch_actions
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
