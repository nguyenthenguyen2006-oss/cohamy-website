import {apiError,json} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import {verifyBrevoWebhook,receiveBrevoWebhook} from '@/lib/crm/document-mail';
export async function POST(request:Request){try{
  verifyBrevoWebhook(request.headers.get('authorization'));
  const reader=request.body?.getReader();if(!reader)throw new CrmError('INVALID_FIELDS',400);
  let length=0;const chunks:Uint8Array[]=[];try{while(true){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>65536){await reader.cancel();throw new CrmError('PAYLOAD_TOO_LARGE',413);}chunks.push(r.value);}}finally{reader.releaseLock();}
  let payload:unknown;try{payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new CrmError('INVALID_FIELDS',400);}return json(await receiveBrevoWebhook(payload));
}catch(e){return apiError(e);}}
