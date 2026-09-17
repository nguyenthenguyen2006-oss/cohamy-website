import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import {ADMIN_X_ROBOTS_TAG} from './lib/search-engine-policy';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // Dev tooling must not cover Home in the pinned floating mobile CRM dock.
  devIndicators: false,
  distDir: process.env.CRM_QA_BUILD === 'true' ? '.local/next-crm-work' : process.env.COHAMY_ISOLATED_LOCAL_BUILD === 'true' ? '.local/next-headless' : '.next',
  serverExternalPackages: ['jsdom', 'pg', '@electric-sql/pglite'],
  outputFileTracingIncludes: { '/api/wordpress/analyze': ['./wordpress/rank-math-analysis/**/*'], '/api/crm/**': ['./db/crm/**/*'] },
  outputFileTracingExcludes: { '/*': ['.local/**/*', 'docs/crm/test-results/**/*', '.impeccable/review/**/*'] },
  experimental: { serverComponentsHmrCache: false },
  // Resolve metadata before sending HTTP headers: upstream failures must not stream a fake 200.
  htmlLimitedBots: /.*/,
  async headers() {
    const noIndexHeaders = [
      {
        key: 'X-Robots-Tag',
        value: ADMIN_X_ROBOTS_TAG,
      },
    ];

    return [
      ...['/crm/:path*', '/portal/:path*', '/api/crm/:path*', '/api/orders'].map(source => ({ source, headers: [...noIndexHeaders, { key: 'Cache-Control', value: 'private, no-store' }, { key: 'Referrer-Policy', value: 'no-referrer' }] })),
      {
        source: '/admin/:path*',
        headers: noIndexHeaders,
      },
      {
        source: '/api/admin/:path*',
        headers: noIndexHeaders,
      },
      { source: '/api/wordpress/:path*', headers: [...noIndexHeaders, { key: 'Cache-Control', value: 'private, no-store' }] },
      { source: '/preview/:path*', headers: [...noIndexHeaders, { key: 'Cache-Control', value: 'private, no-store' }, { key: 'Referrer-Policy', value: 'no-referrer' }] },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cohamy.vn',
        pathname: '/uploads/blog/**',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
