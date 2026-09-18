import 'server-only';
import {z} from 'zod';
import {database,type Sql} from './db';
import {assertCurrentPrincipal} from './auth';
import {assertPermission,CrmError} from './permissions';
import {partnerScope} from './repository';

export function normalizedPhone(value:string) {
  const digits=value.replace(/[^0-9]/g,'');
  return digits.startsWith('0084')&&digits.length>=13?'0'+digits.slice(4):
    digits.startsWith('84')&&digits.length>=11?'0'+digits.slice(2):digits;
}
export function normalizedBusinessId(value:string){return value.replace(/[ ._-]/g,'').toUpperCase();}
export interface DuplicateCandidate {id:string;name:string;code:string;kind:string;matches:string[]}
export async function inputDuplicates(user:import('./types').Principal,input:unknown,sql?:Sql):Promise<DuplicateCandidate[]> {
  assertPermission(user,'partners.read');
  if(user.area!=='crm')throw new CrmError('FORBIDDEN',403);
  const parsed=z.object({phone:z.string().max(40).default(''),email:z.string().max(254).default(''),businessId:z.string().max(40).regex(/^[A-Za-z0-9 ._-]*$/).default(''),excludeId:z.uuid().optional()}).strict().safeParse(input);
  if(!parsed.success)throw new CrmError('INVALID_FIELDS',400);
  const data=parsed.data,scope=partnerScope(user),tx=sql??await database();
  // Scope is applied in SQL before LIMIT. Never report hidden duplicate counts.
  const params=[...scope.params,normalizedPhone(data.phone),data.email.trim().toLowerCase(),normalizedBusinessId(data.businessId),data.excludeId??null],n=scope.params.length;
  const rows=(await tx.query<DuplicateCandidate>(`SELECT o.id,o.name,o.code,o.kind,
    array_remove(ARRAY[CASE WHEN o.phone_key=$${n+1} AND $${n+1}<>'' THEN 'phone' END,
      CASE WHEN o.email_key=$${n+2} AND $${n+2}<>'' THEN 'email' END,
      CASE WHEN o.business_key=$${n+3} AND $${n+3}<>'' THEN 'businessId' END],NULL) AS matches
    FROM cohamy_crm.organizations o WHERE (${scope.sql}) AND o.kind<>'COHAMY'
      AND ($${n+4}::uuid IS NULL OR o.id<>$${n+4})
      AND (($${n+1}<>'' AND o.phone_key=$${n+1}) OR ($${n+2}<>'' AND o.email_key=$${n+2}) OR ($${n+3}<>'' AND o.business_key=$${n+3}))
    ORDER BY o.name,o.id LIMIT 10`,params)).rows;
  return rows;
}
export async function freshInputDuplicates(user:import('./types').Principal,input:unknown) {
  assertPermission(user,'partners.write');
  return(await database()).transaction(async tx=>{await assertCurrentPrincipal(tx,user);return inputDuplicates(user,input,tx);});
}
