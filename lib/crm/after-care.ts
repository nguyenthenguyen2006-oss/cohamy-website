import 'server-only';
import {after} from 'next/server';
import {runCareAutomation} from './care-automation';

// Fast response follow-up; the managed worker remains responsible for recovery.
export function afterCareCommit(){
 after(async()=>{try{await runCareAutomation();}catch{console.error('CRM_CARE_TICK_FAILED; managed worker will retry');}});
}
