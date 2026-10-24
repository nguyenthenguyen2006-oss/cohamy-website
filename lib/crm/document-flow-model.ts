export type FlowKind = 'REQUEST' | 'DISPATCH' | 'RECEIPT' | 'ISSUE';
export type FlowLine = {
  productId:string; sku:string; name:string; unit:string; quantity:string;
  ordered:string; shipped:string; received:string; difference:string;
  unitPrice:string; amount:string; note:string;
};
export type FlowSnapshot = {
  id:string; code:string; kind:FlowKind; revision:number; state:string;
  warehouseId:string; warehouseName:string; warehouseCode:string;
  factoryMembershipId:string|null; factoryName:string;
  sourceId:string|null; sourceCode:string; sourceRevision:number|null;
  requestId:string|null; requestCode:string;
  requestRevision?:number|null;
  salesOrderId?:string|null;
  createdAt:string; createdBy:string; confirmedAt:string|null; confirmedBy:string;
  dueDate:string; note:string; lines:FlowLine[];
  delivery:Record<string,string>; totals:Record<string,string>;
};
export type FlowRow = {id:string;code:string;workflow_state:string;workflow_version:number;flow_payload:FlowSnapshot|null;stage?:string;parent_id:string|null;warehouse_id:string;factory_membership_id:string|null;created_by:string;confirmed_at:string|null};
export const flowLabels:Record<FlowKind,string>={REQUEST:'Phiếu đề nghị sản xuất/cấp hàng',DISPATCH:'Phiếu nhà máy',RECEIPT:'Phiếu nhập kho',ISSUE:'Hóa đơn giao hàng'};
export const flowEntity=(kind:FlowKind)=>kind==='ISSUE'?'warehouse-handover':kind==='RECEIPT'?'warehouse-reconciliation':'factory-invoice';
