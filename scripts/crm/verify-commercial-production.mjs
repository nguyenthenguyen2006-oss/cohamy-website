import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {Pool} from 'pg';
const expected=process.argv[2],output=process.argv[3],cwd=process.cwd();
if(process.platform!=='linux'||!/^\/root\/cohamy-qa\//.test(cwd)||!/^[a-f0-9]{40}$/.test(expected??'')||!output?.startsWith(cwd+'/reports/'))throw Error('VERIFIED_VPS_REPORT_SCOPE_REQUIRED');
const release=(await fs.readFile('/root/cohamy-shared/current-release','utf8')).trim();assert.equal(release,'/root/cohamy-releases/'+expected);
const env=parseEnv(await fs.readFile('/root/cohamy-shared/postgres.env','utf8')),url=new URL('postgresql://127.0.0.1:55432/cohamy_crm');url.username='cohamy_owner';url.password=env.POSTGRES_PASSWORD;
const pool=new Pool({connectionString:url.href}),client=await pool.connect(),cases=[];
try{
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const tables=['price_tiers','organization_pricing','commercial_units','commercial_unit_versions','price_books','price_book_versions','price_events','quotations','quotation_versions','quotation_events','quotation_pdfs'];
 for(const name of tables)assert.equal((await client.query('SELECT to_regclass($1) IS NOT NULL AS present',['cohamy_crm.'+name])).rows[0].present,true);
 cases.push({name:'All11 pricing/quotation tables exist in actual deployed PostgreSQL',status:'PASS'});
 const immutable=(await client.query("SELECT DISTINCT c.relname AS name,has_table_privilege('cohamy_runtime',c.oid,'INSERT') AS append,has_table_privilege('cohamy_runtime',c.oid,'UPDATE') AS update,has_table_privilege('cohamy_runtime',c.oid,'DELETE') AS delete FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='cohamy_crm' AND t.tgfoid='cohamy_crm.deny_audit_mutation'::regproc ORDER BY c.relname")).rows;
 for(const name of ['commercial_unit_versions','price_book_versions','price_events','quotation_versions','quotation_events','quotation_pdfs'])assert.ok(immutable.some(t=>t.name===name));
 assert.ok(immutable.every(t=>t.append&&!t.update&&!t.delete));cases.push({name:'Actual runtime has append permission but no UPDATE/DELETE on every trigger-protected immutable table, including saved quotation PDFs',status:'PASS'});
 const roles=(await client.query("SELECT has_schema_privilege('cohamy_runtime','cohamy_crm','CREATE') AS schema_create,has_table_privilege('cohamy_runtime','cohamy_crm.migrations','SELECT') AS registry_read,has_table_privilege('cohamy_runtime','cohamy_crm.quotations','UPDATE') AS head_update,has_table_privilege('cohamy_runtime','cohamy_crm.commercial_units','UPDATE') AS unit_update")).rows[0];assert.deepEqual(roles,{schema_create:false,registry_read:false,head_update:true,unit_update:true});cases.push({name:'Runtime can change current commercial heads while owner-only migration registry and schema stay protected',status:'PASS'});
 for(const file of ['assets/crm/fonts/BeVietnamPro-Regular.ttf','assets/crm/fonts/BeVietnamPro-SemiBold.ttf','public/images/logo/cohamy-brand-logo.png'])assert.ok((await fs.stat(release+'/'+file)).size>1000);cases.push({name:'Deployed full Vietnamese fonts and Cohamy logo exist for PDF rendering',status:'PASS'});
 const counts=(await client.query('SELECT (SELECT count(*)::text FROM cohamy_crm.price_books WHERE status=\'PUBLISHED\') AS published_policies,(SELECT count(*)::text FROM cohamy_crm.quotation_versions) AS quote_versions,(SELECT count(*)::text FROM cohamy_crm.quotation_pdfs) AS saved_pdfs')).rows[0];
 await client.query('COMMIT');await fs.mkdir(cwd+'/reports',{recursive:true});await fs.writeFile(output,JSON.stringify({testedAt:new Date().toISOString(),sourceSha:expected,environment:'PRODUCTION read-only metadata; no fictitious policy, quote, PDF creation, business mutation or customer delivery',status:'PASS',cases,immutableTables:immutable.map(t=>t.name),counts,realCommercialWorkflow:'NOT_EXERCISED: approved business policies not supplied'},null,2),{mode:0o600});console.log('PASS production commercial metadata '+cases.length+'/'+cases.length);
}finally{client.release();await pool.end();}
