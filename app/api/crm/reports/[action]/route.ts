import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import {operationalReports,reportSubscriptions,saveReportSubscription} from '@/lib/crm/reports';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){try{const user=await apiUser(),{action}=await context.params;if(action==='subscriptions')return json(await reportSubscriptions(user));if(action==='overview'){const q=new URL(request.url).searchParams;return json(await operationalReports(user,{from:q.get('from'),to:q.get('to'),inactivityDays:Number(q.get('inactivityDays')||60),...(q.get('organizationId')?{organizationId:q.get('organizationId')}:{}),...(q.get('sku')?{sku:q.get('sku')}: {})}));}throw new CrmError('NOT_FOUND',404);}catch(error){return apiError(error);}}
export async function POST(request:Request,context:Context){try{sameOrigin(request);const user=await apiUser(),{action}=await context.params,data=await readJson(request);if(action==='subscription-save')return json(await saveReportSubscription(user,data));throw new CrmError('NOT_FOUND',404);}catch(error){return apiError(error);}}
