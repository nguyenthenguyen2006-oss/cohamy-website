# Chuyển kho theo sản phẩm và số gói

Biểu mẫu xuất chuyển kho gộp các dòng tồn theo sản phẩm tại vị trí nguồn. Mỗi sản phẩm chỉ hiện một dòng, số khả dụng là tổng số gói có thể xuất. Người dùng nhập số gói, không nhập hoặc xem mã lô. Biểu mẫu thực nhận và chi tiết phiếu cũng gộp sản phẩm; số thực nhận/thiếu được phân bổ về các dòng chứng từ gốc ở bên trong.

Giữ dữ liệu lô và snapshot đã xác nhận để bảo toàn lịch sử. Khi xuất, phân bổ theo hạn dùng sớm trước, kiểm tra và khóa từng số dư tại backend. Khi nhận, chỉ cộng số thực nhận và ghi thiếu riêng. Tính bằng số nguyên theo độ chính xác 6 chữ số, không cộng số thực JavaScript; định dạng hiển thị bỏ số 0 thập phân dư và dùng dấu phân cách Việt Nam.

Chỉ vị trí soạn hàng `PICK` được chọn làm nguồn/đích của phiếu chuyển mới. Backend từ chối gọi trực tiếp API xuất từ/vào vị trí cách ly hoặc hỏng. Dữ liệu lịch sử vị trí vẫn được giữ; không xóa tồn hoặc chuyển loại hàng cũ. Các phiếu cũ vẫn có thể được nhận theo snapshot gốc.

`GET /api/crm/inventory/transfers` có thêm `products` để MCP đọc cùng dữ liệu tổng theo sản phẩm/vị trí; giữ `balances` để tương thích và lưu vết. `locations`/`destinationLocations` chỉ trả vị trí soạn đang hoạt động trong phạm vi quyền. Hai API POST xuất/nhận giữ nguyên contract, version và idempotency. Không có migration hoặc ghi sửa dữ liệu production trong bản cập nhật này.

Kiểm thử gồm gộp nhiều dòng tồn, số lượng lớn/phần lẻ, phân bổ qua nhiều lô, nhận và ghi thiếu qua nhiều dòng, retry, quyền HCM/Hà Nội và từ chối vị trí cách ly qua API/MCP. Kiểm thử trình duyệt bằng tài khoản/dữ liệu giả; bằng chứng production chỉ đọc. Source giữ trên máy/VPS theo lựa chọn người dùng.
