import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {database,type Sql} from './db';
import {assertCurrentPrincipal,audit} from './auth';
import {assertPermission,CrmError} from './permissions';
import {partnerScope} from './repository';
import {pricingOrganization,calculateForOrganization} from './pricing';
import {basketSchema,type Basket} from './pricing-model';
import {quotationAccess,quoteVersionAccess,type QuotationSnapshot} from './quotations';
import {currentOrderPolicy} from './order-policy';
import {commercialDigest as hash,parseCommercial as parse,vietnamBusinessDate,commercialWriter} from './commercial-common';
import {getOrder} from './work';
import {commercialNotification} from './order-notifications';
import type {Principal} from './types';

export interface CommercialRequest {
 id:string;code:string;organization_id:string;creator_id:string;creator_membership_id:string;
 creator_area:'crm'|'portal';creator_role:string;channel:string;status:'DRAFT'|'PENDING_OWNER'|'READY'|'REJECTED'|'SUBMITTED';
 source_website_id:string|null;source_quotation_id:string|null;source_order_id:string|null;
 latest_version_id:string;owner_approved_version_id:string|null;version:number;updated_at:string;
 organization_name?:string;
}
export interface RequestVersion {
 id:string;request_id:string;number:number;snapshot:QuotationSnapshot;checksum:string;
 actor_id:string;created_at:string;
}
const deliverySchema=z.object({recipient:z.string().trim().min(2).max(120),phone:z.string().trim().min(5).max(40),address:z.string().trim().min(3).max(500)}).strict();
const saveSchema=z.object({
 id:z.uuid().optional(),version:z.number().int().min(0),organizationId:z.uuid(),
 channel:z.enum(['PORTAL','PHONE','VISIT','OTHER','WEBSITE','QUOTATION','REORDER','EXCEL']),
 sourceWebsiteId:z.uuid().optional(),sourceQuotationId:z.uuid().optional(),sourceOrderId:z.uuid().optional(),
 basket:basketSchema,delivery:deliverySchema,note:z.string().trim().max(2000),idempotencyKey:z.uuid(),
}).strict().refine(d=>Boolean(d.id)===(d.version>0)).refine(d=>
 Boolean(d.sourceWebsiteId)===(d.channel==='WEBSITE')&&Boolean(d.sourceQuotationId)===(d.channel==='QUOTATION')&&Boolean(d.sourceOrderId)===(d.channel==='REORDER'));
function writer(user:Principal){if(user.area==='crm')commercialWriter(user);else if(!['DEALER_OWNER','DEALER_STAFF'].includes(user.role))throw new CrmError('FORBIDDEN',403);}
export async function commercialRequestAccess(sql:Sql,user:Principal,id:string,lock=false):Promise<CommercialRequest>{
 assertPermission(user,'orders.read');parse(z.uuid(),id);const scope=partnerScope(user);
 const result=(await sql.query<CommercialRequest>(`SELECT r.*,o.name AS organization_name FROM cohamy_crm.commercial_requests r JOIN cohamy_crm.organizations o ON o.id=r.organization_id WHERE (${scope.sql}) ${user.area==='crm'?"AND(r.creator_area='crm' OR r.status='SUBMITTED')":''} AND r.id=$${scope.params.length+1}`+(lock?' FOR UPDATE OF r':''),[...scope.params,id])).rows[0];
 if(!result)throw new CrmError('NOT_FOUND',404);return result;
}
export async function requestVersionAccess(sql:Sql,head:CommercialRequest,id:string){
 const v=(await sql.query<RequestVersion>('SELECT * FROM cohamy_crm.commercial_request_versions WHERE request_id=$1 AND id=$2',[head.id,parse(z.uuid(),id)])).rows[0];
 if(!v)throw new CrmError('NOT_FOUND',404);if(v.checksum!==hash(v.snapshot))throw new CrmError('REQUEST_SNAPSHOT_INVALID',503);return v;
}
export async function listCommercialRequests(user:Principal,q=''){
 assertPermission(user,'orders.read');const s=partnerScope(user),params=[...s.params,'%'+q.trim().slice(0,120)+'%'];
 return(await(await database()).query<CommercialRequest>(`SELECT r.*,o.name AS organization_name FROM cohamy_crm.commercial_requests r JOIN cohamy_crm.organizations o ON o.id=r.organization_id WHERE (${s.sql}) ${user.area==='crm'?"AND(r.creator_area='crm' OR r.status='SUBMITTED')":''} AND(r.code ILIKE $${params.length} OR o.name ILIKE $${params.length}) ORDER BY r.updated_at DESC,r.id LIMIT 100`,params)).rows;
}
export async function commercialRequestVersions(user:Principal,id:string){
 return(await database()).transaction(async sql=>{await assertCurrentPrincipal(sql,user);const head=await commercialRequestAccess(sql,user,id),versions=(await sql.query<RequestVersion>('SELECT * FROM cohamy_crm.commercial_request_versions WHERE request_id=$1 ORDER BY number DESC LIMIT 100',[head.id])).rows;
 return versions.map(v=>{if(v.checksum!==hash(v.snapshot))throw new CrmError('REQUEST_SNAPSHOT_INVALID',503);return user.area==='portal'?{...v,snapshot:{...v.snapshot,policy:undefined}}:v;});});
}
export async function commercialTodoRequests(user:Principal){
 assertPermission(user,'orders.read');if(user.area!=='portal'||!['DEALER_OWNER','DEALER_STAFF'].includes(user.role))throw new CrmError('FORBIDDEN',403);
 const s=partnerScope(user),params=[...s.params,user.id];
 return(await(await database()).query<CommercialRequest>(`SELECT r.* FROM cohamy_crm.commercial_requests r JOIN cohamy_crm.organizations o ON o.id=r.organization_id WHERE (${s.sql}) AND ${user.role==='DEALER_OWNER'?`(r.status IN('PENDING_OWNER','READY') OR (r.creator_id=$${params.length} AND r.status='DRAFT'))`:`r.creator_id=$${params.length} AND r.status IN('DRAFT','READY','REJECTED')`} ORDER BY r.updated_at DESC,r.id LIMIT 5`,params)).rows;
}
export type RequestViewVersion=Awaited<ReturnType<typeof commercialRequestVersions>>[number];
async function requestSnapshot(sql:Sql,user:Principal,d:z.infer<typeof saveSchema>):Promise<QuotationSnapshot>{
 const org=await pricingOrganization(sql,user,d.organizationId),now=new Date((await sql.query<{now:string}>('SELECT now() AS now')).rows[0].now);
 if(d.channel==='QUOTATION'){
  const q=await quotationAccess(sql,user,d.sourceQuotationId!,true);if(q.organization_id!==org.id||!q.accepted_version_id)throw new CrmError('QUOTE_NOT_ACCEPTED',409);
  const v=await quoteVersionAccess(sql,user,q,q.accepted_version_id);if(new Date(v.valid_until)<=now)throw new CrmError('QUOTE_EXPIRED',409);
  if(hash(v.snapshot.basket)!==hash(d.basket))throw new CrmError('QUOTE_BASKET_CHANGED',409);
  const policy=(await sql.query<{definition:{acceptedQuotePrice:string}}>('SELECT p.definition FROM cohamy_crm.order_policy_current c JOIN cohamy_crm.order_policies p ON p.id=c.policy_id WHERE c.singleton FOR SHARE OF c')).rows[0];
  if(policy?.definition.acceptedQuotePrice!=='REPRICE')return {...v.snapshot,delivery:d.delivery,note:d.note};
 }
 if(d.channel==='WEBSITE'){
  if(user.area!=='crm')throw new CrmError('FORBIDDEN',403);const intake=await getOrder(user,d.sourceWebsiteId!,sql);
  if(intake.organization_id!==org.id||intake.status!=='READY')throw new CrmError('INTAKE_NOT_READY',409);
 }
 if(d.channel==='REORDER'){
  const scope=partnerScope(user),prior=(await sql.query<{organization_id:string;status:string}>(`SELECT s.organization_id,s.status FROM cohamy_crm.sales_orders s JOIN cohamy_crm.organizations o ON o.id=s.organization_id WHERE (${scope.sql}) AND s.id=$${scope.params.length+1} FOR SHARE OF s`,[...scope.params,d.sourceOrderId])).rows[0];
  if(!prior||prior.organization_id!==org.id||!['CONFIRMED','CANCELLED'].includes(prior.status))throw new CrmError('NOT_FOUND',404);
 }
 const price=await calculateForOrganization(sql,user,org.id,d.basket),validUntil=new Date(now.getTime()+price.priceVersion.definition.quoteValidityHours*3600000).toISOString();
 return {organization:{id:org.id,code:org.code,name:org.name,phone:org.phone,email:org.email,businessId:org.business_id??'',address:org.address},delivery:d.delivery,basket:d.basket,calculation:price.calculation,priceBook:{id:price.book.id,name:price.book.name,versionId:price.priceVersion.id,number:price.priceVersion.number,checksum:price.priceVersion.checksum},policy:price.priceVersion.definition,note:d.note,currency:'VND',issuedAt:now.toISOString(),validUntil};
}
export async function saveCommercialRequest(user:Principal,input:unknown,transactionSql?:Sql){
 writer(user);const d=parse(saveSchema,input);if(user.area==='portal'&&(!['PORTAL','EXCEL','REORDER','QUOTATION'].includes(d.channel)||d.organizationId!==user.organizationId))throw new CrmError('FORBIDDEN',403);const requestHash=hash(d);
 const run=async(sql:Sql)=>{
  // Serialize same-actor keys before taking the shared current-identity lock.
  await sql.query('SELECT id FROM cohamy_crm.users WHERE id=$1 FOR NO KEY UPDATE',[user.id]);await assertCurrentPrincipal(sql,user);
  const prior=(await sql.query<{id:string;request_id:string;number:number;request_hash:string}>('SELECT id,request_id,number,request_hash FROM cohamy_crm.commercial_request_versions WHERE actor_id=$1 AND idempotency_key=$2',[user.id,d.idempotencyKey])).rows[0];
  if(prior){if(prior.request_hash!==requestHash)throw new CrmError('IDEMPOTENCY_CONFLICT',409);await commercialRequestAccess(sql,user,prior.request_id);return {id:prior.request_id,versionId:prior.id,number:prior.number,version:d.version+1};}
  const head=d.id?await commercialRequestAccess(sql,user,d.id,true):null;
  if(head){if(head.version!==d.version||head.organization_id!==d.organizationId)throw new CrmError('VERSION_CONFLICT',409);if(head.status==='SUBMITTED')throw new CrmError('REQUEST_ALREADY_SUBMITTED',409);if(user.area==='portal'&&user.role==='DEALER_STAFF'&&head.creator_id!==user.id)throw new CrmError('FORBIDDEN',403);if(head.channel!==d.channel||head.source_website_id!==(d.sourceWebsiteId??null)||head.source_quotation_id!==(d.sourceQuotationId??null)||head.source_order_id!==(d.sourceOrderId??null))throw new CrmError('REQUEST_SOURCE_CHANGED',409);}
  const snapshot=await requestSnapshot(sql,user,d),id=d.id??randomUUID(),versionId=randomUUID(),now=new Date((await sql.query<{now:string}>('SELECT now() AS now')).rows[0].now),number=Number((await sql.query<{n:string}>('SELECT coalesce(max(number),0)::text AS n FROM cohamy_crm.commercial_request_versions WHERE request_id=$1',[id])).rows[0].n)+1;
  if(!head)await sql.query('INSERT INTO cohamy_crm.commercial_requests(id,code,organization_id,creator_id,creator_membership_id,creator_area,creator_role,channel,source_website_id,source_quotation_id,source_order_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,'YC-'+vietnamBusinessDate(now)+'-'+id.slice(0,8).toUpperCase(),d.organizationId,user.id,user.membershipId,user.area,user.role,d.channel,d.sourceWebsiteId??null,d.sourceQuotationId??null,d.sourceOrderId??null]);
  await sql.query('INSERT INTO cohamy_crm.commercial_request_versions(id,request_id,number,snapshot,checksum,actor_id,idempotency_key,request_hash) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,$8)',[versionId,id,number,JSON.stringify(snapshot),hash(snapshot),user.id,d.idempotencyKey,requestHash]);
  await sql.query("UPDATE cohamy_crm.commercial_requests SET latest_version_id=$1,owner_approved_version_id=NULL,status='DRAFT',version=$2,updated_at=now() WHERE id=$3",[versionId,d.version+1,id]);
  await audit(sql,user.id,'commercial-request.version-created',id,{after:{number,versionId,priceVersionId:snapshot.priceBook.versionId,channel:d.channel},reason:'Lưu đề nghị; chưa chuyển thành đơn bán hàng.'});return {id,versionId,number,version:d.version+1};
 };return transactionSql?run(transactionSql):(await database()).transaction(run);
}
export async function requestAction(user:Principal,input:unknown){
 writer(user);const d=parse(z.object({id:z.uuid(),version:z.number().int().positive(),versionId:z.uuid(),action:z.enum(['PROPOSE','OWNER_APPROVE','OWNER_REJECT']),reason:z.string().trim().min(3).max(2000),idempotencyKey:z.uuid()}).strict(),input),requestHash=hash(d);
 return(await database()).transaction(async sql=>{
  await assertCurrentPrincipal(sql,user);const head=await commercialRequestAccess(sql,user,d.id,true),prior=(await sql.query<{request_hash:string;result:unknown}>('SELECT request_hash,result FROM cohamy_crm.commercial_events WHERE actor_id=$1 AND idempotency_key=$2',[user.id,d.idempotencyKey])).rows[0];
  if(prior){if(prior.request_hash!==requestHash)throw new CrmError('IDEMPOTENCY_CONFLICT',409);return prior.result;}
  if(head.version!==d.version||head.latest_version_id!==d.versionId)throw new CrmError('VERSION_CONFLICT',409);if(head.status==='SUBMITTED')throw new CrmError('REQUEST_ALREADY_SUBMITTED',409);
  const v=await requestVersionAccess(sql,head,d.versionId),policy=await currentOrderPolicy(sql);await pricingOrganization(sql,user,head.organization_id);
  if(new Date(v.snapshot.validUntil)<=new Date((await sql.query<{now:string}>('SELECT now() AS now')).rows[0].now))throw new CrmError('REQUEST_EXPIRED',409);
  if(v.snapshot.calculation.minimumShortfalls.length)throw new CrmError('ORDER_MINIMUM_NOT_MET',409);
  let status:CommercialRequest['status'],action:string,approved:string|null=null;
  if(d.action==='PROPOSE'){
   if(head.status!=='DRAFT'||head.creator_id!==user.id)throw new CrmError('REQUEST_NOT_EDITABLE',409);
   status=head.creator_area==='portal'&&head.creator_role==='DEALER_STAFF'&&policy.definition.requireOwnerApproval?'PENDING_OWNER':'READY';action='PROPOSED';
  }else{
   if(user.area!=='portal'||user.role!=='DEALER_OWNER')throw new CrmError('FORBIDDEN',403);if(head.status!=='PENDING_OWNER')throw new CrmError('OWNER_APPROVAL_NOT_REQUIRED',409);
   status=d.action==='OWNER_APPROVE'?'READY':'REJECTED';action=d.action==='OWNER_APPROVE'?'OWNER_APPROVED':'OWNER_REJECTED';if(status==='READY')approved=v.id;
  }
  const result={id:head.id,version:head.version+1,status};await sql.query('UPDATE cohamy_crm.commercial_requests SET status=$1,owner_approved_version_id=$2,version=version+1,updated_at=now() WHERE id=$3',[status,approved,head.id]);
  await sql.query('INSERT INTO cohamy_crm.commercial_events(id,request_id,source_version_id,action,actor_id,reason,idempotency_key,request_hash,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)',[randomUUID(),head.id,v.id,action,user.id,d.reason,d.idempotencyKey,requestHash,JSON.stringify(result)]);
  if(status==='PENDING_OWNER'||d.action!=='PROPOSE')await commercialNotification(sql,{organizationId:head.organization_id,type:'commercial-request',id:head.id,versionId:v.id,action,message:head.code+(status==='PENDING_OWNER'?' đang chờ chủ đại lý duyệt.':status==='READY'?' đã được chủ đại lý duyệt; kiểm tra và gửi đến Cohamy.':' đã bị chủ đại lý từ chối; kiểm tra lý do và sửa bản nháp.'),actorId:user.id,audience:status==='PENDING_OWNER'?'OWNER':'PARTNER',creatorId:head.creator_id});
  await audit(sql,user.id,'commercial-request.'+action.toLowerCase(),head.id,{after:{status,versionId:v.id,orderPolicyId:policy.id},reason:d.reason});return result;
 });
}
export async function commercialTimeline(user:Principal,type:'request'|'order',id:string,sql?:Sql){
 const tx=sql??await database();if(type==='request')await commercialRequestAccess(tx,user,id);else{const {salesOrderAccess}=await import('./sales-orders');await salesOrderAccess(tx,user,id);}
 return(await tx.query<{id:string;action:string;reason:string;internal:boolean;actor_name:string;source_version_id:string;created_at:string}>(`SELECT e.id,e.action,e.reason,e.internal,u.display_name AS actor_name,e.source_version_id,e.created_at FROM cohamy_crm.commercial_events e JOIN cohamy_crm.users u ON u.id=e.actor_id WHERE e.${type==='request'?'request_id':'order_id'}=$1 ${user.area==='portal'?'AND NOT e.internal':''} ORDER BY e.created_at DESC,e.id LIMIT 500`,[parse(z.uuid(),id)])).rows;
}
export type RequestBasket=Basket;
