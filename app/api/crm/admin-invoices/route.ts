import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {adminInvoices,adminInvoiceDetail} from '@/lib/crm/invoice-admin-read';
import {changeAdminInvoice} from '@/lib/crm/invoice-admin-write';
import {z} from 'zod';
import {invoiceKinds} from '@/lib/crm/invoice-admin-model';
import {CrmError} from '@/lib/crm/permissions';
export const runtime='nodejs';
export async function GET(request:Request){try{const user=await apiUser(),params=new URL(request.url).searchParams,id=params.get('id');if(id){const kind=z.enum(invoiceKinds).safeParse(params.get('kind'));if(!kind.success||!z.uuid().safeParse(id).success)throw new CrmError('INVALID_FIELDS',400);return json(await adminInvoiceDetail(user,kind.data,id));}const offset=z.coerce.number().int().min(0).safeParse(params.get('offset')??0);if(!offset.success)throw new CrmError('INVALID_FIELDS',400);return json(await adminInvoices(user,{kind:params.get('kind')??'',q:params.get('q')??'',offset:offset.data,includeCancelled:params.get('includeCancelled')==='true'}));}catch(error){return apiError(error);}}
export async function POST(request:Request){try{sameOrigin(request);const user=await apiUser();return json(await changeAdminInvoice(user,await readJson(request,131072)));}catch(error){return apiError(error);}}
