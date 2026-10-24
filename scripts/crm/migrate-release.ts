import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {database,type Database} from '../../lib/crm/db';

/** One transaction prevents intermediate versions of replaced triggers becoming live. */
export async function migrateRelease(db:Database,directory=path.resolve('db/crm')){
 const files=await Promise.all((await fs.readdir(directory)).filter(name=>/^\d+.*\.sql$/u.test(name)).sort().map(async name=>{const source=await fs.readFile(path.join(directory,name),'utf8');return {name,source,checksum:createHash('sha256').update(source).digest('hex')};}));
 return db.transaction(async sql=>{
  await sql.exec('CREATE SCHEMA IF NOT EXISTS cohamy_crm; CREATE TABLE IF NOT EXISTS cohamy_crm.migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now()); LOCK TABLE cohamy_crm.migrations IN EXCLUSIVE MODE;');
  const applied:string[]=[];
  for(const file of files){
   const previous=(await sql.query<{checksum:string}>('SELECT checksum FROM cohamy_crm.migrations WHERE name=$1',[file.name])).rows[0];
   if(previous){if(previous.checksum!==file.checksum)throw Error('MIGRATION_CHECKSUM_CHANGED');continue;}
   await sql.exec(file.source);await sql.query('INSERT INTO cohamy_crm.migrations(name,checksum) VALUES($1,$2)',[file.name,file.checksum]);applied.push(file.name);
  }
  return {status:'PASS',total:files.length,applied};
 });
}
async function main(){
 const target=new URL(process.env.CRM_DATABASE_URL??'');
 if(process.platform!=='linux'||process.env.CRM_ENVIRONMENT!=='PRODUCTION'||!['localhost','127.0.0.1'].includes(target.hostname)||target.port!=='55432'||target.pathname!=='/cohamy_crm'||target.username!=='cohamy_owner')throw Error('COHAMY_OWNER_RELEASE_SCOPE_REQUIRED');
 const db=await database();try{console.log(JSON.stringify(await migrateRelease(db)));}finally{await db.close();}
}
if(process.argv[1]?.endsWith('migrate-release.ts'))main().catch(()=>{console.error('ATOMIC_RELEASE_MIGRATION_FAILED');process.exitCode=1;});
