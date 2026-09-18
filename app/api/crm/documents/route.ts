import {apiError,apiUser,json,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import {uploadDocument} from '@/lib/crm/workspace';
export async function POST(request:Request){try{sameOrigin(request);const user=await apiUser();const type=request.headers.get('content-type')??'';if(!type.startsWith('multipart/form-data;'))throw new CrmError('INVALID_FIELDS',400);
 const reader=request.body?.getReader();if(!reader)throw new CrmError('INVALID_FIELDS',400);let size=0;const parts:Uint8Array[]=[];try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>8500000){await reader.cancel();throw new CrmError('FILE_SIZE_INVALID',413);}parts.push(r.value);}}finally{reader.releaseLock();}
 const form=await new Response(Buffer.concat(parts),{headers:{'content-type':type}}).formData();const file=form.get('file');if(!(file instanceof File))throw new CrmError('INVALID_FIELDS',400);
 const field=(key:string)=>{const value=form.get(key);return typeof value==='string'?value:'';};
 return json(await uploadDocument(user,{entityType:field('entityType'),entityId:field('entityId'),title:field('title'),filename:file.name,mime:file.type,content:Buffer.from(await file.arrayBuffer()),documentId:field('documentId')||undefined,effectiveAt:field('effectiveAt')||undefined,expiresAt:field('expiresAt')||undefined}),201);
}catch(e){return apiError(e);}}
