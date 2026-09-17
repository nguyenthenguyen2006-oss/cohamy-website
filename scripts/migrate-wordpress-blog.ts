import { loadEnvConfig } from "@next/env";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import Papa from "papaparse";
import { BLOG_HEADERS, blogRowSchema, type BlogRow } from "@/lib/blog-schema";
import { legacyBlogRows } from "@/lib/blog-legacy";
import { getBlogRowsForMigration } from "@/lib/google-sheets-blog";

loadEnvConfig(process.cwd());
const args = process.argv.slice(2);
function flag(name: string) { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; }
async function main() {
  const source = flag("--source");
  if (!["legacy", "sheets", "file"].includes(source || "")) throw new Error("Choose --source legacy|sheets|file explicitly.");
  const local = args.includes("--local");
  const apply = args.includes("--apply");
  let rows: BlogRow[];
  if (source === "legacy") rows = legacyBlogRows();
  else if (source === "sheets") rows = await getBlogRowsForMigration();
  else { const parsed = JSON.parse(await readFile(flag("--file") || "", "utf8")); rows = (Array.isArray(parsed) ? parsed : parsed.rows).map((row: unknown) => blogRowSchema.parse(row)); }
  const seen = [new Set<string>(), new Set<string>(), new Set<string>()];
  for (const row of rows) {
    [row.id, `${row.locale}:${row.slug}`, `${row.group_id}:${row.locale}`].forEach((key, index) => { if (seen[index].has(key)) throw new Error(`Duplicate identity: ${key}`); seen[index].add(key); });
  }
  const directory = path.resolve(flag("--out") || ".headless-reports/migration");
  await mkdir(directory, { recursive: true });
  const exportText = JSON.stringify({ source, rows }, null, 2) + "\n";
  const csv = "\uFEFFsep=;\r\n" + Papa.unparse(rows.map((row) => Object.fromEntries(BLOG_HEADERS.map((key) => [key, Array.isArray(row[key]) ? row[key].join(",") : row[key]]))), { columns: [...BLOG_HEADERS], delimiter: ";", newline: "\r\n" });
  const hash = createHash("sha256").update(exportText).digest("hex");
  await writeFile(path.join(directory, `source-${hash}.json`), exportText);
  await writeFile(path.join(directory, `source-${hash}.csv`), csv);
  const report: Record<string, unknown> = { source, sourceHash: hash, rows: rows.length, groups: new Set(rows.map((row) => row.group_id)).size, localeCounts: Object.fromEntries(["vi","en","zh","ko","ja"].map((locale) => [locale, rows.filter((row) => row.locale === locale).length])), mode: apply ? "apply" : "dry-run", warnings: source === "legacy" ? ["Bundled content only; not proof of current Google Sheets contents. Legacy source has no updated_at; using publishedAt as the only known source timestamp."] : [] };
  let base = process.env.WORDPRESS_URL || "";
  let user = process.env.WORDPRESS_MIGRATION_USER || "";
  let password = process.env.WORDPRESS_APPLICATION_PASSWORD || "";
  if (local) {
    const secrets = JSON.parse(await readFile(".local/secrets.json", "utf8"));
    const credentials = JSON.parse(await readFile(".local/credentials.json", "utf8"));
    base = `http://127.0.0.1:${secrets.cms_port}`; user = credentials.admin.username; password = credentials.admin.application_password;
  }
  async function request(endpoint: string, init?: RequestInit) {
    const response = await fetch(`${base.replace(/\/+$/u, "")}/wp-json/cohamy/v1${endpoint}`, { ...init, signal: AbortSignal.timeout(120000), headers: { Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`, ...init?.headers } });
    const data = await response.json();
    if (!response.ok) throw new Error(`WordPress ${response.status}: ${data.message || data.code || "API_ERROR"}`);
    return data;
  }
  const differences = (row: BlogRow, target?: BlogRow) => {
    if (!target) return ["missing"];
    const canonical = (field: string, value: unknown) => {
      if (["scheduled_at", "published_at", "created_at", "updated_at"].includes(field) && value) return new Date(String(value)).toISOString();
      return Array.isArray(value) ? JSON.stringify(field === "tags" ? [...value].sort() : value) : String(value);
    };
    return BLOG_HEADERS.filter((field) => canonical(field,row[field]) !== canonical(field,target[field]));
  };
  async function readDestination() {
    const exported: {rows: BlogRow[]} = {rows: []};
    for(let offset=0; offset<rows.length; offset+=100) {
      const batch = await request('/export?legacy_ids='+encodeURIComponent(JSON.stringify(rows.slice(offset,offset+100).map(row=>row.id))));
      exported.rows.push(...batch.rows);
    }
    return exported;
  }
  let before: { rows: BlogRow[] } | undefined;
  if (base && user && password) {
    if (!local && !base.startsWith("https://")) throw new Error("HTTPS required for migration credentials.");
    before = await readDestination();
    const conflicts = rows.flatMap((row) => {
      const target = before!.rows.find((candidate) => candidate.id === row.id);
      return target ? differences(row, target).map((field) => ({ id: row.id, field })) : [];
    });
    report.destination = { existing: rows.filter((row) => before!.rows.some((target) => target.id === row.id)).length, conflicts, overwriteExplicitlyAllowed: args.includes("--allow-overwrite") };
    await writeFile(path.join(directory, "report.json"), JSON.stringify(report, null, 2) + "\n");
    if (apply && conflicts.length && !args.includes("--allow-overwrite")) throw new Error("Destination differs from source; refusing to overwrite WordPress edits. Review report, freeze editing, then explicitly use --allow-overwrite if those changes should be replaced.");
  } else report.destination = { status: "NOT CHECKED", reason: "No WordPress migration credentials; source-only dry-run." };
  if (before && !apply) {
    const form = new FormData(); form.set("file", new Blob([csv], { type: "text/csv" }), "migration.csv");
    form.set("mode", "upsert"); form.set("preserve_status", "true"); form.set("preserve_dates", "true");
    report.preview = await request("/import/preview", { method: "POST", body: form });
  }
  if (apply) {
    if (!base || !user || !password) throw new Error("Migration credentials required for --apply.");
    await writeFile(path.join(directory, `wordpress-before-${Date.now()}.json`), JSON.stringify(before, null, 2));
    const pending = rows.filter((row) => differences(row, before!.rows.find((candidate) => candidate.id === row.id)).length);
    if (pending.length) {
    const applyCSV = "\uFEFFsep=;\r\n" + Papa.unparse(pending.map((row) => Object.fromEntries(BLOG_HEADERS.map((key) => [key, Array.isArray(row[key]) ? row[key].join(",") : row[key]]))), { columns: [...BLOG_HEADERS], delimiter: ";", newline: "\r\n" });
    const form = new FormData(); form.set("file", new Blob([applyCSV], { type: "text/csv" }), "migration.csv");
    form.set("mode", "upsert"); form.set("preserve_status", "true"); form.set("preserve_dates", "true");
    const preview = await request("/import/preview", { method: "POST", body: form });
    report.preview = preview;
    if (preview.invalid || preview.valid !== pending.length) throw new Error(`Migration validation failed. ${JSON.stringify(preview.errors)}`);
    let cursor = 0; let batch;
    do { batch = await request("/import/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: preview.token, cursor }) }); cursor = batch.cursor; } while (!batch.done);
    report.import = batch;
    } else report.import = { created: 0, updated: 0, failed: 0, done: true };
    report.skippedUnchanged = rows.length - pending.length;
    const after = await readDestination();
    await writeFile(path.join(directory, `wordpress-after-${Date.now()}.json`), JSON.stringify(after, null, 2));
    const mismatches: { id: string; field: string }[] = [];
    for (const row of rows) {
      const target = after.rows.find((candidate: BlogRow) => candidate.id === row.id);
      for (const field of differences(row, target)) mismatches.push({ id: row.id, field });
    }
    report.reconciliation = { matched: rows.length - new Set(mismatches.map((item) => item.id)).size, mismatches, targetScope: 'source legacy IDs', totalTargetRows: after.rows.length };
    await writeFile(path.join(directory, "report.json"), JSON.stringify(report, null, 2) + "\n");
    if ((report.import as { failed: number }).failed || mismatches.length) throw new Error(`Migration reconciliation failed; inspect ${directory}/report.json`);
  }
  await writeFile(path.join(directory, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ mode: report.mode, source, rows: rows.length, sourceHash: hash, report: path.join(directory, "report.json"), reconciliation: report.reconciliation }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
