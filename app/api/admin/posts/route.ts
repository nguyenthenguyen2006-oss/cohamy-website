import { revalidatePath } from "next/cache";
import {
  requireAdminApi,
  requireSameOrigin,
  safeApiError,
} from "@/lib/admin-auth";
import { normalizeBlogMutation } from "@/lib/blog-mutations";
import {
  listAdminPosts,
  repositoryCreateRow,
} from "@/lib/blog-repository";
import {
  BLOG_CATEGORIES,
  BLOG_LOCALES,
  BLOG_STATUSES,
  type BlogCategory,
  type BlogLocale,
  type BlogStatus,
} from "@/lib/blog-schema";

function enumValue<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const result = await listAdminPosts({
      page: Number(url.searchParams.get("page") || 1),
      pageSize: 20,
      q: url.searchParams.get("q") || "",
      locale: enumValue(
        url.searchParams.get("locale"),
        BLOG_LOCALES,
      ) as BlogLocale | undefined,
      category: enumValue(
        url.searchParams.get("category"),
        BLOG_CATEGORIES,
      ) as BlogCategory | undefined,
      status: enumValue(
        url.searchParams.get("status"),
        BLOG_STATUSES,
      ) as BlogStatus | undefined,
    });
    return Response.json(result);
  } catch (error) {
    return safeApiError(error, "admin-posts-list");
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  try {
    const row = normalizeBlogMutation(await request.json());
    const created = await repositoryCreateRow(row);
    revalidatePath("/", "layout");
    revalidatePath("/sitemap.xml");
    return Response.json({ post: created }, { status: 201 });
  } catch (error) {
    return safeApiError(error, "admin-posts-create");
  }
}
