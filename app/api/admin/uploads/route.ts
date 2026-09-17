import {
  requireAdminApi,
  requireSameOrigin,
  safeApiError,
} from "@/lib/admin-auth";
import { processBlogUpload } from "@/lib/upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "FILE_REQUIRED" }, { status: 400 });
    }
    const result = await processBlogUpload(file);
    return Response.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      ["EMPTY_UPLOAD", "UPLOAD_TOO_LARGE", "UNSUPPORTED_IMAGE_TYPE"].includes(
        message,
      )
    ) {
      const status = message === "UPLOAD_TOO_LARGE" ? 413 : 415;
      return Response.json({ error: message }, { status });
    }
    return safeApiError(error, "admin-upload");
  }
}
