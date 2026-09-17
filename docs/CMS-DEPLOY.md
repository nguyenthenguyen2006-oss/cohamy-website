# Cohamy: triển khai WordPress headless

Blog chọn nguồn bằng `BLOG_SOURCE`: `sheets` (mặc định, rollback), `legacy`
(static trong repo) hoặc `wordpress`. Không trộn nguồn và không dual-write.
Khi chọn WordPress, API quản trị bài cũ trả 410 và `/admin` chuyển tới
WordPress `/wp-admin`. Nguồn sản phẩm và Google Sheets của form liên hệ giữ
nguyên. `cms.cohamy.vn` là địa chỉ dự kiến, chưa xác minh DNS/HTTPS/server.

## Local Windows đã chuẩn bị

Yêu cầu Node/npm có dependencies và PHP 8.2+ có thư mục extension.
Setup tạo php.ini riêng, không thay PHP của máy.

```powershell
npm run headless:setup
npm run headless:build
npm run headless:local -- --production
```

Giữ terminal cuối chạy. WordPress ở `http://127.0.0.1:8081/wp-admin/`,
Next.js ở `http://127.0.0.1:3001`. Database SQLite riêng dùng plugin SQLite
Database Integration chính thức; Rank Math miễn phí được cài và kích hoạt.
Cron PHP CLI độc lập chạy mỗi 2 giây. Canonical dùng `https://cohamy.vn`;
preview mở frontend local. Ctrl+C dừng các tiến trình của harness.

Tài khoản admin/người viết/người duyệt và Application Password nằm trong
`.local/credentials.json`, secret ở `.local/secrets.json`. Không commit hoặc
dùng credential local cho production. `.local` đã bị loại khỏi Git, lint và
TypeScript. Chạy setup lại để đồng bộ source plugin, giữ database có sẵn.

```powershell
npm run blog:migrate -- --source legacy --local
npm run blog:migrate -- --source legacy --local --apply
npm run test:headless
```

E2E chỉ dùng database QA local, không chạy với production. Report migration
ở `.headless-reports/migration`; E2E ở `docs/headless/test-results`.
Đóng tab CMS/preview và tắt monitor local khi chạy E2E: test cron kiểm access
log để xác minh không có HTTP tới WordPress trong thời gian chờ.

```powershell
npm run test:headless:contract
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/wordpress/package-bridge.ps1
php -c .local/php.ini scripts/wordpress/probe-local.php backup
```

ZIP bridge và checksum/manifest được tạo trong `.headless-reports/packages`
và `docs/headless/test-results/bridge-package.json`. Probe backup chỉ cho setup
local: snapshot SQLite nhất quán rồi mở bản backup để kiểm integrity/counts;
không chứng minh full restore WordPress/media trên VPS.

## VPS/staging với MariaDB

Local SQLite là WordPress thật, nhưng không thay kiểm thử MariaDB staging.
Docker không có trên máy này nên `wordpress/compose.yaml` chưa được chạy.
Bảng link native Rank Math đã được khởi tạo và kiểm thử đọc/ghi link thực tế
trên SQLite local, gồm link vào và orphan. MariaDB staging vẫn chưa chạy;
không sửa core hoặc vendor để né khác biệt SQL. Yêu cầu MariaDB 10.6+ hoặc
MySQL 8+ cho JSON và window functions của checkpoint/export/rollback.

Compose tách MariaDB, WordPress, WP-CLI và cron. Database không mở cổng host;
CMS bind loopback 8081. Pin image bằng phiên bản/digest đã kiểm thử trước
production; các tag mặc định trong mẫu còn là tag động.

```bash
cp wordpress/.env.example wordpress/.env
# Điền password DB, HMAC secret >= 32 ký tự, URL staging đã xác minh.
docker compose --env-file wordpress/.env -f wordpress/compose.yaml up -d db wordpress
# Hoàn tất cài WordPress và tạo admin riêng trong CMS staging.
docker compose --env-file wordpress/.env -f wordpress/compose.yaml --profile tools run --rm cli plugin install seo-by-rank-math --version=1.0.278 --activate
docker compose --env-file wordpress/.env -f wordpress/compose.yaml --profile tools run --rm cli plugin activate cohamy-headless-bridge
docker compose --env-file wordpress/.env -f wordpress/compose.yaml --profile tools run --rm cli option update timezone_string Asia/Ho_Chi_Minh
docker compose --env-file wordpress/.env -f wordpress/compose.yaml --profile tools run --rm cli option update permalink_structure '/%postname%/'
docker compose --env-file wordpress/.env -f wordpress/compose.yaml up -d cron
```

Không cần mua PRO/kết nối tài khoản Rank Math để dùng title/description,
focus keyword, robots và phân tích nội dung cơ bản. Content AI, analytics nâng
cao, theo dõi thứ hạng và chức năng PRO không nằm trong tích hợp này. Frontend
render Article/Breadcrumb; schema tùy chỉnh trong Rank Math không tự đưa sang
Next.js.

Cài trực tiếp PHP/WordPress thì kích hoạt plugin bridge trong repo, thêm vào
`wp-config.php` sau khi xác minh hạ tầng và được chấp thuận chuyển nguồn:

```php
define('WP_HOME', 'https://cms.cohamy.vn');
define('WP_SITEURL', WP_HOME);
define('COHAMY_PUBLIC_URL', 'https://cohamy.vn');
define('COHAMY_PREVIEW_URL', 'https://cohamy.vn');
define('COHAMY_WEBHOOK_URL', 'https://cohamy.vn/api/wordpress/webhook');
define('COHAMY_WEBHOOK_SECRET', getenv('COHAMY_WEBHOOK_SECRET'));
define('DISABLE_WP_CRON', true);
define('DISALLOW_FILE_EDIT', true);
```

`deploy/cms-nginx.conf.example` là mẫu reverse proxy HTTPS, không tạo DNS hoặc
certificate. WordPress phải nhận HTTPS từ proxy tin cậy nếu TLS kết thúc ở
proxy. Chuyển tiếp Authorization cho Application Password. Chặn PHP trong
uploads; không chặn toàn bộ media, REST, admin-ajax hoặc cron.

## Next.js và nhiều instance

```dotenv
NEXT_PUBLIC_SITE_URL=https://cohamy.vn
BLOG_SOURCE=wordpress
WORDPRESS_URL=https://cms.cohamy.vn
WORDPRESS_TIMEOUT_MS=8000
WORDPRESS_WEBHOOK_SECRET=<cùng secret với WordPress>
WORDPRESS_REPLAY_DIR=/var/lib/cohamy/webhook-replay
WORDPRESS_ALLOW_LOCAL_HTTP=false
```

Credential migration chỉ ở tiến trình migration; frontend không cần chúng.
Giữ `GOOGLE_SHEETS_WEBHOOK_URL` của form liên hệ. Source/env cần một lần build
và restart ban đầu; đăng/sửa/gỡ/đặt lịch sau đó không cần deploy.

Detail, list, homepage, sitemap render động. Mỗi server render đọc revision
CMS bằng `no-store`; snapshot cache theo revision. Request cũ chỉ có thể ghi
key cũ. Mọi instance đọc revision mới, không phụ thuộc webhook tới cùng process.
Snapshot TTL 300 giây không phải cửa sổ stale khi revision thay đổi.

Không cache `/revision`, `/snapshot`, `/resolve`, `/preview`, HTML bài, list,
homepage, sitemap hoặc 404 blog tại CDN/proxy bên ngoài. Client đang mở trang
phải refresh/điều hướng để thấy sửa; browser back/client router cache có thể
giữ màn hình cũ tới khi refresh. Không có push nội dung tới tab đang mở.

Các instance phải chung `WORDPRESS_REPLAY_DIR` trên filesystem hỗ trợ atomic
exclusive-create, hoặc thay bằng Redis/database trước khi chạy trên hạ tầng
không có shared volume. Marker processing trả 503 để retry; delivered trả 409.
Nếu process chết giữa invalidation, kiểm tra log và dọn marker processing của
event trong cửa sổ bảo trì khi không còn request đang xử lý. Revision vẫn giữ
độ mới của bài. Có thể dọn delivered cũ hơn một ngày; chữ ký quá 5 phút luôn
bị từ chối. Nhiều instance/shared volume chưa được kiểm thử thực tế.

## Cron, webhook, SEO và monitor

WordPress timezone `Asia/Ho_Chi_Minh`; REST/dữ liệu/sitemap chuẩn hóa UTC.
Cron headless chạy độc lập traffic mỗi phút:

```bash
wp --path=/var/www/cohamy-cms cron event run --due-now
wp --path=/var/www/cohamy-cms action-scheduler run --group=cohamy --batch-size=25 --batches=4
```

Dùng Compose hoặc `deploy/cohamy-wp-cron.*`, thay path/user và kiểm tra log.
Đặt lịch có độ trễ khoảng 0–60 giây cộng thời gian chạy job khi cron mỗi phút.

Bridge 2.0.9 kiểm các post/page native còn `future` nhưng đã đến giờ UTC.
Nếu sự kiện `publish_future_post` bị mất khi nhiều request ghi WP-Cron,
bridge khôi phục sự kiện trước lượt cron CLI; WordPress vẫn kiểm trạng thái
và thời gian trước xuất bản. Fallback giới hạn 100 bài mỗi lượt, có lease;
không xuất bản sớm. WP-CLI và DOING_CRON kích hoạt kiểm này, local CLI cũng
gọi trực tiếp. Theo dõi backlog khi có hơn 100 bài đến lịch cùng lúc.
Chu kỳ local 2 giây phục vụ test, không phải cam kết production.

Bridge tăng revision/ghi outbox cuối request sau post, taxonomy và meta. Event
có UUID/revision/IDs/URL cũ và mới, HMAC SHA-256 của `timestamp.body`. Next.js
kiểm chữ ký, timestamp lệch tối đa 300 giây, payload và replay. Retry tăng dần,
tối đa cách một giờ, không bỏ event lỗi. Xem Settings → Cohamy Headless và log
PHP. Đồng bộ NTP. Nếu mất webhook, request server kế tiếp vẫn đọc revision mới.

CMS lỗi: detail, list và sitemap trả 503, health 503; không sitemap rỗng hoặc
404 giả. Không có last-known-good sitemap tự động. Monitor cần kiểm tra
`/api/health`, PHP cron và outbox chờ/retry.

CMS không xuất sitemap; HTML CMS noindex hoặc 301 bài public sang frontend.
Next.js là nơi render canonical/OG/Twitter/Article/Breadcrumb và sitemap duy
nhất, không chèn getHead của Rank Math. Robots CMS không được truyền vào
robots_index public. Media URL hiển thị trực tiếp nên ảnh mới không cần thêm
hostname hay deploy Next.js.

## Backup và điều kiện cutover

Backup DB đầy đủ (post/meta/taxonomy/roles/redirects/outbox/options), uploads,
bridge, cấu hình phiên bản và build. Secrets lưu kho riêng. MariaDB dump cần
nhất quán và checksum; thử restore vào DB riêng rồi kiểm media, quyền, lịch.
Export bài không thay database backup. Không dùng backup SQLite cho MariaDB
bằng cách chép file; migration nội dung qua bridge hoặc công cụ DB phù hợp.

Mẫu backup **Bash trên VPS**, cần sửa đường dẫn/topology trước khi chạy; chưa
chạy trên máy Windows này. Freeze biên tập/upload trong lúc lấy DB và media để
hai bản khớp nhau. Credential nằm trong env container, không in ra terminal:

```bash
umask 077
backup_dir="/srv/cohamy-backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
docker compose --env-file wordpress/.env -f wordpress/compose.yaml exec -T db sh -c 'exec mariadb-dump --single-transaction --quick --routines --triggers --events --user="$MARIADB_USER" --password="$MARIADB_PASSWORD" "$MARIADB_DATABASE"' > "$backup_dir/database.sql"
docker compose --env-file wordpress/.env -f wordpress/compose.yaml --profile tools run --rm -T --entrypoint sh cli -c 'tar -czf - -C /var/www/html wp-content/uploads' > "$backup_dir/uploads.tar.gz"
tar -czf "$backup_dir/source-config.tar.gz" wordpress/cohamy-headless-bridge deploy package.json package-lock.json .env.example wordpress/.env.example docs
(cd "$backup_dir" && sha256sum database.sql uploads.tar.gz source-config.tar.gz > SHA256SUMS)
```

Lưu thêm phiên bản/image digest/build ID và env thực trong kho secrets riêng,
đưa backup ra nơi lưu trữ khác VPS theo retention đã thống nhất. Diễn tập
restore trên project/database/volume **riêng**; không import dump vào DB đang
phục vụ production. Chưa khởi động cron hoặc cho CMS restore gửi webhook ra
ngoài trước khi đổi URL/HMAC sang staging. Ví dụ sau khi chuẩn bị
`wordpress/restore.env`, port CMS khác, secret mới và project restore:

```bash
# Chạy từ thư mục backup để kiểm checksum, rồi trở lại root repo.
sha256sum -c SHA256SUMS
docker compose --project-name cohamy-restore --env-file wordpress/restore.env -f wordpress/compose.yaml up -d db
docker compose --project-name cohamy-restore --env-file wordpress/restore.env -f wordpress/compose.yaml exec -T db sh -c 'exec mariadb --user="$MARIADB_USER" --password="$MARIADB_PASSWORD" "$MARIADB_DATABASE"' < /path/to/backup/database.sql
docker compose --project-name cohamy-restore --env-file wordpress/restore.env -f wordpress/compose.yaml up -d wordpress
docker compose --project-name cohamy-restore --env-file wordpress/restore.env -f wordpress/compose.yaml --profile tools run --rm -T --entrypoint sh cli -c 'tar -xzf - -C /var/www/html' < /path/to/backup/uploads.tar.gz
```

Kiểm count/23 field/media/redirect/quyền/preview/SEO trước, sau đó mới bật cron
staging và chạy bộ E2E với endpoint staging thích hợp. Project restore phải
dùng volume mới; kiểm trước để tránh đè volume production.

Đọc [migration/rollback](headless/MIGRATION-ROLLBACK.md). Trước production cần:

- Quyền VPS, topology, runtime, process manager, proxy/CDN, số instance và
  shared replay volume.
- Xác minh domain CMS, HTTPS/certificate và đường truy cập; không tự đổi DNS.
- Sheet ID/tab/credential chỉ đọc để audit dữ liệu blog thật; đối chiếu cấu
  hình form liên hệ qua kho secrets, không gửi credential trong chat.
- WordPress staging/database, admin và Application Password migration tạm;
  danh sách người viết/người duyệt.
- Backup/restore đã thử, cron monitor, HMAC mới, NTP và phiên bản đã pin.
- Thời điểm freeze, người phê duyệt chuyển nguồn, cửa sổ theo dõi và cách đưa
  thay đổi sau cutover vào rollback.

Giữ Sheet/upload cũ. Tài liệu cũ ở `docs/headless/LEGACY-CMS-DEPLOY.md` chỉ
áp dụng nguồn Sheets, không dùng quy tắc lịch cũ cho WordPress.


## Vận hành nâng cấp: campaign, import/export, indexing và AI

Đọc [nhân viên](content-upgrade/STAFF.md), [feature matrix](../FEATURE-MATRIX.md)
và [kết quả/giới hạn QA](../PROGRESS.md). Bridge có 15 bảng riêng, ngoài các bảng
WordPress, Rank Math và Action Scheduler. Deploy cả thư mục plugin;
package-bridge.ps1 tạo ZIP installable, SHA và mở kiểm mọi entry. Không deploy
.local, credentials, test database, private exports hoặc fixtures.

Cron phải chạy cả native events và Action Scheduler group cohamy. Timer/Compose
đã có lệnh `wp action-scheduler run --group=cohamy --batch-size=25 --batches=4`.
Chỉ dùng một cron authority, theo dõi exit code/runtime và đồng bộ NTP.
Publication không cần traffic wp-admin. Campaign concurrency 1, batch tối đa
10, quota ngày Việt Nam, cửa sổ 5 phút; bỏ lịch lỡ để tránh dồn bài. Repair
không đẩy action tương lai chạy sớm. Timer mỗi phút có độ trễ đến 60 giây cộng
runtime job; backlog cần metric/alert. Service timeout 180 giây; điều chỉnh sau
benchmark staging. Bridge 2.0.9 phục hồi sự kiện native bị mất cho bài đã đến
hạn; xem mục cron phía trên và regression schedule-latest.json.

Health trả queue/heartbeat/outbox, engine, storage và config. Export dùng frozen
inventory SQL, cursor 1.000, chia 10.000 URL/file; ZIP private giữ 7 ngày. Nếu
bỏ indexable_only, inventory có thể chứa nháp/trash; không dùng file đó gửi
indexing. Import trên 250 dòng validate bằng AS trước ghi, rồi ghi batch 10,
skip invalid là lựa chọn rõ ràng. Rollback trên 100 bài dùng AS batch 10,
snapshot và CAS; giữ bài người dùng đã sửa, báo conflict từng dòng.
MariaDB 10.6+/MySQL 8+ cần cho JSON/window functions. Local dùng SQLite; chưa
kiểm DDL, migration, locking và concurrency trên MariaDB, phải chạy ở staging.

Rank Math native IndexNow sender bị tắt; Bridge là sender duy nhất. Kiểm key
public qua HTTPS tại /indexnow/<key>.txt; bật queue và cho phép LIVE riêng sau
review preview. Lựa chọn manual/file/IDs/campaign/date hỗ trợ updated/deleted,
kiểm đúng host và điều kiện index. Tối đa 10.000 URL/request, dedup, generation
CAS, Retry-After và retry có giới hạn. HTTP 200/202 lưu accepted_not_indexed.
GSC cần service account riêng, đúng property Cohamy và API verify quyền;
Search Analytics, URL Inspection, sitemap PUT, kết quả và quota được lưu.
Không dùng Google Indexing API cho blog thường. providers.json là CONTRACT
MOCK, không phải số liệu Search Console hoặc Google index thật.

AI tùy chọn giữ key ở server, endpoint HTTPS allowlist, kiểm model bằng /models;
chỉ dùng records approved, chưa hết hạn, có nguồn và ngày. Private AS job có
ba lần thử, CAS, preview before/after và người dùng xác nhận apply. Input tối
đa 128 KB. Budget reservation dùng ước lượng byte input, output tối đa và
overhead, đối chiếu total_tokens khi response rõ ràng; không cam kết tokenizer
hoặc phí. Kết quả không chắc chắn giữ reservation, không tự retry để tránh phí
trùng. FAQ nối vào bài; link là advisory; near-duplicate xét 100 bài gần nhất
cùng locale. Chưa gọi provider LIVE/trả phí. Đặt model/budget riêng, kiểm quota
và lỗi; không lấy ngân sách MOCK để báo chi phí thật.

Score worker dùng assets nguyên bản WordPress 7.1/Rank Math 1.0.278, hash và
version pin. Upgrade cần refresh assets, license và manifest, chạy lại engine,
score worker và metadata QA. Mismatch báo lỗi/N/A, không giả score. WP local
báo có 7.1.1; chưa upgrade core. Trước production kiểm bản vá và engine tương
ứng. Rank Math Free không cần mua PRO; PRO/Content AI/analytics hãng chưa active.

## Dependency security và source dùng chung

Đã vá đích danh Next.js/eslint-config-next lên 16.3.5, sharp lên 0.35.4.
[Advisory Windows RCE](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)
và [Image API RCE](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4)
xác nhận Next.js 16.2.12 bị ảnh hưởng. npm-audit-before.json và npm-audit.json
đối chiếu 36 xuống 34 cảnh báo: **0 critical, 5 high, 29 moderate còn lại**.
Review/fix/retest các dependency còn lại trước production. Không chạy bulk
force audit fix hoặc mô tả production security đã đạt.

Source/env/dependencies CRM, portal, orders và commerce của tác vụ đồng thời
được giữ. Blog chỉ ghi WordPress khi được chọn; sản phẩm vẫn nguồn tĩnh, contact
vẫn Google Sheets. preserved-source.json chứng minh 5 path product/contact
không đổi byte so với backup. Thay đổi layout/proxy/robots/package có cả tích
hợp headless và tác vụ khác; không quy hết cho migration. Test blog không chứng
minh nghiệp vụ CRM hoặc contact LIVE.

Backup đã restore trên bản copy: integrity/count 45 tables và SHA 40 media
khớp. VPS cần logical MariaDB dump, uploads, plugin/config, build và kho secret
riêng; thực hiện full restore staging cô lập trước cutover. Export URL/config
không thay database backup. Score, AS, audit, redirects và options phải có trong
dump. Trước rollback sau cutover: freeze editorial/jobs, backup/export delta
WordPress, đối chiếu bài mới/sửa, trạng thái, ảnh và slug redirect, đưa delta
vào nguồn rollback có người duyệt; giữ WordPress read-only. Không bỏ thay đổi
sau cutover. Production/DNS/HTTPS/multi-instance/SMTP/full-server restore NOT RUN.

Setup local dùng archive wordpress.org cố định WP 7.1, Rank Math 1.0.278,
SQLite Integration 3.0.2. SHA archive đã tải ở packages-pinned.json. Setup không
overwrite wp-config, credential hoặc database đã có. Docker examples dùng tag
mutable, chưa chạy trên máy này; pin digest đã test ở staging. Nếu phiên bản
WP/RM khác, refresh engine assets và chạy QA trước mở production.
