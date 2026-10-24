import fs from 'node:fs/promises';
import {renderDeliveryPdf} from '../../lib/crm/document-flow-pdf';
import type {FlowSnapshot} from '../../lib/crm/document-flow-model';
const base:FlowSnapshot={id:'00000000-0000-4000-8000-000000000001',code:'QA-GH-20261023',kind:'ISSUE',revision:1,state:'CONFIRMED',warehouseId:'00000000-0000-4000-8000-000000000002',warehouseName:'LOCAL QA · Kho Hà Nội',warehouseCode:'QA-HN',factoryMembershipId:null,factoryName:'',sourceId:'00000000-0000-4000-8000-000000000003',sourceCode:'QA-DON-20261023',sourceRevision:1,requestId:null,requestCode:'',createdAt:'2026-10-23T06:00:00Z',createdBy:'LOCAL QA',confirmedAt:'2026-10-23T06:00:00Z',confirmedBy:'LOCAL QA',dueDate:'',note:'Dữ liệu thử riêng để kiểm tra tiếng Việt, phân trang và số tiền lớn.',lines:[{productId:'00000000-0000-4000-8000-000000000004',sku:'QA-COHAMY-01',name:'LOCAL QA · Sô cô la hạnh nhân — tên sản phẩm dài để kiểm tra xuống dòng',unit:'gói',quantity:'100',ordered:'100',shipped:'100',received:'0',difference:'0',unitPrice:'1234567890123',amount:'123456789012300',note:''}],delivery:{giver:'LOCAL QA · Nguyễn Văn Giao',giverPhone:'0900000123',recipient:'LOCAL QA · Trần Thị Nhận',recipientPhone:'0900000456',address:'LOCAL QA · Địa chỉ thử, không dùng giao hàng thật',deliveryDate:'2026-10-23',deliveryTime:'13:00',carrier:'LOCAL QA · Xe giao thử',customer:'LOCAL QA · Khách hàng thử',packages:'10',condition:'LOCAL QA · Đủ theo kiểm đếm',shortage:'0'},totals:{goods:'123456789012300',discount:'1234567890123',shipping:'25000',total:'122222221147177',paid:'0',remaining:'122222221147177'}};
async function main(){
await fs.mkdir('docs/crm/test-results/document-flow',{recursive:true});
await fs.writeFile('docs/crm/test-results/document-flow/template-pdfkit-reference.pdf',await renderDeliveryPdf(base,true));
for(const n of [1,12,80]){const s={...base,lines:Array.from({length:n},(_,i)=>({...base.lines[0],sku:`QA-${i+1}`,productId:`qa-${i+1}`,name:`${base.lines[0].name} · dòng ${i+1}`}))};await fs.writeFile(`docs/crm/test-results/document-flow/delivery-${n}-lines.pdf`,await renderDeliveryPdf(s));}
console.log('Rendered source layout + 1 / 12 / 80 lines');

}
main().catch(e=>{console.error(e);process.exitCode=1;});
