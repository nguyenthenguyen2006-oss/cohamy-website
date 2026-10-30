# Bảng tồn kho: bỏ số 0 thừa và thêm STT

Bảng “Tồn kho được phân công” trước đây in nguyên chuỗi numeric(30,6) từ API, nên `109.000000` bị ngắt dòng trong ô hẹp. Giao diện dùng lại phép tính thập phân BigInt hiện có để hiển thị `109`, `0`, `12.34`, giữ chính xác tối đa 6 chữ số lẻ. Không chuyển số lượng qua JavaScript Number, không làm tròn và không đổi số liệu kho.

Cột STT đứng đầu và đánh lại từ 1 theo danh sách sau khi lọc kho/tên sản phẩm. Các cột số căn phải và không xuống dòng; kho/tên sản phẩm có chiều rộng tối thiểu. Điện thoại cuộn ngang trong khung bảng. Trạng thái không có kết quả gộp đủ 10 cột.

Chỉ sửa `DocumentFlowWorkspace.tsx` và CSS dùng cho bảng này. Không thay API, schema, ghi sổ, quyền truy cập hay PDF đã chốt. Catalog MCP giữ nguyên 339 operations và kiểm tra đồng bộ PASS.

LOCAL: TypeScript, lint, production build và kiểm tra tracing PASS. Edge với tài khoản WAREHOUSE_HN/WAREHOUSE_HCM trên PGlite riêng xác minh 3 nhóm: dữ liệu đúng kho, 10 cột/STT, số lượng khớp API, số lẻ 6 chữ số và số nguyên lớn chính xác, lọc/không kết quả, căn số không ngắt dòng và cuộn trên điện thoại. Không có lỗi JavaScript hay gửi mail ngoài. Bằng chứng trong `test-results/stock-view/`.

**MCP có dùng được không?** Có, thao tác kho giữ nguyên API và phân quyền.

**MCP có đọc được dữ liệu này không?** Có: `GET /api/crm/document-flow/workspace` trả tồn đầu, nhập, xuất, tồn, giữ hàng theo kho. Định dạng số gọn và STT thuộc giao diện; API vẫn trả chuỗi thập phân chính xác để ChatGPT tính toán, đối chiếu. Đã đọc runtime production trước khi sửa; bằng chứng sau triển khai sẽ bổ sung.
