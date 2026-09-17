# Kết quả kiểm thử Cohamy local

Chốt ngày 18/09/2026, giờ Việt Nam. Next.js, WordPress, Gutenberg, Rank Math
Free và Action Scheduler chạy thật trên database QA riêng. Nội dung được lưu
trong WordPress và kiểm bằng HTTP/HTML/XML của frontend local. Chưa chuyển
production, thay DNS hoặc dùng tài khoản/dữ liệu HumanBank.

## Môi trường

| Thành phần | Đã chạy |
|---|---|
| Next.js / sharp | 16.3.5 / 0.35.4, next start, port 3001 |
| WordPress / Rank Math Free / bridge | 7.1 / 1.0.278 / 2.0.9 |
| PHP / Node | 8.2.31 / 24.19.0 |
| Database | SQLite Database Integration 3.0.2 chính thức |
| Timezone | Asia/Ho_Chi_Minh; API, sitemap và metadata chuẩn hóa UTC |
| Cron | PHP CLI độc lập mỗi 2 giây, native events và Action Scheduler |
| Nguồn | BLOG_SOURCE=wordpress; sản phẩm và contact giữ nguồn cũ |
| Build riêng | .local/next-headless, không thay .next của tác vụ khác |

Frontend: <http://127.0.0.1:3001/vi/bai-viet>.
WordPress: <http://127.0.0.1:8081/wp-admin/>.
Credential local chỉ nằm trong .local/credentials.json và secrets.json.
Supervisor phải tiếp tục chạy để giữ dịch vụ local. Canonical
https://cohamy.vn là cấu hình dự kiến; HTTP được kiểm trên frontend local,
không phải domain production.

## Chuỗi blog bắt buộc: 20/20 PASS

[Report gốc](test-results/e2e-latest.json) ghi build
5CuZsCRQV0qILSzmZCUi2, Next PID **38656**. Script đối chiếu BUILD_ID, runtime
và số lần Next báo Ready: không restart/build/deploy giữa các thao tác.

Các bước đã chạy: làm nóng cache nháp; xuất bản native WordPress; URL 200 và
nội dung thật; đúng một canonical public; bài indexable không có noindex;
danh sách có anchor trong SSR; sitemap và lastModified UTC; sửa nội dung,
Rank Math template SEO và ảnh mới; gỡ xuất bản; chặn các trạng thái không
public; đăng đến lịch không có HTTP vào WordPress; cùng slug ở 5 locale và
uniqueness; tải CSV 23 cột rồi import/reimport; HMAC sai/hết hạn/replay;
quyền và preview Next.js thật; CMS 503 không thành 404 hoặc sitemap rỗng;
cùng Next process/build; đổi slug 301/chống vòng lặp; CMS noindex/API ghi
cũ 410; Gutenberg và sanitizer.

CSV thực tế kiểm BOM UTF-8, `sep=;`, đủ 23 cột, delimiter `;` và `,`, dấu nháy,
HTML, xuống dòng, draft mặc định, lỗi từng dòng và nhiều batch. Parser đã
chạy; Microsoft Excel GUI tại máy mục tiêu chưa chạy.

## Kiểm thử bổ sung

Các report giữ build, thời gian và scope gốc. Không gán report/screenshot cũ
cho build mới. Report nâng cấp ở [content-upgrade/test-results](../content-upgrade/test-results/).

| Bộ kiểm | Kết quả / bằng chứng |
|---|---|
| Public pages/SEO/social/sitemap/private analysis | 6/6 PASS, public.json; build cuối; phân tích chỉ qua ops có quyền |
| Campaign 2 template × 3 location | 7/7 PASS, backend.json; 6 bài xuất bản, chạy lại tạo 0 |
| Records/HTML inspector/links/redirect/404 | 6/6 PASS, advanced.json; SQL/HTTP thật |
| Quick edit, duplicate, mapped CSV/JSON | 4/4 PASS, editorial.json; CAS giữ chỉnh sửa mới |
| Pause/resume/quota/retry/repair/rollback | 5/5 PASS, queue.json; rollover ngày và stale lease là fixture điều khiển |
| Đóng tab trước khi worker chạy | PASS, browser-closedtab.json; queued 2, ID 0 khi đóng; tạo/xuất bản 2 sau đó |
| Campaign pending qua restart CMS | PASS, cms-restart.json; 6 pending tồn tại qua PHP restart, 6 publish đúng lịch, rerun 0; cùng Next PID/build |
| Mất sự kiện cron native | 2/2 PASS, schedule-latest.json; xóa event có chủ đích, cron phục hồi/publish không HTTP CMS |
| Ngắt TCP CMS thật | 3/3 PASS, tcp-disconnect.json; build cuối; detail/list/sitemap 503 → 200, Next không restart |
| Import lớn | 2/2 PASS, large-import.json; 301 dòng preview chưa ghi, 300 valid + 1 lỗi; xác nhận ghi 300 draft; xác nhận lại 409 |
| Frozen export | PASS, export.json; 10.001 unique, chia 10.000 + 1, ZIP/SHA; frozen dù đổi/gỡ/thêm bài |
| Export selected IDs / duplicate review | 2/2 PASS, selection.json; 2 URL và 6 cột metadata; ID sai bị từ chối |
| Rollback lớn | PASS, rollback.json; 101 bài, 100 về draft, 1 human edit giữ nguyên |
| Dashboard/IndexNow selection/robots/CSV | 6/6 PASS, enhancements.json; không gửi LIVE |
| IndexNow/GSC/AI provider contracts | 5/5 PASS CONTRACT MOCK, providers.json; 0 external LIVE requests |
| Gutenberg/lost webhook/migration/backup | 5/5 PASS, operations-latest.json; restore bản copy 45 tables + 40 media khớp |
| Chrome desktop/mobile | PASS, browser-upgrade.json; 1280×900/430×900, ảnh tải, canonical 1; UI save/reload record và export 2 URL |
| Chrome trên build cuối | PASS, browser-final.json; marker Gutenberg, canonical 1/index follow; ops đọc record server mới |
| Migration legacy | 40 matched, 0 mismatch, 40 unchanged skipped; dry-run/apply/rerun; migration-latest.json |

Gutenberg hiển thị điểm Rank Math 59 và worker native engine cho fixture khác
ra 20. Bài chưa phân tích là N/A, không giả điểm 0. Điểm SEO không cam kết
Google index/thứ hạng. CONTRACT MOCK không chứng minh số liệu Search Console,
chi phí AI hoặc indexing thật.

## Kiểm tra code và tính toàn vẹn

Lint, TypeScript, build, CMS tests, hợp đồng headless, native Rank Math engine
và PHP/plugin syntax đã chạy đạt. Build có 117 route, gồm route CRM/commerce
của tác vụ đồng thời; build không chứng minh nghiệp vụ CRM. Có 22 PHP plugin
files. Release scan và ZIP manifest ở
[release-latest.json](test-results/release-latest.json),
[bridge-package.json](test-results/bridge-package.json).

[Preserved-source](test-results/preserved-source.json) chứng minh 5 path
sản phẩm/contact không đổi byte so với backup đầu phiên. Repo không có .git.
Source CRM/portal/orders/layout của tác vụ khác được giữ; không quy tất cả
file thay đổi cho migration. Không xóa Google Sheets hoặc dữ liệu cũ.

Detector giao diện chạy một lần, 3 advisory được review trong design-review.json.
Giữ semantic blockquote và style CRM của tác vụ khác. Đã sửa overflow label
admin và chuỗi dài trong bài qua hai lượt polish.

## Lỗi phát hiện và giới hạn

Lượt E2E trước phát hiện post 10959 vẫn future sau giờ đăng, còn sự kiện
publish_future_post không tồn tại. Report lỗi giữ tại e2e-lost-event-failed.json.
Có thao tác ghi đồng thời; chưa trace chính xác writer làm mất event.
Bridge 2.0.9 khôi phục sự kiện native của bài đã đến hạn trước cron, tối đa
100 bài/lượt; WordPress vẫn kiểm trạng thái và giờ xuất bản.

Lượt restart campaign đầu bị build chạy chồng xóa BUILD_ID, report
cms-restart-invalid.json giữ trạng thái FAIL. Shared QA lock được thêm cho
headless build/E2E/restart/TCP; lượt chạy lại tách tuần tự. Restart PHP CMS và
pause/resume cron không phải OS/VPS reboot hoặc hard-kill worker giữa
transaction. Rollover quota fixture không phải thử qua đêm thực tế.

Benchmark local i9-14900HX, 32 logical processors, RAM 16 GB, SQLite:
preview 301 dòng 15,026 giây; ghi 300 draft records 76,700 giây; export 10.001
URL 24,659 giây; rollback 101 bài 23,246 giây. Tạo native fixture 10.001 bài
mất 231,57 giây/48 MB là tốc độ fixture importer, không phải campaign. Chưa
đo P95 VPS hoặc tải 281.000 bài.

NOT RUN: Docker/MariaDB/VPS/HTTPS/DNS/Nginx/systemd/CDN/multi-instance/shared
replay/SMTP/full-server restore; Sheets production migration/rollback delta;
contact submit LIVE; GSC Cohamy, IndexNow LIVE, AI provider LIVE/cost;
Rank Math PRO/Content AI hãng. Multipart/parser/batch đã chạy thật; Chrome
connector chọn file bị chặn quyền file URL, Excel GUI chưa chạy.

Đã vá Next.js/sharp; npm audit còn **34: 0 critical, 5 high, 29 moderate**.
Phải review/fix/retest dependency còn lại trước production. WP báo có 7.1.1;
local giữ 7.1 đã kiểm. Upgrade WP/RM cần refresh engine assets/version/hash/
license và QA. Bản local chưa phải production được nghiệm thu.

## Bàn giao và thông tin cần cung cấp

[Feature matrix](../../FEATURE-MATRIX.md), [PROGRESS](../../PROGRESS.md),
[nhân viên](../content-upgrade/STAFF.md), [VPS](../CMS-DEPLOY.md),
[migration/rollback](MIGRATION-ROLLBACK.md), [audit/contract](AUDIT-CONTRACT.md).

Trước cutover cần quyền VPS, topology, domain/certificate, database/storage,
backup/cron monitor và CDN/replay policy; snapshot Sheets read-only;
WordPress staging/roles/secrets riêng; full restore/MariaDB QA; provider
credentials nếu dùng; người duyệt và thời điểm freeze/cutover/rollback.
Sau cutover phải giữ/export delta WordPress trước rollback, đối chiếu bài
mới/sửa, trạng thái, ảnh và slug redirect; không đổi nguồn rồi bỏ delta.
