import {apiError, json} from '@/lib/crm/http';
import {getPublicStorefront} from '@/lib/crm/storefront';

export async function GET() {
  try { return json(await getPublicStorefront()); }
  catch (error) { return apiError(error); }
}
