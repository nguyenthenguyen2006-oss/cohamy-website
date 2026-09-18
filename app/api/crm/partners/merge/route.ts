import {apiUser,apiError,json,readJson,sameOrigin} from '@/lib/crm/http';
import {mergePreview,mergeConfirm} from '@/lib/crm/partner-merge';
import {CrmError} from '@/lib/crm/permissions';
export async function POST(request:Request) {
  try {
    sameOrigin(request);const user=await apiUser(),input=await readJson(request) as {action?:string;data?:unknown};
    if(input.action==='preview')return json(await mergePreview(user,input.data));
    if(input.action==='confirm')return json(await mergeConfirm(user,input.data));
    throw new CrmError('INVALID_FIELDS',400);
  }catch(error){return apiError(error);}
}
