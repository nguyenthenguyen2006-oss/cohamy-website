# Lưu người tạo đơn và phiếu kho

Các phiếu đề nghị, nhà máy, nhập kho, xuất/giao hàng, yêu cầu mua hàng, đơn bán và đơn khách hàng/siêu thị hiển thị người tạo. Chi tiết phiếu kho tách người tạo khỏi người xác nhận phiên bản.

Migration 049 bổ sung bảng `document_creators` bất biến. Trigger khi tạo chứng từ lấy user ID, tên hiển thị, email từ tài khoản trên máy chủ; API không nhận tên người tạo do trình duyệt tự nhập. Thay đổi tên, xóa tài khoản hoặc người khác xác nhận không làm thay người tạo gốc. ID người tạo trên chứng từ cũng không được đổi. Audit mới chụp riêng tên/email tại lúc thao tác; audit cũ không bị sửa.

Không backfill hoặc viết lại chứng từ/PDF đã chốt. Phiếu cũ tiếp tục dùng tên người lập đã lưu. Đơn cũ chưa có tên chụp lại chỉ tham chiếu tên tài khoản hiện tại và ghi rõ điều này; không gán tên hiện tại thành tên lịch sử giả. Email nội bộ không được bổ sung cho người xem portal khác chủ tài khoản.

LOCAL và STAGING PostgreSQL: 20 nhóm document-flow PASS, gồm tạo bằng thủ kho, đổi tên, Admin xác nhận, xóa thủ kho, tên/email gốc còn nguyên và PDF byte-for-byte không đổi. Hồi quy khách hàng/siêu thị 13 nhóm PASS. TypeScript, lint, build và catalog kiểm tra PASS. Chi tiết tại `test-results/document-creators/`.

**MCP có dùng được không?** Có: các lệnh tạo đơn/phiếu hiện có đi qua cùng trigger, không cần truyền tên người tạo.

**MCP có đọc được dữ liệu này không?** Có: workspace/view phiếu trả `creator`; danh sách yêu cầu/đơn bán/đơn khách hàng cũng có metadata người tạo. `cohamy_data` đọc bảng `document_creators` và `audit_events.actor_identity` cho Admin, theo phân trang hiện có. Catalog vẫn 339 operations. Bằng chứng production sẽ bổ sung sau triển khai.
