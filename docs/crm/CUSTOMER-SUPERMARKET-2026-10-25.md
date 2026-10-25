# Tài khoản khách hàng và siêu thị

Phạm vi đã xác nhận: bổ sung hai loại tài khoản để Admin cấp sau; không tạo tài khoản khách/siêu thị giả trên production.

## Cấp tài khoản

1. Admin tạo hoặc chọn hồ sơ trong **Khách hàng**.
2. Vào **Tài khoản → Tạo mới**, chọn **Khách hàng** hoặc **Siêu thị** và đúng hồ sơ.
3. Người dùng đăng nhập tại /portal. Tài khoản nội bộ tiếp tục dùng /crm.

Hai vai trò mới thuộc hồ sơ CUSTOMER. Không mở quyền của đại lý, nhà máy hoặc nhân viên nội bộ cho khách. Khi cấp tài khoản hoặc đổi vai trò, hệ thống chặn loại bên mua xung đột với tài khoản khác đang hoạt động trong cùng hồ sơ.

## Luồng khách hàng

- /portal/goods: ảnh thật từ danh mục, tên sản phẩm, quy cách, kho và số lượng; API không trả giá bán lẻ, giá vốn hoặc bảng giá B2B.
- Khách gửi yêu cầu chưa có giá. Chưa tạo phiếu kế toán hoặc trừ tồn kho.
- Sales được phân công, Manager hoặc Admin nhập báo giá, VAT và hạn hiệu lực.
- Khách xác nhận đúng phiên bản báo giá còn hiệu lực. Hệ thống tạo một nguồn đơn trong luồng kho/kế toán hiện có và giữ kho khách đã chọn.
- /portal/orders: trạng thái, lịch sử, PDF đơn hàng, các phiếu giao đã xác nhận và tệp VAT thuộc đơn.

## Luồng siêu thị

- /portal/branches: quản lý chi nhánh của chính hồ sơ; đơn đã gửi lưu nguyên thông tin chi nhánh lúc đặt.
- Admin/Manager cấu hình giá hợp đồng, sản phẩm, VAT, ngày hiệu lực. Không tự điền giá hoặc tỷ lệ đóng thùng chưa được xác nhận.
- /portal/contracts: chỉ đọc bảng giá của chính siêu thị.
- Đặt theo đơn vị gốc hoặc thùng; quy đổi lấy từ units_per_case đã cấu hình. Giá, VAT, chi nhánh và quy đổi được chụp lại trong đơn.
- Xác nhận thực nhận chỉ gắn với đơn đã xác nhận và một phiên bản phiếu giao đã xác nhận. Phải nhập đủ dòng, không nhận vượt số gửi; thiếu hàng bắt buộc có lý do.
- Xác nhận nhận hàng là bằng chứng đối chiếu, không ghi xuất/nhập kho lần nữa.
- /portal/purchases: báo cáo theo tháng đặt đơn, giờ Việt Nam, CSV UTF-8, số đặt/gửi/nhận/thiếu, VAT và xác nhận đối soát theo checksum. Dữ liệu thay đổi thì cần đối soát lại.

## Kho và kế toán

/crm/buyer-orders hiển thị đơn đúng phạm vi Sales/kho, hoặc quyền Admin/Manager/kế toán. Chi tiết có đối chiếu số đặt, số xuất, thực nhận và số thiếu theo từng sản phẩm.

Đơn được khách xác nhận hoặc đặt theo hợp đồng chuyển vào commercial_requests và accounting_order_clearances; phiếu xuất/PDF dùng luồng chứng từ hiện có. Chỉ xác nhận xuất kho mới thay đổi tồn; lặp yêu cầu không tạo đơn hoặc trừ kho thêm. VAT khi giao từng phần phân bổ theo lũy kế để tổng thuế bằng đúng báo giá.

Các quy tắc tự gửi email/PDF hiện có vẫn áp dụng khi xác nhận phiếu xuất; kiểm thử mới không gửi email ra ngoài.

## Phân quyền và bảo toàn dữ liệu

- Kiểm tra danh tính hiện tại, tổ chức, phân công Sales và kho trên server.
- API mới dùng schema nghiêm ngặt, cùng origin, phiên bản và idempotency key.
- Vai trò bên mua bị chặn khỏi API đại lý/nội bộ cũ; không chỉ ẩn menu.
- Lịch sử đơn, thực nhận và đối soát bất biến; runtime PostgreSQL không có quyền sửa/xóa các bản ghi lịch sử này.
- Giá hợp đồng hoặc tên/địa chỉ chi nhánh thay đổi không sửa giá hay thông tin trên đơn đã gửi.
- Đăng nhập và các biểu mẫu mới dùng POST, khóa gửi đến khi JavaScript sẵn sàng; không để trình duyệt gửi mật khẩu trong query khi mạng chậm.

## MCP

MCP có dùng được không? **Có, qua kết nối Admin hiện có**.

MCP có đọc được dữ liệu này không? **Có**: các bảng buyer_* được khám phá và đọc có phân trang; API mới được đưa vào catalog; tải PDF/VAT trả đúng byte đã lưu.

MCP Admin có thể tạo yêu cầu thay khách, báo giá, quản lý chi nhánh/hợp đồng và đọc đối soát qua quy tắc native. Hành động xác nhận của khách/siêu thị vẫn yêu cầu đúng danh tính bên mua; MCP Admin không giả danh người nhận. Đổi mật khẩu cá nhân nằm ngoài catalog MCP.

Catalog tài khoản chứa giá trị enum thật, gồm CUSTOMER và SUPERMARKET. Sau thay đổi chạy npm run crm:mcp:catalog và npm run test:crm:mcp:catalog.

## Bằng chứng

- LOCAL: 13 nhóm kiểm thử dịch vụ; build production; kiểm tra TypeScript/catalog; PDF đã render, một trang cho mẫu một dòng.
- STAGING: 13 nhóm dịch vụ trên PostgreSQL thật với quyền runtime; 8 nhóm trình duyệt Edge và MCP SDK thật, gồm OAuth, phân trang, đọc PDF/VAT, tạo/báo giá yêu cầu, chống gửi trùng, từ chối giả danh nhận hàng, CSV và màn hình 1440/390/320px.
- Hồi quy: 19 nhóm luồng nhà máy/kho/kế toán/chứng từ/mail đã đạt.
- Kết quả chi tiết: docs/crm/test-results/buyer/. Kiểm thử dùng hồ sơ giả trong database riêng, không phải dữ liệu kinh doanh production.
- Khi triển khai phải có backup/restore đã xác minh, migration cộng thêm, candidate smoke và kiểm tra lại HTTPS/MCP. Không suy diễn bằng chứng staging thành đã triển khai production.

## Production đã xác minh

- Đã triển khai source 9247dd81fb36c78b4472464021b63f02e93f345c lên cohamy.vn ngày 25/10/2026.
- Hai bản backup trước migration và trước chuyển release đều đã khôi phục thử, kiểm tra manifest và tính toàn vẹn tệp.
- 14 kiểm tra candidate và 14 kiểm tra HTTPS production đạt, gồm OAuth/MCP thật, enum hai loại tài khoản và API dữ liệu mới.
- Đối chiếu fingerprint 14 bảng kinh doanh trước/sau: giữ nguyên dữ liệu, tồn kho, đơn hàng, thanh toán và hóa đơn cũ.
- Bảy bảng mới chưa có dữ liệu kinh doanh; không tạo tài khoản khách/siêu thị giả trên production. Admin tự cấp sau.
- Rule tự gửi PDF khi xác nhận xuất kho tới địa chỉ thông báo đã cấu hình vẫn được bật.
- Web và worker chạy đúng release, không có lần restart; database/role và tệp credential kiểm thử riêng đã được dọn.
- Chi tiết tại production.json và production-smoke.json trong thư mục bằng chứng của tính năng.

Lần build máy chủ đầu bị OOM khi nhiều build chạy cùng lúc. Đã dừng dev server kiểm thử riêng, build lại thành công và chỉ chuyển release sau khi candidate đạt. Đây không phải một lần rollback dữ liệu.
