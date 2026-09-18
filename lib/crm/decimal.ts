import {CrmError} from './permissions';

export type Rounding='HALF_UP'|'HALF_EVEN'|'TOWARD_ZERO';
const quantityScale=6;
export function integer(value:string,signed=false):bigint {
 if(!(signed?/^-?\d{1,48}$/:/^\d{1,48}$/).test(value))throw new CrmError('INVALID_DECIMAL',400);
 return BigInt(value);
}
export function fixed(value:string,scale=quantityScale,signed=false):bigint {
 if(!Number.isInteger(scale)||scale<0||scale>12)throw new CrmError('INVALID_DECIMAL_SCALE',400);
 if(!(signed?/^-?\d{1,18}(?:\.\d{1,12})?$/:/^\d{1,18}(?:\.\d{1,12})?$/).test(value))throw new CrmError('INVALID_DECIMAL',400);
 const negative=value.startsWith('-'),[whole,fraction='']=(negative?value.slice(1):value).split('.');
 if(fraction.length>scale)throw new CrmError('DECIMAL_PRECISION',400);
 const result=BigInt(whole)*10n**BigInt(scale)+BigInt(fraction.padEnd(scale,'0')||'0');
 return negative?-result:result;
}
export function fixedText(value:bigint,scale=quantityScale):string {
 if(!Number.isInteger(scale)||scale<0||scale>12)throw new CrmError('INVALID_DECIMAL_SCALE',400);
 const sign=value<0n?'-':'',absolute=value<0n?-value:value,divisor=10n**BigInt(scale);
 if(scale===0)return sign+absolute.toString();
 const fraction=(absolute%divisor).toString().padStart(scale,'0').replace(/0+$/,'');
 return sign+(absolute/divisor).toString()+(fraction?'.'+fraction:'');
}
export function roundRatio(numerator:bigint,denominator:bigint,rounding:Rounding):bigint {
 if(denominator<=0n)throw new CrmError('INVALID_RATIO',400);
 if(!['HALF_UP','HALF_EVEN','TOWARD_ZERO'].includes(rounding))throw new CrmError('INVALID_ROUNDING',400);
 const sign=numerator<0n?-1n:1n,n=numerator<0n?-numerator:numerator,q=n/denominator,r=n%denominator;
 const up=rounding==='HALF_UP'?r*2n>=denominator:rounding==='HALF_EVEN'&&(r*2n>denominator||(r*2n===denominator&&q%2n===1n));
 return sign*(q+(up?1n:0n));
}
export function convertQuantity(quantity:string,numerator:string,denominator:string):string {
 const q=fixed(quantity),n=integer(numerator),d=integer(denominator);
 if(q<=0n||n<=0n||d<=0n)throw new CrmError('INVALID_QUANTITY',400);
 if(q*n%d!==0n)throw new CrmError('UNIT_PRECISION',400);
 const result=q*n/d;
 if(result>999999999999999999999999n)throw new CrmError('QUANTITY_LIMIT',400);
 return fixedText(result);
}
export function lineAmount(unitPrice:string,baseQuantity:string,rounding:Rounding):string {
 return roundRatio(integer(unitPrice)*fixed(baseQuantity),10n**BigInt(quantityScale),rounding).toString();
}
export function percentage(amount:string,basisPoints:number,rounding:Rounding):string {
 if(!Number.isInteger(basisPoints)||basisPoints<0||basisPoints>10000)throw new CrmError('INVALID_PERCENTAGE',400);
 return roundRatio(integer(amount)*BigInt(basisPoints),10000n,rounding).toString();
}
// Largest remainder distributes the exact total; equal remainders keep line order.
export function allocateAmount(amount:string,weights:string[]):string[] {
 const total=integer(amount);
 if(weights.length===0||weights.length>1000)throw new CrmError('INVALID_ALLOCATION',400);
 const values=weights.map(w=>integer(w)),sum=values.reduce((a,b)=>a+b,0n);
 if(sum===0n){if(total!==0n)throw new CrmError('INVALID_ALLOCATION',400);return weights.map(()=>'0');}
 const rows=values.map((w,index)=>({index,value:total*w/sum,remainder:total*w%sum}));
 let remaining=total-rows.reduce((a,b)=>a+b.value,0n);
 const ranked=[...rows].sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1);
 for(const row of ranked){if(remaining===0n)break;row.value++;remaining--;}
 if(remaining!==0n)throw new CrmError('ALLOCATION_INCONSISTENT',500);
 return rows.map(r=>r.value.toString());
}
