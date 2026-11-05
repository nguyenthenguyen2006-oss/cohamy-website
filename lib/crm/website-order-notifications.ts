import 'server-only';
import type {Sql} from './db';
import {enqueueDocumentMail} from './document-mail';
import type {FlowSnapshot} from './document-flow-model';
import {WEBSITE_ORDER_MAIL_EVENT, websiteOrderMailEvent} from './website-order-mail-event';

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
  const origin = (process.env.CRM_PUBLIC_ORIGIN ?? 'https://cohamy.vn').replace(/\/$/, '');
  await enqueueDocumentMail(sql, {
    event:WEBSITE_ORDER_MAIL_EVENT, snapshot, files:[], label:websiteOrderMailEvent.label,
    url:origin+'/crm/online-customers/'+encodeURIComponent(order.id),
  });
}
