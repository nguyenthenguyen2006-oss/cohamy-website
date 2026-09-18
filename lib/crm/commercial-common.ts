import 'server-only';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {CrmError} from './permissions';
import type {Principal} from './types';
export function parseCommercial<T>(schema:z.ZodType<T>,input:unknown):T {
 const result=schema.safeParse(input);if(!result.success)throw new CrmError('INVALID_FIELDS',400);return result.data;
}
export function commercialManager(user:Principal){if(user.area!=='crm'||!['ADMIN','MANAGER'].includes(user.role))throw new CrmError('FORBIDDEN',403);}
export function commercialWriter(user:Principal){if(user.area!=='crm'||!['ADMIN','MANAGER','SALES'].includes(user.role))throw new CrmError('FORBIDDEN',403);}
export function canonicalCommercial(value:unknown):string {
 const normalize=(item:unknown):unknown=>Array.isArray(item)?item.map(normalize):item&&typeof item==='object'?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>[key,normalize(v)])):item;
 return JSON.stringify(normalize(value));
}
export function commercialDigest(value:unknown){return createHash('sha256').update(canonicalCommercial(value)).digest('hex');}
export function vietnamBusinessDate(value:Date){return new Date(value.getTime()+7*3600000).toISOString().slice(0,10).replaceAll('-','');}
