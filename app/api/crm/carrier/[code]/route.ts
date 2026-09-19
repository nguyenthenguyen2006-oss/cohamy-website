import {apiError,json} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import {carrierCallback} from '@/lib/crm/carrier';
type Context={params:Promise<{code:string}>};
export async function POST(request:Request,context:Context){try{const length=Number(request.headers.get('content-length')??'0');if(!Number.isFinite(length)||length>65536)throw new CrmError('BODY_TOO_LARGE',413);const bytes=new Uint8Array(await request.arrayBuffer());if(bytes.length>65536)throw new CrmError('BODY_TOO_LARGE',413);const {code}=await context.params,eventId=request.headers.get('x-event-id')??'',signature=request.headers.get('x-cohamy-signature')??'';return json(await carrierCallback(code,eventId,bytes,signature));}catch(error){return apiError(error);}}
