import 'server-only';
import {z} from 'zod';
import {getProductById} from '@/data/products';
import {database,type Sql} from './db';
import {assertCurrentPrincipal,audit,digest} from './auth';
import {CrmError,isWarehouseRole} from './permissions';
import {warehouseScope} from './warehouse-scope';
import type {Principal} from './types';

type DispatchStatus='UNASSIGNED'|'ASSIGNED'|'ACCEPTED';
type Contact={fullName:string;email:string;phone:string;address:string;city:string;district:string;ward:string;note:string};
type SourceLine={websiteId?:string;crmProductId?:string;name:string;quantity:number;unitPrice:string;lineTotal:string;vatRate?:string;vatAmount?:string};
type RawOrder={id:string;code:string;version:number;status:string;created_at:Date|string;contact:Contact;lines:SourceLine[];subtotal:string;payment_requested:string;paid:boolean;assigned_warehouse_id:string|null;dispatch_status:DispatchStatus;dispatch_note:string;dispatched_at:Date|string|null;accepted_at:Date|string|null;warehouse_name:string|null;warehouse_code:string|null;assigned_by_name:string|null;accepted_by_name:string|null;sales_order_id:string|null;sales_order_code:string|null;sales_order_status:string|null};
export type OnlineWarehouse={id:string;code:string;name:string};
const pageSize=20;
const iso=(value:Date|string|null)=>value===null?null:value instanceof Date?value.toISOString():value;
function access(user:Principal){if(user.area!=='crm'||(user.role!=='ADMIN'&&!isWarehouseRole(user.role)))throw new CrmError('FORBIDDEN',403);}
function identifier(value:string){if(!z.uuid().safeParse(value).success)throw new CrmError('NOT_FOUND',404);}
function parse<T>(schema:z.ZodType<T>,input:unknown):T{const result=schema.safeParse(input);if(!result.success)throw new CrmError('INVALID_FIELDS',400);return result.data;}
function pageNumber(value:string|undefined){if(value===undefined||value==='')return 1;return parse(z.coerce.number().int().min(1).max(1000000),value);}
function scopedOrders(user:Principal){
 if(user.role==='ADMIN')return {sql:'true',params:[] as unknown[]};
 const scope=warehouseScope(user,'ow',1);
 return {sql:`EXISTS(SELECT 1 FROM cohamy_crm.warehouses ow JOIN cohamy_crm.organizations owner ON owner.id=ow.organization_id WHERE ow.id=o.assigned_warehouse_id AND ow.organization_id=$1 AND ow.active AND owner.active AND owner.kind='COHAMY' AND (${scope.sql}))`,params:[user.organizationId,...scope.params]};
}
async function warehouses(sql:Sql,user:Principal){
 const scope=warehouseScope(user,'w',1);
 return (await sql.query<OnlineWarehouse>(`SELECT w.id,w.code,w.name FROM cohamy_crm.warehouses w JOIN cohamy_crm.organizations owner ON owner.id=w.organization_id WHERE w.active AND owner.active AND owner.kind='COHAMY' AND w.organization_id=$1 AND (${scope.sql}) ORDER BY w.name,w.id`,[user.organizationId,...scope.params])).rows;
}
const selection=`SELECT o.*,o.subtotal::text,w.name AS warehouse_name,w.code AS warehouse_code,assigner.display_name AS assigned_by_name,receiver.display_name AS accepted_by_name,s.id AS sales_order_id,s.code AS sales_order_code,s.status AS sales_order_status
 FROM cohamy_crm.website_orders o
 LEFT JOIN cohamy_crm.warehouses w ON w.id=o.assigned_warehouse_id
 LEFT JOIN cohamy_crm.users assigner ON assigner.id=o.dispatched_by
 LEFT JOIN cohamy_crm.users receiver ON receiver.id=o.accepted_by
 LEFT JOIN cohamy_crm.sales_orders s ON s.source_website_id=o.id`;
function display(row:RawOrder){
 return {id:row.id,code:row.code,version:row.version,status:row.status,createdAt:iso(row.created_at)!,contact:row.contact,
  lines:row.lines.map(line=>{const product=line.websiteId?getProductById(line.websiteId):undefined;return {...line,image:product?.images[0],unit:'Gói' as const};}),
  subtotal:row.subtotal,paymentRequested:row.payment_requested,paid:row.paid,
  dispatch:{status:row.dispatch_status,warehouseId:row.assigned_warehouse_id,warehouseName:row.warehouse_name,warehouseCode:row.warehouse_code,assignedAt:iso(row.dispatched_at),assignedBy:row.assigned_by_name,acceptedAt:iso(row.accepted_at),acceptedBy:row.accepted_by_name,note:row.dispatch_note},
  linkedSalesOrder:row.sales_order_id?{id:row.sales_order_id,code:row.sales_order_code!,status:row.sales_order_status!}:null};
}
async function orderRow(sql:Sql,user:Principal,id:string){
 identifier(id);const scope=scopedOrders(user);
 const row=(await sql.query<RawOrder>(`${selection} WHERE (${scope.sql}) AND o.id=$${scope.params.length+1}`,[...scope.params,id])).rows[0];
 if(!row)throw new CrmError('NOT_FOUND',404);return row;
}
export async function listOnlineOrders(user:Principal,query:Record<string,string>={}){
 access(user);const requestedPage=pageNumber(query.page);
 return (await database()).transaction(async sql=>{
  await assertCurrentPrincipal(sql,user);const scope=scopedOrders(user),params=[...scope.params],conditions=[scope.sql];
  const add=(value:unknown,condition:(parameter:string)=>string)=>{params.push(value);conditions.push(condition('$'+params.length));};
  if(query.q)add('%'+query.q.trim().slice(0,120)+'%',p=>`(o.code ILIKE ${p} OR o.contact->>'fullName' ILIKE ${p} OR o.contact->>'phone' ILIKE ${p} OR o.contact->>'email' ILIKE ${p})`);
  if(query.status)add(parse(z.enum(['PENDING_REVIEW','IN_PROGRESS','READY','REJECTED','CANCELLED']),query.status),p=>`o.status=${p}`);
  if(query.dispatchStatus)add(parse(z.enum(['UNASSIGNED','ASSIGNED','ACCEPTED']),query.dispatchStatus),p=>`o.dispatch_status=${p}`);
  if(query.warehouseId)add(parse(z.uuid(),query.warehouseId),p=>`o.assigned_warehouse_id=${p}`);
  for(const key of ['from','to'] as const)if(query[key])add(parse(z.iso.date(),query[key]),p=>key==='from'?`o.created_at>=(${p}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`:`o.created_at<((${p}::date+1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`);
  const where=conditions.map(value=>'('+value+')').join(' AND ');
  const total=Number((await sql.query<{total:string}>(`SELECT count(*)::text AS total FROM cohamy_crm.website_orders o WHERE ${where}`,params)).rows[0].total);
  const page=Math.min(requestedPage,Math.max(1,Math.ceil(total/pageSize)));
  const rows=(await sql.query<RawOrder>(`${selection} WHERE ${where} ORDER BY o.created_at DESC,o.id LIMIT ${pageSize} OFFSET $${params.length+1}`,[...params,(page-1)*pageSize])).rows;
  return {items:rows.map(display),total,page,pageSize,warehouses:await warehouses(sql,user),canDispatch:user.role==='ADMIN',canAccept:true};
 });
}
export async function getOnlineOrder(user:Principal,id:string,query:Record<string,string>={}){
 access(user);identifier(id);const requestedHistory=pageNumber(query.historyPage),requestedMail=pageNumber(query.mailPage);
 return (await database()).transaction(async sql=>{
  await assertCurrentPrincipal(sql,user);const row=await orderRow(sql,user,id);
  const historyTotal=Number((await sql.query<{total:string}>('SELECT count(*)::text AS total FROM cohamy_crm.website_order_dispatch_actions WHERE website_order_id=$1',[id])).rows[0].total);
  const historyPage=Math.min(requestedHistory,Math.max(1,Math.ceil(historyTotal/pageSize)));
  const historyRows=(await sql.query<{id:string;action:string;fromWarehouseName:string;toWarehouseName:string;reason:string;actorName:string;createdAt:Date|string;version:number}>(`SELECT id,action,from_warehouse_name AS "fromWarehouseName",to_warehouse_name AS "toWarehouseName",reason,actor_name AS "actorName",created_at AS "createdAt",version FROM cohamy_crm.website_order_dispatch_actions WHERE website_order_id=$1 ORDER BY created_at DESC,id DESC LIMIT ${pageSize} OFFSET $2`,[id,(historyPage-1)*pageSize])).rows;
  let mailTotal=0,mailPage=1;
  type MailRow={id:string;status:string;attempts:number;recipients:{to:string[];cc:string[];bcc:string[]};last_error:string|null;created_at:Date|string;updated_at:Date|string};
  let mailRows:MailRow[]=[];
  if(user.role==='ADMIN'){
   mailTotal=Number((await sql.query<{total:string}>("SELECT count(*)::text AS total FROM cohamy_crm.document_mail_outbox WHERE event='website.order.received' AND entity_id=$1",[id])).rows[0].total);
   mailPage=Math.min(requestedMail,Math.max(1,Math.ceil(mailTotal/pageSize)));
   mailRows=(await sql.query<MailRow>(`SELECT id,status,attempts,recipients,last_error,created_at,updated_at FROM cohamy_crm.document_mail_outbox WHERE event='website.order.received' AND entity_id=$1 ORDER BY created_at DESC,id DESC LIMIT ${pageSize} OFFSET $2`,[id,(mailPage-1)*pageSize])).rows;
  }
  return {order:display(row),warehouses:await warehouses(sql,user),canDispatch:user.role==='ADMIN',canAccept:true,
   history:{items:historyRows.map(action=>({...action,createdAt:iso(action.createdAt)!})),total:historyTotal,page:historyPage,pageSize},
   mailJobs:{items:mailRows.map(job=>({id:job.id,status:job.status,attempts:job.attempts,recipients:job.recipients,lastError:job.last_error?'Email cần kiểm tra trong lịch sử thông báo.':null,createdAt:iso(job.created_at)!,updatedAt:iso(job.updated_at)!})),total:mailTotal,page:mailPage,pageSize}};
 });
}
const assignSchema=z.object({version:z.number().int().positive(),warehouseId:z.uuid(),reason:z.string().trim().min(5).max(1000),idempotencyKey:z.uuid()}).strict();
const acceptSchema=z.object({version:z.number().int().positive(),reason:z.string().trim().max(1000).default(''),idempotencyKey:z.uuid()}).strict();
type ActionResult={id:string;version:number;dispatchStatus:DispatchStatus;warehouseId:string};
async function mutate(user:Principal,id:string,action:'ASSIGN'|'ACCEPT',input:{version:number;reason:string;idempotencyKey:string;warehouseId?:string}):Promise<ActionResult>{
 identifier(id);const requestHash=digest(JSON.stringify({id,action,...input,idempotencyKey:undefined}));
 return (await database()).transaction(async sql=>{
  await assertCurrentPrincipal(sql,user);
  await sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['website-online-action:'+input.idempotencyKey]);
  await sql.query('SELECT id FROM cohamy_crm.website_orders WHERE id=$1 FOR UPDATE',[id]);
  const old=await orderRow(sql,user,id);
  // The generic warehouse role is granted by a removable assignment row.
  // Hold that grant until commit so a concurrent reassignment cannot authorize
  // an acceptance after this user's warehouse access has been removed.
  if(user.role==='WAREHOUSE'){
   const grant=(await sql.query('SELECT membership_id FROM cohamy_crm.warehouse_assignments WHERE membership_id=$1 AND warehouse_id=$2 FOR SHARE',[user.membershipId,old.assigned_warehouse_id])).rows[0];
   if(!grant)throw new CrmError('FORBIDDEN',403);
  }
  const replay=(await sql.query<{actor_id:string;request_hash:string;result:ActionResult}>('SELECT actor_id,request_hash,result FROM cohamy_crm.website_order_dispatch_actions WHERE id=$1',[input.idempotencyKey])).rows[0];
  if(replay){if(replay.actor_id!==user.id||replay.request_hash!==requestHash)throw new CrmError('IDEMPOTENCY_CONFLICT',409);return replay.result;}
  if(old.version!==input.version)throw new CrmError('VERSION_CONFLICT',409);
  if(['REJECTED','CANCELLED'].includes(old.status))throw new CrmError('ORDER_NOT_ROUTABLE',409);
  if(old.sales_order_id)throw new CrmError('ORDER_ALREADY_CONVERTED',409);
  const targetId=action==='ASSIGN'?input.warehouseId!:old.assigned_warehouse_id;
  if(!targetId)throw new CrmError('WAREHOUSE_REQUIRED',409);
  const warehouse=(await warehouses(sql,user)).find(item=>item.id===targetId);
  if(!warehouse)throw new CrmError('INVALID_WAREHOUSE',403);
  // Lock the chosen active warehouse while recording the handoff.
  const targetScope=warehouseScope(user,'w',2);
  const current=(await sql.query<{id:string}>(`SELECT w.id FROM cohamy_crm.warehouses w JOIN cohamy_crm.organizations owner ON owner.id=w.organization_id WHERE w.id=$1 AND w.active AND w.organization_id=$2 AND owner.active AND owner.kind='COHAMY' AND (${targetScope.sql}) FOR SHARE OF w,owner`,[targetId,user.organizationId,...targetScope.params])).rows[0];
  if(!current)throw new CrmError('INVALID_WAREHOUSE',409);
  if(action==='ASSIGN'&&old.assigned_warehouse_id===targetId)throw new CrmError('WAREHOUSE_UNCHANGED',409);
  if(action==='ACCEPT'&&old.dispatch_status!=='ASSIGNED')throw new CrmError('ORDER_NOT_AWAITING_WAREHOUSE',409);
  const version=old.version+1,dispatchStatus=action==='ASSIGN'?'ASSIGNED':'ACCEPTED';
  if(action==='ASSIGN')await sql.query("UPDATE cohamy_crm.website_orders SET assigned_warehouse_id=$1,dispatch_status='ASSIGNED',dispatch_note=$2,dispatched_by=$3,dispatched_at=now(),accepted_by=NULL,accepted_at=NULL,status=CASE WHEN status='PENDING_REVIEW' THEN 'IN_PROGRESS' ELSE status END,version=$4,updated_at=now() WHERE id=$5",[targetId,input.reason,user.id,version,id]);
  else await sql.query("UPDATE cohamy_crm.website_orders SET dispatch_status='ACCEPTED',accepted_by=$1,accepted_at=now(),version=$2,updated_at=now() WHERE id=$3",[user.id,version,id]);
  const result:ActionResult={id,version,dispatchStatus,warehouseId:targetId};
  await sql.query('INSERT INTO cohamy_crm.website_order_dispatch_actions(id,website_order_id,actor_id,actor_name,request_hash,action,from_warehouse_id,to_warehouse_id,from_warehouse_name,to_warehouse_name,reason,version,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)',[input.idempotencyKey,id,user.id,user.displayName,requestHash,action,old.assigned_warehouse_id,targetId,old.warehouse_name??'',warehouse.name,input.reason,version,JSON.stringify(result)]);
  await audit(sql,user.id,action==='ASSIGN'?'website.order-dispatched':'website.order-accepted',id,{fromWarehouseId:old.assigned_warehouse_id,warehouseId:targetId,version,reason:input.reason,idempotencyKey:input.idempotencyKey});
  return result;
 });
}
export async function assignOnlineOrder(user:Principal,id:string,input:unknown){access(user);if(user.role!=='ADMIN')throw new CrmError('FORBIDDEN',403);return mutate(user,id,'ASSIGN',parse(assignSchema,input));}
export async function acceptOnlineOrder(user:Principal,id:string,input:unknown){access(user);return mutate(user,id,'ACCEPT',parse(acceptSchema,input));}
