import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import ExcelJS from 'exceljs';
import {database,type Database} from '../../lib/crm/db';
import {createQaFixture,qaPassword} from './qa-fixture';
import {login} from '../../lib/crm/auth';
import {previewImport,confirmImport} from '../../lib/crm/data-jobs';
async function main(){const directory=process.env.CRM_LOCAL_DATA_DIR;if(process.env.CRM_ENVIRONMENT!=='LOCAL'||process.env.CRM_DATABASE_MODE!=='pglite'||!/^\.local[\\/]crm-qa-worker-restart-[a-f0-9-]+$/.test(directory??''))throw new Error('SEPARATE_QA_DATABASE_REQUIRED');const mode=process.argv[2],file=directory+'-job.json';
if(mode==='prepare'){await createQaFixture();const admin=(await login('admin@crm-qa.invalid',qaPassword)).user,book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Data');sheet.addRow(['Code','Name']);sheet.addRow(['QA_RESTART_1','LOCAL QA Restart One']);sheet.addRow(['QA_RESTART_2','LOCAL QA Restart Two']);const job=await previewImport(admin,Buffer.from(await book.xlsx.writeBuffer()),{idempotencyKey:randomUUID(),kind:'CUSTOMER',mapping:{code:1,name:2}});await confirmImport(admin,job.id);await fs.writeFile(file,JSON.stringify({id:job.id}));await(await database()).close();return;}
const {id}=JSON.parse(await fs.readFile(file,'utf8')),db=await database();
if(mode==='claim-and-wait'){const wrapped:Database={query:(sql,params)=>db.query(sql,params),exec:sql=>db.exec(sql),close:()=>db.close(),transaction:async fn=>{const result=await db.transaction(fn);if(result&&typeof result==='object'&&'id' in result&&result.id===id){process.send?.({claimed:id});await new Promise(()=>{});}return result;}};(globalThis as unknown as {cohamyCrmDatabase:Promise<Database>}).cohamyCrmDatabase=Promise.resolve(wrapped);await import('./worker');return;}
try{const job=(await db.query<{status:string;attempts:number}>('SELECT status,attempts FROM cohamy_crm.data_jobs WHERE id=$1',[id])).rows[0];if(mode==='expire-fixture-lease'){assert.equal(job.status,'RUNNING');assert.equal(job.attempts,1);assert.equal((await db.query('SELECT id FROM cohamy_crm.organizations WHERE import_job_id=$1',[id])).rows.length,0);await db.query("UPDATE cohamy_crm.data_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[id]);}else if(mode==='verify'){assert.equal(job.status,'SUCCEEDED');assert.equal(job.attempts,2);assert.equal((await db.query('SELECT id FROM cohamy_crm.organizations WHERE import_job_id=$1',[id])).rows.length,2);}else throw new Error('INVALID_FIXTURE_MODE');}finally{await db.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
