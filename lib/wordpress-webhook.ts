import "server-only";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { mkdir, open, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const webhookSchema = z.object({
  event_id: z.string().uuid(), revision: z.string().uuid(),
  post_ids: z.array(z.number().int().positive()).max(10000),
  paths: z.array(z.string().regex(/^\/(vi|en|zh|ko|ja)\/(bai-viet|blog|noi-dung|pages)\/[a-z0-9]+(?:-[a-z0-9]+)*$/u)).max(10000),
});

export function verifyWebhook(body: string, timestamp: string | null, signature: string | null, secret: string, now = Date.now()): boolean {
  if (secret.length < 32 || !timestamp || !/^\d{10}$/u.test(timestamp) || !signature || !/^[a-f0-9]{64}$/u.test(signature)) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

/** O_EXCL is atomic; mount this directory on a shared filesystem for multiple instances. */
export async function reserveWebhook(id: string): Promise<{ complete: () => Promise<void>; release: () => Promise<void> } | null> {
  const directory = process.env.WORDPRESS_REPLAY_DIR;
  if (!directory) throw new Error("WORDPRESS_REPLAY_DIR_REQUIRED");
  await mkdir(directory, { recursive: true });
  const filename = path.join(directory, createHash("sha256").update(id).digest("hex"));
  try {
    const file = await open(filename, "wx", 0o600);
    try { await file.writeFile("processing\n" + new Date().toISOString()); } finally { await file.close(); }
    return {
      complete: async () => { await writeFile(filename, "delivered\n" + new Date().toISOString()); },
      release: async () => { await unlink(filename); },
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      if ((await readFile(filename, "utf8")).startsWith("delivered\n")) return null;
      // Another instance is still invalidating. The sender must retry instead of marking this event delivered.
      throw new Error("WORDPRESS_WEBHOOK_IN_PROGRESS");
    }
    throw error;
  }
}
