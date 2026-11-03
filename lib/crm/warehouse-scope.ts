import 'server-only';
import {isWarehouseRole,warehouseRoleRegion,type Principal} from './types';

/** Regional staff share their location; generic WAREHOUSE staff retain explicit assignments. */
export function warehouseScope(user:Principal,alias='w',offset=0){
  if(user.area==='crm'&&['ADMIN','MANAGER','ACCOUNTANT'].includes(user.role))return {sql:'true',params:[] as unknown[]};
  if(user.area==='portal')return {sql:`${alias}.organization_id=$${offset+1}`,params:[user.organizationId] as unknown[]};
  if(user.area==='crm'&&isWarehouseRole(user.role)){
    const region=warehouseRoleRegion(user.role);
    if(region)return {sql:`${alias}.organization_id=$${offset+1} AND ${alias}.region=$${offset+2}`,params:[user.organizationId,region] as unknown[]};
    return {sql:`EXISTS(SELECT 1 FROM cohamy_crm.warehouse_assignments wa WHERE wa.membership_id=$${offset+1} AND wa.warehouse_id=${alias}.id)`,params:[user.membershipId] as unknown[]};
  }
  return {sql:'false',params:[] as unknown[]};
}

/** Trusted SQL aliases only. Keep event recipients aligned with the read/write warehouse scope. */
export function warehouseMemberScope(member='m',warehouse='w'){
  return `${member}.organization_id=${warehouse}.organization_id AND ((${member}.role='WAREHOUSE_HN' AND ${warehouse}.region='NORTH') OR (${member}.role='WAREHOUSE_HCM' AND ${warehouse}.region='SOUTH') OR (${member}.role='WAREHOUSE' AND EXISTS(SELECT 1 FROM cohamy_crm.warehouse_assignments a WHERE a.membership_id=${member}.id AND a.warehouse_id=${warehouse}.id)))`;
}
