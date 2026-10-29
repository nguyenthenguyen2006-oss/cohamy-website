import assert from 'node:assert/strict';
// The user-specified regression case. These constants are used only by release tests.
const requestId='52e60ea4-dc5b-4864-baaa-d437b4a18c17';
const versions=[
 {id:'66c6a784-4912-4278-ac1c-6cf572f09a4e',number:1,total:'997500',lines:6,checksum:'aaff17dc2914832dc34810f8ffd771cefbe76b641efc2f96f69b676ad4dad34f'},
 {id:'31df54db-7f7d-4cb5-8e93-d9138d504c3f',number:2,total:'2030000',lines:8,checksum:'93dca32cbe7ce8d1e4954eea7f77ec08a86008c171f30bdff1df6fad0e10586d'},
];
function checkPayload(data,version){
 assert.equal(data.summary.totalPayable,version.total);assert.equal(data.lines.length,version.lines);
 assert.equal(data.lines.reduce((n,l)=>n+BigInt(l.lineTotal),0n)+BigInt(data.summary.taxAmount)+BigInt(data.summary.feeAmount),BigInt(version.total));
 assert.equal(data.source.versionId,version.id);
 if(version.number===1){assert.deepEqual(data.lines.map(l=>l.finalUnitPrice),['59250','45000','61500','24000','67500','59250']);assert.equal(data.summary.subtotalAfterTier,'1330000');assert.equal(data.summary.extraDiscountAmount,'332500');assert.match(data.summary.totalBaseQuantityText,/^20\s/);}
}
const pageCount=bytes=>(bytes.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
export async function verifyOrderInvoiceHttp(request){
 const response=await request('/api/crm/commerce/request-versions?id='+requestId);assert.equal(response.status,200);const saved=await response.json(),evidence=[];
 for(const version of versions){assert.equal(saved.find(v=>v.id===version.id)?.checksum,version.checksum);assert.equal((await request('/crm/requests/'+requestId+'?v='+version.id+'&invoice=1')).status,200);const query=new URLSearchParams({requestId,versionId:version.id}),dataResponse=await request('/api/crm/commerce/invoice-data?'+query);assert.equal(dataResponse.status,200);checkPayload(await dataResponse.json(),version);const pdf=await request('/api/crm/commerce/invoice-pdf?'+query);assert.equal(pdf.status,200);assert.match(pdf.headers.get('content-type'),/application\/pdf/);const bytes=Buffer.from(await pdf.arrayBuffer()),pages=pageCount(bytes);assert.ok(pages>=1);if(version.number===1)assert.equal(pages,1);evidence.push({...version,pages,bytes:bytes.length});}
 return evidence;
}
export async function verifyOrderInvoiceMcp(client){
 const call=async(name,args)=>{const result=await client.callTool({name,arguments:args});assert.ok(!result.isError);return JSON.parse(result.content.find(c=>c.type==='text').text);};
 const capability=await call('cohamy_capabilities',{operation:'POST /api/crm/commerce/invoice-pdf'});assert.match(capability.operations[0].inputContract,/finalUnitPrice/);assert.match(capability.operations[0].inputContract,/required\(\{source:true\}\)/);
 for(const version of versions){const query={requestId,versionId:version.id},data=await call('cohamy_read',{operation:'GET /api/crm/commerce/invoice-data',query});assert.equal(data.status,200);checkPayload(data.data,version);const pdf=await call('cohamy_read',{operation:'GET /api/crm/commerce/invoice-pdf',query,fileLength:262144});assert.equal(pdf.status,200);assert.equal(pdf.file.nextOffset,null);assert.ok(pageCount(Buffer.from(pdf.file.base64,'base64'))>=1);if(version.number===1)assert.equal(pageCount(Buffer.from(pdf.file.base64,'base64')),1);}
}
