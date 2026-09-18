CREATE TABLE cohamy_crm.workspace_preferences (
  user_id uuid PRIMARY KEY REFERENCES cohamy_crm.users(id),
  value jsonb NOT NULL DEFAULT '{}', version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.workspace_drafts (
  user_id uuid NOT NULL REFERENCES cohamy_crm.users(id), draft_key text NOT NULL,
  entity_type text NOT NULL CHECK(entity_type IN ('partner','order','new-partner')),
  entity_id uuid, value jsonb NOT NULL, version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,draft_key)
);
CREATE TABLE cohamy_crm.saved_filters (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
  name text NOT NULL, resource text NOT NULL CHECK(resource IN ('partners','orders','tasks')),
  value jsonb NOT NULL, shared boolean NOT NULL DEFAULT false, is_default boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.workspace_bookmarks (
  user_id uuid NOT NULL REFERENCES cohamy_crm.users(id), entity_type text NOT NULL CHECK(entity_type IN ('partner','order','product')),
  entity_id uuid NOT NULL, pinned boolean NOT NULL DEFAULT false,
  opened_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,entity_type,entity_id)
);
CREATE TABLE cohamy_crm.notifications (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
  event_key text NOT NULL, kind text NOT NULL,
  entity_type text NOT NULL CHECK(entity_type IN ('partner','order','product','account')),
  entity_id uuid NOT NULL, message text NOT NULL, read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,event_key)
);
CREATE INDEX notifications_user_idx ON cohamy_crm.notifications(user_id,created_at DESC);
CREATE TABLE cohamy_crm.private_documents (
  id uuid PRIMARY KEY, entity_type text NOT NULL CHECK(entity_type IN ('partner','order')),
  entity_id uuid NOT NULL, title text NOT NULL, created_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.document_versions (
  id uuid PRIMARY KEY, document_id uuid NOT NULL REFERENCES cohamy_crm.private_documents(id),
  number integer NOT NULL CHECK(number>0), filename text NOT NULL, mime text NOT NULL,
  size integer NOT NULL CHECK(size BETWEEN 1 AND 8388608), checksum text NOT NULL,
  content bytea NOT NULL, effective_at timestamptz, expires_at timestamptz,
  created_by uuid NOT NULL REFERENCES cohamy_crm.users(id), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id,number), CHECK(expires_at IS NULL OR effective_at IS NULL OR expires_at>effective_at)
);
CREATE TRIGGER document_versions_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.document_versions
FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.document_reads (
  version_id uuid NOT NULL REFERENCES cohamy_crm.document_versions(id),
  user_id uuid NOT NULL REFERENCES cohamy_crm.users(id), read_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(version_id,user_id)
);
CREATE INDEX private_documents_entity_idx ON cohamy_crm.private_documents(entity_type,entity_id);
CREATE TABLE cohamy_crm.partner_contacts (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
  name text NOT NULL, responsibility text NOT NULL, phone text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '',
  is_primary boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX contacts_primary_idx ON cohamy_crm.partner_contacts(organization_id) WHERE is_primary AND active;
CREATE TABLE cohamy_crm.task_checklist (
  id uuid PRIMARY KEY, task_id uuid NOT NULL REFERENCES cohamy_crm.tasks(id),
  title text NOT NULL, position integer NOT NULL CHECK(position>=0), done boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1, UNIQUE(task_id,position)
);
CREATE TABLE cohamy_crm.task_dependencies (
  task_id uuid NOT NULL REFERENCES cohamy_crm.tasks(id), prerequisite_id uuid NOT NULL REFERENCES cohamy_crm.tasks(id),
  PRIMARY KEY(task_id,prerequisite_id), CHECK(task_id<>prerequisite_id)
);
