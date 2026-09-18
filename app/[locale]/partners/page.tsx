import Link from 'next/link';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {hasLocale} from 'next-intl';
import {routing} from '@/i18n/routing';
import {generatePageMetadata} from '@/lib/seo';
import {CONTACT} from '@/lib/contact';
const copy={
 vi:{title:'Dành cho đối tác',lead:'Đăng ký hồ sơ hợp tác và theo dõi kết quả xét duyệt của Cohamy.',register:'Đăng ký đối tác',login:'Đăng nhập đại lý',track:'Theo dõi hồ sơ',steps:['Điền thông tin đơn vị và người đại diện.','Xác minh email rồi gửi hồ sơ xét duyệt.','Bổ sung thông tin nếu Cohamy yêu cầu.','Sau khi được duyệt, đăng nhập cổng đại lý bằng tài khoản đã đăng ký.'],help:'Trao đổi với Cohamy'},
 en:{title:'For partners',lead:'Apply to partner with Cohamy and follow your application review.',register:'Apply as a partner',login:'Dealer sign in',track:'Track application',steps:['Enter your company and representative details.','Verify your email and submit your application.','Update your information if Cohamy requests it.','Once approved, sign in to the dealer portal with your registered account.'],help:'Contact Cohamy'},
 zh:{title:'合作伙伴',lead:'申请与 Cohamy 合作并查看审核进度。',register:'申请合作',login:'经销商登录',track:'查看申请',steps:['填写公司和代表信息。','验证邮箱并提交申请。','根据 Cohamy 的要求补充信息。','审核通过后，使用注册账号登录经销商门户。'],help:'联系 Cohamy'},
 ko:{title:'파트너 안내',lead:'Cohamy 파트너 신청서를 제출하고 심사 결과를 확인하세요.',register:'파트너 신청',login:'대리점 로그인',track:'신청 조회',steps:['회사와 담당자 정보를 입력하세요.','이메일을 인증하고 신청서를 제출하세요.','Cohamy의 요청에 따라 정보를 보완하세요.','승인 후 등록한 계정으로 대리점 포털에 로그인하세요.'],help:'Cohamy 문의'},
 ja:{title:'パートナーの皆様へ',lead:'Cohamyとの取引を申請し、審査の進捗を確認できます。',register:'パートナー申請',login:'販売店ログイン',track:'申請を確認',steps:['会社と担当者の情報を入力してください。','メールアドレスを確認し、申請を送信してください。','Cohamyからの依頼に応じて情報を補足してください。','承認後、登録したアカウントで販売店ポータルにログインしてください。'],help:'Cohamyに連絡'}
};
export async function generateMetadata({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(!hasLocale(routing.locales,locale))return {};return generatePageMetadata({locale,pathname:'/partners',title:copy[locale].title,description:copy[locale].lead});}
export default async function Page({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(!hasLocale(routing.locales,locale))notFound();setRequestLocale(locale);const c=copy[locale];return <main className="max-w-4xl mx-auto px-6 py-12"><h1 className="font-serif text-4xl mb-5">{c.title}</h1><p className="text-[#4A2418]/80 leading-relaxed mb-8">{c.lead}</p><div className="flex flex-wrap gap-4 mb-12"><Link className="bg-[#8C3A1E] text-white px-5 py-3 rounded-md" href="/portal/register">{c.register}</Link><Link className="border border-[#4A2418]/30 px-5 py-3 rounded-md" href="/portal/login">{c.login}</Link><Link className="underline px-2 py-3" href="/portal/application/login">{c.track}</Link></div><ol className="list-decimal pl-6 space-y-5 mb-10">{c.steps.map(s=><li key={s}>{s}</li>)}</ol><a className="underline" href={CONTACT.emailMailto}>{c.help}</a></main>;}
