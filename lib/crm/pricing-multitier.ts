import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { database, type Sql } from './db';
import { assertCurrentPrincipal, audit } from './auth';
import { CrmError } from './permissions';
import { integer, fixed, lineAmount, percentage, type Rounding } from './decimal';
import { parseCommercial as parse, commercialManager as manager } from './commercial-common';
import type { Principal } from './types';
import type { PriceCalculation, PricedLine, Basket } from './pricing-model';
import { eligiblePriceBook, loadPriceProducts, pricingOrganization, type PriceBook, type PriceVersion } from './pricing';

export interface TierRule {
  minQuantity: string;
  maxQuantity: string | null;
  discountPercent: number; // e.g. 30 for 30%
}

export interface AccountDiscountPolicy {
  id: string;
  organization_id: string;
  policy_type: 'FIXED_PERCENT' | 'QUANTITY_TIER';
  fixed_percent: string | null;
  tier_config: TierRule[] | null;
  combination_mode?: 'SEQUENTIAL_STACK' | 'EXCLUSIVE' | 'BEST_BENEFIT';
  exclusive_priority?: 'ACCOUNT_DISCOUNT' | 'PRODUCT_PROMOTION';
  starts_at: string;
  ends_at: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
}

export interface ProductPromotion {
  id: string;
  sku: string;
  discount_percent: string;
  starts_at: string;
  ends_at: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
}

export interface TwoLayerPricedLine extends PricedLine {
  listUnitPrice: string;
  netUnitPrice?: string;
  promoDiscountPercent: number;
  priceAfterPromo: string;
  accountDiscountPercent: number;
  combinationMode?: 'SEQUENTIAL_STACK' | 'EXCLUSIVE' | 'BEST_BENEFIT';
  appliedPromoPercent?: number;
  appliedAccountPercent?: number;
  matchedTierMinQuantity?: string;
  matchedTierMaxQuantity?: string | null;
}

export interface TwoLayerPriceCalculation extends PriceCalculation {
  lines: TwoLayerPricedLine[];
  twoLayerMeta: {
    appliedPromotionSkus: string[];
    accountPolicyType: 'FIXED_PERCENT' | 'QUANTITY_TIER' | 'NONE';
    accountPolicyId: string | null;
    combinationMode: 'SEQUENTIAL_STACK' | 'EXCLUSIVE' | 'BEST_BENEFIT';
    exclusivePriority: 'ACCOUNT_DISCOUNT' | 'PRODUCT_PROMOTION' | null;
  };
}

const tierRuleSchema = z.object({
  minQuantity: z.string().regex(/^\d{1,18}(?:\.\d{1,6})?$/),
  maxQuantity: z.string().regex(/^\d{1,18}(?:\.\d{1,6})?$/).nullable().optional(),
  discountPercent: z.number().min(0).max(100),
}).strict();

const accountDiscountPolicySchema = z.object({
  id: z.uuid().optional(),
  organizationId: z.uuid(),
  policyType: z.enum(['FIXED_PERCENT', 'QUANTITY_TIER']),
  fixedPercent: z.number().min(0).max(100).optional(),
  tierConfig: z.array(tierRuleSchema).max(20).optional(),
  startsAt: z.iso.datetime({ offset: true }).optional(),
  endsAt: z.iso.datetime({ offset: true }).nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.uuid(),
}).strict().superRefine((data, ctx) => {
  if (data.policyType === 'FIXED_PERCENT' && data.fixedPercent === undefined) {
    ctx.addIssue({ code: 'custom', message: 'fixedPercent is required for FIXED_PERCENT policy' });
  }
  if (data.policyType === 'QUANTITY_TIER' && (!data.tierConfig || data.tierConfig.length === 0)) {
    ctx.addIssue({ code: 'custom', message: 'tierConfig is required for QUANTITY_TIER policy' });
  }
});

const productPromotionSchema = z.object({
  id: z.uuid().optional(),
  sku: z.string().trim().min(2).max(80),
  discountPercent: z.number().min(0).max(100),
  startsAt: z.iso.datetime({ offset: true }).optional(),
  endsAt: z.iso.datetime({ offset: true }).nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.uuid(),
}).strict();

/**
 * Configure Account Discount Policy (Layer B)
 */
export async function saveAccountDiscountPolicy(user: Principal, input: unknown) {
  manager(user);
  const data = parse(accountDiscountPolicySchema, input);
  const db = await database();

  return db.transaction(async tx => {
    await assertCurrentPrincipal(tx, user);
    await pricingOrganization(tx, user, data.organizationId);

    // Deactivate previous active policies for this buyer organization if saving ACTIVE
    if (data.status === 'ACTIVE') {
      await tx.query(
        `UPDATE cohamy_crm.account_discount_policies
         SET status = 'INACTIVE', ends_at = now(), version = version + 1, updated_at = now()
         WHERE buyer_organization_id = $1 AND status = 'ACTIVE'`,
        [data.organizationId]
      );
    }

    const cohamy = (await tx.query<{ id: string }>("SELECT id FROM cohamy_crm.organizations WHERE kind = 'COHAMY' LIMIT 1")).rows[0];
    const sellerOrgId = user.organizationId ?? cohamy?.id ?? data.organizationId;
    const fixedPercentBp = data.fixedPercent !== undefined ? Math.round(data.fixedPercent * 100) : 0;
    const id = data.id ?? randomUUID();
    const tierConfigJson = JSON.stringify(data.tierConfig ?? []);

    await tx.query(
      `INSERT INTO cohamy_crm.account_discount_policies(
        id, name, seller_organization_id, buyer_organization_id, method,
        fixed_percent_bp, tiers, starts_at, ends_at, status, created_by, version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, COALESCE($8, now()), $9, $10, $11, 1)`,
      [
        id,
        `CSCK ${data.policyType} ${data.organizationId.slice(0, 8)}`,
        sellerOrgId,
        data.organizationId,
        data.policyType,
        fixedPercentBp,
        tierConfigJson,
        data.startsAt ?? null,
        data.endsAt ?? null,
        data.status,
        user.id,
      ]
    );

    await audit(tx, user.id, 'pricing.account-policy-saved', id, {
      organizationId: data.organizationId,
      policyType: data.policyType,
      fixedPercent: data.fixedPercent,
      reason: data.reason,
    });

    return { id, version: 1 };
  });
}

/**
 * Configure Product Promotion (Layer A)
 */
export async function saveProductPromotion(user: Principal, input: unknown) {
  manager(user);
  const data = parse(productPromotionSchema, input);
  const db = await database();

  return db.transaction(async tx => {
    await assertCurrentPrincipal(tx, user);

    // Validate SKU exists
    const p = (await tx.query<{ id: string }>('SELECT id FROM cohamy_crm.products WHERE sku = $1 AND active', [data.sku])).rows[0];
    if (!p) throw new CrmError('SKU_UNCONFIGURED', 404);

    if (data.status === 'ACTIVE') {
      await tx.query(
        `UPDATE cohamy_crm.product_promotions
         SET active = false, ends_at = now(), version = version + 1, updated_at = now()
         WHERE product_id = $1 AND active = true`,
        [p.id]
      );
    }

    const cohamy = (await tx.query<{ id: string }>("SELECT id FROM cohamy_crm.organizations WHERE kind = 'COHAMY' LIMIT 1")).rows[0];
    const sellerOrgId = user.organizationId ?? cohamy?.id ?? randomUUID();
    const promoPercentBp = Math.round(data.discountPercent * 100);
    const id = data.id ?? randomUUID();
    const startsAt = data.startsAt ?? new Date().toISOString();
    const endsAt = data.endsAt ?? new Date(Date.now() + 365 * 86400000).toISOString();

    await tx.query(
      `INSERT INTO cohamy_crm.product_promotions(
        id, name, seller_organization_id, product_id, promo_percent_bp,
        starts_at, ends_at, is_system_wide, active, created_by, version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, 1)`,
      [
        id,
        `KM ${data.sku} - ${data.discountPercent}%`,
        sellerOrgId,
        p.id,
        promoPercentBp,
        startsAt,
        endsAt,
        data.status === 'ACTIVE',
        user.id,
      ]
    );

    await audit(tx, user.id, 'pricing.product-promotion-saved', id, {
      sku: data.sku,
      discountPercent: data.discountPercent,
      reason: data.reason,
    });

    return { id, version: 1 };
  });
}

/**
 * Fetch active account discount policy
 */
export async function getActiveAccountDiscountPolicy(
  sql: Sql,
  organizationId: string,
  at?: Date
): Promise<AccountDiscountPolicy | null> {
  const now = at ?? new Date();
  const res = await sql.query<{
    id: string;
    buyer_organization_id: string;
    method: 'FIXED_PERCENT' | 'QUANTITY_TIER';
    fixed_percent_bp: number;
    tiers: TierRule[];
    starts_at: string;
    ends_at: string | null;
    status: 'ACTIVE' | 'INACTIVE';
    version: number;
  }>(
    `SELECT id, buyer_organization_id, method, fixed_percent_bp, tiers, starts_at, ends_at, status, version
     FROM cohamy_crm.account_discount_policies
     WHERE buyer_organization_id = $1
       AND status = 'ACTIVE'
       AND starts_at <= $2
       AND (ends_at IS NULL OR ends_at > $2)
     ORDER BY starts_at DESC, id DESC
     LIMIT 1`,
    [organizationId, now]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    organization_id: row.buyer_organization_id,
    policy_type: row.method,
    fixed_percent: (row.fixed_percent_bp / 100).toString(),
    tier_config: row.tiers,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    status: row.status,
    version: row.version,
  };
}

/**
 * Fetch active product promotions for a list of SKUs
 */
export async function getActiveProductPromotions(
  sql: Sql,
  skus: string[],
  at?: Date
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (skus.length === 0) return map;

  const now = at ?? new Date();
  const res = await sql.query<{ sku: string; promo_percent_bp: number }>(
    `SELECT p.sku, pp.promo_percent_bp
     FROM cohamy_crm.product_promotions pp
     JOIN cohamy_crm.products p ON p.id = pp.product_id
     WHERE p.sku = ANY($1::text[])
       AND pp.active = true
       AND pp.starts_at <= $2
       AND (pp.ends_at IS NULL OR pp.ends_at > $2)
     ORDER BY pp.starts_at DESC, pp.id DESC`,
    [[...new Set(skus)], now]
  );

  for (const row of res.rows) {
    if (!map.has(row.sku)) {
      map.set(row.sku, row.promo_percent_bp / 100);
    }
  }
  return map;
}

/**
 * Evaluate half-open interval [min, max) for quantity tier
 */
export function matchQuantityTier(
  tiers: TierRule[],
  totalBaseQuantity: bigint | string | number
): TierRule | null {
  const scaledQty: bigint = typeof totalBaseQuantity === 'string' || typeof totalBaseQuantity === 'number'
    ? fixed(totalBaseQuantity.toString())
    : totalBaseQuantity;
  for (const tier of tiers) {
    const minQ = fixed(tier.minQuantity);
    const maxQ = tier.maxQuantity ? fixed(tier.maxQuantity) : null;
    if (scaledQty >= minQ) {
      if (maxQ === null || scaledQty < maxQ) {
        return tier;
      }
    }
  }
  return null;
}

/**
 * Apply 2-layer sequential pricing on a base calculation:
 * Layer A: Product Promotion (P_promo = list_price * (1 - promo%))
 * Layer B: Account Discount (P_final = P_promo * (1 - account%))
 * Half-open quantity interval [min, max) based on aggregated base quantity of same SKU.
 */
export function applyTwoLayerPricing(
  baseCalculation: PriceCalculation,
  accountPolicy: AccountDiscountPolicy | null,
  promotions: Map<string, number>,
  rounding: Rounding = 'HALF_UP',
  options?: {
    combinationMode?: 'SEQUENTIAL_STACK' | 'EXCLUSIVE' | 'BEST_BENEFIT';
    exclusivePriority?: 'ACCOUNT_DISCOUNT' | 'PRODUCT_PROMOTION';
  }
): TwoLayerPriceCalculation {
  // Aggregate base quantity per SKU across non-gift lines
  const skuTotals = new Map<string, bigint>();
  for (const line of baseCalculation.lines) {
    if (!line.gift) {
      const current = skuTotals.get(line.sku) ?? 0n;
      skuTotals.set(line.sku, current + fixed(line.baseQuantity));
    }
  }

  const mode = options?.combinationMode ?? accountPolicy?.combination_mode ?? 'SEQUENTIAL_STACK';
  const priority = options?.exclusivePriority ?? accountPolicy?.exclusive_priority ?? 'ACCOUNT_DISCOUNT';

  const appliedPromotionSkus: string[] = [];
  const updatedLines: TwoLayerPricedLine[] = [];

  for (const line of baseCalculation.lines) {
    if (line.gift) {
      updatedLines.push({
        ...line,
        listUnitPrice: '0',
        promoDiscountPercent: 0,
        priceAfterPromo: '0',
        accountDiscountPercent: 0,
        combinationMode: mode,
        appliedPromoPercent: 0,
        appliedAccountPercent: 0,
      });
      continue;
    }

    const listUnitPrice = line.regularUnitPrice; // P0
    const promoPercent = promotions.get(line.sku) ?? 0;
    if (promoPercent > 0) {
      appliedPromotionSkus.push(line.sku);
    }

    // Step 1: Layer A - Promo discount
    const promoBasisPoints = Math.round(promoPercent * 100);
    const promoDiscountAmount = percentage(listUnitPrice, promoBasisPoints, rounding);
    const priceAfterPromo = (integer(listUnitPrice) - integer(promoDiscountAmount)).toString();

    // Step 2: Layer B - Account discount
    let accountDiscountPercent = 0;
    let matchedTier: TierRule | null = null;

    if (accountPolicy && accountPolicy.status === 'ACTIVE') {
      if (accountPolicy.policy_type === 'FIXED_PERCENT' && accountPolicy.fixed_percent !== null) {
        accountDiscountPercent = Number(accountPolicy.fixed_percent);
      } else if (accountPolicy.policy_type === 'QUANTITY_TIER' && accountPolicy.tier_config) {
        const totalSkuQuantity = skuTotals.get(line.sku) ?? fixed(line.baseQuantity);
        matchedTier = matchQuantityTier(accountPolicy.tier_config, totalSkuQuantity);
        if (matchedTier) {
          accountDiscountPercent = matchedTier.discountPercent;
        }
      }
    }

    const accountBasisPoints = Math.round(accountDiscountPercent * 100);

    let finalUnitPrice = listUnitPrice;
    let appliedPromo = 0;
    let appliedAccount = 0;

    if (mode === 'SEQUENTIAL_STACK') {
      // P_final = P_promo * (1 - account)
      const accountDiscountAmount = percentage(priceAfterPromo, accountBasisPoints, rounding);
      finalUnitPrice = (integer(priceAfterPromo) - integer(accountDiscountAmount)).toString();
      appliedPromo = promoPercent;
      appliedAccount = accountDiscountPercent;
    } else if (mode === 'EXCLUSIVE') {
      if (priority === 'ACCOUNT_DISCOUNT') {
        if (accountDiscountPercent > 0) {
          const disc = percentage(listUnitPrice, accountBasisPoints, rounding);
          finalUnitPrice = (integer(listUnitPrice) - integer(disc)).toString();
          appliedAccount = accountDiscountPercent;
        } else if (promoPercent > 0) {
          const disc = percentage(listUnitPrice, promoBasisPoints, rounding);
          finalUnitPrice = (integer(listUnitPrice) - integer(disc)).toString();
          appliedPromo = promoPercent;
        }
      } else {
        // priority === 'PRODUCT_PROMOTION'
        if (promoPercent > 0) {
          const disc = percentage(listUnitPrice, promoBasisPoints, rounding);
          finalUnitPrice = (integer(listUnitPrice) - integer(disc)).toString();
          appliedPromo = promoPercent;
        } else if (accountDiscountPercent > 0) {
          const disc = percentage(listUnitPrice, accountBasisPoints, rounding);
          finalUnitPrice = (integer(listUnitPrice) - integer(disc)).toString();
          appliedAccount = accountDiscountPercent;
        }
      }
    } else if (mode === 'BEST_BENEFIT') {
      const discPromo = percentage(listUnitPrice, promoBasisPoints, rounding);
      const pPromo = integer(listUnitPrice) - integer(discPromo);

      const discAccount = percentage(listUnitPrice, accountBasisPoints, rounding);
      const pAccount = integer(listUnitPrice) - integer(discAccount);

      if (pAccount <= pPromo && accountDiscountPercent > 0) {
        finalUnitPrice = pAccount.toString();
        appliedAccount = accountDiscountPercent;
      } else if (promoPercent > 0) {
        finalUnitPrice = pPromo.toString();
        appliedPromo = promoPercent;
      }
    }

    // Recalculate line gross & net amounts
    const gross = lineAmount(finalUnitPrice, line.baseQuantity, rounding);
    const net = gross;
    const total = gross;

    updatedLines.push({
      ...line,
      listUnitPrice,
      promoDiscountPercent: promoPercent,
      priceAfterPromo,
      accountDiscountPercent,
      combinationMode: mode,
      appliedPromoPercent: appliedPromo,
      appliedAccountPercent: appliedAccount,
      matchedTierMinQuantity: matchedTier ? matchedTier.minQuantity : undefined,
      matchedTierMaxQuantity: matchedTier ? matchedTier.maxQuantity : undefined,
      unitPrice: finalUnitPrice,
      regularUnitPrice: finalUnitPrice,
      netUnitPrice: finalUnitPrice,
      gross,
      discount: '0',
      net,
      tax: '0',
      total,
    });
  }

  // Recalculate totals
  const subtotal = updatedLines.reduce((sum, l) => sum + integer(l.gross), 0n);
  const orderDiscount = '0';
  const total = subtotal.toString();

  return {
    ...baseCalculation,
    lines: updatedLines,
    subtotal: subtotal.toString(),
    discount: orderDiscount,
    total,
    twoLayerMeta: {
      appliedPromotionSkus: [...new Set(appliedPromotionSkus)],
      accountPolicyType: accountPolicy ? accountPolicy.policy_type : 'NONE',
      accountPolicyId: accountPolicy ? accountPolicy.id : null,
      combinationMode: mode,
      exclusivePriority: mode === 'EXCLUSIVE' ? priority : null,
    },
  };
}

/**
 * High-level helper: calculate 2-layer price for an organization
 */
export async function calculateTwoLayerForOrganization(
  sql: Sql,
  user: Principal,
  organizationId: string,
  basket: Basket,
  at?: Date
): Promise<{
  book: PriceBook;
  priceVersion: PriceVersion;
  calculation: TwoLayerPriceCalculation;
}> {
  const chosen = await eligiblePriceBook(sql, user, organizationId, at);
  const products = await loadPriceProducts(
    sql,
    [...basket.lines.map(l => l.sku), ...chosen.priceVersion.definition.gifts.map(g => g.giftSku)],
    true
  );

  const { calculatePrice } = await import('./pricing-model');
  const baseCalc = calculatePrice(chosen.priceVersion.definition, basket, products);

  // Fetch Layer A promotions & Layer B account policy
  const skus = basket.lines.map(l => l.sku);
  const [promotions, accountPolicy] = await Promise.all([
    getActiveProductPromotions(sql, skus, at),
    getActiveAccountDiscountPolicy(sql, organizationId, at),
  ]);

  const twoLayerCalc = applyTwoLayerPricing(baseCalc, accountPolicy, promotions, chosen.priceVersion.definition.rounding);

  return {
    ...chosen,
    calculation: twoLayerCalc,
  };
}
