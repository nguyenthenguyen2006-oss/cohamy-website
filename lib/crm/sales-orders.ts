import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {database,type Sql} from './db';
import {assertCurrentPrincipal,audit} from './auth';
import {assertPermission,CrmError} from './permissions';
import {partnerScope} from './repository';
import {pricingOrganization,calculateForOrganization} from './pricing';
import {commercialRequestAccess,requestVersionAccess,type CommercialRequest} from './order-requests';
import {currentOrderPolicy,orderPartnerShortfalls,type OrderPolicyDefinition} from './order-policy';
import {commercialDigest as hash,parseCommercial as parse,vietnamBusinessDate} from './commercial-common';
import type {QuotationSnapshot} from './quotations';
import type {Principal} from './types';
import {commercialNotification} from './order-notifications';

export interface SalesOrder {id:string;code:string;organization_id:string;request_id:string;creator_id:string;status:'PENDING_APPROVAL'|'CONFIRMED'|'REJECTED'|'CANCELLED';delivery_status:string;payment_status:string;latest_version_id:string;confirmed_version_id:string|null;version:number;organization_name?:string;updated_at:string}
export interface SalesSnapshot {quote:QuotationSnapshot;request:{id:string;code:string;versionId:string;creatorId:string;channel:string;sourceWebsiteId:string|null;sourceQuotationId:string|null;sourceOrderId:string|null};orderPolicy:{id:string;number:number;definition:OrderPolicyDefinition;checksum:string};approvalReasons:string[];issuedAt:string}
export interface SalesVersion {id:string;order_id:string;number:number;request_version_id:string;order_policy_id:string;snapshot:SalesSnapshot;checksum:string;approval_required:boolean;actor_id:string;created_at:string}
export async function salesOrderAccess(sql:Sql,user:Principal,id:string,lock=false):Promise<SalesOrder>{
 assertPermission(user,'orders.read');parse(z.uuid(),id);const scope=partnerScope(user);
 const row=(await sql.query<SalesOrder>(`SELECT s.*,o.name AS organization_name FROM cohamy_crm.sales_orders s JOIN cohamy_crm.organizations o ON o.id=s.organization_id WHERE (${scope.sql}) AND s.id=$${scope.params.length+1}`+(lock?' FOR UPDATE OF s':''),[...scope.params,id])).rows[0];
 if(!row)throw new CrmError('NOT_FOUND',404);return row;
}
export async function salesVersionAccess(sql:Sql,head:SalesOrder,id:string){
 const v=(await sql.query<SalesVersion>('SELECT * FROM cohamy_crm.sales_order_versions WHERE order_id=$1 AND id=$2',[head.id,parse(z.uuid(),id)])).rows[0];if(!v)throw new CrmError('NOT_FOUND',404);if(v.checksum!==hash(v.snapshot))throw new CrmError('ORDER_SNAPSHOT_INVALID',503);return v;
}
export async function listSalesOrders(user:Principal,q=''){
 assertPermission(user,'orders.read');const scope=partnerScope(user),params=[...scope.params,'%'+q.trim().slice(0,120)+'%'];
 return(await(await database()).query<SalesOrder>(`SELECT s.*,o.name AS organization_name FROM cohamy_crm.sales_orders s JOIN cohamy_crm.organizations o ON o.id=s.organization_id WHERE (${scope.sql}) AND(s.code ILIKE $${params.length} OR o.name ILIKE $${params.length}) ORDER BY s.updated_at DESC,s.id LIMIT 100`,params)).rows;
}
export async function salesOrderVersions(user:Principal,id:string){return(await database()).transaction(async sql=>{
 await assertCurrentPrincipal(sql,user);const head=await salesOrderAccess(sql,user,id),versions=(await sql.query<SalesVersion>('SELECT * FROM cohamy_crm.sales_order_versions WHERE order_id=$1 ORDER BY number DESC LIMIT 100',[head.id])).rows;
 return versions.map(v=>{if(v.checksum!==hash(v.snapshot))throw new CrmError('ORDER_SNAPSHOT_INVALID',503);if(user.area!=='portal')return v;return {...v,snapshot:{...v.snapshot,quote:{...v.snapshot.quote,policy:undefined},orderPolicy:{id:v.snapshot.orderPolicy.id,number:v.snapshot.orderPolicy.number,checksum:v.snapshot.orderPolicy.checksum},approvalReasons:undefined}};});
});}
function requestMaySubmit(user:Principal,head:CommercialRequest,policy:OrderPolicyDefinition){
 if(user.area==='crm'&&!['ADMIN','MANAGER','SALES'].includes(user.role))throw new CrmError('FORBIDDEN',403);
 if(user.area==='portal'&&!['DEALER_OWNER','DEALER_STAFF'].includes(user.role))throw new CrmError('FORBIDDEN',403);
 if(head.status!=='READY')throw new CrmError(head.status==='SUBMITTED'?'REQUEST_ALREADY_SUBMITTED':'REQUEST_NOT_READY',409);
 if(head.creator_area==='portal'&&head.creator_role==='DEALER_STAFF'&&policy.requireOwnerApproval&&head.owner_approved_version_id!==head.latest_version_id)throw new CrmError('OWNER_APPROVAL_REQUIRED',409);
 if(user.area==='portal'&&user.role==='DEALER_STAFF'&&head.creator_id!==user.id)throw new CrmError('FORBIDDEN',403);
}
export async function submitSalesRequest(user:Principal,input:unknown){
 const d=parse(z.object({id:z.uuid(),version:z.number().int().positive(),versionId:z.uuid(),reason:z.string().trim().min(3).max(2000),idempotencyKey:z.uuid()}).strict(),input),requestHash=hash(d);
 return(await database()).transaction(async sql=>{
  await assertCurrentPrincipal(sql,user);const head=await commercialRequestAccess(sql,user,d.id,true),prior=(await sql.query<{request_hash:string;result:unknown}>('SELECT request_hash,result FROM cohamy_crm.commercial_events WHERE actor_id=$1 AND idempotency_key=$2',[user.id,d.idempotencyKey])).rows[0];
  if(prior){if(prior.request_hash!==requestHash)throw new CrmError('IDEMPOTENCY_CONFLICT',409);return prior.result;}
  if(head.version!==d.version||head.latest_version_id!==d.versionId)throw new CrmError('VERSION_CONFLICT',409);
  const policy=await currentOrderPolicy(sql);requestMaySubmit(user,head,policy.definition);const org=await pricingOrganization(sql,user,head.organization_id),v=await requestVersionAccess(sql,head,d.versionId),now=new Date((await sql.query<{now:string}>('SELECT now() AS now')).rows[0].now);
  if(orderPartnerShortfalls(policy.definition,org).length)throw new CrmError('PARTNER_INCOMPLETE',409);if(new Date(v.snapshot.validUntil)<=now)throw new CrmError('REQUEST_EXPIRED',409);
  if(v.snapshot.calculation.minimumShortfalls.length)throw new CrmError('ORDER_MINIMUM_NOT_MET',409);
  if(head.source_quotation_id&&policy.definition.acceptedQuotePrice==='UNTIL_QUOTE_EXPIRY'){
   const {quotationAccess,quoteVersionAccess}=await import('./quotations'),quote=await quotationAccess(sql,user,head.source_quotation_id,true);if(!quote.accepted_version_id)throw new CrmError('QUOTE_NOT_ACCEPTED',409);const accepted=await quoteVersionAccess(sql,user,quote,quote.accepted_version_id);if(hash(accepted.snapshot.calculation)!==hash(v.snapshot.calculation)||hash(accepted.snapshot.basket)!==hash(v.snapshot.basket))throw new CrmError('QUOTE_BASKET_CHANGED',409);
  }else{
   const current=await calculateForOrganization(sql,user,org.id,v.snapshot.basket);
   if(current.priceVersion.id!==v.snapshot.priceBook.versionId||hash(current.calculation)!==hash(v.snapshot.calculation))throw new CrmError('REQUEST_PRICE_CHANGED',409);
  }
  const reasons=[...v.snapshot.calculation.approvalReasons];if(policy.definition.alwaysManagerApproval)reasons.push('POLICY');if(policy.definition.managerApprovalAmount!==null&&BigInt(v.snapshot.calculation.total)>=BigInt(policy.definition.managerApprovalAmount))reasons.push('ORDER_AMOUNT');if(policy.definition.creditRequiresApproval&&v.snapshot.basket.creditTerms&&!reasons.includes('CREDIT_TERMS'))reasons.push('CREDIT_TERMS');
  const snapshot:SalesSnapshot={quote:v.snapshot,request:{id:head.id,code:head.code,versionId:v.id,creatorId:head.creator_id,channel:head.channel,sourceWebsiteId:head.source_website_id,sourceQuotationId:head.source_quotation_id,sourceOrderId:head.source_order_id},orderPolicy:{id:policy.id,number:policy.number,definition:policy.definition,checksum:policy.checksum},approvalReasons:reasons,issuedAt:now.toISOString()},id=randomUUID(),versionId=randomUUID();
  await sql.query('INSERT INTO cohamy_crm.sales_orders(id,code,organization_id,request_id,creator_id,source_website_id,source_quotation_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,'DH-'+vietnamBusinessDate(now)+'-'+id.slice(0,8).toUpperCase(),org.id,head.id,user.id,head.source_website_id,head.source_quotation_id]);
  await sql.query('INSERT INTO cohamy_crm.sales_order_versions(id,order_id,number,request_version_id,order_policy_id,snapshot,checksum,approval_required,actor_id) VALUES($1,$2,1,$3,$4,$5::jsonb,$6,$7,$8)',[versionId,id,v.id,policy.id,JSON.stringify(snapshot),hash(snapshot),reasons.length>0,user.id]);await sql.query('UPDATE cohamy_crm.sales_orders SET latest_version_id=$1 WHERE id=$2',[versionId,id]);
  await sql.query("UPDATE cohamy_crm.commercial_requests SET status='SUBMITTED',version=version+1,updated_at=now() WHERE id=$1",[head.id]);const result={id,version:1,versionId,requestId:head.id,requestVersion:head.version+1};
  await sql.query("INSERT INTO cohamy_crm.commercial_events(id,request_id,source_version_id,action,actor_id,reason,idempotency_key,request_hash,result) VALUES($1,$2,$3,'SUBMITTED',$4,$5,$6,$7,$8::jsonb)",[randomUUID(),head.id,v.id,user.id,d.reason,d.idempotencyKey,requestHash,JSON.stringify(result)]);
  await sql.query("INSERT INTO cohamy_crm.commercial_events(id,order_id,source_version_id,action,actor_id,reason,idempotency_key,request_hash,result) VALUES($1,$2,$3,'CREATED',$4,$5,$6,$7,$8::jsonb)",[randomUUID(),id,versionId,user.id,d.reason,randomUUID(),hash({sourceRequestId:head.id}),JSON.stringify(result)]);
  await commercialNotification(sql,{organizationId:org.id,type:'sales-order',id,versionId,action:'CREATED',message:head.code+' đã gửi đến Cohamy và đang chờ xác nhận.',actorId:user.id,audience:'COHAMY'});
  await audit(sql,user.id,'sales-order.created',id,{after:{requestId:head.id,requestVersionId:v.id,versionId,orderPolicyId:policy.id,approvalReasons:reasons},reason:d.reason});return result;
 });
}
export async function salesOrderAction(user:Principal,input:unknown){
 const d=parse(z.object({id:z.uuid(),version:z.number().int().positive(),versionId:z.uuid(),action:z.enum(['APPROVE','REJECT','CONFIRM']),reason:z.string().trim().min(3).max(2000),idempotencyKey:z.uuid()}).strict(),input),requestHash=hash(d);
 if(user.area!=='crm')throw new CrmError('FORBIDDEN',403);
 return(await database()).transaction(async sql=>{
  await assertCurrentPrincipal(sql,user);const head=await salesOrderAccess(sql,user,d.id,true),v=await salesVersionAccess(sql,head,d.versionId),prior=(await sql.query<{request_hash:string;result:unknown}>('SELECT request_hash,result FROM cohamy_crm.commercial_events WHERE actor_id=$1 AND idempotency_key=$2',[user.id,d.idempotencyKey])).rows[0];
  if(prior){if(prior.request_hash!==requestHash)throw new CrmError('IDEMPOTENCY_CONFLICT',409);return prior.result;}if(head.version!==d.version||head.latest_version_id!==v.id)throw new CrmError('VERSION_CONFLICT',409);if(head.status!=='PENDING_APPROVAL')throw new CrmError('ORDER_ALREADY_DECIDED',409);
  const policy=v.snapshot.orderPolicy.definition,current=await currentOrderPolicy(sql);if(!current.definition.enabled)throw new CrmError('ORDER_POLICY_UNAVAILABLE',409);const org=await pricingOrganization(sql,user,head.organization_id);
  const decision=(await sql.query<{action:string}>('SELECT action FROM cohamy_crm.commercial_events WHERE order_id=$1 AND source_version_id=$2 AND action IN(\'APPROVED\',\'REJECTED\')',[head.id,v.id])).rows[0];
  let status:SalesOrder['status']='PENDING_APPROVAL',action:string;
  if(d.action==='APPROVE'||d.action==='REJECT'){
   if(!policy.approvalRoles.includes(user.role as 'ADMIN'|'MANAGER'))throw new CrmError('FORBIDDEN',403);if(!v.approval_required)throw new CrmError('ORDER_APPROVAL_NOT_REQUIRED',409);if(decision)throw new CrmError('ORDER_ALREADY_DECIDED',409);
   if((policy.nonSelfApproval||v.snapshot.quote.policy.approval.nonSelfApproval)&&[head.creator_id,v.snapshot.request.creatorId,v.actor_id].includes(user.id))throw new CrmError('SELF_APPROVAL_BLOCKED',403);
   action=d.action==='APPROVE'?'APPROVED':'REJECTED';if(action==='REJECTED')status='REJECTED';
  }else{
   if(!policy.confirmationRoles.includes(user.role as 'ADMIN'|'MANAGER'|'SALES'))throw new CrmError('FORBIDDEN',403);if(v.approval_required&&decision?.action!=='APPROVED')throw new CrmError('ORDER_APPROVAL_REQUIRED',409);
   if(orderPartnerShortfalls(policy,org).length)throw new CrmError('PARTNER_INCOMPLETE',409);const now=new Date((await sql.query<{now:string}>('SELECT now() AS now')).rows[0].now);if(new Date(v.snapshot.quote.validUntil)<=now)throw new CrmError('ORDER_PRICE_EXPIRED',409);status='CONFIRMED';action='CONFIRMED';
  }
  const result={id:head.id,version:head.version+1,status};await sql.query('UPDATE cohamy_crm.sales_orders SET status=$1,confirmed_version_id=CASE WHEN $1=\'CONFIRMED\' THEN $2 ELSE confirmed_version_id END,version=version+1,updated_at=now() WHERE id=$3',[status,v.id,head.id]);
  await sql.query('INSERT INTO cohamy_crm.commercial_events(id,order_id,source_version_id,action,actor_id,reason,internal,idempotency_key,request_hash,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)',[randomUUID(),head.id,v.id,action,user.id,d.reason,action==='APPROVED',d.idempotencyKey,requestHash,JSON.stringify(result)]);
  if(action==='CONFIRMED'||action==='REJECTED')await commercialNotification(sql,{organizationId:head.organization_id,type:'sales-order',id:head.id,versionId:v.id,action,message:head.code+(action==='CONFIRMED'?' đã được Cohamy xác nhận.':' đã bị từ chối; mở đơn để xem lý do.'),actorId:user.id,audience:'PARTNER',creatorId:v.snapshot.request.creatorId});
  await audit(sql,user.id,'sales-order.'+action.toLowerCase(),head.id,{after:{status,versionId:v.id,orderPolicyId:v.order_policy_id},reason:d.reason});return result;
 });
}
