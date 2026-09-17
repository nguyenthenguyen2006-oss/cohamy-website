# Cohamy Headless Bridge 2.0.9

System cron restores a missing native `publish_future_post` event for an
overdue future post/page before running WordPress cron. It scans at most 100
rows under a lease; WordPress performs publication and its timestamp/status
checks. This repairs a lost WP-Cron option event without modifying core.

Plugin riêng cho WordPress Cohamy; không sửa WordPress core hoặc Rank Math. Yêu cầu Rank Math Free active (local tested1.0.278), WordPress7.1/PHP8.2+, MariaDB10.6+/MySQL8+ khi triển khai VPS. SQLite Integration3.0.2 dùng database local QA thật, không thay test MariaDB staging.

Cài toàn bộ thư mục hoặc ZIP tạo bằng `scripts/wordpress/package-bridge.ps1`. Kích hoạt Rank Math trước Bridge. Env/wp-config, HTTPS, roles, native cron và Action Scheduler CLI nằm trong `docs/CMS-DEPLOY.md`. Menu **Vận hành Cohamy** lưu dữ liệu server, không dùng browser làm database/job authority. Hướng dẫn nhân viên: `docs/content-upgrade/STAFF.md`; kết quả: `PROGRESS.md`/`FEATURE-MATRIX.md`.

## Source

- Entry/admin/editor/identity/rest/atomic-rest/webhooks/import: data contract23legacy fields, native Gutenberg/meta/taxonomy/media, unique locale+slug/group, short actor-bound Next preview, full-save HMAC outbox và CSV23 draft-default.
- operations/campaigns/maintenance:15bảng vận hành, versioned approved records/templates, global identity site/base/subject/location, Native Action Scheduler checkpoint/retry/quota VN/lease CAS/repair/health, rollback không ghi đè human changes.
- editorial/analysis/links: server paging/filter/quick-bulk CAS/duplicate, native Rank Math JS engine pinned/HMAC worker, native FREE links/pillar/orphan, real public HTML/robots inspector.
- data-transfer/transfer-preview: mapped CSV/JSON create/upsert; >250row AS validation/cross-batch identity trước ghi, explicit confirmation, captured capabilities/row results, batch writes10.
- distribution/indexnow-selection: incremental sitemap inventory/shards; redirect301/302/307/308/410 loop guards +404path-only; selected/frozen TXTCSV6metadata/privateZIP10k+SHA; single IndexNow sender fixed protocol/deleted+updated/dedup/retry.
- connections/ai-jobs: official GSC service account/RS256/quota/results; optional fixed HTTPS AI endpoints, sourced approved facts, private AS job/3retry/usage reservation/preview/CAS, FAQ append/advisory links/near-duplicate review.
- operations-*-screen + operations.js: native WordPress admin forms, nonce/caps, stored jobs/pagination/errors/preview/confirmation/status/audit.

Public endpoint chỉ published/due/password-empty; SEO minimum normalized fields được resolve bởi native Rank Math. Frontend Next.js phát canonical/metadata/schema/sitemap duy nhất, không render nguyên getHead, không index CMS copy. Provider credential chỉ server; không tự bật LIVE IndexNow, kết nối GSC hoặc dùng AI paid. PHP input validation, HTML sanitizer, no arbitrary provider/source fetching, redirects constrained same public host. Old cover URLs giữ nguyên; không tự tải ảnh từ URL.

Local setup/archive/credential/cache/db/export ở `.local` là private, không đóng gói. Vendor engine assets/license nằm riêng `wordpress/rank-math-analysis`, giữ hash và phiên bản; phải refresh/retest sau upgrade WP/RM. Product catalog snapshot chỉ tham chiếu mã sản phẩm cho bài, không thay nguồn sản phẩm; contact Google Sheets vẫn giữ nguyên.
