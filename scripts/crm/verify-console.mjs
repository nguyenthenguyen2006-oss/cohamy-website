import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
const origin='http://localhost:4310',browser=await chromium.launch({channel:'msedge',headless:true});
const consoleMessages=[];
try {
 const context=await browser.newContext(),page=await context.newPage();
 page.on('console',message=>{if(['error','warning'].includes(message.type()))consoleMessages.push({url:page.url(),type:message.type(),text:message.text()});});
 await context.request.post(origin+'/api/crm/auth/login',{headers:{origin},data:{email:'admin@crm-qa.invalid',password:'Local-QA-Only-2026!'}});
 for(const route of ['/crm','/crm/goods','/crm/dealers','/crm/accounts','/vi/san-pham','/vi/san-pham/cohamy-socola-hanh-nhan','/vi/gio-hang','/vi/thanh-toan']){
  await page.goto(origin+route);await page.evaluate(()=>document.fonts.ready);
 }
 await context.request.post(origin+'/api/crm/auth/logout',{headers:{origin}});
 const report={environment:'LOCAL',testedAt:new Date().toISOString(),method:'Fresh headless Edge context; diagnostic console sample, not full E2E or a blanket zero-error proof',consoleMessages};
 await fs.writeFile('docs/crm/test-results/console-local.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
