# Kế hoạch CRM Cohamy: chuyển giao diện CRM HumanBank

Ngày lập: 18/09/2026. Trạng thái: kế hoạch, chưa triển khai CRM trong phiên lập tài liệu.

## 1. Quyết định đã chốt và phạm vi

- Website đích: `C:\Users\ACER\OneDrive\Desktop\cohamy-website-main`.
- Nguồn giao diện: CRM trong `C:\Users\ACER\OneDrive\Desktop\EDUHMB\humanbank-edu`.
- Giữ giao diện CRM HumanBank; thay thương hiệu, menu, route và nghiệp vụ cho Cohamy. Không thiết kế một dashboard mới.
- Có cả mua đứt và ký gửi. Một đại lý có thể tham gia cả hai.
- Kho thuộc tổ chức/đại lý; người dùng có quyền làm việc với kho, không tạo kho riêng cho từng tài khoản.
- Mục tiêu đợt đầu: bản chạy thử một kho trung tâm và nhóm đại lý nhỏ, có đủ luồng giao dịch chính. Con số nhóm thí điểm do vận hành chọn.
- Việc tạo hai tài liệu không bao gồm sửa code ứng dụng, triển khai hoặc chuyển dữ liệu.

## 2. Hiện trạng đã kiểm tra trên source local

| Thành phần | Bằng chứng | Hệ quả triển khai |
|---|---|---|
| Website Next.js 16.2.12, React 19 | `package.json` | Đọc tài liệu Next.js được cài trong dự án trước khi sửa |
| Danh mục 10 sản phẩm, 5 locale | `data/products.ts`, `lib/types.ts` | Nhập danh mục có ánh xạ ID/slug/bản dịch, giữ URL sản phẩm |
| Giỏ hàng lưu tại trình duyệt | `store/cart.ts` | Chưa phải nguồn dữ liệu đơn hoặc kho |
| Checkout chỉ xóa giỏ và báo thành công | `components/CheckoutForm.tsx` | Cần API tạo đơn và xử lý thành công/thất bại thật |
| Liên hệ gửi sang Sheets | `app/api/contact/route.ts` | Lập phương án chuyển tiếp vào CRM, tránh ghi trùng/mất yêu cầu |
| CMS có các chế độ nguồn nội dung | `lib/blog-source.ts`, `lib/admin-auth.ts` | Giữ CMS độc lập với CRM; không gộp tài khoản bằng cách đổi tên admin |
| HumanBank có shell/launcher, hạt nền, menu và phân quyền navigation | `apps/web/app/components/portal-shell.tsx`, `portal/dashboard/page.tsx`, `lib/portal-navigation.ts` | Có nguồn giao diện cụ thể để chuyển |
| HumanBank dùng NestJS và PostgreSQL/Prisma | `apps/api/package.json`, `packages/database/prisma/schema.prisma` | Có thể tái sử dụng nền sau khi phân tích phụ thuộc |

Chưa kiểm tra website production hoặc chụp giao diện HumanBank đang chạy trong phiên lập kế hoạch. Tài liệu không khẳng định các luồng CRM đã tồn tại hay đã PASS.

## 3. Hợp đồng giao diện

| Màn hình/thành phần | Giữ từ HumanBank | Điều chỉnh cho Cohamy |
|---|---|---|
| Đăng nhập | Bố cục, form, nền, hiệu ứng, kiểu chữ | Logo, tên, nội dung và API đăng nhập |
| Trang chủ CRM | Nền navy, mạng hạt, lưới ô màu lớn, cách hover/focus | Module bán hàng/kho/công nợ, thứ tự theo vai trò |
| Header và tài khoản | Vị trí, kích thước, menu, avatar | Người dùng/đơn vị/quyền Cohamy |
| Điều hướng dưới | Hình thức nổi, active state, responsive | Các mục được phép và route Cohamy |
| Danh sách nghiệp vụ | Nền sáng, tiêu đề, bộ lọc, bảng, phân trang | Dữ liệu, cột, bộ lọc nghiệp vụ |
| Chi tiết và biểu mẫu | Cấu trúc form, nhóm trường, nút và thông báo | Trường dữ liệu, trạng thái, quy trình phê duyệt |

Thư viện icon, font và asset chỉ chuyển phần cần dùng, kèm giấy phép phù hợp. Kiểm tra CSS ghi đè trong các file import từ layout HumanBank; không mặc định riêng `legacy-crm.css` mô tả toàn bộ giao diện cuối.

Các thay đổi bắt buộc để sửa lỗi truy cập, tràn màn hình hoặc đảm bảo accessibility phải nhỏ và được ghi trong đối chiếu. Không dùng sửa lỗi làm lý do đổi phong cách.

## 4. Menu đích dự kiến

Quản trị Cohamy: Khách hàng · Đại lý · Hàng hóa · Đơn hàng · Kho hàng · Ký gửi · Công nợ · Thu chi · Báo cáo · Tài khoản và quyền.

Cổng đại lý: Đặt hàng · Đơn của tôi · Kho của đại lý · Báo bán ký gửi · Đối soát · Công nợ · Chứng từ thanh toán · Tài khoản.

Mỗi vai trò chỉ thấy mục phù hợp. Dùng cùng khung giao diện HumanBank cho cả hai khu vực. Việc chọn vai trò để xem thử không phải cơ chế phân quyền production.

## 5. Các phase và điều kiện chuyển tiếp

### Phase 0 — Khảo sát và khóa hợp đồng dữ liệu/giao diện

Việc cần làm:

- Đọc hướng dẫn repo và tài liệu Next.js local; ghi lại trạng thái source, lệnh chạy và kết quả kiểm tra ban đầu.
- Khảo sát layout, CSS, fonts, icon, auth, navigation và một màn nghiệp vụ mẫu của HumanBank.
- Chụp HumanBank tại desktop 1366×768, mobile 390×844 và kiểm tra thêm chiều rộng 320px.
- Tạo bản đồ thành phần nguồn → đích; lập ma trận vai trò/quyền và sơ đồ trạng thái chứng từ.
- Chọn cấu trúc backend/workspace dựa trên phụ thuộc, tránh đưa cả monorepo HumanBank vào Cohamy.
- Chốt các quyết định nghiệp vụ ở mục 9 trước khi viết luồng ghi sổ liên quan.

Đầu ra: báo cáo khảo sát, ảnh nguồn, bảng ánh xạ, schema dự kiến, phạm vi MVP và rủi ro.

Gate: xác định được nguồn giao diện cụ thể; không còn mơ hồ về mua đứt/ký gửi, chủ sở hữu và thời điểm phát sinh nợ trong các luồng sắp triển khai.

### Phase 1 — Chuyển giao diện HumanBank và nền truy cập

Việc cần làm:

- Chuyển shell, đăng nhập, launcher, hiệu ứng hạt, navigation dưới và mẫu danh sách/chi tiết.
- Thay thương hiệu Cohamy; cô lập CSS; nối route `/crm` và `/portal` không xung đột i18n/CMS.
- Chuyển phần auth phù hợp, thêm tổ chức, membership, vai trò và quyền server.
- Menu phản ánh quyền thật; tài khoản khóa/hết phiên bị chặn đúng.
- Tách màn xem trước khỏi nghiệp vụ chưa kết nối; không giả người dùng đăng nhập hoặc số liệu.

Đầu ra: khung CRM nhận diện đúng HumanBank, đăng nhập hoạt động, truy cập theo vai trò và ảnh đối chiếu.

Gate: đúng giao diện trên desktop/mobile; người chưa đăng nhập không truy cập dữ liệu nội bộ; kiểm thử đại lý A/B không lộ dữ liệu; website công khai và CMS không bị đổi style hoặc route.

### Phase 2 — Danh mục, đại lý và sổ kho

Việc cần làm:

- Sản phẩm/SKU, quy cách, quy đổi đơn vị, kho, vị trí, lô, hạn dùng, chủ sở hữu.
- Khách hàng/đại lý, sales phụ trách, chính sách giá và điều khoản theo phiên bản.
- Chứng từ nhập kho, chuyển kho, xuất giao, nhận hàng, điều chỉnh và kiểm kê; hàng đang vận chuyển riêng.
- Sổ biến động và số dư kho; khả dụng trừ lượng giữ; lô hết hạn/hỏng không được xuất bán.
- Import tồn đầu kỳ có kiểm tra, preview, chống trùng, phê duyệt và đối chiếu.

Đầu ra: tồn kho được tính từ chứng từ; danh mục website được ánh xạ an toàn.

Gate: bảo toàn số lượng qua chuyển/giao/nhận; đúng đơn vị và chủ sở hữu; không ghi trùng khi retry; kiểm kê có dấu vết.

### Phase 3 — Đơn mua đứt và khoản phải thu

Việc cần làm:

- Website và đại lý tạo đơn thật; server tính giá theo chính sách.
- Duyệt, giữ hàng, giao từng phần, xác nhận nhận, hủy, trả hàng và giải phóng giữ hàng.
- Ghi phải thu tại mốc đã thống nhất; thu tiền từng phần; ứng trước và phân bổ thanh toán.
- Giới hạn tín dụng có tính phần cam kết liên quan theo chính sách; duyệt ngoại lệ có lịch sử.
- Refresh/restart vẫn truy xuất đơn, tồn và nợ đã lưu.

Đầu ra: một luồng bán đứt hoàn chỉnh từ đặt hàng đến đối chiếu dư nợ.

Gate: hai đơn đồng thời không bán quá tồn; double-click không tạo trùng; lỗi server không xóa giỏ/báo thành công; số dư khớp chứng từ sau trả hàng và thu tiền.

### Phase 4 — Ký gửi và đối soát

Việc cần làm:

- Giao ký gửi và nhận thực tế, giữ chủ sở hữu Cohamy.
- Đại lý báo bán từng phần/theo kỳ; Cohamy duyệt; ghi phải thu duy nhất cho phần đã chốt.
- Trả hàng chưa bán; xử lý hỏng/mất; chuyển ký gửi sang mua đứt với chứng từ riêng.
- Khóa kỳ đã chốt; điều chỉnh bằng chứng từ nối với kỳ cũ.
- Theo dõi tuổi tồn/lô/hạn dùng tại điểm ký gửi; phân biệt tiền phải thanh toán và giá trị hàng đang giữ.

Đầu ra: mua đứt và ký gửi cùng hoạt động trên một hồ sơ đại lý nhưng không nhập nhằng sổ hàng/nợ.

Gate: giao 100, báo bán 30 thì còn 70 ký gửi; chỉ phần bán được duyệt phát sinh phải thu theo thỏa thuận; gửi lại không cộng nợ lần hai; bán quá tồn bị chặn.

### Phase 5 — Nhà cung cấp, báo cáo và vận hành

Việc cần làm:

- Nhà cung cấp, chứng từ mua/nhập, phải trả và chi tiền cơ bản; tách thời điểm nhập hàng, ghi phải trả và chi tiền theo quy trình được chốt.
- Báo cáo nhập xuất tồn theo kho/chủ sở hữu/lô; bảng phải thu/phải trả theo hạn; báo cáo ký gửi và tiền thu/chi.
- Export có đúng phạm vi quyền; tránh lộ dữ liệu đại lý qua báo cáo tổng hợp.
- Audit người thao tác và các sự kiện nhạy cảm; cấu hình backup, restore và theo dõi lỗi.
- Không đưa báo cáo lợi nhuận vào MVP nếu chưa chốt cách tính giá vốn và dữ liệu chi phí.

Đầu ra: bộ báo cáo vận hành đối chiếu được, dữ liệu đầu kỳ đã duyệt và hướng dẫn theo vai trò.

Gate: báo cáo khớp chứng từ; restore được bản backup; không có số tổng khác nhau do đếm trùng hàng đang giao/ký gửi.

### Phase 6 — Nghiệm thu và chạy thử

- Chạy ma trận kiểm thử ở mục 8, kiểm tra hồi quy website/CMS và đối chiếu hình ảnh.
- Cho nhóm đại lý thí điểm thực hiện các tình huống đã chuẩn bị ở môi trường được cho phép.
- Ghi nhận lỗi, sửa và kiểm tra lại phần bị ảnh hưởng.
- Bàn giao tài liệu, giới hạn, dữ liệu đầu kỳ đối chiếu và cách xử lý sự cố.
- Production chỉ được đánh dấu sẵn sàng khi các gate bắt buộc qua; không lấy build thành công thay thế nghiệm thu.

## 6. Lịch mục tiêu 10 ngày

Ước lượng này giả định có ít nhất hai người triển khai có kinh nghiệm, người nghiệp vụ phản hồi trong ngày, hạ tầng sẵn sàng và dữ liệu đầu kỳ được chuẩn bị sớm. Chưa phải cam kết thời gian; khảo sát phase 0 có thể làm thay đổi lịch. Nếu chỉ có một người hoặc nguồn tái sử dụng khó tách, cần tăng thời gian hoặc giảm số nghiệp vụ trong đợt thí điểm.

| Ngày | Trọng tâm | Kết quả có thể kiểm tra |
|---|---|---|
| 1 | Khảo sát, chụp giao diện nguồn, chốt chính sách | Bản đồ nguồn → đích, schema/state machine và phạm vi |
| 2 | Chuyển shell, login và phân quyền nền | Giao diện HumanBank mang thương hiệu Cohamy; truy cập đúng quyền |
| 3 | Sản phẩm, đại lý, kho, lô, đơn vị, giá | CRUD và kiểm tra phạm vi dữ liệu |
| 4 | Nhập/chuyển/xuất/nhận, sổ kho | Đối chiếu tồn và các thử nghiệm retry/đồng thời |
| 5 | Đặt hàng website và mua đứt | Đơn thật, giá server, giữ/xuất/giao nhận |
| 6 | Phải thu, thu tiền, hạn mức, hủy/trả | Đối chiếu đơn–kho–tiền–nợ |
| 7 | Giao ký gửi và báo bán | Tách chủ sở hữu, tồn tại điểm ký gửi |
| 8 | Đối soát ký gửi, phải trả cơ bản, báo cáo | Hai cơ chế trên cùng đại lý; tổng báo cáo khớp |
| 9 | Import đầu kỳ, backup/restore, E2E và hồi quy | Bằng chứng kiểm thử, số dư đã đối chiếu |
| 10 | Sửa lỗi trọng yếu, nghiệm thu, hướng dẫn | Bản chạy thử có giới hạn và hồ sơ bàn giao |

Nếu cuối ngày 4 sổ kho chưa bảo toàn số lượng hoặc cuối ngày 8 công nợ chưa đối chiếu được, lùi chạy thử với dữ liệu thật. Không bỏ gate để giữ lịch.

## 7. Phạm vi để sau đợt đầu

- Kết nối ngân hàng tự động, cổng thanh toán, vận chuyển và hóa đơn điện tử.
- CRM marketing tự động, tin nhắn/Zalo/email, hoa hồng nhiều tầng.
- App native, chế độ offline, POS của đại lý và đồng bộ hệ thống ngoài.
- Quản lý sản xuất, định mức nguyên liệu, kế hoạch mua hàng và giá vốn nâng cao.
- Hợp nhất báo cáo nhiều pháp nhân, ngoại tệ hoặc mô hình phân phối nhiều cấp.

Không trì hoãn các kiểm soát nền: phân quyền, chủ sở hữu hàng, lô/hạn dùng, chống trùng, kiểm soát đồng thời, audit và backup.

## 8. Ma trận nghiệm thu tối thiểu

| Nhóm | Tình huống | Kết quả bắt buộc |
|---|---|---|
| Giao diện | So sánh HumanBank/Cohamy cùng viewport | Giữ shell, launcher, header, bottom nav, mẫu nghiệp vụ; khác biệt có giải thích |
| Responsive | 1366×768, 390×844 và 320px | Không tràn trang; bảng cuộn trong vùng; nút và nội dung không bị nav che |
| Accessibility | Bàn phím, focus, reduced motion | Điều khiển dùng được; chuyển động tôn trọng thiết lập hệ thống |
| Quyền | A sửa ID/URL/API/export sang B | Server từ chối; không rò dữ liệu |
| Vai trò | Đại lý tự xác nhận tiền/nâng hạn mức | Server từ chối |
| Đơn | Bấm đặt hai lần, retry sau timeout | Cùng một yêu cầu không sinh hai đơn |
| Giá | Trình duyệt sửa giá hoặc chiết khấu | Server dùng chính sách hợp lệ |
| Tồn | Hai đơn tranh lượng cuối | Không âm tồn, không giữ hàng quá lượng khả dụng |
| Giao nhận | Giao/nhận một phần, nhận lại cùng phiếu | Hàng đang giao và đã nhận đúng; không cộng hai lần |
| Lô | Khác chủ sở hữu, lô hết hạn, hàng hỏng | Không trộn hoặc xuất nhầm |
| Mua đứt | Đơn ví dụ 6 triệu, thu 2 triệu | Dư phải thu 4 triệu khi đơn đủ điều kiện ghi nợ |
| Ký gửi | Giao 100, bán 30, giá đối soát 60.000 | Còn 70; phải thu 1,8 triệu sau chốt, trước thanh toán |
| Hai cơ chế | Một đại lý có mua đứt và ký gửi | Hai loại tồn/nghĩa vụ tách rõ; báo cáo không cộng trùng |
| Công nợ | Ứng trước, phân bổ nhiều khoản, thu lại cùng yêu cầu | Không phân bổ quá tiền/nợ và không nhân đôi phiếu |
| Điều chỉnh | Hủy, trả hàng, đảo phiếu đã xác nhận | Kho và nợ khớp; giữ lịch sử chứng từ |
| Phải trả | Nhập/mua, ứng trước, trả tiền nhà cung cấp | Dư phải trả khớp chứng từ; không tự bù phải thu |
| Import | Chạy lại cùng file đầu kỳ | Báo trùng hoặc xử lý có kiểm soát; không nhân đôi tồn/nợ |
| Bền dữ liệu | Restart và restore backup | Dữ liệu/chứng từ còn nguyên và đối chiếu được |
| Hồi quy | Sản phẩm, giỏ, contact, blog, CMS, locale | Không hỏng route/style/SEO hoặc chức năng đang có |

Các số tiền/số lượng trong ma trận là dữ liệu kiểm thử tự tạo, không phải dữ liệu kinh doanh Cohamy.

## 9. Quyết định nghiệp vụ còn cần chốt trước khi chạy thật

Không phải điều kiện để tạo kế hoạch hoặc bắt đầu chuyển giao diện. Người triển khai phải lấy câu trả lời trước khi hoàn thiện các luồng ghi sổ tương ứng:

1. Mua đứt: mốc chuyển quyền sở hữu và mốc ghi phải thu; có yêu cầu đặt cọc hay trả trước không?
2. Ký gửi: giá thanh toán cố định hay doanh thu trừ hoa hồng; chu kỳ báo bán/đối soát; xử lý mất/hỏng/cận hạn?
3. Cách ưu tiên bảng giá, chiết khấu, đơn tối thiểu, hạn mức, kỳ hạn và người duyệt ngoại lệ?
4. Số kho thực, vai trò người dùng, đơn vị quy đổi, danh mục lô/hạn dùng và dữ liệu đầu kỳ được ai xác nhận?
5. Đại lý ghi xuất bán hàng mua đứt trong hệ thống hay chỉ theo dõi hàng nhập? Nếu không ghi, báo cáo phải nêu giới hạn về độ cập nhật tồn.
6. Quy trình nhà cung cấp, mốc ghi phải trả, và hệ thống kế toán hiện có cần đối chiếu?

## 10. Hồ sơ bàn giao

- Source Cohamy đã tích hợp; manifest nguồn giao diện HumanBank và thay đổi tương ứng.
- Schema, migration, sơ đồ trạng thái và ma trận quyền.
- Hướng dẫn chạy local/staging, biến môi trường mẫu không có secret và quy trình deploy/rollback.
- Import đầu kỳ có preview, log và biên bản đối chiếu; bộ dữ liệu kiểm thử riêng.
- Ảnh đối chiếu HumanBank/Cohamy, kết quả lint/typecheck/build và kiểm thử nghiệp vụ.
- Hướng dẫn cho quản lý, sales, thủ kho, kế toán và đại lý.
- Báo cáo `PASS/FAIL/BLOCKED/NOT RUN` theo môi trường; lỗi còn lại, giới hạn và danh sách giai đoạn sau.

Tham chiếu nghiên cứu cho người triển khai: [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html), [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [nguyên tắc tách vị trí và sở hữu hàng ký gửi](https://www.odoo.com/documentation/master/applications/inventory_and_mrp/inventory/shipping_receiving/daily_operations/owned_stock.html). Đây là tài liệu nền, không phải bằng chứng Cohamy đã có các cơ chế đó.
