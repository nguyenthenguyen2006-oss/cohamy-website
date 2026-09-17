# Thiết kế CRM Socola dựa trên giao diện HumanBank

## Nguồn quyết định giao diện

Hai ảnh `references/01-dang-nhap.png` và `references/02-trang-chu.png` là chuẩn về cấu trúc và diện mạo. Mã HumanBank hiện tại chỉ là tham khảo component và kích thước; CSS có nhiều lớp ghi đè, không copy một khai báo cũ rồi coi đó là kết quả cuối trên ảnh.

Mode: Operate. Người dùng mở đúng module và thực hiện nghiệp vụ kho/bán hàng. Tên tạm `CRM SOCOLA`, tên chính thức và logo được cấu hình; chưa có logo thì dùng wordmark chữ gọn cùng icon Package của thư viện, không tạo logo HumanBank đổi tên.

## 1. Đăng nhập

- Full viewport nền xanh đen gần `#020617`, mạng điểm/đường nối mờ. Form đặt giữa cả hai chiều như ảnh, tối đa rộng 400px, padding desktop 38–40px; mobile padding 24px và gutter 16px.
- Khối form nền gần `#111827`, border 1px mờ ấm, góc 24px theo ảnh. Giữ loại góc lớn riêng cho khối đăng nhập, không áp dụng cho mọi nút.
- Thứ tự: logo/wordmark -> ĐĂNG NHẬP CRM -> dòng phụ ngắn -> trường đăng nhập -> mật khẩu + quên mật khẩu -> nút đăng nhập -> liên kết cấp tài khoản/hỗ trợ phù hợp hệ thống nội bộ -> copyright cấu hình theo thương hiệu và năm hiện tại.
- Input cao 50px, dark fill gần `#293347`, icon trái; nút hiện/ẩn mật khẩu phải có tên truy cập, không che text.
- Nút đăng nhập cao 50px, toàn chiều rộng, màu cam phẳng `#ff8000`, chữ gần đen như ảnh, radius 4px. Hover đổi sắc nhẹ, không scale/nhấc nút.
- Email dài có thể cuộn ngang trong input, không cắt giá trị thật; error ở cạnh field và form, loading khóa submit để tránh gửi lặp.
- Không có ảnh sản phẩm lớn/hero quảng cáo trên màn hình này; nguồn hình là hai ảnh tham chiếu và ảnh SKU trong nghiệp vụ sau này.

## 2. Header và trang chủ launcher

- Header ngang tối gần `#0b1017`, cao 66px desktop; brand trái, divider, tên hệ thống; user/name/role/avatar viền cam/menu phải.
- Nền launcher `#0f172a`, particle network nhẹ nằm phía sau. Lời chào giữa phía trên grid, chữ muted; không thêm headline lớn khiến grid bị đẩy khác ảnh.
- Desktop đủ chỗ: 5 cột x 180px, gap 25px, tổng grid rộng 1.000px, căn giữa. 11 ô xếp 5 + 5 + 1; ô cuối nằm cột đầu hàng ba.
- Tile 180x180px, màu phẳng, border-radius 4px theo ảnh người dùng cung cấp. Icon trắng 48–52px nằm trên nhãn, nhãn 14–16px đậm, cân giữa.
- Không lấy radius 32px/gradient/scale của các khai báo legacy cũ; ảnh tham chiếu có tile gần vuông, ít bo và màu phẳng.
- Không đổi vị trí hoặc thứ tự 11 ô; nhãn dài xuống dòng tối đa 2 dòng mà không thay kích thước tile. Giữ thứ tự row-major khi responsive.
- Home chỉ là launcher. Báo cáo số tồn/doanh số/HSD nằm trong module và thông báo phù hợp, không thêm dãy KPI cards phía trên.

## 3. Màu và icon 11 ô

Các mã màu dưới là token đề xuất gần ảnh, không phải kết quả đo pixel tự động. Dùng thống nhất và đối chiếu screenshot khi build.

| Vị trí | Nhãn | Màu phẳng | Icon lucide đề xuất |
| --- | --- | --- | --- |
| 1 | HÀNG HÓA | `#2449ba` | Package |
| 2 | KHÁCH HÀNG | `#107b58` | ContactRound |
| 3 | NHÀ CUNG CẤP | `#343080` | Truck |
| 4 | NHÂN VIÊN | `#4b0da6` | UsersRound |
| 5 | TỒN KHO | `#075441` | Warehouse |
| 6 | NHẬP KHO | `#bf950b` | PackagePlus |
| 7 | XUẤT KHO | `#196c78` | PackageMinus |
| 8 | ĐƠN HÀNG | `#c94906` | ShoppingCart |
| 9 | QUẢN TRỊ TÀI KHOẢN | `#343080` | UserCog |
| 10 | BÁO CÁO THU CHI | `#075441` | ChartColumn |
| 11 | KIỂM KÊ | `#107b58` | ClipboardCheck |

Vàng/cam được giảm độ sáng so với ảnh ở mức cần thiết để nhãn trắng dễ đọc; kiểm tra contrast trên token thật. Không mã hóa nghiệp vụ chỉ bằng màu. Nếu repo đã dùng Phosphor như HumanBank thì dùng icon tương đương của thư viện đó, tránh hai bộ icon cùng một toolbar.

## 4. Điều hướng nổi dưới

- Giữ dock giữa cạnh dưới như ảnh, tối đa 600px, width `min(600px, calc(100% - 24px))`, bottom khoảng 15px cộng safe-area.
- Nền gần `#0b1017`, container góc 25px theo ảnh; 5 mục chia đều, icon trên và nhãn dưới. Đây là ngoại lệ dạng dock, không phải quy tắc bo góc nút.
- Trang chủ -> Hàng hóa -> Nhập kho -> Xuất kho -> Thoát. State active có chấm nhỏ và nhãn sáng, aria-current, focus rõ; không hiệu ứng icon bật cao/scale.
- Dành bottom padding ít nhất 110px + safe-area cho nội dung; dock không đè lên nút lưu, hàng cuối, toast hoặc hộp xác nhận.
- Trên role không có quyền mở một shortcut, không link tới route cấm; thể hiện unavailable đúng quyền hoặc thay shortcut theo policy ghi rõ, không mở rộng quyền.

## 5. Responsive và chữ

- Rộng >=1.120px: 5 cột 180px/gap25; 900–1.119px: 4 cột; 660–899px: 3 cột; nhỏ hơn: 2 cột với track co giãn và aspect-ratio 1, tile không quá 180px.
- Mốc này là đề xuất triển khai cần test, không khẳng định ảnh có đủ trạng thái mobile. Mỗi breakpoint bảo đảm grid vừa parent; tablet và mobile không scroll ngang toàn trang.
- Font body: Be Vietnam Pro, weights 400/500/600/700. Tiêu đề đăng nhập/nhãn tile có thể dùng Roboto Condensed 700 để gần nét chữ gọn trong ảnh, tải font locally/package đã hỗ trợ tiếng Việt.
- Body/table 14–15px, field labels 12–13px, headings module 20–24px, login heading 24px; bottom labels tối thiểu 11px và đủ chỗ.
- Không đổi font-size theo chiều rộng viewport; letter-spacing 0; số lượng/tiền dùng tabular-nums. SKU/mã chứng từ dài wrap/ellipsis có tooltip, không mất khả năng copy giá trị.
- Keyboard tab, focus ring, label input, tooltip icon lạ; vùng bấm thao tác mobile đủ rộng. Particle aria-hidden, pointer-events none, dừng khi tab ẩn/reduced-motion.

## 6. Màn hình bên trong module

Hai ảnh không thể hiện nội thất module. Phần này là phương án vận hành đề xuất dựa trên nguồn HumanBank đang có vùng làm việc sáng: giữ header/dock tối, vùng bảng/form nền trắng hoặc gần trắng `#f8fafc`, chữ `#17212d`, đường phân cách `#dbe2ea`, nút cam theo nhận diện.

- Phía trên: đường về trang chủ/breadcrumb, tiêu đề module, thao tác chính. Tiếp theo filter/search, bảng có phân trang hoặc form nghiệp vụ.
- Chi tiết SKU/lô/đơn có tab gọn cho thông tin, tồn, lịch sử, chứng từ và audit; route hoặc URL giữ filter/tab để back không mất ngữ cảnh.
- Bảng có header phân biệt, hàng 44–48px, số căn phải, đơn vị rõ; chỉ vùng bảng được scroll ngang khi quá nhiều cột.
- Form nhập/xuất có thông tin phiếu và bảng dòng hàng; chọn kho/lô/đơn vị dùng searchable combobox, số lượng dùng input numeric, trạng thái dùng badge, thao tác dùng icon/button rõ.
- Nút thường radius 4px, màu phẳng, không shadow dày/gradient/scale. Các section là layout unframed, không card nằm trong card.
- Loading, empty, lỗi, lưu thành công, phiếu đã ghi sổ/chỉ xem/thiếu quyền đều có state cụ thể. Không dùng placeholder fake để lấp báo cáo.
- Góc giao diện chỉ có login container 24px, dock25px, avatar tròn; các tile/button/field/modal còn lại dùng 4px hoặc tối đa 8px.

## 7. Kiểm tra bám ảnh

Chụp đăng nhập và launcher tại viewport cùng tỷ lệ hai ảnh gốc, cộng desktop1440x900/mobile390x844. Đối chiếu header, vị trí form/grid, 180px tile/gap25, thứ tự5+5+1, màu/icon/text và dock. Kiểm tra font/ảnh SKU render được, nút thật hoạt động, không overlap và không scale hover.

Nếu triển khai bằng skill Impeccable, brief này đã xác định visual direction: giữ giao diện tham chiếu, không mở lại bài chọn phong cách. Impeccable dùng để extract/harden/verify trong phạm vi đã chốt.
