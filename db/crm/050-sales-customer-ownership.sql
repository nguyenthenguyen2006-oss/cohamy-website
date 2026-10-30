-- Primary ownership is distinct from the existing many-to-many access grants.
-- No existing customer or order is reassigned or backfilled.
CREATE TABLE cohamy_crm.sales_referral_codes (
 id uuid PRIMARY KEY,sales_membership_id uuid NOT NULL UNIQUE REFERENCES cohamy_crm.memberships(id),
 code text NOT NULL UNIQUE CHECK(code ~ '^SALE-[A-F0-9]{12}$'),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','DISABLED')),
 expires_at timestamptz,version integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL REFERENCES cohamy_crm.users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.customer_sales_ownership (
 id uuid PRIMARY KEY,customer_organization_id uuid NOT NULL UNIQUE REFERENCES cohamy_crm.organizations(id),
 sales_membership_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id),
 customer_membership_id uuid REFERENCES cohamy_crm.memberships(id),
 referral_code_id uuid REFERENCES cohamy_crm.sales_referral_codes(id),
 source text NOT NULL CHECK(source IN('SALES_CREATED','REFERRAL','ADMIN_ASSIGNED')),
 status text NOT NULL CHECK(status IN('PENDING_ACTIVATION','ACTIVE','SUSPENDED')),
 managed_access boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,
 assigned_at timestamptz NOT NULL DEFAULT now(),assigned_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
 serving_warehouse_id uuid REFERENCES cohamy_crm.warehouses(id),province text NOT NULL DEFAULT '',
 customer_type text NOT NULL DEFAULT 'CUSTOMER' CHECK(customer_type IN('CUSTOMER','SUPERMARKET')),
 note text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_sales_owner_status ON cohamy_crm.customer_sales_ownership(sales_membership_id,status,created_at DESC);
CREATE INDEX customer_sales_referral ON cohamy_crm.customer_sales_ownership(referral_code_id,created_at DESC);
CREATE INDEX customer_sales_serving_warehouse ON cohamy_crm.customer_sales_ownership(serving_warehouse_id,status,created_at DESC);
CREATE TABLE cohamy_crm.customer_sales_assignment_history (
 id uuid PRIMARY KEY,customer_organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 old_sales_membership_id uuid REFERENCES cohamy_crm.memberships(id),
 new_sales_membership_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id),
 event text NOT NULL CHECK(event IN('CREATED','ACTIVATED','ASSIGNED','REASSIGNED')),
 version integer NOT NULL,reason text NOT NULL,changed_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
 changed_at timestamptz NOT NULL DEFAULT now(),UNIQUE(customer_organization_id,version,event)
);
CREATE TRIGGER customer_sales_history_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.customer_sales_assignment_history
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.sales_customer_actions (
 actor_key text NOT NULL,key uuid NOT NULL,request_hash text NOT NULL,result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_key,key)
);
CREATE TRIGGER sales_customer_actions_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.sales_customer_actions
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.sales_registration_limits (
 key_hash text PRIMARY KEY,attempts integer NOT NULL,window_start timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.sales_customer_review_requests (
 id uuid PRIMARY KEY,actor_id uuid REFERENCES cohamy_crm.users(id),
 actor_key text NOT NULL,request_key uuid NOT NULL,
 customer_organization_id uuid REFERENCES cohamy_crm.organizations(id),
 email_hash text NOT NULL,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_key,request_key)
);
CREATE TRIGGER sales_customer_review_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.sales_customer_review_requests
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

CREATE FUNCTION cohamy_crm.validate_customer_sales_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM cohamy_crm.memberships m JOIN cohamy_crm.organizations o ON o.id=m.organization_id WHERE m.id=NEW.sales_membership_id AND m.role='SALES' AND o.kind='COHAMY')
 OR NOT EXISTS(SELECT 1 FROM cohamy_crm.organizations o WHERE o.id=NEW.customer_organization_id AND o.kind='CUSTOMER') THEN RAISE EXCEPTION 'INVALID_CUSTOMER_SALES_OWNER'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_customer_sales_owner BEFORE INSERT OR UPDATE ON cohamy_crm.customer_sales_ownership
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.validate_customer_sales_owner();
