import {apiError,apiUser,json,readCommercialMultipart,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import * as consignment from '@/lib/crm/consignment';
import * as excel from '@/lib/crm/consignment-excel';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){try{const user=await apiUser(),{action}=await context.params;if(action==='overview')return json(await consignment.consignmentOverview(user));if(action==='operations')return json(await consignment.consignmentOperations(user));if(action==='sale-template')return new Response(new Uint8Array(await excel.consignmentSaleTemplate(user,new URL(request.url).searchParams.get('agreementId')??undefined)),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="cohamy-consignment-sales.xlsx"','Cache-Control':'private, no-store'}});throw new CrmError('NOT_FOUND',404);}catch(error){return apiError(error);}}
export async function POST(request:Request,context:Context){try{sameOrigin(request);const user=await apiUser(),{action}=await context.params;if(action==='sale-preview'){const {bytes,input}=await readCommercialMultipart(request);return json(await excel.previewConsignmentSale(user,bytes,input));}const input=await readJson(request);
 if(action==='agreement-save')return json(await consignment.saveAgreement(user,input));
 if(action==='agreement-accept')return json(await consignment.acceptAgreement(user,input));
 if(action==='ship')return json(await consignment.shipConsignment(user,input));
 if(action==='receive')return json(await consignment.receiveConsignment(user,input));
 if(action==='sale-report')return json(await consignment.submitSaleReport(user,input));
 if(action==='sale-confirm')return json(await excel.confirmConsignmentSale(user,input));
 if(action==='settlement-create')return json(await consignment.createSettlement(user,input));
 if(action==='settlement-act')return json(await consignment.actSettlement(user,input));
 if(action==='settlement-adjust')return json(await consignment.adjustSettlement(user,input));
 if(action==='replenishment-suggest')return json(await consignment.suggestReplenishment(user,input));
 if(action==='replenishment-decide')return json(await consignment.decideReplenishment(user,input));
 if(action==='return-request')return json(await consignment.requestConsignmentReturn(user,input));
 if(action==='return-act')return json(await consignment.actConsignmentReturn(user,input));
 throw new CrmError('NOT_FOUND',404);
}catch(error){return apiError(error);}}
