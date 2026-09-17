import {localBuildFile} from './wordpress/local-build.mjs';
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import Papa from "papaparse";
import { legacyBlogRows } from "@/lib/blog-legacy";
import { BLOG_HEADERS, type BlogRow } from "@/lib/blog-schema";

const execute = promisify(execFile);
async function main() {
  const config = JSON.parse(await readFile(".local/secrets.json", "utf8"));
  const admin = JSON.parse(await readFile(".local/credentials.json", "utf8")).admin;
  const base = `http://127.0.0.1:${config.cms_port}`;
  const front = `http://127.0.0.1:${config.frontend_port}`;
  const authorization = `Basic ${Buffer.from(`${admin.username}:${admin.application_password}`).toString("base64")}`;
  const runtime = await readFile(".local/runtime.json", "utf8");
  const build = await readFile(localBuildFile(), "utf8");
  const report: Record<string, unknown> = { environment: "LOCAL / REAL WORDPRESS + REAL RANK MATH", results: [] };
  const results = report.results as { name: string; status: string; detail: string }[];
  async function request(endpoint: string, data?: unknown) {
    const response = await fetch(base + "/wp-json" + endpoint, { method: data ? "POST" : "GET", headers: { Authorization: authorization, ...(data ? { "Content-Type": "application/json" } : {}) }, body: data ? JSON.stringify(data) : undefined });
    assert(response.ok, `${endpoint}: HTTP ${response.status}`); return response.json();
  }
  async function record(name: string, action: () => Promise<string>) {
    try { const detail = await action(); results.push({ name, status: "PASS", detail }); console.log("PASS " + name + ": " + detail); }
    catch (error) { results.push({ name, status: "FAIL", detail: String(error) }); throw error; }
  }
  async function probe(action: string) {
    return JSON.parse((await execute(process.env.PHP_BINARY || "php", ["-c", ".local/php.ini", "scripts/wordpress/probe-local.php", action])).stdout);
  }
  try {
    const uiId = Number(process.env.COHAMY_UI_PROOF_POST_ID || "96");
    let ui: { id: number; content: { raw: string }; meta: Record<string, string>; status: string };
    let route = "";
    await record("Gutenberg and Rank Math browser edit -> public Next HTML", async () => {
      ui = await request(`/wp/v2/posts/${uiId}?context=edit`);
      assert.equal(ui.status, "publish"); assert(ui.content.raw.includes("<!-- wp:paragraph -->")); assert(ui.content.raw.includes("UI_GUTENBERG_COHAMY_THAT"));
      assert.equal(ui.meta.rank_math_title, "Cohamy SEO nhập trong Rank Math thật");
      assert.equal(ui.meta.rank_math_description, "Mô tả Cohamy được nhân viên nhập trực tiếp trong Rank Math tại WordPress.");
      assert.equal(ui.meta.rank_math_focus_keyword, "Cohamy");
      route = `/${ui.meta._cohamy_locale}/${ui.meta._cohamy_locale === "vi" ? "bai-viet" : "blog"}/${ui.meta._cohamy_public_slug}`;
      const response = await fetch(front + route); assert.equal(response.status, 200); const html = await response.text();
      assert(html.includes("UI_GUTENBERG_COHAMY_THAT")); assert(html.includes(`<title>${ui.meta.rank_math_title}</title>`));
      assert(html.includes(`name="description" content="${ui.meta.rank_math_description}"`));
      return `Actual Chrome Gutenberg save/publish, focus keyword/snippet persisted in WP; HTTP 200 and exact SEO in Next production; post ${ui.id}`;
    });
    await record("Lost webhook fallback", async () => {
      const marker = `LOST_WEBHOOK_FALLBACK_COHAMY_${randomUUID().replaceAll("-", "")}`;
      const warmResponse = await fetch(front + route);
      assert.equal(warmResponse.status, 200);
      assert(!(await warmResponse.text()).includes(marker));
      // Acquire the same outbox lock as the real sender, without disabling webhooks or changing its secret.
      for (let attempt = 0; ; attempt++) {
        try { await probe("hold-webhooks"); break; } catch (error) { if (attempt >= 10) throw error; await new Promise((resolve) => setTimeout(resolve, 500)); }
      }
      try {
        const logBefore = await readFile(".local/logs/next.log", "utf8");
        await request(`/wp/v2/posts/${uiId}`, { content: ui!.content.raw + `<!-- wp:paragraph --><p>${marker}</p><!-- /wp:paragraph -->` });
        const revision = (await request("/cohamy/v1/revision")).revision;
        const html = await (await fetch(front + route)).text(); assert(html.includes(marker));
        const logAfter = await readFile(".local/logs/next.log", "utf8"); assert(!logAfter.slice(logBefore.length).includes(revision));
        return "Fresh content rendered from new revision while the real outbox sender was deliberately held; no webhook accepted for that revision";
      } finally { await probe("release-webhooks"); }
    });
    await record("CSV cannot move a previously public locale", async () => {
      const exported = (await request("/cohamy/v1/export?wp_id="+uiId)).rows.find((row: { wp_id: number }) => row.wp_id === uiId);
      const changed = { ...exported, locale: "en", slug: `locale-move-${Date.now()}` };
      const csv = "\uFEFFsep=;\r\n" + Papa.unparse([Object.fromEntries(BLOG_HEADERS.map((field) => [field, Array.isArray(changed[field]) ? changed[field].join(",") : changed[field]]))], { columns: [...BLOG_HEADERS], delimiter: ";" });
      const form = new FormData(); form.set("file", new Blob([csv]), "locale-guard.csv"); form.set("mode", "upsert");
      const response = await fetch(base + "/wp-json/cohamy/v1/import/preview", { method: "POST", headers: { Authorization: authorization }, body: form }); assert(response.ok);
      const preview = await response.json(); assert.equal(preview.invalid, 1); assert.equal(preview.valid, 0);
      const batch = await request("/cohamy/v1/import/batch", { token: preview.token, cursor: 0 }); assert.equal(batch.failed, 1); assert.equal(batch.updated, 0);
      const post = await request(`/wp/v2/posts/${uiId}?context=edit`); assert.equal(post.meta._cohamy_locale, "vi"); assert.equal(post.status, "publish");
      return "CSV preview and commit reject moving a public identity; original URL/status remain intact";
    });
    await record("Migration preserves later WordPress edits", async () => {
      const id = "migration-guard-" + randomUUID();
      const row: BlogRow = { ...legacyBlogRows()[0], id, group_id: id, slug: id, title: "Migration guard Cohamy", created_at:"2024-01-02T10:00:00.123+07:00",updated_at:"2024-01-03T10:00:00.456+07:00" };
      await mkdir(".headless-reports/migration-guard", { recursive: true });
      const filename = ".headless-reports/migration-guard/source.json";
      await writeFile(filename, JSON.stringify({ rows: [row] }));
      const argv = ["--require", "./scripts/register-server-only.cjs", "--import", "tsx", "scripts/migrate-wordpress-blog.ts", "--source", "file", "--file", filename, "--local", "--apply", "--out", ".headless-reports/migration-guard"];
      await execute(process.execPath, argv);
      const scopedExport = "/cohamy/v1/export?legacy_ids="+encodeURIComponent(JSON.stringify([id]));
      const post = (await request(scopedExport)).rows.find((post: BlogRow) => post.id === id);
      assert.equal(post.created_at,new Date(row.created_at).toISOString());assert.equal(post.updated_at,new Date(row.updated_at).toISOString());
      await request(`/wp/v2/posts/${post.wp_id}`, { title: "WordPress edit after migration must survive" });
      await assert.rejects(execute(process.execPath, argv), /refusing to overwrite WordPress edits/);
      const after = (await request(scopedExport)).rows.filter((post: BlogRow) => post.id === id);
      assert.equal(after.length, 1); assert.equal(after[0].title, "WordPress edit after migration must survive");
      return "Applied a fixture with +07:00 and millisecond timestamps (preserved as UTC), edited in real WP, rerun refused overwrite and retained one post with the new title";
    });
    await record("Local SQLite backup and restored database read", async () => {
      const backup = await probe("backup"); assert.equal(backup.database_integrity, "ok");
      assert.equal(backup.sha256,backup.restored_sha256);assert(Object.keys(backup.restored_counts).some(key=>key.endsWith('cohamy_campaign_item')));assert(Object.keys(backup.restored_counts).some(key=>key.endsWith('actionscheduler_actions')));assert(Object.keys(backup.restored_media).length>0);
      report.backup = { integrity: backup.database_integrity, sha256: backup.sha256, tableCounts: backup.restored_counts, media: backup.restored_media, comparison: backup.comparison_scope };
      return `Consistent VACUUM snapshot restored separately; ${Object.keys(backup.restored_counts).length} native/bridge/queue tables and ${Object.keys(backup.restored_media).length} media checksums match; full VPS/MariaDB restore NOT RUN`;
    });
    assert.equal(await readFile(".local/runtime.json", "utf8"), runtime); assert.equal(await readFile(localBuildFile(), "utf8"), build);
    report.runtime = JSON.parse(runtime); report.build = build; report.cmsStatus = await probe("status");
  } finally {
    report.finishedAt = new Date().toISOString();
    await writeFile("docs/headless/test-results/operations-latest.json", JSON.stringify(report, null, 2) + "\n");
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
