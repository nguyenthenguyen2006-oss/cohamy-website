import 'server-only';
import {z} from 'zod';
import {database, type Sql} from './db';
import {assertCurrentPrincipal, audit, digest} from './auth';
import {CrmError} from './permissions';
import type {Principal} from './types';
import {calculateStorefrontPrice, STOREFRONT_PRODUCTS, type PublicStorefront, type StorefrontItem} from '@/lib/storefront-pricing';

type SettingsRow = {discount_percent: number; version: number; updated_at: string};
type ProductRow = {id: string; website_id: string; retail_price: string | null; vat_rate: string; active: boolean; weight_label: string; version: number};

function admin(user: Principal) {
  if (user.area !== 'crm' || user.role !== 'ADMIN') throw new CrmError('FORBIDDEN', 403);
}

/** Public read contains only current package identities and consumer prices. */
export async function resolvePublicStorefront(sql: Sql, lock = false): Promise<PublicStorefront> {
  const settings = (await sql.query<SettingsRow>("SELECT discount_percent,version,updated_at FROM cohamy_crm.storefront_settings WHERE id='PUBLIC'" + (lock ? ' FOR SHARE' : ''))).rows[0];
  if (!settings) throw new CrmError('STOREFRONT_UNAVAILABLE', 503);
  const rows = (await sql.query<ProductRow>('SELECT id,website_id,retail_price::text,vat_rate::text,active,weight_label,version FROM cohamy_crm.products WHERE website_id=ANY($1::text[]) ORDER BY website_id' + (lock ? ' FOR SHARE' : ''), [STOREFRONT_PRODUCTS.map(item => item.crmWebsiteId)])).rows;
  const items: StorefrontItem[] = STOREFRONT_PRODUCTS.map(mapping => {
    const row = rows.find(item => item.website_id === mapping.crmWebsiteId);
    let price: ReturnType<typeof calculateStorefrontPrice> | undefined;
    if (row && row.active && row.weight_label.replace(/\s/g, '').toLowerCase() === mapping.weight && row.retail_price && /^\d+(?:\.0+)?$/.test(row.retail_price)) {
      try { price = calculateStorefrontPrice(Number(row.retail_price), settings.discount_percent, row.vat_rate); } catch { /* An invalid price is unavailable, never a free item. */ }
    }
    return {productId: mapping.productId, crmProductId: row?.id ?? null, basePrice: null, netSalePrice: null, vatRate: null, vatAmount: null, listPrice: null, salePrice: null, discountPercent: settings.discount_percent, available: !!price, ...price};
  });
  return {discountPercent: settings.discount_percent, version: settings.version, quoteVersion: digest(JSON.stringify({version: settings.version, discountPercent: settings.discount_percent, rows, items})), intakeEnabled: process.env.CRM_WEBSITE_ORDER_INTAKE === 'true', items};
}

export async function getPublicStorefront(): Promise<PublicStorefront> {
  // Shared row locks keep settings and catalog coherent throughout the read.
  return (await database()).transaction(sql => resolvePublicStorefront(sql, true));
}

export async function getStorefrontSettings(user: Principal) {
  admin(user);
  return (await database()).transaction(async sql => {
    await assertCurrentPrincipal(sql, user);
    const publicState = await resolvePublicStorefront(sql, true);
    const row = (await sql.query<SettingsRow>("SELECT updated_at FROM cohamy_crm.storefront_settings WHERE id='PUBLIC'")).rows[0];
    return {...publicState, updatedAt: row.updated_at};
  });
}

const storefrontSettingsSchema = z.object({version: z.number().int().positive(), discountPercent: z.number().int().min(0).max(99), idempotencyKey: z.uuid()}).strict();
export async function saveStorefrontSettings(user: Principal, input: unknown) {
  admin(user);
  const parsed = storefrontSettingsSchema.safeParse(input);
  if (!parsed.success) throw new CrmError('INVALID_FIELDS', 400);
  const d = parsed.data, hash = digest(JSON.stringify(d));
  return (await database()).transaction(async sql => {
    await assertCurrentPrincipal(sql, user);
    const row = (await sql.query<SettingsRow>("SELECT discount_percent,version,updated_at FROM cohamy_crm.storefront_settings WHERE id='PUBLIC' FOR UPDATE")).rows[0];
    if (!row) throw new CrmError('STOREFRONT_UNAVAILABLE', 503);
    const previous = (await sql.query<{request_hash: string; result: {version: number; discountPercent: number}}>('SELECT request_hash,result FROM cohamy_crm.storefront_setting_actions WHERE actor_id=$1 AND key=$2', [user.id, d.idempotencyKey])).rows[0];
    if (previous) {
      if (previous.request_hash !== hash) throw new CrmError('IDEMPOTENCY_CONFLICT', 409);
      return previous.result;
    }
    if (row.version !== d.version) throw new CrmError('VERSION_CONFLICT', 409);
    await sql.query("UPDATE cohamy_crm.storefront_settings SET discount_percent=$1,version=version+1,updated_by=$2,updated_at=now() WHERE id='PUBLIC'", [d.discountPercent, user.id]);
    const result = {version: row.version + 1, discountPercent: d.discountPercent};
    await sql.query('INSERT INTO cohamy_crm.storefront_setting_actions(actor_id,key,request_hash,result) VALUES($1,$2,$3,$4::jsonb)', [user.id, d.idempotencyKey, hash, JSON.stringify(result)]);
    await audit(sql, user.id, 'storefront.discount-saved', 'PUBLIC', {before: {version: row.version, discountPercent: row.discount_percent}, after: result});
    return result;
  });
}
