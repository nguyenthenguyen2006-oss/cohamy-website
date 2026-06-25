import type { Locale } from "@/lib/types";
import { enBlogContent } from "@/data/blog-locale/en";
import { zhBlogContent } from "@/data/blog-locale/zh";
import { koBlogContent } from "@/data/blog-locale/ko";
import { jaBlogContent } from "@/data/blog-locale/ja";

const localeBodies: Record<Locale, Record<string, string>> = {
  vi: {},
  en: enBlogContent,
  zh: zhBlogContent,
  ko: koBlogContent,
  ja: jaBlogContent,
};

export function buildBlogContent(postId: string, viContent: string) {
  return {
    vi: viContent,
    en: enBlogContent[postId] ?? viContent,
    zh: zhBlogContent[postId] ?? enBlogContent[postId] ?? viContent,
    ko: koBlogContent[postId] ?? enBlogContent[postId] ?? viContent,
    ja: jaBlogContent[postId] ?? enBlogContent[postId] ?? viContent,
  };
}

export function getBlogSearchText(postId: string, locale: Locale, viContent: string): string {
  return localeBodies[locale][postId] ?? (locale === "vi" ? viContent : enBlogContent[postId] ?? viContent);
}