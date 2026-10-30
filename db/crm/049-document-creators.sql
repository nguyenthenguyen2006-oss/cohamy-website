-- Add attribution without rewriting any existing document or confirmed snapshot.
CREATE TABLE cohamy_crm.document_creators (
 entity_table text NOT NULL CHECK(entity_table IN('factory_invoices','warehouse_handover_invoices','commercial_requests','sales_orders','buyer_orders')),
 entity_id uuid NOT NULL,user_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 display_name text NOT NULL,email text NOT NULL,captured_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(entity_table,entity_id)
);
CREATE INDEX document_creators_user ON cohamy_crm.document_creators(user_id,captured_at);
CREATE TRIGGER document_creators_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.document_creators
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

CREATE FUNCTION cohamy_crm.capture_document_creator() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE creator uuid;
BEGIN
 creator := (to_jsonb(NEW)->>TG_ARGV[0])::uuid;
 IF TG_OP='UPDATE' THEN
  IF creator IS DISTINCT FROM (to_jsonb(OLD)->>TG_ARGV[0])::uuid THEN RAISE EXCEPTION 'DOCUMENT_CREATOR_IMMUTABLE'; END IF;
  RETURN NEW;
 END IF;
 INSERT INTO cohamy_crm.document_creators(entity_table,entity_id,user_id,display_name,email)
 SELECT TG_TABLE_NAME,NEW.id,u.id,u.display_name,u.email FROM cohamy_crm.users u WHERE u.id=creator;
 IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_CREATOR_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER capture_creator AFTER INSERT ON cohamy_crm.factory_invoices FOR EACH ROW EXECUTE FUNCTION cohamy_crm.capture_document_creator('created_by');
CREATE TRIGGER preserve_creator BEFORE UPDATE OF created_by ON cohamy_crm.factory_invoices FOR EACH ROW EXECUTE FUNCTION cohamy_crm.capture_document_creator('created_by');
CREATE TRIGGER capture_creator AFTER INSERT ON cohamy_crm.warehouse_handover_invoices FOR EACH ROW EXECUTE FUNCTION cohamy_crm.capture_document_creator('created_by');
CREATE TRIGGER preserve_creator BEFORE UPDATE OF created_by ON cohamy_crm.warehouse_handover_invoices FOR EACH ROW EXECUTE FUNCTION cohamy_crm.capture_document_creator('created_by');
CREATE TRIGGER capture_creator AFTER INSERT ON cohamy_crm.commercial_requests FOR EACH ROW EXECUTE FUNCTION cohamy_crm.capture_document_creator('creator_id');
CREATE TRIGGER preserve_creator BEFORE UPDATE OF creator_id ON cohamy_crm.commercial_requests FOR EACH ROW EXECUTE FUNCTION cohamy_crm.capture_document_creator('creator_id');
CREATE TRIGGER capture_creator AFTER INSERT ON cohamy_crm.sales_orders FOR EACH ROW EXECUTE FUNCTION cohamy_crm.capture_document_creator('creator_id');
CREATE TRIGGER preserve_creator BEFORE UPDATE OF creator_id ON cohamy_crm.sales_orders FOR EACH ROW EXECUTE FUNCTION cohamy_crm.capture_document_creator('creator_id');
CREATE TRIGGER capture_creator AFTER INSERT ON cohamy_crm.buyer_orders FOR EACH ROW EXECUTE FUNCTION cohamy_crm.capture_document_creator('creator_id');
CREATE TRIGGER preserve_creator BEFORE UPDATE OF creator_id ON cohamy_crm.buyer_orders FOR EACH ROW EXECUTE FUNCTION cohamy_crm.capture_document_creator('creator_id');

ALTER TABLE cohamy_crm.audit_events ADD COLUMN actor_identity jsonb;
CREATE FUNCTION cohamy_crm.capture_audit_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 SELECT jsonb_build_object('userId',u.id,'displayName',u.display_name,'email',u.email)
 INTO NEW.actor_identity FROM cohamy_crm.users u WHERE u.id=NEW.actor_id;
 RETURN NEW;
END $$;
CREATE TRIGGER capture_actor BEFORE INSERT ON cohamy_crm.audit_events FOR EACH ROW EXECUTE FUNCTION cohamy_crm.capture_audit_identity();
