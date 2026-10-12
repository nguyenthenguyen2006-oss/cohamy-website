# Đối chiếu cuộc họp 12/10/2026 → CRM Cohamy

Migration: `db/crm/031-meeting-2026-10-12-channel.sql` (tự nạp khi bootstrap).
Kiểm thử: `npm run test:crm:meeting-1012` (18 kịch bản, kết quả tại `docs/crm/test-results/meeting-1012-local.json`).

## Yêu cầu → triển khai

| # | Yêu cầu trong họp | Triển khai |
|---|---|---|
| A | 3 đầu mối/super admin (Xuất, Hoan, Hào), mỗi người một cây đại lý, chính sách % cố định theo từng đối tác | `partner_type = SHAREHOLDER` (cổ đông là đại lý gốc trên Portal); hồ sơ đối tác "Đặt chiết khấu cố định" (`lib/crm/channel.ts` → `setPartnerProfile`); đầu mối tự đặt % cho cấp con trực tiếp, không vượt % mình nhận (`saveChildDiscount`) |
| B | Hạng Đồng / Bạc / Vàng / Kim cương, nâng hạng là có % mới | Bảng hạng thành viên + `applyMembershipLevel`; trang **Mạng lưới đại lý** (`/crm/network`) |
| C | Khuyến mãi: chỉ định / toàn hệ thống / theo số lượng, gắn HOT | `listPromotions/savePromotion` với phạm vi `ALL`, `DESIGNATED`, `QUANTITY`, badge HOT; áp tuần tự KM → CK tài khoản (`lib/crm/channel-pricing.ts`) |
| D | Đơn điện tử theo chuỗi "Quản lý cấp 1, 2…": cửa hàng không thấy cấp trên, cấp trên thấy cấp dưới, nhà máy liên hệ quản lý gần nhất | `requestManagementChain`, `ManagementChainPanel` trên chi tiết yêu cầu đặt hàng |
| E | Báo cáo theo tháng / quý / năm, ma trận đối tác × sản phẩm, theo đầu mối | `lib/crm/period-reports.ts`, trang **Doanh số theo kỳ** (CRM + Portal) |
| F | KPI thúc đẩy: đạt doanh số → nâng hạng / % mới / quà tặng, admin duyệt | Chương trình thưởng + tiến độ + trao thưởng (`/crm/kpi`) |
| G | Xin chuyển cây, duyệt tập trung | `createTransferRequest / decideTransferRequest` |
| H | 2 kho Hà Nội (NORTH) và HCM (SOUTH), gợi ý kho gần, thiếu hàng báo quản lý trực tiếp kèm tồn kho vùng khác, không tự bịa ngày | Trường `region` cho kho; `OrderChannelPanel`; `reportShortage` |
| I | Hoá đơn xuất cho người mua hoặc công ty khác | `setInvoiceRecipient` |
| J | Portal dạng sàn: lưới sản phẩm có ảnh, giá, số lượng, KM | `PortalOrderCatalogPage` (trang Hàng hoá của Portal); đối tác chỉ thấy trạng thái Còn hàng / Sắp hết / Tạm hết / Liên hệ |

## Mặc định đã chọn (có thể đổi)

- "Sắp hết" khi tồn ≤ 20 đơn vị gốc.
- KM và chiết khấu tài khoản cộng dồn tuần tự (KM trước, CK sau).
- Chuỗi quản lý tính từ cây hiện tại, không lưu cố định trên đơn.
- Doanh số kỳ tính theo phiên bản đơn đã xác nhận (ngày tạo phiên bản, giờ VN); số lượng không gồm hàng tặng.
- Chưa giới hạn số suất KM (quantity cap).

## Doanh nghiệp cần tự nhập

1. Đánh dấu 3 đầu mối là `SHAREHOLDER`, gắn đại lý vào đúng cây.
2. Nhập % cho từng hạng (Đồng/Bạc/Vàng/Kim cương). Hệ thống không tự điền.
3. Chính sách 50% về công ty của đầu mối: đặt qua "Đặt chiết khấu cố định" trên hồ sơ đầu mối.
4. Tạo/cập nhật 2 kho HN, HCM với vùng tương ứng; gán vùng cho đối tác.
5. Tạo chương trình KPI/thưởng theo quý/năm khi có chính sách.
6. Đào tạo online và trực tiếp cho kho, đầu mối; đầu mối hướng dẫn đại lý đặt hàng trên Portal.
