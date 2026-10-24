import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import pg from 'pg';

// Task-local PostgreSQL only. No ambient database URL is accepted.
const owner='postgres://cohamy_qa_owner@127.0.0.1:55432/postgres';
const pool=new pg.Pool({connectionString:owner});
const name='cohamy_qa_documentflow_'+randomUUID().replaceAll('-','');
const runFile='.local/crm-document-flow-run.json';
const previous=await fs.readFile(runFile).catch(()=>null);
try{
  await pool.query(`CREATE DATABASE ${name}`);
  await fs.writeFile('.local/crm-document-native-db.txt',name);
  const child=spawn(process.execPath,['--require','./scripts/register-server-only.cjs','--import','tsx','scripts/crm/test-document-flow.ts'],{
    stdio:'inherit',env:{...process.env,CRM_DATABASE_MODE:'postgres',CRM_ENVIRONMENT:'STAGING',CRM_QA_NATIVE_LOCAL:'true',CRM_DATABASE_URL:`postgres://cohamy_qa_owner@127.0.0.1:55432/${name}`,CRM_EMAIL_ENABLED:'false'},
  });
  const code=await new Promise(resolve=>child.on('exit',resolve));
  if(code!==0)process.exitCode=code??1;
}finally{
  if(previous)await fs.writeFile(runFile,previous);
  await pool.end();
}
