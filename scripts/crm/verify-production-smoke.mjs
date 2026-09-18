import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const [base,credentialPath,output]=process.argv.slice(2);
assert.ok(base&&credentialPath&&output);
const credentials=JSON.parse(await fs.readFile(credentialPath,'utf8'));
const origin='https://cohamy.vn',cases=[];
const check=async(name,fn)=>{await fn();cases.push({name,status:'PASS'});};
let cookie='';
const request=(path,options={})=>fetch(base+path,{redirect:'manual',...options,headers:{cookie,origin,...options.headers}});
try{
 await check('Health and retained configured blog source',async()=>{const r=await request('/api/health');assert.equal(r.status,200);const h=await r.json();assert.equal(h.ok,true);assert.equal(h.blogSource,process.env.BLOG_SOURCE??'legacy');});
 await check('Private request API requires authentication',async()=>{const r=await request('/api/crm/work/orders');assert.equal(r.status,401);assert.match(r.headers.get('cache-control'),/no-store/);});
 await check('Old localized CRM links recover to login',async()=>{for(const locale of ['vi','en','zh','ko','ja']){const r=await request('/'+locale+'/crm/login');assert.equal(r.status,307);assert.equal(new URL(r.headers.get('location'),base).pathname,'/crm/login');}assert.equal((await request('/crm/login')).status,200);});
 await check('Initial administrator authenticates against PostgreSQL',async()=>{const r=await request('/api/crm/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:credentials.email,password:credentials.password})});assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly/i);assert.match(r.headers.get('set-cookie'),/Secure/i);});
 await check('CRM pages render actual production data',async()=>{for(const path of ['/crm','/crm/orders','/crm/tasks','/crm/automation','/crm/customers','/crm/goods','/crm/reports','/crm/accounts','/crm/fields','/crm/workspace','/crm/notifications','/crm/audit','/portal/login','/portal/register']){const r=await request(path);assert.equal(r.status,200,path);const html=await r.text();assert.ok(!html.includes('LOCAL QA'),path);assert.match(r.headers.get('x-robots-tag'),/noindex/);}});
 await check('Scoped intake/task APIs preserve valid persisted responses',async()=>{const r=await request('/api/crm/work/orders');assert.equal(r.status,200);const orders=await r.json();assert.ok(Array.isArray(orders.items));assert.ok(Number.isInteger(orders.total)&&orders.total>=orders.items.length);const tasks=await request('/api/crm/work/tasks');assert.equal(tasks.status,200);assert.ok(Array.isArray((await tasks.json()).items));for(const action of ['schedules','rules','sla','escalations']){const response=await request('/api/crm/automation/'+action);assert.equal(response.status,200,action);assert.ok(Array.isArray(await response.json()),action);}});
 await check('Website and localized products remain available',async()=>{for(const path of ['/vi','/vi/san-pham','/vi/bai-viet','/sitemap.xml','/robots.txt'])assert.equal((await request(path)).status,200,path);});
 await check('Logout revokes server session',async()=>{assert.equal((await request('/api/crm/auth/logout',{method:'POST'})).status,200);assert.equal((await request('/api/crm/work/orders')).status,401);});
 await fs.writeFile(output,JSON.stringify({environment:base,scope:'read-only except administrator login/logout; no order, partner, task or outbound-message writes',testedAt:new Date().toISOString(),cases},null,2)+'\n');
 console.log('PASS '+cases.length+' production smoke checks');
}finally{if(cookie)await request('/api/crm/auth/logout',{method:'POST'}).catch(()=>{});}
