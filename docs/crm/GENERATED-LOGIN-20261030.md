# Cấp tài khoản bằng mật khẩu tự sinh — 30/10/2026

## Hành vi

Theo yêu cầu mới, ChatGPT có thể yêu cầu CRM sinh mật khẩu riêng cho tài khoản mới và đưa mật khẩu đó vào đoạn chat. Tài khoản **dùng được ngay**, không cần email kích hoạt, không bắt buộc đổi mật khẩu ở lần đầu và không có hạn dùng tạm. Người dùng có thể giữ mật khẩu hoặc đổi sau bằng chức năng hiện có.

Chế độ cũ gửi lời mời để người nhận tự đặt mật khẩu vẫn hoạt động. Mặc định API giữ chế độ cũ; để nhận mật khẩu trong chat phải chọn rõ `loginMethod: GENERATED`.

Đây là ngoại lệ có phạm vi theo yêu cầu trực tiếp của người dùng: chỉ **mật khẩu vừa sinh cho tài khoản mới** được trả một lần. Không thêm khả năng đọc mật khẩu cũ, password hash, token, khóa mã hóa hay thực thi SQL/shell.

## API và MCP

`POST /api/crm/accounts/provision` giữ các trường email, displayName, role, organizationId, idempotencyKey; thêm `loginMethod: INVITATION | GENERATED`.

Với GENERATED:

1. Kiểm tra Admin, danh tính hiện hành, tổ chức đang hoạt động và loại tổ chức phù hợp role.
2. Chặn email trùng, xung đột loại tài khoản khách hàng/siêu thị và retry sai nội dung.
3. Sinh mật khẩu bằng `crypto.randomBytes(24)`, có 192 bit ngẫu nhiên và đủ chữ hoa/thường/số/ký tự đặc biệt.
4. Lưu bcrypt cost 12, tạo trạng thái ACTIVE và ghi thời điểm kích hoạt.
5. Trả `generatedPassword` **chỉ trong response tạo thành công lần đầu**, cùng email, role, tổ chức và đường dẫn đăng nhập.
6. Không gửi email. Không đổi mật khẩu của tài khoản đã tồn tại.

MCP nhận đúng kết quả lần đầu để ChatGPT đưa lại cho Admin đã yêu cầu. `account_provision_actions`, audit và `mcp_calls.result` không lưu mật khẩu rõ. Retry cùng requestId hoặc cùng idempotencyKey chỉ trả thông tin tài khoản; không cấp lại hoặc trả lại mật khẩu. Nếu mất kết quả lần đầu, người nhận dùng Quên mật khẩu để thiết lập mật khẩu mới.

Input MCP vẫn không nhận password/currentPassword/newPassword/token/secret. Ngoại lệ output nằm đúng một operation, đòi hỏi GENERATED, response 201/ACTIVE và định dạng mật khẩu do server tạo. Mọi GET, tra cứu dữ liệu và các operation khác giữ nguyên bộ lọc bí mật.

Ví dụ yêu cầu ChatGPT: “Tạo tài khoản Sales cho [tên], email [email], thuộc Cohamy, tự sinh mật khẩu và gửi lại trong chat”. ChatGPT phải chọn tổ chức phù hợp, đọc capabilities rồi gọi cohamy_write với loginMethod GENERATED và UUID mới. Không tự bịa hoặc dùng chung một mật khẩu cho nhiều tài khoản.

## Giao diện

Admin → Cấp tài khoản → Cách cấp đăng nhập → **Tự sinh mật khẩu, dùng ngay**. Mật khẩu hiển thị một lần sau tạo; nút “Đã lưu, mở tài khoản” xóa nó khỏi màn hình. Trang chi tiết, danh sách và lịch sử không có chức năng xem lại mật khẩu.

## Kiểm thử và giới hạn

- Dịch vụ PGlite: 10 nhóm PASS.
- PostgreSQL 17 QA, quyền runtime: 10 nhóm PASS; database/role QA đã được dọn.
- Edge + HTTP + OAuth MCP SDK thật: 6 nhóm PASS, bao gồm output mật khẩu lần đầu, retry không trả lại, đăng nhập không ép đổi, đổi mật khẩu tự nguyện.
- Luồng lời mời hiện tại: 16 nhóm PASS, giữ hash idempotency cũ.
- Hồi quy khách hàng/siêu thị: 13 nhóm PASS.
- TypeScript và lint: PASS. Build/traces và triển khai được kiểm chứng riêng trước khi kích hoạt.
- Không tạo tài khoản production hay gửi email thật trong bộ kiểm thử. Mật khẩu tự sinh trong QA chỉ được giữ trong bộ nhớ khi cần kiểm tra, không ghi vào báo cáo/ảnh.

Bằng chứng: `docs/crm/test-results/generated-accounts/`. Chỉ chụp màn hình sau khi đã đóng phần mật khẩu. Không dùng dữ liệu của tài khoản thật để thử chức năng cấp mật khẩu.

## File thay đổi

- `lib/crm/account-provision-contracts.ts`: mode tùy chọn, mặc định INVITATION.
- `lib/crm/account-provisioning.ts`: tạo ACTIVE, bcrypt, một lần trả mật khẩu; receipt an toàn, tương thích idempotency cũ.
- `lib/crm/mcp/bridge.ts`: ngoại lệ output có điều kiện; xóa mật khẩu khỏi cache kết quả MCP.
- `lib/crm/mcp/server.ts`, `routes.generated.ts`: hướng dẫn và hợp đồng MCP.
- `components/crm/AccountProvisionForm.tsx`, `ModulePage.tsx`: lựa chọn cấp và hiển thị một lần.
- Scripts kiểm thử mới, production-smoke và package scripts.

**Không có migration.** Không sửa auth/login, yêu cầu đổi mật khẩu, role hiện hành hay các chứng từ kho/công nợ/PDF.

## Triển khai

Chỉ đưa lên production sau build, backup mới + thử restore, candidate smoke. Kiểm tra SHA/tổ tiên và giữ release trước để rollback. Đối chiếu số dòng/dấu băm của 50 bảng, gồm users/memberships, để kiểm tra tài khoản/mật khẩu cũ và dữ liệu nghiệp vụ không đổi. Báo cáo production sẽ ghi commit và backup thực tế sau kiểm tra.

## MCP

**MCP có dùng được không?** Có trên runtime QA: SDK thật tạo tài khoản và nhận mật khẩu mới một lần, retry không trả lại.

**MCP có đọc được dữ liệu này không?** Có thể đọc trạng thái, role và tổ chức qua accounts. Mật khẩu chỉ có trong response tạo mới lần đầu theo lựa chọn GENERATED; không thể tra lại bằng dữ liệu/lịch sử. Production kiểm tra capabilities và các API an toàn; không tự tạo tài khoản thật khi chưa có thông tin người nhận.
