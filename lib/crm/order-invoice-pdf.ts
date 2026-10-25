import 'server-only';
import path from 'node:path';
import fs from 'node:fs/promises';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { z } from 'zod';
import {database} from './db';
import {assertCurrentPrincipal,audit} from './auth';
import {CrmError} from './permissions';
import {pricingOrganization,calculateForOrganization} from './pricing';
import {basketSchema} from './pricing-model';
import {commercialRequestAccess,requestVersionAccess} from './order-requests';
import {salesOrderAccess,salesVersionAccess} from './sales-orders';
import {parseCommercial as parse,vietnamBusinessDate} from './commercial-common';
import {
 buildOrderInvoicePayload,
 orderInvoicePayloadSchema,
 resolveInvoiceProductImage,
 vndToVietnameseWords,
 type OrderInvoicePayload,
} from './order-invoice-model';
import type {Principal} from './types';

const NAVY='#172b43';
const ORANGE='#b9420c';
const MUTED='#46566a';
const DARK='#1e293b';
const BORDER='#cbd4df';
const BG_LIGHT='#f8fafc';
const BG_HEADER='#edf1f5';

function formatVnd(value:string):string{
 const clean=String(value??'0').replace(/[^0-9-]/g,'');
 if(!clean)return '0';
 try{
  return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(BigInt(clean));
 }catch{
  return value;
 }
}

function formatVietnameseDateParts(isoOrText:string):{day:string;month:string;year:string;time:string}{
 const d=new Date(isoOrText);
 if(Number.isNaN(d.getTime())){
  const now=new Date();
  return formatVietnameseDateParts(now.toISOString());
 }
 const parts=new Intl.DateTimeFormat('vi-VN',{
  timeZone:'Asia/Ho_Chi_Minh',
  day:'2-digit',
  month:'2-digit',
  year:'numeric',
  hour:'2-digit',
  minute:'2-digit',
  hour12:false,
 }).formatToParts(d);
 const get=(t:string)=>parts.find(p=>p.type===t)?.value??'';
 return {
  day:get('day')||'01',
  month:get('month')||'01',
  year:get('year')||'2026',
  time:`${get('hour')||'00'}:${get('minute')||'00'}`,
 };
}

async function loadProductThumbnailPng(imagePath?:string):Promise<Buffer|null>{
 const rel=(imagePath||'/images/logo/cohamy-c-gold.png').replace(/^\/+/,'');
 const resolved=path.resolve(process.cwd(),'public',rel);
 const publicRoot=path.resolve(process.cwd(),'public');
 if(!resolved.startsWith(publicRoot))return null;
 try{
  const raw=await fs.readFile(resolved);
  return await sharp(raw).resize(96,96,{fit:'contain',background:{r:255,g:255,b:255,alpha:1}}).png().toBuffer();
 }catch{
  return null;
 }
}

export async function renderOrderInvoicePdf(payload:OrderInvoicePayload):Promise<Buffer>{
 const [regular,bold,logo]=await Promise.all([
  fs.readFile(path.join(process.cwd(),'assets/crm/fonts/BeVietnamPro-Regular.ttf')),
  fs.readFile(path.join(process.cwd(),'assets/crm/fonts/BeVietnamPro-SemiBold.ttf')),
  fs.readFile(path.join(process.cwd(),'public/images/logo/cohamy-brand-logo.png')),
 ]);

 const thumbCache=new Map<string,Buffer|null>();
 for(const line of payload.lines){
  const key=line.imagePath||resolveInvoiceProductImage(line.sku);
  if(!thumbCache.has(key)){
   thumbCache.set(key,await loadProductThumbnailPng(key));
  }
 }

 const doc=new PDFDocument({
  size:'A4',
  margins:{top:36,bottom:40,left:44,right:44},
  bufferPages:true,
  info:{
   Title:`Hóa đơn đặt hàng ${payload.invoiceCode}`,
   Author:'CÔNG TY TNHH COHAMY',
   Subject:`Hóa đơn đặt hàng ${payload.requestCode}`,
  },
 });

 const chunks:Buffer[]=[];
 const result=new Promise<Buffer>((resolve,reject)=>{
  doc.on('data',b=>chunks.push(Buffer.from(b)));
  doc.on('error',reject);
  doc.on('end',()=>resolve(Buffer.concat(chunks)));
 });

 doc.registerFont('Body',regular).registerFont('Strong',bold);
 const left=44;
 const width=507;
 const bottom=doc.page.height-48;
 let y=36;

 const ensureSpace=(needed:number)=>{
  if(y+needed>bottom){
   doc.addPage();
   y=36;
   return true;
  }
  return false;
 };

 // 1. HEADER TABLE: Logo (left) & Company Info (right)
 const logoColW=132;
 const infoColW=width-logoColW;
 const headerH=76;
 doc.rect(left,y,logoColW,headerH).fill(NAVY);
 doc.rect(left+logoColW,y,infoColW,headerH).fill(BG_LIGHT);
 doc.rect(left,y,width,headerH).lineWidth(1).stroke(NAVY);
 doc.image(logo,left+14,y+18,{fit:[logoColW-28,40]});

 const infoX=left+logoColW+12;
 const infoW=infoColW-20;
 doc.font('Strong').fontSize(11).fillColor(NAVY).text(
  payload.sellerName&&payload.sellerName!=='CÔNG TY TNHH COHAMY'
   ?`CÔNG TY TNHH COHAMY (${payload.sellerName})`
   :'CÔNG TY TNHH COHAMY',
  infoX,
  y+9,
  {width:infoW}
 );
 doc.font('Body').fontSize(8.2).fillColor(DARK).text(
  'Trụ sở Hà Nội: Tầng 3, tháp A, Tòa T608, Phường Nghĩa Đô, TP. Hà Nội\n'
  +'VP TP.HCM: Tổ 7, Cầu Mới, P. Tân Thành, TP Hồ Chí Minh\n'
  +'Điện thoại: 0981 956 111   |   Email: Cohamyvietnam@gmail.com',
  infoX,
  y+26,
  {width:infoW,lineGap:2.5}
 );
 y+=headerH+8;

 // 2. INVOICE TITLE & META BOX
 const titleColW=315;
 const metaColW=width-titleColW;
 const titleBoxH=58;
 doc.rect(left,y,width,titleBoxH).lineWidth(0.6).stroke(BORDER);
 doc.moveTo(left+titleColW,y).lineTo(left+titleColW,y+titleBoxH).lineWidth(0.6).stroke(BORDER);

 const dt=formatVietnameseDateParts(payload.issuedAt);
 doc.font('Strong').fontSize(13.5).fillColor(NAVY).text('HÓA ĐƠN ĐẶT HÀNG',left+10,y+7,{width:titleColW-20});
 doc.font('Body').fontSize(8.2).fillColor(MUTED).text(
  '(Kiêm Phiếu xác nhận yêu cầu đặt hàng & đối chiếu thanh toán)',
  left+10,
  y+25,
  {width:titleColW-20}
 );
 doc.font('Body').fontSize(8.5).fillColor(DARK).text(
  `Ngày lập: Ngày ${dt.day} tháng ${dt.month} năm ${dt.year} (${dt.time})`,
  left+10,
  y+39,
  {width:titleColW-20}
 );

 const metaX=left+titleColW+10;
 doc.font('Strong').fontSize(8.8).fillColor(DARK).text('Số hóa đơn: ',metaX,y+12,{continued:true,width:metaColW-16});
 doc.font('Strong').fontSize(9.2).fillColor(ORANGE).text(payload.invoiceCode);
 doc.font('Strong').fontSize(8.8).fillColor(DARK).text('Mã YC đặt hàng: ',metaX,y+31,{continued:true,width:metaColW-16});
 doc.font('Body').fontSize(8.8).fillColor(DARK).text(payload.requestCode);
 y+=titleBoxH+8;

 // 3. SECTION I & II: BUYER & DELIVERY INFORMATION (2 Columns)
 const halfW=width/2;
 const secHeaderH=22;
 doc.rect(left,y,width,secHeaderH).fill(BG_HEADER);
 doc.rect(left,y,width,secHeaderH).lineWidth(0.6).stroke(BORDER);
 doc.moveTo(left+halfW,y).lineTo(left+halfW,y+secHeaderH).lineWidth(0.6).stroke(BORDER);
 doc.font('Strong').fontSize(8.5).fillColor(NAVY).text('I. THÔNG TIN ĐƠN VỊ MUA & XUẤT HÓA ĐƠN',left+8,y+6,{width:halfW-16});
 doc.font('Strong').fontSize(8.5).fillColor(NAVY).text('II. THÔNG TIN NHẬN HÀNG & THANH TOÁN',left+halfW+8,y+6,{width:halfW-16});
 y+=secHeaderH;

 const buyerText=[
  `Đơn vị đặt mua: ${payload.buyer.partnerName}${payload.buyer.partnerCode&&payload.buyer.partnerCode!=='—'?` (Mã: ${payload.buyer.partnerCode})`:''}`,
  `Đơn vị ghi trên HĐ: ${payload.buyer.invoiceCompanyName||'—'}`,
  `Mã số thuế / ĐKKD: ${payload.buyer.taxCode||'—'}`,
  `Địa chỉ xuất HĐ: ${payload.buyer.invoiceAddress||'—'}`,
  `Điện thoại / Email: ${payload.buyer.phone||'—'}  |  ${payload.buyer.email||'—'}`,
 ].join('\n');

 const shipText=[
  `Người nhận hàng: ${payload.delivery.recipient||'—'}`,
  `SĐT người nhận: ${payload.delivery.phone||'—'}`,
  `Địa chỉ giao hàng: ${payload.delivery.address||'—'}`,
  `Ngày dự kiến nhận hàng: ${payload.delivery.expectedDeliveryDate||'................................................'}`,
 ].join('\n');

 doc.font('Body').fontSize(8.4);
 const buyerH=doc.heightOfString(buyerText,{width:halfW-16,lineGap:2.8});
 const shipH=doc.heightOfString(shipText,{width:halfW-16,lineGap:2.8});
 const partyBodyH=Math.max(buyerH,shipH)+14;

 doc.rect(left,y,width,partyBodyH).lineWidth(0.6).stroke(BORDER);
 doc.moveTo(left+halfW,y).lineTo(left+halfW,y+partyBodyH).lineWidth(0.6).stroke(BORDER);
 doc.font('Body').fontSize(8.4).fillColor(DARK).text(buyerText,left+8,y+7,{width:halfW-16,lineGap:2.8});
 doc.font('Body').fontSize(8.4).fillColor(DARK).text(shipText,left+halfW+8,y+7,{width:halfW-16,lineGap:2.8});
 y+=partyBodyH+10;

 // 4. SECTION III: PRODUCT LINES TABLE (8 Columns with PNG thumbnail, no Tax column)
 doc.font('Strong').fontSize(9.2).fillColor(NAVY).text('III. CHI TIẾT HÀNG HÓA ĐẶT MUA',left,y,{width});
 y+=15;

 const cols=[
  {label:'STT',w:26,align:'center' as const},
  {label:'PNG',w:44,align:'center' as const},
  {label:'Tên hàng hóa / Quy cách',w:158,align:'left' as const},
  {label:'ĐVT',w:40,align:'center' as const},
  {label:'Số lượng',w:44,align:'right' as const},
  {label:'Đơn giá gốc',w:60,align:'right' as const},
  {label:'Đơn giá sau KM/CK',w:66,align:'right' as const},
  {label:'Thành tiền (VND)',w:69,align:'right' as const},
 ];

 const drawTableHeader=()=>{
  const thH=24;
  doc.rect(left,y,width,thH).fill(NAVY);
  let cx=left;
  for(const col of cols){
   doc.font('Strong').fontSize(7.8).fillColor('#ffffff').text(col.label,cx+3,y+7,{
    width:col.w-6,
    align:'center',
   });
   cx+=col.w;
  }
  y+=thH;
 };

 ensureSpace(64);
 drawTableHeader();

 for(let idx=0;idx<payload.lines.length;idx++){
  const l=payload.lines[idx];
  const nameCellText=`${l.name}\n${l.conversionNote}`;
  const appliedCellText=l.discountNote?`${formatVnd(l.appliedUnitPrice)}\n${l.discountNote}`:formatVnd(l.appliedUnitPrice);
  doc.font('Strong').fontSize(8.2);
  const nameH=doc.heightOfString(l.name,{width:cols[2].w-10,lineGap:2});
  doc.font('Body').fontSize(7.6);
  const convH=doc.heightOfString(l.conversionNote,{width:cols[2].w-10,lineGap:2});
  const appliedH=doc.heightOfString(appliedCellText,{width:cols[6].w-8,lineGap:2});
  const rowH=Math.max(40,nameH+convH+12,appliedH+12);

  if(ensureSpace(rowH+6)){
   drawTableHeader();
  }

  if(idx%2===1){
   doc.rect(left,y,width,rowH).fill(BG_LIGHT);
  }
  doc.rect(left,y,width,rowH).lineWidth(0.5).stroke(BORDER);

  let cx=left;
  for(let cIdx=0;cIdx<cols.length;cIdx++){
   const col=cols[cIdx];
   if(cIdx>0){
    doc.moveTo(cx,y).lineTo(cx,y+rowH).lineWidth(0.4).stroke(BORDER);
   }
   if(cIdx===0){
    doc.font('Body').fontSize(8.2).fillColor(DARK).text(String(idx+1),cx+3,y+12,{width:col.w-6,align:'center'});
   }else if(cIdx===1){
    const imgKey=l.imagePath||resolveInvoiceProductImage(l.sku);
    const pngBuf=thumbCache.get(imgKey);
    if(pngBuf){
     try{
      doc.image(pngBuf,cx+6,y+4,{fit:[col.w-12,rowH-8],align:'center',valign:'center'});
     }catch{
      doc.font('Body').fontSize(7).fillColor(MUTED).text('SP',cx+3,y+14,{width:col.w-6,align:'center'});
     }
    }else{
     doc.font('Body').fontSize(7).fillColor(MUTED).text('SP',cx+3,y+14,{width:col.w-6,align:'center'});
    }
   }else if(cIdx===2){
    doc.font('Strong').fontSize(8.2).fillColor(DARK).text(l.name,cx+5,y+6,{width:col.w-10,lineGap:1.5});
    doc.font('Body').fontSize(7.5).fillColor(l.gift?ORANGE:MUTED).text(l.conversionNote,cx+5,doc.y+1,{width:col.w-10,lineGap:1.5});
   }else if(cIdx===3){
    doc.font('Body').fontSize(8.2).fillColor(DARK).text(l.unitLabel,cx+3,y+12,{width:col.w-6,align:'center'});
   }else if(cIdx===4){
    doc.font('Strong').fontSize(8.4).fillColor(DARK).text(l.quantity,cx+4,y+12,{width:col.w-8,align:'right'});
   }else if(cIdx===5){
    doc.font('Body').fontSize(8.2).fillColor(DARK).text(formatVnd(l.listUnitPrice),cx+4,y+12,{width:col.w-8,align:'right'});
   }else if(cIdx===6){
    doc.font('Strong').fontSize(8.2).fillColor(DARK).text(formatVnd(l.appliedUnitPrice),cx+4,y+7,{width:col.w-8,align:'right'});
    if(l.discountNote){
     doc.font('Body').fontSize(7.2).fillColor(ORANGE).text(l.discountNote,cx+4,doc.y+1,{width:col.w-8,align:'right'});
    }
   }else if(cIdx===7){
    doc.font('Strong').fontSize(8.5).fillColor(DARK).text(formatVnd(l.lineTotal),cx+4,y+12,{width:col.w-8,align:'right'});
   }
   cx+=col.w;
   void nameCellText;
  }
  y+=rowH;
 }

 y+=6;

 // 5. TOTALS SUMMARY TABLE
 const summaryRows:[string,string,boolean][]=[
  [
   'Tổng số lượng hàng hóa (quy đổi đơn vị gốc):',
   `${payload.summary.totalBaseQuantityText} · Số thùng: ${payload.summary.totalCasesText}`,
   false,
  ],
  [
   '1. Tổng tiền hàng theo giá niêm yết (trước KM/CK):',
   `${formatVnd(payload.summary.listSubtotal)} VND`,
   false,
  ],
  [
   '2. Tiền hàng sau khuyến mãi / chiết khấu cấp bậc:',
   `${formatVnd(payload.summary.subtotalAfterTier)} VND`,
   false,
  ],
  [
   `3. Chiết khấu bổ sung trên đơn (${payload.summary.extraDiscountPercent||'0'}%):`,
   `- ${formatVnd(payload.summary.extraDiscountAmount)} VND`,
   false,
  ],
  [
   'TỔNG CỘNG TIỀN THANH TOÁN (2 - 3):',
   `${formatVnd(payload.summary.totalPayable)} VND`,
   true,
  ],
 ];

 ensureSpace(summaryRows.length*22+110);
 const sumLabelW=330;
 const sumValW=width-sumLabelW;

 for(const [label,val,isTotal] of summaryRows){
  const rH=isTotal?24:20;
  if(isTotal){
   doc.rect(left,y,width,rH).fill(BG_HEADER);
  }
  doc.rect(left,y,width,rH).lineWidth(0.5).stroke(BORDER);
  doc.moveTo(left+sumLabelW,y).lineTo(left+sumLabelW,y+rH).lineWidth(0.5).stroke(BORDER);
  doc.font(isTotal?'Strong':'Body').fontSize(isTotal?9.2:8.5).fillColor(isTotal?NAVY:DARK).text(
   label,
   left+8,
   y+(isTotal?6:5),
   {width:sumLabelW-16}
  );
  doc.font(isTotal?'Strong':'Body').fontSize(isTotal?10:8.5).fillColor(isTotal?ORANGE:DARK).text(
   val,
   left+sumLabelW+8,
   y+(isTotal?6:5),
   {width:sumValW-16,align:'right'}
  );
  y+=rH;
 }

 y+=8;
 const wordsText=payload.summary.amountInWords||vndToVietnameseWords(payload.summary.totalPayable);
 doc.font('Strong').fontSize(8.8).fillColor(DARK).text('Số tiền viết bằng chữ: ',left,y,{continued:true,width});
 doc.font('Strong').fontSize(8.8).fillColor(NAVY).text(wordsText);
 y=doc.y+14;

 // 6. SIGNATURES (2 Columns)
 ensureSpace(78);
 doc.font('Strong').fontSize(9).fillColor(NAVY).text('ĐẠI DIỆN BÊN MUA / ĐẠI LÝ',left,y,{width:halfW,align:'center'});
 doc.font('Strong').fontSize(9).fillColor(NAVY).text('ĐẠI DIỆN PHỤ TRÁCH',left+halfW,y,{width:halfW,align:'center'});
 y+=13;
 doc.font('Body').fontSize(8).fillColor(MUTED).text('(Ký, ghi rõ họ tên)',left,y,{width:halfW,align:'center'});
 doc.font('Body').fontSize(8).fillColor(MUTED).text('(Ký, ghi rõ họ tên)',left+halfW,y,{width:halfW,align:'center'});
 y+=44;
 if(payload.signatures.buyerRepresentative){
  doc.font('Strong').fontSize(8.8).fillColor(DARK).text(payload.signatures.buyerRepresentative,left,y,{width:halfW,align:'center'});
 }
 if(payload.signatures.managerRepresentative){
  doc.font('Strong').fontSize(8.8).fillColor(DARK).text(payload.signatures.managerRepresentative,left+halfW,y,{width:halfW,align:'center'});
 }

 // Footer page numbers
 const range=doc.bufferedPageRange();
 for(let i=range.start;i<range.start+range.count;i++){
  doc.switchToPage(i);
  doc.font('Body').fontSize(7.8).fillColor(MUTED)
   .text(`${payload.invoiceCode} · ${payload.requestCode}`,left,doc.page.height-28,{width:0,lineBreak:false})
   .text(`Trang ${i+1} / ${range.count}`,left+width-75,doc.page.height-28,{width:0,lineBreak:false});
 }

 doc.end();
 const bytes=await result;
 if(bytes.length>8388608)throw new CrmError('PDF_TOO_LARGE',400);
 return bytes;
}

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
 const payload=parse(orderInvoicePayloadSchema,rawInput);
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

const draftInvoicePreviewSchema=z.object({
 organizationId:z.uuid(),
 basket:basketSchema,
 delivery:z.object({
  recipient:z.string().trim().max(200).default(''),
  phone:z.string().trim().max(80).default(''),
  address:z.string().trim().max(500).default(''),
  expectedDeliveryDate:z.string().trim().max(120).optional(),
 }),
 note:z.string().trim().max(2000).default(''),
 requestCode:z.string().trim().max(80).optional(),
 invoiceCode:z.string().trim().max(80).optional(),
});

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
