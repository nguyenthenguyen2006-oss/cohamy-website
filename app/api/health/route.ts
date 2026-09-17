import { isBlogSheetsConfigured } from "@/lib/google-sheets-blog";
import { isUploadDirectoryWritable } from "@/lib/upload";
import { blogSource } from "@/lib/blog-source";
import { bridgeRequest } from "@/lib/wordpress-blog";

export const dynamic = "force-dynamic";

export async function GET() {
  const source = blogSource();
  let blogReady = source === "legacy" || isBlogSheetsConfigured();
  if (source === "wordpress") {
    try { const data = await bridgeRequest("/revision") as { rank_math?: boolean }; blogReady = data.rank_math === true; }
    catch { blogReady = false; }
  }
  return Response.json(
    {
      ok: blogReady,
      app: "cohamy",
      blogSource: source,
      blogReady,
      sheetsConfigured: isBlogSheetsConfigured(),
      uploadDirectoryWritable: await isUploadDirectoryWritable(),
      timestamp: new Date().toISOString(),
    },
    {
      status: blogReady ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
