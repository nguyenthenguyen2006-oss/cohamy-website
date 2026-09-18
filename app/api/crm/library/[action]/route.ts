import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import * as l from '@/lib/crm/partner-library';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){try{const user=await apiUser(),{action}=await context.params,q=Object.fromEntries(new URL(request.url).searchParams);if(action==='list')return json(await l.library(user,q));if(action==='detail')return json(await l.getLibraryItem(user,q.id));if(action==='checklist')return json(await l.onboardingChecklist(user));throw new CrmError('NOT_FOUND',404);}catch(e){return apiError(e);}}
export async function POST(request:Request,context:Context){try{sameOrigin(request);const user=await apiUser(),{action}=await context.params,input=await readJson(request);if(action==='save')return json(await l.saveLibraryItem(user,input));throw new CrmError('NOT_FOUND',404);}catch(e){return apiError(e);}}
