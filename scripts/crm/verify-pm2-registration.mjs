import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
if(process.platform==='win32'||process.env.CRM_ENVIRONMENT!=='STAGING'||!process.cwd().startsWith('/root/cohamy-qa/'))throw new Error('ISOLATED_VPS_PM2_QA_REQUIRED');
const pm2='/root/.nvm/versions/node/v20.19.6/bin/pm2',key=randomUUID(),names=['cohamy-qa-registration-'+key,'cohamy-qa-registration-'+key+'-worker'],directory='reports/registration-'+key,cases=[];
const pm=args=>execFileSync(pm2,args,{encoding:'utf8',env:{...process.env,PATH:'/root/cohamy-shared/node22/bin:'+process.env.PATH}});
const state=()=>JSON.parse(pm(['jlist'])).filter(a=>names.includes(a.name)).map(a=>({name:a.name,pid:a.pid,status:a.pm2_env.status,restarts:a.pm2_env.restart_time}));
await fs.mkdir(directory,{recursive:true,mode:0o700});await fs.writeFile(directory+'/fixture.cjs','setInterval(()=>{},1000);',{mode:0o600});
const config=directory+'/pm2.json';await fs.writeFile(config,JSON.stringify({apps:names.map(name=>({name,cwd:process.cwd(),script:directory+'/fixture.cjs',interpreter:'/root/cohamy-shared/node22/bin/node',autorestart:true,watch:false}))}),{mode:0o600});
try{
 pm(['start',config,'--only',names[0]]);const first=state()[0];pm(['start',config,'--only',names[1]]);await new Promise(resolve=>setTimeout(resolve,1000));const separate=state();
 const original=separate.find(a=>a.name===names[0]);assert.equal(original.restarts,first.restarts);assert.equal(original.pid,first.pid);cases.push({name:'Separate exact-name PM2 starts preserve the original fixture PID and restart count; prefix hypothesis ruled out',status:'PASS'});
 for(const name of names)pm(['delete',name]);pm(['start',config,'--only',names.join(',')]);await new Promise(resolve=>setTimeout(resolve,1500));const combined=state();assert.equal(combined.length,2);assert.ok(combined.every(a=>a.status==='online'&&a.restarts===0));cases.push({name:'Single PM2 registration with both exact names starts both with zero restarts',status:'PASS'});
 await fs.writeFile('reports/pm2-registration.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'STAGING isolated temporary PM2 app fixtures; no production processes changed',status:'PASS',cases,separate,combined},null,2));console.log('PASS PM2 registration '+cases.length+'/2');
}finally{for(const name of names){try{pm(['delete',name]);}catch{}}}
