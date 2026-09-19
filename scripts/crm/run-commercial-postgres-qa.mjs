import fs from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
const cwd=process.cwd();if(process.platform!=='linux'||!/^\/root\/cohamy-qa\/commercial-[a-z0-9-]+$/.test(cwd))throw Error('DEDICATED_COMMERCIAL_QA_DIRECTORY_REQUIRED');
const protectedEnv=parseEnv(await fs.readFile('/root/cohamy-shared/postgres.env','utf8'));
if(!protectedEnv.POSTGRES_PASSWORD)throw Error('QA_OWNER_PASSWORD_UNAVAILABLE');
const ownerUrl=new URL('postgres://127.0.0.1:55432/postgres');ownerUrl.username=protectedEnv.POSTGRES_USER||'cohamy_owner';ownerUrl.password=protectedEnv.POSTGRES_PASSWORD;
const owner=new pg.Pool({connectionString:ownerUrl.href,max:1});let failed=false;
try{for(const script of ['verify-pricing.ts','verify-quotations.ts','verify-commercial-orders.ts','verify-request-excel.ts','verify-partner-merge.ts']){
 const name='cohamy_qa_'+(script==='verify-partner-merge.ts'?'merge_':'commercial_')+randomUUID().replaceAll('-','');if(!/^cohamy_qa_[a-z0-9_]+$/.test(name))throw Error('QA_DATABASE_NAME_INVALID');await owner.query('CREATE DATABASE "'+name+'"');const url=new URL(ownerUrl);url.pathname='/'+name;
 console.log('STAGING isolated '+script+' · DML-only services · fresh fictitious fixture');const result=spawnSync(process.execPath,['--require','./scripts/register-server-only.cjs','--import','tsx','scripts/crm/'+script],{cwd,stdio:'inherit',env:{...process.env,NODE_ENV:'test',CRM_ENVIRONMENT:'STAGING',CRM_DATABASE_MODE:'postgres',CRM_DATABASE_URL:url.href}});if(result.status!==0){failed=true;break;}
}}finally{await owner.end();}if(failed)process.exitCode=1;
