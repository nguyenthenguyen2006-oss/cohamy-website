import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {localSettingsKey} from './local-settings-key.mjs';
const f=JSON.parse(await fs.readFile('.local/generated-qa.json','utf8'));if(!/^\.local\/crm-qa-generated-[a-f0-9-]+$/.test(f.dataDir))throw Error('ISOLATED_GENERATED_QA_REQUIRED');
const env={...process.env,CRM_ENVIRONMENT:'LOCAL',CRM_DATABASE_MODE:'pglite',CRM_LOCAL_DATA_DIR:f.dataDir,CRM_PUBLIC_ORIGIN:'http://127.0.0.1:4358',CRM_QA_BUILD:'true',CRM_SETTINGS_ENCRYPTION_KEY:await localSettingsKey(),CRM_EMAIL_ENABLED:'false'};delete env.CRM_DATABASE_URL;
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','4358'],{env,stdio:'inherit'});child.once('exit',code=>{process.exitCode=code??1;});for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
