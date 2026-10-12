-- Migration 032: Remove out-of-scope features per meeting 2026-10-12 review
-- Removes:
-- 1. Sample management (cohamy_crm.sample_events, sample_allocations, sample_issue_lines, sample_issues)
-- 2. Portal draft cart (cohamy_crm.dealer_carts)
-- 3. Portal saved address book (cohamy_crm.dealer_addresses)
-- Note: Inventory movements/documents created historically by sample issues remain in the stock ledger.

DROP TABLE IF EXISTS cohamy_crm.sample_events CASCADE;
DROP TABLE IF EXISTS cohamy_crm.sample_allocations CASCADE;
DROP TABLE IF EXISTS cohamy_crm.sample_issue_lines CASCADE;
DROP TABLE IF EXISTS cohamy_crm.sample_issues CASCADE;
DROP TABLE IF EXISTS cohamy_crm.dealer_carts CASCADE;
DROP TABLE IF EXISTS cohamy_crm.dealer_addresses CASCADE;
