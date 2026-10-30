import 'server-only';
import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {database,type Sql} from './db';
import {audit,assertCurrentPrincipal} from './auth';
import {can,CrmError,isWarehouseRole} from './permissions';
import {isBuyerRole,type Principal} from './types';
import {partnerScope} from './repository';
import {warehouseScope} from './warehouse-scope';
import {withDocumentCreators} from './document-creators';
import {commercialDigest as hash,vietnamBusinessDate} from './commercial-common';
import {syncOrderClearanceOnRequestSave} from './accountant-workflow';
import type {BuyerOrder,BuyerLine,BuyerBranch,BuyerContract,BuyerRole,ContractLine,BuyerDelivery} from './buyer-model';
import type {FlowSnapshot} from './document-flow-model';

const uuid=z.uuid(),text=z.string().trim(),money=z.string().regex(/^\d{1,10}$/);
const priceLineSchema=z.object({productId:uuid,unitPrice:money,vatRate:z.number().int().min(0).max(100)}).strict();
const deliverySchema=z.object({recipient:text.min(2).max(120),phone:text.min(5).max(40),address:text.min(3).max(500)}).strict();
const createSchema=z.object({organizationId:uuid.optional(),buyerRole:z.enum(['CUSTOMER','SUPERMARKET']).optional(),warehouseId:uuid,
 branchId:uuid.optional(),contractId:uuid.optional(),delivery:deliverySchema.optional(),note:text.max(2000).default(''),
 lines:z.array(z.object({productId:uuid,quantity:z.number().int().min(1).max(1000000),unit:z.enum(['PACK','CASE'])}).strict()).min(1).max(100),idempotencyKey:uuid}).strict();
const quoteSchema=z.object({id:uuid,version:z.number().int().positive(),expiresOn:z.iso.date(),lines:z.array(priceLineSchema).min(1).max(100),note:text.max(2000).default(''),idempotencyKey:uuid}).strict();
const orderActionSchema=z.object({id:uuid,version:z.number().int().positive(),idempotencyKey:uuid}).strict();
const branchSchema=z.object({id:uuid.optional(),version:z.number().int().min(0),organizationId:uuid.optional(),code:text.min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),name:text.min(2).max(200),address:text.min(3).max(500),recipient:text.min(2).max(120),phone:text.min(5).max(40),active:z.boolean().default(true),idempotencyKey:uuid}).strict().refine(d=>Boolean(d.id)===(d.version>0));
const contractSchema=z.object({id:uuid.optional(),version:z.number().int().min(0),organizationId:uuid,code:text.min(2).max(80),startsOn:z.iso.date(),endsOn:z.iso.date(),lines:z.array(priceLineSchema).min(1).max(300),active:z.boolean().default(true),note:text.max(2000).default(''),idempotencyKey:uuid}).strict().refine(d=>d.endsOn>=d.startsOn&&Boolean(d.id)===(d.version>0));
const receiveSchema=z.object({id:uuid,issueId:uuid,issueRevision:z.number().int().positive(),lines:z.array(z.object({productId:uuid,received:z.number().int().min(0).max(100000000)}).strict()).min(1).max(300),note:text.max(2000).default(''),idempotencyKey:uuid}).strict();
const statementSchema=z.object({organizationId:uuid.optional(),month:z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),checksum:z.string().regex(/^[a-f0-9]{64}$/),note:text.max(2000).default(''),idempotencyKey:uuid}).strict();
function parse<T>(schema:z.ZodType<T>,input:unknown):T {const r=schema.safeParse(input);if(!r.success)throw new CrmError('INVALID_FIELDS',400);return r.data;}
function access(user:Principal){if(!(user.area==='portal'&&isBuyerRole(user.role))&&!can(user,'buyer.review'))throw new CrmError('FORBIDDEN',403);}
function manager(user:Principal){if(!can(user,'buyer.manage'))throw new CrmError('FORBIDDEN',403);}
function distinct(ids:string[]){if(new Set(ids).size!==ids.length)throw new CrmError('DUPLICATE_PRODUCT',400);}
async function today(sql:Sql){return (await sql.query<{date:string}>("SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS date")).rows[0].date;}
function orderScope(user:Principal){
 access(user);
 if(user.area==='portal')return {sql:'b.organization_id=$1',params:[user.organizationId] as unknown[]};
 if(isWarehouseRole(user.role)){const s=warehouseScope(user,'w');return {sql:s.sql,params:s.params};}
 const s=partnerScope(user,'o');return {sql:`w.organization_id=$${s.params.length+1} AND (${s.sql})`,params:[...s.params,user.organizationId]};
}
async function organization(sql:Sql,user:Principal,id?:string){
 access(user);const selected=user.area==='portal'?user.organizationId:id;
 if(!selected||(user.area==='portal'&&id&&id!==selected))throw new CrmError('NOT_FOUND',404);
 if(user.area==='crm'&&!can(user,'buyer.manage')&&user.role!=='ACCOUNTANT')throw new CrmError('FORBIDDEN',403);
 const s=user.area==='portal'?{sql:'o.id=$1',params:[selected]}:partnerScope(user);
 const row=(await sql.query<{id:string;code:string;name:string;phone:string;email:string;address:string;business_id:string}>(`SELECT o.id,o.code,o.name,o.phone,o.email,o.address,o.business_id FROM cohamy_crm.organizations o WHERE (${s.sql}) AND o.id=$${s.params.length+1} AND o.kind='CUSTOMER' AND o.active AND o.merged_into_id IS NULL`,[...s.params,selected])).rows[0];
 if(!row)throw new CrmError('NOT_FOUND',404);return row;
}
async function command<T>(user:Principal,action:string,d:{idempotencyKey:string},fn:(sql:Sql)=>Promise<T>):Promise<T>{
 access(user);return (await database()).transaction(async sql=>{
  await sql.query('SELECT id FROM cohamy_crm.users WHERE id=$1 FOR NO KEY UPDATE',[user.id]);await assertCurrentPrincipal(sql,user);
  const requestHash=hash({action,input:d}),prior=(await sql.query<{request_hash:string;result:T}>('SELECT request_hash,result FROM cohamy_crm.buyer_actions WHERE actor_id=$1 AND key=$2',[user.id,d.idempotencyKey])).rows[0];
  if(prior){if(prior.request_hash!==requestHash)throw new CrmError('IDEMPOTENCY_CONFLICT',409);return prior.result;}
  const result=await fn(sql);
  await sql.query('INSERT INTO cohamy_crm.buyer_actions(actor_id,key,request_hash,result) VALUES($1,$2,$3,$4::jsonb)',[user.id,d.idempotencyKey,requestHash,JSON.stringify(result)]);
  return result;
 });
}
async function event(sql:Sql,user:Principal,order:BuyerOrder,action:string,extra:unknown={}){
 await sql.query('INSERT INTO cohamy_crm.buyer_order_events(id,order_id,actor_id,action,snapshot) VALUES($1,$2,$3,$4,$5::jsonb)',[randomUUID(),order.id,user.id,action,JSON.stringify({order,...(extra as object)})]);
 await audit(sql,user.id,'buyer.'+action,order.id,{version:order.version,status:order.status});
}
export async function buyerOrder(sql:Sql,user:Principal,id:string,lock=false){
 const s=orderScope(user);parse(uuid,id);
 const row=(await sql.query<BuyerOrder>(`SELECT b.*,o.name AS organization_name,w.name AS warehouse_name,b.quote_expires_on::text FROM cohamy_crm.buyer_orders b JOIN cohamy_crm.organizations o ON o.id=b.organization_id JOIN cohamy_crm.warehouses w ON w.id=b.warehouse_id WHERE (${s.sql}) AND b.id=$${s.params.length+1}${lock?' FOR UPDATE OF b':''}`,[...s.params,id])).rows[0];
 if(!row)throw new CrmError('NOT_FOUND',404);return row;
}
async function contract(sql:Sql,orgId:string,id:string){
 const c=(await sql.query<BuyerContract>('SELECT *,starts_on::text,ends_on::text FROM cohamy_crm.buyer_contracts WHERE id=$1 AND organization_id=$2 AND active AND starts_on<=(now() AT TIME ZONE \'Asia/Ho_Chi_Minh\')::date AND ends_on>=(now() AT TIME ZONE \'Asia/Ho_Chi_Minh\')::date FOR SHARE',[id,orgId])).rows[0];
 if(!c)throw new CrmError('CONTRACT_NOT_ACTIVE',409);return c;
}
function withPrices(lines:BuyerLine[],prices:ContractLine[]):BuyerLine[]{
 distinct(prices.map(x=>x.productId));if(prices.length!==lines.length)throw new CrmError('ALL_PRICES_REQUIRED',400);
 const result=lines.map(l=>{const p=prices.find(p=>p.productId===l.productId);if(!p)throw new CrmError('ALL_PRICES_REQUIRED',400);
  const net=BigInt(p.unitPrice)*BigInt(l.baseQuantity),vat=(net*BigInt(p.vatRate)+50n)/100n;
  return {...l,unitPrice:p.unitPrice,vatRate:p.vatRate,net:String(net),vat:String(vat),total:String(net+vat)};
 });
 if(result.reduce((n,l)=>n+BigInt(l.total!),0n)>9000000000000n)throw new CrmError('ORDER_VALUE_TOO_LARGE',400);
 return result;
}
async function releaseToWarehouse(sql:Sql,user:Principal,b:BuyerOrder){
 if(b.request_id||b.clearance_id)throw new CrmError('ORDER_ALREADY_RELEASED',409);
 const wh=(await sql.query<{organization_id:string}>("SELECT w.organization_id FROM cohamy_crm.warehouses w JOIN cohamy_crm.organizations o ON o.id=w.organization_id WHERE w.id=$1 AND w.active AND o.kind='COHAMY' AND o.active FOR SHARE OF w,o",[b.warehouse_id])).rows[0];
 if(!wh)throw new CrmError('WAREHOUSE_INVALID',409);
 for(const l of b.lines)if(!(await sql.query('SELECT id FROM cohamy_crm.products WHERE id=$1 AND active AND stock_unit=$2 FOR SHARE',[l.productId,l.unitLabel])).rows.length)throw new CrmError('PRODUCT_NOT_ORDERABLE',409);
 // The order has already passed the current actor's scope and row lock.
 const org=(await sql.query<{id:string;code:string;name:string;phone:string;email:string;address:string;business_id:string}>('SELECT id,code,name,phone,email,address,business_id FROM cohamy_crm.organizations WHERE id=$1 AND active FOR SHARE',[b.organization_id])).rows[0];
 if(!org)throw new CrmError('NOT_FOUND',404);
 const id=randomUUID(),versionId=randomUUID(),key=randomUUID(),subtotal=b.lines.reduce((n,l)=>n+BigInt(l.net!),0n);
 const snapshot={buyerOrderId:b.id,organization:{id:org.id,code:org.code,name:org.name,phone:org.phone,email:org.email,businessId:org.business_id,address:org.address},delivery:b.delivery,
  basket:{discountBasisPoints:0,lines:b.lines.map(l=>({productId:l.productId,quantity:String(l.baseQuantity),unitCode:l.unitLabel}))},
  calculation:{subtotal:String(subtotal),discount:'0',total:String(subtotal),lines:b.lines.map(l=>({productId:l.productId,sku:l.sku,name:l.name,unitLabel:l.unitLabel,quantity:String(l.baseQuantity),baseQuantity:String(l.baseQuantity),listUnitPrice:l.unitPrice,unitPrice:l.unitPrice,discount:'0',vatRate:l.vatRate,total:l.net,costUnitPrice:0}))},
  totals:{shippingFee:'0',vat:String(b.lines.reduce((n,l)=>n+BigInt(l.vat!),0n))},vatRate:b.lines.every(l=>l.vatRate===b.lines[0].vatRate)?b.lines[0].vatRate:0,note:b.note,currency:'VND',issuedAt:new Date().toISOString(),validUntil:b.quote_expires_on,buyerContract:b.contract_snapshot};
 await sql.query("INSERT INTO cohamy_crm.commercial_requests(id,code,organization_id,creator_id,creator_membership_id,creator_area,creator_role,channel,status,seller_organization_id,assigned_approver_org_id) VALUES($1,$2,$3,$4,$5,'portal',$6,'PORTAL','SUBMITTED',$7,$7)",[id,b.code,b.organization_id,b.creator_id,(await sql.query<{id:string}>('SELECT id FROM cohamy_crm.memberships WHERE user_id=$1 AND organization_id=$2 AND role=$3 ORDER BY id LIMIT 1',[b.creator_id,b.organization_id,b.buyer_role])).rows[0]?.id??user.membershipId,b.buyer_role,(await sql.query<{organization_id:string}>('SELECT organization_id FROM cohamy_crm.warehouses WHERE id=$1',[b.warehouse_id])).rows[0].organization_id]);
 await sql.query('INSERT INTO cohamy_crm.commercial_request_versions(id,request_id,number,snapshot,checksum,actor_id,idempotency_key,request_hash) VALUES($1,$2,1,$3::jsonb,$4,$5,$6,$4)',[versionId,id,JSON.stringify(snapshot),hash(snapshot),user.id,key]);
 await sql.query('UPDATE cohamy_crm.commercial_requests SET latest_version_id=$1,owner_approved_version_id=$1 WHERE id=$2',[versionId,id]);
 await syncOrderClearanceOnRequestSave(sql,{requestId:id,actorId:user.id,isNew:true,warehouseId:b.warehouse_id});
 const c=(await sql.query<{id:string}>('UPDATE cohamy_crm.accounting_order_clearances SET warehouse_id=$1,orderer_type=\'CUSTOMER\',orderer_name=$2,orderer_phone=$3,note=$4,contract_code=$5 WHERE request_id=$6 RETURNING id',[b.warehouse_id,b.delivery.recipient,b.delivery.phone,b.note,b.contract_snapshot?.code??'',id])).rows[0];
 if(!c)throw new CrmError('CLEARANCE_NOT_CREATED',503);
 await sql.query("UPDATE cohamy_crm.buyer_orders SET status='CONFIRMED',request_id=$1,clearance_id=$2,version=version+1,updated_at=now() WHERE id=$3",[id,c.id,b.id]);
 return buyerOrder(sql,user,b.id);
}
export async function createBuyerOrder(user:Principal,input:unknown){
 const d=parse(createSchema,input);return command(user,'order-created',d,async sql=>{
  if(user.area==='crm')manager(user);
  const org=await organization(sql,user,d.organizationId),role:BuyerRole=user.area==='portal'?user.role as BuyerRole:d.buyerRole??'CUSTOMER';
  if(user.area==='portal'&&d.buyerRole&&d.buyerRole!==user.role)throw new CrmError('FORBIDDEN',403);
  const wh=(await sql.query<{id:string}>("SELECT w.id FROM cohamy_crm.warehouses w JOIN cohamy_crm.organizations o ON o.id=w.organization_id WHERE w.id=$1 AND w.active AND o.kind='COHAMY' AND o.active AND ($2::uuid IS NULL OR w.organization_id=$2) FOR SHARE OF w,o",[d.warehouseId,user.area==='crm'?user.organizationId:null])).rows[0];
  if(!wh)throw new CrmError('WAREHOUSE_INVALID',400);
  let delivery:BuyerDelivery|undefined=d.delivery,branchId:string|null=null;
  if(role==='SUPERMARKET'){
   if(!d.branchId||!d.contractId)throw new CrmError('BRANCH_AND_CONTRACT_REQUIRED',400);
   const br=(await sql.query<BuyerBranch>('SELECT * FROM cohamy_crm.buyer_branches WHERE id=$1 AND organization_id=$2 AND active FOR SHARE',[d.branchId,org.id])).rows[0];
   if(!br)throw new CrmError('BRANCH_INVALID',400);branchId=br.id;delivery={recipient:br.recipient,phone:br.phone,address:br.address,branchName:br.name};
  }else if(!delivery||d.branchId||d.contractId)throw new CrmError('INVALID_FIELDS',400);
  distinct(d.lines.map(l=>l.productId));let lines:BuyerLine[]=[];
  for(const l of d.lines){
   const p=(await sql.query<{id:string;sku:string;name:string;stock_unit:string;units_per_case:number|null;translations:{images?:string[]}}>('SELECT id,sku,name,stock_unit,units_per_case,translations FROM cohamy_crm.products WHERE id=$1 AND active FOR SHARE',[l.productId])).rows[0];
   if(!p||!p.stock_unit)throw new CrmError('PRODUCT_NOT_ORDERABLE',400);
   if(l.unit==='CASE'&&(!p.units_per_case||p.units_per_case<1))throw new CrmError('CASE_CONVERSION_REQUIRED',409);
   const baseQuantity=l.quantity*(l.unit==='CASE'?p.units_per_case!:1);if(baseQuantity>100000000)throw new CrmError('INVALID_QUANTITY',400);
   lines.push({productId:p.id,sku:p.sku,name:p.name,image:safeImage(p.translations?.images?.[0]),unit:l.unit,unitLabel:p.stock_unit,quantity:l.quantity,unitsPerCase:p.units_per_case??1,baseQuantity,unitPrice:null,vatRate:null,net:null,vat:null,total:null});
  }
  const c=role==='SUPERMARKET'?await contract(sql,org.id,d.contractId!):null;
  if(c)lines=withPrices(lines,lines.map(l=>{const p=c.lines.find(p=>p.productId===l.productId);if(!p)throw new CrmError('PRODUCT_OUTSIDE_CONTRACT',409);return p;}));
  const id=randomUUID(),code='DH-'+vietnamBusinessDate(new Date())+'-'+id.slice(0,8).toUpperCase();
  await sql.query("INSERT INTO cohamy_crm.buyer_orders(id,code,organization_id,buyer_role,creator_id,warehouse_id,branch_id,delivery,lines,note,status,quote_expires_on,contract_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13::jsonb)",[id,code,org.id,role,user.id,wh.id,branchId,JSON.stringify(delivery),JSON.stringify(lines),d.note,c?'QUOTED':'WAITING_QUOTE',c?.ends_on??null,c?JSON.stringify(c):null]);
  let b=await buyerOrder(sql,user,id);if(c)b=await releaseToWarehouse(sql,user,b);await event(sql,user,b,'order-created');return {id:b.id,code:b.code,version:b.version,status:b.status};
 });
}
export async function quoteBuyerOrder(user:Principal,input:unknown){
 manager(user);const d=parse(quoteSchema,input);return command(user,'quoted',d,async sql=>{
  const b=await buyerOrder(sql,user,d.id,true);if(b.version!==d.version)throw new CrmError('VERSION_CONFLICT',409);
  if(b.buyer_role!=='CUSTOMER'||!['WAITING_QUOTE','QUOTED'].includes(b.status))throw new CrmError('ORDER_LOCKED',409);
  if(d.expiresOn<await today(sql))throw new CrmError('QUOTE_EXPIRED',409);
  const lines=withPrices(b.lines,d.lines);
  await sql.query("UPDATE cohamy_crm.buyer_orders SET lines=$1::jsonb,status='QUOTED',quote_expires_on=$2,version=version+1,updated_at=now() WHERE id=$3",[JSON.stringify(lines),d.expiresOn,b.id]);
  const updated=await buyerOrder(sql,user,b.id);await event(sql,user,updated,'quoted',{note:d.note});return {id:b.id,version:updated.version};
 });
}
export async function confirmBuyerOrder(user:Principal,input:unknown){
 if(user.area!=='portal'||user.role!=='CUSTOMER')throw new CrmError('FORBIDDEN',403);
 const d=parse(orderActionSchema,input);return command(user,'confirmed',d,async sql=>{
  const b=await buyerOrder(sql,user,d.id,true);if(b.version!==d.version)throw new CrmError('VERSION_CONFLICT',409);
  if(b.status!=='QUOTED')throw new CrmError('QUOTE_REQUIRED',409);
  if(!b.quote_expires_on||b.quote_expires_on<await today(sql))throw new CrmError('QUOTE_EXPIRED',409);
  const updated=await releaseToWarehouse(sql,user,b);await event(sql,user,updated,'confirmed');return {id:b.id,version:updated.version};
 });
}
export async function cancelBuyerOrder(user:Principal,input:unknown){
 const d=parse(orderActionSchema,input);return command(user,'cancelled',d,async sql=>{
  const b=await buyerOrder(sql,user,d.id,true);if(user.area==='crm')manager(user);
  if(b.version!==d.version)throw new CrmError('VERSION_CONFLICT',409);
  if(!['WAITING_QUOTE','QUOTED'].includes(b.status))throw new CrmError('ORDER_LOCKED',409);
  await sql.query("UPDATE cohamy_crm.buyer_orders SET status='CANCELLED',version=version+1,updated_at=now() WHERE id=$1",[b.id]);
  const updated=await buyerOrder(sql,user,b.id);await event(sql,user,updated,'cancelled');return {id:b.id,version:updated.version};
 });
}
export async function saveBuyerBranch(user:Principal,input:unknown){
 if(user.area==='portal'&&user.role!=='SUPERMARKET')throw new CrmError('FORBIDDEN',403);if(user.area==='crm')manager(user);
 const d=parse(branchSchema,input);return command(user,'branch-saved',d,async sql=>{
  const org=await organization(sql,user,d.organizationId),id=d.id??randomUUID();
  if(d.id){const r=await sql.query('UPDATE cohamy_crm.buyer_branches SET code=$1,name=$2,address=$3,recipient=$4,phone=$5,active=$6,version=version+1 WHERE id=$7 AND organization_id=$8 AND version=$9 RETURNING id',[d.code,d.name,d.address,d.recipient,d.phone,d.active,id,org.id,d.version]);if(!r.rows.length)throw new CrmError('VERSION_CONFLICT',409);}
  else await sql.query('INSERT INTO cohamy_crm.buyer_branches(id,organization_id,code,name,address,recipient,phone,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,org.id,d.code,d.name,d.address,d.recipient,d.phone,d.active]);
  await audit(sql,user.id,'buyer.branch-saved',id,{...d,organizationId:org.id});return {id,version:d.version+1};
 });
}
export async function saveBuyerContract(user:Principal,input:unknown){
 if(user.area!=='crm'||!['ADMIN','MANAGER'].includes(user.role))throw new CrmError('FORBIDDEN',403);
 const d=parse(contractSchema,input);return command(user,'contract-saved',d,async sql=>{
  const org=await organization(sql,user,d.organizationId);distinct(d.lines.map(l=>l.productId));
  for(const l of d.lines)if(!(await sql.query('SELECT id FROM cohamy_crm.products WHERE id=$1 AND active FOR SHARE',[l.productId])).rows.length)throw new CrmError('PRODUCT_NOT_ORDERABLE',400);
  const id=d.id??randomUUID();
  if(d.id){const previous=(await sql.query<BuyerContract>('SELECT * FROM cohamy_crm.buyer_contracts WHERE id=$1 AND organization_id=$2 FOR UPDATE',[id,org.id])).rows[0];if(!previous||previous.version!==d.version)throw new CrmError('VERSION_CONFLICT',409);
   await audit(sql,user.id,'buyer.contract-before-change',id,previous);
   await sql.query('UPDATE cohamy_crm.buyer_contracts SET code=$1,starts_on=$2,ends_on=$3,lines=$4::jsonb,active=$5,note=$6,version=version+1,updated_at=now() WHERE id=$7',[d.code,d.startsOn,d.endsOn,JSON.stringify(d.lines),d.active,d.note,id]);
  }else await sql.query('INSERT INTO cohamy_crm.buyer_contracts(id,organization_id,code,starts_on,ends_on,lines,active,note,created_by) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)',[id,org.id,d.code,d.startsOn,d.endsOn,JSON.stringify(d.lines),d.active,d.note,user.id]);
  await audit(sql,user.id,'buyer.contract-saved',id,d);return {id,version:d.version+1};
 });
}
function safeImage(value:unknown){return typeof value==='string'&&((value.startsWith('/')&&!value.startsWith('//'))||value.startsWith('https://'))?value:'';}
export async function buyerSetup(user:Principal,organizationId?:string,q=''){
 access(user);const db=await database();await assertCurrentPrincipal(db,user);
 const org=await organization(db,user,organizationId);
 const [products,warehouses,branches,contracts]=await Promise.all([
  db.query<{id:string;sku:string;name:string;stock_unit:string;units_per_case:number|null;translations:{images?:string[]}}>('SELECT id,sku,name,stock_unit,units_per_case,translations FROM cohamy_crm.products WHERE active AND (name ILIKE $1 OR sku ILIKE $1) ORDER BY name,id LIMIT 300',['%'+q.slice(0,120)+'%']),
  db.query<{id:string;name:string;code:string}>("SELECT w.id,w.name,w.code FROM cohamy_crm.warehouses w JOIN cohamy_crm.organizations o ON o.id=w.organization_id WHERE w.active AND o.kind='COHAMY' AND o.active ORDER BY w.code"),
  db.query<BuyerBranch>('SELECT * FROM cohamy_crm.buyer_branches WHERE organization_id=$1 ORDER BY name,id',[org.id]),
  user.role==='CUSTOMER'?{rows:[] as BuyerContract[]}:db.query<BuyerContract>('SELECT id,organization_id,code,starts_on::text,ends_on::text,lines,note,active,version FROM cohamy_crm.buyer_contracts WHERE organization_id=$1 ORDER BY starts_on DESC,id LIMIT 200',[org.id]),
 ]);
 return {organization:org,products:products.rows.map(({translations,...p})=>({...p,image:safeImage(translations?.images?.[0])})),warehouses:warehouses.rows,branches:branches.rows,contracts:contracts.rows};
}
export async function listBuyerOrders(user:Principal,query:{page?:number;q?:string;status?:string;organizationId?:string}={}){
 const s=orderScope(user),page=Math.max(1,Math.min(100000,Math.floor(query.page??1)||1)),params=[...s.params,'%'+(query.q??'').slice(0,120)+'%'];
 let where=`(${s.sql}) AND (b.code ILIKE $${params.length} OR o.name ILIKE $${params.length})`;
 if(query.organizationId){params.push(parse(uuid,query.organizationId));where+=` AND b.organization_id=$${params.length}`;}
 if(query.status){params.push(parse(z.enum(['WAITING_QUOTE','QUOTED','CONFIRMED','CANCELLED']),query.status));where+=` AND b.status=$${params.length}`;}
 const db=await database();await assertCurrentPrincipal(db,user);
 const from='FROM cohamy_crm.buyer_orders b JOIN cohamy_crm.organizations o ON o.id=b.organization_id JOIN cohamy_crm.warehouses w ON w.id=b.warehouse_id WHERE '+where;
 const [count,rows]=await Promise.all([db.query<{n:string}>('SELECT count(*)::text AS n '+from,params),db.query<BuyerOrder>(`SELECT b.*,o.name AS organization_name,w.name AS warehouse_name,b.quote_expires_on::text ${from} ORDER BY b.created_at DESC,b.id LIMIT 20 OFFSET $${params.length+1}`,[...params,(page-1)*20])]);
 const deliveries=rows.rows.length?(await db.query<{clearance_id:string;flow_payload:FlowSnapshot;received:boolean;shortage:boolean}>("SELECT i.clearance_id,i.flow_payload,EXISTS(SELECT 1 FROM cohamy_crm.buyer_delivery_receipts r WHERE r.issue_id=i.id AND r.issue_revision=i.workflow_version) AS received,EXISTS(SELECT 1 FROM cohamy_crm.buyer_delivery_receipts r WHERE r.issue_id=i.id AND r.issue_revision=i.workflow_version AND r.shortage) AS shortage FROM cohamy_crm.warehouse_handover_invoices i WHERE i.clearance_id=ANY($1::uuid[]) AND i.workflow_state='CONFIRMED'",[rows.rows.map(b=>b.clearance_id).filter(Boolean)])).rows:[];
 return {items:await withDocumentCreators(db,user,'buyer_orders',rows.rows.map(b=>({...b,delivery_status:deliveryStatus(b,deliveries.filter(i=>i.clearance_id===b.clearance_id))}))),total:Number(count.rows[0].n),page,pageSize:20};
}
function deliveryStatus(b:BuyerOrder,issues:{flow_payload:FlowSnapshot;received:boolean;shortage:boolean}[]){
 if(!issues.length)return 'Chưa giao hàng';
 const complete=b.lines.every(l=>issues.reduce((n,i)=>n+Number(i.flow_payload.lines.find(x=>x.productId===l.productId)?.quantity??0),0)>=l.baseQuantity);
 if(issues.some(i=>i.shortage))return 'Có báo thiếu hàng';
 if(complete&&issues.every(i=>i.received))return 'Đã nhận đủ';
 return complete?'Đã xuất / giao đủ':'Đang giao từng phần';
}
async function detail(sql:Sql,user:Principal,id:string){
 const b=await buyerOrder(sql,user,id);
 const [issues,receipts,events,vats,files]=await Promise.all([
  sql.query<{id:string;code:string;workflow_version:number;flow_payload:FlowSnapshot}>("SELECT id,code,workflow_version,flow_payload FROM cohamy_crm.warehouse_handover_invoices WHERE clearance_id=$1 AND workflow_state='CONFIRMED' ORDER BY created_at,id",[b.clearance_id]),
  sql.query<{id:string;issue_id:string;issue_revision:number;lines:{productId:string;received:number;sent:string;difference:string}[];note:string;shortage:boolean;created_at:string}>('SELECT id,issue_id,issue_revision,lines,note,shortage,created_at FROM cohamy_crm.buyer_delivery_receipts WHERE order_id=$1 ORDER BY created_at,id',[id]),
  sql.query<{id:string;action:string;created_at:string;snapshot:{note?:string}}>('SELECT id,action,created_at,jsonb_build_object(\'note\',snapshot->>\'note\') AS snapshot FROM cohamy_crm.buyer_order_events WHERE order_id=$1 ORDER BY created_at,id',[id]),
  sql.query<{id:string;code:string;invoice_number:string;invoice_symbol:string;issued_date:string;status:string;total_amount:string}>("SELECT id,code,invoice_number,invoice_symbol,issued_date::text,status,total_amount::text FROM cohamy_crm.vat_invoices WHERE clearance_id=$1 AND status NOT IN('UNISSUED','CANCELLED') ORDER BY created_at,id",[b.clearance_id]),
  buyerFiles(sql,b),
 ]);
 return {order:{...b,delivery_status:deliveryStatus(b,issues.rows.map(i=>({...i,received:receipts.rows.some(r=>r.issue_id===i.id&&r.issue_revision===i.workflow_version),shortage:receipts.rows.some(r=>r.issue_id===i.id&&r.issue_revision===i.workflow_version&&r.shortage)})))},issues:issues.rows.map(i=>({id:i.id,code:i.code,revision:i.workflow_version,confirmedAt:i.flow_payload.confirmedAt,lines:i.flow_payload.lines.map(l=>({productId:l.productId,sku:l.sku,name:l.name,unit:l.unit,quantity:l.quantity}))})),receipts:receipts.rows,events:events.rows,vats:vats.rows,files};
}
export async function buyerOrderDetail(user:Principal,id:string){const db=await database();await assertCurrentPrincipal(db,user);const d=await detail(db,user,id);return {...d,order:(await withDocumentCreators(db,user,'buyer_orders',[d.order]))[0]};}
async function buyerFiles(sql:Sql,b:BuyerOrder){
 return (await sql.query<{id:string;filename:string;mime:string;size:number;checksum:string}>("SELECT v.id,v.filename,v.mime,v.size,v.checksum FROM cohamy_crm.private_documents d JOIN cohamy_crm.document_versions v ON v.document_id=d.id WHERE d.doc_category LIKE 'VAT%' AND ((d.entity_type='order-clearance' AND d.entity_id=$1) OR (d.entity_type='warehouse-handover' AND EXISTS(SELECT 1 FROM cohamy_crm.warehouse_handover_invoices i WHERE i.id=d.entity_id AND i.clearance_id=$1 AND i.workflow_state='CONFIRMED')) OR (d.entity_type='vat-invoice' AND EXISTS(SELECT 1 FROM cohamy_crm.vat_invoices i WHERE i.id=d.entity_id AND i.clearance_id=$1))) ORDER BY v.created_at DESC,v.id LIMIT 200",[b.clearance_id])).rows;
}
export async function buyerDownload(user:Principal,orderId:string,type:string,id?:string,revision?:number){
 const sql=await database();await assertCurrentPrincipal(sql,user);const b=await buyerOrder(sql,user,orderId);
 if(type==='order'){const {buyerOrderPdf}=await import('./buyer-pdf');await audit(sql,user.id,'buyer.order-pdf-downloaded',b.id);return {bytes:await buyerOrderPdf(b),filename:b.code+'.pdf',mime:'application/pdf'};}
 if(type==='delivery'){
  parse(uuid,id);const row=(await sql.query<{pdf:Uint8Array;filename:string;checksum:string}>("SELECT r.pdf,r.filename,r.checksum FROM cohamy_crm.document_flow_revisions r JOIN cohamy_crm.warehouse_handover_invoices i ON i.id=r.entity_id WHERE i.id=$1 AND i.clearance_id=$2 AND i.workflow_state='CONFIRMED' AND ($3::integer IS NULL OR r.revision=$3) ORDER BY r.revision DESC LIMIT 1",[id,b.clearance_id,revision??null])).rows[0];
  if(!row)throw new CrmError('NOT_FOUND',404);const bytes=Buffer.from(row.pdf);if(createHash('sha256').update(bytes).digest('hex')!==row.checksum)throw new CrmError('DOCUMENT_CHECKSUM_INVALID',503);
  await audit(sql,user.id,'buyer.delivery-pdf-downloaded',b.id,{issueId:id,revision});return {bytes,filename:row.filename,mime:'application/pdf'};
 }
 if(type==='vat'){
  parse(uuid,id);if(!(await buyerFiles(sql,b)).some(f=>f.id===id))throw new CrmError('NOT_FOUND',404);
  const file=(await sql.query<{content:Uint8Array;filename:string;mime:string;checksum:string}>('SELECT content,filename,mime,checksum FROM cohamy_crm.document_versions WHERE id=$1',[id])).rows[0];
  const bytes=Buffer.from(file.content);if(![createHash('sha256').update(bytes).digest('hex'),createHash('sha256').update(bytes.toString('base64')).digest('hex')].includes(file.checksum))throw new CrmError('DOCUMENT_CHECKSUM_INVALID',503);
  await audit(sql,user.id,'buyer.vat-downloaded',b.id,{versionId:id});return {bytes,filename:file.filename,mime:file.mime};
 }
 throw new CrmError('NOT_FOUND',404);
}
export async function receiveBuyerDelivery(user:Principal,input:unknown){
 if(user.area!=='portal'||user.role!=='SUPERMARKET')throw new CrmError('FORBIDDEN',403);
 const d=parse(receiveSchema,input);return command(user,'delivery-received',d,async sql=>{
  const b=await buyerOrder(sql,user,d.id,true);if(b.status!=='CONFIRMED'||!b.clearance_id)throw new CrmError('CONFIRMED_ORDER_REQUIRED',409);
  const i=(await sql.query<{workflow_version:number;flow_payload:FlowSnapshot}>("SELECT workflow_version,flow_payload FROM cohamy_crm.warehouse_handover_invoices WHERE id=$1 AND clearance_id=$2 AND workflow_state='CONFIRMED' FOR SHARE",[d.issueId,b.clearance_id])).rows[0];
  if(!i||!i.flow_payload)throw new CrmError('DELIVERY_REQUIRED',409);if(i.workflow_version!==d.issueRevision)throw new CrmError('SOURCE_REVISION_CHANGED',409);
  distinct(d.lines.map(l=>l.productId));if(d.lines.length!==i.flow_payload.lines.length)throw new CrmError('ALL_RECEIPT_LINES_REQUIRED',400);
  const lines=d.lines.map(l=>{const src=i.flow_payload.lines.find(s=>s.productId===l.productId);if(!src||l.received>Number(src.quantity))throw new CrmError('RECEIVED_EXCEEDS_SENT',400);return {...l,sent:src.quantity,difference:String(l.received-Number(src.quantity))};});
  const shortage=lines.some(l=>Number(l.difference)<0);if(shortage&&d.note.length<3)throw new CrmError('DISCREPANCY_NOTE_REQUIRED',400);
  if((await sql.query('SELECT id FROM cohamy_crm.buyer_delivery_receipts WHERE issue_id=$1 AND issue_revision=$2',[d.issueId,d.issueRevision])).rows.length)throw new CrmError('DELIVERY_ALREADY_RECEIVED',409);
  const id=randomUUID();await sql.query('INSERT INTO cohamy_crm.buyer_delivery_receipts(id,order_id,issue_id,issue_revision,actor_id,lines,note,shortage) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8)',[id,b.id,d.issueId,d.issueRevision,user.id,JSON.stringify(lines),d.note,shortage]);
  await event(sql,user,b,'delivery-received',{issueId:d.issueId,revision:d.issueRevision,lines,note:d.note,shortage});
  // An acknowledgement is evidence for accountants; it never posts inventory or rewrites the issue.
  return {id,shortage};
 });
}
export async function buyerMonthlyStatement(user:Principal,month:string,organizationId?:string,sql?:Sql){
 parse(z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),month);const db=sql??await database();access(user);await assertCurrentPrincipal(db,user);
 if(user.area==='portal'&&user.role!=='SUPERMARKET')throw new CrmError('FORBIDDEN',403);
 const org=await organization(db,user,organizationId);
 // One database statement captures orders, confirmed issue revisions and receipts
 // consistently. No per-order network/query loop as monthly volume grows.
 type Item={id:string;code:string;date:string;branch:string;warehouse:string;lines:BuyerLine[];
  deliveries:{id:string;code:string;revision:number;lines:{productId:string;quantity:string}[]}[];
  receipts:{id:string;issue_id:string;issue_revision:number;lines:{productId:string;received:number;sent:string;difference:string}[];shortage:boolean;note:string}[];
  vats:{id:string;code:string;invoice_number:string}[]};
 const items=(await db.query<Item>(`SELECT b.id,b.code,b.created_at::text AS date,COALESCE(b.delivery->>'branchName','') AS branch,w.name AS warehouse,b.lines,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'code',i.code,'revision',i.workflow_version,'lines',i.flow_payload->'lines') ORDER BY i.created_at,i.id) FROM cohamy_crm.warehouse_handover_invoices i WHERE i.clearance_id=b.clearance_id AND i.workflow_state='CONFIRMED'),'[]'::jsonb) AS deliveries,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'issue_id',r.issue_id,'issue_revision',r.issue_revision,'lines',r.lines,'shortage',r.shortage,'note',r.note) ORDER BY r.created_at,r.id) FROM cohamy_crm.buyer_delivery_receipts r WHERE r.order_id=b.id),'[]'::jsonb) AS receipts,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'code',v.code,'invoice_number',v.invoice_number) ORDER BY v.created_at,v.id) FROM cohamy_crm.vat_invoices v WHERE v.clearance_id=b.clearance_id AND v.status NOT IN('UNISSUED','CANCELLED')),'[]'::jsonb) AS vats
  FROM cohamy_crm.buyer_orders b JOIN cohamy_crm.warehouses w ON w.id=b.warehouse_id
  WHERE b.organization_id=$1 AND b.status='CONFIRMED'
  AND b.created_at>=(($2||'-01')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
  AND b.created_at<((($2||'-01')::date+interval '1 month')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
  ORDER BY b.created_at,b.id LIMIT 10001`,[org.id,month])).rows;
 if(items.length>10000)throw new CrmError('REPORT_TOO_LARGE',413);
 const snapshot={organizationId:org.id,organizationName:org.name,month,items,total:String(items.reduce((n,b)=>n+b.lines.reduce((s,l)=>s+BigInt(l.total!),0n),0n))};
 const checksum=hash(snapshot),ack=(await db.query<{id:string;note:string;created_at:string}>('SELECT id,note,created_at FROM cohamy_crm.buyer_statement_acknowledgements WHERE organization_id=$1 AND month=$2 AND checksum=$3',[org.id,month,checksum])).rows[0]??null;
 return {...snapshot,checksum,acknowledgement:ack};
}
export async function acknowledgeBuyerStatement(user:Principal,input:unknown){
 if(user.area!=='portal'||user.role!=='SUPERMARKET')throw new CrmError('FORBIDDEN',403);
 const d=parse(statementSchema,input);return command(user,'statement-acknowledged',d,async sql=>{
  const statement=await buyerMonthlyStatement(user,d.month,d.organizationId,sql);if(statement.checksum!==d.checksum)throw new CrmError('STATEMENT_CHANGED',409);
  const id=randomUUID();await sql.query('INSERT INTO cohamy_crm.buyer_statement_acknowledgements(id,organization_id,month,checksum,snapshot,actor_id,note) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7) ON CONFLICT(organization_id,month,checksum) DO NOTHING',[id,statement.organizationId,d.month,d.checksum,JSON.stringify(statement),user.id,d.note]);
  await audit(sql,user.id,'buyer.statement-acknowledged',statement.organizationId,{month:d.month,checksum:d.checksum,note:d.note});return {acknowledged:true};
 });
}
export async function buyerOrganizationOptions(user:Principal){
 manager(user);const s=partnerScope(user);return (await(await database()).query<{id:string;name:string}>(`SELECT o.id,o.name FROM cohamy_crm.organizations o WHERE (${s.sql}) AND o.kind='CUSTOMER' AND o.active AND o.merged_into_id IS NULL ORDER BY o.name,o.id LIMIT 1000`,s.params)).rows;
}
