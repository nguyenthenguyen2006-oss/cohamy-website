-- Finance starts disabled and empty. No order is treated as paid or owed by migration.
CREATE TABLE cohamy_crm.credit_accounts (
 organization_id uuid PRIMARY KEY REFERENCES cohamy_crm.organizations(id),limit_amount numeric(30,0) NOT NULL DEFAULT 0,
 used_amount numeric(30,0) NOT NULL DEFAULT 0,terms_days integer NOT NULL DEFAULT 0,enabled boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now(),CHECK(limit_amount>=0 AND used_amount>=0 AND terms_days>=0)
);
CREATE TABLE cohamy_crm.credit_events (
 id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),order_id uuid REFERENCES cohamy_crm.sales_orders(id),
 action text NOT NULL CHECK(action IN('CONFIGURED','HELD','RELEASED','RECEIVABLE_POSTED','PAYMENT_APPLIED','ADJUSTED')),
 amount numeric(30,0) NOT NULL,account_snapshot jsonb NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 reason text NOT NULL,idempotency_key uuid NOT NULL,request_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER credit_events_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.credit_events FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.credit_holds (
 id uuid PRIMARY KEY,order_id uuid NOT NULL UNIQUE REFERENCES cohamy_crm.sales_orders(id),organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 amount numeric(30,0) NOT NULL CHECK(amount>0),status text NOT NULL CHECK(status IN('ACTIVE','POSTED','RELEASED')),
 account_version integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.receivables (
 id uuid PRIMARY KEY,code text NOT NULL UNIQUE,organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 order_id uuid REFERENCES cohamy_crm.sales_orders(id),source_type text NOT NULL,source_id text NOT NULL,
 original_amount numeric(30,0) NOT NULL CHECK(original_amount>0),remaining_amount numeric(30,0) NOT NULL CHECK(remaining_amount>=0),
 due_on date NOT NULL,terms_snapshot jsonb NOT NULL,status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','PARTIAL','PAID','DISPUTED','VOID')),
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX receivables_source_once ON cohamy_crm.receivables(source_type,source_id);
CREATE TABLE cohamy_crm.receivable_events (
 id uuid PRIMARY KEY,receivable_id uuid NOT NULL REFERENCES cohamy_crm.receivables(id),action text NOT NULL,
 amount numeric(30,0) NOT NULL,payload jsonb NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,
 idempotency_key uuid NOT NULL,request_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER receivable_events_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.receivable_events FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

CREATE TABLE cohamy_crm.payment_receipts (
 id uuid PRIMARY KEY,code text NOT NULL UNIQUE,organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 amount numeric(30,0) NOT NULL CHECK(amount>0),allocated_amount numeric(30,0) NOT NULL DEFAULT 0 CHECK(allocated_amount>=0),
 kind text NOT NULL CHECK(kind IN('PAYMENT','DEPOSIT')),status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','CONFIRMED','REJECTED','REVERSED')),
 paid_at timestamptz NOT NULL,reference text NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),CHECK(allocated_amount<=amount)
);
CREATE TABLE cohamy_crm.payment_allocations (
 id uuid PRIMARY KEY,payment_id uuid NOT NULL REFERENCES cohamy_crm.payment_receipts(id),receivable_id uuid NOT NULL REFERENCES cohamy_crm.receivables(id),
 amount numeric(30,0) NOT NULL CHECK(amount>0),actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,
 idempotency_key uuid NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER payment_allocations_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.payment_allocations FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.bank_transfer_proofs (
 id uuid PRIMARY KEY,payment_id uuid NOT NULL REFERENCES cohamy_crm.payment_receipts(id),document_version_id uuid NOT NULL REFERENCES cohamy_crm.document_versions(id),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','CONFIRMED','REJECTED')),reviewer_id uuid REFERENCES cohamy_crm.users(id),
 reason text NOT NULL DEFAULT '',version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.bank_transactions (
 id uuid PRIMARY KEY,bank_code text NOT NULL,external_id text NOT NULL,occurred_at timestamptz NOT NULL,amount numeric(30,0) NOT NULL CHECK(amount>0),
 reference text NOT NULL,counterparty text NOT NULL,raw jsonb NOT NULL,checksum text NOT NULL,imported_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
 matched_payment_id uuid REFERENCES cohamy_crm.payment_receipts(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(bank_code,external_id),UNIQUE(bank_code,checksum)
);
CREATE TRIGGER bank_transactions_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.bank_transactions FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.bank_transaction_matches (
 id uuid PRIMARY KEY,transaction_id uuid NOT NULL UNIQUE REFERENCES cohamy_crm.bank_transactions(id),payment_id uuid NOT NULL REFERENCES cohamy_crm.payment_receipts(id),
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,idempotency_key uuid NOT NULL,request_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER bank_transaction_matches_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.bank_transaction_matches FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

CREATE TABLE cohamy_crm.payment_reminders (
 id uuid PRIMARY KEY,receivable_id uuid NOT NULL REFERENCES cohamy_crm.receivables(id),scheduled_for timestamptz NOT NULL,
 channel text NOT NULL CHECK(channel IN('IN_APP','EMAIL','SMS')),recipient text NOT NULL,template text NOT NULL,
 status text NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN('SCHEDULED','SENT','SKIPPED','FAILED')),provider_key text,
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(receivable_id,scheduled_for,channel,recipient)
);
CREATE TABLE cohamy_crm.cash_requests (
 id uuid PRIMARY KEY,code text NOT NULL UNIQUE,organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 kind text NOT NULL CHECK(kind IN('COLLECT','PAY','REFUND')),amount numeric(30,0) NOT NULL CHECK(amount>0),source_type text NOT NULL,source_id text NOT NULL,
 status text NOT NULL DEFAULT 'REQUESTED' CHECK(status IN('REQUESTED','APPROVED','REJECTED','EXECUTED','REVERSED')),
 requester_id uuid NOT NULL REFERENCES cohamy_crm.users(id),approver_id uuid REFERENCES cohamy_crm.users(id),executor_id uuid REFERENCES cohamy_crm.users(id),
 reason text NOT NULL,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.cash_request_events (
 id uuid PRIMARY KEY,request_id uuid NOT NULL REFERENCES cohamy_crm.cash_requests(id),action text NOT NULL,payload jsonb NOT NULL,
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,idempotency_key uuid NOT NULL,request_hash text NOT NULL,
 result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER cash_request_events_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.cash_request_events FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

CREATE TABLE cohamy_crm.finance_actions (
 id uuid PRIMARY KEY,action text NOT NULL,resource_id text NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 idempotency_key uuid NOT NULL,request_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER finance_actions_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.finance_actions FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE INDEX receivables_aging ON cohamy_crm.receivables(organization_id,status,due_on);
CREATE INDEX payments_org ON cohamy_crm.payment_receipts(organization_id,status,paid_at);
ALTER TABLE cohamy_crm.notifications DROP CONSTRAINT notifications_entity_type_check;
ALTER TABLE cohamy_crm.notifications ADD CONSTRAINT notifications_entity_type_check
 CHECK(entity_type IN('partner','order','product','account','ticket','commercial-request','sales-order','delivery','return-request','receivable','payment','cash-request'));
