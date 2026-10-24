# Bàn giao luồng chứng từ Cohamy — 23/10/2026

Đã triển khai source cho Admin đề nghị sản xuất/cấp hàng → nhà máy tiếp nhận/giao từng đợt → kho xác nhận thực nhận và nhập tồn → kế toán đối chiếu/tải VAT; kho xuất/giao theo snapshot riêng; Admin cấu hình thông báo tài liệu qua outbox Brevo. Chưa deploy hoặc chạy migration production. Tất cả dữ liệu dùng cho test là fixture riêng; chưa gửi Brevo thật.

## Cách dùng theo vai trò

| Tài khoản | Đường dẫn và thao tác |
| --- | --- |
| Admin | `/crm/factory-requests` → **Lập phiếu đề nghị** → chọn nhà máy, kho nhận, hàng/số lượng → **Lưu nháp & Xem trước** → **Xác nhận & Gửi nhà máy**. Mỗi phiếu có một kho nhận. Mở phiếu để xem đã gửi, thực nhận và còn phải giao; không cộng hàng đang đi hai lần |
| Nhà máy | `/crm/accounting-factory` → xem đề nghị được giao → **Xác nhận tiếp nhận** → **Lập phiếu chuyển hàng về kho**. Sản phẩm/kho/phần còn giao lấy từ đề nghị; kiểm tra lượng thực gửi → xem trước → **Xác nhận gửi kho**. Bước này chưa làm tăng tồn kho nhận |
| Thủ kho | `/crm/warehouse-factory` → chọn phiếu chuyển → **Lập phiếu nhập kho**. Số nhận mặc định bằng số chuyển; sửa thực nhận và ghi lý do khi lệch → xem trước → **Xác nhận nhập kho**. Chỉ xác nhận mới cộng tồn theo lượng nhận; nháp/in/tải không ghi tồn |
| Thủ kho xuất hàng | Tab **Xuất / giao hàng** → lập phiếu từ đơn nguồn nếu có → bổ sung giao nhận còn thiếu → xem trước → **Xác nhận xuất kho**. Giá/chiết khấu/tiền nguồn do server chụp; thiếu khả dụng/vi phạm giữ hàng bị chặn |
| Kế toán | `/crm/accounting-factory` → **Chứng từ nhập** hoặc **Chứng từ xuất / giao**. Ba cột **Phiếu nhà máy / Phiếu nhập kho / Hóa đơn VAT** mở đúng liên kết; chưa nhập hiện **Chưa có phiếu nhập**. Chọn PDF/XML/ảnh VAT → xem trước → **Lưu & Khóa VAT**. Kế toán không duyệt lệnh/tiền, không nhập/xuất/chỉnh tồn |
| Admin đính chính | Mở chứng từ đã xác nhận → đính chính với lý do, đúng version hiện tại. Hệ thống giữ revision/PDF cũ; thay lượng nhập/xuất ghi bút toán delta và lịch sử trong transaction. VAT thay thế lưu file/link mới có lý do; không ghi đè bytes cũ |
| Manager | Không có quyền phát hành đề nghị Admin, sửa chứng từ flow đã khóa, đọc/sửa rule email hoặc thay VAT như Admin. Các quyền của nghiệp vụ khác theo service hiện hữu |

Quyền kiểm tại service/API và cơ chế khóa DB, không chỉ ẩn nút. Tài khoản kho chỉ nhận dữ liệu thuộc kho được giao; nhà máy chỉ thấy lệnh/chứng từ của mình. Chứng từ cũ `LEGACY` vẫn đọc được, không tự ghi lại tồn hoặc tiền khi mở.

## Admin cài email

Vào `/crm/document-notifications` (**Thông báo hóa đơn & chứng từ**). Chọn đúng loại/sự kiện, phạm vi kho/nhà máy áp dụng, To/CC/BCC, tiêu đề/nội dung, EVENT hoặc BUNDLE rồi lưu. Có thể thêm nhiều rule cho cùng loại. Rule tắt/chưa có người nhận không gửi; email ngoài không cần tài khoản CRM. Lưu hoặc mở cài đặt không tạo job cho chứng từ cũ.

Biến nội dung: `{{type}}`, `{{code}}`, `{{status}}`, `{{warehouse}}`, `{{factory}}`, `{{source}}`, `{{request}}`, `{{date}}`, `{{revision}}`, `{{url}}`. Xem trước rule bằng phiếu FLOW hoặc BUSINESS đã lưu đúng sự kiện; xem trước job trong **Lịch sử gửi** để xem đúng người nhận/nội dung/file đã chụp. Bộ chọn phạm vi không hỗ trợ bị khóa; API cũng từ chối thay vì âm thầm lưu rule không khớp. Lịch sử lọc mã/kho/người nhận, loại và trạng thái, gồm SIMULATED/SUPERSEDED; **Thử lại / Gửi lại** cần lý do, tạo job con và giữ lần gửi trước.

Admin có thể nhập API key và email gửi ngay tại mục Brevo, bấm **Lưu cấu hình Brevo**. Key được mã hóa trong DB; ô key trống giữ nguyên, checkbox xóa key tạo cấu hình tắt có chủ đích. Lưu không gửi email. Chi tiết cấu hình master key, backup và kiểm thử: [BREVO-ADMIN-SETTINGS-2026-10-23.md](./BREVO-ADMIN-SETTINGS-2026-10-23.md).

**Gửi thử** chỉ xếp hàng đến địa chỉ Admin chủ động nhập. Source ưu tiên cấu hình Brevo đã mã hóa trong DB; chỉ khi chưa có bản ghi mới dùng `CRM_BREVO_API_KEY`/`CRM_BREVO_SENDER_EMAIL` cũ. `CRM_SETTINGS_ENCRYPTION_KEY` chỉ ở server, `CRM_EMAIL_ENABLED` và `CRM_BREVO_WEBHOOK_TOKEN` giữ vai trò hiện có; giao diện chỉ hiện trạng thái/sender, không trả key. Sender phải được xác minh tại Brevo. Webhook `/api/crm/brevo-webhook` dùng Bearer token đủ dài; xem `app/api/crm/brevo-webhook/route.ts`. `ACCEPTED` là Brevo đã nhận request, `DELIVERED` cần webhook; `UNKNOWN` không tự gửi lại sau timeout/crash.

Giao thức đã đối chiếu với tài liệu Brevo: [gửi email giao dịch và đính kèm base64](https://developers.brevo.com/reference/send-transac-email), [sự kiện webhook giao dịch](https://developers.brevo.com/docs/transactional-webhooks), [bảo vệ webhook bằng Bearer token](https://developers.brevo.com/docs/secured-webhooks). Source dùng nội dung giao dịch trực tiếp; không dựa vào khả năng attachment của template cũ.

Luồng worker ở `scripts/crm/worker.ts` gọi `runDocumentMailOutbox()` sau commit, tách khỏi transaction chứng từ. Lỗi email không ghi lại kho/tiền. Retry 429/5xx có backoff; thiếu cấu hình/file còn chờ ở DEFERRED; lỗi vĩnh viễn FAILED. DEMO không gọi Brevo thật.

Mapping đầy đủ 21 nhóm, nguồn file, mọi placeholder Word và các nhánh chưa kiểm thử: [DOCUMENT-EVENT-MAPPING-2026-10-23.md](./DOCUMENT-EVENT-MAPPING-2026-10-23.md).

## Source và migration

| Nhóm | File chính |
| --- | --- |
| Nguồn/khóa/nhập/xuất/đính chính | `lib/crm/document-flow.ts`, `document-flow-model.ts`, `document-vat.ts`, `workspace.ts`, `accountant-workflow.ts`, `inventory.ts` |
| PDF và đúng mẫu gốc | `lib/crm/document-flow-pdf.ts`; `assets/crm/delivery-template/{Hoa_Don_Giao_Hang_COHAMY.docx,layout.json,logo.png}`; font dự phòng `assets/crm/fonts/` |
| Email/rule/snapshot/provider | `lib/crm/document-mail.ts`, `document-mail-model.ts`, `document-business-registry.ts`, `document-business-events.ts`, `brevo.ts`, `auth.ts`; hooks procurement/consignment/fulfillment/finance/inventory/commercial |
| API/UI/quyền | `app/api/crm/document-flow/[action]/route.ts`, API documents/webhook; `components/crm/DocumentFlowWorkspace.tsx`, `DocumentMailSettings.tsx`, shell/module/permission liên quan |
| Migration bổ sung | `037-document-flow-notifications.sql` (state/revision/VAT/rule/outbox/lock); `038-document-business-mail.sql` (snapshot business/VAT lock); `039-document-stock-link-locks.sql` (liên kết giữ hàng/audit/khóa); `040-document-handover-updated-at.sql` (bổ sung updated_at); `041-document-vat-source-revision.sql` (VAT giữ revision nguồn) |

Migration loader `lib/crm/bootstrap.ts migrate()` sắp theo tên file và đối chiếu checksum toàn tên. Repo còn `040-internal-documents.sql` thuộc phần việc khác; không xóa hoặc đổi file đó để xử lý trùng tiền tố số. Không sửa migration đã áp dụng. Không chạy migration ở production trong đợt này.

Baseline bảo toàn việc có trước: `.local/crm-document-workflow-baseline-20261023/preexisting.patch`, bản mẫu cũ riêng và `source-template.sha256`. Patch này là bản ghi thay đổi workspace trước tác vụ, không phải DB backup hoặc lệnh rollback tự động.

## Chạy local và kiểm thử lại

Từ thư mục repo, dùng PowerShell. Core test tự tạo thư mục PGlite QA mới, bật email ngoài = false; không dùng DB thật. Không chạy đồng thời core PGlite test và local web cùng giữ một thư mục DB.

```powershell
node --require ./scripts/register-server-only.cjs --import tsx scripts/crm/test-document-flow.ts
node --require ./scripts/register-server-only.cjs --import tsx scripts/crm/test-document-mail-provider.ts
node --require ./scripts/register-server-only.cjs --import tsx scripts/crm/test-document-outbox-states.ts
node --require ./scripts/register-server-only.cjs --import tsx scripts/crm/test-document-business-mail.ts
node --require ./scripts/register-server-only.cjs --import tsx scripts/crm/test-document-warehouse-scope.ts
node --require ./scripts/register-server-only.cjs --import tsx scripts/crm/test-document-flow-reservations.ts
node scripts/crm/run-document-local.mjs
```

Server local ở `http://127.0.0.1:4341`; sau khi sẵn sàng, terminal khác chạy:

```powershell
node scripts/crm/verify-document-flow-browser.mjs
```

Kiểm chứng restart: chạy `node scripts/crm/verify-document-restart.mjs --capture`, khởi động lại đúng tiến trình local 4341 với cùng fixture/dataDir, sau đó chạy `node scripts/crm/verify-document-restart.mjs --verify`. Hai bước đọc chứng từ/rule và so checksum; không tạo lại fixture giữa capture và verify.

Tài khoản fixture riêng được ghi trong `.local/crm-document-flow-run.json`; không dùng chúng hoặc mật khẩu thử cho môi trường thật. Script browser dùng Edge headless; ảnh kết quả nằm dưới `docs/crm/test-results/document-flow/`.

Các suite regression có instrument capture event khi `CRM_QA_DOCUMENT_MAIL=true`:

```powershell
$env:CRM_QA_DOCUMENT_MAIL='true'
npm run test:crm:inventory
npm run test:crm:procurement
npm run test:crm:consignment
npm run test:crm:fulfillment
npm run test:crm:finance
npm run test:crm:commercial-orders
npm run test:crm:security
Remove-Item Env:CRM_QA_DOCUMENT_MAIL
npm run typecheck
$env:CRM_QA_BUILD='true'
$env:CRM_QA_BUILD_VARIANT='documents'
npm run build
Remove-Item Env:CRM_QA_BUILD
Remove-Item Env:CRM_QA_BUILD_VARIANT
```

PostgreSQL QA là **native PostgreSQL 17.11 chạy trên máy local**, port `127.0.0.1:55432`, binaries/data trong `.local/postgres-document-qa/`. Khi server task-local này đang chạy, `node scripts/crm/run-document-native-qa.mjs` tạo DB QA mới và chạy core test; script không nhận URL DB bên ngoài, giữ lại identity fixture PGlite dùng cho browser. Test chạy migration fixture bằng owner rồi service bằng role DML không có quyền ghi migrations/đổi audit. Guard dùng `CRM_ENVIRONMENT=STAGING` kèm `CRM_QA_NATIVE_LOCAL=true` để cho phép kết nối QA; giá trị env đó **không chứng minh staging deployment**. Không trỏ test vào DB có dữ liệu thật.

Native QA server được dừng sau kiểm chứng. Nếu cần chạy lại, dùng đúng dataDir task-local này; không đổi sang một PostgreSQL đã cài cho công việc khác:

```powershell
$qaPgRoot=(Resolve-Path '.local/postgres-document-qa').Path
& "$qaPgRoot/pgsql/bin/pg_ctl.exe" -D "$qaPgRoot/data" status
& "$qaPgRoot/pgsql/bin/pg_ctl.exe" -D "$qaPgRoot/data" -l "$qaPgRoot/server.log" -o '-h 127.0.0.1 -p 55432' start
node scripts/crm/run-document-native-qa.mjs
& "$qaPgRoot/pgsql/bin/pg_ctl.exe" -D "$qaPgRoot/data" -m fast stop
```

## Bằng chứng và trạng thái kiểm thử

Chỉ mục kết quả: `test-results/document-flow/verification-summary.json` ghi 17 suite, checksum source/mẫu và giới hạn bằng chứng. Entry ERP hiện có `scripts/crm/test-erp-accounting-vat.ts` đã chạy lại thành công 19/19 qua bộ hồi quy mới. Native PostgreSQL task-local đã được dừng sau QA; web PGlite local vẫn chạy tại 127.0.0.1:4341.


| Kiểm tra | Bằng chứng đã có | Giới hạn |
| --- | --- | --- |
| Core PGlite | `test-results/document-flow/integration-pglite.json`: 19 nhóm PASS | DB nhúng riêng, không phải PostgreSQL server production |
| Core native PostgreSQL | `test-results/document-flow/integration-postgres.json`: 19 nhóm PASS | PostgreSQL 17.11 task-local, role DML. Artifact mới ghi rõ native LOCAL |
| Browser | `test-results/document-flow/browser-local.json`: 7 nhóm PASS, Edge, không pageerror; desktop 1440 và mobile 390. Có phiếu xuất không đơn nguồn bằng form thật: preview không đổi tồn, xác nhận trừ 1, phần tiền trống/chỉ đọc | Browser hiện dùng PGlite, chưa phải browser trên native PostgreSQL |
| Provider | `test-results/document-flow/provider-fake.json`: 5 nhóm PASS | fetch giả, không gọi internet/mailbox Brevo |
| Trạng thái outbox/webhook | `test-results/document-flow/outbox-states-pglite.json`: 10 nhóm PASS, `networkAttempts=0` | Provider giả trên fixture PGlite mới: stale SENDING → UNKNOWN, gửi lại có audit, backoff 429/5xx đến hết 5 lần, lỗi vĩnh viễn, defer không tốn lượt, bounce/sai thứ tự và webhook đến trước API response |
| Business preview/mail | `test-results/document-flow/business-mail-local.json`: 5 nhóm PASS | BUSINESS fixture kiểm preview/file/rule; BUNDLE dùng core service thật; không coi fixture RFQ là nhánh nghiệp vụ RFQ đã chạy |
| Phạm vi kho | `test-results/document-flow/warehouse-scope-local.json`: 7 nhóm PASS | Service thật trên fixture PGlite riêng; có kho nguồn/đích và ký gửi |
| Giữ hàng/đính chính | `test-results/document-flow/reservations-pglite.json`: 9 nhóm PASS; `reservations-postgres.json`: 10 nhóm PASS | Kiểm luồng xuất có reservation, đính chính bù và khóa trên DB tương ứng |
| Khởi động/đăng nhập lại | `test-results/document-flow/restart-verification.json`: 5 nhóm PASS, 36 revision PDF, 2 phiên bản VAT, 1 rule giữ nguyên | Edge mới đăng nhập và đọc sau restart; kiểm checksum/bytes, không ghi lại chứng từ/email |
| Security | `test-results/security-local.json`: 5 nhóm PASS | Fixture PGlite, không thao tác tài khoản/email thật |
| Inventory/procurement/consignment/fulfillment/commercial-orders | Suite local lần ghi nhận: 9/8/8/8/15 nhóm PASS; capture riêng `events-verify-*.json` | Capture không đồng nghĩa phủ mọi nhánh registry |
| Finance | `test-results/finance-local.json`: 10 nhóm PASS | Quyền ghi dùng Manager phù hợp luồng mới, không mở lại quyền tiền cho kế toán |
| Typecheck/build | `npm run typecheck` PASS; build với `CRM_QA_BUILD=true`, `CRM_QA_BUILD_VARIANT=documents` PASS, không warning | Bằng chứng compile/build LOCAL ở biến thể QA tài liệu; không phải deployment hoặc full build production |

Sáu capture `events-verify-*.json` ghi **63 tên event thật (58 business + 5 core)**. Nhóm thứ 19 trong core integration còn bật cả 9 core event và thực hiện service thật từ đề nghị/tiếp nhận/giao/nhận lệch/đính chính đến VAT lưu/thay và xuất: hợp bằng chứng hiện có là **67/89 event khả dụng có thực thi service thật**. Sáu artifact `source-mapping-verify-*.json` hợp lại có **80/80 business event SOURCE_MAPPING_PASS**: replay registry trên record fixture để kiểm PDF/bytes; không phải 80 nhánh nghiệp vụ đã chạy. **22 business nhánh** chưa có thực thi service riêng, danh sách nằm trong mapping 21 nhóm.

Ảnh chính: `admin-request.png`, `factory-locked.png`, `warehouse-autofilled-receipt.png`, `warehouse-received-98.png`, `warehouse-delivery-form.png`, `warehouse-delivery-locked.png`, `accountant-paired-documents-vat.png`, `admin-document-notifications.png`, `accountant-mobile-390.png`, `warehouse-mobile-390.png`. `browser-issued.pdf` là phiếu xuất đã chốt qua form browser. Ảnh debug form không phải bằng chứng nghiệm thu.

Mẫu Word gốc được giữ nguyên, SHA-256 `6aa3889e7c1b772e436b754080beaaa02aa150176991f7498690fab53627ac3e`. `source-docx-page-1.png`/`source-docx-browser.pdf` là render bằng docx-preview và Edge; `template-pdfkit-reference*.png/pdf` đối chiếu renderer PDFKit theo XML/layout. PDF dữ liệu thử 1/12/80 dòng có 1/2/5 trang; cả **8 trang** đã được xem trực quan sau sửa phân trang, không thấy cắt/chồng nội dung ở fixture, header bảng lặp và chữ/số tiền lớn đọc được. Chi tiết `test-results/document-flow/pdf-visual-qa.md` ghi rõ khác biệt typography/vị trí/khoảng cách so với DOCX browser render; chưa chứng minh giống Microsoft Word 100%. Không báo mục tiêu 100% đã đạt.

## Backup, rollback và điểm còn lại

Trước khi áp dụng ngoài QA: dừng worker gửi email, tạm tắt khả năng ghi, chụp backup PostgreSQL đầy đủ (schema + dữ liệu + migrations + BYTEA file/VAT/PDF/audit), lưu kèm release/source và kiểm tra restore sang DB riêng. Chỉ restore thử thành công mới chọn lịch migration. Không có DB backup production hoặc restore production nào được thực hiện trong session này.

Rollback an toàn là giữ schema bổ sung và quay lại source tương thích sau khi đã kiểm tra. Khi đã có chứng từ mới, không drop bảng/cột/revision, xóa chứng từ hay sửa số dư để rollback. Sửa số lượng qua Admin amendment/bút toán bù có audit. Nếu cần phục hồi toàn DB, restore sang DB mới để đối chiếu/migrate các phát sinh sau backup trước khi chuyển; không đè DB đang chạy bằng snapshot cũ làm mất nghiệp vụ.

Các giới hạn cần xử lý trước khi gọi hoàn thành toàn bộ yêu cầu:

- Chưa có biên bản riêng chốt xử lý chênh lệch nhà máy, sự kiện gửi đề nghị bổ sung ký gửi riêng, hoặc action NCC từ chối thanh toán; registry chỉ công khai nghiệp vụ có thật.
- Business rule có giới hạn ngữ cảnh phạm vi; UI/service chặn các chiều không hỗ trợ. Tài liệu nhiều kho không được lọc thành một kho tùy ý. Xem mapping để chọn phạm vi phù hợp.
- 22 business event chưa có nhánh service thực riêng; SOURCE_MAPPING 80/80 chỉ chứng minh registry → record/snapshot/file. Không dùng replay để báo 80/80 nghiệp vụ đã chạy.
- PDF BUSINESS là bản trình bày snapshot; chưa có đối chiếu mẫu riêng cho mọi chứng từ. Word giao hàng chưa có chứng nhận fidelity 100%.
- Chưa kiểm tra mailbox/webhook thật, không có staging deployment hoặc production proof. Cần người dùng/Admin chọn địa chỉ thử và cấu hình provider trước test gửi thật.
