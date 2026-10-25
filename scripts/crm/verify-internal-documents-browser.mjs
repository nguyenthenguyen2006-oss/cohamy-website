import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

// First run verify-internal-documents.ts to create the isolated fixture.
const fixture = JSON.parse(await fs.readFile('.local/internal-documents-fixture.json', 'utf8'));
assert.match(fixture.directory, /^\.local\/crm-qa-internal-documents-[a-f0-9-]+$/);
const bytes = await fs.readFile('.local/internal-documents-fixture.pdf');
const checksum = createHash('sha256').update(bytes).digest('hex');
const base = 'http://localhost:4327', password = 'Local-QA-Only-2026!';
const output = 'docs/crm/test-results/internal-documents-browser-local.json';
const screenshots = 'docs/crm/test-results/screenshots';
await fs.mkdir(screenshots, { recursive: true });
const cases = [], errors = [], screens = [];
async function check(name, run) { await run(); cases.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
const log = await fs.open('.local/crm-qa-internal-documents-server.log', 'w');
const server = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'dev', '--hostname', 'localhost', '--port', '4327'], {
  windowsHide: true, stdio: ['ignore', log.fd, log.fd],
  env: { ...process.env, CRM_QA_BUILD: 'true', CRM_QA_BUILD_VARIANT: 'upgrade', CRM_DATABASE_MODE: 'pglite', CRM_ENVIRONMENT: 'LOCAL', CRM_LOCAL_DATA_DIR: fixture.directory, CRM_PUBLIC_ORIGIN: base, BLOG_SOURCE: 'legacy' },
});
let browser;
try {
  let ready = false;
  for (let count = 0; count < 90; count++) {
    if (server.exitCode !== null) throw Error('QA_SERVER_EXITED');
    try { ready = (await fetch(base + '/crm/login')).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'QA_SERVER_NOT_READY');
  // Playwright's headless PDF navigation is unsupported. Keep the headed QA window off-screen.
  browser = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-position=-2400,-2400'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  context.setDefaultTimeout(15000); context.setDefaultNavigationTimeout(20000);
  const signIn = async (context, email) => {
    const response = await context.request.post(base + '/api/crm/auth/login', { headers: { origin: base }, data: { email, password } });
    assert.equal(response.status(), 200, email);
  };
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  let uploadedId;
  const title = 'LOCAL QA – Tài liệu từ trình duyệt ' + randomUUID().slice(0, 8);
  await check('Anonymous list/file APIs require authentication', async () => {
    assert.equal((await context.request.get(base + '/api/crm/internal-documents')).status(), 401);
    assert.equal((await context.request.get(base + '/api/crm/internal-documents/' + fixture.fileId)).status(), 401);
  });
  await signIn(context, 'admin@crm-qa.invalid');
  await check('Admin uploads a real PDF through the browser with Vietnamese metadata', async () => {
    assert.equal((await page.goto(base + '/crm/internal-documents')).status(), 200);
    await expect(page.getByRole('heading', { name: 'Tài liệu nội bộ', exact: true })).toBeVisible();
    await page.getByLabel('Tên tài liệu', { exact: true }).fill(title);
    await page.getByLabel('Ghi chú', { exact: true }).fill('Tệp thử nghiệm riêng cho kiểm tra quyền truy cập.');
    await page.getByLabel('Tệp tài liệu', { exact: true }).setInputFiles({ name: 'Quy trình nội bộ.pdf', mimeType: 'application/pdf', buffer: bytes });
    await page.getByRole('button', { name: 'Đăng tài liệu', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Đã đăng tài liệu' })).toBeVisible();
    await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
    const response = await context.request.get(base + '/api/crm/internal-documents?q=' + encodeURIComponent(title), { maxRetries: 2 });
    const data = await response.json(); assert.equal(data.total, 1); uploadedId = data.items[0].id;
    assert.equal('content' in data.items[0], false);
    const adminFile=await context.request.get(base + '/api/crm/internal-documents/' + uploadedId);assert.equal(adminFile.status(),200);assert.deepEqual(await adminFile.body(),bytes);
  });
  await check('Admin desktop/mobile pages keep the CRM table layout and document-read controls', async () => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + '/crm/internal-documents?q=' + encodeURIComponent(title));
      await expect(page.getByRole('button', { name: 'Đăng tài liệu', exact: true })).toBeVisible();
      assert.ok(await page.getByRole('link', { name: 'Tải xuống', exact: true }).count()>0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const file = screenshots + '/internal-documents-admin-' + width + '.png'; await page.screenshot({ path: file, fullPage: true }); screens.push(file);
    }
  });
  await check('Cross-origin, extra-audience fields and oversize multipart bodies are rejected', async () => {
    assert.equal((await context.request.post(base + '/api/crm/internal-documents', { headers: { origin: 'https://untrusted.invalid' }, data: {} })).status(), 403);
    const response = await context.request.post(base + '/api/crm/internal-documents', { headers: { origin: base }, multipart: { title: 'Invalid audience', description: '', uploadKey: randomUUID(), audience: 'PUBLIC', file: { name: 'test.pdf', mimeType: 'application/pdf', buffer: bytes } } });
    assert.equal(response.status(), 400);
    const oversized = await context.request.post(base + '/api/crm/internal-documents', { headers: { origin: base, 'content-type': 'multipart/form-data; boundary=test' }, data: Buffer.alloc(20 * 1024 * 1024 + 32769) });
    assert.equal(oversized.status(), 413);
  });
  await check('Accountant and all three warehouse roles can view, preview and download, and cannot upload', async () => {
    for (const email of ['accountant', 'warehouse', 'warehouse_hcm', 'warehouse_hn']) {
      const reader = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); await signIn(reader, email + '@crm-qa.invalid');
      reader.setDefaultTimeout(15000); reader.setDefaultNavigationTimeout(20000);
      const view = await reader.newPage(); view.on('pageerror', error => errors.push(error.message));
      assert.equal((await view.goto(base + '/crm/internal-documents?q=' + encodeURIComponent(title))).status(), 200, email);
      await expect(view.getByRole('heading', { name: 'Tài liệu nội bộ', exact: true })).toBeVisible();
      assert.equal(await view.getByRole('button', { name: 'Đăng tài liệu', exact: true }).count(), 0);
      const file = await reader.request.get(base + '/api/crm/internal-documents/' + uploadedId);
      assert.equal(file.status(), 200); assert.deepEqual(await file.body(), bytes); assert.match(file.headers()['content-disposition'], /^attachment/); assert.match(file.headers()['cache-control'], /no-store/); assert.equal(file.headers()['x-content-type-options'], 'nosniff');
      const preview = await reader.request.get(base + '/api/crm/internal-documents/' + uploadedId + '?inline=1'); assert.equal(preview.status(), 200); assert.match(preview.headers()['content-disposition'], /^inline/);
      assert.equal((await reader.request.post(base + '/api/crm/internal-documents', { headers: { origin: base }, data: {} })).status(), 403);
      if (email === 'accountant') {
        const downloaded = view.waitForEvent('download'); await view.getByRole('link', { name: 'Tải xuống', exact: true }).click();
        const download = await downloaded; assert.deepEqual(await fs.readFile(await download.path()), bytes);
        await view.getByRole('link', { name: 'Xem', exact: true }).click(); await expect(view.locator('.internal-document-preview')).toBeVisible();
        await view.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
        const frames = view.frames().map(frame => ({ url: frame.url() }));
        await fs.writeFile('.local/internal-document-preview-frames.json', JSON.stringify(frames, null, 2));
        const shot = screenshots + '/internal-documents-reader-preview.png'; await view.screenshot({ path: shot, fullPage: true }); screens.push(shot);
        await view.setViewportSize({ width: 390, height: 844 }); await view.goto(base + '/crm/internal-documents?q=' + encodeURIComponent(title));
        assert.ok(await view.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        const mobile = screenshots + '/internal-documents-reader-390.png'; await view.screenshot({ path: mobile, fullPage: true }); screens.push(mobile);
      }
      await reader.close();
    }
  });
  await check('Manager, sales and both dealer roles have no menu, page, list, download or upload access', async () => {
    for (const [email, area] of [['manager', 'crm'], ['sales', 'crm'], ['a', 'portal'], ['dealer_staff', 'portal']]) {
      const denied = await browser.newContext(); await signIn(denied, email + '@crm-qa.invalid');
      const response = await denied.request.get(base + '/' + area + '/internal-documents'); assert.equal(response.status(), 404, email);
      const home = await denied.request.get(base + '/' + area); assert.ok(!(await home.text()).includes('href="/' + area + '/internal-documents"'), email);
      assert.equal((await denied.request.get(base + '/api/crm/internal-documents')).status(), 403, email);
      assert.equal((await denied.request.get(base + '/api/crm/internal-documents/' + uploadedId)).status(), 403, email);
      assert.equal((await denied.request.post(base + '/api/crm/internal-documents', { headers: { origin: base }, data: {} })).status(), 403, email);
      await denied.close();
    }
  });
  await check('New files do not bypass the old private-document endpoint and retired modules remain closed', async () => {
    assert.equal((await context.request.get(base + '/api/crm/documents/' + uploadedId)).status(), 404);
    for (const slug of ['library', 'support', 'articles', 'automation', 'consignment', 'procurement', 'invitations', 'network']) assert.equal((await context.request.get(base + '/crm/' + slug)).status(), 404, slug);
    assert.equal((await context.request.delete(base + '/api/crm/internal-documents/' + uploadedId, { headers: { origin: base } })).status(), 405);
  });
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  if (server.pid) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else server.kill('SIGTERM');
  }
  await log.close();
  await fs.writeFile(output, JSON.stringify({ environment: 'LOCAL isolated PGlite and Microsoft Edge', testedAt: new Date().toISOString(), status: cases.length === 7 && errors.length === 0 ? 'PASS' : 'FAIL', cases, errors, screens, fixtureChecksum: checksum, deployment: 'NOT RUN' }, null, 2) + '\n');
}
console.log(cases.length + ' internal-document browser checks passed.');
