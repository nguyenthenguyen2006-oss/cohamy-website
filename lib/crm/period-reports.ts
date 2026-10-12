import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {database,type Sql} from './db';
import {assertCurrentPrincipal,audit} from './auth';
import {assertPermission,CrmError} from './permissions';
import {partnerScope} from './repository';
import {parseCommercial as parse,commercialManager as manager} from './commercial-common';
import {getActiveParentOrganization,getDescendantOrganizationIds} from './distribution';
import {fixed,fixedText} from './decimal';
import {enqueueNotification} from './workspace';
import {applyMembershipLevel,listMembershipLevels,loadNetworkMap} from './channel';
import type {Principal} from './types';

/**
 * Meeting 12/10 — báo cáo doanh số theo tháng / quý / năm và chương trình KPI thúc đẩy.
 * DEFAULT_ASSUMPTION: doanh số = đơn bán đã CONFIRMED, tính theo ngày tạo phiên bản đã chốt (giờ Việt Nam),
 * giá trị = tổng tiền phiên bản đã chốt; số lượng = số lượng đơn vị cơ sở của các dòng không phải quà tặng.
 */
export type PeriodType='MONTH'|'QUARTER'|'YEAR';
const periodKeySchema=z.string().regex(/^\d{4}(?:-(?:0[1-9]|1[0-2])|-Q[1-4])?$/);
export function periodRange(type:PeriodType,key:string):{start:Date;end:Date;months:string[]}{
 const year=Number(key.slice(0,4));let m0=0,count=12;
 if(type==='MONTH'){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(key))throw new CrmError('INVALID_PERIOD',400);m0=Number(key.slice(5,7))-1;count=1;}
 else if(type==='QUARTER'){if(!/^\d{4}-Q[1-4]$/.test(key))throw new CrmError('INVALID_PERIOD',400);m0=(Number(key.slice(6))-1)*3;count=3;}
 else if(!/^\d{4}$/.test(key))throw new CrmError('INVALID_PERIOD',400);
 // Vietnam is UTC+7: local midnight = 17:00 UTC of the previous day.
 const start=new Date(Date.UTC(year,m0,1)-7*3600000),end=new Date(Date.UTC(year,m0+count,1)-7*3600000);
 const months=Array.from({length:count},(_,i)=>{const d=new Date(Date.UTC(year,m0+i,1));return d.toISOString().slice(0,7);});
 return {start,end,months};
}
export function currentPeriodKey(type:PeriodType,now=new Date()){const local=new Date(now.getTime()+7*3600000),y=local.getUTCFullYear(),m=local.getUTCMonth();return type==='MONTH'?`${y}-${String(m+1).padStart(2,'0')}`:type==='QUARTER'?`${y}-Q${Math.floor(m/3)+1}`:String(y);}

interface OrderFact {orderId:string;buyerId:string;sellerId:string|null;confirmedAt:string;total:bigint;lines:{sku:string;name:string;baseQuantity:bigint;total:bigint}[]}
async function confirmedOrders(sql:Sql,start:Date,end:Date,filter:{sql:string;params:unknown[]}):Promise<OrderFact[]>{
 const offset=filter.params.length;
 const rows=(await sql.query<{id:string;organization_id:string;seller_organization_id:string|null;confirmed_at:string;calculation:{total?:string;lines?:{sku:string;name:string;baseQuantity:string;total:string;gift:boolean}[]}|null}>(
  `SELECT s.id,s.organization_id,s.seller_organization_id,v.created_at AS confirmed_at,v.snapshot#>'{quote,calculation}' AS calculation
   FROM cohamy_crm.sales_orders s JOIN cohamy_crm.sales_order_versions v ON v.id=s.confirmed_version_id JOIN cohamy_crm.organizations o ON o.id=s.organization_id
   WHERE s.status='CONFIRMED' AND v.created_at>=$${offset+1} AND v.created_at<$${offset+2} AND (${filter.sql}) ORDER BY v.created_at`,[...filter.params,start,end])).rows;
 return rows.map(r=>({orderId:r.id,buyerId:r.organization_id,sellerId:r.seller_organization_id,confirmedAt:r.confirmed_at,total:BigInt(r.calculation?.total??'0'),
  lines:(r.calculation?.lines??[]).filter(l=>!l.gift).map(l=>({sku:l.sku,name:l.name,baseQuantity:fixed(l.baseQuantity),total:BigInt(l.total??'0')}))}));
}
const localMonth=(iso:string)=>new Date(new Date(iso).getTime()+7*3600000).toISOString().slice(0,7);

const reportSchema=z.object({periodType:z.enum(['MONTH','QUARTER','YEAR']).default('MONTH'),periodKey:periodKeySchema.optional(),view:z.enum(['DIRECT','NETWORK','PURCHASES','SALES']).optional()}).strict();
export type PeriodView='DIRECT'|'NETWORK'|'PURCHASES'|'SALES';
export async function periodSalesReport(user:Principal,input:unknown){
 const d=parse(reportSchema,input);
 if(user.area==='crm'&&!['ADMIN','MANAGER','ACCOUNTANT','SALES'].includes(user.role))throw new CrmError('FORBIDDEN',403);
 if(user.area==='portal'&&user.role!=='DEALER_OWNER')throw new CrmError('FORBIDDEN',403);
 assertPermission(user,'orders.read');
 const periodType=d.periodType as PeriodType,periodKey=d.periodKey??currentPeriodKey(periodType),{start,end,months}=periodRange(periodType,periodKey);
 const view:PeriodView=d.view??(user.area==='portal'?'SALES':'DIRECT');
 const db=await database(),cohamy=(await db.query<{id:string}>("SELECT id FROM cohamy_crm.organizations WHERE kind='COHAMY' ORDER BY created_at LIMIT 1")).rows[0]?.id??null;
 let filter:{sql:string;params:unknown[]};
 if(user.area==='portal'){
  if(view==='PURCHASES')filter={sql:'s.organization_id=$1',params:[user.organizationId]};
  else if(view==='SALES')filter={sql:'s.seller_organization_id=$1',params:[user.organizationId]};
  else {const ids=await getDescendantOrganizationIds(db,user.organizationId);filter={sql:'s.organization_id=ANY($1::uuid[])',params:[ids]};}
 } else {
  const scope=partnerScope(user);
  filter=view==='NETWORK'?scope:{sql:`(${scope.sql}) AND (s.seller_organization_id IS NULL OR s.seller_organization_id=$${scope.params.length+1})`,params:[...scope.params,cohamy]};
 }
 const facts=await confirmedOrders(db,start,end,filter);
 const map=await loadNetworkMap(db),levels=new Map((await listMembershipLevels(db)).map(l=>[l.id,l.name]));
 const partner=new Map<string,{id:string;name:string;code:string;anchorId:string|null;anchorName:string|null;level:string|null;region:string|null;orders:number;revenue:bigint;quantity:bigint;skus:Map<string,bigint>}>();
 const product=new Map<string,{sku:string;name:string;quantity:bigint;revenue:bigint}>();
 const monthly=new Map<string,{orders:number;revenue:bigint}>(months.map(m=>[m,{orders:0,revenue:0n}]));
 let revenue=0n,quantity=0n;
 for(const f of facts){
  const org=map.byId.get(f.buyerId),anchor=map.anchorOf(f.buyerId);
  const p=partner.get(f.buyerId)??{id:f.buyerId,name:org?.name??'—',code:org?.code??'',anchorId:anchor,anchorName:anchor?map.byId.get(anchor)?.name??null:null,level:org?.membership_level_id?levels.get(org.membership_level_id)??null:null,region:org?.region??null,orders:0,revenue:0n,quantity:0n,skus:new Map()};
  p.orders++;p.revenue+=f.total;revenue+=f.total;
  for(const l of f.lines){p.quantity+=l.baseQuantity;quantity+=l.baseQuantity;p.skus.set(l.sku,(p.skus.get(l.sku)??0n)+l.baseQuantity);const pr=product.get(l.sku)??{sku:l.sku,name:l.name,quantity:0n,revenue:0n};pr.quantity+=l.baseQuantity;pr.revenue+=l.total;product.set(l.sku,pr);}
  partner.set(f.buyerId,p);
  const mm=monthly.get(localMonth(f.confirmedAt));if(mm){mm.orders++;mm.revenue+=f.total;}
 }
 const partners=[...partner.values()].sort((a,b)=>b.revenue>a.revenue?1:b.revenue<a.revenue?-1:a.name.localeCompare(b.name,'vi'));
 const products=[...product.values()].sort((a,b)=>b.quantity>a.quantity?1:b.quantity<a.quantity?-1:a.sku.localeCompare(b.sku));
 const anchors=new Map<string,{id:string|null;name:string;orders:number;revenue:bigint;partners:number}>();
 for(const p of partners){const key=p.anchorId??'none';const a=anchors.get(key)??{id:p.anchorId,name:p.anchorName??'Chưa thuộc cổ đông nào',orders:0,revenue:0n,partners:0};a.orders+=p.orders;a.revenue+=p.revenue;a.partners++;anchors.set(key,a);}
 const matrixSkus=products.slice(0,12).map(p=>({sku:p.sku,name:p.name}));
 return {periodType,periodKey,view,start:start.toISOString(),end:end.toISOString(),
  totals:{orders:facts.length,revenue:revenue.toString(),quantity:fixedText(quantity)},
  partners:partners.map(p=>({id:p.id,name:p.name,code:p.code,anchorName:p.anchorName,level:p.level,region:p.region,orders:p.orders,revenue:p.revenue.toString(),quantity:fixedText(p.quantity)})),
  anchors:[...anchors.values()].sort((a,b)=>b.revenue>a.revenue?1:b.revenue<a.revenue?-1:0).map(a=>({...a,revenue:a.revenue.toString()})),
  products:products.map(p=>({sku:p.sku,name:p.name,quantity:fixedText(p.quantity),revenue:p.revenue.toString()})),
  matrix:{skus:matrixSkus,rows:partners.slice(0,50).map(p=>({id:p.id,name:p.name,cells:matrixSkus.map(s=>fixedText(p.skus.get(s.sku)??0n))}))},
  monthly:[...monthly.entries()].map(([month,v])=>({month,orders:v.orders,revenue:v.revenue.toString()}))};
}

// ---------------------------------------------------------------------------
// Chương trình KPI: đạt mục tiêu → lên hạng / chiết khấu mới / quà tặng (ADMIN/MANAGER duyệt trao thưởng)
// ---------------------------------------------------------------------------
const reason=z.string().trim().min(3).max(500);
const programSchema=z.object({id:z.uuid().optional(),version:z.number().int().min(0).default(0),name:z.string().trim().min(3).max(160),description:z.string().trim().max(1000).default(''),periodType:z.enum(['MONTH','QUARTER','YEAR']),periodKey:periodKeySchema,metric:z.enum(['REVENUE','QUANTITY']),target:z.string().regex(/^\d{1,18}(?:\.\d{1,6})?$/),sku:z.string().trim().min(2).max(80).nullable().default(null),audience:z.enum(['ALL','SHAREHOLDER_BRANCH','LEVEL']).default('ALL'),audienceRef:z.uuid().nullable().default(null),rewardType:z.enum(['UPGRADE_LEVEL','DISCOUNT_PERCENT','GIFT_AMOUNT']),rewardLevelId:z.uuid().nullable().default(null),rewardPercent:z.number().min(0).max(100).nullable().default(null),rewardAmount:z.string().regex(/^\d{1,24}$/).nullable().default(null),status:z.enum(['DRAFT','ACTIVE','CLOSED']).default('ACTIVE'),reason,idempotencyKey:z.uuid().optional()}).strict()
 .superRefine((d,c)=>{const issue=(m:string)=>c.addIssue({code:'custom',message:m});if(fixed(d.target)<=0n)issue('Target must be positive');if(d.metric==='QUANTITY'&&!d.sku)issue('Quantity needs SKU');if(d.audience!=='ALL'&&!d.audienceRef)issue('Audience needs reference');if(d.rewardType==='UPGRADE_LEVEL'&&!d.rewardLevelId)issue('Level required');if(d.rewardType==='DISCOUNT_PERCENT'&&d.rewardPercent===null)issue('Percent required');if(d.rewardType==='GIFT_AMOUNT'&&!d.rewardAmount)issue('Amount required');});
export interface IncentiveProgram {id:string;name:string;description:string;period_type:PeriodType;period_key:string;metric:'REVENUE'|'QUANTITY';target:string;sku:string|null;audience:'ALL'|'SHAREHOLDER_BRANCH'|'LEVEL';audience_ref:string|null;reward_type:'UPGRADE_LEVEL'|'DISCOUNT_PERCENT'|'GIFT_AMOUNT';reward_level_id:string|null;reward_percent_bp:number|null;reward_amount:string|null;status:'DRAFT'|'ACTIVE'|'CLOSED';version:number;created_at:string}
const programColumns='id,name,description,period_type,period_key,metric,target::text,sku,audience,audience_ref,reward_type,reward_level_id,reward_percent_bp,reward_amount::text,status,version,created_at';
export async function saveIncentiveProgram(user:Principal,input:unknown){
 manager(user);const d=parse(programSchema,input);if(Boolean(d.id)!==(d.version>0))throw new CrmError('INVALID_FIELDS',400);periodRange(d.periodType,d.periodKey);
 return(await database()).transaction(async tx=>{await assertCurrentPrincipal(tx,user);
  if(d.sku&&!(await tx.query('SELECT 1 FROM cohamy_crm.products WHERE sku=$1',[d.sku])).rows.length)throw new CrmError('SKU_UNCONFIGURED',404);
  if(d.rewardLevelId&&!(await tx.query('SELECT 1 FROM cohamy_crm.membership_levels WHERE id=$1 AND active',[d.rewardLevelId])).rows.length)throw new CrmError('LEVEL_UNAVAILABLE',409);
  if(d.audience==='LEVEL'&&!(await tx.query('SELECT 1 FROM cohamy_crm.membership_levels WHERE id=$1',[d.audienceRef])).rows.length)throw new CrmError('LEVEL_UNAVAILABLE',409);
  if(d.audience==='SHAREHOLDER_BRANCH'&&!(await tx.query("SELECT 1 FROM cohamy_crm.organizations WHERE id=$1 AND partner_type='SHAREHOLDER'",[d.audienceRef])).rows.length)throw new CrmError('SHAREHOLDER_NOT_FOUND',404);
  const id=d.id??randomUUID(),pct=d.rewardType==='DISCOUNT_PERCENT'&&d.rewardPercent!==null?Math.round(d.rewardPercent*100):null;
  const values=[d.name,d.description,d.periodType,d.periodKey,d.metric,d.target,d.metric==='QUANTITY'?d.sku:d.sku,d.audience,d.audience==='ALL'?null:d.audienceRef,d.rewardType,d.rewardType==='UPGRADE_LEVEL'?d.rewardLevelId:null,pct,d.rewardType==='GIFT_AMOUNT'?d.rewardAmount:null,d.status];
  const r=d.id?await tx.query('UPDATE cohamy_crm.incentive_programs SET name=$1,description=$2,period_type=$3,period_key=$4,metric=$5,target=$6,sku=$7,audience=$8,audience_ref=$9,reward_type=$10,reward_level_id=$11,reward_percent_bp=$12,reward_amount=$13,status=$14,version=version+1,updated_at=now() WHERE id=$15 AND version=$16 RETURNING id',[...values,id,d.version])
   :await tx.query('INSERT INTO cohamy_crm.incentive_programs(name,description,period_type,period_key,metric,target,sku,audience,audience_ref,reward_type,reward_level_id,reward_percent_bp,reward_amount,status,id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id',[...values,id,user.id]);
  if(!r.rows.length)throw new CrmError('VERSION_CONFLICT',409);
  await audit(tx,user.id,'incentive.program-saved',id,{after:{...d,idempotencyKey:undefined},reason:d.reason});return {id,version:d.version+1};});
}
async function eligiblePartners(sql:Sql,program:IncentiveProgram){
 const map=await loadNetworkMap(sql);
 return map.rows.filter(r=>r.kind!=='COHAMY'&&r.active&&(program.audience==='ALL'||(program.audience==='LEVEL'&&r.membership_level_id===program.audience_ref)||(program.audience==='SHAREHOLDER_BRANCH'&&map.anchorOf(r.id)===program.audience_ref)));
}
async function achievements(sql:Sql,program:IncentiveProgram,organizationIds:string[]){
 const {start,end}=periodRange(program.period_type,program.period_key);
 const facts=await confirmedOrders(sql,start,end,{sql:'s.organization_id=ANY($1::uuid[])',params:[organizationIds]});
 const achieved=new Map<string,bigint>();
 for(const f of facts){const v=program.metric==='REVENUE'?fixed(f.total.toString()):f.lines.filter(l=>l.sku===program.sku).reduce((s,l)=>s+l.baseQuantity,0n);achieved.set(f.buyerId,(achieved.get(f.buyerId)??0n)+v);}
 return achieved;
}
export async function listIncentivePrograms(user:Principal){
 const db=await database();
 if(user.area==='crm'){if(!['ADMIN','MANAGER','ACCOUNTANT','SALES'].includes(user.role))throw new CrmError('FORBIDDEN',403);return {programs:(await db.query<IncentiveProgram>(`SELECT ${programColumns} FROM cohamy_crm.incentive_programs ORDER BY (status='ACTIVE') DESC,created_at DESC LIMIT 200`)).rows,own:[] as {programId:string;achieved:string;reached:boolean;awarded:boolean}[]};}
 if(user.role!=='DEALER_OWNER')throw new CrmError('FORBIDDEN',403);
 const programs=(await db.query<IncentiveProgram>(`SELECT ${programColumns} FROM cohamy_crm.incentive_programs WHERE status='ACTIVE' ORDER BY created_at DESC LIMIT 100`)).rows;
 const visible:IncentiveProgram[]=[],own:{programId:string;achieved:string;reached:boolean;awarded:boolean}[]=[];
 for(const p of programs){if(!(await eligiblePartners(db,p)).some(r=>r.id===user.organizationId))continue;visible.push(p);const a=(await achievements(db,p,[user.organizationId])).get(user.organizationId)??0n;const awarded=(await db.query('SELECT 1 FROM cohamy_crm.incentive_awards WHERE program_id=$1 AND organization_id=$2',[p.id,user.organizationId])).rows.length>0;own.push({programId:p.id,achieved:fixedText(a),reached:a>=fixed(p.target),awarded});}
 return {programs:visible,own};
}
export async function incentiveProgress(user:Principal,programId:string){
 manager(user);parse(z.uuid(),programId);const db=await database();
 const program=(await db.query<IncentiveProgram>(`SELECT ${programColumns} FROM cohamy_crm.incentive_programs WHERE id=$1`,[programId])).rows[0];if(!program)throw new CrmError('NOT_FOUND',404);
 const partners=await eligiblePartners(db,program),achieved=await achievements(db,program,partners.map(p=>p.id)),target=fixed(program.target);
 const awards=new Map((await db.query<{organization_id:string;created_at:string}>('SELECT organization_id,created_at FROM cohamy_crm.incentive_awards WHERE program_id=$1',[programId])).rows.map(a=>[a.organization_id,a.created_at]));
 const rows=partners.map(p=>{const a=achieved.get(p.id)??0n;return {organizationId:p.id,name:p.name,code:p.code,achieved:fixedText(a),percent:Number(a*10000n/target)/100,reached:a>=target,awardedAt:awards.get(p.id)??null};}).sort((x,y)=>y.percent-x.percent);
 return {program,rows};
}
export async function awardIncentive(user:Principal,input:unknown){
 manager(user);const d=parse(z.object({programId:z.uuid(),organizationId:z.uuid(),reason,idempotencyKey:z.uuid().optional()}).strict(),input);
 return(await database()).transaction(async tx=>{await assertCurrentPrincipal(tx,user);
  const program=(await tx.query<IncentiveProgram>(`SELECT ${programColumns} FROM cohamy_crm.incentive_programs WHERE id=$1 FOR UPDATE`,[d.programId])).rows[0];if(!program)throw new CrmError('NOT_FOUND',404);
  if(program.status==='DRAFT')throw new CrmError('PROGRAM_NOT_ACTIVE',409);
  if(!(await eligiblePartners(tx,program)).some(p=>p.id===d.organizationId))throw new CrmError('NOT_ELIGIBLE',409);
  if((await tx.query('SELECT 1 FROM cohamy_crm.incentive_awards WHERE program_id=$1 AND organization_id=$2',[d.programId,d.organizationId])).rows.length)throw new CrmError('ALREADY_AWARDED',409);
  const achieved=(await achievements(tx,program,[d.organizationId])).get(d.organizationId)??0n;if(achieved<fixed(program.target))throw new CrmError('TARGET_NOT_REACHED',409);
  const id=randomUUID();let reward:Record<string,unknown>={type:program.reward_type};
  if(program.reward_type==='UPGRADE_LEVEL'){const from=(await tx.query<{membership_level_id:string|null}>('SELECT membership_level_id FROM cohamy_crm.organizations WHERE id=$1 FOR UPDATE',[d.organizationId])).rows[0]?.membership_level_id??null;await applyMembershipLevel(tx,user,d.organizationId,from,program.reward_level_id,'INCENTIVE',id,`${program.name}: ${d.reason}`);reward={...reward,fromLevelId:from,toLevelId:program.reward_level_id};}
  else if(program.reward_type==='DISCOUNT_PERCENT'){
   const seller=(await getActiveParentOrganization(tx,d.organizationId))?.id??(await tx.query<{id:string}>("SELECT id FROM cohamy_crm.organizations WHERE kind='COHAMY' ORDER BY created_at LIMIT 1")).rows[0].id;
   await tx.query("UPDATE cohamy_crm.account_discount_policies SET status='INACTIVE',ends_at=GREATEST(now(),starts_at+interval '1 millisecond'),version=version+1,updated_at=now() WHERE buyer_organization_id=$1 AND status='ACTIVE'",[d.organizationId]);
   const policyId=randomUUID();await tx.query("INSERT INTO cohamy_crm.account_discount_policies(id,name,seller_organization_id,buyer_organization_id,method,fixed_percent_bp,tiers,starts_at,status,created_by,approved_by) VALUES($1,$2,$3,$4,'FIXED_PERCENT',$5,'[]'::jsonb,now(),'ACTIVE',$6,$6)",[policyId,`KPI ${program.name}`,seller,d.organizationId,program.reward_percent_bp,user.id]);
   reward={...reward,policyId,percentBp:program.reward_percent_bp};
  } else reward={...reward,amount:program.reward_amount};
  await tx.query('INSERT INTO cohamy_crm.incentive_awards(id,program_id,organization_id,achieved,reward,actor_id,reason) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7)',[id,d.programId,d.organizationId,fixedText(achieved),JSON.stringify(reward),user.id,d.reason]);
  await audit(tx,user.id,'incentive.awarded',id,{programId:d.programId,organizationId:d.organizationId,achieved:fixedText(achieved),reward,reason:d.reason});
  const owners=(await tx.query<{user_id:string}>("SELECT DISTINCT m.user_id FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id WHERE m.active AND u.active AND m.organization_id=$1 AND m.role='DEALER_OWNER'",[d.organizationId])).rows;
  for(const o of owners)await enqueueNotification(tx,o.user_id,'incentive:'+id,'SYSTEM','partner',d.organizationId,`Chúc mừng! Bạn đã đạt chương trình "${program.name}" và được trao thưởng.`);
  return {id,reward};});
}
