import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {localSettingsKey} from './local-settings-key.mjs';
const run=JSON.parse(await fs.readFile('.local/buyer-qa.json','utf8'));
if(!/^\.local\/crm-qa-buyer-[a-f0-9-]+$/.test(run.dataDir))throw Error('ISOLATED_BUYER_FIXTURE_REQUIRED');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','localhost','--port','4351'],{stdio:'inherit',env:{...process.env,CRM_SETTINGS_ENCRYPTION_KEY:await localSettingsKey(),CRM_DATABASE_MODE:'pglite',CRM_ENVIRONMENT:'LOCAL',CRM_LOCAL_DATA_DIR:run.dataDir,CRM_EMAIL_ENABLED:'false',CRM_QA_BUILD:'true',CRM_PUBLIC_ORIGIN:'http://localhost:4351'}});
child.on('exit',code=>{process.exitCode=code??1;});process.on('SIGINT',()=>child.kill('SIGINT'));process.on('SIGTERM',()=>child.kill('SIGTERM'));
