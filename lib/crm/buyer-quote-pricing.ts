import 'server-only';
import {database,type Sql} from './db';
import {assertCurrentPrincipal} from './auth';
import {can,CrmError} from './permissions';
import {calculateForOrganization,eligiblePriceBook} from './pricing';
import type {BuyerLine,BuyerOrder} from './buyer-model';
import type {Principal} from './types';

export type BuyerQuotePricing={configured:boolean;bookName:string;bookVersion:number|null;feeAmount:string;priceVersionId:string|null;maxSalesDiscountBasisPoints:number|null;needsApproval:boolean;nonSelfApproval:boolean;approvalReasons:string[];minimumShortfalls:{kind:string;missing:string;sku?:string}[];lines:{productId:string;listUnitPrice:string;recommendedUnitPrice:string;quotedUnitPrice:string|null;vatRate:number;discountBasisPoints:number}[]};
async function context(sql:Sql,user:Principal,b:BuyerOrder,proposed?:BuyerLine[]):Promise<BuyerQuotePricing>{
 const catalog=(await sql.query<{id:string;retail_price:string;vat_rate:string}>('SELECT id,retail_price::text,vat_rate::text FROM cohamy_crm.products WHERE id=ANY($1::uuid[])',[b.lines.map(l=>l.productId)])).rows;
 let chosen;
 try{chosen=await eligiblePriceBook(sql,user,b.organization_id);}catch(e){if(!(e instanceof CrmError)||e.code!=='PRICE_UNAVAILABLE')throw e;}
 const quoted=proposed??b.lines;
 if(!chosen)return {configured:false,bookName:'Báo giá thủ công theo nghiệp vụ hiện tại',bookVersion:null,feeAmount:'0',priceVersionId:null,maxSalesDiscountBasisPoints:null,needsApproval:false,nonSelfApproval:false,approvalReasons:[],minimumShortfalls:[],lines:b.lines.map(l=>{const p=catalog.find(p=>p.id===l.productId),price=quoted.find(q=>q.productId===l.productId)?.unitPrice??null;return {productId:l.productId,listUnitPrice:p?.retail_price??'0',recommendedUnitPrice:p?.retail_price??'0',quotedUnitPrice:price,vatRate:Number(p?.vat_rate??0),discountBasisPoints:0};})};
 // Reuse the price-book, quantity tiers, product promotions and account terms.
 // No requested price is supplied for the reference calculation: that would
 // suppress channel promotions in the native manual-price override path.
 const priced=await calculateForOrganization(sql,user,b.organization_id,{lines:b.lines.map(l=>({sku:l.sku,unitCode:'BASE',quantity:String(l.baseQuantity)})),discountBasisPoints:0,creditTerms:(await sql.query<{credit_enabled:boolean}>('SELECT credit_enabled FROM cohamy_crm.organizations WHERE id=$1',[b.organization_id])).rows[0]?.credit_enabled??false});
 const definition=priced.priceVersion.definition,net=quoted.reduce((n,l)=>n+BigInt(l.net??'0'),0n),gross=quoted.reduce((n,l)=>n+BigInt(l.total??'0'),BigInt(priced.priceVersion.definition.feeAmount)),reasons:string[]=priced.calculation.approvalReasons.filter(r=>r!=='AMOUNT');
 const lines=b.lines.map(l=>{
  const base=priced.calculation.lines.find(p=>p.productId===l.productId&&!p.gift);if(!base)throw new CrmError('PRICE_UNAVAILABLE',409);
  const quote=quoted.find(p=>p.productId===l.productId),reference=base.unitPrice,actual=quote?.unitPrice??null;
  if(proposed&&actual!==reference)reasons.push('SPECIAL_PRICE');
  const vatRate=Number(definition.taxBasisPoints)/100;if(proposed&&quote?.vatRate!==vatRate)reasons.push('SPECIAL_VAT');
  const discount=actual!==null&&BigInt(reference)>0n?Number((BigInt(reference)-BigInt(actual))*10000n/BigInt(reference)):0;if(proposed&&discount>definition.maxSalesDiscountBasisPoints)reasons.push('DISCOUNT');
  return {productId:l.productId,listUnitPrice:base.listUnitPrice??base.regularUnitPrice,recommendedUnitPrice:reference,quotedUnitPrice:actual,vatRate,discountBasisPoints:discount};
 });
 if(proposed&&definition.approval.orderAmountThreshold!==null&&gross>=BigInt(definition.approval.orderAmountThreshold))reasons.push('AMOUNT');
 const minimumShortfalls=priced.calculation.minimumShortfalls.filter(s=>s.kind!=='AMOUNT').map(s=>({...s}));
 if(proposed&&net<BigInt(definition.minimum.amount))minimumShortfalls.push({kind:'AMOUNT',missing:String(BigInt(definition.minimum.amount)-net)});
 // Native gifts must be present explicitly in this Portal request; never add
 // or deduct stock for extra product lines behind the customer's submitted form.
 for(const gift of priced.calculation.lines.filter(l=>l.gift)){
  const requested=b.lines.find(l=>l.productId===gift.productId);if(!requested||Number(requested.baseQuantity)<Number(gift.baseQuantity))minimumShortfalls.push({kind:'SKU',sku:gift.sku,missing:gift.baseQuantity});
 }
 return {configured:true,bookName:priced.book.name,bookVersion:priced.priceVersion.number,feeAmount:definition.feeAmount,priceVersionId:priced.priceVersion.id,maxSalesDiscountBasisPoints:definition.maxSalesDiscountBasisPoints,needsApproval:reasons.length>0,nonSelfApproval:definition.approval.nonSelfApproval,approvalReasons:[...new Set(reasons)],minimumShortfalls,lines};
}
export async function captureBuyerQuotePricing(sql:Sql,user:Principal,b:BuyerOrder,newVersion:number,proposed:BuyerLine[]){
 const check=await context(sql,user,b,proposed);
 await sql.query('INSERT INTO cohamy_crm.buyer_quote_price_checks(order_id,order_version,price_version_id,needs_approval,non_self_approval,minimum_shortfalls,snapshot,actor_id) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)',[b.id,newVersion,check.priceVersionId,check.needsApproval,check.nonSelfApproval,JSON.stringify(check.minimumShortfalls),JSON.stringify(check),user.id]);return check;
}
export async function buyerQuotePricing(user:Principal,id:string){
 if(user.area!=='crm'||!can(user,'buyer.review'))throw new CrmError('FORBIDDEN',403);const db=await database();await assertCurrentPrincipal(db,user);const {buyerOrder}=await import('./buyer'),b=await buyerOrder(db,user,id);
 if(!can(user,'buyer.manage')||b.status!=='WAITING_QUOTE'){const prior=(await db.query<{snapshot:BuyerQuotePricing}>('SELECT snapshot FROM cohamy_crm.buyer_quote_price_checks WHERE order_id=$1 ORDER BY order_version DESC LIMIT 1',[id])).rows[0];if(prior||!can(user,'buyer.manage')||!['WAITING_QUOTE','QUOTED'].includes(b.status))return prior?.snapshot??null;}
 return context(db,user,b);
}
