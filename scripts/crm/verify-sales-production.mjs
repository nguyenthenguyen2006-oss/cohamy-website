import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Read business data only. The existing Admin credential never leaves the VPS.
const [credentialPath,output]=process.argv.slice(2),origin='https://cohamy.vn';
assert.equal(process.platform,'linux');
assert.equal(credentialPath,'/root/cohamy-shared/initial-admin.json');
assert.ok(output?.startsWith('/root/cohamy-backups/')&&output.endsWith('/sales-smoke.json'));
const credentials=JSON.parse(await fs.readFile(credentialPath,'utf8')),cases=[],reads=[];
let cookie='';
const request=async path=>{
 const start=performance.now(),r=await fetch(origin+path,{redirect:'manual',headers:{cookie,origin},cache:'no-store'});
 const body=await r.text();reads.push({path,status:r.status,ms:Math.round(performance.now()-start)});
 return {r,body};
};
const json=async path=>{const {r,body}=await request(path);assert.equal(r.status,200,path);assert.match(r.headers.get('cache-control'),/no-store/);return JSON.parse(body);};
const check=async(name,fn)=>{await fn();cases.push({name,status:'PASS'});};
let target;
try{
 await check('New Sales APIs require authentication before revealing business data',async()=>{
  for(const path of ['/api/crm/sales-customers/workspace','/api/crm/sales-customers/notifications'])assert.equal((await request(path)).r.status,401);
 });
 const login=await fetch(origin+'/api/crm/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:credentials.email,password:credentials.password})});
 assert.equal(login.status,200);cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
 await check('New Sales and scoped notification pages render through public HTTPS',async()=>{
  for(const path of ['/crm/sales-customers','/crm/sales-notifications','/crm/buyer-orders','/portal/register?ref=SALE-000000000000']){
   const {r,body}=await request(path);assert.equal(r.status,200,path);assert.match(r.headers.get('x-robots-tag'),/noindex/);assert.ok(!body.includes('LOCAL QA'));
  }
 });
 await check('Sales dashboard, filters and empty-page pagination read actual persisted business data',async()=>{
  const a=await json('/api/crm/sales-customers/workspace');assert.ok(Array.isArray(a.items)&&Array.isArray(a.salesOptions)&&Array.isArray(a.reportSalesOptions));assert.equal(a.pageSize,20);assert.ok(a.total>=a.items.length);assert.ok(a.summary.referralConversion>=0&&a.summary.referralConversion<=100);
  const b=await json('/api/crm/sales-customers/workspace?page=100000');assert.equal(b.items.length,0);assert.equal(b.total,a.total);
  await json('/api/crm/sales-customers/workspace?from=2026-10-01&to=2026-10-31');
 });
 await check('Scoped notification totals and Admin review queue are readable without creating or replaying notices',async()=>{
  const a=await json('/api/crm/sales-customers/notifications?limit=1');assert.ok(Array.isArray(a.items));assert.ok(Number.isInteger(a.total)&&Number.isInteger(a.unread));assert.equal(a.pageSize,1);assert.ok(a.total>=a.items.length);
  assert.ok(Array.isArray(await json('/api/crm/sales-customers/review-requests')));
 });
 await check('Actual reference order stays waiting quote with seven packs and no issue; fulfillment denies preparation',async()=>{
  const id='74735ec7-fa0e-45c7-a299-b03597acfdb6',detail=await json('/api/crm/buyer/order?id='+id),f=await json('/api/crm/sales-customers/fulfillment?id='+id),b=detail.order;
  assert.equal(b.code,'DH-20261030-74735EC7');assert.equal(b.status,'WAITING_QUOTE');assert.equal(b.version,1);assert.equal(b.lines.length,7);assert.equal(b.lines.reduce((n,l)=>n+Number(l.baseQuantity),0),7);assert.equal(detail.issues.length,0);assert.equal(f.stage,'WAITING_QUOTE');assert.equal(f.ready,false);assert.ok(!f.allowedActions.includes('PICKING'));
  target={code:b.code,status:b.status,version:b.version,lineCount:b.lines.length,baseQuantity:7,issues:detail.issues.length,fulfillmentStage:f.stage,ready:f.ready,orderDataSha256:createHash('sha256').update(JSON.stringify(b)).digest('hex')};
 });
 await check('Public invalid referral fails explicitly without assigning a customer or Sales',async()=>{
  const {r,body}=await request('/api/crm/sales-referrals/info?ref=SALE-000000000000');assert.equal(r.status,404);assert.equal(JSON.parse(body).error,'INVALID_REFERRAL');
 });
 await fs.writeFile(output,JSON.stringify({status:'PASS',environment:'PRODUCTION public HTTPS business reads only',testedAt:new Date().toISOString(),cases,reads,target,productionBusinessWrites:0,externalEmails:0},null,2)+'\n',{mode:0o600});
 console.log('PASS '+cases.length+' Sales production read-only checks');
}finally{
 if(cookie)await fetch(origin+'/api/crm/auth/logout',{method:'POST',headers:{origin,cookie}}).catch(()=>{});
}
