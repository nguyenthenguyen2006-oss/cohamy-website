import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {parseEnv} from 'node:util';
import {Pool} from 'pg';
if(process.platform==='win32'||process.env.CRM_ENVIRONMENT!=='STAGING'||!process.cwd().startsWith('/root/cohamy-qa/'))throw new Error('ISOLATED_VPS_PM2_QA_REQUIRED');
const release=process.argv[2];if(!/^\/root\/cohamy-releases\/[a-f0-9]{40}$/.test(release??''))throw new Error('COMMITTED_RELEASE_REQUIRED');
const pm2='/root/.nvm/versions/node/v20.19.6/bin/pm2',key=randomUUID().replaceAll('-',''),names=['cohamy-qa-runtime-'+key,'cohamy-qa-runtime-'+key+'-worker'],directory=process.cwd()+'/reports/runtime-'+key,cases=[];
const pm=args=>execFileSync(pm2,args,{encoding:'utf8',env:{...process.env,PATH:'/root/cohamy-shared/node22/bin:'+process.env.PATH}});
const state=()=>JSON.parse(pm(['jlist'])).filter(a=>names.includes(a.name)).map(a=>({name:a.name,pid:a.pid,status:a.pm2_env.status,cwd:a.pm2_env.pm_cwd,restarts:a.pm2_env.restart_time}));
const privateEnv=parseEnv(await fs.readFile('/root/cohamy-shared/postgres.env','utf8')),dbName='cohamy_qa_governance_20260919b';
const connection='postgresql://cohamy_owner:'+privateEnv.POSTGRES_PASSWORD+'@127.0.0.1:55432/'+dbName,pool=new Pool({connectionString:connection});
const role='qa_runtime_'+key.slice(0,16),password=randomBytes(24).toString('hex');
await pool.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}';GRANT CONNECT ON DATABASE "${dbName}" TO "${role}";GRANT USAGE ON SCHEMA cohamy_crm TO "${role}";GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA cohamy_crm TO "${role}";REVOKE ALL ON cohamy_crm.migrations FROM "${role}";`);
await fs.mkdir(directory,{recursive:true,mode:0o700});const envFile=directory+'/worker.env';await fs.writeFile(envFile,'CRM_ENVIRONMENT=STAGING\nCRM_DATABASE_MODE=postgres\nCRM_DATABASE_URL=postgresql://'+role+':'+password+'@127.0.0.1:55432/'+dbName+'\n',{mode:0o600});
const proposed=process.argv[3];if(proposed&&!proposed.startsWith(process.cwd()+'/reports/'))throw new Error('QA_PROPOSED_CONFIG_PATH_REQUIRED');
const original=createRequire(import.meta.url)(proposed??release+'/ecosystem.config.js'),config=directory+'/pm2.json';
original.apps.forEach((a,i)=>{a.name=names[i];a.interpreter='/root/cohamy-shared/node22/bin/node';a.cwd=release;if(i===0)a.args='start --hostname localhost --port 4314';else a.node_args=['--env-file='+envFile,'--require',release+'/scripts/register-server-only.cjs','--import','tsx'];a.env_production={NODE_ENV:'production',CRM_ENVIRONMENT:'STAGING',CRM_DATABASE_MODE:'postgres',CRM_DATABASE_URL:'postgresql://'+role+':'+password+'@127.0.0.1:55432/'+dbName};});
await fs.writeFile(config,JSON.stringify(original),{mode:0o600});let snapshots=[];
try{
 pm(['start',config,'--only',names.join(','),'--env','production','--update-env']);await new Promise(resolve=>setTimeout(resolve,1500));
 for(const path of ['/api/health','/crm/login','/crm/tasks','/crm/workspace','/portal/register','/vi','/vi/san-pham','/sitemap.xml']){const r=await fetch('http://localhost:4314'+path);assert.equal(r.status,200,path);await r.arrayBuffer();}
 await new Promise(resolve=>setTimeout(resolve,35000));snapshots=state();
 await fs.writeFile('reports/managed-runtime.json',JSON.stringify({testedAt:new Date().toISOString(),release,environment:'STAGING exact committed app/worker source, independent PostgreSQL and isolated PM2 names/port',status:'CHECKING',snapshots},null,2));
 assert.equal(snapshots.length,2);assert.ok(snapshots.every(a=>a.status==='online'&&a.cwd===release&&a.restarts===0));cases.push({name:'Exact committed web and worker remain online at release cwd with zero restarts',status:'PASS'});
 assert.equal((await fetch('http://localhost:4314/api/health')).status,200);cases.push({name:'Isolated managed Next health responds on candidate port',status:'PASS'});
 await new Promise(resolve=>setTimeout(resolve,6000));const again=state();assert.ok(again.every(a=>a.pid===snapshots.find(b=>b.name===a.name).pid&&a.restarts===0));cases.push({name:'Web and worker maintain original PIDs through another worker polling cycle',status:'PASS'});
 const memory=snapshots.map(a=>({name:a.name,rssKiB:Number(execFileSync('ps',['-o','rss=','-p',String(a.pid)],{encoding:'utf8'}).trim())}));
 await fs.writeFile('reports/managed-runtime.json',JSON.stringify({testedAt:new Date().toISOString(),release,proposedConfig:proposed??null,environment:'STAGING exact app/worker source, independent PostgreSQL, temporary PM2 names/port; no production business writes',status:'PASS',cases,snapshots,memory,steadyWaitMs:35000},null,2));console.log('PASS managed runtime '+cases.length+'/3');
}catch(e){await fs.writeFile('reports/managed-runtime.json',JSON.stringify({testedAt:new Date().toISOString(),release,environment:'STAGING',status:'FAIL',cases,snapshots,error:e.message},null,2));throw e;}
finally{for(const name of names){try{pm(['delete',name]);}catch{}}await pool.end();}
