import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import ExcelJS from 'exceljs';
const postgres=process.env.CRM_DATABASE_MODE==='postgres';
if(!postgres){process.env.CRM_DATABASE_MODE='pglite';process.env.CRM_ENVIRONMENT='LOCAL';process.env.CRM_LOCAL_DATA_DIR='.local/crm-qa-request-excel-'+randomUUID();}
async function main(){
 const {createQaFixture,qaPassword}=await import('./qa-fixture'),{database}=await import('../../lib/crm/db'),auth=await import('../../lib/crm/auth'),prices=await import('../../lib/crm/pricing'),fixture=await import('./pricing-fixture'),excel=await import('../../lib/crm/request-excel'),requests=await import('../../lib/crm/order-requests'),repo=await import('../../lib/crm/repository'),{validateCommercialXlsx}=await import('../../lib/crm/commercial-xlsx'),{installQaRuntime}=await import('./qa-runtime');
 const ids=await createQaFixture(),owner=await database(),admin=(await auth.login('admin@crm-qa.invalid',qaPassword)).user,a=(await auth.login('a@crm-qa.invalid',qaPassword)).user,b=(await auth.login('b@crm-qa.invalid',qaPassword)).user;
 await fixture.createPriceProducts(admin);let book=await prices.savePriceBook(admin,{version:0,name:'QA Excel price',definition:fixture.qaPriceDefinition,idempotencyKey:randomUUID()});await prices.publishPriceBook(admin,{id:book.id,version:book.version,versionId:book.versionId,action:'PUBLISH',reason:'QA fictitious price',idempotencyKey:randomUUID()});
 const close=await installQaRuntime(owner),db=await database(),cases:{name:string;status:string}[]=[];
 const input={organizationId:ids.dealerA,mapping:{sku:1,unit:2,quantity:3},delivery:{recipient:'QA Người nhận',phone:'0900000123',address:'QA fictitious delivery'},discountBasisPoints:0,creditTerms:false,note:'QA only',idempotencyKey:randomUUID()};
 const file=async(rows:ExcelJS.CellValue[][],header:ExcelJS.CellValue[]=['SKU','Unit','Quantity'])=>{const w=new ExcelJS.Workbook(),s=w.addWorksheet('Request');s.addRow(header);for(const row of rows)s.addRow(row);return Buffer.from(await w.xlsx.writeBuffer());};
 const bytes=await file([['QA_PRICE_A','CASE',2],['QA_PRICE_B','BASE','1.5']]);
 const preview=(data:Buffer=bytes,extra:Record<string,unknown>={})=>excel.previewExcelRequest(a,data,{...input,...extra,idempotencyKey:randomUUID()});
 const test=async(name:string,run:()=>Promise<void>)=>{try{await run();cases.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){cases.push({name,status:'FAIL'});throw e;}};
 try{
  await test('F015 real XLSX template opens; actual expanded ZIP bytes are bounded; forged size/encryption/macro/corruption rejected',async()=>{
   const template=await excel.excelRequestTemplate(a),w=new ExcelJS.Workbook();await w.xlsx.load(template as unknown as ExcelJS.Buffer);assert.equal(w.worksheets[0].getRow(1).getCell(1).text,'SKU');assert.ok(validateCommercialXlsx(bytes).expandedBytes>0);
   const central=bytes.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));assert.ok(central>0);
   for(const mutate of [(d:Buffer)=>d.writeUInt32LE(1,central+24),(d:Buffer)=>d.writeUInt16LE(1,central+8),(d:Buffer)=>d.fill(0,0,4),(d:Buffer)=>{const n=d.readUInt16LE(central+28);d.write('vbaProject',central+46,Math.min(n,10));}]){const corrupt=Buffer.from(bytes);mutate(corrupt);assert.throws(()=>validateCommercialXlsx(corrupt),/FILE_TYPE_INVALID/);}
   assert.throws(()=>validateCommercialXlsx(Buffer.alloc(2097153)),/FILE_SIZE_INVALID/);
  });
  await test('F015 invalid/formula/unknown SKU rows retain Excel row errors and cannot create a partial draft',async()=>{
   const p=await preview(await file([['QA_PRICE_A','CASE','1.5'],['UNKNOWN','BASE',1],['QA_PRICE_B','BASE',{formula:'1+1',result:2}],['QA_PRICE_B','BASE','1.1234567']]));assert.equal(p.rows.length,4);assert.ok(p.rows.every(r=>r.errors.length>0));assert.equal(p.basket,null);assert.equal(p.calculation,null);await assert.rejects(excel.confirmExcelRequest(a,{id:p.id}),/IMPORT_HAS_ERRORS/);assert.equal((await requests.listCommercialRequests(a)).length,0);
  });
  await test('F015 mapping changes real columns; preview alone creates no request; explicit confirmation atomically creates all rows as unsent draft',async()=>{
   const p=await preview(await file([[2,'CASE','QA_PRICE_A']],['Quantity','Unit','SKU']),{mapping:{sku:3,unit:2,quantity:1}});assert.equal(p.rows[0].baseQuantity,'24');assert.equal((await requests.listCommercialRequests(a)).length,0);const r=await excel.confirmExcelRequest(a,{id:p.id}),h=await requests.commercialRequestAccess(db,a,r.id);assert.equal(h.channel,'EXCEL');assert.equal(h.status,'DRAFT');assert.equal((await requests.listCommercialRequests(admin)).some(x=>x.id===r.id),false);assert.equal((await db.query('SELECT id FROM cohamy_crm.sales_orders')).rows.length,0);assert.deepEqual(await excel.confirmExcelRequest(a,{id:p.id}),r);
  });
  await test('F015 same input/file retry returns exact preview; altered file/key conflicts; another organization cannot see or confirm preview',async()=>{
   const p=await excel.previewExcelRequest(a,bytes,input);assert.deepEqual(await excel.previewExcelRequest(a,bytes,input),p);await assert.rejects(excel.previewExcelRequest(a,await file([['QA_PRICE_A','BASE',1]]),input),/IDEMPOTENCY_CONFLICT/);await assert.rejects(excel.confirmExcelRequest(b,{id:p.id}),/NOT_FOUND/);await assert.rejects(preview(bytes,{organizationId:ids.dealerB}),/NOT_FOUND/);
  });
  await test('F015 expired preview is blocked and no draft/result is written',async()=>{
   const p=await preview();await owner.query("UPDATE cohamy_crm.request_excel_previews SET expires_at=now()-interval '1 second' WHERE id=$1",[p.id]);await assert.rejects(excel.confirmExcelRequest(a,{id:p.id}),/PREVIEW_EXPIRED/);assert.equal((await db.query<{result:unknown}>('SELECT result FROM cohamy_crm.request_excel_previews WHERE id=$1',[p.id])).rows[0].result,null);
  });
  await test('F015 current unit version change blocks previously valid preview even when ratio has same numeric value',async()=>{
   const p=await preview(),{commercialProducts}=await import('../../lib/crm/commercial-read'),products=await commercialProducts(admin),product=products.find(p=>p.sku==='QA_PRICE_A')!,u=product.units.find(u=>u.code==='CASE')!;await prices.savePriceUnit(admin,{productId:product.id,productVersion:product.version,code:u.code,label:u.label,numerator:u.numerator,denominator:u.denominator,isCase:u.is_case,allowFractional:u.allow_fractional,active:true,version:u.version,reason:'QA unit version changed'});await assert.rejects(excel.confirmExcelRequest(a,{id:p.id}),/PREVIEW_STALE/);
  });
  await test('F015 SQL failure during immutable draft insertion rolls back request and preview result together',async()=>{
   const p=await preview(),before=(await requests.listCommercialRequests(a)).length;await owner.exec("CREATE FUNCTION cohamy_crm.qa_fail_excel() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA_EXCEL_FAILURE'; END; $$; CREATE TRIGGER qa_fail_excel BEFORE INSERT ON cohamy_crm.commercial_request_versions FOR EACH ROW EXECUTE FUNCTION cohamy_crm.qa_fail_excel();");await assert.rejects(excel.confirmExcelRequest(a,{id:p.id}),/QA_EXCEL_FAILURE/);assert.equal((await requests.listCommercialRequests(a)).length,before);assert.equal((await db.query<{result:unknown}>('SELECT result FROM cohamy_crm.request_excel_previews WHERE id=$1',[p.id])).rows[0].result,null);await owner.exec('DROP TRIGGER qa_fail_excel ON cohamy_crm.commercial_request_versions; DROP FUNCTION cohamy_crm.qa_fail_excel();');assert.ok((await excel.confirmExcelRequest(a,{id:p.id})).id);
  });
  await test('F015 latest published price change requires a new preview instead of silently accepting new totals',async()=>{
   const p=await preview(),head=await prices.getPriceBook(admin,book.id);book=await prices.savePriceBook(admin,{id:head.id,version:head.version,name:head.name,definition:{...fixture.qaPriceDefinition,feeAmount:'2000'},idempotencyKey:randomUUID()});await prices.publishPriceBook(admin,{id:book.id,version:book.version,versionId:book.versionId,action:'PUBLISH',reason:'QA changed current source',idempotencyKey:randomUUID()});await assert.rejects(excel.confirmExcelRequest(a,{id:p.id}),/PREVIEW_STALE/);
  });
  if(postgres)await test('F015 competing distinct previews for same actor do not deadlock; five same-preview retries create one draft',async()=>{
   const p=await preview(),q=await preview(),results=await Promise.all([excel.confirmExcelRequest(a,{id:p.id}),excel.confirmExcelRequest(a,{id:q.id}),...Array.from({length:4},()=>excel.confirmExcelRequest(a,{id:p.id}))]);assert.equal(new Set(results.map(r=>r.id)).size,2);assert.ok(results.slice(2).every(r=>r.id===results[0].id));
  });
  await test('F136 membership lock/unlock invalidates preview identity; fresh login cannot reuse previous membership version',async()=>{
   const p=await preview();await repo.setAccountActive(admin,a.membershipId,{active:false});await repo.setAccountActive(admin,a.membershipId,{active:true});await assert.rejects(excel.confirmExcelRequest(a,{id:p.id}),/FORBIDDEN/);const fresh=(await auth.login('a@crm-qa.invalid',qaPassword)).user;await assert.rejects(excel.confirmExcelRequest(fresh,{id:p.id}),/PREVIEW_STALE/);
  });
 }finally{await fs.mkdir('docs/crm/test-results',{recursive:true});await fs.writeFile('docs/crm/test-results/request-excel-'+(postgres?'postgres':'local')+'.json',JSON.stringify({testedAt:new Date().toISOString(),environment:postgres?'STAGING isolated fictitious PostgreSQL DML-only role':'LOCAL isolated fictitious PGlite',status:cases.length===(postgres?10:9)&&cases.every(c=>c.status==='PASS')?'PASS':'FAIL',cases},null,2));await close();await owner.close();}
}
main().catch(e=>{console.error(e instanceof Error?e.message:'REQUEST_EXCEL_QA_FAILED');process.exitCode=1;});
