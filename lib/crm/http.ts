import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticate, SESSION_COOKIE } from "./auth";
import { CrmError } from "./permissions";
import type { Area, Principal } from "./types";

const privateHeaders = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };
export function json(value: unknown, status = 200) { return Response.json(value, { status, headers: privateHeaders }); }
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (process.env.NODE_ENV === "production" && !process.env.CRM_PUBLIC_ORIGIN?.startsWith("https://")) throw new CrmError("CRM_HTTPS_ORIGIN_REQUIRED", 503);
  const expected = process.env.CRM_PUBLIC_ORIGIN || new URL(request.url).origin;
  if (!origin || origin !== expected) throw new CrmError("INVALID_ORIGIN", 403);
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "none"].includes(fetchSite)) throw new CrmError("INVALID_ORIGIN", 403);
}
export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new CrmError("JSON_REQUIRED", 415);
  // Bound bytes while reading, not only a client-controlled Content-Length header.
  const reader = request.body?.getReader();
  if (!reader) throw new CrmError("INVALID_FIELDS", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 32768) { await reader.cancel(); throw new CrmError("BODY_TOO_LARGE", 413); }
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
    catch { throw new CrmError("INVALID_FIELDS", 400); }
  } finally { reader.releaseLock(); }
}
export async function apiUser(): Promise<Principal> {
  const user = await authenticate((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) throw new CrmError("UNAUTHORIZED", 401);
  return user;
}
export async function readCommercialMultipart(request: Request) {
  const type = request.headers.get('content-type') ?? '';
  if (!type.startsWith('multipart/form-data;')) throw new CrmError('MULTIPART_REQUIRED', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new CrmError('INVALID_FIELDS', 400);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const {value, done} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 2097152 + 32768) { await reader.cancel(); throw new CrmError('BODY_TOO_LARGE', 413); }
      chunks.push(value);
    }
    let form: FormData;
    try { form = await new Request(request.url, {method:'POST', headers:{'content-type':type}, body:new Uint8Array(Buffer.concat(chunks))}).formData(); }
    catch { throw new CrmError('INVALID_FIELDS', 400); }
    const files = form.getAll('file'), inputs = form.getAll('input');
    if (files.length !== 1 || inputs.length !== 1 || [...form.keys()].some(k => !['file','input'].includes(k))) throw new CrmError('INVALID_FIELDS',400);
    const file = files[0], input = inputs[0];
    if (typeof file === 'string' || typeof input !== 'string' || Buffer.byteLength(input)>32768) throw new CrmError('INVALID_FIELDS',400);
    if (!file.size || file.size>2097152) throw new CrmError('FILE_SIZE_INVALID',413);
    let data:unknown; try {data=JSON.parse(input);} catch {throw new CrmError('INVALID_FIELDS',400);}
    return {bytes:Buffer.from(await file.arrayBuffer()), input:data};
  } finally {reader.releaseLock();}
}
export async function pageUser(area: Area): Promise<Principal> {
  const user = await authenticate((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) redirect(`/${area}/login`);
  if (user.area !== area) redirect(`/${user.area}`);
  return user;
}
export function apiError(error: unknown) {
  if (error instanceof CrmError) return json({ error: error.code }, error.status);
  if ((error as { code?: string })?.code === "23505") return json({ error: "DUPLICATE_RECORD" }, 409);
  // Do not log SQL parameters, passwords, connection URLs or customer bodies.
  console.error("[CRM] request failed", { code: (error as { code?: string })?.code || "UNEXPECTED_ERROR" });
  return json({ error: "CRM_UNAVAILABLE" }, 503);
}
