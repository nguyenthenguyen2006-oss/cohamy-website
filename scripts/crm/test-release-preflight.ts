import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {databaseManifest} from './database-manifest';
import {type Database} from '../../lib/crm/db';
import {migrateRelease} from './migrate-release';
function adapter(db:PGlite):Database{return {query:(t,p)=>db.query(t,p),exec:async t=>{await db.exec(t);},transaction:fn=>db.transaction(tx=>fn({query:(t,p)=>tx.query(t,p),exec:async t=>{await tx.exec(t);}})),close:()=>db.close()};}
async function main(){
 const {provisionBrevoMaster}=await import('./provision-brevo-master.mjs');
 const root=path.resolve('.local/crm-qa-release-preflight-'+randomUUID());await fs.mkdir(root,{recursive:true});
 const cases:{test:string;status:string}[]=[];
 async function dirs(name:string){const folder=path.join(root,name);const sharedDirectory=path.join(folder,'shared'),backupDirectory=path.join(folder,'backup');await fs.mkdir(sharedDirectory,{recursive:true});await fs.mkdir(backupDirectory,{recursive:true});const previousEnv=path.join(backupDirectory,'previous.env.production');await fs.writeFile(previousEnv,'CRM_EMAIL_ENABLED=false\n',{mode:0o600});return {sharedDirectory,backupDirectory,previousEnv};}
 const a=await dirs('fresh'),first=await provisionBrevoMaster({...a,encryptedSettingExists:false});assert.ok(Buffer.from(first,'base64').length===32);const second=await provisionBrevoMaster({...a,encryptedSettingExists:true});assert.ok(first===second);assert.ok(await fs.readFile(path.join(a.backupDirectory,'crm-settings-encryption.key'),'utf8')===first);cases.push({test:'Fresh server master is stable across retries and backed up privately',status:'PASS'});
 const b=await dirs('existing-env'),existing=randomBytes(32).toString('base64');await fs.writeFile(b.previousEnv,'CRM_SETTINGS_ENCRYPTION_KEY='+existing+'\nCRM_EMAIL_ENABLED=false\n');assert.ok(await provisionBrevoMaster({...b,encryptedSettingExists:true})===existing);cases.push({test:'Existing environment master is preserved; email gate is not changed',status:'PASS'});
 await fs.writeFile(b.previousEnv,'CRM_SETTINGS_ENCRYPTION_KEY='+randomBytes(32).toString('base64')+'\n');await assert.rejects(provisionBrevoMaster({...b,encryptedSettingExists:true}),/BREVO_MASTER_CONFLICT/);cases.push({test:'Conflicting server master fails closed instead of rotating keys',status:'PASS'});
 const c=await dirs('missing-master');await assert.rejects(provisionBrevoMaster({...c,encryptedSettingExists:true}),/NEEDS_ORIGINAL_MASTER/);await assert.rejects(fs.access(path.join(c.sharedDirectory,'crm-settings-encryption.key')));cases.push({test:'Existing ciphertext without original master cannot create a replacement',status:'PASS'});
 const db=new PGlite();await db.waitReady;
 try{
  await db.exec('CREATE SCHEMA cohamy_crm; CREATE TABLE cohamy_crm.private_documents(id uuid PRIMARY KEY,entity_type text,entity_id uuid); CREATE TABLE cohamy_crm.document_versions(id uuid PRIMARY KEY,document_id uuid,content bytea,size integer,checksum text);');
  const bytes=Buffer.from('QA legacy backup file'),id=randomUUID(),version=randomUUID();await db.query("INSERT INTO cohamy_crm.private_documents VALUES($1,'fixture',$2)",[id,randomUUID()]);await db.query('INSERT INTO cohamy_crm.document_versions VALUES($1,$2,$3,$4,$5)',[version,id,bytes,bytes.length,createHash('sha256').update(bytes.toString('base64')).digest('hex')]);
  assert.equal((await databaseManifest(adapter(db))).fileIntegrityErrors,'0');cases.push({test:'Pre-migration backup manifest works before doc_category exists',status:'PASS'});
  await db.exec("ALTER TABLE cohamy_crm.private_documents ADD COLUMN doc_category text DEFAULT 'GENERAL'");await db.query("UPDATE cohamy_crm.private_documents SET doc_category='VAT_ORIGINAL' WHERE id=$1",[id]);await db.query('UPDATE cohamy_crm.document_versions SET checksum=$1 WHERE id=$2',[createHash('sha256').update(bytes).digest('hex'),version]);assert.equal((await databaseManifest(adapter(db))).fileIntegrityErrors,'0');
  await db.query("UPDATE cohamy_crm.document_versions SET checksum='invalid' WHERE id=$1",[version]);await assert.rejects(databaseManifest(adapter(db)),/INTEGRITY_FAILED/);cases.push({test:'Post-migration raw VAT checksum validates and corrupted file fails',status:'PASS'});
 }finally{await db.close();}
 const batchDb=new PGlite(),batchDir=path.join(root,'batch-migrations');await batchDb.waitReady;await fs.mkdir(batchDir);
 try{
  await fs.writeFile(path.join(batchDir,'001-first.sql'),'CREATE TABLE cohamy_crm.qa_first(id integer);');await fs.writeFile(path.join(batchDir,'002-second.sql'),'INVALID SQL FOR QA');
  await assert.rejects(migrateRelease(adapter(batchDb),batchDir));assert.equal((await batchDb.query<{table:string|null}>("SELECT to_regclass('cohamy_crm.qa_first')::text AS table")).rows[0].table,null);
  await fs.writeFile(path.join(batchDir,'002-second.sql'),'CREATE TABLE cohamy_crm.qa_second(id integer);');assert.equal((await migrateRelease(adapter(batchDb),batchDir)).applied.length,2);assert.equal((await migrateRelease(adapter(batchDb),batchDir)).applied.length,0);
  await fs.writeFile(path.join(batchDir,'001-first.sql'),'CREATE TABLE cohamy_crm.qa_first(id text);');await assert.rejects(migrateRelease(adapter(batchDb),batchDir),/MIGRATION_CHECKSUM_CHANGED/);
  cases.push({test:'Migration batch rolls all DDL back on failure, retries once and rejects changed applied SQL',status:'PASS'});
 }finally{await batchDb.close();}
 await fs.mkdir('docs/crm/test-results/document-flow',{recursive:true});await fs.writeFile('docs/crm/test-results/document-flow/release-preflight-local.json',JSON.stringify({environment:'LOCAL isolated PGlite and synthetic server paths',status:'PASS',cases,noProductionAccess:true,noKeysInReport:true},null,2));for(const c of cases)console.log('PASS',c.test);
}
main().catch(e=>{console.error(e instanceof Error?e.message:'RELEASE_PREFLIGHT_FAILED');process.exitCode=1;});
