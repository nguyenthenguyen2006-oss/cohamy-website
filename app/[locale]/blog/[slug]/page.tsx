import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { hasLocale } from "next-intl";
import { BlogArticle } from "@/components/BlogArticle";
import { routing } from "@/i18n/routing";
import { getAllBlogSlugs, getBlogPostBySlug, getRelatedBlogPosts } from "@/lib/blog";
import { getProductById } from "@/lib/products";
import { generateArticleJsonLd, generatePageMetadata } from "@/lib/seo";
import type { Locale } from "@/lib/types";
import type { Metadata } from "next";

export function generateStaticParams() {
  return getAllBlogSlugs().map(({ locale, slug }) => ({ locale, slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const post = getBlogPostBySlug(slug, locale as Locale);
  if (!post) return {};

  const title =
    post.metaTitle?.[locale as Locale] ?? post.title[locale as Locale];
  const description =
    post.metaDescription?.[locale as Locale] ?? post.excerpt[locale as Locale];

  return generatePageMetadata({
    locale,
    pathname: { pathname: "/blog/[slug]", params: { slug } },
    title,
    description,
    image: post.coverImage,
    type: "article",
    publishedTime: post.publishedAt,
  });
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const post = getBlogPostBySlug(slug, locale as Locale);
  if (!post) notFound();

  const jsonLd = generateArticleJsonLd({
    locale: locale as Locale,
    title: post.title[locale as Locale],
    description: post.excerpt[locale as Locale],
    image: post.coverImage,
    slug,
    author: post.author,
    publishedAt: post.publishedAt,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BlogArticle
        post={post}
        locale={locale as Locale}
        relatedPosts={getRelatedBlogPosts(post)}
        featuredProduct={
          post.relatedProductIds[0]
            ? getProductById(post.relatedProductIds[0])
            : undefined
        }
      />
    </>
  );
}