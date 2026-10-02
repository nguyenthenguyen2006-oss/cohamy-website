import { can } from "./permissions";
import type { Principal } from "./types";
export type ModuleIcon =
  | "customer"
  | "dealer"
  | "goods"
  | "order"
  | "warehouse"
  | "consignment"
  | "debt"
  | "cash"
  | "report"
  | "account"
  | "tasks"
  | "automation"
  | "notifications"
  | "search"
  | "data"
  | "library"
  | "support"
  | "applications"
  | "invitations"
  | "audit"
  | "procurement"
  | "pricing"
  | "quotations"
  | "members"
  | "cart";

export interface CrmModule { id: string; label: string; shortLabel: string; icon: ModuleIcon; tone: string; permission: string; status: "CONNECTED" | "PENDING"; bottom?: number }
const internal: CrmModule[] = [
  {id:'requests',label:'Yêu cầu mua hàng',shortLabel:'Yêu cầu',icon:'order',tone:'primary',permission:'orders.read',status:'CONNECTED'},
  {id:'sales',label:'Đơn bán đã tiếp nhận',shortLabel:'Đơn bán',icon:'order',tone:'primary',permission:'orders.read',status:'CONNECTED'},
  {id:'pricing',label:'Bảng giá và cấp đối tác',shortLabel:'Bảng giá',icon:'pricing',tone:'primary',permission:'pricing.manage',status:'CONNECTED'},
  {id:'quotations',label:'Báo giá theo phiên bản',shortLabel:'Báo giá',icon:'quotations',tone:'primary',permission:'orders.read',status:'CONNECTED'},
  {id:'automation',label:'Lịch và quy tắc công việc',shortLabel:'Lịch công việc',icon:'automation',tone:'primary',permission:'partners.write',status:'CONNECTED'},
  {id:'fields',label:'Trường hồ sơ tùy chỉnh',shortLabel:'Trường dữ liệu',icon:'account',tone:'primary',permission:'accounts.manage',status:'CONNECTED'},
  {id:'care',label:'Danh mục chăm sóc',shortLabel:'Chăm sóc',icon:'customer',tone:'primary',permission:'partners.read',status:'CONNECTED'},
  {id:'visits',label:'Lần thăm điểm bán',shortLabel:'Lần thăm',icon:'customer',tone:'primary',permission:'partners.read',status:'CONNECTED'},
  {id:'library',label:'Thư viện đối tác',shortLabel:'Tài liệu',icon:'library',tone:'primary',permission:'accounts.manage',status:'CONNECTED'},
  {id:'support',label:'Phiếu hỗ trợ',shortLabel:'Hỗ trợ',icon:'support',tone:'primary',permission:'partners.read',status:'CONNECTED'},
  {id:'articles',label:'Bài viết website',shortLabel:'Bài viết',icon:'library',tone:'primary',permission:'articles.read',status:'CONNECTED'},
  {id:'data',label:'Import và export',shortLabel:'Dữ liệu',icon:'data',tone:'primary',permission:'partners.write',status:'CONNECTED'},
  {id:'search',label:'Tìm kiếm',shortLabel:'Tìm kiếm',icon:'search',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
  {id:'notifications',label:'Thông báo',shortLabel:'Thông báo',icon:'notifications',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
  {id:'workspace',label:'Không gian cá nhân',shortLabel:'Cá nhân',icon:'account',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
  {id:'applications',label:'Xét duyệt đối tác',shortLabel:'Xét duyệt',icon:'applications',tone:'primary',permission:'accounts.manage',status:'CONNECTED'},
  {id:'invitations',label:'Link mời đối tác',shortLabel:'Link mời',icon:'invitations',tone:'primary',permission:'accounts.manage',status:'CONNECTED'},
  {id:'audit',label:'Lịch sử thao tác',shortLabel:'Lịch sử',icon:'audit',tone:'primary',permission:'accounts.manage',status:'CONNECTED'},
  { id: "customers", label: "Khách hàng", shortLabel: "Khách hàng", icon: "customer", tone: "success", permission: "partners.read", status: "CONNECTED", bottom: 1 },
  { id: "dealers", label: "Đại lý", shortLabel: "Đại lý", icon: "dealer", tone: "indigoDark", permission: "partners.read", status: "CONNECTED" },
  { id: "goods", label: "Hàng hóa", shortLabel: "Hàng hóa", icon: "goods", tone: "primary", permission: "catalog.read", status: "CONNECTED", bottom: 2 },
  { id: "orders", label: "Yêu cầu đặt hàng", shortLabel: "Đơn hàng", icon: "order", tone: "info", permission: "orders.read", status: "CONNECTED", bottom: 3 },
  { id: "tasks", label: "Việc cần làm", shortLabel: "Công việc", icon: "tasks", tone: "primary", permission: "partners.write", status: "CONNECTED" },
  { id: "inventory", label: "Danh mục kho", shortLabel: "Kho", icon: "warehouse", tone: "indigo", permission: "warehouses.read", status: "CONNECTED" },
  { id: "samples", label: "Hàng mẫu và chuyển đổi", shortLabel: "Hàng mẫu", icon: "goods", tone: "orange", permission: "samples.read", status: "CONNECTED" },
  { id: "procurement", label: "Mua hàng và nhà cung cấp", shortLabel: "Mua hàng", icon: "procurement", tone: "indigoDark", permission: "procurement.read", status: "CONNECTED" },
  { id: "consignment", label: "Ký gửi", shortLabel: "Ký gửi", icon: "consignment", tone: "warning", permission: "consignment.read", status: "CONNECTED" },
  { id: "debts", label: "Công nợ", shortLabel: "Công nợ", icon: "debt", tone: "danger", permission: "finance.read", status: "CONNECTED" },
  { id: "cash", label: "Thu chi", shortLabel: "Thu chi", icon: "cash", tone: "orange", permission: "finance.read", status: "CONNECTED" },
  { id: "reports", label: "Báo cáo tiếp nhận", shortLabel: "Báo cáo", icon: "report", tone: "emerald", permission: "reports.read", status: "CONNECTED" },
  { id: "accounts", label: "Tài khoản và quyền", shortLabel: "Tài khoản", icon: "account", tone: "secondary", permission: "accounts.manage", status: "CONNECTED" },
];
const dealer: CrmModule[] = [
  {id:'requests',label:'Đề nghị mua hàng',shortLabel:'Đề nghị',icon:'order',tone:'primary',permission:'orders.read',status:'CONNECTED'},
  {id:'quotations',label:'Báo giá của tôi',shortLabel:'Báo giá',icon:'quotations',tone:'primary',permission:'orders.read',status:'CONNECTED'},
  {id:'library',label:'Thư viện đối tác',shortLabel:'Tài liệu',icon:'library',tone:'primary',permission:'catalog.read',status:'CONNECTED'},
  {id:'members',label:'Nhân viên đại lý',shortLabel:'Nhân viên',icon:'members',tone:'primary',permission:'dealer.invite',status:'CONNECTED'},
  {id:'support',label:'Phiếu hỗ trợ',shortLabel:'Hỗ trợ',icon:'support',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
  {id:'addresses',label:'Địa chỉ giao hàng',shortLabel:'Địa chỉ',icon:'warehouse',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
  {id:'cart',label:'Giỏ hàng nháp',shortLabel:'Giỏ nháp',icon:'cart',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
  {id:'invitations',label:'Mời nhân viên',shortLabel:'Mời',icon:'invitations',tone:'primary',permission:'dealer.invite',status:'CONNECTED'},
  {id:'search',label:'Tìm kiếm',shortLabel:'Tìm kiếm',icon:'search',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
  {id:'notifications',label:'Thông báo',shortLabel:'Thông báo',icon:'notifications',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
  {id:'workspace',label:'Không gian cá nhân',shortLabel:'Cá nhân',icon:'account',tone:'primary',permission:'workspace.use',status:'CONNECTED'},

  { id: "goods", label: "Đặt hàng", shortLabel: "Đặt hàng", icon: "goods", tone: "primary", permission: "catalog.read", status: "CONNECTED", bottom: 1 },
  { id: "orders", label: "Đơn của tôi", shortLabel: "Đơn", icon: "order", tone: "info", permission: "orders.read", status: "CONNECTED", bottom: 2 },
  { id: "inventory", label: "Kho của đại lý", shortLabel: "Kho", icon: "warehouse", tone: "indigoDark", permission: "warehouses.read", status: "CONNECTED", bottom: 3 },
  { id: "consignment", label: "Báo bán ký gửi", shortLabel: "Báo bán", icon: "consignment", tone: "warning", permission: "consignment.read", status: "CONNECTED" },
  { id: "settlements", label: "Đối soát", shortLabel: "Đối soát", icon: "report", tone: "emerald", permission: "finance.read", status: "CONNECTED" },
  { id: "debts", label: "Công nợ", shortLabel: "Công nợ", icon: "debt", tone: "danger", permission: "finance.read", status: "CONNECTED" },
  { id: "payments", label: "Chứng từ thanh toán", shortLabel: "Chứng từ", icon: "cash", tone: "orange", permission: "finance.read", status: "CONNECTED" },
  { id: "profile", label: "Tài khoản", shortLabel: "Tài khoản", icon: "account", tone: "secondary", permission: "profile.read", status: "CONNECTED" },
];
export const visibleModules = (user: Principal) => (user.area === "crm" ? internal : dealer).filter(module => can(user, module.permission));

export interface CrmHub {
  id: string;
  label: string;
  description: string;
  icon: ModuleIcon;
  color: string;
  gradient: string;
  moduleIds: string[];
}

export const crmHubs: readonly CrmHub[] = [
  {
    id: "orders",
    label: "ĐƠN HÀNG",
    description: "Quản lý yêu cầu mua hàng, đơn bán tiếp nhận, đặt hàng và báo giá",
    icon: "order",
    color: "#2563eb",
    gradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    moduleIds: ["requests", "sales", "orders", "quotations", "pricing"],
  },
  {
    id: "customers",
    label: "KHÁCH HÀNG",
    description: "Thông tin khách hàng, lịch sử chăm sóc và nhật ký thăm điểm bán",
    icon: "customer",
    color: "#10b981",
    gradient: "linear-gradient(135deg, #10b981, #047857)",
    moduleIds: ["customers", "care", "visits"],
  },
  {
    id: "dealers",
    label: "ĐỐI TÁC & ĐẠI LÝ",
    description: "Mạng lưới đại lý phân phối, hồ sơ đăng ký và xét duyệt đối tác",
    icon: "dealer",
    color: "#dc2626",
    gradient: "linear-gradient(135deg, #ef4444, #b91c1c)",
    moduleIds: ["dealers", "applications", "invitations"],
  },
  {
    id: "goods",
    label: "SẢN PHẨM & KHO",
    description: "Danh mục sản phẩm, theo dõi tồn kho và luân chuyển hàng mẫu",
    icon: "warehouse",
    color: "#6366f1",
    gradient: "linear-gradient(135deg, #6366f1, #4338ca)",
    moduleIds: ["goods", "inventory", "samples"],
  },
  {
    id: "procurement",
    label: "MUA HÀNG & NCC",
    description: "Kế hoạch nhập hàng, quản lý nhà cung cấp và chứng từ nhập kho",
    icon: "procurement",
    color: "#0d9488",
    gradient: "linear-gradient(135deg, #0d9488, #115e59)",
    moduleIds: ["procurement"],
  },
  {
    id: "consignment",
    label: "KÝ GỬI & ĐỐI SOÁT",
    description: "Theo dõi hàng ký gửi, báo bán từ điểm bán và đối soát định kỳ",
    icon: "consignment",
    color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    moduleIds: ["consignment", "settlements"],
  },
  {
    id: "debts",
    label: "CÔNG NỢ & THU CHI",
    description: "Theo dõi công nợ đối tác, dòng tiền thu chi và thanh toán",
    icon: "debt",
    color: "#06b6d4",
    gradient: "linear-gradient(135deg, #06b6d4, #0e7490)",
    moduleIds: ["debts", "cash", "payments"],
  },
  {
    id: "tasks",
    label: "CÔNG VIỆC & TỰ ĐỘNG",
    description: "Việc cần làm, quy tắc tự động hóa và thông báo hệ thống",
    icon: "tasks",
    color: "#f97316",
    gradient: "linear-gradient(135deg, #f97316, #c2410c)",
    moduleIds: ["tasks", "automation", "notifications"],
  },
  {
    id: "reports",
    label: "BÁO CÁO & DỮ LIỆU",
    description: "Báo cáo vận hành kinh doanh, xuất nhập dữ liệu và tra cứu nhanh",
    icon: "report",
    color: "#f59e0b",
    gradient: "linear-gradient(135deg, #f59e0b, #b45309)",
    moduleIds: ["reports", "data", "search"],
  },
  {
    id: "library",
    label: "TÀI LIỆU & HỖ TRỢ",
    description: "Thư viện tài liệu bán hàng, quy chuẩn và phiếu hỗ trợ kỹ thuật",
    icon: "library",
    color: "#ef4444",
    gradient: "linear-gradient(135deg, #f43f5e, #be123c)",
    moduleIds: ["library", "support", "articles"],
  },
  {
    id: "accounts",
    label: "QUẢN TRỊ HỆ THỐNG",
    description: "Phân quyền người dùng, trường tùy chỉnh, nhật ký kiểm toán và bảo mật",
    icon: "account",
    color: "#64748b",
    gradient: "linear-gradient(135deg, #64748b, #334155)",
    moduleIds: ["accounts", "fields", "audit", "workspace", "profile"],
  },
];

export interface VisibleHub {
  hub: CrmHub;
  modules: CrmModule[];
}

export function getVisibleHubs(user: Principal): VisibleHub[] {
  const allowed = visibleModules(user);
  const result: VisibleHub[] = [];
  for (const hub of crmHubs) {
    const hubModules = allowed.filter(m => hub.moduleIds.includes(m.id));
    if (hubModules.length > 0) {
      result.push({ hub, modules: hubModules });
    }
  }
  return result;
}
