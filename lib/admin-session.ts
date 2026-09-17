import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "cohamy_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;

export interface AdminSession {
  username: string;
  expiresAt: number;
}

function getSessionSecret(): Uint8Array {
  const value = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET_NOT_CONFIGURED");
  }
  return new TextEncoder().encode(value);
}

export async function signAdminSession(username: string): Promise<string> {
  return new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .setSubject(username)
    .sign(getSessionSecret());
}

export async function verifyAdminToken(
  token: string,
): Promise<AdminSession | null> {
  try {
    const verified = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
    });
    const username = String(verified.payload.username ?? "");
    const expiresAt = verified.payload.exp ?? 0;
    if (!username || !expiresAt) return null;
    return { username, expiresAt };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function setAdminSessionCookie(username: string): Promise<void> {
  const token = await signAdminSession(username);
  (await cookies()).set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
    priority: "high",
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  (await cookies()).set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
