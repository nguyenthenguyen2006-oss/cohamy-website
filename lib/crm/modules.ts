import { can } from "./permissions";
import type { Principal } from "./types";
export type ModuleIcon = "customer" | "dealer" | "goods" | "order" | "warehouse" | "consignment" | "debt" | "cash" | "report" | "account";
export interface CrmModule { id: string; label: string; shortLabel: string; icon: ModuleIcon; tone: string; permission: string; status: "CONNECTED" | "PENDING"; bottom?: number }
const internal: CrmModule[] = [
  {id:'automation',label:'Lịch và quy tắc công việc',shortLabel:'Lịch công việc',icon:'report',tone:'primary',permission:'partners.write',status:'CONNECTED'},
  {id:'fields',label:'Trường hồ sơ tùy chỉnh',shortLabel:'Trường dữ liệu',icon:'account',tone:'primary',permission:'accounts.manage',status:'CONNECTED'},
  {id:'care',label:'Danh mục chăm sóc',shortLabel:'Chăm sóc',icon:'customer',tone:'primary',permission:'partners.read',status:'CONNECTED'},
  {id:'visits',label:'Lần thăm điểm bán',shortLabel:'Lần thăm',icon:'customer',tone:'primary',permission:'partners.read',status:'CONNECTED'},
  {id:'library',label:'Thư viện đối tác',shortLabel:'Tài liệu',icon:'report',tone:'primary',permission:'accounts.manage',status:'CONNECTED'},
  {id:'support',label:'Phiếu hỗ trợ',shortLabel:'Hỗ trợ',icon:'customer',tone:'primary',permission:'partners.read',status:'CONNECTED'},
  {id:'data',label:'Import và export',shortLabel:'Dữ liệu',icon:'report',tone:'primary',permission:'partners.write',status:'CONNECTED'},
  {id:'search',label:'Tìm kiếm',shortLabel:'Tìm kiếm',icon:'report',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
  {id:'notifications',label:'Thông báo',shortLabel:'Thông báo',icon:'report',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
  {id:'workspace',label:'Không gian cá nhân',shortLabel:'Cá nhân',icon:'account',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
  {id:'applications',label:'Xét duyệt đối tác',shortLabel:'Xét duyệt',icon:'dealer',tone:'primary',permission:'accounts.manage',status:'CONNECTED'},
  {id:'invitations',label:'Link mời đối tác',shortLabel:'Link mời',icon:'dealer',tone:'primary',permission:'accounts.manage',status:'CONNECTED'},
  {id:'audit',label:'Lịch sử thao tác',shortLabel:'Lịch sử',icon:'report',tone:'primary',permission:'accounts.manage',status:'CONNECTED'},
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
  {id:'library',label:'Thư viện đối tác',shortLabel:'Tài liệu',icon:'report',tone:'primary',permission:'catalog.read',status:'CONNECTED'},
  {id:'members',label:'Nhân viên đại lý',shortLabel:'Nhân viên',icon:'account',tone:'primary',permission:'dealer.invite',status:'CONNECTED'},
  {id:'support',label:'Phiếu hỗ trợ',shortLabel:'Hỗ trợ',icon:'customer',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
  {id:'addresses',label:'Địa chỉ giao hàng',shortLabel:'Địa chỉ',icon:'warehouse',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
  {id:'cart',label:'Giỏ hàng nháp',shortLabel:'Giỏ nháp',icon:'goods',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
  {id:'invitations',label:'Mời nhân viên',shortLabel:'Mời',icon:'dealer',tone:'primary',permission:'dealer.invite',status:'CONNECTED'},
  {id:'search',label:'Tìm kiếm',shortLabel:'Tìm kiếm',icon:'report',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
  {id:'notifications',label:'Thông báo',shortLabel:'Thông báo',icon:'report',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
  {id:'workspace',label:'Không gian cá nhân',shortLabel:'Cá nhân',icon:'account',tone:'primary',permission:'workspace.use',status:'CONNECTED'},

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
