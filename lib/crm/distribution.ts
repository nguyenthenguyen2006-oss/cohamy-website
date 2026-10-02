import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { database, type Sql } from './db';
import { assertCurrentPrincipal, audit } from './auth';
import { assertPermission, CrmError } from './permissions';
import { partnerScope } from './repository';
import type { Principal, Organization } from './types';

export type PartnerType = 'COHAMY' | 'DEALER_L1' | 'DEALER_L2' | 'STORE' | 'END_CUSTOMER';

export interface DistributionRelation {
  id: string;
  parent_organization_id: string;
  child_organization_id: string;
  parent_name?: string;
  parent_code?: string;
  child_name?: string;
  child_code?: string;
  network_code: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  starts_at: string;
  ends_at: string | null;
  created_by: string;
  approved_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

const relationSchema = z.object({
  parentOrganizationId: z.uuid(),
  childOrganizationId: z.uuid(),
  networkCode: z.string().trim().min(1).max(40).default('DEFAULT'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
  startsAt: z.iso.datetime({ offset: true }).optional(),
  endsAt: z.iso.datetime({ offset: true }).nullable().optional(),
  reason: z.string().trim().min(3).max(1000),
  idempotencyKey: z.uuid(),
}).strict();

/**
 * Detect cycles in distribution hierarchy:
 * Check if childOrganizationId is an ancestor of parentOrganizationId,
 * or if parentOrganizationId equals childOrganizationId.
 */
export async function assertNoDistributionCycle(
  sql: Sql,
  parentOrgId: string,
  childOrgId: string,
  excludeRelationId?: string
): Promise<void> {
  if (parentOrgId === childOrgId) {
    throw new CrmError('DISTRIBUTION_SELF_PARENT_BLOCKED', 400);
  }

  // Traverse up from parentOrgId: if we hit childOrgId, it's a cycle!
  const visited = new Set<string>();
  const queue = [parentOrgId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === childOrgId) {
      throw new CrmError('DISTRIBUTION_CYCLE_DETECTED', 400);
    }
    if (visited.has(current)) continue;
    visited.add(current);

    const params: unknown[] = [current];
    let queryText = `SELECT parent_organization_id FROM cohamy_crm.distribution_relations WHERE child_organization_id = $1 AND status = 'ACTIVE'`;
    if (excludeRelationId) {
      params.push(excludeRelationId);
      queryText += ` AND id <> $2`;
    }

    const res = await sql.query<{ parent_organization_id: string }>(queryText, params);
    for (const row of res.rows) {
      if (!visited.has(row.parent_organization_id)) {
        queue.push(row.parent_organization_id);
      }
    }
  }
}

/**
 * Get active parent organization of a child in a network
 */
export async function getActiveParentOrganization(
  sql: Sql,
  childOrgId: string,
  networkCode = 'DEFAULT'
): Promise<Organization | null> {
  const query = `
    SELECT o.*
    FROM cohamy_crm.distribution_relations r
    JOIN cohamy_crm.organizations o ON o.id = r.parent_organization_id
    WHERE r.child_organization_id = $1
      AND r.network_code = $2
      AND r.status = 'ACTIVE'
      AND (r.ends_at IS NULL OR r.ends_at > now())
    LIMIT 1
  `;
  const res = await sql.query<Organization>(query, [childOrgId, networkCode]);
  return res.rows[0] ?? null;
}

/**
 * Get all descendant organization IDs (children, grandchildren, etc.) for scoping
 */
export async function getDescendantOrganizationIds(
  sql: Sql,
  rootOrgId: string,
  _networkCode = 'DEFAULT'
): Promise<string[]> {
  void _networkCode;
  const descendants: string[] = [];
  const visited = new Set<string>([rootOrgId]);
  const queue = [rootOrgId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const res = await sql.query<{ child_organization_id: string }>(
      `SELECT child_organization_id FROM cohamy_crm.distribution_relations WHERE parent_organization_id = $1 AND status = 'ACTIVE' AND (ends_at IS NULL OR ends_at > now())`,
      [current]
    );
    for (const row of res.rows) {
      if (!visited.has(row.child_organization_id)) {
        visited.add(row.child_organization_id);
        descendants.push(row.child_organization_id);
        queue.push(row.child_organization_id);
      }
    }
  }

  return descendants;
}

/**
 * Get the full upstream route from child to Cohamy
 * Returns: [childOrg, parentOrg, grandParentOrg, ..., cohamyOrg]
 */
export async function getUpstreamRoute(
  sql: Sql,
  startOrgId: string,
  networkCode = 'DEFAULT'
): Promise<Organization[]> {
  const route: Organization[] = [];
  const visited = new Set<string>();
  let currentId: string | null = startOrgId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const org = (await sql.query<Organization>('SELECT * FROM cohamy_crm.organizations WHERE id = $1', [currentId])).rows[0];
    if (!org) break;
    route.push(org);

    if (org.kind === 'COHAMY') break;

    const parent = await getActiveParentOrganization(sql, currentId, networkCode);
    if (!parent) {
      // If no active parent relation, find Cohamy root as ultimate fallback
      const cohamy = (await sql.query<Organization>("SELECT * FROM cohamy_crm.organizations WHERE kind = 'COHAMY' LIMIT 1")).rows[0];
      if (cohamy && cohamy.id !== currentId && !visited.has(cohamy.id)) {
        route.push(cohamy);
      }
      break;
    }
    currentId = parent.id;
  }

  return route;
}

/**
 * List distribution relations accessible by user
 */
export async function listDistributionRelations(
  user: Principal,
  options: { childOrgId?: string; parentOrgId?: string; networkCode?: string } = {}
): Promise<DistributionRelation[]> {
  assertPermission(user, 'partners.read');
  const db = await database();
  const scope = partnerScope(user);

  let where = `(${scope.sql.replace(/o\./g, 'child.')})`;
  const params: unknown[] = [...scope.params];

  if (options.childOrgId) {
    params.push(options.childOrgId);
    where += ` AND r.child_organization_id = $${params.length}`;
  }
  if (options.parentOrgId) {
    params.push(options.parentOrgId);
    where += ` AND r.parent_organization_id = $${params.length}`;
  }
  if (options.networkCode) {
    params.push(options.networkCode);
    where += ` AND r.network_code = $${params.length}`;
  }

  const query = `
    SELECT
      r.*,
      parent.name AS parent_name,
      parent.code AS parent_code,
      child.name AS child_name,
      child.code AS child_code
    FROM cohamy_crm.distribution_relations r
    JOIN cohamy_crm.organizations parent ON parent.id = r.parent_organization_id
    JOIN cohamy_crm.organizations child ON child.id = r.child_organization_id
    WHERE ${where}
    ORDER BY r.created_at DESC
  `;

  const res = await db.query<DistributionRelation>(query, params);
  return res.rows;
}

/**
 * Create or configure a distribution relation
 */
export async function saveDistributionRelation(
  user: Principal,
  input: unknown
): Promise<{ id: string; version: number }> {
  assertPermission(user, 'partners.write');
  if (user.area !== 'crm' || !['ADMIN', 'MANAGER'].includes(user.role)) {
    throw new CrmError('FORBIDDEN', 403);
  }

  const parsed = relationSchema.parse(input);
  const db = await database();

  return db.transaction(async tx => {
    await assertCurrentPrincipal(tx, user);

    // Verify parent and child exist and are active
    const parent = (await tx.query<{ id: string; kind: string; active: boolean }>('SELECT id, kind, active FROM cohamy_crm.organizations WHERE id = $1', [parsed.parentOrganizationId])).rows[0];
    const child = (await tx.query<{ id: string; kind: string; active: boolean }>('SELECT id, kind, active FROM cohamy_crm.organizations WHERE id = $1', [parsed.childOrganizationId])).rows[0];

    if (!parent || !parent.active || !child || !child.active) {
      throw new CrmError('ORGANIZATION_INACTIVE_OR_NOT_FOUND', 404);
    }

    // Verify cycle prevention
    await assertNoDistributionCycle(tx, parsed.parentOrganizationId, parsed.childOrganizationId);

    // If active, terminate any existing active parent relation for this child in this network
    if (parsed.status === 'ACTIVE') {
      await tx.query(
        `UPDATE cohamy_crm.distribution_relations
         SET status = 'INACTIVE', ends_at = now(), version = version + 1, updated_at = now()
         WHERE child_organization_id = $1 AND network_code = $2 AND status = 'ACTIVE' AND id <> $3`,
        [parsed.childOrganizationId, parsed.networkCode, randomUUID()]
      );
    }

    const id = randomUUID();
    await tx.query(
      `INSERT INTO cohamy_crm.distribution_relations(
        id, parent_organization_id, child_organization_id, network_code, status,
        starts_at, ends_at, created_by, approved_by
      ) VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()), $7, $8, $8)`,
      [
        id,
        parsed.parentOrganizationId,
        parsed.childOrganizationId,
        parsed.networkCode,
        parsed.status,
        parsed.startsAt ?? null,
        parsed.endsAt ?? null,
        user.id,
      ]
    );

    await tx.query(
      `INSERT INTO cohamy_crm.distribution_relation_events(
        id, relation_id, action, actor_id, payload, reason
      ) VALUES ($1, $2, 'CREATED', $3, $4::jsonb, $5)`,
      [
        randomUUID(),
        id,
        user.id,
        JSON.stringify({ parentId: parsed.parentOrganizationId, childId: parsed.childOrganizationId, network: parsed.networkCode }),
        parsed.reason,
      ]
    );

    await audit(tx, user.id, 'distribution.relation-created', id, {
      parentId: parsed.parentOrganizationId,
      childId: parsed.childOrganizationId,
      status: parsed.status,
      reason: parsed.reason,
    });

    return { id, version: 1 };
  });
}

// ============================================================================
// MANAGEMENT RELATIONS (Separated from Commercial Distribution)
// ============================================================================

export interface ManagementRelationRecord {
  id: string;
  parent_entity_id: string;
  child_entity_id: string;
  entity_type: 'ORGANIZATION' | 'USER' | 'TEAM';
  status: 'ACTIVE' | 'INACTIVE';
  starts_at: string;
  ends_at: string | null;
  created_by: string;
  version: number;
}

export async function createManagementRelation(
  user: Principal,
  input: {
    parentEntityId: string;
    childEntityId: string;
    entityType?: 'ORGANIZATION' | 'USER' | 'TEAM';
    reason: string;
    idempotencyKey?: string;
  }
): Promise<{ id: string; version: number }> {
  assertPermission(user, 'distribution.network.manage');
  if (input.parentEntityId === input.childEntityId) {
    throw new CrmError('MANAGEMENT_SELF_PARENT_BLOCKED', 400);
  }

  const db = await database();
  return db.transaction(async sql => {
    await assertCurrentPrincipal(sql, user);

    const id = randomUUID();
    const entityType = input.entityType || 'ORGANIZATION';

    await sql.query(
      `INSERT INTO cohamy_crm.management_relations(
        id, parent_entity_id, child_entity_id, entity_type, status, starts_at, created_by, version
      ) VALUES ($1, $2, $3, $4, 'ACTIVE', now(), $5, 1)`,
      [id, input.parentEntityId, input.childEntityId, entityType, user.id]
    );

    await audit(sql, user.id, 'management.relation-created', id, {
      parentEntityId: input.parentEntityId,
      childEntityId: input.childEntityId,
      entityType,
      reason: input.reason,
    });

    return { id, version: 1 };
  });
}

export async function getManagementHierarchy(
  sql: Sql,
  childEntityId: string
): Promise<string[]> {
  const managers: string[] = [];
  const visited = new Set<string>([childEntityId]);
  const queue = [childEntityId];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const res = await sql.query<{ parent_entity_id: string }>(
      `SELECT parent_entity_id FROM cohamy_crm.management_relations
       WHERE child_entity_id = $1 AND status = 'ACTIVE' AND (ends_at IS NULL OR ends_at > now())`,
      [curr]
    );
    for (const r of res.rows) {
      if (!visited.has(r.parent_entity_id)) {
        visited.add(r.parent_entity_id);
        managers.push(r.parent_entity_id);
        queue.push(r.parent_entity_id);
      }
    }
  }

  return managers;
}

// ============================================================================
// DEALER DOWNSTREAM NETWORK MANAGEMENT
// ============================================================================

const createDownstreamSchema = z.object({
  parentOrganizationId: z.uuid(),
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  partnerType: z.enum(['DEALER_L2', 'STORE', 'END_CUSTOMER']),
  phone: z.string().trim().max(30).default(''),
  email: z.string().trim().max(120).default(''),
  address: z.string().trim().max(255).default(''),
  pricingTierId: z.uuid().nullable().optional(),
  creditEnabled: z.boolean().default(false),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.uuid().optional(),
}).strict();

export async function createDownstreamPartner(
  user: Principal,
  input: unknown
): Promise<{ organization: Organization; relationId: string }> {
  assertPermission(user, 'distribution.network.manage');
  const d = createDownstreamSchema.parse(input);

  // Authority check: user must belong to parentOrganizationId or be central ADMIN
  if (user.role !== 'ADMIN') {
    if (user.organizationId !== d.parentOrganizationId || user.role !== 'DEALER_OWNER') {
      throw new CrmError('FORBIDDEN', 403);
    }
  }

  // Downstream cannot be COHAMY or SUPER_ADMIN
  if ((d.partnerType as string) === 'COHAMY') {
    throw new CrmError('CANNOT_CREATE_SYSTEM_ORG', 400);
  }

  const db = await database();
  return db.transaction(async sql => {
    await assertCurrentPrincipal(sql, user);

    const childOrgId = randomUUID();
    const kind = d.partnerType === 'END_CUSTOMER' ? 'CUSTOMER' : 'DEALER';

    const orgRow = (await sql.query<Organization>(
      `INSERT INTO cohamy_crm.organizations(
        id, code, name, kind, phone, email, address, active, version,
        partner_type, pricing_tier_id, credit_enabled, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, 1, $8, $9, $10, now())
      RETURNING *`,
      [
        childOrgId, d.code, d.name, kind, d.phone, d.email, d.address,
        d.partnerType, d.pricingTierId ?? null, d.creditEnabled
      ]
    )).rows[0];

    // Establish distribution relation immediately
    await assertNoDistributionCycle(sql, d.parentOrganizationId, childOrgId);

    const relationId = randomUUID();
    await sql.query(
      `INSERT INTO cohamy_crm.distribution_relations(
        id, parent_organization_id, child_organization_id, network_code, status,
        starts_at, created_by, approved_by, version, created_at, updated_at
      ) VALUES ($1, $2, $3, 'DEFAULT', 'ACTIVE', now(), $4, $4, 1, now(), now())`,
      [relationId, d.parentOrganizationId, childOrgId, user.id]
    );

    await audit(sql, user.id, 'distribution.downstream-created', childOrgId, {
      parentId: d.parentOrganizationId,
      childId: childOrgId,
      partnerType: d.partnerType,
      relationId,
    });

    return { organization: orgRow, relationId };
  });
}

// ============================================================================
// DOWNSTREAM DISCOUNT CEILING POLICIES & EXCEPTIONS
// ============================================================================

export async function setDiscountCeilingPolicy(
  user: Principal,
  input: {
    sellerOrganizationId: string;
    enabled: boolean;
    comparisonBasis?: 'RATE_OR_FLOOR' | 'RATE_ONLY' | 'FLOOR_PRICE_ONLY';
  }
): Promise<{ id: string; version: number }> {
  assertPermission(user, 'discount.ceiling.manage');
  const db = await database();

  return db.transaction(async sql => {
    await assertCurrentPrincipal(sql, user);

    const basis = input.comparisonBasis || 'RATE_OR_FLOOR';
    const existing = (await sql.query<{ id: string; version: number }>(
      'SELECT id, version FROM cohamy_crm.discount_ceiling_policies WHERE seller_organization_id = $1',
      [input.sellerOrganizationId]
    )).rows[0];

    if (existing) {
      await sql.query(
        `UPDATE cohamy_crm.discount_ceiling_policies
         SET enabled = $1, comparison_basis = $2, version = version + 1, updated_at = now()
         WHERE id = $3`,
        [input.enabled, basis, existing.id]
      );
      await audit(sql, user.id, 'discount_ceiling.policy-updated', existing.id, { enabled: input.enabled, basis });
      return { id: existing.id, version: existing.version + 1 };
    }

    const id = randomUUID();
    await sql.query(
      `INSERT INTO cohamy_crm.discount_ceiling_policies(
        id, seller_organization_id, enabled, comparison_basis, version, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 1, $5, now(), now())`,
      [id, input.sellerOrganizationId, input.enabled, basis, user.id]
    );

    await audit(sql, user.id, 'discount_ceiling.policy-created', id, { enabled: input.enabled, basis });
    return { id, version: 1 };
  });
}

export async function requestDiscountCeilingException(
  user: Principal,
  input: {
    sellerOrganizationId: string;
    buyerOrganizationId: string;
    sku: string;
    requestedRate: number;
    reason: string;
  }
): Promise<{ id: string; status: string }> {
  assertPermission(user, 'deals.write');
  const db = await database();

  return db.transaction(async sql => {
    await assertCurrentPrincipal(sql, user);

    const id = randomUUID();
    await sql.query(
      `INSERT INTO cohamy_crm.discount_ceiling_exceptions(
        id, seller_organization_id, buyer_organization_id, sku, requested_rate,
        status, requested_by, reason, starts_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7, now(), now(), now())`,
      [id, input.sellerOrganizationId, input.buyerOrganizationId, input.sku, input.requestedRate, user.id, input.reason]
    );

    await audit(sql, user.id, 'discount_ceiling.exception-requested', id, {
      requestedRate: input.requestedRate,
      sku: input.sku,
      reason: input.reason,
    });

    return { id, status: 'PENDING' };
  });
}

export async function approveDiscountCeilingException(
  user: Principal,
  input: {
    exceptionId: string;
    approvedRate: number;
    reason: string;
  }
): Promise<{ id: string; status: string }> {
  assertPermission(user, 'discount.ceiling.manage');
  const db = await database();

  return db.transaction(async sql => {
    await assertCurrentPrincipal(sql, user);

    const row = (await sql.query<{ id: string; status: string }>(
      'SELECT id, status FROM cohamy_crm.discount_ceiling_exceptions WHERE id = $1',
      [input.exceptionId]
    )).rows[0];
    if (!row) throw new CrmError('NOT_FOUND', 404);
    if (row.status !== 'PENDING') throw new CrmError('ALREADY_PROCESSED', 409);

    await sql.query(
      `UPDATE cohamy_crm.discount_ceiling_exceptions
       SET status = 'APPROVED', approved_rate = $1, approved_by = $2, updated_at = now()
       WHERE id = $3`,
      [input.approvedRate, user.id, input.exceptionId]
    );

    await audit(sql, user.id, 'discount_ceiling.exception-approved', input.exceptionId, {
      approvedRate: input.approvedRate,
      reason: input.reason,
    });

    return { id: input.exceptionId, status: 'APPROVED' };
  });
}

export async function validateDownstreamDiscount(
  sql: Sql,
  sellerOrgId: string,
  buyerOrgId: string,
  sku: string,
  proposedRate: number
): Promise<{ valid: boolean; reason?: string; requiresException?: boolean }> {
  // Check policy
  const policy = (await sql.query<{ enabled: boolean; comparison_basis: string }>(
    'SELECT enabled, comparison_basis FROM cohamy_crm.discount_ceiling_policies WHERE seller_organization_id = $1',
    [sellerOrgId]
  )).rows[0];

  // Default: if policy exists and is disabled -> valid
  if (policy && !policy.enabled) {
    return { valid: true };
  }

  // If enabled (or default enabled for tiered distribution):
  // Check if seller is Cohamy (root) -> can assign any rate
  const sellerOrg = (await sql.query<{ kind: string }>('SELECT kind FROM cohamy_crm.organizations WHERE id = $1', [sellerOrgId])).rows[0];
  if (sellerOrg?.kind === 'COHAMY') {
    return { valid: true };
  }

  // Get active upstream policy granted to sellerOrgId
  const upstreamPolicy = (await sql.query<{ fixed_percent_bp: number }>(
    `SELECT fixed_percent_bp FROM cohamy_crm.account_discount_policies
     WHERE buyer_organization_id = $1 AND status = 'ACTIVE'
     ORDER BY starts_at DESC LIMIT 1`,
    [sellerOrgId]
  )).rows[0];

  const upstreamRate = upstreamPolicy ? upstreamPolicy.fixed_percent_bp / 100 : 0;

  if (proposedRate <= upstreamRate) {
    return { valid: true };
  }

  // Check if an approved exception exists
  const exception = (await sql.query<{ id: string; approved_rate: string }>(
    `SELECT id, approved_rate FROM cohamy_crm.discount_ceiling_exceptions
     WHERE seller_organization_id = $1 AND buyer_organization_id = $2
       AND sku = $3 AND status = 'APPROVED'
       AND (ends_at IS NULL OR ends_at > now())
     ORDER BY created_at DESC LIMIT 1`,
    [sellerOrgId, buyerOrgId, sku]
  )).rows[0];

  if (exception && Number(exception.approved_rate) >= proposedRate) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: `Proposed rate ${proposedRate}% exceeds upstream received rate ${upstreamRate}%`,
    requiresException: true,
  };
}
