# Bộ tài liệu xây CRM quản lý kho socola

Phiên bản: 1.0. Ngày tạo: 18/09/2026.

Mục tiêu: dùng kiểu giao diện đăng nhập và trang chủ CRM HumanBank trong hai ảnh người dùng cung cấp để xây hệ thống CRM quản lý kho socola mới.

## Cách dùng trong dự án mới

Đưa thư mục này vào repository mới, ví dụ `docs/brief-crm-socola/`, rồi gửi Codex yêu cầu sau:

```text
Hãy đọc toàn bộ docs/brief-crm-socola/ và thực hiện
01-PROMPT-VA-DAC-TA.md trong repository hiện tại.
Hai ảnh trong references/ là chuẩn giao diện cho đăng nhập và trang chủ.
02-DESIGN.md quy định cấu trúc, thứ tự 11 ô chức năng, màu và responsive.
Hãy xây đầy đủ nghiệp vụ quản lý kho socola và CRM theo tài liệu,
kiểm tra bằng trình duyệt cùng các bài kiểm tra nghiệm thu đã nêu.
Giữ kiểu giao diện trong ảnh; bắt đầu triển khai sau khi khảo sát repository.
```

Nếu đặt thư mục ở nơi khác, sửa đường dẫn trong câu lệnh tương ứng. Có thể dùng riêng `01-PROMPT-VA-DAC-TA.md`, nhưng gửi kèm cả thư mục sẽ có ảnh và thông số thiết kế để Codex bám sát.

## Các tệp

| Tệp | Nội dung |
| --- | --- |
| `01-PROMPT-VA-DAC-TA.md` | Prompt triển khai độc lập, nghiệp vụ, dữ liệu, quyền và nghiệm thu |
| `02-DESIGN.md` | Thiết kế đăng nhập, launcher 11 ô, điều hướng dưới và màn hình nghiệp vụ |
| `03-NGUON-GIAO-DIEN.md` | Nguồn ảnh, thành phần HumanBank đã đọc và giới hạn tái sử dụng |
| `references/01-dang-nhap.png` | Ảnh đăng nhập người dùng cung cấp |
| `references/02-trang-chu.png` | Ảnh launcher người dùng cung cấp |

## Những giả định ban đầu

- Đây là hệ thống nội bộ cho chủ cửa hàng/doanh nghiệp, nhân viên bán hàng, quản lý kho, thủ kho và kế toán.
- Giai đoạn đầu quản lý socola thành phẩm, nhiều kho/vị trí, bán hàng, nhà cung cấp và khách hàng. Không mặc định xây nhà máy sản xuất.
- Tên `CRM SOCOLA` là tên tạm có thể cấu hình, không phải thương hiệu đã được người dùng chốt.
- Logo, tài khoản và danh mục hàng thật sẽ được cấu hình cho dự án mới. Ảnh tham chiếu có tài khoản HumanBank; thông tin này không được đưa vào seed hoặc màn hình hệ thống mới.
- Hai ảnh chỉ xác định đăng nhập và trang chủ. Thiết kế bảng/form trong module là đề xuất vận hành được ghi riêng trong DESIGN.
- Tài liệu này là brief/prompt, chưa phải phần mềm đã triển khai. Chưa tạo ứng dụng, cài lên server hoặc thay đổi HumanBank.

Các tính năng giáo dục, WordPress, Rank Math và chiến dịch SEO trong cuộc trò chuyện trước không thuộc CRM kho socola.
