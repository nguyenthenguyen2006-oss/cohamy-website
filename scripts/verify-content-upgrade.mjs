import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
const config=JSON.parse(readFileSync('.local/secrets.json','utf8'));
const users=JSON.parse(readFileSync('.local/credentials.json','utf8'));
const cms=`http://127.0.0.1:${config.cms_port}`;
const front=`http://127.0.0.1:${config.frontend_port}`;
const run='upgrade-'+Date.now().toString(36);
const results=[];
async function wp(path,data,role='admin',expected=200) {
  const user=users[role]; const response=await fetch(cms+'/wp-json/cohamy/v1/'+path,{method:data?'POST':'GET',headers:{Authorization:'Basic '+Buffer.from(user.username+':'+user.application_password).toString('base64'),'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(30000)});
  const body=await response.json(); assert.equal(response.status,expected,JSON.stringify(body)); return body;
}
async function check(name,fn) { try { const detail=await fn(); results.push({name,status:'PASS',detail}); console.log('PASS '+name+': '+detail); } catch(error) { results.push({name,status:'FAIL',detail:error.message}); throw error; } }
async function main() {
  let campaign;
  await check('WordPress database and Action Scheduler',async()=>{ const status=await wp('ops/status'); assert.equal(status.action_scheduler,true); assert.equal(status.timezone,'Asia/Ho_Chi_Minh'); assert(status.database); return JSON.stringify(status); });
  await check('2 approved templates × 3 approved locations preview',async()=>{
    for(let i=1;i<=3;i++) await wp('ops/entities',{entity_id:run+'-l'+i,kind:'record',name:'Địa điểm '+i,state:'approved',payload:{type:'location',fields:{slug:run+'-location-'+i},reference_source:'https://cohamy.vn',reference_date:'2026-09-18',expires_at:'2030-01-01'}});
    for(let i=1;i<=2;i++) await wp('ops/entities',{entity_id:run+'-t'+i,kind:'template',name:'Template '+i,state:'approved',payload:{title:'Cohamy '+i+' tại {{location.name}}',slug:run+'-'+i+'-{{location.slug}}',content_html:'<h2>Cohamy</h2><p>CAMPAIGN_REAL_'+run+' tại {{location.name}}.</p>',seo_title:'Cohamy '+i+' tại {{location.name}}',seo_description:'Tìm hiểu Cohamy tại {{location.name}}.',locale:'vi',category:'brand-story',required_variables:['location.name','location.slug']}});
    const input={name:run,templates:[run+'-t1',run+'-t2'],locations:[run+'-l1',run+'-l2',run+'-l3'],publish_mode:'published',batch_size:2};
    const preview=await wp('ops/campaigns/preview',input); assert(preview.valid); assert.equal(preview.new,6); assert.equal(preview.errors.length,0);
    campaign=await wp('ops/campaigns',{...input,confirmed:true},'admin',201); return '6 valid combinations, actual database campaign '+campaign.campaign_id;
  });
  await check('Durable Action Scheduler produces six real public posts',async()=>{
    const end=Date.now()+120000;
    while(Date.now()<end) { campaign=await wp('ops/campaigns/'+campaign.campaign_id); if(campaign.state==='completed') break; await delay(2000); }
    assert.equal(campaign.state,'completed',JSON.stringify(campaign)); assert.equal(campaign.items.length,6); assert(campaign.items.every(i=>i.state==='completed'&&Number(i.post_id)>0),JSON.stringify(campaign.items));
    for (const item of campaign.items) { const post=await (await fetch(cms+'/wp-json/wp/v2/posts/'+item.post_id)).json(); assert.equal(post.status,'publish'); }
    return 'All 6 real WordPress posts published by server queue; no browser involved';
  });
  await check('Re-running same template/location creates no duplicate',async()=>{ const preview=await wp('ops/campaigns/preview',{templates:[run+'-t1',run+'-t2'],locations:[run+'-l1',run+'-l2',run+'-l3']}); assert.equal(preview.new,0); assert.equal(preview.duplicates,6); return 'Stable unique keys reused; six skipped'; });
  await check('Expired data and missing variables fail server validation',async()=>{
    await wp('ops/entities',{entity_id:run+'-expired',kind:'record',name:'Nguồn đã hết hạn',state:'approved',payload:{type:'location',fields:{slug:'expired'},expires_at:'2000-01-01'}});
    const preview=await wp('ops/campaigns/preview',{templates:[run+'-t1'],locations:[run+'-expired']}); assert(!preview.valid); assert(preview.errors[0].error.includes('hết hạn'));
    await wp('ops/entities',{entity_id:run+'-missing',kind:'record',name:'Thiếu slug',state:'approved',payload:{type:'location',fields:{description:'Nguồn thiếu biến'}}});const missing=await wp('ops/campaigns/preview',{templates:[run+'-t1'],locations:[run+'-missing']});assert(!missing.valid && missing.errors[0].error.includes('Thiếu biến'));
    await wp('ops/entities',{entity_id:run+'-conflict',kind:'record',name:'Nguồn mâu thuẫn',state:'approved',payload:{type:'location',fields:{slug:run+'-conflict',country_id:'country-location'}}});await wp('ops/entities',{entity_id:run+'-conflict-template',kind:'template',name:'Template mâu thuẫn',state:'approved',payload:{title:'Cohamy',slug:run+'-conflict-{{location.slug}}',content_html:'<p>Cohamy có nguồn.</p>',locale:'vi',category:'brand-story',country_id:'country-template'}});const conflict=await wp('ops/campaigns/preview',{templates:[run+'-conflict-template'],locations:[run+'-conflict']});assert(!conflict.valid && conflict.errors[0].error.includes('mâu thuẫn'));return 'Expired source, missing required variable and conflicting country references all blocked before post creation';
  });
  await check('Writer cannot operate campaigns or configure credentials',async()=>{ await wp('ops/campaigns/preview',{templates:[],locations:[]},'writer',403); await wp('ops/connections',{type:'indexnow',enabled:true},'writer',403); return 'Real WordPress Application Password permissions return 403'; });
  await check('Redirect loop rejected and missing provider is explicit',async()=>{
    await wp('ops/redirects',{source:'/vi/'+run+'-old',target:'/vi/'+run+'-new',code:301,enabled:true});
    await wp('ops/redirects',{source:'/vi/'+run+'-new',target:'/vi/'+run+'-old',code:301,enabled:true},'admin',409);
    await wp('ops/ai/generate',{records:[run+'-l1']},'admin',503); return 'Loop 409, AI unconnected 503; no simulated success';
  });
  const response=await fetch(front+'/vi/bai-viet'); assert.equal(response.status,200);
}
try { await main(); } catch(error) { console.error(error); process.exitCode=1; }
finally { mkdirSync('docs/content-upgrade/test-results',{recursive:true}); writeFileSync('docs/content-upgrade/test-results/backend.json',JSON.stringify({environment:'LOCAL / REAL WORDPRESS + RANK MATH + ACTION SCHEDULER',run,finished_at:new Date().toISOString(),results},null,2)); }
