CREATE SCHEMA IF NOT EXISTS cohamy_crm;
CREATE TABLE cohamy_crm.organizations (
  id uuid PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('COHAMY','DEALER','CUSTOMER','SUPPLIER')),
  phone text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.users (
  id uuid PRIMARY KEY, email text NOT NULL UNIQUE CHECK (email = lower(email)), display_name text NOT NULL,
  password_hash text NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.memberships (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
  organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
  role text NOT NULL CHECK (role IN ('ADMIN','MANAGER','SALES','WAREHOUSE','ACCOUNTANT','DEALER_OWNER','DEALER_STAFF')),
  active boolean NOT NULL DEFAULT true, UNIQUE(user_id,organization_id,role)
);
CREATE TABLE cohamy_crm.sessions (
  token_hash text PRIMARY KEY, membership_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id),
  expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.login_attempts (
  key_hash text PRIMARY KEY, attempts integer NOT NULL, window_start timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.partner_assignments (
  membership_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id), organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
  PRIMARY KEY(membership_id,organization_id)
);
CREATE TABLE cohamy_crm.warehouses (
  id uuid PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL,
  organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id), active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.warehouse_assignments (
  membership_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id), warehouse_id uuid NOT NULL REFERENCES cohamy_crm.warehouses(id),
  PRIMARY KEY(membership_id,warehouse_id)
);
CREATE TABLE cohamy_crm.products (
  id uuid PRIMARY KEY, website_id text NOT NULL UNIQUE, sku text NOT NULL UNIQUE,
  name text NOT NULL, category text NOT NULL, weight_label text NOT NULL,
  retail_price numeric(18,0) NOT NULL CHECK (retail_price >= 0),
  translations jsonb NOT NULL, mapping_status text NOT NULL DEFAULT 'CATALOG_ONLY' CHECK (mapping_status = 'CATALOG_ONLY'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.audit_events (
  id uuid PRIMARY KEY, actor_id uuid REFERENCES cohamy_crm.users(id), action text NOT NULL,
  entity_id text NOT NULL, payload jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION cohamy_crm.deny_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'AUDIT_APPEND_ONLY'; END; $$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON cohamy_crm.audit_events
FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE INDEX memberships_user_idx ON cohamy_crm.memberships(user_id);
CREATE INDEX sessions_expiry_idx ON cohamy_crm.sessions(expires_at);
CREATE INDEX warehouses_org_idx ON cohamy_crm.warehouses(organization_id);
