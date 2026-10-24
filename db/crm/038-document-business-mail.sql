CREATE TABLE cohamy_crm.document_business_snapshots (
  id uuid PRIMARY KEY, event_key text NOT NULL UNIQUE, event text NOT NULL,
  entity_id uuid NOT NULL, revision integer NOT NULL, snapshot jsonb NOT NULL,
  filename text NOT NULL, pdf bytea NOT NULL, checksum text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER document_business_snapshots_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.document_business_snapshots
  FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE OR REPLACE FUNCTION cohamy_crm.guard_vat_file() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE doc uuid;
BEGIN
  IF TG_TABLE_NAME='private_documents' THEN doc := OLD.id;
  ELSIF TG_OP='INSERT' THEN doc := NEW.document_id;
  ELSE doc := OLD.document_id;
  END IF;
  IF EXISTS(SELECT 1 FROM cohamy_crm.document_vat_links l JOIN cohamy_crm.document_versions v ON v.id=l.version_id WHERE v.document_id=doc)
  THEN RAISE EXCEPTION 'VAT_FILE_LOCKED'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
