import 'server-only';
import {z} from 'zod';
import {database} from './db';
import {assertCurrentPrincipal} from './auth';
import {assertPermission} from './permissions';
import {parseCommercial as parse} from './commercial-common';
import {warehouseScope} from './warehouse-scope';
import {listInventory,listLocations,listTransferDestinationLocations} from './inventory';
import {inventoryTransferNotifications} from './inventory-transfer-notifications';
import type {Principal} from './types';

const querySchema=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),q:z.string().trim().max(100).default(''),direction:z.enum(['ALL','INCOMING','OUTGOING']).default('ALL'),status:z.enum(['ALL','IN_TRANSIT','PARTIAL','SHORT','RECEIVED']).default('ALL')}).strict();
export type TransferLine={productId:string;lotId:string;quantity:string;sourceLocationId:string;destinationLocationId:string;unit:{name?:string;sku?:string;stockUnit?:string}};
export type TransferRow={id:string;code:string;status:string;version:number;source_warehouse_id:string;destination_warehouse_id:string;source_name:string;destination_name:string;created_at:string;creator_name:string;reason:string;snapshot:{lines:TransferLine[];unclassifiedLines?:{quantity:number}[]};receipts:{index:number;quantity:string;shortage:string}[][]};
export async function inventoryTransferWorkspace(user:Principal,input:unknown={}){
 assertPermission(user,'warehouses.read');const query=parse(querySchema,input),db=await database();await assertCurrentPrincipal(db,user);
 const scope=warehouseScope(user),warehouses=(await db.query<{id:string;name:string;region:string}>(`SELECT w.id,w.name,w.region FROM cohamy_crm.warehouses w WHERE (${scope.sql}) ORDER BY w.name`,scope.params)).rows,ids=warehouses.map(w=>w.id);
 const parameters=[ids,query.q,query.direction,query.status];
 const where=`(t.source_warehouse_id=ANY($1::uuid[]) OR t.destination_warehouse_id=ANY($1::uuid[])) AND ($2='' OR t.code ILIKE '%'||$2||'%' OR sw.name ILIKE '%'||$2||'%' OR dw.name ILIKE '%'||$2||'%') AND ($3='ALL' OR ($3='INCOMING' AND t.destination_warehouse_id=ANY($1::uuid[])) OR ($3='OUTGOING' AND t.source_warehouse_id=ANY($1::uuid[]))) AND ($4='ALL' OR t.status=$4)`;
 const [locations,destinations,balances,rows,total,counts,notifications]=await Promise.all([
  listLocations(user),listTransferDestinationLocations(user),listInventory(user),
  db.query<TransferRow>(`SELECT t.*,sw.name AS source_name,dw.name AS destination_name,t.created_at::text,COALESCE((SELECT a.actor_identity->>'displayName' FROM cohamy_crm.audit_events a WHERE a.entity_id=t.id::text AND a.action='inventory.transfer-shipped' ORDER BY a.created_at LIMIT 1),u.display_name,'Chưa ghi nhận') AS creator_name,COALESCE((SELECT jsonb_agg(r.lines ORDER BY r.number) FROM cohamy_crm.inventory_transfer_receipts r WHERE r.transfer_id=t.id),'[]'::jsonb) AS receipts FROM cohamy_crm.inventory_transfers t JOIN cohamy_crm.warehouses sw ON sw.id=t.source_warehouse_id JOIN cohamy_crm.warehouses dw ON dw.id=t.destination_warehouse_id LEFT JOIN cohamy_crm.users u ON u.id=t.actor_id WHERE ${where} ORDER BY t.created_at DESC,t.id DESC LIMIT 50 OFFSET $5`,[...parameters,(query.page-1)*50]),
  db.query<{total:string}>(`SELECT count(*)::text AS total FROM cohamy_crm.inventory_transfers t JOIN cohamy_crm.warehouses sw ON sw.id=t.source_warehouse_id JOIN cohamy_crm.warehouses dw ON dw.id=t.destination_warehouse_id WHERE ${where}`,parameters),
  db.query<{incoming:string;outgoing:string}>("SELECT count(*) FILTER(WHERE destination_warehouse_id=ANY($1::uuid[]))::text AS incoming,count(*) FILTER(WHERE source_warehouse_id=ANY($1::uuid[]))::text AS outgoing FROM cohamy_crm.inventory_transfers WHERE status IN('IN_TRANSIT','PARTIAL') AND (source_warehouse_id=ANY($1::uuid[]) OR destination_warehouse_id=ANY($1::uuid[]))",[ids]),
  inventoryTransferNotifications(db,user),
 ]);
 const count=Number(total.rows[0].total);
 return {query,warehouses,locations,destinationLocations:destinations,balances,items:rows.rows,total:count,pageSize:50,nextPage:query.page*50<count?query.page+1:null,counts:counts.rows[0],notifications};
}
