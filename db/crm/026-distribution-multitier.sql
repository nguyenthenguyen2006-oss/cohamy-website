-- Migration 026: Multi-tier Distribution, Commercial Pricing & Order Chains
-- Meeting 2026-10-02 Alignment

-- 1. Distribution relations table
CREATE TABLE cohamy_crm.distribution_relations (
  id uuid PRIMARY KEY,
  parent_organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
  child_organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
  network_code text NOT NULL DEFAULT 'DEFAULT',
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
  approved_by uuid REFERENCES cohamy_crm.users(id),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_organization_id <> child_organization_id),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX dist_rel_parent_idx ON cohamy_crm.distribution_relations(parent_organization_id, status);
CREATE INDEX dist_rel_child_idx ON cohamy_crm.distribution_relations(child_organization_id, status);

-- Unique active parent per child in a network (status ACTIVE and no end date)
CREATE UNIQUE INDEX dist_rel_unique_active_parent_idx
  ON cohamy_crm.distribution_relations(child_organization_id, network_code)
  WHERE status = 'ACTIVE' AND ends_at IS NULL;

CREATE TABLE cohamy_crm.distribution_relation_events (
  id uuid PRIMARY KEY,
  relation_id uuid NOT NULL REFERENCES cohamy_crm.distribution_relations(id),
  action text NOT NULL,
  actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Partner tier / type and default flags on organizations
ALTER TABLE cohamy_crm.organizations
  ADD COLUMN IF NOT EXISTS partner_type text NOT NULL DEFAULT 'DEALER_L1'
    CHECK (partner_type IN ('COHAMY','DEALER_L1','DEALER_L2','STORE','END_CUSTOMER')),
  ADD COLUMN IF NOT EXISTS pricing_tier_id uuid REFERENCES cohamy_crm.price_tiers(id),
  ADD COLUMN IF NOT EXISTS credit_enabled boolean NOT NULL DEFAULT false;

-- Backfill existing organizations safely
UPDATE cohamy_crm.organizations
  SET partner_type = CASE
    WHEN kind = 'COHAMY' THEN 'COHAMY'
    WHEN kind = 'CUSTOMER' THEN 'END_CUSTOMER'
    ELSE 'DEALER_L1'
  END
  WHERE partner_type = 'DEALER_L1' AND kind <> 'DEALER';

-- 3. Account discount policies (Layer B: FIXED_PERCENT or QUANTITY_TIER)
CREATE TABLE cohamy_crm.account_discount_policies (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  seller_organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
  buyer_organization_id uuid REFERENCES cohamy_crm.organizations(id),
  tier_id uuid REFERENCES cohamy_crm.price_tiers(id),
  method text NOT NULL CHECK (method IN ('FIXED_PERCENT','QUANTITY_TIER')),
  fixed_percent_bp integer NOT NULL DEFAULT 0 CHECK (fixed_percent_bp BETWEEN 0 AND 10000),
  tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority integer NOT NULL DEFAULT 100,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT','ACTIVE','INACTIVE')),
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
  approved_by uuid REFERENCES cohamy_crm.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX account_discount_lookup_idx
  ON cohamy_crm.account_discount_policies(seller_organization_id, buyer_organization_id, status);

-- 4. Product promotions (Layer A: Promotion per product)
CREATE TABLE cohamy_crm.product_promotions (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  seller_organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
  product_id uuid NOT NULL REFERENCES cohamy_crm.products(id),
  promo_percent_bp integer NOT NULL CHECK (promo_percent_bp BETWEEN 0 AND 10000),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_system_wide boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX product_promotions_active_idx
  ON cohamy_crm.product_promotions(product_id, seller_organization_id, active, starts_at, ends_at);

-- 5. Multi-tier order & request routing additions
ALTER TABLE cohamy_crm.commercial_requests
  ADD COLUMN IF NOT EXISTS seller_organization_id uuid REFERENCES cohamy_crm.organizations(id),
  ADD COLUMN IF NOT EXISTS parent_request_id uuid REFERENCES cohamy_crm.commercial_requests(id),
  ADD COLUMN IF NOT EXISTS route_path jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS current_route_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assigned_approver_org_id uuid REFERENCES cohamy_crm.organizations(id);

ALTER TABLE cohamy_crm.sales_orders
  ADD COLUMN IF NOT EXISTS seller_organization_id uuid REFERENCES cohamy_crm.organizations(id),
  ADD COLUMN IF NOT EXISTS parent_order_id uuid REFERENCES cohamy_crm.sales_orders(id),
  ADD COLUMN IF NOT EXISTS fulfillment_shortage jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 6. Receivables creditor scoping
ALTER TABLE cohamy_crm.receivables
  ADD COLUMN IF NOT EXISTS creditor_organization_id uuid REFERENCES cohamy_crm.organizations(id);

-- Backfill existing receivables creditor to Cohamy
UPDATE cohamy_crm.receivables r
  SET creditor_organization_id = (SELECT id FROM cohamy_crm.organizations WHERE kind = 'COHAMY' LIMIT 1)
  WHERE creditor_organization_id IS NULL;

-- 7. Payment allocations multi-order history
CREATE TABLE IF NOT EXISTS cohamy_crm.payment_allocation_records (
  id uuid PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES cohamy_crm.payment_receipts(id),
  receivable_id uuid NOT NULL REFERENCES cohamy_crm.receivables(id),
  amount numeric(30,0) NOT NULL CHECK (amount > 0),
  allocated_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
  idempotency_key uuid NOT NULL,
  UNIQUE(actor_id, idempotency_key)
);
