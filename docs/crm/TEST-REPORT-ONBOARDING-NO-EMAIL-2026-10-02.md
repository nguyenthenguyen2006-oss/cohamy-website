# Gửi hồ sơ đối tác trực tiếp — 02/10/2026

Yêu cầu: bỏ bước nhận/nhập mã xác minh email trên trang hồ sơ đối tác.

## Thay đổi

- `/portal/application` hiển thị nút Gửi hồ sơ xét duyệt cho DRAFT và NEEDS_INFO; bỏ khối gửi mã, nhập mã và cảnh báo chưa xác minh email.
- `submitApplication` và `reviewApplication` không yêu cầu email_verified_at. Giữ kiểm tra phiên, trạng thái, version, quyền xét duyệt và idempotency.
- Migration 030 bỏ điều kiện email_verified_at trong ràng buộc APPROVED, giữ điều kiện phải có membership. Không cập nhật dữ liệu hồ sơ, không tự đánh dấu email đã xác minh hay cấp quyền tự động.
- Cohamy tiếp tục xét duyệt trước khi tạo tài khoản/membership Portal. Hồ sơ cũ đang nháp hoặc cần bổ sung dùng ngay luồng gửi trực tiếp.
- Hướng dẫn đăng ký của cả năm ngôn ngữ và màn hình xét duyệt thống nhất luồng mới. API xác minh cũ giữ tương thích nhưng không được dùng trong luồng đăng ký.

## Bằng chứng

| Kiểm tra | Kết quả |
|---|---|
| Upgrade services LOCAL PGlite | 19/19 PASS, upgrade-local.json |
| Upgrade services STAGING PostgreSQL với quyền runtime DML | 19/19 PASS, upgrade-postgres.json |
| Edge thực, đăng ký/gửi/sửa/gửi lại/duyệt/đăng nhập | 3/3 PASS, onboarding-no-email-browser-local.json |
| Desktop 1366px và mobile 390px | Nút gửi hiện ngay; không có ô/nút xác minh, không tràn ngang |
| Kiểm tra email request | 0 request verification; email_verified_at vẫn null trước/sau duyệt |
| Build production và TypeScript | PASS |
| ESLint các file thay đổi | PASS |
| Build trace | PASS; có migration 030, không lọt dữ liệu QA |

Các thao tác tạo/gửi/duyệt hồ sơ dùng database QA riêng. Production được triển khai bằng exact SHA và kiểm tra đọc sau cutover; không tự gửi hoặc duyệt hồ sơ thật thay người dùng.
