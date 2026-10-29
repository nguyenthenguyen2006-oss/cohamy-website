import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {localSettingsKey} from './local-settings-key.mjs';
const fixture=JSON.parse(await fs.readFile('.local/invoice-qa.json','utf8'));
if(!/^\.local\/crm-qa-invoice-[a-f0-9-]+$/.test(fixture.dataDir))throw Error('ISOLATED_INVOICE_FIXTURE_REQUIRED');
const env={...process.env,CRM_ENVIRONMENT:'LOCAL',CRM_DATABASE_MODE:'pglite',CRM_LOCAL_DATA_DIR:fixture.dataDir,CRM_PUBLIC_ORIGIN:'http://127.0.0.1:4357',CRM_QA_BUILD:'true',CRM_SETTINGS_ENCRYPTION_KEY:await localSettingsKey(),CRM_EMAIL_ENABLED:'false'};
delete env.CRM_DATABASE_URL;
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','4357'],{stdio:'inherit',env});
child.once('exit',code=>{process.exitCode=code??1;});for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
