# Prompt triển khai CRM Cohamy từ giao diện CRM HumanBank

Tài liệu giao việc để dùng ở một phiên triển khai riêng. Việc tạo tài liệu này không có nghĩa là CRM đã được xây dựng hoặc đã chạy thật.

Sử dụng cùng `docs/CRM-COHAMY-IMPLEMENTATION-PLAN.md`. Phần bên dưới có thể sao chép làm prompt triển khai.

---

Bạn là kỹ sư phụ trách triển khai CRM Cohamy trên website hiện có. Hãy khảo sát source, lập bản đồ tái sử dụng, sau đó triển khai lần lượt các phase trong kế hoạch, sửa trực tiếp source và kiểm chứng kết quả. Không dừng ở tư vấn, dựng khung hoặc dữ liệu giả rồi báo hoàn thành.

## 1. Bối cảnh và yêu cầu đã chốt

- Website đích: `C:\Users\ACER\OneDrive\Desktop\cohamy-website-main`.
- Source HumanBank tham chiếu: `C:\Users\ACER\OneDrive\Desktop\EDUHMB\humanbank-edu`.
- Cohamy kinh doanh các sản phẩm thực phẩm đóng gói; website hiện có danh mục sản phẩm, giỏ hàng, giao diện checkout và nội dung đa ngôn ngữ.
- CRM cần quản lý khách hàng, đại lý, hàng hóa, đơn hàng, kho, ký gửi, công nợ, thu chi và báo cáo.
- Đại lý có CẢ HAI cơ chế: mua đứt, có thể trả chậm; và nhận ký gửi.
- Một đại lý có thể sử dụng cả hai cơ chế trong các giao dịch khác nhau.
- Người dùng yêu cầu BÊ GIAO DIỆN CRM HUMANBANK SANG COHAMY. Đây là ràng buộc thiết kế bắt buộc.
- Mốc 10 ngày là mục tiêu cho bản chạy thử có giới hạn; không được lấy mốc này làm lý do bỏ kiểm soát dữ liệu hoặc gọi bản chưa đủ điều kiện là production-ready.

## 2. Giao diện: chuyển từ HumanBank, không thiết kế lại

Nguyên tắc: HumanBank quyết định hình thức; nghiệp vụ Cohamy quyết định nội dung, đường dẫn, dữ liệu và quyền.

Giữ nhận diện giao diện CRM HumanBank:

1. Trang chủ dạng launcher với nền midnight/navy, hiệu ứng mạng hạt và các ô chức năng lớn đa màu, bo góc.
2. Header, khu vực thương hiệu, menu tài khoản, vị trí điều khiển và thanh điều hướng nổi phía dưới.
3. Bố cục, nhịp khoảng cách, kiểu chữ, kích thước icon, màu từng nhóm chức năng và trạng thái tương tác theo source tham chiếu.
4. Màn hình nghiệp vụ dùng giao diện sáng, bảng, bộ lọc, nút, biểu mẫu, trang chi tiết và thông báo theo đúng các màn tương ứng của HumanBank.
5. Trang đăng nhập và cách thích ứng trên điện thoại cũng lấy từ CRM HumanBank.

Được thay: logo và tên thành Cohamy; nhãn module; icon theo nghĩa nghiệp vụ nhưng giữ thư viện/phong cách; nội dung biểu mẫu, cột bảng, trạng thái, route và điều kiện hiển thị theo quyền.

Không tự đổi CRM sang bảng điều khiển có sidebar, dãy KPI lớn, phong cách SaaS mới, hoặc bảng màu nâu-vàng của website bán hàng. Website công khai giữ giao diện hiện có. Không áp dụng một skill thiết kế để làm lệch hình mẫu đã được người dùng chọn.

Không nhập toàn bộ CSS HumanBank vào global CSS của website. Chuyển đúng các thành phần cần dùng, cô lập style dưới layout CRM để không tác động website công khai và CMS.

### Source phải khảo sát trước khi chuyển

Các đường dẫn dưới đây tính từ thư mục HumanBank:

- `apps/web/app/components/portal-shell.tsx`
- `apps/web/app/portal/layout.tsx`
- `apps/web/app/portal/dashboard/page.tsx`
- `apps/web/app/components/particle-network.tsx`
- `apps/web/app/components/portal-module-icon.tsx`
- `apps/web/app/lib/portal-modules.ts`
- `apps/web/app/lib/portal-navigation.ts`
- `apps/web/app/dang-nhap/page.tsx`
- `apps/web/app/components/login-form.tsx`
- `apps/web/app/legacy-crm.css`
- `apps/web/app/layout.tsx` và các stylesheet liên quan để xác định thứ tự ghi đè CSS.
- Các màn danh sách, chi tiết, tài chính và biểu mẫu thực tế được chọn làm mẫu.

Không chỉ lấy đoạn CSS đầu tiên: phải xem style sau cùng đang có hiệu lực. Các giá trị như nền `#0f172a`, ô 180px, lưới 5 cột và thanh điều hướng nổi là mốc tham chiếu từ source đã khảo sát; đối chiếu lại bản hiện tại trước khi chuyển.

Chụp giao diện HumanBank và Cohamy ở cùng viewport để so sánh. Nếu không truy cập được phiên HumanBank, dùng bản local hoặc render thành phần bằng dữ liệu kiểm thử có nhãn; ghi rõ giới hạn bằng chứng. Không nhận là giống hoàn toàn khi chưa đối chiếu hình ảnh.

## 3. Phạm vi tái sử dụng code

- Khảo sát và tái sử dụng phần phù hợp của giao diện, xác thực, quản lý người dùng, phân quyền, nhật ký và công cụ vận hành HumanBank.
- Rà soát phụ thuộc trước khi tách; không sao chép mù quáng cả hệ thống giáo dục.
- Không mang sang dữ liệu học viên, người dùng, mật khẩu, khóa bí mật, cấu hình production hoặc nghiệp vụ lớp học, học phí, giáo viên.
- Không chỉnh sửa hoặc triển khai vào dự án HumanBank. Source đó là nguồn tham chiếu chỉ đọc cho công việc này.
- Kho, ký gửi, chính sách thương mại và công nợ phải có mô hình riêng cho Cohamy. Không đổi tên bảng giáo dục để giả thành bảng hàng hóa.

## 4. Kiến trúc phù hợp với website hiện có

Đích đề xuất:

- Website công khai tiếp tục chạy Next.js và giữ URL, SEO, nội dung đa ngôn ngữ.
- `/crm`: nhân sự nội bộ Cohamy.
- `/portal`: chủ đại lý và nhân viên đại lý.
- Hai khu vực sử dụng chung ngôn ngữ giao diện HumanBank, khác menu và dữ liệu theo quyền.
- Backend nghiệp vụ riêng theo các phân hệ trong một ứng dụng; PostgreSQL là nguồn chính cho đơn, kho và công nợ. Ưu tiên tái sử dụng nền NestJS/Prisma HumanBank nếu khảo sát chứng minh phù hợp.
- Chọn một cấu trúc workspace và một package manager nhất quán sau khi khảo sát; không phá cấu trúc Next.js đang chạy hoặc tạo backend trùng nhau.
- CMS nội dung hiện có tiếp tục phục vụ bài viết/trang. Google Sheets không làm sổ tồn kho hoặc sổ công nợ chính.
- Danh mục thương mại có ID/SKU ổn định; ánh xạ sản phẩm, slug, hình và bản dịch hiện có trước khi đổi nguồn dữ liệu website.
- Giá giao dịch và quyền xem giá được tính ở server. Không tin giá, vai trò, đại lý hoặc kho gửi từ trình duyệt.
- CRM và portal phải có xác thực, kiểm tra quyền server và cấu hình không lập chỉ mục. `noindex` không thay thế xác thực.

Trước khi viết code Next.js, đọc `AGENTS.md` và tài liệu tương ứng trong `node_modules/next/dist/docs/`. Xác minh route/proxy/i18n để `/crm`, `/portal` và các API mới không bị chuyển nhầm sang route ngôn ngữ hay CMS.

## 5. Tài khoản, đại lý và chính sách

- Kho gắn với tổ chức/đại lý; tài khoản được cấp quyền vào kho. Một đại lý có thể có nhiều tài khoản và nhiều kho.
- Vai trò tối thiểu: quản trị, quản lý, sales, thủ kho, kế toán, chủ đại lý, nhân viên đại lý.
- Phạm vi dữ liệu: toàn hệ thống, đối tác được giao, kho được giao hoặc tổ chức của chính người dùng.
- Đại lý A không được đọc/sửa dữ liệu đại lý B qua giao diện, API, ID đoán được, export hay liên kết chứng từ.
- Chính sách gồm bảng giá, chiết khấu, số lượng tối thiểu, hạn mức nợ, kỳ hạn, cơ chế mua đứt/ký gửi và điều kiện trả hàng.
- Áp dụng chính sách mặc định theo nhóm, ngoại lệ theo đại lý có ngày hiệu lực và người phê duyệt. Lưu bản chụp giá/chính sách khi chốt đơn.
- Với MVP, mỗi chứng từ có một cơ chế giao dịch rõ ràng; nếu cần cả hai thì tách chứng từ. Không khóa vĩnh viễn một đại lý vào một cơ chế.

## 6. Nghiệp vụ bắt buộc

### Khách hàng và đại lý

Hồ sơ, đầu mối liên hệ, sales phụ trách, nguồn khách, trạng thái chăm sóc, lịch sử trao đổi, việc cần làm và lịch sử giao dịch. Liên hệ/đăng ký từ website đi vào danh sách xử lý có chống trùng; không tự gửi tin ra bên ngoài.

### Hàng hóa và kho

- SKU, biến thể/quy cách, đơn vị cơ sở và quy đổi gói/hũ/thùng; mã vạch nếu đã có dữ liệu.
- Theo dõi kho/vị trí, chủ sở hữu, lô, hạn sử dụng, trạng thái khả dụng/cách ly/hỏng và hàng đang vận chuyển.
- Nhập, xuất, chuyển kho, giao nhận, kiểm kê, điều chỉnh và trả hàng qua chứng từ.
- Tách số lượng tồn thực tế, đã giữ cho đơn và khả dụng. Không âm tồn mặc định.
- Ưu tiên lô hết hạn trước; cảnh báo cận hạn và chặn xuất bán lô hết hạn.
- Tồn thuộc Cohamy gồm hàng ở kho mình và hàng ký gửi còn thuộc Cohamy; loại hàng đã bán đứt ra khỏi tổng này.
- Chỉ tăng tồn kho nhận theo số lượng thực nhận đã xác nhận. Đơn đặt hoặc yêu cầu nhập hàng không tự tăng tồn.
- Tồn đại lý mua đứt chỉ phản ánh đầy đủ khi đại lý ghi nhận xuất bán/kiểm kê hoặc có tích hợp dữ liệu. Thể hiện lần cập nhật; không suy diễn tồn thực tế từ số đã giao.

### Đơn mua đứt

Đặt hàng → chờ duyệt → kiểm tra giá/hạn mức/tồn → giữ hàng → xuất giao → xác nhận nhận → thanh toán/hoàn tất. Hỗ trợ hủy và giao/nhận từng phần theo chứng từ liên quan; trả hàng có kiểm tra tình trạng.

Khoản phải thu phát sinh tại mốc đã chốt với nghiệp vụ, không phát sinh chỉ vì bấm đặt hàng. Tách thời điểm chuyển quyền sở hữu, ghi nhận phải thu, giao nhận và nhận tiền.

### Ký gửi

Yêu cầu nhận ký gửi → duyệt → xuất giao → đại lý xác nhận nhận → báo bán theo kỳ → Cohamy đối soát → ghi khoản phải thu → thu tiền.

- Giao ký gửi chưa tự biến toàn bộ giá trị hàng thành khoản phải thu.
- Báo bán ghi rõ lô, lượng đã bán, kỳ đối soát và giá thanh toán theo thỏa thuận.
- Không báo bán vượt lượng ký gửi khả dụng; không ghi công nợ hai lần khi gửi lại hoặc duyệt lại.
- Cho phép báo bán một phần, trả hàng chưa bán, ghi nhận hỏng/mất qua phê duyệt, và chuyển ký gửi sang mua đứt bằng chứng từ riêng.
- Điều chỉnh kỳ đã chốt bằng chứng từ điều chỉnh có liên kết; không ghi đè lịch sử.

### Công nợ và thu chi

- Sổ phải thu khách/đại lý và sổ phải trả nhà cung cấp tách riêng.
- Dư đầu kỳ, phát sinh, hạn thanh toán, tiền thu/chi, tiền ứng trước, phân bổ thanh toán, trả hàng/giảm trừ và dư cuối kỳ.
- Một đơn thanh toán nhiều lần; một phiếu thu phân bổ cho nhiều khoản nợ. Ngăn phân bổ vượt số tiền hoặc vượt dư nợ.
- Đại lý gửi chứng từ chuyển khoản; kế toán xác nhận. Ảnh chuyển khoản không tự đánh dấu đã thu tiền.
- Hạn mức, nợ quá hạn, cảnh báo và duyệt ngoại lệ có lưu người duyệt/lý do.
- Chứng từ thu và chi có trạng thái nháp/xác nhận/đảo; không xóa cứng chứng từ đã ghi sổ.
- Không tự bù trừ phải thu/phải trả. Báo cáo tiền thực thu khác doanh số và giá trị hàng ký gửi.
- Đây là quản trị công nợ vận hành; không tự nhận đã thay thế sổ kế toán pháp định, hóa đơn điện tử hay quyết toán thuế.

### Kết nối website

Sửa checkout để tạo đơn thật, trả mã đơn và chỉ báo thành công sau khi server xác nhận lưu. Giữ giỏ khi lỗi; chống tạo trùng khi bấm hai lần hoặc retry. Tính lại giá/phí/tổng ở server. Phương thức thanh toán chưa tích hợp không được báo đã thanh toán.

## 7. Toàn vẹn dữ liệu và bảo mật

- Dùng giao dịch cơ sở dữ liệu, ràng buộc duy nhất và cơ chế kiểm soát đồng thời cho giữ hàng, xuất kho, duyệt đối soát và phân bổ tiền.
- Chống lặp cho các thao tác có thể retry. Kiểm thử đồng thời hai đơn tranh cùng lượng hàng cuối.
- Tiền sử dụng kiểu số chính xác và quy tắc làm tròn thống nhất; không tính sổ công nợ bằng số thực nhị phân thiếu kiểm soát.
- Sổ biến động kho và sổ công nợ có liên kết chứng từ nguồn, người thao tác, thời gian và chứng từ đảo/điều chỉnh.
- Quyền luôn kiểm tra ở server; việc ẩn menu chỉ phục vụ trải nghiệm. Tài khoản đại lý không tự xác nhận thu tiền hoặc tự nâng hạn mức.
- Không trộn hàng của các chủ sở hữu hoặc lô khác nhau khi kiểm tra khả dụng và xuất.
- Import đầu kỳ có xem trước, phát hiện trùng, đối chiếu tổng, lỗi theo dòng và nhật ký. Tách tồn đầu kỳ, nợ đầu kỳ, ứng trước và hàng ký gửi.
- Dữ liệu kiểm thử nằm riêng và có nhãn. Bản thật không chứa khách, đơn, doanh số hay công nợ bịa.
- Cấu hình môi trường, secret và dữ liệu Cohamy độc lập HumanBank. Có backup và diễn tập restore trước khi vận hành.

## 8. Trình tự làm việc

Thực hiện phase 0–6 trong kế hoạch đi kèm. Mỗi phase phải có: thay đổi thực tế, kiểm thử phù hợp, bằng chứng và phần chưa hoàn thành.

1. Khảo sát source hai dự án; xác định giao diện HumanBank cụ thể; tạo bản đồ source → thành phần Cohamy.
2. Chụp giao diện tham chiếu; chuyển shell, đăng nhập và các mẫu trang trước khi mở rộng phân hệ.
3. Xây nền dữ liệu, xác thực và phạm vi quyền; nối menu đúng quyền.
4. Hoàn thành một luồng mua đứt từ website/portal đến kho và công nợ.
5. Hoàn thành luồng ký gửi đến đối soát và thu tiền; kiểm tra không đếm trùng hàng/nợ.
6. Nhập dữ liệu đầu kỳ, hoàn thiện báo cáo tối thiểu, kiểm thử nghiệm thu và bàn giao bản chạy thử.

Tự giải quyết lựa chọn triển khai có thể suy luận từ source và brief. Chỉ hỏi khi còn thiếu quyết định nghiệp vụ ảnh hưởng trực tiếp tới quyền sở hữu hàng, giá thanh toán, mốc ghi nợ hoặc phân quyền. Có thể tiếp tục phần độc lập trong lúc chờ; không tự giả định những quyết định này rồi ghi dữ liệu thật.

Triển khai local/staging trước. Deploy production, nhập/chuyển dữ liệu thật và gửi thông báo ra bên ngoài chỉ thực hiện khi có chỉ dẫn rõ ràng trong phiên triển khai; có bản build và bằng chứng cụ thể để duyệt nếu chưa được cho phép.

## 9. Điều kiện hoàn thành

- Giao diện nhận ra là CRM HumanBank: dashboard, đăng nhập, trang nghiệp vụ, menu tài khoản và thanh điều hướng; có ảnh đối chiếu desktop/mobile.
- Logo, tên, module, dữ liệu và route đúng Cohamy; website và CMS hiện tại vẫn hoạt động.
- Mua đứt và ký gửi chạy qua backend/database thật ở môi trường kiểm thử; refresh/restart không mất dữ liệu.
- Xác thực, cách ly đại lý, cạnh tranh tồn, retry, thu tiền từng phần, hủy/trả hàng và rollback giao dịch được kiểm chứng.
- Không có nút báo thành công giả, số liệu cứng trong màn nghiệp vụ hoặc màn hình trống bị gọi là phân hệ hoàn chỉnh.
- Chạy lint/typecheck/build và các kiểm thử cần thiết của phần thay đổi; ghi lỗi nền có sẵn riêng.
- Báo cáo dùng nhãn `PASS`, `FAIL`, `BLOCKED`, `NOT RUN` và ghi rõ `LOCAL`, `STAGING`, `PRODUCTION`. Mock chỉ chứng minh phần mock.
- Bàn giao hướng dẫn chạy, cấu hình không chứa secret, migration, backup/restore, dữ liệu mẫu, kết quả kiểm thử, ảnh và danh sách giới hạn.

Bắt đầu bằng khảo sát nguồn và bản đồ chuyển giao diện. Không đề xuất lại hướng thiết kế; người dùng đã chọn giao diện CRM HumanBank.
