import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getWordPressContent, listWordPressContent } from "@/lib/wordpress-blog";
import { blogSource } from "@/lib/blog-source";
import { SITE_URL } from "@/lib/seo";
import { getBlogPostRobots } from "@/lib/blog-seo";
import { WordPressPageContent } from "@/components/WordPressPageContent";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{locale: string; slug: string}> };
function path(locale: string, slug: string) { return `/${locale}/${locale === "vi" ? "noi-dung" : "pages"}/${slug}`; }
export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale, slug} = await params;
  if (!hasLocale(routing.locales,locale) || blogSource() !== "wordpress") return {};
  const post = await getWordPressContent(locale,slug,"page"); if (!post) return {};
  const canonical = SITE_URL + path(locale,slug); const languages: Record<string,string> = {};
  const translations = await Promise.all(routing.locales.map(locale => listWordPressContent({type:"page",locale,group:post.group_id,page_size:1})));
  for (const item of translations.flatMap(group => group.items).filter(item => item.robots_index)) languages[item.locale] = SITE_URL + path(item.locale,item.slug);
  if (languages[routing.defaultLocale]) languages["x-default"] = languages[routing.defaultLocale];
  return {title:post.seo_title || post.title, description:post.seo_description || post.excerpt, robots:getBlogPostRobots(post), alternates:{canonical,languages}, openGraph:{type:"website",url:canonical,title:post.seo?.facebook_title || post.seo_title || post.title,description:post.seo?.facebook_description || post.seo_description,images:post.seo?.facebook_image || post.cover_image ? [post.seo?.facebook_image || post.cover_image] : []}, twitter:{card:post.seo?.twitter_card_type === "summary" ? "summary" : "summary_large_image",title:post.seo?.twitter_title || post.seo_title,description:post.seo?.twitter_description || post.seo_description,images:post.seo?.twitter_image || post.cover_image ? [post.seo?.twitter_image || post.cover_image] : []}};
}
export default async function ManagedPage({params}: Props) {
  const {locale,slug} = await params; if (!hasLocale(routing.locales,locale) || blogSource() !== "wordpress") notFound(); setRequestLocale(locale);
  const post = await getWordPressContent(locale,slug,"page"); if (!post) notFound();
  const schema = {"@context":"https://schema.org","@type":"WebPage",url:SITE_URL+path(locale,slug),name:post.title,datePublished:post.published_at,dateModified:post.updated_at,inLanguage:locale};
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</gu,"\\u003c")}}/><WordPressPageContent post={post}/></>;
}
