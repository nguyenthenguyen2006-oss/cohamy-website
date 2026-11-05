# Chính sách và giá bán website

Phạm vi: bảy chính sách tiếng Việt tại `/vi/chinh-sach/[slug]`, liên kết ở cả hai chân trang hiện có; giá và thao tác mua ở trang chủ, danh sách, chi tiết sản phẩm, giỏ hàng và thanh toán. Giữ nguyên sản phẩm, ảnh, bài viết, đường dẫn cũ và các luồng CRM.

## Giá và thuế

Giá niêm yết CRM chưa gồm VAT, theo xác nhận của người dùng. Tám quy cách đang bán dùng ánh xạ tường minh từ mã sản phẩm công khai sang `products.website_id`; không dò gần đúng theo tên và không dùng giá cũ của quy cách ngừng bán. Giá cơ sở, VAT và trạng thái sản phẩm lấy từ CRM.

Mức giảm mặc định 30%, lưu tại `storefront_settings`. Admin chỉnh tại **Quản trị hệ thống → Cài đặt → Giá bán website** (`/crm/storefront`), có bảng xem trước. Cấu hình này áp dụng cho mua lẻ website. Các bảng giá và chiết khấu đối tác tiếp tục dùng luồng hiện có.

Phép tính dùng số nguyên VND và làm tròn nửa lên: giảm tiền hàng trước thuế; tính VAT cho một đơn vị; nhân số lượng. Giá nổi bật và giá gạch cùng gồm VAT. Chi tiết sản phẩm cho biết tiền hàng sau giảm chưa thuế và tiền VAT. Ví dụ giá gốc 79.000, giảm 30%, VAT 8%: tiền hàng 55.300 + VAT 4.424 = 59.724 VND; giá gạch 85.320 VND. Phí giao nhận chờ xác nhận, tách khỏi tiền hàng.

## Đơn và quyền

Server tự xác định giá, không nhận đơn giá hoặc tổng tiền do trình duyệt gửi. `quoteVersion` thay đổi khi cấu hình hoặc dữ liệu giá thay đổi. Trang mua yêu cầu khách kiểm tra lại khi giỏ còn giá cũ; server từ chối báo giá cũ bằng `PRICE_CHANGED`. Lần gửi lại của yêu cầu đã được lưu trả đúng biên nhận và số tiền ban đầu, kể cả sau khi Admin đổi giá.

Yêu cầu được ghi `PENDING_REVIEW`, `paid=false`, còn cần đối chiếu vận chuyển và thanh toán; không tự thu tiền hoặc trừ kho. Dòng hàng lưu ảnh chụp giá cơ sở, mức giảm, giá chưa VAT, thuế và tổng gồm VAT. Xác nhận đã đọc chính sách phiên bản 2026-11-05 được lưu trong sự kiện audit tiếp nhận đơn; không suy diễn thành đồng ý quảng cáo. Yêu cầu mới bắt buộc có phiên bản báo giá và chính sách; phát lại biên nhận cũ vẫn tương thích khi thiếu hai trường mới.

Cấu hình đọc/ghi chỉ cho Admin đang có hiệu lực. Ghi dùng phiên bản, khóa giao dịch, idempotency và audit; biên nhận thao tác là bất biến. Danh mục thiếu giá, sai quy cách, ngừng hoạt động hoặc lỗi tải không trở thành sản phẩm miễn phí.

Migration mới: `055-storefront-pricing.sql`, thêm cấu hình và biên nhận; không sửa giá, thuế, tồn kho hoặc đơn cũ.

## MCP

- `GET /api/crm/storefront`: cấu hình và giá hiện hành.
- `POST /api/crm/storefront`: Admin đổi phần trăm giảm qua cùng dịch vụ với website.
- `GET /api/crm/storefront/policies`: toàn bộ nội dung bảy chính sách, tiếng Việt; chỉnh nội dung qua bản phát hành nguồn.
- `cohamy_data`: đọc cấu hình và ảnh chụp đơn website; biên nhận kỹ thuật nội bộ bị loại khỏi danh mục dữ liệu.

Phải chạy `npm run crm:mcp:catalog` và `npm run test:crm:mcp:catalog` khi thay API/hợp đồng. Các kiểm thử và bằng chứng theo môi trường nằm ở `docs/crm/test-results/storefront/`. QA dùng cơ sở dữ liệu riêng, email giả và tắt gửi thư. Chỉ kiểm tra đọc trên production; không tạo đơn hoặc thay giá thật để chứng minh tính năng.

Nội dung chính sách và nguồn pháp luật được đối chiếu tại `docs/STORE-POLICIES-CONTENT-REVIEW.md`. Giao diện là phần mở rộng của thiết kế hiện có; không thay `DESIGN.md` toàn cục hoặc tạo ảnh mới.

Theo ảnh phản hồi bổ sung của người dùng, gallery bỏ khung vuông và hai dải trắng. Ảnh chính giữ toàn bộ nội dung ở tỷ lệ tự nhiên; `data/product-image-dimensions.ts` ghi kích thước thật của 91 ảnh để trình duyệt dành đúng chỗ ngay từ lúc tải. Tạo lại dữ liệu này khi thay ảnh bằng `node --import tsx scripts/generate-product-image-dimensions.ts`. Thông báo thành công/lỗi trong Admin dùng màu chữ tối của CRM trên nền trắng và giữ vòng focus sẵn có của CRM.

Kiểm tra phát hành đối chiếu nguồn hóa đơn hiện hành. Hiện bốn bảng yêu cầu/đơn bán và phiên bản đều trống; API/MCP cùng trả 404 cho mẫu lịch sử. Kiểm tra live ghi rõ NO_LIVE_SOURCE và PDF dương tính NOT_RUN; bộ hồi quy giả độc lập vẫn đạt 14 nhóm PDF và 8 nhóm API. Tài liệu và PDF bằng chứng giữ riêng tại storefront/invoice-regression, không tạo lại nguồn dữ liệu thật.

Bản production: 4765454c927d7268b0a04e5d5415cae3643484bf. Hai bản backup 240 bảng khôi phục PASS; 18 kiểm tra ứng viên và 18 HTTPS công khai PASS; web/worker đúng release, online và không restart. Trình duyệt production xác nhận ảnh vừa tỷ lệ gốc, giá thật hạt điều 61.992 VND gồm VAT, đủ 7 liên kết ở 1440/390px. MCP kết nối thật đọc được 8 giá, 7 chính sách và cấu hình 30%; cả ba operation mới AVAILABLE. Kiểm thử ghi cấu hình thực hiện trên STAGING; không đổi mức giảm hoặc tạo đơn thật để xác minh. QA database/role/tunnel đã dọn, backup được giữ.
