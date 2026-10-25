import Image from "next/image";
import Link from "next/link";
import { CrmLoginForm } from "./LoginForm";

export function CrmLoginPage() {
  return (
    <div className="crm-login-page">
      <div className="crm-login-split">
        <aside className="crm-login-story" aria-label="Giới thiệu hệ thống vận hành Cohamy">
          <div className="crm-login-story__inner">
            <span className="crm-login-story__badge">
              HỆ THỐNG VẬN HÀNH &amp; ĐỐI SOÁT COHAMY
            </span>
            <h2>
              Bàn điều hành thương mại, kho vận và đối soát chứng từ.
            </h2>
            <p>
              Quản lý xuyên suốt mua đứt, ký gửi, báo giá theo phiên bản, tồn kho đa vị trí và công nợ đối tác trên một không gian làm việc thống nhất.
            </p>
            <ol className="crm-login-pillars">
              <li>
                <strong>01 · Chứng từ &amp; Quy đổi chuẩn</strong>
                <span>Mọi số dư và dòng hàng đều gắn liền chứng từ gốc cùng tỷ lệ quy đổi đã xác nhận.</span>
              </li>
              <li>
                <strong>02 · Báo giá lưu vết theo phiên bản</strong>
                <span>So sánh trực quan thay đổi giữa các phiên bản và phát hành báo giá PDF tức thì.</span>
              </li>
              <li>
                <strong>03 · Bảo mật &amp; Phân quyền vai trò</strong>
                <span>Kiểm soát chặt chẽ phiên đăng nhập, xác thực hai lớp (MFA) và nhật ký kiểm toán.</span>
              </li>
            </ol>
          </div>
        </aside>

        <main className="crm-login-container" id="portal-content">
          <section className="crm-login-card" aria-labelledby="login-title">
            <div className="crm-login-brand">
              <Link href="/vi" aria-label="Cohamy, website công khai">
                <Image
                  alt="Cohamy"
                  className="crm-login-brand__logo"
                  src="/images/logo/cohamy-brand-logo.png"
                  width={925}
                  height={267}
                  style={{ height: "40px", width: "auto" }}
                  priority
                />
              </Link>
            </div>
            <h1 id="login-title" className="crm-login-title">
              Đăng nhập hệ thống
            </h1>
            <p className="crm-login-subtitle">
              Đăng nhập bằng tài khoản nội bộ, khách hàng, siêu thị hoặc đại lý đã được cấp quyền.
            </p>
            <CrmLoginForm />
            <nav className="crm-login-links" aria-label="Liên kết trợ giúp đăng nhập">
              <div className="crm-login-links__row">
                <Link href="/crm/forgot-password" className="crm-link-forgot">
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="crm-login-links__row crm-login-register">
                <span>Đối tác mới chưa có tài khoản?</span>{" "}
                <Link href="/portal/register" className="crm-link-accent">
                  Đăng ký đại lý ngay
                </Link>
              </div>
              <div className="crm-login-links__row crm-login-sublinks">
                <Link href="/portal/application/login" className="crm-link-subtle">
                  Theo dõi hồ sơ đăng ký
                </Link>
                <span className="crm-link-sep" aria-hidden>
                  ·
                </span>
                <Link href="/vi" className="crm-link-subtle">
                  Website công khai
                </Link>
              </div>
            </nav>
            <footer className="crm-login-footer">
              <p>© 2026 COHAMY CRM · BÀN ĐIỀU HÀNH THƯƠNG MẠI B2B</p>
            </footer>
          </section>
        </main>
      </div>
    </div>
  );
}
