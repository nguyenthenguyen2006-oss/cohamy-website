import {apiError,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import {publicReferralInfo,registerReferralCustomer} from '@/lib/crm/sales-customers';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){try{const {action}=await context.params;if(action!=='info')throw new CrmError('NOT_FOUND',404);return json(await publicReferralInfo(new URL(request.url).searchParams.get('ref')??''));}catch(e){return apiError(e);}}
export async function POST(request:Request,context:Context){try{sameOrigin(request);const {action}=await context.params;if(action!=='register')throw new CrmError('NOT_FOUND',404);const forwarded=request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()??'unknown';return json(await registerReferralCustomer(await readJson(request),forwarded),201);}catch(e){return apiError(e);}}
