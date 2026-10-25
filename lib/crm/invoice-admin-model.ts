import {z} from 'zod';
export const invoiceKinds=['FLOW','SALES','HISTORICAL','VAT','TRANSFER'] as const;
export type InvoiceKind=typeof invoiceKinds[number];
const money=z.string().regex(/^\d{1,15}$/),quantity=z.string().regex(/^\d{1,14}(?:\.\d{1,6})?$/);
export const invoiceEditLineSchema=z.object({productId:z.uuid().nullable(),name:z.string().trim().min(1).max(500),unit:z.string().trim().min(1).max(80),quantity,unitPrice:money,discount:money,tax:money,note:z.string().max(500).default('')}).strict();
export type InvoiceEditLine=z.infer<typeof invoiceEditLineSchema>;
export const invoiceContentSchema=z.object({
 warehouseId:z.uuid().nullable(),buyerName:z.string().trim().max(500),buyerAddress:z.string().trim().max(1000),buyerTaxId:z.string().trim().max(80),
 recipient:z.string().trim().max(200),recipientPhone:z.string().trim().max(80),issuedDate:z.union([z.literal(''),z.iso.date()]),
 invoiceNumber:z.string().trim().max(80),invoiceSymbol:z.string().trim().max(80),note:z.string().max(2000),fee:money,
 lines:z.array(invoiceEditLineSchema).min(1).max(200),
}).strict();
export type InvoiceContent=z.infer<typeof invoiceContentSchema>;
export const invoiceActionSchema=z.object({kind:z.enum(invoiceKinds),id:z.uuid(),version:z.string().max(200),action:z.enum(['EDIT','CANCEL']),content:invoiceContentSchema.optional(),reason:z.string().trim().min(5).max(2000),idempotencyKey:z.uuid()}).strict().refine(value=>value.action==='CANCEL'||Boolean(value.content));
export type InvoiceAction=z.infer<typeof invoiceActionSchema>;
export type AdminInvoice={kind:InvoiceKind;id:string;code:string;label:string;status:string;version:string;content:InvoiceContent;total:string;cancelled:boolean;linkedOrderId?:string|null;sourceId?:string|null;original:Record<string,unknown>};
export const invoiceKindLabels:Record<InvoiceKind,string>={FLOW:'Nhà máy / Kho / Giao hàng',SALES:'Hóa đơn bán hàng',HISTORICAL:'Hóa đơn cũ',VAT:'Hóa đơn VAT',TRANSFER:'Phiếu chuyển kho'};
