import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { chromium, expect } from '@playwright/test';

const base = 'https://cohamy.vn';
assert.ok(process.env.COHAMY_VERIFY_CREDENTIAL_PATH, 'CREDENTIAL_PATH_REQUIRED');
const credentials = JSON.parse(await fs.readFile(process.env.COHAMY_VERIFY_CREDENTIAL_PATH, 'utf8'));
const bytes = await fs.readFile('.local/internal-documents-fixture.pdf');
const checksum = createHash('sha256').update(bytes).digest('hex');
const title = 'KIỂM THỬ HỆ THỐNG · Tài liệu nội bộ · ' + randomUUID();
const description = 'Tệp kiểm tra tạm thời do quy trình triển khai tạo; được dọn sau khi xác minh.';
const fixturePath = '.local/internal-documents-production-fixture.json';
const output = process.env.COHAMY_VERIFY_OUTPUT || 'docs/crm/test-results/internal-documents-production.json';
const cases = [], errors = [], screens = [];
async function check(name, run) { await run(); cases.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
context.setDefaultTimeout(30000);
const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
let fixture;
try {
  await check('Anonymous document catalogue and file requests require authentication', async () => {
    assert.equal((await context.request.get(base + '/api/crm/internal-documents')).status(), 401);
    assert.equal((await context.request.get(base + '/api/crm/internal-documents/' + randomUUID())).status(), 401);
  });
  await check('Production administrator signs in using the actual CRM form', async () => {
    await page.goto(base + '/crm/login');
    await page.getByLabel('Email', { exact: true }).fill(credentials.email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page).toHaveURL(base + '/crm');
    const me = await context.request.get(base + '/api/crm/me'); assert.equal(me.status(), 200);
    const { user } = await me.json(); assert.equal(user.role, 'ADMIN');
    fixture = { title, description, filename: 'Kiem-tra-tai-lieu-noi-bo.pdf', uploadedBy: user.id, checksum };
  });
  await check('Administrator uploads a clearly labelled temporary PDF through the production UI', async () => {
    assert.equal((await page.goto(base + '/crm/internal-documents')).status(), 200);
    await page.getByLabel('Tên tài liệu', { exact: true }).fill(title);
    await page.getByLabel('Ghi chú', { exact: true }).fill(description);
    await page.getByLabel('Tệp tài liệu', { exact: true }).setInputFiles({ name: fixture.filename, mimeType: 'application/pdf', buffer: bytes });
    const pending = page.waitForResponse(response => response.url() === base + '/api/crm/internal-documents' && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Đăng tài liệu', exact: true }).click();
    const response = await pending; assert.equal(response.status(), 201);
    fixture.fileId = (await response.json()).id;
    await fs.writeFile(fixturePath, JSON.stringify(fixture, null, 2) + '\n');
    await expect(page.getByRole('status').filter({ hasText: 'Đã đăng tài liệu' })).toBeVisible();
    await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
  });
  await check('Catalogue omits file bytes and administrator cannot download or preview file contents', async () => {
    const response = await context.request.get(base + '/api/crm/internal-documents?q=' + encodeURIComponent(title));
    assert.equal(response.status(), 200); assert.match(response.headers()['cache-control'], /no-store/);
    const data = await response.json(); assert.equal(data.total, 1); assert.equal(data.items[0].id, fixture.fileId); assert.equal('content' in data.items[0], false);
    for (const suffix of ['', '?inline=1']) assert.equal((await context.request.get(base + '/api/crm/internal-documents/' + fixture.fileId + suffix)).status(), 403);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await page.goto(base + '/crm/internal-documents?q=' + encodeURIComponent(title));
      await expect(page.getByRole('button', { name: 'Đăng tài liệu', exact: true })).toBeVisible();
      assert.equal(await page.getByRole('link', { name: 'Tải xuống', exact: true }).count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const file = '.local/production-internal-documents/admin-' + width + '.png'; await fs.mkdir(path.dirname(file), { recursive: true }); await page.screenshot({ path: file, fullPage: true }); screens.push(file);
    }
  });
  await check('Previously retired CRM modules remain 404 and public website stays healthy', async () => {
    for (const slug of ['library', 'support', 'articles', 'automation', 'consignment', 'procurement', 'invitations', 'network']) assert.equal((await context.request.get(base + '/crm/' + slug)).status(), 404, slug);
    const health = await context.request.get(base + '/api/health'); assert.equal(health.status(), 200); assert.equal((await health.json()).ok, true);
  });
  await check('Verification session is revoked on logout', async () => {
    assert.equal((await context.request.post(base + '/api/crm/auth/logout', { headers: { origin: base } })).status(), 200);
    assert.equal((await context.request.get(base + '/api/crm/internal-documents')).status(), 401);
  });
  assert.deepEqual(errors, []);
} finally {
  await context.request.post(base + '/api/crm/auth/logout', { headers: { origin: base } }).catch(() => {});
  await browser.close();
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify({ environment: 'PRODUCTION actual Microsoft Edge administrator UI', testedAt: new Date().toISOString(), status: cases.length === 6 && errors.length === 0 ? 'PASS' : 'FAIL', cases, errors, screens, fixtureFile: fixture?.fileId ? fixturePath : null, fixtureCleanup: fixture?.fileId ? 'PENDING guarded production role verification' : 'NOT CREATED' }, null, 2) + '\n');
}
console.log(cases.length + ' production administrator document checks passed.');
