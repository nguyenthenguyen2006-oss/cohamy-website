import {spawn} from 'node:child_process';
import path from 'node:path';
if(!process.env.CRM_LOCAL_DATA_DIR?.startsWith('.local/crm-qa'))throw new Error('SET_SEPARATE_QA_DIRECTORY');
// NextRequest normalizes loopback IPs to localhost. A dev server whose internal
// origin remains 127.0.0.1 can then fetch localized rewrites as external requests.
// Keep the internal dev origin and browser origin identical; never bind publicly.
const port=process.env.CRM_QA_PORT||'4310';
if(!/^43[0-9]{2}$/.test(port))throw new Error('LOCAL_QA_PORT_REQUIRED');
const child=spawn(process.execPath,[path.resolve('node_modules/next/dist/bin/next'),'dev','--hostname','localhost','--port',port],{stdio:'inherit',env:{...process.env,CRM_QA_BUILD:'true',CRM_DATABASE_MODE:'pglite',CRM_ENVIRONMENT:'LOCAL',CRM_PUBLIC_ORIGIN:`http://localhost:${port}`,CRM_WEBSITE_ORDER_INTAKE:'true',BLOG_SOURCE:'legacy'}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>{process.exitCode=code??1;});
