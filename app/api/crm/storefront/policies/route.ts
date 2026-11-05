import {apiError, apiUser, json} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import {STORE_POLICIES} from '@/data/store-policies';

export async function GET() {
  try {
    const user = await apiUser('storefront');
    if (user.role !== 'ADMIN' || user.area !== 'crm') throw new CrmError('FORBIDDEN',403);
    return json({items: STORE_POLICIES, language: 'vi', editable: false});
  } catch(error) { return apiError(error); }
}
