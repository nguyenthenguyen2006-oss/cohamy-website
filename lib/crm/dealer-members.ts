import 'server-only';
import {z} from 'zod';
import {database} from './db';
import {audit} from './auth';
import {CrmError} from './permissions';
import {parse} from './workspace';
import type {Principal} from './types';
const owner=(user:Principal)=>{if(user.area!=='portal'||user.role!=='DEALER_OWNER')throw new CrmError('FORBIDDEN',403);};
export async function dealerMembers(user:Principal){owner(user);return(await(await database()).query<{id:string;name:string;email:string;role:string;active:boolean;version:number}>('SELECT m.id,u.display_name AS name,u.email,m.role,m.active,m.version FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id WHERE m.organization_id=$1 ORDER BY u.display_name,m.id',[user.organizationId])).rows;}
export async function setDealerMember(user:Principal,input:unknown){owner(user);const d=parse(z.object({id:z.uuid(),version:z.number().int().positive(),active:z.boolean(),role:z.literal('DEALER_STAFF')}).strict(),input);return(await database()).transaction(async tx=>{const m=(await tx.query<{id:string;role:string;version:number;active:boolean}>('SELECT id,role,version,active FROM cohamy_crm.memberships WHERE id=$1 AND organization_id=$2 FOR UPDATE',[d.id,user.organizationId])).rows[0];if(!m)throw new CrmError('NOT_FOUND',404);if(m.role!=='DEALER_STAFF'||m.id===user.membershipId)throw new CrmError('FORBIDDEN',403);if(m.version!==d.version)throw new CrmError('VERSION_CONFLICT',409);await tx.query('UPDATE cohamy_crm.memberships SET active=$1,version=version+1 WHERE id=$2',[d.active,d.id]);if(!d.active)await tx.query('UPDATE cohamy_crm.sessions SET revoked_at=now() WHERE membership_id=$1 AND revoked_at IS NULL',[d.id]);await audit(tx,user.id,'dealer.staff-status-changed',d.id,{active:d.active,role:'DEALER_STAFF',organizationId:user.organizationId});return {version:m.version+1};});}
