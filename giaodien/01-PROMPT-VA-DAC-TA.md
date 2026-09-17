# Prompt và đặc tả CRM quản lý kho socola

Hãy xây hệ thống CRM quản lý kho socola đầy đủ trong repository hiện tại, dùng giao diện CRM HumanBank trong hai ảnh đính kèm làm chuẩn cho màn hình đăng nhập và trang chủ. Thực hiện đến mức chạy được với dữ liệu lưu thật, API thật và luồng nghiệp vụ được kiểm thử. Đọc `02-DESIGN.md` và hai ảnh trong `references/` trước khi viết giao diện.

## 1. Phạm vi và nguyên tắc thực hiện

- Sản phẩm là ứng dụng nội bộ phục vụ chủ doanh nghiệp, quản lý, thủ kho, bán hàng và kế toán; tiếng Việt mặc định, tiền VND, thời gian nghiệp vụ Asia/Ho_Chi_Minh.
- Giữ nền tối, header ngang, các ô chức năng nhiều màu dạng vuông, hiệu ứng mạng điểm nhẹ và thanh điều hướng nổi dưới như ảnh. Không đổi trang chủ thành sidebar/KPI dashboard hoặc trang giới thiệu.
- Đổi nội dung sang quản lý hàng socola. Thứ tự 11 ô chức năng theo mục 2; không tự thêm ô khiến bố cục khác ảnh.
- Đọc code, hướng dẫn repository và stack hiện có; tận dụng pattern và thư viện đã dùng. Nếu repository trống, mặc định Next.js + TypeScript, API phía server, PostgreSQL + Prisma, thư viện UI/icon phù hợp; tách service tồn kho để dễ kiểm thử. Chỉ thêm Redis/worker/storage ngoài khi có tác vụ cần chúng.
- Khảo sát rồi lập FEATURE-MATRIX.md và PROGRESS.md; tiếp tục triển khai, không kết thúc sau bước viết kế hoạch.
- Tạo PRODUCT.md và DESIGN.md cho sản phẩm mới từ brief này. Nguồn HumanBank chỉ quyết định phần hình thức được tham chiếu; hệ thống mới có dữ liệu, quyền và routes riêng.
- Không đưa tài khoản, email, mật khẩu, token, database, URL VPS hay dữ liệu học viên HumanBank vào dự án mới.
- Quản lý thành phẩm là phạm vi đầu tiên. Sản xuất theo công thức, định mức nguyên liệu, payroll, sàn thương mại điện tử và kết nối cảm biến kho là phần mở rộng, không dựng thành chức năng giả trong bản đầu.

## 2. Trang chủ: 11 module đúng vị trí

| Vị trí | Nhãn | Chức năng chính | Route đề xuất |
| --- | --- | --- | --- |
| Hàng 1, cột 1 | HÀNG HÓA | Danh mục sản phẩm, SKU, biến thể, barcode, quy cách | `/crm/hang-hoa` |
| Hàng 1, cột 2 | KHÁCH HÀNG | Hồ sơ, lịch sử mua, chăm sóc và công nợ | `/crm/khach-hang` |
| Hàng 1, cột 3 | NHÀ CUNG CẤP | Hồ sơ, đơn mua, lịch sử nhập và công nợ | `/crm/nha-cung-cap` |
| Hàng 1, cột 4 | NHÂN VIÊN | Hồ sơ, bộ phận, công việc và kho được giao | `/crm/nhan-vien` |
| Hàng 1, cột 5 | TỒN KHO | Tồn theo kho/vị trí/SKU/lô, HSD và truy vết | `/crm/ton-kho` |
| Hàng 2, cột 1 | NHẬP KHO | Nhập từ mua hàng, nhập khác và hàng trả | `/crm/nhap-kho` |
| Hàng 2, cột 2 | XUẤT KHO | Xuất bán, chuyển kho, trả NCC, hao hụt/hủy | `/crm/xuat-kho` |
| Hàng 2, cột 3 | ĐƠN HÀNG | Bán hàng, đơn mua, giữ hàng và giao hàng | `/crm/don-hang` |
| Hàng 2, cột 4 | QUẢN TRỊ TÀI KHOẢN | Tài khoản, roles, quyền, lịch sử và cấu hình | `/crm/tai-khoan` |
| Hàng 2, cột 5 | BÁO CÁO THU CHI | Thu/chi, thanh toán, công nợ và báo cáo kho/bán | `/crm/bao-cao` |
| Hàng 3, cột 1 | KIỂM KÊ | Phiên kiểm kê, đếm hàng, chênh lệch, duyệt | `/crm/kiem-ke` |

Điều hướng dưới: Trang chủ, Hàng hóa, Nhập kho, Xuất kho, Thoát. Link active theo route, đăng xuất thu hồi phiên phía server. Role hạn chế chỉ thấy mục được phép; giữ thứ tự tương đối và grid, không thay bằng một dashboard khác.

Lô/HSD, điều kiện bảo quản, chuyển kho, tài liệu và lịch sử nằm trong tab/trang con của module tương ứng, không cần thêm tile ngoài 11 ô.

## 3. Đăng nhập và người dùng

- Form giữa trang, logo/tên thương hiệu cấu hình được, email hoặc định danh đăng nhập theo model hệ thống, mật khẩu, hiện/ẩn mật khẩu, quên mật khẩu và nút cam toàn chiều rộng.
- Đăng nhập, đăng xuất, hết phiên và đổi mật khẩu hoạt động thật. Quên mật khẩu dùng token hết hạn và một lần; thiếu mail provider phải báo trạng thái cấu hình rõ ràng.
- Tài khoản nội bộ do admin cấp/mời. Vị trí liên kết tạo tài khoản trong ảnh chuyển thành yêu cầu cấp tài khoản theo chính sách đã cấu hình; không cho tự đăng ký thành admin.
- Header có tên thương hiệu trái, tên hệ thống, người dùng/vai trò/avatar/menu phải; menu gồm thông báo, hồ sơ, bảo mật và đăng xuất. Trang chủ có lời chào theo người đang đăng nhập.
- Không tự điền thông tin đăng nhập HumanBank trong ảnh. Không dùng xác thực chỉ bằng localStorage hay mật khẩu hardcode.

## 4. Hàng hóa và đơn vị tính

- Mỗi SKU có mã duy nhất, tên, nhóm/brand, loại socola, tỷ lệ cacao nếu có, khối lượng tịnh, quy cách, ảnh, nhà cung cấp mặc định, trạng thái kinh doanh, giá mua tham khảo và giá bán theo quyền.
- Thuộc tính dị ứng/thành phần, hướng dẫn bảo quản, thông tin nguồn gốc được nhập từ nhãn/tài liệu thật. Cho phép để chưa có dữ liệu; không để AI tự bịa.
- Biến thể theo khối lượng/hương vị/đóng gói có SKU và barcode riêng. Barcode nội bộ không được gọi là EAN/GS1 hợp lệ nếu chưa có dữ liệu tương ứng.
- Chọn đơn vị cơ sở cho từng SKU: viên, thanh, hộp hoặc gram tùy mặt hàng. Đơn vị bán/mua như thùng/hộp có hệ số quy đổi rõ ràng, Decimal phù hợp.
- Ví dụ SKU quản lý theo thanh: 1 hộp = 12 thanh, 1 thùng = 10 hộp = 120 thanh. Không áp dụng một hệ số hộp chung cho mọi sản phẩm.
- Quy đổi được snapshot trên dòng chứng từ. Đổi quy cách chỉ ảnh hưởng nghiệp vụ mới, không làm thay số lượng lịch sử; đổi đơn vị cơ sở cần nghiệp vụ migration có kiểm tra.
- Barcode scan bằng đầu đọc như bàn phím; hỗ trợ camera khi thiết bị cho phép, cùng cách tìm/nhập mã tay. Không bắt nhân viên phải có camera.
- Combo/giỏ quà bán từ nhiều SKU có định mức thành phần: giữ/xuất từng thành phần, không vừa trừ combo vừa trừ thành phần. Nếu chưa triển khai combo, không quảng cáo là đã hỗ trợ.

## 5. Kho, lô, hạn sử dụng và bảo quản

- Kho -> khu vực -> kệ/vị trí; tồn theo SKU + lô + vị trí + trạng thái hàng. Có kho đang hoạt động/ngừng hoạt động và scope người dùng.
- Lô có ID nội bộ, mã lô hãng, SKU, ngày sản xuất nếu có, HSD nếu có, ngày nhận, nhà cung cấp/nguồn, chứng từ nhập và trạng thái kiểm tra. Mã lô hãng không nhất thiết duy nhất toàn hệ thống.
- FEFO: khi xuất hàng ưu tiên lô đủ điều kiện có HSD gần nhất; nếu bằng nhau dùng ngày nhận rồi ID ổn định. Lô không HSD có chính sách cấu hình, không ngầm ưu tiên trước mọi lô có HSD.
- Chặn xuất bán lô hết hạn, cách ly, thu hồi hoặc hỏng. Lô không HSD hoặc thiếu thông tin phải hiện rõ trạng thái và xử lý theo chính sách mặt hàng.
- HSD chỉ có ngày được hiểu dùng được hết ngày đó theo giờ Việt Nam, chặn từ 00:00 ngày tiếp theo, trừ khi cấu hình nhãn có quy tắc khác. Không nhầm UTC với ngày nghiệp vụ.
- Cảnh báo gần HSD theo các mốc cấu hình, ví dụ 7/30/60 ngày. Đây là mốc cảnh báo nghiệp vụ, không phải khuyến nghị kéo dài HSD.
- Bảo quản: giới hạn nhiệt độ/độ ẩm theo mặt hàng hoặc nhãn nhà cung cấp; không đặt một mức chuẩn cho mọi loại socola. Bản đầu hỗ trợ ghi nhận thủ công; cảm biến tự động là integration riêng.
- Lô gặp sự cố bảo quản có thể chuyển cách ly để kiểm tra; không tự kết luận đủ an toàn bán lại.
- Có truy xuất: từ lô thấy nguồn nhập, vị trí, phiếu xuất và đơn/khách nhận; từ đơn thấy SKU/lô đã giao. Chức năng thu hồi đánh dấu lô, chặn phân bổ mới và tạo danh sách đơn liên quan.

## 6. Sổ kho, tồn khả dụng và giao dịch

- Số lượng tồn được hình thành từ các giao dịch đã ghi sổ; không cho sửa trực tiếp một ô tồn kho để thay số liệu.
- Dùng sổ giao dịch tồn kho có chứng từ/dòng, SKU/lô/vị trí/trạng thái, lượng tăng/giảm, người thực hiện, timestamp và liên kết reversal.
- Tồn có thể bán = tồn vật lý đủ điều kiện bán - lượng đã giữ cho đơn. Lượng cách ly/hỏng/hết hạn/đang vận chuyển không cộng vào tồn có thể bán.
- Trình bày riêng tồn vật lý, đủ điều kiện bán, giữ hàng, khả dụng và đang chuyển; định nghĩa rõ để không đếm một lượng nhiều lần.
- Reservation là dữ liệu nghiệp vụ riêng có trạng thái/đối tượng/lô; không giả là xuất kho. Xuất đơn phải đồng thời trừ tồn và giải phóng phần giữ tương ứng.
- Ghi sổ trong transaction với cơ chế khóa/kiểm soát đồng thời theo SKU/lô/vị trí. Hai đơn cùng tranh hàng không được làm âm tồn.
- Mỗi yêu cầu ghi sổ có idempotency key và ràng buộc database; retry/double click/timeout không tạo giao dịch lần hai.
- Dùng Decimal cho lượng, quy đổi và tiền; không dùng số thực nhị phân cho tổng tiền/tồn. Cấm lượng âm bất hợp lệ và kiểm tra độ chính xác theo đơn vị.
- Chứng từ đã ghi sổ giữ lịch sử; chỉnh sai bằng chứng từ đảo/điều chỉnh có lý do và quyền. Không xóa mềm dòng ledger làm mất đối soát.

## 7. Nhập kho, xuất kho, chuyển kho và hàng trả

- Phiếu gồm số chứng từ, ngày nghiệp vụ, kho, nguồn/đích, đối tác, dòng SKU/lô/đơn vị/quy đổi/số lượng/đơn giá khi được phép, ghi chú và tệp đính kèm.
- Trạng thái: nháp -> chờ duyệt -> đã duyệt -> đã ghi sổ; từ chối/hủy trước ghi sổ. Người/role nào được duyệt hoặc ghi sổ phải được cấu hình rõ.
- Nhập từ đơn mua cho phép nhiều lần; theo dõi đặt/đã nhận/còn nhận. Nhập tồn đầu là chứng từ riêng, không sửa stock balance bằng seed tùy tiện.
- Xuất bán từ đơn cho phép giao một phần; chỉ trừ hàng thực sự xuất. Có preview FEFO và lý do có audit khi người có quyền đổi lô còn hợp lệ.
- Xuất hao hụt/hủy ghi loại lý do như chảy, vỡ, quá hạn hoặc sai lệch, quantity, lô và tài liệu nếu có; không tạo doanh thu.
- Chuyển kho có nguồn, đang chuyển, đích; lúc xuất nguồn giảm và hàng vào bucket in-transit; lúc nhận đích tăng và in-transit giảm. Nhận thiếu/hỏng có chênh lệch và audit, không vừa tồn nguồn vừa tồn đích.
- Hàng khách trả tham chiếu lượng đã giao và lô đã giao; nhập vào cách ly, kiểm tra rồi mới chuyển đủ điều kiện bán nếu được duyệt. Không tự cộng ngay vào khả dụng.
- Trả NCC tham chiếu nguồn nhập và lô; không vượt lượng được phép, đi qua quy trình xuất và đối soát công nợ riêng.
- Phiếu ghi sổ bị yêu cầu đảo nhưng đã có nghiệp vụ phụ thuộc phải kiểm tra và trả hướng xử lý; không làm âm tồn hoặc phá chuỗi truy vết để đảo cho xong.

## 8. Đơn hàng và CRM

- Khách hàng: mã, tên, liên hệ, địa chỉ, nhóm đại lý/bán lẻ, nhân viên phụ trách, ghi chú, nguồn, tương tác/công việc và lịch nhắc.
- Có phân nhóm và phát hiện trùng định danh liên hệ; lịch sử đơn, giao hàng, hàng trả, khoản thu/công nợ trong quyền được cấp.
- Đơn bán: nháp -> xác nhận/giữ hàng -> đang soạn -> giao một phần/đã giao -> hoàn tất, cùng nhánh hủy. Trạng thái thanh toán độc lập với trạng thái giao.
- Khi xác nhận giữ đủ hàng theo chính sách; không hứa có hàng nếu khả dụng thiếu. Hủy đơn giải phóng phần giữ chưa giao; phần đã giao cần hàng trả, không tăng tồn ngay khi hủy.
- Dòng đơn lưu snapshot tên SKU, đơn vị/quy đổi, giá, giảm giá và thuế nếu hệ thống áp dụng; thay bảng giá sau này không sửa đơn đã phát sinh.
- Theo dõi hạn giữ hàng/đơn cần soạn, chỉ tự giải phóng nếu chính sách đã cấu hình; không tự hủy nghiệp vụ đã giao.
- NCC: hồ sơ, liên hệ, thời gian giao dự kiến, đơn mua, nguồn lô, hóa đơn/chứng từ và thanh toán.
- Công việc bán hàng gắn khách/đơn, người phụ trách, hạn và trạng thái; nhắc trong ứng dụng. Gửi tin Zalo/SMS/email bên ngoài cần integration và lệnh gửi cụ thể, không giả là gửi thành công.

## 9. Kiểm kê, báo cáo, tiền và tài liệu

- Phiên kiểm kê theo kho/phạm vi SKU/vị trí, snapshot có thời điểm/cutoff, danh sách đếm lô và người phụ trách.
- Bản đầu khóa ghi sổ kho/phạm vi đang kiểm kê để tránh chênh lệch giả; reservation và job liên quan cũng phải kiểm tra khóa. Nếu dùng cơ chế reconciliation khác, viết và test quy tắc rõ.
- Nhập kết quả đếm, xác nhận/đếm lại, nêu lý do chênh lệch, duyệt, sinh chứng từ điều chỉnh duy nhất. Không chỉnh trực tiếp ledger cũ.
- Báo cáo tồn hiện tại/theo cutoff, nhập–xuất–tồn, hàng gần HSD/hết hạn, lượng giữ, hao hụt, lệch kiểm kê, lịch sử lô, bán hàng theo thời gian/SKU/nhân viên/kênh nếu có.
- Thu/chi có đối tác, đơn/phiếu liên quan, phương thức, người lập, trạng thái duyệt và thanh toán; phân bổ một khoản cho nhiều chứng từ và nhiều khoản cho một chứng từ khi cần.
- Công nợ khách/NCC được đối soát từ chứng từ và phân bổ thanh toán; không sửa tay trường "đã trả" để thay số tiền.
- Nếu có giá vốn/lợi nhuận, chọn và ghi rõ phương pháp tính được hỗ trợ; tách FEFO xuất hàng khỏi phương pháp định giá. Không gọi doanh thu trừ giá mua tham khảo là lợi nhuận chính xác.
- Module này là quản trị nội bộ, không tự tuyên bố thay phần mềm kế toán/hóa đơn điện tử. Hóa đơn điện tử chỉ tích hợp khi có provider và yêu cầu cụ thể.
- Xuất CSV/XLSX/PDF theo quyền, filter và timezone; bảng lớn có pagination phía server, export lớn chạy nền khi cần.
- Upload ảnh, nhãn, chứng từ và báo cáo kiểm tra gắn đúng đối tượng, private storage và API có quyền. Hàng hóa và documents không tải tất cả về máy người dùng để lọc.

## 10. Roles và phạm vi dữ liệu

| Role mặc định | Phạm vi nghiệp vụ |
| --- | --- |
| Chủ hệ thống/Admin | Cấu hình, phân quyền, toàn bộ kho và audit theo quyền |
| Quản lý kho | Kho được giao, duyệt phiếu/kiểm kê, cách ly, báo cáo kho |
| Thủ kho | Lập/xử lý phiếu và đếm hàng tại kho được giao; không tự cấp quyền |
| Bán hàng | Khách/đơn được giao, khả dụng để bán; giá vốn/thu chi theo quyền |
| Kế toán | Chứng từ tiền, phân bổ thanh toán, công nợ, chi phí và báo cáo được cấp |
| Chỉ xem | Các bản ghi và báo cáo được cấp, không ghi sổ |

- Tách quyền xem/lập/sửa/duyệt/ghi sổ/đảo/xuất file/cấu hình. Phân quyền API phía server và scope kho/khách hàng; ẩn tile chưa đủ bảo vệ.
- Admin có thể cấu hình người lập có được tự duyệt hay không, mặc định tách người lập và duyệt cho phiếu điều chỉnh/hao hụt nếu có đủ nhân sự.
- Staff profile tách khỏi auth account; dừng tài khoản không làm mất danh tính trên chứng từ cũ. Không cho tự nâng role hoặc tự mở scope kho.
- Audit ghi ai, thao tác, đối tượng, trước/sau, lý do, thời gian và request/job liên quan; không ghi password/token.

## 11. Mô hình dữ liệu và kỹ thuật tối thiểu

- Entity chính: User, Role/Permission, Employee, Warehouse/Location, Product/SKU, Unit/UnitConversion, Lot, Customer, Supplier, SalesOrder/Line, PurchaseOrder/Line, StockDocument/Line, StockMovement, StockBalance, Reservation, Transfer, Return, Stocktake/Count, Payment/Allocation, Task, Attachment, AuditEvent.
- StockBalance là số tổng hợp phục vụ truy vấn; có job/reconciliation đối chiếu với ledger. Unique key phải gồm các chiều thực tế của tồn, không chỉ SKU.
- Lưu snapshot nghiệp vụ ở dòng chứng từ; dùng foreign keys, indexes, constraints, version/optimistic concurrency phù hợp. Ghi sổ và reservation cần đồng bộ chặt hơn check ở frontend.
- Số chứng từ theo prefix/type/kho/năm nếu chọn, duy nhất với thao tác đồng thời. ID nội bộ không phụ thuộc số tăng theo UI.
- API/service theo module; validate server-side; phân biệt lỗi thiếu hàng, lô không hợp lệ, phiếu thay đổi, thiếu quyền và request lỗi.
- Search/filter/sort/pagination phía server, không N+1. Danh sách dài và form nhập nhiều dòng không làm chậm launcher.
- Auth dùng giải pháp trưởng thành, password hash chuẩn, session/cookie bảo vệ, rate limit phù hợp; kiểm tra XSS/CSRF/file upload. Không sao chép chính sách khóa tài khoản HumanBank từ lịch sử hội thoại.
- Notification/job khi có: outbox sau commit, retry giới hạn/idempotency, trạng thái lỗi thật. Chưa cấu hình kết nối ngoài phải hiện rõ và test nội bộ riêng.
- Có migration, seed DEMO riêng, backup/restore và hướng dẫn chạy; migration không phá dữ liệu người dùng.

## 12. Bộ nghiệm thu bắt buộc

1. Đăng nhập/đăng xuất, quên mật khẩu theo cấu hình, hết phiên, menu user và 11 tile đúng thứ tự hoạt động; refresh không mất dữ liệu.
2. Một SKU đơn vị thanh, 1 hộp = 12 thanh: nhập 10 hộp ghi sổ thành 120 thanh. Double click/retry cùng request vẫn chỉ 120.
3. Giữ 30 thanh: vật lý 120, giữ 30, khả dụng 90. Giao 24 từ lượng giữ: vật lý 96, giữ 6, khả dụng 90. Hủy phần còn lại giải phóng 6: khả dụng 96.
4. Có 10 thanh khả dụng, hai request đồng thời mỗi request xin giữ 8: tối đa một request được giữ đủ, không âm hoặc tổng giữ 16.
5. Hai lô đủ điều kiện bán với HSD khác nhau: FEFO lấy lô gần HSD trước; không phân bổ lô hết hạn/cách ly. Test 23:59:59 ngày HSD và 00:00 hôm sau giờ Việt Nam.
6. Xuất chuyển 12 thanh A -> B: A giảm 12, đang chuyển tăng 12; nhận đủ tại B thì B tăng 12 và đang chuyển về 0. Retry nhận không tăng B lần nữa.
7. Khách trả 2 thanh từ đơn đã giao: nhập cách ly 2, khả dụng chưa tăng; chỉ tăng khi kiểm tra/duyệt đủ điều kiện. Trả vượt lượng đã giao bị chặn.
8. Kiểm kê snapshot 50, đếm 48, duyệt điều chỉnh -2 đúng một lần. Ghi sổ đồng thời trong scope khóa phải bị chặn; mở khóa sau khi hoàn tất/hủy theo quy trình.
9. Phiếu nháp không đổi tồn; phiếu ghi sổ không sửa/xóa trực tiếp; reversal kiểm tra nghiệp vụ phụ thuộc và ghi audit.
10. Role kho A gọi API trực tiếp để lấy/sửa kho B bị từ chối. Bán hàng không được thấy giá vốn khi chưa có quyền, kể cả qua export.
11. Đổi hệ số đơn vị mới không đổi số lượng/tiền lịch sử. Tổng tiền theo Decimal và số trên phiếu/báo cáo khớp.
12. Truy vết từ mã lô ra đúng phiếu nhập/đơn đã giao; thu hồi lô chặn phân bổ mới và hiển thị đúng đơn liên quan.
13. Bảng/import xử lý mã trùng, dòng sai, lô thiếu HSD theo policy, tệp lỗi và lỗi kết nối mà không toast thành công giả; reload kiểm tra dữ liệu đã lưu.
14. Kiểm tra screenshot desktop 1440x900 và viewport giống ảnh tham chiếu; mobile 390x844. Không mất nhãn, không overlap, bottom nav không che dòng cuối hoặc nút lưu.
15. Chạy lint/typecheck/build và tests nghiệp vụ/race condition/permission quan trọng. Báo PASS/FAIL/BLOCKED/NOT RUN kèm môi trường; mock không được gọi là kiểm thử production.

## 13. Thứ tự thực hiện và bàn giao

- Triển khai: auth + shell/launcher -> SKU/unit/kho/lô -> ledger + nhập/xuất/reservation -> đơn + khách/NCC -> kiểm kê/returns/trace -> tiền/báo cáo -> hardening và nghiệm thu.
- Tạo app local/staging chạy được, bắt đầu bằng luồng nhập hộp -> tồn thanh -> giữ đơn -> xuất FEFO -> báo cáo; các module đã có UI đều phải nối dữ liệu và quyền thật.
- Seed chỉ là DEMO, có nhãn và database/môi trường riêng; chưa có dữ liệu thật thì hiện empty state, không lấy DEMO làm chứng minh hệ thống đã được khách sử dụng.
- Cập nhật FEATURE-MATRIX.md và PROGRESS.md khi hoàn thành phần; ghi blockers và lệnh chạy để tiếp tục ở cuộc trò chuyện khác.
- Bàn giao source, schema/migrations, tài liệu setup/env không có secrets, hướng dẫn thao tác, kết quả test và screenshot đối chiếu.
- Tự suy luận lựa chọn kỹ thuật từ repo và giả định đã nêu; không dừng vì các quyết định UI đã có trong DESIGN. Chỉ hỏi khi thiếu dữ liệu nghiệp vụ/credential bắt buộc mà không thể làm tiếp phần phụ thuộc.
- Chạy dev server nếu cần và cung cấp URL. Push/deploy chỉ vào repository/server của dự án mới khi đã được giao, không dùng production HumanBank làm môi trường thử.
