import {z} from 'zod';
import {CrmError} from './permissions';
import {integer,fixed,fixedText,convertQuantity,lineAmount,percentage,allocateAmount,type Rounding} from './decimal';

const money=z.string().regex(/^\d{1,24}$/),quantity=z.string().regex(/^\d{1,18}(?:\.\d{1,6})?$/),sku=z.string().min(2).max(80).regex(/^[A-Za-z0-9_-]+$/),basisPoints=z.number().int().min(0).max(10000);
export const priceDefinitionSchema=z.object({
 audience:z.enum(['ALL','TIER','ORGANIZATION']),tierId:z.uuid().nullable(),organizationId:z.uuid().nullable(),
 priority:z.number().int().min(0).max(1000),startsAt:z.iso.datetime({offset:true}),endsAt:z.iso.datetime({offset:true}).nullable(),
 quantityBasis:z.enum(['LINE','SKU','ORDER']),rounding:z.enum(['HALF_UP','HALF_EVEN','TOWARD_ZERO']),taxBasis:z.enum(['LINE','ORDER']),
 taxBasisPoints:basisPoints,feeAmount:money,maxSalesDiscountBasisPoints:basisPoints,
 minimum:z.object({amount:money,cases:z.number().int().min(0).max(1000000),skus:z.array(z.object({sku,minBaseQuantity:quantity}).strict()).max(100)}).strict(),
 deliveryTerms:z.string().trim().min(1).max(2000),quoteValidityHours:z.number().int().min(1).max(2160),
 approval:z.object({nonSelfApproval:z.boolean(),orderAmountThreshold:money.nullable(),creditTerms:z.boolean()}).strict(),
 lines:z.array(z.object({sku,unitPrice:money,thresholds:z.array(z.object({minBaseQuantity:quantity,unitPrice:money}).strict()).max(20)}).strict()).min(1).max(200),
 gifts:z.array(z.object({name:z.string().trim().min(1).max(120),group:z.string().trim().min(1).max(80),priority:z.number().int().min(0).max(1000),stacking:z.enum(['EXCLUSIVE','STACK']),repeat:z.enum(['ONCE','PER_THRESHOLD']),conditions:z.array(z.object({sku,minBaseQuantity:quantity}).strict()).min(1).max(20),giftSku:sku,giftBaseQuantity:quantity}).strict()).max(100),
}).strict().superRefine((d,c)=>{
 const issue=(message:string)=>c.addIssue({code:'custom',message});
 if((d.audience==='ALL'&&(d.tierId||d.organizationId))||(d.audience==='TIER'&&(!d.tierId||d.organizationId))||(d.audience==='ORGANIZATION'&&(!d.organizationId||d.tierId)))issue('Audience fields must match the chosen scope');
 if(d.endsAt&&new Date(d.endsAt)<=new Date(d.startsAt))issue('End must follow start');
 if(new Set(d.lines.map(l=>l.sku)).size!==d.lines.length)issue('Each SKU appears once in a price book');
 if(new Set(d.minimum.skus.map(l=>l.sku)).size!==d.minimum.skus.length)issue('Each minimum SKU appears once');
 for(const line of d.lines){let previous=-1n;for(const t of line.thresholds){const q=fixed(t.minBaseQuantity);if(q<=previous)issue('Quantity thresholds must be strictly increasing');previous=q;}}
 for(const g of d.gifts){if(fixed(g.giftBaseQuantity)<=0n||g.conditions.some(c=>fixed(c.minBaseQuantity)<=0n))issue('Gift quantities/conditions must be positive');if(new Set(g.conditions.map(c=>c.sku)).size!==g.conditions.length)issue('Each gift condition SKU appears once');}
 for(const group of new Set(d.gifts.map(g=>g.group))){const rules=d.gifts.filter(g=>g.group===group);if(new Set(rules.map(g=>g.stacking)).size>1)issue('One stacking strategy per gift group');if(rules[0].stacking==='EXCLUSIVE'&&new Set(rules.map(g=>g.priority)).size!==rules.length)issue('Exclusive gift priorities must be distinct');}
});
export type PriceDefinition=z.infer<typeof priceDefinitionSchema>;
export const basketSchema=z.object({lines:z.array(z.object({sku,unitCode:z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),quantity,requestedUnitPrice:money.optional()}).strict()).min(1).max(200),discountBasisPoints:basisPoints,creditTerms:z.boolean()}).strict();
export type Basket=z.infer<typeof basketSchema>;
export interface PriceProduct {id:string;sku:string;name:string;stockUnit:string;version:number;units:{code:string;label:string;numerator:string;denominator:string;isCase:boolean;allowFractional:boolean;version:number}[]}
export interface PricedLine {sku:string;productId:string;name:string;stockUnit:string;productVersion:number;unitCode:string;unitLabel:string;unitVersion:number;unitNumerator:string;unitDenominator:string;quantity:string;baseQuantity:string;unitPrice:string;regularUnitPrice:string;gross:string;discount:string;net:string;tax:string;total:string;gift:boolean;giftRule:string|null}
export interface PriceCalculation {lines:PricedLine[];subtotal:string;discount:string;tax:string;fee:string;total:string;caseCount:string;approvalRequired:boolean;approvalReasons:string[];minimumShortfalls:{kind:'AMOUNT'|'CASES'|'SKU';sku?:string;missing:string}[];rounding:Rounding;deliveryTerms:string}
export function calculatePrice(definition:PriceDefinition,basket:Basket,products:PriceProduct[]):PriceCalculation {
 const bySku=new Map(products.map(p=>[p.sku,p])),totals=new Map<string,bigint>();
 const prepared=basket.lines.map(line=>{const p=bySku.get(line.sku),u=p?.units.find(u=>u.code===line.unitCode);if(!p||!p.stockUnit)throw new CrmError('SKU_UNCONFIGURED',400);if(!u)throw new CrmError('UNIT_UNCONFIGURED',400);const q=fixed(line.quantity);if(q<=0n||(!u.allowFractional&&q%1000000n!==0n))throw new CrmError('INVALID_QUANTITY',400);const base=convertQuantity(line.quantity,u.numerator,u.denominator);totals.set(p.sku,(totals.get(p.sku)??0n)+fixed(base));return {line,p,u,base};});
 if(definition.quantityBasis==='ORDER'&&new Set(prepared.map(x=>x.p.stockUnit)).size>1)throw new CrmError('POLICY_UNIT_MISMATCH',400);
 const orderQuantity=[...totals.values()].reduce((a,b)=>a+b,0n),approvalReasons:string[]=[];
 const lines:PricedLine[]=prepared.map(({line,p,u,base})=>{const rate=definition.lines.find(r=>r.sku===line.sku);if(!rate)throw new CrmError('PRICE_UNAVAILABLE',409);const eligible=definition.quantityBasis==='LINE'?fixed(base):definition.quantityBasis==='SKU'?totals.get(p.sku)!:orderQuantity;let regular=rate.unitPrice;for(const t of rate.thresholds)if(eligible>=fixed(t.minBaseQuantity))regular=t.unitPrice;const price=line.requestedUnitPrice??regular;if(integer(price)!==integer(regular))approvalReasons.push('SPECIAL_PRICE');const gross=lineAmount(price,base,definition.rounding);return {sku:p.sku,productId:p.id,name:p.name,stockUnit:p.stockUnit,productVersion:p.version,unitCode:u.code,unitLabel:u.label,unitVersion:u.version,unitNumerator:u.numerator,unitDenominator:u.denominator,quantity:line.quantity,baseQuantity:base,unitPrice:price,regularUnitPrice:regular,gross,discount:'0',net:gross,tax:'0',total:gross,gift:false,giftRule:null};});
 const eligibleGifts=definition.gifts.map((rule,index)=>{let multiplier:bigint|null=null;for(const condition of rule.conditions){const count=(totals.get(condition.sku)??0n)/fixed(condition.minBaseQuantity);multiplier=multiplier===null?count:multiplier<count?multiplier:count;}return {rule,index,multiplier:rule.repeat==='ONCE'&&multiplier?1n:multiplier??0n};}).filter(x=>x.multiplier>0n).sort((a,b)=>b.rule.priority-a.rule.priority||a.index-b.index);
 const exclusive=new Set<string>();
 for(const {rule,multiplier} of eligibleGifts){if(rule.stacking==='EXCLUSIVE'&&exclusive.has(rule.group))continue;exclusive.add(rule.group);const p=bySku.get(rule.giftSku);if(!p?.stockUnit)throw new CrmError('GIFT_SKU_UNCONFIGURED',400);const baseUnit=p.units.find(u=>u.code==='BASE');if(!baseUnit||integer(baseUnit.numerator)!==1n||integer(baseUnit.denominator)!==1n)throw new CrmError('GIFT_SKU_UNCONFIGURED',400);const giftQuantity=fixed(rule.giftBaseQuantity)*multiplier;if(!baseUnit.allowFractional&&giftQuantity%1000000n!==0n)throw new CrmError('INVALID_GIFT_QUANTITY',400);const qty=fixedText(giftQuantity);if(fixed(qty)>999999999999999999999999n)throw new CrmError('QUANTITY_LIMIT',400);lines.push({sku:p.sku,productId:p.id,name:p.name,stockUnit:p.stockUnit,productVersion:p.version,unitCode:'BASE',unitLabel:p.stockUnit,unitVersion:baseUnit.version,unitNumerator:baseUnit.numerator,unitDenominator:baseUnit.denominator,quantity:qty,baseQuantity:qty,unitPrice:'0',regularUnitPrice:'0',gross:'0',discount:'0',net:'0',tax:'0',total:'0',gift:true,giftRule:rule.name});}
 const subtotal=lines.reduce((a,l)=>a+integer(l.gross),0n),discount=percentage(subtotal.toString(),basket.discountBasisPoints,definition.rounding),allocated=allocateAmount(discount,lines.map(l=>l.gross));
 lines.forEach((l,i)=>{l.discount=allocated[i];l.net=(integer(l.gross)-integer(l.discount)).toString();});
 let tax:string;
 if(definition.taxBasis==='LINE'){lines.forEach(l=>{l.tax=percentage(l.net,definition.taxBasisPoints,definition.rounding);});tax=lines.reduce((a,l)=>a+integer(l.tax),0n).toString();}
 else {tax=percentage((subtotal-integer(discount)).toString(),definition.taxBasisPoints,definition.rounding);const taxes=allocateAmount(tax,lines.map(l=>l.net));lines.forEach((l,i)=>{l.tax=taxes[i];});}
 lines.forEach(l=>{l.total=(integer(l.net)+integer(l.tax)).toString();});
 const total=subtotal-integer(discount)+integer(tax)+integer(definition.feeAmount);
 if(total>999999999999999999999999n)throw new CrmError('MONEY_LIMIT',400);
 let cases=0n;for(const [sku,base]of totals){const unit=bySku.get(sku)!.units.find(u=>u.isCase);if(unit)cases+=base*integer(unit.denominator)/(integer(unit.numerator)*1000000n);}
 const minimumShortfalls:PriceCalculation['minimumShortfalls']=[];
 const merchandise=subtotal-integer(discount);if(merchandise<integer(definition.minimum.amount))minimumShortfalls.push({kind:'AMOUNT',missing:(integer(definition.minimum.amount)-merchandise).toString()});if(cases<BigInt(definition.minimum.cases))minimumShortfalls.push({kind:'CASES',missing:(BigInt(definition.minimum.cases)-cases).toString()});
 for(const condition of definition.minimum.skus){const actual=totals.get(condition.sku)??0n;if(actual<fixed(condition.minBaseQuantity))minimumShortfalls.push({kind:'SKU',sku:condition.sku,missing:fixedText(fixed(condition.minBaseQuantity)-actual)});}
 if(basket.discountBasisPoints>definition.maxSalesDiscountBasisPoints)approvalReasons.push('DISCOUNT');if(basket.creditTerms&&definition.approval.creditTerms)approvalReasons.push('CREDIT_TERMS');if(definition.approval.orderAmountThreshold!==null&&total>=integer(definition.approval.orderAmountThreshold))approvalReasons.push('AMOUNT');
 return {lines,subtotal:subtotal.toString(),discount,tax,fee:definition.feeAmount,total:total.toString(),caseCount:cases.toString(),approvalRequired:approvalReasons.length>0,approvalReasons:[...new Set(approvalReasons)],minimumShortfalls,rounding:definition.rounding,deliveryTerms:definition.deliveryTerms};
}
