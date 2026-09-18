import {after} from 'next/server';
import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import {parse} from '@/lib/crm/workspace';
import * as j from '@/lib/crm/data-jobs';
import {z} from 'zod';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){try{const user=await apiUser(),{action}=await context.params,q=new URL(request.url).searchParams;
 if(action==='list')return json(await j.listJobs(user));
 const id=parse(z.uuid(),q.get('id'));
 if(action==='detail')return json(await j.getJob(user,id));
 if(action==='download'){const bytes=await j.downloadExport(user,id);return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="cohamy-records.xlsx"','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'}});}
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
export async function POST(request:Request,context:Context){try{sameOrigin(request);const user=await apiUser(),{action}=await context.params;
 if(action==='preview'){const reader=request.body?.getReader();if(!reader)throw new CrmError('INVALID_FIELDS',400);let size=0;const parts:Uint8Array[]=[];try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>2200000){await reader.cancel();throw new CrmError('FILE_SIZE_INVALID',413);}parts.push(r.value);}}finally{reader.releaseLock();}const form=await new Response(Buffer.concat(parts),{headers:{'content-type':request.headers.get('content-type')??''}}).formData();const file=form.get('file');if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.xlsx'))throw new CrmError('FILE_TYPE_INVALID',400);let mapping:unknown;try{mapping=JSON.parse(String(form.get('mapping')));}catch{throw new CrmError('INVALID_FIELDS',400);}return json(await j.previewImport(user,Buffer.from(await file.arrayBuffer()),{idempotencyKey:form.get('idempotencyKey'),kind:form.get('kind'),mapping}),201);}
 const input=await readJson(request);
 if(action==='export'){const result=await j.exportPartners(user,input);after(async()=>{await j.runNextJob();});return json(result,202);}
 const d=parse(z.object({id:z.uuid()}).strict(),input);
 if(action==='confirm'){const result=await j.confirmImport(user,d.id);after(async()=>{await j.runNextJob();});return json(result,202);}
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
