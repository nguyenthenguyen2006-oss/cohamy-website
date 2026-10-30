import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {database,type Sql} from './db';
import {assertCurrentPrincipal,audit} from './auth';
import {CrmError} from './permissions';
import {partnerScope} from './repository';
import {warehouseScope} from './warehouse-scope';
import {isWarehouseRole,isBuyerRole,type Principal} from './types';
import {getPrimarySales} from './sales-customers';
import {enqueueDocumentMail} from './document-mail';
import type {FlowSnapshot} from './document-flow-model';

export const buyerNotificationEvents=['buyer.order.created','buyer.order.quote_sent','buyer.order.quote_accepted','buyer.order.quote_rejected','buyer.order.ready_for_fulfillment','buyer.order.picking','buyer.order.packed','buyer.order.shipped','buyer.order.delivered','buyer.order.delivery_failed','buyer.order.payment_confirmed','buyer.order.cancelled'] as const;
export type BuyerNotificationEvent=typeof buyerNotificationEvents[number];
const labels:Record<BuyerNotificationEvent,string>={'buyer.order.created':'Đơn hàng mới','buyer.order.quote_sent':'Đã gửi báo giá — chờ khách phản hồi','buyer.order.quote_accepted':'Khách đã chấp nhận báo giá','buyer.order.quote_rejected':'Khách yêu cầu sửa báo giá','buyer.order.ready_for_fulfillment':'Đơn đủ điều kiện xuất','buyer.order.picking':'Đơn đang soạn hàng','buyer.order.packed':'Đơn đã đóng gói','buyer.order.shipped':'Đơn đã xuất / giao vận chuyển','buyer.order.delivered':'Đơn đã giao thành công','buyer.order.delivery_failed':'Giao hàng chưa thành công','buyer.order.payment_confirmed':'Đã xác nhận khoản thanh toán','buyer.order.cancelled':'Đơn đã hủy'};
type Recipient={userId:string;membershipId:string;audience:'SALES'|'WAREHOUSE'|'BUYER'};
type Order={id:string;code:string;organization_id:string;warehouse_id:string;status:string;version:number;organization_name:string;warehouse_name:string;quote_fee_amount?:string;lines:{baseQuantity:number;total:string|null}[]};
async function getOrder(sql:Sql,id:string){const b=(await sql.query<Order>('SELECT b.*,o.name AS organization_name,w.name AS warehouse_name FROM cohamy_crm.buyer_orders b JOIN cohamy_crm.organizations o ON o.id=b.organization_id JOIN cohamy_crm.warehouses w ON w.id=b.warehouse_id WHERE b.id=$1',[id])).rows[0];if(!b)throw new CrmError('NOT_FOUND',404);return b;}
export async function captureBuyerSales(sql:Sql,orderId:string,organizationId:string){
 const owner=await getPrimarySales(sql,organizationId);
 const historical=(await sql.query<{sales_membership_id:string;user_id:string;display_name:string;email:string}>('SELECT c.sales_membership_id,u.id AS user_id,u.display_name,u.email FROM cohamy_crm.customer_sales_ownership c JOIN cohamy_crm.memberships m ON m.id=c.sales_membership_id JOIN cohamy_crm.users u ON u.id=m.user_id WHERE c.customer_organization_id=$1 FOR SHARE OF c',[organizationId])).rows[0];
 await sql.query('INSERT INTO cohamy_crm.buyer_order_sales(order_id,customer_organization_id,sales_membership_id,sales_user_id,sales_name,sales_email,source) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(order_id) DO NOTHING',[orderId,organizationId,owner?.membershipId??historical?.sales_membership_id??null,owner?.userId??historical?.user_id??null,owner?.displayName??historical?.display_name??'',owner?.email??historical?.email??'',owner?'PRIMARY_SALES':historical?'OWNER_UNAVAILABLE':'UNASSIGNED']);
}
async function recipients(sql:Sql,b:Order,event:BuyerNotificationEvent){
 const result:Recipient[]=[],owner=await getPrimarySales(sql,b.organization_id);if(owner)result.push({userId:owner.userId,membershipId:owner.membershipId,audience:'SALES'});
 const staff=(await sql.query<{user_id:string;id:string}>(`SELECT m.user_id,m.id FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id JOIN cohamy_crm.organizations o ON o.id=m.organization_id JOIN cohamy_crm.warehouses w ON w.id=$1 WHERE m.active AND u.active AND u.deleted_at IS NULL AND u.activation_status='ACTIVE' AND o.active AND o.kind='COHAMY' AND m.organization_id=w.organization_id AND m.role IN('WAREHOUSE','WAREHOUSE_HN','WAREHOUSE_HCM') AND (EXISTS(SELECT 1 FROM cohamy_crm.warehouse_assignments a WHERE a.membership_id=m.id AND a.warehouse_id=w.id) OR(NOT EXISTS(SELECT 1 FROM cohamy_crm.warehouse_assignments a WHERE a.membership_id=m.id) AND ((m.role='WAREHOUSE_HN' AND w.region='NORTH') OR(m.role='WAREHOUSE_HCM' AND w.region='SOUTH'))))`,[b.warehouse_id])).rows;
 for(const s of staff)result.push({userId:s.user_id,membershipId:s.id,audience:'WAREHOUSE'});
 if(event!=='buyer.order.created')for(const u of (await sql.query<{user_id:string;id:string}>("SELECT m.user_id,m.id FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id JOIN cohamy_crm.organizations o ON o.id=m.organization_id WHERE m.organization_id=$1 AND m.role IN('CUSTOMER','SUPERMARKET') AND m.active AND u.active AND u.deleted_at IS NULL AND u.activation_status='ACTIVE' AND o.active",[b.organization_id])).rows)result.push({userId:u.user_id,membershipId:u.id,audience:'BUYER'});
 return [...new Map(result.map(r=>[r.userId,r])).values()];
}
async function persistedEventEmails(sql:Sql,event:string,entityId:string,identity:string){
 await sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['sales-notify:'+identity]);
 const rows=(await sql.query<{recipients:{to:string[];cc:string[];bcc:string[]}}>('SELECT recipients FROM cohamy_crm.document_mail_outbox WHERE event=$1 AND entity_id=$2 AND(event_key=$3 OR left(event_key,length($4::text))=$4)',[event,entityId,identity,'sales-flow:'+identity+':personal:'])).rows;
 // Every status is a receipt, including UNKNOWN/DEFERRED. Only explicit native
 // Admin resend may repeat mail after a provider outcome or rule change.
 return new Set(rows.flatMap(r=>[...r.recipients.to,...r.recipients.cc,...r.recipients.bcc]).map(s=>s.trim().toLowerCase()));
}
async function insertNotification(sql:Sql,input:{recipient:Recipient;event:string;identity:string;version:number;orgId:string;orderId?:string;href:string;message:string;priority:'HIGH'|'NORMAL';emailExclusions:Set<string>}){
 const key='sales-flow:'+input.identity,id=randomUUID(),created=(await sql.query<{id:string}>('INSERT INTO cohamy_crm.notifications(id,user_id,event_key,kind,entity_type,entity_id,message,available_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()) ON CONFLICT(user_id,event_key) DO NOTHING RETURNING id',[id,input.recipient.userId,key,'SYSTEM',input.orderId?'buyer-order':'sales-customer',input.orderId??input.orgId,input.message])).rows[0];
 if(!created)return null;
 await sql.query('INSERT INTO cohamy_crm.sales_notification_events(notification_id,user_id,buyer_order_id,customer_organization_id,event,event_identity,version,href,priority) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,input.recipient.userId,input.orderId??null,input.orgId,input.event,input.identity,input.version,input.href,input.priority]);
 // Optional personal email uses the existing durable document outbox/worker,
 // whose UNKNOWN state prevents blind replay after a provider timeout.
 const a=(await sql.query<{email:string;value:{notificationChannels?:string[]}}>('SELECT u.email,p.value FROM cohamy_crm.users u LEFT JOIN cohamy_crm.workspace_preferences p ON p.user_id=u.id WHERE u.id=$1 AND u.active',[input.recipient.userId])).rows[0];
 if(a?.value?.notificationChannels?.includes('EMAIL')&&!input.emailExclusions.has(a.email.trim().toLowerCase())){
  const origin=process.env.CRM_PUBLIC_ORIGIN??'https://cohamy.vn';
  await sql.query("INSERT INTO cohamy_crm.document_mail_outbox(id,event_key,event,entity_id,revision,code,recipients,subject,body,files) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,'[]'::jsonb)",[randomUUID(),key+':personal:'+input.recipient.userId,input.event,input.orderId??input.orgId,input.version,input.event,JSON.stringify({to:[a.email],cc:[],bcc:[]}),('Cohamy · '+input.message.split('\n')[0]).slice(0,200),input.message+'\n'+origin+input.href]);input.emailExclusions.add(a.email.trim().toLowerCase());return a.email;
 }
 return null;
}
export async function notifyBuyerEvent(sql:Sql,user:Principal,orderId:string,event:BuyerNotificationEvent,identitySuffix?:string){
 const b=await getOrder(sql,orderId),targets=await recipients(sql,b,event),identity=event+':'+b.id+':'+(identitySuffix??b.version),quantity=b.lines.reduce((n,l)=>n+l.baseQuantity,0),emailExclusions=await persistedEventEmails(sql,event,b.id,identity);
 for(const target of targets){
  const waiting=['WAITING_QUOTE','QUOTED'].includes(b.status)||event==='buyer.order.created',warning=target.audience==='WAREHOUSE'&&event!=='buyer.order.ready_for_fulfillment'&&waiting?'\nCHƯA ĐƯỢC XUẤT KHO — chờ báo giá/xác nhận và điều kiện duyệt.':'';
  const total=b.lines.every(l=>l.total!==null)?b.lines.reduce((n,l)=>n+BigInt(l.total!),BigInt(b.quote_fee_amount??'0')).toString():null;
  const statusLabels:Record<string,string>={WAITING_QUOTE:'Chờ Sales báo giá',QUOTED:'Chờ khách xác nhận báo giá',CONFIRMED:'Đã chuyển kho xử lý',CANCELLED:'Đã hủy'};
  const message=[labels[event],`Khách hàng: ${b.organization_name}`,`Mã đơn: ${b.code}`,`Kho: ${b.warehouse_name}`,`Số lượng: ${quantity} (ĐVT gốc)`,...(total?[`Giá trị có VAT: ${total} VND`]:[]),`Trạng thái: ${statusLabels[b.status]??b.status}`].join('\n')+warning;
  await insertNotification(sql,{recipient:target,event,identity,version:b.version,orgId:b.organization_id,orderId:b.id,href:(target.audience==='BUYER'?'/portal/orders/':'/crm/buyer-orders/')+b.id,message,priority:event==='buyer.order.ready_for_fulfillment'||event==='buyer.order.created'?'HIGH':'NORMAL',emailExclusions});
 }
 const snapshot:FlowSnapshot={id:b.id,code:b.code,kind:'ISSUE',revision:b.version,state:b.status,warehouseId:b.warehouse_id,warehouseName:b.warehouse_name,warehouseCode:'',factoryMembershipId:null,factoryName:'',sourceId:null,sourceCode:'',sourceRevision:null,requestId:null,requestCode:'',createdAt:new Date().toISOString(),createdBy:user.displayName,confirmedAt:null,confirmedBy:'',dueDate:'',note:'',lines:[],delivery:{customer:b.organization_name},totals:{}};
 await enqueueDocumentMail(sql,{event,snapshot,files:[],label:labels[event],eventIdentity:identitySuffix,url:(process.env.CRM_PUBLIC_ORIGIN??'https://cohamy.vn').replace(/\/$/,'')+'/crm/buyer-orders/'+b.id,excludeRecipients:[...emailExclusions]});
}
export async function notifyBuyerReady(sql:Sql,user:Principal,buyerOrderId:string){
 const {evaluateBuyerFulfillment}=await import('./buyer-fulfillment');const state=await evaluateBuyerFulfillment(sql,user,buyerOrderId);if(state.ready)await notifyBuyerEvent(sql,user,buyerOrderId,'buyer.order.ready_for_fulfillment','first-ready');
}
export async function notifySalesCustomerEvent(sql:Sql,input:{event:'customer.registered'|'customer.activated'|'customer.assigned_to_sales'|'customer.reassigned';organizationId:string;salesMembershipId:string;version?:number;previousSalesMembershipId?:string|null}){
 const r=(await sql.query<{user_id:string;name:string}>("SELECT m.user_id,o.name FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id JOIN cohamy_crm.organizations so ON so.id=m.organization_id CROSS JOIN cohamy_crm.organizations o WHERE m.id=$1 AND o.id=$2 AND m.role='SALES' AND m.active AND u.active AND u.deleted_at IS NULL AND so.active",[input.salesMembershipId,input.organizationId])).rows[0];if(!r)return;
 const title={'customer.registered':'Khách hàng mới đăng ký','customer.activated':'Khách hàng đã kích hoạt','customer.assigned_to_sales':'Khách hàng được phân công','customer.reassigned':'Khách hàng được chuyển giao'}[input.event];
 const identity=input.event+':'+input.organizationId+':'+(input.version??1),emailExclusions=await persistedEventEmails(sql,input.event,input.organizationId,identity);
 await insertNotification(sql,{recipient:{userId:r.user_id,membershipId:input.salesMembershipId,audience:'SALES'},event:input.event,identity,version:input.version??1,orgId:input.organizationId,href:'/crm/sales-customers/'+input.organizationId,message:title+'\nKhách hàng: '+r.name,priority:'NORMAL',emailExclusions});
 const snapshot:FlowSnapshot={id:input.organizationId,code:r.name,kind:'REQUEST',revision:input.version??1,state:input.event,warehouseId:'',warehouseName:'',warehouseCode:'',factoryMembershipId:null,factoryName:'',sourceId:null,sourceCode:'',sourceRevision:null,requestId:null,requestCode:'',createdAt:new Date().toISOString(),createdBy:'',confirmedAt:null,confirmedBy:'',dueDate:'',note:'',lines:[],delivery:{},totals:{}};
 await enqueueDocumentMail(sql,{event:input.event,snapshot,files:[],label:title,url:(process.env.CRM_PUBLIC_ORIGIN??'https://cohamy.vn')+'/crm/sales-customers/'+input.organizationId,excludeRecipients:[...emailExclusions]});
}
function notificationScope(user:Principal){
 if(user.area==='portal'){if(!isBuyerRole(user.role))throw new CrmError('FORBIDDEN',403);return {sql:'b.organization_id=$2',params:[user.organizationId] as unknown[]};}
 if(isWarehouseRole(user.role)){const s=warehouseScope(user,'w',1);return {sql:'b.id IS NOT NULL AND ('+s.sql+')',params:s.params};}
 if(['ADMIN','MANAGER','ACCOUNTANT'].includes(user.role))return {sql:'o.id IS NOT NULL',params:[] as unknown[]};
 if(user.role==='SALES'){const s=partnerScope(user,'o');return {sql:s.sql.replace(/\$(\d+)/g,(_,n:string)=>'$'+(Number(n)+1)),params:s.params};}
 return {sql:'false',params:[] as unknown[]};
}
const listSchema=z.object({state:z.enum(['ALL','READ','UNREAD']).default('ALL'),event:z.string().max(100).default(''),page:z.coerce.number().int().min(1).max(100000).default(1),limit:z.coerce.number().int().min(1).max(100).default(20)}).strict();
export async function salesNotificationList(user:Principal,input:unknown={}){
 const d=listSchema.parse(input),db=await database();await assertCurrentPrincipal(db,user);const scope=notificationScope(user),params:unknown[]=[user.id,...scope.params];params.push(d.state,d.event);const state='$'+(params.length-1),event='$'+params.length;
 const from=`FROM cohamy_crm.notifications n JOIN cohamy_crm.sales_notification_events e ON e.notification_id=n.id LEFT JOIN cohamy_crm.buyer_orders b ON b.id=e.buyer_order_id LEFT JOIN cohamy_crm.warehouses w ON w.id=b.warehouse_id JOIN cohamy_crm.organizations o ON o.id=e.customer_organization_id WHERE n.user_id=$1 AND n.available_at<=now() AND (${scope.sql}) AND (${event}='' OR e.event=${event})`;
 const condition=` AND (${state}='ALL' OR (${state}='READ' AND n.read_at IS NOT NULL) OR (${state}='UNREAD' AND n.read_at IS NULL))`;
 const [totals,items]=await Promise.all([db.query<{total:string;unread:string}>(`SELECT count(*) FILTER(WHERE ${state}='ALL' OR (${state}='READ' AND n.read_at IS NOT NULL) OR (${state}='UNREAD' AND n.read_at IS NULL))::text AS total,count(*) FILTER(WHERE n.read_at IS NULL)::text AS unread ${from}`,params),db.query<{id:string;message:string;created_at:string;read_at:string|null;event:string;href:string;priority:string}>(`SELECT n.id,n.message,n.created_at::text,n.read_at::text,e.event,e.href,e.priority ${from}${condition} ORDER BY n.created_at DESC,n.id LIMIT $${params.length+1} OFFSET $${params.length+2}`,[...params,d.limit,(d.page-1)*d.limit])]);
 return {items:items.rows,total:Number(totals.rows[0].total),unread:Number(totals.rows[0].unread),page:d.page,pageSize:d.limit};
}
export async function readSalesNotification(user:Principal,input:unknown){
 const d=z.object({id:z.uuid()}).strict().parse(input),db=await database();await assertCurrentPrincipal(db,user);const scope=notificationScope(user),params=[user.id,...scope.params,d.id];
 const found=(await db.query<{id:string}>(`SELECT n.id FROM cohamy_crm.notifications n JOIN cohamy_crm.sales_notification_events e ON e.notification_id=n.id LEFT JOIN cohamy_crm.buyer_orders b ON b.id=e.buyer_order_id LEFT JOIN cohamy_crm.warehouses w ON w.id=b.warehouse_id JOIN cohamy_crm.organizations o ON o.id=e.customer_organization_id WHERE n.user_id=$1 AND n.id=$${params.length} AND (${scope.sql})`,params)).rows[0];if(!found)throw new CrmError('NOT_FOUND',404);
 await db.query('UPDATE cohamy_crm.notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2',[d.id,user.id]);await audit(db,user.id,'sales-notification.read',d.id);return {read:true};
}

let lastReadinessSweep=0;
/** Detect first readiness after later stock receipts, without rewriting orders. */
export async function runBuyerReadyNotifications(){
 if(Date.now()-lastReadinessSweep<10000)return {processed:0};lastReadinessSweep=Date.now();
 const db=await database(),{buyerFulfillmentStageSql}=await import('./buyer-fulfillment');
 const actor=(await db.query<{id:string}>("SELECT m.id FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id JOIN cohamy_crm.organizations o ON o.id=m.organization_id WHERE m.role='ADMIN' AND m.active AND u.active AND u.deleted_at IS NULL AND u.activation_status='ACTIVE' AND o.active AND o.kind='COHAMY' ORDER BY m.id LIMIT 1")).rows[0];
 if(!actor)return {processed:0};const {membershipPrincipal}=await import('./auth'),user=await membershipPrincipal(actor.id);if(!user)return {processed:0};
 const candidates=(await db.query<{id:string}>(`SELECT b.id FROM cohamy_crm.buyer_orders b JOIN cohamy_crm.buyer_fulfillment_state f ON f.order_id=b.id JOIN cohamy_crm.warehouses w ON w.id=b.warehouse_id WHERE b.status='CONFIRMED' AND w.organization_id=$1 AND NOT EXISTS(SELECT 1 FROM cohamy_crm.sales_notification_events e WHERE e.buyer_order_id=b.id AND e.event='buyer.order.ready_for_fulfillment') AND ${buyerFulfillmentStageSql('b')} IN('READY','PICKING','PACKED') ORDER BY b.created_at,b.id LIMIT 30`,[user.organizationId])).rows;
 for(const b of candidates)await db.transaction(async sql=>{
  // Buyer actions use this row lock too: stock/posting and readiness are rechecked.
  await sql.query('SELECT id FROM cohamy_crm.buyer_orders WHERE id=$1 FOR UPDATE',[b.id]);await assertCurrentPrincipal(sql,user);await notifyBuyerReady(sql,user,b.id);
 });
 return {processed:candidates.length};
}
