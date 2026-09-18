import Link from 'next/link';
import {ApplicantLoginForm} from '@/components/crm/UpgradeForms';
export default function Page(){return <main className="upgrade-public"><header className="portal-page-header"><div><h1>Theo dõi hồ sơ đăng ký</h1><p>Đăng nhập bằng email và mật khẩu đã dùng khi đăng ký.</p></div></header><section className="work-section"><ApplicantLoginForm/></section><div className="upgrade-actions"><Link href="/portal/register">Tạo hồ sơ đối tác</Link><Link href="/portal/login">Đại lý đã duyệt</Link></div></main>;}
