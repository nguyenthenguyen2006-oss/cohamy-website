import { blogPosts } from "@/data/blog";
import { BLOG_LOCALES, blogRowSchema, type BlogRow } from "@/lib/blog-schema";
import { sanitizeBlogHtml } from "@/lib/blog-sanitize";

/** Source dates are preserved; this is deliberately separate from mutation normalization. */
export function legacyBlogRows(): BlogRow[] {
  return blogPosts.flatMap((post) => BLOG_LOCALES.map((locale) => {
    const published = new Date(post.publishedAt).toISOString();
    return blogRowSchema.parse({
      id: `${post.id}-${locale}`, group_id: post.id, locale, slug: post.slug[locale],
      title: post.title[locale], excerpt: post.excerpt[locale],
      content_html: sanitizeBlogHtml(post.content[locale]),
      cover_image: post.coverImage, cover_image_alt: post.title[locale], author: post.author,
      category: post.category, tags: [...post.tags], featured: post.featured,
      related_product_ids: [...post.relatedProductIds], seo_title: post.metaTitle?.[locale] ?? "",
      seo_description: post.metaDescription?.[locale] ?? "", canonical_url: "", robots_index: true,
      status: "published", scheduled_at: "", published_at: published,
      created_at: published, updated_at: published,
    });
  }));
}
