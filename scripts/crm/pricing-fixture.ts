import {randomUUID} from 'node:crypto';
import {database} from '../../lib/crm/db';
import * as pricing from '../../lib/crm/pricing';
import type {Principal} from '../../lib/crm/types';
import type {PriceDefinition} from '../../lib/crm/pricing-model';
export const qaPriceDefinition:PriceDefinition={audience:'ALL',tierId:null,organizationId:null,priority:10,startsAt:'2026-09-01T00:00:00+07:00',endsAt:null,quantityBasis:'SKU',rounding:'HALF_UP',taxBasis:'ORDER',taxBasisPoints:800,feeAmount:'1000',maxSalesDiscountBasisPoints:1000,minimum:{amount:'0',cases:0,skus:[]},deliveryTerms:'QA hư cấu: chỉ dùng kiểm thử, không áp chính sách thật',quoteValidityHours:72,approval:{nonSelfApproval:true,orderAmountThreshold:null,creditTerms:true},lines:[{sku:'QA_PRICE_A',unitPrice:'1000',thresholds:[{minBaseQuantity:'12',unitPrice:'900'},{minBaseQuantity:'24',unitPrice:'800'}]},{sku:'QA_PRICE_B',unitPrice:'2000',thresholds:[]}],gifts:[]};
export const qaBasket={lines:[{sku:'QA_PRICE_A',unitCode:'CASE',quantity:'2'}],discountBasisPoints:0,creditTerms:false};
export async function createPriceProducts(admin:Principal){
 const db=await database();if(!((process.env.CRM_ENVIRONMENT==='LOCAL'&&process.env.CRM_LOCAL_DATA_DIR?.includes('qa'))||(process.env.CRM_ENVIRONMENT==='STAGING'&&/^\/cohamy_qa_/.test(new URL(process.env.CRM_DATABASE_URL??'').pathname))))throw Error('PRICE_FIXTURE_ISOLATED_QA_ONLY');
 const ids:string[]=[];for(const [i,sku]of ['QA_PRICE_A','QA_PRICE_B','QA_PRICE_GIFT'].entries()){const id=randomUUID();ids.push(id);await db.query("INSERT INTO cohamy_crm.products(id,website_id,sku,name,category,weight_label,retail_price,translations,stock_unit) VALUES($1,$2,$3,$4,'QA','QA',999999,'{}','Gói')",[id,'qa-pricing-'+i,sku,'QA hư cấu · '+sku]);let productVersion=1;for(const [code,label,numerator,isCase]of [['BASE','Gói','1',false],['CASE','Thùng 12 gói','12',true]] as const){productVersion=(await pricing.savePriceUnit(admin,{productId:id,productVersion,code,label,numerator,denominator:'1',isCase,allowFractional:!isCase,active:true,version:0,reason:'QA hư cấu · quy đổi đã kiểm tra'})).productVersion;}}
 return ids;
}
