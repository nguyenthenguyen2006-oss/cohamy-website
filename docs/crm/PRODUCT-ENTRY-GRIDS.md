# Bảng nhập sản phẩm trong chứng từ CRM

Phạm vi này mở rộng giao diện CRM Golden-Orange hiện có: các chứng từ số lượng dùng bảng hàng điền sẵn để người vận hành nhập trực tiếp theo từng dòng. Tên sản phẩm, ảnh và đơn vị đứng trước các cột nghiệp vụ; SKU không có cột hiển thị trong bảng nhập. UUID/SKU vẫn được giữ trong liên kết và payload để server kiểm tra đúng sản phẩm.

## Cách nhập chung

- Lọc theo tên chỉ ẩn dòng, không tháo dòng khỏi biểu mẫu; số lượng đã nhập ở dòng bị ẩn vẫn được giữ và gửi khi lưu.
- Enter hoặc mũi tên xuống chuyển đến ô số lượng kế tiếp đang hiển thị; mũi tên lên chuyển về ô trước. Các bảng danh mục có nút cộng nhanh +10/+20/+50/+100.
- Bảng dùng tiêu đề cột cố định khi cuộn, tên hàng có thể xuống dòng, số lượng căn phải. Trên mobile, bảng cuộn ngang trong vùng riêng và có hướng dẫn “Vuốt ngang bảng…”.
- Ảnh dùng nguồn ảnh sản phẩm hiện có và ảnh dự phòng của CRM. Không tạo tài sản raster mới. Đơn vị chưa cấu hình hiển thị “Chưa khai báo”; giao diện không tự suy đoán quy đổi.
- Dòng danh mục để trống hoặc bằng 0 không được đưa vào chứng từ. Giá trị nhập sai vẫn đi đến kiểm tra server để báo lỗi, không bị âm thầm bỏ qua.
- Phiếu thực nhận của luồng nhà máy giữ số 0 rõ ràng; kiểm kê giữ số đếm 0, bỏ qua dòng chưa nhập. Nhận chuyển kho giữ thực nhận 0 để khai thiếu; lần nhận chỉ có thiếu hụt không tạo movement tồn kho bằng 0.

## Phạm vi và nguồn dòng hàng

| Chứng từ / thao tác | Dòng được điền sẵn | Cột nghiệp vụ chính |
| --- | --- | --- |
| Đề nghị nhà máy | Danh mục có đơn vị kho | Số lượng đề nghị, ghi chú |
| Nhà máy gửi về kho | Dòng còn phải giao của đề nghị nguồn | Còn phải giao, thực gửi, ghi chú |
| Kho nhận từ nhà máy | Dòng của phiếu chuyển nguồn, số chuyển làm lượng nhận ban đầu | Số chuyển, thực nhận, lý do chênh lệch |
| Xuất kho theo đơn / độc lập | Phần đơn nguồn chưa xuất; hoặc hàng có tồn khả dụng tại kho đã chọn | Còn phải giao khi có đơn, khả dụng tại kho, thực xuất |
| Admin đính chính | Dòng và đơn vị theo chứng từ đã khóa | Số lượng bản trước, số lượng đính chính |
| Yêu cầu thương mại mới, đặt lại và sửa | Danh mục, ghép với các dòng đã lưu hoặc nguồn đặt lại | Đơn vị đặt, số lượng, giá riêng, tạm tính sau chiết khấu |
| Báo giá và phiên bản mới; thay đổi đơn | Danh mục, giữ các dòng của phiên bản đang sửa | Đơn vị, số lượng, giá và tạm tính; server tính lại khi preview |
| Nhập kho thủ công | Danh mục có đơn vị kho | Thực nhập, mã lô, ngày sản xuất, hạn dùng |
| Xuất chuyển kho | Lô AVAILABLE còn khả dụng tại vị trí nguồn | Khả dụng, số lượng chuyển; kho đích cùng chủ sở hữu và khác kho |
| Nhận chuyển kho | Dòng snapshot còn chờ nhận sau các lần nhận/khai thiếu trước | Đã xuất, còn chờ nhận, thực nhận lần này, thiếu lần này |
| Ghi kiểm kê | Lô/vị trí thuộc kho của phiên kiểm kê | Tồn theo sổ, thực đếm |
| Lập đợt giao | Reservation ACTIVE/PARTIAL của đơn còn lượng chưa lên kế hoạch giao | Còn có thể giao, số lượng đợt này |
| Soạn hàng | Dòng của đợt giao còn chưa soạn đủ | Còn phải soạn, lượng soạn, mã quét sản phẩm/lô, lựa chọn thủ công từng dòng |
| Đóng kiện | Dòng đã soạn còn chưa đóng đủ | Đã soạn, còn chờ đóng, số lượng vào kiện |
| Hàng chờ bổ sung | Sản phẩm của đơn còn thiếu reservation và chưa có backorder OPEN | Chưa được giữ hàng, lượng chờ bổ sung, ngày dự kiến |
| Yêu cầu trả | Dòng đã giao còn quyền yêu cầu trả | Còn được yêu cầu trả, số lượng, lý do từng dòng |
| Nhận hàng trả | Dòng của yêu cầu trả đã được cấp cho biểu mẫu | Đề nghị trả, thực nhận, phân loại, vị trí phù hợp, lý do |

Các bảng nguồn không mở toàn bộ danh mục để chèn hàng ngoài chứng từ. Quyền, kho, trạng thái, số lượng còn lại và phiên bản vẫn được kiểm tra tại server. Batch soạn hàng và backorder giữ tương thích payload đơn trước đây; mỗi lần lưu kiểm tra toàn bộ dòng trong transaction, giữ idempotency và bằng chứng quét/thủ công của từng dòng. Một dòng sai không lưu một phần batch.

Xác nhận vẫn dùng snapshot bất biến và liên kết đúng phiên bản. Sửa cách nhập không chuyển preview thành ghi sổ, không mở quyền kế toán chỉnh kho, không đổi ảnh/tên trong chứng từ đã khóa thành dữ liệu danh mục hiện tại.

## Thành phần và giới hạn

`ProductEntryGrid.tsx` và `product-entry-grid.css` cung cấp bảng chung. `FlowProductLines`, `CommercialProductGrid`, `InventoryProductForms` và `FulfillmentProductForms` cung cấp nguồn dòng và cột theo ngữ cảnh; được nối vào workspace/chứng từ đang sử dụng.

Procurement và ký gửi CRM đã nghỉ, cùng các editor kho/kế toán cũ không được render, được giữ nguyên. Bộ chọn sản phẩm trong cấu hình giá/khuyến mại tiếp tục là bộ chọn theo tên vì đó là cấu hình, không phải phiếu nhập nhiều số lượng. Tài liệu này không mở lại các luồng đã nghỉ.

## Bằng chứng LOCAL

| Bằng chứng | Kết quả ghi nhận | Giới hạn |
| --- | --- | --- |
| `test-results/product-entry/browser-local.json` | 8/8 PASS, Edge thật + PGlite cô lập | Luồng nhà máy/kho/kế toán, bảng danh mục, giữ giá trị khi lọc và bàn phím; provider tắt |
| `test-results/product-entry/operations-browser-local.json` | 3/3 PASS, Edge thật + PGlite cô lập | Batch soạn hàng, backorder và yêu cầu thương mại qua GUI |
| `test-results/document-flow/integration-pglite.json` | 19/19 PASS | Transaction, snapshot, phân quyền, tồn kho, VAT và mail giả |
| `test-results/fulfillment-local.json` | 10/10 case PASS | Có rollback batch sai và retry/idempotency cho soạn hàng/backorder |
| `test-results/inventory-local.json` | 10/10 case PASS | Có nhận chuyển kho chỉ khai thiếu với thực nhận 0 |
| `test-results/product-entry/build-traces-local.json` | PASS | Kiểm tra dấu vết build; không chứng minh runtime production |

Lượt triển khai ghi nhận TypeScript PASS và optimized build thành công (176 trang, 97 route traces, 44 migration). Dữ liệu kiểm thử là giả lập LOCAL; không có đơn, tồn kho, tiền hoặc gửi mail thật. Tại thời điểm lập tài liệu, chưa xác nhận triển khai production.

Ảnh đã đối chiếu trong `.impeccable/review/`: `desktop.png`, `mobile.png`, `user-320.png`, cùng cặp desktop/mobile của picking, backorder và commercial. Ba ảnh đầu chứng minh bố cục trang ở desktop, 390px và 320px; các ảnh sau là capture thành phần. Finish reviewer trả `ship` sau khi chấm hai sửa chữa picking/backorder là resolved; verdict đó chỉ có phạm vi hai sửa chữa, không chứng nhận mọi trạng thái hoặc toàn bộ hệ thống.
