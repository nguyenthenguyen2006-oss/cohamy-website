import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {database} from '../../lib/crm/db';
import {installQaRuntime} from './qa-runtime';

const postgres=process.env.CRM_DATABASE_MODE==='postgres';
if(postgres&&!/^cohamy_qa_[a-z0-9_]+$/.test(new URL(process.env.CRM_DATABASE_URL??'').pathname.slice(1)))throw Error('ISOLATED_QA_DATABASE_REQUIRED');
async function main(){
 const owner=postgres?await database():new PGlite(),cases:Array<{name:string;status:string}>=[];
 let close=async()=>{};
 try{
  await owner.exec('CREATE SCHEMA IF NOT EXISTS cohamy_crm; CREATE TABLE cohamy_crm.migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now());');
  const files=(await fs.readdir('db/crm')).filter(n=>/^\d+.*\.sql$/.test(n)).sort();
  for(const file of files.filter(n=>n<'027'))await owner.exec(await fs.readFile('db/crm/'+file,'utf8'));
  const user=randomUUID(),org=randomUUID();
  await owner.query("INSERT INTO cohamy_crm.organizations(id,code,name,kind) VALUES($1,'QA_MIGRATION','QA migration','COHAMY')",[org]);
  await owner.query("INSERT INTO cohamy_crm.users(id,email,display_name,password_hash) VALUES($1,'migration@crm-qa.invalid','QA migration','not-a-login-password')",[user]);
  const legacy=['partner','order','ticket','library','visit'];
  for(const type of legacy)await owner.query('INSERT INTO cohamy_crm.private_documents(id,entity_type,entity_id,title,created_by) VALUES($1,$2,$3,$4,$5)',[randomUUID(),type,randomUUID(),'QA retained '+type,user]);
  const notifications=['partner','order','product','account','ticket','commercial-request','sales-order','delivery','return-request','receivable','payment','cash-request','report'];
  for(const type of notifications)await owner.query('INSERT INTO cohamy_crm.notifications(id,user_id,event_key,kind,entity_type,entity_id,message) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),user,'qa:'+type,'QA',type,randomUUID(),'QA retained notification']);
  for(const file of files.filter(n=>n>='027'))await owner.exec(await fs.readFile('db/crm/'+file,'utf8'));
  assert.deepEqual((await owner.query<{entity_type:string}>('SELECT entity_type FROM cohamy_crm.private_documents ORDER BY entity_type')).rows.map(r=>r.entity_type),[...legacy].sort());
  assert.equal((await owner.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.notifications')).rows[0].n,String(notifications.length));
  cases.push({name:'Meeting migrations preserve every legacy document and notification type',status:'PASS'});
  if(postgres){close=await installQaRuntime(owner as Awaited<ReturnType<typeof database>>);}
  const runtime=postgres?await database():owner;
  for(const type of ['payment','deal'])await runtime.query('INSERT INTO cohamy_crm.private_documents(id,entity_type,entity_id,title,created_by) VALUES($1,$2,$3,$4,$5)',[randomUUID(),type,randomUUID(),'QA new '+type,user]);
  cases.push({name:'New payment/deal document types remain writable by the runtime role',status:'PASS'});
  console.log('PASS meeting migration compatibility 2/2');
 }finally{
  await fs.mkdir('docs/crm/test-results',{recursive:true});
  await fs.writeFile('docs/crm/test-results/meeting-migration-'+(postgres?'postgres':'local')+'.json',JSON.stringify({testedAt:new Date().toISOString(),environment:postgres?'STAGING isolated PostgreSQL; pre-meeting legacy fixtures then runtime DML':'LOCAL in-memory PGlite; pre-meeting legacy fixtures',status:cases.length===2?'PASS':'FAIL',cases},null,2));
  await close();await owner.close();
 }
}
main().catch(error=>{console.error(error instanceof Error?error.message:'MIGRATION_QA_FAILED');process.exitCode=1;});
