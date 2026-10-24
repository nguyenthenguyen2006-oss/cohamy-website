import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import {chromium,expect as baseExpect} from '@playwright/test';

// Run --capture before an independently managed server restart, --verify after it.
// Document, VAT and mail-rule access is GET-only. Login creates the normal QA session.
const expect=baseExpect.configure({timeout:60000});
const capture=process.argv.includes('--capture'),verify=process.argv.includes('--verify');
assert.notEqual(capture,verify,'Choose exactly one of --capture and --verify');
const arg=(name,fallback)=>{const index=process.argv.indexOf(name);return index<0?fallback:process.argv[index+1];};
const base=new URL(arg('--base','http://127.0.0.1:4341'));
assert.ok(['127.0.0.1','localhost'].includes(base.hostname)&&base.protocol==='http:'&&!base.username&&!base.password,'LOCAL_LOOPBACK_SERVER_REQUIRED');
assert.equal(base.pathname,'/');
const origin=base.origin,folder='docs/crm/test-results/document-flow';
const baselinePath=arg('--baseline',folder+'/restart-baseline.json');
const run=JSON.parse(await fs.readFile('.local/crm-document-flow-run.json','utf8'));
assert.match(run.emails?.admin??'',/@crm-qa\.invalid$/);
assert.ok(run.mode==='postgres'||(run.mode==='pglite'&&/^\.local[/\\]crm-qa-/.test(run.dataDir??'')),'ISOLATED_QA_RUN_REQUIRED');
for(const name of ['requestId','dispatchId','receiptId','vatVersionId'])assert.match(run[name]??'',/^[0-9a-f-]{36}$/);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const identity=hash(JSON.stringify({mode:run.mode,dataDir:run.dataDir,requestId:run.requestId,dispatchId:run.dispatchId,receiptId:run.receiptId,vatVersionId:run.vatVersionId}));
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const prior=verify?JSON.parse(await fs.readFile(baselinePath,'utf8')):null;
if(prior){assert.equal(prior.runIdentity,identity,'QA_RUN_CHANGED_SINCE_CAPTURE');assert.equal(prior.origin,origin);}
if(capture)await assert.rejects(fs.access(baselinePath),{code:'ENOENT'},'Baseline already exists; preserve it or select a new --baseline path');
const browser=await chromium.launch({channel:'msedge',headless:true});
const cases=[],errors=[];
let observed;
const test=async(name,fn)=>{await fn();cases.push({test:name,status:'PASS'});console.log('PASS '+name);};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));
 const writes=[];
 context.on('request',request=>{const url=new URL(request.url());if(url.origin===origin&&url.pathname.startsWith('/api/crm/')&&!['GET','HEAD','OPTIONS'].includes(request.method())&&url.pathname!=='/api/crm/auth/login')writes.push({method:request.method(),url:request.url()});});
 await test('Fresh real Edge QA login reaches CRM',async()=>{
  await page.goto(origin+'/crm/login');await page.getByLabel('Email',{exact:true}).fill(run.emails.admin);await page.getByLabel('Mật khẩu',{exact:true}).fill('Local-QA-Only-2026!');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page).toHaveURL(origin+'/crm');
 });
 const get=async path=>{const response=await context.request.get(origin+path);if(response.status()!==200)assert.fail(path+' '+response.status()+' '+(await response.text()).slice(0,140));return response;};
 const workspace=await(await get('/api/crm/document-flow/workspace')).json();
 const settings=await(await get('/api/crm/document-flow/mail-settings')).json();
 const revisions=workspace.revisions.map(r=>({id:r.entity_id,revision:r.revision,checksum:r.checksum})).sort((a,b)=>a.id.localeCompare(b.id)||a.revision-b.revision);
 const vats=workspace.vats.map(v=>({versionId:v.version_id,entityId:v.entity_id,revision:v.revision,sourceRevision:v.source_revision??null,filename:v.filename,mime:v.mime,checksum:v.checksum})).sort((a,b)=>a.versionId.localeCompare(b.versionId));
 const fields=['id','event','warehouse_id','factory_membership_id','enabled','recipients','subject','body','attachments','version'];
 const rules=settings.rules.map(rule=>canonical(Object.fromEntries(fields.map(key=>[key,rule[key]])))).sort((a,b)=>a.id.localeCompare(b.id));
 observed={runIdentity:identity,origin,capturedAt:new Date().toISOString(),environment:'LOCAL isolated QA / real Edge; document and settings reads only',provider:'No mail worker or email endpoint invoked',revisions:[],vats:[],rules};
 await test('All saved PDF revisions download with their persisted checksums',async()=>{
  assert.ok(revisions.length>=3,'Expected saved revision archives');
  for(const id of [run.requestId,run.dispatchId,run.receiptId])assert.ok(revisions.some(r=>r.id===id),'Seeded saved PDF missing: '+id);
  if(prior)assert.deepEqual(revisions,prior.revisions.map(({size,...entry})=>entry),'Saved PDF archive metadata changed after restart');
  for(const saved of revisions){const response=await get('/api/crm/document-flow/pdf?id='+saved.id+'&revision='+saved.revision),bytes=await response.body();assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.equal(hash(bytes),saved.checksum,'Stored PDF checksum mismatch');observed.revisions.push({...saved,size:bytes.length});}
  if(prior)assert.deepEqual(observed.revisions,prior.revisions,'PDF bytes changed after restart');
 });
 await test('Original saved VAT versions retain the same metadata and exact bytes',async()=>{
  assert.ok(vats.some(v=>v.versionId===run.vatVersionId),'Seeded original VAT missing');
  if(prior)assert.deepEqual(vats,prior.vats.map(({size,bytesSha256,...entry})=>entry),'VAT version metadata changed after restart');
  for(const saved of vats){const response=await get('/api/crm/documents/'+saved.versionId),bytes=await response.body();assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok([hash(bytes),hash(bytes.toString('base64'))].includes(saved.checksum),'Stored VAT checksum mismatch');observed.vats.push({...saved,size:bytes.length,bytesSha256:hash(bytes)});}
  if(prior)assert.deepEqual(observed.vats,prior.vats,'Original VAT bytes changed after restart');
 });
 await test('Admin mail rule dimensions, recipients, templates and versions persist',async()=>{
  assert.ok(rules.length>0,'Need existing saved Admin rule to verify persistence');
  if(prior)assert.deepEqual(rules,prior.rules,'Admin mail rule configuration changed after restart');
  await page.goto(origin+'/crm/document-notifications');await expect(page.getByRole('heading',{name:'Thông báo hóa đơn & chứng từ',exact:true})).toBeVisible();await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:folder+'/restart-'+(capture?'before':'after')+'.png',fullPage:true});
 });
 await test('Verification sends no document, VAT, rule or email mutations',async()=>{assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);});
 if(capture){await fs.mkdir(folder,{recursive:true});await fs.writeFile(baselinePath,JSON.stringify({...observed,status:'CAPTURED; restart and --verify still required'},null,2));}
 if(verify)await fs.writeFile(folder+'/restart-verification.json',JSON.stringify({verifiedAt:new Date().toISOString(),environment:observed.environment,runIdentity:identity,baseline:baselinePath,status:'PASS',pdfRevisions:observed.revisions.length,vatVersions:observed.vats.length,rules:observed.rules.length,cases,errors},null,2));
}catch(error){
 await fs.mkdir(folder,{recursive:true});await fs.writeFile(folder+'/restart-'+(capture?'capture':'verification')+'-failure.json',JSON.stringify({testedAt:new Date().toISOString(),status:'FAIL',cases,error:error instanceof Error?error.stack??error.message:String(error),errors},null,2));throw error;
}finally{await browser.close();}
