import { apiError, apiUser, json } from "@/lib/crm/http";
export async function GET() {
  try { return json({ user: await apiUser() }); } catch (error) { return apiError(error); }
}
