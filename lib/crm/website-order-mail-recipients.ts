import 'server-only';
import {z} from 'zod';
import type {Sql} from './db';
import type {MailRecipients} from './document-mail-model';
import {warehouseMemberScope} from './warehouse-scope';

const emailAddress = z.email();

export async function websiteOrderWarehouseRecipients(sql:Sql, warehouseId:string):Promise<MailRecipients> {
  const {rows} = await sql.query<{email:string}>(`
    SELECT DISTINCT lower(btrim(u.email)) AS email
    FROM cohamy_crm.warehouses w
    JOIN cohamy_crm.organizations o ON o.id=w.organization_id
    JOIN cohamy_crm.memberships m ON ${warehouseMemberScope()}
    JOIN cohamy_crm.users u ON u.id=m.user_id
    WHERE w.id=$1 AND w.active AND o.active AND o.kind='COHAMY'
      AND m.active AND u.active AND u.activation_status='ACTIVE' AND u.deleted_at IS NULL AND NOT u.is_demo
    ORDER BY email`, [warehouseId]);
  return {to:rows.map(row=>row.email).filter(email=>emailAddress.safeParse(email).success),cc:[],bcc:[]};
}

export async function currentWebsiteOrderWarehouseRecipients(sql:Sql, job:{entity_id:string;revision:number;warehouse_id:string|null}) {
  if (!job.warehouse_id) return null;
  const {rows} = await sql.query(`
    SELECT o.id FROM cohamy_crm.website_orders o
    WHERE o.id=$1 AND o.assigned_warehouse_id=$2 AND o.status NOT IN('REJECTED','CANCELLED')
      AND $3=(SELECT a.version FROM cohamy_crm.website_order_dispatch_actions a
        WHERE a.website_order_id=o.id AND a.action='ASSIGN' ORDER BY a.version DESC LIMIT 1)`,
    [job.entity_id,job.warehouse_id,job.revision]);
  return rows.length ? websiteOrderWarehouseRecipients(sql,job.warehouse_id) : null;
}
