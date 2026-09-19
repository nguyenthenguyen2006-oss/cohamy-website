import Image from 'next/image';
import Link from 'next/link';
import {Suspense} from 'react';
import {ResetPasswordForm} from '@/components/crm/SecurityForms';
export default function ResetPasswordPage(){return <div className="crm-login-page"><main className="crm-login"><aside className="work-login-story"><h2>Đặt lại mật khẩu.<br/>Giữ nguyên lớp bảo vệ.</h2><p>Mọi phiên cũ sẽ kết thúc sau khi đổi thành công.</p></aside><section className="crm-login__box" aria-labelledby="reset-title"><Link href="/vi"><Image alt="Cohamy" className="crm-login__logo" src="/images/logo/cohamy-brand-logo.png" width={204} height={42}/></Link><h1 id="reset-title">Mật khẩu mới</h1><Suspense fallback={<p>Đang kiểm tra liên kết…</p>}><ResetPasswordForm/></Suspense></section></main></div>;}
