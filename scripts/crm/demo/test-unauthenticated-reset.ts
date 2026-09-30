import 'server-only';
import assert from 'node:assert/strict';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

import { requestPasswordReset, resetPassword } from '@/lib/crm/account-security';
import { login } from '@/lib/crm/auth';
import { database } from '@/lib/crm/db';
import { POST } from '@/app/api/crm/security/[action]/route';
import { resolveDemoPassword } from './constants';

async function testUnauthenticatedReset() {
  console.log('=================================================');
  console.log(' [COHAMY CRM] TEST BẢO MẬT API DEMO: KHÔNG LỘ qaToken');
  console.log('  Kiểm thử người chưa đăng nhập không thể lấy token ');
  console.log('  hoặc đặt lại trái phép mật khẩu quản trị viên   ');
  console.log('=================================================');

  process.env.CRM_ENVIRONMENT = 'DEMO';
  process.env.CRM_DEMO_MODE = 'true';
  process.env.CRM_DATABASE_MODE = process.env.CRM_DATABASE_MODE || 'pglite';
  if (!process.env.CRM_LOCAL_DATA_DIR) {
    process.env.CRM_LOCAL_DATA_DIR = '.local/crm-demo';
  }
  process.env.CRM_PUBLIC_ORIGIN = process.env.CRM_PUBLIC_ORIGIN || 'https://demo.cohamy.vn';

  const rawPassword = resolveDemoPassword();
  const adminEmail = 'admin@demo.cohamy.invalid';

  // 1. Unauthenticated password reset request via library function
  console.log('\n[1/4] Gửi yêu cầu quên mật khẩu tài khoản Quản trị viên (admin)...');
  const result = await requestPasswordReset(adminEmail);
  console.log('  Kết quả trả về từ requestPasswordReset():', JSON.stringify(result));

  assert.equal(result.accepted, true, 'Yêu cầu phải được ghi nhận (accepted: true)');
  assert.equal(
    'qaToken' in result,
    false,
    'VI PHẠM BẢO MẬT: qaToken KHÔNG ĐƯỢC XUẤT HIỆN trong phản hồi ở môi trường DEMO!'
  );
  assert.equal(
    (result as { qaToken?: string }).qaToken,
    undefined,
    'qaToken phải hoàn toàn undefined trong DEMO'
  );
  console.log('  -> PASS: Phản hồi công khai KHÔNG chứa qaToken.');

  // 2. Unauthenticated password reset request via public HTTP API endpoint
  console.log('\n[2/4] Kiểm tra qua HTTP Route Handler công khai POST /api/crm/security/forgot...');
  const fakeRequest = new Request('https://demo.cohamy.vn/api/crm/security/forgot', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://demo.cohamy.vn',
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify({ email: adminEmail }),
  });

  const apiRes = await POST(fakeRequest, { params: Promise.resolve({ action: 'forgot' }) });
  assert.equal(apiRes.status, 200, 'API status code must be 200');
  const apiBody = (await apiRes.json()) as Record<string, unknown>;
  console.log('  Phản hồi JSON từ API route:', JSON.stringify(apiBody));

  assert.equal(apiBody.accepted, true);
  assert.equal(
    'qaToken' in apiBody,
    false,
    'VI PHẠM BẢO MẬT: API công khai để lộ qaToken cho người chưa đăng nhập!'
  );
  assert.equal(apiBody.qaToken, undefined);
  console.log('  -> PASS: API công khai POST /api/crm/security/forgot KHÔNG trả về qaToken.');

  // 3. Attempt unauthorized password reset with brute-force / forged tokens
  console.log('\n[3/4] Thử đặt lại mật khẩu với token giả mạo hoặc thiếu token...');
  await assert.rejects(
    async () => {
      await resetPassword({
        token: '',
        newPassword: 'AttackerNewPassword123!',
      });
    },
    /INVALID_FIELDS/,
    'Hệ thống phải từ chối token rỗng'
  );

  const forgedToken = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP1'; // 43 chars base64url
  await assert.rejects(
    async () => {
      await resetPassword({
        token: forgedToken,
        newPassword: 'AttackerNewPassword123!',
      });
    },
    /RESET_TOKEN_INVALID/,
    'Hệ thống phải từ chối token giả mạo'
  );
  console.log('  -> PASS: Tất cả nỗ lực đặt lại mật khẩu bằng token giả mạo đều bị từ chối.');

  // 4. Verify original admin credentials remain intact
  console.log('\n[4/4] Xác nhận mật khẩu quản trị viên vẫn an toàn, không bị thay đổi...');
  const originalLogin = await login(adminEmail, rawPassword);
  assert.ok(originalLogin.token, 'Đăng nhập bằng mật khẩu ban đầu phải thành công');
  assert.equal(originalLogin.user.email, adminEmail);

  await assert.rejects(
    async () => {
      await login(adminEmail, 'AttackerNewPassword123!');
    },
    /INVALID_CREDENTIALS/,
    'Mật khẩu của kẻ tấn công không được hoạt động'
  );
  console.log('  -> PASS: Tài khoản quản trị viên được bảo vệ tuyệt đối.');

  console.log('\n=================================================');
  console.log(' ✅ TEST BẢO MẬT qaToken VÀ RESET MẬT KHẨU: PASS!');
  console.log('=================================================');

  const db = await database();
  await db.close().catch(() => {});
}

testUnauthenticatedReset()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('TEST_UNAUTHENTICATED_RESET_FAILED:', err);
    process.exit(1);
  });
