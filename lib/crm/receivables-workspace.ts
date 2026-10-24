import 'server-only';
import {database} from './db';
import {assertPermission,CrmError} from './permissions';
import {partnerScope} from './repository';
import {vietnamBusinessDate} from './commercial-common';
import type {Principal} from './types';

export interface ReceivablePartnerSummary {
 organizationId:string;organizationCode:string;organizationName:string;
 receivableCount:number;outstandingCount:number;remainingAmount:string;overdueAmount:string;disputedAmount:string;nearestDueOn:string|null;
 unpostedOrderCount:number;unpostedAmount:string;limitAmount:string;usedAmount:string;availableCredit:string;termsDays:number;creditEnabled:boolean;
 unallocatedPaymentAmount:string;pendingPaymentCount:number;
}
export const financeBusinessDate=()=>{const day=vietnamBusinessDate(new Date());return `${day.slice(0,4)}-${day.slice(4,6)}-${day.slice(6,8)}`;};

// Aggregate each ledger independently before joining. Detail lists are capped;
// these totals deliberately cover every authorized record, including older rows.
export async function receivablesWorkspaceSummary(user:Principal){
 assertPermission(user,'finance.read');if(user.area!=='crm')throw new CrmError('FORBIDDEN',403);
 const scope=partnerScope(user),asOf=financeBusinessDate(),params=[...scope.params,asOf],dateParam=`$${params.length}::date`;
 const rows=(await(await database()).query<ReceivablePartnerSummary>(`
  WITH partners AS (
   SELECT o.id,o.code,o.name FROM cohamy_crm.organizations o WHERE (${scope.sql}) AND o.kind IN('CUSTOMER','DEALER') AND o.merged_into_id IS NULL
  ), ar AS (
   SELECT r.organization_id,count(*)::integer AS count,
    count(*) FILTER(WHERE r.remaining_amount>0 AND r.status<>'PAID')::integer AS outstanding_count,
    coalesce(sum(r.remaining_amount) FILTER(WHERE r.status<>'PAID'),0)::text AS remaining,
    coalesce(sum(r.remaining_amount) FILTER(WHERE r.status<>'PAID' AND r.due_on<${dateParam}),0)::text AS overdue,
    coalesce(sum(r.remaining_amount) FILTER(WHERE r.status='DISPUTED'),0)::text AS disputed,
    min(r.due_on) FILTER(WHERE r.remaining_amount>0 AND r.status<>'PAID')::text AS nearest_due
   FROM cohamy_crm.receivables r JOIN partners p ON p.id=r.organization_id WHERE r.status<>'VOID' GROUP BY r.organization_id
  ), unposted AS (
   SELECT s.organization_id,count(*)::integer AS count,sum(h.amount)::text AS amount
   FROM cohamy_crm.sales_orders s JOIN partners p ON p.id=s.organization_id
   JOIN cohamy_crm.sales_order_versions v ON v.id=s.confirmed_version_id
   JOIN cohamy_crm.credit_holds h ON h.order_id=s.id AND h.status='ACTIVE'
   WHERE s.status='CONFIRMED' AND NOT EXISTS(SELECT 1 FROM cohamy_crm.receivables r WHERE (r.order_id=s.id OR(r.source_type IN('ORDER','sales-order') AND r.source_id=s.id::text)) AND r.status<>'VOID') GROUP BY s.organization_id
  ), receipts AS (
   SELECT p.organization_id,
    coalesce(sum(p.amount-p.allocated_amount-coalesce(refunds.amount,0)) FILTER(WHERE p.status='CONFIRMED'),0)::text AS available,
    count(*) FILTER(WHERE p.status='PENDING')::integer AS pending_count
   FROM cohamy_crm.payment_receipts p JOIN partners o ON o.id=p.organization_id
   LEFT JOIN LATERAL(SELECT sum(d.amount) AS amount FROM cohamy_crm.deposit_refund_requests d JOIN cohamy_crm.cash_requests c ON c.id=d.cash_request_id WHERE d.payment_id=p.id AND c.status IN('REQUESTED','APPROVED','EXECUTED'))refunds ON true
   GROUP BY p.organization_id
  )
  SELECT p.id AS "organizationId",p.code AS "organizationCode",p.name AS "organizationName",
   coalesce(ar.count,0) AS "receivableCount",coalesce(ar.outstanding_count,0) AS "outstandingCount",coalesce(ar.remaining,'0') AS "remainingAmount",
   coalesce(ar.overdue,'0') AS "overdueAmount",coalesce(ar.disputed,'0') AS "disputedAmount",ar.nearest_due AS "nearestDueOn",
   coalesce(unposted.count,0) AS "unpostedOrderCount",coalesce(unposted.amount,'0') AS "unpostedAmount",
   coalesce(c.limit_amount,0)::text AS "limitAmount",coalesce(c.used_amount,0)::text AS "usedAmount",
   (coalesce(c.limit_amount,0)-coalesce(c.used_amount,0))::text AS "availableCredit",coalesce(c.terms_days,0) AS "termsDays",coalesce(c.enabled,false) AS "creditEnabled",
   coalesce(receipts.available,'0') AS "unallocatedPaymentAmount",coalesce(receipts.pending_count,0) AS "pendingPaymentCount"
  FROM partners p LEFT JOIN ar ON ar.organization_id=p.id LEFT JOIN unposted ON unposted.organization_id=p.id
  LEFT JOIN cohamy_crm.credit_accounts c ON c.organization_id=p.id LEFT JOIN receipts ON receipts.organization_id=p.id
  WHERE coalesce(ar.count,0)>0 OR coalesce(unposted.count,0)>0 OR c.organization_id IS NOT NULL OR coalesce(receipts.pending_count,0)>0 OR coalesce(receipts.available,'0')::numeric<>0
  ORDER BY coalesce(ar.remaining,'0')::numeric DESC,p.name,p.id
 `,params)).rows;
 const postableOrders=(await(await database()).query<{id:string;code:string;organizationId:string;organizationName:string;amount:string;date:string}>(`
  SELECT s.id,s.code,s.organization_id AS "organizationId",o.name AS "organizationName",h.amount::text AS amount,
   (s.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS date
  FROM cohamy_crm.sales_orders s JOIN cohamy_crm.organizations o ON o.id=s.organization_id
  JOIN cohamy_crm.credit_holds h ON h.order_id=s.id AND h.status='ACTIVE'
  WHERE (${scope.sql}) AND o.merged_into_id IS NULL AND s.status='CONFIRMED' AND s.confirmed_version_id IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM cohamy_crm.receivables r WHERE (r.order_id=s.id OR(r.source_type IN('ORDER','sales-order') AND r.source_id=s.id::text)) AND r.status<>'VOID')
  ORDER BY s.created_at DESC,s.id`,scope.params)).rows;
 return {asOf,rows,postableOrders};
}
