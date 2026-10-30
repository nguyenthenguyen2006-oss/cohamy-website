-- New buyer workflows only. Existing orders/documents are not backfilled.
CREATE TABLE cohamy_crm.buyer_fulfillment_state (
 order_id uuid PRIMARY KEY REFERENCES cohamy_crm.buyer_orders(id),
 policy_id uuid REFERENCES cohamy_crm.order_policies(id),policy_snapshot jsonb NOT NULL,
 approval_status text NOT NULL DEFAULT 'PENDING' CHECK(approval_status IN('PENDING','APPROVED','REJECTED')),
 approval_by uuid REFERENCES cohamy_crm.users(id),approval_at timestamptz,
 payment_review text NOT NULL DEFAULT 'PENDING' CHECK(payment_review IN('PENDING','CLEAR','HOLD')),
 payment_by uuid REFERENCES cohamy_crm.users(id),payment_at timestamptz,
 stage text NOT NULL DEFAULT 'NEW' CHECK(stage IN('NEW','PICKING','PACKED','DELIVERED','DELIVERY_FAILED')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION cohamy_crm.preserve_buyer_fulfillment_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.policy_id IS DISTINCT FROM OLD.policy_id OR NEW.policy_snapshot IS DISTINCT FROM OLD.policy_snapshot THEN
  RAISE EXCEPTION 'BUYER_FULFILLMENT_POLICY_IMMUTABLE';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preserve_buyer_fulfillment_policy BEFORE UPDATE OR DELETE ON cohamy_crm.buyer_fulfillment_state FOR EACH ROW EXECUTE FUNCTION cohamy_crm.preserve_buyer_fulfillment_policy();
CREATE TABLE cohamy_crm.buyer_fulfillment_events (
 id uuid PRIMARY KEY,order_id uuid NOT NULL REFERENCES cohamy_crm.buyer_orders(id),
 action text NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 before_snapshot jsonb NOT NULL,after_snapshot jsonb NOT NULL,note text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX buyer_fulfillment_events_order ON cohamy_crm.buyer_fulfillment_events(order_id,created_at,id);
CREATE TRIGGER buyer_fulfillment_events_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.buyer_fulfillment_events FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.buyer_fulfillment_actions (
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),key uuid NOT NULL,
 request_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_id,key)
);
CREATE TRIGGER buyer_fulfillment_actions_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.buyer_fulfillment_actions FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
