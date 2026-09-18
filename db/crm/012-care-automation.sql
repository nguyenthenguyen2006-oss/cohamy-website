ALTER TABLE cohamy_crm.tasks ADD COLUMN care_kind text NOT NULL DEFAULT 'GENERAL'
 CHECK(care_kind IN('GENERAL','FOLLOW_UP','SUPPORT','APPROVAL'));
CREATE TABLE cohamy_crm.care_schedules (
 id uuid PRIMARY KEY,creator_membership_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id),
 entity_type text NOT NULL CHECK(entity_type IN('partner','order')),entity_id uuid NOT NULL,
 title text NOT NULL,assignee_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id),
 care_kind text NOT NULL CHECK(care_kind IN('GENERAL','FOLLOW_UP','SUPPORT','APPROVAL')),
 frequency text NOT NULL CHECK(frequency IN('DAILY','WEEKLY','MONTHLY')),every integer NOT NULL CHECK(every BETWEEN 1 AND 52),
 anchor_day integer NOT NULL CHECK(anchor_day BETWEEN 1 AND 31),
 timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh' CHECK(timezone='Asia/Ho_Chi_Minh'),
 next_due_at timestamptz NOT NULL,enabled boolean NOT NULL DEFAULT false,error_code text NOT NULL DEFAULT '',
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_schedules_due ON cohamy_crm.care_schedules(next_due_at,id) WHERE enabled;
CREATE TABLE cohamy_crm.care_schedule_runs (
 id uuid PRIMARY KEY,schedule_id uuid NOT NULL REFERENCES cohamy_crm.care_schedules(id),
 scheduled_at timestamptz NOT NULL,definition_version integer NOT NULL,
 status text NOT NULL CHECK(status IN('SUCCEEDED','BLOCKED')),task_id uuid REFERENCES cohamy_crm.tasks(id),
 error_code text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((status='SUCCEEDED')=(task_id IS NOT NULL))
);
CREATE UNIQUE INDEX care_schedule_success_once ON cohamy_crm.care_schedule_runs(schedule_id,scheduled_at) WHERE status='SUCCEEDED';
CREATE TRIGGER care_schedule_runs_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.care_schedule_runs
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.task_watchers (
 task_id uuid NOT NULL REFERENCES cohamy_crm.tasks(id),membership_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id),
 user_id uuid NOT NULL REFERENCES cohamy_crm.users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(task_id,membership_id)
);
CREATE TABLE cohamy_crm.activity_mentions (
 activity_id uuid NOT NULL REFERENCES cohamy_crm.activities(id),membership_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id),
 PRIMARY KEY(activity_id,membership_id)
);
CREATE TRIGGER activity_mentions_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.activity_mentions
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.care_task_rules (
 id uuid PRIMARY KEY,name text NOT NULL,event_action text NOT NULL CHECK(event_action IN('application.approved','partner.created')),
 title text NOT NULL,care_kind text NOT NULL CHECK(care_kind IN('GENERAL','FOLLOW_UP','SUPPORT','APPROVAL')),
 assignee_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id),created_by uuid NOT NULL REFERENCES cohamy_crm.memberships(id),
 due_minutes integer NOT NULL CHECK(due_minutes BETWEEN 1 AND 525600),enabled boolean NOT NULL DEFAULT false,
 activated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.care_rule_runs (
 rule_id uuid NOT NULL REFERENCES cohamy_crm.care_task_rules(id),event_id uuid NOT NULL REFERENCES cohamy_crm.audit_events(id),
 rule_version integer NOT NULL,entity_id uuid NOT NULL,
 task_id uuid REFERENCES cohamy_crm.tasks(id),status text NOT NULL CHECK(status IN('SUCCEEDED','BLOCKED')),
 error_code text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(rule_id,event_id),CHECK((status='SUCCEEDED')=(task_id IS NOT NULL))
);
CREATE TRIGGER care_rule_runs_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.care_rule_runs
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.care_sla_policies (
 id uuid PRIMARY KEY,name text NOT NULL,care_kind text NOT NULL CHECK(care_kind IN('GENERAL','FOLLOW_UP','SUPPORT','APPROVAL')),
 delay_minutes integer NOT NULL CHECK(delay_minutes BETWEEN 0 AND 525600),
 recipient_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id),enabled boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.care_escalations (
 policy_id uuid NOT NULL REFERENCES cohamy_crm.care_sla_policies(id),task_id uuid NOT NULL REFERENCES cohamy_crm.tasks(id),
 policy_version integer NOT NULL,recipient_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id),
 deadline timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(policy_id,task_id)
);
CREATE TRIGGER care_escalations_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.care_escalations
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.care_handover_previews (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 from_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id),to_id uuid NOT NULL REFERENCES cohamy_crm.memberships(id),
 reason text NOT NULL,manifest jsonb NOT NULL,result jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',completed_at timestamptz
);
CREATE INDEX tasks_search_kind ON cohamy_crm.tasks(care_kind,done_at,due_at);
