import { NextResponse } from "next/server";
import { getWordPressPreview } from "@/lib/wordpress-blog";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  try {
    if (!token || token.length > 2000) throw new Error("INVALID_TOKEN");
    await getWordPressPreview(token); // The CMS verifies expiry AND the user's current capabilities.
    // request.url may use Next's internal localhost behind a proxy. Keep the browser on its incoming origin.
    const response = new NextResponse(null, { status: 303, headers: { Location: "/preview/blog" } });
    const secure = url.protocol === "https:" || (process.env.NODE_ENV === "production" && process.env.WORDPRESS_ALLOW_LOCAL_HTTP !== "true");
    response.cookies.set("cohamy_wp_preview", token, { httpOnly: true, secure, sameSite: "lax", path: "/preview", maxAge: 300 });
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return Response.json({ error: "PREVIEW_DENIED_OR_CMS_UNAVAILABLE" }, { status: 403, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  }
}
