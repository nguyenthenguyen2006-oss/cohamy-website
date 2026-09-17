import { z } from "zod";
import {
  getRequestIp,
  requireSameOrigin,
  safeApiError,
  verifyAdminCredentials,
} from "@/lib/admin-auth";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  recordLoginFailure,
} from "@/lib/admin-rate-limit";
import { setAdminSessionCookie } from "@/lib/admin-session";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const ip = getRequestIp(request);
  const limit = checkLoginRateLimit(ip);
  if (!limit.allowed) {
    return Response.json(
      { error: "TOO_MANY_ATTEMPTS" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "INVALID_LOGIN_INPUT" }, { status: 400 });
    }

    const valid = await verifyAdminCredentials(
      parsed.data.username,
      parsed.data.password,
    );
    if (!valid) {
      recordLoginFailure(ip);
      return Response.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    clearLoginFailures(ip);
    await setAdminSessionCookie(parsed.data.username);
    return Response.json({ ok: true });
  } catch (error) {
    return safeApiError(error, "admin-login");
  }
}
