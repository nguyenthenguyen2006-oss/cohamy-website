import { apiError, apiUser, json, readJson, sameOrigin } from "@/lib/crm/http";
import { createAccount, createOrganization, createWarehouse, listAccounts, listCatalog, listOrganizations, listWarehouses } from "@/lib/crm/repository";
import { CrmError } from "@/lib/crm/permissions";
type Context = { params: Promise<{ resource: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const user = await apiUser(); const { resource } = await context.params;
    const query = new URL(request.url).searchParams;
    switch (resource) {
      case "partners": return json(await listOrganizations(user, { kind: query.get("kind") || undefined, q: query.get("q") || "", page: Number(query.get("page")) || 1 }));
      case "catalog": return json({ items: await listCatalog(user, query.get("q") || "") });
      case "warehouses": return json({ items: await listWarehouses(user) });
      case "accounts": return json({ items: await listAccounts(user) });
      default: throw new CrmError("NOT_FOUND", 404);
    }
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    sameOrigin(request); const user = await apiUser(); const { resource } = await context.params;
    const input = await readJson(request);
    switch (resource) {
      case "partners": return json(await createOrganization(user, input), 201);
      case "warehouses": return json(await createWarehouse(user, input), 201);
      case "accounts": return json(await createAccount(user, input), 201);
      default: throw new CrmError("NOT_FOUND", 404);
    }
  } catch (error) { return apiError(error); }
}
