import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import type {Principal} from '../../lib/crm/types';

process.env.CRM_DATABASE_MODE='pglite';
process.env.CRM_ENVIRONMENT='LOCAL';
process.env.CRM_LOCAL_DATA_DIR='.local/crm-qa-brevo-settings-'+randomUUID();
process.env.CRM_DATABASE_URL='';
process.env.CRM_QA_DOCUMENT_MAIL='false';
process.env.CRM_EMAIL_ENABLED='true';
process.env.CRM_DEMO_MODE='false';
const master=randomBytes(48).toString('base64'),wrongMaster=randomBytes(48).toString('base64');
const envKey='xkeysib-'+randomBytes(36).toString('hex'),firstKey='xkeysib-'+randomBytes(36).toString('hex'),secondKey='xkeysib-'+randomBytes(36).toString('hex');
const secrets=[master,wrongMaster,envKey,firstKey,secondKey];
process.env.CRM_SETTINGS_ENCRYPTION_KEY=master;
process.env.CRM_BREVO_API_KEY=envKey;
process.env.CRM_BREVO_SENDER_EMAIL='environment@brevo-qa.invalid';
const scrub=(message:string)=>secrets.reduce((text,secret)=>text.replaceAll(secret,'[secret redacted]'),message);
const checks:{test:string;status:string;error?:string}[]=[],evidence:Record<string,unknown>={};
const ciphertexts:string[]=[];
const originalFetch=globalThis.fetch;let fetchCalls=0,expectedRuntimeKey='',expectedSender='';
globalThis.fetch=async(input,init)=>{
 fetchCalls++;assert.ok(String(input)==='https://api.brevo.com/v3/smtp/email','UNEXPECTED_PROVIDER_URL');
 assert.ok(new Headers(init?.headers).get('api-key')===expectedRuntimeKey,'PROVIDER_MUST_USE_SAVED_DB_KEY');
 const body=JSON.parse(String(init?.body));assert.ok(body.sender.email===expectedSender,'PROVIDER_MUST_USE_SAVED_DB_SENDER');
 assert.equal(init?.method,'POST');return new Response(JSON.stringify({messageId:'<brevo-settings-qa-'+fetchCalls+'>'}),{status:201,headers:{'content-type':'application/json'}});
};
async function test(name:string,fn:()=>Promise<void>){try{await fn();checks.push({test:name,status:'PASS'});console.log('PASS '+name);}catch(error){checks.push({test:name,status:'FAIL',error:scrub(error instanceof Error?error.message:String(error))});throw error;}}
const excludesSecrets=(value:unknown,label:string)=>{const text=JSON.stringify(value);for(const secret of secrets)assert.ok(!text.includes(secret),label+'_CONTAINS_PLAINTEXT_SECRET');};

async function main(){
 const {createQaFixture,qaPassword}=await import('./qa-fixture'),{database}=await import('../../lib/crm/db'),auth=await import('../../lib/crm/auth'),repo=await import('../../lib/crm/repository'),settings=await import('../../lib/crm/brevo-settings'),brevo=await import('../../lib/crm/brevo');
 await createQaFixture();const db=await database();
 const admin=(await auth.login('admin@crm-qa.invalid',qaPassword)).user;
 await repo.createAccount(admin,{email:'manager-brevo@crm-qa.invalid',role:'MANAGER',displayName:'LOCAL QA · Quản lý email',password:qaPassword,organizationId:admin.organizationId});
 const denied:Principal[]=[];
 for(const email of ['manager-brevo@crm-qa.invalid','sales@crm-qa.invalid','warehouse@crm-qa.invalid','accountant@crm-qa.invalid','a@crm-qa.invalid'])denied.push((await auth.login(email,qaPassword)).user);
 const row=async()=>(await db.query<{id:string;key_ciphertext:string|null;sender_email:string;version:number}>('SELECT * FROM cohamy_crm.brevo_settings WHERE id=$1',['BREVO'])).rows[0];
 const safe=async()=>{const status=await settings.getBrevoSettings(admin);excludesSecrets(status,'SAFE_STATUS');for(const key of ['apiKey','key','key_ciphertext','keyCiphertext','ciphertext','masterKey','encryptionKey'])assert.ok(!(key in status),'CLIENT_SECRET_FIELD_EXPOSED');return status;};
 const runtime=async(key:string,sender:string)=>{const resolved=await settings.resolveBrevoSettings();assert.ok(resolved.key===key,'RUNTIME_KEY_MISMATCH');assert.ok(resolved.sender===sender,'RUNTIME_SENDER_MISMATCH');return resolved;};
 const sendDocument=()=>brevo.sendDocumentEmail({recipients:{to:['recipient@brevo-qa.invalid'],cc:[],bcc:[]},subject:'LOCAL QA encrypted settings',textContent:'Fictitious QA only',attachments:[],jobId:randomUUID()});
 const sendTransactional=()=>brevo.sendTransactionalEmail('recipient@brevo-qa.invalid','LOCAL QA transactional','Fictitious QA only',randomUUID());
 const sendBoth=async()=>{await sendDocument();await sendTransactional();};
 const expectBlocked=async(fn:()=>Promise<unknown>)=>{let rejected=false;try{await fn();}catch(error){rejected=true;excludesSecrets({error:error instanceof Error?error.message:String(error)},'ERROR');}assert.ok(rejected,'SETTINGS_FAILURE_MUST_REJECT');};
 const blockBoth=async()=>{await expectBlocked(sendDocument);await expectBlocked(sendTransactional);};
 let version=0;
 try{
  await test('No database row uses environment credentials while safe Admin status hides the key',async()=>{
   assert.equal(await row(),undefined);const resolved=await runtime(envKey,'environment@brevo-qa.invalid');const status=await safe();assert.equal(status.version,0);assert.ok(JSON.stringify(status).includes('environment@brevo-qa.invalid'));evidence.initialSource=resolved.source;
  });
  await test('Every non-Admin role, forged area and stale principal are denied both read and save',async()=>{
   const input={version:0,senderEmail:'sender@brevo-qa.invalid',apiKey:firstKey,removeKey:false};
   for(const user of [...denied,{...admin,area:'portal'} as Principal,{...admin,membershipVersion:admin.membershipVersion+1}]){await assert.rejects(settings.getBrevoSettings(user),/FORBIDDEN/);await assert.rejects(settings.saveBrevoSettings(user,input),/FORBIDDEN/);}
   assert.equal(await row(),undefined);
  });
  await test('First save with a blank key securely imports the active environment key into database storage',async()=>{
   await settings.saveBrevoSettings(admin,{version,senderEmail:'environment-import@brevo-qa.invalid',apiKey:'',removeKey:false});version++;const saved=await row();assert.ok(saved.key_ciphertext&&!saved.key_ciphertext.includes(envKey),'ENV_IMPORT_MUST_ENCRYPT');ciphertexts.push(saved.key_ciphertext!);const resolved=await runtime(envKey,'environment-import@brevo-qa.invalid');assert.equal(resolved.source,'DATABASE');await safe();
  });
  await test('Admin saves encrypted singleton with a safe response and database precedence over environment',async()=>{
   const result=await settings.saveBrevoSettings(admin,{version,senderEmail:'first@brevo-qa.invalid',apiKey:firstKey,removeKey:false});excludesSecrets(result,'SAVE_RESPONSE');version++;
   const saved=await row();assert.equal(saved.version,version);assert.equal(saved.sender_email,'first@brevo-qa.invalid');assert.ok(typeof saved.key_ciphertext==='string'&&saved.key_ciphertext.length>20,'CIPHERTEXT_REQUIRED');ciphertexts.push(saved.key_ciphertext);for(const secret of secrets)assert.ok(!saved.key_ciphertext.includes(secret),'DATABASE_CONTAINS_PLAINTEXT_SECRET');
   await runtime(firstKey,'first@brevo-qa.invalid');const status=await safe();assert.equal(status.version,version);assert.ok(!JSON.stringify(status).includes(saved.key_ciphertext),'CLIENT_CIPHERTEXT_EXPOSED');evidence.ciphertextPresent=true;
  });
  await test('Blank key retains the saved credential while sender-only change increments version',async()=>{
   await settings.saveBrevoSettings(admin,{version,senderEmail:'changed@brevo-qa.invalid',apiKey:'',removeKey:false});version++;await runtime(firstKey,'changed@brevo-qa.invalid');assert.equal((await safe()).version,version);
  });
  await test('Replacing key changes ciphertext and immediately updates resolved server credentials',async()=>{
   const before=await row();await settings.saveBrevoSettings(admin,{version,senderEmail:'replacement@brevo-qa.invalid',apiKey:secondKey,removeKey:false});version++;const after=await row();ciphertexts.push(after.key_ciphertext!);assert.ok(before.key_ciphertext!==after.key_ciphertext,'KEY_REPLACEMENT_MUST_CHANGE_CIPHERTEXT');await runtime(secondKey,'replacement@brevo-qa.invalid');
   process.env.CRM_BREVO_API_KEY=envKey;process.env.CRM_BREVO_SENDER_EMAIL='different-environment@brevo-qa.invalid';await runtime(secondKey,'replacement@brevo-qa.invalid');
  });
  await test('Stale optimistic version and invalid sender reject without changing persisted settings',async()=>{
   const before=await row();await assert.rejects(settings.saveBrevoSettings(admin,{version:version-1,senderEmail:'stale@brevo-qa.invalid',apiKey:firstKey,removeKey:false}),/VERSION_CONFLICT/);await assert.rejects(settings.saveBrevoSettings(admin,{version,senderEmail:'invalid-email',apiKey:'',removeKey:false}));
   for(const invalidKey of ['short','abcdefghijklmnop q','abcdefghijklmnopé','x'.repeat(1025)])await assert.rejects(settings.saveBrevoSettings(admin,{version,senderEmail:'replacement@brevo-qa.invalid',apiKey:invalidKey,removeKey:false}),/INVALID_FIELDS/);
   assert.deepEqual(await row(),before);
  });
  await test('Both document and transactional sends use saved database key and sender through fake fetch only',async()=>{
   expectedRuntimeKey=secondKey;expectedSender='replacement@brevo-qa.invalid';const before=fetchCalls;await sendBoth();assert.equal(fetchCalls-before,2);evidence.savedConfigurationSendPaths=['sendDocumentEmail','sendTransactionalEmail'];
  });
  await test('Email enabled flag still blocks both send paths before fake provider invocation',async()=>{
   const before=fetchCalls;process.env.CRM_EMAIL_ENABLED='false';try{await expectBlocked(()=>brevo.sendDocumentEmail({recipients:{to:['recipient@brevo-qa.invalid'],cc:[],bcc:[]},subject:'QA',textContent:'QA',attachments:[],jobId:randomUUID()}));await expectBlocked(()=>brevo.sendTransactionalEmail('recipient@brevo-qa.invalid','QA','QA'));}finally{process.env.CRM_EMAIL_ENABLED='true';}assert.equal(fetchCalls,before);
  });
  await test('Missing, short and wrong encryption masters fail closed despite valid environment fallback',async()=>{
   const before=fetchCalls;for(const invalid of ['', 'too-short',wrongMaster]){process.env.CRM_SETTINGS_ENCRYPTION_KEY=invalid;try{await expectBlocked(()=>settings.resolveBrevoSettings());await blockBoth();const status=await safe();assert.equal(status.configured,false);assert.equal(status.version,version);assert.equal(status.sender,'replacement@brevo-qa.invalid');assert.equal(status.storageError,invalid===wrongMaster?'BREVO_SECRET_UNREADABLE':'BREVO_ENCRYPTION_NOT_CONFIGURED');}finally{process.env.CRM_SETTINGS_ENCRYPTION_KEY=master;}}
   assert.equal(fetchCalls,before);await runtime(secondKey,'replacement@brevo-qa.invalid');
  });
  await test('Ciphertext tampering fails authentication and cannot silently fall back to environment',async()=>{
   const saved=await row(),ciphertext=saved.key_ciphertext!;assert.ok(ciphertext.length>20);const last=ciphertext.at(-1),tampered=ciphertext.slice(0,-1)+(last==='A'?'B':'A'),before=fetchCalls;
   await db.query('UPDATE cohamy_crm.brevo_settings SET key_ciphertext=$1 WHERE id=$2',[tampered,'BREVO']);
   try{await expectBlocked(()=>settings.resolveBrevoSettings());await blockBoth();const status=await safe();assert.equal(status.configured,false);assert.equal(status.storageError,'BREVO_SECRET_UNREADABLE');}finally{await db.query('UPDATE cohamy_crm.brevo_settings SET key_ciphertext=$1 WHERE id=$2',[ciphertext,'BREVO']);}
   assert.equal(fetchCalls,before);await runtime(secondKey,'replacement@brevo-qa.invalid');
  });
  await test('Unavailable settings storage fails closed and never substitutes valid environment credentials',async()=>{
   const before=fetchCalls;await db.exec('ALTER TABLE cohamy_crm.brevo_settings RENAME TO brevo_settings_qa_unavailable');
   try{await expectBlocked(()=>settings.resolveBrevoSettings());await blockBoth();const status=await safe();assert.equal(status.configured,false);assert.equal(status.storageError,'BREVO_SETTINGS_UNAVAILABLE');}finally{await db.exec('ALTER TABLE cohamy_crm.brevo_settings_qa_unavailable RENAME TO brevo_settings');}
   assert.equal(fetchCalls,before);await runtime(secondKey,'replacement@brevo-qa.invalid');
  });
  await test('Explicit removal leaves a versioned tombstone and suppresses configured environment credentials',async()=>{
   await settings.saveBrevoSettings(admin,{version,senderEmail:'replacement@brevo-qa.invalid',apiKey:'',removeKey:true});version++;const saved=await row();assert.equal(saved.version,version);assert.ok(!saved.key_ciphertext,'REMOVAL_MUST_CLEAR_CIPHERTEXT');
   let resolved:Awaited<ReturnType<typeof settings.resolveBrevoSettings>>|undefined;try{resolved=await settings.resolveBrevoSettings();}catch(error){excludesSecrets({error:error instanceof Error?error.message:String(error)},'REMOVAL_ERROR');}
   if(resolved){assert.ok(!resolved.key,'TOMBSTONE_MUST_SUPPRESS_ENV_FALLBACK');assert.equal(resolved.source,'DATABASE');}const before=fetchCalls;await blockBoth();assert.equal(fetchCalls,before);const status=await safe();assert.equal(status.version,version);assert.equal(status.configured,false);evidence.removalTombstone=true;
  });
  await test('Audit payloads and all client responses contain no plaintext credential or encrypted payload',async()=>{
   const audits=(await db.query<{action:string;payload:unknown}>("SELECT action,payload FROM cohamy_crm.audit_events WHERE action ILIKE '%brevo%' OR entity_id='BREVO'")).rows;assert.ok(audits.length>=4,'SETTINGS_CHANGES_REQUIRE_AUDIT');excludesSecrets(audits,'AUDIT');for(const ciphertext of ciphertexts)assert.ok(!JSON.stringify(audits).includes(ciphertext),'AUDIT_CONTAINS_CIPHERTEXT');await safe();evidence.auditRecords=audits.length;evidence.providerFetchCalls=fetchCalls;evidence.finalVersion=version;
  });
 }finally{
  await fs.mkdir('docs/crm/test-results/document-flow',{recursive:true});await fs.writeFile('docs/crm/test-results/document-flow/brevo-settings-local.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'LOCAL fresh isolated PGlite',dataDir:process.env.CRM_LOCAL_DATA_DIR,provider:'Strict in-process fake fetch only; randomly generated fictitious credentials never logged',status:checks.length===14&&checks.every(c=>c.status==='PASS')?'PASS':'FAIL',checks,evidence},null,2));await db.close();globalThis.fetch=originalFetch;
 }
}
main().catch(error=>{globalThis.fetch=originalFetch;console.error(scrub(error instanceof Error?error.stack??error.message:String(error)));process.exitCode=1;});
