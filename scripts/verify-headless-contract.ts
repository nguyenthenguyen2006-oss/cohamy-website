import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { legacyBlogRows } from "@/lib/blog-legacy";
import { adaptWordPressSnapshot } from "@/lib/wordpress-blog";
import { reserveWebhook, verifyWebhook } from "@/lib/wordpress-webhook";
import { wordpressUrl } from "@/lib/blog-source";

async function main() {
  const previousUrl = process.env.WORDPRESS_URL;
  const previousAllowHttp = process.env.WORDPRESS_ALLOW_LOCAL_HTTP;
  const previousNodeEnv = process.env.NODE_ENV;
  try {
    Object.assign(process.env, { NODE_ENV: "production" });
    process.env.WORDPRESS_ALLOW_LOCAL_HTTP = "true";
    process.env.WORDPRESS_URL = "http://127.0.0.1:8181";
    assert.equal(wordpressUrl(), "http://127.0.0.1:8181");
    process.env.WORDPRESS_URL = "http://example.com";
    assert.throws(() => wordpressUrl(), /WORDPRESS_HTTPS_REQUIRED/);
  } finally {
    if (previousUrl === undefined) delete process.env.WORDPRESS_URL; else process.env.WORDPRESS_URL = previousUrl;
    if (previousAllowHttp === undefined) delete process.env.WORDPRESS_ALLOW_LOCAL_HTTP; else process.env.WORDPRESS_ALLOW_LOCAL_HTTP = previousAllowHttp;
    if (previousNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV"); else Object.assign(process.env, { NODE_ENV: previousNodeEnv });
  }
  const post = legacyBlogRows()[0];
  const snapshot = { revision: randomUUID(), posts: [post], redirects: [] };
  assert.equal(adaptWordPressSnapshot(snapshot).posts.length, 1);
  for (const status of ["draft", "scheduled", "archived"]) {
    assert.throws(() => adaptWordPressSnapshot({ ...snapshot, posts: [{ ...post, status, scheduled_at: new Date(Date.now()+60000).toISOString() }] }), /NON_PUBLIC_DATA/);
  }
  assert.throws(() => adaptWordPressSnapshot({ ...snapshot, posts: [{ ...post, published_at: new Date(Date.now() + 60000).toISOString() }] }), /NON_PUBLIC_DATA/);
  assert.throws(() => adaptWordPressSnapshot({ ...snapshot, posts: [post, { ...post, id: "other" }] }), /DUPLICATE_IDENTITY/);
  assert.throws(() => adaptWordPressSnapshot({ revision: "broken", posts: [] }), /CONTRACT_INVALID/);
  const safe = adaptWordPressSnapshot({ ...snapshot, posts: [{ ...post, content_html: '<p>safe</p><script>unsafe()</script><a href="javascript:alert(1)">link</a>' }] });
  assert(!safe.posts[0].content_html.includes("unsafe"));
  assert(!safe.posts[0].content_html.includes("javascript:"));
  assert.equal(verifyWebhook("{}", "0", "0".repeat(64), "s".repeat(32)), false);
  const directory = await mkdtemp(path.join(tmpdir(), "cohamy-webhook-test-"));
  const previous = process.env.WORDPRESS_REPLAY_DIR;
  process.env.WORDPRESS_REPLAY_DIR = directory;
  try {
    const event = randomUUID(); const reservation = await reserveWebhook(event);
    assert(reservation);
    await assert.rejects(reserveWebhook(event), /IN_PROGRESS/);
    await reservation.complete();
    assert.equal(await reserveWebhook(event), null);
    const retry = randomUUID(); const pending = await reserveWebhook(retry); assert(pending);
    await pending.release(); const again = await reserveWebhook(retry); assert(again);
    await again.complete();
  } finally {
    if (previous === undefined) delete process.env.WORDPRESS_REPLAY_DIR; else process.env.WORDPRESS_REPLAY_DIR = previous;
    const resolved = path.resolve(directory);
    if (!resolved.startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(resolved).startsWith("cohamy-webhook-test-")) throw new Error("Unsafe temporary test cleanup path");
    await rm(resolved, { recursive: true });
  }
  console.log("Headless contract passed: invalid/draft/future/duplicate payloads rejected, HTML sanitized, concurrent webhook retries and completed replay handled.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
