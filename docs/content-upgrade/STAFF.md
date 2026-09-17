# Vận hành nội dung Cohamy

Vào WordPress `/wp-admin`. Soạn bài và trang trong **Posts / Pages**, dùng Gutenberg, panel **Cohamy — Ngôn ngữ và URL**, thư viện Media và Rank Math. Menu **Vận hành Cohamy** bổ sung quản lý dữ liệu, template, campaign, import, export và theo dõi SEO. Mỗi thông báo hoàn tất chỉ xuất hiện khi API xác nhận lưu; tải lại trang để đọc dữ liệu đang lưu trên server.

## Quyền và biên tập

Người viết lưu draft và gửi pending. Người duyệt xuất bản, đặt lịch, quản lý nội dung của nhóm và vận hành campaign. SEO manager có quyền vận hành SEO; admin cấu hình kết nối. Không chia sẻ tài khoản/Application Password. Native Gutenberg cung cấp autosave, revisions, undo/redo, outline và preview thiết bị; nút **Lưu và xem trên giao diện Cohamy** mở preview Next.js xác thực, hết hạn sau 5 phút, không index/cache công khai.

Chọn một trong năm ngôn ngữ, group_id chung cho bản dịch, public slug và danh mục Cohamy. Slug nội bộ WordPress không quyết định URL public. Đổi slug đã xuất bản tự tạo redirect 301. Không đổi locale của bài đã public; tạo bản dịch cùng group_id. Chỉ bản dịch được index mới có hreflang.

Ảnh đại diện dùng Media, nhập ALT riêng. ALT là mô tả ảnh, không nhồi từ khóa. Block hỗ trợ: paragraph, H2/H3/H4, list, image/gallery/caption, quote, table, link, video, YouTube/Vimeo HTTPS, CTA buttons, separator, reusable block/group và HTML được làm sạch. Block ngoài danh sách báo lỗi lưu. H1 là tiêu đề trang do frontend tạo. Embed/HTML không chạy script tùy ý. Link ngoài có thể dùng nofollow/sponsored/ugc; mở tab mới được thêm noopener/noreferrer.

Nhập SEO title, description, focus keyword và các từ khóa phụ trong Rank Math; thiết lập social Facebook/Twitter riêng, robots và pillar content tại panel native. Variables Rank Math được engine native resolve. Canonical public luôn do Cohamy sinh từ URL của bài. Điểm trống/N/A nghĩa chưa phân tích; import/campaign không tự gán 0. Có keyword thì cron phân tích bằng engine Rank Math đúng phiên bản. Bảng báo queued/error/stale khi phù hợp. Điểm SEO không bảo đảm thứ hạng hay Google index.

## Lọc, quick edit và kiểm tra HTML

Tab **Bài viết / Trang** lọc trên server theo trạng thái, locale, tác giả, taxonomy, thời gian, record/campaign/template, thiếu SEO và điểm. Mỗi trang tối đa 25. Mở Gutenberg để sửa nội dung; quick edit/bulk dùng WordPress IDs và JSON field được phép. Ví dụ `{"meta":{"rank_math_title":"Tiêu đề SEO mới"}}`. Bấm **Preview từng bài**, đọc trước/sau rồi **Xác nhận ghi**. Nếu bài đổi sau preview, server từ chối bài đó; kết quả nêu từng ID thành công/thất bại. Nhân bản tạo draft với identity mới.

**Đọc HTML và metadata thực tế** kiểm URL website public qua cron, trả HTTP/title/canonical/robots/schema thực tế. **Kiểm tra link** dùng bảng link Rank Math thật và tối đa 20 HTTP link nội bộ; các link chưa kiểm tra được ghi rõ. Gợi ý liên kết cùng locale/danh mục là đề xuất, không tự chèn. Link ngoài chưa được probe HTTP và không được coi là hoạt động.

## Records và template

Trong **Dữ liệu**, tạo stable ID bất biến, loại country/location/topic/subject/school/program phù hợp dữ liệu thực tế. Fields JSON chứa giá trị đơn như `{"slug":"ha-noi","description":"...","country_id":"vn"}`. Dữ liệu thay đổi theo thời gian cần URL nguồn HTTPS, ngày kiểm chứng và hạn dùng. Chọn approved sau kiểm tra; expired/archived/chưa duyệt bị chặn khi tạo bài. Cập nhật giữ stable ID, kiểm version để tránh ghi đè. Có thể chọn record liên quan trong Gutenberg và lọc danh sách public theo record.

Soạn bài gốc bằng Gutenberg + Rank Math, lấy WordPress ID rồi **Chụp từ bài Gutenberg** trong tab Template. Snapshot mặc định draft; sửa required_variables, placeholder `{{location.name}}`, `{{location.slug}}`, `{{subject.name}}`, `{{year}}`, `{{site.name}}`, rồi duyệt approved. Template có version và lịch sử 20 phiên bản. Base ID của bài gốc giữ ổn định: sửa version không tạo lại tổ hợp đã có. Canonical, identity, lịch sử timestamp và locks không được nhân bản.

## Campaign và khôi phục

Nhập IDs template/location, subject tùy chọn, chế độ draft/pending/published/scheduled, batch 1–10 và quota ngày 1–1000. Scheduled_at là ISO có Z hoặc +07:00. Giờ chạy hằng ngày là giờ Việt Nam. Bấm **Preview và validate**; thiếu biến/expired data được báo trước. Sau khi kiểm số tổ hợp mới/trùng, **Xác nhận chạy campaign**. Thay cấu hình phải preview lại.

Job lưu trong database, Action Scheduler chạy từ cron server: đóng tab vẫn tiếp tục. Concurrency sinh bài là 1. Quota tính Asia/Ho_Chi_Minh; cửa sổ chạy 5 phút, bỏ lịch lỡ để tránh dồn bài. Mỗi item có checkpoint, attempts, lease, duration và lỗi. Lỗi được retry tối đa 3 lần; sửa nguồn rồi chọn retry các dòng failed. Pause/stop ngăn batch tiếp theo; item đang commit hoàn tất nguyên vẹn. Resume tiếp tục các khóa còn lại. Khóa toàn cục site/base-template/subject/location chống trùng giữa các campaign.

Dashboard có số dự kiến/đã tạo/đang publish/còn lại/lỗi, mốc thời gian và liên kết mở Gutenberg hoặc URL public. Chi tiết phân trang 100 item; tốc độ đo từ thời gian worker từng item, không phải cam kết số bài/phút trên VPS.

Rollback cần dừng campaign, xem danh sách preview và xác nhận. Chỉ bài còn thuộc campaign, đủ quyền và chưa bị người dùng sửa sau snapshot được đưa về draft/trash; không xóa vĩnh viễn. Trên 100 bài, API trả job chạy nền; tải lại danh sách job trong tab Import để xem từng dòng và lỗi conflict. Dòng người dùng đã sửa được giữ nguyên. Không dùng rollback campaign để khôi phục source Sheets. **Trạng thái / Audit** xem queue/heartbeat/webhook/error. Repair chỉ bổ sung action bị mất, giữ lịch chạy tương lai. Nếu cron ngừng, phải sửa cron trước; giữ tab không thay thế worker.

## Import và export

Tab **Import / Mapping** có mẫu CSV legacy 23 cột, CSV records và JSON templates. CSV UTF-8 BOM, `sep=;` cho Excel; import nhận `;` hoặc `,`, quote, HTML và xuống dòng. Nếu Excel mục tiêu không tách cột, chọn Data → From Text/CSV, UTF-8 và đúng delimiter. Chưa kiểm tra UI trên Microsoft Excel của production.

Chọn loại, create/upsert, file UTF-8 (tối đa 16 MB, 20.000 dòng) và mapping JSON `{"ten_cot_cu":"entity_id"}` khi cần. Preview/validate trước; chỉ start sau xem lỗi. Trên 250 dòng, preview cũng chạy bằng Action Scheduler: lưu Job ID, tải trạng thái đến previewed rồi mở **Xem preview đã lưu** để đọc số dòng/lỗi và xác nhận riêng. Trước xác nhận chưa có bài hoặc record nào được ghi. Giữ tùy chọn bỏ dòng lỗi chỉ khi đã xem đúng các lỗi; preview hết hạn sau một giờ. Mặc định draft; giữ trạng thái phải tick rõ ràng và đủ quyền. Upsert dùng ID ổn định, không đổi locale bài đã public, không ghi đè bản sửa sau preview. Có lựa chọn bỏ dòng lỗi; kết quả lưu từng dòng, batch chạy tại server qua AS. Giữ canonical_url cũ để đối chiếu, canonical public vẫn tự sinh. URL ảnh được giữ làm cover, không tự tải mạng nội bộ. Tải ảnh sang Media là bước migration riêng.

**Export URL** chụp membership và URL tại thời điểm bắt đầu, lọc WordPress IDs được chọn, locale/loại/trạng thái/danh mục, country/topic/subject/location/campaign/template và khoảng ngày sửa theo giờ Việt Nam. IDs dùng số nguyên cách nhau bởi dấu phẩy; để trống nghĩa dùng bộ lọc. Các bộ lọc kết hợp với nhau. CSV có URL, wp_id, locale, content_type, status và last_modified_utc; thời gian trong file luôn UTC. TXT/CSV trong ZIP chia tối đa 10.000 URL/file, manifest số dòng/SHA-256; file riêng server, actor có quyền tải, hết hạn sau 7 ngày. Bỏ tick indexable_only để export inventory (có thể chứa draft/trash); không dùng inventory này làm sitemap hoặc submit indexing. Export records/templates/redirect JSON ở tab Import giúp backup cấu hình vận hành.

## Redirect, IndexNow, GSC và AI

Redirect hỗ trợ 301/302/307/308/410, bật/tắt, hits và import CSV/JSON. Chỉ URL Cohamy, không admin/API/preview, không vòng lặp/chain quá 20. Theo dõi 404 theo path, tổng lượt/first/last, giữ 30 ngày; không lưu query, IP hay cookie. Không đưa tất cả 404 về trang chủ.

Admin cấu hình IndexNow/GSC/AI trong **Kết nối SEO**. Chưa có credential thì báo chưa kết nối, không tạo số liệu giả. IndexNow chỉ Cohamy Bridge gửi; RM native sender tắt. Bật hàng đợi khác với cho phép LIVE. Chọn URL từ WordPress IDs/campaign/khoảng ngày, dán URL hoặc upload TXT/CSV (UTF-8, cột url, tối đa 4 MB). Chọn updated hoặc deleted; bấm preview, kiểm host/số URL/lỗi rồi xác nhận với cấu hình không đổi. updated chỉ dùng nội dung còn đủ điều kiện; deleted không dùng URL bài đang indexable. URL khác host và quá 10.000 bị từ chối trước ghi; chia lựa chọn thành nhóm khi cần. Key phải đọc được trên host public; gửi tối đa 10.000 URL, retry/backoff/Retry-After. HTTP 200/202 là accepted_not_indexed. GSC cần service account riêng được cấp quyền đúng property; verify trước, đọc Search Analytics/URL Inspection, submit sitemap.xml và xem kết quả lưu/quota. Không sử dụng Google Indexing API cho blog thường. Báo cáo CONTRACT MOCK local không phải kết quả production.

AI tùy chọn: chọn bài WordPress đang có và record approved, chưa hết hạn, có nguồn/ngày kiểm chứng. Server giữ key/model/voice/ngân sách; không đưa secret vào browser bundle. Bấm kiểm tra kết nối model bằng API models trước khi sinh nội dung. Chọn draft/outline/seo/image_alt/faq/internal_link_suggestions. Job chạy nền trên server, tối đa ba lần thử, giữ Retry-After và trạng thái khi đóng tab. Xem before/after, missing_fields và cảnh báo trùng từ rồi xác nhận. FAQ chỉ nối phần mới, giữ title/nội dung/SEO cũ; gợi ý link chỉ đưa các URL nội bộ đã biết để người viết chèn trong Gutenberg, không tự ghi đè bài. Cảnh báo trùng từ xét 100 bài publish gần nhất cùng locale, không kết luận sao chép. SEO task sửa SEO; ALT task yêu cầu ảnh đại diện và chỉ cập nhật ALT. Apply từ chối nếu bài đã được người dùng sửa. Lỗi provider/quota không áp dụng nội dung; worker retry có giới hạn; job hết số lần thử phải được người dùng xem lỗi. Trước gửi, ngân sách giữ chỗ gồm ước lượng byte đầu vào, output tối đa và overhead; thành công đối chiếu total_tokens do provider trả. Request tối đa 128 KB. Ước lượng này không phải tokenizer chính xác hay cam kết phí. Request có kết quả không chắc chắn vẫn giữ reservation, không tự gửi lại để tránh phí trùng. CONTRACT MOCK có namespace ngân sách riêng, không phải phí thật. Không tự điền giá, lịch hoặc số liệu chưa có nguồn.

Rank Math đang dùng bản miễn phí. Content AI của hãng/Google integration nâng cao/analytics nâng cao của PRO cần license/dịch vụ riêng; không được cài mua hoặc mô tả là đã hoạt động. Cohamy Bridge dùng API chính thức riêng cho các kết nối được cấu hình.

## Giới hạn kiểm thử giao diện

Trong Chrome QA đã lưu record bằng UI, reload đọc bản đã lưu, tạo campaign bằng UI và đóng tab trước giờ worker tạo hai bài public. Chọn file qua công cụ điều khiển Chrome hiện bị quyền file URL của extension chặn; không phải lỗi API import. Multipart upload, parse/preview/confirm và batch đã được kiểm thử thật qua HTTP. Nhân viên upload trực tiếp trong trình duyệt bình thường; QA connector cần bật Allow access to file URLs của ChatGPT extension trước khi kiểm riêng thao tác chooser. Chưa kiểm Microsoft Excel UI tại máy mục tiêu.
