import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {assignOnlineOrder} from '@/lib/crm/online-orders';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){try{sameOrigin(request);return json(await assignOnlineOrder(await apiUser('online-customers'),(await context.params).id,await readJson(request)));}catch(error){return apiError(error);}}
