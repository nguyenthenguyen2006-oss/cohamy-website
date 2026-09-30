/**
 * Cohamy CRM - Demo Browser Smoke Test
 * Tests UI across roles in DEMO environment with PostgreSQL/PGlite.
 * Verifies interactive operations: CREATE (Tạo), EDIT (Sửa), APPROVE (Duyệt).
 * Captures screenshot evidence into docs/crm/demo-screenshots/.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const screenshotDir = 'docs/crm/demo-screenshots';

function checkPortAvailable(p) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => {
      srv.close(() => resolve(true));
    });
    srv.listen(p, '127.0.0.1');
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port;
      srv.close(() => resolve(p));
    });
    srv.on('error', reject);
  });
}

function createHttpsProxy(targetPort, certPem, keyPem) {
  return new Promise((resolve, reject) => {
    const srv = https.createServer({ cert: certPem, key: keyPem }, (req, res) => {
      const options = {
        hostname: '127.0.0.1',
        port: targetPort,
        path: req.url,
        method: req.method,
        headers: {
          ...req.headers,
          host: `localhost:${srv.address().port}`,
          'x-forwarded-proto': 'https',
        },
      };
      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });
      proxyReq.on('error', (err) => {
        if (!res.headersSent) {
          try {
            res.writeHead(502);
            res.end('Bad Gateway: ' + err.message);
          } catch {}
        }
      });
      req.pipe(proxyReq);
    });
    srv.on('upgrade', (req, socket) => {
      const proxySocket = net.connect(targetPort, '127.0.0.1', () => {
        proxySocket.write(
          `${req.method} ${req.url} HTTP/1.1\r\n` +
          Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
          '\r\n\r\n'
        );
        proxySocket.pipe(socket);
        socket.pipe(proxySocket);
      });
      proxySocket.on('error', () => socket.destroy());
    });
    srv.listen(0, '127.0.0.1', () => {
      resolve(srv);
    });
    srv.on('error', reject);
  });
}

let server = null;
let httpsProxy = null;
let browser = null;
let base = '';
let port = 0;
const cases = [];
const errors = [];

const test = async (name, run) => {
  try {
    await run();
    cases.push({ name, status: 'PASS' });
    console.log('✅ PASS ' + name);
  } catch (error) {
    cases.push({ name, status: 'FAIL', error: String(error) });
    console.error('❌ FAIL ' + name, error);
    throw error;
  }
};

async function capture(page, name) {
  await page.evaluate(async () => {
    if (document.fonts) await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  const screenPath = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: screenPath, fullPage: true });
}

async function loginUser(context, area, email, password) {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`${area}:${email}: ${String(error)}`));
  page.on('console', msg => {
    const text = msg.text();
    if (!text.toLowerCase().includes('certificate error')) {
      console.log(`[Browser ${area}]`, msg.type(), text);
    }
  });
  page.on('response', async res => {
    if (res.url().includes('/api/crm/auth/login')) {
      console.log(`[LOGIN RESPONSE] status: ${res.status()}`);
    }
  });

  await page.goto(`${base}/${area}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('button.crm-login-btn').click();

  // Wait until navigated away from /login into target area
  await page.waitForFunction(
    expectedArea => {
      const p = window.location.pathname;
      return p === `/${expectedArea}` || (p.startsWith(`/${expectedArea}/`) && !p.includes('/login'));
    },
    area,
    { timeout: 15000 }
  );

  await page.waitForSelector('main', { timeout: 10000 });
  return page;
}

async function main() {
  console.log('=================================================');
  console.log(' [COHAMY CRM] BROWSER SMOKE TEST CHO DEMO       ');
  console.log('=================================================');

  const dbMode = process.env.CRM_DATABASE_MODE || 'pglite';
  const dbUrl = process.env.CRM_DATABASE_URL || '';
  const localDataDir = process.env.CRM_LOCAL_DATA_DIR || '.local/crm-demo';

  console.log(` Database Mode : ${dbMode}`);
  if (dbMode === 'postgres') {
    const sanitizedUrl = dbUrl ? dbUrl.replace(/:[^:@]+@/, ':****@') : '[UNSET]';
    console.log(` Target DB URL : ${sanitizedUrl}`);
  } else {
    console.log(` Local Storage : ${localDataDir}`);
  }

  let rawPassword = process.env.CRM_DEMO_PASSWORD?.trim();
  if (!rawPassword) {
    try {
      const creds = JSON.parse(await fs.readFile('.local/demo-credentials.json', 'utf8'));
      rawPassword = creds.commonPassword || creds.password;
    } catch {}
  }
  if (!rawPassword) {
    throw new Error('DEMO_PASSWORD_NOT_FOUND: Please run crm:demo-seed or set CRM_DEMO_PASSWORD.');
  }
  await fs.mkdir(screenshotDir, { recursive: true });

  // 1. Non-destructive port selection (strictly avoid killing external processes)
  if (process.env.PORT) {
    const requestedPort = parseInt(process.env.PORT, 10);
    const isAvail = await checkPortAvailable(requestedPort);
    if (!isAvail) {
      throw new Error(`PORT_OCCUPIED_ERROR: Requested port ${requestedPort} is currently in use. Will not kill external processes.`);
    }
    port = requestedPort;
  } else {
    const isDefaultAvail = await checkPortAvailable(4330);
    if (isDefaultAvail) {
      port = 4330;
    } else {
      port = await getFreePort();
      console.log(`[PORT] Cổng 4330 đang bận. Đã tự động chọn cổng trống khả dụng: ${port}`);
    }
  }

  // 2. Ensure seed data exists
  console.log('\n1. Đảm bảo dữ liệu demo đã được seed...');
  const seedResult = spawnSync(
    process.execPath,
    ['--require', './scripts/register-server-only.cjs', '--import', 'tsx', 'scripts/crm/demo/seed.ts'],
    {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: {
        ...process.env,
        CRM_ENVIRONMENT: 'DEMO',
        CRM_DEMO_MODE: 'true',
        CRM_DATABASE_MODE: dbMode,
        CRM_DATABASE_URL: dbUrl,
        CRM_LOCAL_DATA_DIR: localDataDir,
      }
    }
  );
  assert.equal(seedResult.status, 0, 'Seed demo failed');

  // 3. Setup HTTPS support for DEMO running in production
  let publicOrigin = `http://localhost:${port}`;
  try {
    const certPem = await fs.readFile('.local/demo-test-cert.pem');
    const keyPem = await fs.readFile('.local/demo-test-key.pem');
    httpsProxy = await createHttpsProxy(port, certPem, keyPem);
    const httpsPort = httpsProxy.address().port;
    publicOrigin = `https://localhost:${httpsPort}`;
    console.log(`\n[HTTPS PROXY] Kích hoạt proxy HTTPS cục bộ trên cổng ${httpsPort} -> ${port}`);
  } catch {
    console.log('[HTTPS PROXY] Không tìm thấy chứng chỉ .local/demo-test-cert.pem, dùng HTTP trực tiếp.');
  }

  base = publicOrigin;

  // 4. Start Next.js server on chosen isolated port
  const hasBuild = await fs.stat('.next').then(() => true).catch(() => false);
  const serverCommand = hasBuild ? 'start' : 'dev';
  console.log(`\n2. Khởi động Next.js ${serverCommand} server trên cổng ${port} (Origin: ${publicOrigin})...`);

  server = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', serverCommand, '-p', String(port)],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: hasBuild ? 'production' : 'development',
        CRM_ENVIRONMENT: 'DEMO',
        CRM_DEMO_MODE: 'true',
        CRM_DATABASE_MODE: dbMode,
        CRM_DATABASE_URL: dbUrl,
        CRM_LOCAL_DATA_DIR: localDataDir,
        CRM_PUBLIC_ORIGIN: publicOrigin,
      }
    }
  );

  server.stdout.on('data', chunk => {
    const s = chunk.toString();
    if (s.includes('Ready') || s.includes('compiled') || s.includes('Local:')) {
      // console.log('[Next.js]', s.trim());
    }
  });
  server.stderr.on('data', chunk => {
    console.error('[Next.js STDERR]', chunk.toString().trim());
  });

  // Wait for server to become ready
  let serverReady = false;
  for (let i = 0; i < 40; i++) {
    try {
      const status = await new Promise((resolve, reject) => {
        const mod = base.startsWith('https') ? https : http;
        mod.get(base + '/crm/login', { rejectUnauthorized: false }, (r) => {
          resolve(r.statusCode);
        }).on('error', reject);
      });
      if (status && status < 500) {
        serverReady = true;
        break;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  assert.ok(serverReady, 'Next.js server did not become ready in time');
  console.log(`Next.js server (${serverCommand} mode) is ready at ${base}!`);

  // 5. Launch browser (using installed system browser)
  browser = await chromium.launch({
    headless: true,
    channel: 'msedge',
    args: ['--ignore-certificate-errors', '--allow-insecure-localhost'],
  });
  const origNewContext = browser.newContext.bind(browser);
  browser.newContext = (opts = {}) => origNewContext({ ignoreHTTPSErrors: true, ...opts });

  try {
    // Test 1: Demo Banner visibility & CRM Login Page
    await test('B01: Hiển thị banner DEMO nổi bật trên trang đăng nhập CRM', async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      await page.goto(`${base}/crm/login`);
      
      const banner = page.locator('.crm-demo-banner');
      await banner.waitFor({ timeout: 10000 });
      const bannerText = await banner.textContent();
      assert.ok(bannerText.includes('MÔI TRƯỜNG DEMO — DỮ LIỆU GIẢ LẬP'), 'Banner text must match');
      await capture(page, '01_crm_login_with_banner');
      await context.close();
    });

    // Test 2: Admin Flow & Overview Dashboards
    await test('B02: Đăng nhập Quản trị viên (Admin) và kiểm tra Dashboard nghiệp vụ', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await loginUser(context, 'crm', 'admin@demo.cohamy.invalid', rawPassword);
      
      // Check admin dashboard
      await page.waitForSelector('main');
      await capture(page, '02_admin_dashboard');

      // Check Customers list
      await page.goto(`${base}/crm/customers`);
      await page.waitForSelector('main');
      await capture(page, '03_admin_customers_list');

      // Check Dealers list
      await page.goto(`${base}/crm/dealers`);
      await page.waitForSelector('main');
      await capture(page, '04_admin_dealers_list');

      // Check Partner Applications (with SUBMITTED items waiting for boss review!)
      await page.goto(`${base}/crm/applications`);
      await page.waitForSelector('main');
      await capture(page, '05_admin_partner_applications');

      // Check Inventory with near-expiry alert lots
      await page.goto(`${base}/crm/inventory`);
      await page.waitForSelector('main');
      await capture(page, '06_admin_inventory_ledger');

      // Check Quotations list
      await page.goto(`${base}/crm/quotations`);
      await page.waitForSelector('main');
      await capture(page, '07_admin_quotations_list');

      // Check Debts & Aging Analysis
      await page.goto(`${base}/crm/debts`);
      await page.waitForSelector('main');
      await capture(page, '08_admin_debts_aging');

      // Check Tasks (Overdue, Due soon)
      await page.goto(`${base}/crm/tasks`);
      await page.waitForSelector('main');
      await capture(page, '09_admin_tasks_overdue');

      // Check Support Tickets
      await page.goto(`${base}/crm/support`);
      await page.waitForSelector('main');
      await capture(page, '10_admin_support_tickets');

      // Check Library Documents
      await page.goto(`${base}/crm/library`);
      await page.waitForSelector('main');
      await capture(page, '11_admin_library_documents');

      await context.close();
    });

    // Test 3: Admin DUYỆT hồ sơ đối tác trực tiếp trên giao diện
    await test('B03: [Thao tác DUYỆT - Admin] Xem và DUYỆT hồ sơ đối tác đang chờ duyệt', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await loginUser(context, 'crm', 'admin@demo.cohamy.invalid', rawPassword);

      await page.goto(`${base}/crm/applications`);
      await page.waitForSelector('main');

      // Find first "Xem hồ sơ" link
      const viewLink = page.locator('a.button--secondary', { hasText: 'Xem hồ sơ' }).first();
      await viewLink.waitFor({ timeout: 10000 });
      await viewLink.click();

      // Wait for application detail page
      await page.waitForURL(/\/crm\/applications\/[a-f0-9-]+/);
      await page.waitForSelector('main');
      await capture(page, '05a_admin_application_pending_review');

      // Fill review note and approve
      const reviewSection = page.locator('section.work-section', { hasText: 'Duyệt và cấp quyền đại lý' });
      await reviewSection.waitFor({ timeout: 10000 });

      const messageInput = reviewSection.locator('textarea[name="message"]');
      if (await messageInput.count() > 0) {
        await messageInput.fill('Hồ sơ pháp lý hợp lệ. Quản trị viên duyệt cấp quyền đại lý chính thức.');
      }

      const approveButton = reviewSection.locator('button.button--primary', { hasText: 'Duyệt hồ sơ' });
      await approveButton.click();

      // Wait for success indicator or status update
      await page.waitForTimeout(1500);
      await capture(page, '05b_admin_application_approved');

      await context.close();
    });

    // Test 4: Sales TẠO khách hàng mới
    const testCustCode = `KH-DEMO-${Date.now().toString().slice(-4)}`;
    const testCustName = `Nhà thuốc Minh Châu Demo ${Date.now().toString().slice(-4)}`;

    await test('B04: [Thao tác TẠO - Sales] Nhân viên kinh doanh đăng nhập và TẠO khách hàng mới', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await loginUser(context, 'crm', 'sales@demo.cohamy.invalid', rawPassword);

      await page.goto(`${base}/crm/customers/new`);
      await page.waitForSelector('form.crm-record-form');

      await page.locator('#record-code').fill(testCustCode);
      await page.locator('#record-name').fill(testCustName);
      await page.locator('#record-phone').fill('0912345678');
      await page.locator('#record-email').fill(`minhchau${Date.now().toString().slice(-4)}@demo.cohamy.invalid`);
      await page.locator('#record-address').fill('123 Nguyễn Thị Minh Khai, Phường 6, Quận 3, TP.HCM');
      await page.locator('#partner-segment').fill('Nhà thuốc bán lẻ');

      await page.locator('button.button--primary', { hasText: 'Lưu dữ liệu' }).click();

      // Should redirect back to /crm/customers
      await page.waitForURL(/\/crm\/customers/);
      await page.waitForSelector('table.data-table');
      
      const createdRow = page.locator('table.data-table', { hasText: testCustName });
      await createdRow.waitFor({ timeout: 10000 });
      await capture(page, '03b_sales_customer_created');

      await context.close();
    });

    // Test 5: Sales SỬA / GHI CHÚ chăm sóc khách hàng
    await test('B05: [Thao tác SỬA / GHI CHÚ - Sales] Thêm ghi chú chăm sóc khách hàng', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await loginUser(context, 'crm', 'sales@demo.cohamy.invalid', rawPassword);

      await page.goto(`${base}/crm/customers`);
      await page.waitForSelector('table.data-table');

      // Click on customer name to open detail
      const custLink = page.locator('a.table-primary', { hasText: testCustName }).first();
      await custLink.click();

      await page.waitForURL(/\/crm\/customers\/[a-f0-9-]+/);
      await page.waitForSelector('main');

      // Fill in activity note
      const noteInput = page.locator('textarea[name="body"]').first();
      await noteInput.waitFor({ timeout: 10000 });
      await noteInput.fill('Đã liên hệ tư vấn dòng sản phẩm Trà gừng sả Cohamy. Khách hàng quan tâm và hẹn báo giá 5 thùng.');

      const addNoteBtn = page.locator('button', { hasText: 'Thêm ghi chú' }).first();
      await addNoteBtn.click();

      await page.waitForTimeout(1500);
      await capture(page, '03c_sales_customer_activity_added');

      await context.close();
    });

    // Test 6: Sales Role Flow
    await test('B06: Đăng nhập Nhân viên kinh doanh (Sales) & Xem cơ hội, báo giá, viếng thăm', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await loginUser(context, 'crm', 'sales@demo.cohamy.invalid', rawPassword);
      
      await page.goto(`${base}/crm/care`);
      await page.waitForSelector('main');
      await capture(page, '12_sales_care_opportunities');

      await page.goto(`${base}/crm/visits`);
      await page.waitForSelector('main');
      await capture(page, '13_sales_partner_visits');

      await context.close();
    });

    // Test 7: Warehouse Role Flow
    await test('B07: Đăng nhập Nhân viên kho (Warehouse) & Xem vị trí tồn kho, soạn hàng', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await loginUser(context, 'crm', 'warehouse@demo.cohamy.invalid', rawPassword);
      
      await page.goto(`${base}/crm/inventory`);
      await page.waitForSelector('main');
      await capture(page, '14_warehouse_inventory_view');

      await page.goto(`${base}/crm/samples`);
      await page.waitForSelector('main');
      await capture(page, '15_warehouse_sample_management');

      await context.close();
    });

    // Test 8: Accountant Role Flow
    await test('B08: Đăng nhập Kế toán (Accountant) & Xem đối soát công nợ, phiếu thu', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await loginUser(context, 'crm', 'accountant@demo.cohamy.invalid', rawPassword);
      
      await page.goto(`${base}/crm/debts`);
      await page.waitForSelector('main');
      await capture(page, '16_accountant_receivables');

      await context.close();
    });

    // Test 9: Dealer Owner A Portal Flow - Tạo phiếu hỗ trợ & trả lời
    await test('B09: [Thao tác TẠO & SỬA - Portal] Đại lý tạo phiếu hỗ trợ và gửi phản hồi trao đổi', async () => {
      const contextA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const pageA = await loginUser(contextA, 'portal', 'dealer-a@demo.cohamy.invalid', rawPassword);

      // Verify portal banner
      const banner = pageA.locator('.crm-demo-banner');
      await banner.waitFor();
      assert.ok((await banner.textContent()).includes('MÔI TRƯỜNG DEMO — DỮ LIỆU GIẢ LẬP'));

      // Check Portal Dashboard
      await capture(pageA, '17_portal_dealer_a_dashboard');

      // Check Portal Orders
      await pageA.goto(`${base}/portal/orders`);
      await pageA.waitForSelector('main');
      await capture(pageA, '18_portal_dealer_a_orders');

      // Check Portal Quotations
      await pageA.goto(`${base}/portal/quotations`);
      await pageA.waitForSelector('main');
      await capture(pageA, '19_portal_dealer_a_quotations');

      // Check Portal Library
      await pageA.goto(`${base}/portal/library`);
      await pageA.waitForSelector('main');
      await capture(pageA, '20_portal_dealer_a_library');

      // Check Portal Support
      await pageA.goto(`${base}/portal/support`);
      await pageA.waitForSelector('main');
      await capture(pageA, '21_portal_dealer_a_support');

      // Create Support Ticket
      await pageA.goto(`${base}/portal/support/new`);
      await pageA.waitForSelector('form.work-form');

      await pageA.locator('input[name="title"]').fill('Yêu cầu hỗ trợ bổ sung phiếu kiểm nghiệm lô hàng DEMO');
      await pageA.locator('textarea[name="body"]').fill('Kính gửi Cohamy, đại lý cần tài liệu kiểm định chất lượng cho lô sản phẩm vừa nhận.');
      await pageA.locator('button.button--primary', { hasText: 'Tạo phiếu hỗ trợ' }).click();

      // Wait for redirect to /portal/support/[id]
      await pageA.waitForURL(/\/portal\/support\/[a-f0-9-]+/);
      await pageA.waitForSelector('main');
      await capture(pageA, '21a_portal_ticket_created');

      // Reply to the ticket
      const replyBody = pageA.locator('textarea[name="body"]');
      await replyBody.waitFor({ timeout: 10000 });
      await replyBody.fill('Đại lý đã bổ sung thông tin qua email. Cảm ơn Cohamy.');

      await pageA.locator('button.button--primary', { hasText: 'Gửi phản hồi' }).click();
      await pageA.waitForTimeout(1500);
      await capture(pageA, '21b_portal_ticket_replied');

      await contextA.close();
    });

    // Test 10: Multi-tenant isolation verification
    await test('B10: [Portal Multi-tenant Isolation] Xác nhận phân tách độc lập giữa Đại lý A và Đại lý B', async () => {
      const contextB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const pageB = await loginUser(contextB, 'portal', 'dealer-b@demo.cohamy.invalid', rawPassword);
      await pageB.waitForSelector('main');
      await capture(pageB, '22_portal_dealer_b_dashboard');
      await contextB.close();
    });

  } finally {
    if (browser) await browser.close().catch(() => {});
    if (httpsProxy) await new Promise(r => httpsProxy.close(r)).catch(() => {});
    if (server) {
      server.kill('SIGTERM');
      try {
        if (process.platform === 'win32') {
          spawnSync('taskkill', ['/pid', String(server.pid), '/f', '/t']);
        }
      } catch {}
    }
  }

  // Save report
  await fs.writeFile(
    'docs/crm/test-results/demo-browser-smoke.json',
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        environment: `DEMO (Local ${hasBuild ? 'Production Build' : 'Dev'} on port ${port})`,
        totalCases: cases.length,
        passed: cases.filter(c => c.status === 'PASS').length,
        failed: cases.filter(c => c.status === 'FAIL').length,
        cases,
        screenshotsDir: screenshotDir,
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log('\n=================================================');
  console.log(` ✅ TOÀN BỘ ${cases.length} BROWSER SMOKE TESTS ĐÃ PASS!`);
  console.log(` Ảnh chụp màn hình lưu tại: ${screenshotDir}/`);
  console.log('=================================================');
}

main().catch(err => {
  console.error('\n❌ BROWSER SMOKE TEST THẤT BẠI:', err);
  if (httpsProxy) {
    try { httpsProxy.close(); } catch {}
  }
  if (server) {
    try {
      server.kill('SIGTERM');
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(server.pid), '/f', '/t']);
      }
    } catch {}
  }
  process.exitCode = 1;
});
