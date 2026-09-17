# Nguồn giao diện và phạm vi tái sử dụng

## Ảnh trong bộ tài liệu

- `references/01-dang-nhap.png`: bản sao nguyên trạng ảnh đăng nhập CRM HumanBank do người dùng cung cấp.
- `references/02-trang-chu.png`: bản sao nguyên trạng ảnh trang chủ CRM HumanBank do người dùng cung cấp.
- Hai ảnh chứa tên thương hiệu/tài khoản cũ như một phần ảnh tham chiếu; dự án mới thay bằng tên và dữ liệu của chính dự án.

## Thành phần source đã đọc ngày 18/09/2026

Repository tham chiếu trên máy: `C:/Users/ACER/OneDrive/Desktop/EDUHMB/humanbank-edu`.

| Path tương đối trong repo HumanBank | Phần có thể tham khảo |
| --- | --- |
| `apps/web/app/dang-nhap/page.tsx` | Cấu trúc trang đăng nhập, logo, lời dẫn và particle background |
| `apps/web/app/components/login-form.tsx` | Cách tổ chức field, hiện/ẩn mật khẩu, trạng thái submit/lỗi |
| `apps/web/app/components/portal-shell.tsx` | Header, user menu, content wrapper, bottom dock |
| `apps/web/app/portal/dashboard/page.tsx` | Launcher sinh từ config modules và quyền |
| `apps/web/app/components/particle-network.tsx` | Hiệu ứng nền mạng điểm |
| `apps/web/app/legacy-crm.css` | Kích thước 180px, grid5/gap25, dock600px, login400px |
| `apps/web/app/layout.tsx` | Font package Be Vietnam Pro/Roboto Condensed và CSS import order |
| `apps/web/app/lib/portal-modules.ts` | Mô hình cấu hình module; cần viết config nghiệp vụ socola riêng |

Không đóng gói source auth/API HumanBank vào bộ này. Component trong repo cũ phụ thuộc router, contracts, roleCodes/grants, logo, base path và API cũ; không copy nguyên rồi mong chạy ở hệ thống mới.

Nếu tái sử dụng thành phần source, tách UI khỏi auth/business, viết adapter theo dự án mới, kiểm tra dependency và quyền sử dụng assets/thư viện. Screenshot và DESIGN là chuẩn hình thức; route, vai trò, dữ liệu và nghiệp vụ phải đến từ CRM socola mới.

Một số khai báo CSS legacy vẫn chứa góc32px, gradient và transform hover; chúng không được xem là yêu cầu cho dự án mới. Bộ tài liệu chọn tile/nút4px và màu phẳng theo ảnh và giới hạn người dùng đã nêu.

Tài liệu này dùng để bắt đầu dự án mới trong một cuộc trò chuyện khác, không cần truy cập production HumanBank hoặc VPS để triển khai.
