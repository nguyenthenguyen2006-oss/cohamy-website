import 'server-only';
import {randomUUID} from 'node:crypto';
import {database,type Sql} from './db';
import {assertCurrentPrincipal,audit} from './auth';
import {CrmError,isWarehouseRole} from './permissions';
import {commercialDigest} from './commercial-common';
import {fixed,fixedText} from './decimal';
import {currentOrderPolicy,type OrderPolicyDefinition} from './order-policy';
import {warehouseScope} from './warehouse-scope';
import {buyerFulfillmentActionSchema} from './buyer-fulfillment-contracts';
import type {Principal} from './types';

type State={order_id:string;policy_id:string|null;policy_snapshot:Partial<OrderPolicyDefinition>;approval_status:'PENDING'|'APPROVED'|'REJECTED';approval_by:string|null;payment_review:'PENDING'|'CLEAR'|'HOLD';payment_by:string|null;stage:'NEW'|'PICKING'|'PACKED'|'DELIVERED'|'DELIVERY_FAILED';version:number};
type QuoteCheck={needs_approval:boolean;non_self_approval:boolean;minimum_shortfalls:unknown[];actor_id:string};
export type BuyerFulfillmentStage='WAITING_QUOTE'|'WAITING_CUSTOMER'|'WAITING_APPROVAL'|'WAITING_PAYMENT'|'WAITING_STOCK'|'READY'|'PICKING'|'PACKED'|'SHIPPED'|'DELIVERED'|'DELIVERY_FAILED'|'CANCELLED';
export type BuyerFulfillmentAction='APPROVE'|'REJECT'|'PAYMENT_REVIEW'|'PICKING'|'PACKED'|'DELIVERED'|'DELIVERY_FAILED';
export type BuyerFulfillmentView={ready:boolean;stage:BuyerFulfillmentStage;version:number;legacy:boolean;blockers:string[];allowedActions:BuyerFulfillmentAction[];approval:{required:boolean;status:'NOT_REQUIRED'|'PENDING'|'APPROVED'|'REJECTED'};payment:{mode:'NONE'|'ACCOUNTANT'|'PAID';status:'NOT_REQUIRED'|'PENDING'|'CLEAR'|'HOLD'};stock:{available:boolean;complete:boolean;missing:{productId:string;name:string;needed:string;available:string;missing:string}[]}};

async function scopedBuyer(sql:Sql,user:Principal,id:string,lock=false){const {buyerOrder}=await import('./buyer');return buyerOrder(sql,user,id,lock);}
async function state(sql:Sql,id:string,lock=''){return(await sql.query<State>('SELECT * FROM cohamy_crm.buyer_fulfillment_state WHERE order_id=$1'+lock,[id])).rows[0];}
async function quoteCheck(sql:Sql,id:string){return(await sql.query<QuoteCheck>('SELECT needs_approval,non_self_approval,minimum_shortfalls,actor_id FROM cohamy_crm.buyer_quote_price_checks WHERE order_id=$1 ORDER BY order_version DESC LIMIT 1',[id])).rows[0];}
/** Capture on a new order or an explicitly requested new quote of an old unconfirmed order. */
export async function ensureBuyerFulfillment(sql:Sql,user:Principal,id:string){
 await scopedBuyer(sql,user,id);if(await state(sql,id))return;
 let policy;try{policy=await currentOrderPolicy(sql,false);}catch(e){if(!(e instanceof CrmError)||e.code!=='ORDER_POLICY_UNAVAILABLE')throw e;}
 await sql.query('INSERT INTO cohamy_crm.buyer_fulfillment_state(order_id,policy_id,policy_snapshot) VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING',[id,policy?.id??null,JSON.stringify(policy?.definition??{})]);
}

export async function evaluateBuyerFulfillment(sql:Sql,user:Principal,id:string):Promise<BuyerFulfillmentView>{
 const b=await scopedBuyer(sql,user,id),f=await state(sql,id),check=await quoteCheck(sql,id),policy=f?.policy_snapshot??{},blocks:string[]=[];
 const quoteTotal=b.lines.reduce((n,l)=>n+BigInt(l.total??'0'),BigInt(b.quote_fee_amount??'0')),organization=(await sql.query<{credit_enabled:boolean;phone:string;email:string;business_id:string;address:string;contact_name:string}>('SELECT credit_enabled,phone,email,business_id,address,contact_name FROM cohamy_crm.organizations WHERE id=$1',[b.organization_id])).rows[0];
 const approvalRequired=!!(f&&(check?.needs_approval||policy.alwaysManagerApproval||(policy.managerApprovalAmount!==null&&policy.managerApprovalAmount!==undefined&&quoteTotal>=BigInt(policy.managerApprovalAmount))||(policy.creditRequiresApproval&&organization?.credit_enabled)));
 const nonSelfApproval=policy.nonSelfApproval||check?.non_self_approval;
 const approval={required:approvalRequired,status:approvalRequired?f!.approval_status:'NOT_REQUIRED' as const},mode=policy.buyerFulfillment?.paymentReview??'NONE';
 const payment={mode,status:mode==='NONE'?'NOT_REQUIRED' as const:f?.payment_review??'PENDING' as const};
 const wh=(await sql.query<{active:boolean;organization_active:boolean;kind:string}>('SELECT w.active,o.active AS organization_active,o.kind FROM cohamy_crm.warehouses w JOIN cohamy_crm.organizations o ON o.id=w.organization_id WHERE w.id=$1',[b.warehouse_id])).rows[0];
 if(!wh?.active||!wh.organization_active||wh.kind!=='COHAMY')blocks.push('Kho xử lý không còn hoạt động hoặc không hợp lệ.');
 if(f&&policy.enabled===false)blocks.push('Chính sách đặt hàng đã tắt tại thời điểm tạo đơn.');
 for(const field of policy.requiredPartnerFields??[])if(!String(organization?.[field]??'').trim())blocks.push('Hồ sơ khách còn thiếu: '+field+'.');
 if(check?.minimum_shortfalls.length)blocks.push('Báo giá chưa đạt mức tối thiểu theo chính sách giá; cần sửa báo giá.');
 if(b.status==='WAITING_QUOTE')blocks.push('SALES chưa gửi báo giá.');
 if(b.status==='QUOTED')blocks.push('Chờ khách xác nhận báo giá.');
 if(b.status==='CANCELLED')blocks.push('Đơn đã hủy.');
 if(b.status==='CONFIRMED'&&(!b.clearance_id||!b.request_id))blocks.push('Chưa có chứng từ nguồn hợp lệ để xuất kho.');
 if(approvalRequired&&f?.approval_status!=='APPROVED')blocks.push(f?.approval_status==='REJECTED'?'Quản lý đã từ chối duyệt đơn.':'Chờ duyệt theo chính sách kinh doanh.');
 if(mode!=='NONE'&&f?.payment_review!=='CLEAR')blocks.push(f?.payment_review==='HOLD'?'Kế toán đang giữ kiểm tra thanh toán/công nợ.':'Chờ kế toán kiểm tra điều kiện thanh toán/công nợ.');
 const clearance=b.clearance_id?(await sql.query<{payment_status:string;paid_amount:string;gross_total:string;request_id:string;warehouse_id:string;organization_id:string;order_id:string|null}>('SELECT payment_status,paid_amount::text,gross_total::text,request_id,warehouse_id,organization_id,order_id FROM cohamy_crm.accounting_order_clearances WHERE id=$1',[b.clearance_id])).rows[0]:undefined;
 if(b.status==='CONFIRMED'&&(!clearance||clearance.request_id!==b.request_id||clearance.warehouse_id!==b.warehouse_id||clearance.organization_id!==b.organization_id))blocks.push('Đơn và chứng từ kho không khớp nguồn, khách hàng hoặc kho xử lý.');
 if(mode==='PAID'&&(!clearance||clearance.payment_status!=='PAID'||BigInt(clearance.paid_amount)<quoteTotal))blocks.push('Chưa xác nhận nhận đủ tiền của đơn.');
 const issues=b.clearance_id?(await sql.query<{flow_payload:{lines:{productId:string;quantity:string}[]}}>("SELECT flow_payload FROM cohamy_crm.warehouse_handover_invoices WHERE clearance_id=$1 AND workflow_state='CONFIRMED'",[b.clearance_id])).rows:[];
 const shipped=new Map<string,bigint>();for(const issue of issues)for(const l of issue.flow_payload?.lines??[])shipped.set(l.productId,(shipped.get(l.productId)??0n)+fixed(l.quantity));
 const availability=(await sql.query<{product_id:string;q:string}>("SELECT ib.product_id,COALESCE(sum(ib.on_hand-ib.reserved+COALESCE((SELECT sum(r.quantity-r.consumed-r.released) FROM cohamy_crm.inventory_reservations r WHERE r.order_id=$3 AND r.warehouse_id=ib.warehouse_id AND r.location_id=ib.location_id AND r.product_id=ib.product_id AND r.lot_id=ib.lot_id AND r.status IN('ACTIVE','PARTIAL')),0)),0)::text AS q FROM cohamy_crm.inventory_balances ib JOIN cohamy_crm.warehouse_locations l ON l.id=ib.location_id JOIN cohamy_crm.inventory_lots t ON t.id=ib.lot_id WHERE ib.warehouse_id=$1 AND ib.product_id=ANY($2::uuid[]) AND l.active AND l.kind='PICK' AND t.status='AVAILABLE' AND(t.expires_on IS NULL OR t.expires_on>=current_date) GROUP BY ib.product_id",[b.warehouse_id,b.lines.map(line=>line.productId),clearance?.order_id??null])).rows;
 const availableByProduct=new Map(availability.map(row=>[row.product_id,fixed(row.q,6,true)]));
 const missing=[] as BuyerFulfillmentView['stock']['missing'];let complete=true;
 for(const line of b.lines){const remaining=fixed(String(line.baseQuantity))-(shipped.get(line.productId)??0n);if(remaining<=0n)continue;complete=false;
  const free=availableByProduct.get(line.productId)??0n;if(free<remaining)missing.push({productId:line.productId,name:line.name,needed:fixedText(remaining),available:fixedText(free),missing:fixedText(remaining-free)});
 }
 if(missing.length)blocks.push('Tồn khả dụng chưa đủ số lượng còn phải giao.');
 const ready=b.status==='CONFIRMED'&&blocks.length===0&&!complete;
 const policyBlocked=!wh?.active||!wh.organization_active||wh.kind!=='COHAMY'||!!(f&&policy.enabled===false)||!!check?.minimum_shortfalls.length||(policy.requiredPartnerFields??[]).some(field=>!String(organization?.[field]??'').trim())||(b.status==='CONFIRMED'&&(!b.clearance_id||!b.request_id||!clearance||clearance.request_id!==b.request_id||clearance.warehouse_id!==b.warehouse_id||clearance.organization_id!==b.organization_id));
 let stage:BuyerFulfillmentStage=b.status==='WAITING_QUOTE'?'WAITING_QUOTE':b.status==='QUOTED'?'WAITING_CUSTOMER':b.status==='CANCELLED'?'CANCELLED':policyBlocked||(approvalRequired&&f?.approval_status!=='APPROVED')?'WAITING_APPROVAL':mode!=='NONE'&&(f?.payment_review!=='CLEAR'||(mode==='PAID'&&(!clearance||clearance.payment_status!=='PAID'||BigInt(clearance.paid_amount)<quoteTotal)))?'WAITING_PAYMENT':missing.length?'WAITING_STOCK':'READY';
 if(b.status==='CONFIRMED'&&f?.stage==='DELIVERY_FAILED'&&issues.length)stage='DELIVERY_FAILED';
 else if(b.status==='CONFIRMED'&&complete)stage=f?.stage==='DELIVERED'?'DELIVERED':'SHIPPED';
 else if(ready&&f&&['PICKING','PACKED'].includes(f.stage))stage=f.stage as BuyerFulfillmentStage;
 const allowedActions:BuyerFulfillmentAction[]=[];
 if(f&&user.area==='crm'&&b.status==='CONFIRMED'){
  if(approvalRequired&&!complete&&['ADMIN','MANAGER'].includes(user.role)&&(policy.approvalRoles??['ADMIN','MANAGER']).includes(user.role as 'ADMIN'|'MANAGER')){
   const quoter=nonSelfApproval&&!check?(await sql.query<{actor_id:string}>("SELECT actor_id FROM cohamy_crm.buyer_order_events WHERE order_id=$1 AND action='quoted' ORDER BY created_at DESC,id DESC LIMIT 1",[b.id])).rows[0]:null;
   if(!nonSelfApproval||![b.creator_id,check?.actor_id??quoter?.actor_id].includes(user.id))allowedActions.push('APPROVE','REJECT');
  }
  if(mode!=='NONE'&&!complete&&['ADMIN','MANAGER','ACCOUNTANT'].includes(user.role))allowedActions.push('PAYMENT_REVIEW');
  if((['ADMIN','MANAGER'].includes(user.role)||isWarehouseRole(user.role))&&f.stage!=='DELIVERED'){
   if(ready&&!complete&&f.stage!=='PICKING')allowedActions.push('PICKING');
   if(ready&&!complete&&f.stage==='PICKING')allowedActions.push('PACKED');
   if(complete)allowedActions.push('DELIVERED');if(issues.length&&f.stage!=='DELIVERY_FAILED')allowedActions.push('DELIVERY_FAILED');
  }
 }
 return {ready,stage,version:f?.version??0,legacy:!f,blockers:blocks,allowedActions,approval,payment,stock:{available:missing.length===0,missing,complete}};
}

/** The policy snapshot stays unchanged when Sales sends a new quote revision. */
export async function resetBuyerFulfillmentReviews(sql:Sql,user:Principal,id:string,note:string){
 const b=await scopedBuyer(sql,user,id),f=await state(sql,id,' FOR UPDATE');if(!f)return;
 if(b.status==='CONFIRMED'||b.status==='CANCELLED')throw new CrmError('ORDER_LOCKED',409);
 const before=await evaluateBuyerFulfillment(sql,user,id);
 await sql.query("UPDATE cohamy_crm.buyer_fulfillment_state SET approval_status='PENDING',approval_by=NULL,approval_at=NULL,payment_review='PENDING',payment_by=NULL,payment_at=NULL,stage='NEW',version=version+1,updated_at=now() WHERE order_id=$1",[id]);
 const after=await evaluateBuyerFulfillment(sql,user,id);
 await sql.query('INSERT INTO cohamy_crm.buyer_fulfillment_events(id,order_id,action,actor_id,before_snapshot,after_snapshot,note) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)',[randomUUID(),id,'QUOTE_REVISION',user.id,JSON.stringify(before),JSON.stringify(after),note]);
 await audit(sql,user.id,'buyer.fulfillment.quote-revision',id,{before,after,note});
}

/** Called only after a native Portal receipt insert, under the buyer-order lock. */
export async function markBuyerReceived(sql:Sql,user:Principal,id:string,note:string){
 const b=await scopedBuyer(sql,user,id),f=await state(sql,id,' FOR UPDATE');if(!f||b.status!=='CONFIRMED')return;
 const rows=(await sql.query<{flow_payload:{lines:{productId:string;quantity:string}[]};lines:{productId:string;received:number}[]|null;shortage:boolean|null}>("SELECT i.flow_payload,r.lines,r.shortage FROM cohamy_crm.warehouse_handover_invoices i LEFT JOIN cohamy_crm.buyer_delivery_receipts r ON r.issue_id=i.id AND r.issue_revision=i.workflow_version AND r.order_id=$1 WHERE i.clearance_id=$2 AND i.workflow_state='CONFIRMED'",[id,b.clearance_id])).rows;
 if(!rows.length)return;
 const failed=rows.some(row=>row.shortage),received=new Map<string,bigint>();
 for(const row of rows)for(const line of row.lines??[])received.set(line.productId,(received.get(line.productId)??0n)+fixed(String(line.received)));
 const complete=rows.every(row=>row.lines!==null)&&b.lines.every(line=>(received.get(line.productId)??0n)>=fixed(String(line.baseQuantity)));
 const next=failed?'DELIVERY_FAILED':complete?'DELIVERED':null;if(!next||f.stage===next)return;
 const before=await evaluateBuyerFulfillment(sql,user,id);
 await sql.query('UPDATE cohamy_crm.buyer_fulfillment_state SET stage=$1,version=version+1,updated_at=now() WHERE order_id=$2',[next,id]);
 const after=await evaluateBuyerFulfillment(sql,user,id);
 await sql.query('INSERT INTO cohamy_crm.buyer_fulfillment_events(id,order_id,action,actor_id,before_snapshot,after_snapshot,note) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)',[randomUUID(),id,'PORTAL_RECEIPT_'+next,user.id,JSON.stringify(before),JSON.stringify(after),note]);
 await audit(sql,user.id,'buyer.fulfillment.portal-receipt',id,{before,after,note});
}

/** Pure SQL equivalent of stage evaluation, for scoped, paginated list filters. */
export function buyerFulfillmentStageSql(alias='b'){
 if(!/^[a-z][a-z0-9_]*$/i.test(alias))throw new Error('INVALID_SQL_ALIAS');
 return `(SELECT CASE
 WHEN ${alias}.status='WAITING_QUOTE' THEN 'WAITING_QUOTE'
 WHEN ${alias}.status='QUOTED' THEN 'WAITING_CUSTOMER'
 WHEN ${alias}.status='CANCELLED' THEN 'CANCELLED'
 WHEN f.stage='DELIVERY_FAILED' AND q.has_issue THEN 'DELIVERY_FAILED'
 WHEN q.complete THEN CASE WHEN f.stage='DELIVERED' THEN 'DELIVERED' ELSE 'SHIPPED' END
 WHEN NOT COALESCE(w.active AND wo.active AND wo.kind='COHAMY',false)
   OR f.policy_snapshot->>'enabled'='false' OR jsonb_array_length(COALESCE(pc.minimum_shortfalls,'[]'::jsonb))>0
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(COALESCE(f.policy_snapshot->'requiredPartnerFields','[]'::jsonb)) field WHERE trim(COALESCE(to_jsonb(o)->>field,''))='')
   OR ${alias}.clearance_id IS NULL OR ${alias}.request_id IS NULL OR c.id IS NULL OR c.request_id<>${alias}.request_id OR c.warehouse_id IS DISTINCT FROM ${alias}.warehouse_id OR c.organization_id IS DISTINCT FROM ${alias}.organization_id
   OR (p.approval_required AND f.approval_status<>'APPROVED') THEN 'WAITING_APPROVAL'
 WHEN p.payment_mode<>'NONE' AND (f.payment_review<>'CLEAR' OR (p.payment_mode='PAID' AND (c.payment_status<>'PAID' OR c.paid_amount<p.quote_total))) THEN 'WAITING_PAYMENT'
 WHEN q.missing THEN 'WAITING_STOCK'
 WHEN f.stage IN('PICKING','PACKED') THEN f.stage ELSE 'READY' END
 FROM (SELECT 1) seed
 LEFT JOIN cohamy_crm.buyer_fulfillment_state f ON f.order_id=${alias}.id
 LEFT JOIN LATERAL(SELECT needs_approval,non_self_approval,minimum_shortfalls FROM cohamy_crm.buyer_quote_price_checks checks WHERE checks.order_id=${alias}.id ORDER BY checks.order_version DESC LIMIT 1) pc ON true
 LEFT JOIN cohamy_crm.organizations o ON o.id=${alias}.organization_id
 LEFT JOIN cohamy_crm.accounting_order_clearances c ON c.id=${alias}.clearance_id
 LEFT JOIN cohamy_crm.warehouses w ON w.id=${alias}.warehouse_id
 LEFT JOIN cohamy_crm.organizations wo ON wo.id=w.organization_id
 CROSS JOIN LATERAL(SELECT COALESCE(sum(COALESCE((line->>'total')::numeric,0)),0)+${alias}.quote_fee_amount AS quote_total FROM jsonb_array_elements(${alias}.lines) line) total
 CROSS JOIN LATERAL(SELECT total.quote_total,
  f.order_id IS NOT NULL AND (COALESCE(pc.needs_approval,false) OR COALESCE((f.policy_snapshot->>'alwaysManagerApproval')::boolean,false)
   OR (f.policy_snapshot->>'managerApprovalAmount' IS NOT NULL AND total.quote_total>=(f.policy_snapshot->>'managerApprovalAmount')::numeric)
   OR (COALESCE((f.policy_snapshot->>'creditRequiresApproval')::boolean,false) AND o.credit_enabled)) AS approval_required,
  COALESCE(f.policy_snapshot->'buyerFulfillment'->>'paymentReview','NONE') AS payment_mode) p
 CROSS JOIN LATERAL(SELECT
  NOT EXISTS(SELECT 1 FROM jsonb_array_elements(${alias}.lines) line WHERE (line->>'baseQuantity')::numeric>COALESCE((SELECT sum((il->>'quantity')::numeric) FROM cohamy_crm.warehouse_handover_invoices i CROSS JOIN LATERAL jsonb_array_elements(i.flow_payload->'lines') il WHERE i.clearance_id=${alias}.clearance_id AND i.workflow_state='CONFIRMED' AND il->>'productId'=line->>'productId'),0)) AS complete,
  EXISTS(SELECT 1 FROM cohamy_crm.warehouse_handover_invoices i WHERE i.clearance_id=${alias}.clearance_id AND i.workflow_state='CONFIRMED') AS has_issue,
  EXISTS(SELECT 1 FROM jsonb_array_elements(${alias}.lines) line WHERE
   (line->>'baseQuantity')::numeric-COALESCE((SELECT sum((il->>'quantity')::numeric) FROM cohamy_crm.warehouse_handover_invoices i CROSS JOIN LATERAL jsonb_array_elements(i.flow_payload->'lines') il WHERE i.clearance_id=${alias}.clearance_id AND i.workflow_state='CONFIRMED' AND il->>'productId'=line->>'productId'),0)
   >COALESCE((SELECT sum(ib.on_hand-ib.reserved+COALESCE((SELECT sum(r.quantity-r.consumed-r.released) FROM cohamy_crm.inventory_reservations r WHERE r.order_id=c.order_id AND r.warehouse_id=ib.warehouse_id AND r.location_id=ib.location_id AND r.product_id=ib.product_id AND r.lot_id=ib.lot_id AND r.status IN('ACTIVE','PARTIAL')),0)) FROM cohamy_crm.inventory_balances ib JOIN cohamy_crm.warehouse_locations l ON l.id=ib.location_id JOIN cohamy_crm.inventory_lots t ON t.id=ib.lot_id WHERE ib.warehouse_id=${alias}.warehouse_id AND ib.product_id=(line->>'productId')::uuid AND l.active AND l.kind='PICK' AND t.status='AVAILABLE' AND(t.expires_on IS NULL OR t.expires_on>=current_date)),0)) AS missing) q)`;
}

/** Call before any source-linked stock issue, inside its existing transaction. */
export async function assertBuyerClearanceReady(sql:Sql,user:Principal,clearanceId:string,warehouseId:string){
 const b=(await sql.query<{id:string;warehouse_id:string;status:string}>('SELECT id,warehouse_id,status FROM cohamy_crm.buyer_orders WHERE clearance_id=$1',[clearanceId])).rows[0];if(!b)return;
 if(b.warehouse_id!==warehouseId)throw new CrmError('NOT_FOUND',404);
 const f=await state(sql,b.id,' FOR SHARE');const result=await evaluateBuyerFulfillment(sql,user,b.id);
 // No remaining quantity can pass the native per-line issue check. Keep the
 // Admin amendment path available for an already shipped immutable source.
 if(result.stock.complete&&!result.blockers.length)return;
 // Legacy confirmed orders keep their native per-line/partial stock validation.
 if(!f&&b.status==='CONFIRMED'&&result.blockers.every(x=>x==='Tồn khả dụng chưa đủ số lượng còn phải giao.'))return;
 if(!result.ready)throw new CrmError('BUYER_ORDER_NOT_READY_FOR_FULFILLMENT',409);
}
/** Compatibility guard for reservation/delivery APIs mapped to a native sales_order. */
export async function assertBuyerSalesOrderReady(sql:Sql,user:Principal,salesOrderId:string){const rows=(await sql.query<{id:string;warehouse_id:string}>('SELECT b.clearance_id AS id,b.warehouse_id FROM cohamy_crm.buyer_orders b JOIN cohamy_crm.accounting_order_clearances c ON c.id=b.clearance_id WHERE c.order_id=$1',[salesOrderId])).rows;for(const row of rows)await assertBuyerClearanceReady(sql,user,row.id,row.warehouse_id);}

export async function actionBuyerFulfillment(user:Principal,input:unknown){
 const parsed=buyerFulfillmentActionSchema.safeParse(input);if(!parsed.success)throw new CrmError('INVALID_FIELDS',400);if(user.area!=='crm')throw new CrmError('FORBIDDEN',403);const d=parsed.data,h=commercialDigest(d);
 return(await database()).transaction(async sql=>{
  await assertCurrentPrincipal(sql,user);const b=await scopedBuyer(sql,user,d.id,true);await sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[user.id+':buyer-fulfillment:'+d.idempotencyKey]);
  const prior=(await sql.query<{request_hash:string;result:unknown}>('SELECT request_hash,result FROM cohamy_crm.buyer_fulfillment_actions WHERE actor_id=$1 AND key=$2',[user.id,d.idempotencyKey])).rows[0];if(prior){if(prior.request_hash!==h)throw new CrmError('IDEMPOTENCY_CONFLICT',409);return prior.result;}
  const f=await state(sql,b.id,' FOR UPDATE');if(!f)throw new CrmError('LEGACY_ORDER_NO_FULFILLMENT_REVIEW',409);if(f.version!==d.version)throw new CrmError('VERSION_CONFLICT',409);const before=await evaluateBuyerFulfillment(sql,user,b.id);
  if(d.action==='APPROVE'||d.action==='REJECT'){
   if(!['ADMIN','MANAGER'].includes(user.role)||!(f.policy_snapshot.approvalRoles??['ADMIN','MANAGER']).includes(user.role as 'ADMIN'|'MANAGER'))throw new CrmError('FORBIDDEN',403);
   if(!before.approval.required||b.status!=='CONFIRMED')throw new CrmError('BUYER_APPROVAL_NOT_APPLICABLE',409);
   const check=await quoteCheck(sql,b.id),quoter=!check?(await sql.query<{actor_id:string}>("SELECT actor_id FROM cohamy_crm.buyer_order_events WHERE order_id=$1 AND action='quoted' ORDER BY created_at DESC,id DESC LIMIT 1",[b.id])).rows[0]:null;if((f.policy_snapshot.nonSelfApproval||check?.non_self_approval)&&[b.creator_id,check?.actor_id??quoter?.actor_id].includes(user.id))throw new CrmError('SELF_APPROVAL_BLOCKED',403);
   if(before.stock.complete)throw new CrmError('ORDER_ALREADY_SHIPPED',409);
   await sql.query('UPDATE cohamy_crm.buyer_fulfillment_state SET approval_status=$1,approval_by=$2,approval_at=now() WHERE order_id=$3',[d.action==='APPROVE'?'APPROVED':'REJECTED',user.id,b.id]);
  }else if(d.action==='PAYMENT_REVIEW'){
   if(!['ADMIN','MANAGER','ACCOUNTANT'].includes(user.role))throw new CrmError('FORBIDDEN',403);if(before.payment.mode==='NONE'||b.status!=='CONFIRMED')throw new CrmError('BUYER_PAYMENT_REVIEW_NOT_APPLICABLE',409);if(before.stock.complete)throw new CrmError('ORDER_ALREADY_SHIPPED',409);
   if(d.decision==='CLEAR'&&before.payment.mode==='PAID'){const paid=(await sql.query<{payment_status:string}>('SELECT payment_status FROM cohamy_crm.accounting_order_clearances WHERE id=$1',[b.clearance_id])).rows[0];if(paid?.payment_status!=='PAID')throw new CrmError('BUYER_PAYMENT_NOT_CONFIRMED',409);}
   await sql.query('UPDATE cohamy_crm.buyer_fulfillment_state SET payment_review=$1,payment_by=$2,payment_at=now() WHERE order_id=$3',[d.decision,user.id,b.id]);
  }else{
   if(!['ADMIN','MANAGER'].includes(user.role)&&!isWarehouseRole(user.role))throw new CrmError('FORBIDDEN',403);
   const s=warehouseScope(user);if(!(await sql.query(`SELECT w.id FROM cohamy_crm.warehouses w WHERE w.id=$${s.params.length+1} AND (${s.sql})`,[...s.params,b.warehouse_id])).rows.length)throw new CrmError('NOT_FOUND',404);
   if(['PICKING','PACKED'].includes(d.action)&&(!before.ready||before.stock.complete))throw new CrmError('BUYER_ORDER_NOT_READY_FOR_FULFILLMENT',409);
   if(f.stage===d.action)throw new CrmError('BUYER_FULFILLMENT_STAGE_UNCHANGED',409);
   if(d.action==='PACKED'&&f.stage!=='PICKING')throw new CrmError('BUYER_PICKING_REQUIRED',409);
   if(d.action==='DELIVERED'&&!before.stock.complete)throw new CrmError('BUYER_ORDER_NOT_FULLY_SHIPPED',409);
   if(d.action==='DELIVERY_FAILED'&&!(await sql.query("SELECT id FROM cohamy_crm.warehouse_handover_invoices WHERE clearance_id=$1 AND workflow_state='CONFIRMED' LIMIT 1",[b.clearance_id])).rows.length)throw new CrmError('BUYER_SHIPMENT_REQUIRED',409);
   if(f.stage==='DELIVERED')throw new CrmError('BUYER_DELIVERY_ALREADY_COMPLETE',409);
   await sql.query('UPDATE cohamy_crm.buyer_fulfillment_state SET stage=$1 WHERE order_id=$2',[d.action,b.id]);
  }
  await sql.query('UPDATE cohamy_crm.buyer_fulfillment_state SET version=version+1,updated_at=now() WHERE order_id=$1',[b.id]);const result=await evaluateBuyerFulfillment(sql,user,b.id);
  await sql.query('INSERT INTO cohamy_crm.buyer_fulfillment_events(id,order_id,action,actor_id,before_snapshot,after_snapshot,note) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)',[randomUUID(),b.id,d.action,user.id,JSON.stringify(before),JSON.stringify(result),d.note]);await audit(sql,user.id,'buyer.fulfillment.'+d.action.toLowerCase(),b.id,{before,after:result,note:d.note});
  await sql.query('INSERT INTO cohamy_crm.buyer_fulfillment_actions(actor_id,key,request_hash,result) VALUES($1,$2,$3,$4::jsonb)',[user.id,d.idempotencyKey,h,JSON.stringify(result)]);
  const notifications=await import('./sales-notifications');
  const event=d.action==='PICKING'?'buyer.order.picking':d.action==='PACKED'?'buyer.order.packed':d.action==='DELIVERED'?'buyer.order.delivered':d.action==='DELIVERY_FAILED'?'buyer.order.delivery_failed':null;
  if(event)await notifications.notifyBuyerEvent(sql,user,b.id,event,String(result.version));
  if(d.action==='APPROVE'||d.action==='PAYMENT_REVIEW')await notifications.notifyBuyerReady(sql,user,b.id);return result;
 });
}
