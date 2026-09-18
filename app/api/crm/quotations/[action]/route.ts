import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import * as q from '@/lib/crm/quotations';
import {database} from '@/lib/crm/db';
import {downloadQuotationPdf} from '@/lib/crm/quotation-pdf';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){try{const user=await apiUser(),{action}=await context.params,p=new URL(request.url).searchParams,id=p.get('id')??'';
 if(action==='list')return json(await q.listQuotations(user,p.get('q')??''));
 if(action==='versions')return json(await q.quotationVersions(user,id));
 if(action==='events')return json(await q.quotationEvents(user,id));
 if(action==='head')return json(await q.quotationAccess(await database(),user,id));
 if(action==='pdf'){const result=await downloadQuotationPdf(user,id,p.get('versionId')??'');return new Response(new Uint8Array(result.bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+result.filename+'"','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}});}
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
export async function POST(request:Request,context:Context){try{sameOrigin(request);const user=await apiUser(),{action}=await context.params,input=await readJson(request);
 if(action==='save')return json(await q.saveQuotation(user,input));
 if(action==='action')return json(await q.quotationAction(user,input));
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
