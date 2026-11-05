import {apiUser,apiError,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import {createBuyerOrder,quoteBuyerOrder,confirmBuyerOrder,cancelBuyerOrder,saveBuyerBranch,saveBuyerContract,
 buyerSetup,listBuyerOrders,buyerOrderDetail,buyerDownload,receiveBuyerDelivery,buyerMonthlyStatement,requestBuyerQuoteRevision,
 acknowledgeBuyerStatement,buyerOrganizationOptions,buyerWarehouseOptions} from '@/lib/crm/buyer';
import {changePassword} from '@/lib/crm/work';
import {z} from 'zod';
import {buyerQuotePricing} from '@/lib/crm/buyer-quote-pricing';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){
 try{
  const {action}=await context.params,user=await apiUser('buyer'),q=new URL(request.url).searchParams;
  if(action==='setup')return json(await buyerSetup(user,q.get('organizationId')??undefined,q.get('q')??''));
  if(action==='organizations')return json({items:await buyerOrganizationOptions(user)});
  if(action==='warehouses')return json({items:await buyerWarehouseOptions(user)});
  if(action==='quote-pricing')return json(await buyerQuotePricing(user,q.get('id')??''));
  if(action==='orders')return json(await listBuyerOrders(user,{page:Number(q.get('page')??1),q:q.get('q')??'',status:q.get('status')||undefined,organizationId:q.get('organizationId')||undefined,warehouseId:q.get('warehouseId')||undefined,from:q.get('from')||undefined,to:q.get('to')||undefined,stage:q.get('stage')||undefined,quoteRevision:q.get('quoteRevision')||undefined}));
  if(action==='order')return json(await buyerOrderDetail(user,q.get('id')??''));
  if(action==='statement')return json(await buyerMonthlyStatement(user,q.get('month')??'',q.get('organizationId')??undefined));
  if(action==='download'){
   const raw=q.get('revision'),parsed=raw===null?undefined:z.number().int().positive().safeParse(Number(raw));
   if(parsed&&!parsed.success)throw new CrmError('INVALID_FIELDS',400);const revision=parsed?.success?parsed.data:undefined;
   const file=await buyerDownload(user,q.get('orderId')??'',q.get('type')??'',q.get('id')??undefined,revision);
   return new Response(new Uint8Array(file.bytes),{headers:{'Content-Type':file.mime,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file.filename),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});
  }
  if(action==='report'){
   const s=await buyerMonthlyStatement(user,q.get('month')??'',q.get('organizationId')??undefined);
   // Quote every CSV field and neutralize spreadsheet formula prefixes.
   const cell=(v:unknown)=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
   const rows:unknown[][]=[['Mã đơn','Ngày','Chi nhánh','Kho','Sản phẩm','Đơn vị đặt','Số lượng đặt','Số lượng gốc','Đã gửi','Đã xác nhận nhận','Thiếu đã báo','Tiền trước VAT','VAT','Tổng dòng có VAT','Phí đơn (dòng đầu)','Tổng đơn (dòng đầu)','Phiếu giao','Xác nhận nhận / thiếu','Mã đối soát']];
   for(const b of s.items)for(const [index,l]of b.lines.entries()){
    const current=b.receipts.filter(r=>b.deliveries.some(i=>i.id===r.issue_id&&i.revision===r.issue_revision));
    const sent=b.deliveries.reduce((n,i)=>n+i.lines.filter(x=>x.productId===l.productId).reduce((s,x)=>s+Number(x.quantity),0),0);
    const received=current.flatMap(r=>r.lines).filter(x=>x.productId===l.productId);
    rows.push([b.code,b.date,b.branch,b.warehouse,l.name,l.unit==='CASE'?'Thùng':l.unitLabel,l.quantity,l.baseQuantity,sent,received.reduce((s,x)=>s+x.received,0),received.reduce((s,x)=>s+Math.max(0,-Number(x.difference)),0),l.net,l.vat,l.total,index===0?b.fee??'0':'',index===0?String(b.lines.reduce((n,l)=>n+BigInt(l.total??'0'),BigInt(b.fee??'0'))):'',b.deliveries.map(i=>i.code).join('; '),current.map(r=>r.shortage?'Có thiếu hàng':'Đã nhận đủ').join('; '),s.checksum]);
   }
   return new Response('\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="Cohamy-mua-hang-'+s.month+'.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
  throw new CrmError('NOT_FOUND',404);
 }catch(e){return apiError(e);}
}
export async function POST(request:Request,context:Context){
 try{
  sameOrigin(request);const {action}=await context.params,user=await apiUser('buyer'),input=await readJson(request,262144);
  if(action==='create')return json(await createBuyerOrder(user,input),201);
  if(action==='quote')return json(await quoteBuyerOrder(user,input));
  if(action==='confirm')return json(await confirmBuyerOrder(user,input));
  if(action==='quote-revision')return json(await requestBuyerQuoteRevision(user,input));
  if(action==='cancel')return json(await cancelBuyerOrder(user,input));
  if(action==='branch')return json(await saveBuyerBranch(user,input));
  if(action==='contract')return json(await saveBuyerContract(user,input));
  if(action==='receive')return json(await receiveBuyerDelivery(user,input));
  if(action==='acknowledge')return json(await acknowledgeBuyerStatement(user,input));
  if(action==='password')return json(await changePassword(user,input));
  throw new CrmError('NOT_FOUND',404);
 }catch(e){return apiError(e);}
}
