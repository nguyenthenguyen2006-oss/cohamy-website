# CRM Cohamy — nâng cấp bàn làm việc và chăm sóc khách hàng

Ngày 18/09/2026. Đây là trạng thái hiện tại sau yêu cầu tích hợp tính năng và thiết kế lại UI/UX. Bản này thay phần giao diện và danh sách tính năng của snapshot `IMPLEMENTATION-STATUS.md`; không biến các phase kho–công nợ chưa làm thành hoàn tất.

## Đã triển khai

| Phần | Khả năng hiện có | Giới hạn cần hiểu đúng |
|---|---|---|
| Bàn làm việc | Yêu cầu mới, việc chưa xong, đường tắt theo quyền; điều hướng cố định desktop, menu thu gọn mobile | Không tạo KPI, doanh thu, tồn kho hoặc số nợ giả |
| Yêu cầu đặt hàng | Tìm mã/tên/điện thoại/email; lọc trạng thái, ngày, người phụ trách; phân trang; xem sản phẩm, tiền hàng, liên hệ, địa chỉ, lời nhắn | Là website intake, chưa phải đơn bán hàng đã duyệt hoặc phiếu xuất |
| Xử lý yêu cầu | Phân công; mới nhận → đang tư vấn → đã chốt; từ chối/hủy có lý do; chỉ quản lý mở lại; chống ghi đè phiên bản | “Đã chốt” chỉ là thống nhất nhu cầu; không xác nhận tiền, giữ hàng, xuất kho hoặc ghi nợ |
| Khách hàng/đại lý | Người liên hệ, nguồn, nhóm, giai đoạn; tìm bằng điện thoại/email; cảnh báo trùng thông tin liên hệ trong phạm vi được phép xem | Cảnh báo tại chi tiết hồ sơ; chưa tự gộp, chưa chặn trùng khi nhập mới |
| Chăm sóc | Ghi chú có tác giả/thời gian, lịch sử append-only, nhật ký thay đổi | Chưa email/Zalo/SMS, tệp đính kèm hoặc đồng bộ cuộc gọi |
| Việc cần làm | Tạo việc gắn hồ sơ/yêu cầu, người phụ trách và hạn; lọc chưa xong/quá hạn/đã xong; hoàn thành/mở lại | Theo dõi trong CRM, chưa có tiến trình gửi nhắc tự động; danh sách tối đa 200 việc |
| Phân công | Quản trị/quản lý gán sales cho hồ sơ, người xử lý yêu cầu, thủ kho cho kho | Server kiểm tra role/scope; thu hồi quyền ẩn cả ghi chú/việc liên quan |
| Hàng hóa | Sửa SKU/tên CRM/đơn vị/quy cách thùng/hiển thị đại lý, chống ghi đè | Không đổi ID, tên/ảnh/giá public website; chưa quy đổi sổ kho hoặc tạo tồn |
| Tài khoản | Tạo/khóa; đổi vai trò phù hợp tổ chức; đặt lại mật khẩu; thu hồi phiên; tự đổi mật khẩu với mật khẩu hiện tại | Không tự đổi vai trò mình; đổi vai trò xóa phân công cũ và thu hồi phiên; chưa MFA hoặc quên mật khẩu qua email |
| Báo cáo tiếp nhận | Đếm yêu cầu và tổng tiền hàng theo trạng thái từ dữ liệu thật trong scope | Giá trị yêu cầu không phải doanh thu; chưa báo cáo thu tiền, nợ hoặc lãi |

## UI/UX đã thay

- Giữ logo, Be Vietnam Pro và nhận diện navy/cam; thay launcher cũ bằng bàn làm việc theo tác vụ.
- Các màn đang hoạt động luôn ở menu chính. Các phân hệ chưa có giao dịch nằm trong nhóm có nhãn rõ.
- Chi tiết yêu cầu tập trung sản phẩm, trạng thái, người phụ trách, liên hệ, ghi chú và bước tiếp theo. Mobile có nút gọi và danh sách sản phẩm/yêu cầu đọc được không cần kéo bảng ngang.
- Form có nhãn, báo lỗi/thành công, trạng thái đang lưu và bảo vệ gửi lặp. Nhập lỗi không tự xóa nội dung. Các thao tác nhạy cảm tài khoản ở trang riêng.
- CSS chỉ áp vào CRM/portal; không đổi giao diện website/CMS. Chuyển động giới hạn ở trạng thái điều khiển, hỗ trợ reduced motion và focus bàn phím.

Hợp đồng thiết kế: `WORKSPACE-UI-CONTRACT.md`. Hệ thống thiết kế ở `components/crm/DESIGN.md`, không phải hệ thống thiết kế public website. Kết luận độc lập: `WORKSPACE-FINISH-REVIEW.md`.

Vòng review yêu cầu sửa nhãn truy cập hồ sơ trên mobile, đưa thông tin khách lên disclosure gần nút gọi, tạo việc ngay trong hồ sơ trống và bỏ nhãn thừa trên login. Verdict cuối **ship**: cả bốn sửa đổi được chấm resolved sau kiểm tra lại 16 ảnh; đây là kết luận về bốn sửa đổi UI, không phải chứng nhận toàn CRM hay production.

## Bằng chứng kiểm thử đợt nâng cấp

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Nền truy cập và intake | PASS 21 ca | `test-results/access-local.json` |
| Nghiệp vụ mới, quyền, rollback, phiên bản, tài khoản | PASS 21 ca | `test-results/work-local.json` |
| UI thực trên Edge, lưu rồi tải lại, mobile 390/320, scope sales/đại lý, public isolation | PASS 9 nhóm kiểm tra; không console error trong lượt chạy | `test-results/work-browser-local.json` |
| Regression từ review UI độc lập | PASS 4 kiểm tra; chụp lại 16 ảnh đã mở kiểm tra | `test-results/work-review-local.json` |
| Build sản xuất | PASS; 117 trang được sinh | `npm run build`; chỉ build LOCAL, không deploy |
| Đóng gói migration và loại dữ liệu QA | PASS 54 traces, đủ 4 SQL migrations, không leak các đường dẫn QA/reference được kiểm tra | `test-results/build-traces-local.json` |
| TypeScript và lint | PASS | Typecheck và `npm run lint` exit 0 trong đợt này |

Ảnh desktop/mobile: `.impeccable/review/work/`. Dữ liệu và tài khoản đều fictitious LOCAL QA. Test PGlite không chứng minh PostgreSQL nhiều kết nối, dự phòng hoặc chất lượng vận hành thực tế. Bộ so sánh pixel HumanBank cũ là bằng chứng lịch sử, không còn tiêu chí chấp nhận giao diện mới. Chưa rerun chứng nhận dependency/security toàn hệ thống; snapshot audit cũ không đại diện cho các package đã được cập nhật ở phần việc khác.

## Chạy lại

```powershell
# Tạo bộ dữ liệu mới, chỉ khi directory này chưa có và không có server sở hữu nó.
$env:CRM_LOCAL_DATA_DIR='.local/crm-qa-work-my-review'
node --require ./scripts/register-server-only.cjs --import tsx scripts/crm/seed-work-ui.ts
node scripts/crm/start-qa.mjs
```

Ở terminal khác:

```powershell
npm run test:crm
npm run test:crm:work
npm run test:crm:work-browser
node scripts/crm/verify-work-review.mjs
npm run typecheck
npm run lint
npm run build
npm run test:crm:build
```

Browser test cần server QA ở localhost:4310 và Microsoft Edge; có tạo/chỉnh sửa dữ liệu QA. Backend test tự tạo directory riêng, không mở DB của server. Live preview đợt này dùng `.local/crm-qa-work-ui-20260918`, build cache `.local/next-crm-work`, không ghi đè bộ QA cũ. Xem thông tin tài khoản trong `RUNBOOK.md`. Không dùng fixture hoặc mật khẩu QA ở production.

## Chưa triển khai / điều kiện để làm tiếp

1. **Sổ kho thực:** nhập/xuất/chuyển, lô/hạn dùng, hàng đang giữ, tồn theo owner, kiểm kê và tồn đầu kỳ. Cần đơn vị/kho/quy tắc nghiệp vụ được chốt; metadata quy cách không thay thế ledger.
2. **Mua đứt:** phê duyệt giá/hạn mức, giữ hàng, giao/nhận, chuyển sở hữu, ghi công nợ, thanh toán, phân bổ và trả hàng. Cần thời điểm ghi nhận và người được duyệt.
3. **Ký gửi:** giao hàng, báo bán, đối soát, hoa hồng và công nợ. Cần công thức giá/hoa hồng và kỳ đối soát.
4. **Phần còn lại:** nhà cung cấp/AP, import/export an toàn, contact form → CRM, nhắc việc tự động và kênh liên lạc, upload chứng từ, cấu hình chính sách và báo cáo tài chính. Đây chưa phải các nút đang kết nối.
5. **Trước dữ liệu thật:** staging PostgreSQL, nhiều kết nối/tranh chấp, quyền DB tối thiểu, backup/restore, HTTPS/private cache, kiểm tra security/dependency hiện hành và người dùng pilot. Tự đổi mật khẩu hiện kiểm tra mật khẩu cũ nhưng chưa có limiter riêng cho endpoint này.

Chưa deploy, chưa import dữ liệu thật, chưa gửi thông báo bên ngoài. Không gọi bản này là toàn bộ CRM phase 0–6 hoàn tất.
