-- Migration 033: Split warehouse keeper role into regional roles (Thủ kho HCM = SOUTH, Thủ kho HN = NORTH)
ALTER TABLE cohamy_crm.memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE cohamy_crm.memberships ADD CONSTRAINT memberships_role_check
  CHECK (role IN ('ADMIN','MANAGER','SALES','WAREHOUSE','WAREHOUSE_HCM','WAREHOUSE_HN','ACCOUNTANT','DEALER_OWNER','DEALER_STAFF'));
