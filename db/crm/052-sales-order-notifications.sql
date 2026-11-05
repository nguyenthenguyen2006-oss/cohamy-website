-- No historical ownership/order backfill. Capture only newly placed Portal orders.
CREATE TABLE cohamy_crm.buyer_order_sales (
 order_id uuid PRIMARY KEY REFERENCES cohamy_crm.buyer_orders(id),
 customer_organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 sales_membership_id uuid REFERENCES cohamy_crm.memberships(id),sales_user_id uuid REFERENCES cohamy_crm.users(id),
 sales_name text NOT NULL DEFAULT '',sales_email text NOT NULL DEFAULT '',source text NOT NULL,
 captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX buyer_order_sales_sales_idx ON cohamy_crm.buyer_order_sales(sales_membership_id,captured_at);
CREATE TRIGGER buyer_order_sales_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.buyer_order_sales
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
ALTER TABLE cohamy_crm.notifications DROP CONSTRAINT notifications_entity_type_check;
ALTER TABLE cohamy_crm.notifications ADD CONSTRAINT notifications_entity_type_check CHECK(entity_type IN(
 'partner','order','product','account','ticket','commercial-request','sales-order','delivery','return-request','receivable','payment','cash-request','report','deal','request','factory-invoice','warehouse-reconciliation','order-clearance','vat-invoice','warehouse-handover','buyer-order','sales-customer'));
CREATE TABLE cohamy_crm.sales_notification_events (
 notification_id uuid PRIMARY KEY REFERENCES cohamy_crm.notifications(id),
 user_id uuid NOT NULL REFERENCES cohamy_crm.users(id),buyer_order_id uuid REFERENCES cohamy_crm.buyer_orders(id),
 customer_organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),
 event text NOT NULL,event_identity text NOT NULL,version integer NOT NULL CHECK(version>0),
 href text NOT NULL,priority text NOT NULL CHECK(priority IN('LOW','NORMAL','HIGH')),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,event_identity)
);
CREATE INDEX sales_notifications_order ON cohamy_crm.sales_notification_events(buyer_order_id,event,created_at);
CREATE INDEX sales_notifications_customer ON cohamy_crm.sales_notification_events(customer_organization_id,created_at);
CREATE TRIGGER sales_notification_events_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.sales_notification_events
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE INDEX buyer_orders_customer_created ON cohamy_crm.buyer_orders(organization_id,created_at DESC,id);
CREATE INDEX buyer_orders_warehouse_status ON cohamy_crm.buyer_orders(warehouse_id,status,created_at DESC,id);
CREATE INDEX sales_mail_event_receipts ON cohamy_crm.document_mail_outbox(entity_id,event,event_key);
