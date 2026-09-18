import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import * as w from '@/lib/crm/workspace';
import {z} from 'zod';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){try{const user=await apiUser(),{action}=await context.params,q=Object.fromEntries(new URL(request.url).searchParams);
 if(action==='search')return json(await w.search(user,q.q??'',Math.max(1,Math.min(10000,Number(q.page)||1))));
 if(action==='preferences')return json(await w.preferences(user));
 if(action==='draft')return json(await w.getDraft(user,q.key??''));
 if(action==='filters')return json(await w.listFilters(user,q.resource??'partners'));
 if(action==='bookmarks')return json(await w.bookmarks(user));
 if(action==='notifications')return json(await w.notifications(user));
 if(action==='sessions')return json(await w.sessions(user));
 if(action==='audit')return json(await w.auditSearch(user,q));
 if(action==='documents')return json(await w.documents(user,q.entityType,q.entityId,q.q));
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
export async function POST(request:Request,context:Context){try{sameOrigin(request);const user=await apiUser(),{action}=await context.params,input=await readJson(request);
 if(action==='preferences')return json(await w.savePreferences(user,input));
 if(action==='draft')return json(await w.saveDraft(user,input));
 if(action==='filter')return json(await w.saveFilter(user,input));
 if(action==='bookmark')return json(await w.bookmark(user,input));
 const d=w.parse(z.object({id:z.string()}).strict(),input);
 if(action==='notification-read')return json(await w.readNotification(user,w.parse(z.uuid(),d.id)));
 if(action==='session-revoke')return json(await w.revokeSession(user,d.id));
 if(action==='document-read')return json(await w.acknowledgeDocument(user,w.parse(z.uuid(),d.id)));
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
