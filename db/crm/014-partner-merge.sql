ALTER TABLE cohamy_crm.organizations
 ADD COLUMN merged_into_id uuid REFERENCES cohamy_crm.organizations(id),
 ADD CONSTRAINT organizations_merge_not_self CHECK(merged_into_id IS NULL OR merged_into_id<>id);
CREATE INDEX organizations_merged_into_idx ON cohamy_crm.organizations(merged_into_id) WHERE merged_into_id IS NOT NULL;
CREATE TABLE cohamy_crm.partner_merge_previews (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 source_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),target_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 choices jsonb NOT NULL,reason text NOT NULL,manifest jsonb NOT NULL,result jsonb,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.partner_merge_history (
 id uuid PRIMARY KEY,source_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),target_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,choices jsonb NOT NULL,manifest jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(source_id)
);
CREATE TRIGGER partner_merge_history_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.partner_merge_history
FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

-- Runtime keeps SELECT/INSERT only on immutable histories. This helper grants
-- only bounded locks, never UPDATE/DELETE or arbitrary caller-controlled SQL.
CREATE FUNCTION cohamy_crm.lock_partner_merge() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE row record;
BEGIN
 EXECUTE 'LOCK TABLE cohamy_crm.task_dependencies IN EXCLUSIVE MODE NOWAIT';
 FOR row IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='cohamy_crm' AND c.relkind='r' AND c.relname<>'migrations' ORDER BY c.relname LOOP
   EXECUTE format('LOCK TABLE cohamy_crm.%I IN EXCLUSIVE MODE NOWAIT',row.relname);
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION cohamy_crm.lock_partner_merge() FROM PUBLIC;
