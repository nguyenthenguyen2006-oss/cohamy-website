CREATE TABLE cohamy_crm.quotations (
 id uuid PRIMARY KEY,code text NOT NULL UNIQUE,organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 creator_membership_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id),version integer NOT NULL DEFAULT 1,
 latest_version_id uuid,sent_version_id uuid,accepted_version_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.quotation_versions (
 id uuid PRIMARY KEY,quotation_id uuid NOT NULL REFERENCES cohamy_crm.quotations(id),number integer NOT NULL,
 price_version_id uuid NOT NULL REFERENCES cohamy_crm.price_book_versions(id),snapshot jsonb NOT NULL,checksum text NOT NULL,
 approval_required boolean NOT NULL,creator_id uuid NOT NULL REFERENCES cohamy_crm.users(id),valid_until timestamptz NOT NULL,
 idempotency_key uuid NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(quotation_id,number),UNIQUE(creator_id,idempotency_key)
);
ALTER TABLE cohamy_crm.quotations
 ADD CONSTRAINT quotations_latest_fk FOREIGN KEY(latest_version_id) REFERENCES cohamy_crm.quotation_versions(id),
 ADD CONSTRAINT quotations_sent_fk FOREIGN KEY(sent_version_id) REFERENCES cohamy_crm.quotation_versions(id),
 ADD CONSTRAINT quotations_accepted_fk FOREIGN KEY(accepted_version_id) REFERENCES cohamy_crm.quotation_versions(id);
CREATE TABLE cohamy_crm.quotation_events (
 id uuid PRIMARY KEY,quotation_id uuid NOT NULL REFERENCES cohamy_crm.quotations(id),version_id uuid NOT NULL REFERENCES cohamy_crm.quotation_versions(id),
 action text NOT NULL CHECK(action IN('APPROVED','REJECTED','SENT','ACCEPTED','REVISION_REQUESTED')),
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,idempotency_key uuid NOT NULL,
 request_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE UNIQUE INDEX quotation_events_one_decision ON cohamy_crm.quotation_events(version_id) WHERE action IN('APPROVED','REJECTED');
CREATE UNIQUE INDEX quotation_events_one_send ON cohamy_crm.quotation_events(version_id) WHERE action='SENT';
CREATE UNIQUE INDEX quotation_events_one_accept ON cohamy_crm.quotation_events(version_id) WHERE action='ACCEPTED';
CREATE TRIGGER quotation_versions_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.quotation_versions FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TRIGGER quotation_events_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.quotation_events FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.quotation_pdfs (
 version_id uuid PRIMARY KEY REFERENCES cohamy_crm.quotation_versions(id),content bytea NOT NULL CHECK(octet_length(content)<=8388608),
 checksum text NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER quotation_pdfs_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.quotation_pdfs FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE INDEX quotations_partner ON cohamy_crm.quotations(organization_id,updated_at);
