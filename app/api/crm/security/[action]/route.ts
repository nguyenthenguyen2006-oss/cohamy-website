import {cookies} from 'next/headers';
import {beginMfaEnrollment,confirmMfaEnrollment,disableMfa,mfaStatus,requestPasswordReset,resetPassword} from '@/lib/crm/account-security';
import {SESSION_COOKIE} from '@/lib/crm/auth';
import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
type Context={params:Promise<{action:string}>};
export async function GET(_request:Request,context:Context){try{const {action}=await context.params;if(action!=='mfa-status')throw new CrmError('NOT_FOUND',404);return json(await mfaStatus(await apiUser()));}catch(error){return apiError(error);}}
export async function POST(request:Request,context:Context){try{sameOrigin(request);const {action}=await context.params,data=await readJson(request);
 if(action==='forgot'){const email=typeof(data as {email?:unknown}).email==='string'?(data as {email:string}).email:'';return json(await requestPasswordReset(email));}
 if(action==='reset')return json(await resetPassword(data));
 const user=await apiUser();
 if(action==='mfa-begin')return json(await beginMfaEnrollment(user,data));
 if(action==='mfa-confirm'){const result=await confirmMfaEnrollment(user,data);(await cookies()).delete(SESSION_COOKIE);return json(result);}
 if(action==='mfa-disable'){const result=await disableMfa(user,data);(await cookies()).delete(SESSION_COOKIE);return json(result);}
 throw new CrmError('NOT_FOUND',404);
 }catch(error){return apiError(error);}}
