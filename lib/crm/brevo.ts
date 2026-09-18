import 'server-only';
import {z} from 'zod';
import {CrmError} from './permissions';
export interface VerificationMailer{send(email:string,code:string):Promise<void>}
export const brevoMailer:VerificationMailer={async send(email,code){
 const key=process.env.CRM_BREVO_API_KEY,sender=process.env.CRM_BREVO_SENDER_EMAIL;
 if(!key||!sender||!z.email().safeParse(sender).success)throw new CrmError('EMAIL_NOT_CONFIGURED',503);
 if(process.env.CRM_EMAIL_ENABLED!=='true')throw new CrmError('EMAIL_DISABLED',503);
 const r=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':key,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({sender:{name:'Cohamy',email:sender},to:[{email}],subject:'Mã xác minh đăng ký đối tác Cohamy',textContent:`Mã xác minh của bạn: ${code}. Mã có hiệu lực 10 phút. Không chia sẻ mã này với người khác.`}),signal:AbortSignal.timeout(10000),redirect:'error'}).catch(()=>{throw new CrmError('EMAIL_DELIVERY_FAILED',503);});
 if(!r.ok)throw new CrmError('EMAIL_DELIVERY_FAILED',503);
 const result=z.object({messageId:z.string().min(1)}).safeParse(await r.json().catch(()=>null));
 if(!result.success)throw new CrmError('EMAIL_DELIVERY_FAILED',503);
}};
