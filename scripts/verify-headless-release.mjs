import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const root = process.cwd();
const runtime = JSON.parse(await readFile('.local/runtime.json', 'utf8'));
const distDir = runtime.distDir || '.next';
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? files(target) : [target];
  }));
  return nested.flat();
}
const credentials = JSON.parse(await readFile(".local/credentials.json", "utf8"));
const settings = JSON.parse(await readFile(".local/secrets.json", "utf8"));
const secrets = [settings.webhook_secret, ...Object.values(credentials).flatMap((user) =>
  [user.password, user.application_password, user.application_password?.replace(/\s/gu, "")])]
  .filter((value) => typeof value === "string" && value.length >= 16);
assert(secrets.length >= 4, "Local credentials are required for a meaningful client bundle scan");
const clientFiles = await files(path.join(root, distDir, 'static'));
for (const file of clientFiles) {
  const data = await readFile(file);
  assert(!secrets.some((secret) => data.includes(Buffer.from(secret))),
    "A server credential was found in the client bundle");
}
const pluginRoot = path.join(root, "wordpress/cohamy-headless-bridge");
const pluginFiles = await files(pluginRoot);
const pluginHashes = {};
for (const file of pluginFiles) {
  const relative = path.relative(pluginRoot, file);
  const source = await readFile(file);
  const installed = await readFile(path.join(root, ".local/wordpress/wp-content/plugins/cohamy-headless-bridge", relative));
  assert(source.equals(installed), "The tested local bridge differs from the deliverable source");
  pluginHashes[relative.replaceAll("\\", "/")] = createHash("sha256").update(source).digest("hex");
}
const migration = JSON.parse(await readFile(".headless-reports/migration/report.json", "utf8"));
assert.equal(migration.reconciliation.matched, migration.rows);
assert.equal(migration.reconciliation.mismatches.length, 0);
assert.equal(migration.skippedUnchanged, migration.rows);
await writeFile("docs/headless/test-results/migration-latest.json", JSON.stringify({
  environment: "LOCAL / REAL WORDPRESS", ...migration, verifiedAt: new Date().toISOString(),
}, null, 2) + "\n");
const report = {
  environment: "LOCAL / BUILT NEXT CLIENT + INSTALLED WORDPRESS BRIDGE",
  status: "PASS", build: (await readFile(path.join(distDir, 'BUILD_ID'), "utf8")).trim(),
  clientFilesScanned: clientFiles.length, credentialLeaks: 0,
  installedBridgeMatchesSource: true, pluginHashes, verifiedAt: new Date().toISOString(),
};
await writeFile("docs/headless/test-results/release-latest.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ status: report.status, clientFilesScanned: clientFiles.length,
  credentialLeaks: 0, installedPluginFiles: pluginFiles.length, matchedMigrationRows: migration.rows }));
