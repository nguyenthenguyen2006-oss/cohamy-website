import { can, isWarehouseRole } from "./permissions";
import { isRemovedCrmModule } from "./module-availability";
import type { Principal } from "./types";
import {isBuyerRole} from "./types";
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
  | "members";

export interface CrmModule { id: string; label: string; shortLabel: string; icon: ModuleIcon; tone: string; permission: string; status: "CONNECTED" | "PENDING"; bottom?: number }
const internalDocumentsModule: CrmModule = { id: 'internal-documents', label: 'Tài liệu nội bộ', shortLabel: 'Tài liệu', icon: 'library', tone: 'primary', permission: 'internal-documents.access', status: 'CONNECTED' };
const historicalOrdersModule: CrmModule = { id: 'historical-orders', label: 'Đơn hàng cũ', shortLabel: 'Đơn cũ', icon: 'order', tone: 'primary', permission: 'historical-orders.read', status: 'CONNECTED' };
const buyerOrdersModule:CrmModule={id:'buyer-orders',label:'Đơn khách hàng / siêu thị',shortLabel:'Đơn khách / siêu thị',icon:'order',tone:'primary',permission:'buyer.review',status:'CONNECTED'};
const internal: CrmModule[] = [
  buyerOrdersModule,
  {id:'mcp',label:'Kết nối ChatGPT / MCP',shortLabel:'ChatGPT / MCP',icon:'account',tone:'primary',permission:'document-flow.admin',status:'CONNECTED'},
  historicalOrdersModule,
  internalDocumentsModule,
  {id:'factory-requests',label:'Phiếu đề nghị sản xuất/cấp hàng',shortLabel:'Đề nghị nhà máy',icon:'procurement',tone:'primary',permission:'document-flow.admin',status:'CONNECTED'},
  {id:'document-notifications',label:'Cài đặt → Thông báo hóa đơn & chứng từ',shortLabel:'Thông báo chứng từ',icon:'notifications',tone:'primary',permission:'document-flow.admin',status:'CONNECTED'},
  {id:'requests',label:'Yêu cầu mua hàng',shortLabel:'Yêu cầu',icon:'order',tone:'primary',permission:'orders.read',status:'CONNECTED'},
  {id:'sales',label:'Đơn bán đã tiếp nhận',shortLabel:'Đơn bán',icon:'order',tone:'primary',permission:'orders.read',status:'CONNECTED'},
  {id:'pricing',label:'Bảng giá và cấp đối tác',shortLabel:'Bảng giá',icon:'pricing',tone:'primary',permission:'pricing.manage',status:'CONNECTED'},
  {id:'quotations',label:'Báo giá theo phiên bản',shortLabel:'Báo giá',icon:'quotations',tone:'primary',permission:'orders.read',status:'CONNECTED'},
  {id:'fields',label:'Trường hồ sơ tùy chỉnh',shortLabel:'Trường dữ liệu',icon:'account',tone:'primary',permission:'accounts.manage',status:'CONNECTED'},
  {id:'care',label:'Danh mục chăm sóc',shortLabel:'Chăm sóc',icon:'customer',tone:'primary',permission:'partners.read',status:'CONNECTED'},
  {id:'visits',label:'Lần thăm điểm bán',shortLabel:'Lần thăm',icon:'customer',tone:'primary',permission:'partners.read',status:'CONNECTED'},
  {id:'data',label:'Import và export',shortLabel:'Dữ liệu',icon:'data',tone:'primary',permission:'partners.write',status:'CONNECTED'},
  {id:'search',label:'Tìm kiếm',shortLabel:'Tìm kiếm',icon:'search',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
  {id:'notifications',label:'Thông báo',shortLabel:'Thông báo',icon:'notifications',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
  {id:'workspace',label:'Không gian cá nhân',shortLabel:'Cá nhân',icon:'account',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
  {id:'applications',label:'Xét duyệt đối tác',shortLabel:'Xét duyệt',icon:'applications',tone:'primary',permission:'accounts.manage',status:'CONNECTED'},
  {id:'audit',label:'Lịch sử thao tác',shortLabel:'Lịch sử',icon:'audit',tone:'primary',permission:'accounts.manage',status:'CONNECTED'},
  {id:'period-sales',label:'Doanh số tháng / quý / năm',shortLabel:'Doanh số kỳ',icon:'report',tone:'emerald',permission:'reports.period',status:'CONNECTED'},
  {id:'kpi',label:'Chương trình KPI & thưởng',shortLabel:'KPI',icon:'report',tone:'orange',permission:'incentives.manage',status:'CONNECTED'},
  { id: "customers", label: "Khách hàng", shortLabel: "Khách hàng", icon: "customer", tone: "success", permission: "partners.read", status: "CONNECTED", bottom: 1 },
  { id: "dealers", label: "Đại lý", shortLabel: "Đại lý", icon: "dealer", tone: "indigoDark", permission: "partners.read", status: "CONNECTED" },
  { id: "goods", label: "Hàng hóa", shortLabel: "Hàng hóa", icon: "goods", tone: "primary", permission: "catalog.read", status: "CONNECTED", bottom: 2 },
  { id: "orders", label: "Yêu cầu đặt hàng", shortLabel: "Đơn hàng", icon: "order", tone: "info", permission: "orders.read", status: "CONNECTED", bottom: 3 },
  { id: "tasks", label: "Việc cần làm", shortLabel: "Công việc", icon: "tasks", tone: "primary", permission: "partners.write", status: "CONNECTED" },
  { id: "inventory", label: "Danh mục kho", shortLabel: "Kho", icon: "warehouse", tone: "indigo", permission: "warehouses.read", status: "CONNECTED" },
  { id: "debts", label: "Công nợ", shortLabel: "Công nợ", icon: "debt", tone: "danger", permission: "finance.read", status: "CONNECTED" },
  { id: "cash", label: "Thu chi", shortLabel: "Thu chi", icon: "cash", tone: "orange", permission: "finance.read", status: "CONNECTED" },
  { id: "reports", label: "Báo cáo tiếp nhận", shortLabel: "Báo cáo", icon: "report", tone: "emerald", permission: "reports.read", status: "CONNECTED" },
  { id: "accounts", label: "Tài khoản và quyền", shortLabel: "Tài khoản", icon: "account", tone: "secondary", permission: "accounts.manage", status: "CONNECTED" },
  { id: "accounting-factory", label: "1. NHÀ MÁY → KHO", shortLabel: "Nhà máy → Kho", icon: "procurement", tone: "indigo", permission: "warehouses.read", status: "CONNECTED" },
  { id: "accounting-orders", label: "2. KHO → KHÁCH HÀNG", shortLabel: "Kho → Khách", icon: "order", tone: "primary", permission: "orders.read", status: "CONNECTED" },
  { id: "accounting-vat", label: "3. HÓA ĐƠN VAT", shortLabel: "Hóa đơn VAT", icon: "debt", tone: "orange", permission: "finance.read", status: "CONNECTED" },
  { id: "accounting-warehouses", label: "Tồn kho HN-HCM & Công nợ NM", shortLabel: "Tồn HN-HCM & Nợ NM", icon: "warehouse", tone: "orange", permission: "warehouses.read", status: "CONNECTED" },
];
const accountantModules: CrmModule[] = [
  buyerOrdersModule,
  historicalOrdersModule,
  internalDocumentsModule,
  { id: "accounting-factory", label: "1. NHÀ MÁY → KHO", shortLabel: "Nhà máy → Kho", icon: "procurement", tone: "indigo", permission: "warehouses.read", status: "CONNECTED", bottom: 1 },
  { id: "accounting-orders", label: "2. KHO → KHÁCH HÀNG", shortLabel: "Kho → Khách", icon: "order", tone: "primary", permission: "orders.read", status: "CONNECTED", bottom: 2 },
  { id: "accounting-vat", label: "3. HÓA ĐƠN VAT", shortLabel: "Hóa đơn VAT", icon: "debt", tone: "orange", permission: "finance.read", status: "CONNECTED", bottom: 3 },
];
const factoryModules: CrmModule[] = [
  { id: "accounting-factory", label: "Phiếu đề nghị & chuyển hàng nhà máy", shortLabel: "Phiếu xuất NM", icon: "procurement", tone: "indigo", permission: "warehouses.read", status: "CONNECTED", bottom: 1 },
  { id: "notifications", label: "2. Thông báo Kho tiếp nhận", shortLabel: "Thông báo", icon: "notifications", tone: "primary", permission: "workspace.use", status: "CONNECTED", bottom: 2 },
];
const warehouseKeeperModules: CrmModule[] = [
  buyerOrdersModule,
  historicalOrdersModule,
  internalDocumentsModule,
  { id: "warehouse-stock", label: "1. Kiểm tra Số lượng Hàng trong Kho", shortLabel: "Tồn kho", icon: "warehouse", tone: "indigo", permission: "warehouses.read", status: "CONNECTED", bottom: 1 },
  { id: "warehouse-orders", label: "2. Đơn hàng & Xuất kho Khách hàng", shortLabel: "Đơn & Xuất kho", icon: "order", tone: "primary", permission: "orders.read", status: "CONNECTED", bottom: 2 },
  { id: "warehouse-factory", label: "3. Nhận hàng Nhà máy & Phiếu nhập kho", shortLabel: "Nhập từ NM", icon: "procurement", tone: "orange", permission: "warehouses.read", status: "CONNECTED", bottom: 3 },
  { id: "warehouse-handover", label: "4. Phiếu xuất kho (Có giá trị tiền)", shortLabel: "Phiếu xuất kho", icon: "consignment", tone: "emerald", permission: "warehouses.read", status: "CONNECTED" },
  { id: "warehouse-notifications", label: "5. Thông báo Kho", shortLabel: "Thông báo", icon: "notifications", tone: "primary", permission: "workspace.use", status: "CONNECTED" },
];
const dealer: CrmModule[] = [
  {id:'requests',label:'Đề nghị mua hàng',shortLabel:'Đề nghị',icon:'order',tone:'primary',permission:'orders.read',status:'CONNECTED'},
  {id:'quotations',label:'Báo giá của tôi',shortLabel:'Báo giá',icon:'quotations',tone:'primary',permission:'orders.read',status:'CONNECTED'},
  {id:'network',label:'Mạng lưới của tôi',shortLabel:'Mạng lưới',icon:'dealer',tone:'primary',permission:'channel.network',status:'CONNECTED'},
  {id:'period-sales',label:'Doanh số tháng / quý / năm',shortLabel:'Doanh số',icon:'report',tone:'emerald',permission:'reports.period',status:'CONNECTED'},
  {id:'library',label:'Thư viện đối tác',shortLabel:'Tài liệu',icon:'library',tone:'primary',permission:'catalog.read',status:'CONNECTED'},
  {id:'members',label:'Nhân viên đại lý',shortLabel:'Nhân viên',icon:'members',tone:'primary',permission:'dealer.invite',status:'CONNECTED'},
  {id:'support',label:'Phiếu hỗ trợ',shortLabel:'Hỗ trợ',icon:'support',tone:'primary',permission:'workspace.use',status:'CONNECTED'},
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
const buyerModules:CrmModule[]=[
 {id:'goods',label:'Sản phẩm & đặt hàng',shortLabel:'Đặt hàng',icon:'goods',tone:'primary',permission:'buyer.access',status:'CONNECTED',bottom:1},
 {id:'orders',label:'Đơn hàng & hóa đơn của tôi',shortLabel:'Đơn hàng',icon:'order',tone:'primary',permission:'buyer.access',status:'CONNECTED',bottom:2},
 {id:'contracts',label:'Bảng giá hợp đồng B2B',shortLabel:'Giá B2B',icon:'pricing',tone:'primary',permission:'buyer.supermarket',status:'CONNECTED'},
 {id:'branches',label:'Chi nhánh nhận hàng',shortLabel:'Chi nhánh',icon:'dealer',tone:'primary',permission:'buyer.supermarket',status:'CONNECTED'},
 {id:'purchases',label:'Mua hàng & đối soát tháng',shortLabel:'Đối soát',icon:'report',tone:'primary',permission:'buyer.supermarket',status:'CONNECTED',bottom:3},
 {id:'profile',label:'Tài khoản & bảo mật',shortLabel:'Tài khoản',icon:'account',tone:'primary',permission:'profile.read',status:'CONNECTED'},
];
export const visibleModules = (user: Principal) => {
  const modules = user.area !== "crm" ? isBuyerRole(user.role)?buyerModules:dealer
    : user.role === "ACCOUNTANT" ? accountantModules
    : user.role === "FACTORY" ? factoryModules
    : isWarehouseRole(user.role) ? warehouseKeeperModules : internal;
  return modules.filter(module => !isRemovedCrmModule(user.area, module.id) && can(user, module.permission));
};

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
  { id:'historical-orders', label:'ĐƠN HÀNG CŨ', description:'Hóa đơn trước khi dùng CRM, giữ nguyên số liệu và ảnh nguồn', icon:'order', color:'#b9420c', gradient:'linear-gradient(135deg, #ea580c, #b9420c)', moduleIds:['historical-orders'] },
  {
    id: 'internal-documents',
    label: 'TÀI LIỆU NỘI BỘ',
    description: 'Tài liệu do admin đăng dành cho kế toán và thủ kho',
    icon: 'library',
    color: '#b9420c',
    gradient: 'linear-gradient(135deg, #ea580c, #b9420c)',
    moduleIds: ['internal-documents'],
  },
  {
    id: "warehouse-keeper",
    label: "VẬN HÀNH KHO KHU VỰC (HCM / HN)",
    description: "Kiểm tra số lượng tồn kho, đăng ký & kiểm tra HĐ đặt hàng, thông báo HĐ xuất Nhà máy, đối chiếu Nhà máy và bàn giao sản phẩm",
    icon: "warehouse",
    color: "#2563eb",
    gradient: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    moduleIds: ["warehouse-stock", "warehouse-orders", "warehouse-factory", "warehouse-handover", "warehouse-notifications"],
  },
  {
    id: "accounting",
    label: "KẾ TOÁN",
    description: "Đối chiếu phiếu nhà máy, phiếu nhập, chứng từ giao hàng và lưu tài liệu VAT",
    icon: "debt",
    color: "#c84b11",
    gradient: "linear-gradient(135deg, #ea580c, #c2410c)",
    moduleIds: ["accounting-factory", "accounting-orders", "accounting-vat"],
  },
  {
    id: "orders",
    label: "ĐƠN HÀNG",
    description: "Quản lý yêu cầu mua hàng, đơn bán tiếp nhận, đặt hàng và báo giá",
    icon: "order",
    color: "#2563eb",
    gradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    moduleIds: ["buyer-orders", "requests", "sales", "orders", "quotations", "pricing", "contracts", "branches", "purchases"],
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
    moduleIds: ["dealers", "network", "applications", "invitations"],
  },
  {
    id: "goods",
    label: "SẢN PHẨM & KHO",
    description: "Danh mục sản phẩm và theo dõi tồn kho",
    icon: "warehouse",
    color: "#6366f1",
    gradient: "linear-gradient(135deg, #6366f1, #4338ca)",
    moduleIds: ["goods", "inventory"],
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
    moduleIds: ["reports", "period-sales", "kpi", "data", "search"],
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
    moduleIds: ["accounts", "fields", "audit", "workspace", "profile", "document-notifications", "factory-requests", "mcp"],
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
      const visibleHub = user.area === "crm" && hub.id === "tasks"
        ? { ...hub, label: "CÔNG VIỆC & THÔNG BÁO", description: "Việc cần làm và thông báo hệ thống" }
        : user.area === "crm" && hub.id === "dealers"
          ? { ...hub, description: "Danh bạ đại lý phân phối, hồ sơ đăng ký và xét duyệt đối tác" }
          : hub;
      result.push({ hub: visibleHub, modules: hubModules });
    }
  }
  return result;
}
