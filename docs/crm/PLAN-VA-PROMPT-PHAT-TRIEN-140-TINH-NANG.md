# COHAMY — KẾ HOẠCH VÀ PROMPT PHÁT TRIỂN 140 TÍNH NĂNG

Ngày lập: 19/09/2026. Phiên bản: 1.0.

Tài liệu giao việc phát triển tiếp hệ thống hiện có. Phần A là kế hoạch và danh mục nghiệm thu; phần B là prompt để giao Codex thực hiện. Việc tạo tài liệu này không đồng nghĩa các tính năng đã được xây dựng hoặc được đưa lên production.

## Cách sử dụng

1. Mở task Codex trong repository `C:\Users\ACER\OneDrive\Desktop\cohamy-website-main`.
2. Đính kèm toàn bộ tài liệu này, hoặc yêu cầu Codex đọc file `docs/crm/PLAN-VA-PROMPT-PHAT-TRIEN-140-TINH-NANG.md` trong repository.
3. Sao chép nguyên khối prompt ở phần B vào task. Prompt tham chiếu danh mục F001–F140 trong phần A, vì vậy phải cung cấp cả tài liệu, không chỉ riêng khối prompt.
4. Codex bắt đầu khảo sát thực tế, lập bảng đối chiếu rồi triển khai theo thứ tự phụ thuộc. Bảng quyết định nghiệp vụ được xử lý song song với phần việc không phụ thuộc.

---

# PHẦN A — KẾ HOẠCH PHÁT TRIỂN

## A1. Mục tiêu và ranh giới

Phát triển Cohamy thành hệ thống quản lý kinh doanh cho nhân sự nội bộ và cổng tự phục vụ cho đối tác/đại lý: đăng ký, xét duyệt, chăm sóc, báo giá, đặt hàng, kho, giao nhận, đối soát và điều hành.

Phạm vi sản phẩm là đúng 140 tính năng F001–F140 trong tài liệu. Không tự thêm nhóm AI hoặc tích hợp mở rộng từng được gợi ý ở các mục 141–150. Những kết nối cần thiết để hoàn thành F005, F066, F089 hoặc các tính năng được chọn vẫn thuộc phạm vi phụ thuộc của chính tính năng đó.

Các nguyên tắc sản phẩm:

- Người ngoài không có quyền sử dụng dữ liệu nghiệp vụ chỉ vì đã đăng ký.
- Đối tác/đại lý tự điền hồ sơ; Cohamy xét duyệt, gắn tổ chức và cấp quyền trước khi sử dụng.
- Nhân viên Cohamy dùng `/crm`; đại lý dùng `/portal`. Route đăng ký/chờ duyệt được thiết kế nhất quán với hai khu vực này.
- Một đại lý không truy cập được hồ sơ, giá riêng, đơn, tệp, tồn hoặc công nợ của đại lý khác.
- Nhân viên nội bộ chỉ thao tác theo vai trò và phạm vi được giao; quản trị có công cụ giải thích quyền dễ hiểu.
- Giữ website công khai và danh mục sản phẩm hoạt động. Bổ sung lối vào đối tác theo F010 mà không viết lại website hoặc CMS ngoài phạm vi.
- Tính năng mới phải giúp hoàn thành công việc thực tế, có dữ liệu lưu bền, có trạng thái lỗi và cách tiếp tục.
- Không coi yêu cầu đặt hàng, đơn được duyệt, hàng đã giao, tiền đã thu và doanh thu là cùng một sự kiện.

## A2. Nền tảng hiện có cần kế thừa

Thông tin dưới đây dựa trên source và tài liệu đọc khi lập kế hoạch; Codex triển khai phải đối chiếu lại checkout, schema và trạng thái chạy thật.

| Khu vực | Nền đã có | Hướng phát triển |
|---|---|---|
| Truy cập | Đăng nhập, phiên, vai trò nội bộ/đại lý, kiểm tra quyền phía server | Thêm đăng ký giới hạn quyền, xác minh, xét duyệt, MFA và quản lý thiết bị |
| Khách/đại lý | Hồ sơ, người liên hệ cơ bản, nguồn, nhóm, giai đoạn, phân công | Mở rộng đa liên hệ, hồ sơ tổng hợp, gộp trùng, cơ hội, thăm điểm bán |
| Yêu cầu website | Tiếp nhận, lọc, phân công, ghi chú và chuyển trạng thái | Kết nối sang báo giá/đơn thương mại theo chính sách đã chốt |
| Công việc | Tạo, hạn, người phụ trách, hoàn thành/mở lại | Checklist, lặp lại, phụ thuộc, bàn giao, thông báo và chuyển cấp |
| Hàng hóa | Ánh xạ danh mục website, SKU và metadata quy cách | Thêm đơn vị, bảng giá, lô, số dư, giữ hàng và sổ kho |
| Kho | Danh mục kho và phân công | Xây giao dịch kho; danh mục kho hiện có không phải sổ nhập–xuất–tồn |
| Báo cáo | Thống kê tiếp nhận từ dữ liệu thật | Tách báo cáo bán hàng, giao hàng, tiền, kho và biên lợi nhuận |
| Vận hành | Đã có đợt triển khai CRM và kiểm tra PostgreSQL/HTTPS | Bổ sung quy trình staging, migration, kiểm tra concurrency, backup tự động |

Nguồn trong repository cần đọc: `AGENTS.md`, `package.json`, `lib/crm/`, `db/crm/`, `app/(operations)/`, `app/api/crm/`, `components/crm/`, `docs/crm/WORKSPACE-UPGRADE.md`, `docs/crm/RUNBOOK.md`, `components/crm/DESIGN.md`, `docs/crm/WORKSPACE-UI-CONTRACT.md` và script triển khai hiện hành.

`docs/crm/IMPLEMENTATION-STATUS.md` là snapshot lịch sử. Tài liệu `WORKSPACE-UPGRADE.md` cũng có các dòng trạng thái trước deploy. Không lấy những dòng “chưa deploy” cũ làm kết luận hiện hành. Báo cáo cục bộ `.local/reports/cohamy-deployment.md`, nếu còn, ghi một lần triển khai ngày 18/09/2026; đây là bằng chứng lịch sử, không thay việc kiểm tra hiện trạng.

Theo đợt bàn giao đó, Cohamy dùng Node 22 riêng và PM2 fork. Khi triển khai sau này phải xác minh executable, cwd và SHA thực tế, không chỉ đọc trường cấu hình. Đã từng gặp việc PM2 reload giữ thư mục cũ và Next rewrite lặp khi candidate bind không phù hợp; giữ các regression liên quan.

## A3. Cách quản lý 140 tính năng

Tạo bảng theo dõi `docs/crm/FEATURE-MATRIX-140.md` khi bắt đầu triển khai. Mỗi ID phải có:

- Tên, giai đoạn, trạng thái hiện có và phần còn thiếu.
- Route/màn hình, API, schema/migration và quyền liên quan.
- Phụ thuộc tính năng, quyết định nghiệp vụ và dịch vụ ngoài.
- Tiêu chí nghiệm thu, lệnh/bằng chứng test, môi trường và thời điểm kiểm tra.
- Commit hoặc release chứa tính năng, lỗi còn mở và bước tiếp theo.

Trạng thái thống nhất: `NOT_STARTED`, `IN_PROGRESS`, `IMPLEMENTED`, `VERIFIED_LOCAL`, `VERIFIED_STAGING`, `RELEASED`, `BLOCKED`. `IMPLEMENTED` chưa có nghĩa là được nghiệm thu. `BLOCKED` phải nêu điều kiện thiếu và phần việc vẫn có thể tiếp tục.

Không đổi ID hoặc gộp hai ID thành một dòng đã hoàn thành. Có thể dùng chung một thành phần cho nhiều tính năng, nhưng mỗi tiêu chí vẫn phải được kiểm tra riêng. Danh sách này là backlog mục tiêu, không phải yêu cầu tạo 140 menu.

## A4. Các quyết định nghiệp vụ cần quản lý

Codex tổng hợp thành `docs/crm/BUSINESS-DECISIONS.md`. Trước khi hỏi, đọc tài liệu và quyết định đã có; không hỏi lại câu đã được trả lời. Có thể đưa ra đề xuất để người phụ trách chọn, nhưng phải phân biệt đề xuất với quy định đã được phê duyệt.

| Mã | Quyết định cần chốt | Tính năng chịu ảnh hưởng | Cách tiến hành khi chưa chốt |
|---|---|---|---|
| D01 | Đăng ký qua link mời hay form mở; trường bắt buộc; đơn vị xét duyệt | F001–F010 | Xây hai chế độ cấu hình; hồ sơ chưa duyệt chỉ được xem/sửa thông tin của mình |
| D02 | Xác minh email hay SMS; nhà cung cấp và thông tin kết nối | F005, F137 | Xây adapter và kiểm thử giả lập; chưa đánh dấu xác minh thật nếu chưa có kênh hoạt động |
| D03 | Mô hình đối tác/đại lý, chi nhánh và người được mời nhân viên | F006, F008, F016–F018, F136 | Kế thừa vai trò hiện có; không cho tự nhận tổ chức hoặc tự cấp vai trò nội bộ |
| D04 | Cấp đại lý, bảng giá, thuế/phí, chiết khấu, mức tối thiểu, chương trình tặng | F031–F040, F081 | Xây cơ chế chính sách có phiên bản; không tự áp một mức thương mại giả cho dữ liệu thật |
| D05 | Ai duyệt đơn; khi nào giữ hàng, giao hàng, chuyển sở hữu, ghi phải thu/doanh thu | F041–F050, F056, F081–F090, F115–F116 | Định nghĩa sự kiện và trạng thái riêng; chưa tự động ghi sổ khi thiếu chính sách |
| D06 | Đơn vị cơ sở, quy đổi, SKU thương mại, kho, lô, tồn đầu kỳ, giá vốn | F051–F060, F116, F118 | Làm schema, cấu hình và QA giả lập; import tồn thật cần dữ liệu được đối chiếu |
| D07 | Hạn dùng còn lại tối thiểu, cách ly, xuất lô, kiểm kê và chênh lệch | F054–F060, F070 | Các điều kiện chặn giao dịch phải hiện rõ lý do và quyền xử lý |
| D08 | Vận chuyển, phí giao, bằng chứng nhận, đổi trả và hoàn tiền | F061–F070, F090 | Hỗ trợ thao tác nội bộ; kết nối vận chuyển chỉ mở khi có cấu hình hợp lệ |
| D09 | Có vận hành ký gửi hay không; sở hữu, báo bán, phần hưởng, kỳ đối soát | F071–F080 | Vẫn phát triển luồng QA/cấu hình; giữ giao dịch production chưa kích hoạt nếu chưa được chốt |
| D10 | Hạn mức, kỳ hạn, đặt cọc, phân bổ tiền, ngoại lệ quá hạn và khóa kỳ | F081–F090 | Xây chính sách có phiên bản và màn phê duyệt; không tự thay khoản nợ thật |
| D11 | Duyệt mua, nhận hàng, trả nhà cung cấp, ghi phải trả và giá vốn | F091–F100 | Chuẩn bị luồng và fixture; chờ chính sách trước ghi sổ thật |
| D12 | Kênh thông báo, lịch, múi giờ, chuyển cấp, người được nhận | F089, F103, F107–F110, F120 | Ưu tiên in-app; kiểm thử kênh ngoài với hộp thư/số thử được chỉ định |
| D13 | Tài liệu chính sách, thời hạn lưu dữ liệu, nhu cầu khôi phục và nơi lưu backup | F009, F019, F133–F134, F140 | Xây quản lý phiên bản; không tự viết chính sách kinh doanh thay khách |

Không dừng toàn dự án chỉ vì một quyết định chưa có. Hoàn thành phần độc lập, kiểm thử luồng phụ thuộc bằng dữ liệu giả được ghi rõ và giữ trạng thái chưa nghiệm thu cho phần thật bị chặn. Không dùng nút “sắp có” làm bằng chứng hoàn thành.

## A5. Kiến trúc triển khai

### A5.1. Cấu trúc ứng dụng

Ưu tiên mở rộng ứng dụng hiện tại thành các module trong cùng hệ thống. Không tự tách microservice, đổi framework hoặc thay database chỉ để làm mới kiến trúc.

- Next.js/TypeScript theo phiên bản thực tế trong repo. Đọc hướng dẫn phù hợp trong `node_modules/next/dist/docs/` trước khi sửa code framework.
- PostgreSQL là môi trường xác nhận giao dịch và tranh chấp nhiều kết nối. PGlite có thể dùng cho test nhanh nhưng không thay thế kiểm thử concurrency PostgreSQL.
- Dùng lớp nghiệp vụ dùng chung cho API và UI; không đặt quy tắc giá, kho hoặc công nợ chỉ trong giao diện.
- Tác vụ nền dùng hàng đợi bền và worker/scheduler có giám sát; chọn cách tích hợp phù hợp môi trường hiện có.
- Tệp riêng tư qua storage abstraction; quyền đọc được kiểm tra trước khi tải. URL chia sẻ có phạm vi và thời hạn phù hợp.
- Import/export và sinh báo cáo lớn chạy theo job, có tiến độ, lỗi từng dòng và quyền truy cập kết quả.

### A5.2. Các miền dữ liệu dự kiến

| Miền | Đối tượng chính | Yêu cầu |
|---|---|---|
| Tiếp nhận đối tác | Hồ sơ, lượt xét duyệt, yêu cầu bổ sung, xác minh, lời mời | Tách khỏi membership đang hoạt động; lưu lịch sử quyết định |
| Tổ chức và người dùng | Tổ chức, chi nhánh, người liên hệ, membership, scope, phiên | Kế thừa mô hình hiện có; scope đi cùng mọi truy vấn |
| Quan hệ khách hàng | Nhãn, sở thích, cơ hội, lần thăm, hàng mẫu, hồ sơ hợp nhất | Lưu nguồn và liên kết lịch sử khi gộp |
| Giá và báo giá | Bảng giá, phiên bản, mức số lượng, chương trình, báo giá, lần duyệt | Tiền dùng kiểu chính xác; snapshot chính sách đã áp dụng |
| Đơn hàng | Đơn, dòng hàng, lần sửa, phê duyệt, giao từng phần, nhu cầu còn thiếu | Chống gửi lặp và ghi đè; không gộp trạng thái tiền–hàng |
| Kho | Đơn vị, vị trí, lô, movement, reservation, kiểm kê, chuyển kho | Lưu phát sinh để truy xuất, chống tồn âm ngoài chính sách |
| Giao nhận | Phiếu soạn, kiện, chuyến, vận đơn, giao nhận, đổi trả | Truy ngược đến đơn, SKU, lô và lượng thực tế |
| Ký gửi | Thỏa thuận, lượng gửi/nhận/bán/trả, kỳ đối soát | Tách chủ sở hữu khỏi nơi giữ hàng; khóa kỳ và điều chỉnh có lịch sử |
| Tài chính vận hành | Phải thu/phải trả, thanh toán, phân bổ, đặt cọc, hoàn tiền | Mỗi phát sinh có nguồn; đảo/điều chỉnh thay cho xóa lịch sử |
| Mua hàng | Đề nghị, báo giá nhà cung cấp, đơn mua, nhận/trả | Liên thông kho, phải trả và dữ liệu giá vốn |
| Tiện ích | Checklist, lịch lặp, người theo dõi, notification, preference | Quyền và trạng thái giao việc nhất quán với hồ sơ gốc |
| Dữ liệu và vận hành | Tài liệu, version, custom field, import/export job, audit, backup job | Có quyền, tiến độ, lịch sử và cách khôi phục |

Tên bảng chỉ là định hướng. Phải khảo sát schema thực trước khi đặt tên hoặc tạo migration; không tạo bảng trùng ý nghĩa với bảng hiện hữu.

### A5.3. Những bất biến bắt buộc

1. Tenant/scope được kiểm tra trên server với danh sách, chi tiết, tìm kiếm, export, notification, job và file download.
2. Đăng ký chưa duyệt không có quyền đọc catalog riêng, giá đại lý, đơn, kho hoặc tài chính.
3. Một hồ sơ chỉ được cấp membership một lần cho cùng quyết định duyệt; retry không tạo tổ chức/tài khoản trùng.
4. Tiền và số lượng quy đổi dùng biểu diễn chính xác; có quy tắc làm tròn được chốt, không tính sổ bằng số float thiếu kiểm soát.
5. Đơn xác nhận lưu snapshot giá và chính sách; không tự thay khi bảng giá hiện hành đổi.
6. Các nghiệp vụ kho/tài chính dùng transaction và khóa phù hợp; có unique constraint/idempotency cho thao tác có thể gửi lại.
7. Chứng từ đã ghi sổ không xóa âm thầm. Điều chỉnh phải liên kết chứng từ gốc, có lý do và người thực hiện.
8. Tồn thực, tồn đã giữ, tồn khả dụng và lượng tại đại lý ký gửi được định nghĩa rõ; không cộng trộn làm tăng số hàng.
9. Thông báo nền có outbox hoặc cơ chế tương đương để không báo thành công cho transaction đã rollback; retry không tạo nhiều tác động nghiệp vụ.
10. File, job, cache và dữ liệu offline không giữ quyền truy cập sau khi tài khoản mất quyền hoặc đăng xuất theo thiết kế đã kiểm chứng.
11. Xác minh OTP/token có hạn, giới hạn thử, dùng một lần và không lưu bí mật dạng có thể lộ trong log. Quên mật khẩu không tiết lộ tài khoản tồn tại.
12. Thay quyền, thông tin đăng nhập hoặc trạng thái tài khoản phải tác động đến phiên đang hoạt động đúng quy định.

## A6. Các luồng chính

### A6.1. Đăng ký và duyệt đối tác

Luồng đề xuất: điền hồ sơ → xác minh kênh liên hệ → gửi xét duyệt → cần bổ sung hoặc được duyệt/từ chối. Sau yêu cầu bổ sung, người đăng ký chỉnh hồ sơ của chính mình rồi gửi lại.

Tách “đã xác minh” khỏi “đã được duyệt”. Phiên dành cho người chờ duyệt chỉ truy cập hồ sơ đăng ký và hỗ trợ liên quan. Khi duyệt, thực hiện trong transaction: kiểm tra phiên bản hồ sơ, chọn/gắn tổ chức, cấp membership phù hợp, phân công hỗ trợ, ghi audit và tạo sự kiện thông báo.

Người đăng ký không tự gắn vào đại lý chỉ vì nhập cùng tên hoặc email domain. Lời mời nhân viên đại lý gắn tổ chức và quyền tối đa từ server; chủ đại lý không được cấp quyền nội bộ Cohamy.

### A6.2. Đặt hàng đến giao nhận và tiền

Luồng đề xuất: giỏ nháp → đề nghị của nhân viên đại lý → chủ đại lý duyệt nếu áp dụng → Cohamy xét đơn → xác nhận giá/điều kiện → giữ hàng → soạn/đóng gói → giao từng phần → xác nhận nhận.

Theo dõi riêng trạng thái đơn, từng lần giao và thanh toán. Thời điểm phát sinh phải thu/doanh thu phụ thuộc D05/D10. Đơn hàng không được coi là đã thanh toán chỉ vì người dùng tải ảnh chuyển khoản.

Đặt lại đơn cũ luôn kiểm tra SKU còn bán, giá hiện hành, số lượng tối thiểu và khả năng cung ứng; hiển thị thay đổi trước xác nhận.

### A6.3. Kho và đổi trả

Nhận hàng → kiểm tra → gắn vị trí/lô → xác nhận số thực nhận → movement. Hàng lỗi được đưa vào trạng thái/vị trí không khả dụng cho bán theo quy tắc đã chốt.

Chuyển kho: xuất khỏi kho gửi → hàng đang chuyển → kho nhận xác nhận. Phải thể hiện phần thiếu/chênh lệch; không làm tăng tổng lượng vì tính cả kho gửi và kho nhận.

Đổi trả: tiếp nhận yêu cầu → phê duyệt → nhận thực tế → kiểm tra → phân loại → điều chỉnh kho/tiền theo quyết định được duyệt. Hoàn tiền không tự diễn ra từ một ảnh hoặc một nút xác nhận nhận hàng.

### A6.4. Ký gửi và đối soát

Thỏa thuận có hiệu lực → giao ký gửi → đại lý xác nhận thực nhận → báo bán → hai bên đối chiếu → chấp nhận kỳ → phát sinh tiền theo chính sách. Hàng gửi chưa bán vẫn được theo dõi với chủ sở hữu đúng thỏa thuận.

Ví dụ QA: gửi 100, xác nhận bán 30, còn 70; báo bán retry không thành 60; trả 10 thì còn 60 tại đại lý. Số ví dụ này chỉ dùng test, không là dữ liệu tồn thật.

## A7. Lộ trình theo phụ thuộc

| Giai đoạn | Nội dung và ID chính | Điều kiện vào | Điều kiện hoàn tất |
|---|---|---|---|
| P0 — Khảo sát | Đối chiếu toàn bộ F001–F140; schema, quyền, dữ liệu, vận hành | Có checkout và tài liệu | Có feature matrix đủ 140 ID, baseline test, dependency map, quyết định đã biết/chưa biết |
| P1 — Nền dữ liệu và thao tác | F121–F129, F131–F139; nền file, notification, worker, audit | P0 | Quyền xuyên suốt, import preview, file riêng, audit, tính năng thao tác được kiểm tra PC/mobile |
| P2 — Đăng ký và tiếp nhận | F001–F010, F017, F019–F020, F107–F108 | P1 tối thiểu; D01–D03 | Đăng ký, xác minh, bổ sung, duyệt, gắn tổ chức và đăng nhập sau duyệt chạy end-to-end |
| P3 — Khách và công việc | F021–F030, F101–F106, F109–F110 | P1; tổ chức/quyền ổn định | Hồ sơ tổng hợp, cơ hội, gộp trùng, việc định kỳ, bàn giao và chuyển cấp đúng scope |
| P4 — Giá, portal và đơn | F011–F016, F018, F031–F050 | P2/P3 nền liên quan; D04–D05 | Đặt nhanh/đặt lại/import, báo giá, duyệt và snapshot đơn; thử đầy đủ ngoại lệ |
| P5 — Kho và mua hàng | F051–F060, F091–F098; nền dữ liệu F099–F100 | P4 mô hình dòng hàng; D06–D07/D11 | Nhập/xuất/chuyển/kiểm kê/giữ hàng đúng ledger, có test PostgreSQL concurrent |
| P6 — Giao và đổi trả | F061–F070; hoàn thiện nhánh giao từng phần của F048–F049 | P4–P5; D08 | Soạn/giao/nhận/đổi trả chạy thật trên staging; tích hợp hãng được nghiệm thu riêng |
| P7 — Tiền và mua hàng hoàn chỉnh | F081–F090, hoàn thiện F099–F100 | P4–P6 nguồn chứng từ; D05/D10/D11 | Thu/chi/phân bổ/ứng trước/phải thu/phải trả cân đối và chống ghi lặp |
| P8 — Ký gửi | F071–F080 | P5–P7; D09 được chốt để mở nghiệp vụ thật | Gửi–bán–trả–đối soát–điều chỉnh bảo toàn lượng/tiền và tách ownership |
| P9 — Điều hành và hoàn thiện mobile | F111–F120, F130; hoàn thiện dashboard theo vai trò | Các miền số liệu tương ứng đã có | Báo cáo khớp sổ nguồn, drill-down đúng scope; offline không tự ghi giao dịch nhạy cảm |
| P10 — Nghiệm thu và phát hành | F140; kiểm tra tích hợp toàn bộ F001–F140 | Các phase khả dụng đã qua kiểm tra | Backup/restore, migration, pilot, hiệu năng, regression, tài liệu và release evidence |

Các nền thông báo, worker, file và backup cần được thiết kế từ P1. Không đợi đến P10 mới nghĩ đến khả năng khôi phục. Báo cáo và dashboard được hoàn thiện dần theo dữ liệu nguồn; không phải chờ P9 mới có màn điều hành tối thiểu.

Giai đoạn P4 có thể kiểm tra đơn trước khi kho hoàn chỉnh, nhưng không đánh dấu trọn F047–F049 đã nghiệm thu nếu phần giữ hàng/giao từng phần còn thiếu. F099–F100 chỉ hoàn tất khi mua hàng, nhận hàng và công nợ đã liên thông. Mỗi ID chỉ có một trạng thái cuối dù tham gia nhiều phase.

Không ước lượng thời gian cứng trước P0. Sau khảo sát, lập các đợt bàn giao nhỏ với phạm vi cụ thể, phụ thuộc, công sức dự kiến và tiêu chí chứng minh. Không chia nhỏ theo “làm hết giao diện rồi mới làm backend”; mỗi đợt nên hoàn thành một luồng dùng được.

## A8. Danh mục đầy đủ 140 tính năng và nghiệm thu tối thiểu

Mỗi tiêu chí trong bảng phải đi kèm kiểm tra quyền, dữ liệu lưu sau tải lại, trạng thái rỗng/lỗi và audit khi phù hợp. Các tiêu chí dưới đây là mức tối thiểu, không thay thế kiểm tra liên thông ở A9.

### Nhóm 1 — Đăng ký, xét duyệt và tiếp nhận đối tác

| ID | Tính năng | Phase | Tiêu chí nghiệm thu tối thiểu |
|---|---|---|---|
| F001 | Tự đăng ký đối tác/đại lý | P2 | Lưu tên đơn vị, người đại diện, điện thoại, email, địa chỉ, khu vực; validate rõ; gửi lặp không tạo nhiều hồ sơ |
| F002 | Trang theo dõi hồ sơ đăng ký | P2 | Người đăng ký chỉ thấy hồ sơ mình và trạng thái chờ duyệt, cần bổ sung, chấp nhận hoặc từ chối cùng bước tiếp theo |
| F003 | Hàng đợi xét duyệt cho admin | P2 | Lọc đăng ký mới, người phụ trách, thời gian chờ; xử lý đồng thời không duyệt hồ sơ hai lần |
| F004 | Yêu cầu bổ sung thông tin | P2 | Admin chỉ rõ trường/tài liệu cần bổ sung; người đăng ký sửa và gửi lại, giữ nguyên lịch sử |
| F005 | Xác minh email hoặc điện thoại | P2 | Kênh được chọn xác minh trước gửi duyệt; token hết hạn/dùng lại/thử quá số lần đều bị chặn; có test delivery thật khi cấu hình |
| F006 | Duyệt kèm phân quyền | P2 | Chọn tổ chức, vai trò, người hỗ trợ và scope; cấp quyền nhất quán trong transaction, không cho tự nâng quyền |
| F007 | Link mời đăng ký riêng | P2 | Lưu người giới thiệu, hạn, lượt dùng; thu hồi được; không dùng token hết hạn hoặc dùng lại ngoài giới hạn |
| F008 | Gắn đăng ký vào đại lý hiện có | P2 | Admin xem trùng và chọn đơn vị; người đăng ký không tự gia nhập tổ chức; không nhân bản đơn vị khi retry |
| F009 | Checklist bắt đầu sử dụng | P2 | Theo dõi hoàn thiện hồ sơ, đọc đúng phiên bản chính sách, xem danh mục; mục tạo yêu cầu chỉ hoàn tất khi có yêu cầu thật |
| F010 | Mục Dành cho đối tác trên website | P2 | Có đăng nhập, đăng ký, hướng dẫn hợp tác trên desktop/mobile; liên kết đúng locale và route, giữ website hiện có |

### Nhóm 2 — Cổng tự phục vụ dành cho đại lý

| ID | Tính năng | Phase | Tiêu chí nghiệm thu tối thiểu |
|---|---|---|---|
| F011 | Trang chủ riêng cho đại lý | P4 | Hiện việc, đơn và thông báo thuộc đúng đơn vị/người dùng; không có số liệu mẫu trong runtime thật |
| F012 | Đặt nhanh theo SKU | P4 | Nhập nhiều mã, số lượng và đơn vị trên một màn; báo mã không bán, sai quy cách hoặc vượt điều kiện |
| F013 | Đặt lại đơn cũ | P4 | Sao chép dòng hàng, tính lại giá/khả năng cung ứng và hiển thị thay đổi trước xác nhận |
| F014 | Giỏ hàng nháp theo tài khoản | P4 | Lưu server và tiếp tục trên thiết bị khác; xử lý phiên bản khi hai thiết bị cùng sửa |
| F015 | Tạo yêu cầu từ Excel | P4 | Có mẫu, ánh xạ SKU/đơn vị, lỗi từng dòng và preview; chỉ tạo sau xác nhận, không ghi một phần ngoài ý muốn |
| F016 | Nhiều địa chỉ giao hàng | P4 | Lưu chi nhánh/người nhận, chọn mặc định; sửa địa chỉ không đổi snapshot đơn cũ |
| F017 | Nhân viên đại lý | P2 | Chủ đại lý mời/khóa/cấp quyền trong tổ chức mình; không cấp vượt quyền chủ hoặc vai trò nội bộ |
| F018 | Duyệt đơn nội bộ đại lý | P4 | Nhân viên gửi đề nghị, chủ duyệt/từ chối; Cohamy chỉ nhận khi đáp ứng quy tắc phê duyệt |
| F019 | Thư viện đối tác | P2 | Hiện catalogue, hình, hướng dẫn và chính sách đúng đối tượng/phiên bản; download kiểm tra quyền |
| F020 | Phiếu hỗ trợ | P2 | Gửi nội dung/ảnh, phân công, theo dõi tiến độ và trao đổi; tách ghi chú nội bộ khỏi nội dung cho đại lý |

### Nhóm 3 — Hồ sơ khách hàng và chăm sóc bán hàng

| ID | Tính năng | Phase | Tiêu chí nghiệm thu tối thiểu |
|---|---|---|---|
| F021 | Hồ sơ khách hàng tổng hợp | P3 | Liên kết liên hệ, yêu cầu, báo giá, đơn, việc và trao đổi; từng phần chỉ xuất hiện khi có quyền và dữ liệu |
| F022 | Nhiều người liên hệ | P3 | Một đơn vị có chủ, người mua, kế toán, người nhận; chọn liên hệ chính và giữ lịch sử khi ngừng sử dụng |
| F023 | Cảnh báo trùng lúc nhập | P3 | So sánh điện thoại/email/mã doanh nghiệp đã chuẩn hóa; cảnh báo không tiết lộ hồ sơ ngoài scope |
| F024 | Gộp hồ sơ trùng có preview | P3 | Chọn dữ liệu giữ lại, xem liên kết bị ảnh hưởng; bảo toàn lịch sử, không làm lộ dữ liệu hoặc thay số sổ đã chốt |
| F025 | Bảng cơ hội bán hàng | P3 | Chuyển giai đoạn mới tiếp cận, nhu cầu, báo giá, thắng/mất; lưu người sửa và thời điểm |
| F026 | Lý do chưa mua/mất khách | P3 | Danh mục lý do có ghi chú; được tổng hợp trong báo cáo và không tự ghi là mất khách từ việc hết hạn |
| F027 | Phân nhóm khách linh hoạt | P3 | Quản lý nhiều nhãn/nhóm và lọc theo tổ hợp; có quyền quản lý danh mục nhóm |
| F028 | Sở thích và cách liên hệ | P3 | Lưu sản phẩm quan tâm, khung giờ và kênh ưu tiên; hiển thị ngay khi chuẩn bị chăm sóc |
| F029 | Nhật ký thăm điểm bán | P3 | Gắn người thăm, thời điểm, kết quả, ảnh và đề nghị hỗ trợ vào đúng hồ sơ |
| F030 | Quản lý hàng mẫu | P3 | Theo dõi người nhận, SKU, số lượng, gửi/nhận/phản hồi/chuyển đơn; xuất mẫu thực phải đi qua nghiệp vụ kho |

### Nhóm 4 — Báo giá, bảng giá và chương trình bán hàng

| ID | Tính năng | Phase | Tiêu chí nghiệm thu tối thiểu |
|---|---|---|---|
| F031 | Bảng giá theo cấp đại lý | P4 | Đại lý chỉ nhận bảng giá phù hợp; có quy tắc ưu tiên rõ khi nhiều bảng cùng thỏa điều kiện |
| F032 | Bảng giá theo thời gian | P4 | Có ngày hiệu lực/kết thúc và lịch sử; xử lý đúng múi giờ và khoảng trùng hiệu lực |
| F033 | Giá theo số lượng | P4 | Tính đúng tại biên ngưỡng và sau quy đổi đơn vị; cách áp theo dòng/SKU/đơn được cấu hình rõ |
| F034 | Điều kiện đặt tối thiểu | P4 | Kiểm tra tổng tiền, số thùng hoặc SKU theo chính sách; thông báo phần còn thiếu trước gửi |
| F035 | Báo giá PDF Cohamy | P4 | PDF tiếng Việt đúng font, logo, dòng hàng, điều kiện giao và hạn; tổng tiền khớp dữ liệu nguồn, kiểm tra bản render |
| F036 | Phiên bản báo giá | P4 | Giữ bản đã gửi, so sánh thay đổi và xác định bản được chấp nhận; sửa không ghi đè lịch sử |
| F037 | Đại lý phản hồi báo giá | P4 | Người có quyền xác nhận/yêu cầu sửa đúng phiên bản; phản hồi vào bản hết hạn được xử lý rõ |
| F038 | Duyệt chiết khấu vượt quyền | P4 | Quy tắc ngưỡng áp ở server; có người duyệt/lý do; không tự duyệt ngoại lệ nếu chính sách cấm |
| F039 | Combo và hàng tặng | P4 | Tính điều kiện, ưu tiên/cộng dồn theo chính sách; hàng tặng vẫn có số lượng kho và được xử lý khi trả hàng |
| F040 | Chốt giá khi xác nhận đơn | P4 | Snapshot đơn giữ giá/đơn vị/chính sách; thay bảng giá không đổi đơn đã xác nhận |

### Nhóm 5 — Xử lý đơn hàng đầy đủ

| ID | Tính năng | Phase | Tiêu chí nghiệm thu tối thiểu |
|---|---|---|---|
| F041 | Yêu cầu thành đơn bán hàng | P4 | Chuyển theo quyền và điều kiện, giữ nguồn; retry không tạo hai đơn hoặc bỏ qua phê duyệt |
| F042 | Nhân viên tạo đơn thay khách | P4 | Ghi người thao tác, khách, nguồn điện thoại/gặp/kênh khác; áp đủ quy tắc giá và quyền |
| F043 | Duyệt đơn theo điều kiện | P4 | Tính đúng tuyến duyệt theo giá trị, giá đặc biệt, điều khoản; lưu phiên bản quy tắc áp dụng |
| F044 | Tách trạng thái đơn/giao/tiền | P4 | Đơn duyệt không tự thành đã giao/đã thu; từng chiều cập nhật từ chứng từ tương ứng |
| F045 | Timeline đơn hàng | P4 | Hiện người, thời gian, sự kiện và bước chờ; không lộ ghi chú nội bộ qua portal |
| F046 | Yêu cầu sửa đơn | P4 | Preview trước/sau và ảnh hưởng; đơn đang giao không được sửa âm thầm làm lệch kho/tiền |
| F047 | Hủy theo giai đoạn | P4/P5 | Kiểm tra trạng thái/quyền, ghi lý do; giải phóng reservation đúng một lần và xử lý phần đã giao riêng |
| F048 | Giao nhiều đợt | P4/P6 | Tổng các đợt không vượt lượng được phép; theo dõi đã giao, còn lại, lịch tiếp và lịch sử |
| F049 | Hàng chờ bổ sung | P4/P5/P6 | Hiện SKU/ lượng còn thiếu, ngày dự kiến và người xử lý; không cam kết từ tồn đã bị giữ |
| F050 | Cảnh báo đơn có thể trùng | P4 | So khớp khách, dòng hàng, thời điểm; cho kiểm tra thay vì tự xóa đơn hợp lệ; tách khỏi idempotency kỹ thuật |

### Nhóm 6 — Kho, lô và hạn sử dụng

| ID | Tính năng | Phase | Tiêu chí nghiệm thu tối thiểu |
|---|---|---|---|
| F051 | Sổ nhập–xuất–tồn | P5 | Mọi phát sinh có chứng từ/người thực hiện; tồn khớp tổng movement; đảo chứng từ giữ lịch sử |
| F052 | Quy đổi đơn vị | P5 | Gói/hộp/hũ/thùng quy đổi chính xác; thay quy cách không làm đổi số lượng chứng từ đã ghi |
| F053 | Nhiều kho/vị trí | P5 | Lọc kho/khu/kệ theo quyền; không chuyển hàng đến vị trí không hợp lệ hoặc ngừng dùng |
| F054 | Lô, NSX và hạn dùng | P5 | Gắn lô khi nhận, truy đến lần giao; kiểm tra ngày và điều kiện hàng được xuất |
| F055 | Xuất theo hạn gần nhất | P5 | Gợi ý FEFO từ lô khả dụng, đáp ứng hạn dùng tối thiểu; ngoại lệ cần quyền/lý do |
| F056 | Tồn thực/giữ/khả dụng | P5 | Hai đơn tranh cùng lượng không giữ vượt tồn; giải phóng/tiêu thụ giữ hàng đúng một lần |
| F057 | Chuyển kho hai bước | P5 | Lưu lượng đang chuyển và thực nhận; bảo toàn tổng hàng khi nhận từng phần hoặc báo thiếu |
| F058 | Kiểm kê mobile/máy quét | P5 | Lưu lần đếm, preview chênh lệch, phê duyệt trước movement; xử lý giao dịch phát sinh trong lúc đếm |
| F059 | Cảnh báo thiếu/lâu/cận hạn | P5 | Ngưỡng theo SKU/kho, loại trừ hàng không khả dụng đúng quy tắc; bấm cảnh báo mở đúng danh sách |
| F060 | Khóa và thu hồi lô | P5 | Lô khóa không được giữ/xuất mới; truy được bên nhận, đơn, lượng và tiến độ xử lý thu hồi |

### Nhóm 7 — Soạn hàng, giao hàng và đổi trả

| ID | Tính năng | Phase | Tiêu chí nghiệm thu tối thiểu |
|---|---|---|---|
| F061 | Phiếu soạn trên điện thoại | P6 | Chỉ rõ vị trí/lô/lượng, lưu tiến độ; soạn theo reservation và quyền kho |
| F062 | Quét kiểm tra đóng gói | P6 | Chặn/nhắc SKU sai, thiếu, thừa; có nhập mã thay thế khi thiết bị không hỗ trợ camera |
| F063 | Quản lý kiện | P6 | Một lần giao nhiều kiện có mã/nhãn/dòng hàng; tổng lượng đóng gói không vượt phiếu giao |
| F064 | Gom chuyến giao | P6 | Chọn đơn phù hợp, người giao, thứ tự điểm; không xếp cùng kiện vào hai chuyến hoạt động |
| F065 | Khung giờ nhận | P6 | Lưu ngày/giờ và yêu cầu khách, xử lý hẹn lại có lịch sử; thống nhất múi giờ |
| F066 | Theo dõi vận đơn | P6 | Gắn đúng hãng/mã; callback kiểm chứng, chống lặp và sai thứ tự; có trạng thái mất kết nối và cập nhật thủ công có audit |
| F067 | Bằng chứng giao nhận | P6 | Lưu người nhận/thời gian/ảnh/xác nhận theo chính sách; chỉ người có quyền đọc chứng từ |
| F068 | Giao thất bại | P6 | Ghi lý do và chọn hẹn lại/hoàn; hàng đang chuyển không tự trở thành hàng có thể bán |
| F069 | Yêu cầu đổi trả dòng hàng | P6 | Chọn đơn/dòng/lượng/lý do/ảnh; không trả vượt lượng đủ điều kiện sau các lần trả trước |
| F070 | Phân loại hàng trả | P6 | Ghi thực nhận và kết quả bán lại/cách ly/hỏng; movement liên kết phiếu trả, không tự hoàn tiền |

### Nhóm 8 — Ký gửi tại đại lý

| ID | Tính năng | Phase | Tiêu chí nghiệm thu tối thiểu |
|---|---|---|---|
| F071 | Thỏa thuận ký gửi | P8 | Lưu SKU, thời hạn, địa điểm, điều kiện và kỳ; có phiên bản được hai bên áp dụng |
| F072 | Hàng gửi theo đại lý | P8 | Tách hàng ký gửi với hàng bán đứt; ghi đúng owner và nơi giữ, không đếm trùng tồn |
| F073 | Đại lý xác nhận thực nhận | P8 | Nhận đủ/thiếu/hỏng từng dòng; có đối chiếu với lượng xuất và lịch sử xử lý |
| F074 | Báo bán theo kỳ | P8 | Nhập tay/file có preview; không báo vượt khả dụng; gửi lại không nhân lượng bán |
| F075 | Tồn ký gửi | P8 | Đối chiếu gửi, bán, trả, điều chỉnh và tồn xác nhận; truy được từng chênh lệch |
| F076 | Tính phần hưởng | P8 | Tính theo phiên bản thỏa thuận và cơ sở được chốt; đổi chính sách không sửa kỳ đã chấp nhận |
| F077 | Đối soát hai bên | P8 | Từng bên phản hồi/xác nhận; lưu khoản tranh chấp và người chịu trách nhiệm xử lý |
| F078 | Khóa kỳ đối soát | P8 | Kỳ chấp nhận không bị sửa trực tiếp; điều chỉnh có quyền, chứng từ và liên kết về kỳ gốc |
| F079 | Đề nghị bổ sung ký gửi | P8 | Gợi ý từ tồn/tốc độ bán có giải thích; đề nghị chỉ thành giao hàng sau phê duyệt |
| F080 | Thu hồi/đổi ký gửi | P8 | Áp điều kiện chậm bán/cận hạn; đối chiếu lượng lấy về, thực nhận và tồn còn tại đại lý |

### Nhóm 9 — Công nợ, thanh toán và thu chi

| ID | Tính năng | Phase | Tiêu chí nghiệm thu tối thiểu |
|---|---|---|---|
| F081 | Hạn mức công nợ | P7 | Tính đã dùng/còn lại theo chính sách; hai đơn đồng thời không vượt hạn mức ngoài ngoại lệ được duyệt |
| F082 | Kỳ hạn thanh toán | P7 | Ngày đến hạn được tính từ sự kiện đã chốt; thay chính sách không sửa ngầm chứng từ cũ |
| F083 | Sổ phải thu | P7 | Mỗi khoản có đơn/chứng từ nguồn, điều chỉnh và số còn lại; tổng khớp chi tiết |
| F084 | Phân bổ thu nhiều–nhiều | P7 | Một thu cho nhiều đơn/một đơn nhiều thu; không phân bổ vượt tiền hoặc dư nợ, kể cả concurrent |
| F085 | Đặt cọc/ứng trước | P7 | Theo dõi phát sinh, sử dụng, hoàn và dư; tránh ghi nhận hai lần khi cấn vào đơn |
| F086 | Tải chứng từ chuyển khoản | P7 | Đại lý gửi, kế toán kiểm tra/xác nhận/từ chối; ảnh tải lên không tự đánh dấu đã thu |
| F087 | Nhập sao kê và gợi ý ghép | P7 | Chống nhập trùng dòng giao dịch; gợi ý có căn cứ và cần kế toán xác nhận; xử lý ghép sai có lịch sử |
| F088 | Tuổi nợ | P7 | Nhóm chưa đến hạn/quá hạn khớp ngày đối chiếu, phân bổ và khoản tranh chấp |
| F089 | Nhắc thanh toán | P7 | Lịch, mẫu, người nhận và lịch sử; dừng nhắc khi đã giải quyết; không gửi lặp do retry |
| F090 | Đề nghị thu–chi/hoàn tiền | P7 | Tách đề nghị, duyệt và thực hiện; lưu chứng từ, tránh duyệt/thực hiện hai lần và đảo số có lịch sử |

### Nhóm 10 — Nhà cung cấp và mua hàng

| ID | Tính năng | Phase | Tiêu chí nghiệm thu tối thiểu |
|---|---|---|---|
| F091 | Hồ sơ nhà cung cấp | P5 | Lưu liên hệ, mặt hàng, điều kiện và tài liệu; không trộn scope/loại tổ chức hiện có |
| F092 | Đề nghị mua | P5 | Nhân viên nhập nhu cầu/lượng/hạn cần; theo dõi xét duyệt và chuyển thành mua |
| F093 | Yêu cầu báo giá nhà cung cấp | P5 | Lưu nội dung gửi, phản hồi và phiên bản; gửi ngoài chỉ qua kênh được cấu hình/cho phép |
| F094 | So sánh báo giá mua | P5 | So cùng đơn vị/cơ sở giá, thời gian, phí và điều kiện; ghi lý do lựa chọn |
| F095 | Đơn mua | P5 | Tạo/duyệt/theo dõi, snapshot điều kiện; sửa đơn đã nhận một phần được kiểm soát |
| F096 | Theo dõi giao nhiều đợt/trễ | P5 | Tổng đã nhận/còn lại khớp đợt nhận; hiện hẹn giao và nguyên nhân trễ |
| F097 | Đối chiếu thực nhận | P5 | So đơn mua và hàng nhận, ghi thiếu/thừa/lỗi; chỉ lượng chấp nhận tạo tồn khả dụng |
| F098 | Trả/khiếu nại nhà cung cấp | P5 | Liên kết phiếu nhận/SKU/lô; có lượng, lý do, chứng từ và tiến độ giải quyết |
| F099 | Phải trả và lịch thanh toán | P5/P7 | Khoản phải trả phát sinh theo chính sách; phân bổ, trả hàng, điều chỉnh và số dư khớp |
| F100 | Đánh giá nhà cung cấp | P5/P7 | Tỷ lệ đúng hẹn/đủ hàng/chất lượng tính từ chứng từ thật; có khoảng thời gian và dữ liệu để kiểm tra |

### Nhóm 11 — Công việc, phối hợp và thông báo

| ID | Tính năng | Phase | Tiêu chí nghiệm thu tối thiểu |
|---|---|---|---|
| F101 | Bàn làm việc Hôm nay | P3 | Gom việc đến hạn/quá hạn/hồ sơ chờ theo vai trò, múi giờ và scope; click mở đúng danh sách |
| F102 | Checklist công việc | P3 | Thêm/sắp/đánh dấu bước; lưu sau reload và quy tắc hoàn thành công việc rõ |
| F103 | Công việc lặp lại | P3 | Sinh theo lịch, múi giờ; restart/retry không tạo trùng; có tạm dừng/chỉnh lịch |
| F104 | Công việc phụ thuộc | P3 | Chặn vòng phụ thuộc; hoàn thành bước trước mới mở bước sau theo quy tắc |
| F105 | Nhắc tên/người theo dõi | P3 | Chỉ chọn người hợp lệ; nhắc tên không tự cấp quyền đọc hồ sơ; notification theo scope |
| F106 | Bàn giao phụ trách | P3 | Preview việc/hồ sơ chuyển, ghi bàn giao; thu hồi quyền cũ và cấp scope mới nhất quán |
| F107 | Trung tâm thông báo | P2 | Có đã đọc/chưa đọc, lọc và link đúng đối tượng; người mất quyền không còn đọc nội dung nhạy cảm |
| F108 | Tùy chọn thông báo | P2 | Lưu loại/kênh/giờ yên lặng; hệ thống áp dụng đúng và hiển thị ngoại lệ bắt buộc nếu có |
| F109 | Nhắc/chuyển cấp chậm xử lý | P3 | Cấu hình hạn theo loại việc; không tạo nhiều escalation trùng và ghi rõ người nhận |
| F110 | Quy tắc tự tạo việc | P3 | Sự kiện duyệt hồ sơ tạo đúng một việc theo mẫu; có bật/tắt, log và kiểm thử retry |

### Nhóm 12 — Báo cáo điều hành

| ID | Tính năng | Phase | Tiêu chí nghiệm thu tối thiểu |
|---|---|---|---|
| F111 | Dashboard theo vai trò | P9 | Quản lý/sales/kho/kế toán có chỉ số và việc phù hợp; số liệu truy về nguồn và đúng scope |
| F112 | Nguồn khách và chuyển đổi | P9 | Định nghĩa mẫu số/mốc chuyển rõ; ghi nhận nguồn thiếu; không tính trùng khách đã gộp |
| F113 | Phân tích giai đoạn bán | P9 | Xem số lượng, thời gian ở giai đoạn và lý do thắng/mất trong khoảng chọn |
| F114 | Đại lý mới/giảm hoạt động | P9 | Ngưỡng hoạt động có cấu hình; phân biệt không đặt hàng với thiếu dữ liệu; mở danh sách chăm sóc |
| F115 | Bán hàng theo SKU/đại lý/vùng/sales | P9 | Theo quy tắc ghi nhận đã chốt; xử lý trả/hủy và drill-down tới chứng từ |
| F116 | Biên lợi nhuận | P9 | Có nguồn giá vốn/chi phí và công thức; thiếu dữ liệu hiển thị chưa đủ, không coi thiếu là 0 |
| F117 | Tốc độ xử lý đơn | P9 | Tách chờ duyệt/hàng/soạn/giao; tính từ mốc sự kiện, giải thích thời gian đang chờ |
| F118 | Tồn lâu/cận hạn/vòng quay | P9 | Khớp sổ kho và ngày báo cáo, tách hàng giữ/cách ly/ký gửi theo định nghĩa |
| F119 | Đổi trả/giao thất bại/chất lượng | P9 | Lọc SKU/lô/nguyên nhân; tỷ lệ có mẫu số rõ và truy tới các lần giao/trả |
| F120 | Tổng hợp định kỳ | P9 | Lưu bộ lọc, lịch và người nhận; kiểm tra quyền ở lúc chạy/gửi; job retry không gửi trùng |

### Nhóm 13 — Tiện ích UI/UX

| ID | Tính năng | Phase | Tiêu chí nghiệm thu tối thiểu |
|---|---|---|---|
| F121 | Tìm kiếm toàn hệ thống | P1 | Tìm khách/đại lý/SKU/đơn/việc theo quyền; hỗ trợ từ khóa thực tế, phân trang và không lộ số lượng ngoài scope |
| F122 | Tạo nhanh mọi màn hình | P1 | Thêm khách/ghi chú/việc với ngữ cảnh phù hợp; đóng form quay đúng màn và vị trí trước |
| F123 | Lưu bộ lọc cá nhân/chung | P1 | Đặt tên, sửa, chọn mặc định và chia sẻ có quyền; lọc không vượt quyền người mở |
| F124 | Tùy chỉnh cột | P1 | Chọn/thứ tự/độ rộng và lưu preference; cột nhạy cảm vẫn kiểm tra quyền server |
| F125 | Ghim/vừa mở | P1 | Lưu theo người dùng, bỏ ghim được; mục mất quyền không còn hiển thị nội dung |
| F126 | Xem chi tiết bên cạnh | P1 | Mở/đóng bằng chuột/bàn phím, giữ lọc/scroll; mobile có cách xem phù hợp và link chi tiết trực tiếp |
| F127 | Tự lưu/khôi phục nháp | P1 | Hiện trạng thái lưu, khôi phục sau reload; xử lý xung đột và không lưu mật khẩu/OTP vào draft |
| F128 | Thao tác hàng loạt có preview | P1 | Hiện danh sách tác động; kiểm tra từng bản ghi/quyền/phiên bản; lỗi từng mục rõ, có thể retry an toàn |
| F129 | Một chạm trên mobile | P1 | Gọi/sao chép/bản đồ/chụp ảnh hoạt động với thông tin đúng; có fallback khi thiết bị không hỗ trợ |
| F130 | Cài màn hình chính và nháp offline | P9 | Cài được trên nền tảng hỗ trợ; cache không lộ CRM; offline chỉ lưu nháp phù hợp, đồng bộ kiểm tra lại quyền/giá/phiên bản |

### Nhóm 14 — Quản trị, tài liệu và dữ liệu

| ID | Tính năng | Phase | Tiêu chí nghiệm thu tối thiểu |
|---|---|---|---|
| F131 | Import Excel có ánh xạ/preview | P1 | Kiểm tra loại file/kích thước/cột/trùng/lỗi; xác nhận mới ghi; job có tiến độ và báo cáo tác động |
| F132 | Export danh sách đang lọc | P1 | Chọn cột, giữ bộ lọc và quyền; xử lý nội dung công thức nguy hiểm trong file, kết quả chỉ người có quyền tải |
| F133 | Tệp theo hồ sơ | P1 | Hợp đồng/ảnh/biên bản/chứng từ có metadata tìm kiếm; giới hạn loại/kích thước, private download kiểm tra quyền |
| F134 | Phiên bản và hiệu lực tài liệu | P1 | Lưu bản cũ, bản hiện hành, ngày hiệu lực/hết hạn; xác nhận đọc gắn đúng version |
| F135 | Trường tùy chỉnh | P1 | Có kiểu dữ liệu, validate, bắt buộc và quyền; đổi schema trường không làm mất giá trị cũ |
| F136 | Bảng quyền dễ hiểu | P1 | Giải thích xem/tạo/sửa/duyệt/xuất và scope; preview người bị ảnh hưởng khi đổi, chống tự nâng quyền |
| F137 | MFA và quên mật khẩu | P1 | Đăng ký/xác nhận yếu tố thứ hai, recovery code một lần, reset token an toàn; luồng khôi phục không bỏ qua MFA tùy tiện |
| F138 | Thiết bị và phiên | P1 | Liệt kê phiên với thông tin phù hợp, kết thúc từng phiên/tất cả phiên khác; phiên bị thu hồi mất quyền ngay theo thiết kế |
| F139 | Audit có tìm kiếm | P1 | Lọc người/đối tượng/thời gian; xem trường trước–sau/lý do; append-only và che bí mật/giới hạn quyền |
| F140 | Backup và kiểm tra restore | P10 | Lịch tự động, retention, cảnh báo lỗi, kiểm tra checksum; restore DB và file vào nơi độc lập, xác nhận liên kết dữ liệu và ghi bằng chứng |

## A9. Kiểm thử và nghiệm thu

### A9.1. Theo từng tính năng

- Kiểm tra phần nghiệp vụ có rủi ro: chuyển trạng thái, giá, scope, idempotency, số lượng, tiền và xung đột.
- Kiểm tra qua UI thật cho luồng người dùng chính; tải lại trang để xác nhận dữ liệu lưu bền.
- Kiểm tra desktop, mobile 390px và 320px cho các luồng đại lý/soạn hàng; form dùng được bằng bàn phím, nhãn và lỗi rõ.
- Kiểm tra tình huống rỗng, validation, mất kết nối, hết phiên, thiếu quyền, file lỗi và retry liên quan.
- Không viết test chỉ xác nhận lại chi tiết implementation; ưu tiên hành vi và bất biến cần giữ.

### A9.2. Kịch bản liên thông bắt buộc

| Mã | Kịch bản | Kết quả phải chứng minh |
|---|---|---|
| E01 | Đăng ký → xác minh → yêu cầu bổ sung → gửi lại → duyệt | Quyền trước/sau duyệt đúng; dữ liệu không trùng; notification/audit khớp |
| E02 | Hai admin duyệt cùng hồ sơ và lời mời bị dùng lại | Chỉ một kết quả hợp lệ; không có tổ chức/membership trùng |
| E03 | Đại lý A thử đổi ID để đọc dữ liệu đại lý B | Bị chặn qua API, search, file, export, notification và báo cáo |
| E04 | Chủ đại lý mời nhân viên → nhân viên lập đơn → chủ duyệt | Scope chỉ trong đại lý; không tự cấp vai trò nội bộ; không vượt tuyến duyệt |
| E05 | Bảng giá theo ngưỡng → báo giá → đơn xác nhận → thay bảng giá | Đơn đã chốt không đổi; báo giá cũ và giá mới được phân biệt |
| E06 | Tồn 10, hai kết nối cùng yêu cầu giữ 7 | Không giữ 14; kết quả theo chính sách, không có tồn âm hoặc reservation mồ côi |
| E07 | Nhập/chuyển kho/nhận một phần/kiểm kê | Tổng lượng được bảo toàn, phần đang chuyển và chênh lệch có chứng từ |
| E08 | Lô cận hạn/lô khóa, yêu cầu FEFO và hạn tối thiểu | Không xuất lô không hợp lệ; gợi ý có thể giải thích |
| E09 | Giao nhiều đợt → giao thất bại → nhận lại → đổi trả | Đơn, lượng thực giao, hàng hoàn và trạng thái kho khớp nhau |
| E10 | Một thu chia nhiều đơn, nhiều thu cho một đơn, trả/hoàn | Tổng phân bổ không vượt tiền/nợ; đảo và hoàn không nhân tiền |
| E11 | Hai người phân bổ hoặc duyệt chi cùng lúc | Unique/transaction bảo vệ; không chi hoặc phân bổ hai lần |
| E12 | Ký gửi 100 → bán 30 → trả 10 → khóa kỳ | Tồn 60 tại đại lý; ownership/phần hưởng/đối soát đúng thỏa thuận QA |
| E13 | Đề nghị mua → báo giá → nhận một phần → trả → phải trả | Hàng nhận, giá vốn theo chính sách và số phải trả khớp chứng từ |
| E14 | Import sai, gửi job lặp, worker restart giữa chừng | Không tạo dữ liệu trùng; kết quả từng dòng và tiến độ phục hồi đúng |
| E15 | Đổi vai trò/khóa tài khoản khi export/job/offline draft đang tồn tại | Không tải/xem dữ liệu mất quyền; draft đồng bộ kiểm tra lại server |
| E16 | Báo cáo tại một ngày và sau trả/điều chỉnh | Tổng khớp sổ nguồn; không coi yêu cầu chưa duyệt là doanh thu |
| E17 | Backup rồi restore DB/file vào môi trường riêng | Người dùng, chứng từ, ledger và file liên kết còn nguyên; không ghi đè production |
| E18 | Deploy candidate → kiểm tra → chuyển traffic → rollback nếu lỗi | Đúng SHA/runtime/cwd; CRM, portal và website public đều hoạt động |

Giá trị tiền và lượng trong QA do fixture quy định; không phải chính sách áp vào vận hành thật. Kiểm thử tranh chấp phải dùng PostgreSQL nhiều kết nối, không mô phỏng tuần tự rồi gọi là concurrent.

### A9.3. Hiệu năng và vận hành

Sau P0 chọn tập dữ liệu đại diện: số đại lý, SKU, đơn, chứng từ và người dùng đồng thời. Ghi cấu hình máy, số mẫu, p50/p95 và thời gian job; thống nhất ngưỡng chấp nhận trước load test. Không công bố đáp ứng quy mô lớn chỉ từ vài trang mở thành công.

Danh sách phải phân trang phía server; truy vấn báo cáo có index và kế hoạch phù hợp. Job import/export có giới hạn tài nguyên; không giữ request trình duyệt quá lâu để giả lập xử lý nền.

Ghi bằng chứng với nhãn `LOCAL`, `STAGING`, `PRODUCTION`; kết quả `PASS`, `FAIL`, `BLOCKED`, `NOT_RUN`. Mock email, hãng giao hàng, backup hay MFA không được báo thành kết nối thật đã nghiệm thu.

## A10. Thiết kế UI/UX

- Kế thừa nhận diện Cohamy và design system CRM hiện có; đọc tài liệu thiết kế trước khi sửa.
- Điều hướng theo công việc: Hôm nay, Khách/đại lý, Bán hàng, Kho/giao nhận, Tài chính, Báo cáo, Quản trị. Portal có điều hướng riêng phù hợp đại lý.
- Màn danh sách có tìm kiếm, lọc, trạng thái, tác vụ chính; chi tiết gom thông tin và hành động theo bước xử lý.
- Một hành động chính rõ ràng mỗi bước; thao tác vượt quyền giải thích điều kiện hoặc chuyển người có quyền.
- Không đưa tên bảng DB, mã môi trường, thông báo lỗi kỹ thuật hoặc trạng thái test vào giao diện người dùng bình thường.
- Lưu nháp rõ trạng thái; có cảnh báo xung đột; lỗi không xóa dữ liệu người dùng đã nhập.
- Nội dung tiền, lượng, ngày dùng định dạng nhất quán; lưu thời gian chuẩn và hiển thị theo múi giờ đã chọn.
- Màn rộng dùng bảng phù hợp; mobile chuyển bố cục để đọc và thao tác được, không chỉ thu nhỏ bảng desktop.
- Không để chọn cột, xem panel hoặc thông báo biến thành cách vượt quyền dữ liệu.
- Ngưỡng hoàn thành giao diện là thực hiện được công việc, không chỉ ảnh chụp đẹp.

## A11. Migration, dữ liệu cũ và phát hành

1. Khảo sát schema, phiên bản migration, dữ liệu đang dùng và quyền DB thực tế trước thay đổi.
2. Viết migration theo hướng bổ sung trước; backfill riêng, có thể tiếp tục khi bị gián đoạn. Không reset DB để làm test xanh.
3. Chứng từ cũ thiếu thông tin giữ trạng thái rõ “dữ liệu lịch sử chưa đủ”; không tự suy ra tồn đầu kỳ, giá vốn, doanh thu hoặc số nợ.
4. Đối chiếu tổng bản ghi và số liệu trước/sau backfill; thử rollback/roll-forward trên bản sao staging.
5. Phần tính năng đã sẵn sàng có thể phát hành từng đợt. Phase còn thiếu không được quảng bá như đang hoạt động.
6. Chuẩn bị release từ commit xác định, backup đã kiểm tra và candidate có smoke test. So local HEAD, remote và release đang chạy khi thực hiện deploy.
7. Kiểm tra đường dẫn public có locale, login không locale và bookmark CRM cũ; không làm blog hoặc danh mục sản phẩm chuyển hướng lặp.
8. Khi chuyển PM2, xác minh cwd/script/executable thực. Chỉ tác động ứng dụng Cohamy; không reload daemon hoặc ứng dụng khác để đổi Node.
9. Có kế hoạch quay về release trước và schema tương thích. Không coi rollback code là tự động khôi phục dữ liệu đã ghi sau migration.
10. Push/deploy, nhập dữ liệu thật, gửi tin ra ngoài và thao tác tiền thật chỉ theo ủy quyền đang có cho đợt việc đó. Không hỏi lại nếu đã được cho phép rõ; nếu chưa có, chuẩn bị đầy đủ bản kiểm thử và diff trước khi yêu cầu quyết định phát hành.

Tài liệu này không chứa mật khẩu, OTP, token, private key hoặc chuỗi kết nối thật. Không đưa dữ liệu cá nhân/backup/log bí mật vào Git để làm bằng chứng.

## A12. Bộ bàn giao và định nghĩa hoàn tất

Codex triển khai phải bàn giao:

1. `FEATURE-MATRIX-140.md`: đủ 140 ID, bằng chứng và phần còn thiếu.
2. `BUSINESS-DECISIONS.md`: quyết định, người/xuất xứ xác nhận, thời điểm và phạm vi áp dụng.
3. `IMPLEMENTATION-ROADMAP-140.md`: thứ tự, phụ thuộc và các đợt bàn giao sau khảo sát thực tế.
4. `ARCHITECTURE-140.md`: domain, quyền, trạng thái, event, ledger và worker.
5. `TEST-REPORT-140.md`: kết quả kiểm tra theo ID/luồng, môi trường, lệnh chạy và artifact.
6. `MIGRATION-AND-ROLLBACK-140.md`: chuyển dữ liệu, đối chiếu, backup và phục hồi.
7. `USER-GUIDE-140.md`: hướng dẫn theo vai trò và thao tác thường ngày.
8. `RUNBOOK-140.md`: worker, provider, biến cấu hình, cảnh báo, backup và vận hành.
9. `PROGRESS-140.md`: checkpoint nối tiếp giữa các phiên, commit hiện tại, test đã chạy, blocker và bước tiếp theo.

Tính năng được coi là nghiệm thu khi có luồng UI/API thật, dữ liệu bền, quyền đúng, các bất biến liên quan đạt, lỗi xử lý rõ và bằng chứng trong môi trường được yêu cầu. Nếu chỉ có mock/provider chưa kết nối hoặc chính sách chưa chốt thì phải ghi rõ phần chưa được nghiệm thu.

Mục tiêu là hoàn thành 140 tính năng. Không báo hoàn thành toàn dự án khi chỉ có trang khung, menu, dữ liệu seed hoặc một phần của các luồng. Khi còn blocker ngoài khả năng xử lý, bàn giao chính xác phần đã làm và điều kiện cần để tiếp tục.

---

# PHẦN B — PROMPT GIAO CODEX TRIỂN KHAI

Sao chép toàn bộ khối dưới đây vào Codex và cung cấp toàn bộ tài liệu này. Đây là prompt thực hiện phát triển, khác với yêu cầu chỉ soạn tài liệu ở lượt tạo file.

```text
Bạn đang phát triển tiếp dự án Cohamy tại:
C:\Users\ACER\OneDrive\Desktop\cohamy-website-main

Tôi giao bạn triển khai hệ thống theo PHẦN A của tài liệu:
docs/crm/PLAN-VA-PROMPT-PHAT-TRIEN-140-TINH-NANG.md

PHẦN A, đặc biệt danh mục F001–F140 và tiêu chí nghiệm thu, là đặc tả đầu vào. Đọc toàn bộ trước khi triển khai. Nếu tài liệu được đính kèm thay vì nằm trên disk, dùng đúng nội dung đính kèm. Nếu thật sự thiếu tài liệu, báo rõ phần thiếu; không tự dựng danh sách thay thế.

MỤC TIÊU

Xây hoàn chỉnh 140 tính năng theo từng giai đoạn để Cohamy có CRM nội bộ và cổng đại lý sử dụng được trong quy trình thật. Bao gồm đăng ký/xét duyệt, tự phục vụ đại lý, chăm sóc khách, giá/báo giá, đơn hàng, kho/lô/hạn dùng, giao nhận/đổi trả, ký gửi, công nợ/thu chi, mua hàng, công việc/thông báo, báo cáo và tiện ích quản trị.

Đây là yêu cầu thực hiện code, migration, kiểm thử và tài liệu; không chỉ đề xuất kiến trúc hoặc tạo giao diện mẫu. Phạm vi là F001–F140, không thêm AI và các ý tưởng 141–150 ngoài tài liệu. Tận dụng phần đang có, chỉ xây mới hoặc nâng cấp phần còn thiếu.

QUYỀN THỰC HIỆN VÀ CÁCH LÀM VIỆC

Bạn được chủ động khảo sát read-only, sửa code liên quan, viết migration, tạo fixture riêng, chạy test/build và kiểm thử trên môi trường phát triển/staging được cung cấp. Bảo toàn thay đổi và dữ liệu của tôi. Không reset/xóa database thật hoặc ghi đè file ngoài phạm vi để giải quyết lỗi.

Push/deploy và các tác động bên ngoài theo đúng ủy quyền hiện hành của tôi cho đợt triển khai. Khi chưa có ủy quyền phát hành, hoàn thành bản triển khai review được, các kiểm tra và hướng dẫn phát hành trước khi hỏi. Khi tôi đã cho phép rõ thì tiếp tục, không hỏi lại mỗi bước hoặc mỗi phase.

Không tự gửi email/SMS/thông báo cho khách thật, giao hàng, chi tiền hoặc nhập dữ liệu kinh doanh thật để làm test. Dùng môi trường thử và người nhận thử được chỉ định. Tài liệu này không tự cấp phép cho những thao tác đó.

Không dừng sau phần lập kế hoạch hoặc sau một phase nếu còn công việc đã được giao có thể làm tiếp. Khi một phần phụ thuộc chính sách hoặc dịch vụ bên ngoài, ghi blocker cụ thể và tiếp tục phần độc lập. Không biến mọi lựa chọn kỹ thuật nhỏ thành câu hỏi xin xác nhận.

BẮT ĐẦU BẰNG KHẢO SÁT

1. Đọc AGENTS.md áp dụng và các quy tắc của repository.
2. Đọc hướng dẫn Next.js liên quan trong node_modules/next/dist/docs/ trước khi viết code; phiên bản này có thể khác kiến thức mặc định của bạn.
3. Kiểm tra git status, HEAD, package.json, schema/migration, môi trường và script hiện tại. Không đọc/in bí mật nếu không cần cho công việc.
4. Đọc lib/crm, db/crm, app/(operations), app/api/crm, components/crm, tài liệu design và runbook hiện có.
5. Phân biệt snapshot lịch sử với trạng thái source và môi trường thực tế. Không tin tuyên bố “chưa deploy” hoặc “đã xong” trong tài liệu cũ nếu chưa đối chiếu.
6. Chạy baseline kiểm tra phù hợp. Ghi lỗi có sẵn và lỗi liên quan phạm vi, không che lỗi hoặc bỏ test để làm kết quả xanh.
7. Tạo FEATURE-MATRIX-140.md đủ F001–F140: phần đã có, còn thiếu, phase, phụ thuộc, quyền, schema/API/UI, test và môi trường bằng chứng.
8. Tạo BUSINESS-DECISIONS.md và roadmap triển khai thực tế dựa trên phần A. Sau khảo sát, bắt đầu code phần nền và luồng ưu tiên, không dừng ở việc trả lại kế hoạch.

THỨ TỰ TRIỂN KHAI

Theo P0–P10 trong tài liệu, điều chỉnh chi tiết khi có bằng chứng phụ thuộc nhưng không bỏ ID:
- P0: khảo sát và ma trận đủ 140 tính năng.
- P1: quyền, dữ liệu, file, audit, import/export, tìm kiếm, tiện ích thao tác, nền worker/thông báo.
- P2: đăng ký, xác minh, chờ duyệt, bổ sung, cấp quyền, nhân viên đại lý và tài liệu hỗ trợ.
- P3: hồ sơ tổng hợp, đa liên hệ, gộp trùng, cơ hội, chăm sóc và công việc.
- P4: bảng giá, báo giá, portal đặt hàng, giỏ nháp, duyệt và đơn bán.
- P5: đơn vị, lô, kho, giữ hàng, kiểm kê, chuyển kho và mua hàng.
- P6: soạn, đóng gói, giao nhiều đợt, vận đơn, bằng chứng nhận và đổi trả.
- P7: công nợ, thu chi, ứng trước, phân bổ, sao kê và phải trả.
- P8: ký gửi và đối soát theo chính sách đã xác nhận.
- P9: báo cáo từ dữ liệu nguồn và mobile/offline.
- P10: backup tự động, restore, kiểm thử tích hợp, pilot, tài liệu và chuẩn bị/phát hành theo quyền.

Trong mỗi đợt hãy hoàn thành luồng dọc: migration → nghiệp vụ → API/quyền → UI → kiểm tra → tài liệu. Không làm tất cả menu rồi để backend cho một giai đoạn không xác định.

CHÍNH SÁCH CHƯA RÕ

Đọc lại các quyết định đã được tôi hoặc khách xác nhận trước khi hỏi. D01–D13 trong phần A là danh sách quản lý quyết định, không phải lý do dừng toàn bộ công việc.

Với giá, hạn mức, thuế/phí, thời điểm chuyển sở hữu/ghi nợ/doanh thu, quy đổi, tồn đầu kỳ, giá vốn, ký gửi và phân bổ thanh toán: không tự tạo quy tắc kinh doanh thật. Đề xuất phương án có giải thích, xây cấu hình có phiên bản và giữ chức năng ghi sổ thật chưa kích hoạt khi chưa có quyết định. Có thể hoàn thành kiểm thử bằng fixture có giả định công khai; phần production vẫn phải ghi BLOCKED nếu điều kiện thật chưa đáp ứng.

Với email/SMS/vận chuyển: triển khai adapter, cấu hình, trạng thái lỗi và test contract. Thiếu credential thì ghi rõ cần cấu hình gì; không giả lập gửi thành công trong giao diện thật, không lộ OTP hoặc dùng cách bỏ qua xác minh. Kiểm thử nhận thông báo thật chỉ với người nhận được chỉ định.

YÊU CẦU NGHIỆP VỤ VÀ DỮ LIỆU

- Đăng ký chưa duyệt chỉ có quyền trên hồ sơ đăng ký của chính mình. Xác minh email không đồng nghĩa được cấp quyền đại lý.
- Phê duyệt có tính nguyên tử và chống retry; không tạo tổ chức, user hoặc membership hai lần.
- Đại lý/chi nhánh/nhân viên có scope server rõ ràng; không tự gia nhập hoặc tự nâng quyền bằng trường gửi từ frontend.
- Search, report, file, export, notification, background job và dữ liệu offline phải tuân thủ cùng quyền truy cập.
- Tách yêu cầu, báo giá, đơn, giao hàng, thanh toán và sự kiện ghi sổ. Không coi “đã chốt” của intake cũ là đã thu tiền hoặc đã xuất hàng.
- Giá trên đơn xác nhận có snapshot; thay bảng giá không đổi chứng từ cũ.
- Giá, tiền và quy đổi dùng biểu diễn chính xác và quy tắc làm tròn rõ.
- Kho/phải thu/phải trả/phân bổ/đối soát dùng transaction, khóa và constraint phù hợp; chống double-submit, retry và tranh chấp nhiều kết nối.
- Điều chỉnh chứng từ đã ghi sổ có lịch sử và liên kết nguồn; không xóa âm thầm để sửa số.
- Tách lượng thực, giữ, khả dụng, đang chuyển, cách ly và ký gửi; báo cáo khớp ledger và ownership.
- Hàng tặng, hàng mẫu, giao từng phần, hàng trả và hàng ký gửi vẫn tuân thủ bảo toàn lượng.
- Job bền có retry, chống tạo tác động trùng và cách phục hồi sau restart. Thông báo không được phát sinh từ transaction thất bại.
- Migration bổ sung/backfill có kiểm tra trước–sau; không tạo tồn, giá vốn, nợ hoặc doanh thu giả từ dữ liệu cũ thiếu thông tin.

YÊU CẦU GIAO DIỆN

Kế thừa nhận diện và design system Cohamy; đọc tài liệu thiết kế trước khi thay đổi. CRM nội bộ và portal đại lý có điều hướng riêng theo vai trò. Không tạo 140 mục menu.

Mỗi luồng có loading, empty, success, validation, lỗi quyền, lỗi kết nối và cách tiếp tục. Form không mất nội dung khi gửi lỗi. Tìm kiếm/lọc/phân trang/tạo nhanh phải thực sự hoạt động. Mobile phải đọc và thao tác được, không chỉ thu nhỏ desktop.

Không hiển thị dữ liệu giả, KPI mẫu, log kỹ thuật hoặc thông báo “thành công” khi chưa lưu. Những phần chưa triển khai không được dùng giao diện đẹp để ngụ ý đã xong. Giữ website public, ngôn ngữ, blog, sản phẩm và đường dẫn hiện hữu hoạt động.

KIỂM THỬ

Thực hiện các tiêu chí từng ID ở A8 và các kịch bản E01–E18 ở A9. Test hành vi cần bảo đảm thay vì test chỉ phản chiếu cấu trúc code.

Kiểm tra PostgreSQL nhiều kết nối cho tranh tồn, duyệt hồ sơ, phân bổ tiền và hạn mức; test PGlite tuần tự không đủ cho các kết luận này. Có negative test đại lý A truy cập B qua API, search, file, export và job.

Chạy UI thật cho đăng ký/duyệt, đặt hàng, kho/giao, tiền và ký gửi khi đủ điều kiện. Kiểm tra desktop và mobile 390/320, reload giữ dữ liệu, hết phiên và thu hồi quyền. PDF/Excel phải kiểm tra nội dung và khả năng sử dụng thực tế; không chỉ kiểm tra file tồn tại.

Tách LOCAL, STAGING, PRODUCTION; báo PASS, FAIL, BLOCKED, NOT_RUN trung thực. Không gọi mock email/vận đơn hoặc build thành công là nghiệm thu kết nối thật. Không vô hiệu hóa test, quyền hoặc chức năng để vượt kiểm tra.

Đối với performance, ghi dataset, cấu hình, concurrent users, p50/p95 và ngưỡng đã thống nhất. Đối với backup, restore độc lập cả database và file, kiểm tra liên kết; không chỉ có lệnh backup chưa chạy.

PHÁT HÀNH VÀ BÀN GIAO

Chuẩn bị migration, đối chiếu dữ liệu, backup/restore, candidate, smoke và rollback theo A11. Khi được phép deploy, xác minh SHA, cwd, Node executable và app PM2 thực tế; chỉ tác động Cohamy. Chạy lại login HTTPS, portal, website localized và quyền dữ liệu sau cutover.

Không đưa secret, mật khẩu, OTP, DB URL, dữ liệu khách hoặc backup vào Git/tài liệu công khai. Báo cáo chỉ chứa bằng chứng phù hợp.

Duy trì đủ các tài liệu A12: FEATURE-MATRIX-140, BUSINESS-DECISIONS, IMPLEMENTATION-ROADMAP-140, ARCHITECTURE-140, TEST-REPORT-140, MIGRATION-AND-ROLLBACK-140, USER-GUIDE-140, RUNBOOK-140 và PROGRESS-140 trong docs/crm.

Trong lúc làm, cập nhật ngắn phần đã xác minh, phát hiện ảnh hưởng và bước tiếp theo. Mỗi đợt cập nhật ma trận ID đã qua kiểm tra; không tuyên bố toàn dự án xong nếu còn ID chưa đạt.

Nếu công việc kéo dài qua nhiều phiên, ghi checkpoint cụ thể trong PROGRESS-140.md: HEAD, thay đổi chưa commit, phase/ID, test và kết quả, tiến trình đang chạy, blocker, bước kế tiếp. Phiên sau tiếp tục từ bằng chứng đó; không làm lại phần hoàn tất hoặc bỏ phần còn thiếu.

Báo cáo cuối gồm: phạm vi đã triển khai, ID và môi trường đã nghiệm thu, test chính, giới hạn/chính sách còn thiếu, trạng thái phát hành và đường dẫn tài liệu. Chỉ gọi hoàn thành 140 tính năng khi ma trận đủ 140 ID đạt tiêu chí tương ứng. Nếu bị chặn bởi điều kiện bên ngoài, nêu chính xác phần đã hoàn tất và điều kiện cần để tiếp tục.

Bắt đầu ngay bằng khảo sát P0, sau đó thực hiện phần việc đã đủ điều kiện. Không dừng chỉ để trả lời “tôi có thể làm” hoặc gửi lại một bản kế hoạch.
```
