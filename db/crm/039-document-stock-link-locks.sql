CREATE TABLE cohamy_crm.document_flow_reservation_links (
  entity_id uuid NOT NULL, reservation_id uuid NOT NULL REFERENCES cohamy_crm.inventory_reservations(id),
  consumed numeric(30,6) NOT NULL CHECK(consumed>=0), PRIMARY KEY(entity_id,reservation_id)
);
CREATE TABLE cohamy_crm.document_flow_reservation_adjustments (
  id uuid PRIMARY KEY, entity_id uuid NOT NULL, revision integer NOT NULL,
  reservation_id uuid NOT NULL REFERENCES cohamy_crm.inventory_reservations(id),
  delta numeric(30,6) NOT NULL, actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
  reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER document_flow_reservation_adjustments_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.document_flow_reservation_adjustments
  FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE OR REPLACE FUNCTION cohamy_crm.guard_flow_content() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.workflow_state='CONFIRMED' AND current_setting('cohamy.document_amend',true) IS DISTINCT FROM 'on' THEN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'DOCUMENT_LOCKED'; END IF;
    IF (to_jsonb(NEW)-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'updated_at')
    THEN RAISE EXCEPTION 'DOCUMENT_LOCKED'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
