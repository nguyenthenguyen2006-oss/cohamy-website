import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { blogRowSchema, type BlogRow } from "@/lib/blog-schema";
import { sanitizeBlogHtml } from "@/lib/blog-sanitize";
import { wordpressUrl } from "@/lib/blog-source";

export const WORDPRESS_BLOG_TAG = "cohamy-wordpress-blog";
const revisionSchema = z.object({ revision: z.string().uuid(), rank_math: z.literal(true) });
const snapshotSchema = z.object({
  revision: z.string().uuid(),
  posts: z.array(blogRowSchema),
  redirects: z.array(z.object({ locale: z.enum(["vi", "en", "zh", "ko", "ja"]), from: z.string(), to: z.string() })),
});
export type WordPressSnapshot = z.infer<typeof snapshotSchema>;

export class WordPressError extends Error {
  constructor(public readonly code: string, public readonly status?: number) {
    super(code); this.name = "WordPressError";
  }
}

export async function bridgeRequest(path: string, options?: RequestInit, base = wordpressUrl()): Promise<unknown> {
  try {
    const response = await fetch(`${base}/wp-json/cohamy/v1${path}`, {
      ...options, cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(Number(process.env.WORDPRESS_TIMEOUT_MS || 8000)),
      headers: { Accept: "application/json", ...options?.headers },
    });
    if (!response.ok) throw new WordPressError("WORDPRESS_HTTP_ERROR", response.status);
    return await response.json();
  } catch (error) {
    if (error instanceof WordPressError) throw error;
    throw new WordPressError("WORDPRESS_UNAVAILABLE_OR_INVALID_JSON");
  }
}

export function adaptWordPressSnapshot(input: unknown): WordPressSnapshot {
  const parsed = snapshotSchema.safeParse(input);
  if (!parsed.success) throw new WordPressError("WORDPRESS_CONTRACT_INVALID");
  const slugs = new Set<string>(); const groups = new Set<string>(); const ids = new Set<string>();
  const posts = parsed.data.posts.map((post) => {
    if (post.status !== "published" || !post.published_at || Date.parse(post.published_at) > Date.now()) {
      throw new WordPressError("WORDPRESS_NON_PUBLIC_DATA_REJECTED");
    }
    for (const [set, key] of [[slugs, `${post.locale}:${post.slug}`], [groups, `${post.group_id}:${post.locale}`], [ids, post.id]] as const) {
      if (set.has(key)) throw new WordPressError("WORDPRESS_DUPLICATE_IDENTITY");
      set.add(key);
    }
    return { ...post, updated_at: new Date(post.updated_at).toISOString(), content_html: sanitizeBlogHtml(post.content_html) };
  });
  return { ...parsed.data, posts };
}

// Keyed by the authoritative CMS revision. An old request may only populate an OLD key.
// Every server render checks the revision without caching, including on other instances.
const cachedSnapshot = unstable_cache(async (base: string, revision: string) => {
  const snapshot = adaptWordPressSnapshot(await bridgeRequest(`/snapshot?revision=${encodeURIComponent(revision)}`, undefined, base));
  if (snapshot.revision !== revision) throw new WordPressError("WORDPRESS_REVISION_CHANGED", 409);
  return snapshot;
}, [WORDPRESS_BLOG_TAG], { tags: [WORDPRESS_BLOG_TAG], revalidate: 300 });

export const getWordPressSnapshot = cache(async (): Promise<WordPressSnapshot> => {
  const base = wordpressUrl();
  for (let attempt = 0; attempt < 3; attempt++) {
    const version = revisionSchema.safeParse(await bridgeRequest("/revision", undefined, base));
    if (!version.success) throw new WordPressError("WORDPRESS_BRIDGE_OR_RANK_MATH_NOT_READY");
    try { return await cachedSnapshot(base, version.data.revision); }
    catch (error) { if (!(error instanceof WordPressError) || error.status !== 409) throw error; }
  }
  throw new WordPressError("WORDPRESS_REVISION_BUSY", 503);
});

const pagedSchema = z.object({ items: z.array(blogRowSchema), page: z.number().int(), pageSize: z.number().int(), totalItems: z.number().int(), totalPages: z.number().int(), revision: z.string().uuid(), featured: blogRowSchema.optional() });
const detailSchema = z.object({ post: blogRowSchema.nullable(), revision: z.string().uuid() });
function adaptPublicRow(row: BlogRow): BlogRow {
  if (row.status !== "published" || !row.published_at || Date.parse(row.published_at) > Date.now()) throw new WordPressError("WORDPRESS_NON_PUBLIC_DATA_REJECTED");
  return { ...row, updated_at: new Date(row.updated_at).toISOString(), content_html: sanitizeBlogHtml(row.content_html) };
}
const cachedContent = unstable_cache(async (base: string, revision: string, path: string) => {
  const data = await bridgeRequest(path, undefined, base);
  const parsed = (path.startsWith("/content/detail?") ? detailSchema : pagedSchema).safeParse(data);
  if (!parsed.success) throw new WordPressError("WORDPRESS_CONTENT_CONTRACT_INVALID");
  if (parsed.data.revision !== revision) throw new WordPressError("WORDPRESS_REVISION_CHANGED", 409);
  return parsed.data;
}, ["cohamy-content-paged"], { tags: [WORDPRESS_BLOG_TAG], revalidate: 300 });
async function content(path: string) {
  const base = wordpressUrl();
  for (let attempt = 0; attempt < 3; attempt++) {
    const version = revisionSchema.safeParse(await bridgeRequest("/revision", undefined, base));
    if (!version.success) throw new WordPressError("WORDPRESS_BRIDGE_OR_RANK_MATH_NOT_READY");
    try { return await cachedContent(base, version.data.revision, path); }
    catch (error) { if (!(error instanceof WordPressError) || error.status !== 409) throw error; }
  }
  throw new WordPressError("WORDPRESS_REVISION_BUSY", 503);
}
export const listWordPressContent = cache(async (query: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams(); for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
  const data = pagedSchema.parse(await content("/content?" + params.toString()));
  return { ...data, items: data.items.map(adaptPublicRow), ...(data.featured ? { featured: adaptPublicRow(data.featured) } : {}) };
});
export const getWordPressContent = cache(async (locale: string, slug: string, type = "post") => {
  const data = detailSchema.parse(await content("/content/detail?" + new URLSearchParams({ locale, slug, type })));
  return data.post ? adaptPublicRow(data.post) : undefined;
});

export const getWordPressRedirect = cache(async (locale: string, slug: string) => {
  const result = z.union([z.object({ exists: z.boolean() }), z.object({ to: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) })]).safeParse(await bridgeRequest("/resolve?" + new URLSearchParams({ locale, slug })));
  if (!result.success) throw new WordPressError("WORDPRESS_RESOLVE_CONTRACT_INVALID");
  return "to" in result.data ? result.data.to : undefined;
});

export async function getWordPressReferenceOptions(type:string) {
  const parsed=z.object({items:z.array(z.object({entity_id:z.string(),name:z.string(),type:z.enum(["country","topic","subject","location"])}))}).safeParse(await bridgeRequest("/reference-options?"+new URLSearchParams({type})));
  if(!parsed.success)throw new WordPressError("WORDPRESS_REFERENCES_CONTRACT_INVALID");return parsed.data.items;
}
export async function getWordPressPreview(token: string): Promise<BlogRow> {
  const data = await bridgeRequest("/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
  const result = blogRowSchema.safeParse(data);
  if (!result.success) throw new WordPressError("WORDPRESS_PREVIEW_INVALID");
  return { ...result.data, content_html: sanitizeBlogHtml(result.data.content_html) };
}
