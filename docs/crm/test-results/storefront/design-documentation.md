# Hồ sơ thiết kế storefront — 05/11/2026

## Overview

Đây là hồ sơ mở rộng có giới hạn của storefront Cohamy, đối chiếu mã hoàn tất và ảnh chụp STAGING. Phạm vi gồm bảy trang chính sách tiếng Việt, liên kết tại hai nhánh chân trang, giá mua lẻ và thao tác Mua ngay/Thêm vào giỏ, đối chiếu giá tại giỏ/thanh toán và trang Admin chỉnh phần trăm giảm. Mức giảm ban đầu 30% là cấu hình nghiệp vụ đã được người dùng yêu cầu; giá niêm yết CRM được xác nhận chưa gồm VAT. Ví dụ giá trong ảnh QA không phải cam kết về dữ liệu production.

Đọc theo thứ tự thẩm quyền: PRODUCT.md; hợp đồng hướng trong .impeccable/surfaces/components-productdetailview-tsx.md; mã incumbent của từng bề mặt; components/crm/DESIGN.md cho CRM. DESIGN.md gốc tự giới hạn ở homepage và hai nhánh shell homepage, nên không dùng bảng màu/type của nó để ép đồng nhất trang sản phẩm, chính sách hoặc Admin. Đây không phải thay hệ thiết kế: giữ nguyên DESIGN.md, .impeccable/design.json và tài liệu thiết kế CRM. Các quyết định dưới đây chỉ mô tả phần mở rộng này.

## Colors

| Bề mặt | Đối chiếu thực tế |
| --- | --- |
| Public ngoài homepage | Giữ nền kem (#FAF6EF), mực cacao (#2A120C), chữ nâu (#4A2418), dấu chọn thumbnail và nhãn giảm màu vàng (#D9A441) từ layout, CSS global và gallery hiện có. Nút Mua ngay dùng .btn-primary hiện có: cacao/kem, hover nâu. |
| Giá | Giá mua nổi bật dùng mực cacao; giá gạch, nhãn VAT và phép tách tiền hàng/thuế dùng nâu dịu (#73584D). Nhãn giảm nhỏ không thay màu hành động chính. Đây là giá trị cục bộ của phần mở rộng. |
| Footer/chính sách | Chân trang giữ hai nhánh hiện có, gồm logo và liên kết cũ. Danh sách chính sách dùng chữ sáng (#e0cfbd), tiêu đề (#faf6ef), nhấn hover/focus vàng (#edc061). Trang đọc dùng cacao và nâu; focus riêng (#80550e). Các sắc độ này là triển khai cục bộ, không bổ sung token toàn cục. |
| Admin | Giữ shell vàng cam, Be Vietnam Pro, vùng trắng và đường viền của CRM. Thông báo lỗi (#a22424) và thành công (#166344) trùng giá trị hiện có trong work.css và CRM DESIGN.md. Không thêm vòng focus khác; kế thừa focus CRM. |

Bản detector được chạy một lần tại .impeccable/review/detector.json có 15 advisory về màu/type, không có mục disallowed. Nó là ảnh chụp trước đợt sửa phản hồi cuối: ba advisory của stylesheet Admin còn nhắc màu sáng cũ (#ffb8a5, #bce6c6, #edc061), không còn trong stylesheet hoàn tất. Những cảnh báo public so với tài liệu homepage không tự chứng minh drift toàn site. Hồ sơ này không sửa cảnh báo hoặc drift có trước ngoài phạm vi.

## Typography

Public tiếp tục Playfair Display cho tiêu đề serif và Manrope cho nội dung/điều khiển thông qua app/globals.css. Không tải phông mới. Chi tiết sản phẩm giữ tiêu đề text-4xl/md:text-5xl và bố cục cũ; giá mua dùng chữ sans đậm, số tiền tabular.

Trang chính sách dùng tiêu đề đọc linh hoạt (clamp 30px–48px), đề mục (25px), thân bài (16px, line-height 1.8), độ dài dòng tối đa (74ch). Đây là nhịp đọc cục bộ cho tài liệu dài, không thay thang type homepage. Admin kế thừa Be Vietnam Pro và mật độ CRM; tiêu đề cục bộ (24px), giá trong bảng dùng tabular numerals và căn phải.

## Layout

Chi tiết sản phẩm giữ container max-w-6xl, lề px-6, khoảng cách cột gap-10 và hai cột từ breakpoint md. Ảnh bên trái, tên và giá bên phải; mobile xếp ảnh trước thông tin. Giá nằm ngay dưới tên; thông tin sản phẩm, số lượng và hành động mua theo sau. Danh sách giá và thao tác mua cũng được dùng tại ProductCard và homepage qua cùng thành phần.

Ngoại lệ gallery được người dùng yêu cầu rõ sau khi thấy khung ảnh có hai dải trắng: bỏ width/height vuông (900×900), aspect-square, object-contain và nền trắng khỏi ảnh chính. Dùng kích thước gốc từ data/product-image-dimensions.ts, chiều rộng 100% và chiều cao tự động. Ảnh chính hạt điều hiện có tỷ lệ (1448×1086); các ảnh dọc (1122×1402) vẫn cao theo tỷ lệ thật, không kéo ngang hoặc cắt nội dung để ép chiều cao bằng nhau. Fallback kỹ thuật cho ảnh chưa có metadata là (900×675); 91 ảnh danh mục hiện tại đều có metadata và đã được kiểm tra với tệp gốc. Thumbnail vẫn vuông, crop và cuộn ngang như incumbent, với aria-pressed và viền chọn vàng; ngoại lệ chỉ áp dụng ảnh chính.

Chính sách có container (1200px), sidebar (250px), gap (56px), bài đọc tối đa (74ch). Dưới (760px), bài đọc đứng trước danh sách bảy chính sách và sidebar hết sticky. Footer homepage dùng ba cột chính sách rồi một cột trên mobile; footer public còn lại giữ bốn nhóm desktop, chuyển nhóm About/Activities vào Quick links để dành một nhóm chính sách, không mất đích liên kết.

Admin dùng các work-section hiện có. Điều khiển giảm giá có nhãn, trợ giúp, giá trị đang áp dụng, phiên bản và trạng thái nhận yêu cầu. Dưới (600px) nhãn/ô nhập chiếm toàn hàng. Bảng giữ sáu cột gồm sản phẩm, niêm yết chưa VAT, sau giảm chưa VAT, VAT, gốc gồm VAT và mua gồm VAT; minimum width (850px) và cuộn bên trong vùng bảng, không cuộn ngang tài liệu. Không đổi bảng thành card.

## Elevation & Depth

Không thêm lớp trang trí, gradient, ảnh nền hoặc bóng mới cho các thành phần mở rộng. Trang chính sách dùng đường phân cách; giỏ/thanh toán giữ container trắng/kem và đường viền incumbent. Admin dùng độ nổi, viền và vùng trắng do CRM hiện có cung cấp.

## Shapes

Giữ bo góc ảnh chính rounded-3xl và thumbnail rounded-xl của gallery; chỉ loại bỏ khung vuông/nền trắng. Giỏ hàng và thanh toán tiếp tục các container/ô nhập bo góc đã có. Nút mua và ô số lượng dùng góc bo vừa của public; thông báo Admin không tạo badge/card trang trí. Không áp dụng hình dáng homepage sang CRM.

## Components

| Thành phần | Hành vi và trạng thái đã đối chiếu trong nguồn |
| --- | --- |
| FooterPolicies / PolicyPage | Bảy mục dùng cùng STORE_POLICIES, nhãn nav, aria-current và focus nhìn thấy được. Nội dung có h1/h2, mục lục yên tĩnh, ngày cập nhật và liên hệ từ nguồn hiện có. Các locale khác dẫn về bản tiếng Việt. Hồ sơ thiết kế không đánh giá lại pháp lý hoặc viết lại nội dung. |
| ProductPrice | Giá mua và giá gạch cùng gồm VAT; hiển thị tỷ lệ giảm, VAT và phần tách tiền hàng/thuế ở chi tiết. Thiếu giá, lỗi tải hoặc hết hàng có chữ phù hợp, không hiện giá 0. |
| ProductPurchase | Số lượng 1–100; Mua ngay thêm hàng rồi tới checkout, Thêm vào giỏ có role=status và đường tới giỏ. Lỗi tải có thử lại; tắt tiếp nhận hoặc chưa thể mua có liên hệ. Nút/ô chính có minimum height (44px). |
| StorefrontProvider / CartView | Refresh giá khi vào giỏ/thanh toán và khi focus cửa sổ. Giá thay đổi có cảnh báo và thao tác chấp nhận riêng; hàng không khả dụng hoặc lỗi tải khóa chuyển thanh toán. Tổng hiện hành tách khỏi giá lưu trong giỏ. |
| CheckoutForm | Chính sách liên quan nằm cạnh checkbox bắt buộc, mặc định chưa chọn. Thông báo nói rõ đang gửi yêu cầu chờ duyệt, phương thức thanh toán dự kiến và vận chuyển chờ xác nhận. Pending/changed/error/intake-off khóa nút gửi. Thành công hiển thị mã và tổng server trả. |
| StorefrontSettings | Preview thay đổi theo số nhập trước khi lưu; chỉ Admin lưu bằng phiên bản và khóa retry. Busy khóa điều khiển, lỗi có role=alert, kết quả có role=status. Lỗi phiên bản yêu cầu tải lại; việc lưu thành công rồi tải lại lỗi được mô tả riêng. |

Ảnh chụp mới được xem trực tiếp trong lượt document này: product-desktop/mobile; footer-desktop/mobile; policy-desktop/mobile; checkout-mobile; admin-success-desktop và admin-error-mobile. Ảnh đối ứng và product-mobile-full tồn tại, khớp bản .impeccable/review theo byte; phép kiểm tra trình duyệt chi tiết nằm trong visual-fixes-staging.json.

## Do's and Don'ts

- Do giữ logo, ảnh sản phẩm gốc, tên, nội dung sản phẩm và đích liên kết hiện có.
- Do lấy giá từ nguồn server hiện hành và trình bày VAT bằng chữ; không lấy danh mục công khai làm bằng chứng giá đại lý, tồn kho hoặc quy đổi CRM.
- Do giữ toàn bộ ảnh chính ở tỷ lệ gốc; thumbnail có thể crop theo hành vi incumbent.
- Do giữ dòng tiền, thuế và tổng nhìn thấy cùng nhau trong preview Admin; giữ cuộn bảng bên trong vùng bảng.
- Don't mở rộng ngoại lệ gallery thành quy tắc cắt ảnh/đổi ảnh toàn site.
- Don't coi bảng màu homepage là thẩm quyền cho mọi public route hoặc CRM.
- Don't diễn giải thông báo đã lưu thành thanh toán, xuất kho, gửi email hoặc nhận đơn production thành công.
- Don't nâng kết quả detector, ảnh chụp hoặc pass cục bộ thành chứng nhận toàn site.

## Evidence and limits

| Hồ sơ | Phạm vi kết quả được ghi nhận |
| --- | --- |
| services-local.json | LOCAL PGlite, 8/8 PASS, không ghi production hoặc gửi thư ngoài. |
| services-staging.json | STAGING PostgreSQL riêng, role DML hạn chế, 10/10 PASS; gồm đồng thời/retry. |
| browser-mcp-staging.json | STAGING production build qua tunnel local, 7/7 nhóm PASS: bảy chính sách, mua ngay, thay giá/chấp nhận, lưu yêu cầu giả và MCP SDK OAuth. Desktop (1440px), mobile (390px) không tràn ngang tài liệu trong nhóm đã kiểm. |
| visual-fixes-staging.json | STAGING sau sửa cuối, 18 phép đo tỷ lệ: 8 ảnh chính + 8 nhãn + desktop/mobile; thuộc tính kích thước gốc và tỷ lệ tải khớp trong sai số làm tròn. Admin success HTTP 200 và conflict HTTP 409 thật ở hai viewport; tương phản chữ/nền trắng lần lượt khoảng 7.24:1 và 7.46:1. |
| design-review.json | Finish review độc lập, STAGING, 14 ảnh chụp, disposition SHIP, 0 finding còn lại trong phạm vi bảy chính sách, giá/mua, Admin và tỷ lệ gallery được yêu cầu. productionVerified=false. |
| validation.json | LOCAL access 23 PASS; TypeScript/ESLint/catalog PASS; 359 operations, 251 available; 90 schema locale và offer gồm VAT. test:crm:work có giới hạn baseline: dừng ở retired tasks sau 10 PASS. |

MCP có dùng được không? Có bằng chứng STAGING từ Official MCP SDK/OAuth cho các thao tác trong phạm vi: đọc chính sách/cấu hình, cập nhật mức giảm có retry và đọc yêu cầu website thật do trình duyệt QA tạo. MCP có đọc được dữ liệu này không? Có bằng chứng STAGING cho bảy chính sách, cấu hình hiện hành và ảnh chụp giá của yêu cầu QA. Catalog nguồn chứa GET /api/crm/storefront, POST /api/crm/storefront và GET /api/crm/storefront/policies. Hồ sơ này không tự chạy lại MCP và chưa khẳng định quyền truy cập remote production hiện tại hoặc phiên ChatGPT web đã thực thi thành công. Nội dung chính sách chỉnh qua nguồn phát hành, chưa có workflow sửa nội dung chính sách bằng Admin/MCP.

Các kết quả trên được đọc từ hồ sơ đã lưu, không phải chạy lại cả suite trong lượt document. Không có bằng chứng production cuối trong hồ sơ này. Không bao quát mọi locale/320px, bàn phím hoặc reduced-motion của toàn bộ storefront; những gì ngoài báo cáo vẫn chưa được xác minh. SHIP của finish reviewer độc lập chỉ áp dụng phạm vi đã ghi trong design-review.json; hồ sơ thiết kế không mở rộng verdict đó thành toàn site hoặc production. Không thay root DESIGN.md/sidecar hoặc sửa drift có trước.

Cập nhật sau review: CheckoutForm giữ khóa idempotency đang chờ qua các phản hồi lỗi, gồm HTTP 429; chỉ xóa khi thành công hoặc HTTP 409 PRICE_CHANGED. Thay đổi này không đổi HTML, style, ảnh hoặc hợp đồng đầu vào; 14 ảnh đã review vẫn đại diện cùng giao diện. Bằng chứng transport retry cho chuỗi mất phản hồi sau commit → HTTP 429 → gửi lại đang chờ xác minh riêng; các PASS trước đó không bao hàm kiểm tra mới này.

## Asset provenance

Phần mở rộng không tạo raster để giao diện vận hành. 91 ảnh sản phẩm lấy nguyên byte từ thư mục public đã theo dõi trong Git, được liệt kê đầy đủ trong data/product-image-dimensions.ts; hai logo public cũng tái sử dụng tệp sẵn có. Lượt document đã so sánh từng tệp với HEAD bằng byte và kiểm tra kích thước thực bằng sharp: 93/93 tệp khớp. Không chỉnh pixel, retouch, đổi chữ trên bao bì hoặc bổ sung ảnh sinh. Nguồn đã chứng minh ở đây là repository incumbent; tác giả, ngày chụp và giấy phép ngoài repository không được suy đoán.

Ảnh PNG trong thư mục test-results và .impeccable/review là ảnh chụp QA, không phải raster mới đưa vào trang. Các bản tương ứng được so sánh bằng byte và khớp. Giá trị/phiên bản, tài khoản LOCAL QA và dữ liệu trong ảnh là dữ liệu kiểm thử riêng.

### Incumbent raster inventory

Mọi hàng dưới đây có provenance chung: tệp incumbent trong public, giữ nguyên byte so với Git HEAD tại thời điểm ghi nhận. Đường dẫn bắt đầu bằng /images tương ứng public/images trong repository. Hash SHA-256 là hash byte gốc, không phải ảnh responsive đã tối ưu qua Next.js.

| Asset | Kích thước gốc | SHA-256 |
| --- | --- | --- |
| `/images/products/20261009/cohamy-almond-chocolate-80g/01.jpg` | 1122×1402 | `14662dc587bf5ede235185b9858ecc89b6add0f71c141d860d473216313da1d7` |
| `/images/products/20261009/cohamy-almond-chocolate-80g/02.jpg` | 1122×1402 | `5ff001de94e4dbd6faf9f6193bbf7fba3c6d827dc0ceed83a7e1da1e44ba848a` |
| `/images/products/20261009/cohamy-almond-chocolate-80g/03.jpg` | 1122×1402 | `5e989239e8d03df2ed8d9f204e64c16085980c158cf116c96a75253a2d5837b9` |
| `/images/products/20261009/cohamy-almond-chocolate-80g/04.jpg` | 1122×1402 | `e3607efd6f1cc5c77a9cb9e813f51d14f6ec64f54d6747cc6bdd710a87404f7e` |
| `/images/products/20261009/cohamy-almond-chocolate-80g/05.jpg` | 1122×1402 | `96a7f4bfa768232d5bd69beb88038f05f36d4c69ef22baee694032398b06ffdc` |
| `/images/products/20261009/cohamy-almond-chocolate-80g/06.jpg` | 1122×1402 | `fc32bc26035a256253405931912cf4b4a26c0d8b0d7d2fdc9fee1dbb5ee36eab` |
| `/images/products/20261009/cohamy-almond-chocolate-80g/07.jpg` | 1122×1402 | `77e3105c653f0fc6ec43622bf31b50ff5b463ce37e084a07e4706a92ee3c0a48` |
| `/images/products/20261009/cohamy-almond-chocolate-80g/08.jpg` | 1122×1402 | `d296bc7bb06e55da3786b00f2b5612b9c0bd37895d6ec78941e9ee079ffbb750` |
| `/images/products/20261009/cohamy-almond-chocolate-80g/09.jpg` | 1122×1402 | `5109b22ef6ce2d4adb8b8266ff6c65c5b2706632a91ad9e4ba001254b37d7241` |
| `/images/products/20261009/cohamy-almond-chocolate-80g/label.jpg` | 2560×1811 | `ea457fab3db72d6276a50cc886fb301b12f204cd852ab74cbb0671925ef42726` |
| `/images/products/20261009/cohamy-almond-durian-chocolate-80g/01.jpg` | 1122×1402 | `628fecabef5a4360e8fc598ad699422ba64b9f58d3ad81444da8d2571d86b6a8` |
| `/images/products/20261009/cohamy-almond-durian-chocolate-80g/02.jpg` | 1122×1402 | `e2b7c654ead49f453440f441f42ff818575e895a5c10935599520b8d58c336b1` |
| `/images/products/20261009/cohamy-almond-durian-chocolate-80g/03.jpg` | 1122×1402 | `2b21176a32155d0d19880619e46d864c427afa6104945a300eab7635af615bb7` |
| `/images/products/20261009/cohamy-almond-durian-chocolate-80g/04.jpg` | 1122×1402 | `a4edb208268b0a24622e70b53fc3d7a30adc9a57052bc85bf05592423410f57a` |
| `/images/products/20261009/cohamy-almond-durian-chocolate-80g/05.jpg` | 1122×1402 | `3e45c55904f3bf03b32096e75c10803259caec1dad847881427b930a2bd77917` |
| `/images/products/20261009/cohamy-almond-durian-chocolate-80g/06.jpg` | 1122×1402 | `f0ef51db48fd7e5e55912c151cea7379ef0c8e66c1f217a54b96881735c9af7e` |
| `/images/products/20261009/cohamy-almond-durian-chocolate-80g/07.jpg` | 1122×1402 | `da3809338b354ade0784fcadb57f97a4619f6185f0a10eadd4c6f4def3bdf584` |
| `/images/products/20261009/cohamy-almond-durian-chocolate-80g/08.jpg` | 1122×1402 | `11eb01e2f9c43786fe6e9c2f8f66b06093dda3abc9ac5967953f5addad9524e1` |
| `/images/products/20261009/cohamy-almond-durian-chocolate-80g/09.jpg` | 1122×1402 | `60768b78bce2d3addf57ae8a7f0f301de9110f709bd8dcb8160c91a3de37f0e2` |
| `/images/products/20261009/cohamy-almond-durian-chocolate-80g/10.jpg` | 1122×1402 | `b81d6834cb2be8027d0f8e93259b9c8f07e958fca6d6684d8d4d4d2df7b39efe` |
| `/images/products/20261009/cohamy-almond-durian-chocolate-80g/label.jpg` | 2560×1810 | `e7b9058d3cd6d815cdf499ec959390e91a0cb97c7baffc2a64b51df7ecdc3c36` |
| `/images/products/20261009/cohamy-almond-matcha-chocolate-80g/01.jpg` | 1122×1402 | `369646f8914a0e7053d4152a1eb43cd219efd87c2beec3adecb379983f749fb6` |
| `/images/products/20261009/cohamy-almond-matcha-chocolate-80g/02.jpg` | 1122×1402 | `2ef14b0c98b380db5624526f9c56087a4e6a36e8213108493bc4816c4a0aa81e` |
| `/images/products/20261009/cohamy-almond-matcha-chocolate-80g/03.jpg` | 1122×1402 | `133e296f2625417ff01f84dbc5eba75542a6bac6ffda789d6553ad17557993a8` |
| `/images/products/20261009/cohamy-almond-matcha-chocolate-80g/04.jpg` | 1122×1402 | `c832b2d31cfaf321fd0914b588c6bc63a317a96180a8be44bcaba7ae1ca04339` |
| `/images/products/20261009/cohamy-almond-matcha-chocolate-80g/05.jpg` | 1122×1402 | `8c678d772715974dc90ac71a346f5a20f33204c9ef264cb209e4447aa229fba2` |
| `/images/products/20261009/cohamy-almond-matcha-chocolate-80g/label.jpg` | 2560×1810 | `a2017ae8049ebcc6ffd0cd741183e4ca511eb1df70b24a84a1a911f6c2bd245f` |
| `/images/products/20261009/cohamy-almond-strawberry-chocolate-80g/01.jpg` | 1122×1402 | `b9a63d187487f3434f7558ca80965532553d9bd8793c767b9d6a1378175907c8` |
| `/images/products/20261009/cohamy-almond-strawberry-chocolate-80g/02.jpg` | 1122×1402 | `22dbd31be9a79f5a06a4c2b10aee52bbf6d468de54eefc4f430c56a87874433c` |
| `/images/products/20261009/cohamy-almond-strawberry-chocolate-80g/03.jpg` | 1122×1402 | `0a99c6964e6bd894171c5fd7013805395937eead09cf7acbe680b97cac7428a3` |
| `/images/products/20261009/cohamy-almond-strawberry-chocolate-80g/04.jpg` | 1122×1402 | `ea20d277f93b32d5a19d32155c21634d60233b81f98942f66ecca1986940e535` |
| `/images/products/20261009/cohamy-almond-strawberry-chocolate-80g/05.jpg` | 1122×1402 | `a9b429d2b257540708ea27a2804c87844c9304c44f88e0ba8a28561265f699e2` |
| `/images/products/20261009/cohamy-almond-strawberry-chocolate-80g/06.jpg` | 1122×1402 | `2a6110916408dc499a7415202c32b09d95f10793ce97f4e9743576081d4baa04` |
| `/images/products/20261009/cohamy-almond-strawberry-chocolate-80g/07.jpg` | 1122×1402 | `2f7b87ccf071114b80ecadc433703987c8e0a0274b05a4ff71fd8a94a7d14d9a` |
| `/images/products/20261009/cohamy-almond-strawberry-chocolate-80g/08.jpg` | 1122×1402 | `ccb4bf0952b58e66c4059b51300184bc4aba0d8815b77515784e6ff8b562fa14` |
| `/images/products/20261009/cohamy-almond-strawberry-chocolate-80g/09.jpg` | 1122×1402 | `4ee86e421a619f0c2868e9f0ca7436fbecfba8a1b80769feb6f29eca0d350152` |
| `/images/products/20261009/cohamy-almond-strawberry-chocolate-80g/10.jpg` | 1122×1402 | `790cdf2f2477baa77250268c71226077142f5e93e916348e35723f182abd94ac` |
| `/images/products/20261009/cohamy-almond-strawberry-chocolate-80g/label.jpg` | 2560×1810 | `546dc5bcda96af2a60c05d2a97b7559ad119d977f57e958a1babf7d0fc38e640` |
| `/images/products/20261009/cohamy-cashew-chocolate-80g/01.jpg` | 1448×1086 | `7d48855fd749a537b6841ad1009d02c5491a338fa7ee485c3b10347cd6202819` |
| `/images/products/20261009/cohamy-cashew-chocolate-80g/02.jpg` | 1122×1402 | `294c40175cb4ab7a758a05db145e09346cb50e8514af292d85833cef80ab556a` |
| `/images/products/20261009/cohamy-cashew-chocolate-80g/03.jpg` | 1122×1402 | `e743868cb7ef100d21d1e11adf57b775869ac996c6afec4b248b19beaef70c3f` |
| `/images/products/20261009/cohamy-cashew-chocolate-80g/04.jpg` | 1122×1402 | `8a3613a9bdae8603b26f5c7e4b339f1363f497cb800c8a5a7726862dda48cc0d` |
| `/images/products/20261009/cohamy-cashew-chocolate-80g/05.jpg` | 1122×1402 | `dcce28d814dca093579f1de572ea28467890a97528977db3c9c293d2028a9a67` |
| `/images/products/20261009/cohamy-cashew-chocolate-80g/06.jpg` | 1122×1402 | `c7305287a4ec05db18e732e74806f983adc0a7b4db69fb020bdb57e08a768314` |
| `/images/products/20261009/cohamy-cashew-chocolate-80g/07.jpg` | 1122×1402 | `7385e44be491355af2f47dfa20228cd9a3a3f465a3edb95adbcf0fe8602e1520` |
| `/images/products/20261009/cohamy-cashew-chocolate-80g/08.jpg` | 1122×1402 | `c437e0e2c10a57326122c38625f02a57552821033f9edb0da476f79823eabf91` |
| `/images/products/20261009/cohamy-cashew-chocolate-80g/09.jpg` | 1122×1402 | `c5667cabad808fc7abfd554cc29ae35292cc27dc04449c318ff193808465f352` |
| `/images/products/20261009/cohamy-cashew-chocolate-80g/10.jpg` | 1122×1402 | `b4e3d0379380148961eed23e16273cea2973b2899a35d705f25509f8593b2055` |
| `/images/products/20261009/cohamy-cashew-chocolate-80g/label.jpg` | 2560×1811 | `d3ce233e91901c8260cd56799989a3970708ca3623959ee5703d031e85a4457d` |
| `/images/products/20261009/cohamy-chocolate-candy-65g/01.jpg` | 1122×1402 | `dc114f65728384548b21c9f839e86f72a9bfbc30e10b74c6def0abc7a3266c9b` |
| `/images/products/20261009/cohamy-chocolate-candy-65g/02.jpg` | 1122×1402 | `69857e2a6b34b420615391283f76d5f30b42edc873c71815f1a8815ad3f09e9c` |
| `/images/products/20261009/cohamy-chocolate-candy-65g/03.jpg` | 1122×1402 | `70551b86a80a672f297bde2217e0e59e08295b18223435d1ec2316ca79431e4e` |
| `/images/products/20261009/cohamy-chocolate-candy-65g/04.jpg` | 1122×1402 | `a24f62e0aad0c30420a81577e538a86a662013df09b3642797da06ef52191d93` |
| `/images/products/20261009/cohamy-chocolate-candy-65g/05.jpg` | 1122×1402 | `b6c71eacb65cabec45d589cf7e19a070bcc0c22a799a730d61d3dbfcdc9b24a0` |
| `/images/products/20261009/cohamy-chocolate-candy-65g/06.jpg` | 1122×1402 | `f14575b6002708d2bc40d03b67877ebf0f38236bda930106722065982f2e12fa` |
| `/images/products/20261009/cohamy-chocolate-candy-65g/07.jpg` | 1122×1402 | `1078caef802cf6f0a48f922fd072eeba93c22c447d2a1be34313499f8d0da0df` |
| `/images/products/20261009/cohamy-chocolate-candy-65g/08.jpg` | 1122×1402 | `cf2bb938933aab8c44706d686a0ade1bfef02b6b0555e183dd676a0010a3a1c3` |
| `/images/products/20261009/cohamy-chocolate-candy-65g/09.jpg` | 1122×1402 | `a75c950194eba44ab6b05112f94ae284d5d0bff841fd3cd52fdba6ad9d695b06` |
| `/images/products/20261009/cohamy-chocolate-candy-65g/10.jpg` | 1122×1402 | `3fa42b12244ae6dcff744769135c7949a64d5e4156f3c1b5b431bfac2919dec8` |
| `/images/products/20261009/cohamy-chocolate-candy-65g/label.jpg` | 2560×1811 | `ad6f2fb001aba9c1626f3241c75e033438af360fa643be49ada620244d3968f4` |
| `/images/products/20261009/cohamy-macadamia-chocolate-80g/01.jpg` | 1122×1402 | `484f866569db22f2621412d6c248d1580e071d92ddbd471628d5560de7c6f4ef` |
| `/images/products/20261009/cohamy-macadamia-chocolate-80g/02.jpg` | 1122×1402 | `201c9baa7194fffe95dcfd0f352dde0a59360d6911f7ca764b4e8f7afffada36` |
| `/images/products/20261009/cohamy-macadamia-chocolate-80g/03.jpg` | 1122×1402 | `d1d4e499b5025dae15068d135409703e37ae6cbeba07bb3dba791bcd045fb650` |
| `/images/products/20261009/cohamy-macadamia-chocolate-80g/04.jpg` | 1122×1402 | `f2f5aa0840dd34b22e2ebbe66445b5d65aab55615c9f5b877ad627ab8e1872da` |
| `/images/products/20261009/cohamy-macadamia-chocolate-80g/05.jpg` | 1122×1402 | `df17a388da4409f40ea55867e5c6949b02da6be383d3e44691ecddf577b8f416` |
| `/images/products/20261009/cohamy-macadamia-chocolate-80g/06.jpg` | 1122×1402 | `6ea6931b32c872011bf95a85ec8dbba86b5d66f7c012f1728616e7719ed61091` |
| `/images/products/20261009/cohamy-macadamia-chocolate-80g/07.jpg` | 1122×1402 | `76cb01f7b5ec4896a3b83ab024f3fd07cebcadbcbd0ad49a41fd1c6b6123290e` |
| `/images/products/20261009/cohamy-macadamia-chocolate-80g/08.jpg` | 1122×1402 | `314c426f21a636d7f35dcd62e1c6994a045b9a76538ef41d50e2d4857cdfc6ba` |
| `/images/products/20261009/cohamy-macadamia-chocolate-80g/09.jpg` | 1122×1402 | `6ad94b9b1e2ba60024d7c8186807fddc19e658b2dae4dff9cc98b9f1acab5515` |
| `/images/products/20261009/cohamy-macadamia-chocolate-80g/10.jpg` | 1122×1402 | `28531f16fe4e6b0667756eaf117ec329aa93fa640b0a6ad72a2f3da0d28c2ca0` |
| `/images/products/20261009/cohamy-macadamia-chocolate-80g/label.jpg` | 2560×1811 | `73380f79706931a8d1764b4109a3377684484273a3bf5fd91e21edcb401c2b96` |
| `/images/products/20261009/cohamy-mango-chocolate-80g/01.jpg` | 1122×1402 | `764014b42efd2866cb9e6e9975d67ff0c81a8dff7af9f90d7fbfa2941cdb3454` |
| `/images/products/20261009/cohamy-mango-chocolate-80g/02.jpg` | 1122×1402 | `a5e670a5ad0788f9b91180a063421e9008f1c1c41c157ee70fb1c0f11531a504` |
| `/images/products/20261009/cohamy-mango-chocolate-80g/03.jpg` | 1122×1402 | `b241512bc86e6a32f3ed195affd4d1bd5e9fa9eb68bfe4e4d165e560a1133fa0` |
| `/images/products/20261009/cohamy-mango-chocolate-80g/04.jpg` | 1122×1402 | `2c6f54aee485339803af4ef2852415602676fbf9b434649d24455df30baa5042` |
| `/images/products/20261009/cohamy-mango-chocolate-80g/05.jpg` | 1122×1402 | `de4d96741b4ab1fbb38f5892bb264c51cfee1e7faa4278db2fbf9f877985c833` |
| `/images/products/20261009/cohamy-mango-chocolate-80g/06.jpg` | 1122×1402 | `8a8bc279bc05999bd382c1cfa60639d70b996b0741a836ae7f97f649560608d6` |
| `/images/products/20261009/cohamy-mango-chocolate-80g/07.jpg` | 1122×1402 | `6f8059e30bb1be23a76bd838dce8db96bb8935fdaaca7e5fd76c622936cf5851` |
| `/images/products/20261009/cohamy-mango-chocolate-80g/08.jpg` | 1122×1402 | `a5a10c7f8b33e47827661193d5b530a1e51d5b87fc100d9a33a052d09271c96a` |
| `/images/products/20261009/cohamy-mango-chocolate-80g/09.jpg` | 1122×1402 | `827546acaa08c5b8fd8d3d70de5b0bc88a8e89d34f8952fbf582d8f62bcbca51` |
| `/images/products/20261009/cohamy-mango-chocolate-80g/label.jpg` | 2560×1811 | `15d38ddb84bd1a4a5657ffbf8ecaf4a716c390216b328b6d19f5919f007744fb` |
| `/images/products/cohamy-almond-chocolate-55g.jpg` | 2500×2500 | `0efcb957ba91c4f032560855eb5358f21af8dc9103df212063c3f3e038a86be6` |
| `/images/products/cohamy-almond-durian-chocolate-55g.jpg` | 2500×2500 | `ca3be1ad9d3e3c99ae2a5716fd8acf77652dbd781d5a4210f086b57897c81e29` |
| `/images/products/cohamy-almond-matcha-chocolate-55g.jpg` | 2500×2500 | `77cf114ab512b0e781a57a75dcaeea33ece54a12cb38393817696032ca226b1f` |
| `/images/products/cohamy-almond-milk-chocolate-55g.jpg` | 2500×2500 | `561dbd2603b2c29b45d222643f494f20d4d0a243626dfb16b2a59bde69e6aa9b` |
| `/images/products/cohamy-almond-strawberry-chocolate-55g.jpg` | 2500×2500 | `e70ee6ff0cc1c63145047e3ee1fd5ee5cdeb4e54511432da14369dd9cce4726f` |
| `/images/products/cohamy-cashew-chocolate-55g.jpg` | 2500×2500 | `6b569d9864cb90af59a93cfc85a43c7b7e0278990d03d89057c0a787b96dbb44` |
| `/images/products/cohamy-gift-jar-collection.jpg` | 2560×2548 | `5190ccfa2ca824a172de09b726da3c03e129cf57a95f9f6fd6b5264fd534a47c` |
| `/images/products/jamy-dried-mango-150g.jpg` | 1254×1254 | `b1048e9bd73f2e3951304dedd632ceb5b0bbe4aa1529b3f76b1043dbea2bf9a0` |
| `/images/products/jamy-macadamia-chocolate-160g.jpg` | 1254×1254 | `9a19fc1152e9a38ed4a86ce9fb51d9f501211ce771ece8dd575ffdfbf1aa515f` |
| `/images/products/jamy-mango-dried-chocolate-160g.jpg` | 1254×1254 | `4032303d9cf65638bc8cf5ac8b7fa34d5180183d1920c43e3ba32dc0ce5b2db3` |
| `/images/logo/cohamy-brand-logo.png` | 925×267 | `d43d7a8db466412bd2aa98adcf58a3a543d04c5fe0828d024cf383454ac5db58` |
| `/images/home-cacao/logo.png` | 925×267 | `764cec7b8abd14229628a732fced99014bc230ac8c7ca683616a12854c1f45a9` |

### QA capture inventory

Nguồn: scripts/crm/verify-storefront-browser.mjs và đợt xác minh sửa cuối được ghi trong visual-fixes-staging.json. Tệp tại docs/crm/test-results/storefront/; bản tương ứng tại .impeccable/review/ giống hệt byte.

| Capture | Kích thước | SHA-256 |
| --- | --- | --- |
| `product-desktop.png` | 1440×1000 | `3a138589b8f3b2c0b5ec8c3337cb3f69f66714a505d0bdd1db0eb461d698bb86` |
| `product-mobile.png` | 390×844 | `3332fb347b445bc7d43f97bb0da154d235ec27c553646a1b5fa4c7118d80f703` |
| `product-mobile-full.png` | 390×6869 | `4fee3915274b0e82bc0e7e202b713abdf0ea68a151f12b1271cd8e8fd4ca780c` |
| `footer-desktop.png` | 1440×398 | `a96788f1599c22f182d2942abf0424ff7c026f1d0d829dd03fda6d36923dd0fc` |
| `footer-mobile.png` | 390×810 | `dd30dfaf7b19132e68bd50002e2595bde791b2edacc7604f30ecad3adf68bbc8` |
| `policy-desktop.png` | 1440×3792 | `023bac7fcb22c60500d6956d1b7307c19c6e351e4cd038c520dd240fde9f432a` |
| `policy-mobile.png` | 390×6274 | `5b0122896a64f97cedf92497ce2e1a73386d4bf998e2c379aaae6a26bd52ad80` |
| `checkout-mobile.png` | 390×3200 | `b06d2c2b5d6b39dbd84ec2e303b6e9c66ac7a6b2309787ace75d6b2fffd0a8d4` |
| `admin-success-desktop.png` | 1440×1526 | `1604afe76d34fca738970cd98ef2aaf0a451755a019b187c6364d3696838640d` |
| `admin-error-desktop.png` | 1440×1526 | `36aac36d832fb553a3fa2968ddf071c99dcfc26ef98ab67bf4e0128ec2cee5ff` |
| `admin-success-mobile.png` | 390×1831 | `d5ba1ebae99325f5a248475cdae8a64a106c77e4472959362a8c31ba628f56fe` |
| `admin-error-mobile.png` | 390×1854 | `ef88abc49c79fee9ebb00157e2de7ad1ad0afbf41a40389cadcd5c6a5b5e9910` |

### Source snapshot

Các tệp sau đã được đọc/đối chiếu trong lượt ghi hồ sơ; hash giúp phân biệt bằng chứng này với lần sửa nguồn sau. Các tệp thiết kế toàn cục được đọc theo phạm vi của chúng và không được ghi lại.

| Source | SHA-256 |
| --- | --- |
| `components/Footer.tsx` | `afff535674e8a19d887c1e912806deed03e39921e0978bd611a17f6eeb7d2c11` |
| `components/FooterPolicies.tsx` | `27bdfa7a4be597221ba5d4d7d93af70285168b23e21db333e1e62f2c90e4f5c1` |
| `components/ProductPrice.tsx` | `0df9af7bee47f90e1036906ecf9a73fe3be7229b77fa575a1e64d9a7697ce53c` |
| `components/ProductPurchase.tsx` | `38ca0046a4c70544a0fccd95cf143a4e9f77ed40e050019c985e9a3abf250271` |
| `components/ProductGallery.tsx` | `683c7cd88ef4d36970573cbe3ca621b5bfc50847acb0783bebb8c3d182e28366` |
| `components/ProductDetailView.tsx` | `de53fbbf5ec2e992ab5fc13cc1aa8d3f82bdc1abd45507bab7f3a9d88293cdc5` |
| `components/CartView.tsx` | `95f3ba3ae1b8d30f585b32b8098a5a118ad25a7640ffebb676bbda2da4b6281f` |
| `components/CheckoutForm.tsx` | `d77e0eafc32060d132465a02d8b566d8a0525d38a8029bed9b80c21e9c853beb` |
| `components/StorefrontProvider.tsx` | `4461de86f10cba5bc8ef33e13e7b9dd6d1bfbf654e5d53b25884111ff46f889f` |
| `components/crm/StorefrontSettings.tsx` | `59ed90ae557f0f1c0462f0222b2eeb12166d5a366bbfa67788cea885be7bee9f` |
| `components/crm/storefront-settings.css` | `d98e22a677f4a67c67d7c4d065975aaac8d7484316083445008aa9ccd994480c` |
| `components/store-policies.css` | `aac9b197bcf3405f9b8600b77240a8b6717789a7fe16a30c9f13095109d0f561` |
| `app/[locale]/policies/[slug]/page.tsx` | `52cdc2ddda3f5a4e46a14b72cd5265ed0a0ba94c223d59025e8d05ea2c14fc34` |
| `data/product-image-dimensions.ts` | `c89c254132ac88727dc3cd96504d13bd3dbd95ce97ad39de3899169809625ea8` |
| `scripts/generate-product-image-dimensions.ts` | `2a4d214525d8ef655f011689f7837fa33a56ff5cba6a020a1f298cb23b8f5e8e` |
| `components/ProductCard.tsx` | `df8ad19cb77f129bd619a3e44bbd88e2385e718ace715f5031d8c58c72ddc95a` |
| `components/home/CacaoHome.tsx` | `d122eb152d7732376e5fb60aed8987a5382174dbbde754e1a29768e0a3ecc008` |
| `app/globals.css` | `654051d143f89235a1843a608ddad0869b71b4452961a2a07dd5c5ccce10464c` |
| `app/[locale]/layout.tsx` | `4e61c129553f59a61027b47127a8866b3e6f15ea336744e4aad76e1ddfbcc942` |
| `components/crm/work.css` | `205a6f8e3082103a12b9f148610dbcbd39c6bf5c16c877e72699c5829e184c48` |
| `components/crm/crm-humanbank.css` | `da2bea3b4b2e9aeed82659c6a230febbc9a5df92f37840392fe9ded31303c232` |

Kiểm thử transport bổ sung đã PASS 4 nhóm: lần đầu lưu thật nhưng mất phản hồi, lần sau nhận 429 trước dịch vụ, lần thứ ba trả cùng biên nhận. Cả ba lần giữ cùng key/payload và Admin xác nhận đúng một yêu cầu. Bằng chứng: `client-retry-staging.json`. Không đổi giao diện đã được review.
