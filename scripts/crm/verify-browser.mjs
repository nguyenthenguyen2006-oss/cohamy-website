import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const base = 'http://localhost:4310', reference = 'http://127.0.0.1:4311';
const password = 'Local-QA-Only-2026!';
const output = path.resolve('docs/crm/test-results/screenshots');
await fs.mkdir(output, { recursive: true });
await fs.mkdir('.impeccable/review', { recursive: true });

let startedServer = null;
let startedReference = null;
let qaDir = null;

// Ensure 4310 is up
let is4310Up = false;
try {
  const r = await fetch(base + '/api/health');
  is4310Up = r.ok;
} catch {}

if (!is4310Up) {
  qaDir = '.local/crm-qa-browser-' + randomUUID();
  await fs.mkdir(qaDir, { recursive: true });
  console.log('Seeding QA fixture for port 4310 at ' + qaDir);
  spawnSync(
    process.execPath,
    ['--require', './scripts/register-server-only.cjs', '--import', 'tsx', 'scripts/crm/seed-work-ui.ts'],
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
  console.log('Starting dev server on port 4310...');
  startedServer = spawn(
    process.execPath,
    [path.resolve('node_modules/next/dist/bin/next'), 'dev', '--hostname', 'localhost', '--port', '4310'],
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
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(base + '/api/health');
      if (res.ok) break;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('Dev server ready on port 4310');
}

// Ensure 4311 is up
let is4311Up = false;
try {
  const r = await fetch(reference + '/');
  is4311Up = r.status < 500;
} catch {}

if (!is4311Up) {
  console.log('Starting reference server on port 4311...');
  startedReference = spawn(
    process.execPath,
    [path.resolve('scripts/crm/start-reference.mjs')],
    {
      stdio: 'inherit',
      env: process.env
    }
  );
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(reference + '/');
      if (res.status < 500) break;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('Reference server ready on port 4311');
}

let browser;
const cases = [], captures = [], metrics = [], errors = [];
let pageCacheControl = null;

async function test(name, fn) {
  try {
    await fn();
    cases.push({ name, status: 'PASS' });
    console.log('PASS ' + name);
  } catch (error) {
    cases.push({ name, status: 'FAIL', error: String(error) });
    throw error;
  }
}

async function settled(page, selector) {
  await page.locator(selector).first().waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => {}))
    );
  });
}

async function screenshot(page, name) {
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  const file = path.join(output, name + '.png');
  await page.screenshot({ path: file, fullPage: false, caret: 'initial' });
  captures.push(file);
  const full = path.join(output, name + '-full.png');
  await page.screenshot({ path: full, fullPage: true, caret: 'initial' });
  captures.push(full);
}

async function dimensions(page) {
  return page.locator('.crm-module-tile').first().evaluate(tile => {
    const box = tile.getBoundingClientRect(), style = getComputedStyle(tile);
    const grid = getComputedStyle(tile.parentElement);
    const h = document.querySelector('.crm-dashboard__hero h1');
    const dock = document.querySelector('.portal-bottom-navigation').getBoundingClientRect();
    return {
      tile: { width: box.width, height: box.height, radius: style.borderRadius, background: style.backgroundImage },
      grid: { columns: grid.gridTemplateColumns, gap: grid.gap },
      headingSize: getComputedStyle(h).fontSize,
      dock: { width: dock.width, left: dock.left, bottom: innerHeight - dock.bottom }
    };
  });
}

try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const anonymous = await browser.newContext();
  const anon = await anonymous.newPage();

  await test('anonymous CRM page redirects to non-localized login', async () => {
    await anon.goto(base + '/crm');
    assert.equal(new URL(anon.url()).pathname, '/crm/login');
    await settled(anon, '#login-email');
  });

  await test('anonymous APIs reject private reads', async () => {
    assert.equal((await anonymous.request.get(base + '/api/crm/partners')).status(), 401);
    assert.equal((await anonymous.request.get(base + '/api/crm/accounts')).status(), 401);
  });

  await test('cross-origin and missing-origin writes rejected', async () => {
    const body = { email: 'admin@crm-qa.invalid', password };
    assert.equal((await anonymous.request.post(base + '/api/crm/auth/login', { data: body, headers: { origin: 'https://attacker.invalid' } })).status(), 403);
    assert.equal((await anonymous.request.post(base + '/api/crm/auth/login', { data: body })).status(), 403);
  });

  for (const vp of [{ w: 1920, h: 1080, name: '1920' }, { w: 1366, h: 768, name: '1366' }, { w: 390, h: 844, name: '390' }, { w: 320, h: 844, name: '320' }]) {
    await test('login canvas stability and card viewport fit ' + vp.name, async () => {
      await anon.setViewportSize({ width: vp.w, height: vp.h });
      await anon.goto(base + '/crm/login');
      await settled(anon, '#login-email');
      await anon.waitForTimeout(300);
      const m = await anon.evaluate(() => {
        const docW = document.documentElement.scrollWidth, docH = document.documentElement.scrollHeight;
        const canvas = document.querySelector('.particle-network canvas') || document.querySelector('canvas');
        const cStyle = canvas ? getComputedStyle(canvas) : null;
        const card = document.querySelector('.crm-login-card') || document.querySelector('.crm-login-container');
        const cardRect = card ? card.getBoundingClientRect() : null;
        return { docW, docH, canvasPos: cStyle?.position, cardWidth: cardRect?.width, cardTop: cardRect?.top, cardBottom: cardRect?.bottom };
      });
      assert.ok(m.docW <= vp.w + 1, `Login horizontal scroll overflow at ${vp.name}: ${m.docW} > ${vp.w}`);
      assert.ok(m.docH <= Math.max(vp.h * 2, 1200), `Login height runaway at ${vp.name}: ${m.docH}`);
      assert.equal(m.canvasPos, 'absolute', `Canvas must have computed position absolute at ${vp.name}`);
      assert.ok(m.cardTop >= 0 && m.cardBottom <= Math.max(vp.h, m.docH), `Login card must be in viewport at ${vp.name}`);
      if (vp.w >= 1000) assert.ok(m.cardWidth >= 380 && m.cardWidth <= 440, `Desktop login card width must be 380-440px at ${vp.name}, got ${m.cardWidth}`);
      assert.ok(await anon.locator('#login-email').isVisible(), 'Email input visible');
      assert.ok(await anon.locator('#login-password').isVisible(), 'Password input visible');
      assert.ok(await anon.getByRole('button', { name: 'Đăng nhập', exact: true }).isVisible(), 'Submit button visible');
    });
  }

  const admin = await browser.newContext();
  const page = await admin.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.text().includes('Image with src') || message.text().includes('aspect ratio')) {
      errors.push('IMAGE_WARNING: ' + message.text());
    }
  });

  await test('real browser form login and persisted session', async () => {
    await page.goto(base + '/crm/login');
    await page.getByLabel('Email', { exact: true }).fill('admin@crm-qa.invalid');
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.waitForURL(base + '/crm');
    await settled(page, '.crm-module-tile');
    await page.reload();
    assert.equal((await admin.request.get(base + '/api/crm/me')).status(), 200);
    const cookies = await admin.cookies();
    const cookie = cookies.find(cookie => cookie.name === 'cohamy_crm_session');
    assert.ok(cookie.httpOnly);
    assert.equal(cookie.sameSite, 'Strict');
  });

  const ref = await browser.newPage();
  for (const viewport of [{ width: 1920, height: 1080, name: '1920' }, { width: 1366, height: 768, name: 'desktop' }, { width: 390, height: 844, name: 'mobile' }, { width: 320, height: 844, name: '320' }]) {
    await test('visual capture, canvas geometry and no page overflow ' + viewport.name, async () => {
      await page.setViewportSize(viewport);
      await ref.setViewportSize(viewport);
      await page.goto(base + '/crm');
      await ref.goto(reference + '/dashboard');
      await settled(page, '.crm-module-tile');
      await settled(ref, '.crm-module-tile');

      await screenshot(page, 'cohamy-dashboard-' + viewport.name);
      await screenshot(ref, 'humanbank-reference-dashboard-' + viewport.name);

      const target = await dimensions(page), source = await dimensions(ref);
      metrics.push({ viewport, source, target });

      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Dashboard overflows');
      assert.equal(target.tile.width, source.tile.width);
      assert.equal(target.tile.height, source.tile.height);
      assert.equal(target.tile.radius, source.tile.radius);
      assert.equal(target.headingSize, source.headingSize);
      assert.equal(target.grid.gap, source.grid.gap);
      assert.equal(target.dock.width, source.dock.width);

      const logoHeight = await page.locator('.portal-brand-logo').first().evaluate(el => el.getBoundingClientRect().height);
      if (viewport.width >= 1000) {
        assert.ok(logoHeight >= 28 && logoHeight <= 32, `Desktop logo height should be ~30px, got ${logoHeight}`);
      } else {
        assert.ok(logoHeight >= 22 && logoHeight <= 26, `Mobile logo height should be ~24px, got ${logoHeight}`);
      }

      // Geometric assertions for single fullscreen particle canvas
      const canvasGeo = await page.evaluate(() => {
        const canvases = document.querySelectorAll('.crm-shell-background canvas, .particle-network canvas');
        const canvas = canvases[0];
        const rect = canvas?.getBoundingClientRect();
        const content = document.querySelector('.crm-dashboard__content, .crm-business-content');
        const cRect = content?.getBoundingClientRect();
        return {
          count: canvases.length,
          left: rect?.left,
          top: rect?.top,
          width: rect?.width,
          height: rect?.height,
          contentWidth: cRect?.width,
          contentLeft: cRect?.left,
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight
        };
      });

      assert.equal(canvasGeo.count, 1, `Authenticated CRM must have exactly 1 particle canvas at ${viewport.name}`);
      assert.ok(canvasGeo.left <= 0, `Canvas must start at left edge (<=0) at ${viewport.name}, got ${canvasGeo.left}`);
      assert.ok(Math.abs(canvasGeo.width - viewport.width) <= 2, `Canvas width (${canvasGeo.width}) must match viewport (${viewport.width}) within 2px`);
      assert.ok(canvasGeo.height >= viewport.height - 2, `Canvas height (${canvasGeo.height}) must be >= viewport height (${viewport.height})`);
      assert.ok(canvasGeo.scrollWidth <= viewport.width + 1, `document scrollWidth (${canvasGeo.scrollWidth}) must not exceed innerWidth (${viewport.width})`);

      if (viewport.width === 1920) {
        assert.ok(canvasGeo.contentWidth && canvasGeo.width > canvasGeo.contentWidth + 100, 'Canvas must extend beyond content max-width on 1920px');
        assert.ok(canvasGeo.contentLeft && canvasGeo.contentLeft > 100, 'Content must be centered with side margins on 1920px');
      }

      // Capture all 11 hub pages across all required viewports (1920, 1366, 390, 320)
      const allHubIds = ['orders', 'customers', 'dealers', 'goods', 'procurement', 'consignment', 'debts', 'tasks', 'reports', 'library', 'accounts'];
      for (const hubId of allHubIds) {
        await page.goto(base + '/crm/hub/' + hubId);
        await settled(page, '.crm-hub-header');

        const cardCount = await page.locator('.crm-hub-submodule-card').count();
        assert.ok(cardCount > 0, `Hub ${hubId} must have submodule cards, but found ${cardCount}`);

        if (hubId === 'dealers') {
          await screenshot(page, 'cohamy-hub-' + viewport.name);
        }
        await screenshot(page, 'cohamy-hub-' + hubId + '-' + viewport.name);

        const hubCanvasCount = await page.evaluate(() => document.querySelectorAll('.crm-shell-background canvas, .particle-network canvas').length);
        assert.equal(hubCanvasCount, 1, `Hub ${hubId} must have exactly 1 particle canvas at ${viewport.name}`);

        // Verify hub submodule card bounding box and action containment
        const cardBoundingMetrics = await page.evaluate(() => {
          const cards = Array.from(document.querySelectorAll('.crm-hub-submodule-card'));
          return cards.map(card => {
            const cardRect = card.getBoundingClientRect();
            const action = card.querySelector('.crm-hub-submodule-action');
            const info = card.querySelector('.crm-hub-submodule-info');
            const h3 = card.querySelector('.crm-hub-submodule-info h3');
            const p = card.querySelector('.crm-hub-submodule-info p');
            const actionRect = action ? action.getBoundingClientRect() : null;
            const infoRect = info ? info.getBoundingClientRect() : null;
            const h3Rect = h3 ? h3.getBoundingClientRect() : null;
            const pRect = p ? p.getBoundingClientRect() : null;
            return {
              cardRight: cardRect.right,
              cardLeft: cardRect.left,
              cardWidth: cardRect.width,
              actionRight: actionRect?.right,
              actionLeft: actionRect?.left,
              actionWidth: actionRect?.width,
              infoRight: infoRect?.right,
              infoLeft: infoRect?.left,
              h3Right: h3Rect?.right,
              pRight: pRect?.right,
              viewportWidth: window.innerWidth
            };
          });
        });
        for (const m of cardBoundingMetrics) {
          assert.ok(m.cardRight <= viewport.width + 1, `Hub ${hubId}: Card right edge (${m.cardRight}) must be within viewport (${viewport.width})`);
          assert.ok(m.cardLeft >= 0, `Hub ${hubId}: Card left edge (${m.cardLeft}) must be >= 0`);
          if (m.actionRight) {
            assert.ok(m.actionRight <= m.cardRight + 1, `Hub ${hubId}: Action right edge (${m.actionRight}) must be within card (${m.cardRight}) at ${viewport.name}`);
            assert.ok(m.actionLeft >= m.cardLeft - 1, `Hub ${hubId}: Action left edge (${m.actionLeft}) must be within card (${m.cardLeft}) at ${viewport.name}`);
          }
          if (m.h3Right) {
            assert.ok(m.h3Right <= m.cardRight + 1, `Hub ${hubId}: Title right edge (${m.h3Right}) must be within card (${m.cardRight}) at ${viewport.name}`);
          }
        }

        // Verify text clipping: assert titles do not overflow or use ellipsis to hide clipped text
        const textClippingMetrics = await page.evaluate(() => {
          const cards = Array.from(document.querySelectorAll('.crm-hub-submodule-card'));
          const headerH1 = document.querySelector('.crm-hub-title-box h1');
          const h1Style = headerH1 ? window.getComputedStyle(headerH1) : null;

          const headerMetric = headerH1 ? {
            text: headerH1.textContent?.trim(),
            scrollWidth: headerH1.scrollWidth,
            clientWidth: headerH1.clientWidth,
            isClipped: headerH1.scrollWidth > headerH1.clientWidth + 1,
            textOverflow: h1Style?.textOverflow,
            whiteSpace: h1Style?.whiteSpace,
          } : null;

          const cardTitles = cards.map(card => {
            const h3 = card.querySelector('.crm-hub-submodule-info h3');
            const h3Style = h3 ? window.getComputedStyle(h3) : null;
            return {
              text: h3?.textContent?.trim() || '',
              scrollWidth: h3 ? h3.scrollWidth : 0,
              clientWidth: h3 ? h3.clientWidth : 0,
              scrollHeight: h3 ? h3.scrollHeight : 0,
              clientHeight: h3 ? h3.clientHeight : 0,
              isHorizontallyClipped: h3 ? h3.scrollWidth > h3.clientWidth + 1 : false,
              isVerticallyClipped: h3 ? h3.scrollHeight > h3.clientHeight + 1 : false,
              textOverflow: h3Style?.textOverflow,
              whiteSpace: h3Style?.whiteSpace,
            };
          });

          return { headerMetric, cardTitles };
        });

        if (textClippingMetrics.headerMetric) {
          assert.ok(!textClippingMetrics.headerMetric.isClipped, `Hub ${hubId} header title "${textClippingMetrics.headerMetric.text}" is clipped horizontally at ${viewport.name}`);
          assert.notEqual(textClippingMetrics.headerMetric.textOverflow, 'ellipsis', `Hub ${hubId} header title must not use ellipsis to hide overflow`);
        }

        for (const tm of textClippingMetrics.cardTitles) {
          assert.ok(!tm.isHorizontallyClipped, `Hub ${hubId} card title "${tm.text}" is clipped horizontally (scrollWidth ${tm.scrollWidth} > clientWidth ${tm.clientWidth}) at ${viewport.name}`);
          assert.ok(!tm.isVerticallyClipped, `Hub ${hubId} card title "${tm.text}" is clipped vertically at ${viewport.name}`);
          assert.notEqual(tm.textOverflow, 'ellipsis', `Hub ${hubId} card title "${tm.text}" must not use ellipsis at ${viewport.name}`);
          assert.notEqual(tm.whiteSpace, 'nowrap', `Hub ${hubId} card title "${tm.text}" must allow multi-line wrapping, not nowrap at ${viewport.name}`);
        }

        // Special check for target long titles at 320px
        if (viewport.width === 320) {
          if (hubId === 'procurement') {
            const procTitle = textClippingMetrics.cardTitles.find(t => t.text.includes('Mua hàng và nhà cung cấp'));
            assert.ok(procTitle, 'Hub procurement must contain "Mua hàng và nhà cung cấp"');
            assert.ok(!procTitle.isHorizontallyClipped, `"Mua hàng và nhà cung cấp" must not be clipped at 320px`);
            assert.ok(procTitle.clientHeight > 20, `"Mua hàng và nhà cung cấp" must wrap to multiple lines at 320px (height: ${procTitle.clientHeight}px)`);
          }
          if (hubId === 'tasks') {
            const autoTitle = textClippingMetrics.cardTitles.find(t => t.text.includes('Lịch và quy tắc công việc'));
            assert.ok(autoTitle, 'Hub tasks must contain "Lịch và quy tắc công việc"');
            assert.ok(!autoTitle.isHorizontallyClipped, `"Lịch và quy tắc công việc" must not be clipped at 320px`);
            assert.ok(autoTitle.clientHeight > 20, `"Lịch và quy tắc công việc" must wrap to multiple lines at 320px (height: ${autoTitle.clientHeight}px)`);
          }
        }
      }

      await page.goto(base + '/crm');
      await settled(page, '.crm-module-tile');

      // Mobile drawer stacking context and elementFromPoint test
      if (viewport.width === 390) {
        const menuBtn = page.locator('.crm-mobile-menu-btn').first();
        await menuBtn.click();
        await page.locator('.crm-mobile-drawer.is-open').waitFor();
        await page.waitForTimeout(350);
        const dock = page.locator('.portal-bottom-navigation');
        const dockBox = await dock.boundingBox();
        assert.ok(dockBox, 'Bottom dock bounding box must exist');
        const checkX = dockBox.x + dockBox.width / 2;
        const checkY = dockBox.y + dockBox.height / 2;
        const topElement = await page.evaluate(({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          return {
            isDock: Boolean(el?.closest('.portal-bottom-navigation')),
            isBackdrop: Boolean(el?.closest('.crm-drawer-backdrop')),
            isDrawer: Boolean(el?.closest('.crm-mobile-drawer'))
          };
        }, { x: checkX, y: checkY });

        assert.equal(topElement.isDock, false, 'Dock must NOT be topmost when mobile drawer is open');
        assert.ok(topElement.isBackdrop || topElement.isDrawer, 'Top element at dock center must be backdrop or drawer');
        await screenshot(page, 'cohamy-mobile-drawer-open');
        await page.locator('.crm-drawer-backdrop').click({ position: { x: viewport.width - 10, y: 100 } });
        await page.waitForFunction(() => !document.querySelector('.crm-mobile-drawer.is-open'));
      }

      await page.goto(base + '/crm/goods');
      await settled(page, '.data-table');
      await screenshot(page, 'cohamy-catalog-' + viewport.name);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Catalog overflows');

      const home = page.getByRole('navigation', { name: 'Truy cập nhanh', exact: true }).getByRole('link', { name: 'Home', exact: true });
      const hc = await home.evaluate(anchor => {
        const rect = anchor.getBoundingClientRect();
        const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return { ok: anchor.contains(el), tag: el?.tagName, className: el?.className, outer: el?.outerHTML?.slice(0, 120), x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect };
      });
      if (!hc.ok) console.error('HOME CHECK FAILED ON ' + viewport.name + ':', hc);
      assert.ok(hc.ok, 'Home pointer target is obstructed');
      await home.click();
      await page.waitForURL(base + '/crm');

      await anon.setViewportSize(viewport);
      await anon.goto(base + '/crm/login');
      await ref.goto(reference + '/login');
      await settled(anon, '#login-email');
      await settled(ref, '#login-email');
      await screenshot(anon, 'cohamy-login-' + viewport.name);
      await screenshot(ref, 'humanbank-reference-login-' + viewport.name);
      assert.ok(await anon.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Login overflows');
    });
  }

  await test('keyboard focus, menu and reduced motion', async () => {
    await page.goto(base + '/crm');
    await page.keyboard.press('Tab');
    assert.ok(await page.locator(':focus').count());
    await page.getByLabel('Mở menu người dùng').click();
    await page.getByRole('link', { name: 'Hồ sơ và phiên đăng nhập' }).waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => /^0s(?:, 0s)*$/u.test(getComputedStyle(document.querySelector('.crm-module-tile')).transitionDuration));
  });

  await test('mobile drawer accessibility: focus management, focus trap, escape, focus return, and closed inertness', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '/crm');
    await settled(page, '.crm-module-tile');

    const menuBtn = page.locator('.crm-mobile-menu-btn').first();
    await menuBtn.waitFor({ state: 'visible' });

    // 1. Verify when closed, drawer cannot receive focus
    const isClosedInert = await page.evaluate(() => {
      const drawer = document.querySelector('.crm-mobile-drawer');
      const drawerStyle = drawer ? window.getComputedStyle(drawer) : null;
      return {
        hasInert: drawer?.hasAttribute('inert'),
        ariaHidden: drawer?.getAttribute('aria-hidden') === 'true',
        visibility: drawerStyle?.visibility,
        isOpen: drawer?.classList.contains('is-open')
      };
    });
    assert.equal(isClosedInert.isOpen, false, 'Drawer must not have is-open class when closed');
    assert.equal(isClosedInert.visibility, 'hidden', 'Drawer must have visibility hidden when closed');
    assert.equal(isClosedInert.ariaHidden, true, 'Drawer must have aria-hidden=true when closed');
    assert.equal(isClosedInert.hasInert, true, 'Drawer must have inert attribute when closed');

    // 2. Open drawer and verify focus moves into drawer (close button)
    await menuBtn.focus();
    assert.ok(await menuBtn.evaluate(el => el === document.activeElement), 'Menu button must be focused before click');
    await menuBtn.click();
    await page.locator('.crm-mobile-drawer.is-open').waitFor();
    await page.waitForTimeout(200);

    const activeInDrawer = await page.evaluate(() => {
      const drawer = document.querySelector('.crm-mobile-drawer');
      const closeBtn = drawer?.querySelector('button[aria-label="Đóng menu"]');
      return {
        isInside: drawer?.contains(document.activeElement),
        isCloseBtn: document.activeElement === closeBtn
      };
    });
    assert.ok(activeInDrawer.isInside, 'Focus must move inside drawer when opened');
    assert.ok(activeInDrawer.isCloseBtn, 'Focus must be on close button when opened');

    // 3. Focus trap: Focus last focusable element and verify Tab wraps to first
    const drawerElements = await page.evaluate(() => {
      const drawer = document.querySelector('.crm-mobile-drawer');
      const focusable = Array.from(drawer.querySelectorAll('button:not([disabled]), a[href]:not([disabled])'));
      return { count: focusable.length };
    });
    assert.ok(drawerElements.count >= 3, 'Drawer must have multiple focusable elements');

    await page.evaluate(() => {
      const drawer = document.querySelector('.crm-mobile-drawer');
      const focusable = Array.from(drawer.querySelectorAll('button:not([disabled]), a[href]:not([disabled])'));
      focusable[focusable.length - 1].focus();
    });

    // Press Tab: must wrap back to first element (close button)
    await page.keyboard.press('Tab');
    const wrappedToFirst = await page.evaluate(() => {
      const drawer = document.querySelector('.crm-mobile-drawer');
      const focusable = Array.from(drawer.querySelectorAll('button:not([disabled]), a[href]:not([disabled])'));
      return document.activeElement === focusable[0];
    });
    assert.ok(wrappedToFirst, 'Tab from last element must wrap back to first element in drawer');

    // Press Shift+Tab: must wrap backward to last element
    await page.keyboard.press('Shift+Tab');
    const wrappedToLast = await page.evaluate(() => {
      const drawer = document.querySelector('.crm-mobile-drawer');
      const focusable = Array.from(drawer.querySelectorAll('button:not([disabled]), a[href]:not([disabled])'));
      return document.activeElement === focusable[focusable.length - 1];
    });
    assert.ok(wrappedToLast, 'Shift+Tab from first element must wrap back to last element in drawer');

    // 4. Escape closes drawer and restores focus to toggle button
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.crm-mobile-drawer.is-open'));
    await page.waitForTimeout(100);

    const isClosedAfterEscape = await page.evaluate(() => {
      const drawer = document.querySelector('.crm-mobile-drawer');
      const menuBtn = document.querySelector('.crm-mobile-menu-btn');
      return {
        isOpen: drawer?.classList.contains('is-open'),
        isFocusedOnToggle: document.activeElement === menuBtn
      };
    });
    assert.equal(isClosedAfterEscape.isOpen, false, 'Drawer must be closed after pressing Escape');
    assert.ok(isClosedAfterEscape.isFocusedOnToggle, 'Focus must return to menu toggle button after Escape');

    // 5. Verify when closed again, Tab key does NOT enter the drawer
    await page.keyboard.press('Tab');
    const focusAfterTabWhenClosed = await page.evaluate(() => {
      const drawer = document.querySelector('.crm-mobile-drawer');
      return drawer?.contains(document.activeElement);
    });
    assert.equal(focusAfterTabWhenClosed, false, 'Keyboard focus must not enter closed drawer');
  });

  await test('create and edit a dealer through real UI', async () => {
    const stamp = Date.now(), created = 'LOCAL QA · Tạo từ trình duyệt ' + stamp, updated = 'LOCAL QA · Đã sửa và lưu ' + stamp;
    await page.goto(base + '/crm/dealers/new');
    await page.getByLabel('Mã', { exact: true }).fill('QA_BROWSER_' + stamp);
    await page.getByLabel('Tên hồ sơ').fill(created);
    await page.getByRole('button', { name: 'Lưu dữ liệu' }).click();
    await page.waitForURL(base + '/crm/dealers');
    await page.getByRole('link', { name: new RegExp(created) }).click();
    await page.getByLabel('Tên hồ sơ').fill(updated);
    await page.getByRole('button', { name: 'Lưu dữ liệu' }).click();
    await page.waitForURL(base + '/crm/dealers');
    await page.getByText(updated, { exact: true }).waitFor();
  });

  const dealer = await browser.newContext();
  const dealerPage = await dealer.newPage();
  await dealerPage.goto(base + '/portal/login');
  await dealerPage.getByLabel('Email', { exact: true }).fill('a@crm-qa.invalid');
  await dealerPage.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await dealerPage.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await dealerPage.waitForURL(base + '/portal');

  await test('dealer A cannot access B by ID/API or account list', async () => {
    const result = await admin.request.get(base + '/api/crm/partners?kind=DEALER');
    const list = await result.json();
    const b = list.items.find(item => item.code === 'QA_B');
    assert.ok(b);
    assert.equal((await dealer.request.get(base + '/api/crm/partners/' + b.id)).status(), 404);
    assert.equal((await dealer.request.get(base + '/api/crm/accounts')).status(), 403);
    assert.equal((await dealer.request.patch(base + '/api/crm/accounts/' + b.id, { data: { active: true }, headers: { origin: base } })).status(), 403);
    const own = await (await dealer.request.get(base + '/api/crm/warehouses')).json();
    assert.equal(own.items.length, 1);
    assert.equal(own.items[0].code, 'QA_KHO_A');
  });

  await test('dealer portal menu excludes internal account administration', async () => {
    assert.equal(await dealerPage.getByRole('link', { name: 'Tài khoản và quyền', exact: true }).count(), 0);
    await dealerPage.goto(base + '/portal/inventory');
    await dealerPage.getByText('QA_KHO_A', { exact: true }).waitFor();
    assert.equal(await dealerPage.getByText('QA_KHO_B', { exact: true }).count(), 0);
    await dealerPage.setViewportSize({ width: 390, height: 844 });
    await dealerPage.goto(base + '/portal');
    await settled(dealerPage, '.crm-module-tile');
    await screenshot(dealerPage, 'cohamy-dealer-portal-mobile');
  });

  const publicPage = await anonymous.newPage();
  const publicBefore = {};
  await test('public website, product URLs and five locales remain available', async () => {
    for (const locale of ['vi', 'en', 'zh', 'ko', 'ja']) {
      const response = await publicPage.goto(base + '/' + locale + '/products');
      assert.equal(response.status(), 200);
      assert.equal(await publicPage.locator('.portal-shell').count(), 0);
    }
    for (const route of ['/vi/cart', '/vi/contact', '/vi/blog', '/admin/login']) {
      const response = await publicPage.goto(base + route);
      assert.ok(response.status() < 500, route);
    }
    await publicPage.goto(base + '/vi/products');
    publicBefore.font = await publicPage.locator('body').evaluate(el => getComputedStyle(el).fontFamily);
    await publicPage.goto(base + '/crm/login');
    await publicPage.goto(base + '/vi/products');
    assert.equal(await publicPage.locator('body').evaluate(el => getComputedStyle(el).fontFamily), publicBefore.font);
  });

  let savedOrderCode = '';
  await test('checkout preserves cart on 503, saves once on double-submit and remains unpaid', async () => {
    const catalog = await (await admin.request.get(base + '/api/crm/catalog')).json();
    const product = catalog.items.find(item => item.website_id === 'cohamy-almond-chocolate');
    assert.ok(product);
    await publicPage.goto(base + '/vi/san-pham/cohamy-socola-hanh-nhan');
    await publicPage.evaluate(() => localStorage.removeItem('cohamy-cart'));
    await publicPage.reload();
    await publicPage.getByRole('button', { name: 'Thêm vào yêu cầu đặt hàng', exact: true }).click();
    await publicPage.getByRole('button', { name: 'Thêm vào yêu cầu đặt hàng', exact: true }).click();
    await publicPage.locator('header').getByRole('link', { name: 'Giỏ hàng', exact: true }).click();
    await publicPage.waitForURL(base + '/vi/gio-hang');
    assert.equal(await publicPage.evaluate(() => JSON.parse(localStorage.getItem('cohamy-cart')).state.items[0].quantity), 2);
    // Deliberately tamper only the displayed browser price; server must reprice.
    await publicPage.evaluate(() => {
      const cart = JSON.parse(localStorage.getItem('cohamy-cart'));
      cart.state.items[0].price = 1;
      localStorage.setItem('cohamy-cart', JSON.stringify(cart));
    });
    await publicPage.reload();
    await publicPage.getByRole('link', { name: 'Gửi yêu cầu đặt hàng', exact: true }).click();
    await publicPage.waitForURL(base + '/vi/thanh-toan');
    await publicPage.goto(base + '/vi/checkout');
    for (const [name, value] of Object.entries({ fullName: 'LOCAL QA Buyer', email: 'checkout@crm-qa.invalid', phone: '0900000000', address: 'Địa chỉ kiểm thử LOCAL', city: 'LOCAL QA City' })) {
      await publicPage.locator('[name="' + name + '"]').fill(value);
    }
    await publicPage.route('**/api/orders', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"QA_SIMULATED_OUTAGE"}' }));
    await publicPage.locator('button[type="submit"]').click();
    await publicPage.locator('form').getByRole('alert').waitFor();
    assert.equal(await publicPage.evaluate(() => JSON.parse(localStorage.getItem('cohamy-cart')).state.items.length), 1);
    await publicPage.unroute('**/api/orders');
    const savedResponse = publicPage.waitForResponse(response => response.url() === base + '/api/orders' && response.status() === 201);
    await publicPage.locator('form').evaluate(form => {
      form.requestSubmit();
      form.requestSubmit();
    });
    const saved = await (await savedResponse).json();
    savedOrderCode = saved.code;
    assert.equal(saved.status, 'PENDING_REVIEW');
    assert.equal(saved.paid, false);
    assert.equal(saved.subtotal, (BigInt(product.retail_price) * 2n).toString());
    await publicPage.getByText('Mã yêu cầu: ' + saved.code).waitFor();
    assert.equal(await publicPage.evaluate(() => JSON.parse(localStorage.getItem('cohamy-cart')).state.items.length), 0);
    await page.goto(base + '/crm/orders');
    await page.getByText(saved.code, { exact: true }).waitFor();
    await page.reload();
    await page.getByText(saved.code, { exact: true }).waitFor();
    await page.setViewportSize({ width: 1366, height: 768 });
    await screenshot(page, 'cohamy-orders-intake-desktop');
    await publicPage.setViewportSize({ width: 1366, height: 768 });
    await screenshot(publicPage, 'cohamy-checkout-receipt-desktop');
  });

  await test('order detail includes recurrence panel and document upload disclosure for authorized users', async () => {
    await page.goto(base + '/crm/orders');
    await page.getByText(savedOrderCode, { exact: true }).click();
    await page.getByRole('heading', { name: savedOrderCode, exact: true }).waitFor();
    const recurrence = page.getByRole('heading', { name: 'Lịch chăm sóc định kỳ', exact: true });
    await recurrence.waitFor();
    assert.ok(await recurrence.isVisible(), 'Order recurrence panel should be visible');
    const docUpload = page.locator('summary').filter({ hasText: 'Thêm tệp hoặc phiên bản tài liệu' });
    await docUpload.waitFor();
    assert.ok(await docUpload.isVisible(), 'Document upload disclosure should be visible on order');
  });

  await test('document upload disclosure appears and opens on partner, order, library and visit for authorized CRM staff', async () => {
    // 1. Partner detail
    await page.goto(base + '/crm/dealers');
    await page.locator('.data-table tbody a').first().click();
    await page.waitForURL(/\/crm\/dealers\//);
    const partnerDoc = page.locator('summary').filter({ hasText: 'Thêm tệp hoặc phiên bản tài liệu' });
    await partnerDoc.waitFor();
    await partnerDoc.click();
    const partnerFileInput = page.locator('form input[name="file"][type="file"]').first();
    await partnerFileInput.waitFor();
    assert.ok(await partnerFileInput.isVisible(), 'Partner document upload file input must be visible');

    // 2. Order detail
    await page.goto(base + '/crm/orders');
    await page.getByText(savedOrderCode, { exact: true }).click();
    await page.waitForURL(/\/crm\/orders\//);
    const orderDoc = page.locator('summary').filter({ hasText: 'Thêm tệp hoặc phiên bản tài liệu' });
    await orderDoc.waitFor();
    await orderDoc.click();
    const orderFileInput = page.locator('form input[name="file"][type="file"]').first();
    await orderFileInput.waitFor();
    assert.ok(await orderFileInput.isVisible(), 'Order document upload file input must be visible');

    // 3. Library item detail
    const libRes = await admin.request.post(base + '/api/crm/library/save', {
      headers: { origin: base },
      data: {
        title: 'LOCAL QA Tài liệu thư viện ' + Date.now(),
        category: 'POLICY',
        audience: 'ALL_DEALERS',
        status: 'DRAFT',
        effectiveAt: new Date().toISOString(),
        requiredRead: false,
        version: 0
      }
    });
    assert.equal(libRes.status(), 200, 'Must create library item fixture');
    const { id: libId } = await libRes.json();
    await page.goto(base + '/crm/library/' + libId);
    await page.getByRole('heading', { level: 1 }).waitFor();
    const libDoc = page.locator('summary').filter({ hasText: 'Thêm tệp hoặc phiên bản tài liệu' });
    await libDoc.waitFor();
    await libDoc.click();
    const libFileInput = page.locator('form input[name="file"][type="file"]').first();
    await libFileInput.waitFor();
    assert.ok(await libFileInput.isVisible(), 'Library document upload file input must be visible');

    // 4. Visit item detail
    const partnerList = await (await admin.request.get(base + '/api/crm/partners?kind=DEALER')).json();
    const dealerOrg = partnerList.items[0];
    assert.ok(dealerOrg, 'Dealer org must exist');
    const visitRes = await admin.request.post(base + '/api/crm/relationships/visit', {
      headers: { origin: base },
      data: {
        organizationId: dealerOrg.id,
        visitedAt: new Date().toISOString(),
        result: 'LOCAL QA Đã thăm điểm bán và kiểm tra trưng bày',
        supportRequest: 'Cần hỗ trợ banner',
        idempotencyKey: (await import('node:crypto')).randomUUID()
      }
    });
    assert.equal(visitRes.status(), 201, 'Must create visit item fixture');
    const { id: visitId } = await visitRes.json();
    await page.goto(base + '/crm/visits/' + visitId);
    await page.getByRole('heading', { name: 'Lần thăm điểm bán', exact: true }).waitFor();
    const visitDoc = page.locator('summary').filter({ hasText: 'Thêm tệp hoặc phiên bản tài liệu' });
    await visitDoc.waitFor();
    await visitDoc.click();
    const visitFileInput = page.locator('form input[name="file"][type="file"]').first();
    await visitFileInput.waitFor();
    assert.ok(await visitFileInput.isVisible(), 'Visit document upload file input must be visible');
  });

  await test('dealer portal does not expose unauthorized document uploads on orders', async () => {
    await dealerPage.goto(base + '/portal/orders');
    assert.equal(await dealerPage.locator('summary').filter({ hasText: 'Thêm tệp hoặc phiên bản tài liệu' }).count(), 0);
  });

  await test('private API no-store, CRM noindex and robots exclusion', async () => {
    const response = await admin.request.get(base + '/crm');
    assert.ok(response.headers()['x-robots-tag'].includes('noindex'));
    pageCacheControl = response.headers()['cache-control'];
    assert.ok(pageCacheControl.includes('no-cache'));
    const api = await admin.request.get(base + '/api/crm/me');
    assert.ok(api.headers()['cache-control'].includes('no-store'));
    const robots = await (await admin.request.get(base + '/robots.txt')).text();
    assert.ok(robots.includes('Disallow: /crm') && robots.includes('Disallow: /portal'));
  });

  await test('logout revokes database session', async () => {
    await page.goto(base + '/crm');
    await page.getByRole('button', { name: 'Thoát', exact: true }).click();
    await page.waitForURL(base + '/crm/login');
    assert.equal((await admin.request.get(base + '/api/crm/me')).status(), 401);
  });

  assert.deepEqual(errors, []);
  await fs.copyFile(path.join(output, 'cohamy-dashboard-desktop.png'), '.impeccable/review/desktop.png');
  await fs.copyFile(path.join(output, 'cohamy-dashboard-mobile.png'), '.impeccable/review/mobile.png');
  await fs.copyFile(path.join(output, 'cohamy-dashboard-320.png'), '.impeccable/review/user-320.png');
} finally {
  if (browser) await browser.close();
  if (startedServer && startedServer.exitCode === null) {
    console.log('Stopping dev server on port 4310...');
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(startedServer.pid), '/f', '/t']);
    else startedServer.kill('SIGTERM');
  }
  if (startedReference && startedReference.exitCode === null) {
    console.log('Stopping reference server on port 4311...');
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(startedReference.pid), '/f', '/t']);
    else startedReference.kill('SIGTERM');
  }
  if (qaDir) await fs.rm(qaDir, { recursive: true, force: true }).catch(() => {});
  await fs.writeFile(
    'docs/crm/test-results/browser-local.json',
    JSON.stringify(
      {
        environment: 'LOCAL',
        backend: 'PGlite database, fictitious .invalid users',
        cmsSource: 'Explicit legacy static catalog in QA server only; no proof of live Sheets/WordPress availability or delivery',
        pageCacheControl,
        cacheLimit: 'Next dev overrides page Cache-Control to no-cache, must-revalidate (installed base-server.js). Private API no-store verified; production page header NOT RUN.',
        reference: 'Actual HumanBank shell/dashboard/login components and full current CSS cascade; mocked auth/router, no HumanBank backend or production session',
        testedAt: new Date().toISOString(),
        cases,
        captures,
        metrics,
        errors
      },
      null,
      2
    ) + '\n'
  );
}
