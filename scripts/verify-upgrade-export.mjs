import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
const cfg=JSON.parse(readFileSync('.local/secrets.json'));const user=JSON.parse(readFileSync('.local/credentials.json')).admin;
const base=`http://127.0.0.1:${cfg.cms_port}/wp-json/cohamy/v1/ops/`;const headers={Authorization:'Basic '+Buffer.from(user.username+':'+user.application_password).toString('base64'),'Content-Type':'application/json'};
async function api(path,data){const r=await fetch(base+path,{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(90000)});const body=await r.json();assert(r.ok,JSON.stringify(body));return body;}
const started=Date.now();let report;let original;let extra;
async function native(path,data){const r=await fetch(`http://127.0.0.1:${cfg.cms_port}/wp-json/wp/v2/`+path,{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(90000)});const result=await r.json();assert(r.ok,JSON.stringify(result));return result;}
try {
 const selected=(await api('content?campaign_id=export-load-v2')).items[0];assert(selected);original=await native('posts/'+selected.wp_id+'?context=edit');const oldURL='https://cohamy.vn/vi/bai-viet/'+original.meta._cohamy_public_slug;
 const created=await api('exports',{format:'txt',indexable_only:true,campaign_id:'export-load-v2'});assert.equal(created.total,10001);
 const newSlug=original.meta._cohamy_public_slug+'-freeze-'+Date.now().toString(36);await native('posts/'+original.id,{meta:{_cohamy_public_slug:newSlug},status:'draft'});
 const extraSlug='export-freeze-extra-'+Date.now().toString(36);extra=await native('posts',{title:'Local export concurrent addition',content:'<p>LOCAL_EXPORT_FREEZE</p>',status:'publish',meta:{_cohamy_locale:'vi',_cohamy_public_slug:extraSlug,_cohamy_group_id:extraSlug,_cohamy_legacy_id:extraSlug,_cohamy_campaign_id:'export-load-v2',rank_math_robots:['index','follow']}});
 let job;const deadline=Date.now()+180000;while(Date.now()<deadline){job=(await api('exports')).find(j=>j.job_id===created.job_id);if(job?.state==='completed')break;await delay(2000);}assert.equal(job.state,'completed',JSON.stringify(job));
 const response=await fetch(base+'exports/'+created.job_id+'/download',{headers,signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);mkdirSync('.local/reports',{recursive:true});const file='.local/reports/export-10001.zip';writeFileSync(file,Buffer.from(await response.arrayBuffer()));
 const verified=JSON.parse(execFileSync('php',['-c','.local/php.ini','scripts/wordpress/check-export.php',file,oldURL,'https://cohamy.vn/vi/bai-viet/'+newSlug,'https://cohamy.vn/vi/bai-viet/'+extraSlug],{encoding:'utf8'}));assert.equal(verified.total,10001);assert(verified.frozen_membership);
 report={environment:'LOCAL / REAL WORDPRESS DATABASE + ACTION SCHEDULER',status:'PASS',job_id:created.job_id,elapsed_ms:Date.now()-started,total:verified.total,unique:verified.unique,files:verified.files,hashes_verified:true,frozen_membership:true,concurrent_changes:['slug changed','selected post unpublished','additional post published after selection'],manifest:verified.manifest};console.log(JSON.stringify(report,null,2));
}catch(error){report={status:'FAIL',error:error.message,elapsed_ms:Date.now()-started};console.error(error.message);process.exitCode=1;}
finally{if(original)await native('posts/'+original.id,{status:original.status,meta:{_cohamy_public_slug:original.meta._cohamy_public_slug}});if(extra)await native('posts/'+extra.id,{status:'draft',meta:{_cohamy_campaign_id:'export-freeze-excluded'}});mkdirSync('docs/content-upgrade/test-results',{recursive:true});writeFileSync('docs/content-upgrade/test-results/export.json',JSON.stringify(report,null,2));}
