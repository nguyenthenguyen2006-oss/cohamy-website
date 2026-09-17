import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';

const origin='http://localhost:4310';
const browser=await chromium.launch({channel:'msedge',headless:true});
const cases=[];
try {
 const page=await browser.newPage();
 for(const locale of ['vi','en','zh','ko','ja']) {
  for(const route of ['cart','checkout']) {
   const response=await page.goto(`${origin}/${locale}/${route}`);
   assert.equal(response.status(),200);
   const robots=await page.locator('meta[name="robots"]').getAttribute('content');
   assert.ok(robots.includes('noindex')&&robots.includes('nofollow'));
   cases.push({route:page.url(),status:'PASS',robots});
  }
  const response=await page.goto(`${origin}/${locale}/products`);
  assert.equal(response.status(),200);
  const robotsMeta=page.locator('meta[name="robots"]');
  const robots=await robotsMeta.count()?await robotsMeta.getAttribute('content'):null;
  assert.ok(!robots?.includes('noindex'));
  assert.equal(await page.locator('link[rel="canonical"]').count(),1);
  cases.push({route:page.url(),status:'PASS',robots,canonical:await page.locator('link[rel="canonical"]').getAttribute('href')});
 }
 const report={environment:'LOCAL',testedAt:new Date().toISOString(),method:'Rendered metadata in headless Edge; legacy static QA only, not live CMS or crawler indexing proof',cases};
 await fs.writeFile('docs/crm/test-results/seo-local.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
