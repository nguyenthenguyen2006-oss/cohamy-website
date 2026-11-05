import {apiError,apiUser,json} from '@/lib/crm/http';
import {listOnlineOrders} from '@/lib/crm/online-orders';
export async function GET(request:Request){try{const search=new URL(request.url).searchParams;return json(await listOnlineOrders(await apiUser('online-customers'),{
 q:search.get('q')??'',status:search.get('status')??'',dispatchStatus:search.get('dispatchStatus')??'',warehouseId:search.get('warehouseId')??'',from:search.get('from')??'',to:search.get('to')??'',page:search.get('page')??'1',
}));}catch(error){return apiError(error);}}
