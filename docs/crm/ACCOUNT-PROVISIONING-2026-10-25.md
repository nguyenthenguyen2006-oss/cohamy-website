# Cấp tài khoản qua MCP và kích hoạt bằng email

Admin tạo tài khoản `PENDING_ACTIVATION`, gửi lời mời và người nhận tự đặt mật khẩu. Tài khoản cũ giữ nguyên thông tin đăng nhập; migration không đặt lại mật khẩu hoặc đổi trạng thái của họ.

## API

| API | Quyền / nội dung |
|---|---|
| `POST /api/crm/accounts/provision` | ADMIN hiện hành có `accounts.manage`; email, displayName, role, organizationId, idempotencyKey UUID. Không nhận password. |
| `POST /api/crm/accounts/invitations` | ADMIN; membershipId, action `SEND` / `RESEND` / `REVOKE`, idempotencyKey UUID. |
| `GET /api/crm/accounts` | ADMIN; thông tin công khai, vai trò, tổ chức/phạm vi, trạng thái và thời điểm kích hoạt. |
| `GET /api/crm/accounts/invitations?membershipId=...` | ADMIN; 50 lời mời và 100 audit gần nhất, không token/hash. Lịch sử audit đầy đủ qua công cụ dữ liệu phân trang. |
| `PATCH /api/crm/accounts/{membershipId}` | ADMIN; `{active:false}` / `{active:true}`. Thu hồi phiên; mở khóa không bỏ qua kích hoạt. |
| `POST /api/crm/auth/activate` | Trình duyệt người nhận; token, password. Không đăng ký MCP. |

Màn hình `/crm/accounts/new` không yêu cầu mật khẩu. Có tùy chọn tạo và gửi lời mời; tài khoản được tạo thành công vẫn tồn tại nếu gửi email thất bại. Màn hình chi tiết ghi kết quả gửi và cho phép gửi lại/thu hồi.

## Bảo mật và retry

- Token ngẫu nhiên 256 bit, chỉ lưu SHA256; hết hạn 24 giờ, dùng một lần. Token không xuất hiện trong phản hồi API/MCP hoặc audit. Liên kết HTTPS dùng fragment `#token=...`; trang xóa fragment khỏi thanh địa chỉ trước khi người nhận nhập mật khẩu.
- Mật khẩu mới 12–72 ký tự, tối đa 72 byte UTF-8, có chữ hoa/thường, số và ký tự đặc biệt; bcrypt cost 12. Mật khẩu không gửi qua email.
- Trạng thái kích hoạt được kiểm tra trong login, session authentication, membership principal và kiểm tra quyền giao dịch. Khôi phục mật khẩu không phát hành liên kết cho tài khoản đang chờ kích hoạt.
- Tổ chức phải đang hoạt động và đúng loại. CUSTOMER / SUPERMARKET thuộc các hồ sơ CUSTOMER riêng; không trộn hai loại trong một hồ sơ đang hoạt động. Vai trò nội bộ thuộc COHAMY. SALES và các tài khoản ngoài Admin không có quyền cấp tài khoản.
- Idempotency khóa theo actor + UUID trong transaction, cùng key khác payload trả 409. Cùng key không phát hành/gửi lại email. MCP có thêm requestId receipt của chính giao thức.
- Gửi lại tạo token mới và thu hồi token cũ. Tối thiểu 60 giây giữa hai lần gửi, tối đa 5/tài khoản/giờ và 30/Admin/giờ. Kích hoạt giới hạn 15 lần/địa chỉ trong 15 phút; chỉ giữ digest của địa chỉ. Nginx cần ghi đè `X-Real-IP`; nếu thiếu header, mọi yêu cầu dùng chung một bucket giới hạn.
- Lỗi/timeout của nhà cung cấp được ghi là `UNKNOWN`. Không tự gửi lại khi không biết kết quả; Admin kiểm tra trạng thái rồi chủ động gửi lại, thay liên kết cũ. Crash trước khi ghi kết quả gửi có thể để `PENDING`; không tự lặp lại email.
- Việc khóa tài khoản và thu hồi lời mời là độc lập. Thu hồi lời mời không xóa tài khoản, đơn hàng, audit hoặc dữ liệu nghiệp vụ.

## MCP

Khám phá contract qua `cohamy_capabilities`. Các operation mới: `POST /api/crm/accounts/provision`, `POST /api/crm/accounts/invitations`, `GET /api/crm/accounts/invitations`. Danh sách, vai trò/phạm vi và khóa/mở khóa dùng các operation native đã có. Quản lý vai trò/thu hồi phiên vẫn được hỗ trợ qua `POST /api/crm/work/account`, với contract chỉ gồm `role` / `revoke`.

`POST /api/crm/accounts` (tạo bằng mật khẩu cũ), đổi mật khẩu cá nhân và kích hoạt không được công bố qua MCP. Bridge từ chối input chứa trường credential. Các bảng invitation, limiter và idempotency là auth-private, không nằm trong `cohamy_data_catalog`; users/organizations vẫn có projection công khai và dữ liệu phân trang như trước.

Ví dụ từ ChatGPT đã kết nối Admin:

1. Tra tổ chức để lấy UUID thực tế bằng `cohamy_read` / `cohamy_data`; kiểm tra loại tổ chức.
2. Khám phá operation provision rồi gọi `cohamy_write` với requestId UUID và input `{email,displayName,role,organizationId,idempotencyKey}`.
3. Lấy `membershipId` từ kết quả, gọi operation invitations với action `SEND`, UUID requestId và idempotencyKey mới.
4. Báo trạng thái gửi; người nhận mở email và tự đặt mật khẩu. Không yêu cầu họ cung cấp mật khẩu hoặc liên kết kích hoạt cho ChatGPT.
5. Dùng GET accounts và GET invitations để kiểm tra trạng thái; `RESEND` thay liên kết, `REVOKE` vô hiệu hóa lời mời.

Không sửa được chính sách chặn/duyệt của ChatGPT bằng code CRM. Kết nối ChatGPT phải được người dùng cấp quyền OAuth; kiểm thử giao thức không chứng minh connector đã được thêm vào tài khoản ChatGPT của họ. Trạng thái Brevo nhận yêu cầu không chứng minh email đã tới hộp thư; thông báo UNKNOWN cần kiểm tra riêng.

## Demo và migration

Migration `047-account-provisioning.sql`: thêm activation_status, activated_at, is_demo vào users; thêm is_demo vào organizations; thêm unique index email và ba bảng account_invitations, account_provision_actions (append-only), account_activation_attempts. Không thay đổi hash/mật khẩu hoặc dữ liệu kho/tài chính hiện có.

`npm run crm:provision-demo -- <adminMembershipId>` chỉ chấp nhận cơ sở dữ liệu QA LOCAL PGlite hoặc STAGING PostgreSQL được kiểm tra tên/host/port. Tạo sáu tài khoản DEMO_ADMIN/FACTORY/SALES/ACCOUNTANT/CUSTOMER/SUPERMARKET chờ kích hoạt, email `.invalid`, không mật khẩu mặc định và không gửi email. Bốn vai trò nội bộ thuộc COHAMY; khách và siêu thị có tổ chức riêng. Chạy lại dùng tài khoản đã đánh dấu, từ chối đụng dữ liệu thật trùng mã/email. `--cleanup` chỉ khóa sáu demo và thu hồi lời mời/phiên, giữ audit và dữ liệu. Không seed demo lên production.

## Tệp chính và kiểm thử

- Backend: lib/crm/account-provisioning.ts, account-provision-contracts.ts, auth.ts, account-security.ts, repository.ts; ba route API mới.
- UI: AccountProvisionForm.tsx, ActivationForm.tsx, ModulePage.tsx, `/crm/activate`.
- MCP: generate-mcp-catalog.mjs, routes.generated.ts, bridge.ts, data.ts.
- QA: verify-account-provisioning.ts, verify-provision-browser.mjs, provision-demo.ts; báo cáo tách LOCAL/STAGING/PRODUCTION trong `docs/crm/test-results/provisioning/`.

Lệnh: `npm run test:crm:provision`, `npm run test:crm:provision-browser` (server QA riêng), `npm run test:crm:buyer`, `npm run typecheck`, `npm run crm:mcp:catalog`, `npm run test:crm:mcp:catalog`, `npm run build`. Email trong kiểm thử tự động sử dụng transport giả lập hoặc mailer trong bộ nhớ; không phải bằng chứng gửi Brevo thật.

## Kết quả phát hành ngày 25/10/2026

- PRODUCTION: release `f307fd0ed237548e58b00d9dcf380b7c4fd9d512`, đã tích hợp release hóa đơn Admin `ad4eacfa763444ef9312e8b03f6af6901a515ad5` trước khi phát hành. Không ghi đè các cập nhật đang chạy.
- Hai bản sao lưu trước migration và trước cutover đều được phục hồi thử, đối chiếu manifest và bytea thành công. Backup: `/root/cohamy-backups/20261025T103747Z-f307fd0ed237`.
- LOCAL: build production + TypeScript + catalog freshness + lint tệp mới; deployment trace không chứa `.local` / mailbox / database QA. Bộ cấp tài khoản 16 nhóm; hồi quy khách/siêu thị 13 nhóm; Edge thực và official MCP SDK 7 nhóm.
- STAGING PostgreSQL: 16 nhóm qua runtime role DML, gồm tạo cùng key và kích hoạt cùng token đồng thời, cũng như hai siêu thị thực sự khác tổ chức sau khi kích hoạt. Các database và runtime role QA đều được dọn sau kiểm thử.
- PRODUCTION candidate: 15 nhóm. HTTPS công khai: 15 nhóm, gồm đăng nhập Admin cũ, form cấp tài khoản không mật khẩu, trang kích hoạt, danh sách trạng thái và OAuth/MCP thật. Nguồn blog WordPress hiện có được giữ nguyên.
- 18 bảng được đối chiếu trước/sau giữ nguyên dữ liệu; users được so sánh theo các cột cũ, bao gồm password_hash, không xuất giá trị hash/mật khẩu ra báo cáo. Đơn hàng, kho, công nợ, chứng từ và quy tắc thông báo PDF giữ nguyên. Hai tiến trình web/worker online, không restart sau cutover.
- Không tạo tài khoản QA/demo trên production, không gửi lời mời thật trong lượt phát hành. Bằng chứng gửi email là giả lập; việc nhận thư tại hộp thư thật chưa được kiểm chứng cho mẫu lời mời mới.
- MCP có dùng được không? Có: official SDK đã tạo pending account, gửi/thu hồi lời mời và khóa/mở khóa qua API native trên QA; discovery và đọc native API qua OAuth đã được kiểm tra trên HTTPS production.
- MCP có đọc được dữ liệu này không? Có: danh sách tài khoản, vai trò/tổ chức, trạng thái kích hoạt, thời điểm kích hoạt và audit/lịch sử mời đã lược trường bí mật. Token, password hash và các bảng auth-private không đọc được qua MCP theo thiết kế.

Bằng chứng: `services-local.json`, `services-staging.json`, `browser-mcp-local.json`, `build-traces-local.json`, `production.json`, `production-smoke.json` trong `docs/crm/test-results/provisioning/`. Các commit tiếp theo chỉ cập nhật harness QA và báo cáo; source ứng dụng production giữ commit nêu trên.
