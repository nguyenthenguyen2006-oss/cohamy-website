import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import {sendDocumentEmail} from '../../lib/crm/brevo';
import {verifyBrevoWebhook} from '../../lib/crm/document-mail';
async function main(){
 const saved={key:process.env.CRM_BREVO_API_KEY,sender:process.env.CRM_BREVO_SENDER_EMAIL,enabled:process.env.CRM_EMAIL_ENABLED,environment:process.env.CRM_ENVIRONMENT,demo:process.env.CRM_DEMO_MODE,webhook:process.env.CRM_BREVO_WEBHOOK_TOKEN},original=globalThis.fetch;
 const results:{test:string;status:string}[]=[];let calls=0;const input={recipients:{to:['to@qa.invalid'],cc:['cc@qa.invalid'],bcc:['bcc@qa.invalid']},subject:'LOCAL QA · Chứng từ',textContent:'LOCAL QA · Thử provider giả',attachments:[{name:'VAT-qa.xml',content:Buffer.from('<QA/>').toString('base64')}],jobId:randomUUID()};
 try{
  process.env.CRM_ENVIRONMENT='LOCAL';process.env.CRM_DEMO_MODE='false';process.env.CRM_EMAIL_ENABLED='true';process.env.CRM_BREVO_API_KEY=randomUUID();process.env.CRM_BREVO_SENDER_EMAIL='sender@qa.invalid';
  globalThis.fetch=async(url,init)=>{calls++;assert.equal(url,'https://api.brevo.com/v3/smtp/email');assert.equal(init?.method,'POST');const body=JSON.parse(String(init?.body));assert.deepEqual(body.to,[{email:'to@qa.invalid'}]);assert.deepEqual(body.cc,[{email:'cc@qa.invalid'}]);assert.deepEqual(body.bcc,[{email:'bcc@qa.invalid'}]);assert.deepEqual(body.attachment,input.attachments);assert.ok((init?.headers as Record<string,string>)['api-key']);assert.equal((init?.headers as Record<string,string>)['idempotency-key'],undefined);return Response.json({messageId:'<provider-fake>'},{status:201});};
  assert.equal(await sendDocumentEmail(input),'<provider-fake>');results.push({test:'Exact Brevo endpoint, To/CC/BCC and DB bytes/base64 payload; no invented idempotency guarantee',status:'PASS'});
  for(const [status,code] of [[429,'EMAIL_RATE_LIMITED'],[503,'EMAIL_PROVIDER_UNAVAILABLE'],[400,'EMAIL_PERMANENT_FAILURE']] as const){globalThis.fetch=async()=>new Response('',{status});await assert.rejects(sendDocumentEmail(input),new RegExp(code));}results.push({test:'429/5xx/permanent error classifications',status:'PASS'});
  globalThis.fetch=async()=>{throw Error('QA network timeout');};await assert.rejects(sendDocumentEmail(input),/EMAIL_RESULT_UNKNOWN/);results.push({test:'Ambiguous transport result is UNKNOWN',status:'PASS'});
  globalThis.fetch=async()=>{calls++;throw Error('DEMO must not fetch');};process.env.CRM_ENVIRONMENT='DEMO';assert.equal(await sendDocumentEmail(input),`demo-${input.jobId}`);assert.equal(calls,1);process.env.CRM_ENVIRONMENT='LOCAL';process.env.CRM_DEMO_MODE='true';assert.equal(await sendDocumentEmail(input),`demo-${input.jobId}`);assert.equal(calls,1);results.push({test:'Both DEMO environment and DEMO_MODE flag never call Brevo',status:'PASS'});
  process.env.CRM_BREVO_WEBHOOK_TOKEN=randomUUID();assert.throws(()=>verifyBrevoWebhook(null),/FORBIDDEN/);assert.throws(()=>verifyBrevoWebhook('Bearer wrong'),/FORBIDDEN/);verifyBrevoWebhook(`Bearer ${process.env.CRM_BREVO_WEBHOOK_TOKEN}`);results.push({test:'Webhook bearer authentication rejects missing/wrong credentials',status:'PASS'});
  await fs.mkdir('docs/crm/test-results/document-flow',{recursive:true});await fs.writeFile('docs/crm/test-results/document-flow/provider-fake.json',JSON.stringify({provider:'FAKE_FETCH_ONLY; no external traffic',tests:results},null,2));results.forEach(t=>console.log('PASS',t.test));
 }finally{globalThis.fetch=original;for(const [key,value] of Object.entries({CRM_BREVO_API_KEY:saved.key,CRM_BREVO_SENDER_EMAIL:saved.sender,CRM_EMAIL_ENABLED:saved.enabled,CRM_ENVIRONMENT:saved.environment,CRM_DEMO_MODE:saved.demo,CRM_BREVO_WEBHOOK_TOKEN:saved.webhook})){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
