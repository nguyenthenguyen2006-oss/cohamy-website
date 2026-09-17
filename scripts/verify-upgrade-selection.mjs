import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {localBuildFile} from './wordpress/local-build.mjs';

const cfg=JSON.parse(readFileSync('.local/secrets.json'));
const admin=JSON.parse(readFileSync('.local/credentials.json')).admin;
const root=`http://127.0.0.1:${cfg.cms_port}/wp-json/cohamy/v1/ops/`;
const auth='Basic '+Buffer.from(admin.username+':'+admin.application_password).toString('base64');
const runtime=readFileSync('.local/runtime.json','utf8');
const build=readFileSync(localBuildFile(),'utf8');
const results=[];
async function api(path,data,status=200){
  const r=await fetch(root+path,{method:data?'POST':'GET',headers:{Authorization:auth,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(90000)});
  const body=await r.json();assert.equal(r.status,status,JSON.stringify(body));return body;
}
try{
  const c=await api('campaigns/d4afc807-cb4e-40bd-94d5-567b404f7028');
  const ids=c.items.map(item=>Number(item.post_id));assert.equal(ids.length,2);
  await api('exports',{format:'csv',wp_ids:'1,invalid'},400);
  const started=await api('exports',{format:'csv',wp_ids:[...ids,ids[0]],locale:'vi',content_type:'post',indexable_only:true},201);
  assert.equal(started.total,2);
  let job;for(let i=0;i<60;i++){job=(await api('exports')).find(row=>row.job_id===started.job_id);if(job?.state==='completed')break;await delay(2000);}
  assert.equal(job?.state,'completed',JSON.stringify(job));
  const r=await fetch(root+`exports/${started.job_id}/download`,{headers:{Authorization:auth}});assert.equal(r.status,200);
  mkdirSync('.local/reports',{recursive:true});const zip='.local/reports/selected-export.zip';writeFileSync(zip,Buffer.from(await r.arrayBuffer()));
  const meta=JSON.parse(execFileSync(process.env.PHP_BINARY || 'php',['-c','.local/php.ini','scripts/wordpress/check-export-metadata.php',zip],{encoding:'utf8'}));
  assert.equal(meta.rows,2);assert.equal(meta.columns,6);
  const text=execFileSync(process.env.PHP_BINARY || 'php',['-c','.local/php.ini','scripts/wordpress/read-export-urls.php',zip],{encoding:'utf8'});
  const exported=JSON.parse(text);assert.deepEqual(exported.sort(),c.items.map(item=>item.public_url).sort());
  results.push({name:'Selected WordPress IDs freeze exactly two URLs with metadata, dedup and invalid-ID refusal',status:'PASS',job_id:started.job_id,total:2});
  const review=JSON.parse(execFileSync(process.env.PHP_BINARY || 'php',['-c','.local/php.ini','scripts/wordpress/verify-duplicate-review.php'],{encoding:'utf8'}));
  assert.equal(review.status,'PASS');results.push(review);
  assert.equal(readFileSync('.local/runtime.json','utf8'),runtime);assert.equal(readFileSync(localBuildFile(),'utf8'),build);
}catch(error){results.push({name:'Selection/review verification',status:'FAIL',error:error.message});console.error(error.message);process.exitCode=1;}
finally{mkdirSync('docs/content-upgrade/test-results',{recursive:true});writeFileSync('docs/content-upgrade/test-results/selection.json',JSON.stringify({environment:'LOCAL / REAL WORDPRESS DATABASE + ACTION SCHEDULER',build:build.trim(),runtime:JSON.parse(runtime),results,finished_at:new Date().toISOString()},null,2));console.log(JSON.stringify(results));}
