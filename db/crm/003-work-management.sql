ALTER TABLE cohamy_crm.organizations
 ADD COLUMN source text NOT NULL DEFAULT '',
 ADD COLUMN segment text NOT NULL DEFAULT '',
 ADD COLUMN contact_name text NOT NULL DEFAULT '',
 ADD COLUMN stage text NOT NULL DEFAULT 'ACTIVE' CHECK(stage IN ('LEAD','CONTACTED','ACTIVE','INACTIVE'));
ALTER TABLE cohamy_crm.website_orders DROP CONSTRAINT website_orders_status_check;
ALTER TABLE cohamy_crm.website_orders
 ADD CONSTRAINT website_orders_status_check CHECK(status IN ('PENDING_REVIEW','IN_PROGRESS','READY','REJECTED','CANCELLED')),
 ADD COLUMN assigned_to uuid REFERENCES cohamy_crm.memberships(id),
 ADD COLUMN organization_id uuid REFERENCES cohamy_crm.organizations(id),
 ADD COLUMN version integer NOT NULL DEFAULT 1,
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN resolution_note text NOT NULL DEFAULT '';
CREATE TABLE cohamy_crm.activities (
 id uuid PRIMARY KEY, entity_type text NOT NULL CHECK(entity_type IN ('partner','order')),
 entity_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4000), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.tasks (
 id uuid PRIMARY KEY, entity_type text NOT NULL CHECK(entity_type IN ('partner','order')),
 entity_id uuid NOT NULL, title text NOT NULL CHECK(length(title) BETWEEN 2 AND 240),
 assignee_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id),
 created_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
 due_at timestamptz NOT NULL, done_at timestamptz,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_assignee_idx ON cohamy_crm.website_orders(assigned_to,status,created_at);
CREATE INDEX activities_entity_idx ON cohamy_crm.activities(entity_type,entity_id,created_at);
CREATE INDEX tasks_assignee_idx ON cohamy_crm.tasks(assignee_id,done_at,due_at);
CREATE TRIGGER activities_append_only BEFORE UPDATE OR DELETE ON cohamy_crm.activities
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
