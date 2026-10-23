import { CrmError } from "./permissions";
import type { Area, Principal } from "./types";

// Retired from the internal CRM. Portal services and historical records remain.
const removedCrmModules: ReadonlySet<string> = new Set([
  "library",
  "support",
  "articles",
  "automation",
  "consignment",
  "procurement",
  "invitations",
  "network",
]);

export function isRemovedCrmModule(area: Area, moduleId: string): boolean {
  return area === "crm" && removedCrmModules.has(moduleId);
}

export function assertModuleAvailable(user: Principal, moduleId: string): void {
  if (isRemovedCrmModule(user.area, moduleId)) throw new CrmError("NOT_FOUND", 404);
}
