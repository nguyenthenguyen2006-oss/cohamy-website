import 'server-only';
import {z} from 'zod';
import {database} from './db';
import {assertCurrentPrincipal} from './auth';
import {CrmError} from './permissions';
import {partnerScope} from './repository';
import {calculateForOrganization} from './pricing';
import {basketSchema,type Basket,type PriceCalculation} from './pricing-model';
import {fixed,fixedText} from './decimal';
import {commercialDigest as hash,parseCommercial as parse} from './commercial-common';
import {salesOrderAccess,salesVersionAccess,type SalesOrder,type SalesVersion} from './sales-orders';
import type {Principal} from './types';
function quantitySignature(calculation:PriceCalculation){
 const skus=new Map<string,bigint>();for(const l of calculation.lines.filter(l=>!l.gift))skus.set(l.productId,(skus.get(l.productId)??0n)+fixed(l.baseQuantity));
 return hash([...skus].sort(([a],[b])=>a.localeCompare(b)).map(([sku,q])=>({sku,baseQuantity:fixedText(q)})));
}
export async function reorderPreview(user:Principal,id:string){
 return(await database()).transaction(async sql=>{
  await assertCurrentPrincipal(sql,user);const old=await salesOrderAccess(sql,user,id);if(!old.confirmed_version_id)throw new CrmError('ORDER_NOT_CONFIRMED',409);const v=await salesVersionAccess(sql,old,old.confirmed_version_id),current=await calculateForOrganization(sql,user,old.organization_id,v.snapshot.quote.basket);
  return {sourceOrderId:old.id,sourceCode:old.code,organizationId:old.organization_id,basket:v.snapshot.quote.basket,delivery:v.snapshot.quote.delivery,note:'Đặt lại từ '+old.code,before:v.snapshot.quote.calculation,after:current.calculation,changed:hash(v.snapshot.quote.calculation)!==hash(current.calculation),priceVersionId:current.priceVersion.id,availability:'CHECK_AT_RESERVATION' as const};
 });
}
export async function duplicateSalesCandidates(user:Principal,input:unknown){
 const d=parse(z.object({organizationId:z.uuid(),basket:basketSchema,hours:z.number().int().min(1).max(168).default(24)}).strict(),input);
 return(await database()).transaction(async sql=>{
  await assertCurrentPrincipal(sql,user);const current=await calculateForOrganization(sql,user,d.organizationId,d.basket),signature=quantitySignature(current.calculation),s=partnerScope(user);
  const params=[...s.params,d.organizationId,d.hours],rows=(await sql.query<SalesOrder&{snapshot:SalesVersion['snapshot']}>(`SELECT s.*,v.snapshot FROM cohamy_crm.sales_orders s JOIN cohamy_crm.organizations o ON o.id=s.organization_id JOIN cohamy_crm.sales_order_versions v ON v.id=coalesce(s.confirmed_version_id,s.latest_version_id) WHERE (${s.sql}) AND s.organization_id=$${s.params.length+1} AND s.status NOT IN('REJECTED','CANCELLED') AND s.created_at>=now()-($${params.length}::integer*interval '1 hour') ORDER BY s.created_at DESC,s.id LIMIT 201`,params)).rows;
  if(rows.length>200)throw new CrmError('DUPLICATE_CHECK_LIMIT',409);
  return {candidates:rows.filter(r=>quantitySignature(r.snapshot.quote.calculation)===signature).map(r=>({id:r.id,code:r.code,status:r.status,createdAt:r.snapshot.issuedAt,total:r.snapshot.quote.calculation.total})),automaticAction:'NONE' as const};
 });
}
export type ReorderBasket=Basket;
