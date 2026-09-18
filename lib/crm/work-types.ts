export const orderStates = ['PENDING_REVIEW','IN_PROGRESS','READY','REJECTED','CANCELLED'] as const;
export type OrderState = typeof orderStates[number];
export const orderLabels: Record<OrderState,string> = {PENDING_REVIEW:'Mới nhận',IN_PROGRESS:'Đang tư vấn',READY:'Đã chốt yêu cầu',REJECTED:'Từ chối',CANCELLED:'Đã hủy'};
export const stages = {LEAD:'Tiềm năng',CONTACTED:'Đang chăm sóc',ACTIVE:'Đang hợp tác',INACTIVE:'Ngừng hợp tác'};
export type EntityType = 'partner'|'order';
export interface OrderRecord {
 id:string; code:string; contact:{fullName:string;phone:string;email:string;address:string;city:string;district:string;ward:string;note:string};
 lines:{websiteId:string;name:string;quantity:number;unitPrice:string;lineTotal:string}[];
 subtotal:string; status:OrderState; paid:boolean; payment_requested:string; created_at:string; updated_at:string;
 assigned_to:string|null; assignee_name:string|null; organization_id:string|null; organization_name:string|null; version:number; resolution_note:string;
}
export interface StaffOption {id:string;userId:string;name:string;role:string;organization_id:string}
export interface TaskRecord {id:string;entity_type:EntityType;entity_id:string;entity_label:string;title:string;assignee_id:string;assignee_name:string;due_at:string;done_at:string|null;version:number}
export interface ActivityRecord {id:string;body:string;actor_name:string;created_at:string}
