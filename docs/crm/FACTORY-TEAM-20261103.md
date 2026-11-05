# Nhà máy dùng chung phiếu — 03/11/2026

Các tài khoản có vai trò FACTORY đang hoạt động trong cùng tổ chức Cohamy cùng nhận phiếu đã xác nhận. `factory_membership_id` trên phiếu cũ chỉ còn là thông tin lịch sử, không giới hạn người trong nhóm được xử lý.

- API danh sách, xem chi tiết, PDF, tiếp nhận và lập phiếu chuyển cùng dùng phạm vi tổ chức.
- Phiếu đề nghị nháp của Admin chưa được công bố; phiếu chuyển nháp chỉ người tạo và Admin xem được.
- Người tạo, người xác nhận, lịch sử và PDF đã khóa được giữ nguyên. Tiếp nhận chung được ghi một lần, các đợt giao từ nhiều nhân viên cùng kiểm tra tổng số đã gửi dưới khóa nguồn.
- Thông báo nội bộ phát tới các tài khoản FACTORY cùng tổ chức, loại tài khoản bị khóa/xóa. Email tiếp tục dùng người nhận đã cấu hình; không tự thêm email hoặc phát lại thư cũ.
- Form lập phiếu hiển thị một Nhà máy Cohamy, không yêu cầu chọn nhân viên nhận phiếu.
- Không có migration hoặc endpoint mới. `factoryMembershipId` cũ vẫn được chấp nhận để tương thích; khi bỏ qua, server chọn một membership nhà máy hợp lệ cho metadata lịch sử.

Catalog cập nhật: `lib/crm/mcp/routes.generated.ts`.

File sửa: `lib/crm/document-flow.ts`, `components/crm/DocumentFlowWorkspace.tsx`, `scripts/crm/test-document-flow.ts`, `scripts/crm/verify-document-flow-browser.mjs`.

Kiểm chứng trước triển khai: PGlite 24/24 PASS; PostgreSQL 17 với role DML tách biệt 24/24 PASS; DB và role thử đã dọn. Backup phục hồi đối chiếu 238 bảng PASS. Rehearsal trên bản phục hồi: các tài khoản nhà máy xem đủ phiếu xác nhận/PDF, replay thông báo lần hai thêm 0; fingerprint 17 bảng nghiệp vụ giữ nguyên.

Catalog MCP đã sinh lại và kiểm tra: 355 operation, 247 đang dùng, 108 nghỉ. MCP tiếp tục đọc danh sách phiếu, chi tiết, PDF, dữ liệu và thông báo qua API native; quyền người dùng và bất biến nghiệp vụ áp dụng trên backend.

Bằng chứng build, HTTP, rollout và MCP production được lưu riêng trong thư mục tác vụ `factory-team-20261103`.

Production build + TypeScript + kiểm tra build tracing PASS, 0 leak. HTTP trên bản phục hồi PASS 4 nhóm: ẩn danh bị từ chối; cả 3 tài khoản nhà máy đang hoạt động xem đủ 6 phiếu đã gửi qua dashboard, menu và PDF. Số lượng này là snapshot nghiệm thu; quyền áp dụng tự động cho các tài khoản cùng vai trò đang hoạt động.
