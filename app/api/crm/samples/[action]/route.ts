import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import * as samples from '@/lib/crm/samples';

type Context={params:Promise<{action:string}>};

export async function GET(_request:Request,context:Context){try{
 const user=await apiUser(),{action}=await context.params;
 if(action==='list')return json(await samples.listSamples(user));
 if(action==='warehouses')return json(await samples.sampleWarehouseOptions(user));
 throw new CrmError('NOT_FOUND',404);
}catch(error){return apiError(error);}}

export async function POST(request:Request,context:Context){try{
 sameOrigin(request);const user=await apiUser(),{action}=await context.params,input=await readJson(request);
 if(action==='create')return json(await samples.createSample(user,input));
 if(action==='issue')return json(await samples.issueSample(user,input));
 if(action==='act')return json(await samples.actSample(user,input));
 throw new CrmError('NOT_FOUND',404);
}catch(error){return apiError(error);}}
