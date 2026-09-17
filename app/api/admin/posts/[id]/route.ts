import { revalidatePath } from "next/cache";
import {
  requireAdminApi,
  requireSameOrigin,
  safeApiError,
} from "@/lib/admin-auth";
import { normalizeBlogMutation } from "@/lib/blog-mutations";
import {
  getAdminPostById,
  repositoryArchiveRow,
  repositoryUpdateRow,
} from "@/lib/blog-repository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const post = await getAdminPostById(id);
    if (!post) {
      return Response.json({ error: "BLOG_ROW_NOT_FOUND" }, { status: 404 });
    }
    return Response.json({ post });
  } catch (error) {
    return safeApiError(error, "admin-post-read");
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  try {
    const { id } = await context.params;
    const existing = await getAdminPostById(id);
    if (!existing) {
      return Response.json({ error: "BLOG_ROW_NOT_FOUND" }, { status: 404 });
    }
    const row = normalizeBlogMutation(await request.json(), existing);
    const updated = await repositoryUpdateRow(id, row);
    revalidatePath("/", "layout");
    revalidatePath("/sitemap.xml");
    return Response.json({ post: updated });
  } catch (error) {
    return safeApiError(error, "admin-post-update");
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  try {
    const { id } = await context.params;
    const archived = await repositoryArchiveRow(id);
    revalidatePath("/", "layout");
    revalidatePath("/sitemap.xml");
    return Response.json({ post: archived });
  } catch (error) {
    return safeApiError(error, "admin-post-archive");
  }
}
