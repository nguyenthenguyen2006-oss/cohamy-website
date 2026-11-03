-- Add the native transfer event type without rewriting existing notices or stock.
ALTER TABLE cohamy_crm.notifications DROP CONSTRAINT notifications_entity_type_check;
ALTER TABLE cohamy_crm.notifications ADD CONSTRAINT notifications_entity_type_check CHECK(entity_type IN(
 'partner','order','product','account','ticket','commercial-request','sales-order','delivery','return-request','receivable','payment','cash-request','report','deal','request','factory-invoice','warehouse-reconciliation','order-clearance','vat-invoice','warehouse-handover','buyer-order','sales-customer','inventory-transfer'));
