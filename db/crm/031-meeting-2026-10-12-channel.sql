-- Migration 031: Meeting 2026-10-12
-- Shareholder anchors (cổ đông / đầu mối), membership levels (Đồng/Bạc/Vàng/Kim cương),
-- scoped product promotions, branch transfer requests, KPI incentive programs,
-- warehouse/partner regions (Hà Nội / Hồ Chí Minh) and invoice recipient.
-- No real percentage, target or stock is seeded: levels start without a discount (DEC-16).

-- 1. Shareholder partner type: a top branch directly under Cohamy.
ALTER TABLE cohamy_crm.organizations DROP CONSTRAINT IF EXISTS organizations_partner_type_check;
ALTER TABLE cohamy_crm.organizations ADD CONSTRAINT organizations_partner_type_check
  CHECK (partner_type IN ('COHAMY','SHAREHOLDER','DEALER_L1','DEALER_L2','STORE','END_CUSTOMER'));

-- 2. Membership levels. A level carries a default account discount used when the
-- partner has no individual policy. NULL percent means "not configured" (no discount).
CREATE TABLE cohamy_crm.membership_levels (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_]{2,40}$'),
  name text NOT NULL,
  rank integer NOT NULL UNIQUE,
  method text NOT NULL DEFAULT 'FIXED_PERCENT' CHECK (method IN ('FIXED_PERCENT','QUANTITY_TIER')),
  fixed_percent_bp integer CHECK (fixed_percent_bp IS NULL OR fixed_percent_bp BETWEEN 0 AND 10000),
  tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  color text NOT NULL DEFAULT '#64748b' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO cohamy_crm.membership_levels(id, code, name, rank, color, description) VALUES
  ('5b1f0d6e-0c1a-4f51-9a01-000000000001', 'BRONZE', 'Đồng', 10, '#b45309', 'Hạng khởi đầu. Doanh nghiệp tự nhập tỷ lệ chiết khấu.'),
  ('5b1f0d6e-0c1a-4f51-9a01-000000000002', 'SILVER', 'Bạc', 20, '#64748b', 'Doanh nghiệp tự nhập tỷ lệ chiết khấu.'),
  ('5b1f0d6e-0c1a-4f51-9a01-000000000003', 'GOLD', 'Vàng', 30, '#ca8a04', 'Doanh nghiệp tự nhập tỷ lệ chiết khấu.'),
  ('5b1f0d6e-0c1a-4f51-9a01-000000000004', 'DIAMOND', 'Kim cương', 40, '#0e7490', 'Hạng cao nhất. Doanh nghiệp tự nhập tỷ lệ chiết khấu.');

ALTER TABLE cohamy_crm.organizations
  ADD COLUMN IF NOT EXISTS membership_level_id uuid REFERENCES cohamy_crm.membership_levels(id),
  ADD COLUMN IF NOT EXISTS region text CHECK (region IS NULL OR region IN ('NORTH','SOUTH'));

CREATE TABLE cohamy_crm.membership_level_events (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
  from_level_id uuid REFERENCES cohamy_crm.membership_levels(id),
  to_level_id uuid REFERENCES cohamy_crm.membership_levels(id),
  source text NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','INCENTIVE')),
  reference_id uuid,
  actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX membership_level_events_org_idx ON cohamy_crm.membership_level_events(organization_id, created_at DESC);

-- 3. Warehouse region: two physical warehouses (Hà Nội = NORTH, Hồ Chí Minh = SOUTH).
ALTER TABLE cohamy_crm.warehouses
  ADD COLUMN IF NOT EXISTS region text CHECK (region IS NULL OR region IN ('NORTH','SOUTH'));

-- 4. Promotion mechanisms: ALL (toàn hệ thống), DESIGNATED (chỉ định đối tác/hạng), QUANTITY (theo số lượng).
ALTER TABLE cohamy_crm.product_promotions
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'ALL' CHECK (scope IN ('ALL','DESIGNATED','QUANTITY')),
  ADD COLUMN IF NOT EXISTS target_organization_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS target_level_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS min_base_quantity numeric(30,6) NOT NULL DEFAULT 0 CHECK (min_base_quantity >= 0),
  ADD COLUMN IF NOT EXISTS badge text CHECK (badge IS NULL OR badge IN ('HOT','NEW','SALE')),
  ADD COLUMN IF NOT EXISTS campaign text NOT NULL DEFAULT '';

-- 5. Branch transfer requests ("xin chuyển cây"): never self-edited, always approved centrally.
CREATE TABLE cohamy_crm.distribution_transfer_requests (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
  from_parent_id uuid REFERENCES cohamy_crm.organizations(id),
  to_parent_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
  requester_organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
  requested_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  decided_by uuid REFERENCES cohamy_crm.users(id),
  decision_reason text NOT NULL DEFAULT '',
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CHECK (organization_id <> to_parent_id),
  UNIQUE (requested_by, idempotency_key)
);
CREATE UNIQUE INDEX distribution_transfer_one_pending_idx
  ON cohamy_crm.distribution_transfer_requests(organization_id) WHERE status = 'PENDING';

-- 6. KPI incentive programs (VD: quý đạt 300 triệu → lên Kim cương / 40% / quà tặng).
CREATE TABLE cohamy_crm.incentive_programs (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  period_type text NOT NULL CHECK (period_type IN ('MONTH','QUARTER','YEAR')),
  period_key text NOT NULL,
  metric text NOT NULL CHECK (metric IN ('REVENUE','QUANTITY')),
  target numeric(30,6) NOT NULL CHECK (target > 0),
  sku text,
  audience text NOT NULL DEFAULT 'ALL' CHECK (audience IN ('ALL','SHAREHOLDER_BRANCH','LEVEL')),
  audience_ref uuid,
  reward_type text NOT NULL CHECK (reward_type IN ('UPGRADE_LEVEL','DISCOUNT_PERCENT','GIFT_AMOUNT')),
  reward_level_id uuid REFERENCES cohamy_crm.membership_levels(id),
  reward_percent_bp integer CHECK (reward_percent_bp IS NULL OR reward_percent_bp BETWEEN 0 AND 10000),
  reward_amount numeric(30,0) CHECK (reward_amount IS NULL OR reward_amount >= 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT','ACTIVE','CLOSED')),
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES cohamy_crm.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (metric <> 'QUANTITY' OR sku IS NOT NULL),
  CHECK (audience = 'ALL' OR audience_ref IS NOT NULL),
  CHECK (reward_type <> 'UPGRADE_LEVEL' OR reward_level_id IS NOT NULL),
  CHECK (reward_type <> 'DISCOUNT_PERCENT' OR reward_percent_bp IS NOT NULL),
  CHECK (reward_type <> 'GIFT_AMOUNT' OR reward_amount IS NOT NULL)
);

CREATE TABLE cohamy_crm.incentive_awards (
  id uuid PRIMARY KEY,
  program_id uuid NOT NULL REFERENCES cohamy_crm.incentive_programs(id),
  organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
  achieved numeric(30,6) NOT NULL,
  reward jsonb NOT NULL,
  actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, organization_id)
);

-- 7. Invoice recipient: issue the VAT invoice to the buyer itself or to another trading company.
ALTER TABLE cohamy_crm.sales_orders
  ADD COLUMN IF NOT EXISTS invoice_recipient jsonb NOT NULL DEFAULT '{}'::jsonb;
