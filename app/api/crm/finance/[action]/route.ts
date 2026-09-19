import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import * as finance from '@/lib/crm/finance';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){try{const user=await apiUser(),{action}=await context.params,p=new URL(request.url).searchParams;if(action==='overview')return json(await finance.financeOverview(user));if(action==='aging')return json(await finance.receivableAging(user,p.get('asOf')??new Date().toISOString().slice(0,10)));if(action==='bank-suggestions')return json(await finance.bankMatchSuggestions(user,p.get('id')??''));throw new CrmError('NOT_FOUND',404);}catch(error){return apiError(error);}}
export async function POST(request:Request,context:Context){try{sameOrigin(request);const user=await apiUser(),{action}=await context.params,input=await readJson(request);
 if(action==='credit-configure')return json(await finance.configureCreditAccount(user,input));
 if(action==='receivable-post')return json(await finance.postOrderReceivable(user,input));
 if(action==='payment-create')return json(await finance.createPaymentReceipt(user,input));
 if(action==='payment-review')return json(await finance.reviewPaymentReceipt(user,input));
 if(action==='payment-allocate')return json(await finance.allocatePayment(user,input));
 if(action==='bank-import')return json(await finance.importBankTransaction(user,input));
 if(action==='bank-match')return json(await finance.confirmBankMatch(user,input));
 if(action==='bank-match-reverse')return json(await finance.reverseBankMatch(user,input));
 if(action==='receivable-adjust')return json(await finance.adjustReceivable(user,input));
 if(action==='reminder-schedule')return json(await finance.scheduleReminder(user,input));
 if(action==='reminder-run')return json(await finance.runDueReminders(user));
 if(action==='deposit-refund')return json(await finance.requestDepositRefund(user,input));
 if(action==='cash-create')return json(await finance.createCashRequest(user,input));
 if(action==='cash-act')return json(await finance.actCashRequest(user,input));
 throw new CrmError('NOT_FOUND',404);
}catch(error){return apiError(error);}}
