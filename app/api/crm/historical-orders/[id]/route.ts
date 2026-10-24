import { apiUser, apiError } from '@/lib/crm/http';
import { historicalInvoiceSource } from '@/lib/crm/historical-orders';

export const runtime='nodejs';
export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    const user=await apiUser(),{id}=await context.params,file=await historicalInvoiceSource(user,id);
    const inline=new URL(request.url).searchParams.get('inline')==='1';
    const filename=encodeURIComponent(file.source_filename).replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16).toUpperCase());
    return new Response(new Uint8Array(file.content),{headers:{'Content-Type':'image/png','Content-Length':String(file.content.length),'Content-Disposition':`${inline?'inline':'attachment'}; filename*=UTF-8''${filename}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':"default-src 'none'; img-src 'self' data:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'"}});
  } catch(error){return apiError(error);}
}
