import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createQaFixture, qaPassword} from './qa-fixture';
import {installQaRuntime} from './qa-runtime';
import {database, type Database, type Sql} from '../../lib/crm/db';
import {digest, login} from '../../lib/crm/auth';
import {getPublicStorefront, getStorefrontSettings, saveStorefrontSettings} from '../../lib/crm/storefront';
import {calculateStorefrontPrice, STOREFRONT_PRODUCTS} from '../../lib/storefront-pricing';
import {createWebsiteOrder} from '../../lib/crm/website-orders';
import {invokeOperation, operationCatalog} from '../../lib/crm/mcp/bridge';
import {browseData, dataCatalog} from '../../lib/crm/mcp/data';

async function main() {
  const postgres = process.env.CRM_DATABASE_MODE === 'postgres';
  if (postgres) {
    const target = new URL(process.env.CRM_DATABASE_URL ?? '');
    assert.equal(process.env.CRM_ENVIRONMENT, 'STAGING');
    assert.ok(['localhost', '127.0.0.1'].includes(target.hostname));
    assert.equal(target.port, '55432');
    assert.match(target.pathname, /^\/cohamy_qa_storefront_[a-z0-9_]+$/);
  } else {
    delete process.env.CRM_DATABASE_URL;
    process.env.CRM_DATABASE_MODE = 'pglite';
    process.env.CRM_ENVIRONMENT = 'LOCAL';
    process.env.CRM_LOCAL_DATA_DIR = '.local/crm-qa-storefront-' + randomUUID();
  }
  process.env.CRM_EMAIL_ENABLED = 'false';
  process.env.CRM_WEBSITE_ORDER_INTAKE = 'true';
  process.env.CRM_PUBLIC_ORIGIN = 'https://storefront-qa.invalid';
  await createQaFixture();
  const owner = await database();
  // Fictitious independent QA catalog mirrors the documented identity mapping.
  for (const mapping of STOREFRONT_PRODUCTS) await owner.query(`INSERT INTO cohamy_crm.products(id,website_id,sku,name,category,weight_label,retail_price,vat_rate,translations)
    VALUES($1,$2,$3,$4,'pouch',$5,79000,8,'{}'::jsonb)
    ON CONFLICT(website_id) DO UPDATE SET weight_label=EXCLUDED.weight_label,retail_price=79000,vat_rate=8,active=true`,
    [randomUUID(), mapping.crmWebsiteId, 'WEB-' + mapping.crmWebsiteId, 'QA storefront package', mapping.weight]);
  const admin = (await login('admin@crm-qa.invalid', qaPassword)).user;
  const sales = (await login('sales@crm-qa.invalid', qaPassword)).user;
  const close = await installQaRuntime(owner), db = await database();
  const cases: {name: string; status: string}[] = [];
  let complete = false;
  const test = async (name: string, run: () => Promise<void>) => { await run(); cases.push({name, status: 'PASS'}); console.log('PASS ' + name); };
  try {
    await test('Retail prices exclude VAT; exact discount and per-unit VAT give the same consumer total', async () => {
      assert.deepEqual(calculateStorefrontPrice(79000, 30, '8.00'), {basePrice: 79000, netSalePrice: 55300, vatRate: 8, vatAmount: 4424, listPrice: 85320, salePrice: 59724});
      assert.deepEqual(calculateStorefrontPrice(101, 50, '8.00'), {basePrice: 101, netSalePrice: 51, vatRate: 8, vatAmount: 4, listPrice: 109, salePrice: 55});
      assert.throws(() => calculateStorefrontPrice(Number.MAX_SAFE_INTEGER + 1, 30, '8'), /AMOUNT_INVALID/);
      assert.throws(() => calculateStorefrontPrice(1, 99, '8'), /AMOUNT_INVALID/);
      const quote = await getPublicStorefront();
      assert.equal(quote.discountPercent, 30); assert.equal(quote.items.length, 8);
      assert.ok(quote.items.every(item => item.available && item.salePrice === 59724));
      assert.equal(quote.intakeEnabled, true); assert.match(quote.quoteVersion, /^[a-f0-9]{64}$/);
    });
    await test('Only a current Admin can read or save public retail settings, with bounded strict input', async () => {
      await assert.rejects(getStorefrontSettings(sales), /FORBIDDEN/);
      await assert.rejects(saveStorefrontSettings(sales, {version: 1, discountPercent: 25, idempotencyKey: randomUUID()}), /FORBIDDEN/);
      for (const discountPercent of [-1, 100, 1.1]) await assert.rejects(saveStorefrontSettings(admin, {version: 1, discountPercent, idempotencyKey: randomUUID()}), /INVALID_FIELDS/);
      await assert.rejects(saveStorefrontSettings(admin, {version: 1, discountPercent: 30, idempotencyKey: randomUUID(), role: 'ADMIN'}), /INVALID_FIELDS/);
      await assert.rejects(getStorefrontSettings({...admin, membershipVersion: admin.membershipVersion + 1}), /FORBIDDEN/);
    });
    await test('Settings use version checking, exact native retries and append-only audited receipts', async () => {
      const request = {version: 1, discountPercent: 25, idempotencyKey: randomUUID()};
      const result = await saveStorefrontSettings(admin, request);
      assert.deepEqual(result, {version: 2, discountPercent: 25});
      assert.deepEqual(await saveStorefrontSettings(admin, request), result);
      await assert.rejects(saveStorefrontSettings(admin, {...request, discountPercent: 20}), /IDEMPOTENCY_CONFLICT/);
      await assert.rejects(saveStorefrontSettings(admin, {...request, idempotencyKey: randomUUID()}), /VERSION_CONFLICT/);
      assert.equal((await db.query<{n: string}>("SELECT count(*)::text AS n FROM cohamy_crm.audit_events WHERE action='storefront.discount-saved'")).rows[0].n, '1');
      await assert.rejects(db.query('UPDATE cohamy_crm.storefront_setting_actions SET request_hash=$1', ['tamper']), postgres ? /permission denied/ : /AUDIT_APPEND_ONLY/);
    });
    const quote = await getPublicStorefront();
    const input = {idempotencyKey: randomUUID(), locale: 'vi', payment: 'cod', quoteVersion: quote.quoteVersion, acceptedPolicyVersion: '2026-11-05', contact: {fullName: 'QA storefront buyer', email: 'buyer@crm-qa.invalid', phone: '0900000000', address: 'QA fictitious delivery address', city: 'QA city', district: '', ward: '', note: 'Fictitious test; no delivery'}, items: [{productId: STOREFRONT_PRODUCTS[1].productId, quantity: 3}]};
    let receipt: Awaited<ReturnType<typeof createWebsiteOrder>>;
    await test('Checkout stores server-priced immutable net, discount, VAT and gross without posting money or stock', async () => {
      receipt = await createWebsiteOrder(input);
      assert.equal(receipt.subtotal, String(quote.items[1].salePrice! * 3));
      assert.equal(receipt.paid, false); assert.equal(receipt.status, 'PENDING_REVIEW');
      const row = (await db.query<{lines: {unitPrice: string; netUnitPrice: string; vatAmount: string; lineTotal: string; baseUnitPrice: string; discountPercent: number}[]; paid: boolean; status: string}>('SELECT lines,paid,status FROM cohamy_crm.website_orders WHERE idempotency_key=$1', [input.idempotencyKey])).rows[0];
      assert.equal(row.lines[0].unitPrice, String(quote.items[1].salePrice));
      assert.equal(row.lines[0].netUnitPrice, String(quote.items[1].netSalePrice));
      assert.equal(row.lines[0].vatAmount, String(quote.items[1].vatAmount! * 3));
      assert.equal(row.lines[0].baseUnitPrice, '79000'); assert.equal(row.lines[0].discountPercent, 25);
      assert.equal(row.lines[0].lineTotal, receipt.subtotal); assert.equal(row.paid, false);
      const acknowledgement = (await db.query<{payload: {policyAcknowledgement: {version: string; acceptedAt: string; marketingConsent: boolean}}}>("SELECT payload FROM cohamy_crm.audit_events WHERE action='website.order-received' AND payload->>'code'=$1", [receipt.code])).rows[0].payload.policyAcknowledgement;
      assert.equal(acknowledgement.version, '2026-11-05'); assert.equal(acknowledgement.marketingConsent, false);
      assert.ok(Number.isFinite(Date.parse(acknowledgement.acceptedAt)));
      await assert.rejects(createWebsiteOrder({...input, idempotencyKey: randomUUID(), acceptedPolicyVersion: '2099-01-01'}), /INVALID_FIELDS/);
      await assert.rejects(createWebsiteOrder({...input, acceptedPolicyVersion: undefined}), /IDEMPOTENCY_CONFLICT/);
      await assert.rejects(createWebsiteOrder({...input, idempotencyKey: randomUUID(), acceptedPolicyVersion: undefined}), /PRICE_REVIEW_REQUIRED/);
      await assert.rejects(createWebsiteOrder({...input, idempotencyKey: randomUUID(), quoteVersion: undefined}), /PRICE_REVIEW_REQUIRED/);
      await assert.rejects(createWebsiteOrder({...input, idempotencyKey: randomUUID(), items: [{...input.items[0], price: 1}]}), /INVALID_FIELDS/);
      await assert.rejects(createWebsiteOrder({...input, items: [{...input.items[0], quantity: 2}]}), /IDEMPOTENCY_CONFLICT/);
    });
    await test('Discount or catalog VAT changes reject stale quotes while retries keep the original order and total', async () => {
      await saveStorefrontSettings(admin, {version: 2, discountPercent: 30, idempotencyKey: randomUUID()});
      await assert.rejects(createWebsiteOrder({...input, idempotencyKey: randomUUID()}), /PRICE_CHANGED/);
      assert.deepEqual(await createWebsiteOrder(input), receipt!);
      const fresh = await getPublicStorefront();
      await db.query("UPDATE cohamy_crm.products SET vat_rate=10,version=version+1 WHERE website_id=$1", [STOREFRONT_PRODUCTS[1].crmWebsiteId]);
      await assert.rejects(createWebsiteOrder({...input, quoteVersion: fresh.quoteVersion, idempotencyKey: randomUUID()}), /PRICE_CHANGED/);
      assert.deepEqual(await createWebsiteOrder(input), receipt!);
      assert.equal((await db.query<{n: string}>('SELECT count(*)::text AS n FROM cohamy_crm.website_orders')).rows[0].n, '1');
    });
    await test('Inactive, mismatched packages and discontinued public products cannot become free or purchasable', async () => {
      await db.query('UPDATE cohamy_crm.products SET active=false,version=version+1 WHERE website_id=$1', [STOREFRONT_PRODUCTS[1].crmWebsiteId]);
      let current = await getPublicStorefront(); assert.equal(current.items[1].available, false); assert.equal(current.items[1].salePrice, null);
      await assert.rejects(createWebsiteOrder({...input, quoteVersion: current.quoteVersion, idempotencyKey: randomUUID()}), /PRICE_ON_REQUEST/);
      await db.query("UPDATE cohamy_crm.products SET active=true,weight_label='55g',version=version+1 WHERE website_id=$1", [STOREFRONT_PRODUCTS[1].crmWebsiteId]);
      current = await getPublicStorefront(); assert.equal(current.items[1].available, false);
      await assert.rejects(createWebsiteOrder({...input, quoteVersion: current.quoteVersion, idempotencyKey: randomUUID(), items: [{productId: 'cohamy-almond-chocolate', quantity: 1}]}), /PRODUCT_OUT_OF_STOCK/);
      await db.query("UPDATE cohamy_crm.products SET weight_label='80g',version=version+1 WHERE website_id=$1", [STOREFRONT_PRODUCTS[1].crmWebsiteId]);
    });
    await test('Native MCP can discover/read/update retail settings and read policy/current settings data safely', async () => {
      const operations = operationCatalog('', 'POST /api/crm/storefront');
      assert.ok('operations' in operations);
      assert.equal(operations.operations[0].status, 'AVAILABLE');
      const read = await invokeOperation(admin, {operation: 'GET /api/crm/storefront'}, false);
      assert.equal(read.status, 200); assert.ok('data' in read);
      const settings = read.data as {version: number; discountPercent: number};
      const command = {operation: 'POST /api/crm/storefront', input: {version: settings.version, discountPercent: 20, idempotencyKey: randomUUID()}};
      const saved = await invokeOperation(admin, command, true);
      assert.equal(saved.status, 200); assert.deepEqual(await invokeOperation(admin, command, true), saved);
      assert.equal((await getPublicStorefront()).discountPercent, 20);
      const catalog = await dataCatalog(admin);
      assert.ok(catalog.tables.storefront_settings); assert.equal(catalog.tables.storefront_setting_actions, undefined);
      assert.equal((await browseData(admin, {table: 'storefront_settings'})).total, 1);
      const policies = await invokeOperation(admin, {operation: 'GET /api/crm/storefront/policies'}, false);
      assert.equal(policies.status, 200);
      assert.ok(!JSON.stringify(read).includes('password_hash'));
    });
    await test('Pre-upgrade orders without quote or acknowledgement fields still replay their frozen receipt', async () => {
      const legacy = {...input, quoteVersion: undefined, acceptedPolicyVersion: undefined, idempotencyKey: randomUUID()};
      const code = 'CH-QA-LEGACY-' + randomUUID().replaceAll('-', '').slice(0, 12);
      await db.query(`INSERT INTO cohamy_crm.website_orders(id,code,idempotency_key,request_hash,locale,contact,lines,subtotal,payment_requested)
        VALUES($1,$2,$3,$4,'vi',$5::jsonb,'[]'::jsonb,123,'cod')`, [randomUUID(), code, legacy.idempotencyKey, digest(JSON.stringify({...legacy, idempotencyKey: undefined})), JSON.stringify(legacy.contact)]);
      const replay = await createWebsiteOrder(legacy);
      assert.equal(replay.code, code); assert.equal(replay.subtotal, '123');
      assert.equal(replay.paid, false);
    });
    if (postgres) await test('Concurrent same-version Admin changes allow one winner without duplicated audit', async () => {
      const state = await getStorefrontSettings(admin);
      const results = await Promise.allSettled([20, 25].map(discountPercent => saveStorefrontSettings(admin, {version: state.version, discountPercent, idempotencyKey: randomUUID()})));
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      assert.ok(results.some(result => result.status === 'rejected' && String(result.reason).includes('VERSION_CONFLICT')));
    });
    if (postgres) await test('A retry that missed an uncommitted order replays it after a concurrent discount commit', async () => {
      const state = await getStorefrontSettings(admin);
      const race = {...input, quoteVersion: state.quoteVersion, idempotencyKey: randomUUID()};
      let signalInserted!: () => void, rejectInserted!: (error: unknown) => void, releaseInsert!: () => void;
      const inserted = new Promise<void>((resolve, reject) => {signalInserted = resolve; rejectInserted = reject;});
      const released = new Promise<void>(resolve => {releaseInsert = resolve;});
      let signalRetry!: () => void, rejectRetry!: (error: unknown) => void, releaseRetry!: () => void;
      const retryReached = new Promise<void>((resolve, reject) => {signalRetry = resolve; rejectRetry = reject;});
      const retryReleased = new Promise<void>(resolve => {releaseRetry = resolve;});
      let firstInsert = true;
      let adminPid: number | undefined;
      const instrumented: Database = {...db, transaction: fn => db.transaction(sql => fn({...sql, query: async <T>(text: string, params?: unknown[]) => {
        if (text.includes('storefront_settings') && (text.endsWith('FOR UPDATE') || (!firstInsert && text.endsWith('FOR SHARE')))) {
          if (text.endsWith('FOR UPDATE')) adminPid = (await sql.query<{pid: number}>('SELECT pg_backend_pid() AS pid')).rows[0].pid;
          else {
            // The retry already missed the uncommitted receipt. Delay only its
            // next real SELECT so the Admin can commit first; no lock-queue
            // fairness assumption or SQL result substitution is involved.
            signalRetry(); await retryReleased;
          }
        }
        const result = await sql.query<T>(text, params);
        if (firstInsert && text.startsWith('INSERT INTO cohamy_crm.website_orders') && params?.[2] === race.idempotencyKey) {
          firstInsert = false; signalInserted(); await released;
        }
        return result;
      }} as Sql))};
      const globalDb = globalThis as unknown as {cohamyCrmDatabase: Promise<Database>};
      globalDb.cohamyCrmDatabase = Promise.resolve(instrumented);
      const pending: Promise<unknown>[] = [];
      const adminQueued = async () => {
        // Observe PostgreSQL's actual wait queue; no timing sleeps decide ordering.
        for (let attempt = 0; attempt < 2000; attempt++) {
          const row = (await owner.query<{n: string}>('SELECT count(*)::text AS n FROM pg_locks WHERE pid=$1 AND NOT granted', [adminPid ?? 0])).rows[0];
          if (Number(row.n) > 0) return;
        }
        throw new Error('STOREFRONT_QA_ADMIN_LOCK_QUEUE_NOT_REACHED');
      };
      try {
        const first = createWebsiteOrder(race); pending.push(first);
        void first.catch(rejectInserted);
        await inserted;
        const changed = saveStorefrontSettings(admin, {version: state.version, discountPercent: state.discountPercent === 22 ? 23 : 22, idempotencyKey: randomUUID()}); pending.push(changed);
        void changed.catch(() => {});
        await adminQueued();
        const retry = createWebsiteOrder(race); pending.push(retry);
        void retry.catch(rejectRetry);
        await retryReached;
        releaseInsert();
        const [original] = await Promise.all([first, changed]);
        releaseRetry();
        const replayed = await retry;
        assert.deepEqual(replayed, original);
        assert.equal((await owner.query<{n: string}>('SELECT count(*)::text AS n FROM cohamy_crm.website_orders WHERE idempotency_key=$1', [race.idempotencyKey])).rows[0].n, '1');
        assert.equal((await owner.query<{n: string}>("SELECT count(*)::text AS n FROM cohamy_crm.audit_events WHERE action='website.order-received' AND payload->>'code'=$1", [original.code])).rows[0].n, '1');
      } finally {
        releaseInsert(); releaseRetry(); await Promise.allSettled(pending);
        globalDb.cohamyCrmDatabase = Promise.resolve(db);
      }
    });
    const current = await getStorefrontSettings(admin);
    if (current.discountPercent !== 30) await saveStorefrontSettings(admin, {version: current.version, discountPercent: 30, idempotencyKey: randomUUID()});
    if (!postgres) await fs.writeFile('.local/storefront-qa.json', JSON.stringify({dataDir: process.env.CRM_LOCAL_DATA_DIR, qaPassword, adminOrganizationId: admin.organizationId}), {mode: 0o600});
    complete = true;
  } finally {
    await fs.mkdir('docs/crm/test-results/storefront', {recursive: true});
    await fs.writeFile('docs/crm/test-results/storefront/services-' + (postgres ? 'staging' : 'local') + '.json', JSON.stringify({status: complete ? 'PASS' : 'FAIL', environment: postgres ? 'STAGING isolated PostgreSQL restricted DML role' : 'LOCAL PGlite', testedAt: new Date().toISOString(), cases, productionWrites: 0, externalEmails: 0}, null, 2) + '\n');
    await close(); await owner.close();
  }
}
main().catch(error => {console.error(error instanceof Error ? error.message : 'STOREFRONT_QA_FAILED'); process.exitCode = 1;});
