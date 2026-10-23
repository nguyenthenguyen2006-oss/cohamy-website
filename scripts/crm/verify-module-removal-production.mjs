import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium, expect} from '@playwright/test';

const base = 'https://cohamy.vn';
const credentialPath = process.env.COHAMY_VERIFY_CREDENTIAL_PATH;
assert.ok(credentialPath, 'COHAMY_VERIFY_CREDENTIAL_PATH_REQUIRED');
const credentials = JSON.parse(await fs.readFile(credentialPath, 'utf8'));
const modules = [
  ['library', 'Thư viện đối tác', 'library/list'],
  ['support', 'Phiếu hỗ trợ', 'portal/tickets'],
  ['articles', 'Bài viết website', 'articles/list'],
  ['automation', 'Lịch và quy tắc công việc', 'automation/schedules'],
  ['consignment', 'Ký gửi', 'consignment/overview'],
  ['procurement', 'Mua hàng và nhà cung cấp', 'procurement/overview'],
  ['invitations', 'Link mời đối tác', 'onboarding/invitations'],
  ['network', 'Mạng lưới, hạng & khuyến mãi', 'channel/network'],
];
const output = process.env.COHAMY_VERIFY_OUTPUT || 'docs/crm/test-results/module-removal-production.json';
const screenshots = '.local/production-module-removal';
await fs.mkdir(screenshots, {recursive:true});
const cases = [], pageErrors = [], screens = [];
const browser = await chromium.launch({channel:'msedge', headless:true});
const context = await browser.newContext({viewport:{width:1440,height:1080}});
context.setDefaultTimeout(30000);
const page = await context.newPage();
page.on('pageerror', error => pageErrors.push(error.message));
async function check(name, run) { await run(); cases.push({name,status:'PASS'}); console.log('PASS '+name); }
try {
  await check('Production administrator signs in through the CRM UI', async () => {
    assert.equal((await page.goto(base+'/crm/login')).status(), 200);
    await page.getByLabel('Email',{exact:true}).fill(credentials.email);
    await page.getByLabel('Mật khẩu',{exact:true}).fill(credentials.password);
    await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
    await expect(page).toHaveURL(base+'/crm');
    const me = await context.request.get(base+'/api/crm/me');
    assert.equal(me.status(),200);
    const data = await me.json();
    assert.equal((data.user || data).role, 'ADMIN');
  });
  await check('Desktop and mobile navigation omit all eight modules and the three empty groups', async () => {
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:1080});
      assert.equal((await page.goto(base+'/crm')).status(),200);
      await expect(page.locator('h1')).toBeVisible();
      if (width === 390) await page.getByRole('button',{name:'Mở menu',exact:true}).click();
      const nav = page.locator('.crm-sidebar');
      await expect(nav).toBeVisible();
      for (const [slug, label] of modules) {
        assert.equal(await page.locator(`a[href^="/crm/${slug}"]`).count(),0,slug);
        assert.equal(await nav.getByText(label,{exact:true}).count(),0,label);
      }
      for (const hub of ['library','consignment','procurement']) assert.equal(await page.locator(`a[href="/crm/hub/${hub}"]`).count(),0,hub);
      const file = screenshots+`/navigation-${width}.png`;
      await nav.screenshot({path:file}); screens.push(file);
    }
  });
  for (const [slug,label,api] of modules) await check(label+' removed: direct, create and detail URLs plus API return 404', async () => {
    for (const suffix of ['', '/new', '/00000000-0000-4000-8000-000000000000']) {
      const response = await context.request.get(base+'/crm/'+slug+suffix);
      assert.equal(response.status(),404,slug+suffix);
    }
    const response = await context.request.get(base+'/api/crm/'+api);
    assert.equal(response.status(),404,api);
    assert.equal((await response.json()).error,'NOT_FOUND');
    assert.match(response.headers()['cache-control'],/no-store/);
  });
  await check('Retired hub URLs are closed while retained CRM pages and private APIs work', async () => {
    for (const hub of ['library','consignment','procurement']) assert.equal((await context.request.get(base+'/crm/hub/'+hub)).status(),404,hub);
    for (const route of ['requests','sales','inventory','tasks','pricing','customers','dealers','reports','accounts','hub/dealers','hub/tasks']) assert.equal((await context.request.get(base+'/crm/'+route)).status(),200,route);
    for (const route of ['work/orders','work/tasks','pricing/books','commerce/requests','channel/report']) assert.equal((await context.request.get(base+'/api/crm/'+route)).status(),200,route);
  });
  await check('Public website remains healthy and logout revokes this verification session', async () => {
    const health = await context.request.get(base+'/api/health'); assert.equal(health.status(),200); assert.equal((await health.json()).ok,true);
    for (const route of ['/vi','/en','/zh','/ko','/ja','/vi/bai-viet','/vi/gio-hang','/portal/login']) assert.equal((await context.request.get(base+route)).status(),200,route);
    assert.equal((await context.request.post(base+'/api/crm/auth/logout',{headers:{origin:base}})).status(),200);
    assert.equal((await context.request.get(base+'/api/crm/work/orders')).status(),401);
  });
  assert.deepEqual(pageErrors,[]);
} finally {
  await context.request.post(base+'/api/crm/auth/logout',{headers:{origin:base}}).catch(()=>{});
  await browser.close();
  await fs.mkdir(path.dirname(output), {recursive:true});
  await fs.writeFile(output,JSON.stringify({environment:'PRODUCTION',testedAt:new Date().toISOString(),base,browser:'Microsoft Edge',scope:'Authenticated read-only verification except administrator login/logout; no business writes, deletes or messages',status:cases.length===12&&pageErrors.length===0?'PASS':'FAIL',cases,pageErrors,screens},null,2)+'\n');
}
console.log('PASS '+cases.length+' production module-removal checks');
