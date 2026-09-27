import Image from "next/image";
import Link from "next/link";
import { CrmLoginForm } from "./LoginForm";
import { ParticleNetwork } from "./ParticleNetwork";

export function CrmLoginPage() {
  return (
    <div className="crm-login-page">
      <ParticleNetwork tone="white" />
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
                style={{ height: '38px', width: 'auto' }}
                priority
              />
            </Link>
          </div>
          <h1 id="login-title" className="crm-login-title">
            ĐĂNG NHẬP HỆ THỐNG
          </h1>
          <CrmLoginForm />
          <nav className="crm-login-links" aria-label="Liên kết trợ giúp đăng nhập">
            <div className="crm-login-links__row">
              <Link href="/crm/forgot-password" className="crm-link-forgot">
                Quên mật khẩu?
              </Link>
            </div>
            <div className="crm-login-links__row crm-login-register">
              <span>Chưa có tài khoản?</span>{" "}
              <Link href="/portal/register" className="crm-link-accent">
                Đăng ký ngay
              </Link>
            </div>
            <div className="crm-login-links__row crm-login-sublinks">
              <Link href="/portal/application/login" className="crm-link-subtle">
                Theo dõi hồ sơ đăng ký
              </Link>
              <span className="crm-link-sep" aria-hidden>·</span>
              <Link href="/vi" className="crm-link-subtle">
                Website công khai
              </Link>
            </div>
          </nav>
          <footer className="crm-login-footer">
            <p>© 2026 COHAMY CRM</p>
          </footer>
        </section>
      </main>
    </div>
  );
}
