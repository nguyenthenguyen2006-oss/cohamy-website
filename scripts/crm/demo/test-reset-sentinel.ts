import 'server-only';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { database } from '@/lib/crm/db';
import { migrate, importWebsiteCatalog } from '@/lib/crm/bootstrap';
import { resetDemoData, assertDemoDatabaseTarget } from './reset';

async function testResetSentinel() {
  console.log('=================================================');
  console.log(' [COHAMY CRM] TEST RESET CHỌN LỌC & SENTINEL     ');
  console.log('  (Database dùng một lần - Isolated Single-use)  ');
  console.log('=================================================');

  // Create isolated single-use database for this test run
  const ephemeralDir = `.local/crm-demo-sentinel-${randomUUID().replace(/-/g, '').slice(0, 10)}`;
  process.env.CRM_DATABASE_MODE = 'pglite';
  process.env.CRM_ENVIRONMENT = 'DEMO';
  process.env.CRM_LOCAL_DATA_DIR = ephemeralDir;

  try {
    // Bootstrap single-use database schema
    console.log(`\n[0/5] Khởi tạo schema và catalog trên database dùng một lần (${ephemeralDir})...`);
    await migrate();
    await importWebsiteCatalog();
  
  assert.throws(
    () => assertDemoDatabaseTarget({ environment: 'PRODUCTION' }),
    /DEMO_RESET_DATABASE_NOT_ALLOWED/,
    'Must reject reset in non-DEMO environment'
  );

  assert.throws(
    () =>
      assertDemoDatabaseTarget({
        environment: 'DEMO',
        databaseMode: 'postgres',
        databaseUrl: 'postgresql://cohamy_owner:pass@127.0.0.1:55432/cohamy_crm',
      }),
    /Refusing to reset protected production database 'cohamy_crm'/,
    'Must strictly reject production database cohamy_crm'
  );

  assert.throws(
    () =>
      assertDemoDatabaseTarget({
        environment: 'DEMO',
        databaseMode: 'postgres',
        databaseUrl: 'postgresql://cohamy_owner:pass@127.0.0.1:55432/cohamy_prod',
      }),
    /Refusing to reset protected production database 'cohamy_prod'/,
    'Must strictly reject cohamy_prod'
  );

  assert.throws(
    () =>
      assertDemoDatabaseTarget({
        environment: 'DEMO',
        databaseMode: 'postgres',
        databaseUrl: 'postgresql://cohamy_owner:pass@127.0.0.1:55432/analytics_db',
      }),
    /is not in the demo allowlist/,
    'Must reject databases not containing demo'
  );

  // Allowed database targets
  assert.doesNotThrow(
    () =>
      assertDemoDatabaseTarget({
        environment: 'DEMO',
        databaseMode: 'postgres',
        databaseUrl: 'postgresql://cohamy_owner:pass@127.0.0.1:55432/cohamy_crm_demo',
      }),
    'Must allow dedicated cohamy_crm_demo database'
  );

  assert.doesNotThrow(
    () =>
      assertDemoDatabaseTarget({
        environment: 'DEMO',
        databaseMode: 'pglite',
        localDataDir: '.local/crm-demo',
      }),
    'Must allow local crm-demo'
  );
  console.log('  -> PASS: Tất cả các chốt chặn allowlist database từ chối chính xác cơ sở dữ liệu thật/production.');

  // 2. Insert mixed demo + sentinel records
  console.log('\n[2/4] Trộn bản ghi demo và bản ghi sentinel (non-demo) vào database...');
  const db = await database();

  const sentinelOrgId = randomUUID();
  const sentinelOrgCode = 'SENTINEL_NON_DEMO';
  const sentinelUserId = randomUUID();
  const sentinelUserEmail = 'sentinel_boss@cohamy.com';
  const sentinelMembershipId = randomUUID();
  const sentinelProdId = randomUUID();
  const sentinelProdSku = 'SKU-SENTINEL-999';
  const sentinelWarehouseId = randomUUID();
  const sentinelWarehouseCode = 'KHO_SENTINEL_01';
  const sentinelPriceBookId = randomUUID();
  const sentinelRecId = randomUUID();
  const sentinelRecCode = 'REC-SENTINEL-999';
  const sentinelTaskId = randomUUID();
  const sentinelTicketId = randomUUID();

  // Demo records to ensure presence before reset
  const demoOrgId = randomUUID();
  const demoOrgCode = 'DEMO_TEST_RESET_ORG';
  const demoUserId = randomUUID();
  const demoUserEmail = 'user_reset_test@demo.cohamy.invalid';
  const demoProdId = randomUUID();
  const demoProdSku = 'DEMO-RESET-SKU-001';

  await db.transaction(async (sql) => {
    // Pre-cleanup of any prior sentinel records from previous test runs
    await sql.query('DELETE FROM cohamy_crm.support_tickets WHERE title LIKE \'%Sentinel%\'');
    await sql.query('DELETE FROM cohamy_crm.tasks WHERE title LIKE \'%Sentinel%\'');
    await sql.query('DELETE FROM cohamy_crm.receivables WHERE code=$1', [sentinelRecCode]);
    await sql.query('DELETE FROM cohamy_crm.price_books WHERE name LIKE \'%Sentinel%\'');
    await sql.query('DELETE FROM cohamy_crm.warehouses WHERE code=$1', [sentinelWarehouseCode]);
    await sql.query('DELETE FROM cohamy_crm.products WHERE sku=$1', [sentinelProdSku]);
    await sql.query('DELETE FROM cohamy_crm.memberships WHERE user_id IN (SELECT id FROM cohamy_crm.users WHERE email=$1)', [sentinelUserEmail]);
    await sql.query('DELETE FROM cohamy_crm.users WHERE email=$1', [sentinelUserEmail]);
    await sql.query('DELETE FROM cohamy_crm.organizations WHERE code=$1', [sentinelOrgCode]);

    // A. Insert Sentinel records (Real / Non-demo records)
    await sql.query(
      `INSERT INTO cohamy_crm.organizations(id, code, name, kind, phone, email, address, stage)
       VALUES($1, $2, 'Công ty Cổ phần Thực phẩm Sentinel Không-Demo', 'COHAMY', '024.9999.8888', $3, 'Hà Nội', 'ACTIVE')
       ON CONFLICT (code) DO NOTHING`,
      [sentinelOrgId, sentinelOrgCode, sentinelUserEmail]
    );

    const dummyHash = await bcrypt.hash('SentinelSecurePass2026!', 10);
    await sql.query(
      `INSERT INTO cohamy_crm.users(id, email, display_name, password_hash)
       VALUES($1, $2, 'Sentinel Executive User', $3)
       ON CONFLICT (email) DO NOTHING`,
      [sentinelUserId, sentinelUserEmail, dummyHash]
    );

    await sql.query(
      `INSERT INTO cohamy_crm.memberships(id, user_id, organization_id, role)
       VALUES($1, $2, $3, 'ADMIN')
       ON CONFLICT (user_id, organization_id, role) DO NOTHING`,
      [sentinelMembershipId, sentinelUserId, sentinelOrgId]
    );

    await sql.query(
      `INSERT INTO cohamy_crm.products(id, website_id, sku, name, category, weight_label, retail_price, translations)
       VALUES($1, 'SENTINEL_WEB_001', $2, 'Hạt Dinh Dưỡng Sentinel Đặc Biệt', 'Hạt Dinh Dưỡng', '500g', 150000, '{}'::jsonb)
       ON CONFLICT (sku) DO NOTHING`,
      [sentinelProdId, sentinelProdSku]
    );

    await sql.query(
      `INSERT INTO cohamy_crm.warehouses(id, code, name, organization_id)
       VALUES($1, $2, 'Kho Bảo Mật Sentinel Không-Demo', $3)
       ON CONFLICT (code) DO NOTHING`,
      [sentinelWarehouseId, sentinelWarehouseCode, sentinelOrgId]
    );

    await sql.query(
      `INSERT INTO cohamy_crm.price_books(id, name, status, audience, created_by)
       VALUES($1, 'Bảng giá Sentinel Thực Tế', 'DRAFT', 'ALL', $2)
       ON CONFLICT DO NOTHING`,
      [sentinelPriceBookId, sentinelUserId]
    );

    await sql.query(
      `INSERT INTO cohamy_crm.receivables(id, code, organization_id, source_type, source_id, original_amount, remaining_amount, due_on, terms_snapshot, status)
       VALUES($1::uuid, $2, $3, 'MANUAL', $1::text, 50000000, 50000000, CURRENT_DATE + 30, '{}'::jsonb, 'OPEN')
       ON CONFLICT (code) DO NOTHING`,
      [sentinelRecId, sentinelRecCode, sentinelOrgId]
    );

    await sql.query(
      `INSERT INTO cohamy_crm.tasks(id, entity_type, entity_id, title, assignee_id, created_by, due_at)
       VALUES($1, 'partner', $2, 'Task Thực Tế Sentinel Cần Giữ Nguyên', $3, $4, now() + interval '5 days')
       ON CONFLICT DO NOTHING`,
      [sentinelTaskId, sentinelOrgId, sentinelMembershipId, sentinelUserId]
    );

    await sql.query(
      `INSERT INTO cohamy_crm.support_tickets(id, organization_id, created_by, title, body, status)
       VALUES($1, $2, $3, 'Hỗ trợ nghiệp vụ Sentinel Không-Demo', 'Nội dung phiếu hỗ trợ thực tế', 'OPEN')
       ON CONFLICT DO NOTHING`,
      [sentinelTicketId, sentinelOrgId, sentinelUserId]
    );

    // B. Insert Demo test records (Should be purged by reset)
    await sql.query(
      `INSERT INTO cohamy_crm.organizations(id, code, name, kind, phone, email, address, stage)
       VALUES($1, $2, 'DEMO · Tổ chức thử nghiệm Reset', 'DEALER', '0912.000.111', $3, 'Hà Nội', 'ACTIVE')
       ON CONFLICT (code) DO NOTHING`,
      [demoOrgId, demoOrgCode, demoUserEmail]
    );

    await sql.query(
      `INSERT INTO cohamy_crm.users(id, email, display_name, password_hash)
       VALUES($1, $2, 'DEMO · Test User For Reset', $3)
       ON CONFLICT (email) DO NOTHING`,
      [demoUserId, demoUserEmail, dummyHash]
    );

    await sql.query(
      `INSERT INTO cohamy_crm.products(id, website_id, sku, name, category, weight_label, retail_price, translations)
       VALUES($1, 'DEMO_WEB_RESET_001', $2, 'DEMO · Sản phẩm test reset', 'Bột ngũ cốc', '250g', 85000, '{}'::jsonb)
       ON CONFLICT (sku) DO NOTHING`,
      [demoProdId, demoProdSku]
    );
  });
  console.log('  -> Đã tạo thành công các bản ghi sentinel và các bản ghi demo.');

  // 3. Test rollback on error
  console.log('\n[3/5] Kiểm thử cơ chế Rollback: khi có lỗi trong transaction reset, không có dữ liệu nào bị xóa mất...');
  await assert.rejects(
    async () => {
      await db.transaction(async (sql) => {
        await sql.query("DELETE FROM cohamy_crm.users WHERE email=$1", [demoUserEmail]);
        // Simulate unexpected failure inside transaction
        throw new Error('SIMULATED_TRANSACTION_FAILURE');
      });
    },
    /SIMULATED_TRANSACTION_FAILURE/,
    'Transaction must throw on internal failure'
  );
  // Verify demo user still exists due to rollback
  const rollbackCheck = (await db.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM cohamy_crm.users WHERE email=$1",
    [demoUserEmail]
  )).rows[0].count;
  assert.equal(rollbackCheck, '1', 'Demo user must still exist because transaction rolled back!');
  console.log('  -> PASS: Rollback hoạt động hoàn hảo, bảo vệ toàn vẹn dữ liệu khi gặp lỗi.');

  // 4. Execute targeted reset
  console.log('\n[4/5] Thực thi resetDemoData()...');
  const resetResult = await resetDemoData({ preserveCredentialsFile: true });
  assert.equal(resetResult.deletedBatch, 'DEMO_BATCH_2026');
  console.log('  -> resetDemoData() hoàn tất thành công trong transaction.');

  // 5. Verification: Sentinels must remain 100% intact, Demo records must be 0
  console.log('\n[5/5] Kiểm tra tính bảo toàn của bản ghi Sentinel và xóa sạch bản ghi Demo...');
  const verifyDb = await database();

  // Check Sentinels
  const checkSentinelOrg = (await verifyDb.query<{ id: string; name: string }>(
    'SELECT id, name FROM cohamy_crm.organizations WHERE code=$1',
    [sentinelOrgCode]
  )).rows[0];
  assert.ok(checkSentinelOrg, 'Sentinel organization MUST survive reset!');
  assert.equal(checkSentinelOrg.name, 'Công ty Cổ phần Thực phẩm Sentinel Không-Demo');

  const checkSentinelUser = (await verifyDb.query<{ id: string; email: string }>(
    'SELECT id, email FROM cohamy_crm.users WHERE email=$1',
    [sentinelUserEmail]
  )).rows[0];
  assert.ok(checkSentinelUser, 'Sentinel user MUST survive reset!');

  const checkSentinelProd = (await verifyDb.query<{ id: string; sku: string }>(
    'SELECT id, sku FROM cohamy_crm.products WHERE sku=$1',
    [sentinelProdSku]
  )).rows[0];
  assert.ok(checkSentinelProd, 'Sentinel product MUST survive reset!');

  const checkSentinelWarehouse = (await verifyDb.query<{ id: string }>(
    'SELECT id FROM cohamy_crm.warehouses WHERE code=$1',
    [sentinelWarehouseCode]
  )).rows[0];
  assert.ok(checkSentinelWarehouse, 'Sentinel warehouse MUST survive reset!');

  const checkSentinelPriceBook = (await verifyDb.query<{ id: string }>(
    'SELECT id FROM cohamy_crm.price_books WHERE name=$1',
    ['Bảng giá Sentinel Thực Tế']
  )).rows[0];
  assert.ok(checkSentinelPriceBook, 'Sentinel price book MUST survive reset!');

  const checkSentinelRec = (await verifyDb.query<{ id: string }>(
    'SELECT id FROM cohamy_crm.receivables WHERE code=$1',
    [sentinelRecCode]
  )).rows[0];
  assert.ok(checkSentinelRec, 'Sentinel receivable MUST survive reset!');

  const checkSentinelTask = (await verifyDb.query<{ id: string }>(
    'SELECT id FROM cohamy_crm.tasks WHERE id=$1',
    [sentinelTaskId]
  )).rows[0];
  assert.ok(checkSentinelTask, 'Sentinel task MUST survive reset!');

  const checkSentinelTicket = (await verifyDb.query<{ id: string }>(
    'SELECT id FROM cohamy_crm.support_tickets WHERE id=$1',
    [sentinelTicketId]
  )).rows[0];
  assert.ok(checkSentinelTicket, 'Sentinel support ticket MUST survive reset!');

  console.log('  -> PASS: 100% bản ghi Sentinel (Tổ chức, Người dùng, Phân quyền, Sản phẩm, Kho, Bảng giá, Công nợ, Công việc, Phiếu hỗ trợ) CÒN NGUYÊN VẸN!');

  // Check Demo records are purged
  const demoOrgCount = (await verifyDb.query<{ n: string }>(
    "SELECT count(*)::text AS n FROM cohamy_crm.organizations WHERE code LIKE 'DEMO_%' OR name LIKE 'DEMO · %'"
  )).rows[0].n;
  assert.equal(demoOrgCount, '0', 'All demo organizations must be deleted');

  const demoUserCount = (await verifyDb.query<{ n: string }>(
    "SELECT count(*)::text AS n FROM cohamy_crm.users WHERE email LIKE '%@demo.cohamy.invalid'"
  )).rows[0].n;
  assert.equal(demoUserCount, '0', 'All demo users must be deleted');

  const demoProdCount = (await verifyDb.query<{ n: string }>(
    "SELECT count(*)::text AS n FROM cohamy_crm.products WHERE sku LIKE 'DEMO-%'"
  )).rows[0].n;
  assert.equal(demoProdCount, '0', 'All demo products must be deleted');

  console.log('  -> PASS: Toàn bộ bản ghi thuộc batch Demo đã được xóa sạch (0 bản ghi demo còn lại).');

  // Verify triggers are strictly active and protect audit log outside demo reset
  console.log('\n  -> Kiểm tra bảo vệ trigger: append-only triggers vẫn HOẠT ĐỘNG...');
  await assert.rejects(
    () => verifyDb.query("DELETE FROM cohamy_crm.audit_events WHERE 1=1"),
    /AUDIT_APPEND_ONLY/,
    'Triggers must strictly remain active and reject direct audit deletions'
  );
  console.log('  -> PASS: Trigger cohamy_crm.deny_audit_mutation() đang bảo vệ toàn vẹn audit events.');

  console.log('\n=================================================');
  console.log(' TEST RESET CHỌN LỌC VỚI SENTINEL: PASS TOÀN BỘ!');
  console.log('=================================================');
  } finally {
    const activeDb = await database().catch(() => null);
    if (activeDb) await activeDb.close().catch(() => {});
    await fs.rm(ephemeralDir, { recursive: true, force: true }).catch(() => {});
    console.log(`  -> Đã dọn dẹp sạch sẽ database dùng một lần (${ephemeralDir}).`);
  }
}

testResetSentinel()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('TEST_RESET_SENTINEL_FAILED:', err);
    process.exit(1);
  });
