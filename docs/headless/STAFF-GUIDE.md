# Quản lý bài Cohamy trong WordPress

Hướng dẫn bổ sung về template, campaign, import/export, redirect và kết nối SEO:
[Quy trình nhân viên](../content-upgrade/STAFF.md).

Chỉ dùng WordPress Cohamy. CMS HumanBank không thuộc hệ thống này. Địa chỉ CMS
production do quản trị cung cấp sau triển khai; local dùng
`http://127.0.0.1:8081/wp-admin/`.

## Soạn bài và duyệt

1. Vào Posts → Add Post, nhập title/content bằng Gutenberg.
2. Mở Settings → Cohamy — Ngôn ngữ và URL. Chọn locale, nhập group_id chung
   cho bản dịch, điền Public slug hoặc tạo từ title. Mỗi nhóm chỉ có một bài
   mỗi locale. Slug chữ thường không dấu/số/gạch ngang; locale khác được dùng
   cùng slug.
3. Chọn một danh mục Cohamy, tác giả hiển thị, bài nổi bật, sản phẩm liên quan
   (Ctrl/Cmd để chọn nhiều). Thêm tags và excerpt trong panel WordPress.
4. Upload/chọn Featured image, nhập ALT trong Media Library. Ảnh trong bài
   cũng cần ALT và caption phù hợp.
5. Mở nút Rank Math, nhập Focus Keyword rồi Enter, bấm Edit Snippet điền Title
   và Description. Xem Basic SEO, Additional, Title/Content Readability. Biến
   `%title%`, `%sep%`, `%sitename%`, `%excerpt%` được Rank Math thật xử lý.
6. Save draft hoặc Submit for review. Người duyệt kiểm tra rồi Publish.
   Người viết không có quyền tự publish hoặc sửa bài public của người khác.

Locale của bài từng xuất bản được khóa để giữ URL; tạo bản dịch riêng nếu
cần ngôn ngữ khác. Public URL nằm trong panel Cohamy. Permalink/slug nội bộ WordPress trong cửa
sổ Rank Math không quyết định URL website: đổi URL bằng Public slug. Đổi slug
bài đã public có 301 về slug hiện tại; không tái dùng slug lịch sử của bài khác.

Các chức năng SEO trên dùng bản miễn phí. PRO/Content AI/theo dõi thứ hạng
không thuộc tích hợp. Điểm SEO là gợi ý, không cam kết thứ hạng/Google index.
Canonical do hệ thống sinh; không nhập CMS canonical để đổi URL public.
Noindex trong Rank Math loại bài khỏi sitemap/hreflang; bài đã publish vẫn
xem được bằng URL trực tiếp.

## Block và preview

Dùng Paragraph, Heading, List, Image, Gallery, Quote, Table và link trong text.
Editor giới hạn block; paste/import block khác sẽ báo lỗi lúc lưu. HTML cũ có
thể thành Classic block: chuyển sang các block hỗ trợ trước khi lưu chỉnh sửa.
Không chèn script/iframe/embed; frontend loại HTML nguy hiểm.

Bấm **Lưu và xem trên giao diện Cohamy** trong panel Cohamy để xem nội dung
chưa xuất bản; link **View Post** dành cho bài đã public. Bài lưu rồi mở Next.js thật; token gắn
với quyền sửa bài, hết hạn tối đa 5 phút, không cache public/index. Hết hạn mở
lại từ WordPress. Không gửi URL preview cho khách: người giữ URL còn hạn có
thể sử dụng quyền preview trong thời hạn đó.

## Lịch và gỡ bài

Người duyệt chọn Publish → ngày/giờ tương lai → Schedule. Timezone CMS
Asia/Ho_Chi_Minh. Server cron chạy kể cả không ai mở wp-admin; kiểm frontend
sau lịch, nếu chưa xuất hiện báo admin kiểm cron/webhook. Chu kỳ VPS mỗi phút
có thể trễ khoảng một phút cộng thời gian job.

Đổi về Draft hoặc Trash để gỡ. URL public không còn nội dung/list/sitemap.
Private, pending, draft, future và trash không được API blog public trả về.

## CSV mẫu và import

Vào Posts → Import CSV Cohamy, tải mẫu UTF-8 BOM có `sep=;`. Excel tự chia
23 cột; nếu không, dùng Data → From Text/CSV chọn UTF-8 và delimiter `;`.
Lưu bằng CSV UTF-8. Local đã kiểm byte/header/parser, chưa mở bằng Excel
desktop của người dùng; cần xác nhận cách mở trên bản Excel dùng để nhập bài.

Giữ 23 header và thứ tự. Cần title, author, category, locale, slug, group_id,
status. `id` là khóa cập nhật ổn định; để trống sẽ sinh từ group_id+locale nên
không đổi nhóm nếu muốn cập nhật đúng bài. Giá trị:

- locale: vi/en/zh/ko/ja.
- category: chocolate/dried-fruit/gift-ideas/food-guide/brand-story.
- featured, robots_index: TRUE/FALSE.
- status: draft/published/scheduled/archived.
- tags, related_product_ids: các giá trị cách nhau bằng phẩy; mã sản phẩm tra
  trong editor.
- Ngày: ISO 8601 có Z hoặc +07:00, ví dụ `2026-09-20T09:00:00+07:00`.
  scheduled phải có scheduled_at.

Nhận delimiter `;` hoặc `,`. HTML, delimiter và xuống dòng trong field phải
được bao nháy kép; nháy kép trong field nhân đôi. Excel tự xử lý khi lưu CSV.

Bấm Xem trước và kiểm tra, đọc tổng số/ví dụ/lỗi theo dòng, rồi mới Ghi các
dòng hợp lệ theo batch. Dòng lỗi bị bỏ qua và báo; tối đa 16 MB/20.000 bản ghi,
batch 25. Xem created/updated/failed sau cùng.

Mặc định draft kể cả CSV ghi published. Muốn giữ trạng thái phải tick rõ;
published/scheduled cần quyền người duyệt/admin. Import lại chọn Tạo mới/cập
nhật theo ID; Chỉ tạo mới báo trùng. Nếu batch ngắt lâu, preview lại dùng upsert
với cùng ID. Checkbox giữ thời gian nguồn chỉ dành admin migration.

SEO title/description/robots_index ghi vào Rank Math; canonical_url cũ giữ
đối chiếu, frontend canonical tự tham chiếu. Cover HTTPS hoặc `/images/...`
được giữ URL, không tải qua server. Muốn quản media trong WordPress thì upload
và chọn Featured image; ảnh mới không cần deploy frontend.
