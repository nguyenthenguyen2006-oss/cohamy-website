import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { assertPermission, CrmError } from './permissions';
import { assertCurrentPrincipal, audit } from './auth';
import { database } from './db';
import type { Principal } from './types';
import {parseCommercial} from './commercial-common';
import { listAdminPosts, getAdminPostById, getAllPublicPosts, repositoryCreateRow, repositoryUpdateRow, repositoryArchiveRow, type PageResult } from '@/lib/blog-repository';
import { blogSource } from '@/lib/blog-source';
import { storeCrmArticle } from '@/lib/blog-crm-store';
import { sanitizeBlogHtml } from '@/lib/blog-sanitize';
import { buildBlogPostPath } from '@/lib/blog-seo';
import { type BlogRow, type BlogStatus, type BlogLocale, type BlogCategory, BLOG_LOCALES, BLOG_CATEGORIES, BLOG_STATUSES, blogEditableSchema } from '@/lib/blog-schema';

const articleInputSchema = z.object({
  id: z.string().trim().optional(), expectedUpdatedAt: z.string().optional(),
  groupId: z.string().trim().min(1).optional(), locale: z.enum(BLOG_LOCALES).default('vi'),
  slug: z.string().trim().min(1).max(180), title: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().optional(), summary: z.string().trim().optional(),
  contentHtml: z.string().max(180000).optional(), content: z.string().max(180000).optional(),
  coverImage: z.string().trim().default(''), coverImageAlt: z.string().trim().default(''),
  author: z.string().trim().default('Cohamy'), category: z.enum(BLOG_CATEGORIES).default('brand-story'),
  tags: z.array(z.string().trim()).default([]), featured: z.boolean().default(false),
  relatedProductIds: z.array(z.string().trim()).default([]),
  seoTitle: z.string().trim().default(''), seoDescription: z.string().trim().default(''),
  canonicalUrl: z.string().trim().default(''), robotsIndex: z.boolean().default(true),
  status: z.enum(BLOG_STATUSES).default('draft'), scheduledAt: z.string().default(''), publishedAt: z.string().default(''),
  reason: z.string().trim().optional(), idempotencyKey: z.string().trim().optional(),
}).strict();

export async function listCrmArticles(user: Principal, options: {page?: number; pageSize?: number; q?: string; locale?: BlogLocale; category?: BlogCategory; status?: BlogStatus} = {}): Promise<PageResult<BlogRow>> {
  assertPermission(user, 'articles.read');
  return listAdminPosts(options);
}
export async function getCrmArticle(user: Principal, id: string): Promise<BlogRow> {
  assertPermission(user, 'articles.read');
  const post = await getAdminPostById(id);
  if (!post) throw new CrmError('NOT_FOUND', 404);
  return post;
}
function writableSource() {
  if (blogSource() === 'wordpress') throw new CrmError('ARTICLE_WORDPRESS_WRITE_UNAVAILABLE', 409);
}
async function persist(user: Principal, row: BlogRow, action: string, expectedUpdatedAt?: string) {
  writableSource();
  return (await database()).transaction(async sql => {
    await assertCurrentPrincipal(sql, user);
    const result = blogSource() === 'legacy'
      ? await storeCrmArticle(sql, row, user.id, action, expectedUpdatedAt)
      : action === 'created' ? await repositoryCreateRow(row)
      : action === 'archived' ? await repositoryArchiveRow(row.id)
      : await repositoryUpdateRow(row.id, row);
    await audit(sql, user.id, 'article.' + action, result.id, {slug: result.slug, status: result.status});
    return result;
  });
}
export async function saveCrmArticle(user: Principal, input: unknown): Promise<BlogRow> {
  assertPermission(user, 'articles.write');
  const data = parseCommercial(articleInputSchema,input);
  const existing = data.id ? await getCrmArticle(user, data.id) : undefined;
  const now = new Date().toISOString();
  const content = sanitizeBlogHtml(data.contentHtml ?? data.content ?? '<p></p>');
  const excerpt = data.excerpt ?? data.summary ?? '';
  const row: BlogRow = {
    ...existing,
    id: data.id || randomUUID(), group_id: data.groupId ?? existing?.group_id ?? randomUUID(),
    locale: data.locale, slug: data.slug, title: data.title, excerpt, content_html: content,
    cover_image: data.coverImage, cover_image_alt: data.coverImageAlt, author: data.author,
    category: data.category, tags: data.tags, featured: data.featured, related_product_ids: data.relatedProductIds,
    seo_title: data.seoTitle || data.title, seo_description: data.seoDescription || excerpt,
    canonical_url: data.canonicalUrl, robots_index: data.robotsIndex, status: data.status,
    scheduled_at: data.scheduledAt, published_at: data.status === 'published' ? data.publishedAt || existing?.published_at || now : '',
    created_at: existing?.created_at ?? now, updated_at: now,
  };
  parseCommercial(blogEditableSchema,row);
  if (row.status === 'scheduled' && !row.scheduled_at) throw new CrmError('ARTICLE_SCHEDULE_REQUIRED', 400);
  return persist(user, row, existing ? 'updated' : 'created', data.expectedUpdatedAt);
}
async function changeStatus(user: Principal, input: string | {id: string; reason?: string; idempotencyKey?: string; expectedUpdatedAt?: string}, status: BlogStatus, action: string) {
  assertPermission(user, 'articles.write');
  const id = typeof input === 'string' ? input : input.id;
  const post = await getCrmArticle(user, id);
  const now = new Date().toISOString();
  return persist(user, {...post, status, published_at: status === 'published' ? post.published_at || now : '', updated_at: now}, action,
    typeof input === 'string' ? post.updated_at : input.expectedUpdatedAt ?? post.updated_at);
}
export async function publishCrmArticle(user: Principal, input: Parameters<typeof changeStatus>[1]) {
  return changeStatus(user, input, 'published', 'published');
}
export async function unpublishCrmArticle(user: Principal, input: Parameters<typeof changeStatus>[1]) {
  return changeStatus(user, input, 'draft', 'unpublished');
}
export async function archiveCrmArticle(user: Principal, id: string) {
  return changeStatus(user, id, 'archived', 'archived');
}
export async function getPublicArticlesForProduct(user: Principal, productIdOrSku: string): Promise<BlogRow[]> {
  assertPermission(user, 'catalog.read');
  const target = productIdOrSku.toLowerCase().trim();
  const product = (await (await database()).query<{id: string; sku: string; website_id: string | null}>(
    'SELECT id,sku,website_id FROM cohamy_crm.products WHERE lower(id::text)=$1 OR lower(sku)=$1 OR lower(website_id)=$1', [target],
  )).rows[0];
  const aliases = new Set([target, product?.id, product?.sku?.toLowerCase(), product?.website_id?.toLowerCase()].filter(Boolean));
  return (await getAllPublicPosts()).filter(row => row.related_product_ids.some(id => aliases.has(id.toLowerCase().trim())))
    .map(row => ({...row, canonical_url: buildBlogPostPath(row)}));
}
