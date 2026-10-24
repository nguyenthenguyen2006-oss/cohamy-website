import 'server-only';
import {z} from 'zod';
import {database} from './db';
import {assertCurrentPrincipal,audit} from './auth';
import {assertPermission,CrmError,isWarehouseRole,warehouseRoleRegion} from './permissions';
import {partnerScope,getOrganization,listWarehouses} from './repository';
import {fixed,fixedText,integer,lineAmount} from './decimal';
import type {Principal} from './types';
import type {SalesSnapshot} from './sales-orders';

function isoDate(value:unknown):string{
 if(!value)return '';
 if(value instanceof Date)return value.toISOString().slice(0,10);
 return String(value).slice(0,10);
}

function cleanQty(value:string|number|null|undefined):string{
 if(value===null||value===undefined||value==='')return '0';
 const s=String(value);
 return s.includes('.')?s.replace(/\.?0+$/,'')||'0':s;
}

export interface ReconciliationLineRow {
 rowKey:string;
 orderId:string;
 orderCode:string;
 orderDate:string;
 organizationId:string;
 organizationCode:string;
 organizationName:string;
 partnerKind:string;
 sku:string;
 productId:string;
 productName:string;
 unitCode:string;
 unitLabel:string;
 stockUnit:string;
 quantity:string;
 baseQuantity:string;
 listUnitPrice:string;
 discountPercent:string;
 unitPriceAfterDiscount:string;
 listAmount:string;
 discountAmount:string;
 netAmount:string;
 taxAmount:string;
 lineTotal:string;
 orderStatus:string;
 deliveryStatus:string;
 paymentStatus:string;
 deliveryCodes:string[];
 issueDocCodes:string[];
 warehouseCodes:string[];
 receivableCode:string|null;
 receivableId:string|null;
}

export interface ReconciliationOrderRow {
 orderId:string;
 orderCode:string;
 createdAt:string;
 orderDate:string;
 organizationId:string;
 organizationCode:string;
 organizationName:string;
 partnerKind:string;
 orderStatus:string;
 deliveryStatus:string;
 paymentStatus:string;
 versionNumber:number;
 lineCount:number;
 skuSummary:string;
 totalBaseQty:string;
 listSubtotal:string;
 discountPercentLabel:string;
 discountAmount:string;
 taxAndFee:string;
 netTotal:string;
 deliveryIds:string[];
 deliveryCodes:string[];
 issueDocIds:string[];
 issueDocCodes:string[];
 warehouseCodes:string[];
 deliveredQty:string;
 dispatchedQty:string;
 receivableIds:string[];
 receivableCodes:string[];
 receivableStatus:string;
 receivableOriginal:string;
 paidAmount:string;
 remainingDebt:string;
 unpostedAmount:string;
 dueOn:string|null;
 note:string;
 lines:ReconciliationLineRow[];
}

export interface SalesReconciliationResult {
 orders:ReconciliationOrderRow[];
 lineItems:ReconciliationLineRow[];
 totals:{
  orderCount:number;
  lineCount:number;
  totalBaseQty:string;
  listSubtotal:string;
  discountAmount:string;
  taxAndFee:string;
  netTotal:string;
  deliveredQty:string;
  receivableOriginal:string;
  paidAmount:string;
  remainingDebt:string;
  unpostedAmount:string;
 };
 filterOptions:{
  organizations:{id:string;code:string;name:string;kind:string}[];
  warehouses:{id:string;code:string;name:string}[];
  skus:{sku:string;name:string}[];
 };
}

export async function salesReconciliation(user:Principal,query:Record<string,string>={}):Promise<SalesReconciliationResult>{
 assertPermission(user,'orders.read');
 const db=await database();
 const whRegion=warehouseRoleRegion(user.role);
 const scope=user.area==='crm'&&isWarehouseRole(user.role)
  ?(whRegion
   ?{sql:'EXISTS(SELECT 1 FROM cohamy_crm.inventory_reservations ir JOIN cohamy_crm.warehouse_assignments wa ON wa.warehouse_id=ir.warehouse_id JOIN cohamy_crm.warehouses w ON w.id=ir.warehouse_id WHERE ir.order_id=s.id AND wa.membership_id=$1 AND w.region=$2)',params:[user.membershipId,whRegion] as unknown[]}
   :{sql:'EXISTS(SELECT 1 FROM cohamy_crm.inventory_reservations ir JOIN cohamy_crm.warehouse_assignments wa ON wa.warehouse_id=ir.warehouse_id WHERE ir.order_id=s.id AND wa.membership_id=$1)',params:[user.membershipId] as unknown[]})
  :partnerScope(user,'o');
 const params:unknown[]=[...scope.params];
 const conds:string[]=[`(${scope.sql})`];
 if(user.area==='portal'){
  params.push(user.organizationId);
  conds.push(`(s.organization_id=$${params.length} OR s.seller_organization_id=$${params.length})`);
 }
 if(query.organizationId&&z.uuid().safeParse(query.organizationId).success){
  params.push(query.organizationId);
  conds.push(`s.organization_id=$${params.length}`);
 }
 if(query.orderStatus){
  params.push(query.orderStatus);
  conds.push(`s.status=$${params.length}`);
 }
 if(query.deliveryStatus){
  params.push(query.deliveryStatus);
  conds.push(`s.delivery_status=$${params.length}`);
 }
 if(query.paymentStatus){
  params.push(query.paymentStatus);
  conds.push(`s.payment_status=$${params.length}`);
 }
 if(query.from&&z.iso.date().safeParse(query.from).success){
  params.push(query.from);
  conds.push(`s.created_at>=(($${params.length}::date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`);
 }
 if(query.to&&z.iso.date().safeParse(query.to).success){
  params.push(query.to);
  conds.push(`s.created_at<((($${params.length}::date)+1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`);
 }

 // Query orders with subquery-aggregated delivery, inventory issue document, and receivable figures
 // so 1-N deliveries or 1-N receivables never multiply order amounts.
 const rows=(await db.query<{
  id:string;
  code:string;
  organization_id:string;
  organization_code:string;
  organization_name:string;
  partner_kind:string;
  status:string;
  delivery_status:string;
  payment_status:string;
  version_number:number;
  snapshot:SalesSnapshot;
  created_at:string;
  updated_at:string;
  delivery_ids:string[]|null;
  delivery_codes:string[]|null;
  delivered_qty:string;
  dispatched_qty:string;
  issue_doc_ids:string[]|null;
  issue_doc_codes:string[]|null;
  warehouse_codes:string[]|null;
  warehouse_ids:string[]|null;
  receivable_ids:string[]|null;
  receivable_codes:string[]|null;
  receivable_original:string;
  receivable_remaining:string;
  receivable_statuses:string[]|null;
  earliest_due_on:string|null;
 }>(`
  SELECT
   s.id,
   s.code,
   s.organization_id,
   o.code AS organization_code,
   o.name AS organization_name,
   o.kind AS partner_kind,
   s.status,
   s.delivery_status,
   s.payment_status,
   v.number AS version_number,
   v.snapshot,
   s.created_at,
   s.updated_at,
   del_agg.delivery_ids,
   del_agg.delivery_codes,
   COALESCE(del_agg.delivered_qty, 0)::text AS delivered_qty,
   COALESCE(del_agg.dispatched_qty, 0)::text AS dispatched_qty,
   inv_agg.issue_doc_ids,
   inv_agg.issue_doc_codes,
   inv_agg.warehouse_codes,
   inv_agg.warehouse_ids,
   rec_agg.receivable_ids,
   rec_agg.receivable_codes,
   COALESCE(rec_agg.original_amount, 0)::text AS receivable_original,
   COALESCE(rec_agg.remaining_amount, 0)::text AS receivable_remaining,
   rec_agg.statuses AS receivable_statuses,
   rec_agg.earliest_due_on::text AS earliest_due_on
  FROM cohamy_crm.sales_orders s
  JOIN cohamy_crm.organizations o ON o.id = s.organization_id
  JOIN cohamy_crm.sales_order_versions v ON v.id = COALESCE(s.confirmed_version_id, s.latest_version_id)
  LEFT JOIN LATERAL (
   SELECT
    array_agg(DISTINCT d.id) AS delivery_ids,
    array_agg(DISTINCT d.code) AS delivery_codes,
    sum(dl.delivered) AS delivered_qty,
    sum(dl.dispatched) AS dispatched_qty
   FROM cohamy_crm.deliveries d
   LEFT JOIN cohamy_crm.delivery_lines dl ON dl.delivery_id = d.id
   WHERE d.order_id = s.id AND d.status <> 'CANCELLED'
  ) del_agg ON true
  LEFT JOIN LATERAL (
   SELECT
    array_agg(DISTINCT idoc.id) FILTER (WHERE idoc.id IS NOT NULL) AS issue_doc_ids,
    array_agg(DISTINCT idoc.code) FILTER (WHERE idoc.code IS NOT NULL) AS issue_doc_codes,
    array_agg(DISTINCT w.code) FILTER (WHERE w.code IS NOT NULL) AS warehouse_codes,
    array_agg(DISTINCT w.id::text) FILTER (WHERE w.id IS NOT NULL) AS warehouse_ids
   FROM cohamy_crm.inventory_reservations ir
   JOIN cohamy_crm.warehouses w ON w.id = ir.warehouse_id
   LEFT JOIN cohamy_crm.inventory_movements im ON im.source_order_id = s.id AND im.warehouse_id = w.id AND im.quantity < 0
   LEFT JOIN cohamy_crm.inventory_documents idoc ON idoc.id = im.document_id AND idoc.status = 'POSTED'
   WHERE ir.order_id = s.id
  ) inv_agg ON true
  LEFT JOIN LATERAL (
   SELECT
    array_agg(r.id ORDER BY r.created_at) AS receivable_ids,
    array_agg(r.code ORDER BY r.created_at) AS receivable_codes,
    sum(r.original_amount) AS original_amount,
    sum(r.remaining_amount) AS remaining_amount,
    array_agg(DISTINCT r.status) AS statuses,
    min(r.due_on) AS earliest_due_on
   FROM cohamy_crm.receivables r
   WHERE (r.order_id = s.id OR (r.source_type IN ('ORDER','sales-order') AND r.source_id = s.id::text))
     AND r.status <> 'VOID'
  ) rec_agg ON true
  WHERE ${conds.join(' AND ')}
  ORDER BY s.created_at DESC, s.id
  LIMIT 500
 `,params)).rows;

 const skuFilter=(query.sku??'').trim().toLowerCase();
 const warehouseFilter=(query.warehouseId??'').trim();
 const qFilter=(query.q??'').trim().toLowerCase();

 const orders:ReconciliationOrderRow[]=[];
 const lineItems:ReconciliationLineRow[]=[];

 let sumBaseQty=0n;
 let sumListSubtotal=0n;
 let sumDiscount=0n;
 let sumTaxAndFee=0n;
 let sumNetTotal=0n;
 let sumDeliveredQty=0n;
 let sumReceivableOrig=0n;
 let sumPaid=0n;
 let sumRemainingDebt=0n;
 let sumUnposted=0n;

 for(const row of rows){
  if(warehouseFilter&&!(row.warehouse_ids??[]).includes(warehouseFilter))continue;
  const calc=row.snapshot?.quote?.calculation;
  if(!calc)continue;
  const rawLines=calc.lines??[];
  if(skuFilter&&!rawLines.some(l=>l.sku.toLowerCase().includes(skuFilter)||l.name.toLowerCase().includes(skuFilter)))continue;

  const deliveryCodes=(row.delivery_codes??[]).filter(Boolean);
  const issueDocCodes=(row.issue_doc_codes??[]).filter(Boolean);
  const warehouseCodes=(row.warehouse_codes??[]).filter(Boolean);
  const receivableCodes=(row.receivable_codes??[]).filter(Boolean);
  const receivableIds=(row.receivable_ids??[]).filter(Boolean);

  if(qFilter){
   const hay=[
    row.code,
    row.organization_code,
    row.organization_name,
    ...deliveryCodes,
    ...issueDocCodes,
    ...receivableCodes,
    ...rawLines.map(l=>`${l.sku} ${l.name}`),
   ].join(' ').toLowerCase();
   if(!hay.includes(qFilter))continue;
  }

  const orderListSubtotal=integer(calc.channel?.listSubtotal??calc.subtotal);
  const orderNetAfterDiscount=integer(calc.subtotal)-integer(calc.discount);
  const orderDiscountAmount=orderListSubtotal>orderNetAfterDiscount?orderListSubtotal-orderNetAfterDiscount:integer(calc.discount);
  const orderTaxAndFee=integer(calc.tax)+integer(calc.fee);
  const orderTotal=integer(calc.total);

  let discountPercentLabel='0%';
  if(orderListSubtotal>0n&&orderDiscountAmount>0n){
   const bp=Number((orderDiscountAmount*10000n)/orderListSubtotal);
   discountPercentLabel=`${(bp/100).toFixed(bp%100===0?0:2)}%`;
  }

  const recOrig=integer(row.receivable_original);
  const recRem=integer(row.receivable_remaining);
  const recPaid=recOrig>recRem?recOrig-recRem:0n;
  const unposted=receivableIds.length===0&&row.status!=='CANCELLED'&&row.status!=='REJECTED'?orderTotal:0n;
  const recStatuses=(row.receivable_statuses??[]).filter(Boolean);
  const recStatus=receivableIds.length===0
   ?(row.status==='CONFIRMED'?'CHƯA GHI SỔ':'NHÁP/CHỜ DUYỆT')
   :recStatuses.includes('DISPUTED')?'DISPUTED'
   :recRem===0n?'PAID'
   :recPaid>0n?'PARTIAL':'OPEN';

  const orderLines:ReconciliationLineRow[]=[];
  let orderBaseQty=0n;

  for(let idx=0;idx<rawLines.length;idx++){
   const l=rawLines[idx];
   if(skuFilter&&!l.sku.toLowerCase().includes(skuFilter)&&!l.name.toLowerCase().includes(skuFilter))continue;
   const baseQ=fixed(l.baseQuantity);
   orderBaseQty+=baseQ;
   const listUnit=l.listUnitPrice??l.regularUnitPrice??l.unitPrice;
   const listAmt=l.gift?'0':lineAmount(listUnit,l.baseQuantity,calc.rounding);
   const netAmt=l.net;
   const discAmt=(integer(listAmt)>integer(netAmt)?integer(listAmt)-integer(netAmt):integer(l.discount)).toString();
   const totalBp=(l.promoPercentBp??0)+(l.accountPercentBp??0);
   const lineDiscPct=totalBp>0?`${(totalBp/100).toFixed(totalBp%100===0?0:1)}%`:integer(listAmt)>0n&&integer(discAmt)>0n?`${(Number((integer(discAmt)*10000n)/integer(listAmt))/100).toFixed(1)}%`:'0%';

   const lineRow:ReconciliationLineRow={
    rowKey:`${row.id}:${idx}:${l.sku}`,
    orderId:row.id,
    orderCode:row.code,
    orderDate:isoDate(row.created_at),
    organizationId:row.organization_id,
    organizationCode:row.organization_code,
    organizationName:row.organization_name,
    partnerKind:row.partner_kind,
    sku:l.sku,
    productId:l.productId,
    productName:l.name,
    unitCode:l.unitCode,
    unitLabel:l.unitLabel,
    stockUnit:l.stockUnit,
    quantity:cleanQty(l.quantity),
    baseQuantity:cleanQty(l.baseQuantity),
    listUnitPrice:listUnit,
    discountPercent:lineDiscPct,
    unitPriceAfterDiscount:l.unitPrice,
    listAmount:listAmt,
    discountAmount:discAmt,
    netAmount:netAmt,
    taxAmount:l.tax,
    lineTotal:l.total,
    orderStatus:row.status,
    deliveryStatus:row.delivery_status,
    paymentStatus:row.payment_status,
    deliveryCodes,
    issueDocCodes,
    warehouseCodes,
    receivableCode:receivableCodes[0]??null,
    receivableId:receivableIds[0]??null,
   };
   orderLines.push(lineRow);
   lineItems.push(lineRow);
  }

  const delivQtyFixed=fixed(row.delivered_qty||'0');
  const dispQtyFixed=fixed(row.dispatched_qty||'0');

  orders.push({
   orderId:row.id,
   orderCode:row.code,
   createdAt:row.created_at,
   orderDate:isoDate(row.created_at),
   organizationId:row.organization_id,
   organizationCode:row.organization_code,
   organizationName:row.organization_name,
   partnerKind:row.partner_kind,
   orderStatus:row.status,
   deliveryStatus:row.delivery_status,
   paymentStatus:row.payment_status,
   versionNumber:row.version_number,
   lineCount:orderLines.length,
   skuSummary:orderLines.map(l=>`${l.productName} (${l.quantity} ${l.unitLabel})`).join(', '),
   totalBaseQty:cleanQty(fixedText(orderBaseQty)),
   listSubtotal:orderListSubtotal.toString(),
   discountPercentLabel,
   discountAmount:orderDiscountAmount.toString(),
   taxAndFee:orderTaxAndFee.toString(),
   netTotal:orderTotal.toString(),
   deliveryIds:(row.delivery_ids??[]).filter(Boolean),
   deliveryCodes,
   issueDocIds:(row.issue_doc_ids??[]).filter(Boolean),
   issueDocCodes,
   warehouseCodes,
   deliveredQty:cleanQty(fixedText(delivQtyFixed)),
   dispatchedQty:cleanQty(fixedText(dispQtyFixed)),
   receivableIds,
   receivableCodes,
   receivableStatus:recStatus,
   receivableOriginal:recOrig.toString(),
   paidAmount:recPaid.toString(),
   remainingDebt:recRem.toString(),
   unpostedAmount:unposted.toString(),
   dueOn:row.earliest_due_on?isoDate(row.earliest_due_on):null,
   note:row.snapshot?.quote?.note??'',
   lines:orderLines,
  });

  sumBaseQty+=orderBaseQty;
  sumListSubtotal+=orderListSubtotal;
  sumDiscount+=orderDiscountAmount;
  sumTaxAndFee+=orderTaxAndFee;
  sumNetTotal+=orderTotal;
  sumDeliveredQty+=delivQtyFixed;
  sumReceivableOrig+=recOrig;
  sumPaid+=recPaid;
  sumRemainingDebt+=recRem;
  sumUnposted+=unposted;
 }

 const orgScope=partnerScope(user,'o');
 const orgRows=(await db.query<{id:string;code:string;name:string;kind:string}>(
  `SELECT o.id,o.code,o.name,o.kind FROM cohamy_crm.organizations o WHERE (${orgScope.sql}) AND o.merged_into_id IS NULL AND o.kind IN ('DEALER','CUSTOMER') ORDER BY o.name LIMIT 300`,
  orgScope.params
 )).rows;
 const warehouses=canWarehouseRead(user)?(await listWarehouses(user)).map(w=>({id:w.id,code:w.code,name:w.name})):[];
 const skus=(await db.query<{sku:string;name:string}>('SELECT sku,name FROM cohamy_crm.products WHERE active ORDER BY name')).rows;

 return {
  orders,
  lineItems,
  totals:{
   orderCount:orders.length,
   lineCount:lineItems.length,
   totalBaseQty:cleanQty(fixedText(sumBaseQty)),
   listSubtotal:sumListSubtotal.toString(),
   discountAmount:sumDiscount.toString(),
   taxAndFee:sumTaxAndFee.toString(),
   netTotal:sumNetTotal.toString(),
   deliveredQty:cleanQty(fixedText(sumDeliveredQty)),
   receivableOriginal:sumReceivableOrig.toString(),
   paidAmount:sumPaid.toString(),
   remainingDebt:sumRemainingDebt.toString(),
   unpostedAmount:sumUnposted.toString(),
  },
  filterOptions:{
   organizations:orgRows,
   warehouses,
   skus,
  },
 };
}

function canWarehouseRead(user:Principal){
 return user.area==='crm'&&(['ADMIN','MANAGER','SALES','ACCOUNTANT'].includes(user.role)||isWarehouseRole(user.role));
}

export interface MatrixColumnDef {
 key:string;
 label:string;
 subLabel:string;
 partnerId:string|null;
 partnerName:string;
 date:string;
 documentId:string;
 documentCode:string;
 orderId:string|null;
 orderCode:string|null;
 kind:string;
}

export interface MatrixMovementItem {
 id:string;
 documentId:string;
 documentCode:string;
 kind:string;
 status:string;
 warehouseId:string;
 warehouseCode:string;
 warehouseName:string;
 locationCode:string;
 productId:string;
 sku:string;
 productName:string;
 stockUnit:string;
 unitsPerCase:number|null;
 lotId:string;
 lotCode:string;
 expiresOn:string|null;
 quantity:string;
 signedQuantity:string;
 balanceAfter:string;
 sourceOrderId:string|null;
 orderCode:string|null;
 partnerId:string|null;
 partnerName:string;
 reason:string;
 createdAt:string;
 date:string;
}

export interface MatrixProductRow {
 productId:string;
 sku:string;
 productName:string;
 category:string;
 weightLabel:string;
 stockUnit:string;
 unitsPerCase:number;
 caseRuleLabel:string;
 retailPrice:string;
 openingQty:string;
 receiptQty:string;
 receiptCasesLabel:string;
 dynamicOutbounds:Record<string,{qty:string;movements:MatrixMovementItem[]}>;
 totalOutboundQty:string;
 returnAndAdjustQty:string;
 closingOnHand:string;
 closingCasesLabel:string;
 reservedQty:string;
 availableQty:string;
 retailStockValue:string;
 allMovements:MatrixMovementItem[];
}

export interface InventoryMatrixResult {
 pendingUnclassifiedTransfers?:{id:string;code:string;sourceCode:string;destinationCode:string;quantity:number}[];
 rows:MatrixProductRow[];
 dynamicColumns:MatrixColumnDef[];
 movements:MatrixMovementItem[];
 totals:{
  skuCount:number;
  openingQty:string;
  receiptQty:string;
  columnTotals:Record<string,string>;
  totalOutboundQty:string;
  returnAndAdjustQty:string;
  closingOnHand:string;
  reservedQty:string;
  availableQty:string;
  retailStockValue:string;
 };
 warehouses:{id:string;code:string;name:string}[];
 partners:{id:string;name:string}[];
}

function formatCasesAndUnits(baseQtyFixed:bigint,unitsPerCase:number,stockUnit:string):string{
 const wholeUnits=baseQtyFixed/1000000n;
 if(wholeUnits===0n)return `0 ${stockUnit}`;
 if(!unitsPerCase||unitsPerCase<=1)return `${wholeUnits.toString()} ${stockUnit}`;
 const upc=BigInt(unitsPerCase);
 const cases=wholeUnits/upc;
 const rem=wholeUnits%upc;
 if(cases>0n&&rem===0n)return `${cases.toString()} lô (${wholeUnits.toString()} ${stockUnit})`;
 if(cases>0n)return `${cases.toString()} lô + ${rem.toString()} ${stockUnit}`;
 return `${wholeUnits.toString()} ${stockUnit}`;
}

export async function inventoryMatrix(user:Principal,query:Record<string,string>={}):Promise<InventoryMatrixResult>{
 assertPermission(user,'warehouses.read');
 const db=await database();
 const warehouses=await listWarehouses(user);
 const allowedWhIds=warehouses.map(w=>w.id);
 const selectedWhId=query.warehouseId&&allowedWhIds.includes(query.warehouseId)?query.warehouseId:null;
 const targetWhIds=selectedWhId?[selectedWhId]:allowedWhIds;
 const pendingUnclassifiedTransfers=targetWhIds.length?(await db.query<{id:string;code:string;sourceCode:string;destinationCode:string;quantity:number}>(`
  SELECT t.id,t.code,sw.code AS "sourceCode",dw.code AS "destinationCode",
   (SELECT coalesce(sum((line->>'quantity')::integer),0)::integer FROM jsonb_array_elements(coalesce(t.snapshot->'unclassifiedLines','[]'::jsonb)) line) AS quantity
  FROM cohamy_crm.inventory_transfers t
  JOIN cohamy_crm.warehouses sw ON sw.id=t.source_warehouse_id
  JOIN cohamy_crm.warehouses dw ON dw.id=t.destination_warehouse_id
  WHERE (t.source_warehouse_id=ANY($1::uuid[]) OR t.destination_warehouse_id=ANY($1::uuid[]))
   AND t.status IN('IN_TRANSIT','PARTIAL') AND jsonb_array_length(coalesce(t.snapshot->'unclassifiedLines','[]'::jsonb))>0
  ORDER BY t.created_at,t.id`,[targetWhIds])).rows:[];

 const fromDate=query.from&&z.iso.date().safeParse(query.from).success?query.from:null;
 const toDate=query.to&&z.iso.date().safeParse(query.to).success?query.to:null;
 const qFilter=(query.q??'').trim().toLowerCase();
 const partnerFilter=(query.partnerId??'').trim();

 const products=(await db.query<{
  id:string;
  sku:string;
  name:string;
  category:string;
  weight_label:string;
  stock_unit:string;
  units_per_case:number|null;
  retail_price:string;
  active:boolean;
 }>(`SELECT id,sku,name,category,weight_label,stock_unit,units_per_case,retail_price::text,active FROM cohamy_crm.products WHERE active ORDER BY name,sku`)).rows;

 const balances=targetWhIds.length?(await db.query<{
  product_id:string;
  on_hand:string;
  reserved:string;
  available:string;
 }>(`
  SELECT
   b.product_id,
   sum(b.on_hand)::text AS on_hand,
   sum(b.reserved)::text AS reserved,
   sum(CASE WHEN l.kind='PICK' AND l.active AND t.status='AVAILABLE' THEN b.on_hand-b.reserved ELSE 0 END)::text AS available
  FROM cohamy_crm.inventory_balances b
  JOIN cohamy_crm.warehouse_locations l ON l.id = b.location_id
  JOIN cohamy_crm.inventory_lots t ON t.id = b.lot_id
  WHERE b.warehouse_id = ANY($1::uuid[])
  GROUP BY b.product_id
 `,[targetWhIds])).rows:[];

 const balanceMap=new Map(balances.map(b=>[b.product_id,b]));

 const rawMovements=targetWhIds.length?(await db.query<{
  id:string;
  document_id:string;
  document_code:string;
  kind:string;
  status:string;
  warehouse_id:string;
  warehouse_code:string;
  warehouse_name:string;
  location_code:string;
  product_id:string;
  sku:string;
  product_name:string;
  stock_unit:string;
  units_per_case:number|null;
  lot_id:string;
  lot_code:string;
  expires_on:string|null;
  quantity:string;
  balance_after:string;
  source_order_id:string|null;
  order_code:string|null;
  order_org_id:string|null;
  order_org_name:string|null;
  doc_org_id:string|null;
  doc_org_name:string|null;
  reason:string;
  created_at:string;
 }>(`
  SELECT
   m.id,
   m.document_id,
   d.code AS document_code,
   d.kind,
   d.status,
   m.warehouse_id,
   w.code AS warehouse_code,
   w.name AS warehouse_name,
   l.code AS location_code,
   m.product_id,
   p.sku,
   p.name AS product_name,
   p.stock_unit,
   p.units_per_case,
   m.lot_id,
   t.code AS lot_code,
   t.expires_on::text AS expires_on,
   m.quantity::text AS quantity,
   m.balance_after::text AS balance_after,
   m.source_order_id,
   so.code AS order_code,
   so.organization_id AS order_org_id,
   so_org.name AS order_org_name,
   d.organization_id AS doc_org_id,
   doc_org.name AS doc_org_name,
   d.reason,
   d.created_at::text AS created_at
  FROM cohamy_crm.inventory_movements m
  JOIN cohamy_crm.inventory_documents d ON d.id = m.document_id
  JOIN cohamy_crm.warehouses w ON w.id = m.warehouse_id
  JOIN cohamy_crm.warehouse_locations l ON l.id = m.location_id
  JOIN cohamy_crm.products p ON p.id = m.product_id
  JOIN cohamy_crm.inventory_lots t ON t.id = m.lot_id
  LEFT JOIN cohamy_crm.sales_orders so ON so.id = COALESCE(m.source_order_id, CASE WHEN d.reference_type='sales-order' AND d.reference_id ~* '^[0-9a-f-]{36}$' THEN d.reference_id::uuid ELSE NULL END)
  LEFT JOIN cohamy_crm.organizations so_org ON so_org.id = so.organization_id
  LEFT JOIN cohamy_crm.organizations doc_org ON doc_org.id = d.organization_id
  WHERE m.warehouse_id = ANY($1::uuid[])
  ORDER BY d.created_at ASC, m.created_at ASC, m.id ASC
 `,[targetWhIds])).rows:[];

 const partnerOptionsMap=new Map<string,string>();
 const columnMap=new Map<string,MatrixColumnDef>();
 const movementsInPeriod:MatrixMovementItem[]=[];
 const beforePeriodDeltaByProduct=new Map<string,bigint>();
 const inPeriodDeltaByProduct=new Map<string,bigint>();

 for(const m of rawMovements){
  const moveDate=isoDate(m.created_at);
  const signedQ=fixed(m.quantity,6,true);
  const absQ=signedQ<0n?-signedQ:signedQ;
  const partnerId=m.order_org_id??m.doc_org_id??null;
  const partnerName=m.order_org_name??(m.kind==='RECEIPT'?'Nhập kho':m.doc_org_name??'Nội bộ');
  if(m.order_org_id&&m.order_org_name){
   partnerOptionsMap.set(m.order_org_id,m.order_org_name);
  }

  if(fromDate&&moveDate<fromDate){
   beforePeriodDeltaByProduct.set(m.product_id,(beforePeriodDeltaByProduct.get(m.product_id)??0n)+signedQ);
   continue;
  }
  if(toDate&&moveDate>toDate){
   continue;
  }
  if(partnerFilter&&partnerId!==partnerFilter)continue;

  inPeriodDeltaByProduct.set(m.product_id,(inPeriodDeltaByProduct.get(m.product_id)??0n)+signedQ);

  const item:MatrixMovementItem={
   id:m.id,
   documentId:m.document_id,
   documentCode:m.document_code,
   kind:m.kind,
   status:m.status,
   warehouseId:m.warehouse_id,
   warehouseCode:m.warehouse_code,
   warehouseName:m.warehouse_name,
   locationCode:m.location_code,
   productId:m.product_id,
   sku:m.sku,
   productName:m.product_name,
   stockUnit:m.stock_unit,
   unitsPerCase:m.units_per_case,
   lotId:m.lot_id,
   lotCode:m.lot_code,
   expiresOn:m.expires_on?isoDate(m.expires_on):null,
   quantity:cleanQty(fixedText(absQ)),
   signedQuantity:(signedQ<0n?'-':'+')+cleanQty(fixedText(absQ)),
   balanceAfter:cleanQty(m.balance_after),
   sourceOrderId:m.source_order_id,
   orderCode:m.order_code,
   partnerId,
   partnerName,
   reason:m.reason,
   createdAt:m.created_at,
   date:moveDate,
  };
  movementsInPeriod.push(item);

  // Dynamic outbound column per outbound document / order (like Kho Hà Nội Excel columns: Cô Nga, Tân - Thìn, A Xuất Đợt 1, A Xuất Đợt 2)
  if(signedQ<0n&&(m.kind==='ISSUE'||m.kind==='TRANSFER')){
   const colKey=m.document_id;
   if(!columnMap.has(colKey)){
    const shortDate=moveDate.slice(8,10)+'/'+moveDate.slice(5,7);
    columnMap.set(colKey,{
     key:colKey,
     label:m.order_org_name?`${m.order_org_name}`:`Xuất ${m.document_code.slice(0,12)}`,
     subLabel:`${shortDate} · ${m.order_code??m.document_code}`,
     partnerId,
     partnerName,
     date:moveDate,
     documentId:m.document_id,
     documentCode:m.document_code,
     orderId:m.source_order_id,
     orderCode:m.order_code,
     kind:m.kind,
    });
   }
  }
 }

 const dynamicColumns=[...columnMap.values()];
 const rows:MatrixProductRow[]=[];

 let totalOpening=0n;
 let totalReceipt=0n;
 let totalOutbound=0n;
 let totalReturnAdjust=0n;
 let totalClosing=0n;
 let totalReserved=0n;
 let totalAvailable=0n;
 let totalRetailValue=0n;
 const columnTotalsNum=new Map<string,bigint>();

 for(const p of products){
  if(qFilter&&!p.sku.toLowerCase().includes(qFilter)&&!p.name.toLowerCase().includes(qFilter))continue;
  const bal=balanceMap.get(p.id);
  const currentOnHand=fixed(bal?.on_hand??'0');
  const currentReserved=fixed(bal?.reserved??'0');
  const currentAvailable=fixed(bal?.available??'0');

  const pMoves=movementsInPeriod.filter(m=>m.productId===p.id);
  // Filter out completely inactive zero-balance SKUs only if user filtered by partner
  if(partnerFilter&&pMoves.length===0)continue;

  const openingFixed=fromDate?(beforePeriodDeltaByProduct.get(p.id)??0n):0n;
  let receiptFixed=0n;
  let outboundFixed=0n;
  let returnAdjustFixed=0n;
  const dynamicOutbounds:Record<string,{qty:string;movements:MatrixMovementItem[]}>={};

  for(const col of dynamicColumns){
   dynamicOutbounds[col.key]={qty:'0',movements:[]};
  }

  for(const mv of pMoves){
   const q=fixed(mv.quantity);
   const isNegative=mv.signedQuantity.startsWith('-');
   if(mv.kind==='RECEIPT'&&!isNegative){
    receiptFixed+=q;
   }else if(isNegative&&(mv.kind==='ISSUE'||mv.kind==='TRANSFER')){
    outboundFixed+=q;
    const cell=dynamicOutbounds[mv.documentId];
    if(cell){
     const nextQ=fixed(cell.qty)+q;
     cell.qty=cleanQty(fixedText(nextQ));
     cell.movements.push(mv);
     columnTotalsNum.set(mv.documentId,(columnTotalsNum.get(mv.documentId)??0n)+q);
    }
   }else{
    returnAdjustFixed+=isNegative?-q:q;
   }
  }

  const closingFixed=fromDate||toDate?(openingFixed+receiptFixed-outboundFixed+returnAdjustFixed):currentOnHand;
  const upc=p.units_per_case??24;
  const retailVal=(closingFixed/1000000n)*integer(p.retail_price||'0');

  rows.push({
   productId:p.id,
   sku:p.sku,
   productName:p.name,
   category:p.category,
   weightLabel:p.weight_label,
   stockUnit:p.stock_unit||'Gói',
   unitsPerCase:upc,
   caseRuleLabel:`1 Lô/Thùng = ${upc} ${p.stock_unit||'Gói'}`,
   retailPrice:p.retail_price||'0',
   openingQty:cleanQty(fixedText(openingFixed)),
   receiptQty:cleanQty(fixedText(receiptFixed)),
   receiptCasesLabel:formatCasesAndUnits(receiptFixed,upc,p.stock_unit||'Gói'),
   dynamicOutbounds,
   totalOutboundQty:cleanQty(fixedText(outboundFixed)),
   returnAndAdjustQty:(returnAdjustFixed<0n?'-':'')+cleanQty(fixedText(returnAdjustFixed<0n?-returnAdjustFixed:returnAdjustFixed)),
   closingOnHand:cleanQty(fixedText(closingFixed)),
   closingCasesLabel:formatCasesAndUnits(closingFixed,upc,p.stock_unit||'Gói'),
   reservedQty:cleanQty(fixedText(currentReserved)),
   availableQty:cleanQty(fixedText(currentAvailable)),
   retailStockValue:retailVal.toString(),
   allMovements:pMoves,
  });

  totalOpening+=openingFixed;
  totalReceipt+=receiptFixed;
  totalOutbound+=outboundFixed;
  totalReturnAdjust+=returnAdjustFixed;
  totalClosing+=closingFixed;
  totalReserved+=currentReserved;
  totalAvailable+=currentAvailable;
  totalRetailValue+=retailVal;
 }

 const columnTotals:Record<string,string>={};
 for(const col of dynamicColumns){
  columnTotals[col.key]=cleanQty(fixedText(columnTotalsNum.get(col.key)??0n));
 }

 return {
  pendingUnclassifiedTransfers,
  rows,
  dynamicColumns,
  movements:[...movementsInPeriod].reverse(),
  totals:{
   skuCount:rows.length,
   openingQty:cleanQty(fixedText(totalOpening)),
   receiptQty:cleanQty(fixedText(totalReceipt)),
   columnTotals,
   totalOutboundQty:cleanQty(fixedText(totalOutbound)),
   returnAndAdjustQty:(totalReturnAdjust<0n?'-':'')+cleanQty(fixedText(totalReturnAdjust<0n?-totalReturnAdjust:totalReturnAdjust)),
   closingOnHand:cleanQty(fixedText(totalClosing)),
   reservedQty:cleanQty(fixedText(totalReserved)),
   availableQty:cleanQty(fixedText(totalAvailable)),
   retailStockValue:totalRetailValue.toString(),
  },
  warehouses:warehouses.map(w=>({id:w.id,code:w.code,name:w.name})),
  partners:[...partnerOptionsMap.entries()].map(([id,name])=>({id,name})),
 };
}

const partnerPatchItemSchema=z.object({
 id:z.uuid(),
 version:z.number().int().positive(),
 changes:z.object({
  code:z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/u).optional(),
  name:z.string().trim().min(2).max(200).optional(),
  phone:z.string().trim().max(40).optional(),
  email:z.union([z.literal(''),z.email()]).optional(),
  address:z.string().trim().max(500).optional(),
  contact_name:z.string().trim().max(120).optional(),
  segment:z.string().trim().max(120).optional(),
  source:z.string().trim().max(120).optional(),
  business_id:z.string().trim().max(40).regex(/^[A-Za-z0-9 ._-]*$/).optional(),
  stage:z.enum(['LEAD','CONTACTED','ACTIVE','INACTIVE']).optional(),
  active:z.boolean().optional(),
 }).strict(),
}).strict();

export async function batchPartnerCells(user:Principal,input:unknown){
 assertPermission(user,'partners.write');
 if(user.area!=='crm')throw new CrmError('FORBIDDEN',403);
 const parsed=z.object({
  preview:z.boolean().default(false),
  rows:z.array(partnerPatchItemSchema).min(1).max(100),
  reason:z.string().trim().min(2).max(500).default('Cập nhật trực tiếp trên bảng tính CRM'),
 }).strict().safeParse(input);
 if(!parsed.success)throw new CrmError('INVALID_FIELDS',400);
 const d=parsed.data;
 const db=await database();

 return db.transaction(async tx=>{
  await assertCurrentPrincipal(tx,user);
  const results:{id:string;code:string;name:string;ok:boolean;error?:string;nextVersion?:number}[]=[];

  for(const item of [...d.rows].sort((a,b)=>a.id.localeCompare(b.id))){
   try{
    const org=await getOrganization(user,item.id,tx);
    if(org.merged_into_id){
     results.push({id:item.id,code:org.code,name:org.name,ok:false,error:'Hồ sơ đã gộp (PARTNER_MERGED), không thể sửa.'});
     continue;
    }
    if(org.kind==='COHAMY'){
     results.push({id:item.id,code:org.code,name:org.name,ok:false,error:'Không thể sửa tổ chức gốc COHAMY.'});
     continue;
    }
    if(org.version!==item.version){
     results.push({id:item.id,code:org.code,name:org.name,ok:false,error:`Xung đột phiên bản (hiện tại v${org.version}, bản gửi v${item.version}).`});
     continue;
    }
    if(!d.preview){
     const nextCode=item.changes.code??org.code;
     const nextName=item.changes.name??org.name;
     const nextPhone=item.changes.phone??org.phone;
     const nextEmail=item.changes.email??org.email;
     const nextAddress=item.changes.address??org.address;
     const nextActive=item.changes.active??org.active;
     const nextContact=item.changes.contact_name??org.contact_name??'';
     const nextSegment=item.changes.segment??org.segment??'';
     const nextSource=item.changes.source??org.source??'';
     const nextBiz=item.changes.business_id??org.business_id??'';
     const nextStage=item.changes.stage??org.stage??'ACTIVE';

     const updated=await tx.query<{version:number}>(
      `UPDATE cohamy_crm.organizations
       SET code=$1,name=$2,phone=$3,email=$4,address=$5,active=$6,contact_name=$7,segment=$8,source=$9,business_id=$10,stage=$11,version=version+1
       WHERE id=$12 AND version=$13 RETURNING version`,
      [nextCode,nextName,nextPhone,nextEmail,nextAddress,nextActive,nextContact,nextSegment,nextSource,nextBiz,nextStage,item.id,item.version]
     );
     if(!updated.rows.length){
      results.push({id:item.id,code:org.code,name:org.name,ok:false,error:'Xung đột phiên bản khi ghi (VERSION_CONFLICT).'});
      continue;
     }
     await audit(tx,user.id,'partner.spreadsheet-updated',item.id,{before:{version:org.version},after:{...item.changes,version:updated.rows[0].version},reason:d.reason});
     results.push({id:item.id,code:nextCode,name:nextName,ok:true,nextVersion:updated.rows[0].version});
    }else{
     results.push({id:item.id,code:org.code,name:org.name,ok:true,nextVersion:org.version+1});
    }
   }catch(e){
    const code=e instanceof CrmError?e.code:'INVALID_FIELDS';
    results.push({id:item.id,code:'',name:'',ok:false,error:code});
   }
  }

  return {
   preview:d.preview,
   total:results.length,
   validCount:results.filter(r=>r.ok).length,
   errorCount:results.filter(r=>!r.ok).length,
   results,
  };
 });
}

const catalogPatchItemSchema=z.object({
 id:z.uuid(),
 version:z.number().int().positive(),
 changes:z.object({
  sku:z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9_-]+$/).optional(),
  name:z.string().trim().min(2).max(200).optional(),
  stock_unit:z.string().trim().min(1).max(40).optional(),
  units_per_case:z.number().int().min(1).max(100000).nullable().optional(),
  active:z.boolean().optional(),
 }).strict(),
}).strict();

export async function batchCatalogCells(user:Principal,input:unknown){
 if(user.area!=='crm'||!['ADMIN','MANAGER'].includes(user.role))throw new CrmError('FORBIDDEN',403);
 const parsed=z.object({
  preview:z.boolean().default(false),
  rows:z.array(catalogPatchItemSchema).min(1).max(100),
  reason:z.string().trim().min(2).max(500).default('Cập nhật hàng hóa trực tiếp trên bảng tính CRM'),
 }).strict().safeParse(input);
 if(!parsed.success)throw new CrmError('INVALID_FIELDS',400);
 const d=parsed.data;
 const db=await database();

 return db.transaction(async tx=>{
  await assertCurrentPrincipal(tx,user);
  const results:{id:string;sku:string;name:string;ok:boolean;error?:string;nextVersion?:number}[]=[];

  for(const item of [...d.rows].sort((a,b)=>a.id.localeCompare(b.id))){
   const row=(await tx.query<{id:string;sku:string;name:string;stock_unit:string;units_per_case:number|null;active:boolean;version:number}>('SELECT id,sku,name,stock_unit,units_per_case,active,version FROM cohamy_crm.products WHERE id=$1 FOR UPDATE',[item.id])).rows[0];
   if(!row){
    results.push({id:item.id,sku:'',name:'',ok:false,error:'Không tìm thấy sản phẩm (NOT_FOUND).'});
    continue;
   }
   if(row.version!==item.version){
    results.push({id:item.id,sku:row.sku,name:row.name,ok:false,error:`Xung đột phiên bản (hiện tại v${row.version}, bản gửi v${item.version}).`});
    continue;
   }
   if(item.changes.stock_unit&&item.changes.stock_unit!==row.stock_unit){
    const inUse=(await tx.query('SELECT code FROM cohamy_crm.commercial_units WHERE product_id=$1 AND active LIMIT 1',[item.id])).rows.length>0;
    if(inUse){
     results.push({id:item.id,sku:row.sku,name:row.name,ok:false,error:'Đơn vị tồn đang gắn với đơn vị thương mại (UNIT_IN_USE).'});
     continue;
    }
   }
   if(!d.preview){
    const nextSku=item.changes.sku??row.sku;
    const nextName=item.changes.name??row.name;
    const nextUnit=item.changes.stock_unit??row.stock_unit;
    const nextUpc=item.changes.units_per_case!==undefined?item.changes.units_per_case:row.units_per_case;
    const nextActive=item.changes.active??row.active;

    const updated=await tx.query<{version:number}>(
     'UPDATE cohamy_crm.products SET sku=$1,name=$2,stock_unit=$3,units_per_case=$4,active=$5,version=version+1 WHERE id=$6 AND version=$7 RETURNING version',
     [nextSku,nextName,nextUnit,nextUpc,nextActive,item.id,item.version]
    );
    if(!updated.rows.length){
     results.push({id:item.id,sku:row.sku,name:row.name,ok:false,error:'Xung đột phiên bản (VERSION_CONFLICT).'});
     continue;
    }
    await audit(tx,user.id,'catalog.spreadsheet-updated',item.id,{before:{version:row.version},after:{...item.changes,version:updated.rows[0].version},reason:d.reason});
    results.push({id:item.id,sku:nextSku,name:nextName,ok:true,nextVersion:updated.rows[0].version});
   }else{
    results.push({id:item.id,sku:row.sku,name:row.name,ok:true,nextVersion:row.version+1});
   }
  }

  return {
   preview:d.preview,
   total:results.length,
   validCount:results.filter(r=>r.ok).length,
   errorCount:results.filter(r=>!r.ok).length,
   results,
  };
 });
}
