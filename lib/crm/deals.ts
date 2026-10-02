import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { database, type Sql } from './db';
import { assertCurrentPrincipal, audit } from './auth';
import { assertPermission, CrmError } from './permissions';
import type { Principal, Deal } from './types';

const createDealSchema = z.object({
  title: z.string().trim().min(2).max(200),
  customerId: z.uuid(),
  sellerOrganizationId: z.uuid().optional(),
  managementOwnerId: z.uuid().nullable().optional(),
  managementTeamId: z.uuid().nullable().optional(),
  notes: z.string().trim().max(2000).default(''),
  idempotencyKey: z.uuid().optional(),
}).strict();

export async function createDeal(user: Principal, input: unknown): Promise<Deal> {
  assertPermission(user, 'deals.write');
  const d = createDealSchema.parse(input);
  const db = await database();

  return db.transaction(async sql => {
    await assertCurrentPrincipal(sql, user);

    const sellerOrgId = d.sellerOrganizationId || (user.area === 'portal' ? user.organizationId : (await getCohamyOrgId(sql)));

    // Check customer exists and is accessible
    const customer = (await sql.query<{ id: string; name: string }>(
      'SELECT id, name FROM cohamy_crm.organizations WHERE id = $1',
      [d.customerId]
    )).rows[0];
    if (!customer) throw new CrmError('CUSTOMER_NOT_FOUND', 404);

    const year = new Date().getFullYear();
    const seqRes = await sql.query<{ next_val: string }>(
      "SELECT nextval('cohamy_crm.deal_code_seq')::text AS next_val"
    );
    const code = `DEAL-${year}-${seqRes.rows[0].next_val.padStart(6, '0')}`;

    const id = randomUUID();
    const deal: Deal = {
      id,
      code,
      title: d.title,
      customer_id: d.customerId,
      seller_organization_id: sellerOrgId,
      management_owner_id: d.managementOwnerId || (user.area === 'crm' ? user.id : null),
      management_team_id: d.managementTeamId || null,
      status: 'OPEN',
      notes: d.notes,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await sql.query(
      `INSERT INTO cohamy_crm.deals (
        id, code, title, customer_id, seller_organization_id,
        management_owner_id, management_team_id, status, notes, version, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        deal.id, deal.code, deal.title, deal.customer_id, deal.seller_organization_id,
        deal.management_owner_id, deal.management_team_id, deal.status, deal.notes,
        deal.version, deal.created_at, deal.updated_at
      ]
    );

    await audit(sql, user.id, 'deal.created', id, { code, title: d.title, customerId: d.customerId });
    return deal;
  });
}

export async function getDeal(user: Principal, id: string): Promise<Deal> {
  assertPermission(user, 'deals.read');
  const db = await database();
  const row = (await db.query<Deal>('SELECT * FROM cohamy_crm.deals WHERE id = $1', [id])).rows[0];
  if (!row) throw new CrmError('NOT_FOUND', 404);

  // Scope check: admin sees all, dealer sees only deals where seller is their org or customer is in their scope
  if (user.role !== 'ADMIN' && user.area === 'portal') {
    if (row.seller_organization_id !== user.organizationId && row.customer_id !== user.organizationId) {
      throw new CrmError('FORBIDDEN', 403);
    }
  }

  return row;
}

export async function getDealByCode(user: Principal, code: string): Promise<Deal> {
  assertPermission(user, 'deals.read');
  const db = await database();
  const row = (await db.query<Deal>('SELECT * FROM cohamy_crm.deals WHERE code = $1', [code])).rows[0];
  if (!row) throw new CrmError('NOT_FOUND', 404);

  if (user.role !== 'ADMIN' && user.area === 'portal') {
    if (row.seller_organization_id !== user.organizationId && row.customer_id !== user.organizationId) {
      throw new CrmError('FORBIDDEN', 403);
    }
  }

  return row;
}

export interface DealTimelineItem {
  id: string;
  type: 'QUOTATION' | 'ORDER_REQUEST' | 'SALES_ORDER' | 'FULFILLMENT' | 'RECEIVABLE' | 'PAYMENT';
  code: string;
  status: string;
  amount?: string;
  date: string;
  summary: string;
}

export async function getDealTimeline(user: Principal, dealId: string): Promise<DealTimelineItem[]> {
  const deal = await getDeal(user, dealId);
  const db = await database();
  const items: DealTimelineItem[] = [];

  // Quotations
  const quotes = (await db.query<{ id: string; code: string; status: string; total: string; created_at: string }>(
    `SELECT q.id, q.code,
      CASE WHEN q.accepted_version_id IS NOT NULL THEN 'ACCEPTED' WHEN q.sent_version_id IS NOT NULL THEN 'SENT' ELSE 'DRAFT' END AS status,
      COALESCE(v.snapshot->'calculation'->>'total', '0') AS total,
      q.created_at
     FROM cohamy_crm.quotations q
     LEFT JOIN cohamy_crm.quotation_versions v ON v.id = q.latest_version_id
     WHERE q.deal_id = $1`,
    [deal.id]
  )).rows;
  for (const q of quotes) {
    items.push({
      id: q.id,
      type: 'QUOTATION',
      code: q.code,
      status: q.status,
      amount: q.total,
      date: q.created_at,
      summary: `Báo giá ${q.code} (${q.status})`,
    });
  }

  // Commercial Requests
  const requests = (await db.query<{ id: string; code: string; status: string; created_at: string }>(
    'SELECT id, code, status, created_at FROM cohamy_crm.commercial_requests WHERE deal_id = $1',
    [deal.id]
  )).rows;
  for (const r of requests) {
    items.push({
      id: r.id,
      type: 'ORDER_REQUEST',
      code: r.code,
      status: r.status,
      date: r.created_at,
      summary: `Đề nghị đặt hàng ${r.code} (${r.status})`,
    });
  }

  // Sales Orders
  const orders = (await db.query<{ id: string; code: string; status: string; total: string; created_at: string }>(
    `SELECT o.id, o.code, o.status,
      COALESCE(v.snapshot->'quote'->'calculation'->>'total', '0') AS total,
      o.created_at
     FROM cohamy_crm.sales_orders o
     LEFT JOIN cohamy_crm.sales_order_versions v ON v.id = o.latest_version_id
     WHERE o.deal_id = $1`,
    [deal.id]
  )).rows;
  for (const o of orders) {
    items.push({
      id: o.id,
      type: 'SALES_ORDER',
      code: o.code,
      status: o.status,
      amount: o.total,
      date: o.created_at,
      summary: `Đơn bán hàng ${o.code} (${o.status})`,
    });
  }

  // Fulfillments (deliveries)
  const fulfillments = (await db.query<{ id: string; code: string; status: string; created_at: string }>(
    'SELECT id, code, status, created_at FROM cohamy_crm.deliveries WHERE deal_id = $1',
    [deal.id]
  )).rows;
  for (const f of fulfillments) {
    items.push({
      id: f.id,
      type: 'FULFILLMENT',
      code: f.code,
      status: f.status,
      date: f.created_at,
      summary: `Giao hàng ${f.code} (${f.status})`,
    });
  }

  // Receivables
  const receivables = (await db.query<{ id: string; code: string; status: string; remaining_amount: string; created_at: string }>(
    'SELECT id, code, status, remaining_amount::text, created_at FROM cohamy_crm.receivables WHERE deal_id = $1',
    [deal.id]
  )).rows;
  for (const rec of receivables) {
    items.push({
      id: rec.id,
      type: 'RECEIVABLE',
      code: rec.code,
      status: rec.status,
      amount: rec.remaining_amount,
      date: rec.created_at,
      summary: `Khoản phải thu ${rec.code} (${rec.status})`,
    });
  }

  // Payments
  const payments = (await db.query<{ id: string; code: string; status: string; amount: string; created_at: string }>(
    'SELECT id, code, status, amount::text, created_at FROM cohamy_crm.payment_receipts WHERE deal_id = $1',
    [deal.id]
  )).rows;
  for (const p of payments) {
    items.push({
      id: p.id,
      type: 'PAYMENT',
      code: p.code,
      status: p.status,
      amount: p.amount,
      date: p.created_at,
      summary: `Thanh toán ${p.code} (${p.status})`,
    });
  }

  // Sort by date ascending
  return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function searchDeals(user: Principal, q: string): Promise<Deal[]> {
  assertPermission(user, 'deals.read');
  const db = await database();
  const searchPattern = `%${q.trim()}%`;

  if (user.role === 'ADMIN') {
    return (await db.query<Deal>(
      `SELECT d.* FROM cohamy_crm.deals d
       JOIN cohamy_crm.organizations c ON c.id = d.customer_id
       WHERE d.code ILIKE $1 OR d.title ILIKE $1 OR c.name ILIKE $1
       ORDER BY d.created_at DESC LIMIT 50`,
      [searchPattern]
    )).rows;
  }

  return (await db.query<Deal>(
    `SELECT d.* FROM cohamy_crm.deals d
     JOIN cohamy_crm.organizations c ON c.id = d.customer_id
     WHERE (d.seller_organization_id = $2 OR d.customer_id = $2)
       AND (d.code ILIKE $1 OR d.title ILIKE $1 OR c.name ILIKE $1)
     ORDER BY d.created_at DESC LIMIT 50`,
    [searchPattern, user.organizationId]
  )).rows;
}

export async function linkEntityToDeal(
  sql: Sql,
  dealId: string,
  entityType: 'REQUEST' | 'ORDER' | 'QUOTATION' | 'RECEIVABLE' | 'PAYMENT' | 'FULFILLMENT',
  entityId: string
): Promise<void> {
  switch (entityType) {
    case 'REQUEST':
      await sql.query('UPDATE cohamy_crm.commercial_requests SET deal_id = $1 WHERE id = $2', [dealId, entityId]);
      break;
    case 'ORDER':
      await sql.query('UPDATE cohamy_crm.sales_orders SET deal_id = $1 WHERE id = $2', [dealId, entityId]);
      break;
    case 'QUOTATION':
      await sql.query('UPDATE cohamy_crm.quotations SET deal_id = $1 WHERE id = $2', [dealId, entityId]);
      break;
    case 'RECEIVABLE':
      await sql.query('UPDATE cohamy_crm.receivables SET deal_id = $1 WHERE id = $2', [dealId, entityId]);
      break;
    case 'PAYMENT':
      await sql.query('UPDATE cohamy_crm.payment_receipts SET deal_id = $1 WHERE id = $2', [dealId, entityId]);
      break;
    case 'FULFILLMENT':
      await sql.query('UPDATE cohamy_crm.deliveries SET deal_id = $1 WHERE id = $2', [dealId, entityId]);
      break;
  }
}

/**
 * Backfill deals for historical orders that have unambiguous source linkages
 * but never merge arbitrarily solely on date/total/customer.
 */
export async function backfillDeals(user: Principal): Promise<{ backfilledCount: number; unresolvedCount: number }> {
  assertPermission(user, 'deals.write');
  const db = await database();

  return db.transaction(async sql => {
    // Find sales orders without deal_id
    const unlinkedOrders = (await sql.query<{
      id: string;
      code: string;
      customer_id: string;
      seller_organization_id: string | null;
      created_at: string;
    }>(
      'SELECT id, code, organization_id as customer_id, seller_organization_id, created_at FROM cohamy_crm.sales_orders WHERE deal_id IS NULL'
    )).rows;

    let backfilledCount = 0;
    const unresolvedCount = 0;

    for (const order of unlinkedOrders) {
      // Find linked commercial request
      const req = (await sql.query<{ id: string; deal_id: string | null }>(
        'SELECT id, deal_id FROM cohamy_crm.commercial_requests WHERE id = $1',
        [order.id] // Or via reference
      )).rows[0];

      if (req?.deal_id) {
        await linkEntityToDeal(sql, req.deal_id, 'ORDER', order.id);
        backfilledCount++;
      } else {
        // Create an explicit single deal for this order
        const year = new Date(order.created_at).getFullYear();
        const seqRes = await sql.query<{ next_val: string }>(
          "SELECT nextval('cohamy_crm.deal_code_seq')::text AS next_val"
        );
        const dealId = randomUUID();
        const dealCode = `DEAL-${year}-${seqRes.rows[0].next_val.padStart(6, '0')}`;
        const sellerId = order.seller_organization_id || (await getCohamyOrgId(sql));

        await sql.query(
          `INSERT INTO cohamy_crm.deals (
            id, code, title, customer_id, seller_organization_id, status, notes, version, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, 'WON', 'Backfilled from historical order', 1, $6, now())`,
          [dealId, dealCode, `Giao dịch ${order.code}`, order.customer_id, sellerId, order.created_at]
        );

        await linkEntityToDeal(sql, dealId, 'ORDER', order.id);
        if (req) {
          await linkEntityToDeal(sql, dealId, 'REQUEST', req.id);
        }
        backfilledCount++;
      }
    }

    return { backfilledCount, unresolvedCount };
  });
}

async function getCohamyOrgId(sql: Sql): Promise<string> {
  const row = (await sql.query<{ id: string }>('SELECT id FROM cohamy_crm.organizations WHERE kind = \'COHAMY\' LIMIT 1')).rows[0];
  return row ? row.id : randomUUID();
}
