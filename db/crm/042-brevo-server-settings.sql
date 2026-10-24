CREATE TABLE cohamy_crm.brevo_settings (
  id text PRIMARY KEY CHECK (id = 'BREVO'),
  key_ciphertext text,
  sender_email text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_by uuid REFERENCES cohamy_crm.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
