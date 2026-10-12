# BÁO CÁO DỌN DẸP CÁC TÍNH NĂNG NẰM NGOÀI PHẠM VI CUỘC HỌP (12/10/2026)

## 1. CĂN CỨ VÀ NGUYÊN TẮC THỰC HIỆN
Theo tinh thần các biên bản cuộc họp ngày 02/10/2026 và 12/10/2026:
- Trọng tâm nghiệp vụ CRM & Portal Cohamy là: **Cây phân cấp quản lý & chuỗi thương mại (4 cấp), chính sách giá theo hạng đối tác & khuyến mãi lũy tiến (Layer A/B), phân quyền kho/tài chính, hạn mức công nợ, luồng phê duyệt đơn hàng & xử lý thiếu hàng, KPI và ma trận doanh số**.
- Các tính năng thử nghiệm hoặc tiện ích bổ trợ ngoài phạm vi cuộc họp được loại bỏ hoàn toàn khỏi mã nguồn sản phẩm để đảm bảo hệ thống tinh gọn, bảo mật và đúng chuẩn nghiệp vụ:
  1. **CRM Hàng mẫu (F030 - Sample Management)**: Đã xóa toàn bộ luồng cấp phát, xuất kho hàng mẫu, hạn ngạch mẫu và biên bản bàn giao mẫu.
  2. **Portal Giỏ hàng nháp (F014 - Draft Cart)**: Đã xóa bảng lưu nháp giỏ hàng portal và form giỏ hàng portal. Việc đặt hàng trên portal được thực hiện trực tiếp từ catalog và tạo thẳng đơn thương mại hoặc đề nghị mua hàng.
  3. **Portal Sổ địa chỉ lưu sẵn (F016 - Saved Addresses)**: Đã xóa sổ địa chỉ portal phụ. Đại lý nhập trực tiếp địa chỉ nhận hàng trên từng đơn hàng thương mại (inline delivery fields).

---

## 2. NGUYÊN TẮC BẢO TOÀN (STRICT PRESERVATIONS)
- **Giỏ hàng Website công khai (B2C)**: Giữ nguyên 100% các file giỏ hàng bán lẻ của website khách hàng (`app/[locale]/cart/page.tsx`, `components/CartDrawer.tsx`, `components/CartView.tsx`, `store/cart.ts`).
- **Địa chỉ giao hàng trên đơn hàng**: Các trường giao hàng trực tiếp (`recipient`, `phone`, `address`, `deliveryNote`) trên các form đặt hàng thương mại (`components/crm/OrderForms.tsx`, `lib/crm/order-requests.ts`) được giữ nguyên đầy đủ.
- **Tính toàn vẹn của Migration lịch sử**: Không sửa đổi các file migration `008-portal-services.sql` và `025-sample-management.sql` để không làm hỏng checksum sha256 trong bảng `_migrations`. Thay vào đó, tạo migration dọn dẹp riêng `db/crm/032-remove-out-of-scope-features.sql`.
- **Sổ cái kho (Stock Ledger)**: Bút toán kho trong quá khứ giữ nguyên tính bất biến.

---

## 3. MIGRATION DỌN DẸP DỮ LIỆU
Đã bổ sung file migration: `db/crm/032-remove-out-of-scope-features.sql`
```sql
-- Migration 032: Dọn dẹp các tính năng ngoài phạm vi (Hàng mẫu, Giỏ hàng nháp portal, Sổ địa chỉ portal)
DROP TABLE IF EXISTS cohamy_crm.sample_events CASCADE;
DROP TABLE IF EXISTS cohamy_crm.sample_allocations CASCADE;
DROP TABLE IF EXISTS cohamy_crm.sample_issue_lines CASCADE;
DROP TABLE IF EXISTS cohamy_crm.sample_issues CASCADE;
DROP TABLE IF EXISTS cohamy_crm.dealer_carts CASCADE;
DROP TABLE IF EXISTS cohamy_crm.dealer_addresses CASCADE;
```

---

## 4. CHI TIẾT CÁC FILE ĐÃ XÓA VÀ ĐIỀU CHỈNH

### A. Các file và thư mục đã xóa vĩnh viễn:
1. `lib/crm/samples.ts` (Nghiệp vụ Hàng mẫu)
2. `components/crm/SamplePages.tsx` (Giao diện Quản lý hàng mẫu)
3. `components/crm/SampleForms.tsx` (Form tạo/sửa phiếu xuất hàng mẫu)
4. `app/api/crm/samples/` (Thư mục API endpoint `app/api/crm/samples/[action]/route.ts`)
5. `scripts/crm/verify-samples.ts` (Test suite hàng mẫu)
6. `scripts/crm/verify-sample-browser.mjs` (Browser test hàng mẫu)
7. `scripts/crm/seed-sample-ui.ts` (Script seed UI hàng mẫu)
8. `docs/crm/test-results/samples-local.json`
9. `docs/crm/test-results/samples-browser-local.json`
10. `docs/crm/demo-screenshots/15_warehouse_sample_management.png`

### B. Các file đã hiệu chỉnh:
1. `lib/crm/portal-services.ts`:
   - Xóa các hàm `addresses`, `saveAddress`, `cart`, `saveCart`.
   - Giữ lại các dịch vụ bảo hành/khiếu nại (`warrantyPolicies`, `tickets`, `createTicket`, `claimLookup`).
2. `app/api/crm/portal/[action]/route.ts`:
   - Gỡ bỏ routing cho `addresses`, `address`, `cart`.
3. `components/crm/PortalServicePages.tsx` & `PortalServiceForms.tsx`:
   - Gỡ bỏ `AddressesPage`, `CartPage`, `CartForm`.
4. `components/crm/OrderForms.tsx` & `OrderPages.tsx`:
   - Loại bỏ selector chọn sổ địa chỉ cũ, dùng nhập liệu địa chỉ trực tiếp khi gửi đơn.
   - Loại bỏ seeding query `?cart=1`.
5. `components/crm/ModulePage.tsx` & `lib/crm/modules.ts`:
   - Gỡ bỏ module `samples` khỏi danh mục nội bộ và kho hàng.
   - Gỡ bỏ module `cart` và `addresses` khỏi danh mục portal đại lý.
6. `lib/crm/permissions.ts` & `lib/crm/governance.ts`:
   - Loại bỏ quyền `samples.read` khỏi danh sách permissions hệ thống.
7. `lib/crm/partner-merge.ts` & `components/crm/PartnerMergeDetails.tsx`:
   - Gỡ bỏ xử lý gộp bảng `dealer_addresses`, `dealer_carts` và lựa chọn `defaultAddress`.
8. `lib/crm/inventory.ts`:
   - Gỡ bỏ khối xử lý đảo ngược tham chiếu loại `sample-issue`.
9. `package.json`:
   - Gỡ bỏ các script `test:crm:samples` và `test:crm:samples-browser`.
10. `scripts/crm/demo/reset.ts` & `scripts/crm/demo/seed.ts`:
    - Dọn dẹp câu truy vấn và dữ liệu seed hàng mẫu / địa chỉ portal.
11. `scripts/crm/verify-portal-services.ts`:
    - Điều chỉnh ca kiểm thử bỏ qua F014 (cart) và F016 (addresses), tập trung bảo hành/ticket/tra cứu.
12. `scripts/crm/verify-commercial-orders.ts` & `scripts/crm/verify-partner-merge.ts`:
    - Cập nhật payload test bỏ trường `defaultAddress`.

---

## 5. KẾT QUẢ KIỂM THỬ VÀ BIÊN DỊCH
- **TypeScript Compiler (`npx tsc --noEmit`)**: **0 errors**, biên dịch thành công 100%.
- **Next.js Typegen (`npx next typegen`)**: Thành công, không còn tham chiếu API hàng mẫu/giỏ hàng portal.
- **Toàn bộ Test Suite CRM**:
  - `test:crm:portal`: **PASS**
  - `test:crm:partner-merge`: **PASS**
  - `test:crm:commercial-orders`: **PASS**
  - `test:crm:meeting-migration`: **PASS**
  - `test:crm:meeting-53`: **PASS** (39/39 tests PASS)
  - `test:crm:meeting-contract`: **PASS** (72/72 tests PASS)
  - `test:crm:meeting-1012`: **PASS** (18/18 tests PASS)
  - `test:crm:inventory`: **PASS**
  - `test:crm:fulfillment`: **PASS**
  - `test:crm:finance`: **PASS**
  - `test:crm:quotations`: **PASS**
  - `test:crm:pricing-model`: **PASS**
  - `test:crm:pricing`: **PASS**
  - `test:crm:decimal`: **PASS**
