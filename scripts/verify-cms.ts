import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import sharp from "sharp";
import {
  unstable_doesMiddlewareMatch,
  unstable_getResponseFromNextConfig,
} from "next/experimental/testing/server";
import nextConfig from "@/next.config";
import { config as proxyConfig } from "@/proxy";
import { BlogCard } from "@/components/BlogCard";
import { dynamic as blogDetailDynamic } from "@/app/[locale]/blog/[slug]/page";
import { dynamic as blogListDynamic } from "@/app/[locale]/blog/page";
import { dynamic as sitemapDynamic } from "@/app/sitemap.xml/route";
import {
  BLOG_HEADERS,
  blogRowSchema,
  isPublicBlogRow,
  type BlogRow,
} from "@/lib/blog-schema";
import {
  buildBlogPostPath,
  buildBlogPostUrl,
  buildBlogSitemapEntries,
  getBlogPostRobots,
  isIndexableBlogPost,
} from "@/lib/blog-seo";
import { paginatePublicBlogRows } from "@/lib/blog-repository";
import {
  extractTableOfContents,
  sanitizeBlogHtml,
} from "@/lib/blog-sanitize";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  recordLoginFailure,
} from "@/lib/admin-rate-limit";
import { signAdminSession, verifyAdminToken } from "@/lib/admin-session";
import { ADMIN_ROBOTS, ADMIN_X_ROBOTS_TAG } from "@/lib/search-engine-policy";
import { SITE_URL } from "@/lib/seo";
import { processBlogUpload } from "@/lib/upload";
import { ensureSheetHeader } from "@/lib/google-sheets-blog";
import robots from "@/app/robots";

function baseRow(overrides: Partial<BlogRow> = {}): BlogRow {
  const now = new Date().toISOString();
  return {
    id: "test-id",
    group_id: "test-group",
    locale: "vi",
    slug: "bai-viet-hop-le",
    title: "Bài viết hợp lệ",
    excerpt: "Mô tả",
    content_html: "<h2 id=\"noi-dung\">Nội dung</h2>",
    cover_image: "/images/products/cohamy-almond-chocolate-55g.jpg",
    cover_image_alt: "Socola hạnh nhân",
    author: "Cohamy Editorial",
    category: "chocolate",
    tags: ["socola"],
    featured: false,
    related_product_ids: ["cohamy-almond-chocolate"],
    seo_title: "",
    seo_description: "",
    canonical_url: "",
    robots_index: true,
    status: "draft",
    scheduled_at: "",
    published_at: "",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

async function verifySanitizer() {
  const sanitized = sanitizeBlogHtml(`
    <h1>Tiêu đề trùng</h1>
    <h2>Tiêu đề trùng</h2>
    <p onclick="alert(1)">Nội dung<script>alert(1)</script></p>
    <a href="javascript:alert(1)">Xấu</a>
    <a href="https://example.com">Ngoài</a>
  `);
  assert(!sanitized.includes("<h1"));
  assert(!sanitized.includes("<script"));
  assert(!sanitized.includes("onclick"));
  assert(!sanitized.includes("javascript:"));
  assert(sanitized.includes('rel="noopener noreferrer"'));
  const toc = extractTableOfContents(sanitized);
  assert.equal(toc.length, 2);
  assert.notEqual(toc[0].id, toc[1].id);
}

function verifySchemaAndSchedule() {
  assert.deepEqual(BLOG_HEADERS, [
    "id",
    "group_id",
    "locale",
    "slug",
    "title",
    "excerpt",
    "content_html",
    "cover_image",
    "cover_image_alt",
    "author",
    "category",
    "tags",
    "featured",
    "related_product_ids",
    "seo_title",
    "seo_description",
    "canonical_url",
    "robots_index",
    "status",
    "scheduled_at",
    "published_at",
    "created_at",
    "updated_at",
  ]);
  assert(blogRowSchema.safeParse(baseRow()).success);
  assert(
    !blogRowSchema.safeParse(baseRow({ slug: "Slug Sai" })).success,
  );
  for (const invalidSlug of [
    "foo?bar",
    "foo#bar",
    "foo/bar",
    "foo\\bar",
    "foo%20bar",
    "-foo",
    "foo-",
    "foo--bar",
  ]) {
    assert(!blogRowSchema.safeParse(baseRow({ slug: invalidSlug })).success);
  }
  assert(
    !blogRowSchema.safeParse(
      baseRow({ related_product_ids: ["khong-ton-tai"] }),
    ).success,
  );
  assert(!isPublicBlogRow(baseRow({ status: "draft" })));
  assert(isPublicBlogRow(baseRow({ status: "published" })));
  assert(
    !isPublicBlogRow(
      baseRow({
        status: "scheduled",
        scheduled_at: new Date(Date.now() + 60_000).toISOString(),
      }),
    ),
  );
  assert(
    isPublicBlogRow(
      baseRow({
        status: "scheduled",
        scheduled_at: new Date(Date.now() - 60_000).toISOString(),
      }),
    ),
  );
}

function verifySearchIndexContract() {
  const updatedAt = "2026-07-28T08:30:00.000Z";
  const publishedVi = baseRow({
    id: "published-vi",
    group_id: "published-group",
    locale: "vi",
    slug: "bai-da-xuat-ban",
    status: "published",
    robots_index: true,
    canonical_url: "https://example.com/wrong-canonical",
    published_at: "2026-07-27T08:30:00.000Z",
    updated_at: updatedAt,
  });
  const publishedEn = baseRow({
    id: "published-en",
    group_id: "published-group",
    locale: "en",
    slug: "published-post",
    status: "published",
    robots_index: true,
    published_at: "2026-07-27T08:30:00.000Z",
    updated_at: updatedAt,
  });
  const pastScheduled = baseRow({
    id: "past-scheduled",
    group_id: "past-scheduled-group",
    slug: "bai-da-den-lich",
    status: "scheduled",
    robots_index: true,
    scheduled_at: "2026-07-27T08:30:00.000Z",
    updated_at: updatedAt,
  });
  const draft = baseRow({
    id: "draft",
    group_id: "draft-group",
    slug: "bai-nhap",
    status: "draft",
  });
  const archived = baseRow({
    id: "archived",
    group_id: "archived-group",
    slug: "bai-luu-tru",
    status: "archived",
  });
  const futureScheduled = baseRow({
    id: "future-scheduled",
    group_id: "future-scheduled-group",
    slug: "bai-chua-den-lich",
    status: "scheduled",
    scheduled_at: "2026-07-29T08:30:00.000Z",
  });
  const noindexPublished = baseRow({
    id: "published-noindex",
    group_id: "published-noindex-group",
    slug: "bai-khong-index",
    status: "published",
    robots_index: false,
  });
  const now = new Date("2026-07-28T12:00:00.000Z");
  const canonical = `${SITE_URL}/vi/bai-viet/bai-da-xuat-ban`;

  assert.equal(buildBlogPostPath(publishedVi), "/vi/bai-viet/bai-da-xuat-ban");
  assert.equal(buildBlogPostUrl(publishedVi), canonical);
  assert.notEqual(buildBlogPostUrl(publishedVi), publishedVi.canonical_url);
  assert.deepEqual(getBlogPostRobots(publishedVi), {
    index: true,
    follow: true,
  });
  assert.deepEqual(getBlogPostRobots(noindexPublished), {
    index: false,
    follow: true,
  });

  assert(isIndexableBlogPost(publishedVi, now));
  assert(isIndexableBlogPost(pastScheduled, now));
  assert(!isIndexableBlogPost(draft, now));
  assert(!isIndexableBlogPost(archived, now));
  assert(!isIndexableBlogPost(futureScheduled, now));
  assert(!isIndexableBlogPost(noindexPublished, now));

  const sitemapEntries = buildBlogSitemapEntries(
    [
      publishedVi,
      publishedEn,
      pastScheduled,
      draft,
      archived,
      futureScheduled,
      noindexPublished,
    ],
    now,
  );
  assert.equal(sitemapEntries.length, 3);
  const viEntry = sitemapEntries.find((entry) => entry.url === canonical);
  assert(viEntry);
  assert.equal(viEntry.lastModified, updatedAt);
  assert.equal(
    viEntry.alternates?.languages?.vi,
    `${SITE_URL}/vi/bai-viet/bai-da-xuat-ban`,
  );
  assert.equal(
    viEntry.alternates?.languages?.en,
    `${SITE_URL}/en/blog/published-post`,
  );
  assert.equal(
    viEntry.alternates?.languages?.["x-default"],
    `${SITE_URL}/en/blog/published-post`,
  );

  const intlProviderProps = {
    locale: "vi",
    now,
    timeZone: "Asia/Ho_Chi_Minh",
    onError: () => {},
    messages: {
      blog: {
        minRead: "phút đọc",
        readMore: "Đọc thêm",
      },
    },
  } as unknown as Parameters<typeof NextIntlClientProvider>[0];
  const listHtml = renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      intlProviderProps,
      createElement(BlogCard, { post: publishedVi }),
    ),
  );
  assert.match(
    listHtml,
    /<a[^>]+href="\/vi\/bai-viet\/bai-da-xuat-ban"/u,
  );

  const robotsFile = robots();
  const rules = Array.isArray(robotsFile.rules)
    ? robotsFile.rules
    : [robotsFile.rules];
  const disallowed = rules.flatMap((rule) =>
    Array.isArray(rule.disallow)
      ? rule.disallow
      : rule.disallow
        ? [rule.disallow]
        : [],
  );
  assert.equal(robotsFile.sitemap, `${SITE_URL}/sitemap.xml`);
  const articlePath = buildBlogPostPath(publishedVi);
  assert(
    !disallowed.some((pathValue) => {
      const prefix = pathValue.split("*", 1)[0];
      return Boolean(prefix) && articlePath.startsWith(prefix);
    }),
  );

  assert.deepEqual(ADMIN_ROBOTS, { index: false, follow: false });
  assert.match(ADMIN_X_ROBOTS_TAG, /\bnoindex\b/u);
  assert.equal(blogDetailDynamic, "force-dynamic");
  assert.equal(blogListDynamic, "force-dynamic");
  assert.equal(sitemapDynamic, "force-dynamic");
}

function verifyCrawlableListingPagination() {
  const posts = Array.from({ length: 25 }, (_, index) =>
    baseRow({
      id: `listing-${index}`,
      group_id: `listing-group-${index}`,
      slug: `bai-danh-sach-${index}`,
      status: "published",
      featured: index === 20,
      published_at: new Date(
        Date.UTC(2026, 6, 28, 12, 0, 0) - index * 60_000,
      ).toISOString(),
    }),
  );
  const pages = [1, 2, 3].map((page) =>
    paginatePublicBlogRows(posts, {
      page,
      pageSize: 12,
      showFeatured: true,
    }),
  );
  const listedIds = pages.flatMap((result) => [
    ...(result.featured ? [result.featured.id] : []),
    ...result.items.map((post) => post.id),
  ]);

  assert.equal(pages[0].featured?.id, "listing-20");
  assert.equal(pages[1].featured, undefined);
  assert.equal(listedIds.length, posts.length);
  assert.equal(new Set(listedIds).size, posts.length);
  assert.deepEqual(
    [...listedIds].sort(),
    posts.map((post) => post.id).sort(),
  );
}

async function verifyAuthAndRateLimit() {
  process.env.ADMIN_SESSION_SECRET = "x".repeat(48);
  const token = await signAdminSession("cms-admin");
  const session = await verifyAdminToken(token);
  assert.equal(session?.username, "cms-admin");
  assert.equal(await verifyAdminToken(`${token}x`), null);

  const ip = "203.0.113.15";
  clearLoginFailures(ip);
  for (let index = 0; index < 5; index += 1) {
    assert(checkLoginRateLimit(ip).allowed);
    recordLoginFailure(ip);
  }
  assert(!checkLoginRateLimit(ip).allowed);
  clearLoginFailures(ip);
}

async function verifyNextConfigSearchHeaders() {
  for (const pathname of ["/admin", "/admin/posts", "/api/admin/posts"]) {
    const response = await unstable_getResponseFromNextConfig({
      url: `${SITE_URL}${pathname}`,
      nextConfig,
    });
    assert.equal(
      response.headers.get("x-robots-tag"),
      ADMIN_X_ROBOTS_TAG,
    );
  }

  const articleResponse = await unstable_getResponseFromNextConfig({
    url: `${SITE_URL}/vi/bai-viet/bai-da-xuat-ban`,
    nextConfig,
  });
  assert.equal(articleResponse.headers.get("x-robots-tag"), null);
}

async function verifyUpload() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cohamy-upload-test-"));
  process.env.UPLOAD_DIR = directory;
  process.env.NEXT_PUBLIC_UPLOAD_BASE_URL =
    "https://cohamy.vn/uploads/blog";

  try {
    const source = await sharp({
      create: {
        width: 2200,
        height: 1200,
        channels: 3,
        background: "#b38b56",
      },
    })
      .png()
      .toBuffer();
    const uploaded = await processBlogUpload(
      new File([source], "large.png", { type: "image/png" }),
    );
    assert(uploaded.url.endsWith(".webp"));
    assert(uploaded.width <= 1920);
    const outputBuffer = await readFile(
      path.join(directory, path.basename(uploaded.url)),
    );
    const uploadedImage = sharp(outputBuffer);
    const metadata = await uploadedImage.metadata();
    assert.equal(metadata.format, "webp");
    uploadedImage.destroy();

    await assert.rejects(
      processBlogUpload(
        new File(
          [
            '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
          ],
          "image.svg",
          { type: "image/svg+xml" },
        ),
      ),
      /UNSUPPORTED_IMAGE_TYPE/u,
    );
    await assert.rejects(
      processBlogUpload(
        new File([new Uint8Array(8 * 1024 * 1024 + 1)], "large.png", {
          type: "image/png",
        }),
      ),
      /UPLOAD_TOO_LARGE/u,
    );
  } finally {
    await rm(directory, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  }
}

async function verifyMissingSheetsConfiguration() {
  const keys = [
    "GOOGLE_SHEETS_SPREADSHEET_ID",
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_PRIVATE_KEY",
  ] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];

  try {
    await assert.rejects(ensureSheetHeader(), /BLOG_SHEETS_NOT_CONFIGURED/u);
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function verifyProxyMatcher() {
  const nextConfig = {};
  assert.equal(
    unstable_doesMiddlewareMatch({
      config: proxyConfig,
      nextConfig,
      url: "/admin/posts",
    }),
    false,
  );
  assert.equal(
    unstable_doesMiddlewareMatch({
      config: proxyConfig,
      nextConfig,
      url: "/api/admin/posts",
    }),
    false,
  );
  assert.equal(
    unstable_doesMiddlewareMatch({
      config: proxyConfig,
      nextConfig,
      url: "/uploads/blog/image.webp",
    }),
    false,
  );
  assert.equal(
    unstable_doesMiddlewareMatch({
      config: proxyConfig,
      nextConfig,
      url: "/vi/bai-viet",
    }),
    true,
  );
}

async function main() {
  await verifySanitizer();
  verifySchemaAndSchedule();
  verifySearchIndexContract();
  verifyCrawlableListingPagination();
  await verifyAuthAndRateLimit();
  await verifyNextConfigSearchHeaders();
  await verifyUpload();
  await verifyMissingSheetsConfiguration();
  verifyProxyMatcher();
  console.log(
    "CMS verification passed: sanitizer, schema, schedule, SEO/index contract, crawlable pagination, auth, rate limit, upload và proxy matcher.",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
