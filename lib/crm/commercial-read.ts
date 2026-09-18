import 'server-only';
import {database} from './db';
import {assertPermission} from './permissions';
import {partnerScope} from './repository';
import {productPriceUnits} from './pricing';
import type {Principal} from './types';
export async function commercialProducts(user:Principal){assertPermission(user,'catalog.read');const rows=(await(await database()).query<{id:string;sku:string;name:string;stock_unit:string;version:number}>('SELECT id,sku,name,stock_unit,version FROM cohamy_crm.products WHERE active ORDER BY sku LIMIT 1000')).rows;return Promise.all(rows.map(async p=>({...p,units:await productPriceUnits(user,p.id)})));}
export async function commercialPartners(user:Principal,q=''){assertPermission(user,'partners.read');const scope=partnerScope(user),params=[...scope.params,'%'+q.trim().slice(0,120)+'%'];return(await(await database()).query<{id:string;code:string;name:string;pricingVersion:number;tierName:string|null}>(`SELECT o.id,o.code,o.name,COALESCE(p.version,0) AS "pricingVersion",t.name AS "tierName" FROM cohamy_crm.organizations o LEFT JOIN cohamy_crm.organization_pricing p ON p.organization_id=o.id LEFT JOIN cohamy_crm.price_tiers t ON t.id=p.tier_id WHERE (${scope.sql}) AND o.active AND o.merged_into_id IS NULL AND o.kind IN('DEALER','CUSTOMER') AND(o.name ILIKE $${params.length} OR o.code ILIKE $${params.length}) ORDER BY o.name,o.id LIMIT 100`,params)).rows;}
