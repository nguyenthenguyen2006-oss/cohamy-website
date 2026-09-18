CREATE TABLE cohamy_crm.care_reasons (
 id uuid PRIMARY KEY, name text NOT NULL UNIQUE, active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1
);
CREATE TABLE cohamy_crm.care_tags (
 id uuid PRIMARY KEY, name text NOT NULL UNIQUE, active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1
);
CREATE TABLE cohamy_crm.partner_tags (
 organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id), tag_id uuid NOT NULL REFERENCES cohamy_crm.care_tags(id),
 PRIMARY KEY(organization_id,tag_id)
);
CREATE TABLE cohamy_crm.contact_preferences (
 organization_id uuid PRIMARY KEY REFERENCES cohamy_crm.organizations(id), channel text NOT NULL CHECK(channel IN ('PHONE','EMAIL','ZALO','IN_PERSON')),
 preferred_time text NOT NULL, interested_skus jsonb NOT NULL DEFAULT '[]', notes text NOT NULL DEFAULT '',
 version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.opportunities (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id), title text NOT NULL,
 stage text NOT NULL CHECK(stage IN ('NEW','NEEDS','QUOTED','WON','LOST')), reason_id uuid REFERENCES cohamy_crm.care_reasons(id),
 notes text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1, updated_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(stage<>'LOST' OR reason_id IS NOT NULL)
);
CREATE TABLE cohamy_crm.opportunity_history (
 id uuid PRIMARY KEY, opportunity_id uuid NOT NULL REFERENCES cohamy_crm.opportunities(id),
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id), from_stage text, to_stage text NOT NULL,
 reason_id uuid REFERENCES cohamy_crm.care_reasons(id), notes text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER opportunity_history_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.opportunity_history
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.partner_visits (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 visitor_id uuid NOT NULL REFERENCES cohamy_crm.users(id), visited_at timestamptz NOT NULL,
 result text NOT NULL, support_request text NOT NULL DEFAULT '', idempotency_key uuid NOT NULL,
 request_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(visitor_id,idempotency_key)
);
CREATE TRIGGER partner_visits_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.partner_visits
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE INDEX opportunities_org_idx ON cohamy_crm.opportunities(organization_id,stage,updated_at);
CREATE INDEX partner_visits_org_idx ON cohamy_crm.partner_visits(organization_id,visited_at);
ALTER TABLE cohamy_crm.private_documents DROP CONSTRAINT private_documents_entity_type_check;
ALTER TABLE cohamy_crm.private_documents ADD CONSTRAINT private_documents_entity_type_check CHECK(entity_type IN ('partner','order','ticket','library','visit'));
