# Cohamy — báo cáo kiểm thử F001–F140

Cập nhật 2026-09-19T03:45:00.126Z. **PASS 268/268 ca có cấu trúc** trong 32 báo cáo bắt buộc. Ngoài các ca này, `npm run typecheck`, ESLint mục tiêu và `npm run build` đã đạt; build trace chứa đủ migration 001–025 và không đóng gói database/ảnh QA.

| Báo cáo | Ca PASS | Môi trường | Thời điểm |
|---|---:|---|---|
| [access-local.json](./test-results/access-local.json) | 21 | LOCAL | 2026-09-19T03:22:28.835Z |
| [work-local.json](./test-results/work-local.json) | 21 | LOCAL PGlite isolated fixtures | 2026-09-19T03:19:49.516Z |
| [upgrade-local.json](./test-results/upgrade-local.json) | 18 | LOCAL isolated PGlite, fictitious data | 2026-09-19T03:19:53.346Z |
| [data-jobs-local.json](./test-results/data-jobs-local.json) | 8 | LOCAL isolated PGlite and actual XLSX parsing | 2026-09-19T03:20:52.270Z |
| [portal-services-local.json](./test-results/portal-services-local.json) | 5 | LOCAL isolated fictitious PGlite | 2026-09-19T03:44:44.284Z |
| [partner-library-local.json](./test-results/partner-library-local.json) | 6 | LOCAL isolated fictitious PGlite; policy bytes synthetic | 2026-09-19T03:44:45.191Z |
| [relationships-local.json](./test-results/relationships-local.json) | 6 | LOCAL isolated fictitious PGlite | 2026-09-19T03:44:41.633Z |
| [care-automation-local.json](./test-results/care-automation-local.json) | 14 | LOCAL isolated PGlite; fictitious users, no live delivery or business postings | 2026-09-18T21:10:34.492Z |
| [partner-merge-local.json](./test-results/partner-merge-local.json) | 10 | LOCAL isolated PGlite; fictitious businesses and explicitly fake closed balance fixture | 2026-09-19T03:21:12.649Z |
| [governance-local.json](./test-results/governance-local.json) | 12 | LOCAL | Không ghi trong report cũ |
| [decimal-local.json](./test-results/decimal-local.json) | 6 | LOCAL deterministic pure arithmetic; no database or commercial posting | 2026-09-19T03:21:09.978Z |
| [pricing-model-local.json](./test-results/pricing-model-local.json) | 10 | LOCAL pure exact price model; fictitious rates only, no production policy or posting | 2026-09-19T03:21:12.934Z |
| [pricing-local.json](./test-results/pricing-local.json) | 8 | LOCAL isolated PGlite; fictitious published policies only | 2026-09-19T03:21:37.964Z |
| [quotations-local.json](./test-results/quotations-local.json) | 10 | LOCAL isolated PGlite; fictitious quotes, no real customer sends | 2026-09-19T03:21:33.814Z |
| [quotation-pdf-local.json](./test-results/quotation-pdf-local.json) | 2 | LOCAL actual PDFKit output, Poppler rendering and pypdf text; fictitious immutable source/stress fixture | 2026-09-18T22:40:53.030Z |
| [request-excel-local.json](./test-results/request-excel-local.json) | 9 | LOCAL isolated fictitious PGlite | 2026-09-19T03:21:37.923Z |
| [commercial-orders-local.json](./test-results/commercial-orders-local.json) | 15 | LOCAL isolated fictitious PGlite; no real order/stock/money/provider mutation | 2026-09-19T03:21:41.037Z |
| [inventory-local.json](./test-results/inventory-local.json) | 8 | LOCAL isolated fictitious PGlite; no real stock/order/provider mutation | 2026-09-19T03:22:06.001Z |
| [fulfillment-local.json](./test-results/fulfillment-local.json) | 8 | LOCAL isolated fictitious PGlite; no real delivery/stock/money/provider mutation | 2026-09-19T03:22:03.139Z |
| [finance-local.json](./test-results/finance-local.json) | 9 | LOCAL isolated fictitious PGlite; no real money/order/provider mutation | 2026-09-19T03:22:03.669Z |
| [procurement-local.json](./test-results/procurement-local.json) | 8 | LOCAL isolated fictitious PGlite; no real supplier/stock/money/provider mutation | 2026-09-19T03:22:00.222Z |
| [consignment-local.json](./test-results/consignment-local.json) | 8 | LOCAL isolated fictitious PGlite; no real stock/money/provider mutation | 2026-09-19T03:22:04.557Z |
| [security-local.json](./test-results/security-local.json) | 5 | LOCAL isolated fictitious PGlite; Brevo disabled and no real account/email mutation | 2026-09-19T03:22:31.948Z |
| [reports-local.json](./test-results/reports-local.json) | 8 | LOCAL isolated fictitious PGlite; no real customer/order/stock/money/provider mutation | 2026-09-19T03:22:26.697Z |
| [pwa-local.json](./test-results/pwa-local.json) | 4 | LOCAL static and isolated service-worker harness | 2026-09-19T03:31:30.087Z |
| [samples-local.json](./test-results/samples-local.json) | 8 | LOCAL isolated fictitious PGlite; no real stock/order/provider mutation | 2026-09-19T03:40:53.389Z |
| [samples-browser-local.json](./test-results/samples-browser-local.json) | 4 | LOCAL actual Edge/Next with isolated fictitious PGlite; no real stock, recipient or provider send | 2026-09-19T03:30:00.634Z |
| [browser-140-local.json](./test-results/browser-140-local.json) | 5 | LOCAL actual Edge/Next, isolated fictitious PGlite; every authorized module root at desktop/mobile | 2026-09-19T03:37:28.146Z |
| [backup-guards-local.json](./test-results/backup-guards-local.json) | 3 | LOCAL | 2026-09-19T03:31:35.623Z |
| [public-files-backup-local.json](./test-results/public-files-backup-local.json) | 3 | LOCAL isolated public-file fixture | 2026-09-19T03:31:32.080Z |
| [build-traces-local.json](./test-results/build-traces-local.json) | 3 | LOCAL | 2026-09-19T03:42:49.409Z |
| [worker-restart-local.json](./test-results/worker-restart-local.json) | 3 | LOCAL actual Node child termination/restart, isolated PGlite, fictitious import; lease expiry advanced by guarded fixture | 2026-09-19T03:31:45.691Z |

## Phạm vi bằng chứng

- LOCAL/PGlite xác nhận transaction, scope, idempotency, version conflict, ledger và trạng thái lỗi bằng dữ liệu hư cấu.
- Edge/Next thực xác nhận các luồng UI đại diện ở desktop 1366 px và mobile 390/320 px; F030 có bộ ảnh riêng trong `.impeccable/review/samples`.
- Các bộ PostgreSQL biệt lập trước đó xác nhận tranh chấp ở pricing, order, governance, inventory/care và worker. Phát hành production phải tiếp tục chạy migration, readiness, SHA, smoke read-only và backup checksum.
- Không có email/SMS, callback carrier, giao dịch tiền, tồn hoặc đơn thật nào được tạo trong QA. Việc chưa có secret production là trạng thái cấu hình ngoài code, không được thay bằng dữ liệu giả.
