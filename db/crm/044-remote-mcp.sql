CREATE TABLE cohamy_crm.mcp_clients (
  id text PRIMARY KEY,
  name text NOT NULL,
  redirect_uris jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.mcp_authorizations (
  id uuid PRIMARY KEY,
  nonce_hash text NOT NULL,
  request jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
CREATE TABLE cohamy_crm.mcp_grants (
  id uuid PRIMARY KEY,
  client_id text NOT NULL REFERENCES cohamy_crm.mcp_clients(id),
  membership_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id),
  membership_version integer NOT NULL,
  code_hash text UNIQUE,
  code_expires_at timestamptz NOT NULL,
  code_used_at timestamptz,
  redirect_uri text NOT NULL,
  challenge text NOT NULL,
  resource text NOT NULL,
  scope text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE TABLE cohamy_crm.mcp_tokens (
  token_hash text PRIMARY KEY,
  grant_id uuid NOT NULL REFERENCES cohamy_crm.mcp_grants(id),
  kind text NOT NULL CHECK (kind IN ('access','refresh')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mcp_tokens_grant ON cohamy_crm.mcp_tokens(grant_id);
CREATE INDEX mcp_grants_membership ON cohamy_crm.mcp_grants(membership_id);
CREATE TABLE cohamy_crm.mcp_calls (
  grant_id uuid NOT NULL REFERENCES cohamy_crm.mcp_grants(id),
  request_id uuid NOT NULL,
  input_hash text NOT NULL,
  operation text NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(grant_id,request_id)
);
CREATE FUNCTION cohamy_crm.revoke_user_mcp() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE cohamy_crm.mcp_grants SET revoked_at=now()
  WHERE membership_id IN (SELECT id FROM cohamy_crm.memberships WHERE user_id=NEW.id) AND revoked_at IS NULL;
  RETURN NEW;
END;
$$;
CREATE TRIGGER users_revoke_mcp AFTER UPDATE OF password_hash,active ON cohamy_crm.users
FOR EACH ROW WHEN (OLD.password_hash IS DISTINCT FROM NEW.password_hash OR OLD.active IS DISTINCT FROM NEW.active)
EXECUTE FUNCTION cohamy_crm.revoke_user_mcp();
CREATE FUNCTION cohamy_crm.revoke_mfa_mcp() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE cohamy_crm.mcp_grants SET revoked_at=now()
  WHERE membership_id IN (SELECT id FROM cohamy_crm.memberships WHERE user_id=NEW.user_id) AND revoked_at IS NULL;
  RETURN NEW;
END;
$$;
CREATE TRIGGER mfa_revoke_mcp AFTER UPDATE OF status ON cohamy_crm.mfa_factors
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION cohamy_crm.revoke_mfa_mcp();
