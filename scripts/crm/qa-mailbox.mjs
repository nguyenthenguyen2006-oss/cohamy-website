// A test-only preload. The application always uses its real Brevo adapter.
// Refuse production or non-QA data paths; never deliver an email to a real address.
import fs from 'node:fs';
import path from 'node:path';
if(process.env.CRM_ENVIRONMENT!=='LOCAL'||process.env.CRM_DATABASE_MODE!=='pglite'||!/^\.local[\\/]crm-qa-upgrade-ui-/.test(process.env.CRM_LOCAL_DATA_DIR??'')||process.env.NODE_ENV==='production')throw new Error('QA_MAILBOX_LOCAL_ONLY');
const originalFetch=globalThis.fetch;
globalThis.fetch=async function(input,init){const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;if(url!=='https://api.brevo.com/v3/smtp/email')return originalFetch(input,init);const body=JSON.parse(init.body);const email=body.to[0].email;if(!email.endsWith('@crm-qa.invalid'))throw new Error('QA_MAILBOX_RECIPIENT_REQUIRED');const code=body.textContent.match(/\b(\d{6})\b/)?.[1];if(!code)throw new Error('QA_MAILBOX_CODE_MISSING');const directory=path.resolve(process.env.CRM_LOCAL_DATA_DIR+'-mailbox');fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,email.replace(/[^a-zA-Z0-9_-]/g,'_')+'.json'),JSON.stringify({email,code}));return Response.json({messageId:'LOCAL-QA-MOCK-MESSAGE-ID'},{status:201});};
