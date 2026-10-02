# Sửa lỗi runtime CRM Cohamy — 02/10/2026

## Thay đổi thực tế

1. Gửi đơn gọi giữ hàng trong cùng transaction, đóng băng chính sách giữ và sử dụng kho bên bán. Xác nhận kiểm tra lại sau hết hạn; retry không giữ trùng. Worker chạy bảo trì giải phóng giữ tạm. Hủy/từ chối trả lại lượng giữ; nhiều allocation cùng balance không làm sai phép trừ.
2. API và form chuyển lên cấp trên tạo đề nghị mua riêng với giá riêng và Deal liên kết. Portal chỉ thấy đơn của chính mình hoặc giao dịch mà mình là bên bán; không tự xác nhận đơn mua của mình. Tuyến đơn sử dụng bên mua/bên bán đã đóng băng.
3. CMS legacy lưu trong PostgreSQL/PGlite thay cho Map. Bản nháp và public snapshot độc lập; revision bất biến, kiểm tra xung đột cập nhật. Public website, bài liên quan sản phẩm và chăm sóc dùng cùng nguồn. Form nhận HTML dài tới 180.000 ký tự; bộ lọc HTML chống script vẫn hoạt động. Bài đã xuất bản tồn tại sau khởi động lại.
4. ADD44 được ghi đúng là API contract. Có browser Edge thực cho biên tập/xuất bản/nháp/unpublish, gửi đơn, chuyển lên cấp trên, xác nhận đúng bên bán và màn hình desktop/390px. ADD45 tranh tồn bằng hai submit đồng thời trên PostgreSQL runtime DML.
5. Sửa khóa đối soát ngân hàng: function SECURITY DEFINER chỉ khóa đúng giao dịch được yêu cầu, không cấp UPDATE/DELETE sổ bất biến. Retry cùng idempotency key trả kết quả cũ; hai payment tranh một giao dịch chỉ một match thành công.
6. Sửa lint/types và đường dẫn Node/PM2 cho VPS Cohamy hiện tại. Các migration bổ sung: 026–029; không sửa checksum migration đã tồn tại trên production.

## Bằng chứng trước triển khai

| Kiểm tra | Phạm vi | Kết quả / file |
|---|---|---|
| Meeting 53 | LOCAL + STAGING PostgreSQL riêng | 45/45 PASS mỗi môi trường; meeting-53-*.json |
| Meeting contract | LOCAL + STAGING PostgreSQL riêng | 72/72 PASS mỗi môi trường; meeting-contract-*.json |
| Commercial orders, inventory | STAGING PostgreSQL riêng | PASS; commercial-orders-postgres.json, inventory-postgres.json |
| Finance | LOCAL + STAGING PostgreSQL riêng | 10 nhóm; finance-*.json |
| Browser runtime | LOCAL Edge + Next server/API | 5/5 PASS; meeting-runtime-browser-local.json |
| Restart CMS | LOCAL Edge, dừng và khởi động lại QA server | 1/1 PASS; meeting-runtime-browser-restart-local.json |
| Decimal, pricing-model | LOCAL | 6/6 và 10/10 PASS |
| ESLint, Next production build | LOCAL | Exit 0 |
| Build trace | LOCAL + VPS candidate | verify-build.mjs kiểm tra migration, tài nguyên và không lọt dữ liệu QA |

Dữ liệu nghiệp vụ được tạo bởi kiểm thử chỉ nằm trong các database QA riêng. Kiểm tra production sử dụng login/logout và đọc; không tạo đơn, giao hàng, chứng từ hoặc bài viết thử trên dữ liệu thật.

## Cấu hình và giới hạn

- Chính sách chưa chỉ định cho đơn mới: ON_SUBMIT, TTL 120 phút, allowPartial=true; đây là giả định kỹ thuật có thể chỉnh trong `/crm/requests/policy`. Chính sách AFTER_APPROVAL vẫn dùng kho thủ công.
- HTML tối đa 180.000 ký tự và JSON save article tối đa 524.288 bytes. API khác giữ giới hạn hiện hữu.
- BLOG_SOURCE thực tế được giữ theo cấu hình VPS. CMS legacy là nguồn đã kiểm chứng trong đợt này; WordPress báo read-only thay vì giả vờ lưu.
- Không tuyên bố mọi chi tiết của 53 mục đã được kiểm thử end-to-end chỉ vì suite dịch vụ xanh.

## Triển khai

Đang chuẩn bị push và deploy exact SHA. Dùng release riêng, backup và kiểm tra restore trước migration/cutover; chỉ thay tiến trình Cohamy web và CRM worker. Báo cáo production sau triển khai phải ghi exact SHA, migration, health HTTPS, PM2 và backup.
