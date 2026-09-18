-- Keep one personal default if older code produced competing defaults.
WITH ranked AS (
 SELECT id,row_number() OVER(PARTITION BY user_id,resource ORDER BY created_at DESC,id DESC) AS position
 FROM cohamy_crm.saved_filters WHERE is_default
)
UPDATE cohamy_crm.saved_filters SET is_default=false,version=version+1
WHERE id IN(SELECT id FROM ranked WHERE position>1);
CREATE UNIQUE INDEX saved_filter_one_default ON cohamy_crm.saved_filters(user_id,resource) WHERE is_default;
ALTER TABLE cohamy_crm.notifications ADD COLUMN available_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX notifications_available_idx ON cohamy_crm.notifications(user_id,available_at,created_at DESC);
ALTER TABLE cohamy_crm.sessions ADD COLUMN device_label text NOT NULL DEFAULT 'Thiết bị chưa ghi nhận';

CREATE TABLE cohamy_crm.bulk_previews (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 action text NOT NULL CHECK(action IN('DEACTIVATE','ACTIVATE','STAGE')),
 reason text NOT NULL,stage text CHECK(stage IN('LEAD','CONTACTED','ACTIVE','INACTIVE')),
 items jsonb NOT NULL,result jsonb,created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',completed_at timestamptz
);
CREATE TABLE cohamy_crm.custom_field_definitions (
 id uuid PRIMARY KEY,field_key text NOT NULL UNIQUE,label text NOT NULL,
 kind text NOT NULL CHECK(kind IN('TEXT','NUMBER','DATE','BOOLEAN','ENUM')),
 options jsonb NOT NULL DEFAULT '[]',required boolean NOT NULL DEFAULT false,
 read_roles text[] NOT NULL,write_roles text[] NOT NULL,active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1,created_by uuid NOT NULL REFERENCES cohamy_crm.users(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.custom_field_versions (
 field_id uuid NOT NULL REFERENCES cohamy_crm.custom_field_definitions(id),number integer NOT NULL,
 definition jsonb NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(field_id,number)
);
CREATE TRIGGER custom_field_versions_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.custom_field_versions
FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.custom_field_values (
 organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),field_id uuid NOT NULL,
 definition_version integer NOT NULL,value jsonb NOT NULL,version integer NOT NULL DEFAULT 1,
 updated_by uuid NOT NULL REFERENCES cohamy_crm.users(id),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,field_id,definition_version),
 FOREIGN KEY(field_id,definition_version) REFERENCES cohamy_crm.custom_field_versions(field_id,number)
);
CREATE TABLE cohamy_crm.custom_value_history (
 id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 field_id uuid NOT NULL,definition_version integer NOT NULL,value jsonb NOT NULL,
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(field_id,definition_version) REFERENCES cohamy_crm.custom_field_versions(field_id,number)
);
CREATE TRIGGER custom_value_history_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.custom_value_history
FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
