import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/crm/SecurityForms';

export default function ResetPasswordPage() {
  return (
    <div className="crm-login-page">
      <div className="crm-login-split">
        <aside className="crm-login-story" aria-label="Đặt lại mật khẩu Cohamy CRM">
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
            <span className="crm-login-story__badge">ĐẶT LẠI MẬT KHẨU AN TOÀN</span>
          </div>

          <div className="crm-login-story__hero">
            <h2>Đặt lại mật khẩu. Giữ nguyên lớp bảo vệ.</h2>
            <p>
              Sau khi cập nhật mật khẩu mới thành công, toàn bộ các phiên đăng nhập cũ trên thiết bị khác sẽ tự động kết thúc để bảo vệ tài khoản.
            </p>

            <div className="crm-login-pillars">
              <div className="crm-login-pillar">
                <span className="crm-login-pillar__num">01</span>
                <div className="crm-login-pillar__text">
                  <strong>Thu hồi phiên cũ tức thì</strong>
                  <span>Đảm bảo chỉ thiết bị vừa xác thực mới có quyền tiếp tục truy cập dữ liệu.</span>
                </div>
              </div>
              <div className="crm-login-pillar">
                <span className="crm-login-pillar__num">02</span>
                <div className="crm-login-pillar__text">
                  <strong>Mã hóa mật khẩu chuẩn doanh nghiệp</strong>
                  <span>Mật khẩu mới được kiểm tra độ mạnh và lưu trữ băm một chiều an toàn.</span>
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
          <section className="crm-login-card" aria-labelledby="reset-title">
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
              <span className="crm-login-card__eyebrow">CẬP NHẬT THÔNG TIN XÁC THỰC</span>
              <h1 id="reset-title">Mật khẩu mới</h1>
              <p className="crm-login__lead">
                Thiết lập mật khẩu mới cho tài khoản vận hành nội bộ Cohamy CRM.
              </p>
            </div>

            <Suspense fallback={<p>Đang kiểm tra liên kết…</p>}>
              <ResetPasswordForm />
            </Suspense>

            <div className="crm-login-card__links">
              <Link href="/crm/login">← Quay lại đăng nhập CRM</Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
