# Cohamy

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Nhân sự Cohamy: quản trị, quản lý, sales, thủ kho và kế toán. Đại lý có chủ đại lý và nhân viên; một tổ chức có thể có nhiều tài khoản và nhiều kho.

## Product Purpose

Website bán thực phẩm đóng gói và CRM quản trị mua đứt, ký gửi, hàng hóa, kho và công nợ. Người vận hành cần đối chiếu số dư với chứng từ.

## Capabilities and Constraints

Giữ Next.js hiện có, URL sản phẩm và năm locale; CMS độc lập. Backend CRM dùng PostgreSQL, quyền server và dữ liệu riêng. Người dùng đã cho phép push và deploy mà không hỏi xác nhận lại. Kiểm thử dùng database LOCAL/STAGING độc lập trước phát hành. Không chuyển dữ liệu hoặc secret HumanBank.

Chưa chốt mốc chuyển sở hữu/ghi phải thu mua đứt, công thức giá đối soát ký gửi, bảng giá đại lý, hạn mức, kỳ hạn, quy đổi đơn vị và dữ liệu đầu kỳ. Không mở ghi sổ khi các quyết định liên quan chưa được xác nhận.

## Brand Commitments

Người dùng đã chốt thiết kế lại toàn bộ UI/UX của CRM Nội bộ (`/crm`) theo hướng **Chuẩn SaaS Enterprise B2B Hiện Đại (Modern Enterprise SaaS Standard — Workspace-First)** với **tông màu chủ đạo Vàng Cam (Golden-Amber `#F59E0B` / `#D97706` & Warm Orange `#EA580C`)**, giữ logo Cohamy và phông chữ Be Vietnam Pro; thay thế hoàn toàn màn hình launcher tối và thanh dock nổi bằng khung điều hướng cố định bên trái (7 nhóm phân hệ / 33 module), thanh lệnh trên cùng, dải 4 hàng đợi trực tiếp đầu trang và không gian bảng/chứng từ mật độ cao. Giữ nguyên Cổng Đại lý (`/portal`) và Website công khai.

## Evidence on Hand

Hai brief tại `docs/CRM-COHAMY-IMPLEMENTATION-PLAN.md` và `docs/CRM-COHAMY-MASTER-PROMPT.md`. Source HumanBank local là tham chiếu chỉ đọc. Danh mục website là nội dung hiện có, không chứng minh tồn kho, giá đại lý hoặc quy cách quy đổi đã được xác nhận.

## Accessibility & Inclusion

Kiểm tra desktop 1366×768, mobile 390×844, chiều rộng 320px, bàn phím, focus và reduced motion.
