import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { createQaFixture, qaPassword } from "./qa-fixture";
import { database } from "../../lib/crm/db";
import { login } from "../../lib/crm/auth";
import { createAccount, createOrganization } from "../../lib/crm/repository";
import { createTask } from "../../lib/crm/work";
import { visibleModules, getVisibleHubs } from "../../lib/crm/modules";
import { roles } from "../../lib/crm/types";
import { assertModuleAvailable } from "../../lib/crm/module-availability";
import { entityAccess } from "../../lib/crm/workspace";
import { runCareAutomation, saveCareSchedule, saveCareRule, saveSlaPolicy } from "../../lib/crm/care-automation";

const base = "http://localhost:4326";
const removed = ["library", "support", "articles", "automation", "consignment", "procurement", "invitations", "network"];
const cases: { name: string; status: "PASS" }[] = [];
async function check(name: string, run: () => Promise<void> | void) {
  await run(); cases.push({ name, status: "PASS" }); console.log("PASS " + name);
}

async function main() {
  process.env.CRM_DATABASE_MODE = "pglite";
  process.env.CRM_ENVIRONMENT = "LOCAL";
  process.env.CRM_LOCAL_DATA_DIR = ".local/crm-qa-module-removal-" + randomUUID();
  await fs.mkdir(".local", { recursive: true });
  const ids = await createQaFixture();
  const db = await database();
  try {
    const { user } = await login("admin@crm-qa.invalid", qaPassword);
    for (const role of ["MANAGER", "WAREHOUSE_HCM", "WAREHOUSE_HN"] as const) {
      await createAccount(user, { email: role.toLowerCase() + "@crm-qa.invalid", displayName: "LOCAL QA " + role, password: qaPassword, role, organizationId: user.organizationId });
    }
    await check("All current internal roles lose the retired modules and empty hub groups", () => {
      for (const role of roles.filter(r => !r.startsWith("DEALER_"))) {
        const principal = { ...user, role };
        assert.equal(visibleModules(principal).some(m => removed.includes(m.id)), false, role);
        assert.equal(getVisibleHubs(principal).some(h => ["library", "procurement", "consignment"].includes(h.hub.id)), false, role);
        for (const id of removed) assert.throws(() => assertModuleAvailable(principal, id), e => (e as { status: number }).status === 404);
      }
    });
    await check("Enabled legacy schedules, rules and SLA cannot generate tasks", async () => {
      await saveCareSchedule(user, { version: 0, entityType: "partner", entityId: ids.dealerA, title: "LOCAL QA retired schedule", assigneeId: user.membershipId, kind: "FOLLOW_UP", frequency: "DAILY", every: 1, nextDueAt: new Date(Date.now() - 3600000).toISOString(), enabled: true });
      await saveCareRule(user, { version: 0, name: "LOCAL QA retired rule", eventAction: "partner.created", title: "LOCAL QA retired task", kind: "GENERAL", assigneeId: user.membershipId, dueMinutes: 1, enabled: true });
      await createOrganization(user, { code: "QA_RETIRED_RULE", name: "LOCAL QA trigger", kind: "CUSTOMER" });
      await saveSlaPolicy(user, { version: 0, name: "LOCAL QA retired SLA", kind: "GENERAL", delayMinutes: 0, recipientId: user.membershipId, enabled: true });
      await createTask(user, { entityType: "partner", entityId: ids.dealerA, title: "LOCAL QA manual overdue", assigneeId: user.membershipId, dueAt: new Date(Date.now() - 3600000).toISOString(), kind: "GENERAL" });
      const counts = async () => (await db.query("SELECT (SELECT count(*) FROM cohamy_crm.tasks) AS tasks,(SELECT count(*) FROM cohamy_crm.care_schedule_runs) AS schedules,(SELECT count(*) FROM cohamy_crm.care_rule_runs) AS rules,(SELECT count(*) FROM cohamy_crm.care_escalations) AS escalations")).rows[0];
      const before = await counts();
      assert.equal(await runCareAutomation(), 0); assert.deepEqual(await counts(), before);
      assert.equal((await db.query("SELECT id FROM cohamy_crm.care_schedules WHERE enabled")).rows.length, 1);
    });
    await check("Archived support/library entities cannot reappear in CRM documents, pins or notifications", async () => {
      for (const type of ["library", "ticket"]) await assert.rejects(entityAccess(user, type, randomUUID()), e => (e as { status: number }).status === 404);
    });
    await check("Dealer Portal module registration stays available", async () => {
      const dealer = (await login("a@crm-qa.invalid", qaPassword)).user;
      for (const id of ["library", "support", "consignment", "network", "invitations"]) assert.ok(visibleModules(dealer).some(m => m.id === id));
    });
  } finally { await db.close(); }

  const serverLog = await fs.open(".local/crm-qa-module-removal-server.log", "w");
  const server = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "dev", "--hostname", "localhost", "--port", "4326"], {
    windowsHide: true, stdio: ["ignore", serverLog.fd, serverLog.fd],
    env: { ...process.env, CRM_QA_BUILD: "true", CRM_QA_BUILD_VARIANT: "upgrade", CRM_PUBLIC_ORIGIN: base, BLOG_SOURCE: "legacy" },
  });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const pageErrors: string[] = [];
  try {
    let ready = false;
    for (let i = 0; i < 90; i++) {
      if (server.exitCode !== null) throw Error("QA_SERVER_EXITED");
      try { ready = (await fetch(base + "/crm/login")).ok; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.ok(ready, "QA_SERVER_NOT_READY");
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const signIn = async (context: typeof adminContext, email: string) => {
      const response = await context.request.post(base + "/api/crm/auth/login", { headers: { origin: base }, data: { email, password: qaPassword } });
      assert.equal(response.status(), 200, email);
    };
    await signIn(adminContext, "admin@crm-qa.invalid");
    const page = await adminContext.newPage();
    page.on("pageerror", error => pageErrors.push(error.message));
    await check("Desktop and mobile CRM navigation has no retired features or groups", async () => {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal((await page.goto(base + "/crm"))?.status(), 200);
        await expect(page.locator("h1")).toBeVisible();
        for (const id of removed) assert.equal(await page.locator(`a[href^="/crm/${id}"]`).count(), 0, id);
        for (const id of ["library", "consignment", "procurement"]) assert.equal(await page.locator(`a[href="/crm/hub/${id}"]`).count(), 0, id);
        await page.screenshot({ path: `docs/crm/test-results/screenshots/module-removal-${width}.png`, fullPage: true });
      }
    });
    await check("Every retired CRM URL and detail URL returns 404 to an administrator", async () => {
      for (const id of removed) for (const suffix of ["", "/new", "/" + randomUUID()]) {
        const response = await adminContext.request.get(base + "/crm/" + id + suffix);
        assert.equal(response.status(), 404, id + suffix);
      }
      for (const id of ["library", "consignment", "procurement"]) assert.equal((await adminContext.request.get(base + "/crm/hub/" + id)).status(), 404, id);
    });
    await check("CRM read and write APIs reject all eight retired features", async () => {
      const reads = ["library/list", "portal/tickets", "articles/list", "automation/schedules", "consignment/overview", "procurement/overview", "onboarding/invitations", "channel/network"];
      const writes = ["library/save", "portal/ticket", "articles/save", "automation/schedule", "consignment/agreement-save", "procurement/supplier-create", "onboarding/invitation", "channel/promotion"];
      for (const route of reads) assert.equal((await adminContext.request.get(base + "/api/crm/" + route)).status(), 404, route);
      for (const route of writes) {
        const response = await adminContext.request.post(base + "/api/crm/" + route, { headers: { origin: base }, data: {} });
        assert.equal(response.status(), 404, route);
      }
    });
    await check("Partner details no longer expose network or recurring-work forms", async () => {
      await page.goto(base + "/crm/dealers/" + ids.dealerA);
      await expect(page.getByRole("heading", { name: "LOCAL QA · Đại lý A", exact: true })).toBeVisible();
      assert.equal(await page.getByRole("heading", { name: "Hồ sơ kênh phân phối", exact: true }).count(), 0);
      assert.equal(await page.getByRole("heading", { name: "Lịch chăm sóc định kỳ", exact: true }).count(), 0);
    });
    await check("Warehouse and accountant routes cannot bypass retired-module checks", async () => {
      for (const email of ["warehouse@crm-qa.invalid", "warehouse_hcm@crm-qa.invalid", "warehouse_hn@crm-qa.invalid", "accountant@crm-qa.invalid"]) {
        const context = await browser!.newContext(); await signIn(context, email);
        assert.equal((await context.request.get(base + "/crm")).status(), 200, email);
        for (const id of removed) assert.equal((await context.request.get(base + "/crm/" + id)).status(), 404, email + ":" + id);
        await context.close();
      }
    });
    await check("Remaining CRM orders, inventory, work, pricing and reports stay available", async () => {
      for (const route of ["requests", "inventory", "tasks", "pricing", "period-sales", "kpi", "hub/dealers", "hub/tasks"]) assert.equal((await adminContext.request.get(base + "/crm/" + route)).status(), 200, route);
      for (const route of ["channel/report", "channel/catalog?organizationId=" + ids.dealerA]) assert.equal((await adminContext.request.get(base + "/api/crm/" + route)).status(), 200, route);
    });
    await check("Shared Portal pages and APIs still work for a dealer", async () => {
      const context = await browser!.newContext(); await signIn(context, "a@crm-qa.invalid");
      for (const route of ["library", "support", "consignment", "network", "invitations"]) assert.equal((await context.request.get(base + "/portal/" + route)).status(), 200, route);
      for (const route of ["library/list", "portal/tickets", "consignment/overview", "onboarding/invitations", "channel/network"]) assert.equal((await context.request.get(base + "/api/crm/" + route)).status(), 200, route);
      await context.close();
    });
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser?.close();
    if (server.pid) {
      if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      else server.kill("SIGTERM");
    }
    await serverLog.close();
    await fs.writeFile("docs/crm/test-results/module-removal-local.json", JSON.stringify({ environment: "LOCAL", testedAt: new Date().toISOString(), browser: "Microsoft Edge headless", fixture: process.env.CRM_LOCAL_DATA_DIR, status: cases.length === 11 && pageErrors.length === 0 ? "PASS" : "FAIL", cases, pageErrors, deployment: "NOT RUN" }, null, 2) + "\n");
  }
  console.log(cases.length + " module-removal checks passed.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
