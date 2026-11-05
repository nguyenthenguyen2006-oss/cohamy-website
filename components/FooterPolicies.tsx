"use client";

import { Link } from '@/i18n/navigation';
import { STORE_POLICIES } from '@/data/store-policies';
import './store-policies.css';

export function FooterPolicies({ home = false }: { home?: boolean }) {
  return <nav className={`store-footer-policies${home ? ' store-footer-policies-home' : ''}`} aria-label="Chính sách mua hàng" lang="vi">
    <h2>Chính sách mua hàng</h2>
    <ul>{STORE_POLICIES.map(policy => <li key={policy.slug}>
      <Link locale="vi" href={{ pathname: '/policies/[slug]', params: { slug: policy.slug } }}>{policy.title}</Link>
    </li>)}</ul>
  </nav>;
}
