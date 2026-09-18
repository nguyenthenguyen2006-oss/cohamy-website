import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import * as c from '@/lib/crm/care';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){try{const user=await apiUser(),{action}=await context.params,q=new URL(request.url).searchParams;
 if(action==='contacts')return json(await c.contacts(user,q.get('id')??''));
 if(action==='checklist')return json(await c.checklist(user,q.get('id')??''));
 if(action==='dependencies')return json(await c.dependencies(user,q.get('id')??''));
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
export async function POST(request:Request,context:Context){try{sameOrigin(request);const user=await apiUser(),{action}=await context.params,input=await readJson(request);
 if(action==='contact')return json(await c.saveContact(user,input));
 if(action==='checklist')return json(await c.saveChecklist(user,input));
 if(action==='dependency')return json(await c.saveDependency(user,input));
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
