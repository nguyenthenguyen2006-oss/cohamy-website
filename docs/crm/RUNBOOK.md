# Chạy và kiểm tra CRM Cohamy

Phạm vi hiện tại: nền truy cập/danh mục, intake website, xử lý yêu cầu, chăm sóc khách, việc cần làm và phân công; chưa phải bộ CRM mua đứt–ký gửi hoàn chỉnh. Không deploy production, import dữ liệu thật hoặc gửi thông báo trong phiên này. Đọc `WORKSPACE-UPGRADE.md` trước vận hành; `IMPLEMENTATION-STATUS.md` là snapshot nền trước nâng cấp.

## Máy chủ QA riêng (LOCAL)

Trong PowerShell, tại thư mục Cohamy. Chọn tên thư mục QA mới chưa dùng, seed khi server đã dừng:

```powershell
$env:CRM_LOCAL_DATA_DIR='.local/crm-qa-my-review'
npm run crm:seed-qa
node scripts/crm/start-qa.mjs
```

Mở `http://localhost:4310/crm/login` và `/portal/login`. Harness bind localhost, bật PGlite LOCAL và intake; chủ động dùng `BLOG_SOURCE=legacy` chỉ trong child QA để render nội dung static đang có. Đây không phải test CMS Sheets/WordPress live. Không dùng `127.0.0.1` cho origin QA: Next dev chuẩn hóa loopback thành localhost có thể tạo vòng rewrite i18n khi origin nội bộ khác.

Tài khoản fictitious: `admin@crm-qa.invalid`, `a@crm-qa.invalid`, `b@crm-qa.invalid`, `sales@crm-qa.invalid`, `warehouse@crm-qa.invalid`, `accountant@crm-qa.invalid`. Mật khẩu **chỉ QA**: `Local-QA-Only-2026!`. Mỗi user/hồ sơ/kho mang nhãn LOCAL QA; không seed vào database thật. Hai dealer A/B có tổ chức/kho riêng. Không stock/debt mẫu.

Lượt nền dùng `.local/crm-qa-browser-20260918`; preview UI mới dùng `.local/crm-qa-work-ui-20260918`. Muốn có cả yêu cầu, ghi chú và việc QA, dùng `seed-work-ui.ts` theo `WORKSPACE-UPGRADE.md` thay cho seed nền. Password QA không phải default auth: cấu hình bình thường không tự tạo user này. Muốn seed lại, chọn directory QA mới; script từ chối seed đè. Một PGlite directory chỉ có một process sở hữu; không chạy CLI init/restore với directory đang được Next dev mở.

Đối chiếu HumanBank read-only lịch sử trong terminal thứ hai (không còn là tiêu chí giao diện sau yêu cầu redesign):

```powershell
node scripts/crm/start-reference.mjs
```

Mở `http://127.0.0.1:4311/dashboard` hoặc `/login`. Đây là source components/CSS thực được bundle vào `.local/crm-reference`, auth/router mô phỏng; không truy cập backend/database hoặc secret HumanBank. Tham chiếu cần source HumanBank tại đúng path ghi trong manifest.

## Kiểm thử

```powershell
npm run test:crm
npm run test:crm:work
npm run test:crm:work-browser
node scripts/crm/verify-seo.mjs
node scripts/crm/verify-console.mjs
npm run typecheck
npm run lint
npm run build
npm run test:crm:build
npm run test:cms
npm run test:headless:contract
```

`test:crm` và `test:crm:work` tự tạo directory QA riêng mỗi lượt và đóng DB. `test:crm:work-browser` cần server Cohamy QA 4310 và Edge cài sẵn; thao tác trên dữ liệu fictitious và kiểm tra lưu thật. `test:crm:browser` cũ cần cả server HumanBank reference, giữ làm lịch sử; các selector/so sánh launcher cũ không còn tiêu chí mới. Kiểm tra 503 và sửa giá localStorage của lượt nền là kiểm tra có mô phỏng lỗi, không phải dữ liệu thật của khách.

JSON kết quả và ảnh tại `docs/crm/test-results`. Lượt đầu có lỗi thật giảm chuyển động và route cart/checkout; đã sửa và kiểm tra lại. Một số lỗi harness locator trùng/ảnh viewport sai cũng đã sửa. Không coi test chính sách, stock hoặc concurrency PostgreSQL là PASS khi chưa chạy.

`verify-seo` kiểm tra cart/checkout noindex và danh mục giữ canonical ở năm locale. `verify-console` cũ chỉ lấy mẫu console, không thay E2E. Đợt nâng cấp mới chạy `npm run lint` toàn repository PASS; không tái sử dụng kết luận FAIL từ snapshot nền.

Next dev tự override Cache-Control trang thành `no-cache, must-revalidate`. API private có `no-store` đã kiểm tra. Các page dùng cookies/dynamic và cấu hình private/no-store; header runtime production vẫn phải kiểm tra ở staging HTTPS. Không thay noindex bằng xác thực.

## Database PostgreSQL độc lập (chưa chạy trong phiên này)

Chuẩn bị database Cohamy trống và tài khoản migration riêng. Không dùng connection HumanBank/CMS. Nhập các giá trị riêng trong `.env.local` (gitignored), lấy tên biến từ `.env.example`:

- `CRM_DATABASE_MODE=postgres`, `CRM_DATABASE_URL` của database dành riêng Cohamy.
- `CRM_ENVIRONMENT=LOCAL` hoặc `STAGING`; `CRM_PUBLIC_ORIGIN` đúng scheme/host/port, không trailing slash. Khi chạy build production/staging phải là HTTPS.
- Không `CRM_LOCAL_DATA_DIR` trong runtime PostgreSQL; không seed QA vào DB này.
- `CRM_WEBSITE_ORDER_INTAKE=false` đến khi migration, admin, access và staging được kiểm tra; bật intake không mở ghi sổ.

Không copy nguyên `.env.example` với `NODE_ENV=production` vào môi trường dev QA. Không đưa mật khẩu vào CLI arguments, log, tài liệu hoặc commit.

```powershell
npm run crm:init -- --catalog
```

Lệnh áp bốn SQL migrations 001–004 theo checksum, nhập mapping 10 sản phẩm idempotent. SKU `WEB-*` tạm không phải SKU thương mại đã chốt; quản lý có thể sửa metadata SKU/unit trong CRM. Không tạo tồn, debt, price policy hoặc opening balance.

Để tạo admin đầu tiên, đặt `CRM_BOOTSTRAP_EMAIL`, `CRM_BOOTSTRAP_PASSWORD` (12–72 ký tự) và `CRM_BOOTSTRAP_NAME` qua secret manager/phiên shell kín; chạy `npm run crm:init -- --bootstrap`. Chỉ database chưa có users được bootstrap. Xóa biến bootstrap khỏi runtime sau đó. Không lấy hash/user HumanBank hoặc admin CMS. Đây là hướng dẫn, chưa tạo admin thật.

`pg` transaction luôn pin cùng client BEGIN/COMMIT/ROLLBACK. PostgreSQL mặc định của project chưa được kiểm chứng bằng service có nhiều kết nối; phải chạy đầy đủ integration/concurrency và grants trước production. Migrations schema append-only chỉ bảo vệ audit qua trigger, không bảo vệ trước DBA/superuser cố ý bỏ trigger.

## Restart và restore QA

Dừng Next QA bằng Ctrl+C, xác nhận process sở hữu directory đã dừng. Giữ biến directory QA đã có đơn browser thành công:

```powershell
$env:CRM_LOCAL_DATA_DIR='.local/crm-qa-browser-20260918'
node scripts/crm/verify-durability.mjs
```

Script mở/đóng/mở DB, copy directory đã đóng vào directory restore mới không overwrite/xóa, mở bản copy và đối chiếu logical SHA-256 + tổng hồ sơ/catalog/kho/requests/audit. Không copy live DB. Bản restore QA được giữ lại và path ghi trong `durability-local.json`. Đây không phải diễn tập pg_dump/pg_restore, không chứng minh ledger kho/nợ chưa tồn tại.

## Backup PostgreSQL và rollback (NOT RUN)

Trước khi chạy thật: chốt vị trí backup ngoài deployment/public uploads, mã hóa/quyền truy cập, thời hạn giữ, lịch, RPO/RTO và người khôi phục. Dùng `pg_dump` custom format trên database Cohamy, ghi checksum; `pg_restore` vào database kiểm thử khác, không overwrite database vận hành. Đối chiếu migration registry, row totals, ledger/source links và test quyền A/B rồi diễn tập restart. Không log URL chứa credential; dùng pgpass/secret manager.

Chưa có PostgreSQL tools/service trên máy được tìm thấy trong phiên này, nên các thao tác trên chưa chạy. Không dùng bản copy PGlite thay cho gate backup production. Migrations hiện additive; khi rollback source, tắt intake và dừng CRM writes, giữ data/audit. Không drop schema hoặc xóa chứng từ để rollback giao diện. Source backup trước sửa không chứa backup dữ liệu CRM.

## Hướng dẫn theo vai trò hiện có

Quản trị: login `/crm/login`, cấp/khóa membership, tạo dealer/customer/kho. Không tự khóa tài khoản đang dùng. Chọn tổ chức thuộc đúng role; internal chỉ Cohamy, dealer roles chỉ dealer.

Quản lý: hồ sơ toàn hệ thống, sửa metadata hàng hóa, phân công sales/kho, xử lý yêu cầu và việc chăm sóc. Sales: chỉ hồ sơ được giao hoặc do chính sales tạo và yêu cầu được giao; được ghi chú, tạo/hoàn thành việc và cập nhật trạng thái đúng quyền. Thủ kho: chỉ directory kho được giao, không phiếu nhập/xuất. Kế toán: chỉ đọc hồ sơ/website requests/báo cáo tiếp nhận; không xác nhận tiền/nợ trong bản này.

Đại lý: `/portal/login`, đọc catalog và kho của chính tổ chức, xem profile và tự đổi mật khẩu. Đặt hàng đại lý/đối soát/công nợ/chứng từ là màn chưa mở, không phải thao tác đã kết nối. Tài khoản khóa có hiệu lực trên request kế tiếp; logout revoke session database; session hết hạn sau 8 giờ. Admin có đặt lại mật khẩu/thu hồi phiên/đổi vai trò tại chi tiết tài khoản; chưa quên mật khẩu qua email, MFA hoặc self-registration.

Website: khi intake bật, vào sản phẩm → thêm vào yêu cầu → biểu tượng giỏ → gửi yêu cầu. Server chỉ lưu pending/unpaid, trả code và item subtotal; phí vận chuyển chưa báo giá. Khi API lỗi, cart và metadata chống trùng còn giữ. Bank/MoMo chưa có gateway, không nhắc khách chuyển tiền hoặc gọi chọn phương thức là đã thu tiền.

## Điều kiện mở tiếp

Chốt các quyết định trong PHASE-0-AUDIT; triển khai sổ kho và luồng mua đứt/ký gửi trước nhập đầu kỳ. Xử lý vulnerability và test trên PostgreSQL/staging/CMS thật trước production. Không tự gửi email/Zalo/Telegram, import spreadsheet hoặc ghi nợ với chính sách suy đoán.
