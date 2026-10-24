import {apiUser,apiError,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import {flowWorkspace,saveFlowDocument,confirmFlowDocument,acceptFactoryRequest,amendFlowDocument,downloadFlowPdf,viewFlowDocument} from '@/lib/crm/document-flow';
import {mailSettings,saveMailRule,removeMailRule,previewMail,previewMailRule,retryDocumentMail,testDocumentMail} from '@/lib/crm/document-mail';
import {getBrevoSettings,saveBrevoSettings} from '@/lib/crm/brevo-settings';

type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){try{
  const user=await apiUser(),{action}=await context.params;
  if(action==='workspace')return json(await flowWorkspace(user));
  if(action==='provider-settings')return json(await getBrevoSettings(user));
  if(action==='mail-settings')return json(await mailSettings(user));
  if(action==='view'){const p=new URL(request.url).searchParams;return json(await viewFlowDocument(user,p.get('id')??'',p.get('revision')?Number(p.get('revision')):undefined));}
  if(action==='pdf'){
    const p=new URL(request.url).searchParams,revision=p.get('revision');if(revision&&!/^\d{1,8}$/.test(revision))throw new CrmError('INVALID_FIELDS',400);
    const file=await downloadFlowPdf(user,p.get('id')??'',revision?Number(revision):undefined);
    return new Response(new Uint8Array(file.bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`${p.get('download')==='1'?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});
  }
  throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
export async function POST(request:Request,context:Context){try{
  sameOrigin(request);const user=await apiUser(),{action}=await context.params,input=await readJson(request);
  if(action==='save')return json(await saveFlowDocument(user,input));
  if(action==='confirm')return json(await confirmFlowDocument(user,input));
  if(action==='accept')return json(await acceptFactoryRequest(user,input));
  if(action==='amend')return json(await amendFlowDocument(user,input));
  if(action==='save-provider')return json(await saveBrevoSettings(user,input));
  if(action==='save-mail-rule')return json(await saveMailRule(user,input));
  if(action==='remove-mail-rule')return json(await removeMailRule(user,input));
  if(action==='preview-mail')return json(await previewMail(user,input));
  if(action==='preview-mail-rule')return json(await previewMailRule(user,input));
  if(action==='retry-mail')return json(await retryDocumentMail(user,input));
  if(action==='test-mail')return json(await testDocumentMail(user,input));
  throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
