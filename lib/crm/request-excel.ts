import 'server-only';
import ExcelJS from 'exceljs';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {database,type Sql} from './db';
import {assertCurrentPrincipal,audit} from './auth';
import {assertPermission,CrmError} from './permissions';
import {commercialWriter,parseCommercial as parse,commercialDigest as hash} from './commercial-common';
import {pricingOrganization,eligiblePriceBook,loadPriceProducts} from './pricing';
import {basketSchema,calculatePrice,type PriceCalculation,type Basket} from './pricing-model';
import {convertQuantity,fixed} from './decimal';
import {validateCommercialXlsx} from './commercial-xlsx';
import {saveCommercialRequest,commercialRequestAccess} from './order-requests';
import type {Principal} from './types';

const inputSchema=z.object({organizationId:z.uuid(),mapping:z.object({sku:z.number().int().min(1).max(50),unit:z.number().int().min(1).max(50),quantity:z.number().int().min(1).max(50)}).strict().refine(m=>new Set(Object.values(m)).size===3),delivery:z.object({recipient:z.string().trim().min(2).max(120),phone:z.string().trim().min(5).max(40),address:z.string().trim().min(3).max(500)}).strict(),discountBasisPoints:z.number().int().min(0).max(10000),creditTerms:z.boolean(),note:z.string().trim().max(2000),idempotencyKey:z.uuid()}).strict();
type ExcelInput=z.infer<typeof inputSchema>;
export interface ExcelRequestRow {row:number;sku:string;unitCode:string;quantity:string;baseQuantity:string|null;errors:string[]}
interface ExcelManifest {rows:ExcelRequestRow[];basket:Basket|null;calculation:PriceCalculation|null;priceVersionId:string}
interface Preview {id:string;user_id:string;membership_id:string;membership_version:number;organization_id:string;input:ExcelInput;manifest:ExcelManifest;checksum:string;result:{id:string}|null;expired:boolean;expires_at:string}
function writer(user:Principal){assertPermission(user,'orders.read');if(user.area==='crm')commercialWriter(user);else if(!['DEALER_OWNER','DEALER_STAFF'].includes(user.role))throw new CrmError('FORBIDDEN',403);}
async function rowManifest(sql:Sql,user:Principal,input:ExcelInput,rows:ExcelRequestRow[]):Promise<ExcelManifest>{
 await pricingOrganization(sql,user,input.organizationId);const price=await eligiblePriceBook(sql,user,input.organizationId),products=await loadPriceProducts(sql,[...rows.map(r=>r.sku),...price.priceVersion.definition.gifts.map(g=>g.giftSku)],true);
 const fresh=rows.map(row=>({...row,errors:[...row.errors],baseQuantity:null as string|null}));
 for(const r of fresh){
  if(!basketSchema.shape.lines.element.safeParse({sku:r.sku,unitCode:r.unitCode,quantity:r.quantity}).success)r.errors.push('SKU, mã đơn vị hoặc số lượng không đúng định dạng.');
  const product=products.find(p=>p.sku===r.sku),unit=product?.units.find(u=>u.code===r.unitCode);if(!product)r.errors.push('SKU không bán hoặc chưa có đơn vị gốc.');if(product&&!price.priceVersion.definition.lines.some(l=>l.sku===r.sku))r.errors.push('SKU chưa có giá trong bảng áp dụng.');if(product&&!unit)r.errors.push('Đơn vị chưa được xác nhận cho SKU.');
  if(product&&!product.stockUnit)r.errors.push('SKU chưa có đơn vị gốc được xác nhận.');
  if(product&&unit){try{const q=fixed(r.quantity);if(q<=0n||(!unit.allowFractional&&q%1000000n!==0n))throw Error('QUANTITY');r.baseQuantity=convertQuantity(r.quantity,unit.numerator,unit.denominator);}catch{r.errors.push('Số lượng không phù hợp hoặc quy đổi không biểu diễn chính xác.');}}
 }
 let basket:Basket|null=null,calculation:PriceCalculation|null=null;
 if(fresh.every(r=>r.errors.length===0)){basket=basketSchema.parse({lines:fresh.map(r=>({sku:r.sku,unitCode:r.unitCode,quantity:r.quantity})),discountBasisPoints:input.discountBasisPoints,creditTerms:input.creditTerms});calculation=calculatePrice(price.priceVersion.definition,basket,products);}
 return {rows:fresh,basket,calculation,priceVersionId:price.priceVersion.id};
}
export async function previewExcelRequest(user:Principal,bytes:Buffer,input:unknown){
 writer(user);const d=parse(inputSchema,input);validateCommercialXlsx(bytes);const workbook=new ExcelJS.Workbook();try{await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);}catch{throw new CrmError('FILE_TYPE_INVALID',400);}
 const sheet=workbook.worksheets[0];if(!sheet||sheet.rowCount<2||sheet.rowCount>201||sheet.columnCount>50)throw new CrmError('IMPORT_LIMIT',400);const rows:ExcelRequestRow[]=[];
 for(let n=2;n<=sheet.rowCount;n++){const row=sheet.getRow(n),errors:string[]=[];const value=(column:number)=>{const cell=row.getCell(column);if([ExcelJS.ValueType.Formula,ExcelJS.ValueType.Hyperlink].includes(cell.type))errors.push('Không nhập ô công thức hoặc liên kết.');return cell.text.trim();};const sku=value(d.mapping.sku),unitCode=value(d.mapping.unit),quantity=value(d.mapping.quantity);if(!sku&&!unitCode&&!quantity)continue;if(sku.length>80||unitCode.length>30||quantity.length>40)errors.push('Nội dung ô vượt giới hạn.');if(!sku||!unitCode||!quantity)errors.push('Thiếu SKU, đơn vị hoặc số lượng.');rows.push({row:n,sku,unitCode,quantity,baseQuantity:null,errors});}
 if(!rows.length)throw new CrmError('EMPTY_FILE',400);const requestHash=hash({input:d,fileChecksum:hash(bytes.toString('base64'))});
 return(await database()).transaction(async sql=>{
  await sql.query('SELECT id FROM cohamy_crm.users WHERE id=$1 FOR NO KEY UPDATE',[user.id]);await assertCurrentPrincipal(sql,user);await pricingOrganization(sql,user,d.organizationId);
  const prior=(await sql.query<Preview&{request_hash:string}>('SELECT *,expires_at<=now() AS expired FROM cohamy_crm.request_excel_previews WHERE user_id=$1 AND idempotency_key=$2',[user.id,d.idempotencyKey])).rows[0];
  if(prior){if(prior.request_hash!==requestHash)throw new CrmError('IDEMPOTENCY_CONFLICT',409);if(prior.membership_id!==user.membershipId||prior.membership_version!==user.membershipVersion)throw new CrmError('PREVIEW_STALE',409);if(prior.expired&&!prior.result)throw new CrmError('PREVIEW_EXPIRED',409);return {id:prior.id,...prior.manifest,expiresAt:prior.expires_at};}
  const manifest=await rowManifest(sql,user,d,rows),id=randomUUID();const p=(await sql.query<{expires_at:string}>('INSERT INTO cohamy_crm.request_excel_previews(id,user_id,membership_id,membership_version,organization_id,input,manifest,checksum,idempotency_key,request_hash) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10) RETURNING expires_at',[id,user.id,user.membershipId,user.membershipVersion,d.organizationId,JSON.stringify(d),JSON.stringify(manifest),hash(manifest),d.idempotencyKey,requestHash])).rows[0];return {id,...manifest,expiresAt:p.expires_at};
 });
}
export async function confirmExcelRequest(user:Principal,input:unknown){
 writer(user);const d=parse(z.object({id:z.uuid()}).strict(),input);
 return(await database()).transaction(async sql=>{
  await sql.query('SELECT id FROM cohamy_crm.users WHERE id=$1 FOR NO KEY UPDATE',[user.id]);await assertCurrentPrincipal(sql,user);
  const p=(await sql.query<Preview>('SELECT *,expires_at<=now() AS expired FROM cohamy_crm.request_excel_previews WHERE id=$1 AND user_id=$2 FOR UPDATE',[d.id,user.id])).rows[0];if(!p)throw new CrmError('NOT_FOUND',404);
  if(p.result){await commercialRequestAccess(sql,user,p.result.id);return p.result;}if(p.expired)throw new CrmError('PREVIEW_EXPIRED',409);if(p.membership_id!==user.membershipId||p.membership_version!==user.membershipVersion)throw new CrmError('PREVIEW_STALE',409);if(p.checksum!==hash(p.manifest))throw new CrmError('PREVIEW_INVALID',503);if(!p.manifest.basket||!p.manifest.calculation||p.manifest.rows.some(r=>r.errors.length))throw new CrmError('IMPORT_HAS_ERRORS',409);
  const current=await rowManifest(sql,user,p.input,p.manifest.rows);if(hash(current)!==p.checksum)throw new CrmError('PREVIEW_STALE',409);
  const result=await saveCommercialRequest(user,{version:0,organizationId:p.organization_id,channel:'EXCEL',basket:current.basket,delivery:p.input.delivery,note:p.input.note,idempotencyKey:p.id},sql);await sql.query('UPDATE cohamy_crm.request_excel_previews SET result=$1::jsonb WHERE id=$2',[JSON.stringify(result),p.id]);await audit(sql,user.id,'commercial-request.excel-confirmed',result.id,{after:{previewId:p.id,rows:current.rows.length},reason:'Xác nhận toàn bộ preview Excel; chưa gửi đề nghị đến Cohamy.'});return result;
 });
}
export async function excelRequestTemplate(user:Principal){writer(user);const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Request');sheet.columns=[{header:'SKU',key:'sku',width:35},{header:'Unit',key:'unit',width:20},{header:'Quantity',key:'quantity',width:20}];sheet.addRow({sku:'',unit:'',quantity:''});sheet.getRow(1).font={bold:true};const guide=workbook.addWorksheet('Huong dan');guide.addRow(['Nhập SKU đang bán, mã đơn vị đã xác nhận và số lượng dương.']);guide.addRow(['Tối đa200 dòng. Xem preview và lỗi trước khi xác nhận; xác nhận không tự gửi đề nghị.']);guide.getColumn(1).width=100;return Buffer.from(await workbook.xlsx.writeBuffer());}
