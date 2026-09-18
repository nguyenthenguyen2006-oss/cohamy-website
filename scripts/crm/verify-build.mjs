import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();let traces=0;const leaks=[],migrations=new Set(),pdfAssets=new Set();
async function scan(directory){
 for(const entry of await fs.readdir(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);
  if(entry.isDirectory())await scan(file);
  else if(entry.name.endsWith('.nft.json')){
   traces++;const trace=JSON.parse(await fs.readFile(file,'utf8'));
   for(const item of trace.files){
    const relative=path.relative(root,path.resolve(path.dirname(file),item)).replaceAll('\\','/');
    if(relative.startsWith('.local/')||relative.startsWith('docs/crm/test-results/')||relative.startsWith('.impeccable/review/')||relative.startsWith('../EDUHMB/')||/^scripts\/crm\/(?:qa-mailbox\.mjs|start-upgrade-qa\.mjs|worker-restart-fixture\.ts)$/.test(relative))leaks.push({trace:path.relative(root,file),file:relative});
    if(relative.startsWith('db/crm/'))migrations.add(relative);
    if(relative.startsWith('assets/crm/fonts/')||relative==='public/images/logo/cohamy-brand-logo.png'||relative.startsWith('node_modules/pdfkit/'))pdfAssets.add(relative);
   }
  }
 }
}
await scan(path.join(root,'.next','server'));assert.ok(traces>0);assert.deepEqual(leaks,[],'QA/private reference files must never enter deployment traces');
const expectedMigrations=(await fs.readdir(path.join(root,'db','crm'))).filter(name=>name.endsWith('.sql')).map(name=>'db/crm/'+name);
for(const migration of expectedMigrations)assert.ok(migrations.has(migration),'Missing migration in deployment trace: '+migration);
for(const asset of ['assets/crm/fonts/BeVietnamPro-Regular.ttf','assets/crm/fonts/BeVietnamPro-SemiBold.ttf','public/images/logo/cohamy-brand-logo.png'])assert.ok(pdfAssets.has(asset),'Missing PDF asset: '+asset);
assert.ok(pdfAssets.has('node_modules/pdfkit/js/data/Helvetica.afm'),'PDFKit constructor default font data missing');
const report={environment:'LOCAL',testedAt:new Date().toISOString(),cases:[{name:'Production build traces exclude local QA databases, backups, screenshots and HumanBank reference',status:'PASS'},{name:'All CRM migration files included in API tracing',status:'PASS'},{name:'Full Vietnamese PDF fonts/logo and PDFKit AFM data included',status:'PASS'}],traceCount:traces,includedMigrations:[...migrations],includedPdfAssets:[...pdfAssets],leaks,deployment:'NOT RUN',runtimePostgres:'NOT RUN'};
await fs.writeFile('docs/crm/test-results/build-traces-local.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
