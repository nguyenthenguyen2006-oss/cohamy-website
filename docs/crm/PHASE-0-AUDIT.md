# Khảo sát CRM Cohamy — 18/09/2026

## Phạm vi đã kiểm tra

Cohamy giữ một ứng dụng Next.js và npm/package-lock. Không có `.git` trong checkout này; không có commit để bàn giao. Trước sửa đã lưu source trong `.local/source-before-crm-20260918.zip`; lint ban đầu chạy thành công. Không lấy secret hoặc database HumanBank.

Đã đọc hướng dẫn repo và các tài liệu Next.js được cài: layout/page, CSS, proxy, route handlers, cookies, authentication và output tracing. Next.js đích 16.2.12, React 19.2.4; HumanBank có monorepo pnpm, NestJS, các package workspace và Prisma PostgreSQL.

Hiện trạng khác bản kế hoạch ban đầu: component checkout có luồng giả, nhưng route cart/checkout còn redirect sang contact và trang sản phẩm chỉ có CTA liên hệ. Đã mở route thật; nút thêm yêu cầu và biểu tượng giỏ chỉ xuất hiện khi `CRM_WEBSITE_ORDER_INTAKE=true`. CTA liên hệ, URL sản phẩm và các locale được giữ.

## Bản đồ nguồn → đích

Các đường dẫn nguồn dưới đây tương đối với HumanBank, đích tương đối với Cohamy.

| Nguồn HumanBank | Đích Cohamy | Cách chuyển |
|---|---|---|
| `apps/web/app/components/portal-shell.tsx` | `components/crm/CrmShell.tsx` | Header, menu tài khoản, navigation nổi; thay branding, route, user DB và quyền |
| `apps/web/app/portal/layout.tsx` | `app/(operations)/crm/(workspace)/layout.tsx`, `portal/(workspace)/layout.tsx` | Layout được bảo vệ; không dùng EDU auth hoặc user mẫu |
| `apps/web/app/portal/dashboard/page.tsx` | `components/crm/CrmDashboard.tsx` | Launcher, lưới ô màu, hero; module Cohamy, không KPI bịa |
| `apps/web/app/components/particle-network.tsx` | `components/crm/ParticleNetwork.tsx` | Canvas; thêm pause khi hidden và cập nhật reduced motion |
| `apps/web/app/components/portal-module-icon.tsx` | `components/crm/ModuleIcon.tsx` | Phosphor fill; icon phù hợp hàng/kho/đại lý |
| `apps/web/app/lib/portal-modules.ts`, `portal-navigation.ts` | `lib/crm/modules.ts`, `permissions.ts` | Menu theo quyền database; bỏ giáo dục và role switch giả |
| `apps/web/app/dang-nhap/page.tsx`, `components/login-form.tsx` | `components/crm/LoginPage.tsx`, `LoginForm.tsx` | Giữ login tối, form và tương tác; API riêng, không tự đăng ký/quên mật khẩu giả |
| `apps/web/app/portal/crm/customers/page.tsx`, `new/page.tsx`, `components/resource-table.tsx` | `components/crm/ModulePage.tsx`, `RecordForm.tsx` | Mẫu mặt sáng, toolbar, table, form, thông báo; partner CRUD thực |
| `apps/web/app/portal/finance/settlements/page.tsx`, `finance-design.css` | Mẫu tham chiếu; chưa chuyển nghiệp vụ | Không đổi bảng học phí thành công nợ hàng hóa |
| `apps/web/app/layout.tsx` và 11 stylesheet theo thứ tự import | `components/crm/crm.css` | Chọn selector cần dùng, scope `.cohamy-crm`, giữ cascade cuối |
| `apps/api/src/auth/permission.guard.ts`, `session-policy.ts` | `lib/crm/auth.ts`, `permissions.ts`, `http.ts` | Tái sử dụng nguyên tắc server guard/expiry, không copy grants/EDU roles hoặc secret |
| `packages/database/prisma/schema.prisma` | `db/crm/001-access-catalog.sql`, `002-website-order-intake.sql` | Schema Cohamy mới; không mang user, học viên, lớp hoặc học phí |

`source-manifest.json` ghi SHA-256 của 25 file tham chiếu. Kiểm tra lại sau triển khai: cả 25 hash vẫn khớp. Không phải kiểm tra hash toàn bộ monorepo HumanBank.

## Cascade, font và hình ảnh

Thứ tự nguồn: globals → foundation → public → public-utility → portal → dossier → legacy-crm → landing-teachers → landing-banners → finance → control. `control-design.css` cuối cùng thực tế đặt ô/control radius 4px và fill phẳng; không dùng radius 32px/gradient của đoạn legacy cũ làm chuẩn.

CRM dùng Be Vietnam Pro 400/500/600/700/800; icon Phosphor. Fonts/icon cài qua npm, giữ license package: `@fontsource/be-vietnam-pro/LICENSE` (SIL OFL), `@phosphor-icons/react/LICENSE` (MIT). Logo Cohamy là asset đang có; logo HumanBank chỉ dùng trong máy chủ tham chiếu LOCAL, không đưa vào ứng dụng đích. Quyền sử dụng source riêng do chủ dự án cung cấp, không tuyên bố HumanBank có giấy phép open-source.

Giá trị rem nguồn được quy về base 16px trong scope CRM, tránh thay html 17/18px của website. Không import toàn bộ global CSS HumanBank. Ảnh source render component thực, nhưng auth/router có mock nhãn LOCAL QA; không chứng minh phiên HumanBank thật.

## Quyết định kiến trúc

Giữ modular monolith trong Next.js: route handlers chỉ là transport; auth, permissions, repository, website-order intake và database adapter nằm trong `lib/crm`. PostgreSQL qua `pg` là cấu hình mặc định. Không tạo một backend Nest song song hoặc một workspace pnpm chồng lên npm.

Chưa tái sử dụng trực tiếp Nest/Prisma: API nguồn phụ thuộc `@humanbank/{auth,config,contracts,database}`, Prisma schema EDU, Redis/session và module giáo dục. Sao chép toàn bộ sẽ kéo nhiều ngữ cảnh ngoài Cohamy. Guard, cách tổ chức service, audit và expiry được thích ứng; đây không phải chuyển nguyên hệ auth HumanBank.

Adapter PGlite chỉ cho LOCAL, một process/connection, path `.local/crm*`; production bị từ chối. Là PostgreSQL WASM có dữ liệu lưu thật, không phải mảng mock, nhưng không thay kiểm thử trên dịch vụ PostgreSQL và nhiều kết nối. Xem [giới hạn PGlite](https://pglite.dev/docs/) và [transaction trên cùng client pg](https://node-postgres.com/features/transactions).

## Schema đã có và schema chưa có

Đã có: organizations → users/memberships → sessions; partner/warehouse assignments; warehouses thuộc organizations; products có website ID và SKU ánh xạ; audit append-only; website_orders chỉ `PENDING_REVIEW`, `paid=false`. Migrations có checksum, lock registry và transaction. Tiền intake dùng numeric(18,0), BigInt VND, không làm tròn lẻ.

Chưa có: quy đổi đơn vị, vị trí, lô/hạn dùng, balance/stock ledger/reservations; hợp đồng/version bảng giá; sales orders và giao/nhận; ký gửi/báo bán/đối soát; AR/AP/cash/allocation/reversals; import tồn/nợ đầu kỳ. Không có migration giả cho các phân hệ này.

Thiết kế tiếp theo cần tách: warehouse/location khỏi owner; stock bucket gồm SKU–lot–owner–warehouse–condition; lượng thực/giữ/khả dụng/transit; document line liên kết stock ledger; financial ledger liên kết nguồn và chứng từ đảo. Giá/chính sách cần snapshot khi duyệt. Đây là đề xuất chưa triển khai, không phải bằng chứng sổ kho/sổ nợ đã tồn tại.

## Ma trận quyền đang áp dụng

| Vai trò | Partner | Kho | Danh mục | Tài khoản | Website intake chưa phân công |
|---|---|---|---|---|---|
| ADMIN | Toàn hệ thống, tạo/sửa | Toàn hệ thống, tạo | Đọc | Tạo/khóa, không tự khóa | Đọc |
| MANAGER | Toàn hệ thống, tạo/sửa | Toàn hệ thống, tạo | Đọc | Không | Đọc |
| SALES | Được giao; tạo mới tự gán, sửa trong scope | Không | Đọc | Không | Không |
| WAREHOUSE | Không | Chỉ kho được giao, đọc | Đọc | Không | Không |
| ACCOUNTANT | Toàn hệ thống, đọc | Không | Không | Không | Đọc |
| DEALER_OWNER | Chính tổ chức, đọc | Kho của chính tổ chức, đọc | Đọc; UI không hiện giá đại lý chưa duyệt | Hồ sơ/phiên riêng | Không |
| DEALER_STAFF | Không | Kho chính tổ chức, đọc | Đọc | Hồ sơ/phiên riêng | Không |

Các quyền orders/finance/consignment/reports ở menu chưa tương đương nghiệp vụ đã triển khai. Không API xác nhận tiền, nâng hạn mức, export hoặc ghi sổ. Đọc partner B ngoài scope trả 404; account admin ngoài quyền trả 403. Scoping hiện nằm trong query/service; chưa có PostgreSQL RLS hoặc grant DB least-privilege đã nghiệm thu.

## Trạng thái chứng từ

Đã chạy: yêu cầu website → `PENDING_REVIEW` (unpaid, shipping pending). Không có bước tự duyệt hay posting.

Chưa chạy: mua đứt draft → duyệt → giữ → giao từng phần → nhận từng phần → hoàn tất; mốc owner/AR là gate do nghiệp vụ chốt. Ký gửi draft → duyệt → giao/nhận (owner Cohamy) → báo bán → đối soát được duyệt → AR → thu tiền. Thu/chi draft → xác nhận → đảo; điều chỉnh chỉ bằng chứng từ liên kết. Những state machine này là phạm vi kế hoạch, chưa phải endpoint.

## Gate còn chặn

1. Mua đứt: mốc owner và AR riêng; đặt cọc/trả trước.
2. Ký gửi: giá cố định hay doanh thu trừ hoa hồng; kỳ và xử lý mất/hỏng/cận hạn.
3. Thứ tự chính sách, chiết khấu, MOQ, credit/term và quyền duyệt ngoại lệ.
4. Người duyệt kho/unit/lot/đầu kỳ; độ cập nhật tồn đại lý mua đứt.
5. Quy trình supplier/AP và đối chiếu kế toán.

Không có câu trả lời trong hai brief. Chưa tự chọn giá/ownership/AR để ghi dữ liệu thật. Có thể xem UI và kiểm thử access/intake riêng; không qua gate phase 2–6 chỉ bằng CRUD hoặc build.
