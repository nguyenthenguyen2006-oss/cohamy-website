import {spawn} from 'node:child_process';
import {writeFileSync,unlinkSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
writeFileSync('.local/cron-pause','LOCAL queue recovery test');
try {await delay(3000);const script=process.argv.includes('--providers')?'scripts/wordpress/verify-provider-contracts.php':'scripts/wordpress/verify-queue-recovery.php';const child=spawn(process.env.PHP_BINARY || 'php',['-c','.local/php.ini',script],{windowsHide:true,stdio:'inherit'});process.exitCode=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>resolve(code ?? 1));});}finally{unlinkSync('.local/cron-pause');}
