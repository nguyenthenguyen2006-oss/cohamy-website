import type { Area, Principal, Role } from "./types";

const permissions: Record<Role, readonly string[]> = {
  ADMIN: ["*"],
  MANAGER: ["partners.read", "partners.write", "catalog.read", "warehouses.read", "warehouses.write", "orders.read", "consignment.read", "finance.read", "reports.read"],
  SALES: ["partners.read", "partners.write", "catalog.read", "orders.read"],
  WAREHOUSE: ["catalog.read", "warehouses.read", "orders.read"],
  ACCOUNTANT: ["partners.read", "orders.read", "consignment.read", "finance.read", "reports.read"],
  DEALER_OWNER: ["partners.read", "catalog.read", "warehouses.read", "orders.read", "consignment.read", "finance.read", "profile.read"],
  DEALER_STAFF: ["catalog.read", "warehouses.read", "orders.read", "consignment.read", "profile.read"],
};
export function can(user: Principal, permission: string): boolean {
  if(permission==="workspace.use")return true;
  if(permission==="dealer.invite")return user.area==="portal"&&user.role==="DEALER_OWNER";
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
