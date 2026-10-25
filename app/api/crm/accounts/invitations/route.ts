import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {accountActivationHistory,issueAccountInvitation} from '@/lib/crm/account-provisioning';
export async function POST(request:Request){try{sameOrigin(request);const user=await apiUser('accounts');return json(await issueAccountInvitation(user,await readJson(request)));}catch(error){return apiError(error);}}
export async function GET(request:Request){try{const user=await apiUser('accounts');return json(await accountActivationHistory(user,new URL(request.url).searchParams.get('membershipId')??''));}catch(error){return apiError(error);}}
