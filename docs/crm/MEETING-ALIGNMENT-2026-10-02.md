# Cohamy CRM & Partner Portal - Khảo sát, Bản đồ sai lệch và Kế hoạch thực thi theo cuộc họp 02/10/2026

Cập nhật: 2026-10-02
Phiên bản tài liệu: 1.0.0
Trạng thái: Bản khảo sát gốc được giữ để đối chiếu. Kết quả sửa lỗi và bằng chứng hiện tại: [TEST-REPORT-RUNTIME-FIXES-2026-10-02.md](TEST-REPORT-RUNTIME-FIXES-2026-10-02.md).

---

## 1. NGUỒN YÊU CẦU VÀ QUY TẮC PHÂN LOẠI QUYẾT ĐỊNH

| Mã | Nội dung quyết định | Phân loại | Nguồn / Căn cứ |
|---|---|---|---|
| **DEC-01** | Mô hình mạng lưới phân phối đa cấp: Nhà máy/Cohamy → Đại lý cấp 1 → Đại lý cấp 2 → Cửa hàng/Điểm bán → Khách mua cuối. Hỗ trợ tuyến tắt (Cohamy → Đại lý cấp 1 → Cửa hàng/Khách cuối). | **MEETING_CONFIRMED** | Cuộc họp 02/10/2026. Phân tách rõ Organization, Distribution Relation, User Role, Pricing Policy, Warehouse. |
| **DEC-02** | Đại lý cấp 1, cấp 2 và cửa hàng có tài khoản xem sản phẩm và đặt hàng. Khách cuối lưu hồ sơ chăm sóc, không bắt buộc tài khoản. | **MEETING_CONFIRMED** | Cuộc họp 02/10/2026. |
| **DEC-03** | Kho dùng chung nhưng mỗi nhân viên kho đăng nhập tài khoản riêng để ghi nhận người thực hiện trong nhật ký kiểm toán (Audit). Không chia sẻ mật khẩu. | **DEFAULT_ASSUMPTION** | Diễn giải mặc định từ cuộc họp theo chuẩn an toàn thông tin & yêu cầu prompt. |
| **DEC-04** | Một bên chỉ có 1 tuyến mua hàng cấp trên đang hiệu lực trong 1 mạng lưới. Chặn tự làm cấp trên, quan hệ vòng, gán vào hậu duệ. | **DEFAULT_ASSUMPTION** | Đề xuất trong prompt để ngăn chặn chu trình vô hạn và tuyến đặt hàng nhập nhằng. |
| **DEC-05** | Công thức giá 2 lớp: Lớp A (Khuyến mãi sản phẩm) và Lớp B (Chiết khấu tài khoản). Áp dụng giảm giá nối tiếp (compounded / sequential): `Giá sau KM = Niêm yết × (1 - KM)`, `Giá thuần = Giá sau KM × (1 - CK)`. Ví dụ: 100k × 90% × 70% = 63k; 100k × 90% × 60% = 54k. | **DEFAULT_ASSUMPTION** | Đề xuất trong prompt vì cuộc họp chưa chốt công thức chiết khấu nối tiếp hay gộp. Cấu hình linh hoạt. |
| **DEC-06** | Chiết khấu tài khoản gồm 2 phương pháp: `FIXED_PERCENT` (tỷ lệ cố định) hoặc `QUANTITY_TIER` (theo bậc số lượng `[min, max)` nửa mở không chồng chéo, tính trên tổng số lượng cùng SKU trong đơn sau khi quy đổi đơn vị chuẩn). Một tài khoản chỉ áp dụng 1 phương pháp tại một thời điểm theo chính sách được duyệt. | **MEETING_CONFIRMED** | Cuộc họp 02/10/2026. |
| **DEC-07** | Đặt hàng và duyệt nhiều cấp: Đơn của cấp dưới chuyển đến cấp trên trực tiếp (S → A2 → A1 → Cohamy). Mỗi cấp có giá, bên bán, bên mua và chứng từ thương mại độc lập. Không sao chép giá cấp dưới cho cấp trên. | **MEETING_CONFIRMED** | Cuộc họp 02/10/2026. |
| **DEC-08** | Bán từ kho sở hữu: Nếu đại lý đã có hàng trong kho của mình, bán từ kho đại lý. Chỉ tạo đề nghị mua lên cấp trên đối với phần thiếu cần bổ sung. | **MEETING_CONFIRMED** | Cuộc họp 02/10/2026. |
| **DEC-09** | Tác động kho: Nháp/chờ duyệt không giảm tồn vật lý. Xác nhận đơn giữ hàng (Reservation). Xuất kho giảm tồn vật lý và giải trừ giữ hàng. Hủy đơn giải phóng giữ hàng chưa xuất. | **DEFAULT_ASSUMPTION** | Quy tắc quản lý kho chuẩn đề xuất trong prompt. |
| **DEC-10** | Thiếu hàng: Đơn cần 70, kho đáp ứng 50 → Cấp 50, thiếu 20. Báo trạng thái rõ ràng, không bịa thời gian giao nếu chưa có dữ liệu. Cho phép giao một phần. | **MEETING_CONFIRMED** | Cuộc họp 02/10/2026. |
| **DEC-11** | Công nợ: Mặc định TẮT cho các bên chưa được duyệt. Chưa thanh toán không đồng nghĩa được mua công nợ. Công nợ ghi nhận đúng chủ thể quan hệ thương mại (S nợ A2, A2 nợ A1, A1 nợ Cohamy). Cohamy không ghi trực tiếp S nợ Cohamy. | **MEETING_CONFIRMED** | Cuộc họp 02/10/2026. |
| **DEC-12** | Thời điểm ghi nhận công nợ: Ghi nhận công nợ theo phần hàng ĐÃ GIAO được xác nhận, trừ thanh toán đã phân bổ. Giao một phần chỉ ghi nợ phần đã giao. | **DEFAULT_ASSUMPTION** | Quy tắc đối soát thương mại đề xuất trong prompt. |
| **DEC-13** | Phân bổ thanh toán: Hỗ trợ thanh toán nhiều lần, một khoản thu phân bổ cho nhiều đơn không vượt số tiền thu và không vượt nghĩa vụ còn lại. | **MEETING_CONFIRMED** | Cuộc họp 02/10/2026. |
| **DEC-14** | Phân quyền & Cách ly nhánh: Nhánh A không xem được khách hàng, đơn hàng, công nợ của nhánh B. Đại lý chỉ xem yêu cầu thuộc tuyến mình phụ trách. Quản trị toàn hệ thống theo phân quyền cấu hình. | **MEETING_CONFIRMED** | Cuộc họp 02/10/2026. |
| **DEC-15** | Bài viết (CMS trong CRM): Có mục Bài viết trong CRM cho người có quyền, đồng bộ với nguồn bài viết của website công khai. Phân biệt bản nháp và bản xuất bản. Xuất bản kiểm tra quyền phía server, revalidate cache, giữ nguyên URL/canonical/SEO. | **MEETING_CONFIRMED** | Cuộc họp 02/10/2026. |
| **DEC-16** | Bảng giá thật, tỷ lệ chiết khấu thật, hạn mức công nợ thật, tồn kho thật: Không tự áp đặt dữ liệu thật. Doanh nghiệp cấu hình qua giao diện quản trị. QA chỉ dùng fixture cô lập. | **OPEN_CONFIGURATION** | Quy tắc bắt buộc trong prompt. |
| **DEC-17** | Bảo toàn nghiệp vụ cũ: Mua đứt, ký gửi, đối soát, tồn kho theo chủ sở hữu, procurement, tiếp nhận đơn website, mẫu thử, công việc chăm sóc. | **PRESERVED_EXISTING** | Quy tắc bắt buộc trong prompt. |

---

## 2. BẢN ĐỒ ĐỐI CHIẾU VÀ SAI LỆCH (GAP ANALYSIS)

| Yêu cầu cuộc họp / Prompt | Hiện trạng có bằng chứng | Sai lệch / Thiếu sót | Giải pháp sửa đổi | Thành phần liên quan | Ca kiểm thử |
|---|---|---|---|---|---|
| **1. Mạng lưới phân phối đa cấp** (Cohamy → A1 → A2 → S → Khách) | `organizations` chỉ có `kind IN ('COHAMY','DEALER','CUSTOMER','SUPPLIER')`. Chưa có quan hệ cây phân phối cha - con. | Thiếu bảng quan hệ phân phối đa cấp; thiếu cấp đại lý (Level 1, Level 2, Store); thiếu validation chặn vòng lặp. | Tạo bảng `cohamy_crm.distribution_relations` với parent, child, network, status, effective dates. Thêm cột `partner_type` hoặc `tier` trên organization. Service kiểm tra chu trình và tuyến hợp lệ. | `db/crm/026-distribution-multitier.sql`, `lib/crm/distribution.ts`, `lib/crm/repository.ts` | TC01, TC02, TC04, TC05 |
| **2. Cách ly dữ liệu theo nhánh** (Nhánh A không thấy nhánh B) | `partnerScope` trong `repository.ts` cho Portal chỉ là `o.id = user.organizationId`. Portal không thấy cấp dưới; CRM Sales chỉ thấy theo `partner_assignments`. | Cấp trên không quản lý được cấp dưới trực thuộc tuyến; chưa hỗ trợ phạm vi nhánh cây phân phối. | Cập nhật `partnerScope` và `branchScope`: Portal user xem được chính mình và cây con thuộc nhánh mình quản lý (descendants). Chặn xem chéo nhánh anh em (sibling/cross-branch). | `lib/crm/repository.ts`, `lib/crm/permissions.ts`, `lib/crm/distribution.ts` | TC06, TC07, TC55, TC71 |
| **3. Cấp chính sách đối tác khi duyệt** | `onboarding.ts` `reviewApplication` chỉ tạo Org DEALER và User/Membership. Không cấu hình cấp đại lý, tuyến, bảng giá, quyền kho, công nợ. | Thiếu toàn bộ cấu hình thương mại và phân phối khi phê duyệt đối tác. | Mở rộng `reviewApplication` cho phép chọn `partnerType`, `parentOrganizationId`, `pricingTierId`, `creditEnabled`, `creditLimit`, `warehouseScope`. | `lib/crm/onboarding.ts`, `components/crm/UpgradePages.tsx`, `components/crm/UpgradeForms.tsx` | TC09, TC10 |
| **4. Công thức giá 2 lớp & Bậc số lượng** | `pricing-model.ts` tính theo đơn giá mốc (threshold unit price) và quà tặng. Không có 2 lớp KM nối tiếp CK theo tỷ lệ. | Chưa hỗ trợ giảm giá nối tiếp (100k × 90% × 70% = 63k); chưa có phương pháp `FIXED_PERCENT` và `QUANTITY_TIER` theo chuẩn cuộc họp. | Triển khai mô hình tính giá 2 lớp: Lớp 1 (Khuyến mãi sản phẩm), Lớp 2 (Chiết khấu tài khoản `FIXED_PERCENT` / `QUANTITY_TIER` trên khoảng `[min, max)`). Đồng nhất làm tròn với `decimal.ts`. | `lib/crm/pricing-model.ts`, `lib/crm/pricing-multitier.ts`, `lib/crm/pricing.ts` | TC11, TC12, TC13, TC14, TC15, TC16, TC17, TC18, TC19, TC20, TC21, TC22 |
| **5. Đơn hàng theo quan hệ mua bán & Duyệt nhiều cấp** | `sales_orders` luôn mặc định bên bán là Cohamy; gửi đơn trực tiếp đến Cohamy. | Đơn từ S không chuyển đến A2; A2 không duyệt đơn của S; không có luồng chuyển tiếp lên A1 rồi Cohamy; giá bị đồng nhất hóa. | Bổ sung `seller_organization_id` và `buyer_organization_id` cho Request & Order. Luồng: S tạo đơn gửi A2 → A2 duyệt → A2 nếu thiếu hàng tạo/chuyển đơn mua lên A1 (với giá A2-A1) → A1 duyệt → A1 tạo đơn mua Cohamy (giá A1-Cohamy) → Cohamy duyệt. | `db/crm/026-distribution-multitier.sql`, `lib/crm/order-requests.ts`, `lib/crm/sales-orders.ts`, `lib/crm/order-routing.ts` | TC03, TC13, TC23, TC24, TC25, TC26, TC27, TC28, TC29, TC30, TC31, TC32, TC34 |
| **6. Kho, Giữ hàng, Thiếu hàng & Giao một phần** | `inventory.ts` đã có `reserveOrder` và `inventory_balances` (`on_hand`, `reserved`). Nhưng chưa gắn kết với đơn nhiều cấp, thiếu hàng chỉ báo lỗi `INVENTORY_INSUFFICIENT` chứ chưa hỗ trợ partial split. | Thiếu logic phân tách: Cấp 50, thiếu 20; ghi nhận kế hoạch bổ sung rõ ràng, không bịa ngày giao. | Bổ sung cơ chế `fulfillPartialOrShortage`: tính toán khả dụng kho ưu tiên, ghi nhận phần giữ được (50) và phần thiếu (20), lưu backlog/backorder mà không tạo ngày giao giả. | `lib/crm/inventory.ts`, `lib/crm/fulfillment.ts`, `components/crm/InventoryPages.tsx` | TC35, TC36, TC37, TC38, TC39, TC40, TC41, TC42, TC43, TC44 |
| **7. Công nợ đúng chủ thể theo mốc giao hàng** | `finance.ts` có `credit_accounts` và `receivables`, nhưng mặc định công nợ của tất cả đơn đều quy về Cohamy (`creditor` không được lưu riêng). | S mua của A2 nhưng Cohamy lại ghi nhận phải thu; công nợ có thể bị kích hoạt sai thời điểm. | Gắn `creditor_organization_id` (bên bán) và `debtor_organization_id` (bên mua) trên Receivable. Ghi nhận nợ theo giá trị giao hàng thực tế. Cho phép thu tiền nhiều lần, phân bổ nhiều đơn. | `db/crm/026-distribution-multitier.sql`, `lib/crm/finance.ts`, `components/crm/FinancePages.tsx` | TC45, TC46, TC47, TC48, TC49, TC50, TC51, TC52, TC53, TC54 |
| **8. Quản lý bài viết (CMS) trong CRM** | Website có CMS (`lib/blog-repository.ts`), admin có `app/admin/(dashboard)/posts`, nhưng CRM (/crm) chưa có menu và module "Bài viết". | CRM chưa có module biên tập/quản lý bài viết liên kết với website công khai. | Thêm module `articles` vào `lib/crm/modules.ts`, tạo API CRM articles (`/api/crm/articles/[action]`), tạo UI `ArticlesPage` trong CRM cho phép xem danh sách, biên tập, lưu nháp (không hiện public), xuất bản (revalidate cache). | `lib/crm/modules.ts`, `app/api/crm/articles/[action]/route.ts`, `components/crm/ArticlesPage.tsx`, `components/crm/ModulePage.tsx` | TC58, TC59, TC60 |
| **9. Giao diện đặt hàng & Danh mục trực quan** | Danh mục `goods` ở portal hiển thị dạng bảng đơn sơ, chưa có hình ảnh sản phẩm rõ ràng, chưa giải thích chính sách chiết khấu. | Người mua khó nhận diện sản phẩm, dễ nhầm SKU; thiếu giải thích chiết khấu. | Cải tiến trang chọn hàng: hiển thị ảnh sản phẩm rõ ràng, mã SKU, quy cách, đơn vị, giá niêm yết, khuyến mãi, chiết khấu và giá thuần dự tính theo thời gian thực. | `components/crm/OrderPages.tsx`, `components/crm/OrderForms.tsx` | TC57 |
| **10. 72 Ca nghiệm thu bắt buộc (TC01 - TC72)** | Các script hiện có kiểm tra các tính năng cũ (F001-F140). | Chưa có bộ test suite tập trung kiểm thử 72 ca nghiệm thu của cuộc họp 02/10/2026. | Viết test suite chuyên dụng `scripts/crm/verify-meeting-contract.ts` thực thi và nghiệm thu đầy đủ 72 test case từ TC01 đến TC72. | `scripts/crm/verify-meeting-contract.ts`, `package.json` | TC01 - TC72 |

---

## 3. LỘ TRÌNH THỰC THI (P1 - P7)

- **P1: Quan hệ phân phối và phân quyền**:
  - Tạo migration `db/crm/026-distribution-multitier.sql`.
  - Triển khai `lib/crm/distribution.ts` quản lý cấu trúc cây đại lý, xác thực chu trình, quan hệ phân phối.
  - Cập nhật scoping trong `lib/crm/repository.ts` và `lib/crm/permissions.ts`.
  - Cập nhật onboarding đối tác trong `lib/crm/onboarding.ts`.
  - Nghiệm thu TC01 - TC10.

- **P2: Chính sách và công thức giá 2 lớp**:
  - Triển khai `lib/crm/pricing-multitier.ts`: tính giá 2 lớp (KM sản phẩm + CK tài khoản FIXED_PERCENT / QUANTITY_TIER theo bậc nửa mở).
  - Snapshot giá, bảo toàn số tiền chính xác qua `decimal.ts`.
  - Nghiệm thu TC11 - TC22.

- **P3: Đơn hàng và duyệt nhiều cấp**:
  - Triển khai `lib/crm/order-routing.ts` quản lý định tuyến đơn hàng, quan hệ mua bán tại từng nấc.
  - Cập nhật `lib/crm/order-requests.ts` và `lib/crm/sales-orders.ts` hỗ trợ seller/buyer, multi-tier approvals, chuyển tiếp đơn cấp trên.
  - Nghiệm thu TC23 - TC34.

- **P4: Kho, giữ hàng, thiếu hàng & giao hàng**:
  - Nâng cấp `lib/crm/inventory.ts` và `lib/crm/fulfillment.ts`: quản lý giữ hàng (reservation), ưu tiên kho, xử lý thiếu hàng (shortage), giao một phần.
  - Nghiệm thu TC35 - TC44.

- **P5: Thanh toán và công nợ**:
  - Cập nhật `lib/crm/finance.ts`: quản lý công nợ theo đúng chủ nợ (bên bán) và con nợ (bên mua), kích hoạt khi giao hàng, phân bổ thu tiền nhiều lần.
  - Nghiệm thu TC45 - TC54.

- **P6: Chăm sóc, báo cáo, bài viết (CMS) và website intake**:
  - Tích hợp module Bài viết vào CRM (`lib/crm/articles.ts`, `app/api/crm/articles/[action]/route.ts`, `components/crm/ArticlesPage.tsx`).
  - Đảm bảo website checkout intake bảo vệ quyền và trạng thái.
  - Nghiệm thu TC55 - TC62.

- **P7: Kiểm thử toàn diện 72 ca, Build, Migration & Bàn giao**:
  - Xây dựng test suite `scripts/crm/verify-meeting-contract.ts`.
  - Chạy toàn bộ test suite, kiểm tra TypeScript, typecheck, lint, build.
  - Lập báo cáo nghiệm thu và ma trận kết quả chi tiết.
