import 'server-only';
import {randomUUID} from 'node:crypto';
import {database, type Sql} from './db';
import {assertCurrentPrincipal, audit} from './auth';
import {CrmError} from './permissions';
import {commercialRequestAccess} from './order-requests';
import {salesVersionAccess, type SalesOrder} from './sales-orders';
import {fixed, fixedText} from './decimal';
import {commercialNotification} from './order-notifications';
import type {Principal} from './types';

type Balance = {warehouse_id:string;location_id:string;product_id:string;lot_id:string;on_hand:string;reserved:string};
type Reservation = Balance & {id:string;quantity:string;consumed:string;released:string;expires_at:string|null;request_id:string;order_id:string|null};
export const defaultProvisionalPolicy = {mode:'ON_SUBMIT' as const,ttlMinutes:120,allowPartial:true};
type ReserveInput = {requestId:string;warehouseId?:string;allowPartial?:boolean;ttlMinutes?:number;reason:string;idempotencyKey?:string};

async function releaseRows(sql:Sql, rows:Reservation[]) {
  for (const row of rows) {
    const remaining=fixed(row.quantity)-fixed(row.consumed)-fixed(row.released);
    const balance=(await sql.query<Balance>('SELECT * FROM cohamy_crm.inventory_balances WHERE warehouse_id=$1 AND location_id=$2 AND product_id=$3 AND lot_id=$4 FOR UPDATE',
      [row.warehouse_id,row.location_id,row.product_id,row.lot_id])).rows[0];
    if (!balance || fixed(balance.reserved)<remaining) throw new CrmError('RESERVATION_BALANCE_INVALID',503);
    await sql.query('UPDATE cohamy_crm.inventory_balances SET reserved=reserved-$1,version=version+1,updated_at=now() WHERE warehouse_id=$2 AND location_id=$3 AND product_id=$4 AND lot_id=$5',
      [fixedText(remaining),row.warehouse_id,row.location_id,row.product_id,row.lot_id]);
    await sql.query("UPDATE cohamy_crm.inventory_reservations SET released=quantity-consumed,status='RELEASED',version=version+1,updated_at=now() WHERE id=$1",[row.id]);
    await audit(sql,null,'inventory.provisional-released',row.id,{requestId:row.request_id,orderId:row.order_id,quantity:fixedText(remaining)});
  }
  return rows.length;
}
async function expiredForRequest(sql:Sql, requestId:string) {
  const rows=(await sql.query<Reservation>(`SELECT * FROM cohamy_crm.inventory_reservations WHERE request_id=$1
    AND reservation_type='PROVISIONAL' AND status IN('ACTIVE','PARTIAL') AND expires_at<=now()
    ORDER BY product_id,warehouse_id,location_id,lot_id,id FOR UPDATE`,[requestId])).rows;
  return releaseRows(sql,rows);
}

export async function reserveSubmittedRequest(sql:Sql,user:Principal,input:ReserveInput) {
  await assertCurrentPrincipal(sql,user);
  const head=await commercialRequestAccess(sql,user,input.requestId,true);
  if(head.status!=='SUBMITTED')throw new CrmError('REQUEST_NOT_SUBMITTED',409);
  const order=(await sql.query<SalesOrder>('SELECT * FROM cohamy_crm.sales_orders WHERE request_id=$1 FOR UPDATE',[head.id])).rows[0];
  if(!order||!['PENDING_APPROVAL','CONFIRMED'].includes(order.status))throw new CrmError('ORDER_NOT_RESERVABLE',409);
  const version=await salesVersionAccess(sql,order,order.latest_version_id);
  const policy=version.snapshot.reservationPolicy ?? version.snapshot.orderPolicy.definition.provisionalReservation ?? defaultProvisionalPolicy;
  if(policy.mode!=='ON_SUBMIT')return {requestId:head.id,reservationIds:[],status:'PROVISIONAL' as const,shortages:[]};
  if(input.warehouseId) {
    if(user.area!=='crm'||!['ADMIN','MANAGER','WAREHOUSE'].includes(user.role))throw new CrmError('FORBIDDEN',403);
    const warehouse=(await sql.query<{id:string}>(`SELECT w.id FROM cohamy_crm.warehouses w WHERE w.id=$1 AND w.active AND w.organization_id=$2
      AND ($3 OR EXISTS(SELECT 1 FROM cohamy_crm.warehouse_assignments a WHERE a.warehouse_id=w.id AND a.membership_id=$4))`,
    [input.warehouseId,order.seller_organization_id,['ADMIN','MANAGER'].includes(user.role),user.membershipId])).rows[0];
    if(!warehouse)throw new CrmError('WAREHOUSE_OUTSIDE_SELLER_SCOPE',403);
  }
  // TTL/partial fulfillment are taken from the submitted policy, never from client payloads.
  await expiredForRequest(sql,head.id);
  const existing=(await sql.query<Reservation>(`SELECT * FROM cohamy_crm.inventory_reservations WHERE request_id=$1 AND order_version_id=$2
    AND status IN('ACTIVE','PARTIAL') ORDER BY product_id,warehouse_id,location_id,lot_id,id FOR UPDATE`,[head.id,version.id])).rows;
  const wanted=new Map<string,bigint>();
  for(const line of version.snapshot.quote.calculation.lines)wanted.set(line.productId,(wanted.get(line.productId)??0n)+fixed(line.baseQuantity));
  const ids=existing.map(row=>row.id),shortages:Array<{productId:string;needed:string;allocated:string;missing:string}>=[];
  const expiresAt=new Date(new Date((await sql.query<{now:string}>('SELECT now() AS now')).rows[0].now).getTime()+policy.ttlMinutes*60000).toISOString();
  for(const [productId,total] of [...wanted].sort(([a],[b])=>a.localeCompare(b))) {
    let allocated=existing.filter(row=>row.product_id===productId).reduce((sum,row)=>sum+fixed(row.quantity)-fixed(row.consumed)-fixed(row.released),0n);
    let need=total-allocated;
    // One physical pool per legal seller. Upstream requests use their own seller's pool.
    const candidates=need>0n?(await sql.query<Balance>(`SELECT b.* FROM cohamy_crm.inventory_balances b
      JOIN cohamy_crm.warehouses w ON w.id=b.warehouse_id JOIN cohamy_crm.inventory_lots t ON t.id=b.lot_id
      JOIN cohamy_crm.warehouse_locations l ON l.id=b.location_id WHERE w.organization_id=$1 AND w.active AND b.product_id=$2
      AND ($3::uuid IS NULL OR b.warehouse_id=$3) AND t.status='AVAILABLE' AND(t.expires_on IS NULL OR t.expires_on>current_date)
      AND l.active AND l.kind='PICK' AND b.on_hand>b.reserved ORDER BY b.warehouse_id,b.location_id,b.lot_id FOR UPDATE OF b`,
    [order.seller_organization_id,productId,input.warehouseId??null])).rows:[];
    for(const balance of candidates) {
      if(need<=0n)break;
      const free=fixed(balance.on_hand)-fixed(balance.reserved),take=free<need?free:need;
      if(take<=0n)continue;
      const prior=existing.find(row=>row.product_id===productId&&row.warehouse_id===balance.warehouse_id&&row.location_id===balance.location_id&&row.lot_id===balance.lot_id);
      const id=prior?.id??randomUUID();
      await sql.query('UPDATE cohamy_crm.inventory_balances SET reserved=reserved+$1,version=version+1,updated_at=now() WHERE warehouse_id=$2 AND location_id=$3 AND product_id=$4 AND lot_id=$5',
        [fixedText(take),balance.warehouse_id,balance.location_id,productId,balance.lot_id]);
      if(prior)await sql.query('UPDATE cohamy_crm.inventory_reservations SET quantity=quantity+$1,version=version+1,updated_at=now() WHERE id=$2',[fixedText(take),id]);
      else {
        await sql.query(`INSERT INTO cohamy_crm.inventory_reservations(id,request_id,request_version_id,order_id,order_version_id,warehouse_id,location_id,product_id,lot_id,quantity,reservation_type,expires_at,status)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PROVISIONAL',$11,'ACTIVE')`,
        [id,head.id,version.request_version_id,order.id,version.id,balance.warehouse_id,balance.location_id,productId,balance.lot_id,fixedText(take),expiresAt]);
        ids.push(id);
      }
      allocated+=take;need-=take;
    }
    if(need>0n) {
      if(!policy.allowPartial)throw new CrmError('INVENTORY_INSUFFICIENT',409);
      shortages.push({productId,needed:fixedText(total),allocated:fixedText(allocated),missing:fixedText(need)});
    }
  }
  await sql.query('UPDATE cohamy_crm.sales_orders SET fulfillment_shortage=$1::jsonb WHERE id=$2',[JSON.stringify(shortages),order.id]);
  await audit(sql,user.id,'inventory.request-provisional-reserved',head.id,{orderId:order.id,reservationIds:ids,shortages,expiresAt,reason:input.reason});
  return {requestId:head.id,reservationIds:ids,status:shortages.length?'PARTIAL' as const:'PROVISIONAL' as const,shortages};
}
export async function provisionalReserveRequest(user:Principal,input:ReserveInput) {
  return (await database()).transaction(sql=>reserveSubmittedRequest(sql,user,input));
}
export async function promoteProvisionalReservations(sql:Sql,user:Principal,requestId:string,orderId:string,orderVersionId:string) {
  const head=await commercialRequestAccess(sql,user,requestId,true);
  const order=(await sql.query<SalesOrder>('SELECT * FROM cohamy_crm.sales_orders WHERE id=$1 AND request_id=$2 FOR UPDATE',[orderId,head.id])).rows[0];
  if(!order)throw new CrmError('NOT_FOUND',404);
  const version=await salesVersionAccess(sql,order,orderVersionId);
  if((version.snapshot.reservationPolicy??version.snapshot.orderPolicy.definition.provisionalReservation)?.mode==='ON_SUBMIT') {
    await reserveSubmittedRequest(sql,user,{requestId,reason:'Recheck stock before confirmation'});
  }else await expiredForRequest(sql,requestId);
  const promoted=(await sql.query<{id:string}>(`UPDATE cohamy_crm.inventory_reservations SET reservation_type='CONFIRMED',expires_at=NULL,
    version=version+1,updated_at=now() WHERE request_id=$1 AND order_id=$2 AND order_version_id=$3 AND reservation_type='PROVISIONAL'
    AND status IN('ACTIVE','PARTIAL') AND expires_at>now() RETURNING id`,[requestId,orderId,orderVersionId])).rows;
  await audit(sql,user.id,'inventory.provisional-confirmed',orderId,{reservationIds:promoted.map(row=>row.id)});
  return {promotedCount:promoted.length};
}
export async function releaseRequestReservations(sql:Sql,requestId:string) {
  const rows=(await sql.query<Reservation>(`SELECT * FROM cohamy_crm.inventory_reservations WHERE request_id=$1 AND reservation_type='PROVISIONAL'
    AND status IN('ACTIVE','PARTIAL') ORDER BY product_id,warehouse_id,location_id,lot_id,id FOR UPDATE`,[requestId])).rows;
  return releaseRows(sql,rows);
}
export async function releaseExpiredReservations(sql:Sql) {
  const requests=(await sql.query<{id:string;organization_id:string;creator_id:string;latest_version_id:string;code:string}>(`SELECT r.* FROM cohamy_crm.commercial_requests r
    WHERE EXISTS(SELECT 1 FROM cohamy_crm.inventory_reservations i WHERE i.request_id=r.id AND i.reservation_type='PROVISIONAL'
    AND i.status IN('ACTIVE','PARTIAL') AND i.expires_at<=now()) ORDER BY r.id LIMIT 100 FOR UPDATE OF r SKIP LOCKED`)).rows;
  let count=0;
  for(const request of requests) {
    const released=await expiredForRequest(sql,request.id);count+=released;
    if(released)await commercialNotification(sql,{organizationId:request.organization_id,type:'commercial-request',id:request.id,
      versionId:request.latest_version_id,action:'RESERVATION_EXPIRED',message:request.code+' đã hết hạn giữ hàng tạm. Tồn kho sẽ được kiểm tra lại khi xác nhận.',
      actorId:request.creator_id,creatorId:request.creator_id,audience:'PARTNER'});
  }
  return count;
}
export async function runReservationMaintenance() {
  return (await database()).transaction(async sql=>({released:await releaseExpiredReservations(sql)}));
}
