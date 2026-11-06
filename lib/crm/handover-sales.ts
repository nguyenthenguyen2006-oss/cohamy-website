import 'server-only';
import {randomUUID} from 'node:crypto';
import type {Sql} from './db';
import type {Principal} from './types';
import type {FlowSnapshot} from './document-flow-model';
import {allPartners,CrmError,isWarehouseRole} from './permissions';
import {warehouseScope} from './warehouse-scope';
import {commercialDigest,vietnamBusinessDate} from './commercial-common';
import {currentOrderPolicy} from './order-policy';
import {assertCurrentPrincipal,audit} from './auth';
import {fixed,integer,lineAmount,roundRatio} from './decimal';
import {z} from 'zod';

/** Admin retains native all-partner buyer selection, including imported legacy
 * profiles. Warehouse users still require a recorded seller relationship. */
export function handoverCustomerScope(user:Principal,alias='o',offset=0){
 if(user.area!=='crm'||!['ADMIN','MANAGER','ACCOUNTANT'].includes(user.role)&&!isWarehouseRole(user.role))return {sql:'false',params:[] as unknown[]};
 const eligible=`${alias}.active AND ${alias}.merged_into_id IS NULL AND ${alias}.kind IN('CUSTOMER','DEALER')`;
 if(user.role==='ADMIN'&&allPartners(user))return {sql:eligible,params:[] as unknown[]};
 const p=`$${offset+1}`;
 return {sql:`${eligible} AND (
 EXISTS(SELECT 1 FROM cohamy_crm.commercial_requests cr WHERE cr.organization_id=${alias}.id AND cr.seller_organization_id=${p})
 OR EXISTS(SELECT 1 FROM cohamy_crm.sales_orders so WHERE so.organization_id=${alias}.id AND so.seller_organization_id=${p})
 OR EXISTS(SELECT 1 FROM cohamy_crm.deals d WHERE d.customer_id=${alias}.id AND d.seller_organization_id=${p})
 OR EXISTS(SELECT 1 FROM cohamy_crm.partner_assignments a JOIN cohamy_crm.memberships m ON m.id=a.membership_id WHERE a.organization_id=${alias}.id AND m.organization_id=${p} AND m.active)
 OR EXISTS(SELECT 1 FROM cohamy_crm.customer_sales_ownership c JOIN cohamy_crm.memberships m ON m.id=c.sales_membership_id WHERE c.customer_organization_id=${alias}.id AND c.status IN('ACTIVE','PENDING_ACTIVATION') AND m.organization_id=${p} AND m.active)
 OR EXISTS(WITH RECURSIVE branch AS (SELECT child_organization_id FROM cohamy_crm.distribution_relations WHERE parent_organization_id=${p} AND status='ACTIVE' AND (ends_at IS NULL OR ends_at>now()) UNION SELECT r.child_organization_id FROM cohamy_crm.distribution_relations r JOIN branch b ON r.parent_organization_id=b.child_organization_id WHERE r.status='ACTIVE' AND (r.ends_at IS NULL OR r.ends_at>now())) SELECT 1 FROM branch WHERE child_organization_id=${alias}.id)
 OR EXISTS(SELECT 1 FROM cohamy_crm.audit_events e JOIN cohamy_crm.memberships m ON m.user_id=e.actor_id WHERE e.entity_id=${alias}.id::text AND e.action='partner.created' AND m.organization_id=${p} AND m.role IN('ADMIN','MANAGER','SALES') AND m.active)
 )`,params:[user.organizationId] as unknown[]};
}

type SaleLink={handover_id:string;request_id:string;order_id:string;clearance_id:string;receivable_id:string|null;source_checksum:string};
export interface HandoverSaleSettlement {orderId:string;clearanceId:string;receivableId:string|null;total:string;paid:string;remaining:string;paymentStatus:'UNPAID'|'PARTIAL'|'PAID';status:'UNPAID'|'PARTIAL'|'PAID'}

/** Serialize new-sale finance writers with Admin correction, before locking a
 * receipt/receivable. Legacy orders keep their existing locking behavior. */
export async function lockHandoverSaleOrders(sql:Sql,orderIds:string[]){
 if(orderIds.length)await sql.query('SELECT s.id FROM cohamy_crm.sales_orders s JOIN cohamy_crm.warehouse_sale_links l ON l.order_id=s.id WHERE s.id=ANY($1::uuid[]) ORDER BY s.id FOR UPDATE OF s',[[...new Set(orderIds)].sort()]);
}

/** Internal, transaction-bound read. Caller must first authorize the flow/order. */
export async function getHandoverSaleSettlement(sql:Sql,handoverId:string):Promise<HandoverSaleSettlement|null>{
 const row=(await sql.query<{order_id:string;clearance_id:string;receivable_id:string|null;total:string;remaining:string;paid:string}>(`
 SELECT l.order_id,l.clearance_id,r.id AS receivable_id,
 COALESCE(CASE WHEN r.status='VOID' THEN 0 ELSE r.original_amount END,c.gross_total)::text AS total,
 COALESCE(CASE WHEN r.status='VOID' THEN 0 ELSE r.remaining_amount END,0)::text AS remaining,
 COALESCE((SELECT sum(a.amount) FROM cohamy_crm.payment_allocations a JOIN cohamy_crm.payment_receipts p ON p.id=a.payment_id
 WHERE a.receivable_id=r.id AND p.status='CONFIRMED' AND NOT EXISTS(SELECT 1 FROM cohamy_crm.invoice_allocation_reversals x WHERE x.allocation_id=a.id)),0)::text AS paid
 FROM cohamy_crm.warehouse_sale_links l JOIN cohamy_crm.accounting_order_clearances c ON c.id=l.clearance_id
 LEFT JOIN cohamy_crm.receivables r ON r.order_id=l.order_id AND r.source_type='ORDER' AND r.source_id=l.order_id::text WHERE l.handover_id=$1`,[handoverId])).rows[0];
 if(!row)return null;
 const paymentStatus=BigInt(row.remaining)===0n?'PAID':BigInt(row.paid)>0n?'PARTIAL':'UNPAID';
 return {orderId:row.order_id,clearanceId:row.clearance_id,receivableId:row.receivable_id,total:row.total,paid:row.paid,remaining:row.remaining,paymentStatus,status:paymentStatus};
}

/** Payment and correction writers call this in their existing transaction. It
 * updates live read models only; confirmed flow/PDF snapshots stay immutable. */
export async function syncHandoverSaleSettlement(sql:Sql,orderId:string){
 const link=(await sql.query<{handover_id:string}>('SELECT handover_id FROM cohamy_crm.warehouse_sale_links WHERE order_id=$1',[orderId])).rows[0];
 if(!link)return null;
 const result=await getHandoverSaleSettlement(sql,link.handover_id);
 if(!result)return null;
 await sql.query('UPDATE cohamy_crm.accounting_order_clearances SET paid_amount=$1,remaining_debt=$2,payment_status=$3,updated_at=now() WHERE id=$4',[result.paid,result.remaining,result.paymentStatus,result.clearanceId]);
 await sql.query('UPDATE cohamy_crm.sales_orders SET payment_status=$1,updated_at=now() WHERE id=$2',[result.paymentStatus,result.orderId]);
 return result;
}

/** Only the new explicit SALE contract posts finances. The caller already holds
 * the draft lock and must execute this before its single stock issue, in the same
 * transaction. No quote pricing, reservation, credit hold or payment is invented. */
export async function finalizeHandoverSale(sql:Sql,user:Principal,snapshot:FlowSnapshot):Promise<FlowSnapshot>{
 if(snapshot.kind!=='ISSUE'||snapshot.issuePurpose!=='SALE'||snapshot.sale?.version!==1)return snapshot;
 if(user.area!=='crm'||user.role!=='ADMIN'&&!isWarehouseRole(user.role))throw new CrmError('FORBIDDEN',403);
 await assertCurrentPrincipal(sql,user);
 const sourceChecksum=commercialDigest({sale:snapshot.sale,lines:snapshot.lines,totals:snapshot.totals,warehouseId:snapshot.warehouseId});
 const prior=(await sql.query<SaleLink>('SELECT * FROM cohamy_crm.warehouse_sale_links WHERE handover_id=$1',[snapshot.id])).rows[0];
 if(prior){
  if(prior.source_checksum!==sourceChecksum)throw new CrmError('WAREHOUSE_SALE_SNAPSHOT_CONFLICT',409);
  const codes=(await sql.query<{request_code:string;order_code:string}>('SELECT r.code AS request_code,s.code AS order_code FROM cohamy_crm.commercial_requests r JOIN cohamy_crm.sales_orders s ON s.request_id=r.id WHERE s.id=$1',[prior.order_id])).rows[0];
  return {...snapshot,requestId:prior.request_id,requestCode:codes.request_code,sourceId:prior.clearance_id,sourceCode:codes.order_code,salesOrderId:prior.order_id};
 }
 if(snapshot.sourceId||snapshot.requestId||snapshot.salesOrderId)throw new CrmError('WAREHOUSE_SALE_SOURCE_CONFLICT',409);
 const whScope=warehouseScope(user,'w',1);
 const wh=(await sql.query<{organization_id:string}>(`SELECT w.organization_id FROM cohamy_crm.warehouses w JOIN cohamy_crm.organizations seller ON seller.id=w.organization_id WHERE w.id=$1 AND w.active AND w.organization_id=$${whScope.params.length+2} AND seller.kind='COHAMY' AND seller.active AND (${whScope.sql}) FOR UPDATE OF w FOR SHARE OF seller`,[snapshot.warehouseId,...whScope.params,user.organizationId])).rows[0];
 if(!wh)throw new CrmError('WAREHOUSE_INVALID',409);
 const customerScope=handoverCustomerScope(user,'o',1);
 const org=(await sql.query<{id:string;code:string;name:string;phone:string;email:string;address:string;business_id:string}>(`SELECT o.* FROM cohamy_crm.organizations o WHERE o.id=$1 AND (${customerScope.sql}) FOR SHARE OF o`,[snapshot.sale.customerOrganizationId,...customerScope.params])).rows[0];
 if(!org)throw new CrmError('CUSTOMER_NOT_ELIGIBLE',404);
 const products=(await sql.query<{id:string;sku:string;name:string;stock_unit:string;version:number;retail_price:string;vat_rate:string}>('SELECT id,sku,name,stock_unit,version,retail_price::text,vat_rate::text FROM cohamy_crm.products WHERE id=ANY($1::uuid[]) AND active FOR SHARE',[snapshot.lines.map(l=>l.productId)])).rows;
 const lines=snapshot.lines.map(l=>{
  const p=products.find(p=>p.id===l.productId);
  if(!p||p.stock_unit!==l.unit||fixed(l.quantity)<=0n||l.listUnitPrice===undefined||l.discountPercent===undefined||l.discountAmount===undefined||l.listLineTotal===undefined||l.vatAmount===undefined||l.grossLineTotal===undefined)throw new CrmError('WAREHOUSE_SALE_LINE_INVALID',409);
  // These catalog values were frozen by server-side draft preparation. A later
  // catalog edit must not silently reprice the customer's saved document.
  const percent=fixed(l.discountPercent),list=integer(l.listUnitPrice);
  if(percent>100000000n)throw new CrmError('WAREHOUSE_SALE_PRICE_CHANGED',409);
  const unit=roundRatio(list*(100000000n-percent),100000000n,'HALF_UP').toString(),gross=lineAmount(l.listUnitPrice,l.quantity,'HALF_UP'),net=lineAmount(unit,l.quantity,'HALF_UP');
  if(l.catalogVatRate===undefined)throw new CrmError('WAREHOUSE_SALE_LINE_INVALID',409);
  const rate=snapshot.sale!.includeVat?fixed(l.catalogVatRate):0n,tax=roundRatio(integer(net)*rate,100000000n,'HALF_UP').toString();
  if(rate>100000000n||fixed(l.vatRate??'0')!==rate)throw new CrmError('WAREHOUSE_SALE_CALCULATION_INVALID',409);
  if(l.unitPrice!==unit||l.listLineTotal!==gross||l.amount!==net||l.discountAmount!==(integer(gross)-integer(net)).toString()||l.vatAmount!==tax||l.grossLineTotal!==(integer(net)+integer(tax)).toString())throw new CrmError('WAREHOUSE_SALE_CALCULATION_INVALID',409);
  return {sku:p.sku,productId:p.id,name:p.name,stockUnit:p.stock_unit,productVersion:p.version,unitCode:'BASE',unitLabel:p.stock_unit,unitVersion:1,unitNumerator:'1',unitDenominator:'1',quantity:l.quantity,baseQuantity:l.quantity,unitPrice:unit,regularUnitPrice:l.listUnitPrice,listUnitPrice:l.listUnitPrice,discountPercent:l.discountPercent,discountAmount:l.discountAmount,listLineTotal:gross,gross,discount:l.discountAmount,net,tax,total:l.grossLineTotal,vatRate:l.vatRate??'0',catalogVatRate:l.catalogVatRate??p.vat_rate,gift:false,giftRule:null,note:l.note};
 });
 const sum=(key:'gross'|'discount'|'net'|'tax')=>lines.reduce((n,l)=>n+integer(l[key]),0n).toString();
 const goods=sum('gross'),discount=sum('discount'),net=sum('net'),vat=sum('tax'),shipping=integer(snapshot.sale.shippingFee).toString(),total=(integer(net)+integer(vat)+integer(shipping)).toString();
 if(goods!==snapshot.totals.goods||discount!==snapshot.totals.discount||net!==snapshot.totals.net||vat!==snapshot.totals.vat||shipping!==snapshot.totals.shipping||total!==snapshot.totals.total)throw new CrmError('WAREHOUSE_SALE_TOTAL_INVALID',409);
 const now=(await sql.query<{at:string;day:string}>("SELECT now()::text AS at,(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS day")).rows[0],issuedAt=new Date(now.at).toISOString(),day=vietnamBusinessDate(new Date(now.at));
 const requestId=randomUUID(),requestVersionId=randomUUID(),orderId=randomUUID(),orderVersionId=randomUUID(),clearanceId=randomUUID(),receivableId=integer(total)>0n?randomUUID():null;
 const requestCode=`YC-KHO-${day}-${requestId.slice(0,8).toUpperCase()}`,orderCode=`DH-KHO-${day}-${orderId.slice(0,8).toUpperCase()}`,policy=await currentOrderPolicy(sql,false);
 const pricePolicy={audience:'ORGANIZATION',organizationId:org.id,tierId:null,priority:0,startsAt:issuedAt,endsAt:null,quantityBasis:'LINE',rounding:'HALF_UP',taxBasis:'LINE',taxBasisPoints:0,feeAmount:shipping,maxSalesDiscountBasisPoints:10000,minimum:{amount:'0',cases:0,skus:[]},deliveryTerms:'Giao hàng từ kho theo phiếu đã xác nhận.',quoteValidityHours:1,approval:{nonSelfApproval:false,orderAmountThreshold:null,creditTerms:false},lines:lines.map(l=>({sku:l.sku,unitPrice:l.listUnitPrice,thresholds:[]})),gifts:[]};
 const quote={source:'WAREHOUSE_SALE',warehouseSale:{version:1,handoverId:snapshot.id,includeVat:snapshot.sale.includeVat},organization:{id:org.id,code:org.code,name:org.name,phone:org.phone,email:org.email,businessId:org.business_id??'',address:org.address},delivery:{recipient:snapshot.delivery.recipientName||snapshot.delivery.recipient||org.name,phone:snapshot.delivery.recipientPhone||snapshot.delivery.phone||org.phone,address:snapshot.delivery.address||org.address},basket:{lines:lines.map(l=>({sku:l.sku,unitCode:'BASE',quantity:l.quantity})),discountBasisPoints:0,creditTerms:false},calculation:{lines,subtotal:goods,discount,tax:vat,fee:shipping,total,caseCount:'0',approvalRequired:false,approvalReasons:[],minimumShortfalls:[],rounding:'HALF_UP',deliveryTerms:pricePolicy.deliveryTerms},totals:{goods,discount,net,vat,shipping,total,paid:'0',remaining:total},policy:pricePolicy,note:snapshot.note,currency:'VND',issuedAt,validUntil:issuedAt};
 const salesSnapshot={quote,request:{id:requestId,code:requestCode,versionId:requestVersionId,creatorId:user.id,channel:'OTHER',sourceWebsiteId:null,sourceQuotationId:null,sourceOrderId:null},orderPolicy:{id:policy.id,number:policy.number,definition:policy.definition,checksum:policy.checksum},approvalReasons:[],issuedAt};
 await sql.query("INSERT INTO cohamy_crm.commercial_requests(id,code,organization_id,creator_id,creator_membership_id,creator_area,creator_role,channel,status,seller_organization_id,assigned_approver_org_id) VALUES($1,$2,$3,$4,$5,'crm',$6,'OTHER','SUBMITTED',$7,$7)",[requestId,requestCode,org.id,user.id,user.membershipId,user.role,wh.organization_id]);
 await sql.query('INSERT INTO cohamy_crm.commercial_request_versions(id,request_id,number,snapshot,checksum,actor_id,idempotency_key,request_hash) VALUES($1,$2,1,$3::jsonb,$4,$5,$6,$4)',[requestVersionId,requestId,JSON.stringify(quote),commercialDigest(quote),user.id,randomUUID()]);
 await sql.query('UPDATE cohamy_crm.commercial_requests SET latest_version_id=$1,owner_approved_version_id=$1 WHERE id=$2',[requestVersionId,requestId]);
 await sql.query("INSERT INTO cohamy_crm.sales_orders(id,code,organization_id,request_id,creator_id,status,delivery_status,payment_status,seller_organization_id) VALUES($1,$2,$3,$4,$5,'CONFIRMED','DELIVERED',$6,$7)",[orderId,orderCode,org.id,requestId,user.id,receivableId?'UNPAID':'PAID',wh.organization_id]);
 await sql.query('INSERT INTO cohamy_crm.sales_order_versions(id,order_id,number,request_version_id,order_policy_id,snapshot,checksum,approval_required,actor_id) VALUES($1,$2,1,$3,$4,$5::jsonb,$6,false,$7)',[orderVersionId,orderId,requestVersionId,policy.id,JSON.stringify(salesSnapshot),commercialDigest(salesSnapshot),user.id]);
 await sql.query('UPDATE cohamy_crm.sales_orders SET latest_version_id=$1,confirmed_version_id=$1 WHERE id=$2',[orderVersionId,orderId]);
 const immutableLines=lines.map(l=>({...l,netUnitPrice:l.unitPrice,netLineTotal:l.net,vatAmount:l.tax,grossLineTotal:l.total,orderedQuantity:l.quantity,shippedQuantity:l.quantity}));
 await sql.query("INSERT INTO cohamy_crm.accounting_order_clearances(id,request_id,order_id,document_code,organization_id,warehouse_id,list_subtotal,discount_percent,discount_amount,net_total,vat_rate,vat_amount,gross_total,paid_amount,remaining_debt,payment_status,warehouse_issue_status,immutable_lines,orderer_type,orderer_name,orderer_phone,note) VALUES($1,$2,$3,$4,$5,$6,$7,0,$8,$9,0,$10,$11,0,$11,$12,'ISSUED',$13::jsonb,'CUSTOMER',$14,$15,$16)",[clearanceId,requestId,orderId,orderCode,org.id,snapshot.warehouseId,goods,discount,net,vat,total,receivableId?'UNPAID':'PAID',JSON.stringify(immutableLines),quote.delivery.recipient,quote.delivery.phone,snapshot.note]);
 if(receivableId){
  const terms={days:0,postingDate:now.day,orderVersionId,source:'WAREHOUSE_SALE',handoverId:snapshot.id,creditExposure:false};
  await sql.query("INSERT INTO cohamy_crm.receivables(id,code,organization_id,creditor_organization_id,order_id,source_type,source_id,original_amount,remaining_amount,due_on,terms_snapshot,status) VALUES($1,$2,$3,$4,$5,'ORDER',$5::uuid::text,$6,$6,$7,$8::jsonb,'OPEN')",[receivableId,`PT-KHO-${day}-${receivableId.slice(0,8).toUpperCase()}`,org.id,wh.organization_id,orderId,total,now.day,JSON.stringify(terms)]);
  await sql.query("INSERT INTO cohamy_crm.receivable_events(id,receivable_id,action,amount,payload,actor_id,reason,idempotency_key,request_hash,result) VALUES($1,$2,'POSTED',$3,$4::jsonb,$5,$6,$7,$8,$9::jsonb)",[randomUUID(),receivableId,total,JSON.stringify({sourceType:'ORDER',sourceId:orderId,terms}),user.id,'Ghi phải thu từ phiếu xuất bán được xác nhận.',randomUUID(),sourceChecksum,JSON.stringify({orderId,handoverId:snapshot.id,remaining:total})]);
 }
 await sql.query('INSERT INTO cohamy_crm.warehouse_sale_links(handover_id,request_id,order_id,clearance_id,receivable_id,warehouse_id,seller_organization_id,customer_organization_id,source_checksum,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[snapshot.id,requestId,orderId,clearanceId,receivableId,snapshot.warehouseId,wh.organization_id,org.id,sourceChecksum,user.id]);
 await sql.query('UPDATE cohamy_crm.warehouse_handover_invoices SET request_id=$1,clearance_id=$2,sales_order_id=$3,organization_id=$4,order_code=$5 WHERE id=$6',[requestId,clearanceId,orderId,org.id,orderCode,snapshot.id]);
 await audit(sql,user.id,'warehouse-sale.confirmed',orderId,{after:{handoverId:snapshot.id,requestId,clearanceId,receivableId,total,creditExposure:false},reason:'Phiếu xuất bán tạo một đơn bán và một khoản phải thu; tồn kho do luồng chứng từ ghi một lần.'});
 return {...snapshot,requestId,requestCode,sourceId:clearanceId,sourceCode:orderCode,salesOrderId:orderId};
}

const paymentInput=z.object({clearanceId:z.uuid(),amount:z.string().regex(/^[1-9]\d{0,23}$/),paymentDate:z.iso.datetime({offset:true}).optional(),paymentMethod:z.string().trim().max(80).default('BANK_TRANSFER'),referenceCode:z.string().trim().max(200).default(''),bankAccount:z.string().trim().max(200).default(''),transferContent:z.string().trim().max(2000).default(''),proofDocumentId:z.uuid().nullable().optional(),idempotencyKey:z.uuid()}).strict();
type PaymentInput=z.input<typeof paymentInput>;
async function paymentActionPrior(sql:Sql,user:Principal,key:string,hash:string){
 await sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[user.id+':finance:'+key]);
 const row=(await sql.query<{request_hash:string;result:Record<string,unknown>}>('SELECT request_hash,result FROM cohamy_crm.finance_actions WHERE actor_id=$1 AND idempotency_key=$2',[user.id,key])).rows[0];
 if(row&&row.request_hash!==hash)throw new CrmError('IDEMPOTENCY_CONFLICT',409);
 return row?.result;
}
async function paymentActionRecord(sql:Sql,user:Principal,key:string,hash:string,id:string,action:string,result:unknown){
 await sql.query('INSERT INTO cohamy_crm.finance_actions(id,action,resource_id,actor_id,idempotency_key,request_hash,result) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',[randomUUID(),action,id,user.id,key,hash,JSON.stringify(result)]);
}
async function salePaymentTarget(sql:Sql,user:Principal,clearanceId:string){
 if(user.area!=='crm'||!['ADMIN','MANAGER','ACCOUNTANT','SALES'].includes(user.role))throw new CrmError('FORBIDDEN',403);
 await assertCurrentPrincipal(sql,user);
 const row=(await sql.query<{handover_id:string;order_id:string;receivable_id:string|null;customer_organization_id:string;seller_organization_id:string}>("SELECT l.*,r.id AS receivable_id FROM cohamy_crm.warehouse_sale_links l LEFT JOIN cohamy_crm.receivables r ON r.order_id=l.order_id AND r.source_type='ORDER' AND r.source_id=l.order_id::text WHERE l.clearance_id=$1 AND l.seller_organization_id=$2",[clearanceId,user.organizationId])).rows[0];
 if(!row)throw new CrmError('NOT_FOUND',404);
 if(user.role==='SALES'){
  const {salesOrderAccess}=await import('./sales-orders');
  await salesOrderAccess(sql,user,row.order_id);
 }
 if(!row.receivable_id)throw new CrmError('RECEIVABLE_RESOLVED',409);
 return row as typeof row&{receivable_id:string};
}
async function applySaleReceipt(sql:Sql,user:Principal,target:{receivable_id:string;order_id:string},paymentId:string,amount:string,reason:string,hash:string){
 const r=(await sql.query<{remaining_amount:string;status:string}>('SELECT remaining_amount::text,status FROM cohamy_crm.receivables WHERE id=$1 FOR UPDATE',[target.receivable_id])).rows[0];
 if(!r||!['OPEN','PARTIAL','DISPUTED'].includes(r.status)||integer(amount)>integer(r.remaining_amount))throw new CrmError('RECEIVABLE_OVERALLOCATED',409);
 const remaining=(integer(r.remaining_amount)-integer(amount)).toString(),status=remaining==='0'?'PAID':'PARTIAL';
 await sql.query('INSERT INTO cohamy_crm.payment_allocations(id,payment_id,receivable_id,amount,actor_id,reason,idempotency_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),paymentId,target.receivable_id,amount,user.id,reason,randomUUID(),hash]);
 await sql.query('UPDATE cohamy_crm.payment_receipts SET allocated_amount=allocated_amount+$1,version=version+1,updated_at=now() WHERE id=$2',[amount,paymentId]);
 await sql.query('UPDATE cohamy_crm.receivables SET remaining_amount=$1,status=$2,version=version+1,updated_at=now() WHERE id=$3',[remaining,status,target.receivable_id]);
 await sql.query("INSERT INTO cohamy_crm.receivable_events(id,receivable_id,action,amount,payload,actor_id,reason,idempotency_key,request_hash,result) VALUES($1,$2,'PAYMENT_APPLIED',$3,$4::jsonb,$5,$6,$7,$8,$9::jsonb)",[randomUUID(),target.receivable_id,amount,JSON.stringify({paymentId}),user.id,reason,randomUUID(),hash,JSON.stringify({remaining,status})]);
}
function paymentResult(payment:{id:string;code:string;status:string},settlement:HandoverSaleSettlement){return {ok:true,id:settlement.clearanceId,transactionId:payment.id,transactionCode:payment.code,transactionStatus:payment.status,paidAmount:settlement.paid,remainingDebt:settlement.remaining,paymentStatus:settlement.paymentStatus,canonicalFinance:true};}

/** Existing accountant forms can use canonical finance without a nested
 * transaction. A staff submission records pending money; it cannot reduce debt. */
export async function recordHandoverSalePayment(sql:Sql,user:Principal,input:PaymentInput){
 const parsed=paymentInput.safeParse(input);if(!parsed.success)throw new CrmError('INVALID_FIELDS',400);
 const d=parsed.data,hash=commercialDigest({action:'WAREHOUSE_SALE_PAYMENT',...d});
 const target=await salePaymentTarget(sql,user,d.clearanceId),old=await paymentActionPrior(sql,user,d.idempotencyKey,hash);if(old)return old;
 await lockHandoverSaleOrders(sql,[target.order_id]);
 const id=randomUUID(),code=`TT-${vietnamBusinessDate(new Date())}-${id.slice(0,8).toUpperCase()}`,confirmed=['ADMIN','MANAGER','ACCOUNTANT'].includes(user.role),status=confirmed?'CONFIRMED':'PENDING';
 if(d.proofDocumentId&&!(await sql.query('SELECT id FROM cohamy_crm.private_documents WHERE id=$1',[d.proofDocumentId])).rows.length)throw new CrmError('DOCUMENT_NOT_FOUND',404);
 const remaining=(await sql.query<{remaining_amount:string;status:string}>('SELECT remaining_amount::text,status FROM cohamy_crm.receivables WHERE id=$1 FOR UPDATE',[target.receivable_id])).rows[0];
 if(!remaining||remaining.status==='VOID'||integer(d.amount)>integer(remaining.remaining_amount))throw new CrmError('RECEIVABLE_OVERALLOCATED',409);
 await sql.query("INSERT INTO cohamy_crm.payment_receipts(id,code,organization_id,amount,kind,status,paid_at,reference,actor_id,payer_organization_id,payee_organization_id,method,notes,confirmed_by,confirmed_at) VALUES($1,$2,$3,$4,'PAYMENT',$5,COALESCE($6::timestamptz,now()),$7,$8,$3,$9,$10,$11,$12,CASE WHEN $12::uuid IS NULL THEN NULL ELSE now() END)",[id,code,target.customer_organization_id,d.amount,status,d.paymentDate??null,d.referenceCode||code,user.id,target.seller_organization_id,d.paymentMethod,JSON.stringify({transferContent:d.transferContent,bankAccount:d.bankAccount,proofDocumentId:d.proofDocumentId??null}),confirmed?user.id:null]);
 await sql.query('INSERT INTO cohamy_crm.warehouse_sale_payment_links(payment_id,handover_id,receivable_id,actor_id,idempotency_key,request_hash) VALUES($1,$2,$3,$4,$5,$6)',[id,target.handover_id,target.receivable_id,user.id,d.idempotencyKey,hash]);
 if(confirmed)await applySaleReceipt(sql,user,target,id,d.amount,d.transferContent||'Ghi nhận thanh toán đơn xuất bán.',hash);
 const settlement=(await syncHandoverSaleSettlement(sql,target.order_id))!,result=paymentResult({id,code,status},settlement);
 await paymentActionRecord(sql,user,d.idempotencyKey,hash,id,'WAREHOUSE_SALE_PAYMENT_CREATED',result);
 await audit(sql,user.id,'finance.warehouse-sale-payment.created',id,{after:{...result,amount:d.amount},reason:d.transferContent||'Ghi nhận thanh toán đơn xuất bán.'});
 return result;
}

export async function reviewHandoverSalePayment(sql:Sql,user:Principal,input:{transactionId:string;decision:'CONFIRM'|'REJECT';reason:string;idempotencyKey:string}){
 if(user.area!=='crm'||!['ADMIN','MANAGER','ACCOUNTANT'].includes(user.role))throw new CrmError('FORBIDDEN',403);
 if(!z.object({transactionId:z.uuid(),decision:z.enum(['CONFIRM','REJECT']),reason:z.string().trim().min(3).max(2000),idempotencyKey:z.uuid()}).strict().safeParse(input).success)throw new CrmError('INVALID_FIELDS',400);
 const linked=(await sql.query<{clearance_id:string}>('SELECT l.clearance_id FROM cohamy_crm.warehouse_sale_payment_links p JOIN cohamy_crm.warehouse_sale_links l ON l.handover_id=p.handover_id WHERE p.payment_id=$1',[input.transactionId])).rows[0];
 if(!linked)throw new CrmError('NOT_FOUND',404);
 const target=await salePaymentTarget(sql,user,linked.clearance_id),hash=commercialDigest({action:'WAREHOUSE_SALE_PAYMENT_REVIEW',...input}),old=await paymentActionPrior(sql,user,input.idempotencyKey,hash);if(old)return old;
 await lockHandoverSaleOrders(sql,[target.order_id]);
 const payment=(await sql.query<{id:string;code:string;status:string;amount:string}>('SELECT id,code,status,amount::text FROM cohamy_crm.payment_receipts WHERE id=$1 FOR UPDATE',[input.transactionId])).rows[0];
 if(!payment||payment.status!=='PENDING')throw new CrmError('PAYMENT_ALREADY_REVIEWED',409);
 const status=input.decision==='CONFIRM'?'CONFIRMED':'REJECTED';
 await sql.query('UPDATE cohamy_crm.payment_receipts SET status=$1,confirmed_by=$2,confirmed_at=now(),version=version+1,updated_at=now() WHERE id=$3',[status,input.decision==='CONFIRM'?user.id:null,payment.id]);
 if(status==='CONFIRMED')await applySaleReceipt(sql,user,target,payment.id,payment.amount,input.reason,hash);
 const settlement=(await syncHandoverSaleSettlement(sql,target.order_id))!,result=paymentResult({...payment,status},settlement);
 await paymentActionRecord(sql,user,input.idempotencyKey,hash,payment.id,'WAREHOUSE_SALE_PAYMENT_REVIEWED',result);
 await audit(sql,user.id,'finance.warehouse-sale-payment.'+status.toLowerCase(),payment.id,{before:{status:payment.status},after:result,reason:input.reason});
 return result;
}
