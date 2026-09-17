# Cohamy Blog CMS: cấu hình, deploy và rollback

## 1. Kiến trúc

- Next.js chạy bằng PM2 với tên process `cohamy`, mặc định ở cổng `3001`.
- Google Sheet `Posts` là cơ sở dữ liệu bài viết. Server dùng service account,
  không đưa private key xuống browser.
- Dữ liệu bài được cache 60 giây bằng Next Data Cache với tag
  `cohamy-blog-rows`; mọi mutation qua CMS tăng generation và expire tag ngay
  để request public kế tiếp đọc dữ liệu mới, không cần build hoặc deploy lại.
- Ảnh được lưu ngoài source tại `/var/www/cohamy_uploads/blog` để không mất
  khi pull hoặc thay bản build. Nginx phục vụ URL `/uploads/blog/`.
- Bài `scheduled` tự xuất hiện khi `scheduled_at <= thời điểm đọc`; không cần
  cron.
- Endpoint `/api/health` kiểm tra cấu hình Sheet và quyền ghi thư mục upload.

## 2. Tạo Google Sheet và service account

1. Tạo một Google Spreadsheet riêng, không bật chia sẻ công khai.
2. Trong Google Cloud Console, tạo hoặc chọn project, bật Google Sheets API.
3. Tạo service account và tạo khóa JSON. Không commit hoặc tải khóa lên thư
   mục public.
4. Chia sẻ Spreadsheet cho email của service account với quyền Editor.
5. Lấy chuỗi giữa `/d/` và `/edit` trong URL làm
   `GOOGLE_SHEETS_SPREADSHEET_ID`.
6. Điền `client_email` vào `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
7. Điền `private_key` vào `GOOGLE_PRIVATE_KEY`. Trong file env có thể dùng
   chuỗi nhiều dòng hoặc ký tự `\n`; code hỗ trợ cả hai.

Sau khi env đã sẵn sàng:

```bash
npm run sheet:init
```

Lệnh tạo tab `Posts` nếu chưa có và ghi chính xác header sau:

```text
id,group_id,locale,slug,title,excerpt,content_html,cover_image,cover_image_alt,author,category,tags,featured,related_product_ids,seo_title,seo_description,canonical_url,robots_index,status,scheduled_at,published_at,created_at,updated_at
```

Nếu tab đã có header khác, lệnh dừng và báo vị trí sai; không tự xóa dữ liệu.

## 3. Biến môi trường

Sao chép `.env.example` thành `.env.local` khi chạy local hoặc
`.env.production` trên VPS:

```dotenv
NEXT_PUBLIC_SITE_URL=https://cohamy.vn
NODE_ENV=production
PORT=3001

GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_POSTS_SHEET=Posts
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=

ADMIN_USERNAME=
ADMIN_PASSWORD_HASH=
ADMIN_SESSION_SECRET=

UPLOAD_DIR=/var/www/cohamy_uploads/blog
NEXT_PUBLIC_UPLOAD_BASE_URL=https://cohamy.vn/uploads/blog

GOOGLE_SHEETS_WEBHOOK_URL=
```

Tạo hash bcrypt và secret:

```bash
npm run admin:hash -- "mat-khau-rat-manh"
openssl rand -base64 48
```

`GOOGLE_SHEETS_WEBHOOK_URL` chỉ dành cho form liên hệ hiện có. Đây là Apps
Script endpoint tách biệt với service account của CMS. URL Apps Script từng
được đặt trực tiếp trong source cũ; nên tạo deployment URL mới, thu hồi URL cũ
và chỉ lưu URL mới trong env.

## 4. Nhập 8 bài hiện có

Sao lưu Sheet trước khi seed. Chạy:

```bash
npm run sheet:seed-blog
```

Script chuyển 8 bài cũ thành 5 locale, làm sạch HTML, đổi H1 trong nội dung
thành H2, tạo heading ID và upsert theo `group_id + locale`. Sau khi ghi, script
đọc lại và chỉ thành công khi có đủ 8 nhóm và 40 dòng.

## 5. Dùng CMS

1. Mở `https://cohamy.vn/admin/login`.
2. Tạo bài tại `Bài viết > Viết bài`.
3. Cùng một bài đa ngôn ngữ dùng chung `group_id`; mỗi locale có slug riêng.
4. `Lưu nháp`, `Đặt lịch` và `Xuất bản` đặt status tương ứng.
5. Xóa trong UI là lưu trữ mềm (`status=archived`), không xóa dòng Sheet.
6. Preview admin hiển thị cả draft nhưng không làm bài xuất hiện công khai.

Import CSV dùng đúng 23 header trong
`docs/posts-import-template.csv`. UI xem trước tối đa 20 dòng, báo lỗi theo
dòng và chỉ gửi các dòng hợp lệ. Cặp `locale + slug` và
`group_id + locale` phải duy nhất.

## 6. Kiểm tra VPS trước khi thay đổi

Không giả định source, user chạy PM2 hay file Nginx. Đăng nhập VPS rồi kiểm tra:

```bash
pwd
pm2 ls
pm2 describe cohamy
ps -eo user,pid,cmd | grep -E 'next start|next-server' | grep -v grep
sudo nginx -T
df -h
du -sh /var/www/* 2>/dev/null
free -h
node --version
npm --version
```

Từ `pm2 describe cohamy`, xác định chính xác `exec cwd` và user đang chạy
process. Từ `nginx -T`, xác định đúng `server {}` phục vụ `cohamy.vn`. Không
chỉnh một server block khác chỉ vì tên file có vẻ đúng.

## 7. Backup trước deploy

Ví dụ sau chỉ chạy sau khi đã xác nhận đường dẫn:

```bash
export COHAMY_APP_DIR=/duong/dan/source-thuc-te
export COHAMY_BACKUP_DIR=/var/backups/cohamy/$(date +%Y%m%d-%H%M%S)
sudo install -d -m 0750 "$COHAMY_BACKUP_DIR"
sudo tar -C "$COHAMY_APP_DIR" \
  --exclude=node_modules --exclude=.next \
  -czf "$COHAMY_BACKUP_DIR/source.tgz" .
sudo nginx -T > "$COHAMY_BACKUP_DIR/nginx-full.conf"
pm2 jlist > "$COHAMY_BACKUP_DIR/pm2-jlist.json"
```

Trong Google Sheets, tải một bản `.xlsx` hoặc tạo bản sao trước lần seed/deploy
đầu. Không đặt file backup vào repository.

## 8. Thư mục upload và Nginx

Thay `cohamy-runner` bằng user thật đã xác định ở bước kiểm tra:

```bash
sudo install -d -o cohamy-runner -g cohamy-runner -m 0755 \
  /var/www/cohamy_uploads/blog
sudo -u cohamy-runner test -w /var/www/cohamy_uploads/blog
```

Không dùng `chmod 777`.

Đặt block sau vào bên trong đúng `server {}` của `cohamy.vn`:

```nginx
location /uploads/blog/ {
    alias /var/www/cohamy_uploads/blog/;
    try_files $uri =404;
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
    add_header X-Content-Type-Options "nosniff";
}
```

Sau khi sửa:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Chỉ reload khi `nginx -t` thành công.

## 9. Deploy an toàn

Trong source thật:

```bash
export COHAMY_APP_DIR=/duong/dan/source-thuc-te
cd "$COHAMY_APP_DIR"
git status --short
git pull --ff-only origin main
npm ci
npm run test:cms
npm run lint
npx tsc --noEmit
npm run build
npm audit --omit=dev
npm run sheet:init
npm run sheet:seed-blog
pm2 reload ecosystem.config.js --env production
pm2 save
```

Hoặc sau khi đã backup và xác nhận đường dẫn:

```bash
bash scripts/manual-deploy.sh "$COHAMY_APP_DIR"
```

Script không chỉnh Nginx, không tạo env và không seed Sheet thay người vận
hành. Các bước có dữ liệu phải được chạy riêng để dễ kiểm soát.

## 10. Smoke test sau deploy

```bash
curl -fsS https://cohamy.vn/api/health
curl -fsSI https://cohamy.vn/admin/login
curl -fsSI https://cohamy.vn/vi/bai-viet
curl -fsSI https://cohamy.vn/en/blog
curl -fsSI https://cohamy.vn/sitemap.xml
pm2 status
pm2 logs cohamy --lines 100 --nostream
```

Kết quả health mong đợi:

```json
{"ok":true,"app":"cohamy","sheetsConfigured":true,"uploadDirectoryWritable":true,"timestamp":"..."}
```

Sau đó kiểm tra bằng browser:

- đăng nhập sai 5 lần bị giới hạn;
- đăng nhập đúng, tạo draft, preview, upload ảnh;
- xuất bản một bài thử, kiểm tra list/detail/search/category/pagination;
- kiểm tra source trang có canonical, robots, Open Graph, Twitter, Article và
  Breadcrumb JSON-LD;
- kiểm tra hreflang chỉ chứa bản dịch đã public;
- mở URL ảnh upload trực tiếp qua Nginx;
- lưu trữ bài thử và xác nhận bài biến mất khỏi public.

## 11. Rollback

Nếu build mới lỗi nhưng source cũ vẫn còn:

```bash
export COHAMY_APP_DIR=/duong/dan/source-thuc-te
cd "$COHAMY_APP_DIR"
git log --oneline -10
git checkout <commit-da-xac-nhan>
npm ci
npm run build
pm2 reload ecosystem.config.js --env production
```

Nếu cần phục hồi từ backup:

```bash
sudo tar -xzf /var/backups/cohamy/<moc-thoi-gian>/source.tgz \
  -C /duong/dan/source-thuc-te
```

Khôi phục file Nginx đúng vị trí từ bản backup, sau đó luôn chạy:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Sheet không tự rollback theo code. Chỉ phục hồi bản sao Sheet khi đã đối chiếu
đúng thời điểm và dữ liệu cần giữ. Ảnh ở thư mục ngoài source không bị rollback
khi đổi commit.

## 12. Giới hạn xác minh

Build local không chứng minh quyền truy cập Spreadsheet thật, quyền ghi thư
mục trên VPS, cấu hình server block đang chạy hoặc luồng HTTPS production.
Những ranh giới đó chỉ được xác nhận bằng credential và SSH của môi trường
đích. Không được coi source đã “deploy live” nếu chưa chạy và đọc lại toàn bộ
smoke test ở bước 10.
