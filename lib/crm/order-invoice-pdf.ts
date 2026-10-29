import 'server-only';
import {database} from './db';
import {assertCurrentPrincipal,audit} from './auth';
import {CrmError} from './permissions';
import {pricingOrganization,calculateForOrganization} from './pricing';
import {commercialRequestAccess,requestVersionAccess} from './order-requests';
import {salesOrderAccess,salesVersionAccess} from './sales-orders';
import {parseCommercial as parse,vietnamBusinessDate} from './commercial-common';
import {buildOrderInvoicePayload,orderInvoicePayloadSchema,draftInvoicePreviewSchema,type OrderInvoicePayload} from './order-invoice-model';
import {invoiceTaxCode} from './order-invoice-pricing';
import {renderOrderInvoicePdf} from './order-invoice-renderer';
import type {Principal} from './types';
export {renderOrderInvoicePdf} from './order-invoice-renderer';
export async function getOrderInvoicePayloadForRequest(
 user:Principal,
 requestId:string,
 versionId?:string,
 expectedDeliveryDate?:string
):Promise<OrderInvoicePayload>{
 return (await database()).transaction(async tx=>{
  await assertCurrentPrincipal(tx,user);
  const head=await commercialRequestAccess(tx,user,requestId);
  const targetVersionId=versionId||head.latest_version_id;
  const v=await requestVersionAccess(tx,head,targetVersionId);
  if('buyerOrderId' in v.snapshot)throw new CrmError('BUYER_ORDER_USE_BUYER_WORKFLOW',409);
  let sellerName='CÔNG TY TNHH COHAMY';
  if(head.seller_organization_id){
   const sellerRow=(await tx.query<{name:string;kind:string}>('SELECT name,kind FROM cohamy_crm.organizations WHERE id=$1',[head.seller_organization_id])).rows[0];
   if(sellerRow&&sellerRow.kind!=='COHAMY')sellerName=sellerRow.name;
  }
  return buildOrderInvoicePayload({
   snapshot:v.snapshot,
   source:{kind:'REQUEST',id:head.id,versionId:v.id},
   requestCode:head.code,
   sellerName,
   expectedDeliveryDate,
   managerRepresentative:user.displayName||'',
  });
 });
}

export async function getOrderInvoicePayloadForSalesOrder(
 user:Principal,
 orderId:string,
 versionId?:string,
 expectedDeliveryDate?:string
):Promise<OrderInvoicePayload>{
 return (await database()).transaction(async tx=>{
  await assertCurrentPrincipal(tx,user);
  const head=await salesOrderAccess(tx,user,orderId);
  const targetVersionId=versionId||head.confirmed_version_id||head.latest_version_id;
  const v=await salesVersionAccess(tx,head,targetVersionId);
  const extra=(await tx.query<{invoice_recipient:{kind?:string;companyName?:string;taxCode?:string;address?:string;email?:string}|null}>('SELECT invoice_recipient FROM cohamy_crm.sales_orders WHERE id=$1',[head.id])).rows[0];
  let sellerName='CÔNG TY TNHH COHAMY';
  if(head.seller_organization_id){
   const sellerRow=(await tx.query<{name:string;kind:string}>('SELECT name,kind FROM cohamy_crm.organizations WHERE id=$1',[head.seller_organization_id])).rows[0];
   if(sellerRow&&sellerRow.kind!=='COHAMY')sellerName=sellerRow.name;
  }
  return buildOrderInvoicePayload({
   snapshot:v.snapshot.quote,
   source:{kind:'ORDER',id:head.id,versionId:v.id},
   requestCode:v.snapshot.request.code||head.code,
   invoiceCode:head.code.replace(/^DH-/,'HD-'),
   sellerName,
   expectedDeliveryDate,
   invoiceRecipient:extra?.invoice_recipient??null,
   managerRepresentative:user.displayName||'',
  });
 });
}

export async function generateCustomInvoicePdf(user:Principal,rawInput:unknown):Promise<{bytes:Buffer;filename:string}>{
 const incoming=parse(orderInvoicePayloadSchema,rawInput);
 if(!incoming.source)throw new CrmError('INVOICE_SOURCE_REQUIRED',400);
 const source=incoming.source;
 const canonical=source.kind==='REQUEST'?await getOrderInvoicePayloadForRequest(user,source.id,source.versionId):source.kind==='ORDER'?await getOrderInvoicePayloadForSalesOrder(user,source.id,source.versionId):await previewDraftInvoicePayload(user,source.input);
 const expected=parse(orderInvoicePayloadSchema,canonical);
 if(JSON.stringify(incoming.lines)!==JSON.stringify(expected.lines)||JSON.stringify(incoming.summary)!==JSON.stringify(expected.summary)||incoming.requestCode!==expected.requestCode)throw new CrmError('INVOICE_PRICING_CHANGED',409);
 const payload={...expected,invoiceCode:incoming.invoiceCode,buyer:{...incoming.buyer,taxCode:invoiceTaxCode(incoming.buyer.taxCode)},delivery:incoming.delivery,signatures:incoming.signatures};
 const db=await database();
 await db.transaction(async tx=>{
  await assertCurrentPrincipal(tx,user);
  await audit(tx,user.id,'commerce.invoice-pdf-generated',payload.invoiceCode,{
   after:{invoiceCode:payload.invoiceCode,requestCode:payload.requestCode,totalPayable:payload.summary.totalPayable},
   reason:'Xuất hóa đơn đặt hàng PDF từ bản xem trước.',
  });
 });
 const bytes=await renderOrderInvoicePdf(payload);
 const safeCode=payload.invoiceCode.replace(/[^A-Za-z0-9_-]/g,'-')||'Hoa-don-Cohamy';
 return {bytes,filename:`${safeCode}.pdf`};
}

export async function downloadOrderInvoicePdf(
 user:Principal,
 params:{requestId?:string;orderId?:string;versionId?:string;expectedDeliveryDate?:string}
):Promise<{bytes:Buffer;filename:string}>{
 const payload=params.orderId
  ?await getOrderInvoicePayloadForSalesOrder(user,params.orderId,params.versionId,params.expectedDeliveryDate)
  :await getOrderInvoicePayloadForRequest(user,params.requestId||'',params.versionId,params.expectedDeliveryDate);
 const bytes=await renderOrderInvoicePdf(payload);
 const safeCode=payload.invoiceCode.replace(/[^A-Za-z0-9_-]/g,'-')||'Hoa-don-Cohamy';
 return {bytes,filename:`${safeCode}.pdf`};
}

export async function previewDraftInvoicePayload(user:Principal,rawInput:unknown):Promise<OrderInvoicePayload>{
 const d=parse(draftInvoicePreviewSchema,rawInput);
 return (await database()).transaction(async tx=>{
  await assertCurrentPrincipal(tx,user);
  const org=await pricingOrganization(tx,user,d.organizationId);
  const price=await calculateForOrganization(tx,user,org.id,d.basket);
  const now=new Date((await tx.query<{now:string}>('SELECT now() AS now')).rows[0].now);
  const validUntil=new Date(now.getTime()+price.priceVersion.definition.quoteValidityHours*3600000).toISOString();
  const datePart=vietnamBusinessDate(now);
  const reqCode=d.requestCode?.trim()||`YC-${datePart}-NHAP`;
  const invCode=d.invoiceCode?.trim()||reqCode.replace(/^(YC|DH)-/,'HD-');
  return buildOrderInvoicePayload({
   source:{kind:'DRAFT',input:d},
   snapshot:{
    organization:{
     id:org.id,
     code:org.code,
     name:org.name,
     phone:org.phone,
     email:org.email,
     businessId:org.business_id??'',
     address:org.address,
    },
    delivery:{
     recipient:d.delivery.recipient||org.contact_name||org.name,
     phone:d.delivery.phone||org.phone,
     address:d.delivery.address||org.address,
    },
    basket:d.basket,
    calculation:price.calculation,
    priceBook:{
     id:price.book.id,
     name:price.book.name,
     versionId:price.priceVersion.id,
     number:price.priceVersion.number,
     checksum:price.priceVersion.checksum,
    },
    policy:price.priceVersion.definition,
    note:d.note,
    currency:'VND',
    issuedAt:now.toISOString(),
    validUntil,
   },
   requestCode:reqCode,
   invoiceCode:invCode,
   expectedDeliveryDate:d.delivery.expectedDeliveryDate,
   managerRepresentative:user.displayName||'',
  });
 });
}
