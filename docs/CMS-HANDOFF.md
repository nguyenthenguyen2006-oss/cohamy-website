# Bàn giao blog Cohamy WordPress headless

Đọc [kết quả test](headless/TEST-RESULTS.md),
[audit/hợp đồng](headless/AUDIT-CONTRACT.md),
[hướng dẫn nhân viên](headless/STAFF-GUIDE.md),
[triển khai](CMS-DEPLOY.md), [migration/rollback](headless/MIGRATION-ROLLBACK.md).

Plugin: `wordpress/cohamy-headless-bridge`. Env/Compose: `.env.example`,
`wordpress/.env.example`, `wordpress/compose.yaml`. Mẫu VPS: `deploy/`.
Setup/router/cron: `scripts/wordpress/`. Migration:
`scripts/migrate-wordpress-blog.ts`. E2E: `scripts/verify-wordpress-e2e.ts`.

Local dùng WordPress/Rank Math thật, DB riêng. Chưa thay DNS hoặc chuyển
production. Thiếu credential để đọc Sheets thật; source static có 8 nhóm ×
5 locale. Backup source đầu phiên ở `.local/source-before-headless.zip`.
Repo không có `.git`; không thể kiểm chứng diff/commit bằng Git trong phiên này.


Nâng cấp vận hành theo hai attachment đã triển khai thêm: native pages, records/templates có version/approval, campaign Action Scheduler/quota/checkpoint/rollback, server search/quick edit, durable CSV/JSON mapping preview, frozen URL export, sitemap shards, redirect404, real Rank Math engine/links, HTML/robots inspector và optional IndexNow/GSC/AI connectors. Đọc [bảng trước/sau](../FEATURE-MATRIX.md), [PROGRESS và scope kiểm thử](../PROGRESS.md), [hướng dẫn mới](content-upgrade/STAFF.md). Bằng chứng provider CONTRACT MOCK không phải LIVE; production/Google index/AI paid chưa chạy.

Source/dependency CRM/portal/orders của tác vụ đồng thời được giữ. Không dùng database hay tài khoản HumanBank. Sản phẩm/contact source giữ SHA; blog chỉ có WordPress writer khi được chọn. Next.js đã vá lên 16.3.5, sharp 0.35.4, eslint-config-next 16.3.5; build riêng `.local/next-headless` tránh thay `.next` của tác vụ khác. Báo cáo audit còn 34 cảnh báo, 0 critical sau bản vá; review dependency còn lại trước production.
