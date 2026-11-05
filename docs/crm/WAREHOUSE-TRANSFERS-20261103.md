# Chuyển kho cho thủ kho HCM / Hà Nội — 03/11/2026

Menu `Chuyển kho` tại `/crm/warehouse-transfers` dành cho Admin/Manager và các tài khoản kho. HCM chọn vị trí nguồn có hàng khả dụng và vị trí nhận thuộc kho Hà Nội, nhập số lượng từng sản phẩm/lô rồi xuất. Hệ thống trừ tồn nguồn, lưu snapshot và ghi trạng thái đang chuyển. Nhóm kho Hà Nội nhận thông báo liên kết tới phiếu; chỉ kho đích được xác nhận thực nhận. Thực nhận tăng tồn đích, thiếu hụt ghi riêng; hỗ trợ nhận từng phần và chốt có thiếu.

Tái sử dụng `inventory.shipTransfer` / `inventory.receiveTransfer`, không tạo hệ thống chuyển kho thứ hai. Thêm khóa idempotency theo tài khoản và UUID để hai request giống nhau cùng trả về một kết quả; dòng xuất trùng sản phẩm/lô bị từ chối. Giữ khóa bản ghi khi nhận, version/checksum snapshot, quyền kho nguồn/đích, tồn khả dụng và lịch sử người xuất/nhận. Biểu mẫu dùng cơ chế retry hiện có của CommercialForms, giữ nguyên khóa khi mất phản hồi. Không lưu dữ liệu biểu mẫu vào bộ nhớ trình duyệt mới.

## Giao diện và API

- Danh sách dạng bảng: STT, mã/ngày, kho nguồn/đích, trạng thái, số gửi/thực nhận/thiếu, người xuất và thao tác theo quyền.
- Tìm theo mã/kho, lọc gửi/nhận và trạng thái, phân trang 50 phiếu. Làm mới 20 giây khi tab đang hiển thị và không sửa biểu mẫu.
- Thông báo chuyển kho trong trang mới và tab Thông báo chứng từ đang dùng; không khôi phục các module thông báo cũ đã gỡ.
- `GET /api/crm/inventory/transfers`: query `page`, `q`, `direction=ALL|INCOMING|OUTGOING`, `status=ALL|IN_TRANSIT|PARTIAL|SHORT|RECEIVED`.
- `POST /api/crm/inventory/transfer-ship`: `sourceLocationId`, `lines[{productId,lotId,quantity,destinationLocationId}]`, `reason`, `idempotencyKey`.
- `POST /api/crm/inventory/transfer-receive`: `id`, `version`, `lines[{index,quantity,shortage}]`, `final`, `reason`, `idempotencyKey`.
- Kho nguồn chỉ gửi; kho đích chỉ nhận. Tài khoản cùng địa điểm xem và xử lý cùng phạm vi. Người thuộc kho/tổ chức khác không được vượt scope bằng cách gọi trực tiếp API.

MCP sử dụng cùng API/RBAC: catalog đã sinh lại và kiểm tra, 356 operations / 248 đang dùng. Bổ sung mô tả schema chính xác cho hai lệnh xuất/nhận để ChatGPT web tra vị trí, tồn và điều khiển được. Thử đọc phân trang và ghi xuất/nhận qua native MCP bridge trên QA; không tạo giao dịch thật để test production.

## Migration và dữ liệu

`054-inventory-transfer-notifications.sql` chỉ mở rộng CHECK entity_type cho `inventory-transfer`, không thêm/xóa bảng và không viết lại dữ liệu. Registry có 56 file migration sau cập nhật (số thứ tự tên file không phải tổng file). Rehearsal trên backup production giữ nguyên fingerprint 23 bảng, gồm tài khoản, hàng hóa, tồn/biến động/giữ hàng, chứng từ, công nợ, transfer/receipt, thông báo và mail outbox.

Thông báo nội bộ nằm cùng transaction ghi kho, chống trùng theo sự kiện/phiếu/version/người nhận. Không tự thêm email, không gửi lại email cũ.

## Kiểm chứng

- LOCAL PGlite: 12 nhóm chuyển kho + 10 nhóm hồi quy inventory PASS.
- PostgreSQL 17 role DML tách biệt: 12 nhóm mới + 11 inventory + 28 document-flow PASS. Fixture cạnh tranh giữ hàng giải phóng giữ tự động sau CONFIRM trước khi thử giữ thủ công; không thay đổi nghiệp vụ sản xuất.
- Edge headless trên localhost, dữ liệu giả: 4 nhóm PASS, HCM gửi 6 / Hà Nội thực nhận 5 / thiếu 1; mô phỏng mất phản hồi đã commit và retry cùng UUID, không cộng tồn hai lần.
- Responsive 375/768/1440 được chụp và đối chiếu mắt; không tràn toàn trang, bảng cuộn trong vùng riêng. Visual regression INCONCLUSIVE vì chưa có baseline; không đo Core Web Vitals trên dev và chưa chạy screen reader.
- TypeScript, production build và build tracing PASS. HTTP production build trên clone: 7 nhóm PASS, gồm 6 tài khoản kho và từ chối truy cập ẩn danh. Kiểm tra MCP production được lưu riêng trong thư mục tác vụ `warehouse-transfer-ui-20261103`.

## Triển khai / rollback

Trước cutover: kiểm tra SHA hiện tại là tổ tiên, backup mới có phục hồi đối chiếu, dừng đúng hai tiến trình Cohamy, áp dụng migration atomically bằng owner, xác nhận 23 bảng giữ nguyên, rồi chạy source mới bằng runtime DML. Source cũ và backup được giữ. Rollback source giữ CHECK rộng của migration 054 và dữ liệu hiện tại; không phục hồi đè database nếu đã phát sinh giao dịch.

Source giữ trên máy và VPS theo lựa chọn của người dùng, không đẩy GitHub. Các QA session/database/role được dọn sau kiểm thử; không dùng tài khoản thật trong kiểm thử trình duyệt.
