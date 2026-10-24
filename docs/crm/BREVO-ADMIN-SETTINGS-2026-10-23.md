# Nhập API Brevo trong cài đặt Admin

Đã triển khai LOCAL. Chưa deploy hoặc chạy migration production; mọi lần thử dùng khóa ngẫu nhiên giả và email `.invalid`, không gọi Brevo thật.

## Sử dụng

1. Admin mở `/crm/document-notifications` → phần **Brevo**.
2. Nhập **Email người gửi Brevo** và **API key Brevo**, rồi **Lưu cấu hình Brevo**. Sender cần được xác minh trong tài khoản Brevo.
3. Sau lưu, ô API trống. Để trống khi sửa email sẽ giữ key; nhập key mới để thay thế. **Xóa API key đã lưu** xóa key khỏi cấu hình đang dùng, không tự lấy lại key cũ từ biến môi trường.
4. Lưu cấu hình không gửi email và không bật `CRM_EMAIL_ENABLED`. Nút **Gửi thử** vẫn cần Admin chủ động chọn địa chỉ; worker xử lý riêng.

Chỉ CRM Admin được đọc/sửa cấu hình, cả ở service và API. Manager, kế toán, nhà máy, kho và Portal không được quyền này. Các trường key/sender có hiệu lực cho email chứng từ, bảo mật/RFQ và nhắc công nợ EMAIL. SMS giữ cấu hình/gate riêng hiện có.

## Bảo vệ và lưu trữ

- Migration `db/crm/042-brevo-server-settings.sql` thêm một bản ghi singleton trong `cohamy_crm.brevo_settings`. API key chỉ lưu thành ciphertext AES-256-GCM với nonce ngẫu nhiên, tag xác thực và AAD gắn phiên bản/provider. Email gửi và số version lưu trong DB.
- Master key là `CRM_SETTINGS_ENCRYPTION_KEY`, chỉ ở môi trường server, tối thiểu 32 byte ngẫu nhiên (có thể mã hóa base64). Không đặt biến này dưới `NEXT_PUBLIC_*`, không nhập nó qua UI, không ghi vào Git/log. Dùng cùng master key cho web và mọi worker/process đọc DB này.
- API chỉ trả trạng thái có key, sender, version, nguồn và mã lỗi cho phép; không trả key, ciphertext hoặc fingerprint. Audit ghi người sửa, email trước/sau, version và thao tác giữ/thay/xóa key.
- DB được đọc khi gửi, không cache key giữa các lần thay đổi. Khi có bản ghi DB, lỗi giải mã/thiếu master không chuyển sang dùng env cũ. Outbox để DEFERRED và giữ ngân sách retry để quản trị khắc phục.
- Khi chưa có bản ghi DB, cấu hình env `CRM_BREVO_API_KEY`/`CRM_BREVO_SENDER_EMAIL` vẫn hoạt động tương thích. Nhánh env chưa cần master; master bắt buộc cho thao tác lưu qua UI. Lần đầu để trống key sẽ mã hóa và giữ key env hiện có nếu có.
- Các lỗi version chặn ghi đè cấu hình người khác vừa sửa. Lưu không gọi provider hoặc tạo job email.

Ứng dụng không tự tạo master key trên production. Trước áp dụng ngoài LOCAL, quản trị cần cấp một master key riêng qua secret store/env cho web và worker, rồi chạy migration trong quy trình release đã được phép. Nếu mất/đổi master, dữ liệu key cũ không đọc được: có thể cung cấp lại đúng master hoặc nhập lại API key mới bằng Admin với master mới; không có cơ chế đọc plaintext cũ từ UI.

## LOCAL hiện tại

`node scripts/crm/run-document-local.mjs` chỉ chạy fixture PGlite QA ở 127.0.0.1:4341, email ngoài luôn tắt. Launcher tạo master ngẫu nhiên một lần ở `.local/secure-settings/brevo-master.key`, ngoài dữ liệu DB và ngoài Git; Windows DACL chỉ cho tài khoản hiện tại và SYSTEM, Unix thư mục 0700/file 0600. Master được truyền vào môi trường tiến trình web; app không có fallback đọc file này. Nếu đã cấp `CRM_SETTINGS_ENCRYPTION_KEY` từ bên ngoài, launcher giữ nguyên giá trị đó.

Backup DB chứa ciphertext cần đi kèm bản backup master được bảo vệ riêng để khôi phục. Không đưa master vào dump SQL, báo cáo test hoặc file bàn giao công khai. Quay source về bản cũ không đọc cấu hình DB; không bật lại key env cũ khi rollback nếu Admin đã chủ động xóa key. Giữ migration bổ sung; không drop dữ liệu cấu hình để rollback.

## Kiểm chứng

| Kiểm tra | Kết quả LOCAL |
| --- | --- |
| `test-brevo-settings.ts` | 14/14 PGlite: quyền/stale principal, ciphertext và audit, giữ/thay/xóa, env precedence/import, lỗi master/tamper/outage, hai đường gửi với fake fetch |
| `verify-brevo-settings-browser.mjs` | 6/6 Edge: form thực, refresh, giữ key khi đổi sender, CSRF, quyền API/UI, mobile 390 và không lưu key vào browser storage |
| `verify-brevo-settings-browser.mjs --after-restart` | 2/2: đăng nhập sau restart vẫn giải mã được, xóa key rồi reload không lấy lại env |
| Master local | `test-local-settings-key.mjs` 3/3: tạo/giữ master, sửa quyền file khôi phục có Everyone đọc, env precedence |
| Provider fake | 5/5; cả hai cờ DEMO chặn gửi ngoài |
| Outbox | 10/10, gồm DEFERRED không tốn lượt khi thiếu master/không đọc được cấu hình |
| Hồi quy | Core chứng từ 19/19 PGlite; finance 10/10 |
| Compile | Whole-tree TypeScript và optimized build LOCAL PASS |

Chỉ mục bằng chứng: `docs/crm/test-results/document-flow/brevo-settings-verification.json`.

Artifact nằm trong `docs/crm/test-results/document-flow/brevo-settings-*.json/png`. Ảnh đã lưu không chứa API key. Chưa thử trên mailbox thật hoặc chứng minh release production.

```powershell
node --require ./scripts/register-server-only.cjs --import tsx scripts/crm/test-brevo-settings.ts
node scripts/crm/verify-brevo-settings-browser.mjs
# Restart local server independently, then:
node scripts/crm/verify-brevo-settings-browser.mjs --after-restart
```
