import { apiUser, apiError, json } from '@/lib/crm/http';
import { listHistoricalInvoices } from '@/lib/crm/historical-orders';

export const runtime='nodejs';
export async function GET(request:Request) {
  try {const user=await apiUser(),params=new URL(request.url).searchParams;return json(await listHistoricalInvoices(user,{q:params.get('q')??'',page:params.get('page')??'1'}));}
  catch(error){return apiError(error);}
}
