import { notFound, redirect, RedirectType } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { BlogArticle } from "@/components/BlogArticle";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import {
  getPublicPostBySlug,
  getPublishedTranslations,
  getRelatedPosts,
  getBlogRedirect,
} from "@/lib/blog-repository";
import {
  buildBlogPostUrl,
  getBlogPostRobots,
} from "@/lib/blog-seo";
import type { BlogLocale } from "@/lib/blog-schema";
import { getProductById } from "@/lib/products";
import {
  generateArticleJsonLd,
  generateBlogBreadcrumbJsonLd,
  generatePageMetadata,
  SITE_URL,
} from "@/lib/seo";
import type { Locale } from "@/lib/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

async function articleAlternates(groupId: string) {
  const translations = await getPublishedTranslations(groupId);
  const languages: Record<string, string> = {};

  for (const translation of translations) {
    languages[translation.locale] = `${SITE_URL}${getPathname({
      locale: translation.locale,
      href: {
        pathname: "/blog/[slug]",
        params: { slug: translation.slug },
      },
    })}`;
  }

  const defaultTranslation = translations.find(
    (translation) => translation.locale === routing.defaultLocale,
  );
  if (defaultTranslation) {
    languages["x-default"] = languages[defaultTranslation.locale];
  }

  return languages;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const post = await getPublicPostBySlug(locale as BlogLocale, slug);
  if (!post) return {};
  const canonical = buildBlogPostUrl(post);

  return generatePageMetadata({
    locale,
    pathname: { pathname: "/blog/[slug]", params: { slug } },
    title: post.seo_title || post.title,
    description: post.seo_description || post.excerpt,
    image: post.cover_image || undefined,
    imageAlt: post.cover_image_alt,
    type: "article",
    publishedTime: post.published_at || post.scheduled_at,
    modifiedTime: post.updated_at,
    author: post.author,
    canonicalUrl: canonical,
    alternates: {
      canonical,
      languages: await articleAlternates(post.group_id),
    },
    robots: getBlogPostRobots(post),
    social: post.seo,
    keywords: post.tags,
  });
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const post = await getPublicPostBySlug(locale as BlogLocale, slug);
  if (!post) {
    const destination = await getBlogRedirect(locale as BlogLocale, slug);
    if (destination) redirect(`${SITE_URL}${getPathname({ locale: locale as BlogLocale, href: { pathname: "/blog/[slug]", params: { slug: destination } } })}`, RedirectType.replace);
    notFound();
  }
  const [relatedPosts] = await Promise.all([getRelatedPosts(post)]);
  const publishedAt =
    post.published_at || post.scheduled_at || post.updated_at;
  const articleJsonLd = generateArticleJsonLd({
    locale: locale as Locale,
    title: post.title,
    description: post.excerpt,
    image: post.cover_image,
    slug,
    author: post.author,
    publishedAt,
    modifiedAt: post.updated_at,
    canonicalUrl: buildBlogPostUrl(post),
  });
  const breadcrumbJsonLd = generateBlogBreadcrumbJsonLd({
    locale: locale as Locale,
    slug,
    title: post.title,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</gu, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</gu, "\\u003c") }}
      />
      <BlogArticle
        post={post}
        locale={locale as Locale}
        relatedPosts={relatedPosts}
        featuredProduct={
          post.related_product_ids[0]
            ? getProductById(post.related_product_ids[0])
            : undefined
        }
      />
    </>
  );
}
