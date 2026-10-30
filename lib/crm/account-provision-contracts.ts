import {z} from 'zod';
import {roles} from './types';
export const provisionAccountSchema=z.object({email:z.email().trim().toLowerCase(),displayName:z.string().trim().min(2).max(120),role:z.enum(roles),organizationId:z.uuid(),idempotencyKey:z.uuid(),loginMethod:z.enum(['INVITATION','GENERATED']).default('INVITATION')}).strict();
export const accountInvitationSchema=z.object({membershipId:z.uuid(),action:z.enum(['SEND','RESEND','REVOKE']),idempotencyKey:z.uuid()}).strict();
