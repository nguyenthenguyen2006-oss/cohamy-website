-- Existing identities keep their activation state and credentials. New invitations
-- never contain a recoverable token or password in storage.
ALTER TABLE cohamy_crm.users ADD COLUMN activation_status text NOT NULL DEFAULT 'ACTIVE'
 CHECK(activation_status IN('ACTIVE','PENDING_ACTIVATION'));
ALTER TABLE cohamy_crm.users ADD COLUMN activated_at timestamptz;
ALTER TABLE cohamy_crm.users ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE cohamy_crm.organizations ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX users_email_case_insensitive ON cohamy_crm.users(lower(email));
CREATE TABLE cohamy_crm.account_invitations (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 membership_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id),
 token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
 consumed_at timestamptz, revoked_at timestamptz,
 delivery_status text NOT NULL DEFAULT 'PENDING' CHECK(delivery_status IN('PENDING','SENT','FAILED','UNKNOWN')),
 created_by uuid NOT NULL REFERENCES cohamy_crm.users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_invitations_user ON cohamy_crm.account_invitations(user_id,created_at DESC);
CREATE TABLE cohamy_crm.account_provision_actions (
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id), key uuid NOT NULL,
 request_hash text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,key)
);
CREATE TRIGGER account_provision_actions_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.account_provision_actions
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.account_activation_attempts (
 key_hash text PRIMARY KEY, attempts integer NOT NULL, window_start timestamptz NOT NULL DEFAULT now()
);
