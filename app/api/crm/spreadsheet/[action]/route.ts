import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import * as rec from '@/lib/crm/reconciliation';

type Context={params:Promise<{action:string}>};

export async function GET(request:Request,context:Context){
 try{
  const user=await apiUser(),{action}=await context.params,q=Object.fromEntries(new URL(request.url).searchParams);
  if(action==='reconciliation')return json(await rec.salesReconciliation(user,q));
  if(action==='inventory-matrix')return json(await rec.inventoryMatrix(user,q));
  throw new CrmError('NOT_FOUND',404);
 }catch(e){
  return apiError(e);
 }
}

export async function POST(request:Request,context:Context){
 try{
  sameOrigin(request);
  const user=await apiUser(),{action}=await context.params,input=await readJson(request,65536);
  if(action==='partner-cells')return json(await rec.batchPartnerCells(user,input));
  if(action==='catalog-cells')return json(await rec.batchCatalogCells(user,input));
  throw new CrmError('NOT_FOUND',404);
 }catch(e){
  return apiError(e);
 }
}
