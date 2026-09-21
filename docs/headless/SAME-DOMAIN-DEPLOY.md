# WordPress dưới cohamy.vn/wp-admin

Đích production: Next.js phục vụ website công khai; WordPress và MariaDB riêng
phục vụ Gutenberg, Rank Math, CSV và API. Không cần DNS `cms.cohamy.vn`.
FastPanel đang quản lý vhost Cohamy; dùng tệp include của chính vhost, không
sửa tệp vhost sinh tự động và không đụng các site/container HumanBank.

## Topology được kiểm tra 21/09/2026

- HTTPS `cohamy.vn` đã có certificate và Next.js qua upstream `cohamy.vn12`.
- `/etc/nginx/fastpanel2-sites/cohamy_vn_usr/cohamy.vn.includes` là tệp include
  riêng, ban đầu rỗng. Mẫu: `deploy/cohamy-wordpress-paths.conf.example`.
- `127.0.0.1:8081` đã thuộc HumanBank, nên Cohamy CMS dùng `8181`.
- Port WordPress bind loopback, database chỉ trong Compose network. 12 GB trống
  tại thời điểm khảo sát; theo dõi trước khi tải image/backup.

## Thứ tự phát hành

1. Backup source/env/PM2/Nginx và kiểm dung lượng; giữ release rollback.
2. Tạo `/root/cohamy-cms/wordpress/.env` mode 0600 từ mẫu, sinh ngẫu nhiên
   hai secret riêng. Đặt `COHAMY_CMS_PORT=8181`, URL CMS/public/preview đều là
   `https://cohamy.vn`, webhook là `https://cohamy.vn/api/wordpress/webhook`,
   môi trường `production`. Pin các Docker image theo digest sau khi test.
3. `docker compose --env-file wordpress/.env -f wordpress/compose.yaml up -d db wordpress`.
   Cài WordPress bằng WP-CLI, kích hoạt Rank Math Free và Cohamy Headless Bridge,
   đặt timezone `Asia/Ho_Chi_Minh`, permalink `/%postname%/`. Cài CLI cron.
4. Dùng Nginx include cho `/wp-admin/`, `/wp-login.php`, `/wp-json/`,
   `/wp-content/`, `/wp-includes/`; kiểm `nginx -t` rồi reload. Uploads PHP bị
   chặn. `/wp-cron.php` từ web và XML-RPC không cần thiết; cron CLI vẫn chạy.
   Kiểm tra HTTPS login/cookie/Gutenberg/REST/ảnh. Không proxy `/sitemap.xml`,
   `/robots.txt`, `/vi/bai-viet/` hay các trang Next khác.
5. Chạy migration dry-run từ nguồn **đã xác minh**, dùng Application Password
   tạm qua HTTPS và đối chiếu 23 field/5 locale/URL/SEO. Backup DB/uploads,
   thử restore trên project tách biệt trước khi cutover.
6. Sau khi staging kiểm thử đạt, đặt env Next server-side `BLOG_SOURCE=wordpress`,
   `WORDPRESS_URL=http://127.0.0.1:8181`, `WORDPRESS_ALLOW_LOCAL_HTTP=true`,
   `WORDPRESS_WEBHOOK_SECRET` trùng WordPress, `WORDPRESS_REPLAY_DIR` ghi được
   bởi Next. Restart một lần; các lần biên tập tiếp theo không cần restart.
7. Kiểm HTTP 200, canonical/sitemap/robots, ảnh, các bản dịch, publish/sửa/gỡ
   cùng PID Next, webhook lỗi chữ ký, phân quyền, cron và CMS outage 503.

Trong proxy, `X-Forwarded-Proto: https` cho WordPress biết TLS đã kết thúc ở
Nginx. Compose chỉ tin header này vì Apache chỉ bind host loopback. Không dùng
`WORDPRESS_URL=https://cohamy.vn` từ Next trên cùng VPS nếu DNS hairpin làm
kết nối bất ổn; adapter chỉ chấp nhận HTTP production tới loopback khi bật flag.
Cookie preview vẫn dùng Secure khi request public qua HTTPS.

Rollback: giữ WordPress/DB/media và export delta kể từ cutover. Nếu chỉ proxy
lỗi, bỏ các location WordPress trong include sau khi backup rồi `nginx -t` và
reload. Nếu nguồn WordPress lỗi, freeze biên tập, export delta rồi mới đổi
`BLOG_SOURCE` theo [quy trình rollback](MIGRATION-ROLLBACK.md); không âm thầm
trả dữ liệu cũ như bài mới. Form liên hệ Google Sheets không nằm trong cutover.
