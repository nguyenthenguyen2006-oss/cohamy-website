import {spawn} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
if(!/^\.local[\\/]crm-qa-upgrade-ui-/.test(process.env.CRM_LOCAL_DATA_DIR??''))throw new Error('SEPARATE_UPGRADE_QA_DIRECTORY_REQUIRED');
const child=spawn(process.execPath,['--import',pathToFileURL(path.resolve('scripts/crm/qa-mailbox.mjs')).href,path.resolve('node_modules/next/dist/bin/next'),'dev','--hostname','localhost','--port','4320'],{stdio:'inherit',env:{...process.env,CRM_QA_BUILD:'true',CRM_QA_BUILD_VARIANT:'upgrade',CRM_DATABASE_MODE:'pglite',CRM_ENVIRONMENT:'LOCAL',CRM_PUBLIC_ORIGIN:'http://localhost:4320',CRM_WEBSITE_ORDER_INTAKE:'true',BLOG_SOURCE:'legacy',CRM_REGISTRATION_MODE:'OPEN',CRM_EMAIL_ENABLED:'true',CRM_BREVO_API_KEY:'QA-FAKE-NOT-A-REAL-KEY',CRM_BREVO_SENDER_EMAIL:'sender@crm-qa.invalid'}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));child.on('exit',code=>{process.exitCode=code??1;});
