CREATE TABLE cohamy_crm.data_jobs (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
  membership_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id), role text NOT NULL,
  idempotency_key uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('IMPORT_PARTNERS','EXPORT_PARTNERS')),
  status text NOT NULL CHECK(status IN ('PREVIEW','QUEUED','RUNNING','SUCCEEDED','FAILED')),
  input jsonb NOT NULL, input_hash text NOT NULL, scope_hash text NOT NULL,
  result jsonb NOT NULL DEFAULT '{}', output bytea, attempts integer NOT NULL DEFAULT 0,
  lease_id uuid, lease_until timestamptz, error text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,idempotency_key)
);
CREATE INDEX data_jobs_queue_idx ON cohamy_crm.data_jobs(status,created_at);
ALTER TABLE cohamy_crm.organizations ADD COLUMN import_job_id uuid REFERENCES cohamy_crm.data_jobs(id);
ALTER TABLE cohamy_crm.organizations ADD COLUMN import_row integer;
CREATE UNIQUE INDEX organizations_import_origin_idx ON cohamy_crm.organizations(import_job_id,import_row) WHERE import_job_id IS NOT NULL;
