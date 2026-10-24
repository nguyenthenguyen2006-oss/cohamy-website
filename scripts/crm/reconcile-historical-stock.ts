// Operator-only, reviewed source import. Preview is read-only; apply requires its digest.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {database,type Sql} from '../../lib/crm/db';
import {membershipPrincipal,assertCurrentPrincipal,audit} from '../../lib/crm/auth';
import {commercialDigest as digest} from '../../lib/crm/commercial-common';
import {historicalInvoiceSchema,type HistoricalInvoice} from '../../lib/crm/historical-order-model';
import {priceDefinitionSchema,type PricedLine,type PriceCalculation} from '../../lib/crm/pricing-model';
import type {QuotationSnapshot} from '../../lib/crm/quotations';
import type {SalesSnapshot} from '../../lib/crm/sales-orders';

type Product={id:string;sku:string;name:string;stock_unit:string;active:boolean;version?:number};
type ReceiptLine={productId:string;sku:string;name:string;quantity:number;unitCost:number;amount:number;sourceRow:number;sourceNote:string};
type Plan={version:number;sourceChecksum:string;warehouseCode:string;destinationWarehouseCode:string;products:Record<string,Product>;receipts:{date:string;sourceHeader:string;lines:ReceiptLine[]}[];historicalInvoiceSources:{id:string;snapshotChecksum:string;sourceChecksum:string}[];transfer:{date:string;sourceChecksum:string;classificationAuthority:string;lines:{productId:string;sku:string;quantity:number}[];unclassifiedLines:{name:string;quantity:number;stockEffect:string;userInstruction:string}[]}};
type Invoice={id:string;warehouse_id:string;snapshot:HistoricalInvoice;snapshot_checksum:string;source_checksum:string};
type Warehouse={id:string;code:string;organization_id:string};
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const stable=(key:string)=>{const v=createHash('sha256').update('COHAMY-HCM-RECONCILIATION-20261025/'+key).digest('hex');return `${v.slice(0,8)}-${v.slice(8,12)}-4${v.slice(13,16)}-a${v.slice(17,20)}-${v.slice(20,32)}`;};
const batchId=stable('batch');
function productKey(name:string){const text=name.normalize('NFD').replace(/\p{M}/gu,'').replaceAll('đ','d').replaceAll('Đ','D').toLowerCase();for(const [term,key] of [['macca','macadamia'],['mac ca','macadamia'],['sau rieng','durian'],['matcha','matcha'],['tra xanh','matcha'],['dau','strawberry'],['hat dieu','cashew'],['nhieu mau','rainbow'],['ngu sac','rainbow'],['xoai','mango'],['hanh nhan','almond']])if(text.includes(term))return key;throw Error('UNMAPPED_SOURCE_PRODUCT '+name);}
const at=(date:string)=>{assert.match(date,/^2026-\d{2}-\d{2}$/);return date+'T12:00:00+07:00';};
async function rowManifest(sql:Sql){
 const tables=(await sql.query<{name:string}>("SELECT tablename AS name FROM pg_tables WHERE schemaname='cohamy_crm' ORDER BY tablename")).rows;
 const result=new Map<string,Set<string>>();
 for(const {name} of tables){assert.match(name,/^[a-z][a-z0-9_]*$/);const rows=(await sql.query<{hash:string}>(`SELECT encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') AS hash FROM cohamy_crm."${name}" t`)).rows;result.set(name,new Set(rows.map(r=>r.hash)));}
 return result;
}

async function main(){
 const [planPath,membershipId,reportPath,applyDigest]=process.argv.slice(2);assert.ok(planPath&&membershipId&&reportPath);
 assert.ok(['STAGING','PRODUCTION'].includes(process.env.CRM_ENVIRONMENT??''));
 const target=new URL(process.env.CRM_DATABASE_URL??'');assert.equal(process.env.CRM_DATABASE_MODE,'postgres');assert.ok(['127.0.0.1','localhost'].includes(target.hostname)&&target.port==='55432');
 assert.ok(process.env.CRM_ENVIRONMENT==='PRODUCTION'?target.pathname==='/cohamy_crm':/^\/cohamy_restore_[a-z0-9_]+$/.test(target.pathname));
 const plan=JSON.parse(await fs.readFile(planPath,'utf8')) as Plan,directory=path.dirname(path.resolve(planPath));assert.equal(plan.version,1);
 assert.equal(sha(await fs.readFile(path.join(directory,'source.xlsx'))),plan.sourceChecksum,'WORKBOOK_SOURCE_CHANGED');
 assert.equal(sha(await fs.readFile(path.join(directory,'transfer.png'))),plan.transfer.sourceChecksum,'TRANSFER_IMAGE_CHANGED');
 assert.equal(plan.receipts.length,7);assert.equal(plan.historicalInvoiceSources.length,4);assert.equal(plan.transfer.classificationAuthority,'USER_CONFIRMED_HCM_TO_HN_TRANSFER');
 assert.equal(plan.transfer.unclassifiedLines.reduce((sum,l)=>sum+l.quantity,0),8);
 assert.ok(plan.transfer.unclassifiedLines.every(l=>l.stockEffect==='PENDING_PRODUCT_IDENTIFICATION'));
 const db=await database();
 try{
  const report=await db.transaction(async sql=>{
   await sql.exec(applyDigest?'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE':'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const admin=await membershipPrincipal(membershipId,sql);assert.ok(admin&&admin.area==='crm'&&admin.role==='ADMIN');
   if(applyDigest){await sql.query('SELECT pg_advisory_xact_lock(431025,hashtext($1))',[batchId]);await sql.query('SELECT id FROM cohamy_crm.users WHERE id=$1 FOR UPDATE',[admin.id]);await assertCurrentPrincipal(sql,admin);}
   const warehouses=(await sql.query<Warehouse>('SELECT id,code,organization_id FROM cohamy_crm.warehouses WHERE active AND organization_id=$1 AND code=ANY($2::text[]) ORDER BY id'+(applyDigest?' FOR UPDATE':''),[admin.organizationId,[plan.warehouseCode,plan.destinationWarehouseCode]])).rows;
   const hcm=warehouses.find(w=>w.code===plan.warehouseCode),hn=warehouses.find(w=>w.code===plan.destinationWarehouseCode);assert.ok(hcm&&hn&&hcm.id!==hn.id);
   const products=(await sql.query<Product>('SELECT id,sku,name,stock_unit,active,version FROM cohamy_crm.products WHERE id=ANY($1::uuid[])',[Object.values(plan.products).map(p=>p.id)])).rows;
   assert.equal(products.length,8);for(const p of Object.values(plan.products))assert.ok(products.some(l=>l.id===p.id&&l.sku===p.sku&&l.active&&l.stock_unit==='Gói'),'PRODUCT_MAPPING_CHANGED');
   const invoiceRows=(await sql.query<Invoice>('SELECT id,warehouse_id,snapshot,snapshot_checksum,source_checksum FROM cohamy_crm.historical_order_invoices WHERE id=ANY($1::uuid[]) ORDER BY invoice_date,id',[plan.historicalInvoiceSources.map(s=>s.id)])).rows;
   assert.equal(invoiceRows.length,4);for(const row of invoiceRows){historicalInvoiceSchema.parse(row.snapshot);const source=plan.historicalInvoiceSources.find(s=>s.id===row.id)!;assert.equal(row.warehouse_id,hcm.id);assert.equal(digest(row.snapshot),source.snapshotChecksum);assert.equal(row.snapshot_checksum,source.snapshotChecksum);assert.equal(row.source_checksum,source.sourceChecksum);}
   const prior=(await sql.query<{payload:{checksum:string;result:unknown}}>("SELECT payload FROM cohamy_crm.audit_events WHERE action='historical-stock.reconciled' AND entity_id=$1",[batchId])).rows[0];
   const sourceDigest=digest(plan);
   if(prior){assert.equal(prior.payload.checksum,sourceDigest,'HISTORICAL_BATCH_SOURCE_CONFLICT');return {mode:'ALREADY_APPLIED',sourceDigest,result:prior.payload.result};}
   const deltas=new Map<string,number>(),add=(id:string,q:number)=>deltas.set(id,(deltas.get(id)??0)+q);
   for(const receipt of plan.receipts){at(receipt.date);for(const line of receipt.lines){assert.ok(Number.isSafeInteger(line.quantity)&&line.quantity>=0);assert.equal(line.quantity*line.unitCost,line.amount);assert.ok(products.some(p=>p.id===line.productId&&p.sku===line.sku));add(line.productId,line.quantity);}}
   for(const invoice of invoiceRows)for(const line of invoice.snapshot.lines){const p=plan.products[productKey(line.name)];assert.ok(p);add(p.id,-line.quantity);}
   for(const line of plan.transfer.lines){assert.ok(Number.isSafeInteger(line.quantity)&&line.quantity>0);assert.ok(products.some(p=>p.id===line.productId&&p.sku===line.sku));add(line.productId,-line.quantity);}
   const balances=(await sql.query<{warehouse_id:string;location_id:string;product_id:string;lot_id:string;on_hand:string;reserved:string;version:number}>('SELECT warehouse_id,location_id,product_id,lot_id,on_hand::text,reserved::text,version FROM cohamy_crm.inventory_balances WHERE warehouse_id=ANY($1::uuid[]) ORDER BY warehouse_id,location_id,product_id,lot_id'+(applyDigest?' FOR UPDATE':''),[[hcm.id,hn.id]])).rows;
   assert.ok(balances.filter(b=>b.warehouse_id===hcm.id).every(b=>Number(b.on_hand)===0&&Number(b.reserved)===0),'HCM_ALREADY_HAS_STOCK_REVIEW_REQUIRED');
   assert.ok([...deltas.values()].every(q=>q>=0),'NEGATIVE_CLOSING_STOCK');
   const checksum=digest({plan:sourceDigest,warehouseIds:[hcm.id,hn.id],balances,invoices:invoiceRows.map(i=>[i.id,i.snapshot_checksum])});
   const summary=products.map(p=>({productId:p.id,sku:p.sku,name:p.name,closingHCMKnown:deltas.get(p.id)??0}));
   const result={factoryReceipts:7,receiptQuantity:plan.receipts.reduce((s,r)=>s+r.lines.reduce((n,l)=>n+l.quantity,0),0),historicalSales:4,salesQuantity:invoiceRows.reduce((s,r)=>s+r.snapshot.lines.reduce((n,l)=>n+l.quantity,0),0),salesTotal:invoiceRows.reduce((s,r)=>s+r.snapshot.total,0),remainingDebt:0,knownTransferQuantity:plan.transfer.lines.reduce((s,l)=>s+l.quantity,0),unclassifiedTransferQuantity:8,summary};
   assert.equal(result.receiptQuantity,3211);assert.equal(result.salesQuantity,663);assert.equal(result.salesTotal,31163000);assert.equal(result.knownTransferQuantity,84);
   if(!applyDigest)return {mode:'PREVIEW',checksum,sourceDigest,result};
   assert.equal(applyDigest,checksum,'PREVIEW_CHANGED_REVIEW_REQUIRED');
   const originalRows=await rowManifest(sql);
   const beforeMail=(await sql.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.document_mail_outbox')).rows[0].n;
   const locations=(await sql.query<{id:string;warehouse_id:string}>('SELECT id,warehouse_id FROM cohamy_crm.warehouse_locations WHERE active AND kind=\'PICK\' AND warehouse_id=ANY($1::uuid[]) ORDER BY code,id',[[hcm.id,hn.id]])).rows;
   let hcmLocation=locations.find(l=>l.warehouse_id===hcm.id)?.id;const hnLocation=locations.find(l=>l.warehouse_id===hn.id)?.id;assert.ok(hnLocation,'HN_LOCATION_REQUIRED');
   if(!hcmLocation){hcmLocation=stable('HCM-PICK');await sql.query("INSERT INTO cohamy_crm.warehouse_locations(id,warehouse_id,code,name,kind) VALUES($1,$2,'HCM-PICK','Khu lưu kho Hồ Chí Minh','PICK')",[hcmLocation,hcm.id]);}
   const lotIds=new Map<string,string>();
   for(const p of products){const id=stable('unknown-lot/'+p.id);await sql.query("INSERT INTO cohamy_crm.inventory_lots(id,product_id,code,manufactured_on,expires_on) VALUES($1,$2,'IMPORT-HCM-2026-CHUA-RO-LO',NULL,NULL)",[id,p.id]);lotIds.set(p.id,id);}
   const movement=async(docId:string,warehouseId:string,locationId:string,productId:string,quantity:number,key:string,orderId:string|null=null)=>{
    const lotId=lotIds.get(productId)!;await sql.query('INSERT INTO cohamy_crm.inventory_balances(warehouse_id,location_id,product_id,lot_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[warehouseId,locationId,productId,lotId]);
    const balance=(await sql.query<{on_hand:string;reserved:string}>('SELECT on_hand::text,reserved::text FROM cohamy_crm.inventory_balances WHERE warehouse_id=$1 AND location_id=$2 AND product_id=$3 AND lot_id=$4 FOR UPDATE',[warehouseId,locationId,productId,lotId])).rows[0];
    const after=Number(balance.on_hand)+quantity;assert.ok(Number.isSafeInteger(after)&&after>=Number(balance.reserved));
    await sql.query('UPDATE cohamy_crm.inventory_balances SET on_hand=$1,version=version+1,updated_at=now() WHERE warehouse_id=$2 AND location_id=$3 AND product_id=$4 AND lot_id=$5',[after,warehouseId,locationId,productId,lotId]);
    const product=products.find(p=>p.id===productId)!;const unit={productId,sku:product.sku,name:product.name,code:'BASE',stockUnit:'Gói',numerator:'1',denominator:'1',sourceBatch:batchId,lotIdentification:'UNKNOWN_SOURCE_NOT_SUPPLIED'};
    await sql.query('INSERT INTO cohamy_crm.inventory_movements(id,document_id,warehouse_id,location_id,product_id,lot_id,quantity,balance_after,unit_snapshot,source_order_id,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)',[stable('move/'+key),docId,warehouseId,locationId,productId,lotId,quantity,after,JSON.stringify(unit),orderId,admin.id]);
    return unit;
   };
   const document=async(kind:string,key:string,date:string,referenceType:string,referenceId:string,reason:string,source:unknown)=>{
    const id=stable('doc/'+key),code=`KHO-${kind.slice(0,3)}-IMPORT-${date.replaceAll('-','')}-${id.slice(0,8).toUpperCase()}`;
    await sql.query('INSERT INTO cohamy_crm.inventory_documents(id,code,kind,organization_id,reference_type,reference_id,actor_id,reason,idempotency_key,request_hash,result,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)',[id,code,kind,admin.organizationId,referenceType,referenceId,admin.id,reason,stable('doc-action/'+key),digest(source),JSON.stringify({sourceBatch:batchId,businessDate:date,source}),at(date)]);return id;
   };
   for(const receipt of plan.receipts){const key='factory/'+receipt.date+'/'+receipt.sourceHeader;const doc=await document('RECEIPT',key,receipt.date,'historical-factory-receipt',key,`Nhập nhà máy Jamy Green → kho HCM ngày ${receipt.date}; nguồn Excel ${receipt.sourceHeader}; lô/NSX/HSD chưa được cung cấp.`,{checksum:plan.sourceChecksum,sourceHeader:receipt.sourceHeader,lines:receipt.lines});for(const line of receipt.lines)if(line.quantity)await movement(doc,hcm.id,hcmLocation,line.productId,line.quantity,key+'/'+line.sourceRow);}
   const policy=(await sql.query<{id:string;number:number;definition:SalesSnapshot['orderPolicy']['definition'];checksum:string}>('SELECT id,number,definition,checksum FROM cohamy_crm.order_policies ORDER BY number DESC LIMIT 1')).rows[0];assert.ok(policy);
   const bookId=stable('historical-price-book');await sql.query("INSERT INTO cohamy_crm.price_books(id,name,status,created_by) VALUES($1,'Giá chứng từ lịch sử HCM 2026 — chỉ đối chiếu','WITHDRAWN',$2)",[bookId,admin.id]);
   let priceNumber=0;const orderIds=[];
   for(const invoice of invoiceRows){
    const s=invoice.snapshot,date=s.date,sourceKey=invoice.id,customerCode='OLD-HCM-'+s.buyerTaxId.replaceAll('-','');
    const matches=(await sql.query<{id:string;code:string;name:string;phone:string;email:string;address:string;business_id:string}>('SELECT id,code,name,phone,email,address,business_id FROM cohamy_crm.organizations WHERE business_id=$1 AND merged_into_id IS NULL AND kind IN(\'DEALER\',\'CUSTOMER\')',[s.buyerTaxId])).rows;assert.ok(matches.length<=1,'AMBIGUOUS_CUSTOMER');let org=matches[0];
    if(!org){org={id:stable('customer/'+s.buyerTaxId),code:customerCode,name:s.buyerName,phone:'',email:'',address:s.buyerAddress,business_id:s.buyerTaxId};await sql.query("INSERT INTO cohamy_crm.organizations(id,code,name,kind,address,business_id,contact_name,region,source) VALUES($1,$2,$3,'CUSTOMER',$4,$5,$6,'SOUTH','Hóa đơn cũ HCM 2026')",[org.id,org.code,org.name,org.address,org.business_id,s.buyerContact]);}
    const orderId=stable('order/'+sourceKey),requestId=stable('request/'+sourceKey),requestVersionId=stable('request-version/'+sourceKey),versionId=stable('order-version/'+sourceKey),priceVersionId=stable('price-version/'+sourceKey),orderCode=`OLD-HCM-${s.series}-${s.number}`,requestCode=`YC-${orderCode}`;
    const reason=`Đối chiếu hóa đơn cũ ${s.series}/${s.number} đã thanh toán; nhập lại đơn và xuất kho HCM một lần. Không tạo giao dịch thu tiền mới.`,terms='Giá và thuế giữ nguyên từ hóa đơn cũ đã chốt; không áp dụng cho đơn mới.';
    const prices=s.lines.map(l=>({sku:plan.products[productKey(l.name)].sku,unitPrice:String(l.unitPrice),thresholds:[]}));
    const definition=priceDefinitionSchema.parse({audience:'ORGANIZATION',tierId:null,organizationId:org.id,priority:0,startsAt:at(date),endsAt:null,quantityBasis:'LINE',rounding:'HALF_UP',taxBasis:'ORDER',taxBasisPoints:s.vatRatePercent*100,feeAmount:'0',maxSalesDiscountBasisPoints:0,minimum:{amount:'0',cases:0,skus:[]},deliveryTerms:terms,quoteValidityHours:1,approval:{nonSelfApproval:false,orderAmountThreshold:null,creditTerms:false},lines:prices,gifts:[]});
    await sql.query('INSERT INTO cohamy_crm.price_book_versions(id,book_id,number,definition,checksum,actor_id,idempotency_key,request_hash) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,$8)',[priceVersionId,bookId,++priceNumber,JSON.stringify(definition),digest(definition),admin.id,stable('price-action/'+sourceKey),digest(s)]);
    let allocatedTax=0;const lines:PricedLine[]=s.lines.map((line,index)=>{const p=products.find(p=>p.id===plan.products[productKey(line.name)].id)!;const tax=index===s.lines.length-1?s.vatAmount-allocatedTax:Math.floor(s.vatAmount*line.amount/s.subtotal);allocatedTax+=tax;return {sku:p.sku,productId:p.id,name:line.name,stockUnit:'Gói',productVersion:p.version??1,unitCode:'BASE',unitLabel:'Gói',unitVersion:1,unitNumerator:'1',unitDenominator:'1',quantity:String(line.quantity),baseQuantity:String(line.quantity),unitPrice:String(line.unitPrice),regularUnitPrice:String(line.unitPrice),listUnitPrice:String(line.unitPrice),gross:String(line.amount),discount:'0',net:String(line.amount),tax:String(tax),total:String(line.amount+tax),gift:false,giftRule:null};});
    const calculation:PriceCalculation={lines,subtotal:String(s.subtotal),discount:'0',tax:String(s.vatAmount),fee:'0',total:String(s.total),caseCount:'0',approvalRequired:false,approvalReasons:[],minimumShortfalls:[],rounding:'HALF_UP',deliveryTerms:terms};
    const quote:QuotationSnapshot={organization:{id:org.id,code:org.code,name:org.name,phone:org.phone,email:org.email,address:org.address,businessId:org.business_id},delivery:{recipient:s.buyerContact||s.buyerName,phone:org.phone,address:s.buyerAddress},basket:{lines:lines.map(l=>({sku:l.sku,unitCode:'BASE',quantity:l.quantity})),discountBasisPoints:0,creditTerms:false},calculation,priceBook:{id:bookId,name:'Giá chứng từ lịch sử HCM 2026 — chỉ đối chiếu',versionId:priceVersionId,number:priceNumber,checksum:digest(definition)},policy:definition,note:reason,currency:'VND',issuedAt:at(date),validUntil:at(date)};
    await sql.query("INSERT INTO cohamy_crm.commercial_requests(id,code,organization_id,creator_id,creator_membership_id,creator_area,creator_role,channel,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'crm','ADMIN','EXCEL','SUBMITTED',$6,$6)",[requestId,requestCode,org.id,admin.id,admin.membershipId,at(date)]);
    await sql.query('INSERT INTO cohamy_crm.commercial_request_versions(id,request_id,number,snapshot,checksum,actor_id,idempotency_key,request_hash,created_at) VALUES($1,$2,1,$3::jsonb,$4,$5,$6,$7,$8)',[requestVersionId,requestId,JSON.stringify(quote),digest(quote),admin.id,stable('request-action/'+sourceKey),digest(s),at(date)]);
    await sql.query('UPDATE cohamy_crm.commercial_requests SET latest_version_id=$1 WHERE id=$2',[requestVersionId,requestId]);
    const snapshot:SalesSnapshot&{historicalSource:unknown}={quote,request:{id:requestId,code:requestCode,versionId:requestVersionId,creatorId:admin.id,channel:'EXCEL',sourceWebsiteId:null,sourceQuotationId:null,sourceOrderId:null},orderPolicy:policy,approvalReasons:[],issuedAt:at(date),historicalSource:{invoiceId:invoice.id,snapshotChecksum:invoice.snapshot_checksum,sourceChecksum:invoice.source_checksum,paymentConfirmation:s.paymentConfirmation,sourceBatch:batchId,approvalAuthority:'USER_AUTHORIZED_HISTORICAL_RECONCILIATION',recordedAt:new Date().toISOString()}};
    await sql.query("INSERT INTO cohamy_crm.sales_orders(id,code,organization_id,request_id,creator_id,status,delivery_status,payment_status,seller_organization_id,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'CONFIRMED','DELIVERED','PAID',$6,$7,$7)",[orderId,orderCode,org.id,requestId,admin.id,admin.organizationId,at(date)]);
    await sql.query('INSERT INTO cohamy_crm.sales_order_versions(id,order_id,number,request_version_id,order_policy_id,snapshot,checksum,approval_required,actor_id,created_at) VALUES($1,$2,1,$3,$4,$5::jsonb,$6,false,$7,$8)',[versionId,orderId,requestVersionId,policy.id,JSON.stringify(snapshot),digest(snapshot),admin.id,at(date)]);
    await sql.query('UPDATE cohamy_crm.sales_orders SET latest_version_id=$1,confirmed_version_id=$1 WHERE id=$2',[versionId,orderId]);
    const issueId=await document('ISSUE','sale/'+sourceKey,date,'sales-order',orderId,reason,{invoiceId:invoice.id,snapshotChecksum:invoice.snapshot_checksum});
    const deliveryId=stable('delivery/'+sourceKey);
    await sql.query("INSERT INTO cohamy_crm.deliveries(id,code,order_id,status,requirements,actor_id) VALUES($1,$2,$3,'DELIVERED',$4,$5)",[deliveryId,'GH-'+orderCode,orderId,'Đối chiếu hàng đã xuất theo hóa đơn lịch sử; không tạo lịch giao mới. Chưa có ngày giao thực tế riêng ngoài ngày hóa đơn.',admin.id]);
    for(const [index,line] of lines.entries()){const quantity=Number(line.baseQuantity),reservationId=stable('reservation/'+sourceKey+'/'+index);await movement(issueId,hcm.id,hcmLocation,line.productId,-quantity,'sale/'+sourceKey+'/'+index,orderId);await sql.query("INSERT INTO cohamy_crm.inventory_reservations(id,order_id,order_version_id,warehouse_id,location_id,product_id,lot_id,quantity,consumed,status,request_id,request_version_id,reservation_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,'CONSUMED',$9,$10,'CONFIRMED')",[reservationId,orderId,versionId,hcm.id,hcmLocation,line.productId,lotIds.get(line.productId),quantity,requestId,requestVersionId]);await sql.query("INSERT INTO cohamy_crm.inventory_reservation_events(id,reservation_id,action,quantity,actor_id,reason,idempotency_key,request_hash,result) VALUES($1,$2,'CONSUMED',$3,$4,$5,$6,$7,$8::jsonb)",[stable('reservation-event/'+sourceKey+'/'+index),reservationId,quantity,admin.id,reason,stable('reservation-action/'+sourceKey+'/'+index),digest(line),JSON.stringify({historical:true,invoiceId:invoice.id})]);}
    const receivableId=stable('receivable/'+sourceKey);await sql.query("INSERT INTO cohamy_crm.receivables(id,code,organization_id,order_id,source_type,source_id,original_amount,remaining_amount,due_on,terms_snapshot,status,created_at,updated_at) VALUES($1,$2,$3,$4,'historical-invoice',$5,$6,0,$7,$8::jsonb,'PAID',$9,$9)",[receivableId,'CN-'+orderCode,org.id,orderId,invoice.id,s.total,date,JSON.stringify({historical:true,invoiceId:invoice.id,paymentConfirmation:s.paymentConfirmation,createsCashMovement:false}),at(date)]);
    for(const [index,line] of lines.entries())await sql.query('INSERT INTO cohamy_crm.delivery_lines(id,delivery_id,reservation_id,planned,picked,packed,dispatched,delivered) VALUES($1,$2,$3,$4,$4,$4,$4,$4)',[stable('delivery-line/'+sourceKey+'/'+index),deliveryId,stable('reservation/'+sourceKey+'/'+index),line.baseQuantity]);
    await sql.query("INSERT INTO cohamy_crm.receivable_events(id,receivable_id,action,amount,payload,actor_id,reason,idempotency_key,request_hash,result) VALUES($1,$2,'HISTORICAL_PAID_IMPORTED',$3,$4::jsonb,$5,$6,$7,$8,$9::jsonb)",[stable('receivable-event/'+sourceKey),receivableId,s.total,JSON.stringify({invoiceId:invoice.id,paymentConfirmation:s.paymentConfirmation,createsCashMovement:false}),admin.id,reason,stable('receivable-action/'+sourceKey),digest(s),JSON.stringify({remainingAmount:0})]);
    await audit(sql,admin.id,'historical-invoice.reconciled',invoice.id,{sourceBatch:batchId,orderId,inventoryDocumentId:issueId,receivableId,sourceChecksum:invoice.source_checksum,originalSnapshotPreserved:true,createsCashMovement:false});orderIds.push(orderId);
   }
   const transferId=stable('transfer'),transferCode='CK-HCM-HN-20260918-IMPORT',transferLines=[];
   for(const line of plan.transfer.lines){const p=products.find(p=>p.id===line.productId)!;transferLines.push({productId:p.id,lotId:lotIds.get(p.id)!,quantity:String(line.quantity),sourceLocationId:hcmLocation,destinationLocationId:hnLocation,unit:{productId:p.id,sku:p.sku,name:p.name,code:'BASE',stockUnit:'Gói',numerator:'1',denominator:'1'}});}
   const transferSnapshot={lines:transferLines,unclassifiedLines:plan.transfer.unclassifiedLines,sourceChecksum:plan.transfer.sourceChecksum,sourceBatch:batchId,businessDate:plan.transfer.date,classificationAuthority:plan.transfer.classificationAuthority,distinctFromAnnaMartSale:true};
   const transferReason='Chuyển kho HCM → Hà Nội theo ảnh ngày 18/09/2026: 84 gói đã rõ sản phẩm; 8 gói tặng chưa biết sản phẩm, chưa hạch toán vào từng SKU. Lô riêng với đơn bán Anna Mart.';
   await sql.query("INSERT INTO cohamy_crm.inventory_transfers(id,code,source_warehouse_id,destination_warehouse_id,status,snapshot,checksum,actor_id,reason,idempotency_key,request_hash,result,created_at,updated_at) VALUES($1,$2,$3,$4,'PARTIAL',$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12,$12)",[transferId,transferCode,hcm.id,hn.id,JSON.stringify(transferSnapshot),digest(transferSnapshot),admin.id,transferReason,stable('transfer-action'),sourceDigest,JSON.stringify({id:transferId,code:transferCode,status:'PARTIAL',unclassifiedQuantity:8}),at(plan.transfer.date)]);
   const transferDoc=await document('TRANSFER','transfer-out',plan.transfer.date,'inventory-transfer',transferId,transferReason,transferSnapshot),receiptDoc=await document('TRANSFER','transfer-in',plan.transfer.date,'inventory-transfer',transferId,transferReason,transferSnapshot);
   for(const [index,line] of plan.transfer.lines.entries()){await movement(transferDoc,hcm.id,hcmLocation,line.productId,-line.quantity,'transfer-out/'+index);await movement(receiptDoc,hn.id,hnLocation,line.productId,line.quantity,'transfer-in/'+index);}
   const received=transferLines.map((l,index)=>({index,quantity:l.quantity,shortage:'0'}));await sql.query('INSERT INTO cohamy_crm.inventory_transfer_receipts(id,transfer_id,number,lines,checksum,actor_id,reason,idempotency_key,request_hash,result,created_at) VALUES($1,$2,1,$3::jsonb,$4,$5,$6,$7,$8,$9::jsonb,$10)',[stable('transfer-receipt'),transferId,JSON.stringify(received),digest(received),admin.id,transferReason,stable('transfer-receipt-action'),sourceDigest,JSON.stringify({status:'PARTIAL',unclassifiedQuantity:8}),at(plan.transfer.date)]);
   const after=(await sql.query<{product_id:string;qty:string}>('SELECT product_id,sum(on_hand)::text AS qty FROM cohamy_crm.inventory_balances WHERE warehouse_id=$1 GROUP BY product_id',[hcm.id])).rows;for(const row of summary)assert.equal(Number(after.find(a=>a.product_id===row.productId)?.qty??0),row.closingHCMKnown);
   assert.equal((await sql.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.document_mail_outbox')).rows[0].n,beforeMail,'IMPORT_MUST_NOT_QUEUE_EMAIL');
   const finalRows=await rowManifest(sql);for(const [table,hashes] of originalRows)for(const hash of hashes)assert.ok(finalRows.get(table)?.has(hash),'EXISTING_ROW_CHANGED_ABORTING_IMPORT '+table);
   await audit(sql,admin.id,'historical-stock.reconciled',batchId,{checksum:sourceDigest,reviewedPreviewChecksum:checksum,result:{...result,orderIds,transferId},sourceFileChecksum:plan.sourceChecksum,transferImageChecksum:plan.transfer.sourceChecksum,originalHistoricalInvoicesPreserved:true,noCashMovement:true,noEmail:true,unknownLotDatesNotInvented:true});
   return {mode:'APPLIED',checksum,sourceDigest,result:{...result,orderIds,transferId}};
  });
  await fs.mkdir(path.dirname(reportPath),{recursive:true});await fs.writeFile(reportPath,JSON.stringify({environment:process.env.CRM_ENVIRONMENT,testedAt:new Date().toISOString(),...report},null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({environment:process.env.CRM_ENVIRONMENT,mode:report.mode,checksum:'checksum' in report?report.checksum:undefined,reportPath}));
 }finally{await db.close();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'HISTORICAL_RECONCILIATION_FAILED');process.exitCode=1;});
