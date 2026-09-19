import {apiError,apiUser,json,readJson,readCommercialMultipart,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import {database} from '@/lib/crm/db';
import * as requests from '@/lib/crm/order-requests';
import * as orders from '@/lib/crm/sales-orders';
import * as policy from '@/lib/crm/order-policy';
import * as previews from '@/lib/crm/order-previews';
import * as excel from '@/lib/crm/request-excel';
import * as changes from '@/lib/crm/order-changes';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){try{
 const user=await apiUser(),{action}=await context.params,p=new URL(request.url).searchParams,id=p.get('id')??'';
 if(action==='requests')return json(await requests.listCommercialRequests(user,p.get('q')??''));
 if(action==='request')return json(await requests.commercialRequestAccess(await database(),user,id));
 if(action==='request-versions')return json(await requests.commercialRequestVersions(user,id));
 if(action==='orders')return json(await orders.listSalesOrders(user,p.get('q')??''));
 if(action==='order')return json(await orders.salesOrderAccess(await database(),user,id));
 if(action==='order-versions')return json(await orders.salesOrderVersions(user,id));
 if(action==='request-events'||action==='order-events')return json(await requests.commercialTimeline(user,action==='request-events'?'request':'order',id));
 if(action==='policy')return json(await policy.readOrderPolicy(user));
 if(action==='reorder')return json(await previews.reorderPreview(user,id));
 if(action==='excel-template')return new Response(new Uint8Array(await excel.excelRequestTemplate(user)),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="cohamy-request.xlsx"','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}});
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
export async function POST(request:Request,context:Context){try{
 sameOrigin(request);const user=await apiUser(),{action}=await context.params;
 if(action==='excel-preview'){const {bytes,input}=await readCommercialMultipart(request);return json(await excel.previewExcelRequest(user,bytes,input));}
 const input=await readJson(request);
 if(action==='save-request')return json(await requests.saveCommercialRequest(user,input));
 if(action==='request-action')return json(await requests.requestAction(user,input));
 if(action==='submit-request')return json(await orders.submitSalesRequest(user,input));
 if(action==='order-action')return json(await orders.salesOrderAction(user,input));
 if(action==='save-policy')return json(await policy.saveOrderPolicy(user,input));
 if(action==='duplicates')return json(await previews.duplicateSalesCandidates(user,input));
 if(action==='excel-confirm')return json(await excel.confirmExcelRequest(user,input));
 if(action==='change-preview')return json(await changes.previewOrderChange(user,input));
 if(action==='change-confirm')return json(await changes.confirmOrderChange(user,input));
 if(action==='cancel-order')return json(await changes.cancelOrder(user,input));
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
