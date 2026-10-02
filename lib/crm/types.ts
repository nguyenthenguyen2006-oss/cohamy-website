export const roles = ["ADMIN", "MANAGER", "SALES", "WAREHOUSE", "ACCOUNTANT", "DEALER_OWNER", "DEALER_STAFF"] as const;
export type Role = typeof roles[number];
export type Area = "crm" | "portal";
export type OrganizationKind = "COHAMY" | "DEALER" | "CUSTOMER" | "SUPPLIER";
export interface Principal {
  id: string;
  membershipId: string;
  membershipVersion: number;
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
  merged_into_id?: string|null; business_id?: string; source?: string; segment?: string; contact_name?: string; stage?: string;
  partner_type?: string; pricing_tier_id?: string|null; credit_enabled?: boolean;
}
export interface CatalogProduct {
  id: string; website_id: string; sku: string; name: string; category: string;
  weight_label: string; retail_price: string; mapping_status: string; translations: Record<string, unknown>;
  stock_unit: string; units_per_case: number|null; active: boolean; version: number;
}
export interface Warehouse {
  id: string; code: string; name: string; organization_id: string; organization_name: string; active: boolean;
}

export interface Deal {
  id: string;
  code: string;
  title: string;
  customer_id: string;
  seller_organization_id: string;
  management_owner_id: string | null;
  management_team_id: string | null;
  status: 'OPEN' | 'WON' | 'LOST' | 'CLOSED';
  notes: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ManagementRelation {
  id: string;
  parent_entity_id: string;
  child_entity_id: string;
  entity_type: 'ORGANIZATION' | 'USER' | 'TEAM';
  status: 'ACTIVE' | 'INACTIVE';
  starts_at: string;
  ends_at: string | null;
  created_by: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export type PricingCombinationMode = 'SEQUENTIAL_STACK' | 'EXCLUSIVE' | 'BEST_BENEFIT';
export type ExclusivePriority = 'ACCOUNT_DISCOUNT' | 'PRODUCT_PROMOTION';

export interface PaymentReceipt {
  id: string;
  code: string;
  organization_id: string;
  payer_organization_id: string | null;
  payee_organization_id: string | null;
  amount: string;
  allocated_amount: string;
  kind: 'PAYMENT' | 'DEPOSIT';
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'REVERSED';
  paid_at: string;
  reference: string;
  method: string;
  notes: string;
  actor_id: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  deal_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}
