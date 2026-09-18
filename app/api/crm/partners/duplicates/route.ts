import {apiUser,apiError,json,readJson,sameOrigin} from '@/lib/crm/http';
import {freshInputDuplicates} from '@/lib/crm/partner-identifiers';
export async function POST(request:Request) {
  try {sameOrigin(request);return json({items:await freshInputDuplicates(await apiUser(),await readJson(request))});}
  catch(error){return apiError(error);}
}
