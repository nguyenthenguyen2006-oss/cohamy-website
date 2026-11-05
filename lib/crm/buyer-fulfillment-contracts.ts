import {z} from 'zod';
export const buyerFulfillmentActionSchema=z.object({
 id:z.uuid(),version:z.number().int().positive(),
 action:z.enum(['APPROVE','REJECT','PAYMENT_REVIEW','PICKING','PACKED','DELIVERED','DELIVERY_FAILED']),
 decision:z.enum(['CLEAR','HOLD']).optional(),note:z.string().trim().min(3).max(2000),idempotencyKey:z.uuid(),
}).strict().refine(d=>(d.action==='PAYMENT_REVIEW')===(d.decision!==undefined));
