import {fixed,fixedText,roundRatio} from './decimal';
import {CrmError} from './permissions';

// Shared by the browser preview and authoritative server calculation. No database,
// Node or server-only imports belong in this module.
const maximumMoney=999999999999999999999999999999n;
const percentScale=4;
const percentDenominator=1000000n;
const quantityDenominator=1000000n;

function money(value:string):bigint {
  if(typeof value!=='string'||!/^\d{1,30}$/u.test(value))throw new CrmError('INVALID_MONEY',400);
  return bounded(BigInt(value));
}
function bounded(value:bigint):bigint {
  if(value<0n||value>maximumMoney)throw new CrmError('MONEY_LIMIT',400);
  return value;
}
function normalizedPercent(value:string|number,code:string):string {
  if(typeof value!=='string'&&typeof value!=='number')throw new CrmError(code,400);
  if(typeof value==='number'&&!Number.isFinite(value))throw new CrmError(code,400);
  const text=String(value).trim();
  if(!/^\d{1,3}(?:\.\d{1,4})?$/u.test(text))throw new CrmError(code,400);
  const percentage=fixed(text,percentScale);
  if(percentage>percentDenominator)throw new CrmError(code,400);
  return fixedText(percentage,percentScale);
}

export function normalizeDiscountPercent(value:string|number):string {
  return normalizedPercent(value,'INVALID_DISCOUNT_PERCENT');
}

export type HandoverSalePricingInput={
  listUnitPrice:string;
  quantity:string;
  discountPercent:string;
  vatRate:string;
  includeVat:boolean;
};
export type HandoverSalePricedLine={
  listUnitPrice:string;
  discountPercent:string;
  unitPrice:string;
  amount:string;
  listLineTotal:string;
  discountAmount:string;
  vatRate:string;
  vatAmount:string;
  grossLineTotal:string;
};

export function calculateHandoverSaleLine(input:HandoverSalePricingInput):HandoverSalePricedLine {
  if(typeof input.quantity!=='string'||!/^\d{1,14}(?:\.\d{1,2})?$/u.test(input.quantity))throw new CrmError('INVALID_SALE_QUANTITY',400);
  const quantity=fixed(input.quantity);
  if(quantity<=0n)throw new CrmError('INVALID_SALE_QUANTITY',400);
  if(typeof input.includeVat!=='boolean')throw new CrmError('INVALID_VAT_RATE',400);
  const listUnitPrice=money(input.listUnitPrice);
  const discountPercent=normalizeDiscountPercent(input.discountPercent);
  const discount=fixed(discountPercent,percentScale);
  const actualVatRate=input.includeVat?normalizedPercent(input.vatRate,'INVALID_VAT_RATE'):'0';
  const vatRate=fixed(actualVatRate,percentScale);

  // Round the discounted unit price first, then multiply that exact VND value.
  const unitPrice=bounded(roundRatio(listUnitPrice*(percentDenominator-discount),percentDenominator,'HALF_UP'));
  const listLineTotal=bounded(roundRatio(listUnitPrice*quantity,quantityDenominator,'HALF_UP'));
  const amount=bounded(roundRatio(unitPrice*quantity,quantityDenominator,'HALF_UP'));
  const discountAmount=bounded(listLineTotal-amount);
  const vatAmount=bounded(roundRatio(amount*vatRate,percentDenominator,'HALF_UP'));
  const grossLineTotal=bounded(amount+vatAmount);
  return {listUnitPrice:listUnitPrice.toString(),discountPercent,unitPrice:unitPrice.toString(),amount:amount.toString(),listLineTotal:listLineTotal.toString(),discountAmount:discountAmount.toString(),vatRate:actualVatRate,vatAmount:vatAmount.toString(),grossLineTotal:grossLineTotal.toString()};
}

type TotalLine=Pick<HandoverSalePricedLine,'listLineTotal'|'discountAmount'|'amount'|'vatAmount'|'grossLineTotal'>;
export type HandoverSaleTotals={goods:string;discount:string;net:string;vat:string;shipping:string;total:string;paid:'0';remaining:string};

export function calculateHandoverSaleTotals(lines:readonly TotalLine[],shippingFee:string):HandoverSaleTotals {
  if(!Array.isArray(lines)||lines.length>300)throw new CrmError('INVALID_SALE_LINES',400);
  let goods=0n,discount=0n,net=0n,vat=0n;
  for(const line of lines){
    const list=money(line.listLineTotal),reduction=money(line.discountAmount),amount=money(line.amount),tax=money(line.vatAmount),gross=money(line.grossLineTotal);
    if(list-reduction!==amount||amount+tax!==gross)throw new CrmError('SALE_TOTALS_INVALID',400);
    goods=bounded(goods+list);discount=bounded(discount+reduction);net=bounded(net+amount);vat=bounded(vat+tax);
  }
  const shipping=money(shippingFee),total=bounded(net+vat+shipping).toString();
  return {goods:goods.toString(),discount:discount.toString(),net:net.toString(),vat:vat.toString(),shipping:shipping.toString(),total,paid:'0',remaining:total};
}
