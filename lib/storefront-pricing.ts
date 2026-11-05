export interface StorefrontItem {
  productId: string;
  crmProductId: string | null;
  basePrice: number | null;
  netSalePrice: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  listPrice: number | null;
  salePrice: number | null;
  discountPercent: number;
  available: boolean;
}

export interface PublicStorefront {
  discountPercent: number;
  version: number;
  quoteVersion: string;
  intakeEnabled: boolean;
  items: StorefrontItem[];
}

// Explicit package identities: legacy website ids in the CRM are not the current
// public package ids. Never guess a price by product name or similar SKU.
export const STOREFRONT_PRODUCTS = [
  {productId: 'cohamy-cashew-chocolate-80g', crmWebsiteId: 'cohamy-cashew-chocolate', weight: '80g'},
  {productId: 'cohamy-almond-chocolate-80g', crmWebsiteId: 'cohamy-almond-chocolate', weight: '80g'},
  {productId: 'cohamy-almond-durian-chocolate-80g', crmWebsiteId: 'cohamy-almond-durian-chocolate', weight: '80g'},
  {productId: 'cohamy-almond-matcha-chocolate-80g', crmWebsiteId: 'cohamy-almond-matcha-chocolate', weight: '80g'},
  {productId: 'cohamy-almond-strawberry-chocolate-80g', crmWebsiteId: 'cohamy-almond-strawberry-chocolate', weight: '80g'},
  {productId: 'cohamy-macadamia-chocolate-80g', crmWebsiteId: 'jamy-macadamia-chocolate', weight: '80g'},
  {productId: 'cohamy-mango-chocolate-80g', crmWebsiteId: 'jamy-mango-dried-chocolate', weight: '80g'},
  {productId: 'cohamy-chocolate-candy-65g', crmWebsiteId: 'cohamy-rainbow-chocolate', weight: '65g'},
] as const;

function safeNumber(value: bigint): number {
  if (value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('STOREFRONT_AMOUNT_INVALID');
  return Number(value);
}

/** Round positive VND amounts half up; never calculate money with floating point. */
export function calculateStorefrontPrice(basePrice: number, discountPercent: number, vatRate: string) {
  if (!Number.isSafeInteger(basePrice) || basePrice <= 0 || !Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 99 || !/^\d{1,3}(?:\.\d{1,2})?$/.test(vatRate)) throw new Error('STOREFRONT_AMOUNT_INVALID');
  const [whole, fraction = ''] = vatRate.split('.');
  const rate = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'));
  if (rate > BigInt(10000)) throw new Error('STOREFRONT_AMOUNT_INVALID');
  const base = BigInt(basePrice), net = (base * BigInt(100 - discountPercent) + BigInt(50)) / BigInt(100);
  if (net <= BigInt(0)) throw new Error('STOREFRONT_AMOUNT_INVALID');
  const tax = (net * rate + BigInt(5000)) / BigInt(10000);
  const listTax = (base * rate + BigInt(5000)) / BigInt(10000);
  return {basePrice, netSalePrice: safeNumber(net), vatRate: Number(rate) / 100, vatAmount: safeNumber(tax), listPrice: safeNumber(base + listTax), salePrice: safeNumber(net + tax)};
}
