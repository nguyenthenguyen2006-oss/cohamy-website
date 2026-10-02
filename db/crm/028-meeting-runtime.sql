-- Durable CRM articles, with a separate public snapshot while editors work on drafts.
CREATE TABLE cohamy_crm.website_articles (
  id text PRIMARY KEY,
  locale text NOT NULL,
  slug text NOT NULL,
  draft_row jsonb NOT NULL,
  public_row jsonb,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(locale, slug)
);
CREATE TABLE cohamy_crm.website_article_revisions (
  id uuid PRIMARY KEY,
  article_id text NOT NULL REFERENCES cohamy_crm.website_articles(id),
  number integer NOT NULL,
  row_snapshot jsonb NOT NULL,
  action text NOT NULL,
  actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(article_id, number)
);
CREATE TRIGGER website_article_revisions_immutable BEFORE UPDATE OR DELETE
  ON cohamy_crm.website_article_revisions FOR EACH ROW
  EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
-- A retry of the same request version cannot allocate the same balance twice.
CREATE UNIQUE INDEX provisional_request_balance_unique
  ON cohamy_crm.inventory_reservations(request_version_id, warehouse_id, location_id, product_id, lot_id)
  WHERE reservation_type='PROVISIONAL' AND status IN ('ACTIVE','PARTIAL');
