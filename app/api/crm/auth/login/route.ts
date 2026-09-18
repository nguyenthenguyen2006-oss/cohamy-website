import { cookies } from "next/headers";
import { z } from "zod";
import { login, SESSION_COOKIE, SESSION_SECONDS } from "@/lib/crm/auth";
import { apiError, json, readJson, sameOrigin } from "@/lib/crm/http";
import { CrmError } from "@/lib/crm/permissions";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const parsed = z.object({ email: z.email().toLowerCase(), password: z.string().min(1).max(72) }).strict().safeParse(await readJson(request));
    if (!parsed.success) throw new CrmError("INVALID_FIELDS", 400);
    const result = await login(parsed.data.email, parsed.data.password,{userAgent:request.headers.get('user-agent')??undefined});
    (await cookies()).set(SESSION_COOKIE, result.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: SESSION_SECONDS });
    return json({ user: result.user, redirectTo: `/${result.user.area}` });
  } catch (error) { return apiError(error); }
}
