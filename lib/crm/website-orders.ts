import "server-only";
import {randomUUID} from "node:crypto";
import {z} from "zod";
import {getProductById} from "@/data/products";
import {database} from "./db";
import {audit,digest} from "./auth";
import {allPartners,assertPermission,CrmError} from "./permissions";
import type {Principal} from "./types";
const intake=z.object({
  idempotencyKey:z.uuid(),locale:z.enum(["vi","en","zh","ko","ja"]),payment:z.enum(["cod","bank","momo"]),
  contact:z.object({fullName:z.string().trim().min(2).max(120),email:z.email(),phone:z.string().trim().min(8).max(40),address:z.string().trim().min(5).max(500),city:z.string().trim().min(2).max(120),district:z.string().trim().max(120),ward:z.string().trim().max(120),note:z.string().trim().max(1000)}).strict(),
  items:z.array(z.object({productId:z.string().max(120),quantity:z.number().int().min(1).max(100)}).strict()).min(1).max(30),
}).strict();
export async function createWebsiteOrder(input:unknown) {
  if(process.env.CRM_WEBSITE_ORDER_INTAKE!=="true")throw new CrmError("ORDER_INTAKE_NOT_ENABLED",503);
  const parsed=intake.safeParse(input);if(!parsed.success)throw new CrmError("INVALID_FIELDS",400);
  const data=parsed.data;
  if(new Set(data.items.map(item=>item.productId)).size!==data.items.length)throw new CrmError("DUPLICATE_PRODUCT",400);
  const lines=data.items.map(item=>{const product=getProductById(item.productId);if(!product)throw new CrmError("INVALID_PRODUCT",400);return {websiteId:product.id,name:product.name[data.locale],quantity:item.quantity,unitPrice:String(product.price),lineTotal:String(BigInt(product.price)*BigInt(item.quantity))};});
  const subtotal=lines.reduce((sum,line)=>sum+BigInt(line.lineTotal),BigInt(0)).toString();
  const requestHash=digest(JSON.stringify({...data,idempotencyKey:undefined}));
  const db=await database();
  return db.transaction(async tx=> {
    const code=`CH-${randomUUID().replaceAll('-','').slice(0,16).toUpperCase()}`;
    const inserted=await tx.query<{id:string;code:string;subtotal:string}>(`INSERT INTO cohamy_crm.website_orders(id,code,idempotency_key,request_hash,locale,contact,lines,subtotal,payment_requested)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id,code,subtotal::text`,[randomUUID(),code,data.idempotencyKey,requestHash,data.locale,JSON.stringify(data.contact),JSON.stringify(lines),subtotal,data.payment]);
    const created=inserted.rows[0];
    if(created) {await audit(tx,null,"website.order-received",created.id,{code:created.code});return {code:created.code,subtotal:created.subtotal,status:"PENDING_REVIEW",paid:false,shippingQuotePending:true};}
    const existing=(await tx.query<{code:string;subtotal:string;request_hash:string}>("SELECT code,subtotal::text,request_hash FROM cohamy_crm.website_orders WHERE idempotency_key=$1",[data.idempotencyKey])).rows[0];
    if(!existing||existing.request_hash!==requestHash)throw new CrmError("IDEMPOTENCY_CONFLICT",409);
    return {code:existing.code,subtotal:existing.subtotal,status:"PENDING_REVIEW",paid:false,shippingQuotePending:true};
  });
}
export async function listWebsiteOrders(user:Principal) {
  assertPermission(user,"orders.read");
  if(!allPartners(user))return [];
  return (await (await database()).query<{id:string;code:string;contact:{fullName:string;phone:string};subtotal:string;status:string;paid:boolean;created_at:string}>("SELECT id,code,contact,subtotal::text,status,paid,created_at FROM cohamy_crm.website_orders ORDER BY created_at DESC,id LIMIT 100")).rows;
}
