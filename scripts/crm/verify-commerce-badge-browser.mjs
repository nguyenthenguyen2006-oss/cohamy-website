import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium, expect} from '@playwright/test';

// Direct public reads only: no HTML fixtures, authentication or business actions.
const production = process.argv.includes('--production');
const base = (production ? 'https://cohamy.vn' : process.env.CRM_BADGE_BASE_URL || 'http://127.0.0.1:4378').replace(/\/$/u, '');
const origin = new URL(base).origin;
const folder = `docs/crm/test-results/commerce-badge/${production ? 'production' : 'local'}`;
const hrefs = ['https://online.gov.vn/nen-tang/e0ebf111-de97-4910-aaf1-938a1098ee56', 'https://online.gov.vn/nen-tang/320a005c-16bb-4b71-aa8a-f0515f2df6c4'];
const paths = ['/vi', '/vi/san-pham/cohamy-socola-hat-dieu-80g', '/vi/chinh-sach/thanh-toan', '/en'];
const records = [], screenshots = [], errors = [], blockedWrites = [], adminRequests = [];
const browser = await chromium.launch({channel: 'msedge', headless: true});
const context = await browser.newContext({serviceWorkers: 'block', reducedMotion: 'reduce'});
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin === origin && /^\/(?:api\/)?crm(?:\/|$)/u.test(url.pathname)) {
    adminRequests.push({method: request.method(), path: url.pathname});
    return route.abort('blockedbyclient');
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
    blockedWrites.push({method: request.method(), origin: url.origin, path: url.pathname});
    return route.abort('blockedbyclient');
  }
  return route.continue();
});
const page = await context.newPage(), cdp = await context.newCDPSession(page);
page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(90000);
page.on('pageerror', error => errors.push({path: new URL(page.url()).pathname, message: error.message}));
const footer = page.locator('footer[data-site-footer]');
let complete = false;
try {
  await fs.mkdir(folder, {recursive: true});
  for (const [width, height] of [[1440, 900], [390, 844], [320, 844]]) {
    await page.setViewportSize({width, height});
    for (const path of paths) {
      const response = await page.goto(base + path, {waitUntil: 'domcontentloaded'});
      assert.equal(response?.status(), 200, `HTTP ${path}`);
      await expect(footer).toHaveCount(1);
      await page.waitForFunction(() => [...document.querySelectorAll('link[rel="stylesheet"]')].every(link => link.sheet));
      await page.evaluate(() => document.fonts.ready);
      const commerce = footer.locator('[data-footer-commerce]'), links = commerce.locator('a'), image = commerce.locator('img');
      await expect(commerce).toHaveCount(1); await expect(links).toHaveCount(2); await expect(image).toHaveCount(1);
      await image.scrollIntoViewIfNeeded(); await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
      const data = await commerce.evaluate(node => {
        const box = element => { const r = element.getBoundingClientRect(); return {x: r.x, right: r.right, width: r.width, height: r.height}; };
        const image = node.querySelector('img'), footer = node.closest('footer');
        return {links: [...node.querySelectorAll('a')].map(a => ({href: a.getAttribute('href'), target: a.target, rel: a.rel, ...box(a)})), image: {src: image.getAttribute('src'), naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, ...box(image)}, footer: box(footer), documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, viewport: innerWidth};
      });
      assert.deepEqual(data.links.map(link => link.href), hrefs, `${path} exact government links`);
      for (const link of data.links) {
        assert.equal(link.target, '_blank'); assert.ok(link.rel.split(/\s+/u).includes('noopener')); assert.ok(link.rel.split(/\s+/u).includes('noreferrer'));
        assert.ok(link.x >= -1 && link.right <= width + 1, `${path} commerce link bounds`);
      }
      assert.equal(data.image.src, '/images/legal/bo-cong-thuong-da-thong-bao.png');
      assert.ok(data.image.naturalWidth > 0 && data.image.naturalHeight > 0); assert.ok(Math.abs(data.image.height - 44) < 0.5, '44px badge height');
      assert.ok(data.documentWidth <= width + 1 && data.bodyWidth <= width + 1 && data.footer.x >= -1 && data.footer.right <= width + 1, `${path} no horizontal overflow`);
      await links.first().focus(); await page.keyboard.press('Tab'); await expect(links.nth(1)).toBeFocused();
      for (const key of ['Shift+Tab', 'Tab']) {
        await page.keyboard.press(key);
        const focused = await commerce.locator(':focus').evaluate(node => ({href: node.getAttribute('href'), style: getComputedStyle(node).outlineStyle, width: parseFloat(getComputedStyle(node).outlineWidth)}));
        assert.ok(hrefs.includes(focused.href) && focused.style !== 'none' && focused.width >= 2, 'keyboard focus remains visible');
      }
      const clip = await footer.evaluate(node => { const r = node.getBoundingClientRect(); return {x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, scale: 1}; });
      await page.evaluate(() => scrollTo({left: 0, top: 0, behavior: 'instant'}));
      const screenshot = `${folder}/${path.slice(1).replaceAll('/', '-')}-${width}.png`;
      const capture = await cdp.send('Page.captureScreenshot', {format: 'png', fromSurface: true, captureBeyondViewport: true, clip});
      await fs.writeFile(screenshot, Buffer.from(capture.data, 'base64')); screenshots.push(screenshot);
      records.push({path, width, height, ...data, keyboardFocus: 'PASS'}); console.log(`PASS ${path} ${width}x${height}`);
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(adminRequests, []);
  complete = true;
} catch (error) {
  errors.push({type: 'assertion', message: String(error?.stack ?? error)}); console.error(String(error?.stack ?? error)); process.exitCode = 1;
} finally {
  await browser.close();
  if (errors.length || adminRequests.length) { complete = false; process.exitCode = 1; }
  await fs.mkdir(folder, {recursive: true});
  await fs.writeFile(`${folder}/browser-${production ? 'production' : 'local'}.json`, JSON.stringify({status: complete ? 'PASS' : 'FAIL', testedAt: new Date().toISOString(), base, records, screenshots, errors, blockedWrites, adminRequests, businessWrites: 0, orderSubmissions: 0, mocks: 0, scope: 'Actual shared footer across four routes and three viewport sizes; exact links, loaded badge, 44px height, horizontal bounds, keyboard focus and native CDP footer captures. All non-read requests blocked; no login or CRM navigation.'}, null, 2) + '\n');
}
