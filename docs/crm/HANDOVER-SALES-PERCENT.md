# Phiếu xuất kho bán hàng: chiết khấu theo sản phẩm

Luồng `ISSUE` mới với mục đích `SALE` chọn khách hàng đã có quan hệ với đơn vị bán. Mỗi dòng lấy giá bán niêm yết từ danh mục và có `discountPercent` riêng; dòng mới bắt đầu ở 0%. Không nhận số tiền giảm trực tiếp, đơn giá sau giảm hoặc tỷ lệ chung cho phiếu.

CK nằm trong khoảng 0–100%, tối đa bốn chữ số thập phân. Hệ thống dùng số nguyên/fixed-point, làm tròn HALF_UP đơn giá sau CK về đồng trước, sau đó nhân số lượng để tính tiền dòng. Ví dụ A: 2 × 90.000 × 90% = 162.000; B: 3 × 50.000 × 80% = 120.000; C: 1 × 80.000 × 95% = 76.000. Tổng gốc 410.000, CK 52.000, sau CK 358.000 đồng.

VAT theo từng sản phẩm chỉ được tính khi người dùng bật lựa chọn VAT. Phí vận chuyển được cộng một lần. Giá gốc và thuế suất danh mục đã lưu trong nháp được giữ khi xác nhận; sản phẩm thêm mới lấy giá danh mục hiện tại. Giá trên phiếu có nguồn đã chốt được giữ theo nguồn đó.

Lưu nháp không xuất kho, ghi đơn bán hoặc ghi phải thu. Xác nhận tạo liên kết thật tới yêu cầu, đơn bán, clearance và khoản phải thu trong cùng giao dịch với lần xuất kho duy nhất. Không tạo hạn mức, credit hold hoặc thanh toán giả. Phiếu 0 đồng không tạo khoản phải thu 0 đồng. Phiếu SAMPLE/GIFT/OTHER và chứng từ lịch sử không được tự chuyển thành doanh thu.

Thanh toán dùng `payment_receipts` và `payment_allocations`. Sales báo thu vẫn là PENDING; kế toán/Admin xác nhận khoản thu mới làm tăng đã trả. Không ghi bản sao vào `order_payment_transactions`. SALE mới không nhận lệnh xác nhận tổng tiền kiểu cũ; dùng mã khoản thu chuẩn để duyệt từng khoản. Số đã trả/còn nợ hiện tại được đọc riêng với PDF đã lưu tại thời điểm chốt.

Admin sửa số lượng/CK/phí qua `admin-invoices` trên nguồn SALES hoặc phiếu FLOW liên kết; server giữ giá gốc/thuế suất và kiểm tra số tiền tính lại. Thu hồi bù tồn kho đúng một lần, điều chỉnh phải thu và phân bổ khoản thu, giữ tiền đã nhận cùng lịch sử; không tự tạo hoàn tiền. PDF và snapshot cũ vẫn đọc được theo revision.

## MCP

MCP có dùng được không? Có: các thao tác save/view/confirm/pdf, thanh toán chuẩn và sửa/thu hồi Admin đã được kiểm thử qua native MCP dispatch trên PostgreSQL QA hạn chế quyền.

MCP có đọc được dữ liệu này không? Có: workspace/view, đối soát, PDF theo từng chunk và dữ liệu phân trang gồm `warehouse_sale_links`, `warehouse_sale_payment_links`, đơn bán, phải thu và khoản thu. Catalog được tạo lại bằng `npm run crm:mcp:catalog`, kiểm tra bằng `npm run test:crm:mcp:catalog`. Catalog có hợp đồng CK từng dòng, không chấp nhận giá/tiền giảm tùy ý.

## Bằng chứng phát hành

Xem `test-results/handover-sales/`: pricing-local (17), flow-local (16), finance-local (10), flow-postgres (16), finance-concurrency-postgres (5), mcp-postgres (7), và browser (6). Các bộ hồi quy phiếu, Admin và tài chính cũ được lưu riêng trong cùng thư mục. Giao diện Edge đã kiểm tra 1440px/390px/320px; PDF staging đã đối chiếu số tiền và từng CK%. Triển khai và đọc MCP production được ghi riêng sau kiểm tra thực tế. Tất cả dữ liệu giao dịch kiểm thử là giả, thuộc database LOCAL/STAGING riêng; không chạy worker hoặc gửi mail ngoài.
