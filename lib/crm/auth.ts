import "server-only";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { database, type Sql } from "./db";
import { CrmError } from "./permissions";
import type { Principal, Role } from "./types";

export const SESSION_COOKIE = "cohamy_crm_session";
export const SESSION_SECONDS = 8 * 60 * 60;
export const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const principalSelect = `SELECT u.id, u.email, u.display_name, m.id AS membership_id,
  m.role, o.id AS organization_id, o.name AS organization_name, o.kind
  FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id
  JOIN cohamy_crm.organizations o ON o.id=m.organization_id`;
type IdentityRow = { id: string; email: string; display_name: string; membership_id: string; role: Role; organization_id: string; organization_name: string; kind: string };
function principal(row: IdentityRow): Principal | null {
  const dealer = ["DEALER_OWNER", "DEALER_STAFF"].includes(row.role);
  if ((dealer && row.kind !== "DEALER") || (!dealer && row.kind !== "COHAMY")) return null;
  return { id: row.id, email: row.email, displayName: row.display_name, membershipId: row.membership_id,
    role: row.role, organizationId: row.organization_id, organizationName: row.organization_name, area: dealer ? "portal" : "crm" };
}
export async function audit(sql: Sql, actorId: string | null, action: string, entityId: string, payload: unknown = {}) {
  await sql.query("INSERT INTO cohamy_crm.audit_events(id,actor_id,action,entity_id,payload) VALUES ($1,$2,$3,$4,$5::jsonb)",
    [randomUUID(), actorId, action, entityId, JSON.stringify(redactAudit(payload))]);
}
export function redactAudit(value:unknown,depth=0):unknown {
  if(depth>8)return '[omitted]';
  if(Array.isArray(value))return value.slice(0,100).map(item=>redactAudit(item,depth+1));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,100).map(([key,item])=>[key,/(password|otp|token|secret|credential|database.?url)/i.test(key)?'[redacted]':redactAudit(item,depth+1)]));
  return typeof value==='string'?value.slice(0,4000):value;
}
function deviceLabel(agent='') {
  const browser=/Edg\//.test(agent)?'Edge':/Firefox\//.test(agent)?'Firefox':/Chrome\//.test(agent)?'Chrome':/Safari\//.test(agent)?'Safari':'Trình duyệt khác';
  const platform=/Android/.test(agent)?'Android':/iPhone|iPad/.test(agent)?'iOS':/Windows/.test(agent)?'Windows':/Macintosh/.test(agent)?'macOS':/Linux/.test(agent)?'Linux':'Thiết bị khác';
  return agent?browser+' · '+platform:'Thiết bị chưa ghi nhận';
}
// Constant cost comparison for unknown emails. Never creates an account or fallback session.
const dummyHash = bcrypt.hashSync("not-a-usable-credential", 12);
export async function login(email: string, password: string, metadata:{userAgent?:string}={}): Promise<{ token: string; user: Principal }> {
  const db = await database();
  const key = digest(email);
  const attempt = await db.query<{ attempts: number }>(`INSERT INTO cohamy_crm.login_attempts(key_hash,attempts) VALUES ($1,1)
    ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN cohamy_crm.login_attempts.window_start < now()-interval '15 minutes' THEN 1 ELSE cohamy_crm.login_attempts.attempts+1 END,
    window_start=CASE WHEN cohamy_crm.login_attempts.window_start < now()-interval '15 minutes' THEN now() ELSE cohamy_crm.login_attempts.window_start END RETURNING attempts`, [key]);
  if (attempt.rows[0].attempts > 8) throw new CrmError("LOGIN_RATE_LIMITED", 429);
  const result = await db.query<{ id: string; password_hash: string; active: boolean }>("SELECT id,password_hash,active FROM cohamy_crm.users WHERE email=$1", [email]);
  const candidate = result.rows[0];
  const matches = await bcrypt.compare(password, candidate?.password_hash ?? dummyHash);
  if (!candidate?.active || !matches) throw new CrmError("INVALID_CREDENTIALS", 401);
  return db.transaction(async tx => {
    // Recheck the lock state under the same transaction as session creation.
    const identities = await tx.query<IdentityRow>(`${principalSelect} WHERE u.id=$1 AND u.active AND m.active AND o.active ORDER BY m.id FOR SHARE OF u,m,o`, [candidate.id]);
    const user = identities.rows.map(principal).find((value): value is Principal => value !== null);
    if (!user) throw new CrmError("INVALID_CREDENTIALS", 401);
    const token = randomBytes(32).toString("base64url");
    await tx.query("INSERT INTO cohamy_crm.sessions(token_hash,membership_id,expires_at,device_label) VALUES ($1,$2,$3,$4)", [digest(token), user.membershipId, new Date(Date.now() + SESSION_SECONDS * 1000),deviceLabel(metadata.userAgent?.slice(0,300))]);
    await audit(tx, user.id, "auth.login", user.membershipId);
    return { token, user };
  });
}
export async function authenticate(token?: string): Promise<Principal | null> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/u.test(token)) return null;
  const db = await database();
  const result = await db.query<IdentityRow>(`${principalSelect} JOIN cohamy_crm.sessions s ON s.membership_id=m.id
    WHERE s.token_hash=$1 AND s.expires_at>now() AND s.revoked_at IS NULL AND u.active AND m.active AND o.active`, [digest(token)]);
  return result.rows[0] ? principal(result.rows[0]) : null;
}
export async function membershipPrincipal(id: string, sql?: Sql): Promise<Principal | null> {
  const result=await(sql??await database()).query<IdentityRow>(`${principalSelect} WHERE m.id=$1 AND u.active AND m.active AND o.active`,[id]);
  return result.rows[0]?principal(result.rows[0]):null;
}
export async function logout(token?: string) {
  if (!token) return;
  const db = await database();
  const user = await authenticate(token);
  await db.transaction(async tx => {
    await tx.query("UPDATE cohamy_crm.sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL", [digest(token)]);
    if (user) await audit(tx, user.id, "auth.logout", user.membershipId);
  });
}
