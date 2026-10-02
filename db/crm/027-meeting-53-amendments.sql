-- Migration 027: Meeting 53 Amendments
-- 1. Deal ID sequence and table
CREATE SEQUENCE IF NOT EXISTS cohamy_crm.deal_code_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS cohamy_crm.deals (
  id uuid PRIMARY KEY,
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  customer_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
  seller_organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
  management_owner_id uuid REFERENCES cohamy_crm.users(id),
  management_team_id uuid,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','WON','LOST','CLOSED')),
  notes text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deals_customer_idx ON cohamy_crm.deals(customer_id);
CREATE INDEX IF NOT EXISTS deals_seller_idx ON cohamy_crm.deals(seller_organization_id);

-- 2. Add deal_id to transactions and documents
ALTER TABLE cohamy_crm.commercial_requests ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES cohamy_crm.deals(id);
ALTER TABLE cohamy_crm.quotations ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES cohamy_crm.deals(id);
ALTER TABLE cohamy_crm.sales_orders ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES cohamy_crm.deals(id);
ALTER TABLE cohamy_crm.deliveries ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES cohamy_crm.deals(id);
ALTER TABLE cohamy_crm.receivables ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES cohamy_crm.deals(id);
ALTER TABLE cohamy_crm.payment_receipts ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES cohamy_crm.deals(id);

-- 3. Management relations (Hierarchy for ownership, oversight & approval)
CREATE TABLE IF NOT EXISTS cohamy_crm.management_relations (
  id uuid PRIMARY KEY,
  parent_entity_id uuid NOT NULL,
  child_entity_id uuid NOT NULL,
  entity_type text NOT NULL DEFAULT 'ORGANIZATION' CHECK (entity_type IN ('ORGANIZATION','USER','TEAM')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_entity_id <> child_entity_id),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS mgmt_rel_parent_idx ON cohamy_crm.management_relations(parent_entity_id, status);
CREATE INDEX IF NOT EXISTS mgmt_rel_child_idx ON cohamy_crm.management_relations(child_entity_id, status);

-- 4. Approval route snapshot in commercial requests
ALTER TABLE cohamy_crm.commercial_requests
  ADD COLUMN IF NOT EXISTS approval_route_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS approval_policy_version integer NOT NULL DEFAULT 1;

-- 5. Downstream discount ceiling policies & exceptions
CREATE TABLE IF NOT EXISTS cohamy_crm.discount_ceiling_policies (
  id uuid PRIMARY KEY,
  seller_organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
  enabled boolean NOT NULL DEFAULT true,
  comparison_basis text NOT NULL DEFAULT 'RATE_OR_FLOOR' CHECK (comparison_basis IN ('RATE_OR_FLOOR','RATE_ONLY','FLOOR_PRICE_ONLY')),
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cohamy_crm.discount_ceiling_exceptions (
  id uuid PRIMARY KEY,
  seller_organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
  buyer_organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
  sku text NOT NULL,
  requested_rate numeric(8,4) NOT NULL,
  approved_rate numeric(8,4),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  requested_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
  approved_by uuid REFERENCES cohamy_crm.users(id),
  reason text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Combination modes for pricing Layer A & Layer B
ALTER TABLE cohamy_crm.account_discount_policies
  ADD COLUMN IF NOT EXISTS combination_mode text NOT NULL DEFAULT 'SEQUENTIAL_STACK'
    CHECK (combination_mode IN ('SEQUENTIAL_STACK','EXCLUSIVE','BEST_BENEFIT')),
  ADD COLUMN IF NOT EXISTS exclusive_priority text DEFAULT 'ACCOUNT_DISCOUNT'
    CHECK (exclusive_priority IS NULL OR exclusive_priority IN ('ACCOUNT_DISCOUNT','PRODUCT_PROMOTION'));

-- 7. Provisional reservations on submit with TTL
ALTER TABLE cohamy_crm.inventory_reservations
  ALTER COLUMN order_id DROP NOT NULL,
  ALTER COLUMN order_version_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES cohamy_crm.commercial_requests(id),
  ADD COLUMN IF NOT EXISTS request_version_id uuid REFERENCES cohamy_crm.commercial_request_versions(id),
  ADD COLUMN IF NOT EXISTS reservation_type text NOT NULL DEFAULT 'CONFIRMED'
    CHECK (reservation_type IN ('PROVISIONAL','CONFIRMED')),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS inventory_reservations_req_idx
  ON cohamy_crm.inventory_reservations(request_id, status);

-- 8. Enhanced payment receipts fields
ALTER TABLE cohamy_crm.payment_receipts
  ADD COLUMN IF NOT EXISTS payer_organization_id uuid REFERENCES cohamy_crm.organizations(id),
  ADD COLUMN IF NOT EXISTS payee_organization_id uuid REFERENCES cohamy_crm.organizations(id),
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'BANK_TRANSFER',
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES cohamy_crm.users(id),
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- 9. Expand private documents and notifications entity types
ALTER TABLE cohamy_crm.private_documents DROP CONSTRAINT IF EXISTS private_documents_entity_type_check;
ALTER TABLE cohamy_crm.private_documents ADD CONSTRAINT private_documents_entity_type_check
  CHECK (entity_type IN ('partner','order','ticket','library','visit','payment','deal'));

ALTER TABLE cohamy_crm.notifications DROP CONSTRAINT IF EXISTS notifications_entity_type_check;
ALTER TABLE cohamy_crm.notifications ADD CONSTRAINT notifications_entity_type_check
  CHECK (entity_type IN ('partner','order','product','account','ticket','commercial-request','sales-order','delivery','return-request','receivable','payment','cash-request','report','deal','request'));
