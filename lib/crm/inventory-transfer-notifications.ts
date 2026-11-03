import 'server-only';
import {randomUUID} from 'node:crypto';
import type {Sql} from './db';
import type {Principal} from './types';
import {warehouseScope,warehouseMemberScope} from './warehouse-scope';

export async function notifyInventoryTransfer(sql:Sql,input:{id:string;code:string;sourceId:string;destinationId:string;event:'SHIPPED'|'RECEIVED';version:number;status:string}){
 const names=(await sql.query<{id:string;name:string}>('SELECT id,name FROM cohamy_crm.warehouses WHERE id=ANY($1::uuid[])',[[input.sourceId,input.destinationId]])).rows;
 const source=names.find(w=>w.id===input.sourceId)?.name??'',destination=names.find(w=>w.id===input.destinationId)?.name??'';
 const recipients=(await sql.query<{user_id:string}>(`SELECT DISTINCT m.user_id FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id JOIN cohamy_crm.warehouses w ON w.id=ANY($1::uuid[]) WHERE m.active AND u.active AND u.deleted_at IS NULL AND (${warehouseMemberScope('m','w')})`,[input.event==='SHIPPED'?[input.destinationId]:[input.sourceId,input.destinationId]])).rows;
 const message=`${input.code} · ${source} → ${destination} · ${input.event==='SHIPPED'?'Chờ kho nhận xác nhận thực nhận':input.status==='SHORT'?'Đã chốt nhận, có thiếu hàng':input.status==='PARTIAL'?'Đã nhận một phần':'Đã xác nhận nhận đủ'}`;
 for(const recipient of recipients)await sql.query("INSERT INTO cohamy_crm.notifications(id,user_id,event_key,kind,entity_type,entity_id,message,available_at) VALUES($1,$2,$3,'SYSTEM','inventory-transfer',$4,$5,now()) ON CONFLICT(user_id,event_key) DO NOTHING",[randomUUID(),recipient.user_id,`inventory.transfer.${input.event.toLowerCase()}:${input.id}:${input.version}`,input.id,message]);
}

export async function inventoryTransferNotifications(sql:Sql,user:Principal){
 const scope=warehouseScope(user,'w',1);
 const rows=(await sql.query<{id:string;message:string;entity_id:string;created_at:string;code:string}>(`SELECT n.id,n.message,n.entity_id,n.created_at::text,t.code FROM cohamy_crm.notifications n JOIN cohamy_crm.inventory_transfers t ON t.id=n.entity_id WHERE n.user_id=$1 AND n.entity_type='inventory-transfer' AND n.available_at<=now() AND EXISTS(SELECT 1 FROM cohamy_crm.warehouses w WHERE w.id IN(t.source_warehouse_id,t.destination_warehouse_id) AND (${scope.sql})) ORDER BY n.created_at DESC LIMIT 100`,[user.id,...scope.params])).rows;
 return rows.map(row=>({...row,href:'/crm/warehouse-transfers?q='+encodeURIComponent(row.code)}));
}
