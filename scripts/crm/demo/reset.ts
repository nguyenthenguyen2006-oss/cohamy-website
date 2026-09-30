import 'server-only';
import fs from 'node:fs/promises';
import { database, type Sql } from '@/lib/crm/db';
import { assertConnectedDemoPostgresDatabase, assertDemoPostgresUrl, DEMO_DATABASE_NAME } from '@/lib/crm/demo-database-guard';
import { DEMO_CREDENTIALS_FILE } from './constants';

/**
 * Validates that the active database target strictly belongs to an isolated demo database.
 * Rejects execution on production databases or non-demo environments.
 */
export function assertDemoDatabaseTarget(options?: {
  environment?: string;
  databaseMode?: string;
  databaseUrl?: string;
  localDataDir?: string;
}): void {
  const env = options?.environment ?? process.env.CRM_ENVIRONMENT;
  if (env !== 'DEMO') {
    throw new Error(
      `DEMO_RESET_DATABASE_NOT_ALLOWED: Target environment is '${env}'. Demo reset is strictly permitted only when CRM_ENVIRONMENT='DEMO'.`
    );
  }

  const mode = options?.databaseMode ?? process.env.CRM_DATABASE_MODE ?? 'pglite';

  if (mode === 'postgres' || mode === 'pg') {
    const urlStr = options?.databaseUrl ?? process.env.CRM_DATABASE_URL;
    if (!urlStr) {
      throw new Error('DEMO_RESET_DATABASE_NOT_ALLOWED: CRM_DATABASE_URL is not configured for postgres mode.');
    }

    let url: URL;
    try {
      url = new URL(urlStr);
    } catch {
      throw new Error('DEMO_RESET_DATABASE_NOT_ALLOWED: Invalid CRM_DATABASE_URL connection string format.');
    }

    const dbName = url.pathname.replace(/^\//, '').toLowerCase();

    // Explicit blacklist of production database names
    const forbiddenNames = ['cohamy', 'cohamy_crm', 'cohamy_prod', 'cohamy_production', 'production', 'cohamy_main'];
    if (forbiddenNames.includes(dbName)) {
      throw new Error(
        `DEMO_RESET_DATABASE_NOT_ALLOWED: CRITICAL SAFETY VIOLATION! Refusing to reset protected production database '${dbName}'.`
      );
    }

    // An arbitrary database name containing "demo" is not sufficient protection.
    if (dbName !== DEMO_DATABASE_NAME) {
      throw new Error(
        `DEMO_RESET_DATABASE_NOT_ALLOWED: Database '${dbName}' is not in the demo allowlist. Expected ${DEMO_DATABASE_NAME}.`
      );
    }
    try { assertDemoPostgresUrl(urlStr); }
    catch { throw new Error('DEMO_RESET_DATABASE_NOT_ALLOWED: Invalid dedicated PostgreSQL demo URL.'); }
  } else if (mode === 'pglite') {
    const localDir = options?.localDataDir ?? process.env.CRM_LOCAL_DATA_DIR ?? '.local/crm-demo';
    if (!localDir.toLowerCase().includes('demo')) {
      throw new Error(
        `DEMO_RESET_DATABASE_NOT_ALLOWED: Local storage path '${localDir}' is not in the demo allowlist.`
      );
    }
  } else {
    throw new Error(`DEMO_RESET_DATABASE_NOT_ALLOWED: Unsupported CRM_DATABASE_MODE '${mode}'.`);
  }
}

export function sanitizeDatabaseUrl(urlStr?: string): string {
  if (!urlStr) return '';
  try {
    const url = new URL(urlStr);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return '[REDACTED_URL]';
  }
}

/**
 * Resets ONLY demo batch entities within an explicit single transaction.
 * Strictly avoids DISABLE TRIGGER ALL, does NOT change session_replication_role,
 * and rolls back completely on any error.
 */
export async function resetDemoData(options?: { preserveCredentialsFile?: boolean }): Promise<{ deletedBatch: string; timestamp: string }> {
  // 1. Strict allowlist validation before touching the database
  assertDemoDatabaseTarget();

  const mode = process.env.CRM_DATABASE_MODE ?? 'pglite';
  const targetDesc = mode === 'pglite' ? (process.env.CRM_LOCAL_DATA_DIR ?? '.local/crm-demo') : sanitizeDatabaseUrl(process.env.CRM_DATABASE_URL);
  console.log(`[DEMO RESET] Initializing targeted demo reset on [${mode}] (${targetDesc})...`);

  const db = await database();
  if (mode === 'postgres' || mode === 'pg') {
    await assertConnectedDemoPostgresDatabase(sql => db.query<{ name: string }>(sql));
  }

  // Execute all deletions strictly inside a single transaction
  await db.transaction(async (sql: Sql) => {
    // Modify deny_audit_mutation inside this transaction only to allow demo cleanup
    // when cohamy.demo_reset is explicitly 'on'.
    // Zero trigger disabling (triggers remain fully enabled and active).
    // Zero session_replication_role changes (never changes replication role).
    await sql.exec(`
      CREATE OR REPLACE FUNCTION cohamy_crm.deny_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF current_setting('cohamy.demo_reset', true) = 'on' THEN
          RETURN OLD;
        END IF;
        RAISE EXCEPTION 'AUDIT_APPEND_ONLY';
      END;
      $$;
    `);
    await sql.exec("SET LOCAL cohamy.demo_reset = 'on';");

    // Helper to run query with error bubbling (no swallowing!)
    const runDelete = async (label: string, query: string, params: unknown[] = []) => {
      await sql.query(query, params);
    };

    console.log('[DEMO RESET] Purging demo audit and immutable events...');
    await runDelete(
      'audit_events',
      `DELETE FROM cohamy_crm.audit_events
       WHERE actor_id IN (SELECT id FROM cohamy_crm.users WHERE email LIKE '%@demo.cohamy.invalid')
          OR entity_id IN (SELECT id::text FROM cohamy_crm.organizations WHERE code LIKE 'DEMO_%' OR name LIKE 'DEMO · %')
          OR entity_id IN (SELECT id::text FROM cohamy_crm.products WHERE sku LIKE 'DEMO-%')`
    );

    console.log('[DEMO RESET] Purging demo documents, versions, reads...');
    const demoOrgSubquery = `(SELECT id FROM cohamy_crm.organizations WHERE code LIKE 'DEMO_%' OR name LIKE 'DEMO · %')`;
    const demoUserSubquery = `(SELECT id FROM cohamy_crm.users WHERE email LIKE '%@demo.cohamy.invalid')`;

    await runDelete(
      'document_reads',
      `DELETE FROM cohamy_crm.document_reads 
       WHERE user_id IN ${demoUserSubquery}
          OR version_id IN (
            SELECT v.id FROM cohamy_crm.document_versions v 
            JOIN cohamy_crm.private_documents d ON d.id = v.document_id 
            WHERE (d.entity_type = 'partner' AND d.entity_id IN ${demoOrgSubquery})
               OR d.created_by IN ${demoUserSubquery}
          )`
    );
    await runDelete(
      'document_versions',
      `DELETE FROM cohamy_crm.document_versions 
       WHERE document_id IN (
         SELECT d.id FROM cohamy_crm.private_documents d 
         WHERE (d.entity_type = 'partner' AND d.entity_id IN ${demoOrgSubquery})
            OR d.created_by IN ${demoUserSubquery}
       )`
    );
    await runDelete(
      'private_documents',
      `DELETE FROM cohamy_crm.private_documents 
       WHERE (entity_type = 'partner' AND entity_id IN ${demoOrgSubquery})
          OR created_by IN ${demoUserSubquery}`
    );

    console.log('[DEMO RESET] Purging demo support tickets, library, notifications...');
    await runDelete(
      'support_messages',
      `DELETE FROM cohamy_crm.support_messages 
       WHERE ticket_id IN (
         SELECT id FROM cohamy_crm.support_tickets 
         WHERE organization_id IN ${demoOrgSubquery}
       )`
    );
    await runDelete(
      'support_tickets',
      `DELETE FROM cohamy_crm.support_tickets 
       WHERE organization_id IN ${demoOrgSubquery}`
    );
    await runDelete('partner_library', `DELETE FROM cohamy_crm.partner_library WHERE title LIKE 'DEMO · %'`);
    await runDelete(
      'notifications',
      `DELETE FROM cohamy_crm.notifications 
       WHERE user_id IN ${demoUserSubquery}`
    );
    await runDelete(
      'notification_outbox',
      `DELETE FROM cohamy_crm.notification_outbox 
       WHERE recipient IN (SELECT id::text FROM cohamy_crm.users WHERE email LIKE '%@demo.cohamy.invalid')
          OR recipient LIKE '%@demo.cohamy.invalid'`
    );
    await runDelete('workspace_bookmarks', `DELETE FROM cohamy_crm.workspace_bookmarks WHERE user_id IN ${demoUserSubquery}`);
    await runDelete('workspace_drafts', `DELETE FROM cohamy_crm.workspace_drafts WHERE user_id IN ${demoUserSubquery}`);
    await runDelete('workspace_preferences', `DELETE FROM cohamy_crm.workspace_preferences WHERE user_id IN ${demoUserSubquery}`);
    await runDelete('saved_filters', `DELETE FROM cohamy_crm.saved_filters WHERE user_id IN ${demoUserSubquery}`);
    await runDelete('dealer_carts', `DELETE FROM cohamy_crm.dealer_carts WHERE organization_id IN ${demoOrgSubquery} OR user_id IN ${demoUserSubquery}`);
    await runDelete('dealer_addresses', `DELETE FROM cohamy_crm.dealer_addresses WHERE organization_id IN ${demoOrgSubquery}`);

    console.log('[DEMO RESET] Purging demo opportunities, visits, care, tasks...');
    await runDelete(
      'opportunity_history',
      `DELETE FROM cohamy_crm.opportunity_history 
       WHERE opportunity_id IN (
         SELECT id FROM cohamy_crm.opportunities 
         WHERE organization_id IN ${demoOrgSubquery}
       )`
    );
    await runDelete(
      'opportunities',
      `DELETE FROM cohamy_crm.opportunities 
       WHERE organization_id IN ${demoOrgSubquery}`
    );
    await runDelete(
      'partner_visits',
      `DELETE FROM cohamy_crm.partner_visits 
       WHERE organization_id IN ${demoOrgSubquery}`
    );
    await runDelete(
      'activities',
      `DELETE FROM cohamy_crm.activities 
       WHERE (entity_type = 'partner' AND entity_id IN ${demoOrgSubquery})
          OR actor_id IN ${demoUserSubquery}`
    );
    await runDelete(
      'tasks',
      `DELETE FROM cohamy_crm.tasks 
       WHERE (entity_type = 'partner' AND entity_id IN ${demoOrgSubquery})
          OR created_by IN ${demoUserSubquery}
          OR assignee_id IN (SELECT id FROM cohamy_crm.memberships WHERE user_id IN ${demoUserSubquery})
          OR title LIKE 'DEMO · %'`
    );
    await runDelete(
      'contact_preferences',
      `DELETE FROM cohamy_crm.contact_preferences 
       WHERE organization_id IN ${demoOrgSubquery}`
    );
    await runDelete(
      'partner_tags',
      `DELETE FROM cohamy_crm.partner_tags 
       WHERE organization_id IN ${demoOrgSubquery}`
    );

    console.log('[DEMO RESET] Purging demo sample management...');
    const demoSampleIssueSubquery = `(SELECT id FROM cohamy_crm.sample_issues WHERE organization_id IN ${demoOrgSubquery})`;

    await runDelete(
      'sample_events',
      `DELETE FROM cohamy_crm.sample_events WHERE issue_id IN ${demoSampleIssueSubquery}`
    );
    await runDelete(
      'sample_allocations',
      `DELETE FROM cohamy_crm.sample_allocations WHERE line_id IN (SELECT id FROM cohamy_crm.sample_issue_lines WHERE issue_id IN ${demoSampleIssueSubquery})`
    );
    await runDelete(
      'sample_issue_lines',
      `DELETE FROM cohamy_crm.sample_issue_lines WHERE issue_id IN ${demoSampleIssueSubquery}`
    );
    await runDelete(
      'sample_issues',
      `DELETE FROM cohamy_crm.sample_issues WHERE organization_id IN ${demoOrgSubquery}`
    );

    console.log('[DEMO RESET] Purging demo consignment...');
    const demoAgreementSubquery = `(SELECT id FROM cohamy_crm.consignment_agreements WHERE organization_id IN ${demoOrgSubquery} OR code LIKE 'HD-DEMO-%')`;
    const demoConsignmentVersionSubquery = `(SELECT id FROM cohamy_crm.consignment_agreement_versions WHERE agreement_id IN ${demoAgreementSubquery})`;
    const demoConsignmentSettlementSubquery = `(SELECT id FROM cohamy_crm.consignment_settlements WHERE agreement_version_id IN ${demoConsignmentVersionSubquery} OR code LIKE 'ST-DEMO-%')`;
    const demoConsignmentSaleReportSubquery = `(SELECT id FROM cohamy_crm.consignment_sale_reports WHERE agreement_version_id IN ${demoConsignmentVersionSubquery} OR code LIKE 'BC-DEMO-%')`;
    const demoConsignmentShipmentSubquery = `(SELECT id FROM cohamy_crm.consignment_shipments WHERE agreement_version_id IN ${demoConsignmentVersionSubquery} OR code LIKE 'KG-DEMO-%')`;
    const demoConsignmentReturnSubquery = `(SELECT id FROM cohamy_crm.consignment_returns WHERE agreement_version_id IN ${demoConsignmentVersionSubquery} OR code LIKE 'TRA-DEMO-%')`;

    await runDelete('consignment_return_lines', `DELETE FROM cohamy_crm.consignment_return_lines WHERE return_id IN ${demoConsignmentReturnSubquery}`);
    await runDelete('consignment_returns', `DELETE FROM cohamy_crm.consignment_returns WHERE id IN ${demoConsignmentReturnSubquery}`);
    await runDelete('consignment_replenishments', `DELETE FROM cohamy_crm.consignment_replenishments WHERE agreement_version_id IN ${demoConsignmentVersionSubquery}`);
    await runDelete('consignment_settlement_reports', `DELETE FROM cohamy_crm.consignment_settlement_reports WHERE settlement_id IN ${demoConsignmentSettlementSubquery} OR report_id IN ${demoConsignmentSaleReportSubquery}`);
    await runDelete('consignment_settlement_events', `DELETE FROM cohamy_crm.consignment_settlement_events WHERE settlement_id IN ${demoConsignmentSettlementSubquery}`);
    await runDelete('consignment_settlements', `DELETE FROM cohamy_crm.consignment_settlements WHERE id IN ${demoConsignmentSettlementSubquery}`);
    await runDelete('consignment_sale_lines', `DELETE FROM cohamy_crm.consignment_sale_lines WHERE report_id IN ${demoConsignmentSaleReportSubquery}`);
    await runDelete('consignment_sale_events', `DELETE FROM cohamy_crm.consignment_sale_events WHERE report_id IN ${demoConsignmentSaleReportSubquery}`);
    await runDelete('consignment_sale_reports', `DELETE FROM cohamy_crm.consignment_sale_reports WHERE id IN ${demoConsignmentSaleReportSubquery}`);
    await runDelete('consignment_sale_previews', `DELETE FROM cohamy_crm.consignment_sale_previews WHERE agreement_id IN ${demoAgreementSubquery} OR user_id IN ${demoUserSubquery}`);
    await runDelete('consignment_receipts', `DELETE FROM cohamy_crm.consignment_receipts WHERE shipment_id IN ${demoConsignmentShipmentSubquery}`);
    await runDelete('consignment_batches', `DELETE FROM cohamy_crm.consignment_batches WHERE organization_id IN ${demoOrgSubquery} OR shipment_id IN ${demoConsignmentShipmentSubquery}`);
    await runDelete('consignment_shipments', `DELETE FROM cohamy_crm.consignment_shipments WHERE id IN ${demoConsignmentShipmentSubquery}`);
    await runDelete('consignment_acceptances', `DELETE FROM cohamy_crm.consignment_acceptances WHERE version_id IN ${demoConsignmentVersionSubquery}`);
    await runDelete('consignment_agreements_break_cycle', `UPDATE cohamy_crm.consignment_agreements SET current_version_id = NULL WHERE organization_id IN ${demoOrgSubquery} OR id IN ${demoAgreementSubquery}`);
    await runDelete('consignment_agreement_versions', `DELETE FROM cohamy_crm.consignment_agreement_versions WHERE agreement_id IN ${demoAgreementSubquery}`);
    await runDelete('consignment_events', `DELETE FROM cohamy_crm.consignment_events WHERE actor_id IN ${demoUserSubquery} OR entity_id IN ${demoAgreementSubquery}`);
    await runDelete('consignment_actions', `DELETE FROM cohamy_crm.consignment_actions WHERE actor_id IN ${demoUserSubquery}`);
    await runDelete('consignment_agreements', `DELETE FROM cohamy_crm.consignment_agreements WHERE id IN ${demoAgreementSubquery}`);

    console.log('[DEMO RESET] Purging demo procurement & suppliers...');
    const demoPRsubquery = `(SELECT id FROM cohamy_crm.purchase_requests WHERE requester_id IN ${demoUserSubquery} OR code LIKE 'PR-DEMO-%')`;
    const demoRFQsubquery = `(SELECT id FROM cohamy_crm.supplier_rfqs WHERE request_id IN ${demoPRsubquery} OR actor_id IN ${demoUserSubquery} OR code LIKE 'RFQ-DEMO-%')`;
    const demoPOsubquery = `(SELECT id FROM cohamy_crm.purchase_orders WHERE supplier_id IN ${demoOrgSubquery} OR request_id IN ${demoPRsubquery} OR rfq_id IN ${demoRFQsubquery} OR code LIKE 'PO-DEMO-%')`;
    const demoReceiptSubquery = `(SELECT id FROM cohamy_crm.goods_receipts WHERE order_id IN ${demoPOsubquery} OR code LIKE 'GR-DEMO-%')`;
    const demoReceiptLineSubquery = `(SELECT id FROM cohamy_crm.goods_receipt_lines WHERE receipt_id IN ${demoReceiptSubquery})`;
    const demoClaimSubquery = `(SELECT id FROM cohamy_crm.supplier_claims WHERE receipt_line_id IN ${demoReceiptLineSubquery} OR actor_id IN ${demoUserSubquery} OR code LIKE 'SC-DEMO-%')`;
    const demoPayableSubquery = `(SELECT id FROM cohamy_crm.payables WHERE supplier_id IN ${demoOrgSubquery} OR receipt_id IN ${demoReceiptSubquery} OR code LIKE 'AP-DEMO-%')`;
    const demoSupplierPaymentSubquery = `(SELECT id FROM cohamy_crm.supplier_payments WHERE supplier_id IN ${demoOrgSubquery} OR requester_id IN ${demoUserSubquery} OR code LIKE 'SP-DEMO-%')`;

    await runDelete('supplier_payment_allocations', `DELETE FROM cohamy_crm.supplier_payment_allocations WHERE payment_id IN ${demoSupplierPaymentSubquery} OR payable_id IN ${demoPayableSubquery}`);
    await runDelete('supplier_payments', `DELETE FROM cohamy_crm.supplier_payments WHERE id IN ${demoSupplierPaymentSubquery}`);
    await runDelete('payable_events', `DELETE FROM cohamy_crm.payable_events WHERE payable_id IN ${demoPayableSubquery}`);
    await runDelete('payables', `DELETE FROM cohamy_crm.payables WHERE id IN ${demoPayableSubquery}`);
    await runDelete('supplier_claim_events', `DELETE FROM cohamy_crm.supplier_claim_events WHERE claim_id IN ${demoClaimSubquery}`);
    await runDelete('supplier_claims', `DELETE FROM cohamy_crm.supplier_claims WHERE id IN ${demoClaimSubquery}`);
    await runDelete('goods_receipt_lines', `DELETE FROM cohamy_crm.goods_receipt_lines WHERE receipt_id IN ${demoReceiptSubquery}`);
    await runDelete('goods_receipts', `DELETE FROM cohamy_crm.goods_receipts WHERE id IN ${demoReceiptSubquery}`);
    await runDelete('purchase_order_amendments', `DELETE FROM cohamy_crm.purchase_order_amendments WHERE order_id IN ${demoPOsubquery}`);
    await runDelete('purchase_order_events', `DELETE FROM cohamy_crm.purchase_order_events WHERE order_id IN ${demoPOsubquery}`);
    await runDelete('purchase_order_lines', `DELETE FROM cohamy_crm.purchase_order_lines WHERE order_id IN ${demoPOsubquery}`);
    await runDelete('purchase_orders', `DELETE FROM cohamy_crm.purchase_orders WHERE id IN ${demoPOsubquery}`);
    await runDelete('supplier_quotes', `DELETE FROM cohamy_crm.supplier_quotes WHERE supplier_id IN ${demoOrgSubquery} OR rfq_id IN ${demoRFQsubquery}`);
    await runDelete('supplier_rfq_dispatches', `DELETE FROM cohamy_crm.supplier_rfq_dispatches WHERE supplier_id IN ${demoOrgSubquery} OR rfq_id IN ${demoRFQsubquery}`);
    await runDelete('supplier_rfq_versions', `DELETE FROM cohamy_crm.supplier_rfq_versions WHERE rfq_id IN ${demoRFQsubquery}`);
    await runDelete('supplier_rfqs', `DELETE FROM cohamy_crm.supplier_rfqs WHERE id IN ${demoRFQsubquery}`);
    await runDelete('purchase_request_events', `DELETE FROM cohamy_crm.purchase_request_events WHERE request_id IN ${demoPRsubquery}`);
    await runDelete('purchase_request_lines', `DELETE FROM cohamy_crm.purchase_request_lines WHERE request_id IN ${demoPRsubquery}`);
    await runDelete('purchase_requests', `DELETE FROM cohamy_crm.purchase_requests WHERE id IN ${demoPRsubquery}`);
    await runDelete('supplier_products', `DELETE FROM cohamy_crm.supplier_products WHERE organization_id IN ${demoOrgSubquery}`);
    await runDelete('supplier_profiles', `DELETE FROM cohamy_crm.supplier_profiles WHERE organization_id IN ${demoOrgSubquery}`);
    await runDelete('procurement_actions', `DELETE FROM cohamy_crm.procurement_actions WHERE actor_id IN ${demoUserSubquery}`);

    console.log('[DEMO RESET] Purging demo finance, debt, and bank transactions...');
    await runDelete('payment_reminders', `DELETE FROM cohamy_crm.payment_reminders WHERE receivable_id IN (SELECT id FROM cohamy_crm.receivables WHERE organization_id IN ${demoOrgSubquery} OR code LIKE 'CN-DEMO-%') OR recipient LIKE '%@demo.cohamy.invalid'`);
    await runDelete('bank_match_reversals', `DELETE FROM cohamy_crm.bank_match_reversals WHERE match_id IN (SELECT id FROM cohamy_crm.bank_transaction_matches WHERE transaction_id IN (SELECT id FROM cohamy_crm.bank_transactions WHERE external_id LIKE 'TX-DEMO-%'))`);
    await runDelete('bank_transaction_matches', `DELETE FROM cohamy_crm.bank_transaction_matches WHERE transaction_id IN (SELECT id FROM cohamy_crm.bank_transactions WHERE external_id LIKE 'TX-DEMO-%') OR payment_id IN (SELECT id FROM cohamy_crm.payment_receipts WHERE organization_id IN ${demoOrgSubquery} OR reference LIKE 'VCB-DEMO-%')`);
    await runDelete('payment_allocations', `DELETE FROM cohamy_crm.payment_allocations WHERE payment_id IN (SELECT id FROM cohamy_crm.payment_receipts WHERE organization_id IN ${demoOrgSubquery} OR reference LIKE 'VCB-DEMO-%')`);
    await runDelete('bank_transfer_proofs', `DELETE FROM cohamy_crm.bank_transfer_proofs WHERE payment_id IN (SELECT id FROM cohamy_crm.payment_receipts WHERE organization_id IN ${demoOrgSubquery} OR reference LIKE 'VCB-DEMO-%')`);
    await runDelete('deposit_refund_requests', `DELETE FROM cohamy_crm.deposit_refund_requests WHERE payment_id IN (SELECT id FROM cohamy_crm.payment_receipts WHERE organization_id IN ${demoOrgSubquery} OR reference LIKE 'VCB-DEMO-%')`);
    await runDelete('payment_receipts', `DELETE FROM cohamy_crm.payment_receipts WHERE organization_id IN ${demoOrgSubquery} OR reference LIKE 'VCB-DEMO-%' OR code LIKE 'PT-DEMO-%'`);
    await runDelete('bank_transactions', `DELETE FROM cohamy_crm.bank_transactions WHERE external_id LIKE 'TX-DEMO-%'`);
    await runDelete('receivable_events', `DELETE FROM cohamy_crm.receivable_events WHERE receivable_id IN (SELECT id FROM cohamy_crm.receivables WHERE organization_id IN ${demoOrgSubquery} OR code LIKE 'CN-DEMO-%')`);
    await runDelete('receivables', `DELETE FROM cohamy_crm.receivables WHERE organization_id IN ${demoOrgSubquery} OR code LIKE 'CN-DEMO-%'`);
    await runDelete('credit_events', `DELETE FROM cohamy_crm.credit_events WHERE organization_id IN ${demoOrgSubquery}`);
    await runDelete('credit_holds', `DELETE FROM cohamy_crm.credit_holds WHERE organization_id IN ${demoOrgSubquery}`);
    await runDelete('credit_accounts', `DELETE FROM cohamy_crm.credit_accounts WHERE organization_id IN ${demoOrgSubquery}`);
    await runDelete('cash_request_events', `DELETE FROM cohamy_crm.cash_request_events WHERE request_id IN (SELECT id FROM cohamy_crm.cash_requests WHERE organization_id IN ${demoOrgSubquery} OR code LIKE 'TC-DEMO-%')`);
    await runDelete('cash_requests', `DELETE FROM cohamy_crm.cash_requests WHERE organization_id IN ${demoOrgSubquery} OR requester_id IN ${demoUserSubquery} OR code LIKE 'TC-DEMO-%'`);
    await runDelete('finance_actions', `DELETE FROM cohamy_crm.finance_actions WHERE actor_id IN ${demoUserSubquery}`);

    console.log('[DEMO RESET] Purging demo fulfillment & deliveries...');
    const demoOrderSubquery = `(SELECT id FROM cohamy_crm.sales_orders WHERE organization_id IN ${demoOrgSubquery} OR code LIKE 'SO-DEMO-%')`;
    const demoDeliverySubquery = `(SELECT id FROM cohamy_crm.deliveries WHERE order_id IN ${demoOrderSubquery} OR code LIKE 'DL-DEMO-%')`;
    const demoDeliveryLineSubquery = `(SELECT id FROM cohamy_crm.delivery_lines WHERE delivery_id IN ${demoDeliverySubquery})`;
    const demoParcelSubquery = `(SELECT id FROM cohamy_crm.delivery_parcels WHERE delivery_id IN ${demoDeliverySubquery})`;
    const demoReturnSubquery = `(SELECT id FROM cohamy_crm.return_requests WHERE order_id IN ${demoOrderSubquery} OR code LIKE 'RT-DEMO-%')`;
    const demoReturnLineSubquery = `(SELECT id FROM cohamy_crm.return_request_lines WHERE request_id IN ${demoReturnSubquery})`;

    await runDelete('delivery_proofs', `DELETE FROM cohamy_crm.delivery_proofs WHERE delivery_id IN ${demoDeliverySubquery}`);
    await runDelete('carrier_events', `DELETE FROM cohamy_crm.carrier_events WHERE parcel_id IN ${demoParcelSubquery}`);
    await runDelete('delivery_trip_parcels', `DELETE FROM cohamy_crm.delivery_trip_parcels WHERE parcel_id IN ${demoParcelSubquery}`);
    await runDelete('delivery_trips', `DELETE FROM cohamy_crm.delivery_trips WHERE actor_id IN ${demoUserSubquery} OR code LIKE 'TRIP-DEMO-%'`);
    await runDelete('delivery_parcel_lines', `DELETE FROM cohamy_crm.delivery_parcel_lines WHERE parcel_id IN ${demoParcelSubquery} OR delivery_line_id IN ${demoDeliveryLineSubquery}`);
    await runDelete('delivery_parcels', `DELETE FROM cohamy_crm.delivery_parcels WHERE id IN ${demoParcelSubquery}`);
    await runDelete('return_dispositions', `DELETE FROM cohamy_crm.return_dispositions WHERE request_line_id IN ${demoReturnLineSubquery}`);
    await runDelete('return_events', `DELETE FROM cohamy_crm.return_events WHERE request_id IN ${demoReturnSubquery}`);
    await runDelete('return_request_lines', `DELETE FROM cohamy_crm.return_request_lines WHERE id IN ${demoReturnLineSubquery}`);
    await runDelete('return_requests', `DELETE FROM cohamy_crm.return_requests WHERE id IN ${demoReturnSubquery}`);
    await runDelete('pick_events', `DELETE FROM cohamy_crm.pick_events WHERE delivery_line_id IN ${demoDeliveryLineSubquery}`);
    await runDelete('delivery_events', `DELETE FROM cohamy_crm.delivery_events WHERE delivery_id IN ${demoDeliverySubquery}`);
    await runDelete('delivery_lines', `DELETE FROM cohamy_crm.delivery_lines WHERE id IN ${demoDeliveryLineSubquery}`);
    await runDelete('deliveries', `DELETE FROM cohamy_crm.deliveries WHERE id IN ${demoDeliverySubquery}`);
    await runDelete('delivery_backorders', `DELETE FROM cohamy_crm.delivery_backorders WHERE order_id IN ${demoOrderSubquery}`);
    await runDelete('fulfillment_actions', `DELETE FROM cohamy_crm.fulfillment_actions WHERE actor_id IN ${demoUserSubquery}`);
    await runDelete('inventory_reservation_events', `DELETE FROM cohamy_crm.inventory_reservation_events WHERE reservation_id IN (SELECT id FROM cohamy_crm.inventory_reservations WHERE order_id IN ${demoOrderSubquery})`);
    await runDelete('inventory_reservations', `DELETE FROM cohamy_crm.inventory_reservations WHERE order_id IN ${demoOrderSubquery}`);
    await runDelete('inventory_actions', `DELETE FROM cohamy_crm.inventory_actions WHERE actor_id IN ${demoUserSubquery}`);

    console.log('[DEMO RESET] Purging demo commercial orders & quotations...');
    const demoWarehouseSubquery = `(SELECT id FROM cohamy_crm.warehouses WHERE code LIKE 'DEMO_%')`;
    const demoProductSubquery = `(SELECT id FROM cohamy_crm.products WHERE sku LIKE 'DEMO-%')`;
    const demoDocumentSubquery = `(SELECT id FROM cohamy_crm.inventory_documents WHERE organization_id IN ${demoOrgSubquery} OR actor_id IN ${demoUserSubquery} OR code LIKE 'DOC-DEMO-%')`;

    // Break reversal cycles and delete movements before sales orders to satisfy source_order_id FK
    await runDelete('inventory_movements_break_cycle', `UPDATE cohamy_crm.inventory_movements SET reversal_of = NULL WHERE warehouse_id IN ${demoWarehouseSubquery} OR product_id IN ${demoProductSubquery} OR source_order_id IN ${demoOrderSubquery} OR document_id IN ${demoDocumentSubquery}`);
    await runDelete('inventory_movements', `DELETE FROM cohamy_crm.inventory_movements WHERE warehouse_id IN ${demoWarehouseSubquery} OR product_id IN ${demoProductSubquery} OR source_order_id IN ${demoOrderSubquery} OR document_id IN ${demoDocumentSubquery}`);

    const demoRequestSubquery = `(SELECT id FROM cohamy_crm.commercial_requests WHERE organization_id IN ${demoOrgSubquery} OR code LIKE 'CR-DEMO-%')`;
    const demoQuotationSubquery = `(SELECT id FROM cohamy_crm.quotations WHERE organization_id IN ${demoOrgSubquery} OR code LIKE 'BG-DEMO-%')`;

    await runDelete('request_excel_previews', `DELETE FROM cohamy_crm.request_excel_previews WHERE organization_id IN ${demoOrgSubquery} OR user_id IN ${demoUserSubquery}`);
    await runDelete('order_change_previews', `DELETE FROM cohamy_crm.order_change_previews WHERE order_id IN ${demoOrderSubquery} OR actor_id IN ${demoUserSubquery}`);
    await runDelete('commercial_events', `DELETE FROM cohamy_crm.commercial_events WHERE order_id IN ${demoOrderSubquery} OR request_id IN ${demoRequestSubquery} OR actor_id IN ${demoUserSubquery}`);

    // Break self-referencing foreign keys between sales_orders and commercial_requests
    await runDelete('sales_orders_break_cycle', `UPDATE cohamy_crm.sales_orders SET latest_version_id = NULL, confirmed_version_id = NULL WHERE id IN ${demoOrderSubquery}`);
    await runDelete('commercial_requests_break_cycle', `UPDATE cohamy_crm.commercial_requests SET latest_version_id = NULL, owner_approved_version_id = NULL, source_order_id = NULL, source_quotation_id = NULL WHERE id IN ${demoRequestSubquery}`);

    await runDelete('sales_order_versions', `DELETE FROM cohamy_crm.sales_order_versions WHERE order_id IN ${demoOrderSubquery}`);
    await runDelete('sales_orders', `DELETE FROM cohamy_crm.sales_orders WHERE id IN ${demoOrderSubquery}`);
    await runDelete('commercial_request_versions', `DELETE FROM cohamy_crm.commercial_request_versions WHERE request_id IN ${demoRequestSubquery}`);
    await runDelete('commercial_requests', `DELETE FROM cohamy_crm.commercial_requests WHERE id IN ${demoRequestSubquery}`);
    await runDelete('website_orders', `DELETE FROM cohamy_crm.website_orders WHERE code LIKE 'WEB-DEMO-%' OR contact->>'email' LIKE '%@demo.cohamy.invalid'`);

    await runDelete('quotation_events', `DELETE FROM cohamy_crm.quotation_events WHERE quotation_id IN ${demoQuotationSubquery}`);
    await runDelete('quotation_pdfs', `DELETE FROM cohamy_crm.quotation_pdfs WHERE version_id IN (SELECT id FROM cohamy_crm.quotation_versions WHERE quotation_id IN ${demoQuotationSubquery})`);
    await runDelete('quotations_break_cycle', `UPDATE cohamy_crm.quotations SET latest_version_id = NULL, sent_version_id = NULL, accepted_version_id = NULL WHERE id IN ${demoQuotationSubquery}`);
    await runDelete('quotation_versions', `DELETE FROM cohamy_crm.quotation_versions WHERE quotation_id IN ${demoQuotationSubquery}`);
    await runDelete('quotations', `DELETE FROM cohamy_crm.quotations WHERE id IN ${demoQuotationSubquery}`);

    console.log('[DEMO RESET] Purging demo inventory, products, price books...');
    await runDelete('inventory_documents_break_cycle', `UPDATE cohamy_crm.inventory_documents SET reversal_document_id = NULL WHERE id IN ${demoDocumentSubquery}`);
    await runDelete('inventory_documents', `DELETE FROM cohamy_crm.inventory_documents WHERE id IN ${demoDocumentSubquery}`);
    await runDelete('inventory_balances', `DELETE FROM cohamy_crm.inventory_balances WHERE warehouse_id IN ${demoWarehouseSubquery} OR product_id IN ${demoProductSubquery}`);
    await runDelete('inventory_lots', `DELETE FROM cohamy_crm.inventory_lots WHERE product_id IN ${demoProductSubquery} OR code LIKE 'LOT-DEMO-%'`);
    await runDelete('warehouse_locations', `DELETE FROM cohamy_crm.warehouse_locations WHERE warehouse_id IN ${demoWarehouseSubquery}`);
    await runDelete('warehouse_assignments', `DELETE FROM cohamy_crm.warehouse_assignments WHERE warehouse_id IN ${demoWarehouseSubquery} OR membership_id IN (SELECT id FROM cohamy_crm.memberships WHERE user_id IN (SELECT id FROM cohamy_crm.users WHERE email LIKE '%@demo.cohamy.invalid'))`);
    await runDelete('warehouses', `DELETE FROM cohamy_crm.warehouses WHERE code LIKE 'DEMO_%'`);

    const demoBookSubquery = `(SELECT id FROM cohamy_crm.price_books WHERE name LIKE 'DEMO · %' OR organization_id IN ${demoOrgSubquery} OR created_by IN ${demoUserSubquery})`;
    await runDelete('price_events', `DELETE FROM cohamy_crm.price_events WHERE book_id IN ${demoBookSubquery}`);
    await runDelete('price_books_break_cycle', `UPDATE cohamy_crm.price_books SET latest_version_id = NULL, published_version_id = NULL WHERE id IN ${demoBookSubquery}`);
    await runDelete('price_book_versions', `DELETE FROM cohamy_crm.price_book_versions WHERE book_id IN ${demoBookSubquery}`);
    await runDelete('organization_pricing', `DELETE FROM cohamy_crm.organization_pricing WHERE organization_id IN ${demoOrgSubquery}`);
    await runDelete('price_books', `DELETE FROM cohamy_crm.price_books WHERE id IN ${demoBookSubquery}`);
    await runDelete('commercial_unit_versions', `DELETE FROM cohamy_crm.commercial_unit_versions WHERE product_id IN ${demoProductSubquery}`);
    await runDelete('commercial_units', `DELETE FROM cohamy_crm.commercial_units WHERE product_id IN ${demoProductSubquery}`);
    await runDelete('products', `DELETE FROM cohamy_crm.products WHERE sku LIKE 'DEMO-%'`);

    console.log('[DEMO RESET] Purging demo onboarding applications...');
    await runDelete('application_history', `DELETE FROM cohamy_crm.application_history WHERE application_id IN (SELECT id FROM cohamy_crm.partner_applications WHERE email LIKE '%@demo.cohamy.invalid' OR company_name LIKE 'DEMO · %')`);
    await runDelete('application_verifications', `DELETE FROM cohamy_crm.application_verifications WHERE application_id IN (SELECT id FROM cohamy_crm.partner_applications WHERE email LIKE '%@demo.cohamy.invalid' OR company_name LIKE 'DEMO · %')`);
    await runDelete('applicant_sessions', `DELETE FROM cohamy_crm.applicant_sessions WHERE application_id IN (SELECT id FROM cohamy_crm.partner_applications WHERE email LIKE '%@demo.cohamy.invalid' OR company_name LIKE 'DEMO · %')`);
    await runDelete('partner_applications', `DELETE FROM cohamy_crm.partner_applications WHERE email LIKE '%@demo.cohamy.invalid' OR company_name LIKE 'DEMO · %'`);
    await runDelete('partner_invitations', `DELETE FROM cohamy_crm.partner_invitations WHERE created_by IN ${demoUserSubquery} OR organization_id IN ${demoOrgSubquery}`);

    console.log('[DEMO RESET] Purging demo sessions, memberships, users, organizations...');
    await runDelete(
      'sessions',
      `DELETE FROM cohamy_crm.sessions 
       WHERE membership_id IN (
         SELECT id FROM cohamy_crm.memberships 
         WHERE user_id IN (SELECT id FROM cohamy_crm.users WHERE email LIKE '%@demo.cohamy.invalid')
       )`
    );
    await runDelete(
      'partner_assignments',
      `DELETE FROM cohamy_crm.partner_assignments 
       WHERE membership_id IN (SELECT id FROM cohamy_crm.memberships WHERE user_id IN (SELECT id FROM cohamy_crm.users WHERE email LIKE '%@demo.cohamy.invalid'))
          OR organization_id IN ${demoOrgSubquery}`
    );
    await runDelete(
      'memberships',
      `DELETE FROM cohamy_crm.memberships 
       WHERE user_id IN (SELECT id FROM cohamy_crm.users WHERE email LIKE '%@demo.cohamy.invalid')
          OR organization_id IN ${demoOrgSubquery}`
    );
    await runDelete('users', `DELETE FROM cohamy_crm.users WHERE email LIKE '%@demo.cohamy.invalid'`);
    await runDelete('organizations', `DELETE FROM cohamy_crm.organizations WHERE code LIKE 'DEMO_%' OR name LIKE 'DEMO · %'`);

    // Restore original deny_audit_mutation definition before commit
    await sql.exec(`
      CREATE OR REPLACE FUNCTION cohamy_crm.deny_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'AUDIT_APPEND_ONLY';
      END;
      $$;
    `);
  });

  // Remove local credentials file after transaction commits successfully
  if (!options?.preserveCredentialsFile && (!process.env.CRM_LOCAL_DATA_DIR || process.env.CRM_LOCAL_DATA_DIR === '.local/crm-demo')) {
    await fs.rm(DEMO_CREDENTIALS_FILE, { force: true }).catch(() => {});
  }

  console.log('[DEMO RESET] ✅ Hoàn tất xóa có chọn lọc toàn bộ bản ghi demo trong transaction an toàn.');

  return { deletedBatch: 'DEMO_BATCH_2026', timestamp: new Date().toISOString() };
}

if (process.argv[1]?.endsWith('reset.ts')) {
  process.env.CRM_DATABASE_MODE = process.env.CRM_DATABASE_MODE || 'pglite';
  process.env.CRM_ENVIRONMENT = process.env.CRM_ENVIRONMENT || 'DEMO';
  process.env.CRM_LOCAL_DATA_DIR = process.env.CRM_LOCAL_DATA_DIR || '.local/crm-demo';

  resetDemoData()
    .then(async () => {
      const db = await database();
      await db.close().catch(() => {});
      console.log('RESET_DEMO_DATA_SUCCEEDED');
      process.exit(0);
    })
    .catch((error) => {
      console.error('RESET_DEMO_DATA_FAILED:', error instanceof Error ? error.stack : error);
      process.exit(1);
    });
}
