import 'server-only';
import {createCipheriv,createDecipheriv,hkdfSync,randomBytes} from 'node:crypto';
import {z} from 'zod';
import {database,type Sql} from './db';
import {assertCurrentPrincipal,audit} from './auth';
import {CrmError} from './permissions';
import type {Principal} from './types';

type Source='DATABASE'|'ENVIRONMENT'|'NONE';
type Row={key_ciphertext:string|null;sender_email:string;version:number};
const aad=Buffer.from('Cohamy:Brevo:settings:v1');
export function isBrevoDemo(){return process.env.CRM_ENVIRONMENT==='DEMO'||process.env.CRM_DEMO_MODE==='true';}
function masterKey(){
  const secret=process.env.CRM_SETTINGS_ENCRYPTION_KEY;
  if(!secret||Buffer.byteLength(secret)<32||secret.trim()!==secret)throw new CrmError('BREVO_ENCRYPTION_NOT_CONFIGURED',503);
  return Buffer.from(hkdfSync('sha256',secret,'Cohamy CRM server settings','Brevo credential encryption v1',32));
}
function storageReady(){try{masterKey();return true;}catch{return false;}}
function seal(value:string){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',masterKey(),iv);cipher.setAAD(aad);
  const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');
}
function open(value:string){
  const key=masterKey();
  try{
    const parts=value.split('.');
    if(parts.length!==4||parts[0]!=='v1'||parts.slice(1).some(p=>!p||!/^[A-Za-z0-9_-]+$/.test(p)))throw Error();
    const [iv,tag,encrypted]=parts.slice(1).map(p=>Buffer.from(p,'base64url'));
    if(iv.length!==12||tag.length!==16||encrypted.length<16||encrypted.length>1024||[iv,tag,encrypted].some((b,i)=>b.toString('base64url')!==parts[i+1]))throw Error();
    const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(aad);decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8');
  }catch{throw new CrmError('BREVO_SECRET_UNREADABLE',503);}
}
async function readRow(sql:Sql){
  try{return (await sql.query<Row>("SELECT key_ciphertext,sender_email,version FROM cohamy_crm.brevo_settings WHERE id='BREVO'")).rows[0];}
  catch{throw new CrmError('BREVO_SETTINGS_UNAVAILABLE',503);}
}
function environmentSettings(){return {key:process.env.CRM_BREVO_API_KEY??'',sender:process.env.CRM_BREVO_SENDER_EMAIL??''};}
/** Internal only. Never serialize this result into a response, audit or log. */
export async function resolveBrevoSettings(sql?:Sql):Promise<{key:string;sender:string;source:Source;version:number}>{
  // Standalone provider callers without a configured CRM database retain env compatibility.
  const db=sql??(process.env.CRM_DATABASE_MODE==='pglite'||process.env.CRM_DATABASE_URL?await database():undefined);
  const row=db?await readRow(db):undefined;
  if(row)return {key:row.key_ciphertext?open(row.key_ciphertext):'',sender:row.sender_email,source:'DATABASE',version:row.version};
  const env=environmentSettings();return {...env,source:env.key||env.sender?'ENVIRONMENT':'NONE',version:0};
}
export async function brevoServerStatus(sql?:Sql){
  const ready=storageReady(),common={enabled:process.env.CRM_EMAIL_ENABLED==='true',demo:isBrevoDemo(),webhookConfigured:!!process.env.CRM_BREVO_WEBHOOK_TOKEN,storageReady:ready};
  let row:Row|undefined;
  try{
    const db=sql??(process.env.CRM_DATABASE_MODE==='pglite'||process.env.CRM_DATABASE_URL?await database():undefined);
    row=db?await readRow(db):undefined;
    const env=environmentSettings();
    const resolved=row?{key:row.key_ciphertext?open(row.key_ciphertext):'',sender:row.sender_email,source:'DATABASE' as Source,version:row.version}:{...env,source:(env.key||env.sender?'ENVIRONMENT':'NONE') as Source,version:0};
    return {...common,configured:!!resolved.key&&z.email().safeParse(resolved.sender).success,keyConfigured:!!resolved.key,sender:resolved.sender,source:resolved.source,version:resolved.version,storageError:ready?null:'BREVO_ENCRYPTION_NOT_CONFIGURED'};
  }catch(error){
    // Return only a controlled error code; ciphertext and crypto diagnostics remain private.
    return {...common,configured:false,keyConfigured:!!row?.key_ciphertext,sender:row?.sender_email??'',source:'DATABASE' as Source,version:row?.version??0,storageError:error instanceof CrmError?error.code:'BREVO_SETTINGS_UNAVAILABLE'};
  }
}
function admin(user:Principal){if(user.area!=='crm'||user.role!=='ADMIN')throw new CrmError('FORBIDDEN',403);}
export async function getBrevoSettings(user:Principal){admin(user);const db=await database();await assertCurrentPrincipal(db,user);return brevoServerStatus(db);}
const schema=z.object({version:z.number().int().min(0),senderEmail:z.email().max(320).transform(v=>v.toLowerCase()),apiKey:z.string().trim().max(1024).default(''),removeKey:z.boolean().default(false)}).strict();
function auditStatus(row:Row|undefined){const env=environmentSettings();return {source:row?'DATABASE':env.key||env.sender?'ENVIRONMENT':'NONE',sender:row?.sender_email??env.sender,keyConfigured:row?!!row.key_ciphertext:!!env.key,version:row?.version??0};}
export async function saveBrevoSettings(user:Principal,input:unknown){
  admin(user);const parsed=schema.safeParse(input);if(!parsed.success)throw new CrmError('INVALID_FIELDS',400);
  const d=parsed.data;
  if(d.apiKey&&(d.removeKey||d.apiKey.length<16||!/^[\x21-\x7e]+$/.test(d.apiKey)))throw new CrmError('INVALID_FIELDS',400);
  masterKey();
  const db=await database();
  return db.transaction(async sql=>{
    await assertCurrentPrincipal(sql,user);
    // An inserted sentinel locks even the first save; failed writes roll it back.
    await sql.query("INSERT INTO cohamy_crm.brevo_settings(id) VALUES('BREVO') ON CONFLICT DO NOTHING");
    const row=(await sql.query<Row>("SELECT key_ciphertext,sender_email,version FROM cohamy_crm.brevo_settings WHERE id='BREVO' FOR UPDATE")).rows[0];
    if(row.version!==d.version)throw new CrmError('VERSION_CONFLICT',409);
    const previous=row.version===0?undefined:row;
    const currentKey=d.removeKey?'':d.apiKey||(previous?previous.key_ciphertext?open(previous.key_ciphertext):'':environmentSettings().key);
    if(currentKey&&(currentKey.length<16||currentKey.length>1024||!/^[\x21-\x7e]+$/.test(currentKey)))throw new CrmError('INVALID_FIELDS',400);
    const encrypted=currentKey?seal(currentKey):null;
    await sql.query("UPDATE cohamy_crm.brevo_settings SET key_ciphertext=$1,sender_email=$2,version=version+1,updated_by=$3,updated_at=now() WHERE id='BREVO'",[encrypted,d.senderEmail,user.id]);
    const after={key_ciphertext:encrypted,sender_email:d.senderEmail,version:row.version+1};
    await audit(sql,user.id,'brevo.settings-saved','BREVO',{before:auditStatus(previous),after:auditStatus(after),keyAction:d.removeKey?'REMOVED':d.apiKey?'REPLACED':'RETAINED'});
    return {version:after.version};
  });
}
