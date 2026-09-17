import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {localBuildFile} from './wordpress/local-build.mjs';
import {acquireQaLock} from './wordpress/qa-lock.mjs';

const before=JSON.parse(readFileSync('.local/runtime.json'));
const cfg=JSON.parse(readFileSync('.local/secrets.json'));
const admin=JSON.parse(readFileSync('.local/credentials.json')).admin;
const root=`http://127.0.0.1:${cfg.cms_port}`;
const front=`http://127.0.0.1:${cfg.frontend_port}`;
const auth='Basic '+Buffer.from(admin.username+':'+admin.application_password).toString('base64');
const build=readFileSync(localBuildFile(),'utf8');
const release=acquireQaLock('CMS restart mutations');
const run='restart-'+Date.now().toString(36);
const due=Math.ceil(Date.now()/60000)*60000+60000;
const dailyAt=new Date(due+7*3600000).toISOString().slice(11,16);
let stopped=false,restored=false,campaign;
const report={environment:'LOCAL / ACTUAL PHP CMS PROCESS RESTART WITH PERSISTED PENDING ACTION SCHEDULER JOB',status:'NOT RUN',scope:'HTTP PHP server restarted; system cron dispatch paused then resumed with new PHP CLI workers. This is not an OS/VPS reboot or hard-kill inside an open transaction.',due_utc:new Date(due).toISOString(),daily_at_vn:dailyAt};
async function api(path,data,status=200){const r=await fetch(root+'/wp-json/cohamy/v1/ops/'+path,{method:data?'POST':'GET',headers:{Authorization:auth,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(90000)});const json=await r.json();assert.equal(r.status,status,JSON.stringify(json));return json;}
async function restore(){const child=spawn(process.execPath,['scripts/wordpress/restore-cms-server.mjs',String(before.cms)],{windowsHide:true,stdio:'ignore'});child.unref();for(let i=0;i<60;i++){try{if((await fetch(root+'/wp-json/cohamy/v1/revision',{signal:AbortSignal.timeout(2000)})).ok){restored=true;return;}}catch{}await delay(500);}throw Error('CMS recovery did not become ready.');}
writeFileSync('.local/cron-pause','LOCAL persisted campaign restart test');
try{
  await delay(3000);process.kill(before.harness,0);process.kill(before.frontend,0);
  for(let i=1;i<=3;i++)await api('entities',{entity_id:run+'-l'+i,kind:'record',name:'Địa điểm restart '+i,state:'approved',payload:{type:'location',fields:{slug:run+'-l'+i},reference_source:'https://cohamy.vn',reference_date:'2026-09-18'}});
  for(let i=1;i<=2;i++)await api('entities',{entity_id:run+'-t'+i,kind:'template',name:'Template restart '+i,state:'approved',payload:{title:'Cohamy restart '+i+' {{location.name}}',slug:run+'-t'+i+'-{{location.slug}}',content_html:'<h2>Cohamy</h2><p>ACTUAL_PENDING_RESTART_'+run+' {{location.name}}</p>',seo_title:'Cohamy {{location.name}}',seo_description:'Nội dung QA restart đã lưu server.',locale:'vi',category:'brand-story',required_variables:['location.name','location.slug']}});
  const input={templates:[run+'-t1',run+'-t2'],locations:[run+'-l1',run+'-l2',run+'-l3'],publish_mode:'published',batch_size:1,daily_quota:20,daily_at:dailyAt};
  assert.equal((await api('campaigns/preview',input)).new,6);
  campaign=await api('campaigns',{...input,confirmed:true},201);
  assert(campaign.items.every(item=>item.state==='queued' && Number(item.post_id)===0));
  report.campaign_id=campaign.campaign_id;report.items_at_stop=6;
  process.kill(before.cms);stopped=true;await delay(1000);
  let refused=false;try{await fetch(root+'/wp-json/cohamy/v1/revision',{signal:AbortSignal.timeout(2000)});}catch{refused=true;}assert(refused,'CMS TCP must really stop.');
  await restore();const persisted=await api('campaigns/'+campaign.campaign_id);
  assert.deepEqual(persisted.items.map(x=>x.item_key).sort(),campaign.items.map(x=>x.item_key).sort());
  assert(persisted.items.every(item=>item.state==='queued' && Number(item.post_id)===0));
  report.pending_items_survived_restart=6;unlinkSync('.local/cron-pause');
  const deadline=Date.now()+240000;let finished;
  while(Date.now()<deadline){finished=await api('campaigns/'+campaign.campaign_id);if(finished.state==='completed')break;await delay(2000);}
  assert.equal(finished.state,'completed',JSON.stringify(finished));assert.equal(finished.items.length,6);assert.equal(new Set(finished.items.map(x=>Number(x.post_id))).size,6);
  for(const item of finished.items){assert(item.state==='completed' && Number(item.post_id)>0);const r=await fetch(front+new URL(item.public_url).pathname);assert.equal(r.status,200);assert((await r.text()).includes('ACTUAL_PENDING_RESTART_'+run));}
  assert.equal((await api('campaigns/preview',input)).new,0);
  const after=JSON.parse(readFileSync('.local/runtime.json'));assert.notEqual(after.cms,before.cms);assert.equal(after.frontend,before.frontend);assert.equal(after.harness,before.harness);assert.equal(readFileSync(localBuildFile(),'utf8'),build);
  Object.assign(report,{status:'PASS',published_after_restart:6,rerun_new:0,cms_pid_before:before.cms,cms_pid_after:after.cms,next_pid:after.frontend,build:build.trim(),finished_at:new Date().toISOString()});
  console.log('PASS pending6 survived actual CMS restart; native cron published6 at real wall-clock time; rerun0, same Next PID/build');
}catch(error){report.status='FAIL';report.error=error.message;process.exitCode=1;console.error(error.message);}
finally{if(stopped&&!restored)await restore();try{unlinkSync('.local/cron-pause');}catch{}writeFileSync('docs/content-upgrade/test-results/cms-restart.json',JSON.stringify(report,null,2));release();}
// Keep the restored server inside this supervised tool session until the owning harness stops.
if(restored)setInterval(()=>{try{process.kill(before.harness,0);process.kill(before.frontend,0);}catch{process.exit(0);}},2000);
