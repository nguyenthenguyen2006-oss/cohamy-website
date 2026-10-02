import fs from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
const cwd=process.cwd();
if(process.platform!=='linux'||!/^\/root\/cohamy-qa\/commercial-[a-z0-9-]+$/.test(cwd))throw Error('ISOLATED_MEETING_QA_DIRECTORY_REQUIRED');
const config=parseEnv(await fs.readFile('/root/cohamy-shared/postgres.env','utf8'));
if(!config.POSTGRES_PASSWORD)throw Error('QA_OWNER_PASSWORD_UNAVAILABLE');
const target=new URL('postgres://127.0.0.1:55432/postgres');target.username=config.POSTGRES_USER||'cohamy_owner';target.password=config.POSTGRES_PASSWORD;
const owner=new pg.Pool({connectionString:target.href,max:1});
try{
  for(const script of ['verify-meeting-migration.ts','verify-meeting-53-amendments.ts','verify-meeting-contract.ts','verify-commercial-orders.ts','verify-inventory.ts','verify-finance.ts']){
    const name='cohamy_qa_meeting_'+randomUUID().replaceAll('-','');assertName(name);
    await owner.query('CREATE DATABASE "'+name+'"');const url=new URL(target);url.pathname='/'+name;
    console.log('STAGING PostgreSQL: '+script+'; isolated fictitious database; actual DML runtime role');
    const result=spawnSync(process.execPath,['--require','./scripts/register-server-only.cjs','--import','tsx','scripts/crm/'+script],
      {cwd,stdio:'inherit',env:{...process.env,NODE_ENV:'test',BLOG_SOURCE:'legacy',CRM_ENVIRONMENT:'STAGING',CRM_DATABASE_MODE:'postgres',CRM_DATABASE_URL:url.href}});
    if(result.status!==0){process.exitCode=1;break;}
  }
}finally{await owner.end();}
function assertName(name){if(!/^cohamy_qa_meeting_[a-z0-9]+$/.test(name))throw Error('QA_DATABASE_NAME_INVALID');}
