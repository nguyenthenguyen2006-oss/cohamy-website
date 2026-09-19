-- No legacy request, quotation or retail price is backfilled into a sale.
CREATE TABLE cohamy_crm.order_policies (
 id uuid PRIMARY KEY,number integer NOT NULL UNIQUE,definition jsonb NOT NULL,
 checksum text NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 reason text NOT NULL,idempotency_key uuid NOT NULL,request_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER order_policies_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.order_policies
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.order_policy_current (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 policy_id uuid NOT NULL REFERENCES cohamy_crm.order_policies(id),version integer NOT NULL DEFAULT 1
);
CREATE TABLE cohamy_crm.commercial_requests (
 id uuid PRIMARY KEY,code text NOT NULL UNIQUE,
 organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 creator_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 creator_membership_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id),
 creator_area text NOT NULL CHECK(creator_area IN('crm','portal')),creator_role text NOT NULL,
 channel text NOT NULL CHECK(channel IN('PORTAL','PHONE','VISIT','OTHER','WEBSITE','QUOTATION','REORDER','EXCEL')),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','PENDING_OWNER','READY','REJECTED','SUBMITTED')),
 source_website_id uuid REFERENCES cohamy_crm.website_orders(id),source_quotation_id uuid REFERENCES cohamy_crm.quotations(id),
 source_order_id uuid,latest_version_id uuid,owner_approved_version_id uuid,
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.commercial_request_versions (
 id uuid PRIMARY KEY,request_id uuid NOT NULL REFERENCES cohamy_crm.commercial_requests(id),number integer NOT NULL,
 snapshot jsonb NOT NULL,checksum text NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 idempotency_key uuid NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(request_id,number),UNIQUE(actor_id,idempotency_key)
);
ALTER TABLE cohamy_crm.commercial_requests
 ADD CONSTRAINT commercial_requests_latest_fk FOREIGN KEY(latest_version_id) REFERENCES cohamy_crm.commercial_request_versions(id),
 ADD CONSTRAINT commercial_requests_owner_fk FOREIGN KEY(owner_approved_version_id) REFERENCES cohamy_crm.commercial_request_versions(id);
CREATE TRIGGER commercial_request_versions_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.commercial_request_versions
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.sales_orders (
 id uuid PRIMARY KEY,code text NOT NULL UNIQUE,organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 request_id uuid NOT NULL UNIQUE REFERENCES cohamy_crm.commercial_requests(id),creator_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 status text NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK(status IN('PENDING_APPROVAL','CONFIRMED','REJECTED','CANCELLED')),
 delivery_status text NOT NULL DEFAULT 'NOT_STARTED' CHECK(delivery_status IN('NOT_STARTED','PARTIAL','DELIVERED','RETURNED')),
 payment_status text NOT NULL DEFAULT 'UNBILLED' CHECK(payment_status IN('UNBILLED','UNPAID','PARTIAL','PAID','REFUNDED')),
 latest_version_id uuid,confirmed_version_id uuid,
 source_website_id uuid UNIQUE REFERENCES cohamy_crm.website_orders(id),source_quotation_id uuid UNIQUE REFERENCES cohamy_crm.quotations(id),
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cohamy_crm.commercial_requests ADD CONSTRAINT commercial_requests_source_order_fk FOREIGN KEY(source_order_id) REFERENCES cohamy_crm.sales_orders(id);
CREATE TABLE cohamy_crm.sales_order_versions (
 id uuid PRIMARY KEY,order_id uuid NOT NULL REFERENCES cohamy_crm.sales_orders(id),number integer NOT NULL,
 request_version_id uuid NOT NULL REFERENCES cohamy_crm.commercial_request_versions(id),
 order_policy_id uuid NOT NULL REFERENCES cohamy_crm.order_policies(id),snapshot jsonb NOT NULL,checksum text NOT NULL,
 approval_required boolean NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(order_id,number)
);
ALTER TABLE cohamy_crm.sales_orders
 ADD CONSTRAINT sales_orders_latest_fk FOREIGN KEY(latest_version_id) REFERENCES cohamy_crm.sales_order_versions(id),
 ADD CONSTRAINT sales_orders_confirmed_fk FOREIGN KEY(confirmed_version_id) REFERENCES cohamy_crm.sales_order_versions(id);
CREATE TRIGGER sales_order_versions_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.sales_order_versions
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.commercial_events (
 id uuid PRIMARY KEY,request_id uuid REFERENCES cohamy_crm.commercial_requests(id),order_id uuid REFERENCES cohamy_crm.sales_orders(id),
 source_version_id uuid NOT NULL,action text NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,
 internal boolean NOT NULL DEFAULT false,idempotency_key uuid NOT NULL,request_hash text NOT NULL,result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key),CHECK(num_nonnulls(request_id,order_id)=1)
);
CREATE UNIQUE INDEX commercial_events_one_approval ON cohamy_crm.commercial_events(order_id,source_version_id) WHERE action IN('APPROVED','REJECTED');
CREATE UNIQUE INDEX commercial_events_one_owner_decision ON cohamy_crm.commercial_events(request_id,source_version_id) WHERE action IN('OWNER_APPROVED','OWNER_REJECTED');
CREATE TRIGGER commercial_events_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.commercial_events
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.order_change_previews (
 id uuid PRIMARY KEY,order_id uuid NOT NULL REFERENCES cohamy_crm.sales_orders(id),actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 expected_version integer NOT NULL,manifest jsonb NOT NULL,reason text NOT NULL,result jsonb,
 expires_at timestamptz NOT NULL DEFAULT(now()+interval '10 minutes'),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX commercial_requests_org ON cohamy_crm.commercial_requests(organization_id,status,updated_at);
CREATE INDEX sales_orders_org ON cohamy_crm.sales_orders(organization_id,status,updated_at);
CREATE TABLE cohamy_crm.request_excel_previews (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES cohamy_crm.users(id),membership_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id),
 membership_version integer NOT NULL,organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 input jsonb NOT NULL,manifest jsonb NOT NULL,checksum text NOT NULL,idempotency_key uuid NOT NULL,request_hash text NOT NULL,
 result jsonb,expires_at timestamptz NOT NULL DEFAULT(now()+interval '10 minutes'),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,idempotency_key)
);
ALTER TABLE cohamy_crm.notifications DROP CONSTRAINT notifications_entity_type_check;
ALTER TABLE cohamy_crm.notifications ADD CONSTRAINT notifications_entity_type_check
 CHECK(entity_type IN('partner','order','product','account','ticket','commercial-request','sales-order'));
