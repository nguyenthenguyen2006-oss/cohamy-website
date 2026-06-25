import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['vi', 'en', 'zh', 'ko', 'ja'],
  defaultLocale: 'en',
  localePrefix: 'always',
  pathnames: {
    '/': '/',
    '/products': {
      vi: '/san-pham',
      en: '/products',
      zh: '/products',
      ko: '/products',
      ja: '/products',
    },
    '/products/[slug]': {
      vi: '/san-pham/[slug]',
      en: '/products/[slug]',
      zh: '/products/[slug]',
      ko: '/products/[slug]',
      ja: '/products/[slug]',
    },
    '/cart': {
      vi: '/gio-hang',
      en: '/cart',
      zh: '/cart',
      ko: '/cart',
      ja: '/cart',
    },
    '/checkout': {
      vi: '/thanh-toan',
      en: '/checkout',
      zh: '/checkout',
      ko: '/checkout',
      ja: '/checkout',
    },
    '/blog': {
      vi: '/bai-viet',
      en: '/blog',
      zh: '/blog',
      ko: '/blog',
      ja: '/blog',
    },
    '/blog/[slug]': {
      vi: '/bai-viet/[slug]',
      en: '/blog/[slug]',
      zh: '/blog/[slug]',
      ko: '/blog/[slug]',
      ja: '/blog/[slug]',
    },
    '/about': {
      vi: '/ve-chung-toi',
      en: '/about',
      zh: '/about',
      ko: '/about',
      ja: '/about',
    },
    '/activities': {
      vi: '/hoat-dong',
      en: '/activities',
      zh: '/activities',
      ko: '/activities',
      ja: '/activities',
    },
    '/contact': {
      vi: '/lien-he',
      en: '/contact',
      zh: '/contact',
      ko: '/contact',
      ja: '/contact',
    },
  },
});

export type Locale = (typeof routing.locales)[number];
export type Pathnames = keyof typeof routing.pathnames;