import "server-only";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";
import { blogSource, wordpressUrl } from "@/lib/blog-source";

export async function verifyAdminCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const configuredUsername = process.env.ADMIN_USERNAME?.trim();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim();

  if (!configuredUsername || !passwordHash) {
    throw new Error("ADMIN_CREDENTIALS_NOT_CONFIGURED");
  }

  const usernameMatches = username === configuredUsername;
  const passwordMatches = await bcrypt.compare(password, passwordHash);
  return usernameMatches && passwordMatches;
}

export async function requireAdminPage(): Promise<string> {
  if (blogSource() === "wordpress") redirect(`${wordpressUrl()}/wp-admin/`);
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session.username;
}

export async function requireAdminApi(): Promise<
  { ok: true; username: string } | { ok: false; response: Response }
> {
  if (blogSource() !== "sheets") return { ok: false, response: Response.json({ error: "LEGACY_BLOG_WRITES_DISABLED", cms: blogSource() === "wordpress" ? `${wordpressUrl()}/wp-admin/` : undefined }, { status: 410 }) };
  const session = await getAdminSession();
  if (!session) {
    return {
      ok: false,
      response: Response.json(
        { error: "UNAUTHORIZED" },
        { status: 401 },
      ),
    };
  }
  return { ok: true, username: session.username };
}

export function requireSameOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) {
    return Response.json({ error: "ORIGIN_REQUIRED" }, { status: 403 });
  }

  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
    : requestOrigin;

  if (origin !== requestOrigin && origin !== configuredOrigin) {
    return Response.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }

  return null;
}

export function getRequestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export function safeApiError(error: unknown, context: string): Response {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const knownErrors = [
    "BLOG_SHEETS_NOT_CONFIGURED",
    "BLOG_SHEET_PERMISSION_DENIED",
    "BLOG_SPREADSHEET_NOT_FOUND",
    "BLOG_SHEET_HEADER_INVALID",
    "DUPLICATE_LOCALE_SLUG",
    "DUPLICATE_GROUP_LOCALE",
    "BLOG_ROW_NOT_FOUND",
    "ADMIN_CREDENTIALS_NOT_CONFIGURED",
    "ADMIN_SESSION_SECRET_NOT_CONFIGURED",
    "UPLOAD_NOT_CONFIGURED",
  ];

  if (message.startsWith("BLOG_VALIDATION_FAILED:")) {
    return Response.json({ error: message }, { status: 400 });
  }

  if (knownErrors.some((known) => message.startsWith(known))) {
    const status =
      message.startsWith("DUPLICATE") ? 409
      : message === "BLOG_ROW_NOT_FOUND" ? 404
      : 503;
    return Response.json({ error: message }, { status });
  }

  console.error(`[${context}]`, error);
  return Response.json(
    { error: "INTERNAL_SERVER_ERROR" },
    { status: 500 },
  );
}
