import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import {dealerMembers,setDealerMember} from '@/lib/crm/dealer-members';
import * as p from '@/lib/crm/portal-services';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){try{const user=await apiUser(),{action}=await context.params,q=Object.fromEntries(new URL(request.url).searchParams);
 if(action==='members')return json(await dealerMembers(user));
 if(action==='cart')return json(await p.cart(user));
 if(action==='addresses')return json(await p.addresses(user));
 if(action==='tickets')return json(await p.listTickets(user,q));
 if(action==='ticket')return json({...await p.getTicket(user,q.id),messages:await p.ticketMessages(user,q.id)});
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
export async function POST(request:Request,context:Context){try{sameOrigin(request);const user=await apiUser(),{action}=await context.params,d=await readJson(request);
 if(action==='member')return json(await setDealerMember(user,d));
 if(action==='cart')return json(await p.saveCart(user,d));
 if(action==='address')return json(await p.saveAddress(user,d));
 if(action==='ticket')return json(await p.createTicket(user,d),201);
 if(action==='reply')return json(await p.replyTicket(user,d));
 if(action==='ticket-update')return json(await p.updateTicket(user,d));
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
