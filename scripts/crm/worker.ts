import {database} from '../../lib/crm/db';
import {runNextJob} from '../../lib/crm/data-jobs';
import {runCareAutomation} from '../../lib/crm/care-automation';
import {runNotificationOutbox} from '../../lib/crm/workspace';
import {runDueReportSubscriptions} from '../../lib/crm/reports';
import {runDueReminders} from '../../lib/crm/finance';
let stopping=false;process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
async function main(){const once=process.argv.includes('--once');try{do{const worked=await runNextJob(),care=await runCareAutomation(),reminders=await runDueReminders(),reports=await runDueReportSubscriptions(),outbox=await runNotificationOutbox();if(once)break;if(!worked&&!care&&!reminders.processed&&!reports.processed&&!outbox.processed)await new Promise(resolve=>setTimeout(resolve,5000));}while(!stopping);}finally{await(await database()).close();}}
main().catch(()=>{console.error('CRM worker stopped: check database configuration and migrations.');process.exitCode=1;});
