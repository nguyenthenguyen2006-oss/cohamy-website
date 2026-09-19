import 'server-only';
import type {Sql} from './db';
import {enqueueNotification} from './workspace';
export async function commercialNotification(sql:Sql,input:{organizationId:string;type:'commercial-request'|'sales-order';id:string;versionId:string;action:string;message:string;actorId:string;audience:'OWNER'|'COHAMY'|'PARTNER';creatorId?:string}){
 const recipients=(await sql.query<{user_id:string}>(`SELECT DISTINCT m.user_id FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id JOIN cohamy_crm.organizations o ON o.id=m.organization_id WHERE m.active AND u.active AND o.active AND o.merged_into_id IS NULL AND m.user_id<>$1 AND ${input.audience==='COHAMY'?"(m.role IN('ADMIN','MANAGER') OR (m.role='SALES' AND EXISTS(SELECT 1 FROM cohamy_crm.partner_assignments a WHERE a.membership_id=m.id AND a.organization_id=$2)))":input.audience==='OWNER'?"m.organization_id=$2 AND m.role='DEALER_OWNER'":"m.organization_id=$2 AND(m.role='DEALER_OWNER' OR m.user_id=$3)"}`,[input.actorId,input.organizationId,...(input.audience==='PARTNER'?[input.creatorId??input.actorId]:[])])).rows;
 for(const r of recipients)await enqueueNotification(sql,r.user_id,input.type+':'+input.id+':'+input.versionId+':'+input.action,'SYSTEM',input.type,input.id,input.message);
}
