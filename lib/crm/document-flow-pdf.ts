import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import {fixed,fixedText} from './decimal';
import {vndToVietnameseWords} from './order-invoice-model';
import {flowLabels,type FlowSnapshot} from './document-flow-model';

type Run={text:string;size:number;bold:boolean;italic:boolean;color:string;image:boolean};
type Paragraph={type:'p';runs:Run[];align:string;before:number;after:number;line:number};
type Cell={width:number;span:number;shade:string|null;margins:{top:number;left:number;bottom:number;right:number};borders:Record<string,{color:string;size:number}>;paragraphs:Paragraph[]};
type Row={height:number;cells:Cell[]};
type Table={type:'table';index:number;grid:number[];rows:Row[]};
type Layout={page:{width:number;height:number;left:number;right:number;top:number;bottom:number};blocks:(Paragraph|Table)[];footer:Paragraph[]};
const root=()=>path.join(process.cwd(),'assets/crm');
const money=(v:string)=>v===''?'—':new Intl.NumberFormat('vi-VN').format(BigInt(v||'0'));
export function deliveryPlaceholders(s:FlowSnapshot):Record<string,string>{
 const d=s.delivery,t=s.totals,na='—';
 return {MA_PHIEU_GIAO:s.code,MA_DON_HANG:s.sourceCode||na,NGAY_LAP:new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(s.confirmedAt??s.createdAt)),NGUOI_GIAO:d.giver||na,SDT_NGUOI_GIAO:d.giverPhone||na,KHO_XUAT:s.warehouseName,TEN_DOI_TAC:d.customer||na,NGUOI_NHAN_HANG:d.recipient||na,SDT_NHAN_HANG:d.recipientPhone||na,DIA_CHI_GIAO_HANG:d.address||na,NGAY_GIAO:d.deliveryDate||na,GIO_GIAO:d.deliveryTime||na,DON_VI_VAN_CHUYEN:d.carrier||na,TONG_SL_GIAO:fixedText(s.lines.reduce((n,l)=>n+fixed(l.quantity),0n)),TONG_SO_THUNG:d.packages||na,SL_CHENH_LECH:d.shortage||na,TINH_TRANG_HANG:d.condition||na,TIEN_HANG:money(t.goods??''),CHIET_KHAU:money(t.discount??''),PHI_VAN_CHUYEN:money(t.shipping??''),TONG_THANH_TOAN:money(t.total??''),DA_THANH_TOAN:money(t.paid??''),CON_PHAI_THU:money(t.remaining??''),GHI_CHU_GIAO_NHAN:d.note||s.note||na,SO_TIEN_BANG_CHU:t.total?vndToVietnameseWords(t.total):na};
}
async function fonts(doc:PDFKit.PDFDocument){
 const dirs=[process.env.CRM_DOCUMENT_FONT_DIRECTORY,process.platform==='win32'?'C:/Windows/Fonts':undefined].filter(Boolean) as string[];
 for(const dir of dirs){try{const [regular,bold,italic,boldItalic]=await Promise.all(['arial.ttf','arialbd.ttf','ariali.ttf','arialbi.ttf'].map(f=>fs.readFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ dir,f))));doc.registerFont('Body',regular).registerFont('Bold',bold).registerFont('Italic',italic).registerFont('BoldItalic',boldItalic);return;}catch{}}
 const [regular,bold]=await Promise.all(['BeVietnamPro-Regular.ttf','BeVietnamPro-SemiBold.ttf'].map(f=>fs.readFile(path.join(root(),'fonts',f))));doc.registerFont('Body',regular).registerFont('Bold',bold).registerFont('Italic',regular).registerFont('BoldItalic',bold);
}
function setupDoc(s:FlowSnapshot){
 const doc=new PDFDocument({size:'A4',margin:0,bufferPages:true,info:{Title:`${flowLabels[s.kind]} ${s.code}`,Author:'CÔNG TY TNHH COHAMY'}}),chunks:Buffer[]=[];
 const done=new Promise<Buffer>((resolve,reject)=>{doc.on('data',b=>chunks.push(Buffer.from(b)));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});return {doc,done};
}
export async function renderFlowPdf(s:FlowSnapshot):Promise<Buffer>{
 if(s.kind==='ISSUE')return renderDeliveryPdf(s);
 const {doc,done}=setupDoc(s);await fonts(doc);const left=36,width=523;let y=36;
 doc.font('Bold').fontSize(15).fillColor('#182C43').text('CÔNG TY TNHH COHAMY',left,y,{width});y+=28;
 doc.fontSize(16).text(flowLabels[s.kind].toLocaleUpperCase('vi'),left,y,{width});y+=30;
 const details=[`${s.code} · Phiên bản ${s.revision} · ${s.state==='DRAFT'?'BẢN NHÁP':s.state==='LEGACY'?'CHỨNG TỪ CŨ':'ĐÃ XÁC NHẬN'}`,`Nhà máy: ${s.factoryName}`,`Kho nhận: ${s.warehouseName}`,`Nguồn: ${s.sourceCode||'—'} · Đề nghị: ${s.requestCode||s.code}`,`Người lập: ${s.createdBy} · ${s.createdAt}`,`Xác nhận: ${s.confirmedBy||'—'} · ${s.confirmedAt||'—'}`,`Ngày cần hàng: ${s.dueDate||'—'}`];
 doc.font('Body').fontSize(9).fillColor('#394C60');for(const line of details){doc.text(line,left,y,{width});y=doc.y+6;}y+=10;
 const header=()=>{doc.rect(left,y,width,24).fill('#182C43');doc.font('Bold').fontSize(8).fillColor('#ffffff').text('SKU / Tên hàng',left+6,y+7,{width:245}).text('ĐVT',left+260,y+7,{width:45}).text('Số lượng',left+310,y+7,{width:64}).text('Số chuyển / Chênh lệch',left+382,y+7,{width:137});y+=24;};header();
 for(const l of s.lines){doc.font('Body').fontSize(9);const h=Math.max(32,doc.heightOfString(`${l.sku} · ${l.name}${l.note?'\n'+l.note:''}`,{width:245})+12);if(y+h>770){doc.addPage();y=36;header();}doc.rect(left,y,width,h).lineWidth(.5).stroke('#D9E2E9');doc.fillColor('#394C60').text(`${l.sku} · ${l.name}${l.note?'\n'+l.note:''}`,left+6,y+6,{width:245}).text(l.unit,left+260,y+6,{width:45}).text(l.quantity,left+310,y+6,{width:64}).text(`${l.shipped} / ${l.difference}`,left+382,y+6,{width:135});y+=h;}
 if(y+60>780){doc.addPage();y=36;}doc.font('Body').fontSize(9).text(`Ghi chú: ${s.note||'—'}`,left,y+14,{width});
 const range=doc.bufferedPageRange();for(let i=0;i<range.count;i++){doc.switchToPage(i);doc.fontSize(8).fillColor('#6B7681').text(`${s.code} · v${s.revision} · Trang ${i+1}/${range.count}`,left,810,{width,lineBreak:false});}doc.end();return done;
}
export async function renderDeliveryPdf(s:FlowSnapshot,original=false):Promise<Buffer>{
 const layout=JSON.parse(await fs.readFile(path.join(root(),'delivery-template/layout.json'),'utf8')) as Layout;
 const logo=await fs.readFile(path.join(root(),'delivery-template/logo.png'));
 const {doc,done}=setupDoc(s);await fonts(doc);const p=layout.page,width=p.width-p.left-p.right;
 const values=deliveryPlaceholders(s);let y=p.top;
 const text=(v:string)=>original?v:v.replace(/\{\{(\w+)\}\}/g,(_,k:string)=>values[k]??'—');
 const setRun=(r:Run)=>doc.font(r.bold?r.italic?'BoldItalic':'Bold':r.italic?'Italic':'Body').fontSize(r.size).fillColor(/^([0-9A-F]{6})$/i.test(r.color)?`#${r.color}`:'#394C60');
 function paragraphHeight(q:Paragraph,w:number){if(q.runs.some(r=>r.image))return 39.7+q.before+q.after;const max=Math.max(1,...q.runs.map(r=>r.size));const combined=q.runs.map(r=>text(r.text)).join('');doc.font(q.runs.some(r=>r.bold)?'Bold':'Body').fontSize(max);const lineHeight=max*q.line;return q.before+Math.max(lineHeight,doc.heightOfString(combined||' ',{width:Math.max(10,w),lineGap:lineHeight-doc.currentLineHeight(true)}))+q.after;}
 function drawParagraph(q:Paragraph,x:number,top:number,w:number){
   const total=paragraphHeight(q,w);top+=q.before;
   if(q.runs.some(r=>r.image)){doc.image(logo,x+(w-137.5)/2,top,{width:137.5,height:39.7});return total;}
   const runs=q.runs.length?q.runs:[{text:' ',size:8,bold:false,italic:false,color:'394C60',image:false}];
   const max=Math.max(...runs.map(r=>r.size));doc.x=x;doc.y=top;
   const combined=runs.map(r=>text(r.text)).join('');
   if((q.align==='right'||q.align==='center')&&!combined.includes('\n')){
     const widths=runs.map(r=>{setRun(r);return doc.widthOfString(text(r.text));}),sum=widths.reduce((a,b)=>a+b,0);
     if(sum<=w){let dx=x+(q.align==='right'?w-sum:(w-sum)/2);runs.forEach((r,i)=>{setRun(r);doc.text(text(r.text),dx,top,{lineBreak:false});dx+=widths[i];});return total;}
   }
   runs.forEach((r,i)=>{setRun(r);doc.text(text(r.text)||' ',i===0?x:doc.x,i===0?top:doc.y,{width:Math.max(10,w),align:(['left','right','center','justify'].includes(q.align)?q.align:'left') as PDFKit.Mixins.TextOptions['align'],continued:i<runs.length-1,lineGap:max*q.line-doc.currentLineHeight(true)});});
   return total;
 }
 function rowHeight(r:Row){return Math.max(r.height,...r.cells.map(c=>c.margins.top+c.margins.bottom+c.paragraphs.reduce((n,q)=>n+paragraphHeight(q,c.width-c.margins.left-c.margins.right),0)));}
 function drawRow(r:Row){const h=rowHeight(r);let x=p.left;for(const c of r.cells){if(c.shade)doc.rect(x,y,c.width,h).fill(`#${c.shade}`);for(const [side,b] of Object.entries(c.borders)){doc.lineWidth(b.size).strokeColor(`#${b.color}`);if(side==='top')doc.moveTo(x,y).lineTo(x+c.width,y);if(side==='bottom')doc.moveTo(x,y+h).lineTo(x+c.width,y+h);if(side==='left')doc.moveTo(x,y).lineTo(x,y+h);if(side==='right')doc.moveTo(x+c.width,y).lineTo(x+c.width,y+h);doc.stroke();}let cy=y+c.margins.top;for(const q of c.paragraphs)cy+=drawParagraph(q,x+c.margins.left,cy,c.width-c.margins.left-c.margins.right);x+=c.width;}y+=h;}
 function newPage(){doc.addPage();y=p.top;}
 for(let blockIndex=0;blockIndex<layout.blocks.length;blockIndex++){
   const b=layout.blocks[blockIndex];
   if(b.type==='p'){const h=paragraphHeight(b,width),label=b.runs.map(r=>r.text).join(''),next=layout.blocks[blockIndex+1];
     const keep=next?.type==='table'&&/^0[1-4]\s/.test(label)?(/^0[34]\s/.test(label)?next.rows.reduce((sum,r)=>sum+rowHeight(r),0):rowHeight(next.rows[0])):0;
     if(y+h+keep>p.height-p.bottom-14)newPage();y+=drawParagraph(b,p.left,y,width);continue;}
   let rows=b.rows;
   if(b.index===3&&!original){
     const pattern=b.rows[1];rows=[b.rows[0],...s.lines.map((l,i)=>{const cells=structuredClone(b.rows[1+i%6].cells);const texts=[String(i+1),`${l.name}\n${l.sku}`,l.unit,l.ordered,l.quantity,money(l.unitPrice),money(l.amount)];cells.forEach((c,j)=>{const q=c.paragraphs[0]??pattern.cells[0].paragraphs[0],r=q.runs[0]??{text:'',size:8,bold:false,italic:false,color:'394C60',image:false};c.paragraphs=[{...q,runs:[{...r,text:texts[j]}]}];});return {height:pattern.height,cells};})];
     while(rows.length<7){const blank=structuredClone(b.rows[rows.length]);blank.cells.forEach((c,j)=>{c.paragraphs=[{type:'p',runs:[{text:j===0?String(rows.length):' ',size:8,bold:false,italic:false,color:'394C60',image:false}],align:j===1?'left':'center',before:0,after:0,line:1.08}];});rows.push(blank);}
   }
   for(let ri=0;ri<rows.length;ri++){
     const r=rows[ri],h=rowHeight(r);
     if(y+h>p.height-p.bottom-14){newPage();if(b.index===3&&ri>0)drawRow(rows[0]);}
     drawRow(r);
   }
 }
 const range=doc.bufferedPageRange();for(let i=0;i<range.count;i++){doc.switchToPage(i);let fy=p.height-25;for(const q of layout.footer){fy+=drawParagraph(q,p.left,fy,width);}doc.font('Body').fontSize(6.5).fillColor('#6B7681').text(`${original?'Mẫu gốc':s.code} · ${i+1}/${range.count}`,p.left,p.height-12,{width,lineBreak:false,align:'right'});}
 doc.end();return done;
}
export async function renderBusinessPdf(label:string,code:string,status:string,snapshot:unknown):Promise<Buffer>{
 const placeholder={kind:'REQUEST',code} as FlowSnapshot;
 const {doc,done}=setupDoc(placeholder);await fonts(doc);let y=36;const left=36,width=523;
 doc.font('Bold').fontSize(14).fillColor('#182C43').text('CÔNG TY TNHH COHAMY',left,y,{width});y+=28;
 doc.fontSize(13).text(label,left,y,{width});y=doc.y+10;doc.font('Body').fontSize(9).text(`Mã chứng từ: ${code}\nTrạng thái: ${status}`,left,y,{width});y=doc.y+16;
 const labels:Record<string,string>={record:'Chứng từ',version:'Phiên bản đã lưu',children:'Chi tiết chứng từ',result:'Kết quả sự kiện',snapshot:'Nội dung đã chốt',lines:'Dòng hàng',code:'Mã',status:'Trạng thái',quantity:'Số lượng',amount:'Số tiền',name:'Tên',sku:'Mã sản phẩm',reason:'Lý do',note:'Ghi chú',created_at:'Ngày lập',updated_at:'Cập nhật',received:'Thực nhận',sent:'Đã gửi',delivered:'Đã giao',planned:'Kế hoạch',product_id:'Sản phẩm',warehouse_id:'Kho',unit_price:'Đơn giá',total_amount:'Tổng tiền',needed_on:'Ngày cần hàng',expected_on:'Ngày dự kiến',filename:'Tên file',checksum:'Checksum',issuedAt:'Ngày lập',validUntil:'Hiệu lực đến'};
 function line(value:string,bold=false,indent=0){doc.font(bold?'Bold':'Body').fontSize(8.5);const h=doc.heightOfString(value,{width:width-indent,lineGap:2})+5;if(y+h>790){doc.addPage();y=36;}doc.fillColor('#394C60').text(value,left+indent,y,{width:width-indent,lineGap:2});y=doc.y+5;}
 function walk(v:unknown,labelText:string,depth=0){if(depth>9)return;if(v===null||v===undefined||v==='')return;if(Array.isArray(v)){if(!v.length)return;line(labelText,true,depth*10);v.forEach((x,i)=>walk(x,`Dòng ${i+1}`,depth+1));return;}if(typeof v==='object'){line(labelText,true,depth*10);for(const [key,item] of Object.entries(v)){if(['request_hash','idempotency_key','actor_id','creator_id','created_by','updated_by'].includes(key))continue;walk(item,labels[key]??key,depth+1);}return;}line(`${labelText}: ${String(v)}`,false,depth*10);}
 walk(snapshot,'Nội dung chứng từ');doc.end();return done;
}
