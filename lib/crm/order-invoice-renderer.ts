import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import {CrmError} from './permissions';
import {formatInvoiceMoney as money,invoiceTaxCode} from './order-invoice-pricing';
import {resolveInvoiceProductImage,vndToVietnameseWords,type OrderInvoicePayload} from './order-invoice-model';
const navy='#172b43',orange='#b9420c',muted='#46566a',border='#cbd4df';

export async function renderOrderInvoicePdf(p:OrderInvoicePayload):Promise<Buffer>{
 const [regular,bold,logo]=await Promise.all(['BeVietnamPro-Regular.ttf','BeVietnamPro-SemiBold.ttf'].map(n=>fs.readFile(path.join(process.cwd(),'assets/crm/fonts',n))).concat([fs.readFile(path.join(process.cwd(),'public/images/logo/cohamy-brand-logo.png'))]));
 const doc=new PDFDocument({size:'A4',margins:{top:24,bottom:24,left:30,right:30},bufferPages:true,info:{Title:'Hóa đơn đặt hàng '+p.invoiceCode,Author:'CÔNG TY TNHH COHAMY',Subject:'Phiếu xác nhận yêu cầu đặt hàng '+p.requestCode}});
 const chunks:Buffer[]=[],result=new Promise<Buffer>((resolve,reject)=>{doc.on('data',b=>chunks.push(Buffer.from(b)));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 doc.registerFont('Body',regular).registerFont('Strong',bold);
 const left=30,width=doc.page.width-60,bottom=doc.page.height-24,half=width/2;
 let y=24;
 const h=(text:string,w:number,size=9,strong=false)=>{doc.font(strong?'Strong':'Body').fontSize(size);return doc.heightOfString(text||' ',{width:w,lineGap:1.5});};
 const text=(value:string,x:number,top:number,w:number,size=9,strong=false,color=navy,align:'left'|'center'|'right'='left')=>{doc.font(strong?'Strong':'Body').fontSize(size).fillColor(color).text(value,x,top,{width:w,lineGap:1.5,align});};
 const box=(top:number,height:number,fill?:string)=>{if(fill)doc.rect(left,top,width,height).fill(fill);doc.rect(left,top,width,height).lineWidth(.5).stroke(border);};
 function continuation(){const label='HÓA ĐƠN ĐẶT HÀNG · Tiếp theo',meta=p.invoiceCode+' · '+p.requestCode;text(label,left,y,width,11,true);y+=h(label,width,11,true)+4;text(meta,left,y,width,8.5);y+=h(meta,width,8.5)+10;}
 function nextPage(){doc.addPage();y=24;continuation();}
 function ensure(needed:number){if(y+needed>bottom){nextPage();return true;}return false;}
 const thumbs=new Map<string,Buffer|null>(),publicRoot=path.resolve(process.cwd(),'public');
 for(const l of p.lines){const image=l.imagePath||resolveInvoiceProductImage(l.sku);if(thumbs.has(image))continue;
  const absolute=path.resolve(publicRoot,image.replace(/^\/+/,''));if(!absolute.startsWith(publicRoot+path.sep)){thumbs.set(image,null);continue;}
  try{const real=await fs.realpath(absolute);if(!real.startsWith(publicRoot+path.sep))throw Error('IMAGE_OUTSIDE_PUBLIC');thumbs.set(image,await sharp(await fs.readFile(real)).resize(96,96,{fit:'contain',background:'#fff'}).png().toBuffer());}catch{thumbs.set(image,null);}
 }
 // Every vertical coordinate advances by measured content; no continued text or fixed meta height.
 const company=p.sellerName||'CÔNG TY TNHH COHAMY',companyDetails='Trụ sở Hà Nội: Tầng 3, tháp A, Tòa T608, Phường Nghĩa Đô, TP. Hà Nội\nVP TP.HCM: Tổ 7, Cầu Mới, P. Tân Thành, TP Hồ Chí Minh\nĐiện thoại: 0981 956 111 · Email: Cohamyvietnam@gmail.com';
 const companyX=left+118,companyW=width-128,companyNameH=h(company,companyW,11,true),companyH=Math.max(54,companyNameH+h(companyDetails,companyW,8.2)+12);
 box(y,companyH,'#f8fafc');doc.rect(left,y,108,companyH).fill(navy);doc.image(logo,left+9,y+(companyH-34)/2,{fit:[90,34]});text(company,companyX,y+6,companyW,11,true);text(companyDetails,companyX,y+8+companyNameH,companyW,8.2,false);y+=companyH+6;
 const date=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(p.issuedAt));
 const titleWidth=width*.55,metaWidth=width-titleWidth,title='HÓA ĐƠN ĐẶT HÀNG',caption='Phiếu xác nhận yêu cầu đặt hàng & đối chiếu thanh toán',dated='Ngày lập: '+date;
 const meta=['Số hóa đơn: '+p.invoiceCode,'Mã YC đặt hàng: '+p.requestCode],titleH=h(title,titleWidth-16,14,true)+h(caption,titleWidth-16,8.5)+h(dated,titleWidth-16,8.5)+16,metaH=meta.reduce((n,t)=>n+h(t,metaWidth-16,9,true)+4,12),titleBoxH=Math.max(titleH,metaH);
 box(y,titleBoxH);doc.moveTo(left+titleWidth,y).lineTo(left+titleWidth,y+titleBoxH).stroke(border);let ty=y+6;text(title,left+8,ty,titleWidth-16,14,true);ty+=h(title,titleWidth-16,14,true)+2;text(caption,left+8,ty,titleWidth-16,8.5,false,muted);ty+=h(caption,titleWidth-16,8.5)+2;text(dated,left+8,ty,titleWidth-16,8.5);
 ty=y+6;for(const m of meta){text(m,left+titleWidth+8,ty,metaWidth-16,9,true,orange);ty+=h(m,metaWidth-16,9,true)+4;}y+=titleBoxH+6;
 const buyer=[`Đơn vị đặt mua: ${p.buyer.partnerName||'—'}`,`Mã đối tác: ${p.buyer.partnerCode||'—'}`,`Đơn vị ghi trên phiếu: ${p.buyer.invoiceCompanyName||'—'}`,`Mã số thuế / ĐKKD: ${invoiceTaxCode(p.buyer.taxCode)||'Chưa cung cấp'}`,`Địa chỉ: ${p.buyer.invoiceAddress||'—'}`,...([p.buyer.phone,p.buyer.email].some(v=>v&&v!=='—')?[`Liên hệ: ${[p.buyer.phone,p.buyer.email].filter(v=>v&&v!=='—').join(' · ')}`]:[])].join('\n');
 const delivery=[`Người nhận: ${p.delivery.recipient||'—'}`,`Điện thoại: ${p.delivery.phone||'—'}`,`Địa chỉ giao: ${p.delivery.address||'—'}`,`Dự kiến nhận hàng: ${p.delivery.expectedDeliveryDate||'Chưa xác định'}`].join('\n');
 const partyH=Math.max(h(buyer,half-16,8.7),h(delivery,half-16,8.7))+34;ensure(partyH);box(y,partyH);doc.rect(left,y,width,20).fill('#edf1f5');text('I. THÔNG TIN BÊN MUA',left+8,y+4,half-16,8.8,true);text('II. THÔNG TIN NHẬN HÀNG',left+half+8,y+4,half-16,8.8,true);doc.moveTo(left+half,y).lineTo(left+half,y+partyH).stroke(border);text(buyer,left+8,y+25,half-16,8.7);text(delivery,left+half+8,y+25,half-16,8.7);y+=partyH+8;
 const rows:[string,string,boolean][]=[['Tổng số lượng',p.summary.totalBaseQuantityText+' · '+p.summary.totalCasesText+' thùng',false],['Tổng giá niêm yết',money(p.summary.listSubtotal)+' VND',false],['Giảm / điều chỉnh giá sản phẩm',money((-BigInt(p.summary.productDiscountAmount)).toString())+' VND',false],['Tiền sau KM sản phẩm / CK cấp bậc',money(p.summary.subtotalAfterTier)+' VND',false],['CK đơn hàng'+(p.summary.extraDiscountPercent!=='0'?' '+p.summary.extraDiscountPercent+'%':'')+' (đã phân bổ)',money((-BigInt(p.summary.extraDiscountAmount)).toString())+' VND',false],
  ...(BigInt(p.summary.taxAmount)>0n?[['Thuế theo đơn hàng',money(p.summary.taxAmount)+' VND',false] as [string,string,boolean]]:[]),...(BigInt(p.summary.feeAmount)>0n?[['Phí',money(p.summary.feeAmount)+' VND',false] as [string,string,boolean]]:[]),['TỔNG PHẢI THANH TOÁN',money(p.summary.totalPayable)+' VND',true]];
 const summaryLabelW=width*.61,summaryValueW=width-summaryLabelW,rowHeights=rows.map(([label,value,total])=>Math.max(h(label,summaryLabelW-16,total?9.3:8.8,total),h(value,summaryValueW-16,total?10:9,total))+6);
 const words='Số tiền bằng chữ: '+(p.summary.amountInWords||vndToVietnameseWords(p.summary.totalPayable)),approx=p.lines.some(l=>l.unitPriceApproximate)?'Đơn giá cuối có làm tròn. Thành tiền từng dòng là số tiền chính xác đã phân bổ.':'';
 const wordsH=h(words,width,9,true),approxH=approx?h(approx,width,8)+4:0,signatureH=45+Math.max(h(p.signatures.buyerRepresentative||' ',half-12,9,true),h(p.signatures.managerRepresentative||' ',half-12,9,true));
 const tailH=rowHeights.reduce((a,b)=>a+b,0)+wordsH+approxH+signatureH+8;
 const cols=[{label:'STT',w:28},{label:'Ảnh',w:34},{label:'Tên sản phẩm / Quy cách',w:179},{label:'ĐVT',w:32},{label:'SL',w:30},{label:'Giá gốc (VND)',w:72},{label:'Giá sau KM & CK (VND)',w:72},{label:'Thành tiền cuối (VND)',w:width-447}];
 const tableHeaderH=Math.max(...cols.map(c=>h(c.label,c.w-8,8.5,true)))+10;
 function tableHeader(){box(y,tableHeaderH,navy);let x=left;for(const c of cols){text(c.label,x+4,y+5,c.w-8,8.5,true,'#fff','center');x+=c.w;}y+=tableHeaderH;}
 ensure(tableHeaderH+60);text('III. CHI TIẾT HÀNG HÓA · Giá theo ĐVT đã chọn',left,y,width,9,true);y+=17;tableHeader();
 for(let i=0;i<p.lines.length;i++){
  const l=p.lines[i],listPrice=money(l.listUnitPrice),finalPrice=(l.unitPriceApproximate?'~ ':'')+money(l.finalUnitPrice),intermediate=l.appliedUnitPrice!==l.listUnitPrice&&p.summary.extraDiscountAmount!=='0'?'Trước CK đơn: '+money(l.appliedUnitPrice)+' VND':'';
  const name=l.name+(l.conversionNote?'\n'+l.conversionNote:'')+(l.discountNote?'\n'+l.discountNote:'')+(intermediate?'\n'+intermediate:'');
  const rowH=Math.max(36,h(name,171,8.8,true)+8,h(listPrice,64,8.8)+8,h(finalPrice,64,8.8,true)+8,h(l.unitLabel,24,8.8)+8,h(l.quantity.replace('.',','),22,9)+8,h(money(l.lineTotal),cols[7].w-8,9,true)+8);
  if(ensure(rowH+(i===p.lines.length-1?tailH+7:0)))tableHeader();
  if(y+rowH>bottom)throw new CrmError('PDF_ROW_TOO_TALL',400);
  box(y,rowH,i%2?'#f8fafc':undefined);let x=left;
  const values=[String(i+1),'',name,l.unitLabel,l.quantity.replace('.',','),listPrice,finalPrice,money(l.lineTotal)];
  for(let k=0;k<cols.length;k++){const c=cols[k];if(k)doc.moveTo(x,y).lineTo(x,y+rowH).lineWidth(.4).stroke(border);
   if(k===1){const image=thumbs.get(l.imagePath||resolveInvoiceProductImage(l.sku));if(image)doc.image(image,x+3,y+5,{fit:[28,28]});}
   else text(values[k],x+4,y+5,c.w-8,k===7?9:8.8,k===2||k===6||k===7,k===6||k===7?orange:navy,k===0||k===3?'center':k>=4?'right':'left');x+=c.w;
  }y+=rowH;
 }
 y+=7;ensure(tailH);
 for(let i=0;i<rows.length;i++){const [label,value,total]=rows[i],rh=rowHeights[i];box(y,rh,total?'#edf1f5':undefined);text(label,left+8,y+4,summaryLabelW-16,total?9.3:8.8,total);text(value,left+summaryLabelW+8,y+4,summaryValueW-16,total?10:9,total,total?orange:navy,'right');y+=rh;}
 y+=6;text(words,left,y,width,9,true);y+=wordsH+4;if(approx){text(approx,left,y,width,8,false,muted);y+=approxH;}
 text('ĐẠI DIỆN BÊN MUA',left,y,half,9,true,navy,'center');text('ĐẠI DIỆN PHỤ TRÁCH',left+half,y,half,9,true,navy,'center');y+=13;text('(Ký, ghi rõ họ tên)',left,y,half,8,false,muted,'center');text('(Ký, ghi rõ họ tên)',left+half,y,half,8,false,muted,'center');y+=30;text(p.signatures.buyerRepresentative,left+6,y,half-12,9,true,navy,'center');text(p.signatures.managerRepresentative,left+half+6,y,half-12,9,true,navy,'center');
 const range=doc.bufferedPageRange();for(let i=range.start;i<range.start+range.count;i++){doc.switchToPage(i);const saved=doc.page.margins.bottom;doc.page.margins.bottom=0;text(p.invoiceCode,left,doc.page.height-20,width-90,7.5,false,muted);text(`Trang ${i+1} / ${range.count}`,left+width-85,doc.page.height-20,85,7.5,false,muted,'right');doc.page.margins.bottom=saved;}
 doc.end();const bytes=await result;if(bytes.length>8388608)throw new CrmError('PDF_TOO_LARGE',400);return bytes;
}
