import 'server-only';
import {isWarehouseRole,warehouseRoleRegion,type Principal} from './types';

/** Explicit warehouse assignments take precedence over the regional default. */
export function warehouseScope(user:Principal,alias='w',offset=0){
  if(user.area==='crm'&&['ADMIN','MANAGER','ACCOUNTANT'].includes(user.role))return {sql:'true',params:[] as unknown[]};
  if(user.area==='portal'){
    return {sql:`${alias}.organization_id=$${offset+1}`,params:[user.organizationId] as unknown[]};
  }
  if(user.area==='crm'&&isWarehouseRole(user.role)){
    return {
      sql:`(EXISTS(SELECT 1 FROM cohamy_crm.warehouse_assignments wa WHERE wa.membership_id=$${offset+2} AND wa.warehouse_id=${alias}.id) OR (${alias}.organization_id=$${offset+1} AND $${offset+3}::text IS NOT NULL AND ${alias}.region=$${offset+3} AND NOT EXISTS(SELECT 1 FROM cohamy_crm.warehouse_assignments wa WHERE wa.membership_id=$${offset+2})))`,
      params:[user.organizationId,user.membershipId,warehouseRoleRegion(user.role)] as unknown[],
    };
  }
  return {sql:'false',params:[] as unknown[]};
}
