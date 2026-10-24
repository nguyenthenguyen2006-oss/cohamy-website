import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {localSettingsKey} from './local-settings-key.mjs';
const run=JSON.parse(await fs.readFile('.local/crm-document-flow-run.json','utf8'));
if(run.mode!=='pglite'||!/^\.local\/crm-qa-documentflow-[a-f0-9-]+$/.test(run.dataDir))throw Error('ISOLATED_LOCAL_DOCUMENT_FIXTURE_REQUIRED');
const masterKey=await localSettingsKey();
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','4341'],{stdio:'inherit',env:{...process.env,CRM_SETTINGS_ENCRYPTION_KEY:masterKey,CRM_DATABASE_MODE:'pglite',CRM_ENVIRONMENT:'LOCAL',CRM_LOCAL_DATA_DIR:run.dataDir,CRM_EMAIL_ENABLED:'false',CRM_QA_BUILD:'true',CRM_QA_BUILD_VARIANT:'documents',CRM_PUBLIC_ORIGIN:'http://127.0.0.1:4341'}});
child.on('exit',code=>{process.exitCode=code??1;});
process.on('SIGINT',()=>child.kill('SIGINT'));process.on('SIGTERM',()=>child.kill('SIGTERM'));
