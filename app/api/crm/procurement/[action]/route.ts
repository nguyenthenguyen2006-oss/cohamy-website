import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import * as procurement from '@/lib/crm/procurement';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){try{const user=await apiUser(),{action}=await context.params,p=new URL(request.url).searchParams;if(action==='overview')return json(await procurement.procurementOverview(user));if(action==='operations')return json(await procurement.procurementOperations(user));if(action==='compare')return json(await procurement.compareRfq(user,p.get('id')??''));if(action==='performance')return json(await procurement.supplierPerformance(user,{from:p.get('from')??new Date().toISOString().slice(0,10),to:p.get('to')??new Date().toISOString().slice(0,10)}));throw new CrmError('NOT_FOUND',404);}catch(error){return apiError(error);}}
export async function POST(request:Request,context:Context){try{sameOrigin(request);const user=await apiUser(),{action}=await context.params,input=await readJson(request);
 if(action==='supplier-create')return json(await procurement.createSupplier(user,input));
 if(action==='supplier-save')return json(await procurement.saveSupplierProfile(user,input));
 if(action==='supplier-product')return json(await procurement.saveSupplierProduct(user,input));
 if(action==='request-create')return json(await procurement.createPurchaseRequest(user,input));
 if(action==='request-decide')return json(await procurement.decidePurchaseRequest(user,input));
 if(action==='rfq-create')return json(await procurement.createRfq(user,input));
 if(action==='rfq-dispatch')return json(await procurement.dispatchRfq(user,input));
 if(action==='quote-add')return json(await procurement.addSupplierQuote(user,input));
 if(action==='quote-select')return json(await procurement.selectSupplierQuote(user,input));
 if(action==='order-decide')return json(await procurement.decidePurchaseOrder(user,input));
 if(action==='order-amend')return json(await procurement.amendPurchaseOrder(user,input));
 if(action==='receipt')return json(await procurement.receivePurchaseOrder(user,input));
 if(action==='claim-create')return json(await procurement.createSupplierClaim(user,input));
 if(action==='claim-update')return json(await procurement.updateSupplierClaim(user,input));
 if(action==='payable-post')return json(await procurement.postPayable(user,input));
 if(action==='payment-create')return json(await procurement.createSupplierPayment(user,input));
 if(action==='payment-act')return json(await procurement.actSupplierPayment(user,input));
 throw new CrmError('NOT_FOUND',404);
}catch(error){return apiError(error);}}
