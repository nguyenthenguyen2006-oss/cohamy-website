import 'server-only';
import type {Sql} from './db';
import {enqueueNotification} from './workspace';
export async function commercialNotification(sql:Sql,input:{organizationId:string;type:'commercial-request'|'sales-order'|'delivery'|'return-request';id:string;versionId:string;action:string;message:string;actorId:string;audience:'OWNER'|'COHAMY'|'PARTNER';creatorId?:string}){
 const recipients=(await sql.query<{user_id:string}>(`SELECT DISTINCT m.user_id FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id JOIN cohamy_crm.organizations o ON o.id=m.organization_id WHERE m.active AND u.active AND o.active AND o.merged_into_id IS NULL AND m.user_id<>$1 AND ${input.audience==='COHAMY'?"(m.role IN('ADMIN','MANAGER') OR (m.role='SALES' AND EXISTS(SELECT 1 FROM cohamy_crm.partner_assignments a WHERE a.membership_id=m.id AND a.organization_id=$2)))":input.audience==='OWNER'?"m.organization_id=$2 AND m.role='DEALER_OWNER'":"m.organization_id=$2 AND(m.role='DEALER_OWNER' OR m.user_id=$3)"}`,[input.actorId,input.organizationId,...(input.audience==='PARTNER'?[input.creatorId??input.actorId]:[])])).rows;
 for(const r of recipients)await enqueueNotification(sql,r.user_id,input.type+':'+input.id+':'+input.versionId+':'+input.action,'SYSTEM',input.type,input.id,input.message);
}

export async function notifyShortage(
  sql: Sql,
  input: {
    orderOrRequestId: string;
    code: string;
    entityType: 'commercial-request' | 'sales-order';
    sku: string;
    needed: string;
    allocated: string;
    missing: string;
    expectedOn?: string | null;
    updatedBy: string;
    organizationId: string;
    actorId: string;
  }
) {
  const expectedStr = input.expectedOn ? ` Dự kiến giao: ${input.expectedOn}.` : ' Thời gian dự kiến: Chưa xác định.';
  const message = `Kho báo thiếu hàng cho ${input.code}: SKU ${input.sku}. Cần: ${input.needed}, Khả dụng: ${input.allocated}, Thiếu: ${input.missing}.${expectedStr} Người cập nhật: ${input.updatedBy}.`;

  const recipients = (await sql.query<{ user_id: string }>(
    `SELECT DISTINCT m.user_id FROM cohamy_crm.memberships m
     JOIN cohamy_crm.users u ON u.id = m.user_id
     WHERE m.active AND u.active AND (m.organization_id = $1 OR m.role IN ('ADMIN', 'MANAGER', 'SALES'))`,
    [input.organizationId]
  )).rows;

  const eventKey = `shortage:${input.orderOrRequestId}:${input.sku}:${input.missing}`;
  for (const r of recipients) {
    await enqueueNotification(sql, r.user_id, eventKey, 'SYSTEM', input.entityType, input.orderOrRequestId, message);
  }
}

export async function notifyReservationExpiring(
  sql: Sql,
  input: {
    requestId: string;
    code: string;
    expiresAt: string;
    organizationId: string;
    actorId: string;
  }
) {
  const message = `Giữ hàng tạm thời cho yêu cầu ${input.code} sắp hết hạn vào lúc ${input.expiresAt}. Vui lòng hoàn tất duyệt đơn.`;
  const recipients = (await sql.query<{ user_id: string }>(
    `SELECT DISTINCT m.user_id FROM cohamy_crm.memberships m
     JOIN cohamy_crm.users u ON u.id = m.user_id
     WHERE m.active AND u.active AND (m.organization_id = $1 OR m.role IN ('ADMIN', 'MANAGER'))`,
    [input.organizationId]
  )).rows;

  const eventKey = `res_expiring:${input.requestId}:${input.expiresAt}`;
  for (const r of recipients) {
    await enqueueNotification(sql, r.user_id, eventKey, 'SYSTEM', 'commercial-request', input.requestId, message);
  }
}
