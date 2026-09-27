import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { crmHubs, visibleModules, type CrmModule } from "@/lib/crm/modules";
import type { Principal } from "@/lib/crm/types";
import { CrmModuleIcon } from "./ModuleIcon";

const moduleDetails: Record<string, { desc: string; action: string }> = {
  requests: { desc: "Tiếp nhận và xử lý các đề xuất mua hàng", action: "Xem yêu cầu" },
  sales: { desc: "Theo dõi đơn bán buôn và trạng thái giao hàng", action: "Xem đơn bán" },
  pricing: { desc: "Chính sách giá bán và chiết khấu cấp đối tác", action: "Quản lý bảng giá" },
  quotations: { desc: "Báo giá theo phiên bản và điều khoản thương mại", action: "Xem báo giá" },
  orders: { desc: "Tổng hợp và điều phối đơn hàng toàn hệ thống", action: "Quản lý đơn hàng" },
  customers: { desc: "Hồ sơ khách hàng và thông tin liên hệ", action: "Xem khách hàng" },
  care: { desc: "Kế hoạch chăm sóc và tương tác định kỳ", action: "Nhật ký chăm sóc" },
  visits: { desc: "Nhật ký ghé thăm điểm bán thực địa", action: "Lịch thăm điểm" },
  dealers: { desc: "Danh bạ đại lý phân phối đang hoạt động", action: "Xem danh sách" },
  applications: { desc: "Hồ sơ đăng ký đại lý mới chờ xét duyệt", action: "Xét duyệt hồ sơ" },
  invitations: { desc: "Tạo và quản lý liên kết mời gia nhập đại lý", action: "Quản lý link mời" },
  goods: { desc: "Danh mục sản phẩm, quy cách và giá niêm yết", action: "Tra cứu hàng hóa" },
  inventory: { desc: "Theo dõi tồn kho khả dụng và vị trí lưu trữ", action: "Kiểm tra tồn kho" },
  samples: { desc: "Cấp phát, luân chuyển và chuyển đổi hàng mẫu", action: "Quản lý hàng mẫu" },
  procurement: { desc: "Kế hoạch mua hàng và quản lý nhà cung cấp", action: "Theo dõi mua hàng" },
  consignment: { desc: "Ký gửi đại lý và ghi nhận doanh số ký gửi", action: "Quản lý ký gửi" },
  settlements: { desc: "Đối soát công nợ kỳ bán và phí dịch vụ", action: "Đối soát định kỳ" },
  debts: { desc: "Theo dõi dư nợ, hạn mức và lịch thanh toán", action: "Theo dõi công nợ" },
  cash: { desc: "Sổ quỹ thu chi tiền mặt và tài khoản ngân hàng", action: "Sổ quỹ thu chi" },
  payments: { desc: "Lập và duyệt chứng từ chi tiền, thanh toán", action: "Chứng từ thanh toán" },
  tasks: { desc: "Danh sách việc cần làm theo tiến độ và hạn xử lý", action: "Xử lý công việc" },
  automation: { desc: "Thiết lập quy tắc tự động hóa và nhắc việc", action: "Cấu hình tự động" },
  notifications: { desc: "Thông báo nghiệp vụ và cảnh báo hệ thống", action: "Xem thông báo" },
  reports: { desc: "Báo cáo doanh số, tồn kho và hiệu suất vận hành", action: "Xem báo cáo" },
  data: { desc: "Nhập xuất dữ liệu hàng loạt định dạng chuẩn", action: "Import / Export" },
  search: { desc: "Tra cứu nhanh mã chứng từ, đối tác và sản phẩm", action: "Tra cứu hệ thống" },
  library: { desc: "Tài liệu hướng dẫn, biểu mẫu và quy chế bán hàng", action: "Mở kho tài liệu" },
  support: { desc: "Tiếp nhận yêu cầu kỹ thuật và hỗ trợ đối tác", action: "Xử lý phiếu hỗ trợ" },
  fields: { desc: "Tùy chỉnh các trường dữ liệu bổ sung cho hồ sơ", action: "Cấu hình trường" },
  workspace: { desc: "Tùy chỉnh góc làm việc và bộ lọc cá nhân", action: "Vào không gian" },
  audit: { desc: "Nhật ký truy vết thao tác và thay đổi dữ liệu", action: "Xem lịch sử" },
  accounts: { desc: "Phân quyền tài khoản và quản trị người dùng", action: "Quản lý tài khoản" },
  members: { desc: "Danh sách nhân sự thuộc tổ chức đại lý", action: "Quản lý nhân viên" },
  addresses: { desc: "Sổ địa chỉ giao nhận hàng của đại lý", action: "Sổ địa chỉ" },
  cart: { desc: "Giỏ hàng đang chuẩn bị và lưu tạm", action: "Xem giỏ hàng" },
  profile: { desc: "Thông tin tổ chức và bảo mật tài khoản", action: "Hồ sơ đại lý" },
};

export function CrmHubPage({ hubId, user }: { hubId: string; user: Principal }) {
  const hub = crmHubs.find((h) => h.id === hubId);
  if (!hub) notFound();

  const allowed = visibleModules(user);
  const hubModules = allowed.filter((m) => hub.moduleIds.includes(m.id));

  const root = `/${user.area}`;

  return (
    <div className="crm-hub-page">
      <div className="crm-hub-container">
        <nav className="crm-hub-nav" aria-label="Điều hướng nhóm phân hệ">
          <Link href={root} className="crm-hub-back">
            <ArrowLeft size={16} aria-hidden />
            <span>Quay lại tổng quan</span>
          </Link>
        </nav>

        <header className="crm-hub-header">
          <div
            className="crm-hub-badge-icon"
            style={{ background: hub.gradient }}
            aria-hidden
          >
            <CrmModuleIcon name={hub.icon} size={36} color="#ffffff" />
          </div>
          <div className="crm-hub-title-box">
            <h1>{hub.label}</h1>
            <p>{hub.description}</p>
          </div>
        </header>

        {hubModules.length === 0 ? (
          <div className="crm-hub-empty" role="alert">
            <h2>Chưa được cấp quyền</h2>
            <p>Tài khoản của bạn chưa có quyền truy cập phân hệ nào trong nhóm này.</p>
            <Link href={root} className="button button--secondary">
              Về trang chủ
            </Link>
          </div>
        ) : (
          <section className="crm-hub-section" aria-label="Danh sách phân hệ">
            <h2 className="sr-only">Các phân hệ trực thuộc</h2>
            <div className="crm-hub-grid">
              {hubModules.map((m: CrmModule) => {
                const detail = moduleDetails[m.id] || { desc: m.shortLabel, action: "Truy cập" };
                return (
                  <Link
                    key={m.id}
                    href={`${root}/${m.id}`}
                    className="crm-hub-submodule-card"
                  >
                    <div
                      className="crm-hub-submodule-icon"
                      style={{
                        background: `linear-gradient(135deg, ${hub.color}22, ${hub.color}44)`,
                        border: `1px solid ${hub.color}55`,
                      }}
                      aria-hidden
                    >
                      <CrmModuleIcon name={m.icon} size={28} color={hub.color} />
                    </div>
                    <div className="crm-hub-submodule-info">
                      <h3>{m.label}</h3>
                      <p>{detail.desc}</p>
                    </div>
                    <div className="crm-hub-submodule-action" aria-hidden>
                      <span>{detail.action}</span>
                      <ArrowRight size={16} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
