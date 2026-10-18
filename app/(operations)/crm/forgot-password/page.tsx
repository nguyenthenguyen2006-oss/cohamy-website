import Image from 'next/image';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/crm/SecurityForms';

export default function ForgotPasswordPage() {
  return (
    <div className="crm-login-page">
      <div className="crm-login-split">
        <aside className="crm-login-story" aria-label="Bảo mật tài khoản Cohamy CRM">
          <div className="crm-login-story__top">
            <Link href="/vi" className="crm-login-story__brand" aria-label="Trang chủ Cohamy">
              <Image
                alt="Cohamy"
                className="crm-login__logo"
                src="/images/logo/cohamy-brand-logo.png"
                width={156}
                height={45}
                style={{ width: 'auto', height: '38px' }}
              />
            </Link>
            <span className="crm-login-story__badge">KHÔI PHỤC TÀI KHOẢN NỘI BỘ</span>
          </div>

          <div className="crm-login-story__hero">
            <h2>Khôi phục an toàn. Không mất dấu phiên.</h2>
            <p>
              Liên kết đặt lại mật khẩu chỉ sử dụng một lần và tự động hết hạn sau 30 phút. Lớp xác thực đa yếu tố (MFA) vẫn được bảo toàn nếu tài khoản đã kích hoạt.
            </p>

            <div className="crm-login-pillars">
              <div className="crm-login-pillar">
                <span className="crm-login-pillar__num">01</span>
                <div className="crm-login-pillar__text">
                  <strong>Liên kết dùng một lần (30 phút)</strong>
                  <span>Mã thông báo khôi phục được băm bảo mật và tự hủy ngay sau khi hoàn tất đổi mật khẩu.</span>
                </div>
              </div>
              <div className="crm-login-pillar">
                <span className="crm-login-pillar__num">02</span>
                <div className="crm-login-pillar__text">
                  <strong>Giữ nguyên kiểm soát MFA & Nhật ký</strong>
                  <span>Mọi yêu cầu đặt lại mật khẩu đều được ghi nhận vào nhật ký kiểm toán bảo mật.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="crm-login-story__foot">
            <span>© Cohamy Vietnam · Bảo mật phiên đăng nhập theo thời gian thực</span>
            <span>Chuẩn xác thực nội bộ B2B</span>
          </div>
        </aside>

        <main className="crm-login-card-wrap">
          <section className="crm-login-card" aria-labelledby="forgot-title">
            <div className="crm-login-card__head">
              <Link href="/vi" className="crm-login-card__logo-link" aria-label="Trang chủ Cohamy">
                <Image
                  alt="Cohamy"
                  className="crm-login__logo"
                  src="/images/logo/cohamy-brand-logo.png"
                  width={140}
                  height={40}
                  style={{ width: 'auto', height: '34px' }}
                />
              </Link>
              <span className="crm-login-card__eyebrow">CẤP LẠI LIÊN KẾT XÁC THỰC</span>
              <h1 id="forgot-title">Quên mật khẩu</h1>
              <p className="crm-login__lead">
                Nhập email đăng nhập nội bộ để nhận liên kết khôi phục mật khẩu qua hệ thống Brevo.
              </p>
            </div>

            <ForgotPasswordForm />

            <div className="crm-login-card__links">
              <Link href="/crm/login">← Quay lại đăng nhập CRM</Link>
              <Link href="/portal/login">Cổng Đại lý (/portal) →</Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
