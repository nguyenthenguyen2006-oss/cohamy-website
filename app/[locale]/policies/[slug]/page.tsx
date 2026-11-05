import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { STORE_POLICIES, getStorePolicy } from '@/data/store-policies';
import { CONTACT, getAddresses, getCompanyName } from '@/lib/contact';
import { SITE_URL } from '@/lib/seo';
import '@/components/store-policies.css';

export async function generateMetadata({ params }: { params: Promise<{locale: string; slug: string}> }): Promise<Metadata> {
  const {slug} = await params;
  const policy = getStorePolicy(slug);
  if (!policy) return {};
  return {title: `${policy.title} | Cohamy`, description: policy.summary,
    alternates: {canonical: `${SITE_URL}/vi/chinh-sach/${policy.slug}`},
    openGraph: {title: policy.title, description: policy.summary, locale: 'vi_VN', type: 'article'}};
}

export default async function PolicyPage({ params }: { params: Promise<{locale: string; slug: string}> }) {
  const {locale, slug} = await params;
  const policy = getStorePolicy(slug);
  if (!policy) notFound();
  if (locale !== 'vi') redirect(`/vi/chinh-sach/${policy.slug}`);
  setRequestLocale('vi');
  return <div className="store-policy-page" lang="vi">
    <Link href="/products" className="store-policy-back">Trở về sản phẩm</Link>
    <header className="store-policy-heading">
      <h1>{policy.title}</h1><p>{policy.summary}</p>
      <small>Cập nhật: {new Date(`${policy.updatedAt}T00:00:00+07:00`).toLocaleDateString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh'})} · Áp dụng cho mua hàng trên cohamy.vn</small>
    </header>
    <div className="store-policy-layout">
      <nav className="store-policy-nav" aria-label="Các chính sách mua hàng">
        <h2>Chính sách mua hàng</h2>
        {STORE_POLICIES.map(item => <Link key={item.slug} href={{pathname: '/policies/[slug]', params: {slug: item.slug}}} aria-current={item.slug === slug ? 'page' : undefined}>{item.title}</Link>)}
      </nav>
      <article className="store-policy-body">
        {policy.sections.map(section => <section id={section.id} key={section.id}>
          <h2>{section.title}</h2>
          {section.paragraphs?.map((text, index) => <p key={index}>{text}</p>)}
          {section.items?.length ? <ul>{section.items.map((text, index) => <li key={index}>{text}</li>)}</ul> : null}
        </section>)}
        <section className="store-policy-contact">
          <h2>Liên hệ Cohamy</h2><p>{getCompanyName('vi')}</p>
          <p>Điện thoại: <a href={CONTACT.phoneTel}>{CONTACT.phoneDisplay}</a><br/>Email: <a href={CONTACT.emailMailto}>{CONTACT.email}</a></p>
          <p>Văn phòng Hà Nội: {getAddresses('vi').hanoi}<br/>Văn phòng TP. Hồ Chí Minh: {getAddresses('vi').hcmc}</p>
          <p><Link href="/contact">Gửi yêu cầu liên hệ</Link></p>
        </section>
      </article>
    </div>
  </div>;
}
