import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {parseEnv} from 'node:util';
import {pathToFileURL} from 'node:url';
import pg from 'pg';

// Never print the returned value or include it in a command-line argument.
export async function provisionBrevoMaster({previousEnv,sharedDirectory,backupDirectory,encryptedSettingExists}){
 const previous=parseEnv(await fs.readFile(previousEnv,'utf8')).CRM_SETTINGS_ENCRYPTION_KEY??'';
 const file=path.join(sharedDirectory,'crm-settings-encryption.key');
 let stored='';try{const info=await fs.lstat(file);if(!info.isFile()||info.isSymbolicLink())throw Error('BREVO_MASTER_FILE_INVALID');stored=(await fs.readFile(file,'utf8')).trim();}catch(e){if(e.code!=='ENOENT')throw e;}
 for(const value of [previous,stored])if(value&&!/^[A-Za-z0-9+/=_-]{32,1024}$/.test(value))throw Error('BREVO_MASTER_FORMAT_INVALID');
 if(previous&&stored){const a=Buffer.from(previous),b=Buffer.from(stored);if(a.length!==b.length||!timingSafeEqual(a,b))throw Error('BREVO_MASTER_CONFLICT');}
 if(!previous&&!stored&&encryptedSettingExists)throw Error('BREVO_EXISTING_CIPHERTEXT_NEEDS_ORIGINAL_MASTER');
 const value=previous||stored||randomBytes(32).toString('base64');
 if(!stored)await fs.writeFile(file,value,{flag:'wx',mode:0o600});
 await fs.chmod(file,0o600);
 await fs.copyFile(file,path.join(backupDirectory,'crm-settings-encryption.key'));await fs.chmod(path.join(backupDirectory,'crm-settings-encryption.key'),0o600);
 return value;
}
async function main(){
 const sharedDirectory='/root/cohamy-shared',previousEnv=process.env.COHAMY_PREVIOUS_ENV,backupDirectory=process.env.CRM_RELEASE_BACKUP;
 if(process.platform!=='linux'||!previousEnv||!backupDirectory?.startsWith('/root/cohamy-backups/')||!previousEnv.startsWith(backupDirectory+'/'))throw Error('VERIFIED_COHAMY_RELEASE_SCOPE_REQUIRED');
 const target=new URL(process.env.CRM_DATABASE_URL??'');
 if(!['localhost','127.0.0.1'].includes(target.hostname)||target.port!=='55432'||target.pathname!=='/cohamy_crm'||target.username!=='cohamy_owner')throw Error('COHAMY_OWNER_DATABASE_REQUIRED');
 const pool=new pg.Pool({connectionString:target.href});
 try{
  const exists=(await pool.query("SELECT to_regclass('cohamy_crm.brevo_settings') IS NOT NULL AS present")).rows[0].present;
  const encryptedSettingExists=exists&&(await pool.query("SELECT 1 FROM cohamy_crm.brevo_settings WHERE key_ciphertext IS NOT NULL LIMIT 1")).rows.length>0;
  await provisionBrevoMaster({previousEnv,sharedDirectory,backupDirectory,encryptedSettingExists});
  console.log('BREVO_MASTER_READY');
 }finally{await pool.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('BREVO_MASTER_PROVISION_FAILED: check protected server configuration; no key was printed');process.exitCode=1;});
