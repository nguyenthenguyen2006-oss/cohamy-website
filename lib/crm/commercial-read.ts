import 'server-only';
import {database} from './db';
import {assertPermission} from './permissions';
import {partnerScope} from './repository';
import {productPriceUnits} from './pricing';
import type {Principal} from './types';

const fallbackImagesBySku:Record<string,string>={
  'WEB-cohamy-almond-chocolate':'/images/products/cohamy-almond-chocolate-55g.jpg',
  'WEB-cohamy-almond-durian-chocolate':'/images/products/cohamy-almond-durian-chocolate-55g.jpg',
  'WEB-cohamy-almond-matcha-chocolate':'/images/products/cohamy-almond-matcha-chocolate-55g.jpg',
  'WEB-cohamy-almond-milk-chocolate':'/images/products/cohamy-almond-milk-chocolate-55g.jpg',
  'WEB-cohamy-almond-strawberry-chocolate':'/images/products/cohamy-almond-strawberry-chocolate-55g.jpg',
  'WEB-cohamy-cashew-chocolate':'/images/products/cohamy-cashew-chocolate-55g.jpg',
  'WEB-cohamy-gift-jar-collection':'/images/products/cohamy-gift-jar-collection.jpg',
  'WEB-cohamy-rainbow-chocolate':'/images/products/20261009/cohamy-chocolate-candy-65g/01.jpg',
  'WEB-jamy-dried-mango':'/images/products/jamy-dried-mango-150g.jpg',
  'WEB-jamy-macadamia-chocolate':'/images/products/jamy-macadamia-chocolate-160g.jpg',
  'WEB-jamy-mango-dried-chocolate':'/images/products/jamy-mango-dried-chocolate-160g.jpg',
};

export async function commercialProducts(user:Principal){
  assertPermission(user,'catalog.read');
  const rows=(await(await database()).query<{id:string;sku:string;name:string;stock_unit:string;weight_label:string;retail_price:string;translations:{images?:string[]}|null;version:number}>('SELECT id,sku,name,stock_unit,weight_label,retail_price::text AS retail_price,translations,version FROM cohamy_crm.products WHERE active ORDER BY sku LIMIT 1000')).rows;
  return Promise.all(rows.map(async p=>{
    const firstImage=Array.isArray(p.translations?.images)&&typeof p.translations.images[0]==='string'&&p.translations.images[0]?p.translations.images[0]:(fallbackImagesBySku[p.sku]??'/images/logo/cohamy-c-gold.png');
    return {id:p.id,sku:p.sku,name:p.name,stock_unit:p.stock_unit,weight_label:p.weight_label,retail_price:p.retail_price,image:firstImage,version:p.version,units:await productPriceUnits(user,p.id)};
  }));
}
export async function commercialPartners(user:Principal,q=''){assertPermission(user,'partners.read');const scope=partnerScope(user),params=[...scope.params,'%'+q.trim().slice(0,120)+'%'];return(await(await database()).query<{id:string;code:string;name:string;pricingVersion:number;tierName:string|null}>(`SELECT o.id,o.code,o.name,COALESCE(p.version,0) AS "pricingVersion",t.name AS "tierName" FROM cohamy_crm.organizations o LEFT JOIN cohamy_crm.organization_pricing p ON p.organization_id=o.id LEFT JOIN cohamy_crm.price_tiers t ON t.id=p.tier_id WHERE (${scope.sql}) AND o.active AND o.merged_into_id IS NULL AND o.kind IN('DEALER','CUSTOMER') AND(o.name ILIKE $${params.length} OR o.code ILIKE $${params.length}) ORDER BY o.name,o.id LIMIT 100`,params)).rows;}
