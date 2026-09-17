import { loadEnvConfig } from "@next/env";
import { blogPosts } from "@/data/blog";
import { BLOG_LOCALES, type BlogRow } from "@/lib/blog-schema";
import { sanitizeBlogHtml } from "@/lib/blog-sanitize";
import {
  ensureSheetHeader,
  getAllRows,
  upsertRows,
} from "@/lib/google-sheets-blog";

loadEnvConfig(process.cwd(), false);

function legacyRows(): BlogRow[] {
  return blogPosts.flatMap((post) =>
    BLOG_LOCALES.map((locale) => {
      const publishedAt = new Date(post.publishedAt).toISOString();
      return {
        id: `${post.id}-${locale}`,
        group_id: post.id,
        locale,
        slug: post.slug[locale],
        title: post.title[locale],
        excerpt: post.excerpt[locale],
        content_html: sanitizeBlogHtml(post.content[locale]),
        cover_image: post.coverImage,
        cover_image_alt: post.title[locale],
        author: post.author,
        category: post.category,
        tags: [...post.tags],
        featured: post.featured,
        related_product_ids: [...post.relatedProductIds],
        seo_title: post.metaTitle?.[locale] ?? "",
        seo_description: post.metaDescription?.[locale] ?? "",
        canonical_url: "",
        robots_index: true,
        status: "published" as const,
        scheduled_at: "",
        published_at: publishedAt,
        created_at: publishedAt,
        updated_at: publishedAt,
      };
    }),
  );
}

async function main() {
  await ensureSheetHeader();
  const seedRows = legacyRows();
  const result = await upsertRows(seedRows);
  const after = await getAllRows();
  const migrated = after.filter((row) =>
    blogPosts.some((post) => post.id === row.group_id),
  );
  const groupCount = new Set(migrated.map((row) => row.group_id)).size;

  if (groupCount !== blogPosts.length || migrated.length !== seedRows.length) {
    throw new Error(
      `MIGRATION_COUNT_MISMATCH: cần ${blogPosts.length} group/${seedRows.length} dòng, hiện có ${groupCount} group/${migrated.length} dòng`,
    );
  }

  console.log(
    `Migrate hoàn tất: ${groupCount} bài, ${migrated.length} bản ngôn ngữ, tạo ${result.created}, cập nhật ${result.updated}.`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  console.error(`Không thể migrate blog legacy: ${message}`);
  process.exitCode = 1;
});
