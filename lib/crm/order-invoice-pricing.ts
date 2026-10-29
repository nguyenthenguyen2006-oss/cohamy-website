import {allocateAmount,fixed,fixedText,integer,lineAmount,roundRatio} from './decimal';
import {CrmError} from './permissions';
import type {PriceCalculation,PriceDefinition} from './pricing-model';

export function formatInvoiceMoney(value:string):string{
 if(!/^-?\d+(?:\.\d+)?$/.test(value))return value;
 const [whole,fraction='']=value.split('.'),tail=fraction.replace(/0+$/,'');
 return new Intl.NumberFormat('vi-VN').format(BigInt(whole))+(tail?','+tail:'');
}
export function invoiceQuantity(value:string){return fixedText(fixed(value));}
export function invoicePercent(bp:number){return fixedText(BigInt(bp),2).replace('.',',');}
export function invoiceTaxCode(value:string){const v=value.trim();return /^(?:\d{10}(?:-\d{3})?|\d{12,13})$/.test(v)?v:'';}
function rate(numerator:bigint,denominator:bigint){
 const scaled=numerator*1000000n;
 return {value:fixedText(roundRatio(scaled,denominator,'HALF_UP')),approximate:scaled%denominator!==0n};
}
/** Display the already allocated backend result. Never apply an order discount twice. */
export function invoicePricing(calculation:PriceCalculation,policy?:Pick<PriceDefinition,'lines'>){
 const c=calculation,rounding=c.rounding??'HALF_UP';
 const allocations=c.lines.every(l=>typeof l.discount==='string')?c.lines.map(l=>l.discount):allocateAmount(c.discount,c.lines.map(l=>l.gross));
 const lines=c.lines.map((l,i)=>{
  const gross=integer(l.gross),discount=integer(allocations[i]),net=gross-discount,tax=integer(l.tax??'0');
  if(net<0n||l.net!==undefined&&integer(l.net)!==net||l.total!==undefined&&integer(l.total)!==net+tax)throw new CrmError('INVOICE_PRICE_SNAPSHOT_INVALID',409);
  // Older channel snapshots used listUnitPrice for an already reduced quantity tier.
  // Prefer the list rate captured in that document's policy, never today's catalog.
  const list=l.gift?'0':policy?.lines.find(p=>p.sku===l.sku)?.unitPrice??l.listUnitPrice??l.regularUnitPrice??l.unitPrice;
  const applied=l.gift?'0':l.unitPrice,numerator=integer(l.unitNumerator??'1'),denominator=integer(l.unitDenominator??'1');
  const listRate=rate(integer(list)*numerator,denominator),appliedRate=rate(integer(applied)*numerator,denominator),finalRate=rate(net*1000000n,fixed(l.quantity));
  const listGross=l.gift?'0':lineAmount(list,l.baseQuantity,rounding);
  return {listUnitPrice:listRate.value,appliedUnitPrice:appliedRate.value,finalUnitPrice:finalRate.value,unitPriceApproximate:listRate.approximate||appliedRate.approximate||finalRate.approximate,
   lineSubtotal:gross.toString(),allocatedDiscount:discount.toString(),lineTotal:net.toString(),taxAmount:tax.toString(),payableTotal:(net+tax).toString(),listGross};
 });
 const sum=(key:'lineSubtotal'|'allocatedDiscount'|'lineTotal'|'taxAmount'|'listGross')=>lines.reduce((n,l)=>n+integer(l[key]),0n);
 const merchandise=sum('lineTotal'),tax=sum('taxAmount'),fee=integer(c.fee??'0');
 if(sum('lineSubtotal')!==integer(c.subtotal)||sum('allocatedDiscount')!==integer(c.discount)||tax!==integer(c.tax??'0')||merchandise+tax+fee!==integer(c.total))throw new CrmError('INVOICE_PRICE_SNAPSHOT_INVALID',409);
 return {lines,listSubtotal:sum('listGross').toString(),productDiscountAmount:(sum('listGross')-sum('lineSubtotal')).toString(),merchandiseTotal:merchandise.toString(),taxAmount:tax.toString(),feeAmount:fee.toString(),totalPayable:c.total};
}
