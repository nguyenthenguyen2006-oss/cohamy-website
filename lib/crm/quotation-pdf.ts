import 'server-only';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import PDFDocument from 'pdfkit';
import {database} from './db';
import {CrmError} from './permissions';
import {audit,assertCurrentPrincipal} from './auth';
import {quotationAccess,quoteVersionAccess,type Quotation,type QuotationVersion} from './quotations';
import type {Principal} from './types';
const navy='#172b43',orange='#b9420c',muted='#46566a';
export const pdfChecksum=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const vnd=(value:string)=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(BigInt(value));
const date=(value:string)=>new Intl.DateTimeFormat('vi-VN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(value));
export async function renderQuotationPdf(head:Quotation,version:QuotationVersion,sent=false):Promise<Buffer>{
 const [regular,bold,logo]=await Promise.all([fs.readFile(path.join(process.cwd(),'assets/crm/fonts/BeVietnamPro-Regular.ttf')),fs.readFile(path.join(process.cwd(),'assets/crm/fonts/BeVietnamPro-SemiBold.ttf')),fs.readFile(path.join(process.cwd(),'public/images/logo/cohamy-brand-logo.png'))]);
 const doc=new PDFDocument({size:'A4',margins:{top:44,bottom:48,left:44,right:44},bufferPages:true,info:{Title:head.code+' · Phiên bản '+version.number,Author:'Cohamy',Subject:'Báo giá tiếng Việt · VND',CreationDate:new Date(version.created_at)}}),chunks:Buffer[]=[];
 const result=new Promise<Buffer>((resolve,reject)=>{doc.on('data',b=>chunks.push(Buffer.from(b)));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));});
 doc.registerFont('Body',regular).registerFont('Strong',bold);const left=44,width=doc.page.width-88,bottom=doc.page.height-58;let y=44;
 const text=(value:string,x:number,top:number,w:number,size=9,strong=false,color=navy)=>{doc.font(strong?'Strong':'Body').fontSize(size).fillColor(color).text(value,x,top,{width:w,lineGap:3});return doc.y;};
 const block=(value:string,strong=false,size=10,color=navy)=>{doc.font(strong?'Strong':'Body').fontSize(size);const h=doc.heightOfString(value,{width,lineGap:3});if(h>bottom-76)throw new CrmError('PDF_TEXT_TOO_LONG',400);if(y+h>bottom){doc.addPage();y=44;}y=text(value,left,y,width,size,strong,color)+10;};
 doc.rect(0,0,doc.page.width,93).fill(navy);doc.image(logo,left,25,{fit:[136,42]});text('BÁO GIÁ',doc.page.width-196,26,152,21,true,'#ffffff');y=113;
 block(head.code+' · Phiên bản '+version.number,true,13);block(sent?'Bản đã gửi - nội dung và tổng tiền được giữ nguyên.':'Bản nháp - chưa gửi cho đối tác.',false,9,sent?muted:orange);
 const s=version.snapshot;block('Đối tác: '+s.organization.name,true);block([s.organization.code,s.organization.businessId?'Mã doanh nghiệp: '+s.organization.businessId:'',s.organization.phone,s.organization.email,s.organization.address].filter(Boolean).join(' · '),false,9,muted);
 block('Ngày lập: '+date(s.issuedAt)+' · Có hiệu lực đến: '+date(s.validUntil)+' (giờ Việt Nam)',false,9,muted);
 const columns=[{x:left,w:204,label:'Sản phẩm'},{x:left+214,w:74,label:'Số lượng'},{x:left+298,w:86,label:'Giá / đơn vị gốc'},{x:left+394,w:width-394,label:'Tổng dòng'}];
 function tableHeader(){doc.rect(left,y,width,28).fill('#edf1f5');for(const c of columns)text(c.label,c.x+4,y+7,c.w-8,8,true);y+=37;}
 if(y+70>bottom){doc.addPage();y=44;}tableHeader();
 for(const l of s.calculation.lines){
  const values=[l.name+'\n'+l.sku+(l.gift?' · Hàng tặng: '+l.giftRule:'')+'\n'+l.baseQuantity.replace('.',',')+' '+l.stockUnit+' sau quy đổi',l.quantity.replace('.',',')+'\n'+l.unitLabel,vnd(l.unitPrice)+'\nVND / '+l.stockUnit,vnd(l.total)+'\nVND'];
  const heights=values.map((v,i)=>{doc.font(i===0?'Strong':'Body').fontSize(8);return doc.heightOfString(v,{width:columns[i].w-8,lineGap:3});});const details='Trước giảm: '+vnd(l.gross)+' · Giảm: '+vnd(l.discount)+' · Thuế: '+vnd(l.tax)+' VND';doc.font('Body');const detailHeight=doc.heightOfString(details,{width:width-8,lineGap:3}),h=Math.max(...heights)+detailHeight+21;if(h>bottom-85)throw new CrmError('PDF_ROW_TOO_LONG',400);
  if(y+h>bottom){doc.addPage();y=44;tableHeader();}for(let i=0;i<columns.length;i++)text(values[i],columns[i].x+4,y,columns[i].w-8,8,i===0);const detailY=y+Math.max(...heights)+5;text(details,left+4,detailY,width-8,8,false,muted);y+=h;doc.moveTo(left,y-6).lineTo(left+width,y-6).lineWidth(.5).stroke('#cbd4df');
 }
 const amounts:[string,boolean,number][]=[['Tổng tiền (VND)',true,12],['Tiền hàng trước giảm: '+vnd(s.calculation.subtotal),false,10],['Chiết khấu: '+vnd(s.calculation.discount),false,10],['Thuế: '+vnd(s.calculation.tax),false,10],['Phí: '+vnd(s.calculation.fee),false,10],['Tổng thanh toán: '+vnd(s.calculation.total)+' VND',true,15]];
 const amountHeight=amounts.reduce((sum,[value,strong,size])=>{doc.font(strong?'Strong':'Body').fontSize(size);return sum+doc.heightOfString(value,{width,lineGap:3})+10;},12);if(y+amountHeight>bottom){doc.addPage();y=44;}else y+=12;for(const [value,strong,size]of amounts)block(value,strong,size);
 block('Giao hàng',true,12);block(s.delivery.recipient+' · '+s.delivery.phone+'\n'+s.delivery.address);block(s.calculation.deliveryTerms);if(s.note){block('Ghi chú gửi đối tác',true,11);block(s.note);}
 block('Nguồn giá: '+s.priceBook.name+' · Phiên bản '+s.priceBook.number+'\nTiền được tính theo đơn vị gốc; số lượng giao gồm cả hàng tặng. Thuế '+(s.policy.taxBasis==='LINE'?'làm tròn từng dòng':'làm tròn tổng đơn')+'.',false,8,muted);
 const range=doc.bufferedPageRange();for(let i=range.start;i<range.start+range.count;i++){doc.switchToPage(i);doc.font('Body').fontSize(8).fillColor(muted).text(head.code+' · Bản '+version.number,left,doc.page.height-35,{width:0,lineBreak:false}).text('Trang '+(i+1)+' / '+range.count,left+width-90,doc.page.height-35,{width:0,lineBreak:false});}doc.end();const bytes=await result;if(bytes.length>8388608)throw new CrmError('PDF_TOO_LARGE',400);return bytes;
}
export async function downloadQuotationPdf(user:Principal,id:string,versionId:string){return(await database()).transaction(async tx=>{await assertCurrentPrincipal(tx,user);const head=await quotationAccess(tx,user,id),v=await quoteVersionAccess(tx,user,head,versionId),stored=(await tx.query<{content:Uint8Array;checksum:string}>('SELECT content,checksum FROM cohamy_crm.quotation_pdfs WHERE version_id=$1',[v.id])).rows[0];let bytes:Buffer;if(stored){bytes=Buffer.from(stored.content);if(pdfChecksum(bytes)!==stored.checksum)throw new CrmError('PDF_CHECKSUM_INVALID',503);}else{if(user.area==='portal')throw new CrmError('PDF_NOT_AVAILABLE',409);bytes=await renderQuotationPdf(head,v,false);}await audit(tx,user.id,'quotation.pdf-downloaded',head.id,{after:{versionId:v.id,checksum:pdfChecksum(bytes)},reason:'Tải đúng phiên bản báo giá được phép đọc.'});return {bytes,filename:head.code+'-v'+v.number+'.pdf'};});}
