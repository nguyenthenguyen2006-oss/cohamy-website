import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { BlogPageClient } from "@/components/BlogPageClient";
import { routing } from "@/i18n/routing";
import { generatePageMetadata } from "@/lib/seo";
import { listPublicPosts } from "@/lib/blog-repository";
import { blogSource } from "@/lib/blog-source";
import { getWordPressReferenceOptions } from "@/lib/wordpress-blog";
import {
  BLOG_CATEGORIES,
  type BlogCategory,
  type BlogLocale,
} from "@/lib/blog-schema";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "seo.blog" });
  return generatePageMetadata({
    locale,
    pathname: "/blog",
    title: t("title"),
    description: t("description"),
  });
}

export default async function BlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 200) : "";
  const requestedCategory =
    typeof query.category === "string" ? query.category : "";
  const category = BLOG_CATEGORIES.includes(
    requestedCategory as BlogCategory,
  )
    ? (requestedCategory as BlogCategory)
    : undefined;
  const page = Math.max(
    1,
    Number(typeof query.page === "string" ? query.page : "1") || 1,
  );
  const result = await listPublicPosts({
    locale: locale as BlogLocale,
    page,
    q,
    category,
    ...Object.fromEntries(["country","topic","subject","location"].map(key=>[key,typeof query[key]==="string" ? query[key].slice(0,64) : undefined])),
  });
  const referenceFilters=Object.fromEntries(["country","topic","subject","location"].map(key=>[key,typeof query[key]==="string" ? query[key].slice(0,64) : ""]));
  const referenceOptions=blogSource()==="wordpress" ? (await Promise.all(["country","topic","subject","location"].map(getWordPressReferenceOptions))).flat() : [];
  return (
    <BlogPageClient
      locale={locale as BlogLocale}
      result={result}
      q={q}
      category={category}
      referenceFilters={referenceFilters}
      referenceOptions={referenceOptions}
    />
  );
}
