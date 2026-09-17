# Migration, đối chiếu và rollback

## Nguồn thật và dry-run

Source local có 8 nhóm trong data/blog.ts × 5 locale = 40 dòng. Không có
credential Sheets thật nên chưa xác minh số bài production. Phải đọc Sheet
thật trước cutover. `--source` bắt buộc: legacy/sheets/file. Hàm migration
Sheets chỉ đọc A1:W, kiểm header, không tạo tab hoặc normalize ghi đè ngày sửa.
Legacy chỉ có publishedAt, giữ timestamp đã biết, không bịa ngày sửa.

```powershell
npm run blog:migrate -- --source legacy --local
npm run blog:migrate -- --source legacy --local --apply
# Env migration lấy từ kho bảo mật, CMS HTTPS đã xác minh.
npm run blog:migrate -- --source sheets
npm run blog:migrate -- --source sheets --apply
npm run blog:migrate -- --source file --file /path/source-snapshot.json
```

Không credential đích: dry-run source-only, destination NOT CHECKED. Có
credential: đọc export và validate qua preview API, không ghi bài. Migration
cần admin tạm có manage_options; credential không cần trong frontend/client.

## Báo cáo và chạy lại

JSON/CSV nguồn đặt tên SHA-256; report đếm row/group/locale, validation, số
tạo/cập nhật/bỏ qua và đối chiếu tất cả 23 field. Timestamp đối chiếu cùng
instant UTC, giữ millisecond trong meta; cron/native date WordPress có độ phân
giải giây. Tags đối chiếu theo tập tên, sản phẩm liên quan giữ thứ tự. Before/after export giữ raw
content/SEO template. `.headless-reports/migration` bị Git ignore vì có thể
chứa bài chưa public. Export không thay backup database.

Khóa là ID cũ; locale+slug và group_id+locale còn được unique trong database.
WordPress post_name riêng không đổi public slug. Chạy lại bỏ qua bài không
đổi, không tạo trùng. Nếu đích khác nguồn, apply dừng báo field để giữ sửa đổi
sau migration. Chỉ sau freeze, xem report và quyết định thay thế mới thêm
`--allow-overwrite`; tùy chọn đó có thể thay nội dung/status mới bằng nguồn cũ.

Mỗi dòng trong transaction; lỗi rollback dòng và báo. Toàn bộ file không là
một transaction: bài thành công vẫn giữ. Nếu process chết sau commit dòng
trước lưu cursor, preview lại dùng upsert/cùng ID. URL ảnh cũ giữ nguyên;
chuyển media làm riêng sau khi kiểm tra URL và checksum.

## Cutover

1. Backup source/build/env, Sheet đầy đủ, uploads cũ và DB WordPress.
2. Freeze ghi blog ở CMS cũ, ghi UTC timestamp/người phụ trách; form liên hệ
   tiếp tục hoạt động.
3. Dry-run dữ liệu thật, xử lý lỗi, apply staging và đối chiếu số lượng/23
   field/URL/locale/ảnh/SEO. Kiểm thử MariaDB, HTTPS, roles, cron, webhook và
   restore backup trên staging.
4. Migration cuối vào CMS đã xác minh; lưu source hash/report/export. Giữ Sheet.
5. Sau phê duyệt, release cấu hình BLOG_SOURCE=wordpress ban đầu. Kiểm /admin,
   ghi cũ 410, health, bài/ảnh/sitemap/redirect rồi mới mở biên tập WordPress.
6. Theo dõi cron/outbox/503/backup và ghi timestamp cutover/delta sau cutover.

Không tự fallback hoặc ghi đồng thời hai nguồn khi WordPress lỗi. Legacy chỉ
là nguồn đọc static, không mở CMS ghi bài.

## Rollback có dữ liệu mới

Quay ngay về Sheet cũ làm mất bài/sửa/lịch sau cutover. Freeze WordPress,
backup DB và export `/wp-json/cohamy/v1/export` bằng admin tại lúc rollback.
So với export cutover theo ID để lập delta: bài mới, sửa content/SEO/ảnh/slug,
gỡ/noindex/lịch/bản dịch.

Ưu tiên sửa hạ tầng hoặc rollback code frontend vẫn giữ nguồn WordPress nếu
contract còn tương thích. Nếu bắt buộc về Sheets, duyệt delta rồi đưa vào Sheet
làm việc riêng bằng công cụ quản trị cũ. Export có wp_status; pending/private
không tương đương schema cũ, chuyển draft theo quyết định, không tự publish.
Giữ redirects mới tại proxy/bridge phù hợp vì nguồn Sheets không tự phục vụ
redirect WordPress. Media mới cần giữ CMS hoặc sao chép/kiểm URL trước khi gỡ.

Sau đối chiếu mới đổi BLOG_SOURCE=sheets với Sheet/credential/upload đã cập
nhật, restart cấu hình một lần, mở lại CMS cũ và kiểm URL/SEO/sitemap/lịch/form.
Giữ DB/export WordPress, không xóa Sheet hoặc media. Rollback/restore với Sheet
thật chưa chạy trong phiên local này; phải diễn tập staging trước cutover.
