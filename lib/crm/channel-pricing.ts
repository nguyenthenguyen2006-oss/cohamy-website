import 'server-only';
import type {Sql} from './db';
import type {ChannelPricing,ChannelPromotion,ChannelTier} from './pricing-model';

/**
 * Resolve channel pricing for a buyer (meeting 12/10):
 * - Product promotions: ALL (toàn hệ thống), DESIGNATED (chỉ định đối tác/hạng), QUANTITY (theo số lượng).
 * - Account discount: the partner's own approved policy, otherwise the default of its membership level.
 * Returns null when nothing applies, so calculations stay byte-identical for unconfigured partners.
 */
export async function resolveChannelPricing(sql:Sql,organizationId:string,skus:string[],at:Date):Promise<ChannelPricing|null>{
 const org=(await sql.query<{membership_level_id:string|null;level_code:string|null;level_name:string|null;level_method:'FIXED_PERCENT'|'QUANTITY_TIER'|null;level_fixed_bp:number|null;level_tiers:ChannelTier[]|null;level_active:boolean|null}>(
  `SELECT o.membership_level_id,l.code AS level_code,l.name AS level_name,l.method AS level_method,l.fixed_percent_bp AS level_fixed_bp,l.tiers AS level_tiers,l.active AS level_active
   FROM cohamy_crm.organizations o LEFT JOIN cohamy_crm.membership_levels l ON l.id=o.membership_level_id WHERE o.id=$1`,[organizationId])).rows[0];
 const level=org?.membership_level_id&&org.level_active?{code:org.level_code!,name:org.level_name!}:null;

 const policy=(await sql.query<{id:string;method:'FIXED_PERCENT'|'QUANTITY_TIER';fixed_percent_bp:number;tiers:ChannelTier[]}>(
  `SELECT id,method,fixed_percent_bp,tiers FROM cohamy_crm.account_discount_policies
   WHERE buyer_organization_id=$1 AND status='ACTIVE' AND starts_at<=$2 AND (ends_at IS NULL OR ends_at>$2)
   ORDER BY starts_at DESC,id DESC LIMIT 1`,[organizationId,at])).rows[0];
 let account:ChannelPricing['account']=null;
 if(policy)account={source:'ACCOUNT',method:policy.method,fixedPercentBp:policy.fixed_percent_bp,tiers:normalizeTiers(policy.tiers),policyId:policy.id};
 else if(level&&org?.level_method==='FIXED_PERCENT'&&org.level_fixed_bp!==null)account={source:'MEMBERSHIP',method:'FIXED_PERCENT',fixedPercentBp:org.level_fixed_bp,tiers:[],policyId:null};
 else if(level&&org?.level_method==='QUANTITY_TIER'&&normalizeTiers(org.level_tiers).length)account={source:'MEMBERSHIP',method:'QUANTITY_TIER',fixedPercentBp:0,tiers:normalizeTiers(org.level_tiers),policyId:null};
 if(account&&account.method==='FIXED_PERCENT'&&account.fixedPercentBp===0&&account.source==='MEMBERSHIP')account=null;

 const promotions:Record<string,ChannelPromotion[]>={};
 const unique=[...new Set(skus)];
 if(unique.length){
  const rows=(await sql.query<{id:string;sku:string;promo_percent_bp:number;name:string;campaign:string;badge:string|null;scope:'ALL'|'DESIGNATED'|'QUANTITY';target_organization_ids:string[];target_level_ids:string[];min_base_quantity:string}>(
   `SELECT pp.id,p.sku,pp.promo_percent_bp,pp.name,pp.campaign,pp.badge,pp.scope,pp.target_organization_ids,pp.target_level_ids,pp.min_base_quantity::text
    FROM cohamy_crm.product_promotions pp JOIN cohamy_crm.products p ON p.id=pp.product_id
    WHERE p.sku=ANY($1::text[]) AND pp.active AND pp.starts_at<=$2 AND (pp.ends_at IS NULL OR pp.ends_at>$2)
    ORDER BY pp.promo_percent_bp DESC,pp.id`,[unique,at])).rows;
  for(const r of rows){
   if(r.scope==='DESIGNATED'&&!(asList(r.target_organization_ids).includes(organizationId)||(org?.membership_level_id&&asList(r.target_level_ids).includes(org.membership_level_id))))continue;
   (promotions[r.sku]??=[]).push({id:r.id,percentBp:r.promo_percent_bp,name:r.campaign||r.name,badge:r.badge,minBaseQuantity:r.min_base_quantity});
  }
 }
 if(!account&&!Object.keys(promotions).length)return null;
 return {promotions,account,level};
}
function asList(value:unknown):string[]{return Array.isArray(value)?value.filter((v):v is string=>typeof v==='string'):[];}
function normalizeTiers(value:unknown):ChannelTier[]{
 if(!Array.isArray(value))return [];
 return value.filter((t):t is ChannelTier=>Boolean(t)&&typeof t==='object'&&typeof (t as ChannelTier).minQuantity==='string'&&typeof (t as ChannelTier).discountPercent==='number')
  .map(t=>({minQuantity:t.minQuantity,maxQuantity:t.maxQuantity??null,discountPercent:t.discountPercent}));
}
