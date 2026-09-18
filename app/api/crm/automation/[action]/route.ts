import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import * as care from '@/lib/crm/care-automation';
import {afterCareCommit} from '@/lib/crm/after-care';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){try{const user=await apiUser(),{action}=await context.params,q=new URL(request.url).searchParams;
 if(action==='schedules')return json(await care.careSchedules(user));
 if(action==='schedule-runs')return json(await care.scheduleRuns(user,q.get('id')??''));
 if(action==='rules')return json(await care.careRules(user));
 if(action==='rule-runs')return json(await care.ruleRuns(user,q.get('id')??''));
 if(action==='sla')return json(await care.slaPolicies(user));
 if(action==='escalations')return json(await care.escalations(user));
 if(action==='watchers')return json(await care.taskWatchers(user,q.get('id')??''));
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
export async function POST(request:Request,context:Context){try{sameOrigin(request);const user=await apiUser(),{action}=await context.params,d=await readJson(request);
 if(action==='schedule'){const result=await care.saveCareSchedule(user,d);afterCareCommit();return json(result);}
 if(action==='rule'){const result=await care.saveCareRule(user,d);afterCareCommit();return json(result);}
 if(action==='sla'){const result=await care.saveSlaPolicy(user,d);afterCareCommit();return json(result);}
 if(action==='follow')return json(await care.followTask(user,d));
 if(action==='handover-preview')return json(await care.handoverPreview(user,d));
 if(action==='handover-confirm')return json(await care.handoverConfirm(user,d));
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
