# Tiến độ và bàn giao Cohamy

Chốt ngày 18/09/2026, giờ Việt Nam. Đã triển khai source Next.js và plugin
Cohamy Headless Bridge, chạy WordPress, Gutenberg, Rank Math Free và Action
Scheduler thật trên database local riêng. Nội dung lưu được trong WordPress
và phản ánh trên HTML/XML frontend local. Chưa thay DNS/chuyển production,
không dùng CMS HumanBank, không mua plugin hoặc gọi AI trả phí.

## Audit và phần giữ nguyên

Đã đọc đầy đủ hai attachment, AGENTS.md, code và tài liệu Next.js cài trong
node_modules trước sửa; sau security patch đã đọc lại docs 16.3.5. Đã kiểm
Gutenberg/Rank Math và frontend desktop/mobile bằng Chrome thật. Feature audit
trước/sau nằm trong [FEATURE-MATRIX](FEATURE-MATRIX.md).

Nguồn legacy có 40 dòng tĩnh, 8 nhóm × 5 locale. Chưa có credential để audit
Google Sheets blog production. Default locale **en**, localePrefix always và
URL /vi/bai-viet, /en/zh/ko/ja/blog giữ theo cấu hình hiện tại. Public slug
độc lập post_name WordPress; locale+slug và group+locale là UNIQUE.

Repo không có .git. Backup đầu phiên: .local/source-before-headless.zip.
Đối chiếu SHA chứng minh 5 path sản phẩm/contact không đổi; 156 file cũ giữ
nguyên. app/sitemap.ts được thay bằng sitemap index/shards. Source CRM,
portal, orders, commerce, env và dependencies của tác vụ đồng thời được giữ.
Test blog không chứng minh nghiệp vụ CRM hoặc contact submission LIVE.

## Phần đã triển khai

- WordPress là nơi viết khi BLOG_SOURCE=wordpress; API ghi cũ 410, admin cũ
  dẫn wp-admin; không trộn nguồn hoặc fallback sang bài cũ khi CMS lỗi.
- Adapter có validation/timeout/error; chỉ public bài đã xuất bản, không
  password, đã đến giờ. Draft/private/pending/trash/future không lộ.
- Gutenberg, taxonomy, ảnh/ALT, related products, bản dịch, duyệt bài, lịch
  đăng và preview giao diện Next.js thật; token actor-bound 300 giây,
  HttpOnly, private/no-cache/noindex. Block allowlist, sanitizer, CSS/TOC.
- Rank Math resolve SEO templates; Next.js render metadata/social/schema/
  canonical/sitemap duy nhất. Canonical public tự tham chiếu; noindex CMS
  không truyền sang bài. Focus keywords/score/analysis chỉ qua ops có quyền.
- HMAC webhook có timestamp/replay/outbox/retry sau full-save. Cache key theo
  revision, đọc revision mỗi request làm dự phòng mất webhook và đồng bộ
  nội dung giữa instance. CMS/DB lỗi trả 503, không false404/sitemap rỗng.
- Native pages; approved records có nguồn/ngày/hạn; templates immutable base,
  version/history/CAS; campaigns AS có UNIQUE toàn cục, quota ngày VN,
  concurrency/checkpoint/retry/repair/pause/stop/resume; dashboard và rollback.
- Quick/bulk edit, duplicate; CSV23/JSON/mapping, preview trước ghi, import
  lớn AS, draft mặc định và reimport; frozen TXT/CSV URL exports ZIP/SHA.
- Sitemap inventory/shards, redirect 301/302/307/308/410 và 404 aggregate;
  native Rank Math score/link tables, HTML/robots inspector; optional
  IndexNow/GSC/AI connectors có quyền, preview, durable jobs và audit.

## Môi trường local

| Thành phần | Đã chạy |
|---|---|
| Next.js / sharp / ESLint config | 16.3.5 / 0.35.4 / 16.3.5 |
| WordPress / Rank Math Free / bridge | 7.1 / 1.0.278 / 2.0.9 |
| PHP / Node | 8.2.31 / 24.19.0 |
| Database | SQLite Integration 3.0.2 chính thức |
| Cron | PHP CLI mỗi 2 giây, native events + Action Scheduler |
| Timezone | Asia/Ho_Chi_Minh, API/metadata/sitemap UTC |
| Frontend | http://127.0.0.1:3001/vi/bai-viet |
| WordPress admin | http://127.0.0.1:8081/wp-admin/ |
| Build riêng | .local/next-headless; giữ .next của tác vụ khác |

Phiên hiện tại: Next PID 38656, CMS PID 36360, harness 30708,
build 5CuZsCRQV0qILSzmZCUi2. Runtime/watchdog ở .local/runtime.json; supervisor cần tiếp
tục chạy. Credential local ở .local/credentials.json và secrets.json, không
đưa vào báo cáo/bundle hoặc dùng production. Canonical https://cohamy.vn là
cấu hình dự kiến; HTTP200/HTML/XML được kiểm tại **frontend local**.

## Kết quả kiểm thử

| Bộ kiểm | Kết quả đã chạy | Report |
|---|---|---|
| 17 yêu cầu blog + 3 regression | **20/20 PASS**, cùng Next PID/build cuối | headless/test-results/e2e-latest.json |
| Mất cron event có chủ đích | **2/2 PASS**, future không publish sớm, cron phục hồi/publish không HTTP CMS | headless/test-results/schedule-latest.json |
| Pending campaign qua PHP CMS restart | **PASS: 6 pending tồn tại, 6 publish đúng lịch, rerun 0**, cùng Next | content-upgrade/test-results/cms-restart.json |
| Ngắt TCP CMS thật | **3/3 PASS**, detail/list/sitemap 503 → 200, Next không restart | headless/test-results/tcp-disconnect.json |
| Native pages/SEO/social/sitemap/private score | 6/6 PASS, build cuối | public.json |
| Campaign 2 template × 3 location/gates/caps | 7/7 PASS, 6 published, rerun 0 | backend.json |
| References/inspector/links/redirect/404 | 6/6 PASS, SQL/HTTP thật | advanced.json |
| CSV/JSON/quick CAS/duplicate | 4/4 PASS | editorial.json |
| Pause/resume/quota/retry/repair/rollback | 5/5 PASS; rollover/stale lease là controlled fixtures | queue.json |
| Native UI đóng trước giờ worker | PASS: queued 2/ID 0 khi đóng, tạo/public 2 sau đó, HTML/XML | browser-closedtab.json |
| Preview/import 301 dòng | 2/2 PASS: 300 valid + 1 lỗi; preview chưa ghi, confirm 300 draft, reconfirm 409 | large-import.json |
| Frozen URL export 10.001 | PASS: unique, chia 10.000+1, SHA/frozen khi mutation | export.json |
| Selected ID CSV / duplicate review | 2/2 PASS: 2 URL/6 metadata, invalid ID 400; overlap advisory | selection.json |
| Rollback 101 bài | PASS: 100 draft, 1 human edit giữ nguyên | rollback.json |
| Dashboard/IndexNow selection/robots/CSV | 6/6 PASS local, không submit LIVE | enhancements.json |
| Provider contracts | 5/5 PASS **CONTRACT MOCK ONLY**, 0 provider LIVE requests | providers.json |
| Gutenberg/lost webhook/migration/backup | 5/5 PASS, restored copy 45 tables + 40 media khớp | headless/test-results/operations-latest.json |
| Chrome desktop/mobile | PASS 1280×900/430×900, ảnh tải/canonical 1; UI save/reload và export 2 URL completed | browser-upgrade.json + screenshots |
| Chrome trên build cuối | PASS, marker Gutenberg/canonical 1/index follow và ops đọc dữ liệu đã lưu | browser-final.json |
| Migration legacy 40 dòng | dry-run/apply/rerun PASS: 40 matched, 0 mismatch, 40 unchanged skipped | headless/test-results/migration-latest.json |
| Lint/TSC/build/CMS/contract/native engine/PHP | PASS: build 117 routes; 22 plugin PHP files; engine locale papers | tool outputs/php-lint.json |
| Client/source/package | PASS: 83 client files, 0 known credential leaks, 27 installed files khớp, ZIP/SHA | headless/test-results/release-latest.json/bridge-package.json |

Paths trong bảng bắt đầu bằng headless/ hoặc content-upgrade/ nằm dưới docs/;
report tên ngắn nằm trong docs/content-upgrade/test-results/. Report giữ
build, thời gian và scope gốc. Các lượt kiểm trên build/version trước vẫn
được ghi đúng, không gán lại cho build cuối. Handoff JSON tổng hợp từ report
đã PASS, không sửa dữ liệu gốc.

Điểm 59 trong Gutenberg và 20 của worker thuộc fixture khác nhau; đều native
engine. N/A khác điểm 0. Điểm SEO/accepted200 không cam kết index/thứ hạng.
Benchmark SQLite trên i9-14900HX/32 logical/16 GB: preview 301 dòng 15,026 s,
ghi 300 draft records 76,700 s, export 10.001 URL 24,659 s, rollback 101 bài
23,246 s. Tạo 10.001 fixture posts mất 231,57 s/48 MB; không phải campaign
throughput, P95 VPS hoặc khả năng 281.000 bài.

## Lỗi tìm thấy và đã xử lý

E2E đầu phát hiện post 10959 future sau giờ đăng, native cron event bị mất.
Có ghi đồng thời, chưa trace writer chính xác. Bridge 2.0.9 phục hồi event
cho bài đã đến hạn trước cron, tối đa 100/lượt; native WordPress vẫn kiểm
status/time và xuất bản. Report lỗi giữ tại e2e-lost-event-failed.json; full20
và regression mất event2 đã PASS sau sửa.

Restart test đầu bị build chạy chồng làm mất BUILD_ID, giữ report FAIL trong
cms-restart-invalid.json. Đã thêm shared QA lock cho headless build/E2E/
restart/TCP và chạy lại tuần tự; test restart6 đã PASS. Không tính lượt lỗi
thành PASS. PHP restart/pause cron không phải OS reboot hoặc hard-kill trong
transaction; rollover fixture không phải test qua đêm.

Detector giao diện chạy đúng một lần, 3 advisory có disposition trong
design-review.json. Giữ semantic blockquote và CRM grid của tác vụ khác.
Hai lượt polish sửa overflow label admin/chuỗi dài bài. Console errors quan
sát thuộc extension onboarding, không app source.

## Điều kiện còn thiếu

- NOT RUN: VPS/MariaDB/Docker/DNS/HTTPS/Nginx/systemd/CDN/multi-instance/shared
  replay/SMTP/full-server restore/load production. WP 7.1.1 available chưa
  upgrade; upgrade WP/RM cần refresh engine assets/pins/license và QA.
- NOT RUN: Google Sheets blog production audit/migration/rollback delta,
  contact submission LIVE; giữ source và dữ liệu cũ.
- NOT RUN: GSC property/service account, IndexNow key public/LIVE permission,
  AI provider/model/budget/cost thật. CONTRACT MOCK không phải LIVE metrics/
  index/cost; không mua PRO/Content AI hãng hoặc dùng Indexing API cho blog.
- NOT RUN: chooser UI qua Chrome connector bị chặn file URL permission; đã
  hướng dẫn Allow access to file URLs. Multipart/parser/preview/batch chạy
  thật. Microsoft Excel GUI tại máy mục tiêu chưa kiểm.
- NOT RUN: OS/VPS reboot, hard-kill worker giữa transaction, overnight quota.
- Security audit 36 → **34 còn lại: 0 critical, 5 high, 29 moderate** sau vá
  Next/sharp. Review/fix/retest dependency còn lại trước production; không
  chạy bulk force fix ảnh hưởng phần dùng chung.

## Chạy lại và bàn giao

[Nhân viên](docs/content-upgrade/STAFF.md), [VPS](docs/CMS-DEPLOY.md),
[migration/rollback](docs/headless/MIGRATION-ROLLBACK.md),
[kết quả](docs/headless/TEST-RESULTS.md),
[handoff JSON](docs/content-upgrade/test-results/handoff-latest.json).
Source Next/plugin/vendor engine/license/env không chứa secret, local setup,
Compose/Nginx/systemd/backup/migration scripts đều có trong repo. Gói plugin
installable và SHA ở bridge-package.json. Không deploy test database/fixtures.

```powershell
npm install
npm run headless:setup
npm run headless:build
npm run headless:local -- --production
# Terminal khác: đóng CMS/preview và monitor HTTP trước cron E2E.
npm run test:headless
npm run test:headless:schedule -- --lose-schedule-event
npm run test:upgrade:public
npm run test:upgrade:advanced
npm run test:upgrade:editorial
npm run test:upgrade:large-import
npm run test:upgrade:export
npm run test:upgrade:queue
npm run test:upgrade:providers
npm run test:upgrade:selection
node scripts/verify-upgrade-cms-restart.mjs
node scripts/verify-wordpress-disconnect.mjs
npm run blog:migrate -- --source legacy --local
npm run blog:migrate -- --source legacy --local --apply
```

Chạy tuần tự build/mutation. Helpers restart/TCP giữ CMS replacement trong
supervisor và tự tắt khi own harness/Next dừng. Không kill toàn bộ Node/PHP.
Trước cutover cần quyền VPS/topology/domains/cert/database/storage/backup,
cron monitor/CDN/replay policy, Sheet snapshot read-only, editorial owner/
roles/secrets riêng, MariaDB/staging/full restore QA, optional credentials
và phê duyệt LIVE/cutover. Freeze single writer, migration/reconcile trước.
Rollback sau cutover phải giữ/export WordPress delta bài mới/sửa/trạng thái/
ảnh/slug redirect và có người duyệt; không xóa Sheet hoặc database WordPress.
