import "server-only";

import { randomUUID } from "node:crypto";
import {
  blogEditableSchema,
  blogRowSchema,
  formatZodIssues,
  splitCommaList,
  type BlogEditableInput,
  type BlogRow,
} from "@/lib/blog-schema";
import { sanitizeBlogHtml } from "@/lib/blog-sanitize";

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toUpperCase() === "TRUE") return true;
    if (value.toUpperCase() === "FALSE") return false;
  }
  return fallback;
}

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeBlogMutation(
  input: unknown,
  existing?: BlogRow,
): BlogRow {
  const source = (input ?? {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  const editable: BlogEditableInput = {
    id: stringValue(source.id) || existing?.id,
    group_id:
      stringValue(source.group_id) || existing?.group_id || randomUUID(),
    locale: stringValue(source.locale) as BlogEditableInput["locale"],
    slug: stringValue(source.slug),
    title: stringValue(source.title),
    excerpt: stringValue(source.excerpt),
    content_html: String(source.content_html ?? ""),
    cover_image: stringValue(source.cover_image),
    cover_image_alt: stringValue(source.cover_image_alt),
    author: stringValue(source.author) || "Cohamy Editorial",
    category: stringValue(source.category) as BlogEditableInput["category"],
    tags: splitCommaList(source.tags),
    featured: booleanValue(source.featured, false),
    related_product_ids: splitCommaList(source.related_product_ids),
    seo_title: stringValue(source.seo_title),
    seo_description: stringValue(source.seo_description),
    canonical_url: "",
    robots_index: booleanValue(source.robots_index, true),
    status: stringValue(source.status || "draft") as BlogEditableInput["status"],
    scheduled_at: stringValue(source.scheduled_at),
    published_at: stringValue(source.published_at),
    created_at: existing?.created_at || stringValue(source.created_at) || now,
    updated_at: now,
  };

  const editableResult = blogEditableSchema.safeParse(editable);
  if (!editableResult.success) {
    throw new Error(
      `BLOG_VALIDATION_FAILED:${formatZodIssues(editableResult.error).join("|")}`,
    );
  }

  const status = editableResult.data.status;
  const publishedAt =
    status === "published" && !editableResult.data.published_at
      ? now
      : editableResult.data.published_at ?? "";

  const result = blogRowSchema.safeParse({
    ...editableResult.data,
    id: existing?.id || editableResult.data.id || randomUUID(),
    content_html: sanitizeBlogHtml(editableResult.data.content_html),
    published_at: publishedAt,
    created_at: existing?.created_at || editableResult.data.created_at || now,
    updated_at: now,
  });

  if (!result.success) {
    throw new Error(
      `BLOG_VALIDATION_FAILED:${formatZodIssues(result.error).join("|")}`,
    );
  }
  return result.data;
}

export function duplicateBlogPost(source: BlogRow): BlogRow {
  const now = new Date().toISOString();
  return {
    ...source,
    id: randomUUID(),
    group_id: randomUUID(),
    slug: `${source.slug}-copy-${Date.now().toString(36)}`,
    title: `${source.title} (bản sao)`,
    status: "draft",
    featured: false,
    scheduled_at: "",
    published_at: "",
    created_at: now,
    updated_at: now,
  };
}
