CREATE TABLE cohamy_crm.storefront_settings (
 id text PRIMARY KEY CHECK(id='PUBLIC'),
 discount_percent integer NOT NULL DEFAULT 30 CHECK(discount_percent BETWEEN 0 AND 99),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 updated_by uuid REFERENCES cohamy_crm.users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO cohamy_crm.storefront_settings(id) VALUES('PUBLIC');

CREATE TABLE cohamy_crm.storefront_setting_actions (
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 key uuid NOT NULL,
 request_hash text NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,key)
);
CREATE TRIGGER storefront_setting_actions_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.storefront_setting_actions
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
