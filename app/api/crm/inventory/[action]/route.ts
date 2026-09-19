import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import * as inventory from '@/lib/crm/inventory';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){try{
 const user=await apiUser(),{action}=await context.params,p=new URL(request.url).searchParams,id=p.get('id')??'';
 if(action==='balances')return json(await inventory.listInventory(user));
 if(action==='locations')return json(await inventory.listLocations(user));
 if(action==='alerts')return json(await inventory.inventoryAlerts(user));
 if(action==='lot-trace')return json(await inventory.lotTrace(user,id));
 if(action==='count-preview')return json(await inventory.previewStockCount(user,id));
 throw new CrmError('NOT_FOUND',404);
}catch(error){return apiError(error);}}
export async function POST(request:Request,context:Context){try{
 sameOrigin(request);const user=await apiUser(),{action}=await context.params,input=await readJson(request);
 if(action==='create-location')return json(await inventory.createLocation(user,input));
 if(action==='receipt')return json(await inventory.postReceipt(user,input));
 if(action==='reverse')return json(await inventory.reverseDocument(user,input));
 if(action==='reserve')return json(await inventory.reserveOrder(user,input));
 if(action==='release')return json(await inventory.releaseOrderReservations(user,input));
 if(action==='consume')return json(await inventory.consumeOrderReservations(user,input));
 if(action==='transfer-ship')return json(await inventory.shipTransfer(user,input));
 if(action==='transfer-receive')return json(await inventory.receiveTransfer(user,input));
 if(action==='count-start')return json(await inventory.startStockCount(user,input));
 if(action==='count-record')return json(await inventory.recordStockCount(user,input));
 if(action==='count-approve')return json(await inventory.approveStockCount(user,input));
 if(action==='alert-rule')return json(await inventory.saveAlertRule(user,input));
 if(action==='recall-open')return json(await inventory.openRecall(user,input));
 if(action==='recall-update')return json(await inventory.updateRecall(user,input));
 throw new CrmError('NOT_FOUND',404);
}catch(error){return apiError(error);}}
