export type BuyerRole='CUSTOMER'|'SUPERMARKET';
export type BuyerLine={
 productId:string;sku:string;name:string;image:string;unit:'PACK'|'CASE';unitLabel:string;
 quantity:number;unitsPerCase:number;baseQuantity:number;
 unitPrice:string|null;vatRate:number|null;net:string|null;vat:string|null;total:string|null;
};
export type BuyerDelivery={recipient:string;phone:string;address:string;branchName?:string};
export type BuyerOrder={
 id:string;code:string;organization_id:string;organization_name:string;buyer_role:BuyerRole;creator_id:string;
 warehouse_id:string;warehouse_name:string;branch_id:string|null;delivery:BuyerDelivery;lines:BuyerLine[];note:string;
 status:'WAITING_QUOTE'|'QUOTED'|'CONFIRMED'|'CANCELLED';quote_expires_on:string|null;
 contract_snapshot:BuyerContract|null;request_id:string|null;clearance_id:string|null;version:number;
 created_at:string;updated_at:string;
 delivery_status?:string;
 quote_fee_amount?:string;
};
export type BuyerBranch={id:string;organization_id:string;code:string;name:string;address:string;recipient:string;phone:string;active:boolean;version:number};
export type ContractLine={productId:string;unitPrice:string;vatRate:number};
export type BuyerContract={id:string;organization_id:string;code:string;starts_on:string;ends_on:string;lines:ContractLine[];note:string;active:boolean;version:number};
export const buyerStatusLabels:Record<BuyerOrder['status'],string>={WAITING_QUOTE:'Chờ Sales báo giá',QUOTED:'Chờ xác nhận báo giá',CONFIRMED:'Đã chuyển kho xử lý',CANCELLED:'Đã hủy'};
export const buyerMoney=(v:string|null|undefined)=>v===null||v===undefined?'Chờ báo giá':new Intl.NumberFormat('vi-VN').format(BigInt(v))+' đ';
