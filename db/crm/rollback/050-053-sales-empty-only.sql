-- MANUAL OWNER-ONLY rollback, never run by migrate().
-- Use only with the application stopped and a verified backup. Once the feature
-- has business history, keep the additive schema and follow the source rollback
-- runbook; this script deliberately refuses to detach non-empty history.
BEGIN;
LOCK TABLE cohamy_crm.migrations IN EXCLUSIVE MODE;
DO $$
DECLARE t text; n bigint;
BEGIN
 IF to_regnamespace('cohamy_sales_20261030_archive') IS NOT NULL THEN
  RAISE EXCEPTION 'SALES_ROLLBACK_ARCHIVE_ALREADY_EXISTS';
 END IF;
 FOREACH t IN ARRAY ARRAY[
  'sales_referral_codes','customer_sales_ownership','customer_sales_assignment_history',
  'sales_customer_actions','sales_registration_limits','sales_customer_review_requests',
  'buyer_fulfillment_state','buyer_fulfillment_events','buyer_fulfillment_actions',
  'buyer_order_sales','sales_notification_events','buyer_quote_price_checks'
 ] LOOP
  EXECUTE format('LOCK TABLE cohamy_crm.%I IN ACCESS EXCLUSIVE MODE',t);
  EXECUTE format('SELECT count(*) FROM cohamy_crm.%I',t) INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'SALES_ROLLBACK_HAS_HISTORY: %',t; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM cohamy_crm.buyer_orders WHERE quote_fee_amount<>0)
 OR EXISTS(SELECT 1 FROM cohamy_crm.notifications WHERE entity_type IN('buyer-order','sales-customer'))
 OR EXISTS(SELECT 1 FROM cohamy_crm.document_mail_rules WHERE event LIKE 'buyer.order.%' OR event LIKE 'customer.%')
 OR EXISTS(SELECT 1 FROM cohamy_crm.document_mail_outbox WHERE event LIKE 'buyer.order.%' OR event LIKE 'customer.%') THEN
  RAISE EXCEPTION 'SALES_ROLLBACK_HAS_RELATED_DATA';
 END IF;
 CREATE SCHEMA cohamy_sales_20261030_archive;
 FOREACH t IN ARRAY ARRAY[
  'sales_referral_codes','customer_sales_ownership','customer_sales_assignment_history',
  'sales_customer_actions','sales_registration_limits','sales_customer_review_requests',
  'buyer_fulfillment_state','buyer_fulfillment_events','buyer_fulfillment_actions',
  'buyer_order_sales','sales_notification_events','buyer_quote_price_checks'
 ] LOOP
  EXECUTE format('ALTER TABLE cohamy_crm.%I SET SCHEMA cohamy_sales_20261030_archive',t);
 END LOOP;
 ALTER FUNCTION cohamy_crm.preserve_buyer_fulfillment_policy() SET SCHEMA cohamy_sales_20261030_archive;
 ALTER FUNCTION cohamy_crm.validate_customer_sales_owner() SET SCHEMA cohamy_sales_20261030_archive;
 ALTER TABLE cohamy_crm.buyer_orders RENAME COLUMN quote_fee_amount TO sales_20261030_archived_fee;
 ALTER INDEX cohamy_crm.buyer_orders_customer_created RENAME TO sales_20261030_archived_customer_created;
 ALTER INDEX cohamy_crm.buyer_orders_warehouse_status RENAME TO sales_20261030_archived_warehouse_status;
 ALTER INDEX cohamy_crm.sales_mail_event_receipts RENAME TO sales_20261030_archived_mail_receipts;
 DELETE FROM cohamy_crm.migrations WHERE name IN(
  '050-sales-customer-ownership.sql','051-buyer-fulfillment.sql',
  '052-sales-order-notifications.sql','053-buyer-quote-price-checks.sql'
 );
END $$;
COMMIT;
