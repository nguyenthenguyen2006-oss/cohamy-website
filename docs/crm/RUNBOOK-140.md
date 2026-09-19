# Cohamy — runbook phát hành F001–F140

## Cấu hình

Production dùng PostgreSQL và migration 001–025. Đăng ký mở: `CRM_REGISTRATION_MODE=OPEN`. Brevo mặc định tắt; nạp `CRM_BREVO_API_KEY`, sender đã xác minh và đặt `CRM_EMAIL_ENABLED=true` chỉ sau test delivery được ủy quyền. Không commit secret. Worker `npm run crm:worker` phải được PM2/scheduler giám sát.

## Gate trước phát hành

1. `npm run typecheck`, ESLint và `npm run build`.
2. Chạy các lệnh trong [TEST-REPORT-140.md](./TEST-REPORT-140.md); mọi report bắt buộc phải PASS.
3. Kiểm tra `git diff --check`, không đưa `.local`, ảnh QA, credential hoặc `scripts/crm/verify-pm2-registration.mjs` vào commit.
4. Tạo một commit release, push đúng SHA.

## Triển khai

1. Backup DB/files, lưu checksum và kiểm tra khả năng đọc.
2. Checkout/clone đúng SHA từ remote trên máy chủ; cài dependency khóa; build.
3. Chạy `npm run crm:init` với tài khoản migration rồi trả runtime về DML role.
4. Reload ứng dụng và worker bằng PM2, chờ ready. Không chạy hai worker/poller trùng.
5. So sánh source SHA, deployed SHA/build image, migration 025, PM2 status, `/api/health`, HTTPS và cache/noindex của route private.
6. Smoke đăng nhập/logout, render `/crm`, `/crm/samples`, các phân hệ chính và năm locale công khai. Không tạo giao dịch kinh doanh thật.
7. Chạy backup sau deploy, xác minh checksum; restore định kỳ vào nơi độc lập theo retention/RPO/RTO đã được Cohamy duyệt.

## Rollback

Giữ bản release trước và backup trước migration. Nếu readiness hoặc smoke thất bại, phục hồi artifact/SHA trước; chỉ restore DB khi migration không thể tiến tới an toàn và phải dùng đúng backup đã xác minh. Không xóa dữ liệu hoặc giả lập số dư để làm xanh health check.
