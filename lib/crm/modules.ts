import { can } from "./permissions";
import type { Principal } from "./types";
export type ModuleIcon = "customer" | "dealer" | "goods" | "order" | "warehouse" | "consignment" | "debt" | "cash" | "report" | "account";
export interface CrmModule { id: string; label: string; shortLabel: string; icon: ModuleIcon; tone: string; permission: string; status: "CONNECTED" | "PENDING"; bottom?: number }
const internal: CrmModule[] = [
  { id: "customers", label: "Khách hàng", shortLabel: "Khách hàng", icon: "customer", tone: "success", permission: "partners.read", status: "CONNECTED", bottom: 1 },
  { id: "dealers", label: "Đại lý", shortLabel: "Đại lý", icon: "dealer", tone: "indigoDark", permission: "partners.read", status: "CONNECTED" },
  { id: "goods", label: "Hàng hóa", shortLabel: "Hàng hóa", icon: "goods", tone: "primary", permission: "catalog.read", status: "CONNECTED", bottom: 2 },
  { id: "orders", label: "Yêu cầu đặt hàng", shortLabel: "Đơn hàng", icon: "order", tone: "info", permission: "orders.read", status: "CONNECTED", bottom: 3 },
  { id: "tasks", label: "Việc cần làm", shortLabel: "Công việc", icon: "report", tone: "primary", permission: "partners.write", status: "CONNECTED" },
  { id: "inventory", label: "Danh mục kho", shortLabel: "Kho", icon: "warehouse", tone: "indigo", permission: "warehouses.read", status: "CONNECTED" },
  { id: "consignment", label: "Ký gửi", shortLabel: "Ký gửi", icon: "consignment", tone: "warning", permission: "consignment.read", status: "PENDING" },
  { id: "debts", label: "Công nợ", shortLabel: "Công nợ", icon: "debt", tone: "danger", permission: "finance.read", status: "PENDING" },
  { id: "cash", label: "Thu chi", shortLabel: "Thu chi", icon: "cash", tone: "orange", permission: "finance.read", status: "PENDING" },
  { id: "reports", label: "Báo cáo tiếp nhận", shortLabel: "Báo cáo", icon: "report", tone: "emerald", permission: "reports.read", status: "CONNECTED" },
  { id: "accounts", label: "Tài khoản và quyền", shortLabel: "Tài khoản", icon: "account", tone: "secondary", permission: "accounts.manage", status: "CONNECTED" },
];
const dealer: CrmModule[] = [
  { id: "goods", label: "Đặt hàng", shortLabel: "Đặt hàng", icon: "goods", tone: "primary", permission: "catalog.read", status: "PENDING", bottom: 1 },
  { id: "orders", label: "Đơn của tôi", shortLabel: "Đơn", icon: "order", tone: "info", permission: "orders.read", status: "PENDING", bottom: 2 },
  { id: "inventory", label: "Kho của đại lý", shortLabel: "Kho", icon: "warehouse", tone: "indigoDark", permission: "warehouses.read", status: "CONNECTED", bottom: 3 },
  { id: "consignment", label: "Báo bán ký gửi", shortLabel: "Báo bán", icon: "consignment", tone: "warning", permission: "consignment.read", status: "PENDING" },
  { id: "settlements", label: "Đối soát", shortLabel: "Đối soát", icon: "report", tone: "emerald", permission: "finance.read", status: "PENDING" },
  { id: "debts", label: "Công nợ", shortLabel: "Công nợ", icon: "debt", tone: "danger", permission: "finance.read", status: "PENDING" },
  { id: "payments", label: "Chứng từ thanh toán", shortLabel: "Chứng từ", icon: "cash", tone: "orange", permission: "finance.read", status: "PENDING" },
  { id: "profile", label: "Tài khoản", shortLabel: "Tài khoản", icon: "account", tone: "secondary", permission: "profile.read", status: "CONNECTED" },
];
export const visibleModules = (user: Principal) => (user.area === "crm" ? internal : dealer).filter(module => can(user, module.permission));
