// Isolated process preloader for real HTTP/browser tests. Never imported by app.
import fs from 'node:fs/promises';
if(process.env.CRM_ENVIRONMENT!=='LOCAL'||process.env.CRM_DATABASE_MODE!=='pglite'||!/^\.local\/crm-qa-provision-[a-f0-9-]+$/.test(process.env.CRM_LOCAL_DATA_DIR??''))throw Error('ISOLATED_LOCAL_PROVISION_QA_REQUIRED');
const native=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 if(url!=='https://api.brevo.com/v3/smtp/email')return native(input,init);
 const body=JSON.parse(init.body);if(body.to.some(r=>!r.email.endsWith('@provision-qa.invalid')))throw Error('QA_RECIPIENT_REQUIRED');
 // Contains synthetic secrets only; ignored, mode-restricted and removed by QA.
 await fs.writeFile('.local/provision-mailbox.json',JSON.stringify(body),{mode:0o600});return Response.json({messageId:'local-provider-qa'});
};
