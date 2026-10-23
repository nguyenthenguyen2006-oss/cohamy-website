CREATE TABLE cohamy_crm.internal_documents (
  id uuid PRIMARY KEY,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  filename text NOT NULL CHECK (length(filename) BETWEEN 1 AND 180),
  mime text NOT NULL,
  size integer NOT NULL CHECK (size BETWEEN 1 AND 20971520),
  checksum text NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
  content bytea NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
  upload_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (uploaded_by, upload_key),
  CHECK (octet_length(content) = size)
);
CREATE INDEX internal_documents_created_idx ON cohamy_crm.internal_documents(created_at DESC, id);
CREATE INDEX internal_documents_uploader_idx ON cohamy_crm.internal_documents(uploaded_by, created_at);
