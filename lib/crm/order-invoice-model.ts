import {z} from 'zod';
import type {QuotationSnapshot} from './quotations';

const DIGITS=['không','một','hai','ba','bốn','năm','sáu','bảy','tám','chín'] as const;
const SCALES=['','nghìn','triệu','tỷ','nghìn tỷ','triệu tỷ'] as const;

function readThreeDigits(hundreds:number,tens:number,units:number,showZeroHundred:boolean):string{
 const parts:string[]=[];
 if(hundreds>0||showZeroHundred){
  parts.push(`${DIGITS[hundreds]} trăm`);
 }
 if(tens>1){
  parts.push(`${DIGITS[tens]} mươi`);
  if(units===1)parts.push('mốt');
  else if(units===4)parts.push('tư');
  else if(units===5)parts.push('lăm');
  else if(units>0)parts.push(DIGITS[units]);
 }else if(tens===1){
  parts.push('mười');
  if(units===5)parts.push('lăm');
  else if(units>0)parts.push(DIGITS[units]);
 }else if(tens===0&&units>0){
  if(hundreds>0||showZeroHundred)parts.push('lẻ');
  parts.push(DIGITS[units]);
 }
 return parts.join(' ');
}

export function vndToVietnameseWords(rawAmount:string|number|bigint):string{
 const clean=String(rawAmount??'0').replace(/[^0-9-]/g,'');
 if(!clean||clean==='0'||clean==='-0')return 'Không đồng.';
 const negative=clean.startsWith('-');
 const digits=clean.replace(/^-/,'').replace(/^0+/,'');
 if(!digits)return 'Không đồng.';

 const groups:number[]=[];
 for(let i=digits.length;i>0;i-=3){
  const start=Math.max(0,i-3);
  groups.unshift(Number(digits.slice(start,i)));
 }

 const segments:string[]=[];
 for(let i=0;i<groups.length;i++){
  const value=groups[i];
  if(value===0)continue;
  const hundreds=Math.floor(value/100);
  const tens=Math.floor((value%100)/10);
  const units=value%10;
  const showZeroHundred=i>0;
  const words=readThreeDigits(hundreds,tens,units,showZeroHundred);
  const scaleIdx=groups.length-1-i;
  const scale=SCALES[scaleIdx]??'';
  segments.push(scale?`${words} ${scale}`:words);
 }

 const body=(negative?'Âm ':'')+segments.join(' ').trim();
 const capitalized=body.charAt(0).toUpperCase()+body.slice(1);
 return `${capitalized} đồng chẵn.`;
}

export const orderInvoiceLineSchema=z.object({
 sku:z.string().trim().max(120),
 imagePath:z.string().trim().max(400).optional(),
 name:z.string().trim().min(1).max(300),
 conversionNote:z.string().trim().max(300),
 unitLabel:z.string().trim().min(1).max(80),
 quantity:z.string().trim().min(1).max(60),
 listUnitPrice:z.string().trim().min(1).max(60),
 appliedUnitPrice:z.string().trim().min(1).max(60),
 discountNote:z.string().trim().max(160),
 lineTotal:z.string().trim().min(1).max(60),
 gift:z.boolean().optional(),
});

export const orderInvoicePayloadSchema=z.object({
 invoiceCode:z.string().trim().min(1).max(80),
 requestCode:z.string().trim().min(1).max(80),
 issuedAt:z.string().trim().min(1).max(80),
 sellerName:z.string().trim().min(1).max(200),
 buyer:z.object({
  partnerName:z.string().trim().max(240),
  partnerCode:z.string().trim().max(80),
  invoiceCompanyName:z.string().trim().max(240),
  taxCode:z.string().trim().max(80),
  invoiceAddress:z.string().trim().max(500),
  phone:z.string().trim().max(80),
  email:z.string().trim().max(200),
 }),
 delivery:z.object({
  recipient:z.string().trim().max(200),
  phone:z.string().trim().max(80),
  address:z.string().trim().max(500),
  expectedDeliveryDate:z.string().trim().max(120),
 }),
 lines:z.array(orderInvoiceLineSchema).min(1).max(200),
 summary:z.object({
  totalBaseQuantityText:z.string().trim().max(120),
  totalCasesText:z.string().trim().max(80),
  listSubtotal:z.string().trim().max(60),
  subtotalAfterTier:z.string().trim().max(60),
  extraDiscountPercent:z.string().trim().max(40),
  extraDiscountAmount:z.string().trim().max(60),
  totalPayable:z.string().trim().max(60),
  amountInWords:z.string().trim().max(500),
 }),
 signatures:z.object({
  buyerRepresentative:z.string().trim().max(160),
  managerRepresentative:z.string().trim().max(160),
 }),
});

export type OrderInvoiceLine=z.infer<typeof orderInvoiceLineSchema>;
export type OrderInvoicePayload=z.infer<typeof orderInvoicePayloadSchema>;

const SKU_IMAGE_MAP:Record<string,string>={
 'WEB-cohamy-almond-chocolate':'/images/products/20261009/cohamy-almond-chocolate-80g/01.jpg',
 'WEB-cohamy-almond-durian-chocolate':'/images/products/20261009/cohamy-almond-durian-chocolate-80g/01.jpg',
 'WEB-cohamy-almond-matcha-chocolate':'/images/products/20261009/cohamy-almond-matcha-chocolate-80g/01.jpg',
 'WEB-cohamy-almond-strawberry-chocolate':'/images/products/20261009/cohamy-almond-strawberry-chocolate-80g/01.jpg',
 'WEB-cohamy-cashew-chocolate':'/images/products/20261009/cohamy-cashew-chocolate-80g/01.jpg',
 'WEB-cohamy-rainbow-chocolate':'/images/products/20261009/cohamy-chocolate-candy-65g/01.jpg',
 'WEB-jamy-macadamia-chocolate':'/images/products/20261009/cohamy-macadamia-chocolate-80g/01.jpg',
 'WEB-jamy-mango-dried-chocolate':'/images/products/20261009/cohamy-mango-chocolate-80g/01.jpg',
 'cohamy-almond-chocolate-80g':'/images/products/20261009/cohamy-almond-chocolate-80g/01.jpg',
 'cohamy-almond-durian-chocolate-80g':'/images/products/20261009/cohamy-almond-durian-chocolate-80g/01.jpg',
 'cohamy-almond-matcha-chocolate-80g':'/images/products/20261009/cohamy-almond-matcha-chocolate-80g/01.jpg',
 'cohamy-almond-strawberry-chocolate-80g':'/images/products/20261009/cohamy-almond-strawberry-chocolate-80g/01.jpg',
 'cohamy-cashew-chocolate-80g':'/images/products/20261009/cohamy-cashew-chocolate-80g/01.jpg',
 'cohamy-chocolate-candy-65g':'/images/products/20261009/cohamy-chocolate-candy-65g/01.jpg',
 'cohamy-macadamia-chocolate-80g':'/images/products/20261009/cohamy-macadamia-chocolate-80g/01.jpg',
 'cohamy-mango-chocolate-80g':'/images/products/20261009/cohamy-mango-chocolate-80g/01.jpg',
};

export function resolveInvoiceProductImage(sku:string,fallback?:string):string{
 if(SKU_IMAGE_MAP[sku])return SKU_IMAGE_MAP[sku];
 if(fallback&&!fallback.includes('-55g.')&&!fallback.includes('-150g.')&&!fallback.includes('-160g.'))return fallback;
 return '/images/logo/cohamy-c-gold.png';
}

function formatQtyText(q:string):string{
 const cleaned=q.replace(/\.?0+$/,'');
 return (cleaned||'0').replace('.',',');
}

function formatPercentBp(bp?:number):string{
 if(!bp||bp<=0)return '';
 const pct=bp/100;
 return Number.isInteger(pct)?`${pct}%`:pct.toFixed(2).replace(/\.?0+$/,'').replace('.',',')+'%';
}

export function buildOrderInvoicePayload(input:{
 snapshot:Omit<QuotationSnapshot,'policy'>&{policy?:QuotationSnapshot['policy']};
 requestCode:string;
 invoiceCode?:string;
 sellerName?:string;
 expectedDeliveryDate?:string;
 invoiceRecipient?:{kind?:string;companyName?:string;taxCode?:string;address?:string;email?:string}|null;
 buyerRepresentative?:string;
 managerRepresentative?:string;
 productImagesBySku?:Record<string,string>;
}):OrderInvoicePayload{
 const {snapshot:s,requestCode}=input;
 const derivedInvoiceCode=input.invoiceCode?.trim()||requestCode.replace(/^(YC|DH)-/,'HD-');
 const rec=input.invoiceRecipient;
 const useCompany=rec?.kind==='COMPANY'&&Boolean(rec.companyName);

 const lines:OrderInvoiceLine[]=s.calculation.lines.map(l=>{
  const listPrice=l.gift?'0':(l.listUnitPrice??l.regularUnitPrice??l.unitPrice);
  const appliedPrice=l.gift?'0':l.unitPrice;
  const discountTags:string[]=[];
  if(l.gift){
   discountTags.push('(Hàng tặng)');
  }else{
   if(l.promoPercentBp&&l.promoPercentBp>0)discountTags.push(`-${formatPercentBp(l.promoPercentBp)} KM`);
   if(l.accountPercentBp&&l.accountPercentBp>0)discountTags.push(`-${formatPercentBp(l.accountPercentBp)} CK`);
   if(!discountTags.length&&BigInt(listPrice)>BigInt(appliedPrice)&&BigInt(listPrice)>0n){
    const diffPct=Math.round(Number((BigInt(listPrice)-BigInt(appliedPrice))*10000n/BigInt(listPrice)))/100;
    if(diffPct>0)discountTags.push(`(-${diffPct}%)`);
   }
  }
  const conversionNote=l.gift
   ?`[Hàng tặng KM: ${l.giftRule||'Khuyến mãi đơn hàng'}]`
   :`(Quy đổi: ${formatQtyText(l.baseQuantity)} ${l.stockUnit})`;

  return {
   sku:l.sku,
   imagePath:resolveInvoiceProductImage(l.sku,input.productImagesBySku?.[l.sku]),
   name:l.name,
   conversionNote,
   unitLabel:l.unitLabel,
   quantity:formatQtyText(l.quantity),
   listUnitPrice:listPrice,
   appliedUnitPrice:appliedPrice,
   discountNote:discountTags.length?`(${discountTags.join(' · ').replace(/^\(|\)$/g,'')})`:'',
   lineTotal:l.gift?'0':l.gross,
   gift:l.gift,
  };
 });

 let totalBaseNum=0;
 let stockUnitLabel='đơn vị gốc';
 s.calculation.lines.forEach((l,idx)=>{
  if(idx===0&&l.stockUnit)stockUnitLabel=l.stockUnit;
  const n=Number(l.baseQuantity);
  if(Number.isFinite(n))totalBaseNum+=n;
 });

 const listSubtotal=s.calculation.channel?.listSubtotal
  ??s.calculation.lines.reduce((acc,l)=>{
   if(l.gift)return acc;
   const lp=BigInt(l.listUnitPrice??l.regularUnitPrice??l.unitPrice);
   const bq=Math.round(Number(l.baseQuantity));
   return acc+lp*BigInt(bq);
  },0n).toString();

 const subtotalAfterTier=s.calculation.subtotal;
 const extraDiscountAmount=s.calculation.discount;
 const extraDiscountBp=s.basket.discountBasisPoints??0;
 const extraDiscountPercent=extraDiscountBp>0?String(extraDiscountBp/100).replace('.',','):'0';
 const totalPayableBig=BigInt(subtotalAfterTier)-BigInt(extraDiscountAmount);
 const totalPayable=(totalPayableBig>=0n?totalPayableBig:0n).toString();

 return {
  invoiceCode:derivedInvoiceCode,
  requestCode,
  issuedAt:s.issuedAt||new Date().toISOString(),
  sellerName:input.sellerName?.trim()||'CÔNG TY TNHH COHAMY',
  buyer:{
   partnerName:s.organization.name||'—',
   partnerCode:s.organization.code||'—',
   invoiceCompanyName:useCompany?(rec?.companyName||s.organization.name):(s.organization.name||'—'),
   taxCode:useCompany?(rec?.taxCode||s.organization.businessId||'—'):(s.organization.businessId||'—'),
   invoiceAddress:useCompany?(rec?.address||s.organization.address||'—'):(s.organization.address||'—'),
   phone:s.organization.phone||'—',
   email:useCompany?(rec?.email||s.organization.email||'—'):(s.organization.email||'—'),
  },
  delivery:{
   recipient:s.delivery.recipient||'—',
   phone:s.delivery.phone||'—',
   address:s.delivery.address||'—',
   expectedDeliveryDate:input.expectedDeliveryDate?.trim()||'',
  },
  lines,
  summary:{
   totalBaseQuantityText:`${totalBaseNum.toLocaleString('vi-VN')} ${stockUnitLabel}`,
   totalCasesText:s.calculation.caseCount||'0',
   listSubtotal,
   subtotalAfterTier,
   extraDiscountPercent,
   extraDiscountAmount,
   totalPayable,
   amountInWords:vndToVietnameseWords(totalPayable),
  },
  signatures:{
   buyerRepresentative:input.buyerRepresentative?.trim()||s.delivery.recipient||s.organization.name||'',
   managerRepresentative:input.managerRepresentative?.trim()||'',
  },
 };
}
