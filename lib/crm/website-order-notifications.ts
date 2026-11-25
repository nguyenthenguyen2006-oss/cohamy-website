import 'server-only';
import {randomUUID} from 'node:crypto';
import type {Sql} from './db';
import {enqueueDocumentMail} from './document-mail';
import type {FlowSnapshot} from './document-flow-model';
import {WEBSITE_ORDER_ASSIGNED_MAIL_EVENT, WEBSITE_ORDER_MAIL_EVENT, WEBSITE_ORDER_WAREHOUSE_RECIPIENTS_MISSING, websiteOrderMailEvent} from './website-order-mail-event';
import {websiteOrderWarehouseRecipients} from './website-order-mail-recipients';

function websiteOrderUrl(id:string) {
  const origin = (process.env.CRM_PUBLIC_ORIGIN ?? 'https://cohamy.vn').replace(/\/$/, '');
  return origin+'/crm/online-customers/'+encodeURIComponent(id);
}

/** Call only for a newly inserted order, inside its existing intake transaction. */
export async function enqueueWebsiteOrderReceived(sql:Sql, order:{id:string;code:string;createdAt?:string}):Promise<void> {
  const receivedAt = new Date(order.createdAt ?? Date.now());
  if(!Number.isFinite(receivedAt.getTime()))throw new Error('WEBSITE_ORDER_CREATED_AT_INVALID');
  const receivedDisplay = new Intl.DateTimeFormat('vi-VN', {
    timeZone:'Asia/Ho_Chi_Minh', dateStyle:'short', timeStyle:'short',
  }).format(receivedAt);
  const snapshot:FlowSnapshot = {
    id:order.id, code:order.code, kind:'REQUEST', revision:1, state:'PENDING_REVIEW',
    warehouseId:'', warehouseName:'', warehouseCode:'', factoryMembershipId:null, factoryName:'',
    sourceId:null, sourceCode:'', sourceRevision:null, requestId:null, requestCode:'',
    createdAt:receivedDisplay, createdBy:'', confirmedAt:null, confirmedBy:'', dueDate:'',
    note:'', lines:[], delivery:{}, totals:{},
  };
  await enqueueDocumentMail(sql, {
    event:WEBSITE_ORDER_MAIL_EVENT, snapshot, files:[], label:websiteOrderMailEvent.label,
    url:websiteOrderUrl(order.id),
  });
}

export async function enqueueWebsiteOrderAssigned(sql:Sql, order:{id:string;code:string;revision:number;warehouseId:string;warehouseName:string;actorId:string}) {
  const event = WEBSITE_ORDER_ASSIGNED_MAIL_EVENT;
  await sql.query(`UPDATE cohamy_crm.document_mail_outbox SET status='SUPERSEDED',updated_at=now()
    WHERE event=$1 AND entity_id=$2 AND revision<$3 AND status IN('PENDING','RETRY','DEFERRED','FAILED')`, [event,order.id,order.revision]);
  const recipients = await websiteOrderWarehouseRecipients(sql,order.warehouseId);
  const subject = `Cohamy · Đơn online ${order.code} được giao về ${order.warehouseName}`;
  const body = `Đơn online ${order.code} đã được giao về ${order.warehouseName}.\n\nMở đơn trong CRM để kiểm tra và bấm “Tiếp nhận đơn tại kho”.\n${websiteOrderUrl(order.id)}`;
  await sql.query(`INSERT INTO cohamy_crm.document_mail_outbox
    (id,event_key,event,entity_id,revision,warehouse_id,code,recipients,subject,body,files,created_by,status,last_error)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,'[]'::jsonb,$11,$12,$13)`,
    [randomUUID(),`${event}:${order.id}:${order.revision}`,event,order.id,order.revision,order.warehouseId,
      order.code,JSON.stringify(recipients),subject,body,order.actorId,recipients.to.length?'PENDING':'FAILED',
      recipients.to.length?'':WEBSITE_ORDER_WAREHOUSE_RECIPIENTS_MISSING]);
}
