# CRM Cohamy — trạng thái bàn giao LOCAL

> **Snapshot lịch sử trước yêu cầu thiết kế lại.** Trạng thái hiện tại và bằng chứng mới ở [WORKSPACE-UPGRADE.md](WORKSPACE-UPGRADE.md). Các dòng bên dưới về launcher HumanBank, chưa tasks/phân công/password reset và lint/dependency là thông tin tại thời điểm snapshot, không đại diện cho bản nâng cấp mới. Các gate kho–công nợ vẫn chưa hoàn tất.

Ngày: 18/09/2026. **Chưa hoàn thành phase 0–6; chưa đủ điều kiện chạy kinh doanh thật.** Có source chạy được, không chỉ bản kế hoạch; các gate nghiệp vụ chưa được tự giả định.

## Đã thay đổi thực tế

- Chuyển shell/launcher/login/particles/navigation và mẫu table/form HumanBank sang `/crm`, `/portal`; dùng logo Cohamy, CSS scope riêng. Final HumanBank control cascade là radius 4px/fill phẳng, không dựa vào đoạn legacy cũ.
- Tạo schema/migrations Cohamy độc lập; PostgreSQL qua pg là mặc định, PGlite persistent chỉ cho QA LOCAL. User/membership/session opaque-hashed, bcrypt, quyền và scope server; không role switch hoặc login mẫu trong runtime bình thường.
- CRUD partner có phiên bản chống ghi đè; sales được giao; warehouse directory thuộc tổ chức; account tạo/khóa; mapping 10 website products có ID/slug/images/bản dịch giữ nguyên. SKU `WEB-*` chưa phải SKU/unit thương mại được duyệt.
- Mở lại cart/checkout; khi intake bật có đường UI sản phẩm → giỏ → gửi yêu cầu. API lưu pending/unpaid, unique idempotency + request hash, server reprice chính xác, trả code/subtotal. Lỗi giữ cart; chưa payment gateway, phí giao, giữ hàng, owner hoặc AR.
- Phân hệ chưa triển khai ghi rõ trên màn, không có doanh số/tồn/nợ giả. Chưa có export hoặc API finance posting để đại lý vượt quyền.
- Không sửa hoặc deploy HumanBank; 25 hash file tham chiếu vẫn khớp. Database/users/secrets nguồn không chuyển sang Cohamy. Source backup trước sửa được giữ trong `.local`.

## Gate theo phase

| Phase | Kết quả có source/bằng chứng | Gate hiện tại |
|---|---|---|
| 0 | PASS khảo sát nguồn, mapping, quyết định kiến trúc, UI contract, role matrix, proposed state machines | BLOCKED: owner/AR, ký gửi settlement price, policy/credit, unit/kho/lô/đầu kỳ và supplier/AP chưa chốt |
| 1 | PASS LOCAL UI/access, partner scope A/B, lock/expiry/logout, route và style isolation trong QA | Chưa nghiệm thu staging PostgreSQL/CMS thật; pixel-pair operational HumanBank table NOT RUN |
| 2 | Có catalog mapping, partner CRUD và warehouse directory | NOT RUN sổ kho, unit conversion, vị trí, lot/expiry/owner buckets, reservations, opening import; chưa qua gate |
| 3 | PASS LOCAL website pending intake, reprice, retry/double-submit, refresh và bảo toàn cart khi lỗi | BLOCKED mua đứt hoàn chỉnh: chưa policy/approval/reserve/shipment/receipt/AR/cash/credit/return; không gọi intake là full sales order |
| 4 | Menu/màn trạng thái chưa mở, không ledger | BLOCKED giá/thỏa thuận ký gửi; NOT RUN giao100/bán30/còn70, settlement AR và payment |
| 5 | Audit append-only nền, QA restart/restore và hướng dẫn vận hành | NOT RUN supplier/AP, operational reports/export, opening data, service PostgreSQL backup/restore |
| 6 | Có local access/browser/CMS contract tests, screenshots và build | NOT RUN thử nghiệm nhóm đại lý/staging/nghiệp vụ kho–nợ; không đủ điều kiện nghiệm thu toàn CRM |

## Kiểm chứng và giới hạn

| Kiểm tra | Môi trường | Trạng thái | Bằng chứng/giới hạn |
|---|---|---|---|
| Access/database foundation | LOCAL | PASS | `test-results/access-local.json`: 21 cases, actual persisted PGlite; A/B, assigned scope, rollback, audit, role/org mismatch, lock/expiry/logout, intake idempotency |
| Browser functional/UI | LOCAL | PASS | `test-results/browser-local.json`: 15 cases, Edge; source comparison metrics, 1366/390/320, real form login/CRUD/checkout; simulated 503 then actual persistence |
| Reopen/restore QA snapshot | LOCAL | PASS | `test-results/durability-local.json`; 10 products, 4 pending unpaid requests và audit khớp logical SHA-256. Closed QA DB only, không PostgreSQL service backup hoặc stock/finance ledger |
| Production build tracing | LOCAL | PASS | `test-results/build-traces-local.json`; 53 traces, không gói `.local` DB/backup/screenshots/HumanBank reference; không phải deploy |
| typecheck/build | LOCAL | PASS | Lệnh chạy exit0; build 117 pages, dynamic CRM/portal/API. Build không chứng minh nghiệp vụ hoặc production readiness |
| Lint các file CRM và public integration đã sửa | LOCAL | PASS | ESLint scoped source exit0; không tắt rule |
| Lint toàn repository | LOCAL | FAIL | Một lỗi `react-hooks/purity` ở `app/not-found.tsx:10` (`Date.now()` trong render). File không có trong backup trước sửa, LastWriteTime 02:34:47; không thuộc CRM edits. Giữ nguyên thay đổi ngoài phạm vi |
| CMS validation/contracts | LOCAL | PASS | `npm run test:cms`, `test:headless:contract`; sanitizer, schema/SEO, auth/upload/matcher và retry contract. Không gửi contact hay quản trị CMS live |
| HumanBank auth/router | LOCAL REFERENCE | Mock only | Actual source components/CSS; synthetic identity, mock auth/router. Không có phiên live backend nguồn |
| Website products/locale/style | LOCAL | PASS ở nguồn static QA | Legacy source được bật riêng trong QA; năm locale và public font không bị CRM override |
| SEO giỏ hàng/checkout/danh mục | LOCAL | PASS | `test-results/seo-local.json`: 15 rendered-metadata checks ở năm locale; cart/checkout noindex/nofollow, danh mục không noindex và giữ canonical. Không phải bằng chứng crawler đã cập nhật index |
| Sheets/WordPress runtime/delivery | LOCAL/STAGING | BLOCKED/NOT RUN | Không lấy credential. Default Sheets không có cấu hình, homepage baseline báo `BLOG_SHEETS_NOT_CONFIGURED`; không đánh dấu live CMS PASS nhờ static fallback |
| Contact → CRM / tasks / history | LOCAL | NOT RUN | Contact route hiện tại được giữ, không gửi thử ra Sheets và chưa nối CRM dedupe |
| Stock competition/lot/owner/FEFO/receipt retry | LOCAL/STAGING | NOT RUN | Chưa có stock ledger/reservations; PGlite one-connection retry không chứng minh hai kết nối tranh tồn |
| AR/AP/cash/allocation/return/consignment | LOCAL/STAGING | BLOCKED/NOT RUN | Chưa có ledger hoặc policies; không số liệu bịa |
| PostgreSQL service/runtime/grants/RLS | LOCAL/STAGING | NOT RUN | Không có service/tools PostgreSQL hoặc connection Cohamy được cấu hình cho lượt này; adapter pg chưa nghiệm thu integration |
| Private API no-store / robots noindex | LOCAL | PASS | Auth required; API response no-store; `/crm`,`/portal` excluded robots. Next dev overrides page header thành no-cache; production page cache header NOT RUN |
| Console sample | LOCAL | PASS giới hạn | `test-results/console-local.json`: fresh Edge context không gặp console error trong 8 trang; có 5 warnings public logo aspect ratio/LCP. Không phải chứng nhận toàn app không lỗi |
| Production deploy/data import/external sends | PRODUCTION | NOT RUN | Không được yêu cầu/không thực hiện |

## Lỗi đã phát hiện và sửa

Reduced-motion selector nguồn thua `!important` specificity; đã thêm override scoped đủ specificity và test thật. Cart/checkout redirect contact cùng thiếu CTA vào cart đã sửa bằng opt-in intake. Receipt sau submit bị giữ scroll cuối trang; đã đưa về đầu để thấy code. SQL options của form không còn mất tổ chức Cohamy khi list20 đầy.

Harness i18n loopback origin, locator QA trùng tên/Next route-announcer và screenshot sai viewport đã sửa, không che test lỗi. Reviewer yêu cầu tắt Next dev N vì che Home; verdict-pass đã chấm fix này resolved, disposition ship chỉ cho fix. Real pointer/click Home được test ở 1366/390/320. Xem `UI-FINISH-REVIEW.md`; không chuyển nhận xét UI thành chứng nhận backend.

Build tracing từng suy luận cả `.local` từ path literal; đã siết path LOCAL và tracing exclusions, thêm kiểm thử manifest. Không xóa database QA/backup để tránh warning.

## Rủi ro trước phát hành

`dependency-audit-local.json`: npm audit production dependencies báo 33 findings (29 moderate, 3 high, 1 critical), có Next.js 16.2.12 critical và sharp high; nhiều cảnh báo thuộc chuỗi thư viện incumbent. Chưa auto-upgrade hoặc `audit fix --force`. **BLOCKED production release** cho đến khi xử lý/đánh giá advisories và chạy regression sau upgrade. Added CRM packages không xuất hiện như nguồn advisory trong snapshot này; không suy ra toàn hệ thống an toàn.

Chưa MFA/password reset, fine-grained price policies, UI phân công sales/kho hoặc DB least-privilege nghiệm thu. Intake global60/15min là hạn chế bảo thủ, chưa limiter theo client từ trusted gateway; cùng mạng lớn có thể bị chặn. Chưa cleanup job cho sessions/attempts, upload proof-payment, export, migration deploy/rollback rehearsal trên PostgreSQL.

## Tiếp tục đúng thứ tự

1. Chốt owner/AR mua đứt; settlement formula/period ký gửi; policy/credit/approvers; kho/unit/lot/đầu kỳ và độ cập nhật dealer stock; supplier/AP.
2. Hoàn thiện phase2 sổ kho; test conservation, receipt retry, expired/blocked lots và concurrent reservations trên PostgreSQL nhiều connections.
3. Phase3 luồng mua đứt hoàn chỉnh; phase4 ký gửi; phase5 reports/import/backup; phase6 pilot acceptance.
4. Chỉ deploy/nhập dữ liệu thật/gửi thông báo sau chỉ dẫn rõ ràng và bằng chứng đủ gate.

Hướng dẫn chạy: `RUNBOOK.md`. Khảo sát/mapping/quyền: `PHASE-0-AUDIT.md`. Ảnh và JSON: `test-results/`. Hệ thống thiết kế được ghi riêng trong `components/crm/DESIGN.md` và `components/crm/.impeccable/design.json`, không áp vào public website/CMS.
