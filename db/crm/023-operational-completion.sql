-- Security, reporting, and correction records are empty by default. This
-- migration does not enable live providers or change any business balance.

ALTER TABLE cohamy_crm.organizations ADD COLUMN region text NOT NULL DEFAULT '';

CREATE TABLE cohamy_crm.mfa_factors (
  id uuid PRIMARY KEY,user_id uuid NOT NULL UNIQUE REFERENCES cohamy_crm.users(id),
  kind text NOT NULL DEFAULT 'TOTP' CHECK(kind='TOTP'),status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','ACTIVE','DISABLED')),
  secret_ciphertext text NOT NULL,confirmed_at timestamptz,version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.mfa_recovery_codes (
  id uuid PRIMARY KEY,factor_id uuid NOT NULL REFERENCES cohamy_crm.mfa_factors(id),code_hash text NOT NULL,
  used_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(factor_id,code_hash)
);
CREATE TABLE cohamy_crm.password_reset_tokens (
  id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES cohamy_crm.users(id),token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,used_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_tokens_user ON cohamy_crm.password_reset_tokens(user_id,created_at DESC);

CREATE TABLE cohamy_crm.notification_outbox (
  id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES cohamy_crm.users(id),event_key text NOT NULL,
  channel text NOT NULL CHECK(channel IN('EMAIL')),recipient text NOT NULL,subject text NOT NULL,body text NOT NULL,
  available_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','SENDING','SENT','FAILED','SKIPPED')),
  attempts integer NOT NULL DEFAULT 0,last_error text NOT NULL DEFAULT '',provider_key text,
  created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,event_key,channel)
);
CREATE INDEX notification_outbox_due ON cohamy_crm.notification_outbox(status,available_at);

CREATE TABLE cohamy_crm.bank_match_reversals (
  id uuid PRIMARY KEY,match_id uuid NOT NULL UNIQUE REFERENCES cohamy_crm.bank_transaction_matches(id),
  actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,idempotency_key uuid NOT NULL,
  request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER bank_match_reversals_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.bank_match_reversals
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

CREATE TABLE cohamy_crm.supplier_rfq_dispatches (
  id uuid PRIMARY KEY,rfq_id uuid NOT NULL REFERENCES cohamy_crm.supplier_rfqs(id),supplier_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
  channel text NOT NULL CHECK(channel IN('EMAIL','INTERNAL')),recipient text NOT NULL,content_snapshot jsonb NOT NULL,
  status text NOT NULL CHECK(status IN('RECORDED','SENT','FAILED')),provider_key text,
  actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,idempotency_key uuid NOT NULL,request_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER supplier_rfq_dispatches_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.supplier_rfq_dispatches
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

CREATE TABLE cohamy_crm.purchase_order_amendments (
  id uuid PRIMARY KEY,order_id uuid NOT NULL REFERENCES cohamy_crm.purchase_orders(id),number integer NOT NULL,
  before_snapshot jsonb NOT NULL,after_snapshot jsonb NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
  reason text NOT NULL,idempotency_key uuid NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id,number),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER purchase_order_amendments_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.purchase_order_amendments
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

CREATE TABLE cohamy_crm.report_subscriptions (
  id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES cohamy_crm.users(id),name text NOT NULL,
  report_key text NOT NULL CHECK(report_key IN('EXECUTIVE','SALES','FULFILLMENT','INVENTORY','FINANCE','QUALITY')),
  filters jsonb NOT NULL DEFAULT '{}',frequency text NOT NULL CHECK(frequency IN('DAILY','WEEKLY','MONTHLY')),
  next_run_at timestamptz NOT NULL,channel text NOT NULL CHECK(channel IN('IN_APP','EMAIL')),recipient text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.report_runs (
  id uuid PRIMARY KEY,subscription_id uuid NOT NULL REFERENCES cohamy_crm.report_subscriptions(id),scheduled_for timestamptz NOT NULL,
  actor_membership_id uuid REFERENCES cohamy_crm.memberships(id),snapshot jsonb NOT NULL,status text NOT NULL CHECK(status IN('SENT','SKIPPED','FAILED')),
  reason text NOT NULL DEFAULT '',provider_key text,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(subscription_id,scheduled_for)
);
CREATE TRIGGER report_runs_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.report_runs
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

ALTER TABLE cohamy_crm.workspace_drafts DROP CONSTRAINT workspace_drafts_entity_type_check;
ALTER TABLE cohamy_crm.workspace_drafts ADD CONSTRAINT workspace_drafts_entity_type_check
 CHECK(entity_type IN('partner','order','new-partner','commercial-request','consignment-report'));

ALTER TABLE cohamy_crm.notifications DROP CONSTRAINT notifications_entity_type_check;
ALTER TABLE cohamy_crm.notifications ADD CONSTRAINT notifications_entity_type_check
 CHECK(entity_type IN('partner','order','product','account','ticket','commercial-request','sales-order','delivery','return-request','receivable','payment','cash-request','report'));
