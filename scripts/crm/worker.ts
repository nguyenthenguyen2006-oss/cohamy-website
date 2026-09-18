import {database} from '../../lib/crm/db';
import {runNextJob} from '../../lib/crm/data-jobs';
let stopping=false;process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
async function main(){const once=process.argv.includes('--once');try{do{const worked=await runNextJob();if(once)break;if(!worked)await new Promise(resolve=>setTimeout(resolve,5000));}while(!stopping);}finally{await(await database()).close();}}
main().catch(()=>{console.error('CRM worker stopped: check database configuration and migrations.');process.exitCode=1;});
