import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {database,type Sql} from './db';
import {assertCurrentPrincipal,audit} from './auth';
import {CrmError} from './permissions';
import {commercialManager,parseCommercial,commercialDigest} from './commercial-common';
import type {Principal,Organization} from './types';
const money=z.string().regex(/^\d{1,24}$/).transform(v=>BigInt(v).toString());
export const orderPolicySchema=z.object({
 enabled:z.boolean(),requireOwnerApproval:z.boolean(),alwaysManagerApproval:z.boolean(),
 managerApprovalAmount:money.nullable(),creditRequiresApproval:z.boolean(),nonSelfApproval:z.boolean(),
 acceptedQuotePrice:z.enum(['UNTIL_QUOTE_EXPIRY','REPRICE']),pendingPrice:z.literal('UNTIL_REQUEST_EXPIRY'),
 requiredPartnerFields:z.array(z.enum(['phone','email','business_id','address','contact_name'])).max(5)
  .refine(fields=>new Set(fields).size===fields.length),
 approvalRoles:z.array(z.enum(['ADMIN','MANAGER'])).min(1).max(2).refine(roles=>new Set(roles).size===roles.length),
 confirmationRoles:z.array(z.enum(['ADMIN','MANAGER','SALES'])).min(1).max(3).refine(roles=>new Set(roles).size===roles.length),
}).strict();
export type OrderPolicyDefinition=z.infer<typeof orderPolicySchema>;
export interface OrderPolicy {id:string;number:number;definition:OrderPolicyDefinition;checksum:string;actor_id:string;reason:string;created_at:string}
export async function currentOrderPolicy(sql:Sql,requireEnabled=true){
 const result=(await sql.query<OrderPolicy&{version:number}>('SELECT p.*,c.version FROM cohamy_crm.order_policy_current c JOIN cohamy_crm.order_policies p ON p.id=c.policy_id WHERE c.singleton FOR SHARE OF c')).rows[0];
 if(!result||(requireEnabled&&!result.definition.enabled))throw new CrmError('ORDER_POLICY_UNAVAILABLE',409);
 if(result.checksum!==commercialDigest(result.definition))throw new CrmError('ORDER_POLICY_INVALID',503);
 result.definition=orderPolicySchema.parse(result.definition);return result;
}
export async function readOrderPolicy(user:Principal){commercialManager(user);return(await database()).transaction(async sql=>{await assertCurrentPrincipal(sql,user);const rows=(await sql.query<OrderPolicy>('SELECT * FROM cohamy_crm.order_policies ORDER BY number DESC LIMIT 100')).rows;return {current:rows.length?await currentOrderPolicy(sql,false):null,versions:rows};});}
export async function saveOrderPolicy(user:Principal,input:unknown){
 commercialManager(user);const data=parseCommercial(z.object({version:z.number().int().min(0),definition:orderPolicySchema,reason:z.string().trim().min(3).max(1000),idempotencyKey:z.uuid()}).strict(),input),requestHash=commercialDigest(data);
 return(await database()).transaction(async sql=>{
  await sql.query('LOCK TABLE cohamy_crm.order_policy_current IN SHARE ROW EXCLUSIVE MODE');await assertCurrentPrincipal(sql,user);
  const prior=(await sql.query<OrderPolicy&{request_hash:string}>('SELECT * FROM cohamy_crm.order_policies WHERE actor_id=$1 AND idempotency_key=$2',[user.id,data.idempotencyKey])).rows[0];
  if(prior){if(prior.request_hash!==requestHash)throw new CrmError('IDEMPOTENCY_CONFLICT',409);return {id:prior.id,number:prior.number,version:data.version+1};}
  const current=(await sql.query<{version:number}>('SELECT version FROM cohamy_crm.order_policy_current WHERE singleton FOR UPDATE')).rows[0];
  if((current?.version??0)!==data.version)throw new CrmError('VERSION_CONFLICT',409);
  const id=randomUUID(),number=Number((await sql.query<{n:string}>('SELECT coalesce(max(number),0)::text AS n FROM cohamy_crm.order_policies')).rows[0].n)+1;
  await sql.query('INSERT INTO cohamy_crm.order_policies(id,number,definition,checksum,actor_id,reason,idempotency_key,request_hash) VALUES($1,$2,$3::jsonb,$4,$5,$6,$7,$8)',[id,number,JSON.stringify(data.definition),commercialDigest(data.definition),user.id,data.reason,data.idempotencyKey,requestHash]);
  await sql.query('INSERT INTO cohamy_crm.order_policy_current(singleton,policy_id,version) VALUES(true,$1,1) ON CONFLICT(singleton) DO UPDATE SET policy_id=excluded.policy_id,version=cohamy_crm.order_policy_current.version+1',[id]);
  await audit(sql,user.id,'order-policy.published',id,{before:{version:data.version},after:{number,enabled:data.definition.enabled},reason:data.reason});return {id,number,version:data.version+1};
 });
}
export function orderPartnerShortfalls(policy:OrderPolicyDefinition,organization:Organization){return policy.requiredPartnerFields.filter(field=>!String(organization[field]??'').trim());}
