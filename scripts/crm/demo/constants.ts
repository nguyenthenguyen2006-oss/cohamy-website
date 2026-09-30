import type { Role, OrganizationKind } from '@/lib/crm/types';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';

export const DEMO_BATCH_TAG = 'DEMO_BATCH_2026';
export const DEMO_CREDENTIALS_FILE = '.local/demo-credentials.json';

/**
 * Resolves demo password strictly from secret environment variable (CRM_DEMO_PASSWORD)
 * or generates a cryptographically random secure string. Default passwords are strictly forbidden.
 */
export function resolveDemoPassword(): string {
  const envPassword = process.env.CRM_DEMO_PASSWORD?.trim();
  if (envPassword && envPassword.length >= 12) {
    return envPassword;
  }
  // Try reading from previously generated local credentials file if available
  try {
    if (fs.existsSync(DEMO_CREDENTIALS_FILE)) {
      const data = JSON.parse(fs.readFileSync(DEMO_CREDENTIALS_FILE, 'utf8'));
      const stored = data.password || data.commonPassword;
      if (typeof stored === 'string' && stored.length >= 12) {
        return stored;
      }
    }
  } catch {}

  // Cryptographically random secure password (minimum 16 bytes base64url + complexity suffix)
  return randomBytes(16).toString('base64url') + '!A9';
}

export function getDemoCredentials(): { password: string; accounts: Record<string, string> } | null {
  try {
    if (fs.existsSync(DEMO_CREDENTIALS_FILE)) {
      return JSON.parse(fs.readFileSync(DEMO_CREDENTIALS_FILE, 'utf8'));
    }
  } catch {}
  return null;
}

export interface DemoAccountDef {
  email: string;
  displayName: string;
  role: Role;
  orgCode: string;
  orgName: string;
  orgKind: OrganizationKind;
  area: 'crm' | 'portal';
  description: string;
}

export const DEMO_ACCOUNTS: DemoAccountDef[] = [
  {
    email: 'admin@demo.cohamy.invalid',
    displayName: 'DEMO · Nguyễn Quốc Bảo (Quản trị)',
    role: 'ADMIN',
    orgCode: 'COHAMY',
    orgName: 'Cohamy',
    orgKind: 'COHAMY',
    area: 'crm',
    description: 'Toàn quyền quản trị hệ thống, duyệt đối tác, phân quyền tài khoản, cấu hình chính sách',
  },
  {
    email: 'manager@demo.cohamy.invalid',
    displayName: 'DEMO · Trần Thu Hà (Quản lý vận hành)',
    role: 'MANAGER',
    orgCode: 'COHAMY',
    orgName: 'Cohamy',
    orgKind: 'COHAMY',
    area: 'crm',
    description: 'Quản lý kinh doanh, phê duyệt ngoại lệ đơn hàng/báo giá, duyệt hợp đồng ký gửi và mua hàng',
  },
  {
    email: 'sales@demo.cohamy.invalid',
    displayName: 'DEMO · Lê Hoàng Nam (Trưởng nhóm Kinh doanh)',
    role: 'SALES',
    orgCode: 'COHAMY',
    orgName: 'Cohamy',
    orgKind: 'COHAMY',
    area: 'crm',
    description: 'Quản lý quan hệ khách hàng, lập báo giá phiên bản, tiếp nhận đơn bán và cấp phát hàng mẫu',
  },
  {
    email: 'warehouse@demo.cohamy.invalid',
    displayName: 'DEMO · Đỗ Mạnh Hùng (Thủ kho chính)',
    role: 'WAREHOUSE',
    orgCode: 'COHAMY',
    orgName: 'Cohamy',
    orgKind: 'COHAMY',
    area: 'crm',
    description: 'Quản lý nhập xuất tồn, xuất kho hàng mẫu, giao hàng đơn bán và xuất ký gửi',
  },
  {
    email: 'accountant@demo.cohamy.invalid',
    displayName: 'DEMO · Phạm Phương Thảo (Kế toán công nợ)',
    role: 'ACCOUNTANT',
    orgCode: 'COHAMY',
    orgName: 'Cohamy',
    orgKind: 'COHAMY',
    area: 'crm',
    description: 'Quản lý công nợ đại lý, ghi nhận chứng từ thanh toán, đối soát ký gửi và thanh toán NCC',
  },
  {
    email: 'dealer-a@demo.cohamy.invalid',
    displayName: 'DEMO · Vũ Hải Đăng (Chủ đại lý An Nhiên)',
    role: 'DEALER_OWNER',
    orgCode: 'DEMO_DL_A',
    orgName: 'DEMO · Siêu thị Thực phẩm Sạch An Nhiên',
    orgKind: 'DEALER',
    area: 'portal',
    description: 'Chủ đại lý A (Hà Nội): Đặt hàng, duyệt đề nghị của nhân viên, xem báo giá, báo bán ký gửi, công nợ',
  },
  {
    email: 'staff-a@demo.cohamy.invalid',
    displayName: 'DEMO · Nguyễn Mai Linh (Nhân viên đại lý An Nhiên)',
    role: 'DEALER_STAFF',
    orgCode: 'DEMO_DL_A',
    orgName: 'DEMO · Siêu thị Thực phẩm Sạch An Nhiên',
    orgKind: 'DEALER',
    area: 'portal',
    description: 'Nhân viên đại lý A: Lập đề nghị mua hàng nháp, giỏ hàng, tra cứu tồn kho ký gửi, gửi phiếu hỗ trợ',
  },
  {
    email: 'dealer-b@demo.cohamy.invalid',
    displayName: 'DEMO · Hoàng Trọng Nghĩa (Chủ đại lý Bình An)',
    role: 'DEALER_OWNER',
    orgCode: 'DEMO_DL_B',
    orgName: 'DEMO · Chuỗi Nông Sản Xanh Bình An',
    orgKind: 'DEALER',
    area: 'portal',
    description: 'Chủ đại lý B (Đà Nẵng): Đại lý độc lập dùng kiểm tra cách ly dữ liệu (data isolation)',
  },
];

export interface DemoProductDef {
  sku: string;
  name: string;
  category: string;
  weightLabel: string;
  retailPrice: string;
  baseUnit: string;
  caseUnit: string;
  unitsPerCase: number;
  casePrice: string;
}

export const DEMO_PRODUCTS: DemoProductDef[] = [
  {
    sku: 'DEMO-CHOC-01',
    name: 'DEMO · Socola Hạnh Nhân Đen 70% Cacao',
    category: 'Socola Bọc Hạt',
    weightLabel: 'Gói 120g',
    retailPrice: '85000',
    baseUnit: 'Gói',
    caseUnit: 'Thùng 12 gói',
    unitsPerCase: 12,
    casePrice: '918000',
  },
  {
    sku: 'DEMO-CHOC-02',
    name: 'DEMO · Socola Hạnh Nhân Sữa 45% Cacao',
    category: 'Socola Bọc Hạt',
    weightLabel: 'Gói 120g',
    retailPrice: '80000',
    baseUnit: 'Gói',
    caseUnit: 'Thùng 12 gói',
    unitsPerCase: 12,
    casePrice: '864000',
  },
  {
    sku: 'DEMO-BAR-03',
    name: 'DEMO · Thanh Hạt Năng Lượng Hạnh Nhân & Việt Quất',
    category: 'Thanh Hạt',
    weightLabel: 'Hộp 6 thanh (240g)',
    retailPrice: '95000',
    baseUnit: 'Hộp',
    caseUnit: 'Thùng 10 hộp',
    unitsPerCase: 10,
    casePrice: '855000',
  },
  {
    sku: 'DEMO-BAR-04',
    name: 'DEMO · Thanh Hạt Dinh Dưỡng Hạt Điều & Macca',
    category: 'Thanh Hạt',
    weightLabel: 'Hộp 6 thanh (240g)',
    retailPrice: '105000',
    baseUnit: 'Hộp',
    caseUnit: 'Thùng 10 hộp',
    unitsPerCase: 10,
    casePrice: '945000',
  },
  {
    sku: 'DEMO-GRAN-05',
    name: 'DEMO · Granola Mật Ong Rừng & Yến Mạch Nướng Giòn',
    category: 'Granola',
    weightLabel: 'Hũ 500g',
    retailPrice: '145000',
    baseUnit: 'Hũ',
    caseUnit: 'Thùng 12 hũ',
    unitsPerCase: 12,
    casePrice: '1566000',
  },
  {
    sku: 'DEMO-CASH-06',
    name: 'DEMO · Hạt Điều Rang Muối Vỏ Lụa Loại A Bình Phước',
    category: 'Hạt Dinh Dưỡng',
    weightLabel: 'Hũ 450g',
    retailPrice: '160000',
    baseUnit: 'Hũ',
    caseUnit: 'Thùng 12 hũ',
    unitsPerCase: 12,
    casePrice: '1728000',
  },
  {
    sku: 'DEMO-MACC-07',
    name: 'DEMO · Hạt Macca Nứt Vỏ Tây Nguyên Thượng Hạng',
    category: 'Hạt Dinh Dưỡng',
    weightLabel: 'Túi zip 500g',
    retailPrice: '175000',
    baseUnit: 'Túi',
    caseUnit: 'Thùng 12 túi',
    unitsPerCase: 12,
    casePrice: '1890000',
  },
  {
    sku: 'DEMO-RAIS-08',
    name: 'DEMO · Nho Khô Ninh Thuận Sấy Dẻo Tự Nhiên',
    category: 'Trái Cây Sấy',
    weightLabel: 'Hộp 300g',
    retailPrice: '75000',
    baseUnit: 'Hộp',
    caseUnit: 'Thùng 24 hộp',
    unitsPerCase: 24,
    casePrice: '1620000',
  },
  {
    sku: 'DEMO-CACA-09',
    name: 'DEMO · Bột Cacao Nguyên Chất Đắk Lắk Đậm Vị',
    category: 'Đồ Uống',
    weightLabel: 'Túi 500g',
    retailPrice: '120000',
    baseUnit: 'Túi',
    caseUnit: 'Thùng 12 túi',
    unitsPerCase: 12,
    casePrice: '1296000',
  },
  {
    sku: 'DEMO-TEA-10',
    name: 'DEMO · Trà Mãng Cầu Xiêm Thượng Hạng Sấy Lạnh',
    category: 'Đồ Uống',
    weightLabel: 'Hộp 200g',
    retailPrice: '110000',
    baseUnit: 'Hộp',
    caseUnit: 'Thùng 20 hộp',
    unitsPerCase: 20,
    casePrice: '1980000',
  },
];

export interface DemoOrgDef {
  code: string;
  name: string;
  kind: OrganizationKind;
  phone: string;
  email: string;
  address: string;
  contactName: string;
  businessId: string;
  segment: string;
  stage: string;
  source: string;
}

export const DEMO_CUSTOMERS: DemoOrgDef[] = [
  {
    code: 'DEMO_CUST_01',
    name: 'DEMO · Chuỗi Cafe Highland Oasis',
    kind: 'CUSTOMER',
    phone: '0901234001',
    email: 'contact@oasis-cafe.demo.invalid',
    address: 'Số 45 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội',
    contactName: 'Nguyễn Văn Toàn',
    businessId: '0109988771',
    segment: 'Chuỗi F&B / Horeca',
    stage: 'ACTIVE',
    source: 'Hội chợ OCOP 2026',
  },
  {
    code: 'DEMO_CUST_02',
    name: 'DEMO · Công ty CP Bánh Kẹo Ánh Dương',
    kind: 'CUSTOMER',
    phone: '0901234002',
    email: 'muahang@anhduong-sweets.demo.invalid',
    address: 'Lô C2 KCN Thăng Long, Đông Anh, Hà Nội',
    contactName: 'Trần Minh Quang',
    businessId: '0109988772',
    segment: 'B2B Sản xuất',
    stage: 'ACTIVE',
    source: 'Website',
  },
  {
    code: 'DEMO_CUST_03',
    name: 'DEMO · Siêu thị Mini Mart Hạnh Phúc',
    kind: 'CUSTOMER',
    phone: '0901234003',
    email: 'quanly@minimarthanhphuc.demo.invalid',
    address: 'Số 88 Trần Hưng Đạo, Q.1, TP. Hồ Chí Minh',
    contactName: 'Lê Cẩm Tú',
    businessId: '0309988773',
    segment: 'Bán lẻ hiện đại',
    stage: 'ACTIVE',
    source: 'Giới thiệu đối tác',
  },
  {
    code: 'DEMO_CUST_04',
    name: 'DEMO · Cửa hàng Dinh Dưỡng Xanh Thảo Điền',
    kind: 'CUSTOMER',
    phone: '0901234004',
    email: 'hello@dinhduongxanh.demo.invalid',
    address: 'Số 12 Xuân Thủy, Thảo Điền, TP. Thủ Đức',
    contactName: 'Đặng Thảo Vy',
    businessId: '0309988774',
    segment: 'Cửa hàng Organic',
    stage: 'CONTACTED',
    source: 'Mạng xã hội',
  },
  {
    code: 'DEMO_CUST_05',
    name: 'DEMO · Nhà hàng Buffet Sen Tây Hồ',
    kind: 'CUSTOMER',
    phone: '0901234005',
    email: 'bep@sentayho-buffet.demo.invalid',
    address: 'Số 614 Lạc Long Quân, Tây Hồ, Hà Nội',
    contactName: 'Bùi Đức Long',
    businessId: '0109988775',
    segment: 'Nhà hàng / Horeca',
    stage: 'ACTIVE',
    source: 'Sales trực tiếp',
  },
  {
    code: 'DEMO_CUST_06',
    name: 'DEMO · Khách hàng Doanh nghiệp Viettel Post',
    kind: 'CUSTOMER',
    phone: '0901234006',
    email: 'congdoan@viettelpost-gift.demo.invalid',
    address: 'Tòa nhà Viettel, Cầu Giấy, Hà Nội',
    contactName: 'Hoàng Ánh Nguyệt',
    businessId: '0109988776',
    segment: 'Quà tặng doanh nghiệp',
    stage: 'CONTACTED',
    source: 'Liên hệ Hotline',
  },
  {
    code: 'DEMO_CUST_07',
    name: 'DEMO · Cửa hàng Thực phẩm Sạch Vườn Nhà',
    kind: 'CUSTOMER',
    phone: '0901234007',
    email: 'vuonnha.cleanfood@demo.invalid',
    address: 'Số 34 Nguyễn Văn Huyên, Cầu Giấy, Hà Nội',
    contactName: 'Vũ Thị Thanh',
    businessId: '0109988777',
    segment: 'Cửa hàng tiện lợi',
    stage: 'LEAD',
    source: 'Website',
  },
  {
    code: 'DEMO_CUST_08',
    name: 'DEMO · Trường Quốc tế Á Châu Campus 2',
    kind: 'CUSTOMER',
    phone: '0901234008',
    email: 'canteen@asianschool.demo.invalid',
    address: 'Số 226 Pasteur, Q.3, TP. Hồ Chí Minh',
    contactName: 'Thái Mỹ Dung',
    businessId: '0309988778',
    segment: 'Giáo dục / Trường học',
    stage: 'CONTACTED',
    source: 'Thăm điểm bán',
  },
  {
    code: 'DEMO_CUST_09',
    name: 'DEMO · Khách sạn Mường Thanh Grand Đà Nẵng',
    kind: 'CUSTOMER',
    phone: '0901234009',
    email: 'fb-manager@muongthanh-danang.demo.invalid',
    address: 'Số 962 Ngô Quyền, Sơn Trà, Đà Nẵng',
    contactName: 'Phan Bá Tùng',
    businessId: '0409988779',
    segment: 'Khách sạn / Horeca',
    stage: 'ACTIVE',
    source: 'Hội thảo xúc tiến',
  },
  {
    code: 'DEMO_CUST_10',
    name: 'DEMO · Tạp hóa Gia Đình Bác Năm',
    kind: 'CUSTOMER',
    phone: '0901234010',
    email: 'taphoabacnam@demo.invalid',
    address: 'Số 15 Phố Huế, Hai Bà Trưng, Hà Nội',
    contactName: 'Nguyễn Văn Năm',
    businessId: '0109988780',
    segment: 'Bán lẻ truyền thống',
    stage: 'LEAD',
    source: 'Tiếp cận thị trường',
  },
];

export const DEMO_DEALERS: DemoOrgDef[] = [
  {
    code: 'DEMO_DL_A',
    name: 'DEMO · Siêu thị Thực phẩm Sạch An Nhiên',
    kind: 'DEALER',
    phone: '0902345001',
    email: 'admin@annhienmart.demo.invalid',
    address: 'Số 102 Hoàng Văn Thái, Thanh Xuân, Hà Nội',
    contactName: 'Vũ Hải Đăng',
    businessId: '0108877661',
    segment: 'Đại lý Cấp 1',
    stage: 'ACTIVE',
    source: 'Đăng ký đối tác',
  },
  {
    code: 'DEMO_DL_B',
    name: 'DEMO · Chuỗi Nông Sản Xanh Bình An',
    kind: 'DEALER',
    phone: '0902345002',
    email: 'lienhe@binhanorganic.demo.invalid',
    address: 'Số 54 Nguyễn Tri Phương, Hải Châu, Đà Nẵng',
    contactName: 'Hoàng Trọng Nghĩa',
    businessId: '0408877662',
    segment: 'Đại lý Cấp 1',
    stage: 'ACTIVE',
    source: 'Hội nghị đại lý',
  },
  {
    code: 'DEMO_DL_03',
    name: 'DEMO · Đại lý Miền Tây Phú Cường',
    kind: 'DEALER',
    phone: '0902345003',
    email: 'phucuong.cantho@demo.invalid',
    address: 'Số 89 Đường 30 Tháng 4, Ninh Kiều, Cần Thơ',
    contactName: 'Ngô Quốc Cường',
    businessId: '1808877663',
    segment: 'Đại lý Cấp 2',
    stage: 'ACTIVE',
    source: 'Sales phụ trách',
  },
  {
    code: 'DEMO_DL_04',
    name: 'DEMO · Nhà Phân phối Hải Phòng Thành Đạt',
    kind: 'DEALER',
    phone: '0902345004',
    email: 'nppthanhdat.hp@demo.invalid',
    address: 'Số 18 Lạch Tray, Ngô Quyền, Hải Phòng',
    contactName: 'Đoàn Văn Đạt',
    businessId: '0208877664',
    segment: 'Nhà phân phối tỉnh',
    stage: 'ACTIVE',
    source: 'Hội chợ Nông sản',
  },
  {
    code: 'DEMO_DL_05',
    name: 'DEMO · Đại lý Tây Nguyên Ban Mê',
    kind: 'DEALER',
    phone: '0902345005',
    email: 'banmemart@demo.invalid',
    address: 'Số 23 Lê Duẩn, TP. Buôn Ma Thuột, Đắk Lắk',
    contactName: 'Y Krông Niê',
    businessId: '6008877665',
    segment: 'Đại lý Cấp 2',
    stage: 'ACTIVE',
    source: 'Đăng ký đối tác',
  },
  {
    code: 'DEMO_DL_06',
    name: 'DEMO · Chuỗi Tiện lợi Daily Plus Sài Gòn',
    kind: 'DEALER',
    phone: '0902345006',
    email: 'vanhanh@dailyplus.demo.invalid',
    address: 'Số 310 Nguyễn Thị Minh Khai, Q.3, TP. Hồ Chí Minh',
    contactName: 'Trịnh Gia Huy',
    businessId: '0308877666',
    segment: 'Chuỗi cửa hàng',
    stage: 'ACTIVE',
    source: 'Hội nghị xúc tiến',
  },
  {
    code: 'DEMO_DL_07',
    name: 'DEMO · Đại lý Bắc Giang Thịnh Vượng',
    kind: 'DEALER',
    phone: '0902345007',
    email: 'thinhvuong.bg@demo.invalid',
    address: 'Số 76 Hoàng Văn Thụ, TP. Bắc Giang',
    contactName: 'Nguyễn Thị Hạnh',
    businessId: '2408877667',
    segment: 'Đại lý Cấp 2',
    stage: 'ACTIVE',
    source: 'Giới thiệu',
  },
  {
    code: 'DEMO_DL_08',
    name: 'DEMO · Nhà phân phối Quảng Ninh Sunmart',
    kind: 'DEALER',
    phone: '0902345008',
    email: 'sunmart.qn@demo.invalid',
    address: 'Số 105 Trần Phú, Cẩm Phả, Quảng Ninh',
    contactName: 'Trần Tuấn Kiệt',
    businessId: '2208877668',
    segment: 'Nhà phân phối tỉnh',
    stage: 'ACTIVE',
    source: 'Sales trực tiếp',
  },
  {
    code: 'DEMO_DL_09',
    name: 'DEMO · Đại lý Đông Nam Bộ Đồng Nai',
    kind: 'DEALER',
    phone: '0902345009',
    email: 'dongnai.dealer@demo.invalid',
    address: 'Số 42 Đồng Khởi, Tân Hiệp, Biên Hòa, Đồng Nai',
    contactName: 'Lâm Văn Phước',
    businessId: '3608877669',
    segment: 'Đại lý Cấp 2',
    stage: 'ACTIVE',
    source: 'Đăng ký đối tác',
  },
  {
    code: 'DEMO_DL_10',
    name: 'DEMO · Đại lý Nha Trang SeaMart',
    kind: 'DEALER',
    phone: '0902345010',
    email: 'seamart.nhatrang@demo.invalid',
    address: 'Số 68 Trần Phú, Lộc Thọ, Nha Trang, Khánh Hòa',
    contactName: 'Võ Thị Tuyết Mai',
    businessId: '4208877670',
    segment: 'Đại lý Du lịch / Quà tặng',
    stage: 'ACTIVE',
    source: 'Triển lãm Du lịch',
  },
];

export const DEMO_SUPPLIERS: DemoOrgDef[] = [
  {
    code: 'DEMO_SUP_01',
    name: 'DEMO · Nông trại Hạt Điều Bình Phước Xanh',
    kind: 'SUPPLIER',
    phone: '0903456001',
    email: 'kinhdoanh@cashewfarm-bp.demo.invalid',
    address: 'Thôn 3, Xã Đồng Tâm, Huyện Đồng Phú, Bình Phước',
    contactName: 'Nguyễn Tấn Tài',
    businessId: '3807766551',
    segment: 'Vùng nguyên liệu hạt',
    stage: 'ACTIVE',
    source: 'Khảo sát vùng trồng',
  },
  {
    code: 'DEMO_SUP_02',
    name: 'DEMO · HTX Cacao Hữu cơ Bến Tre',
    kind: 'SUPPLIER',
    phone: '0903456002',
    email: 'cacao.bentre@demo.invalid',
    address: 'Ấp Phú Lợi, Xã Phú Hưng, TP. Bến Tre',
    contactName: 'Lê Văn Hiếu',
    businessId: '1307766552',
    segment: 'Nguyên liệu Cacao',
    stage: 'ACTIVE',
    source: 'Hội Nông dân',
  },
  {
    code: 'DEMO_SUP_03',
    name: 'DEMO · Công ty TNHH Macca Gia Lai',
    kind: 'SUPPLIER',
    phone: '0903456003',
    email: 'macca.gialai@demo.invalid',
    address: 'Km 15 Quốc lộ 14, Chư Prông, Gia Lai',
    contactName: 'Đinh Văn Thắng',
    businessId: '3907766553',
    segment: 'Hạt dinh dưỡng thô',
    stage: 'ACTIVE',
    source: 'Hội chợ Nông sản',
  },
  {
    code: 'DEMO_SUP_04',
    name: 'DEMO · Nông sản Sạch Đà Lạt Farm',
    kind: 'SUPPLIER',
    phone: '0903456004',
    email: 'dalatfarm.supply@demo.invalid',
    address: 'Khu Suối Tía, Phường 3, Đà Lạt, Lâm Đồng',
    contactName: 'Phạm Hồng Nhung',
    businessId: '4207766554',
    segment: 'Trái cây sấy & trà',
    stage: 'ACTIVE',
    source: 'Hợp tác xã',
  },
  {
    code: 'DEMO_SUP_05',
    name: 'DEMO · Xưởng Bao bì & In ấn Thăng Long',
    kind: 'SUPPLIER',
    phone: '0903456005',
    email: 'kinhdoanh@baobithanglong.demo.invalid',
    address: 'KCN Từ Liêm, Bắc Từ Liêm, Hà Nội',
    contactName: 'Vũ Quốc Huy',
    businessId: '0107766555',
    segment: 'Vật tư & Bao bì',
    stage: 'ACTIVE',
    source: 'Đấu thầu nội bộ',
  },
  {
    code: 'DEMO_SUP_06',
    name: 'DEMO · Công ty Hạnh Nhân Nhập khẩu Cali VN',
    kind: 'SUPPLIER',
    phone: '0903456006',
    email: 'sales@calialmonds.demo.invalid',
    address: 'Tòa nhà River Gate, Q.4, TP. Hồ Chí Minh',
    contactName: 'Trần Kim Ngân',
    businessId: '0307766556',
    segment: 'Nguyên liệu nhập khẩu',
    stage: 'ACTIVE',
    source: 'Nhập khẩu chính ngạch',
  },
  {
    code: 'DEMO_SUP_07',
    name: 'DEMO · Nhà Cung cấp Màng Thực phẩm An Toàn',
    kind: 'SUPPLIER',
    phone: '0903456007',
    email: 'contact@antoanpack.demo.invalid',
    address: 'KCN Sóng Thần 2, Dĩ An, Bình Dương',
    contactName: 'Ngô Kiến Huy',
    businessId: '3707766557',
    segment: 'Vật tư phụ',
    stage: 'ACTIVE',
    source: 'Đối tác lâu năm',
  },
  {
    code: 'DEMO_SUP_08',
    name: 'DEMO · HTX Nho Khô Phan Rang',
    kind: 'SUPPLIER',
    phone: '0903456008',
    email: 'nhophanrang@demo.invalid',
    address: 'Thôn Thái An, Xã Vĩnh Hải, Ninh Hải, Ninh Thuận',
    contactName: 'Nguyễn Văn Hùng',
    businessId: '4507766558',
    segment: 'Nho sấy dẻo',
    stage: 'ACTIVE',
    source: 'Liên kết vùng trồng',
  },
  {
    code: 'DEMO_SUP_09',
    name: 'DEMO · Nhà máy Chế biến Nông sản Tây Bắc',
    kind: 'SUPPLIER',
    phone: '0903456009',
    email: 'taybac.factory@demo.invalid',
    address: 'KCN Phù Ninh, Huyện Phù Ninh, Phú Thọ',
    contactName: 'Hoàng Văn Sơn',
    businessId: '2607766559',
    segment: 'Gia công đóng gói',
    stage: 'ACTIVE',
    source: 'Đối tác chiến lược',
  },
  {
    code: 'DEMO_SUP_10',
    name: 'DEMO · Công ty Cung ứng Gia vị Tự nhiên Sơn Hà',
    kind: 'SUPPLIER',
    phone: '0903456010',
    email: 'giavi.sonha@demo.invalid',
    address: 'Số 55 Nguyễn Sơn, Long Biên, Hà Nội',
    contactName: 'Tô Vĩnh Diện',
    businessId: '0107766560',
    segment: 'Gia vị & Phụ gia',
    stage: 'ACTIVE',
    source: 'Khảo sát chất lượng',
  },
];
