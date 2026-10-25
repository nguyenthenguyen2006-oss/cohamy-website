import {apiError,json,readJson,sameOrigin} from '@/lib/crm/http';
import {activateProvisionedAccount} from '@/lib/crm/account-provisioning';
export async function POST(request:Request){try{sameOrigin(request);
 // Reverse proxy supplies the address in production. A missing address shares
 // one bucket; it never disables limiting. No address is retained in cleartext.
 const client=(request.headers.get('x-real-ip')??'unknown').slice(0,100);
 return json(await activateProvisionedAccount(await readJson(request,2048),client));
}catch(error){return apiError(error);}}
