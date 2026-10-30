import { apiError, apiUser, json, readJson, sameOrigin } from "@/lib/crm/http";
import { getOrganization, setAccountActive, updateOrganization } from "@/lib/crm/repository";
import { CrmError } from "@/lib/crm/permissions";
import {deleteAccount} from '@/lib/crm/account-deletion';
type Context = { params: Promise<{ resource: string; id: string }> };
export async function DELETE(request:Request,context:Context){try{sameOrigin(request);const user=await apiUser('accounts'),{resource,id}=await context.params;if(resource==='accounts')return json(await deleteAccount(user,id,await readJson(request)));throw new CrmError('NOT_FOUND',404);}catch(e){return apiError(e);}}
export async function GET(_request: Request, context: Context) {
  try {
    const user = await apiUser(); const { resource, id } = await context.params;
    if (resource !== "partners") throw new CrmError("NOT_FOUND", 404);
    return json({ item: await getOrganization(user, id) });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    sameOrigin(request); const user = await apiUser(); const { resource, id } = await context.params;
    const input = await readJson(request);
    if (resource === "partners") return json(await updateOrganization(user, id, input));
    if (resource === "accounts") return json(await setAccountActive(user, id, input));
    throw new CrmError("NOT_FOUND", 404);
  } catch (error) { return apiError(error); }
}
