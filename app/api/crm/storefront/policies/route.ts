import {apiError, apiUser, json} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import {STORE_POLICIES} from '@/data/store-policies';
import {CONTACT} from '@/lib/contact';

export async function GET() {
  try {
    const user = await apiUser('storefront');
    if (user.role !== 'ADMIN' || user.area !== 'crm') throw new CrmError('FORBIDDEN',403);
    return json({items: STORE_POLICIES, language: 'vi', editable: false, companyProfile: {
      legalName: CONTACT.companyName.vi,
      registration: CONTACT.registration,
      phone: CONTACT.phoneDisplay,
      email: CONTACT.email,
      offices: {hanoi: CONTACT.addresses.hanoi.vi, hcmc: CONTACT.addresses.hcmc.vi},
      bankAccount: CONTACT.bankAccount,
    }});
  } catch(error) { return apiError(error); }
}
