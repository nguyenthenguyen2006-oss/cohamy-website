import { z } from "zod";
import { products } from "@/data/products";

export const BLOG_HEADERS = [
  "id",
  "group_id",
  "locale",
  "slug",
  "title",
  "excerpt",
  "content_html",
  "cover_image",
  "cover_image_alt",
  "author",
  "category",
  "tags",
  "featured",
  "related_product_ids",
  "seo_title",
  "seo_description",
  "canonical_url",
  "robots_index",
  "status",
  "scheduled_at",
  "published_at",
  "created_at",
  "updated_at",
] as const;

export const BLOG_LOCALES = ["vi", "en", "zh", "ko", "ja"] as const;
export const BLOG_CATEGORIES = [
  "chocolate",
  "dried-fruit",
  "gift-ideas",
  "food-guide",
  "brand-story",
] as const;
export const BLOG_STATUSES = [
  "draft",
  "scheduled",
  "published",
  "archived",
] as const;

export type BlogLocale = (typeof BLOG_LOCALES)[number];
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];
export type BlogStatus = (typeof BLOG_STATUSES)[number];

const productIds = new Set(products.map((product) => product.id));
const isoDate = z
  .string()
  .refine(
    (value) => value === "" || !Number.isNaN(Date.parse(value)),
    "Thời gian phải là ISO 8601 hợp lệ",
  );
const slug = z
  .string()
  .trim()
  .min(1, "Slug là bắt buộc")
  .max(180, "Slug tối đa 180 ký tự")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/u,
    "Slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang đơn",
  );

const blogRowBaseSchema = z
  .object({
    id: z.string().trim().min(1, "ID là bắt buộc"),
    group_id: z.string().trim().min(1, "Group ID là bắt buộc"),
    locale: z.enum(BLOG_LOCALES),
    slug,
    title: z.string().trim().min(1, "Tiêu đề là bắt buộc").max(300),
    excerpt: z.string().trim().max(1000),
    content_html: z.string(),
    cover_image: z.string().trim().max(2000),
    cover_image_alt: z.string().trim().max(500),
    author: z.string().trim().min(1, "Tác giả là bắt buộc").max(200),
    category: z.enum(BLOG_CATEGORIES),
    tags: z.array(z.string().trim().min(1)).max(50),
    featured: z.boolean(),
    related_product_ids: z.array(z.string().trim().min(1)).max(30),
    seo_title: z.string().trim().max(300),
    seo_description: z.string().trim().max(1000),
    canonical_url: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || z.url().safeParse(value).success,
        "Canonical phải là URL hợp lệ",
      ),
    robots_index: z.boolean(),
    status: z.enum(BLOG_STATUSES),
    scheduled_at: isoDate,
    published_at: isoDate,
    created_at: isoDate.refine((value) => value !== "", "created_at là bắt buộc"),
    updated_at: isoDate.refine((value) => value !== "", "updated_at là bắt buộc"),
    content_type: z.enum(["post", "page"]).optional(),
    references: z.object({country:z.string(),topic:z.string(),subject:z.string(),location:z.string()}).optional(),
    seo: z.object({
      follow: z.boolean(), pillar: z.boolean(),
      facebook_title: z.string(), facebook_description: z.string(), facebook_image: z.string(),
      twitter_title: z.string(), twitter_description: z.string(), twitter_image: z.string(), twitter_card_type: z.string(),
    }).optional(),
  });

export const blogRowSchema = blogRowBaseSchema.superRefine((row, context) => {
    if (row.status === "scheduled" && !row.scheduled_at) {
      context.addIssue({
        code: "custom",
        path: ["scheduled_at"],
        message: "Bài scheduled phải có ngày đặt lịch",
      });
    }

    for (const productId of row.related_product_ids) {
      if (!productIds.has(productId)) {
        context.addIssue({
          code: "custom",
          path: ["related_product_ids"],
          message: `Không tìm thấy sản phẩm: ${productId}`,
        });
      }
    }
});

export type BlogRow = z.infer<typeof blogRowSchema>;

export const blogEditableSchema = blogRowBaseSchema
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
  })
  .extend({
    id: z.string().trim().optional(),
    created_at: isoDate.optional(),
    updated_at: isoDate.optional(),
  });

export type BlogEditableInput = z.input<typeof blogEditableSchema>;

export const blogListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  q: z.string().trim().max(200).default(""),
  locale: z.enum(BLOG_LOCALES).optional(),
  category: z.enum(BLOG_CATEGORIES).optional(),
  status: z.enum(BLOG_STATUSES).optional(),
});

export function splitCommaList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseSheetBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "TRUE") return true;
  if (normalized === "FALSE") return false;
  return fallback;
}

export function isPublicBlogRow(
  row: BlogRow,
  now = new Date(),
): boolean {
  if (row.status === "published") return true;
  if (row.status !== "scheduled" || !row.scheduled_at) return false;
  return new Date(row.scheduled_at).getTime() <= now.getTime();
}

export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const field = issue.path.join(".");
    return field ? `${field}: ${issue.message}` : issue.message;
  });
}
