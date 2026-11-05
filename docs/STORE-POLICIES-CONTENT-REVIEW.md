# Rà soát nội dung chính sách bán hàng Cohamy

Ngày rà soát: 05/11/2026.

Nội dung cuối nằm tại `data/store-policies.ts`, gồm đủ bảy trang theo yêu cầu. Các trang dùng tiếng Việt; không tự tạo bản dịch hoặc thay đổi nội dung sản phẩm hiện có. Việc biên tập chính sách không phải xác nhận toàn bộ hoạt động doanh nghiệp đã đáp ứng mọi thủ tục pháp lý.

## Tài liệu và dữ liệu đối chiếu

- Tệp mẫu người dùng cung cấp: `C:/Users/ACER/Downloads/Chính sách mới luật TMĐT.docx`. SHA256: `9C2114990D6D35E4E92B5EDCBAD9E829198F42ACC9293B7AFBEAC83198557E84`.
- `lib/contact.ts`: tên công ty, hotline/Zalo, email và hai địa chỉ văn phòng. Không tự điền số tài khoản, ngày cấp, nơi cấp giấy đăng ký hoặc địa chỉ pháp lý khác từ doanh nghiệp mẫu.
- `components/CheckoutForm.tsx`, `lib/crm/website-orders.ts`: yêu cầu website được tiếp nhận để kiểm tra, chưa thu tiền, còn cần xác nhận phí giao nhận; chọn COD/ngân hàng/MoMo không có nghĩa thanh toán thành công.
- `app/api/contact/route.ts`, `lib/google-sheets.ts`: biểu mẫu liên hệ gửi thông tin vào Google Sheets.
- `store/cart.ts`, các route đăng nhập: lưu giỏ trên trình duyệt và dùng cookie phiên tại khu vực đăng nhập.
- Chỉ đạo bổ sung của người dùng: giá niêm yết chưa gồm VAT. Cách hiển thị dự kiến của thay đổi này: giá trước/sau giảm công khai đã cộng VAT, chi tiết phân tách tiền hàng và thuế; VAT lấy theo sản phẩm, không ghi một mức thuế cố định vào chính sách.

## Nguồn pháp luật chính thức đã tra cứu

1. [Luật Thương mại điện tử số 122/2025/QH15](https://chinhphu.vn/?classid=1&docid=216503&orggroupid=1&pageid=27160), hiệu lực 01/07/2026. [Bản PDF gốc](https://datafiles.chinhphu.vn/cpp/files/vbpq/2026/01/luat122.2025.qh15.pdf).
2. [Nghị định 248/2026/NĐ-CP](https://chinhphu.vn/?classid=1&docid=218747&pageid=27160), hiệu lực 01/07/2026. [Thông báo triển khai của Cục TMĐT ngày 14/10/2026](https://www.idea.gov.vn/default.aspx?category_id=6e3f3b28-3917-4816-83c5-a331259dd181&do=detail&id=184e0d3f-daab-42a5-a33e-782c78e579c0&page=news) xác nhận cặp văn bản đang được triển khai. PDF nghị định chỉ có bản quét; không dùng OCR chưa xác minh để gán điều khoản cụ thể.
3. [Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15](https://chinhphu.vn/?docid=214590&pageid=27160), hiệu lực 01/01/2026. [Thông tin quyền của chủ thể do Bộ Công an công bố](https://www.bocongan.gov.vn/bai-viet/luat-bao-ve-du-lieu-ca-nhan-chinh-thuc-co-hieu-luc-thi-hanh-tu-ngay-01-01-2026-1767186124).
4. [Nghị định 356/2025/NĐ-CP, PDF gốc](https://datafiles.chinhphu.vn/cpp/files/vbpq/2026/01/356-nd.signed.pdf), hướng dẫn Luật Bảo vệ dữ liệu cá nhân. Không dùng Nghị định 13/2023 làm căn cứ duy nhất cho chính sách mới.
5. [Luật Bảo vệ quyền lợi người tiêu dùng số 19/2023/QH15, Công báo](https://congbao.chinhphu.vn/van-ban/luat-so-19-2023-qh15-39843.htm). [Bản luật trên cổng phổ biến pháp luật tỉnh Lai Châu](https://pbgdpl.laichau.gov.vn/uploads/news/2023_07/luat-bao-ve-quyen-loi-nguoi-tieu-dung-moi-nhat-2023-so-19-2023-qh15.pdf) xác minh thời hạn thông báo tiếp nhận 03 ngày làm việc tại Điều 31.
6. [Bộ Công Thương về trách nhiệm của nhà phân phối, bán lẻ](https://moit.gov.vn/tin-tuc/bao-chi-voi-nguoi-dan/mot-so-trach-nhiem-quan-trong-ve-bao-ve-quyen-loi-nguoi-tieu-dung-cua-cac-to-chuc-ca-nhan-phan-phoi-ban-le-hang-tieu-dun.html), xác minh thời hạn tiến hành thương lượng 07 ngày làm việc và văn bản từ chối có lý do. Không chuyển mốc tiếp nhận sang ngày đủ hồ sơ.

Nội dung không sao chép dài từ nguồn web. Các quy định giao dịch được biên tập từ mẫu người dùng, dữ liệu sản phẩm/hệ thống và chỉ đạo bổ sung; nguồn luật dùng để kiểm tra các quyền và thời hạn bắt buộc.

## Humanizer

Đã đọc `C:/Users/ACER/.codex/skills/humanizer/SKILL.md` và thực hiện quy trình đầy đủ trong chế độ nhúng.

1. Đánh dấu: mẫu có placeholder, tên miền doanh nghiệp khác, mục lắp tủ bếp, diễn đạt lặp và các mốc đổi trả 12 giờ/7 ngày không thống nhất. Các đoạn miễn trừ trách nhiệm hoặc coi truy cập website là mặc nhiên đồng ý cần điều chỉnh.
2. Soạn bản: viết bảy chính sách riêng cho thực phẩm đóng gói Cohamy, dùng thông tin liên hệ có trong mã nguồn. Giữ nội dung về giao nhận, giá, thanh toán, bảo mật, phản ánh và nghĩa vụ hai bên từ mẫu.
3. Rà soát: loại bỏ thông tin doanh nghiệp mẫu; kiểm tra giá gạch ngang và giá bán cùng cách tính VAT; phân biệt yêu cầu với đơn xác nhận và khoản đã thanh toán; kiểm tra mốc 03/07 ngày làm việc. Rút ngắn đoạn lặp, không thêm lời quảng cáo, không hứa an toàn tuyệt đối hay giao hàng 24 giờ khi chưa có cơ sở.
4. Biên tập cuối: mỗi đoạn nêu cách thực hiện hoặc quyền cụ thể, giữ giọng trung tính, dùng tiêu đề câu thường. Không chèn mô tả quá trình biên tập vào trang công khai.

## Các lựa chọn nội dung

- Vận chuyển: địa chỉ, phí, thời gian dự kiến và khả năng bảo quản được xác nhận theo từng đơn; không tự tạo biểu phí, giờ làm việc hoặc SLA.
- Kiểm hàng: đồng kiểm phụ thuộc dịch vụ; người mua vẫn phản ánh sau mở kiện. Video hỗ trợ đối chiếu, không phải điều kiện duy nhất.
- Đổi trả: phân biệt lỗi thuộc người bán với đổi tự nguyện vì đổi ý. Không dùng cửa sổ 12 giờ để loại bỏ quyền luật định; không yêu cầu túi thực phẩm lỗi phải còn nguyên để được xem xét.
- Hoàn tiền: đối chiếu số thực thu, thống nhất thời hạn và phương thức, giữ thời hạn bắt buộc theo luật. Không tạo thông tin tài khoản ngân hàng.
- Dữ liệu: công khai Google Sheets ở biểu mẫu liên hệ; nêu quyền, căn cứ lưu hồ sơ và nghĩa vụ khi chuyển xuyên biên giới. Không khẳng định dữ liệu chỉ lưu tại Việt Nam hoặc đã xóa toàn bộ khi xóa tài khoản mềm.
- Thuế: xác nhận giá cơ sở chưa VAT và giá thanh toán công khai gồm VAT theo sản phẩm. Phí vận chuyển còn chờ xác nhận; thay đổi mức giảm không sửa đơn đã chốt.
- Quyền hai bên: không miễn trừ trách nhiệm người bán khi thuê vận chuyển, không tự thay giá/điều kiện hồi tố, không hạn chế quyền yêu cầu thương lượng hoặc khởi kiện.
- Không sao chép hoặc đặt biểu tượng Bộ Công Thương từ ảnh mẫu. Chỉ được dùng dấu và liên kết xác nhận khi doanh nghiệp đã có hồ sơ hợp lệ.

## Phạm vi kiểm tra

Đã nhập được mô-đun nội dung bằng `tsx`; lần kiểm tra ESLint đầu tiên đạt. Các chỉnh sửa cuối vẫn cần được đưa vào kiểm tra toàn bộ thay đổi sau khi quá trình cài lại dependency của tác vụ chính hoàn tất. Chưa công bố nội dung, chưa kiểm tra giao diện hoặc triển khai trong tác vụ con này; tác vụ chính chịu trách nhiệm tích hợp, runtime và MCP.
