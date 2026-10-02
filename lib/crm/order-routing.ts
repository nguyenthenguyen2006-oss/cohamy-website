import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { database } from './db';
import { assertCurrentPrincipal, audit } from './auth';
import { CrmError } from './permissions';
import { getActiveParentOrganization, getUpstreamRoute } from './distribution';
import { commercialRequestAccess, requestVersionAccess, saveCommercialRequest } from './order-requests';
import { salesOrderAccess } from './sales-orders';
import { parseCommercial as parse, commercialDigest as hash, commercialWriter } from './commercial-common';
import type { Principal, Organization } from './types';

export interface RouteNode {
  organizationId: string;
  organizationName: string;
  partnerType: string;
  role: 'BUYER' | 'SELLER' | 'INTERMEDIARY' | 'ROOT';
  requestId?: string;
  requestCode?: string;
  orderId?: string;
  orderCode?: string;
  status?: string;
}

export interface OrderRouteChain {
  rootOrderId: string;
  nodes: RouteNode[];
  upstreamOrderId?: string;
  downstreamOrderId?: string;
}

const escalateSchema = z.object({
  requestId: z.uuid(),
  reason: z.string().trim().min(3).max(1000),
  idempotencyKey: z.uuid(),
}).strict();

/**
 * Escalate a commercial request upstream:
 * When an intermediary dealer (e.g. Tier 2) receives an order request from a store/dealer
 * and needs stock, it creates an upstream request to its own parent (e.g. Tier 1 dealer or Cohamy).
 */
export async function escalateCommercialRequest(user: Principal, input: unknown) {
  if (user.area === 'crm') {
    commercialWriter(user);
  } else if (!['DEALER_OWNER', 'DEALER_STAFF'].includes(user.role)) {
    throw new CrmError('FORBIDDEN', 403);
  }
  const data = parse(escalateSchema, input);
  const db = await database();

  return db.transaction(async tx => {
    await assertCurrentPrincipal(tx, user);

    const downstreamReq = await commercialRequestAccess(tx, user, data.requestId, true);
    const downstreamVer = await requestVersionAccess(tx, downstreamReq, downstreamReq.latest_version_id);

    // Current user's organization acts as the buyer in the upstream request
    const buyerOrgId = user.area==='crm' ? downstreamReq.seller_organization_id : user.organizationId;
    if (!buyerOrgId) throw new CrmError('INVALID_ORGANIZATION', 400);
    if(downstreamReq.status!=='SUBMITTED')throw new CrmError('REQUEST_NOT_SUBMITTED',409);
    if(downstreamReq.seller_organization_id!==buyerOrgId||downstreamReq.organization_id===buyerOrgId)throw new CrmError('FORBIDDEN',403);

    // Find parent of current organization
    const parentOrg = await getActiveParentOrganization(tx, buyerOrgId);
    let sellerOrgId: string;
    if (parentOrg) {
      sellerOrgId = parentOrg.id;
    } else {
      const cohamy = (await tx.query<Organization>("SELECT id FROM cohamy_crm.organizations WHERE kind = 'COHAMY' LIMIT 1")).rows[0];
      if (!cohamy) throw new CrmError('COHAMY_ORG_NOT_FOUND', 500);
      sellerOrgId = cohamy.id;
    }

    if (sellerOrgId === buyerOrgId) {
      throw new CrmError('CANNOT_ESCALATE_TO_SELF', 400);
    }

    // Upstream request uses downstream basket & delivery, but prices independently for buyerOrgId
    const upstreamBasket = downstreamVer.snapshot.basket;
    const upstreamDelivery = downstreamVer.snapshot.delivery;

    // Check idempotency
    const existing = (await tx.query<{ id: string; version: number }>(
      `SELECT id, version FROM cohamy_crm.commercial_requests
       WHERE parent_request_id = $1 AND organization_id = $2`,
      [downstreamReq.id, buyerOrgId]
    )).rows[0];

    if (existing) {
      return {
        id: existing.id,
        version: existing.version,
        isExisting: true,
      };
    }

    // Save upstream commercial request
    const saveResult = await saveCommercialRequest(
      user,
      {
        organizationId: buyerOrgId,
        channel: user.area==='portal'?'PORTAL':'OTHER',
        basket: upstreamBasket,
        delivery: upstreamDelivery,
        note: `Escalated upstream from ${downstreamReq.code}: ${data.reason}`,
        idempotencyKey: data.idempotencyKey,
        version: 0,
        ...(downstreamReq.deal_id?{dealId:downstreamReq.deal_id}:{}),
      },
      tx
    );

    // Link parent_request_id and seller_organization_id
    const route = await getUpstreamRoute(tx, buyerOrgId);
    const routePath = JSON.stringify(route.map(r => r.id));

    await tx.query(
      `UPDATE cohamy_crm.commercial_requests
       SET parent_request_id = $1, seller_organization_id = $2, route_path = $3::jsonb, assigned_approver_org_id = $2
       WHERE id = $4`,
      [downstreamReq.id, sellerOrgId, routePath, saveResult.id]
    );

    await tx.query(
      `INSERT INTO cohamy_crm.commercial_events(
        id, request_id, source_version_id, action, actor_id, reason, idempotency_key, request_hash, result
      ) VALUES ($1, $2, $3, 'ESCALATED_UPSTREAM', $4, $5, $6, $7, $8::jsonb)`,
      [
        randomUUID(),
        downstreamReq.id,
        downstreamVer.id,
        user.id,
        data.reason,
        data.idempotencyKey,
        hash({ requestId: downstreamReq.id, upstreamId: saveResult.id }),
        JSON.stringify({ upstreamRequestId: saveResult.id, sellerOrgId }),
      ]
    );

    await audit(tx, user.id, 'commercial-request.escalated-upstream', downstreamReq.id, {
      downstreamRequestId: downstreamReq.id,
      upstreamRequestId: saveResult.id,
      buyerOrgId,
      sellerOrgId,
    });

    return {
      id: saveResult.id,
      version: saveResult.version,
      isExisting: false,
    };
  });
}

/**
 * Get route chain for a given sales order
 */
export async function getOrderRouteChain(user: Principal, orderId: string): Promise<OrderRouteChain> {
  const db = await database();
  return db.transaction(async tx => {
    await assertCurrentPrincipal(tx, user);
    const order = await salesOrderAccess(tx, user, orderId);

    const nodes: RouteNode[] = [];
    // The legal buyer/seller were frozen on submission; later tree edits cannot reroute this order.
    const route = (await tx.query<Organization>('SELECT * FROM cohamy_crm.organizations WHERE id=ANY($1::uuid[])',
      [[order.organization_id,order.seller_organization_id].filter(Boolean)])).rows;

    for (const org of route) {
      nodes.push({
        organizationId: org.id,
        organizationName: org.name,
        partnerType: org.partner_type ?? org.kind,
        role: org.id === order.organization_id ? 'BUYER' : org.kind === 'COHAMY' ? 'ROOT' : 'INTERMEDIARY',
        orderId: org.id === order.organization_id ? order.id : undefined,
        orderCode: org.id === order.organization_id ? order.code : undefined,
        status: org.id === order.organization_id ? order.status : undefined,
      });
    }

    return {
      rootOrderId: order.id,
      nodes,
    };
  });
}
