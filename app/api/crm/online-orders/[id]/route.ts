import {apiError,apiUser,json} from '@/lib/crm/http';
import {getOnlineOrder} from '@/lib/crm/online-orders';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{const search=new URL(request.url).searchParams;return json(await getOnlineOrder(await apiUser('online-customers'),(await context.params).id,{
 historyPage:search.get('historyPage')??'1',mailPage:search.get('mailPage')??'1',
}));}catch(error){return apiError(error);}}
