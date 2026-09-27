import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const port = '4320';
const base = `http://localhost:${port}`;

function getOccupyingPid(targetPort) {
  try {
    if (process.platform === 'win32') {
      const check = spawnSync('powershell', [
        '-NoProfile',
        '-Command',
        `(Get-NetTCPConnection -LocalPort ${targetPort} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)`
      ]);
      const out = check.stdout?.toString().trim();
      if (out) {
        const pids = out.split(/\r?\n/).map(s => s.trim()).filter(s => /^\d+$/.test(s) && s !== '0');
        if (pids.length > 0) return pids.join(', ');
      }
    } else {
      const check = spawnSync('lsof', ['-i', `:${targetPort}`, '-t']);
      const out = check.stdout?.toString().trim();
      if (out) {
        const pids = out.split(/\r?\n/).map(s => s.trim()).filter(s => /^\d+$/.test(s));
        if (pids.length > 0) return pids.join(', ');
      }
    }
  } catch {}
  return null;
}

let qaDir = null;
let server = null;
let browser = null;
let scriptError = null;

const cases = [];
const errors = [];
const screens = [];
const folder = '.impeccable/review/release-140';
const internal = ['requests', 'sales', 'pricing', 'quotations', 'automation', 'fields', 'care', 'visits', 'library', 'support', 'data', 'search', 'notifications', 'workspace', 'applications', 'invitations', 'audit', 'customers', 'dealers', 'goods', 'orders', 'tasks', 'inventory', 'samples', 'procurement', 'consignment', 'debts', 'cash', 'reports', 'accounts'];
const portal = ['requests', 'quotations', 'library', 'members', 'support', 'addresses', 'cart', 'invitations', 'search', 'notifications', 'workspace', 'goods', 'orders', 'inventory', 'consignment', 'settlements', 'debts', 'payments', 'profile'];

const test = async (name, run) => {
  try {
    await run();
    cases.push({ name, status: 'PASS' });
    console.log('PASS ' + name);
  } catch (error) {
    cases.push({ name, status: 'FAIL' });
    throw error;
  }
};

async function login(context, area, email) {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(area + ': ' + String(error)));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('Image with src')) errors.push(area + ': ' + message.text());
  });
  await page.goto(base + '/' + area + '/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Local-QA-Only-2026!');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL(base + '/' + area);
  return page;
}

async function visit(page, area, moduleNames, width) {
  await page.setViewportSize({ width, height: 844 });
  for (const moduleName of moduleNames) {
    const response = await page.goto(`${base}/${area}/${moduleName}`, { waitUntil: 'domcontentloaded' });
    assert.ok(response && response.status() < 500, `${area}/${moduleName} ${response?.status()}`);
    await page.locator('main').waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${area}/${moduleName} overflows ${width}`);
  }
}

async function capture(page, name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    scrollTo(0, 0);
  });
  const screenPath = folder + '/' + name + '.png';
  await page.screenshot({ path: screenPath, fullPage: true, caret: 'initial' });
  screens.push(screenPath);
}

try {
  const activePid = getOccupyingPid(port);
  if (activePid) {
    throw new Error(`Port ${port} is currently in use by process PID ${activePid}. Aborting test without killing existing process.`);
  }

  qaDir = '.local/crm-qa-140-' + randomUUID();
  await fs.mkdir(qaDir, { recursive: true });
  await fs.mkdir(folder, { recursive: true });

  console.log('1. Preparing isolated QA database at ' + qaDir);
  const seedResult = spawnSync(
    process.execPath,
    ['--require', './scripts/register-server-only.cjs', '--import', 'tsx', 'scripts/crm/seed-qa.ts'],
    {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: {
        ...process.env,
        CRM_ENVIRONMENT: 'LOCAL',
        CRM_DATABASE_MODE: 'pglite',
        CRM_LOCAL_DATA_DIR: qaDir
      }
    }
  );
  assert.equal(seedResult.status, 0, 'QA seed failed');

  console.log(`2. Starting Next.js dev server on port ${port}...`);
  server = spawn(
    process.execPath,
    [path.resolve('node_modules/next/dist/bin/next'), 'dev', '--hostname', 'localhost', '--port', port],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        CRM_QA_BUILD: 'true',
        CRM_DATABASE_MODE: 'pglite',
        CRM_ENVIRONMENT: 'LOCAL',
        CRM_LOCAL_DATA_DIR: qaDir,
        CRM_PUBLIC_ORIGIN: base,
        CRM_WEBSITE_ORDER_INTAKE: 'true',
        BLOG_SOURCE: 'legacy'
      }
    }
  );

  console.log(`3. Waiting for server readiness at ${base}/api/health...`);
  const deadline = Date.now() + 60000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) { ready = true; break; }
    } catch {}
    if (server.exitCode !== null) throw new Error('Dev server exited early with code ' + server.exitCode);
    await new Promise(r => setTimeout(r, 500));
  }
  if (!ready) throw new Error(`Dev server on ${base} did not become ready within 60s`);
  console.log(`4. Server ready on ${base}. Running browser smoke tests...`);

  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const adminContext = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const admin = await login(adminContext, 'crm', 'admin@crm-qa.invalid');

  await test('F001–F140 all authorized internal module roots render without 5xx or viewport overflow', async () => {
    await visit(admin, 'crm', internal, 1366);
    await visit(admin, 'crm', internal, 390);
  });

  await test('F001–F140 internal dashboard, ledger and sample surfaces capture at release viewports', async () => {
    for (const [path, name, width] of [['/crm', 'crm-dashboard-desktop', 1366], ['/crm/inventory', 'inventory-mobile', 390], ['/crm/samples', 'samples-mobile', 390], ['/crm/reports', 'reports-desktop', 1366]]) {
      await admin.setViewportSize({ width, height: 844 });
      await admin.goto(base + path);
      await capture(admin, name);
    }
  });

  const dealerContext = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const dealer = await login(dealerContext, 'portal', 'a@crm-qa.invalid');

  await test('F009–F020 all authorized dealer module roots render without 5xx or viewport overflow', async () => {
    await visit(dealer, 'portal', portal, 1366);
    await visit(dealer, 'portal', portal, 390);
  });

  await test('Dealer portal has no internal modules and remains usable at 320 px', async () => {
    await dealer.setViewportSize({ width: 320, height: 844 });
    await dealer.goto(base + '/portal');
    assert.equal(await dealer.getByRole('link', { name: 'Tài khoản và quyền', exact: true }).count(), 0);
    assert.equal(await dealer.getByRole('link', { name: 'Mua hàng và nhà cung cấp', exact: true }).count(), 0);
    assert.ok(await dealer.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await capture(dealer, 'dealer-dashboard-320');
  });

  await test('F130 offline shell bypasses locale rewriting and private routes keep no-store', async () => {
    const offline = await adminContext.request.get(base + '/offline');
    assert.equal(offline.status(), 200);
    assert.match(await offline.text(), /Cohamy đang chờ kết nối/);
    for (const path of ['/crm', '/portal', '/api/crm/me']) {
      const response = await adminContext.request.get(base + path);
      assert.match(response.headers()['cache-control'] ?? '', /no-store|no-cache/);
    }
  });

  assert.deepEqual(errors, []);
} catch (err) {
  scriptError = err;
  console.error('ERROR in test execution:', err.message || err);
} finally {
  if (browser) {
    try {
      await browser.close();
    } catch {}
  }

  if (server && server.exitCode === null) {
    console.log(`Stopping isolated Next.js dev server (PID: ${server.pid})...`);
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(server.pid), '/f', '/t']);
    } else {
      server.kill('SIGTERM');
    }
  }

  if (qaDir) {
    const resolvedQaDir = path.resolve(qaDir);
    const repoLocalDir = path.resolve('.local');
    if (resolvedQaDir.startsWith(repoLocalDir + path.sep)) {
      await fs.rm(resolvedQaDir, { recursive: true, force: true }).catch(() => {});
    } else {
      console.error(`Safety check failed: qaDir (${resolvedQaDir}) is not inside ${repoLocalDir}`);
    }
  }

  const isPassed = !scriptError && cases.length === 5 && cases.every(item => item.status === 'PASS') && errors.length === 0;
  const report = {
    testedAt: new Date().toISOString(),
    environment: 'LOCAL actual Edge/Next, self-contained isolated fictitious PGlite; every authorized module root at desktop/mobile',
    status: isPassed ? 'PASS' : 'FAIL',
    cases,
    errors: scriptError ? [...errors, String(scriptError?.stack || scriptError?.message || scriptError)] : errors,
    screens,
    coverage: { internal, portal }
  };
  if (scriptError) {
    report.failureReason = String(scriptError?.message || scriptError);
  }

  await fs.mkdir('docs/crm/test-results', { recursive: true });
  await fs.writeFile('docs/crm/test-results/browser-140-local.json', JSON.stringify(report, null, 2));

  if (scriptError) {
    process.exit(1);
  }
}
