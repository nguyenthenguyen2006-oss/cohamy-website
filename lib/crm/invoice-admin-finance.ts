import 'server-only';
import {randomUUID} from 'node:crypto';
import type {Sql} from './db';
import type {Principal} from './types';
import {CrmError} from './permissions';
import {commercialDigest} from './commercial-common';

// Collected money remains a real payment. Cancelling a sale unallocates that
// money; it never fabricates a cash refund or deletes an allocation/history row.
export async function reviseInvoiceReceivables(sql:Sql,user:Principal,orderId:string,total:string|null,reason:string){
 const rows=(await sql.query<{id:string;organization_id:string;original_amount:string;remaining_amount:string;status:string;version:number}>("SELECT id,organization_id,original_amount::text,remaining_amount::text,status,version FROM cohamy_crm.receivables WHERE (order_id=$1::uuid OR(source_type IN('ORDER','sales-order') AND source_id=$1::uuid::text)) AND status<>'VOID' ORDER BY id FOR UPDATE",[orderId])).rows;
 if(rows.length>1&&total!==null)throw new CrmError('INVOICE_MULTIPLE_RECEIVABLES_REVIEW_REQUIRED',409);
 const changed:unknown[]=[];
 for(const row of rows){
  const allocations=(await sql.query<{id:string;payment_id:string;amount:string}>("SELECT a.id,a.payment_id,a.amount::text FROM cohamy_crm.payment_allocations a WHERE a.receivable_id=$1 AND NOT EXISTS(SELECT 1 FROM cohamy_crm.invoice_allocation_reversals r WHERE r.allocation_id=a.id) ORDER BY a.payment_id,a.created_at,a.id",[row.id])).rows;
  for(const paymentId of [...new Set(allocations.map(a=>a.payment_id))].sort())await sql.query('SELECT id FROM cohamy_crm.payment_receipts WHERE id=$1 FOR UPDATE',[paymentId]);
  let paid=allocations.reduce((n,a)=>n+BigInt(a.amount),0n);const next=total===null?0n:BigInt(total);
  if(total===null||paid>next){
   const repay=next;let kept=0n;
   for(const allocation of allocations){
    await sql.query('INSERT INTO cohamy_crm.invoice_allocation_reversals(id,allocation_id,actor_id,reason) VALUES($1,$2,$3,$4)',[randomUUID(),allocation.id,user.id,reason]);
    const amount=BigInt(allocation.amount);await sql.query('UPDATE cohamy_crm.payment_receipts SET allocated_amount=allocated_amount-$1,version=version+1,updated_at=now() WHERE id=$2',[allocation.amount,allocation.payment_id]);
    const apply=repay-kept<amount?repay-kept:amount;
    if(apply>0n){await sql.query('INSERT INTO cohamy_crm.payment_allocations(id,payment_id,receivable_id,amount,actor_id,reason,idempotency_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),allocation.payment_id,row.id,apply.toString(),user.id,reason,randomUUID(),commercialDigest({orderId,total,allocation:allocation.id})]);await sql.query('UPDATE cohamy_crm.payment_receipts SET allocated_amount=allocated_amount+$1,version=version+1,updated_at=now() WHERE id=$2',[apply.toString(),allocation.payment_id]);kept+=apply;}
   }
   paid=kept;
  }
  const remaining=next>paid?next-paid:0n,status=total===null||next===0n?'VOID':remaining===0n?'PAID':paid>0n?'PARTIAL':'OPEN',delta=remaining-BigInt(row.remaining_amount);
  const account=(await sql.query<{used_amount:string;limit_amount:string;version:number}>('SELECT used_amount::text,limit_amount::text,version FROM cohamy_crm.credit_accounts WHERE organization_id=$1 FOR UPDATE',[row.organization_id])).rows[0];
  if(account){const used=BigInt(account.used_amount)+delta;if(used<0n)throw new CrmError('CREDIT_BALANCE_INVALID',409);await sql.query('UPDATE cohamy_crm.credit_accounts SET used_amount=$1,version=version+1,updated_at=now() WHERE organization_id=$2',[used.toString(),row.organization_id]);await sql.query("INSERT INTO cohamy_crm.credit_events(id,organization_id,order_id,action,amount,account_snapshot,actor_id,reason,idempotency_key,request_hash,result) VALUES($1,$2,$3,'ADJUSTED',$4,$5::jsonb,$6,$7,$8,$9,$10::jsonb)",[randomUUID(),row.organization_id,orderId,delta.toString(),JSON.stringify({...account,used_amount:used.toString(),version:account.version+1}),user.id,reason,randomUUID(),commercialDigest({orderId,total}),JSON.stringify({invoiceCorrection:true,receivableId:row.id})]);}
  await sql.query('UPDATE cohamy_crm.receivables SET original_amount=$1,remaining_amount=$2,status=$3,version=version+1,updated_at=now() WHERE id=$4',[next===0n?row.original_amount:next.toString(),remaining.toString(),status,row.id]);
  const result={id:row.id,status,remainingAmount:remaining.toString(),unallocatedMoney:(allocations.reduce((n,a)=>n+BigInt(a.amount),0n)-paid).toString()};
  await sql.query("INSERT INTO cohamy_crm.receivable_events(id,receivable_id,action,amount,payload,actor_id,reason,idempotency_key,request_hash,result) VALUES($1,$2,'ADMIN_INVOICE_CORRECTION',$3,$4::jsonb,$5,$6,$7,$8,$9::jsonb)",[randomUUID(),row.id,delta.toString(),JSON.stringify({before:row,after:result}),user.id,reason,randomUUID(),commercialDigest({orderId,total}),JSON.stringify(result)]);changed.push(result);
 }
 const hold=(await sql.query<{id:string;organization_id:string;amount:string;status:string}>("SELECT id,organization_id,amount::text,status FROM cohamy_crm.credit_holds WHERE order_id=$1 FOR UPDATE",[orderId])).rows[0];
 if(hold?.status==='ACTIVE'){
  const next=total===null?0n:BigInt(total),delta=next-BigInt(hold.amount),account=(await sql.query<{used_amount:string}>('SELECT used_amount::text FROM cohamy_crm.credit_accounts WHERE organization_id=$1 FOR UPDATE',[hold.organization_id])).rows[0];if(account){const used=BigInt(account.used_amount)+delta;if(used<0n)throw new CrmError('CREDIT_BALANCE_INVALID',409);await sql.query('UPDATE cohamy_crm.credit_accounts SET used_amount=$1,version=version+1,updated_at=now() WHERE organization_id=$2',[used.toString(),hold.organization_id]);}
 }
 if(hold)await sql.query('UPDATE cohamy_crm.credit_holds SET amount=$1,status=$2,updated_at=now() WHERE id=$3',[total&&BigInt(total)>0n?total:hold.amount,total===null||total==='0'?'RELEASED':hold.status,hold.id]);
 return changed;
}
