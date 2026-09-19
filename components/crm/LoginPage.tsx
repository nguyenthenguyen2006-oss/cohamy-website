import Image from "next/image";
import Link from "next/link";
import { CrmLoginForm } from "./LoginForm";
export function CrmLoginPage() {
  return <div className="crm-login-page"><main className="crm-login"><aside className="work-login-story"><h2>Mỗi khách hàng.<br/>Một hành trình rõ ràng.</h2><p>Theo dõi yêu cầu, giữ nhịp chăm sóc và phối hợp cùng đội ngũ trong một nơi.</p><ol><li>Tiếp nhận yêu cầu mới</li><li>Giao đúng người phụ trách</li><li>Theo dõi đến bước tiếp theo</li></ol></aside><section className="crm-login__box" aria-labelledby="login-title">
    <Link href="/vi" aria-label="Cohamy, website công khai"><Image alt="Cohamy" className="crm-login__logo" src="/images/logo/cohamy-brand-logo.png" width={204} height={42} style={{height:'auto'}} preload/></Link>
    <h1 id="login-title">Đăng nhập</h1><p className="crm-login__lead">Tiếp tục công việc của bạn tại Cohamy.</p><CrmLoginForm/>
    <div className="crm-login__links"><Link href="/crm/forgot-password">Quên mật khẩu</Link><br/><Link href="/portal/register">Đăng ký đối tác</Link><br/><Link href="/portal/application/login">Theo dõi hồ sơ đăng ký</Link><br/><Link href="/vi">Xem website công khai</Link></div><p className="crm-login__footer">© 2026 COHAMY</p>
  </section></main></div>;
}
