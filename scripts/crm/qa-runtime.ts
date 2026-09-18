import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {Pool} from 'pg';
import type {Database} from '../../lib/crm/db';
// Isolated QA only: business service tests must use the same DML ceiling as live.
export async function installQaRuntime(owner:Database):Promise<()=>Promise<void>>{
 if(process.env.CRM_DATABASE_MODE!=='postgres')return async()=>{};
 const url=new URL(process.env.CRM_DATABASE_URL??'');if(process.env.CRM_ENVIRONMENT!=='STAGING'||!['localhost','127.0.0.1'].includes(url.hostname)||url.port!=='55432'||!/^\/cohamy_qa_[a-z0-9_]+$/.test(url.pathname))throw Error('ISOLATED_POSTGRES_QA_REQUIRED');
 const role='qa_commercial_'+randomUUID().replaceAll('-',''),password=randomBytes(24).toString('hex');
 await owner.exec("CREATE ROLE "+role+" LOGIN PASSWORD '"+password+"'; GRANT USAGE ON SCHEMA cohamy_crm TO "+role+"; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA cohamy_crm TO "+role+"; REVOKE ALL ON cohamy_crm.migrations FROM "+role+"; GRANT EXECUTE ON FUNCTION cohamy_crm.lock_partner_merge() TO "+role+";");
 const immutable=(await owner.query<{name:string}>("SELECT DISTINCT c.relname AS name FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='cohamy_crm' AND t.tgfoid='cohamy_crm.deny_audit_mutation'::regproc")).rows;
 for(const table of immutable){assert.match(table.name,/^\w+$/);await owner.exec('REVOKE UPDATE,DELETE ON cohamy_crm.'+table.name+' FROM '+role);}
 url.username=role;url.password=password;const pool=new Pool({connectionString:url.href,max:8});
 const adapter:Database={query:async(text,params)=>({rows:(await pool.query(text,params)).rows}),exec:async text=>{await pool.query(text);},transaction:async fn=>{const client=await pool.connect();try{await client.query('BEGIN');const result=await fn({query:async(text,params)=>({rows:(await client.query(text,params)).rows}),exec:async text=>{await client.query(text);}});await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}},close:()=>pool.end()};
 (globalThis as unknown as {cohamyCrmDatabase:Promise<Database>}).cohamyCrmDatabase=Promise.resolve(adapter);return()=>adapter.close();
}
