-- Retain identities referenced by immutable business documents and audit history.
-- Existing users keep their access, credentials and membership versions.
ALTER TABLE cohamy_crm.users ADD COLUMN deleted_at timestamptz;
ALTER TABLE cohamy_crm.users ADD COLUMN deleted_by uuid REFERENCES cohamy_crm.users(id);
ALTER TABLE cohamy_crm.users ADD COLUMN deletion_reason text;
ALTER TABLE cohamy_crm.users ADD CONSTRAINT deleted_account_inactive CHECK(deleted_at IS NULL OR NOT active);
ALTER TABLE cohamy_crm.users ADD CONSTRAINT deleted_account_attribution CHECK(
 deleted_at IS NULL OR (deleted_by IS NOT NULL AND deletion_reason IS NOT NULL AND length(btrim(deletion_reason)) BETWEEN 3 AND 1000)
);
CREATE INDEX deleted_accounts_at ON cohamy_crm.users(deleted_at) WHERE deleted_at IS NOT NULL;
