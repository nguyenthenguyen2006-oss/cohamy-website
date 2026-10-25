# Admin sửa và thu hồi hóa đơn

Admin nội bộ có thể mở **Tất cả hóa đơn · Sửa / Thu hồi (Admin)** tại màn hình chứng từ nhà máy/kho. Các nút tương tự nằm tại chi tiết hóa đơn bán hàng, hóa đơn cũ, chứng từ và VAT. Các vai trò khác không được gọi API này.

`GET /api/crm/admin-invoices` phân trang 50 dòng, lọc `kind`, `q`, `offset`, `includeCancelled`. Truyền `kind` và `id` để đọc nội dung hiện tại, phiên bản, lịch sử và dự kiến biến động kho khi thu hồi. Các loại được hỗ trợ: `FLOW`, `SALES`, `HISTORICAL`, `VAT`, `TRANSFER`.

`POST /api/crm/admin-invoices` nhận `kind`, `id`, phiên bản hiện tại, `action: EDIT | CANCEL`, lý do ít nhất 5 ký tự và UUID `idempotencyKey`. `EDIT` cần nội dung theo `invoiceContentSchema`. Số lượng dùng đơn vị tồn kho gốc; tiền là chuỗi số nguyên VND. Giao diện chọn tên và ảnh sản phẩm, không buộc người vận hành đọc SKU. Bảng sửa không hiển thị cột thuế dòng; giữ nguyên thuế từ chứng từ nguồn khi người dùng sửa các trường khác.

## Tồn kho và tiền

- Thu hồi hàng đã xuất bù đúng số thực xuất ròng về **kho, vị trí và lô ban đầu**. Hóa đơn chưa xuất chỉ giải phóng phần giữ hàng; không cộng tồn giả.
- Thu hồi một phiếu giao từng phần chỉ trả lại phần của phiếu đó và giảm đơn bán tương ứng. Những lần giao khác vẫn còn hiệu lực.
- Sửa số lượng chỉ ghi phần chênh lệch. Giữ và tiêu thụ hàng được đồng bộ với phiên bản mới; sửa riêng ghi chú không thay số giữ hàng, giá niêm yết hoặc chiết khấu đã chốt.
- Thu hồi phiếu nhập trừ hàng đã nhập. Nếu hàng cùng lô đã dùng hoặc đang giữ cho đơn khác, toàn bộ giao dịch bị từ chối; cần xử lý phiếu xuất liên quan trước.
- Thu hồi chuỗi nhà máy xử lý phiếu đề nghị, gửi kho và nhập kho liên quan trong cùng giao dịch. Chuyển kho bù ở cả kho đi và kho đến; hàng chưa xác định sản phẩm giữ nguyên lịch sử, không tự suy đoán mã hàng.
- Công nợ và hạn mức được điều chỉnh cùng giao dịch. Tiền thực thu không bị xóa hoặc coi là đã hoàn; phần phân bổ bị đảo được giải phóng để đối chiếu hoặc phân bổ lại.
- Mã chứng từ gốc giữ cố định. Giá, thuế và chiết khấu của phiếu giao có nguồn đơn bán được sửa ở hóa đơn `SALES` nguồn. Phiếu chuyển giữ danh mục, lô và kho nguồn; có thể sửa số lượng hoặc thu hồi.

Mỗi lệnh khóa tổ chức, kiểm tra phiên bản và lưu kết quả để phát lại khi thử lại. Thu hồi lần hai không ghi thêm tồn kho hoặc tiền. Lệnh khác dùng phiên bản cũ bị từ chối. Các API trả hàng cũ không được hoàn lại lần nữa đối với nguồn đã điều chỉnh bằng cơ chế này.

## Lịch sử và dữ liệu gốc

Migration `046-admin-invoices.sql` bổ sung `invoice_admin_heads` cho phiên bản hiện tại, `invoice_admin_revisions` và `invoice_allocation_reversals` cho lịch sử bất biến. Runtime không có quyền sửa/xóa hai bảng lịch sử. Giữ nguyên ảnh hóa đơn cũ, snapshot, PDF và bút toán gốc; thêm bản mới và bút toán bù. Hóa đơn thu hồi bị loại khỏi các danh sách và tổng đang hiệu lực, vẫn tra cứu được bằng bộ lọc lịch sử.

Hóa đơn cũ đã đối chiếu với đơn bán sẽ điều chỉnh đơn bán liên kết. VAT có đơn bán/phiếu nguồn sẽ xử lý nguồn tương ứng. VAT độc lập hoặc hóa đơn cũ chưa có bút toán không tự sinh thêm số tồn.

## MCP

MCP có dùng được không? Có: `cohamy_capabilities` khám phá GET/POST ở trên; `cohamy_read` đọc trước, `cohamy_write` sửa/thu hồi với phiên bản, lý do và khóa chống lặp gốc.

MCP có đọc được dữ liệu này không? Có: API hiện tại trả nội dung, dự kiến thay đổi kho và lịch sử. `cohamy_data_catalog`/`cohamy_data` đọc phân trang ba bảng mới. Snapshot/ảnh cũ chỉ là bằng chứng gốc, cần đọc API hiện tại hoặc head để biết hóa đơn còn hiệu lực. Không đưa mật khẩu, key hay lệnh SQL/shell vào công cụ.

Thử lại qua MCP phải giữ nguyên cả `requestId` và `idempotencyKey`. Nếu MCP báo `OUTCOME_UNKNOWN`, đọc hóa đơn/lịch sử trước khi quyết định thử lại.

## Kiểm chứng

- `node --require ./scripts/register-server-only.cjs --import tsx scripts/crm/verify-admin-invoices.ts`: 14 tình huống LOCAL với dữ liệu giả và email tắt.
- Bản sao PostgreSQL dùng runtime role thật: thu hồi đồng thời, thử lại, dữ liệu hóa đơn cũ/PDF không đổi, đảo chuyển HCM–HN 84 gói, giữ nguyên 8 gói chưa rõ loại và chặn sửa/xóa lịch sử. Thêm kiểm tra sửa ghi chú trên đơn có chiết khấu thật sao chép từ production.
- `node scripts/crm/verify-admin-invoices-browser.mjs`: trình duyệt Edge và official MCP SDK trên candidate STAGING qua tunnel sở hữu riêng. Lệnh ghi chỉ chạy với dữ liệu sao chép; kiểm tra tồn trước/sau và cả hai tầng chống lặp.
- `node scripts/crm/verify-admin-invoices-browser.mjs --production`: UI và MCP công khai, chỉ đọc dữ liệu nghiệp vụ; OAuth QA được thu hồi sau kiểm tra.
- `npm run crm:mcp:catalog` và `npm run test:crm:mcp:catalog`: sinh/kiểm tra danh mục API sau thay đổi hợp đồng hoặc service.

Biên bản theo môi trường nằm tại `docs/crm/test-results/admin-invoices/`. Kết quả LOCAL hoặc STAGING không tự chứng minh đã phát hành production.
