import { blogPosts } from "@/data/blog";
import { getBlogSearchText } from "@/lib/blog-content";
import type { BlogCategory, BlogPost, Locale } from "@/lib/types";

export { blogPosts };

export function getBlogPostBySlug(
  slug: string,
  locale: Locale,
): BlogPost | undefined {
  return blogPosts.find((post) => post.slug[locale] === slug);
}

export function getFeaturedBlogPosts(): BlogPost[] {
  return blogPosts.filter((post) => post.featured);
}

export function getBlogPostsByCategory(category: BlogCategory): BlogPost[] {
  return blogPosts.filter((post) => post.category === category);
}

export function searchBlogPosts(query: string, locale: Locale): BlogPost[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return blogPosts;

  return blogPosts.filter((post) => {
    const haystack = [
      post.title[locale],
      post.excerpt[locale],
      getBlogSearchText(post.id, locale, post.content.vi),
      ...post.tags,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

export function getRelatedBlogPosts(
  post: BlogPost,
  limit = 3,
): BlogPost[] {
  return blogPosts
    .filter(
      (candidate) =>
        candidate.id !== post.id &&
        (candidate.category === post.category ||
          candidate.tags.some((tag) => post.tags.includes(tag))),
    )
    .slice(0, limit);
}

export function getAllBlogSlugs(): { locale: Locale; slug: string }[] {
  const locales: Locale[] = ["vi", "en", "zh", "ko", "ja"];
  return blogPosts.flatMap((post) =>
    locales.map((locale) => ({
      locale,
      slug: post.slug[locale],
    })),
  );
}

export function extractToc(content: string): { id: string; text: string; level: number }[] {
  const headings: { id: string; text: string; level: number }[] = [];
  const regex = /<h([23])[^>]*id="([^"]+)"[^>]*>(.*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    headings.push({
      level: Number(match[1]),
      id: match[2],
      text: match[3].replace(/<[^>]+>/g, ""),
    });
  }

  return headings;
}