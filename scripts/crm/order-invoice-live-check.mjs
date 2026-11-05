import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// Historical user cases belong to business data. Never recreate them in a smoke.
const historicalRequestId='52e60ea4-dc5b-4864-baaa-d437b4a18c17';
const historicalVersions=[
 {id:'66c6a784-4912-4278-ac1c-6cf572f09a4e',number:1,total:'997500',lines:6,checksum:'aaff17dc2914832dc34810f8ffd771cefbe76b641efc2f96f69b676ad4dad34f'},
 {id:'31df54db-7f7d-4cb5-8e93-d9138d504c3f',number:2,total:'2030000',lines:8,checksum:'93dca32cbe7ce8d1e4954eea7f77ec08a86008c171f30bdff1df6fad0e10586d'},
];
const pageCount=bytes=>(bytes.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
const checksum=value=>{
 const normalize=item=>Array.isArray(item)?item.map(normalize):item&&typeof item==='object'?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>[key,normalize(v)])):item;
 return createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');
};
function checkPayload(data,source,version,historical){
 const snapshot=source.kind==='ORDER'?version.snapshot.quote:version.snapshot;
 assert.equal(checksum(version.snapshot),version.checksum,'Saved snapshot checksum changed');
 assert.equal(data.source.kind,source.kind);assert.equal(data.source.id,source.id);assert.equal(data.source.versionId,version.id);
 assert.equal(data.lines.length,snapshot.calculation.lines.length);assert.equal(data.summary.totalPayable,snapshot.calculation.total);
 assert.equal(data.summary.subtotalAfterTier,snapshot.calculation.subtotal);assert.equal(data.summary.extraDiscountAmount,snapshot.calculation.discount);
 assert.equal(data.summary.taxAmount,snapshot.calculation.tax??'0');assert.equal(data.summary.feeAmount,snapshot.calculation.fee??'0');
 const sum=key=>data.lines.reduce((n,line)=>n+BigInt(line[key]),0n);
 assert.equal(sum('lineTotal')+BigInt(data.summary.taxAmount)+BigInt(data.summary.feeAmount),BigInt(data.summary.totalPayable));assert.equal(sum('taxAmount'),BigInt(data.summary.taxAmount));
 for(const line of data.lines){assert.equal(BigInt(line.lineSubtotal)-BigInt(line.allocatedDiscount),BigInt(line.lineTotal));assert.equal(BigInt(line.lineTotal)+BigInt(line.taxAmount),BigInt(line.payableTotal));}
 if(historical){
  assert.equal(version.checksum,historical.checksum);assert.equal(data.summary.totalPayable,historical.total);assert.equal(data.lines.length,historical.lines);
  if(historical.number===1){assert.deepEqual(data.lines.map(l=>l.finalUnitPrice),['59250','45000','61500','24000','67500','59250']);assert.equal(data.summary.subtotalAfterTier,'1330000');assert.equal(data.summary.extraDiscountAmount,'332500');assert.match(data.summary.totalBaseQuantityText,/^20\s/);}
 }
}
function notFound(response,label){assert.equal(response.status,404,label);assert.equal(response.data?.error,'NOT_FOUND',label);}

async function verifyViews(adapter){
 const evidence={scope:'LIVE_SOURCE',historicalFixture:{requestId:historicalRequestId,state:'AVAILABLE',versions:[]},selected:[],positivePdf:'NOT_RUN',sixLineHistoricalPdf:'NOT_RUN',discovery:{}};
 const originalHead=await adapter.json('request',{id:historicalRequestId});
 const originalVersions=await adapter.json('request-versions',{id:historicalRequestId});
 if(originalHead.status===404){notFound(originalHead,'historical head');notFound(originalVersions,'historical versions');evidence.historicalFixture.state='ABSENT_FROM_CURRENT_DATA';}
 else{assert.equal(originalHead.status,200);assert.equal(originalVersions.status,200);assert.ok(Array.isArray(originalVersions.data));evidence.historicalFixture.status=originalHead.data.status;}
 const verifyOne=async(source,version,historical)=>{
  const query={...(source.kind==='ORDER'?{orderId:source.id}:{requestId:source.id}),versionId:version.id};
  const data=await adapter.json('invoice-data',query);assert.equal(data.status,200);checkPayload(data.data,source,version,historical);
  if(adapter.page)assert.equal((await adapter.page('/crm/'+(source.kind==='ORDER'?'sales':'requests')+'/'+source.id+'?v='+version.id+'&invoice=1')).status,200);
  const pdf=await adapter.pdf(query);assert.equal(pdf.status,200);assert.match(pdf.mime,/application\/pdf/);assert.ok(pdf.bytes.subarray(0,5).equals(Buffer.from('%PDF-')));assert.ok(pdf.bytes.length>1024);
  const pages=pageCount(pdf.bytes);assert.ok(pages>=1);if(historical?.number===1){assert.equal(pages,1);evidence.sixLineHistoricalPdf='PASS';}
  const reread=await adapter.json(source.kind==='ORDER'?'order-versions':'request-versions',{id:source.id});assert.equal(reread.status,200);assert.equal(reread.data.find(item=>item.id===version.id)?.checksum,version.checksum);
  evidence.selected.push({kind:source.kind,id:source.id,versionId:version.id,number:version.number,checksum:version.checksum,lines:data.data.lines.length,total:data.data.summary.totalPayable,tax:data.data.summary.taxAmount,pages,bytes:pdf.bytes.length,historicalFixture:!!historical});evidence.positivePdf='PASS';
 };
 for(const historical of historicalVersions){
  const version=originalVersions.status===200?originalVersions.data.find(item=>item.id===historical.id):undefined;
  if(version){await verifyOne({kind:'REQUEST',id:historicalRequestId},version,historical);evidence.historicalFixture.versions.push({id:historical.id,state:'VERIFIED'});}
  else{
   const query={requestId:historicalRequestId,versionId:historical.id};
   notFound(await adapter.json('invoice-data',query),'absent historical invoice data');notFound(await adapter.pdf(query),'absent historical invoice PDF');
   evidence.historicalFixture.versions.push({id:historical.id,state:'ABSENT',invoiceDataStatus:404,invoicePdfStatus:404});
  }
 }
 const [requests,orders]=await Promise.all([adapter.json('requests'),adapter.json('orders')]);
 assert.equal(requests.status,200);assert.equal(orders.status,200);assert.ok(Array.isArray(requests.data));assert.ok(Array.isArray(orders.data));
 evidence.discovery={nativeRequestCount:requests.data.length,nativeOrderCount:orders.data.length,viewLimit:100};
 if(!evidence.selected.length){
  for(const [kind,heads] of [['REQUEST',requests.data],['ORDER',orders.data]]){
   for(const head of heads){
    const saved=await adapter.json(kind==='ORDER'?'order-versions':'request-versions',{id:head.id});assert.equal(saved.status,200);assert.ok(Array.isArray(saved.data));
    const version=saved.data.find(item=>item.id===(kind==='ORDER'?(head.confirmed_version_id||head.latest_version_id):head.latest_version_id));
    if(!version)continue;
    // Buyer snapshots must retain their own invoice workflow.
    if(kind==='REQUEST'&&Object.hasOwn(version.snapshot,'buyerOrderId'))continue;
    await verifyOne({kind,id:head.id},version);break;
   }
   if(evidence.selected.length)break;
  }
 }
 if(!evidence.selected.length){
  assert.equal(requests.data.length,0,'Current request views contain data but no compatible invoice source was verified');assert.equal(orders.data.length,0,'Current order views contain data but no compatible invoice source was verified');
  evidence.scope='NO_LIVE_SOURCE';evidence.reason='Current authenticated request and sales-order views are empty; historical head/versions return NOT_FOUND. No production fixture was created.';
  evidence.positivePdf='NOT_RUN_NO_LIVE_SOURCE';evidence.sixLineHistoricalPdf='NOT_RUN_HISTORICAL_SOURCE_ABSENT';
 }
 return evidence;
}

export async function verifyOrderInvoiceHttp(request){
 const json=async(action,query={})=>{const response=await request('/api/crm/commerce/'+action+'?'+new URLSearchParams(query));return {status:response.status,data:await response.json()};};
 const pdf=async query=>{const response=await request('/api/crm/commerce/invoice-pdf?'+new URLSearchParams(query));if(response.status!==200)return {status:response.status,data:await response.json()};return {status:response.status,mime:response.headers.get('content-type'),bytes:Buffer.from(await response.arrayBuffer())};};
 const evidence=await verifyViews({json,pdf,page:path=>request(path)});
 // Invalid input stops before source lookup/audit/PDF creation.
 const invalid=await request('/api/crm/commerce/invoice-pdf',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(invalid.status,400);assert.equal((await invalid.json()).error,'INVALID_FIELDS');evidence.invalidPostStatus=400;
 return evidence;
}

export async function verifyOrderInvoiceMcp(client){
 const call=async(name,args)=>{const result=await client.callTool({name,arguments:args});assert.ok(!result.isError);return JSON.parse(result.content.find(c=>c.type==='text').text);};
 const capability=await call('cohamy_capabilities',{operation:'POST /api/crm/commerce/invoice-pdf'});assert.match(capability.operations[0].inputContract,/finalUnitPrice/);assert.match(capability.operations[0].inputContract,/required\(\{source:true\}\)/);
 const json=(action,query={})=>call('cohamy_read',{operation:'GET /api/crm/commerce/'+action,query});
 const pdf=async query=>{
  let response=await call('cohamy_read',{operation:'GET /api/crm/commerce/invoice-pdf',query,fileLength:262144});if(response.status!==200)return response;
  const chunks=[Buffer.from(response.file.base64,'base64')],total=response.file.totalBytes,mime=response.file.mime;
  while(response.file.nextOffset!==null){assert.ok(chunks.length<500);const offset=response.file.nextOffset;response=await call('cohamy_read',{operation:'GET /api/crm/commerce/invoice-pdf',query,fileOffset:offset,fileLength:262144});assert.equal(response.status,200);assert.equal(response.file.offset,offset);assert.equal(response.file.totalBytes,total);chunks.push(Buffer.from(response.file.base64,'base64'));}
  const bytes=Buffer.concat(chunks);assert.equal(bytes.length,total);return {status:200,mime,bytes};
 };
 const evidence=await verifyViews({json,pdf});
 if(evidence.scope==='NO_LIVE_SOURCE'){
  for(const table of ['commercial_requests','commercial_request_versions','sales_orders','sales_order_versions']){const result=await call('cohamy_data',{table,limit:1});assert.equal(result.total,0,'Empty native views must agree with complete Admin data counts');evidence.discovery[table+'Total']=result.total;}
 }
 return evidence;
}
