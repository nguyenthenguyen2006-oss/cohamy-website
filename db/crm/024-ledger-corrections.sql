-- Corrections stay append-only. Nothing in this migration enables a provider
-- or creates money, stock, supplier, or dealer data.

-- A bank transaction can be matched again only after the preceding immutable
-- match has an immutable reversal. The service serializes on bank_transactions.
ALTER TABLE cohamy_crm.bank_transaction_matches
  DROP CONSTRAINT bank_transaction_matches_transaction_id_key;
CREATE INDEX bank_transaction_matches_transaction_history
  ON cohamy_crm.bank_transaction_matches(transaction_id,created_at DESC);

ALTER TABLE cohamy_crm.payment_reminders ADD COLUMN attempts integer NOT NULL DEFAULT 0;
ALTER TABLE cohamy_crm.payment_reminders ADD COLUMN next_attempt_at timestamptz;
ALTER TABLE cohamy_crm.payment_reminders ADD COLUMN last_error text NOT NULL DEFAULT '';
ALTER TABLE cohamy_crm.payment_reminders DROP CONSTRAINT payment_reminders_status_check;
ALTER TABLE cohamy_crm.payment_reminders ADD CONSTRAINT payment_reminders_status_check
 CHECK(status IN('SCHEDULED','SENDING','SENT','SKIPPED','FAILED'));
UPDATE cohamy_crm.payment_reminders SET next_attempt_at=scheduled_for WHERE next_attempt_at IS NULL;
ALTER TABLE cohamy_crm.payment_reminders ALTER COLUMN next_attempt_at SET NOT NULL;
CREATE INDEX payment_reminders_due_retry
  ON cohamy_crm.payment_reminders(status,next_attempt_at);

ALTER TABLE cohamy_crm.cash_requests ADD COLUMN document_version_id uuid REFERENCES cohamy_crm.document_versions(id);

CREATE TABLE cohamy_crm.deposit_refund_requests (
  id uuid PRIMARY KEY,payment_id uuid NOT NULL REFERENCES cohamy_crm.payment_receipts(id),
  cash_request_id uuid NOT NULL UNIQUE REFERENCES cohamy_crm.cash_requests(id),amount numeric(30,0) NOT NULL CHECK(amount>0),
  actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER deposit_refund_requests_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.deposit_refund_requests
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

CREATE TABLE cohamy_crm.consignment_sale_previews (
  id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES cohamy_crm.users(id),agreement_id uuid NOT NULL REFERENCES cohamy_crm.consignment_agreements(id),
  agreement_version_id uuid NOT NULL REFERENCES cohamy_crm.consignment_agreement_versions(id),period_start date NOT NULL,period_end date NOT NULL,
  rows jsonb NOT NULL,checksum text NOT NULL,reason text NOT NULL,expires_at timestamptz NOT NULL,used_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consignment_sale_previews_owner ON cohamy_crm.consignment_sale_previews(user_id,expires_at DESC);

ALTER TABLE cohamy_crm.workspace_bookmarks DROP CONSTRAINT workspace_bookmarks_entity_type_check;
ALTER TABLE cohamy_crm.workspace_bookmarks ADD CONSTRAINT workspace_bookmarks_entity_type_check
 CHECK(entity_type IN('partner','order','product','commercial-request','sales-order'));
