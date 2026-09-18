import {cookies} from 'next/headers';
import {z} from 'zod';
import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {SESSION_COOKIE} from '@/lib/crm/auth';
import {CrmError} from '@/lib/crm/permissions';
import {parse} from '@/lib/crm/workspace';
import * as g from '@/lib/crm/governance';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){try{
 const user=await apiUser(),{action}=await context.params,q=Object.fromEntries(new URL(request.url).searchParams);
 if(action==='bulk-preview')return json(await g.getBulkPreview(user,q.id));
 if(action==='field-definitions')return json(await g.fieldDefinitions(user));
 if(action==='custom-values')return json(await g.customValues(user,q.organizationId));
 if(action==='permissions')return json(g.permissionExplanation(user));
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
export async function POST(request:Request,context:Context){try{
 sameOrigin(request);const user=await apiUser(),{action}=await context.params,input=await readJson(request);
 if(action==='bulk-preview')return json(await g.bulkPreview(user,input),201);
 if(action==='bulk-confirm')return json(await g.bulkConfirm(user,input));
 if(action==='field-definition')return json(await g.saveFieldDefinition(user,input));
 if(action==='custom-value')return json(await g.saveCustomValue(user,input));
 if(action==='role-preview')return json(await g.rolePreview(user,input));
 if(action==='session-revoke-others'){parse(z.object({}).strict(),input);return json(await g.revokeOtherSessions(user,(await cookies()).get(SESSION_COOKIE)?.value??''));}
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
