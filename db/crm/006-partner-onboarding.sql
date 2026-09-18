CREATE TABLE cohamy_crm.partner_invitations (
  id uuid PRIMARY KEY, token_hash text NOT NULL UNIQUE, created_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
  organization_id uuid REFERENCES cohamy_crm.organizations(id),
  role text NOT NULL DEFAULT 'DEALER_OWNER' CHECK(role IN ('DEALER_OWNER','DEALER_STAFF')),
  expires_at timestamptz NOT NULL, max_uses integer NOT NULL CHECK(max_uses BETWEEN 1 AND 100),
  uses integer NOT NULL DEFAULT 0 CHECK(uses>=0 AND uses<=max_uses), revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.partner_applications (
  id uuid PRIMARY KEY, idempotency_key uuid NOT NULL UNIQUE, email text NOT NULL UNIQUE CHECK(email=lower(email)),
  registration_hash text NOT NULL, approval_hash text, password_hash text NOT NULL, company_name text NOT NULL, representative text NOT NULL, phone text NOT NULL,
  address text NOT NULL, region text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','NEEDS_INFO','APPROVED','REJECTED')),
  email_verified_at timestamptz, version integer NOT NULL DEFAULT 1,
  invitation_id uuid REFERENCES cohamy_crm.partner_invitations(id),
  assigned_to uuid REFERENCES cohamy_crm.memberships(id), organization_id uuid REFERENCES cohamy_crm.organizations(id),
  membership_id uuid UNIQUE REFERENCES cohamy_crm.memberships(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(status<>'APPROVED' OR (membership_id IS NOT NULL AND email_verified_at IS NOT NULL))
);
CREATE TABLE cohamy_crm.applicant_sessions (
  token_hash text PRIMARY KEY, application_id uuid NOT NULL REFERENCES cohamy_crm.partner_applications(id),
  expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.application_history (
  id uuid PRIMARY KEY, application_id uuid NOT NULL REFERENCES cohamy_crm.partner_applications(id),
  actor_id uuid REFERENCES cohamy_crm.users(id), action text NOT NULL, message text NOT NULL DEFAULT '',
  fields jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER application_history_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.application_history
FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.application_verifications (
  application_id uuid PRIMARY KEY REFERENCES cohamy_crm.partner_applications(id), token_hash text NOT NULL,
  expires_at timestamptz NOT NULL, attempts integer NOT NULL DEFAULT 0, consumed_at timestamptz,
  delivery_status text NOT NULL CHECK(delivery_status IN ('PENDING','SENT','FAILED')),
  requested_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partner_applications_queue_idx ON cohamy_crm.partner_applications(status,created_at);
