import {
  requireAdminApi,
  requireSameOrigin,
} from "@/lib/admin-auth";
import { clearAdminSessionCookie } from "@/lib/admin-session";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  await clearAdminSessionCookie();
  return Response.json({ ok: true });
}
