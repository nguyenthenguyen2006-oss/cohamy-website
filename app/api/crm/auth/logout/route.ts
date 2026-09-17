import { cookies } from "next/headers";
import { logout, SESSION_COOKIE } from "@/lib/crm/auth";
import { apiError, json, sameOrigin } from "@/lib/crm/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const store = await cookies();
    await logout(store.get(SESSION_COOKIE)?.value);
    store.delete(SESSION_COOKIE);
    return json({ ok: true });
  } catch (error) { return apiError(error); }
}
