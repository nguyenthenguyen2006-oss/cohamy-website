# Cohamy - checkpoint

Updated 2026-09-18T19:19:43.460Z. HEAD 02746efe0aa502db71e8a18ec43537c09e382c3c. Changes are uncommitted; user-provided PLAN file remains preserved. No push/deploy, real-data import, money/shipment or customer message performed.

Current source: P1 workspace/search/filter/columns/pins/panel/note drafts/private document versions/session/audit + XLSX jobs/worker; P2 open registration, Brevo adapter and applicant/reviewer workflow; P3 multiple contacts/checklist/dependency guard plus opportunities/reasons/tags/preferences/visits; independent portal cart/address/support/invitation/staff-lock scope, versioned partner library and onboarding checklist. Full acceptance is per-ID in FEATURE-MATRIX-140.md, not whole-phase completion.

Tests: see TEST-REPORT-140 and test-results JSON. UI server / processes / final build results are appended after verification. QA API/config credentials and OTP stay gitignored.

External inputs: Brevo key/verified sender/designated recipient; staging PostgreSQL test DB; D03-D13 business decisions and backup policy. Source development of remaining IDs can continue independently using explicitly labelled fixtures.

Next source tasks: finish P1/P2 gaps listed in matrix, then P3 CRM care automation and P4 versioned policy/quotes/orders. Do not promote intake READY to delivered/paid/revenue. Before acceptance, test PostgreSQL multi-connection approval/reservation/allocation/credit, negative A/B paths and independent restore.

NOT COMPLETED: 140-feature objective. IDs lacking implementation/acceptance remain open rather than inferred completed from shared UI or a passed build.

## Kiểm tra cuối — 19/09/2026

- Phạm vi đúng 140 ID: 14 VERIFIED_LOCAL, 31 IN_PROGRESS, 95 NOT_STARTED; 0 RELEASED. Không coi một đợt nâng cấp là hoàn tất toàn bộ kế hoạch.
- 103/103 ca PASS trong chín nhóm LOCAL: access 21, work 21, upgrade 18, portal 5, library 6, relationships 6, worker restart 3, XLSX 8, Edge UI 15. Hai ca kiểm tra đóng gói được ghi riêng.
- Edge UI: 19 ảnh desktop 1366px, mobile 390/320px; không có page/console error. Brevo MOCK_ONLY với địa chỉ QA giả; chưa kiểm chứng delivery thật.
- npm run build: PASS trên mã cuối, gồm hai sửa theo reviewer; 126 trang được build, route CRM/portal là dynamic.
- npm run typecheck: PASS. npm run lint: PASS, không cảnh báo. git diff --check: PASS.
- npm run test:crm:build: 2/2 PASS, 67 traces, đủ migration 001–010; không kèm QA database, ảnh, mailbox preload hoặc worker interruption fixture. Không sửa migration 001–004.
- npm run test:headless:contract đã PASS trong đợt này; không chạy lại toàn bộ WordPress/provider E2E hoặc kiểm tra production.
- Finish review: lần đầu fix; một đợt sửa; verdict ship chấm đúng hai phát hiện resolved. Xem UI-FINISH-REVIEW-140.md để biết phạm vi kết luận. DESIGN.md và sidecar chỉ được cập nhật trong ranh giới components/crm.
- Tài liệu PLAN trong repo và attachment có cùng nội dung sau chuẩn hóa xuống dòng; raw SHA khác do LF/CRLF. File người dùng được giữ nguyên.
- Thay đổi chưa commit/push. Không gửi email thật, nhập dữ liệu thật, deploy, ghi tiền hoặc xuất kho.

## Trạng thái QA và tiếp tục

Server QA localhost:4320 đã dừng sau kiểm thử để build. Các cơ sở dữ liệu QA a/b/c và báo cáo vẫn được giữ. Không mở cùng thư mục PGlite từ Next và CLI/worker đồng thời.

Để xem lại dữ liệu giả c trong PowerShell tại repo, chạy:

```powershell
$env:CRM_LOCAL_DATA_DIR='.local/crm-qa-upgrade-ui-20260919-c'
node scripts/crm/start-upgrade-qa.mjs
```

Server này chỉ dùng LOCAL/PGlite, catalog QA và mailbox giả lập. Không dùng launcher QA cho staging hoặc production. Đăng ký tại /portal/register; đăng nhập nhân sự tại /crm/login; tài khoản fixture dành riêng cho QA.

Các đầu vào đang thiếu: Brevo API key cấu hình ở môi trường server, sender đã xác thực và người nhận kiểm thử được chỉ định; PostgreSQL staging để chứng minh multi-connection/concurrency; chính sách D04–D11 và backup/restore D13. Chưa kiểm chứng worker được supervisor khôi phục trên PostgreSQL, restore độc lập hoặc candidate cutover/rollback. Source của các ID còn lại vẫn có thể phát triển độc lập với fixture được ghi nhãn; việc thiếu chính sách không phải bằng chứng đã hoàn thành thương mại.
