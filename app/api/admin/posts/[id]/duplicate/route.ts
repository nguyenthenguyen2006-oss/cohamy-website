import {
  requireAdminApi,
  requireSameOrigin,
  safeApiError,
} from "@/lib/admin-auth";
import { duplicateBlogPost } from "@/lib/blog-mutations";
import {
  getAdminPostById,
  repositoryCreateRow,
} from "@/lib/blog-repository";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  try {
    const { id } = await context.params;
    const source = await getAdminPostById(id);
    if (!source) {
      return Response.json({ error: "BLOG_ROW_NOT_FOUND" }, { status: 404 });
    }
    const created = await repositoryCreateRow(duplicateBlogPost(source));
    return Response.json({ post: created }, { status: 201 });
  } catch (error) {
    return safeApiError(error, "admin-post-duplicate");
  }
}
