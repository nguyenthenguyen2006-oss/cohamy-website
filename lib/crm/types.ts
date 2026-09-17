export const roles = ["ADMIN", "MANAGER", "SALES", "WAREHOUSE", "ACCOUNTANT", "DEALER_OWNER", "DEALER_STAFF"] as const;
export type Role = typeof roles[number];
export type Area = "crm" | "portal";
export type OrganizationKind = "COHAMY" | "DEALER" | "CUSTOMER" | "SUPPLIER";
export interface Principal {
  id: string;
  membershipId: string;
  displayName: string;
  email: string;
  role: Role;
  organizationId: string;
  organizationName: string;
  area: Area;
}
export const roleLabels: Record<Role, string> = {
  ADMIN: "Quản trị hệ thống", MANAGER: "Quản lý", SALES: "Sales", WAREHOUSE: "Thủ kho",
  ACCOUNTANT: "Kế toán", DEALER_OWNER: "Chủ đại lý", DEALER_STAFF: "Nhân viên đại lý",
};
export interface Organization {
  id: string; code: string; name: string; kind: OrganizationKind; phone: string;
  email: string; address: string; active: boolean; version: number; created_at: string;
  source?: string; segment?: string; contact_name?: string; stage?: string;
}
export interface CatalogProduct {
  id: string; website_id: string; sku: string; name: string; category: string;
  weight_label: string; retail_price: string; mapping_status: string; translations: Record<string, unknown>;
  stock_unit: string; units_per_case: number|null; active: boolean; version: number;
}
export interface Warehouse {
  id: string; code: string; name: string; organization_id: string; organization_name: string; active: boolean;
}
