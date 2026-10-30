import {z} from 'zod';
export const deleteAccountSchema=z.object({expectedVersion:z.number().int().positive(),previewFingerprint:z.string().regex(/^[a-f0-9]{64}$/),confirmEmail:z.email().trim().toLowerCase(),reason:z.string().trim().min(3).max(1000),idempotencyKey:z.uuid()}).strict();
