import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import { assertLegacyBlogWrites, blogSource } from "@/lib/blog-source";
import { legacyBlogRows } from "@/lib/blog-legacy";
import { getWordPressSnapshot, getWordPressContent, getWordPressRedirect, listWordPressContent, WORDPRESS_BLOG_TAG } from "@/lib/wordpress-blog";
import {
  archiveRow,
  createRow,
  getAllRows,
  isBlogSheetsConfigured,
  updateRow,
  upsertRows,
} from "@/lib/google-sheets-blog";
import {
  isPublicBlogRow,
  type BlogCategory,
  type BlogLocale,
  type BlogRow,
  type BlogStatus,
} from "@/lib/blog-schema";

export const BLOG_ROWS_CACHE_TAG = "cohamy-blog-rows";
const BLOG_CACHE_GENERATION_KEY = "__cohamyBlogCacheGeneration";

type BlogCacheGlobal = typeof globalThis & {
  [BLOG_CACHE_GENERATION_KEY]?: number;
};

function cacheGeneration(): number {
  return (globalThis as BlogCacheGlobal)[BLOG_CACHE_GENERATION_KEY] ?? 0;
}

const getCachedRows = unstable_cache(
  async (generation: number) => {
    void generation;
    return getAllRows();
  },
  [BLOG_ROWS_CACHE_TAG],
  {
    revalidate: 60,
    tags: [BLOG_ROWS_CACHE_TAG],
  },
);

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PublicBlogPage extends PageResult<BlogRow> {
  featured?: BlogRow;
}

export function paginatePublicBlogRows(
  all: BlogRow[],
  options: {
    page: number;
    pageSize: number;
    showFeatured: boolean;
  },
): PublicBlogPage {
  const featured = options.showFeatured
    ? [...all]
        .filter((row) => row.featured)
        .sort(publishedFirst)[0]
    : undefined;

  if (!featured) {
    const totalPages = Math.max(1, Math.ceil(all.length / options.pageSize));
    const safePage = Math.min(options.page, totalPages);
    return {
      items: all.slice(
        (safePage - 1) * options.pageSize,
        safePage * options.pageSize,
      ),
      page: safePage,
      pageSize: options.pageSize,
      totalItems: all.length,
      totalPages,
    };
  }

  const remaining = all.filter((row) => row.id !== featured.id);
  const firstPageCapacity = Math.max(0, options.pageSize - 1);
  const totalPages =
    remaining.length <= firstPageCapacity
      ? 1
      : 1 +
        Math.ceil(
          (remaining.length - firstPageCapacity) / options.pageSize,
        );
  const safePage = Math.min(options.page, totalPages);
  const start =
    safePage === 1
      ? 0
      : firstPageCapacity + (safePage - 2) * options.pageSize;
  const capacity = safePage === 1 ? firstPageCapacity : options.pageSize;

  return {
    items: remaining.slice(start, start + capacity),
    featured: safePage === 1 ? featured : undefined,
    page: safePage,
    pageSize: options.pageSize,
    totalItems: all.length,
    totalPages,
  };
}

async function rows(): Promise<BlogRow[]> {
  if (blogSource() === "wordpress") return (await getWordPressSnapshot()).posts;
  if (blogSource() === "legacy") return legacyBlogRows();
  return getCachedRows(cacheGeneration());
}

async function publicRows(): Promise<BlogRow[]> {
  if (blogSource() === "sheets" && !isBlogSheetsConfigured()) throw new Error("BLOG_SHEETS_NOT_CONFIGURED");
  return rows();
}

function newestFirst(a: BlogRow, b: BlogRow): number {
  return (
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

function publishedFirst(a: BlogRow, b: BlogRow): number {
  const left = Date.parse(a.published_at || a.scheduled_at || a.updated_at);
  const right = Date.parse(b.published_at || b.scheduled_at || b.updated_at);
  return right - left;
}

function matchesQuery(row: BlogRow, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase(row.locale);
  if (!normalized) return true;
  return [row.title, row.excerpt, ...row.tags]
    .join(" ")
    .toLocaleLowerCase(row.locale)
    .includes(normalized);
}

export function invalidateBlogCache(): void {
  const scope = globalThis as BlogCacheGlobal;
  scope[BLOG_CACHE_GENERATION_KEY] = cacheGeneration() + 1;
  revalidateTag(BLOG_ROWS_CACHE_TAG, { expire: 0 });
  revalidateTag(WORDPRESS_BLOG_TAG, { expire: 0 });
}

export async function listPublicPosts(options: {
  locale: BlogLocale;
  page?: number;
  q?: string;
  category?: BlogCategory;
  pageSize?: number;
  country?:string;topic?:string;subject?:string;location?:string;
}): Promise<PublicBlogPage> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(12, Math.max(1, options.pageSize ?? 12));
  const query = options.q?.trim() ?? "";
  if (blogSource() === "wordpress") return listWordPressContent({ locale: options.locale, page, page_size: pageSize, q: query, category: options.category,country:options.country,topic:options.topic,subject:options.subject,location:options.location, show_featured: !query && !options.category && !options.country && !options.topic && !options.subject && !options.location ? "1" : undefined });
  const all = (await publicRows())
    .filter(
      (row) =>
        row.locale === options.locale &&
        isPublicBlogRow(row) &&
        (!options.category || row.category === options.category) &&
        matchesQuery(row, query),
    )
    .sort(publishedFirst);

  return paginatePublicBlogRows(all, {
    page,
    pageSize,
    showFeatured: !query && !options.category,
  });
}

export async function listAdminPosts(options: {
  page?: number;
  pageSize?: number;
  q?: string;
  locale?: BlogLocale;
  category?: BlogCategory;
  status?: BlogStatus;
}): Promise<PageResult<BlogRow>> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
  const filtered = (await rows())
    .filter(
      (row) =>
        (!options.locale || row.locale === options.locale) &&
        (!options.category || row.category === options.category) &&
        (!options.status || row.status === options.status) &&
        matchesQuery(row, options.q ?? ""),
    )
    .sort(newestFirst);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  return {
    items: filtered.slice(
      (safePage - 1) * pageSize,
      safePage * pageSize,
    ),
    page: safePage,
    pageSize,
    totalItems: filtered.length,
    totalPages,
  };
}

export async function getAdminPostById(
  id: string,
): Promise<BlogRow | undefined> {
  return (await rows()).find((row) => row.id === id);
}

export async function getAllAdminRows(): Promise<BlogRow[]> {
  return [...(await rows())];
}

export async function getPublicPostBySlug(
  locale: BlogLocale,
  slug: string,
): Promise<BlogRow | undefined> {
  if (blogSource() === "wordpress") return getWordPressContent(locale, slug);
  return (await publicRows()).find(
    (row) =>
      row.locale === locale &&
      row.slug === slug &&
      isPublicBlogRow(row),
  );
}

export async function getRelatedPosts(
  post: BlogRow,
  limit = 3,
): Promise<BlogRow[]> {
  if (blogSource() === "wordpress") return (await listWordPressContent({ locale: post.locale, category: post.category, exclude: post.id, page_size: limit })).items;
  return (await publicRows())
    .filter(
      (candidate) =>
        candidate.id !== post.id &&
        candidate.locale === post.locale &&
        isPublicBlogRow(candidate) &&
        (candidate.category === post.category ||
          candidate.tags.some((tag) => post.tags.includes(tag))),
    )
    .sort(publishedFirst)
    .slice(0, limit);
}

export async function getPublishedTranslations(
  groupId: string,
): Promise<BlogRow[]> {
  if (blogSource() === "wordpress") {
    const groups = await Promise.all((["vi", "en", "zh", "ko", "ja"] as const).map(locale => listWordPressContent({ locale, group: groupId, page_size: 1 })));
    return groups.flatMap(group => group.items).filter(row => row.robots_index);
  }
  return (await publicRows())
    .filter(
      (row) => row.group_id === groupId && row.robots_index && isPublicBlogRow(row),
    )
    .sort((a, b) => a.locale.localeCompare(b.locale));
}

export async function getAllPublicPosts(): Promise<BlogRow[]> {
  return (await publicRows()).filter((row) => isPublicBlogRow(row));
}

export async function getFeaturedPosts(
  locale: BlogLocale,
  limit = 3,
): Promise<BlogRow[]> {
  if (blogSource() === "wordpress") return (await listWordPressContent({ locale, featured: "1", page_size: limit })).items;
  return (await publicRows())
    .filter(
      (row) =>
        row.locale === locale && row.featured && isPublicBlogRow(row),
    )
    .sort(publishedFirst)
    .slice(0, limit);
}

export async function getAdminStats(): Promise<{
  total: number;
  draft: number;
  scheduled: number;
  published: number;
  archived: number;
  missingSeoTitle: number;
  missingSeoDescription: number;
  missingImageAlt: number;
}> {
  const all = await rows();
  return {
    total: all.length,
    draft: all.filter((row) => row.status === "draft").length,
    scheduled: all.filter((row) => row.status === "scheduled").length,
    published: all.filter((row) => row.status === "published").length,
    archived: all.filter((row) => row.status === "archived").length,
    missingSeoTitle: all.filter((row) => !row.seo_title).length,
    missingSeoDescription: all.filter((row) => !row.seo_description).length,
    missingImageAlt: all.filter(
      (row) => row.cover_image && !row.cover_image_alt,
    ).length,
  };
}

export async function repositoryCreateRow(row: BlogRow): Promise<BlogRow> {
  assertLegacyBlogWrites();
  const result = await createRow(row);
  invalidateBlogCache();
  return result;
}

export async function repositoryUpdateRow(
  id: string,
  row: BlogRow,
): Promise<BlogRow> {
  assertLegacyBlogWrites();
  const result = await updateRow(id, row);
  invalidateBlogCache();
  return result;
}

export async function repositoryArchiveRow(id: string): Promise<BlogRow> {
  assertLegacyBlogWrites();
  const result = await archiveRow(id);
  invalidateBlogCache();
  return result;
}

export async function repositoryUpsertRows(
  blogRows: BlogRow[],
): Promise<{ created: number; updated: number }> {
  assertLegacyBlogWrites();
  const result = await upsertRows(blogRows);
  invalidateBlogCache();
  return result;
}

export async function getBlogRedirect(locale: BlogLocale, slug: string): Promise<string | undefined> {
  if (blogSource() !== "wordpress") return undefined;
  return getWordPressRedirect(locale, slug);
}
