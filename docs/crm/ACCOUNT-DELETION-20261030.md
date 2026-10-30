# Xóa tài khoản CRM qua Admin và MCP

Admin mở **Tài khoản và quyền → chọn tài khoản → Xóa tài khoản**, kiểm tra tên/email và toàn bộ vai trò, nhập đúng email cùng lý do rồi xác nhận. Tài khoản biến mất khỏi danh sách hiện tại; tab **Đã xóa** giữ trạng thái, lý do và lịch sử.

Đây là xóa quyền đăng nhập của toàn bộ danh tính, gồm mọi membership, phiên đăng nhập, OAuth MCP, lời mời chưa dùng và liên kết đặt lại mật khẩu. Không xóa vật lý user hay tổ chức/khách hàng. Chứng từ, PDF đã chốt, tồn kho, công nợ và audit được giữ nguyên. Email cũ tiếp tục được giữ để bảo toàn lịch sử; không có chức năng khôi phục trong thay đổi này.

Máy chủ kiểm tra Admin hiện hành, chặn tự xóa theo user ID ở cả membership khác và bảo vệ Admin hoạt động cuối. Yêu cầu phải khớp phiên bản, dấu vân tay bản xem trước, email và lý do; idempotency cùng audit bất biến bảo vệ khi gửi lại. Các thao tác cấp tài khoản/lời mời/đổi vai trò/khóa/xóa dùng chung thứ tự khóa; reset mật khẩu khóa identity trước token để tránh deadlock với xóa.

Migration `048-account-deletion.sql` chỉ thêm ba cột có giá trị mặc định NULL và ràng buộc tài khoản đã xóa phải inactive. Không thay mật khẩu hay dữ liệu tài khoản đang có.

## MCP

**MCP có dùng được không?** Có: Admin MCP đọc `GET /api/crm/accounts/[id]/deletion-preview`, rồi gọi `DELETE /api/crm/accounts/[id]` với `expectedVersion`, `previewFingerprint`, `confirmEmail`, `reason`, `idempotencyKey`; mỗi lệnh MCP còn có `requestId`. Gửi lại sau lỗi truyền tải phải dùng nguyên hai khóa và nội dung. Không tự chọn mục tiêu nếu người dùng chưa chỉ định tài khoản.

**MCP có đọc được dữ liệu này không?** Có: danh sách tài khoản mặc định bỏ tài khoản đã xóa, `includeDeleted=true` trả thêm trạng thái/lý do; API lịch sử trả sự kiện `account.deleted`. Dữ liệu nghiệp vụ và audit vẫn tra cứu qua công cụ hiện có. Không đọc được mật khẩu đã lưu, token, hash hay khóa bí mật.

Catalog đã tạo lại và kiểm tra: 339 operations, 231 hoạt động, 108 ngừng dùng; thêm preview và DELETE. Kiểm thử dùng MCP SDK chính thức qua OAuth thật trong ứng dụng local, không mô phỏng thành công từ catalog.

## Bằng chứng kiểm thử

- LOCAL PGlite: 12 nhóm kiểm thử service; STAGING PostgreSQL với role runtime riêng: cùng 12 nhóm đều PASS.
- Edge + OAuth MCP: 5 nhóm PASS, gồm giao diện xóa, thu hồi session/access/refresh token, retry MCP/native và đọc lịch sử. Không có lỗi JavaScript trang.
- Tạo REQUEST → DISPATCH → RECEIPT thật trong QA trước khi xóa thủ kho HCM. Snapshot/PDF bytes và hash các bảng chứng từ, biến động/tồn kho, công nợ/tổ chức không đổi sau xóa.
- Chặn Sales, giả mạo email/fingerprint, bản xem trước cũ, tự xóa qua vai trò khác; không thể kích hoạt lại qua unlock/role/reset/đại lý/lời mời. Hai Admin xóa chéo và reset chạy đồng thời với xóa hoàn thành mà không hồi sinh tài khoản.
- Hồi quy: provisioning 16, mật khẩu tự sinh 10, MFA/reset 5, khách hàng/siêu thị 13 nhóm PASS. Tài khoản hiện có giữ nguyên hash mật khẩu.
- Không gửi mail ra ngoài và không xóa tài khoản production trong các phép thử.

Kết quả máy đọc nằm trong `test-results/account-deletion/`.

## PRODUCTION đã xác minh

- Release `faa908fee590a51d9bca66408eb66e84739a609b` đã lên `https://cohamy.vn` ngày 30/10/2026. Bản sao lưu: `/root/cohamy-backups/20261030T050004Z-faa908fee590`.
- Hai lần backup/restore đều PASS, mỗi lần 225 bảng; không lỗi file hay nguồn chứng từ. Bản ứng viên và HTTPS công khai đều qua 18 kiểm tra. Web/worker online, không restart trong kiểm tra triển khai.
- Đối chiếu 50 bảng/448 dòng nghiệp vụ và trường tài khoản có từ trước cho kết quả không đổi. Cả 14 tài khoản thật giữ nguyên dữ liệu/quyền/mật khẩu; ba cột mới đều NULL, không có tài khoản thật bị xóa. Không gửi mail thử.
- Kết nối Cohamy MCP hiện có phát hiện đúng DELETE và preview; đọc danh sách 14 tài khoản, bản xem trước thật có fingerprint và chặn tự xóa; đọc lịch sử tài khoản HTTP 200. Catalog dữ liệu cho phép đọc `deleted_at`, `deleted_by`, `deletion_reason`, vẫn loại hash/mật khẩu/token.
- Không chạy DELETE thành công với tài khoản production vì người dùng chưa chỉ định mục tiêu. Hiệu lực xóa, thu hồi đăng nhập/OAuth và retry đã được chứng minh trên dữ liệu kiểm thử riêng ở LOCAL/STAGING.

Chi tiết: `test-results/account-deletion/production-release.json` và `connected-mcp-production.json`. Thay đổi tài liệu sau triển khai không đổi source đang chạy trên production.
