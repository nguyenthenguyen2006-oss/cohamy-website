-- Additive only. Existing invoices, balances and receivables are retained.
ALTER TABLE cohamy_crm.factory_invoices
  ADD COLUMN workflow_state text NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN workflow_version integer NOT NULL DEFAULT 1,
  ADD COLUMN factory_membership_id uuid REFERENCES cohamy_crm.memberships(id),
  ADD COLUMN flow_payload jsonb,
  ADD COLUMN confirmed_at timestamptz,
  ADD COLUMN confirmed_by uuid REFERENCES cohamy_crm.users(id);
ALTER TABLE cohamy_crm.warehouse_handover_invoices
  ADD COLUMN workflow_state text NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN workflow_version integer NOT NULL DEFAULT 1,
  ADD COLUMN flow_payload jsonb,
  ADD COLUMN confirmed_at timestamptz,
  ADD COLUMN confirmed_by uuid REFERENCES cohamy_crm.users(id),
  ADD COLUMN IF NOT EXISTS inventory_document_id uuid REFERENCES cohamy_crm.inventory_documents(id);
CREATE UNIQUE INDEX document_flow_receipt_source_once ON cohamy_crm.factory_invoices(parent_id)
  WHERE stage='WAREHOUSE_RECONCILIATION' AND workflow_state='CONFIRMED';
CREATE TABLE cohamy_crm.document_flow_revisions (
  id uuid PRIMARY KEY, entity_type text NOT NULL, entity_id uuid NOT NULL,
  revision integer NOT NULL CHECK(revision>0), snapshot jsonb NOT NULL,
  filename text NOT NULL, pdf bytea NOT NULL, checksum text NOT NULL,
  actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id), reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(entity_type,entity_id,revision)
);
CREATE TRIGGER document_flow_revisions_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.document_flow_revisions
  FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.document_flow_actions (
  actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id), key uuid NOT NULL,
  request_hash text NOT NULL, result jsonb NOT NULL, PRIMARY KEY(actor_id,key)
);
CREATE TABLE cohamy_crm.document_flow_locks (actor_id uuid PRIMARY KEY REFERENCES cohamy_crm.users(id));
CREATE TABLE cohamy_crm.document_vat_links (
  id uuid PRIMARY KEY, entity_type text NOT NULL, entity_id uuid NOT NULL,
  version_id uuid NOT NULL UNIQUE REFERENCES cohamy_crm.document_versions(id),
  revision integer NOT NULL, actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
  reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_type,entity_id,revision)
);
CREATE TRIGGER document_vat_links_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.document_vat_links
  FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.document_mail_rules (
  id uuid PRIMARY KEY, event text NOT NULL, warehouse_id uuid REFERENCES cohamy_crm.warehouses(id),
  factory_membership_id uuid REFERENCES cohamy_crm.memberships(id),
  enabled boolean NOT NULL DEFAULT false, recipients jsonb NOT NULL DEFAULT '{"to":[],"cc":[],"bcc":[]}',
  subject text NOT NULL DEFAULT '{{type}} · {{code}}', body text NOT NULL DEFAULT '{{type}} {{code}}\n{{status}}\n{{url}}',
  attachments text NOT NULL DEFAULT 'EVENT' CHECK(attachments IN('EVENT','BUNDLE')),
  version integer NOT NULL DEFAULT 1, updated_by uuid REFERENCES cohamy_crm.users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX document_mail_rule_scope ON cohamy_crm.document_mail_rules(event,COALESCE(warehouse_id,'00000000-0000-0000-0000-000000000000'),COALESCE(factory_membership_id,'00000000-0000-0000-0000-000000000000'));
CREATE TABLE cohamy_crm.document_mail_outbox (
  id uuid PRIMARY KEY, event_key text NOT NULL, event text NOT NULL, entity_id uuid NOT NULL,
  revision integer NOT NULL, rule_id uuid REFERENCES cohamy_crm.document_mail_rules(id),
  warehouse_id uuid, factory_membership_id uuid, code text NOT NULL,
  recipients jsonb NOT NULL, subject text NOT NULL, body text NOT NULL,
  files jsonb NOT NULL, status text NOT NULL DEFAULT 'PENDING',
  attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
  claim_token uuid, claimed_at timestamptz, message_id text, last_error text NOT NULL DEFAULT '',
  parent_job_id uuid REFERENCES cohamy_crm.document_mail_outbox(id),
  created_by uuid REFERENCES cohamy_crm.users(id), created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(event_key,rule_id)
);
CREATE INDEX document_mail_due ON cohamy_crm.document_mail_outbox(status,available_at);
CREATE TABLE cohamy_crm.document_mail_webhooks (
  event_key text PRIMARY KEY, message_id text NOT NULL, recipient text NOT NULL,
  event text NOT NULL, occurred_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER document_mail_webhooks_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.document_mail_webhooks
  FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
-- Content is immutable after confirmation. Services set this transaction-local
-- flag only after authenticating an ADMIN and recording an amendment reason.
CREATE FUNCTION cohamy_crm.guard_flow_content() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.workflow_state='CONFIRMED' AND current_setting('cohamy.document_amend',true) IS DISTINCT FROM 'on' THEN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'DOCUMENT_LOCKED'; END IF;
    IF (to_jsonb(NEW)-ARRAY['status','reconciliation_status','reconciled_by','reconciled_by_name','reconciled_at','received_date','updated_at'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','reconciliation_status','reconciled_by','reconciled_by_name','reconciled_at','received_date','updated_at'])
    THEN RAISE EXCEPTION 'DOCUMENT_LOCKED'; END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER factory_flow_content_guard BEFORE UPDATE OR DELETE ON cohamy_crm.factory_invoices
  FOR EACH ROW EXECUTE FUNCTION cohamy_crm.guard_flow_content();
CREATE TRIGGER handover_flow_content_guard BEFORE UPDATE OR DELETE ON cohamy_crm.warehouse_handover_invoices
  FOR EACH ROW EXECUTE FUNCTION cohamy_crm.guard_flow_content();
CREATE FUNCTION cohamy_crm.guard_vat_file() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE doc uuid;
BEGIN
  doc := CASE WHEN TG_TABLE_NAME='private_documents' THEN OLD.id ELSE CASE WHEN TG_OP='INSERT' THEN NEW.document_id ELSE OLD.document_id END END;
  IF EXISTS(SELECT 1 FROM cohamy_crm.document_vat_links l JOIN cohamy_crm.document_versions v ON v.id=l.version_id WHERE v.document_id=doc)
  THEN RAISE EXCEPTION 'VAT_FILE_LOCKED'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER vat_version_guard BEFORE INSERT OR UPDATE OR DELETE ON cohamy_crm.document_versions
  FOR EACH ROW EXECUTE FUNCTION cohamy_crm.guard_vat_file();
CREATE TRIGGER vat_metadata_guard BEFORE UPDATE OR DELETE ON cohamy_crm.private_documents
  FOR EACH ROW EXECUTE FUNCTION cohamy_crm.guard_vat_file();
