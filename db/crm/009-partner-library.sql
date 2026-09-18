ALTER TABLE cohamy_crm.memberships ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE cohamy_crm.partner_applications ADD COLUMN reviewer_id uuid REFERENCES cohamy_crm.memberships(id);
CREATE TABLE cohamy_crm.partner_library (
 id uuid PRIMARY KEY, title text NOT NULL, category text NOT NULL CHECK(category IN ('CATALOGUE','IMAGE','GUIDE','POLICY')),
 audience text NOT NULL CHECK(audience IN ('ALL_DEALERS','DEALER_OWNER','DEALER_STAFF')),
 organization_id uuid REFERENCES cohamy_crm.organizations(id),
 required_read boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED','WITHDRAWN')),
 effective_at timestamptz NOT NULL, expires_at timestamptz,
 version integer NOT NULL DEFAULT 1, created_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), CHECK(expires_at IS NULL OR expires_at>effective_at)
);
CREATE TABLE cohamy_crm.onboarding_progress (
 user_id uuid PRIMARY KEY REFERENCES cohamy_crm.users(id), catalog_seen_at timestamptz
);
ALTER TABLE cohamy_crm.private_documents DROP CONSTRAINT private_documents_entity_type_check;
ALTER TABLE cohamy_crm.private_documents ADD CONSTRAINT private_documents_entity_type_check CHECK(entity_type IN ('partner','order','ticket','library'));
CREATE INDEX partner_library_audience_idx ON cohamy_crm.partner_library(status,audience,organization_id);
