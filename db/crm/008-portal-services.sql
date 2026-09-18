CREATE TABLE cohamy_crm.dealer_addresses (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 label text NOT NULL, recipient text NOT NULL, phone text NOT NULL, address text NOT NULL,
 is_default boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX dealer_addresses_default_idx ON cohamy_crm.dealer_addresses(organization_id) WHERE is_default AND active;
CREATE TABLE cohamy_crm.dealer_carts (
 user_id uuid PRIMARY KEY REFERENCES cohamy_crm.users(id), organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 lines jsonb NOT NULL DEFAULT '[]', version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.support_tickets (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 created_by uuid NOT NULL REFERENCES cohamy_crm.users(id), title text NOT NULL, body text NOT NULL,
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_PROGRESS','WAITING_PARTNER','RESOLVED')),
 assigned_to uuid REFERENCES cohamy_crm.memberships(id), version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_tickets_org_idx ON cohamy_crm.support_tickets(organization_id,created_at DESC);
CREATE TABLE cohamy_crm.support_messages (
 id uuid PRIMARY KEY, ticket_id uuid NOT NULL REFERENCES cohamy_crm.support_tickets(id),
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id), body text NOT NULL, internal boolean NOT NULL DEFAULT false,
 idempotency_key uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER support_messages_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.support_messages
FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
ALTER TABLE cohamy_crm.private_documents DROP CONSTRAINT private_documents_entity_type_check;
ALTER TABLE cohamy_crm.private_documents ADD CONSTRAINT private_documents_entity_type_check CHECK(entity_type IN ('partner','order','ticket'));
ALTER TABLE cohamy_crm.notifications DROP CONSTRAINT notifications_entity_type_check;
ALTER TABLE cohamy_crm.notifications ADD CONSTRAINT notifications_entity_type_check CHECK(entity_type IN ('partner','order','product','account','ticket'));
