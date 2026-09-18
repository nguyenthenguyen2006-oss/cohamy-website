import {cookies} from 'next/headers';
import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import * as o from '@/lib/crm/onboarding';
import {parse} from '@/lib/crm/workspace';
import {z} from 'zod';
type Context={params:Promise<{action:string}>};
async function applicant(){const id=await o.applicantIdentity((await cookies()).get(o.APPLICANT_COOKIE)?.value);if(!id)throw new CrmError('UNAUTHORIZED',401);return id;}
export async function GET(request:Request,context:Context){try{const {action}=await context.params,q=Object.fromEntries(new URL(request.url).searchParams);
 if(action==='application')return json(await o.application(await applicant()));
 if(action==='queue')return json(await o.reviewQueue(await apiUser(),q));
 if(action==='invitations')return json(await o.invitations(await apiUser()));
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
export async function POST(request:Request,context:Context){try{sameOrigin(request);const {action}=await context.params;
 if(action==='logout'){await o.applicantLogout((await cookies()).get(o.APPLICANT_COOKIE)?.value);(await cookies()).delete(o.APPLICANT_COOKIE);return json({loggedOut:true});}
 const input=await readJson(request);
 if(action==='register'||action==='login'){const result=action==='register'?await o.registerApplication(input):await o.applicantLogin(input);(await cookies()).set(o.APPLICANT_COOKIE,result.token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:8*3600});return json({id:result.id},action==='register'?201:200);}
 if(action==='verification-send')return json(await o.requestVerification(await applicant()));
 if(action==='verification-confirm')return json(await o.verifyApplication(await applicant(),input));
 if(action==='edit')return json(await o.editApplication(await applicant(),input));
 if(action==='submit')return json(await o.submitApplication(await applicant(),input));
 if(action==='invitation')return json(await o.createInvitation(await apiUser(),input));
 const d=parse(z.object({id:z.uuid(),data:z.unknown().optional()}).strict(),input);
 if(action==='reviewer')return json(await o.assignReviewer(await apiUser(),d.id,d.data));
 if(action==='review')return json(await o.reviewApplication(await apiUser(),d.id,d.data));
 if(action==='invitation-revoke')return json(await o.revokeInvitation(await apiUser(),d.id));
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
