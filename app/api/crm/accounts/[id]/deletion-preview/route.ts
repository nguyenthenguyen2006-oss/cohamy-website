import {apiError,apiUser,json} from '@/lib/crm/http';
import {previewAccountDeletion} from '@/lib/crm/account-deletion';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){try{const user=await apiUser('accounts'),{id}=await context.params;return json(await previewAccountDeletion(user,id));}catch(e){return apiError(e);}}
