import {z} from 'zod';
import QRCode from 'qrcode';
import {apiUser,apiError,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import {salesCustomersWorkspace,salesCustomerDetail,salesReferralView} from '@/lib/crm/sales-workspace';
import {createSalesCustomer,saveSalesReferral,reassignSalesCustomer,resendSalesCustomerInvitation,listSalesCustomerReviews} from '@/lib/crm/sales-customers';
import {createSalesCustomerSchema,saveSalesReferralSchema,reassignSalesCustomerSchema} from '@/lib/crm/sales-customers-contracts';
import {salesNotificationList,readSalesNotification} from '@/lib/crm/sales-notifications';
import {evaluateBuyerFulfillment,actionBuyerFulfillment} from '@/lib/crm/buyer-fulfillment';
import {buyerFulfillmentActionSchema} from '@/lib/crm/buyer-fulfillment-contracts';
import {database} from '@/lib/crm/db';

type Context={params:Promise<{action:string}>};
const invitationSchema=z.object({membershipId:z.uuid(),action:z.enum(['SEND','RESEND','REVOKE']),idempotencyKey:z.uuid()}).strict();
const readNotificationSchema=z.object({id:z.uuid()}).strict();
function failure(e:unknown){return apiError(e instanceof z.ZodError?new CrmError('INVALID_FIELDS',400):e);}
export async function GET(request:Request,context:Context){
 try{
  const {action}=await context.params,user=await apiUser('sales-customers'),q=new URL(request.url).searchParams;
  if(action==='workspace')return json(await salesCustomersWorkspace(user,{q:q.get('q')??'',status:q.get('status')??'',source:q.get('source')??'',referralCode:q.get('referralCode')??'',page:Number(q.get('page')??1),from:q.get('from')??'',to:q.get('to')??'',warehouseId:q.get('warehouseId')??'',salesMembershipId:q.get('salesMembershipId')??''}));
  if(action==='customer')return json(await salesCustomerDetail(user,q.get('id')??''));
  if(action==='referral')return json(await salesReferralView(user,q.get('salesMembershipId')||undefined));
  if(action==='review-requests')return json(await listSalesCustomerReviews(user,Number(q.get('page')??1)));
  if(action==='notifications')return json(await salesNotificationList(user,{state:q.get('state')??'ALL',event:q.get('event')??'',page:Number(q.get('page')??1),limit:Number(q.get('limit')??20)}));
  if(action==='fulfillment')return json(await evaluateBuyerFulfillment(await database(),user,z.uuid().parse(q.get('id'))));
  if(action==='referral-qr'){
   const referral=await salesReferralView(user,q.get('salesMembershipId')||undefined);if(!referral)throw new CrmError('NOT_FOUND',404);
   const svg=await QRCode.toString(referral.url,{type:'svg',margin:2,errorCorrectionLevel:'M',width:256});
   return new Response(svg,{headers:{'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox",'X-Robots-Tag':'noindex, nofollow'}});
  }
  throw new CrmError('NOT_FOUND',404);
 }catch(e){return failure(e);}
}
export async function POST(request:Request,context:Context){
 try{
  sameOrigin(request);const {action}=await context.params,user=await apiUser('sales-customers'),input=await readJson(request,65536);
  if(action==='create')return json(await createSalesCustomer(user,createSalesCustomerSchema.parse(input)),201);
  if(action==='referral')return json(await saveSalesReferral(user,saveSalesReferralSchema.parse(input)));
  if(action==='reassign')return json(await reassignSalesCustomer(user,reassignSalesCustomerSchema.parse(input)));
  if(action==='invite')return json(await resendSalesCustomerInvitation(user,invitationSchema.parse(input)));
  if(action==='read-notification')return json(await readSalesNotification(user,readNotificationSchema.parse(input)));
  if(action==='fulfillment')return json(await actionBuyerFulfillment(user,buyerFulfillmentActionSchema.parse(input)));
  throw new CrmError('NOT_FOUND',404);
 }catch(e){return failure(e);}
}
