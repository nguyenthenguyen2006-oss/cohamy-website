import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import {buyerMoney,buyerStatusLabels,type BuyerOrder} from './buyer-model';

export async function buyerOrderPdf(b:BuyerOrder){
 const doc=new PDFDocument({size:'A4',margin:40,bufferPages:true,info:{Title:'Đơn đặt hàng '+b.code,Author:'Cohamy'}});
 const chunks:Buffer[]=[],done=new Promise<Buffer>((resolve,reject)=>{doc.on('data',c=>chunks.push(Buffer.from(c)));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 const dir=path.join(process.cwd(),'assets/crm/fonts');
 const [regular,bold]=await Promise.all(['BeVietnamPro-Regular.ttf','BeVietnamPro-SemiBold.ttf'].map(f=>fs.readFile(path.join(dir,f))));
 doc.registerFont('Body',regular).registerFont('Bold',bold).font('Bold').fontSize(17).text('COHAMY · ĐƠN ĐẶT HÀNG');
 doc.fontSize(12).text(b.code).moveDown(.5).font('Body').fontSize(10);
 for(const s of [b.organization_name,buyerStatusLabels[b.status],'Kho: '+b.warehouse_name,b.delivery.branchName?'Chi nhánh: '+b.delivery.branchName:'','Người nhận: '+b.delivery.recipient+' · '+b.delivery.phone,b.delivery.address,b.contract_snapshot?'Hợp đồng: '+b.contract_snapshot.code:'',b.quote_expires_on?'Báo giá có hiệu lực đến: '+b.quote_expires_on:''])if(s)doc.text(s);
 doc.moveDown();let y=doc.y;
 const header=()=>{doc.rect(40,y,515,24).fill('#182c43').fillColor('white').font('Bold').fontSize(9).text('Sản phẩm',46,y+6,{width:225}).text('SL / Quy đổi',277,y+6,{width:98}).text('Giá / ĐVT gốc',380,y+6,{width:85}).text('Tổng có VAT',470,y+6,{width:79});y+=24;doc.fillColor('#182c43').font('Body');};
 header();for(const l of b.lines){
  const name=l.sku+' · '+l.name,h=Math.max(44,doc.heightOfString(name,{width:225})+14);
  if(y+h>750){doc.addPage();y=40;header();}
  doc.fontSize(9).rect(40,y,515,h).lineWidth(.5).stroke('#cbd5e1').text(name,46,y+7,{width:225})
   .text(l.quantity+' '+(l.unit==='CASE'?'thùng':l.unitLabel)+'\n'+l.baseQuantity+' '+l.unitLabel,277,y+7,{width:95})
   .text(buyerMoney(l.unitPrice)+(l.vatRate!==null?'\nVAT '+l.vatRate+'%':''),380,y+7,{width:85}).text(buyerMoney(l.total),470,y+7,{width:79});y+=h;
 }
 if(y>630){doc.addPage();y=40;}
 if(b.lines.every(l=>l.total!==null)){
  doc.font('Body').fontSize(10).text('Tiền hàng trước VAT: '+buyerMoney(String(b.lines.reduce((n,l)=>n+BigInt(l.net!),0n))),40,y+16,{width:515});
  doc.text('Thuế VAT: '+buyerMoney(String(b.lines.reduce((n,l)=>n+BigInt(l.vat!),0n))),40,doc.y+5,{width:515});y=doc.y;
 }
 if(BigInt(b.quote_fee_amount??'0')>0n){doc.font('Body').fontSize(10).text('Phí theo bảng giá: '+buyerMoney(b.quote_fee_amount),40,y+12,{width:515});y=doc.y;}
 doc.font('Bold').fontSize(11).text('Tổng cộng: '+(b.lines.some(l=>l.total===null)?'Chờ Sales báo giá':buyerMoney(String(b.lines.reduce((n,l)=>n+BigInt(l.total!),BigInt(b.quote_fee_amount??'0'))))),40,y+16,{width:515});
 doc.font('Body').fontSize(9).text('Ghi chú: '+(b.note||'—'),40,doc.y+12,{width:515}).moveDown().text('Đơn đặt hàng không thay thế hóa đơn VAT. PDF giao hàng và VAT được lưu riêng theo chứng từ đã phát hành.');
 const pages=doc.bufferedPageRange();for(let i=0;i<pages.count;i++){doc.switchToPage(i);doc.fontSize(8).text(b.code+' · v'+b.version+' · Trang '+(i+1)+'/'+pages.count,40,784,{width:515,lineBreak:false});}
 doc.end();return done;
}
