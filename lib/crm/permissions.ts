import { isWarehouseRole, warehouseRoleRegion, type Area, type Principal, type Role } from "./types";
export { isWarehouseRole, warehouseRoleRegion };

const permissions: Record<Role, readonly string[]> = {
  ADMIN: ["*"],
  MANAGER: ["partners.read", "partners.write", "catalog.read", "warehouses.read", "warehouses.write", "orders.read", "consignment.read", "finance.read", "procurement.read", "reports.read"],
  SALES: ["partners.read", "partners.write", "catalog.read", "orders.read", "procurement.read", "reports.read"],
  WAREHOUSE: ["catalog.read", "warehouses.read", "orders.read", "consignment.read", "procurement.read", "reports.read"],
  WAREHOUSE_HCM: ["catalog.read", "warehouses.read", "orders.read", "consignment.read", "procurement.read", "reports.read"],
  WAREHOUSE_HN: ["catalog.read", "warehouses.read", "orders.read", "consignment.read", "procurement.read", "reports.read"],
  ACCOUNTANT: ["partners.read", "catalog.read", "warehouses.read", "orders.read", "consignment.read", "finance.read", "procurement.read", "reports.read"],
  DEALER_OWNER: ["partners.read", "catalog.read", "warehouses.read", "orders.read", "consignment.read", "finance.read", "profile.read"],
  DEALER_STAFF: ["catalog.read", "warehouses.read", "orders.read", "consignment.read", "profile.read"],
};
export function can(user: Principal, permission: string): boolean {
  if(permission==='internal-documents.manage')return user.area==='crm'&&user.role==='ADMIN';
  if(permission==='internal-documents.read')return user.area==='crm'&&(user.role==='ACCOUNTANT'||isWarehouseRole(user.role));
  if(permission==='internal-documents.access')return user.area==='crm'&&(user.role==='ADMIN'||user.role==='ACCOUNTANT'||isWarehouseRole(user.role));
  if(permission==="pricing.manage")return user.area==="crm"&&["ADMIN","MANAGER"].includes(user.role);
  if(permission==="articles.read"||permission==="articles.write")return user.area==="crm"&&["ADMIN","MANAGER"].includes(user.role);
  if(permission==="workspace.use")return true;
  if(permission==="dealer.invite")return user.area==="portal"&&user.role==="DEALER_OWNER";
  if(permission==="deals.read")return permissions[user.role]?.some(v => v === "*" || v === "orders.read") ?? false;
  if(permission==="deals.write")return ["ADMIN","MANAGER","SALES","DEALER_OWNER"].includes(user.role);
  if(permission==="distribution.network.manage")return user.role==="ADMIN"||(user.area==="portal"&&user.role==="DEALER_OWNER");
  if(permission==="discount.ceiling.manage")return user.area==="crm"&&["ADMIN","MANAGER"].includes(user.role);
  // Meeting 12/10: network (shareholders, levels, promotions, transfers), period reports, KPI programs.
  if(permission==="channel.manage"||permission==="incentives.manage")return user.area==="crm"&&["ADMIN","MANAGER"].includes(user.role);
  if(permission==="channel.network")return user.area==="portal"&&user.role==="DEALER_OWNER";
  if(permission==="reports.period")return user.area==="crm"?["ADMIN","MANAGER","ACCOUNTANT","SALES"].includes(user.role):user.role==="DEALER_OWNER";
  return permissions[user.role]?.some(value => value === "*" || value === permission) ?? false;
}
export function assertPermission(user: Principal, permission: string) {
  if (!can(user, permission)) throw new CrmError("FORBIDDEN", 403);
}
export function assertArea(user: Principal, area: Area) {
  if (user.area !== area) throw new CrmError("FORBIDDEN", 403);
}
export function allPartners(user: Principal) {
  return ["ADMIN", "MANAGER", "ACCOUNTANT"].includes(user.role) && user.area === "crm";
}
export class CrmError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}
