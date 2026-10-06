import type { Metadata, MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import {
  isPublicBlogRow,
  type BlogRow,
} from "@/lib/blog-schema";
import { SITE_URL } from "@/lib/seo";

type BlogUrlSource = Pick<BlogRow, "locale" | "slug">;

export function buildBlogPostPath(post: BlogUrlSource): string {
  return getPathname({
    locale: post.locale,
    href: {
      pathname: "/blog/[slug]",
      params: { slug: post.slug },
    },
  });
}

export function buildBlogPostUrl(post: BlogUrlSource): string {
  return `${SITE_URL}${buildBlogPostPath(post)}`;
}

export function getBlogPostCanonical(post: BlogUrlSource & { canonical_url?: string }): string {
  return getContentCanonical(post.canonical_url, buildBlogPostUrl(post));
}

export function getContentCanonical(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    const url = new URL(value);
    const own = new URL(fallback);
    if (url.protocol !== "https:" || url.origin !== own.origin || url.username || url.password || url.hash || url.search) return fallback;
    const prefix = own.pathname.slice(0, own.pathname.lastIndexOf("/") + 1);
    const slug = url.pathname.slice(prefix.length);
    return url.pathname.startsWith(prefix) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug) ? url.href : fallback;
  } catch {
    return fallback;
  }
}

export function getBlogPostRobots(
  post: Pick<BlogRow, "robots_index" | "seo">,
): Metadata["robots"] {
  return {
    index: post.robots_index,
    follow: post.seo?.follow ?? true,
  };
}

export function isIndexableBlogPost(
  post: BlogRow,
  now = new Date(),
): boolean {
  return Boolean(post.slug) && post.robots_index && isPublicBlogRow(post, now);
}

export function buildBlogSitemapEntries(
  rows: BlogRow[],
  now = new Date(),
): MetadataRoute.Sitemap {
  const posts = rows.filter((post) => isIndexableBlogPost(post, now));
  const grouped = new Map<string, BlogRow[]>();

  for (const post of posts) {
    const group = grouped.get(post.group_id) ?? [];
    group.push(post);
    grouped.set(post.group_id, group);
  }

  return posts.map((post) => {
    const translations = grouped.get(post.group_id) ?? [];
    const languages = Object.fromEntries(
      translations.map((translation) => [
        translation.locale,
        buildBlogPostUrl(translation),
      ]),
    );
    const defaultTranslation = translations.find(
      (translation) => translation.locale === routing.defaultLocale,
    );

    if (defaultTranslation) {
      languages["x-default"] = buildBlogPostUrl(defaultTranslation);
    }

    return {
      url: buildBlogPostUrl(post),
      lastModified: new Date(post.updated_at).toISOString(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
      alternates: { languages },
    };
  });
}
