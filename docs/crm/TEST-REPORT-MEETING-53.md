# Kết quả kiểm thử bổ sung cuộc họp 53 mục — 02/10/2026

Báo cáo này ghi nhận phạm vi các assertion đã chạy. 45 ca dịch vụ không tương đương 53 nghiệp vụ đã được kiểm thử toàn bộ trên giao diện hoặc production. Bằng chứng runtime và triển khai nằm trong [báo cáo sửa lỗi](TEST-REPORT-RUNTIME-FIXES-2026-10-02.md).

## Kết quả và phạm vi

- LOCAL PGlite: 45/45 PASS, `test-results/meeting-53-local.json`.
- STAGING PostgreSQL riêng, tài khoản runtime DML: 45/45 PASS, `test-results/meeting-53-postgres.json`.
- ADD24–ADD30 gọi luồng gửi/xác nhận đơn thực tế; kiểm tra số lượng giữ, giải phóng, hết hạn và retry.
- ADD45 gửi đồng thời hai đơn tranh lượng cuối cùng trên PostgreSQL: một thành công, một bị từ chối; không vượt tồn. PGlite chỉ cung cấp bằng chứng chức năng.
- ADD44 kiểm tra hợp đồng API. Kiểm thử Edge thực nằm trong `meeting-runtime-browser-local.json` (5 nhóm) và `meeting-runtime-browser-restart-local.json` (1 nhóm).

## Cấu hình giữ hàng đã triển khai

Đơn mới gửi chính thức đóng băng `reservationPolicy` riêng bên cạnh bản chính sách và checksum gốc. Mặc định kỹ thuật khi chính sách chưa chỉ định là `ON_SUBMIT`, **120 phút**, cho phép giữ một phần. Có thể chỉnh bằng chính sách đơn hàng; đây là DEFAULT_ASSUMPTION, không phải giá trị đã được cuộc họp chốt. `AFTER_APPROVAL` vẫn hỗ trợ luồng kho thủ công. Đơn lịch sử không bị viết lại snapshot.

Nháp không giữ hàng. Gửi chính thức giữ tại kho thuộc bên bán của đơn; không giảm On Hand. Xác nhận chuyển giữ tạm thành giữ xác nhận. Nếu đã hết hạn, phải kiểm tra và giữ lại. Worker giải phóng đúng lượng, không nhân đôi khi retry.

## Danh sách ca đã chạy

| Assertion trong script | Kết quả |
|---|---|
| ADD01: Có bước quản lý nội bộ nhưng không sinh giao dịch mua bán giả | PASS |
| ADD02: Cây quản lý và chuỗi thương mại khác nhau vẫn định tuyến đúng | PASS |
| ADD03: Đổi cây quản lý không tự viết lại đơn đã gửi | PASS |
| ADD04: Người có quyền tạo được tài khoản con trong phạm vi | PASS |
| ADD05: Đại lý không tạo được tài khoản hoặc role toàn hệ thống | PASS |
| ADD06: Tuyến ngắn hoạt động mà không cần đại lý cấp 2 | PASS |
| ADD07: Deal ID duy nhất khi tạo đồng thời | PASS |
| ADD08: Deal liên kết được báo giá, đơn, giao và thanh toán | PASS |
| ADD09: Chung Deal không làm lộ bill/giá/công nợ trái quyền | PASS |
| ADD10: Backfill Deal không tự gộp các giao dịch không đủ bằng chứng | PASS |
| ADD11: Bật giới hạn: cấp trên 40%, tuyến dưới 20% hợp lệ | PASS |
| ADD12: Bật giới hạn: tuyến dưới 45% bị chặn hoặc chờ ngoại lệ | PASS |
| ADD13: Chỉ người có quyền được duyệt ngoại lệ, có audit đầy đủ | PASS |
| ADD14: Khác cơ sở giá không so phần trăm máy móc | PASS |
| ADD15: Quantity Tier không lấy bậc cao nhất chưa đạt làm giới hạn | PASS |
| ADD16: SEQUENTIAL_STACK cho kết quả 54.000 trong ví dụ đã nêu | PASS |
| ADD17: EXCLUSIVE ưu tiên account cho kết quả đúng | PASS |
| ADD18: EXCLUSIVE ưu tiên promotion cho kết quả đúng | PASS |
| ADD19: BEST_BENEFIT khác EXCLUSIVE khi ưu đãi ưu tiên thấp hơn | PASS |
| ADD20: Client không tự đổi chế độ kết hợp | PASS |
| ADD21: Đổi chính sách không làm đổi snapshot yêu cầu đã gửi | PASS |
| ADD22: Sửa giá đã chấp thuận tạo phiên bản và quy trình chấp thuận lại | PASS |
| ADD23: Nháp không giữ hàng | PASS |
| ADD24: Formal submit atomically reserves without reducing On Hand | PASS |
| ADD25: Real order confirmation promotes the same allocation | PASS |
| ADD26: Worker releases two expired holds sharing a balance exactly once | PASS |
| ADD27: Confirmation after expiry rechecks actual stock | PASS |
| ADD28: Same submit key and worker retry never multiply reservations | PASS |
| ADD29: Buyer cannot reserve seller allocations a second time | PASS |
| ADD30: Formal submit exposes partial held quantity and missing quantity | PASS |
| ADD31: Người mua thấy tổng khả dụng đúng phạm vi, không thấy kho bị hạn chế | PASS |
| ADD32: Tổng khả dụng loại trừ hàng giữ, cách ly, chuyển kho và nguồn trái quyền | PASS |
| ADD33: Upload chứng từ không tự xác nhận thanh toán | PASS |
| ADD34: Chứng từ thanh toán bị chặn khi truy cập trái quyền | PASS |
| ADD35: Bấm công nợ mở đúng đơn, bill, payment history và Deal nguồn | PASS |
| ADD36: Đơn trả một phần và quá hạn hiển thị được cả hai trạng thái | PASS |
| ADD37: Sản phẩm hiển thị được các bài public liên quan | PASS |
| ADD38: Hồ sơ chăm sóc gợi ý bài đúng sản phẩm trong phạm vi | PASS |
| ADD39: Không chia sẻ bài nháp hoặc preview token như link public | PASS |
| ADD40: Copy link không bị ghi thành đã gửi/đã đọc | PASS |
| ADD41: Thông báo đúng người, đúng đối tượng và mở được màn hình nguồn | PASS |
| ADD42: Worker retry không tạo thông báo trùng | PASS |
| ADD43: UI/API/export cùng sử dụng phiên bản giá và phạm vi dữ liệu | PASS |
| ADD44: API debt summary contract only; browser evidence is in meeting-runtime-browser report | PASS |
| ADD45: Two real submissions compete for the last unit; PostgreSQL mode uses separate connections | PASS |

## Nguồn mã

- `026-distribution-multitier.sql`, `027-meeting-53-amendments.sql`: thay đổi nghiệp vụ do Anti triển khai.
- `028-meeting-runtime.sql`: CMS lưu bền vững, revision bất biến, chỉ mục chống giữ trùng.
- `029-bank-match-lock.sql`: khóa đối soát có phạm vi mà không cấp quyền sửa sổ ngân hàng.
- `request-reservations.ts`, `sales-orders.ts`, `order-routing.ts`, `articles.ts`, `blog-crm-store.ts`, worker và các form CRM/Portal: kết nối hành vi vào runtime.

Trạng thái production phải dựa vào báo cáo release, kiểm tra migration, web/worker và HTTPS sau cutover; các file LOCAL/STAGING không chứng minh production.
