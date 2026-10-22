import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {database,type Sql} from './db';
import {assertCurrentPrincipal,audit} from './auth';
import {assertPermission,can,CrmError,isWarehouseRole} from './permissions';
import {getOrganization,partnerScope} from './repository';
import {parseCommercial as parse,commercialManager as manager} from './commercial-common';
import {assertNoDistributionCycle,getActiveParentOrganization,getDescendantOrganizationIds} from './distribution';
import {eligiblePriceBook} from './pricing';
import {resolveChannelPricing} from './channel-pricing';
import {channelAccountBp,channelPromotionFor,type ChannelTier} from './pricing-model';
import {fixed,fixedText} from './decimal';
import {enqueueNotification} from './workspace';
import {notifyShortage} from './order-notifications';
import {commercialRequestAccess} from './order-requests';
import {salesOrderAccess} from './sales-orders';
import type {Principal} from './types';

/**
 * Meeting 12/10 — kênh phân phối:
 * cổ đông/đầu mối (SHAREHOLDER), hạng thành viên, khuyến mãi theo 3 cơ chế, chiết khấu cấp dưới,
 * xin chuyển cây (duyệt tập trung), chuỗi quản lý trên đơn, catalog đặt hàng, người nhận hoá đơn, báo thiếu hàng.
 * DEFAULT_ASSUMPTION: "Sắp hết" khi tồn khả dụng của đơn vị bán <= 20 đơn vị cơ sở.
 */
export const LOW_STOCK_BASE_UNITS='20';
export type PartnerTypeCode='COHAMY'|'SHAREHOLDER'|'DEALER_L1'|'DEALER_L2'|'STORE'|'END_CUSTOMER';
export interface MembershipLevel {id:string;code:string;name:string;rank:number;method:'FIXED_PERCENT'|'QUANTITY_TIER';fixed_percent_bp:number|null;tiers:ChannelTier[];color:string;description:string;active:boolean;version:number}
const quantityText=z.string().regex(/^\d{1,18}(?:\.\d{1,6})?$/);
const tierSchema=z.object({minQuantity:quantityText,maxQuantity:quantityText.nullable().optional(),discountPercent:z.number().min(0).max(100)}).strict();
const reason=z.string().trim().min(3).max(500);
const idem=z.uuid().optional();
const bp=(percent:number)=>Math.round(percent*100);

function normalizedTiers(tiers:z.infer<typeof tierSchema>[]):ChannelTier[]{
 const out=tiers.map(t=>({minQuantity:t.minQuantity,maxQuantity:t.maxQuantity??null,discountPercent:t.discountPercent})).sort((a,b)=>fixed(a.minQuantity)<fixed(b.minQuantity)?-1:1);
 for(let i=0;i<out.length;i++){const t=out[i],max=t.maxQuantity?fixed(t.maxQuantity):null;if(max!==null&&max<=fixed(t.minQuantity))throw new CrmError('INVALID_TIERS',400);const next=out[i+1];if(next&&(max===null||max>fixed(next.minQuantity)))throw new CrmError('INVALID_TIERS',400);}
 return out;
}
async function cohamyId(sql:Sql){const row=(await sql.query<{id:string}>("SELECT id FROM cohamy_crm.organizations WHERE kind='COHAMY' AND active ORDER BY created_at LIMIT 1")).rows[0];if(!row)throw new CrmError('COHAMY_ORG_NOT_FOUND',500);return row.id;}
async function ownerRecipients(sql:Sql,organizationId:string){return(await sql.query<{user_id:string}>("SELECT DISTINCT m.user_id FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id WHERE m.active AND u.active AND m.organization_id=$1 AND m.role IN('DEALER_OWNER','ADMIN','MANAGER')",[organizationId])).rows.map(r=>r.user_id);}
async function managerRecipients(sql:Sql){return(await sql.query<{user_id:string}>("SELECT DISTINCT m.user_id FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id WHERE m.active AND u.active AND m.role IN('ADMIN','MANAGER')")).rows.map(r=>r.user_id);}

// ---------------------------------------------------------------------------
// Hạng thành viên (Đồng / Bạc / Vàng / Kim cương)
// ---------------------------------------------------------------------------
export async function listMembershipLevels(sql?:Sql):Promise<MembershipLevel[]>{
 return(await(sql??await database()).query<MembershipLevel>('SELECT id,code,name,rank,method,fixed_percent_bp,tiers,color,description,active,version FROM cohamy_crm.membership_levels ORDER BY rank,id')).rows;
}
const levelSchema=z.object({id:z.uuid().optional(),version:z.number().int().min(0),code:z.string().trim().regex(/^[A-Z0-9_]{2,40}$/),name:z.string().trim().min(1).max(80),rank:z.number().int().min(0).max(100000),method:z.enum(['FIXED_PERCENT','QUANTITY_TIER']),fixedPercent:z.number().min(0).max(100).nullable().optional(),tiers:z.array(tierSchema).max(20).default([]),color:z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#64748b'),description:z.string().trim().max(500).default(''),active:z.boolean().default(true),reason,idempotencyKey:idem}).strict();
export async function saveMembershipLevel(user:Principal,input:unknown){
 manager(user);const d=parse(levelSchema,input);if(Boolean(d.id)!==(d.version>0))throw new CrmError('INVALID_FIELDS',400);
 const tiers=d.method==='QUANTITY_TIER'?normalizedTiers(d.tiers):[];if(d.method==='QUANTITY_TIER'&&!tiers.length)throw new CrmError('INVALID_TIERS',400);
 const fixedBp=d.method==='FIXED_PERCENT'&&d.fixedPercent!==null&&d.fixedPercent!==undefined?bp(d.fixedPercent):null;
 return(await database()).transaction(async tx=>{await assertCurrentPrincipal(tx,user);const id=d.id??randomUUID();
  const r=d.id?await tx.query('UPDATE cohamy_crm.membership_levels SET code=$1,name=$2,rank=$3,method=$4,fixed_percent_bp=$5,tiers=$6::jsonb,color=$7,description=$8,active=$9,version=version+1,updated_at=now() WHERE id=$10 AND version=$11 RETURNING id',[d.code,d.name,d.rank,d.method,fixedBp,JSON.stringify(tiers),d.color,d.description,d.active,id,d.version])
   :await tx.query('INSERT INTO cohamy_crm.membership_levels(id,code,name,rank,method,fixed_percent_bp,tiers,color,description,active) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING id',[id,d.code,d.name,d.rank,d.method,fixedBp,JSON.stringify(tiers),d.color,d.description,d.active]);
  if(!r.rows.length)throw new CrmError(d.id?'VERSION_CONFLICT':'LEVEL_CODE_OR_RANK_TAKEN',409);
  await audit(tx,user.id,'channel.level-saved',id,{after:{code:d.code,name:d.name,method:d.method,fixedPercentBp:fixedBp,tiers,active:d.active},reason:d.reason});return {id,version:d.version+1};});
}

// ---------------------------------------------------------------------------
// Hồ sơ kênh của đối tác: loại đối tác (cổ đông…), hạng, vùng
// ---------------------------------------------------------------------------
const profileSchema=z.object({organizationId:z.uuid(),partnerType:z.enum(['SHAREHOLDER','DEALER_L1','DEALER_L2','STORE','END_CUSTOMER']).optional(),membershipLevelId:z.uuid().nullable().optional(),region:z.enum(['NORTH','SOUTH']).nullable().optional(),reason,idempotencyKey:idem}).strict();
export async function setPartnerProfile(user:Principal,input:unknown){
 manager(user);const d=parse(profileSchema,input);
 return(await database()).transaction(async tx=>{await assertCurrentPrincipal(tx,user);await getOrganization(user,d.organizationId,tx);
  const org=(await tx.query<{kind:string;partner_type:string;membership_level_id:string|null;region:string|null;merged_into_id:string|null}>('SELECT kind,partner_type,membership_level_id,region,merged_into_id FROM cohamy_crm.organizations WHERE id=$1 FOR UPDATE',[d.organizationId])).rows[0];
  if(!org||org.kind==='COHAMY'||org.merged_into_id)throw new CrmError('COMMERCIAL_PARTNER_UNAVAILABLE',409);
  if(d.partnerType!==undefined)await tx.query('UPDATE cohamy_crm.organizations SET partner_type=$1,version=version+1 WHERE id=$2',[d.partnerType,d.organizationId]);
  if(d.region!==undefined)await tx.query('UPDATE cohamy_crm.organizations SET region=$1 WHERE id=$2',[d.region,d.organizationId]);
  if(d.membershipLevelId!==undefined&&d.membershipLevelId!==org.membership_level_id)await changeLevel(tx,user,d.organizationId,org.membership_level_id,d.membershipLevelId,'MANUAL',null,d.reason);
  await audit(tx,user.id,'channel.profile-saved',d.organizationId,{before:{partnerType:org.partner_type,levelId:org.membership_level_id,region:org.region},after:{partnerType:d.partnerType,levelId:d.membershipLevelId,region:d.region},reason:d.reason});
  return {id:d.organizationId};});
}
async function changeLevel(tx:Sql,user:Principal,organizationId:string,from:string|null,to:string|null,source:'MANUAL'|'INCENTIVE',referenceId:string|null,why:string){
 if(to&&!(await tx.query('SELECT id FROM cohamy_crm.membership_levels WHERE id=$1 AND active',[to])).rows.length)throw new CrmError('LEVEL_UNAVAILABLE',409);
 await tx.query('UPDATE cohamy_crm.organizations SET membership_level_id=$1 WHERE id=$2',[to,organizationId]);
 await tx.query('INSERT INTO cohamy_crm.membership_level_events(id,organization_id,from_level_id,to_level_id,source,reference_id,actor_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),organizationId,from,to,source,referenceId,user.id,why]);
 const name=to?(await tx.query<{name:string}>('SELECT name FROM cohamy_crm.membership_levels WHERE id=$1',[to])).rows[0]?.name:'Chưa xếp hạng';
 for(const u of await ownerRecipients(tx,organizationId))await enqueueNotification(tx,u,'level:'+organizationId+':'+(to??'none')+':'+Date.now(),'SYSTEM','partner',organizationId,`Hạng thành viên của bạn đã được cập nhật: ${name}.`);
}
export {changeLevel as applyMembershipLevel};

/** Cây phân phối hiện tại: child → parent (mạng DEFAULT). */
export async function loadNetworkMap(sql:Sql){
 const rows=(await sql.query<{id:string;code:string;name:string;kind:string;partner_type:string;region:string|null;membership_level_id:string|null;parent_id:string|null;active:boolean}>(`SELECT o.id,o.code,o.name,o.kind,o.partner_type,o.region,o.membership_level_id,o.active,
  (SELECT r.parent_organization_id FROM cohamy_crm.distribution_relations r WHERE r.child_organization_id=o.id AND r.network_code='DEFAULT' AND r.status='ACTIVE' AND (r.ends_at IS NULL OR r.ends_at>now()) ORDER BY r.starts_at DESC LIMIT 1) AS parent_id
  FROM cohamy_crm.organizations o WHERE o.merged_into_id IS NULL AND o.kind IN('COHAMY','DEALER','CUSTOMER')`)).rows;
 const byId=new Map(rows.map(r=>[r.id,r]));
 /** Đầu mối (cổ đông) gần nhất phía trên, gồm chính nó nếu nó là cổ đông. */
 const anchorOf=(id:string):string|null=>{const seen=new Set<string>();let cur=byId.get(id);while(cur&&!seen.has(cur.id)){if(cur.partner_type==='SHAREHOLDER')return cur.id;seen.add(cur.id);cur=cur.parent_id?byId.get(cur.parent_id):undefined;}return null;};
 const depthOf=(id:string)=>{let d=0;const seen=new Set<string>();let cur=byId.get(id);while(cur?.parent_id&&!seen.has(cur.id)){seen.add(cur.id);d++;cur=byId.get(cur.parent_id);}return d;};
 return {rows,byId,anchorOf,depthOf};
}

export async function partnerChannelProfile(user:Principal,organizationId:string){
 assertPermission(user,'partners.read');const db=await database();await getOrganization(user,organizationId,db);
 const org=(await db.query<{id:string;code:string;name:string;partner_type:string;region:string|null;membership_level_id:string|null}>('SELECT id,code,name,partner_type,region,membership_level_id FROM cohamy_crm.organizations WHERE id=$1',[organizationId])).rows[0];
 const map=await loadNetworkMap(db),anchorId=map.anchorOf(organizationId),parentId=map.byId.get(organizationId)?.parent_id??null;
 const levels=await listMembershipLevels(db);
 const policy=(await db.query<{id:string;method:string;fixed_percent_bp:number;tiers:ChannelTier[];seller_organization_id:string;starts_at:string}>("SELECT id,method,fixed_percent_bp,tiers,seller_organization_id,starts_at FROM cohamy_crm.account_discount_policies WHERE buyer_organization_id=$1 AND status='ACTIVE' AND starts_at<=now() AND (ends_at IS NULL OR ends_at>now()) ORDER BY starts_at DESC,id DESC LIMIT 1",[organizationId])).rows[0]??null;
 const events=(await db.query<{id:string;from_name:string|null;to_name:string|null;source:string;reason:string;created_at:string;actor:string}>('SELECT e.id,f.name AS from_name,t.name AS to_name,e.source,e.reason,e.created_at,u.display_name AS actor FROM cohamy_crm.membership_level_events e LEFT JOIN cohamy_crm.membership_levels f ON f.id=e.from_level_id LEFT JOIN cohamy_crm.membership_levels t ON t.id=e.to_level_id JOIN cohamy_crm.users u ON u.id=e.actor_id WHERE e.organization_id=$1 ORDER BY e.created_at DESC LIMIT 20',[organizationId])).rows;
 const children=map.rows.filter(r=>r.parent_id===organizationId).map(r=>({id:r.id,code:r.code,name:r.name,partnerType:r.partner_type,levelId:r.membership_level_id}));
 const pendingTransfer=(await db.query<{id:string;to_parent_id:string;reason:string}>("SELECT id,to_parent_id,reason FROM cohamy_crm.distribution_transfer_requests WHERE organization_id=$1 AND status='PENDING'",[organizationId])).rows[0]??null;
 const name=(id:string|null)=>id?map.byId.get(id)?.name??null:null;
 return {organization:org,level:levels.find(l=>l.id===org.membership_level_id)??null,levels,anchor:anchorId?{id:anchorId,name:name(anchorId)}:null,parent:parentId?{id:parentId,name:name(parentId)}:null,policy,events,children,pendingTransfer};
}

/** Tổng quan mạng lưới: cổ đông (đầu mối) và cây của từng người. ADMIN/MANAGER thấy toàn bộ; đại lý thấy nhánh của mình. */
export async function networkOverview(user:Principal){
 assertPermission(user,'partners.read');const db=await database(),scope=partnerScope(user);
 const visible=new Set((await db.query<{id:string}>(`SELECT o.id FROM cohamy_crm.organizations o WHERE (${scope.sql})`,scope.params)).rows.map(r=>r.id));
 const map=await loadNetworkMap(db),levels=await listMembershipLevels(db),levelName=new Map(levels.map(l=>[l.id,l.name]));
 const partners=map.rows.filter(r=>r.kind!=='COHAMY'&&visible.has(r.id)).map(r=>{const anchor=map.anchorOf(r.id);return {id:r.id,code:r.code,name:r.name,partnerType:r.partner_type,region:r.region,levelId:r.membership_level_id,levelName:r.membership_level_id?levelName.get(r.membership_level_id)??null:null,parentId:r.parent_id,parentName:r.parent_id?map.byId.get(r.parent_id)?.name??null:null,anchorId:anchor,anchorName:anchor?map.byId.get(anchor)?.name??null:null,depth:map.depthOf(r.id),active:r.active};});
 const shareholders=partners.filter(p=>p.partnerType==='SHAREHOLDER').map(s=>({...s,members:partners.filter(p=>p.anchorId===s.id&&p.id!==s.id).length}));
 return {partners,shareholders,unanchored:partners.filter(p=>!p.anchorId&&p.partnerType!=='END_CUSTOMER').length,levels};
}

// ---------------------------------------------------------------------------
// Khuyến mãi: ALL (toàn hệ thống), DESIGNATED (chỉ định đối tác/hạng), QUANTITY (theo số lượng)
// ---------------------------------------------------------------------------
const promotionSchema=z.object({id:z.uuid().optional(),version:z.number().int().min(0).default(0),sku:z.string().trim().min(2).max(80),name:z.string().trim().min(2).max(160),campaign:z.string().trim().max(160).default(''),percent:z.number().min(0).max(100),scope:z.enum(['ALL','DESIGNATED','QUANTITY']),targetOrganizationIds:z.array(z.uuid()).max(500).default([]),targetLevelIds:z.array(z.uuid()).max(20).default([]),minBaseQuantity:quantityText.default('0'),badge:z.enum(['HOT','NEW','SALE']).nullable().default(null),startsAt:z.iso.datetime({offset:true}),endsAt:z.iso.datetime({offset:true}),active:z.boolean().default(true),reason,idempotencyKey:idem}).strict()
 .superRefine((d,c)=>{if(new Date(d.endsAt)<=new Date(d.startsAt))c.addIssue({code:'custom',message:'End must follow start'});if(d.scope==='DESIGNATED'&&!d.targetOrganizationIds.length&&!d.targetLevelIds.length)c.addIssue({code:'custom',message:'Designated needs targets'});if(d.scope==='QUANTITY'&&fixed(d.minBaseQuantity)<=0n)c.addIssue({code:'custom',message:'Quantity scope needs a minimum'});});
export interface PromotionRow {id:string;sku:string;product_name:string;name:string;campaign:string;promo_percent_bp:number;scope:'ALL'|'DESIGNATED'|'QUANTITY';target_organization_ids:string[];target_level_ids:string[];min_base_quantity:string;badge:string|null;starts_at:string;ends_at:string;active:boolean;version:number}
export async function listPromotions(user:Principal){
 manager(user);return(await(await database()).query<PromotionRow>('SELECT pp.id,p.sku,p.name AS product_name,pp.name,pp.campaign,pp.promo_percent_bp,pp.scope,pp.target_organization_ids,pp.target_level_ids,pp.min_base_quantity::text,pp.badge,pp.starts_at,pp.ends_at,pp.active,pp.version FROM cohamy_crm.product_promotions pp JOIN cohamy_crm.products p ON p.id=pp.product_id ORDER BY pp.active DESC,pp.ends_at DESC,pp.id LIMIT 300')).rows;
}
export async function savePromotion(user:Principal,input:unknown){
 manager(user);const d=parse(promotionSchema,input);if(Boolean(d.id)!==(d.version>0))throw new CrmError('INVALID_FIELDS',400);
 return(await database()).transaction(async tx=>{await assertCurrentPrincipal(tx,user);
  const p=(await tx.query<{id:string}>('SELECT id FROM cohamy_crm.products WHERE sku=$1 AND active',[d.sku])).rows[0];if(!p)throw new CrmError('SKU_UNCONFIGURED',404);
  if(d.targetOrganizationIds.length&&(await tx.query<{n:string}>("SELECT count(*)::text AS n FROM cohamy_crm.organizations WHERE id=ANY($1::uuid[]) AND kind IN('DEALER','CUSTOMER') AND merged_into_id IS NULL",[d.targetOrganizationIds])).rows[0].n!==String(new Set(d.targetOrganizationIds).size))throw new CrmError('COMMERCIAL_PARTNER_UNAVAILABLE',409);
  if(d.targetLevelIds.length&&(await tx.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.membership_levels WHERE id=ANY($1::uuid[])',[d.targetLevelIds])).rows[0].n!==String(new Set(d.targetLevelIds).size))throw new CrmError('LEVEL_UNAVAILABLE',409);
  const id=d.id??randomUUID(),seller=await cohamyId(tx),targets=d.scope==='DESIGNATED'?[JSON.stringify([...new Set(d.targetOrganizationIds)]),JSON.stringify([...new Set(d.targetLevelIds)])]:['[]','[]'],minQ=d.scope==='QUANTITY'?d.minBaseQuantity:'0';
  const r=d.id?await tx.query('UPDATE cohamy_crm.product_promotions SET name=$1,product_id=$2,promo_percent_bp=$3,starts_at=$4,ends_at=$5,is_system_wide=$6,active=$7,scope=$8,target_organization_ids=$9::jsonb,target_level_ids=$10::jsonb,min_base_quantity=$11,badge=$12,campaign=$13,version=version+1,updated_at=now() WHERE id=$14 AND version=$15 RETURNING id',[d.name,p.id,bp(d.percent),d.startsAt,d.endsAt,d.scope==='ALL',d.active,d.scope,targets[0],targets[1],minQ,d.badge,d.campaign,id,d.version])
   :await tx.query('INSERT INTO cohamy_crm.product_promotions(id,name,seller_organization_id,product_id,promo_percent_bp,starts_at,ends_at,is_system_wide,active,created_by,scope,target_organization_ids,target_level_ids,min_base_quantity,badge,campaign) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,$16) RETURNING id',[id,d.name,seller,p.id,bp(d.percent),d.startsAt,d.endsAt,d.scope==='ALL',d.active,user.id,d.scope,targets[0],targets[1],minQ,d.badge,d.campaign]);
  if(!r.rows.length)throw new CrmError('VERSION_CONFLICT',409);
  await audit(tx,user.id,'channel.promotion-saved',id,{after:{sku:d.sku,percentBp:bp(d.percent),scope:d.scope,badge:d.badge,campaign:d.campaign,startsAt:d.startsAt,endsAt:d.endsAt,active:d.active},reason:d.reason});
  return {id,version:d.version+1};});
}
export async function setPromotionActive(user:Principal,input:unknown){
 manager(user);const d=parse(z.object({id:z.uuid(),version:z.number().int().positive(),active:z.boolean(),reason,idempotencyKey:idem}).strict(),input);
 return(await database()).transaction(async tx=>{await assertCurrentPrincipal(tx,user);const r=await tx.query('UPDATE cohamy_crm.product_promotions SET active=$1,version=version+1,updated_at=now() WHERE id=$2 AND version=$3 RETURNING id',[d.active,d.id,d.version]);if(!r.rows.length)throw new CrmError('VERSION_CONFLICT',409);await audit(tx,user.id,d.active?'channel.promotion-activated':'channel.promotion-deactivated',d.id,{reason:d.reason});return {id:d.id,version:d.version+1};});
}

// ---------------------------------------------------------------------------
// Chiết khấu cố định theo tài khoản (Cohamy → cổ đông/đại lý; đại lý → cấp dưới trực tiếp)
// ---------------------------------------------------------------------------
const childDiscountSchema=z.object({organizationId:z.uuid(),method:z.enum(['FIXED_PERCENT','QUANTITY_TIER']),fixedPercent:z.number().min(0).max(100).optional(),tiers:z.array(tierSchema).max(20).default([]),reason,idempotencyKey:idem}).strict();
/** Mức chiết khấu tối đa mà một đơn vị đang nhận từ cấp trên (bp), null nếu chưa cấu hình. */
export async function receivedMaxBp(sql:Sql,organizationId:string):Promise<number|null>{
 const channel=await resolveChannelPricing(sql,organizationId,[],new Date());const a=channel?.account;if(!a)return null;
 return a.method==='FIXED_PERCENT'?a.fixedPercentBp:Math.max(0,...a.tiers.map(t=>bp(t.discountPercent)));
}
export async function saveChildDiscount(user:Principal,input:unknown){
 const d=parse(childDiscountSchema,input);const portal=user.area==='portal';
 if(portal){if(user.role!=='DEALER_OWNER')throw new CrmError('FORBIDDEN',403);}else manager(user);
 const tiers=d.method==='QUANTITY_TIER'?normalizedTiers(d.tiers):[];if(d.method==='QUANTITY_TIER'&&!tiers.length)throw new CrmError('INVALID_TIERS',400);if(d.method==='FIXED_PERCENT'&&d.fixedPercent===undefined)throw new CrmError('INVALID_FIELDS',400);
 const proposedMax=d.method==='FIXED_PERCENT'?bp(d.fixedPercent!):Math.max(0,...tiers.map(t=>bp(t.discountPercent)));
 return(await database()).transaction(async tx=>{await assertCurrentPrincipal(tx,user);
  const target=(await tx.query<{id:string;kind:string;active:boolean;merged_into_id:string|null}>('SELECT id,kind,active,merged_into_id FROM cohamy_crm.organizations WHERE id=$1 FOR UPDATE',[d.organizationId])).rows[0];
  if(!target||!target.active||target.merged_into_id||!['DEALER','CUSTOMER'].includes(target.kind))throw new CrmError('COMMERCIAL_PARTNER_UNAVAILABLE',409);
  let seller:string;
  if(portal){const parent=await getActiveParentOrganization(tx,d.organizationId);if(parent?.id!==user.organizationId)throw new CrmError('NOT_DIRECT_CHILD',403);seller=user.organizationId;
   const ceiling=await receivedMaxBp(tx,user.organizationId);if(ceiling===null)throw new CrmError('DISCOUNT_CEILING_UNCONFIGURED',409);if(proposedMax>ceiling)throw new CrmError('DISCOUNT_EXCEEDS_UPSTREAM',409);}
  else {await getOrganization(user,d.organizationId,tx);seller=(await getActiveParentOrganization(tx,d.organizationId))?.id??await cohamyId(tx);}
  const before=(await tx.query<{id:string;method:string;fixed_percent_bp:number;tiers:unknown}>("UPDATE cohamy_crm.account_discount_policies SET status='INACTIVE',ends_at=GREATEST(now(),starts_at+interval '1 millisecond'),version=version+1,updated_at=now() WHERE buyer_organization_id=$1 AND status='ACTIVE' RETURNING id,method,fixed_percent_bp,tiers",[d.organizationId])).rows;
  const id=randomUUID();
  await tx.query("INSERT INTO cohamy_crm.account_discount_policies(id,name,seller_organization_id,buyer_organization_id,method,fixed_percent_bp,tiers,starts_at,status,created_by,approved_by) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,now(),'ACTIVE',$8,$8)",[id,`Chiết khấu tài khoản ${d.method==='FIXED_PERCENT'?d.fixedPercent+'%':'theo số lượng'}`,seller,d.organizationId,d.method,d.method==='FIXED_PERCENT'?proposedMax:0,JSON.stringify(tiers),user.id]);
  await audit(tx,user.id,'channel.account-discount-saved',id,{organizationId:d.organizationId,sellerOrganizationId:seller,before,after:{method:d.method,fixedPercentBp:d.method==='FIXED_PERCENT'?proposedMax:null,tiers},reason:d.reason});
  for(const u of await ownerRecipients(tx,d.organizationId))await enqueueNotification(tx,u,'discount:'+id,'SYSTEM','partner',d.organizationId,`Chính sách chiết khấu tài khoản của bạn đã được cập nhật (${d.method==='FIXED_PERCENT'?d.fixedPercent+'%':'theo bậc số lượng'}).`);
  return {id};});
}

// ---------------------------------------------------------------------------
// Xin chuyển cây: không tự sửa, luôn được ADMIN/MANAGER duyệt tập trung
// ---------------------------------------------------------------------------
const transferSchema=z.object({organizationId:z.uuid(),toParentId:z.uuid(),reason,idempotencyKey:z.uuid()}).strict();
export async function createTransferRequest(user:Principal,input:unknown){
 const d=parse(transferSchema,input);
 if(user.area==='portal'&&user.role!=='DEALER_OWNER')throw new CrmError('FORBIDDEN',403);
 if(user.area==='crm'&&!['ADMIN','MANAGER','SALES'].includes(user.role))throw new CrmError('FORBIDDEN',403);
 return(await database()).transaction(async tx=>{await assertCurrentPrincipal(tx,user);
  const prior=(await tx.query<{id:string;organization_id:string;to_parent_id:string}>('SELECT id,organization_id,to_parent_id FROM cohamy_crm.distribution_transfer_requests WHERE requested_by=$1 AND idempotency_key=$2',[user.id,d.idempotencyKey])).rows[0];
  if(prior){if(prior.organization_id!==d.organizationId||prior.to_parent_id!==d.toParentId)throw new CrmError('IDEMPOTENCY_CONFLICT',409);return {id:prior.id};}
  await getOrganization(user,d.organizationId,tx);
  const target=(await tx.query<{id:string;kind:string;active:boolean}>("SELECT id,kind,active FROM cohamy_crm.organizations WHERE id=$1 AND merged_into_id IS NULL",[d.toParentId])).rows[0];
  if(!target||!target.active||!['COHAMY','DEALER'].includes(target.kind))throw new CrmError('ORGANIZATION_INACTIVE_OR_NOT_FOUND',404);
  await assertNoDistributionCycle(tx,d.toParentId,d.organizationId);
  const from=(await getActiveParentOrganization(tx,d.organizationId))?.id??null;if(from===d.toParentId)throw new CrmError('TRANSFER_SAME_PARENT',409);
  if((await tx.query("SELECT id FROM cohamy_crm.distribution_transfer_requests WHERE organization_id=$1 AND status='PENDING'",[d.organizationId])).rows.length)throw new CrmError('TRANSFER_ALREADY_PENDING',409);
  const id=randomUUID();
  await tx.query('INSERT INTO cohamy_crm.distribution_transfer_requests(id,organization_id,from_parent_id,to_parent_id,requester_organization_id,requested_by,reason,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,d.organizationId,from,d.toParentId,user.organizationId,user.id,d.reason,d.idempotencyKey]);
  await audit(tx,user.id,'channel.transfer-requested',id,{organizationId:d.organizationId,fromParentId:from,toParentId:d.toParentId,reason:d.reason});
  for(const u of await managerRecipients(tx))if(u!==user.id)await enqueueNotification(tx,u,'transfer:'+id,'SYSTEM','partner',d.organizationId,'Có yêu cầu xin chuyển cây phân phối cần duyệt.');
  return {id};});
}
export interface TransferRow {id:string;organization_id:string;organization_name:string;from_parent_id:string|null;from_name:string|null;to_parent_id:string;to_name:string;requester_name:string;requested_by_name:string;reason:string;status:string;decision_reason:string;created_at:string;decided_at:string|null}
export async function listTransferRequests(user:Principal){
 assertPermission(user,'partners.read');const scope=partnerScope(user);
 return(await(await database()).query<TransferRow>(`SELECT t.id,t.organization_id,o.name AS organization_name,t.from_parent_id,f.name AS from_name,t.to_parent_id,tp.name AS to_name,rq.name AS requester_name,u.display_name AS requested_by_name,t.reason,t.status,t.decision_reason,t.created_at,t.decided_at
  FROM cohamy_crm.distribution_transfer_requests t JOIN cohamy_crm.organizations o ON o.id=t.organization_id LEFT JOIN cohamy_crm.organizations f ON f.id=t.from_parent_id JOIN cohamy_crm.organizations tp ON tp.id=t.to_parent_id JOIN cohamy_crm.organizations rq ON rq.id=t.requester_organization_id JOIN cohamy_crm.users u ON u.id=t.requested_by
  WHERE (${scope.sql}) ORDER BY (t.status='PENDING') DESC,t.created_at DESC LIMIT 200`,scope.params)).rows;
}
export async function decideTransferRequest(user:Principal,input:unknown){
 manager(user);const d=parse(z.object({id:z.uuid(),decision:z.enum(['APPROVE','REJECT']),reason,idempotencyKey:idem}).strict(),input);
 return(await database()).transaction(async tx=>{await assertCurrentPrincipal(tx,user);
  const t=(await tx.query<{id:string;organization_id:string;to_parent_id:string;from_parent_id:string|null;status:string;requester_organization_id:string}>('SELECT * FROM cohamy_crm.distribution_transfer_requests WHERE id=$1 FOR UPDATE',[d.id])).rows[0];
  if(!t)throw new CrmError('NOT_FOUND',404);if(t.status!=='PENDING')throw new CrmError('ALREADY_PROCESSED',409);
  if(d.decision==='APPROVE'){
   await assertNoDistributionCycle(tx,t.to_parent_id,t.organization_id);
   const ended=(await tx.query<{id:string}>("UPDATE cohamy_crm.distribution_relations SET status='INACTIVE',ends_at=GREATEST(now(),starts_at+interval '1 millisecond'),version=version+1,updated_at=now() WHERE child_organization_id=$1 AND network_code='DEFAULT' AND status='ACTIVE' RETURNING id",[t.organization_id])).rows;
   for(const e of ended)await tx.query("INSERT INTO cohamy_crm.distribution_relation_events(id,relation_id,action,actor_id,payload,reason) VALUES($1,$2,'ENDED_BY_TRANSFER',$3,$4::jsonb,$5)",[randomUUID(),e.id,user.id,JSON.stringify({transferId:t.id}),d.reason]);
   const cohamy=await cohamyId(tx);
   if(t.to_parent_id!==cohamy){const rel=randomUUID();await tx.query("INSERT INTO cohamy_crm.distribution_relations(id,parent_organization_id,child_organization_id,network_code,status,created_by,approved_by) VALUES($1,$2,$3,'DEFAULT','ACTIVE',$4,$4)",[rel,t.to_parent_id,t.organization_id,user.id]);await tx.query("INSERT INTO cohamy_crm.distribution_relation_events(id,relation_id,action,actor_id,payload,reason) VALUES($1,$2,'CREATED_BY_TRANSFER',$3,$4::jsonb,$5)",[randomUUID(),rel,user.id,JSON.stringify({transferId:t.id,fromParentId:t.from_parent_id}),d.reason]);}
  }
  await tx.query('UPDATE cohamy_crm.distribution_transfer_requests SET status=$1,decided_by=$2,decision_reason=$3,decided_at=now() WHERE id=$4',[d.decision==='APPROVE'?'APPROVED':'REJECTED',user.id,d.reason,t.id]);
  await audit(tx,user.id,d.decision==='APPROVE'?'channel.transfer-approved':'channel.transfer-rejected',t.id,{organizationId:t.organization_id,toParentId:t.to_parent_id,reason:d.reason});
  for(const org of new Set([t.requester_organization_id,t.organization_id]))for(const u of await ownerRecipients(tx,org))await enqueueNotification(tx,u,'transfer-decision:'+t.id,'SYSTEM','partner',t.organization_id,`Yêu cầu chuyển cây phân phối đã được ${d.decision==='APPROVE'?'duyệt':'từ chối'}: ${d.reason}`);
  return {id:t.id,status:d.decision==='APPROVE'?'APPROVED':'REJECTED'};});
}

// ---------------------------------------------------------------------------
// Chuỗi quản lý trên đơn: "Quản lý cấp 1, cấp 2…" hiện dần khi đơn được chuyển lên.
// Cửa hàng không thấy phía trên mình; cấp trên thấy toàn bộ phía dưới; nhà máy liên hệ quản lý gần nhất.
// DEFAULT_ASSUMPTION: chuỗi được suy ra từ parent_request_id (mỗi lần chuyển lên tạo một yêu cầu mới).
// ---------------------------------------------------------------------------
export interface ChainNode {organizationId:string;organizationName:string;partnerType:string;label:string;requestId:string|null;requestCode:string|null;status:string|null;viewer:boolean}
export async function requestManagementChain(user:Principal,requestId:string){
 const db=await database();const head=await commercialRequestAccess(db,user,requestId);
 type Row={id:string;code:string;status:string;organization_id:string;seller_organization_id:string|null;parent_request_id:string|null};
 const load=async(where:string,param:string)=>(await db.query<Row>(`SELECT id,code,status,organization_id,seller_organization_id,parent_request_id FROM cohamy_crm.commercial_requests WHERE ${where} ORDER BY created_at LIMIT 1`,[param])).rows[0];
 const down:Row[]=[];let cur:Row|undefined=await load('id=$1',head.id);const seen=new Set<string>();
 while(cur&&!seen.has(cur.id)){seen.add(cur.id);down.unshift(cur);cur=cur.parent_request_id?await load('id=$1',cur.parent_request_id):undefined;}
 const up:Row[]=[];cur=await load('parent_request_id=$1',head.id);
 while(cur&&!seen.has(cur.id)){seen.add(cur.id);up.push(cur);cur=await load('parent_request_id=$1',cur.id);}
 const requests=[...down,...up];const top=requests[requests.length-1];
 const orgIds=[...requests.map(r=>r.organization_id),...(top.seller_organization_id?[top.seller_organization_id]:[])];
 const orgs=new Map((await db.query<{id:string;name:string;partner_type:string;kind:string}>('SELECT id,name,partner_type,kind FROM cohamy_crm.organizations WHERE id=ANY($1::uuid[])',[orgIds])).rows.map(o=>[o.id,o]));
 const nodes:ChainNode[]=orgIds.map((id,i)=>{const o=orgs.get(id);const r=requests[i]??null;return {organizationId:id,organizationName:o?.name??'—',partnerType:o?.partner_type??'',label:o?.kind==='COHAMY'?'Nhà máy Cohamy':i===0?'Đơn vị đặt hàng':`Quản lý cấp ${i}`,requestId:r?.id??null,requestCode:r?.code??null,status:r?.status??null,viewer:user.area==='portal'&&id===user.organizationId};});
 const cohamyIndex=nodes.findIndex(n=>orgs.get(n.organizationId)?.kind==='COHAMY');
 const nearestManager=cohamyIndex>1?nodes[cohamyIndex-1]:null;
 let visible=nodes;
 if(user.area==='portal'){const at=nodes.findIndex(n=>n.organizationId===user.organizationId);visible=at>=0?nodes.slice(0,at+1):[];}
 return {nodes:visible,levels:Math.max(0,(cohamyIndex>=0?cohamyIndex:nodes.length)-1),nearestManager:user.area==='crm'?nearestManager:null,pendingAt:top.status==='SUBMITTED'&&top.seller_organization_id?(user.area==='crm'?orgs.get(top.seller_organization_id)?.name??null:null):null};
}

/** Cấp trên xem (chỉ đọc) các yêu cầu đã gửi của toàn bộ cấp dưới trong nhánh. */
export async function networkRequests(user:Principal){
 if(user.area!=='portal'||user.role!=='DEALER_OWNER')throw new CrmError('FORBIDDEN',403);
 const db=await database(),ids=await getDescendantOrganizationIds(db,user.organizationId);if(!ids.length)return [];
 return(await db.query<{id:string;code:string;status:string;organization_name:string;seller_name:string|null;created_at:string;updated_at:string;total:string|null}>(`SELECT r.id,r.code,r.status,o.name AS organization_name,s.name AS seller_name,r.created_at,r.updated_at,v.snapshot#>>'{quote,calculation,total}' AS total
  FROM cohamy_crm.commercial_requests r JOIN cohamy_crm.organizations o ON o.id=r.organization_id LEFT JOIN cohamy_crm.organizations s ON s.id=r.seller_organization_id LEFT JOIN cohamy_crm.commercial_request_versions v ON v.id=r.latest_version_id
  WHERE r.organization_id=ANY($1::uuid[]) AND r.status='SUBMITTED' ORDER BY r.updated_at DESC LIMIT 200`,[ids])).rows;
}

// ---------------------------------------------------------------------------
// Catalog đặt hàng (giao diện thương mại điện tử cho đối tác)
// ---------------------------------------------------------------------------
export interface CatalogItem {sku:string;name:string;category:string;weightLabel:string;image:string|null;stockUnit:string;listUnitPrice:string;promotion:{percentBp:number;name:string;badge:string|null;minBaseQuantity:string}|null;accountPercentBp:number;estimatedUnitPrice:string;availability:'IN_STOCK'|'LOW'|'OUT'|'UNKNOWN'}
function imageOf(translations:unknown):string|null{
 if(!translations||typeof translations!=='object')return null;
 for(const value of Object.values(translations as Record<string,unknown>)){const images=(value as {images?:unknown})?.images;if(Array.isArray(images)&&typeof images[0]==='string')return images[0];}
 const top=(translations as {images?:unknown}).images;return Array.isArray(top)&&typeof top[0]==='string'?top[0]:null;
}
export async function sellerWarehouseOrganizations(sql:Sql,buyerOrganizationId:string){const parent=await getActiveParentOrganization(sql,buyerOrganizationId);return [parent?.id??await cohamyId(sql)];}
export async function orderCatalog(user:Principal,organizationId?:string){
 assertPermission(user,'catalog.read');
 const buyer=user.area==='portal'?user.organizationId:organizationId;if(!buyer)throw new CrmError('INVALID_FIELDS',400);
 return(await database()).transaction(async tx=>{await assertCurrentPrincipal(tx,user);
  let book;try{book=await eligiblePriceBook(tx,user,buyer);}catch(e){if(e instanceof CrmError&&e.code==='PRICE_UNAVAILABLE')return {items:[] as CatalogItem[],priceBook:null,level:null,accountSource:'NONE' as const,message:'Chưa có bảng giá đang phát hành cho đơn vị này.'};throw e;}
  const lines=book.priceVersion.definition.lines,skus=lines.map(l=>l.sku);
  const products=new Map((await tx.query<{sku:string;name:string;category:string;weight_label:string;translations:unknown;stock_unit:string;id:string}>("SELECT p.id,p.sku,p.name,p.category,p.weight_label,p.translations,p.stock_unit FROM cohamy_crm.products p WHERE p.active AND p.sku=ANY($1::text[]) AND EXISTS(SELECT 1 FROM cohamy_crm.commercial_units u WHERE u.product_id=p.id AND u.code='BASE' AND u.active)",[skus])).rows.map(p=>[p.sku,p]));
  const sellers=await sellerWarehouseOrganizations(tx,buyer);
  const stock=new Map((await tx.query<{sku:string;available:string}>(`SELECT p.sku,COALESCE(SUM(b.on_hand-b.reserved),0)::text AS available FROM cohamy_crm.inventory_balances b JOIN cohamy_crm.products p ON p.id=b.product_id JOIN cohamy_crm.inventory_lots t ON t.id=b.lot_id JOIN cohamy_crm.warehouse_locations l ON l.id=b.location_id JOIN cohamy_crm.warehouses w ON w.id=b.warehouse_id
   WHERE p.sku=ANY($1::text[]) AND t.status='AVAILABLE' AND (t.expires_on IS NULL OR t.expires_on>current_date) AND l.active AND l.kind='PICK' AND w.active AND w.organization_id=ANY($2::uuid[]) GROUP BY p.sku`,[skus,sellers])).rows.map(r=>[r.sku,r.available]));
  const anyStockData=(await tx.query('SELECT 1 FROM cohamy_crm.warehouses WHERE active AND organization_id=ANY($1::uuid[]) LIMIT 1',[sellers])).rows.length>0;
  const channel=await resolveChannelPricing(tx,buyer,skus,new Date());const low=fixed(LOW_STOCK_BASE_UNITS);
  const items:CatalogItem[]=[];
  for(const line of lines){const p=products.get(line.sku);if(!p)continue;
   const promo=channel?channelPromotionFor(channel,line.sku,fixed('1')):null,promoAny=channel?.promotions[line.sku]?.[0]??null,account=channel?channelAccountBp(channel,fixed('1')):0;
   const list=BigInt(line.unitPrice),afterPromo=promo?list-(list*BigInt(promo.percentBp)+5000n)/10000n:list,net=afterPromo-(afterPromo*BigInt(account)+5000n)/10000n;
   const raw=stock.get(line.sku),available=raw?fixed(raw.startsWith('-')?'0':raw):0n;
   const shown=promo??promoAny;
   items.push({sku:line.sku,name:p.name,category:p.category,weightLabel:p.weight_label,image:imageOf(p.translations),stockUnit:p.stock_unit,listUnitPrice:line.unitPrice,promotion:shown?{percentBp:shown.percentBp,name:shown.name,badge:shown.badge,minBaseQuantity:shown.minBaseQuantity}:null,accountPercentBp:account,estimatedUnitPrice:net.toString(),availability:!anyStockData?'UNKNOWN':available<=0n?'OUT':available<=low?'LOW':'IN_STOCK'});}
  items.sort((a,b)=>Number(Boolean(b.promotion?.badge==='HOT'))-Number(Boolean(a.promotion?.badge==='HOT'))||a.name.localeCompare(b.name,'vi'));
  return {items,priceBook:{id:book.book.id,name:book.book.name,versionNumber:book.priceVersion.number},level:channel?.level??null,accountSource:channel?.account?.source??'NONE',message:null as string|null};});
}

// ---------------------------------------------------------------------------
// Người nhận hoá đơn: chính đơn vị mua, hoặc công ty thương mại khác
// ---------------------------------------------------------------------------
const invoiceSchema=z.object({orderId:z.uuid(),kind:z.enum(['BUYER','COMPANY']),companyName:z.string().trim().max(200).default(''),taxCode:z.string().trim().max(40).regex(/^[0-9A-Za-z-]*$/).default(''),address:z.string().trim().max(500).default(''),email:z.union([z.literal(''),z.email()]).default(''),reason,idempotencyKey:idem}).strict()
 .superRefine((d,c)=>{if(d.kind==='COMPANY'&&(d.companyName.length<2||d.taxCode.length<6||d.address.length<3))c.addIssue({code:'custom',message:'Company invoice needs name, tax code and address'});});
export async function setInvoiceRecipient(user:Principal,input:unknown){
 const d=parse(invoiceSchema,input);
 if(user.area==='portal'&&user.role!=='DEALER_OWNER')throw new CrmError('FORBIDDEN',403);
 if(user.area==='crm'&&!['ADMIN','MANAGER','SALES','ACCOUNTANT'].includes(user.role))throw new CrmError('FORBIDDEN',403);
 return(await database()).transaction(async tx=>{await assertCurrentPrincipal(tx,user);const order=await salesOrderAccess(tx,user,d.orderId,true);
  if(user.area==='portal'&&order.organization_id!==user.organizationId)throw new CrmError('FORBIDDEN',403);
  if(['CANCELLED','REJECTED'].includes(order.status))throw new CrmError('ORDER_CLOSED',409);
  const recipient=d.kind==='BUYER'?{kind:'BUYER'}:{kind:'COMPANY',companyName:d.companyName,taxCode:d.taxCode,address:d.address,email:d.email};
  await tx.query('UPDATE cohamy_crm.sales_orders SET invoice_recipient=$1::jsonb,updated_at=now() WHERE id=$2',[JSON.stringify({...recipient,updatedBy:user.id,updatedAt:new Date().toISOString()}),order.id]);
  await audit(tx,user.id,'sales.invoice-recipient-set',order.id,{after:recipient,reason:d.reason});return {id:order.id};});
}

// ---------------------------------------------------------------------------
// Kho: gợi ý kho gần (theo vùng) và báo thiếu hàng cho quản lý trực tiếp
// ---------------------------------------------------------------------------
export async function regionWarehouses(sql:Sql,sellerOrganizationId:string,buyerOrganizationId:string){
 const region=(await sql.query<{region:string|null}>('SELECT region FROM cohamy_crm.organizations WHERE id=$1',[buyerOrganizationId])).rows[0]?.region??null;
 const rows=(await sql.query<{id:string;code:string;name:string;region:string|null}>('SELECT id,code,name,region FROM cohamy_crm.warehouses WHERE active AND organization_id=$1 ORDER BY code',[sellerOrganizationId])).rows;
 return {buyerRegion:region,warehouses:rows.map(w=>({...w,suggested:Boolean(region)&&w.region===region})).sort((a,b)=>Number(b.suggested)-Number(a.suggested))};
}
const shortageSchema=z.object({orderId:z.uuid(),sku:z.string().trim().min(2).max(80),needed:quantityText,available:quantityText,note:z.string().trim().max(500).default(''),idempotencyKey:idem}).strict();
export async function reportShortage(user:Principal,input:unknown){
 const d=parse(shortageSchema,input);
 const crmAllowed=user.area==='crm'&&(['ADMIN','MANAGER'].includes(user.role)||isWarehouseRole(user.role)),portalAllowed=user.area==='portal'&&user.role==='DEALER_OWNER';
 if(!crmAllowed&&!portalAllowed)throw new CrmError('FORBIDDEN',403);
 if(fixed(d.available)>=fixed(d.needed))throw new CrmError('NO_SHORTAGE',400);
 return(await database()).transaction(async tx=>{await assertCurrentPrincipal(tx,user);
  const order=user.area==='crm'&&isWarehouseRole(user.role)?(await tx.query<{id:string;code:string;organization_id:string;seller_organization_id:string|null;status:string}>('SELECT id,code,organization_id,seller_organization_id,status FROM cohamy_crm.sales_orders WHERE id=$1',[d.orderId])).rows[0]:await salesOrderAccess(tx,user,d.orderId);
  if(!order)throw new CrmError('NOT_FOUND',404);
  const cohamy=await cohamyId(tx),seller=order.seller_organization_id??cohamy;
  if(user.area==='portal'&&seller!==user.organizationId)throw new CrmError('FORBIDDEN',403);
  if(user.area==='crm'&&isWarehouseRole(user.role)&&seller!==cohamy)throw new CrmError('FORBIDDEN',403);
  const byRegion=(await tx.query<{region:string|null;name:string;available:string}>(`SELECT w.region,w.name,COALESCE(SUM(b.on_hand-b.reserved),0)::text AS available FROM cohamy_crm.inventory_balances b JOIN cohamy_crm.products p ON p.id=b.product_id JOIN cohamy_crm.inventory_lots t ON t.id=b.lot_id JOIN cohamy_crm.warehouse_locations l ON l.id=b.location_id JOIN cohamy_crm.warehouses w ON w.id=b.warehouse_id
   WHERE p.sku=$1 AND w.organization_id=$2 AND w.active AND t.status='AVAILABLE' AND l.active AND l.kind='PICK' GROUP BY w.region,w.name ORDER BY w.name`,[d.sku,seller])).rows;
  const other=byRegion.filter(r=>fixed(r.available.startsWith('-')?'0':r.available)>0n).map(r=>`${r.name}${r.region?` (${r.region==='NORTH'?'Hà Nội':'Hồ Chí Minh'})`:''}: ${r.available}`).join('; ');
  const missing=fixedText(fixed(d.needed)-fixed(d.available));
  const actor=(await tx.query<{display_name:string}>('SELECT display_name FROM cohamy_crm.users WHERE id=$1',[user.id])).rows[0]?.display_name??user.email;
  await notifyShortage(tx,{orderOrRequestId:order.id,code:order.code,entityType:'sales-order',sku:d.sku,needed:d.needed,allocated:d.available,missing,expectedOn:null,updatedBy:actor,organizationId:order.organization_id,actorId:user.id,note:[other?`Tồn kho khác có thể điều chuyển: ${other}.`:'',d.note].filter(Boolean).join(' ')});
  await audit(tx,user.id,'warehouse.shortage-reported',order.id,{sku:d.sku,needed:d.needed,available:d.available,missing,otherStock:byRegion,note:d.note});
  return {id:order.id,missing};});
}

export function canManageChannel(user:Principal){return can(user,'channel.manage');}
