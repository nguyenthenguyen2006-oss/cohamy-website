import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import * as c from '@/lib/crm/channel';
import * as r from '@/lib/crm/period-reports';
type Context={params:Promise<{action:string}>};
// Meeting 12/10: network, levels, promotions, transfers, management chain, order catalog, period reports, KPI.
export async function GET(request:Request,context:Context){try{const user=await apiUser(),{action}=await context.params,q=new URL(request.url).searchParams;
 if(action==='levels')return json(await c.listMembershipLevels());
 if(action==='network')return json(await c.networkOverview(user));
 if(action==='profile')return json(await c.partnerChannelProfile(user,q.get('id')??''));
 if(action==='promotions')return json(await c.listPromotions(user));
 if(action==='transfers')return json(await c.listTransferRequests(user));
 if(action==='chain')return json(await c.requestManagementChain(user,q.get('id')??''));
 if(action==='network-requests')return json(await c.networkRequests(user));
 if(action==='catalog')return json(await c.orderCatalog(user,q.get('organizationId')??undefined));
 if(action==='report')return json(await r.periodSalesReport(user,{periodType:q.get('periodType')??undefined,periodKey:q.get('periodKey')??undefined,view:q.get('view')??undefined}));
 if(action==='incentives')return json(await r.listIncentivePrograms(user));
 if(action==='incentive-progress')return json(await r.incentiveProgress(user,q.get('id')??''));
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
export async function POST(request:Request,context:Context){try{sameOrigin(request);const user=await apiUser(),{action}=await context.params,input=await readJson(request);
 if(action==='level')return json(await c.saveMembershipLevel(user,input));
 if(action==='profile')return json(await c.setPartnerProfile(user,input));
 if(action==='promotion')return json(await c.savePromotion(user,input));
 if(action==='promotion-active')return json(await c.setPromotionActive(user,input));
 if(action==='child-discount')return json(await c.saveChildDiscount(user,input));
 if(action==='transfer-request')return json(await c.createTransferRequest(user,input));
 if(action==='transfer-decision')return json(await c.decideTransferRequest(user,input));
 if(action==='invoice-recipient')return json(await c.setInvoiceRecipient(user,input));
 if(action==='shortage')return json(await c.reportShortage(user,input));
 if(action==='incentive')return json(await r.saveIncentiveProgram(user,input));
 if(action==='incentive-award')return json(await r.awardIncentive(user,input));
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
