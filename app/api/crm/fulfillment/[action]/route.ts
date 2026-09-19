import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import * as fulfillment from '@/lib/crm/fulfillment';
import {saveCarrierConnection} from '@/lib/crm/carrier';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){try{const user=await apiUser(),{action}=await context.params,p=new URL(request.url).searchParams;if(action==='order')return json(await fulfillment.orderFulfillment(user,p.get('id')??''));throw new CrmError('NOT_FOUND',404);}catch(error){return apiError(error);}}
export async function POST(request:Request,context:Context){try{sameOrigin(request);const user=await apiUser(),{action}=await context.params,input=await readJson(request);
 if(action==='backorder')return json(await fulfillment.saveBackorder(user,input));
 if(action==='delivery-create')return json(await fulfillment.createDelivery(user,input));
 if(action==='pick')return json(await fulfillment.pickDelivery(user,input));
 if(action==='pack')return json(await fulfillment.packParcel(user,input));
 if(action==='trip-create')return json(await fulfillment.createTrip(user,input));
 if(action==='trip-dispatch')return json(await fulfillment.dispatchTrip(user,input));
 if(action==='delivery-finish')return json(await fulfillment.finishDelivery(user,input));
 if(action==='carrier-manual')return json(await fulfillment.manualCarrierEvent(user,input));
 if(action==='carrier-connection')return json(await saveCarrierConnection(user,input));
 if(action==='return-request')return json(await fulfillment.requestReturn(user,input));
 if(action==='return-decide')return json(await fulfillment.decideReturn(user,input));
 if(action==='return-receive')return json(await fulfillment.receiveReturn(user,input));
 throw new CrmError('NOT_FOUND',404);
}catch(error){return apiError(error);}}
