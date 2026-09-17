import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {localBuildFile} from './wordpress/local-build.mjs';
import {acquireQaLock} from './wordpress/qa-lock.mjs';
const release=acquireQaLock('CMS TCP disconnect mutations');
const runtime=JSON.parse(readFileSync('.local/runtime.json'));const cfg=JSON.parse(readFileSync('.local/secrets.json'));const user=JSON.parse(readFileSync('.local/credentials.json')).admin;const cms=`http://127.0.0.1:${cfg.cms_port}`;const front=`http://127.0.0.1:${cfg.frontend_port}`;const build=readFileSync(localBuildFile(),'utf8');
async function restore(){const child=spawn(process.execPath,['scripts/wordpress/restore-cms-server.mjs',String(runtime.cms)],{windowsHide:true,stdio:'ignore'});child.unref();for(let i=0;i<60;i++){try{if((await fetch(cms+'/wp-json/cohamy/v1/revision',{signal:AbortSignal.timeout(2000)})).ok)return;}catch{}await delay(500);}throw new Error('Local CMS replacement did not become ready.');}
let killed=false;let restored=false;const results=[];
writeFileSync('.local/cron-pause','LOCAL TCP recovery verification');await delay(3000);
try{
 const probe=await fetch(cms+'/wp-json/cohamy/v1/ops/status',{headers:{Authorization:'Basic '+Buffer.from(user.username+':'+user.application_password).toString('base64')}});const state=await probe.json();assert(probe.ok && state.database && state.action_scheduler);process.kill(runtime.harness,0);process.kill(runtime.frontend,0);
 for(const path of ['/vi/bai-viet/e2e-mu5skjxi','/vi/bai-viet','/sitemap.xml'])assert.equal((await fetch(front+path)).status,200,path);
 process.kill(runtime.cms);killed=true;await delay(1000);let refused=false;try{await fetch(cms+'/wp-json/cohamy/v1/revision',{signal:AbortSignal.timeout(2000)});}catch{refused=true;}assert(refused,'CMS TCP must actually be unavailable.');
 for(const path of ['/vi/bai-viet/e2e-mu5skjxi','/vi/bai-viet','/sitemap.xml']){const r=await fetch(front+path,{signal:AbortSignal.timeout(20000)});const text=await r.text();assert.equal(r.status,503,path);assert(!text.includes('<sitemapindex'),'Failure must not return an empty sitemap.');results.push({path,status:'PASS',http_status:r.status,cms_transport:'TCP_CONNECTION_REFUSED'});}
 await restore();restored=true;for(const path of ['/vi/bai-viet/e2e-mu5skjxi','/vi/bai-viet','/sitemap.xml'])assert.equal((await fetch(front+path)).status,200,path);
 const after=JSON.parse(readFileSync('.local/runtime.json'));assert.equal(after.frontend,runtime.frontend);assert.equal(after.harness,runtime.harness);assert.equal(readFileSync(localBuildFile(),'utf8'),build);assert.notEqual(after.cms,runtime.cms);console.log('PASS actual CMS TCP disconnect -> honest 503 -> restored 200; Next PID/build unchanged');
}catch(e){results.push({status:'FAIL',error:e.message});console.error(e.message);process.exitCode=1;}finally{if(killed && !restored){await restore();restored=true;}unlinkSync('.local/cron-pause');writeFileSync('docs/headless/test-results/tcp-disconnect.json',JSON.stringify({environment:'LOCAL / ACTUAL WORDPRESS PROCESS STOP AND RESTORE / NEXT UNCHANGED',next_pid:runtime.frontend,build:build.trim(),results,finished_at:new Date().toISOString()},null,2));release();}
// Keep the replacement inside this supervised exec session. Its watchdog stops
// PHP when the original harness or Next exits; no detached service is installed.
if(restored)setInterval(()=>{try{process.kill(runtime.harness,0);process.kill(runtime.frontend,0);}catch{process.exit(0);}},2000);
