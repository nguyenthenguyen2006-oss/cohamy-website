import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {localSettingsKey} from './local-settings-key.mjs';
const fixture=JSON.parse(await fs.readFile('.local/provision-qa.json','utf8'));
if(!/^\.local\/crm-qa-provision-[a-f0-9-]+$/.test(fixture.localDataDir))throw Error('ISOLATED_PROVISION_FIXTURE_REQUIRED');
const child=spawn(process.execPath,['--import','./scripts/crm/provision-mailer-qa.mjs','node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','4355'],{stdio:'inherit',env:{...process.env,CRM_ENVIRONMENT:'LOCAL',CRM_DATABASE_MODE:'pglite',CRM_LOCAL_DATA_DIR:fixture.localDataDir,CRM_PUBLIC_ORIGIN:'http://127.0.0.1:4355',CRM_QA_BUILD:'true',CRM_SETTINGS_ENCRYPTION_KEY:await localSettingsKey(),CRM_EMAIL_ENABLED:'true',CRM_BREVO_API_KEY:'synthetic-local-provider-key',CRM_BREVO_SENDER_EMAIL:'sender@provision-qa.invalid'}});
child.once('exit',code=>{process.exitCode=code??1;});for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
