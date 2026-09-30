import 'server-only';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database } from '@/lib/crm/db';
import { sendTransactionalEmail } from '@/lib/crm/brevo';
import { runDueReminders, scheduleReminder } from '@/lib/crm/finance';
import { requestPasswordReset } from '@/lib/crm/account-security';
import { login } from '@/lib/crm/auth';
import { resolveDemoPassword } from './constants';

async function testNetworkIsolation() {
  console.log('=================================================');
  console.log(' [COHAMY CRM] TEST CÔ LẬP MẠNG RA NGOÀI (DEMO)  ');
  console.log('=================================================');

  process.env.CRM_DATABASE_MODE = 'pglite';
  process.env.CRM_ENVIRONMENT = 'DEMO';
  process.env.CRM_LOCAL_DATA_DIR = '.local/crm-demo';

  // Mock global fetch to strictly monitor and block any outbound provider requests
  let outboundRequestCount = 0;
  const outboundRequests: { url: string; method: string }[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    outboundRequestCount++;
    outboundRequests.push({ url: urlStr, method: init?.method || 'GET' });
    throw new Error(`SECURITY_ALERT: Outbound network request intercepted in DEMO mode to [${urlStr}]! Outbound calls to real providers are strictly prohibited in DEMO.`);
  }) as typeof fetch;

  try {
    const db = await database();
    const rawPassword = resolveDemoPassword();

    // Authenticate accountant for finance actions
    const accountantLogin = await login('accountant@demo.cohamy.invalid', rawPassword);
    const accountant = accountantLogin.user;

    // Test 1: Brevo transactional email simulation
    console.log('\n[1/3] Kiểm tra gửi Email Brevo trong môi trường DEMO...');
    const emailResult = await sendTransactionalEmail(
      'customer@external-real-domain.com',
      'DEMO · Chào mừng khách hàng',
      'Nội dung email demo giả lập.',
      randomUUID()
    );
    assert.ok(emailResult.startsWith('demo-msg-'), 'Email result must return demo simulation ID');
    assert.equal(outboundRequestCount, 0, 'No outbound fetch must have been made for email');
    console.log('  -> PASS: Email Brevo được mô phỏng an toàn, không có request tới api.brevo.com.');

    // Test 2: Debt reminders (EMAIL and SMS channels)
    console.log('\n[2/3] Kiểm tra nhắc nợ đa kênh (EMAIL & SMS) trong môi trường DEMO...');
    // Find an open demo receivable to schedule reminders for
    const recRow = (await db.query<{ id: string }>('SELECT id FROM cohamy_crm.receivables WHERE remaining_amount > 0 LIMIT 1')).rows[0];
    assert.ok(recRow, 'Must have at least one open receivable for test');

    // Schedule EMAIL reminder
    const emailReminder = (await scheduleReminder(accountant, {
      receivableId: recRow.id,
      scheduledFor: new Date(Date.now() - 60000).toISOString(), // Due 1 minute ago
      channel: 'EMAIL',
      recipient: 'ketoan@khachhang-thuc-te.vn',
      template: 'DEMO: Thông báo nhắc thanh toán công nợ đến hạn',
      reason: 'DEMO test nhắc nợ email',
      idempotencyKey: randomUUID(),
    })) as { id: string; status: string };

    // Schedule SMS reminder
    const smsReminder = (await scheduleReminder(accountant, {
      receivableId: recRow.id,
      scheduledFor: new Date(Date.now() - 60000).toISOString(), // Due 1 minute ago
      channel: 'SMS',
      recipient: '0988776655',
      template: 'DEMO: Nhac no SMS Cohamy',
      reason: 'DEMO test nhắc nợ SMS',
      idempotencyKey: randomUUID(),
    })) as { id: string; status: string };

    // Run due reminders worker
    const reminderResults = await runDueReminders(accountant);
    console.log(`  -> Kết quả runDueReminders: đã xử lý ${reminderResults.processed}, gửi thành công ${reminderResults.sent}, lỗi ${reminderResults.failed}`);
    assert.ok(reminderResults.sent >= 2, 'Both EMAIL and SMS reminders must be sent');
    assert.equal(reminderResults.failed, 0, 'No reminders should fail in simulated demo mode');
    assert.equal(outboundRequestCount, 0, 'No outbound fetch must have been made for EMAIL/SMS reminders');

    // Verify reminder rows in database have demo provider keys
    const reminderRows = (await db.query<{ channel: string; status: string; provider_key: string }>(
      'SELECT channel, status, provider_key FROM cohamy_crm.payment_reminders WHERE id IN ($1, $2)',
      [emailReminder.id, smsReminder.id]
    )).rows;
    for (const r of reminderRows) {
      assert.equal(r.status, 'SENT', `Reminder ${r.channel} must be SENT`);
      assert.ok(r.provider_key.startsWith(`demo-${r.channel.toLowerCase()}-`), `Provider key must be demo format: ${r.provider_key}`);
    }
    console.log('  -> PASS: Cả Email và SMS nhắc nợ được gửi giả lập thành công, provider_key gắn nhãn demo.');

    // Test 3: Password reset workflow
    console.log('\n[3/3] Kiểm tra luồng quên mật khẩu / đặt lại mật khẩu trong môi trường DEMO...');
    const resetResult = await requestPasswordReset('admin@demo.cohamy.invalid');
    assert.equal(resetResult.accepted, true);
    assert.equal('qaToken' in resetResult, false, 'DEMO mode strictly OMITS qaToken from public responses');
    assert.equal(outboundRequestCount, 0, 'No outbound fetch must have been made for password reset');
    console.log('  -> PASS: Luồng đặt lại mật khẩu bảo mật (không lộ qaToken), mô phỏng an toàn, không gửi email ra ngoài.');

    console.log('\n=================================================');
    console.log(' TẤT CẢ CÁC ĐƯỜNG RA NGOÀI ĐÃ ĐƯỢC CHẶN & MÔ PHỎNG!');
    console.log(` Tổng số outbound network requests: ${outboundRequestCount}`);
    console.log(' KẾT QUẢ: PASS');
    console.log('=================================================');

    await db.close();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

testNetworkIsolation()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('NETWORK_ISOLATION_TEST_FAILED:', err);
    process.exit(1);
  });
