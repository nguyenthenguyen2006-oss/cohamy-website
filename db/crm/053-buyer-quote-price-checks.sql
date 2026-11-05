-- Native buyer quotes keep their existing version/event store. This immutable
-- check records the existing published price-book policy used for that quote.
ALTER TABLE cohamy_crm.buyer_orders ADD COLUMN quote_fee_amount numeric(30,0) NOT NULL DEFAULT 0 CHECK(quote_fee_amount>=0);
CREATE TABLE cohamy_crm.buyer_quote_price_checks (
 order_id uuid NOT NULL REFERENCES cohamy_crm.buyer_orders(id),
 order_version integer NOT NULL CHECK(order_version>0),
 price_version_id uuid REFERENCES cohamy_crm.price_book_versions(id),
 needs_approval boolean NOT NULL,
 non_self_approval boolean NOT NULL,
 minimum_shortfalls jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(minimum_shortfalls)='array'),
 snapshot jsonb NOT NULL,
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(order_id,order_version)
);
CREATE TRIGGER buyer_quote_price_checks_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.buyer_quote_price_checks
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
