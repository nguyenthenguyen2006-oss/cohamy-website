-- Deleted identities remain immutable business references. Reusing an email
-- creates a separate identity; locked or pending identities still reserve it.
CREATE UNIQUE INDEX users_live_email_case_insensitive
 ON cohamy_crm.users(lower(email)) WHERE deleted_at IS NULL;
DROP INDEX cohamy_crm.users_email_case_insensitive;
ALTER TABLE cohamy_crm.users DROP CONSTRAINT users_email_key;
