import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { database, type Sql } from "./db";
import { audit } from "./auth";
import { allPartners, assertPermission, CrmError } from "./permissions";
import { roles, type CatalogProduct, type Organization, type Principal, type Warehouse } from "./types";
import bcrypt from "bcryptjs";

export const organizationSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/u),
  name: z.string().trim().min(2).max(200), kind: z.enum(["DEALER", "CUSTOMER", "SUPPLIER"]),
  phone: z.string().trim().max(40).default(""), email: z.union([z.literal(""), z.email()]).default(""),
  address: z.string().trim().max(500).default(""),
  source: z.string().trim().max(120).default(""), segment: z.string().trim().max(120).default(""),
  contactName: z.string().trim().max(120).default(""), stage: z.enum(['LEAD','CONTACTED','ACTIVE','INACTIVE']).default('ACTIVE'),
}).strict();
const updateSchema = organizationSchema.extend({ active: z.boolean(), version: z.number().int().positive() });
const warehouseSchema = z.object({ code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/u), name: z.string().trim().min(2).max(200), organizationId: z.uuid() }).strict();
const accountSchema = z.object({ email: z.email().toLowerCase(), displayName: z.string().trim().min(2).max(120), password: z.string().min(12).max(72), role: z.enum(roles), organizationId: z.uuid() }).strict();
const organizationColumns = "o.id,o.code,o.name,o.kind,o.phone,o.email,o.address,o.active,o.version,o.created_at,o.source,o.segment,o.contact_name,o.stage";
const parse = <T>(schema: z.ZodType<T>, input: unknown): T => {
  const result = schema.safeParse(input);
  if (!result.success) throw new CrmError("INVALID_FIELDS", 400);
  return result.data;
};
export function partnerScope(user: Principal): { sql: string; params: unknown[] } {
  if (allPartners(user)) return { sql: "true", params: [] };
  if (user.area === "portal") return { sql: "o.id=$1", params: [user.organizationId] };
  if (user.role === "SALES") return { sql: "EXISTS (SELECT 1 FROM cohamy_crm.partner_assignments a WHERE a.organization_id=o.id AND a.membership_id=$1)", params: [user.membershipId] };
  return { sql: "false", params: [] };
}
export async function listOrganizations(user: Principal, options: { kind?: string; q?: string; page?: number } = {}) {
  assertPermission(user, "partners.read");
  const db = await database();
  const scope = partnerScope(user);
  const params = [...scope.params];
  let where = `(${scope.sql})`;
  if (options.kind) { params.push(options.kind); where += ` AND o.kind=$${params.length}`; }
  if (options.q) { params.push(`%${options.q.slice(0, 120)}%`); where += ` AND (o.name ILIKE $${params.length} OR o.code ILIKE $${params.length} OR o.phone ILIKE $${params.length} OR o.email ILIKE $${params.length})`; }
  const count = await db.query<{ total: string }>(`SELECT count(*)::text AS total FROM cohamy_crm.organizations o WHERE ${where}`, params);
  const page = Math.min(100000, Math.max(1, Math.floor(options.page ?? 1) || 1));
  params.push((page - 1) * 20);
  const data = await db.query<Organization>(`SELECT ${organizationColumns} FROM cohamy_crm.organizations o WHERE ${where} ORDER BY o.created_at DESC,o.id LIMIT 20 OFFSET $${params.length}`, params);
  return { items: data.rows, total: Number(count.rows[0].total), page, pageSize: 20 };
}
export async function getOrganization(user: Principal, id: string, tx?: Sql) {
  assertPermission(user, "partners.read");
  if (!z.uuid().safeParse(id).success) throw new CrmError("NOT_FOUND", 404);
  const db = tx ?? await database();
  const scope = partnerScope(user);
  const result = await db.query<Organization>(`SELECT ${organizationColumns} FROM cohamy_crm.organizations o WHERE (${scope.sql}) AND o.id=$${scope.params.length + 1}`, [...scope.params, id]);
  if (!result.rows[0]) throw new CrmError("NOT_FOUND", 404);
  return result.rows[0];
}
export async function listOrganizationOptions(user: Principal) {
  // Creation selectors must not lose Cohamy or older dealers after the first
  // paginated list fills up. Only privileged writers can enumerate these.
  if (!canOrganizationOptions(user)) throw new CrmError("FORBIDDEN", 403);
  const db = await database();
  return (await db.query<Organization>(`SELECT ${organizationColumns} FROM cohamy_crm.organizations o WHERE o.active AND o.kind IN ('COHAMY','DEALER') ORDER BY (o.kind='COHAMY') DESC,o.name,o.id`)).rows;
}
function canOrganizationOptions(user: Principal) {
  return user.area === "crm" && ["ADMIN", "MANAGER"].includes(user.role);
}
export async function createOrganization(user: Principal, input: unknown) {
  assertPermission(user, "partners.write");
  const data = parse(organizationSchema, input);
  // Supplier management is restricted; sales cannot create a supplier to widen their scope.
  if (data.kind === "SUPPLIER" && !["ADMIN", "MANAGER"].includes(user.role)) throw new CrmError("FORBIDDEN", 403);
  const db = await database();
  return db.transaction(async tx => {
    const id = randomUUID();
    await tx.query(`INSERT INTO cohamy_crm.organizations(id,code,name,kind,phone,email,address) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, data.code, data.name, data.kind, data.phone, data.email, data.address]);
    await tx.query('UPDATE cohamy_crm.organizations SET source=$1,segment=$2,contact_name=$3,stage=$4 WHERE id=$5',[data.source,data.segment,data.contactName,data.stage,id]);
    if (user.role === "SALES") await tx.query("INSERT INTO cohamy_crm.partner_assignments(membership_id,organization_id) VALUES ($1,$2)", [user.membershipId, id]);
    await audit(tx, user.id, "partner.created", id, { kind: data.kind });
    return { id };
  });
}
export async function updateOrganization(user: Principal, id: string, input: unknown) {
  assertPermission(user, "partners.write");
  const data = parse(updateSchema, input);
  const db = await database();
  return db.transaction(async tx => {
    const original = await getOrganization(user, id, tx);
    if (original.kind === "COHAMY" || data.kind !== original.kind) throw new CrmError("ORGANIZATION_KIND_IMMUTABLE", 409);
    const result = await tx.query<{ id: string }>(`UPDATE cohamy_crm.organizations SET code=$1,name=$2,phone=$3,email=$4,address=$5,active=$6,version=version+1 WHERE id=$7 AND version=$8 RETURNING id`, [data.code, data.name, data.phone, data.email, data.address, data.active, id, data.version]);
    if (!result.rows.length) throw new CrmError("VERSION_CONFLICT", 409);
    await tx.query('UPDATE cohamy_crm.organizations SET source=$1,segment=$2,contact_name=$3,stage=$4 WHERE id=$5',[data.source,data.segment,data.contactName,data.stage,id]);
    await audit(tx, user.id, "partner.updated", id, { version: data.version + 1, active: data.active });
    return { id, version: data.version + 1 };
  });
}
export async function listCatalog(user: Principal, q = "") {
  assertPermission(user, "catalog.read");
  const db = await database();
  const data = await db.query<CatalogProduct>(`SELECT id,website_id,sku,name,category,weight_label,retail_price::text,translations,mapping_status,stock_unit,units_per_case,active,version FROM cohamy_crm.products WHERE (name ILIKE $1 OR sku ILIKE $1) ${user.area==='portal'?'AND active':''} ORDER BY sku`, [`%${q.slice(0, 120)}%`]);
  return data.rows;
}
export async function listWarehouses(user: Principal) {
  assertPermission(user, "warehouses.read");
  const db = await database();
  let where = "false";
  const params: unknown[] = [];
  if (["ADMIN", "MANAGER"].includes(user.role)) where = "true";
  else if (user.area === "portal") { where = "w.organization_id=$1"; params.push(user.organizationId); }
  else { where = "EXISTS (SELECT 1 FROM cohamy_crm.warehouse_assignments a WHERE a.warehouse_id=w.id AND a.membership_id=$1)"; params.push(user.membershipId); }
  return (await db.query<Warehouse>(`SELECT w.id,w.code,w.name,w.organization_id,o.name AS organization_name,w.active FROM cohamy_crm.warehouses w JOIN cohamy_crm.organizations o ON o.id=w.organization_id WHERE ${where} ORDER BY w.code`, params)).rows;
}
export async function createWarehouse(user: Principal, input: unknown) {
  assertPermission(user, "warehouses.write");
  const data = parse(warehouseSchema, input);
  const db = await database();
  return db.transaction(async tx => {
    const org = await getOrganization(user, data.organizationId, tx);
    if (!org.active || !["COHAMY", "DEALER"].includes(org.kind)) throw new CrmError("INVALID_WAREHOUSE_OWNER", 400);
    const id = randomUUID();
    await tx.query("INSERT INTO cohamy_crm.warehouses(id,code,name,organization_id) VALUES ($1,$2,$3,$4)", [id, data.code, data.name, data.organizationId]);
    await audit(tx, user.id, "warehouse.created", id, { organizationId: data.organizationId });
    return { id };
  });
}
export async function listAccounts(user: Principal) {
  assertPermission(user, "accounts.manage");
  const db = await database();
  return (await db.query<{ id: string; display_name: string; email: string; role: string; organization_name: string; active: boolean }>(`SELECT m.id,u.display_name,u.email,m.role,o.name AS organization_name,(u.active AND m.active AND o.active) AS active FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id JOIN cohamy_crm.organizations o ON o.id=m.organization_id ORDER BY u.email,m.id`)).rows;
}
export async function createAccount(user: Principal, input: unknown) {
  assertPermission(user, "accounts.manage");
  const data = parse(accountSchema, input);
  const db = await database();
  const hash = await bcrypt.hash(data.password, 12);
  return db.transaction(async tx => {
    const org = await getOrganization(user, data.organizationId, tx);
    const isDealer = data.role.startsWith("DEALER_");
    if (!org.active || org.kind !== (isDealer ? "DEALER" : "COHAMY")) throw new CrmError("ROLE_ORGANIZATION_MISMATCH", 400);
    const id = randomUUID();
    await tx.query("INSERT INTO cohamy_crm.users(id,email,display_name,password_hash) VALUES ($1,$2,$3,$4)", [id, data.email, data.displayName, hash]);
    await tx.query("INSERT INTO cohamy_crm.memberships(id,user_id,organization_id,role) VALUES ($1,$2,$3,$4)", [randomUUID(), id, org.id, data.role]);
    await audit(tx, user.id, "account.created", id, { role: data.role, organizationId: org.id });
    return { id };
  });
}
export async function setAccountActive(user: Principal, membershipId: string, input: unknown) {
  assertPermission(user, "accounts.manage");
  const data = parse(z.object({ active: z.boolean() }).strict(), input);
  if (!z.uuid().safeParse(membershipId).success) throw new CrmError("NOT_FOUND", 404);
  if (user.membershipId === membershipId) throw new CrmError("CANNOT_LOCK_OWN_ACCOUNT", 409);
  const db = await database();
  return db.transaction(async tx => {
    const result = await tx.query<{ user_id: string }>("UPDATE cohamy_crm.memberships SET active=$1 WHERE id=$2 RETURNING user_id", [data.active, membershipId]);
    if (!result.rows[0]) throw new CrmError("NOT_FOUND", 404);
    await audit(tx, user.id, data.active ? "account.unlocked" : "account.locked", membershipId);
    return { id: membershipId, active: data.active };
  });
}
