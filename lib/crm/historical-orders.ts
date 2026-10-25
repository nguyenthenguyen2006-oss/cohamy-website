import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { database, type Sql } from './db';
import { assertCurrentPrincipal, audit } from './auth';
import { assertPermission, CrmError, warehouseRoleRegion } from './permissions';
import { commercialDigest, parseCommercial } from './commercial-common';
import { historicalInvoiceSchema, type HistoricalInvoiceRecord } from './historical-order-model';
import type { Principal } from './types';
import type {InvoiceContent} from './invoice-admin-model';
import {invoiceLineAmount} from './invoice-admin-read';

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const batchSchema = z.object({ warehouseId:z.uuid(), invoices:z.array(z.object({
  snapshot:historicalInvoiceSchema,
  filename:z.string().max(180).regex(/^[^/\\\x00-\x1f\x7f]+\.png$/iu).refine(value => !/\p{Cf}/u.test(value)),
  content:z.instanceof(Buffer).refine(value => value.length > 0 && value.length <= 20971520),
}).strict()).min(1).max(50) }).strict();

function scope(user: Principal) {
  assertPermission(user,'historical-orders.read');
  const params: unknown[] = [user.organizationId];
  let sql = 'h.owner_organization_id=$1';
  const region = warehouseRoleRegion(user.role);
  if (region) { params.push(region); sql += ' AND w.region=$2'; }
  if (user.role === 'WAREHOUSE') { params.push(user.membershipId); sql += ' AND EXISTS(SELECT 1 FROM cohamy_crm.warehouse_assignments a WHERE a.warehouse_id=w.id AND a.membership_id=$2)'; }
  return { sql, params };
}
const adminJoin="LEFT JOIN cohamy_crm.invoice_admin_heads ia ON ia.kind='HISTORICAL' AND ia.entity_id=h.id";
const columns = `h.id,COALESCE((ia.content->>'warehouseId')::uuid,h.warehouse_id) AS warehouse_id,h.snapshot,h.snapshot_checksum,h.source_filename,h.source_size,h.source_checksum,h.imported_at::text,w.name AS warehouse_name,w.region AS warehouse_region,ia.content AS admin_content,ia.total_amount::text AS admin_total,ia.paid_amount::text AS admin_paid,ia.cancelled_at AS admin_cancelled`;
function verifySnapshot(row: HistoricalInvoiceRecord & { snapshot_checksum:string;admin_content?:InvoiceContent|null;admin_total?:string;admin_paid?:string;admin_cancelled?:string|null }) {
  const parsed = historicalInvoiceSchema.safeParse(row.snapshot);
  if (!parsed.success || commercialDigest(parsed.data) !== row.snapshot_checksum) throw new CrmError('HISTORICAL_INVOICE_INTEGRITY_FAILED',503);
  const { snapshot_checksum: _,admin_content:content,admin_total:total,admin_paid:paid,admin_cancelled:cancelled, ...record } = row;
  void _;
  if(content){const amount=Number(total),collected=Number(paid),subtotal=content.lines.reduce((n,l)=>n+Number(l.unitPrice)*Number(l.quantity)-Number(l.discount),0),tax=content.lines.reduce((n,l)=>n+Number(l.tax),0);record.snapshot={...record.snapshot,series:content.invoiceSymbol,number:content.invoiceNumber,date:content.issuedDate,buyerName:content.buyerName,buyerContact:content.recipient,buyerTaxId:content.buyerTaxId,buyerAddress:content.buyerAddress,note:content.note,lines:content.lines.map(l=>({name:l.name,unit:l.unit,quantity:Number(l.quantity),unitPrice:Number(l.unitPrice),amount:Number(invoiceLineAmount(l))-Number(l.tax)})),subtotal,fee:Number(content.fee),vatAmount:tax,total:amount,paidAmount:collected,paymentStatus:cancelled?'CANCELLED':collected>=amount?'PAID':collected>0?'PARTIAL':'UNPAID',paymentConfirmation:'ADMIN_CORRECTED_FROM_LEDGER'};}
  return record;
}
export async function listHistoricalInvoices(user: Principal, query:{q?:string;page?:string}={}) {
  const access = scope(user), q = (query.q ?? '').trim().slice(0,120);
  const page = Math.max(1,Math.min(10000,Math.floor(Number(query.page) || 1)));
  return (await database()).transaction(async tx => {
    await assertCurrentPrincipal(tx,user);
    const params = [...access.params,'%'+q+'%'];
    const where = access.sql + ` AND ia.cancelled_at IS NULL AND (COALESCE(ia.content->>'invoiceNumber',h.invoice_number) ILIKE $${params.length} OR COALESCE(ia.content->>'buyerName',h.snapshot->>'buyerName') ILIKE $${params.length} OR COALESCE(ia.content->>'buyerTaxId',h.snapshot->>'buyerTaxId') ILIKE $${params.length})`;
    const summary = (await tx.query<{total:string;amount:string;paid:string}>(`SELECT count(*)::text AS total,coalesce(sum(coalesce(ia.total_amount,(h.snapshot->>'total')::bigint)),0)::text AS amount,coalesce(sum(coalesce(ia.paid_amount,(h.snapshot->>'paidAmount')::bigint)),0)::text AS paid FROM cohamy_crm.historical_order_invoices h ${adminJoin} JOIN cohamy_crm.warehouses w ON w.id=COALESCE((ia.content->>'warehouseId')::uuid,h.warehouse_id) WHERE ${where}`,params)).rows[0];
    const items = (await tx.query<HistoricalInvoiceRecord & {snapshot_checksum:string}>(`SELECT ${columns} FROM cohamy_crm.historical_order_invoices h ${adminJoin} JOIN cohamy_crm.warehouses w ON w.id=COALESCE((ia.content->>'warehouseId')::uuid,h.warehouse_id) WHERE ${where} ORDER BY COALESCE(ia.content->>'issuedDate',h.invoice_date::text) DESC,h.invoice_number DESC,h.id LIMIT 50 OFFSET $${params.length+1}`,[...params,(page-1)*50])).rows.map(verifySnapshot);
    return {items,total:Number(summary.total),amount:summary.amount,paid:summary.paid,page,pageSize:50};
  });
}
async function record(sql:Sql,user:Principal,id:string) {
  const access=scope(user);
  if (!z.uuid().safeParse(id).success) throw new CrmError('NOT_FOUND',404);
  const row=(await sql.query<HistoricalInvoiceRecord & {snapshot_checksum:string}>(`SELECT ${columns} FROM cohamy_crm.historical_order_invoices h ${adminJoin} JOIN cohamy_crm.warehouses w ON w.id=COALESCE((ia.content->>'warehouseId')::uuid,h.warehouse_id) WHERE ${access.sql} AND h.id=$${access.params.length+1}`,[...access.params,id])).rows[0];
  if (!row) throw new CrmError('NOT_FOUND',404);
  return verifySnapshot(row);
}
export async function historicalInvoice(user:Principal,id:string) {
  scope(user);
  return (await database()).transaction(async tx => {await assertCurrentPrincipal(tx,user);return record(tx,user,id);});
}
export async function historicalInvoiceSource(user:Principal,id:string) {
  scope(user);
  return (await database()).transaction(async tx => {
    await assertCurrentPrincipal(tx,user);
    const invoice=await record(tx,user,id);
    const bytes=(await tx.query<{source_content:Uint8Array}>('SELECT source_content FROM cohamy_crm.historical_order_invoices WHERE id=$1',[invoice.id])).rows[0];
    const content=Buffer.from(bytes.source_content);
    if (content.length!==invoice.source_size || sha(content)!==invoice.source_checksum) throw new CrmError('HISTORICAL_SOURCE_INTEGRITY_FAILED',503);
    return {...invoice,content};
  });
}

// Import is deliberately a server-side operator action. Preview is the default;
// applying requires the exact digest of the reviewed warehouse, fields and image bytes.
export async function importHistoricalInvoices(user:Principal,input:unknown,applyDigest?:string) {
  assertPermission(user,'historical-orders.import');
  const data=parseCommercial(batchSchema,input);
  const keys=data.invoices.map(file => [file.snapshot.sellerTaxId.replace('-',''),file.snapshot.series,file.snapshot.number].join('/'));
  if (new Set(keys).size!==keys.length) throw new CrmError('DUPLICATE_INVOICE_IN_BATCH',400);
  for (const file of data.invoices) {
    try { if ((await sharp(file.content,{limitInputPixels:40_000_000}).metadata()).format!=='png') throw new Error(); }
    catch {throw new CrmError('INVALID_SOURCE_IMAGE',400);}
  }
  const entries=data.invoices.map(file=>({...file,checksum:sha(file.content),snapshotChecksum:commercialDigest(file.snapshot)}));
  const checksum=commercialDigest({organizationId:user.organizationId,warehouseId:data.warehouseId,invoices:entries.map(file=>({snapshot:file.snapshot,filename:file.filename,checksum:file.checksum}))});
  if (applyDigest!==undefined && applyDigest!==checksum) throw new CrmError('IMPORT_PREVIEW_CHANGED',409);
  return (await database()).transaction(async tx => {
    await assertCurrentPrincipal(tx,user);
    const warehouse=(await tx.query<{id:string;name:string;region:string}>("SELECT id,name,region FROM cohamy_crm.warehouses WHERE id=$1 AND organization_id=$2 AND active AND region IN('NORTH','SOUTH')",[data.warehouseId,user.organizationId])).rows[0];
    if (!warehouse) throw new CrmError('WAREHOUSE_NOT_FOUND',404);
    // An advisory transaction lock serializes imports without requiring UPDATE
    // privilege on this immutable table. Runtime retains SELECT/INSERT only.
    if (applyDigest) await tx.query('SELECT pg_advisory_xact_lock(431025,hashtext($1))',[user.organizationId]);
    const results:{id:string|null;number:string;action:'CREATE'|'ALREADY_IMPORTED';total:number}[]=[];
    for (const file of entries) {
      const s=file.snapshot;
      const prior=(await tx.query<{id:string;warehouse_id:string;snapshot_checksum:string;source_checksum:string}>("SELECT id,warehouse_id,snapshot_checksum,source_checksum FROM cohamy_crm.historical_order_invoices WHERE owner_organization_id=$1 AND seller_tax_id=$2 AND series=$3 AND invoice_number=$4",[user.organizationId,s.sellerTaxId.replace('-',''),s.series,s.number])).rows[0];
      if (prior && (prior.warehouse_id!==warehouse.id || prior.snapshot_checksum!==file.snapshotChecksum || prior.source_checksum!==file.checksum)) throw new CrmError('HISTORICAL_INVOICE_CONFLICT',409);
      let id=prior?.id ?? null;
      if (!prior && applyDigest) {
        id=randomUUID();
        await tx.query("INSERT INTO cohamy_crm.historical_order_invoices(id,owner_organization_id,warehouse_id,seller_tax_id,series,invoice_number,invoice_date,snapshot,snapshot_checksum,source_filename,source_mime,source_size,source_checksum,source_content,batch_checksum,imported_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,'image/png',$11,$12,$13,$14,$15)",[id,user.organizationId,warehouse.id,s.sellerTaxId.replace('-',''),s.series,s.number,s.date,JSON.stringify(s),file.snapshotChecksum,file.filename,file.content.length,file.checksum,file.content,checksum,user.id]);
        await audit(tx,user.id,'historical-invoice.imported',id,{warehouseId:warehouse.id,series:s.series,number:s.number,batchChecksum:checksum,sourceChecksum:file.checksum,paymentConfirmation:s.paymentConfirmation,stockEffect:'NONE',liveLedgerEffect:'NONE'});
      }
      results.push({id,number:s.number,action:prior?'ALREADY_IMPORTED':'CREATE',total:s.total});
    }
    return {mode:applyDigest?'APPLIED':'PREVIEW',checksum,warehouse,results,total:entries.reduce((sum,file)=>sum+file.snapshot.total,0),stockEffect:'NONE',liveLedgerEffect:'NONE'};
  });
}
