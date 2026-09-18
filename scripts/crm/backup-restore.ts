import fs from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import {Pool,type PoolClient} from 'pg';
import {databaseManifest,type DatabaseManifest} from './database-manifest';
import {pruneVerifiedBackups} from './backup-retention';
import {backupPublicFiles} from './backup-public-files';

const safeDatabase=(value:string)=>/^(cohamy_crm|cohamy_qa_[a-z0-9_]+|cohamy_restore_[a-z0-9_]+)$/.test(value);
function sql(client:PoolClient){return {query:async<T>(text:string,params?:unknown[])=>({rows:(await client.query(text,params)).rows as T[]}),exec:async(text:string)=>{await client.query(text);}};}
async function hashFile(file:string){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function docker(args:string[],file?:{input?:string;output?:string}){
 const child=spawn('docker',['exec',...(file?.input?['-i']:[]),'cohamy-crm-postgres',...args],{stdio:[file?.input?'pipe':'ignore',file?.output?'pipe':'ignore','pipe']});
 let errorBytes=0;child.stderr?.on('data',chunk=>{errorBytes+=chunk.length;});
 const exited=new Promise<void>((resolve,reject)=>{child.on('error',()=>reject(new Error('BACKUP_DATABASE_TOOL_UNAVAILABLE')));child.on('exit',code=>code===0?resolve():reject(new Error('BACKUP_DATABASE_TOOL_FAILED '+args[0]+' '+code)));});
 const stream=file?.input?pipeline(createReadStream(file.input),child.stdin!):file?.output?pipeline(child.stdout!,createWriteStream(file.output,{flags:'wx',mode:0o600})):Promise.resolve();
 await Promise.all([exited,stream]);return {stderrBytes:errorBytes};
}
export async function verifiedBackup(){
 const target=new URL(process.env.CRM_DATABASE_URL??''),database=decodeURIComponent(target.pathname.slice(1));
 if(process.platform==='win32'||!['127.0.0.1','localhost'].includes(target.hostname)||target.port!=='55432'||!safeDatabase(database)||target.username!=='cohamy_owner')throw new Error('DEDICATED_COHAMY_OWNER_DATABASE_REQUIRED');
 const configured=process.env.CRM_BACKUP_ROOT??'/root/cohamy-backups/scheduled';
 await fs.mkdir(configured,{recursive:true,mode:0o700});const root=await fs.realpath(configured);
 if(!root.startsWith('/root/cohamy-backups/'))throw new Error('COHAMY_BACKUP_ROOT_REQUIRED');
 const id=new Date().toISOString().replaceAll(':','').replaceAll('.','')+'-'+randomUUID().slice(0,8),directory=path.join(root,id);await fs.mkdir(directory,{mode:0o700});
 const restoreDatabase='cohamy_restore_'+randomUUID().replaceAll('-',''),dump=path.join(directory,'crm.dump'),sourcePool=new Pool({connectionString:target.href,max:1}),client=await sourcePool.connect();let manifest:DatabaseManifest;
 try{
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await client.query("SET LOCAL TIME ZONE 'UTC'");
  const exported=(await client.query<{snapshot:string}>('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
  await docker(['pg_dump','-U','cohamy_owner','-d',database,'-Fc','--snapshot='+exported],{output:dump});manifest=await databaseManifest(sql(client));await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK').catch(()=>{});await fs.writeFile(path.join(directory,'FAILED.json'),JSON.stringify({status:'FAIL',at:new Date().toISOString(),stage:'snapshot'},null,2),{mode:0o600});throw e;}
 finally{client.release();await sourcePool.end();}
 const sha256=await hashFile(dump);await fs.writeFile(path.join(directory,'source-manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});
 await docker(['createdb','-U','cohamy_owner',restoreDatabase]);
 await docker(['pg_restore','-U','cohamy_owner','-d',restoreDatabase,'--exit-on-error','--single-transaction'],{input:dump});
 const restoreTarget=new URL(target);restoreTarget.pathname='/'+restoreDatabase;const restorePool=new Pool({connectionString:restoreTarget.href,max:1}),restored=await restorePool.connect();
 try{await restored.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await restored.query("SET LOCAL TIME ZONE 'UTC'");const copy=await databaseManifest(sql(restored));if(JSON.stringify(copy)!==JSON.stringify(manifest))throw new Error('RESTORE_MANIFEST_MISMATCH');await restored.query('COMMIT');await fs.writeFile(path.join(directory,'restored-manifest.json'),JSON.stringify(copy,null,2),{mode:0o600});}
 catch(e){await restored.query('ROLLBACK').catch(()=>{});await fs.writeFile(path.join(directory,'FAILED.json'),JSON.stringify({status:'FAIL',at:new Date().toISOString(),stage:'restore',restoreDatabase},null,2),{mode:0o600});throw e;}
 finally{restored.release();await restorePool.end();}
 if(await hashFile(dump)!==sha256)throw new Error('BACKUP_CHECKSUM_CHANGED');
 // Only the newly generated disposable restore database is eligible for cleanup.
 // Retain it for QA evidence when requested; never target the source database.
 const publicFiles=process.env.CRM_BACKUP_PUBLIC_UPLOAD_DIR?await backupPublicFiles(process.env.CRM_BACKUP_PUBLIC_UPLOAD_DIR,directory):null;
 const retained=process.env.CRM_BACKUP_RETAIN_RESTORE==='true';if(!retained)await docker(['dropdb','-U','cohamy_owner',restoreDatabase]);
 const report={status:'PASS',completedAt:new Date().toISOString(),sourceDatabase:database,restoreDatabase,restoreRetained:retained,sha256,tableCount:manifest.tables.length,rows:manifest.tables.map(t=>({table:t.name,count:t.rows})),fileIntegrityErrors:manifest.fileIntegrityErrors,documentSourceErrors:manifest.documentSourceErrors,directory,snapshotConsistent:true,publicFiles};
 await fs.writeFile(path.join(directory,'VERIFIED.json'),JSON.stringify(report,null,2),{mode:0o600});await fs.writeFile(path.join(root,'latest.json'),JSON.stringify(report,null,2),{mode:0o600});const retention=await pruneVerifiedBackups(root,database);return {...report,retention};
}
if(process.argv[1]?.endsWith('backup-restore.ts'))verifiedBackup().then(report=>console.log(JSON.stringify(report))).catch(e=>{console.error(e instanceof Error?e.message:'BACKUP_RESTORE_FAILED');process.exitCode=1;});
