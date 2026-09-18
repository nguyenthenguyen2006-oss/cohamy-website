import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Pool} from 'pg';
const target=new URL(process.env.CRM_DATABASE_URL??'');
if(process.platform==='win32'||process.env.CRM_ENVIRONMENT!=='STAGING'||target.hostname!=='127.0.0.1'||target.port!=='55432'||!/^\/cohamy_qa_[a-z0-9_]+$/.test(target.pathname))throw new Error('ISOLATED_VPS_POSTGRES_QA_REQUIRED');
const pm2='/root/.nvm/versions/node/v20.19.6/bin/pm2',key=randomUUID().replaceAll('-',''),name='cohamy-qa-care-worker-'+key,config='reports/care-worker-'+key+'.json',cases:{name:string;status:string}[]=[];
const pm=(args:string[])=>execFileSync(pm2,args,{stdio:['ignore','pipe','pipe'],env:{...process.env,PATH:'/root/cohamy-shared/node22/bin:'+process.env.PATH},encoding:'utf8'});
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitUntil(run:()=>Promise<boolean>,timeout=30000){const end=Date.now()+timeout;do{if(await run())return;await sleep(500);}while(Date.now()<end);throw new Error('QA_CARE_WORKER_WAIT_TIMEOUT');}
async function main(){
 const {database}=await import('../../lib/crm/db'),{login}=await import('../../lib/crm/auth'),care=await import('../../lib/crm/care-automation'),{qaPassword}=await import('./qa-fixture'),db=await database(),admin=(await login('admin@crm-qa.invalid',qaPassword)).user;
 const org=(await db.query<{id:string}>("SELECT id FROM cohamy_crm.organizations WHERE code='QA_A'")).rows[0];assert.ok(org);
 const title='STAGING QA recovery schedule '+key,schedule=await care.saveCareSchedule(admin,{version:0,entityType:'partner',entityId:org.id,title,assigneeId:admin.membershipId,kind:'FOLLOW_UP',frequency:'DAILY',every:1,nextDueAt:new Date(Date.now()-60000).toISOString(),enabled:true});
 const role='qa_care_'+key.slice(0,16),password=randomBytes(24).toString('hex'),workerTarget=new URL(target);workerTarget.username=role;workerTarget.password=password;workerTarget.searchParams.set('application_name',name);
 await db.exec(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}';GRANT CONNECT ON DATABASE "${target.pathname.slice(1)}" TO "${role}";GRANT USAGE ON SCHEMA cohamy_crm TO "${role}";GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA cohamy_crm TO "${role}";REVOKE ALL ON cohamy_crm.migrations FROM "${role}";REVOKE UPDATE,DELETE ON cohamy_crm.care_schedule_runs,cohamy_crm.care_rule_runs,cohamy_crm.care_escalations,cohamy_crm.activity_mentions FROM "${role}";`);
 await fs.mkdir('reports',{recursive:true});await fs.writeFile(config,JSON.stringify({apps:[{name,cwd:process.cwd(),script:'scripts/crm/worker.ts',interpreter:'/root/cohamy-shared/node22/bin/node',node_args:['--require','./scripts/register-server-only.cjs','--import','tsx'],autorestart:true,watch:false,env:{NODE_ENV:'production',CRM_ENVIRONMENT:'STAGING',CRM_DATABASE_MODE:'postgres',CRM_DATABASE_URL:workerTarget.href}}]}),{mode:0o600});
 const pool=new Pool({connectionString:target.href,max:1}),lock=await pool.connect();let locked=false,managed=false;const started=Date.now();
 const count=async()=>Number((await db.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.tasks WHERE title=$1',[title])).rows[0].n);
 try{
  await lock.query('BEGIN');await lock.query('SELECT id FROM cohamy_crm.organizations WHERE id=$1 FOR UPDATE',[org.id]);locked=true;
  pm(['start',config]);managed=true;await waitUntil(async()=>(await db.query("SELECT pid FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'",[name])).rows.length>0);
  assert.equal(await count(),0);assert.equal((await care.scheduleRuns(admin,schedule.id)).length,0);cases.push({name:'Actual worker waits on parent row lock with no committed task or schedule outcome',status:'PASS'});console.log('PASS care transaction blocked without partial business writes');
  const originalPid=Number(pm(['pid',name]).trim());assert.ok(originalPid>0);process.kill(originalPid,'SIGKILL');await waitUntil(async()=>{const pid=Number(pm(['pid',name]).trim());return pid>0&&pid!==originalPid;});assert.equal(await count(),0);cases.push({name:'PM2 automatically restarts the killed worker; PostgreSQL aborts its unfinished transaction',status:'PASS'});console.log('PASS actual care worker killed and automatically restarted');
  await lock.query('ROLLBACK');locked=false;await waitUntil(async()=>{const rows=await care.scheduleRuns(admin,schedule.id);return rows.length===1&&rows[0].status==='SUCCEEDED';});assert.equal(await count(),1);cases.push({name:'Restarted worker recovers the unchanged due occurrence and commits exactly one task',status:'PASS'});
  pm(['restart',name]);await sleep(6000);assert.equal(await count(),1);assert.equal((await care.scheduleRuns(admin,schedule.id)).length,1);cases.push({name:'Another supervised restart preserves one successful occurrence without duplicate work',status:'PASS'});console.log('PASS care worker recovery 4/4');
 }finally{if(locked)await lock.query('ROLLBACK').catch(()=>{});lock.release();await pool.end();if(managed)pm(['delete',name]);await fs.unlink(config).catch(()=>{});await fs.writeFile('reports/care-worker-postgres.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'STAGING independent PostgreSQL, actual temporary PM2 worker, fictitious care schedule',status:cases.length===4?'PASS':'FAIL',elapsedMs:Date.now()-started,clockOrScheduleAdvancedByFixture:false,cases},null,2));await db.close();}
}
main().catch(e=>{console.error(e instanceof Error?e.message:'CARE_WORKER_QA_FAILED');process.exitCode=1;});
