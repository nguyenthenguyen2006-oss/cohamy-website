import {calculatePrice,type Basket,type PriceDefinition,type PriceProduct} from './pricing-model';
import {fixed} from './decimal';
type Product={id:string;sku:string;name:string;stock_unit:string;version:number;retail_price?:string;units:{code:string;label:string;version:number;numerator:string;denominator:string;is_case:boolean;allow_fractional:boolean;active:boolean}[]};
/** Provisional catalogue pricing uses the same integer calculator as the server.
 * Server-selected contracts/promotions, tax and fees remain authoritative at preview/save. */
export function estimateOrderBasket(products:Product[],lines:Basket['lines'],discountPercent:string|number){
 try{
  const bp=fixed(String(discountPercent||'0'),2);if(bp<0n||bp>10000n)return null;
  const selected=lines.filter(l=>l.sku&&l.quantity&&fixed(l.quantity)>0n);if(!selected.length)return null;
  const definition:PriceDefinition={audience:'ALL',tierId:null,organizationId:null,priority:0,startsAt:'2020-01-01T00:00:00Z',endsAt:null,quantityBasis:'SKU',rounding:'HALF_UP',taxBasis:'ORDER',taxBasisPoints:0,feeAmount:'0',maxSalesDiscountBasisPoints:10000,minimum:{amount:'0',cases:0,skus:[]},deliveryTerms:'Tạm tính theo danh mục',quoteValidityHours:1,approval:{nonSelfApproval:false,orderAmountThreshold:null,creditTerms:false},gifts:[],lines:products.map(p=>({sku:p.sku,unitPrice:p.retail_price??'0',thresholds:[]}))};
  const catalogue:PriceProduct[]=products.map(p=>({id:p.id,sku:p.sku,name:p.name,stockUnit:p.stock_unit,version:p.version,units:p.units.filter(u=>u.active).map(u=>({...u,isCase:u.is_case,allowFractional:u.allow_fractional}))}));
  return calculatePrice(definition,{lines:selected,discountBasisPoints:Number(bp),creditTerms:false},catalogue);
 }catch{return null;}
}
