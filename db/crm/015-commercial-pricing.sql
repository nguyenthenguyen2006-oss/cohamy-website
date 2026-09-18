CREATE TABLE cohamy_crm.price_tiers (
 id uuid PRIMARY KEY,code text NOT NULL UNIQUE,name text NOT NULL,active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1
);
CREATE TABLE cohamy_crm.organization_pricing (
 organization_id uuid PRIMARY KEY REFERENCES cohamy_crm.organizations(id),tier_id uuid NOT NULL REFERENCES cohamy_crm.price_tiers(id),
 version integer NOT NULL DEFAULT 1,updated_by uuid NOT NULL REFERENCES cohamy_crm.users(id),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.commercial_units (
 product_id uuid NOT NULL REFERENCES cohamy_crm.products(id),code text NOT NULL,label text NOT NULL,
 numerator numeric(24,0) NOT NULL CHECK(numerator>0),denominator numeric(24,0) NOT NULL CHECK(denominator>0),
 is_case boolean NOT NULL,allow_fractional boolean NOT NULL,active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,
 PRIMARY KEY(product_id,code)
);
CREATE UNIQUE INDEX commercial_units_one_case ON cohamy_crm.commercial_units(product_id) WHERE is_case AND active;
CREATE TABLE cohamy_crm.commercial_unit_versions (
 id uuid PRIMARY KEY,product_id uuid NOT NULL REFERENCES cohamy_crm.products(id),code text NOT NULL,version integer NOT NULL,
 snapshot jsonb NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(product_id,code,version)
);
CREATE TRIGGER commercial_unit_versions_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.commercial_unit_versions
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.price_books (
 id uuid PRIMARY KEY,name text NOT NULL,version integer NOT NULL DEFAULT 1,latest_version_id uuid,published_version_id uuid,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED','WITHDRAWN')),
 audience text CHECK(audience IN ('ALL','TIER','ORGANIZATION')),tier_id uuid REFERENCES cohamy_crm.price_tiers(id),
 organization_id uuid REFERENCES cohamy_crm.organizations(id),priority integer,starts_at timestamptz,ends_at timestamptz,
 created_by uuid NOT NULL REFERENCES cohamy_crm.users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.price_book_versions (
 id uuid PRIMARY KEY,book_id uuid NOT NULL REFERENCES cohamy_crm.price_books(id),number integer NOT NULL,
 definition jsonb NOT NULL,checksum text NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 idempotency_key uuid NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(book_id,number),UNIQUE(actor_id,idempotency_key)
);
ALTER TABLE cohamy_crm.price_books
 ADD CONSTRAINT price_books_latest_fk FOREIGN KEY(latest_version_id) REFERENCES cohamy_crm.price_book_versions(id),
 ADD CONSTRAINT price_books_published_fk FOREIGN KEY(published_version_id) REFERENCES cohamy_crm.price_book_versions(id);
CREATE TABLE cohamy_crm.price_events (
 id uuid PRIMARY KEY,book_id uuid NOT NULL REFERENCES cohamy_crm.price_books(id),version_id uuid NOT NULL REFERENCES cohamy_crm.price_book_versions(id),
 action text NOT NULL CHECK(action IN ('PUBLISHED','WITHDRAWN')),actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,
 idempotency_key uuid NOT NULL,request_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER price_book_versions_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.price_book_versions
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TRIGGER price_events_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.price_events
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE INDEX price_books_effective ON cohamy_crm.price_books(status,audience,priority,starts_at,ends_at);
