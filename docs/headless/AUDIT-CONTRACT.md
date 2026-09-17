# Audit và hợp đồng WordPress ↔ Next.js

## Baseline thực tế

Đã đọc AGENTS.md và docs cài cùng Next.js 16.2.12 về fetch, unstable_cache,
revalidateTag, revalidatePath, draft-mode, metadata, sitemap và headers trước
thay đổi tương ứng. Repo không có .git; backup source trước thay đổi ở
`.local/source-before-headless.zip`. Không reset/xóa các thay đổi có sẵn.

Code cũ đọc blog Sheets bằng service account qua cache 60 giây. Không cấu
hình Sheet từng trả mảng rỗng; đã đổi thành lỗi rõ ràng. CMS cũ có editor
Tiptap, nhập CSV, upload, JWT cookie, API mutations. Có 8 bài static, mỗi bài
5 locale; không có credential đọc dữ liệu Sheets thật. Default locale `en`
và localePrefix `always` giữ nguyên. WordPress/Rank Math đều tải từ nguồn
chính thức, không dùng CMS của hệ thống khác.

| Phần audit | Kết quả/chỉnh sửa |
| --- | --- |
| lib/blog-repository.ts | Chọn đúng một nguồn; adapter WordPress; translation chỉ indexable; khóa ghi cũ |
| lib/google-sheets-blog.ts | Giữ đọc/ghi cho rollback; thêm read-only migration giữ timestamp; guard mọi mutation |
| lib/blog-schema.ts | Giữ 23 field/locale/status/canonical compatibility của hợp đồng cũ |
| lib/blog-mutations.ts | Giữ normalize cho CMS cũ; migration không dùng normalize này |
| lib/blog-seo.ts | URL localized, robots và sitemap theo điều kiện publish/index; lastModified UTC |
| lib/seo.ts | Next.js render metadata/OG/schema public duy nhất, giữ canonical tự tham chiếu |
| app/[locale]/blog | SSR detail/list, lỗi upstream không thành empty/not-found; JSON-LD escape an toàn |
| app/sitemap.ts, app/robots.ts | Giữ URL trang/sản phẩm; thêm bài nguồn hiện chọn; sitemap động; robots không chặn bài |
| BlogArticle, BlogCard | Giữ bố cục/SSR anchor; external media hiển thị trực tiếp; HTML sanitize |
| components/admin, app/admin | Giữ code CMS cũ để rollback; WordPress source chuyển admin sang wp-admin |
| app/api/admin | Guard chung trả 410 khi WordPress/legacy được chọn, kể cả import/upload |
| i18n/routing.ts | Không đổi en mặc định, vi/bai-viet và bốn /blog |
| scripts/verify-cms.ts | Bộ test cũ giữ và chạy; thêm script E2E WordPress thật riêng |
| docs/CMS-DEPLOY.md | Hướng dẫn WordPress/cron mới; tài liệu Sheets cũ lưu bản LEGACY |
| next.config.ts | Bảo vệ preview/admin/API, metadata giải quyết trước header, tắt HMR fetch cache |
| .env.example | Chọn nguồn explicit, WordPress/HMAC/replay/credential migration riêng; không secret |

Sản phẩm vẫn ở nguồn cũ. `lib/google-sheets.ts` và API form liên hệ không
chuyển sang WordPress. Danh sách mã sản phẩm trong plugin là catalog tham chiếu
để chọn bài liên quan; không thành nguồn sản phẩm thay thế.

## Mapping 23 field

| Field | WordPress |
| --- | --- |
| id | `_cohamy_legacy_id`, unique hash trong cohamy_identity; WP ID riêng |
| group_id, locale, slug | `_cohamy_group_id`, `_cohamy_locale`, `_cohamy_public_slug`; hai unique key |
| title, excerpt, content_html | post_title, post_excerpt, post_content; Gutenberg do_blocks + kses và frontend sanitize |
| cover_image, cover_image_alt | Native featured attachment + ALT ưu tiên; meta legacy external URL/ALT khi chưa chuyển media |
| author | post_author cho quyền, `_cohamy_author` cho tên hiển thị cũ |
| category, tags | Native category và post_tag; một category Cohamy, tags giữ tên |
| featured, related_product_ids | `_cohamy_featured`, `_cohamy_related_product_ids` |
| seo_title, seo_description | rank_math_title/description; Native Helper::replace_vars trong context bài |
| canonical_url | `_cohamy_canonical_url` giữ cột legacy; không dùng làm canonical public |
| robots_index | Rank Math robots bài/custom defaults, tách khỏi robots của host CMS |
| status | publish→published, future→scheduled, trash→archived; pending/private chỉ ở WordPress, không public |
| scheduled_at | Native future post_date_gmt và meta legacy tương ứng |
| published_at | Native publish date hoặc meta lịch sử nguồn |
| created_at, updated_at | Meta lịch sử nguồn; editor update cập nhật UTC, migration preserve_dates giữ source/native modified |

WP post_name luôn nội bộ `cohamy-{id/uuid}`. Public slug không để WordPress tự
thêm hậu tố. Unique locale+slug, group+locale, ID cũ được thực thi ở database;
provisional reservation thất bại được giải phóng. Slug lịch sử của bài khác
không được lấy lại. Redirect trỏ thẳng về post hiện tại, không chain; đổi lại
slug cũ không tạo vòng. Locale của URL từng public được khóa; đổi locale báo
409, tạo bản dịch riêng cùng group_id để giữ URL. Đổi slug được hỗ trợ/kiểm thử.

## Public và quyền

Bridge `/wp-json/cohamy/v1/revision`, `/snapshot`, `/resolve` chỉ trả post đã
publish, không password và ngày publish không tương lai, có identity hợp lệ.
Không trả draft/private/pending/future/trash. Noindex published vẫn xem được
detail/list nhưng không sitemap/hreflang. Core WordPress REST giữ quyền native.
API meta Rank Math được đăng ký edit-context rõ ràng, không giả định vendor tự
public meta. Dữ liệu public được validation Zod, kiểm duplicate và sanitize.

Preview dùng grant HMAC 5 phút, nonce transient, gắn user/post; server kiểm
quyền edit_post lại mỗi lần. Next.js đổi grant thành HttpOnly cookie scoped
/preview, fetch server-only, no-store/noindex/no-referrer. Token là bearer,
không chia sẻ ra ngoài. Không bật Next Draft Mode trên route public: draft chỉ
đi qua route preview riêng, tránh cache hoặc URL public lộ draft.

Người viết: draft/pending riêng, upload và Rank Math cơ bản, không publish.
Người duyệt: native editor capabilities, publish và lịch. Admin cấu hình/import
migration/export. Quick Edit và Bulk Edit bị gỡ để tránh đường lưu thiếu guard.

## API bổ sung

Core REST dùng cho post/media/category/tag. Bridge cần endpoint riêng cho
identity/public snapshot/SEO đã resolve, preview grant và import batch vì core
không có đủ hợp đồng cũ. `/export` chỉ manage_options, có raw content, raw SEO,
wp_status, wp_id phục vụ đối chiếu và rollback. CSV preview/batch cần edit_posts,
gắn job với user và kiểm quyền mỗi dòng, preserve status cần publish_posts.

Không có chức năng server tải ảnh từ URL: external URL chỉ được lưu/hiển thị
client, không tạo SSRF downloader. Upload native WordPress kiểm MIME/quyền;
PHP local và proxy mẫu giới hạn kích thước. Giới hạn vận hành production cần
kiểm tra php.ini thực tế. Plugin không sửa core hoặc Rank Math.

## Độ mới và giới hạn

Mỗi render đọc revision authoritative no-store, cache snapshot theo revision.
Revision tăng cuối request; kiểm đầu/cuối snapshot, xung đột 409 retry tối đa
3 lần. Request đang chạy chỉ ghi key cũ; key mới không bị ghi lại dữ liệu cũ.
Webhook HMAC + outbox retry invalidates detail/list/home/translations/sitemap;
cache revision là dự phòng khi webhook mất và cơ chế đồng bộ các instance.

Bản nâng cấp đọc API detail/list phân trang và translations theo group, không dùng snapshot toàn bộ cho các trang public. Sitemap dùng inventory và shards tối đa5.000URL. Endpoint snapshot legacy vẫn giữ để tương thích/test, không dùng làm public data path chính. Timeout mặc định 8 giây; nhiều thay
đổi liên tiếp làm snapshot 409 ba lần thì báo lỗi rõ, không trả dữ liệu thiếu.
Multi-instance/CDN/shared filesystem chưa được thực nghiệm tại local.

Metadata/OG/Twitter/Article/Breadcrumb do Next.js render; không đưa raw getHead
hoặc Rank Math schema sang frontend. CMS sitemap bị tắt; HTML CMS noindex/301.
Không tuyên bố điểm SEO hay schema bảo đảm Google index/thứ hạng.


## Bổ sung bản nâng cấp vận hành

Next.js đã được vá lên 16.3.5, sharp lên 0.35.4 và đã đọc lại tài liệu cài mới,
gồm `revalidateTag` với `expire: 0` cho webhook. Plugin 2.0.9 có 15 bảng phục vụ
vận hành, campaign, export và inventory; hỗ trợ native pages, records/templates
có duyệt và version, worker phân tích Rank Math thật, native link tables,
JSON/mapped CSV và preview trên 250 dòng chạy nền. API public chỉ trả bài/trang
đã xuất bản. SEO chỉ trả title, description, robots, follow, pillar và social.
Focus keywords, score và analysis_state chỉ đọc qua ops có quyền; frontend
metadata keywords dùng tags public. API public không nhận context edit để đọc
nháp hoặc dữ liệu phân tích nội bộ.

Sitemap index thay `app/sitemap.ts` bằng `app/sitemap.xml/route.ts` và
`app/sitemaps/[name]/route.ts`; giữ URL trang/sản phẩm, kiểm điều kiện index và
robots mặc định, revision từng shard. Lỗi DB/CMS trả 503. Thay đổi Rank Math
titles/general hoặc blogname/blogdescription cập nhật revision, shard và outbox.
Noindex của host CMS không dùng làm robots public. Nội dung, thời gian, meta,
taxonomy và media được flush ở shutdown priority 999; transaction vận hành
gọi flush trước commit. Cron phục hồi sự kiện native bị mất cho bài đã đến hạn;
WordPress vẫn thực hiện bước kiểm trạng thái/thời gian và xuất bản.

Đối chiếu SHA chứng minh 5 path sản phẩm/contact không đổi. Source CRM, portal
và orders của tác vụ đồng thời được giữ. Default locale en và đường dẫn
vi/bai-viet giữ theo `i18n/routing.ts` hiện tại. Nhiều instance dùng revision
chung và replay filesystem atomic; CDN không được cache lỗi public. Nháp,
preview, admin và ops là private. Cluster/CDN/MariaDB chưa được chạy thực tế.
