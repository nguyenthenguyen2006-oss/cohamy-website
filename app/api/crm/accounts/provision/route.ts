import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {provisionAccount} from '@/lib/crm/account-provisioning';
export async function POST(request:Request){try{sameOrigin(request);const user=await apiUser('accounts');return json(await provisionAccount(user,await readJson(request)),201);}catch(error){return apiError(error);}}
