import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requireAdminApi,
  requireSameOrigin,
  safeApiError,
} from "@/lib/admin-auth";
import { normalizeBlogMutation } from "@/lib/blog-mutations";
import {
  getAllAdminRows,
  repositoryUpsertRows,
} from "@/lib/blog-repository";
import type { BlogRow } from "@/lib/blog-schema";

const importSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(1000),
  preserveStatus: z.boolean().default(false),
});

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  try {
    const requestData = importSchema.safeParse(await request.json());
    if (!requestData.success) {
      return Response.json({ error: "INVALID_IMPORT_PAYLOAD" }, { status: 400 });
    }

    const existing = await getAllAdminRows();
    const slugKeys = new Set(
      existing.map((row) => `${row.locale}:${row.slug}`),
    );
    const groupKeys = new Set(
      existing.map((row) => `${row.group_id}:${row.locale}`),
    );
    const valid: BlogRow[] = [];
    const errors: { row: number; reason: string }[] = [];

    requestData.data.rows.forEach((source, index) => {
      try {
        const mutationSource = requestData.data.preserveStatus
          ? source
          : {
              ...source,
              status: "draft",
              scheduled_at: "",
              published_at: "",
            };
        const row = normalizeBlogMutation(mutationSource);
        const slugKey = `${row.locale}:${row.slug}`;
        const groupKey = `${row.group_id}:${row.locale}`;

        if (slugKeys.has(slugKey)) {
          throw new Error("Slug đã tồn tại trong locale");
        }
        if (groupKeys.has(groupKey)) {
          throw new Error("Group ID và locale đã tồn tại");
        }

        slugKeys.add(slugKey);
        groupKeys.add(groupKey);
        valid.push(row);
      } catch (error) {
        errors.push({
          row: index + 2,
          reason: error instanceof Error ? error.message : "Dữ liệu không hợp lệ",
        });
      }
    });

    const result =
      valid.length > 0
        ? await repositoryUpsertRows(valid)
        : { created: 0, updated: 0 };
    revalidatePath("/", "layout");
    revalidatePath("/sitemap.xml");

    return Response.json({
      total: requestData.data.rows.length,
      succeeded: valid.length,
      failed: errors.length,
      created: result.created,
      updated: result.updated,
      errors,
    });
  } catch (error) {
    return safeApiError(error, "admin-post-import");
  }
}
