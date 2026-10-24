import 'server-only';
import {z} from 'zod';
import {CrmError} from './permissions';
import type {MailRecipients} from './document-mail-model';
import {brevoServerStatus,isBrevoDemo,resolveBrevoSettings} from './brevo-settings';
export type DocumentEmail={recipients:MailRecipients;subject:string;textContent:string;attachments:{name:string;content:string}[];jobId:string};
export async function brevoStatus(){return brevoServerStatus();}
export async function sendDocumentEmail(input:DocumentEmail){
 if(isBrevoDemo())return `demo-${input.jobId}`;
 const {key,sender}=await resolveBrevoSettings();
 if(!key||!z.email().safeParse(sender).success)throw new CrmError('EMAIL_NOT_CONFIGURED',503);if(process.env.CRM_EMAIL_ENABLED!=='true')throw new CrmError('EMAIL_DISABLED',503);
 const recipients=z.object({to:z.array(z.email()).min(1).max(50),cc:z.array(z.email()).max(50),bcc:z.array(z.email()).max(50)}).safeParse(input.recipients);
 if(!recipients.success||!input.subject||input.subject.length>200||input.textContent.length>10000)throw new CrmError('INVALID_FIELDS',400);
 const map=(items:string[])=>items.map(email=>({email}));
 const response=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':key,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({sender:{name:'Cohamy',email:sender},to:map(input.recipients.to),...(input.recipients.cc.length?{cc:map(input.recipients.cc)}:{}),...(input.recipients.bcc.length?{bcc:map(input.recipients.bcc)}:{}),subject:input.subject,textContent:input.textContent,attachment:input.attachments,headers:{'X-Cohamy-Job':input.jobId}}),signal:AbortSignal.timeout(15000),redirect:'error'}).catch(()=>{throw new CrmError('EMAIL_RESULT_UNKNOWN',503);});
 if(!response.ok)throw new CrmError(response.status===429?'EMAIL_RATE_LIMITED':response.status>=500?'EMAIL_PROVIDER_UNAVAILABLE':'EMAIL_PERMANENT_FAILURE',response.status===429?429:503);
 const result=z.object({messageId:z.string().min(1)}).safeParse(await response.json().catch(()=>null));if(!result.success)throw new CrmError('EMAIL_RESULT_UNKNOWN',503);return result.data.messageId;
}
export interface VerificationMailer{send(email:string,code:string):Promise<void>}
export async function sendTransactionalEmail(email:string,subject:string,textContent:string,idempotencyKey?:string){
 const isDemo = process.env.CRM_ENVIRONMENT === 'DEMO' || process.env.CRM_DEMO_MODE === 'true';
 if (isDemo) {
  // In DEMO mode, block all external email calls and record simulation
  console.log(`[DEMO SIMULATED EMAIL] To: ${email} | Subject: ${subject}`);
  return `demo-msg-${idempotencyKey ?? Date.now()}`;
 }
 const {key,sender}=await resolveBrevoSettings();
 if(!key||!sender||!z.email().safeParse(sender).success)throw new CrmError('EMAIL_NOT_CONFIGURED',503);
 if(process.env.CRM_EMAIL_ENABLED!=='true')throw new CrmError('EMAIL_DISABLED',503);
 const parsed=z.object({email:z.email(),subject:z.string().min(1).max(200),textContent:z.string().min(1).max(10000)}).safeParse({email,subject,textContent});
 if(!parsed.success)throw new CrmError('INVALID_FIELDS',400);
 const r=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':key,'content-type':'application/json',accept:'application/json',...(idempotencyKey?{'idempotency-key':idempotencyKey}:{})},body:JSON.stringify({sender:{name:'Cohamy',email:sender},to:[{email}],subject,textContent}),signal:AbortSignal.timeout(10000),redirect:'error'}).catch(()=>{throw new CrmError('EMAIL_DELIVERY_FAILED',503);});
 if(!r.ok)throw new CrmError('EMAIL_DELIVERY_FAILED',503);
 const result=z.object({messageId:z.string().min(1)}).safeParse(await r.json().catch(()=>null));
 if(!result.success)throw new CrmError('EMAIL_DELIVERY_FAILED',503);
 return result.data.messageId;
}
export const brevoMailer:VerificationMailer={async send(email,code){
 await sendTransactionalEmail(email,'Mã xác minh đăng ký đối tác Cohamy',`Mã xác minh của bạn: ${code}. Mã có hiệu lực 10 phút. Không chia sẻ mã này với người khác.`);
}};
