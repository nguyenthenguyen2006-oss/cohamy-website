# Kho HCM và Hà Nội dùng chung theo địa điểm — 03/11/2026

Tài khoản WAREHOUSE_HCM cùng dùng phạm vi kho SOUTH của tổ chức Cohamy; tài khoản WAREHOUSE_HN cùng dùng phạm vi NORTH. Phân công cá nhân thiếu, cũ hoặc trỏ nhầm địa điểm không thể thu hẹp nhóm cùng khu vực hoặc mở quyền sang khu vực khác. Vai trò WAREHOUSE chung tiếp tục sử dụng kho được Admin phân công rõ ràng.

Predicate nhận thông báo dùng chung với quy tắc phạm vi cho đơn Portal và chứng từ. Từ lúc Admin xác nhận đề nghị sản xuất/cấp hàng, cả nhóm kho nhận dự kiến nhận thông báo để theo dõi kế hoạch. Phiếu chuyển, thực nhận và xuất hàng tiếp tục gửi cho đúng nhóm kho. Kho chỉ nhập khi có phiếu chuyển hợp lệ, vẫn xác nhận theo thực nhận; đề nghị và thông báo không thay đổi tồn.

Các tài khoản cùng kho xem được danh sách, chi tiết và PDF; có thể hoàn tất phiếu nhập/xuất trong phạm vi kho. Giữ người tạo, người xác nhận, lịch sử, PDF khóa và chống ghi tồn trùng khi hai người thao tác đồng thời. HCM không xem/nhập/xuất thay Hà Nội; Hà Nội không nhận thông báo công việc của HCM.

Không thêm endpoint hay migration. Catalog MCP được sinh lại và kiểm tra. Không tự thêm người nhận email, không gửi lại email lịch sử; replay một lần có audit chỉ thêm thông báo còn thiếu và chạy lại thêm 0.

Kiểm thử: PGlite chứng từ 28/28 + đơn/thông báo 10/10 PASS; PostgreSQL 17 với role DML tách biệt 28/28 + 10/10 PASS. Bản production build, TypeScript và build tracing PASS. Backup phục hồi 238 bảng PASS. Rehearsal replay giữ fingerprint 21 bảng, đọc native/PDF đúng phạm vi cho từng tài khoản kho, không có thông báo chéo.

Source giữ trên máy và VPS theo lựa chọn của người dùng, không đẩy GitHub. Báo cáo runtime, HTTP, cutover, cleanup và MCP production nằm trong thư mục tác vụ warehouse-team-20261103.
