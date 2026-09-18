import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Pool} from 'pg';
import ExcelJS from 'exceljs';
const target=new URL(process.env.CRM_DATABASE_URL??'');
if(process.platform==='win32'||process.env.CRM_ENVIRONMENT!=='STAGING'||target.hostname!=='127.0.0.1'||target.port!=='55432'||!/^\/cohamy_qa_[a-z0-9_]+$/.test(target.pathname))throw new Error('ISOLATED_VPS_POSTGRES_QA_REQUIRED');
const pm2='/root/.nvm/versions/node/v20.19.6/bin/pm2',key=randomUUID().replaceAll('-',''),name='cohamy-qa-worker-'+key,config='reports/worker-'+key+'.json',cases:{name:string;status:string}[]=[];
const pm=(args:string[])=>execFileSync(pm2,args,{stdio:['ignore','pipe','pipe'],env:{...process.env,PATH:'/root/cohamy-shared/node22/bin:'+process.env.PATH},encoding:'utf8'});
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitUntil(run:()=>Promise<boolean>,timeout:number){const end=Date.now()+timeout;do{if(await run())return;await sleep(500);}while(Date.now()<end);throw new Error('QA_WORKER_WAIT_TIMEOUT');}
async function main(){
 const {database}=await import('../../lib/crm/db'),{login}=await import('../../lib/crm/auth'),jobs=await import('../../lib/crm/data-jobs'),{qaPassword}=await import('./qa-fixture'),db=await database(),admin=(await login('admin@crm-qa.invalid',qaPassword)).user;
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Data');sheet.addRow(['Code','Name']);sheet.addRow(['QA_PG_'+key.slice(0,10)+'_1','STAGING QA worker one']);sheet.addRow(['QA_PG_'+key.slice(0,10)+'_2','STAGING QA worker two']);
 const job=await jobs.previewImport(admin,Buffer.from(await book.xlsx.writeBuffer()),{idempotencyKey:randomUUID(),kind:'CUSTOMER',mapping:{code:1,name:2}});await jobs.confirmImport(admin,job.id);
 const role='qa_worker_'+key.slice(0,16),password=randomBytes(24).toString('hex'),workerTarget=new URL(target);workerTarget.username=role;workerTarget.password=password;
 await db.exec(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}';GRANT CONNECT ON DATABASE "${target.pathname.slice(1)}" TO "${role}";GRANT USAGE ON SCHEMA cohamy_crm TO "${role}";GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA cohamy_crm TO "${role}";REVOKE ALL ON cohamy_crm.migrations FROM "${role}";`);
 await fs.mkdir('reports',{recursive:true});await fs.writeFile(config,JSON.stringify({apps:[{name,cwd:process.cwd(),script:'scripts/crm/worker.ts',interpreter:'/root/cohamy-shared/node22/bin/node',node_args:['--require','./scripts/register-server-only.cjs','--import','tsx'],autorestart:true,watch:false,env:{NODE_ENV:'production',CRM_ENVIRONMENT:'STAGING',CRM_DATABASE_MODE:'postgres',CRM_DATABASE_URL:workerTarget.href}}]}),{mode:0o600});
 const pool=new Pool({connectionString:target.href,max:1}),lock=await pool.connect();const read=async()=>(await db.query<{status:string;attempts:number;lease_until:string;result:{imported?:number};error:string}>('SELECT status,attempts,lease_until,result,error FROM cohamy_crm.data_jobs WHERE id=$1',[job.id])).rows[0];let locked=false,managed=false;const started=Date.now();
 try{
  await lock.query('BEGIN');await lock.query('LOCK TABLE cohamy_crm.organizations IN ACCESS EXCLUSIVE MODE');locked=true;
  pm(['start',config]);managed=true;await waitUntil(async()=>(await read()).status==='RUNNING',30000);
  assert.equal((await read()).attempts,1);assert.equal((await lock.query('SELECT id FROM cohamy_crm.organizations WHERE import_job_id=$1',[job.id])).rows.length,0);
  cases.push({name:'Actual managed worker commits claim; blocked business transaction has zero partial writes',status:'PASS'});console.log('PASS worker committed claim; killing actual managed process');
  const originalPid=Number(pm(['pid',name]).trim());assert.ok(originalPid>0);process.kill(originalPid,'SIGKILL');await waitUntil(async()=>{const pid=Number(pm(['pid',name]).trim());return pid>0&&pid!==originalPid;},30000);
  await lock.query('ROLLBACK');locked=false;assert.equal((await read()).attempts,1);cases.push({name:'PM2 automatically restarts killed worker before its unmodified lease expires',status:'PASS'});console.log('PASS PM2 automatic PID restart; waiting real two-minute lease');
  await waitUntil(async()=>(await read()).status==='SUCCEEDED',150000);const completed=await read();assert.equal(completed.attempts,2);assert.equal(completed.result.imported,2);assert.equal((await db.query('SELECT id FROM cohamy_crm.organizations WHERE import_job_id=$1',[job.id])).rows.length,2);
  cases.push({name:'Real lease expiry is recovered once under PostgreSQL, with two rows and no clock/lease manipulation',status:'PASS'});console.log('PASS actual lease expired and recovered once');
  pm(['restart',name]);await sleep(6000);assert.equal((await read()).attempts,2);assert.equal((await db.query('SELECT id FROM cohamy_crm.organizations WHERE import_job_id=$1',[job.id])).rows.length,2);cases.push({name:'Second supervised restart preserves success and exact imported row counts',status:'PASS'});
 }finally{if(locked)await lock.query('ROLLBACK').catch(()=>{});lock.release();await pool.end();if(managed)pm(['delete',name]);await fs.unlink(config).catch(()=>{});await fs.writeFile('reports/worker-postgres.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'STAGING independent PostgreSQL, temporary PM2 QA worker, fictitious import',status:cases.length===4?'PASS':'FAIL',elapsedMs:Date.now()-started,leaseAdvancedByFixture:false,cases},null,2));await db.close();}
}
main().catch(e=>{console.error(e instanceof Error?e.message:'POSTGRES_WORKER_QA_FAILED');process.exitCode=1;});
