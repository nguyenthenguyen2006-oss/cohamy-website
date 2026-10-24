import { z } from 'zod';

const money = z.number().int().min(0).max(1_000_000_000_000);
const text = z.string().trim().min(1).max(500);
export const historicalInvoiceSchema = z.object({
  series: z.string().trim().regex(/^[A-Z0-9]{1,20}$/),
  number: z.string().regex(/^[1-9][0-9]{0,19}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
  }),
  sellerName: text,
  sellerTaxId: z.string().regex(/^[0-9]{10}(?:-?[0-9]{3})?$/),
  buyerName: text,
  buyerContact: z.string().trim().max(200),
  buyerTaxId: z.string().regex(/^[0-9]{10}(?:-?[0-9]{3})?$/),
  buyerAddress: text,
  lines: z.array(z.object({ name: text, unit: z.literal('Gói'), quantity: z.number().int().positive().max(1_000_000), unitPrice: money, amount: money }).strict()).min(1).max(100),
  currency: z.literal('VND'),
  subtotal: money,
  vatRatePercent: z.number().int().min(0).max(100),
  vatAmount: money,
  total: money,
  paidAmount: money,
  paymentStatus: z.literal('PAID'),
  paymentConfirmation: z.literal('USER_CONFIRMED_FULLY_PAID'),
  note: z.string().trim().max(2000),
}).strict().superRefine((data, context) => {
  if (data.lines.some(line => line.quantity * line.unitPrice !== line.amount)) context.addIssue({ code:'custom', message:'LINE_AMOUNT_MISMATCH' });
  if (data.lines.reduce((total,line) => total + line.amount,0) !== data.subtotal) context.addIssue({ code:'custom', message:'SUBTOTAL_MISMATCH' });
  if (data.subtotal + data.vatAmount !== data.total || data.paidAmount !== data.total) context.addIssue({ code:'custom', message:'TOTAL_OR_PAYMENT_MISMATCH' });
});
export type HistoricalInvoice = z.infer<typeof historicalInvoiceSchema>;
export interface HistoricalInvoiceRecord {
  id: string;
  warehouse_id: string;
  warehouse_name: string;
  warehouse_region: string;
  snapshot: HistoricalInvoice;
  source_filename: string;
  source_size: number;
  source_checksum: string;
  imported_at: string;
}
