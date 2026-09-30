# HƯỚNG DẪN TRẢI NGHIỆM MÔI TRƯỜNG & BỘ DỮ LIỆU DEMO COHAMY CRM & DEALER PORTAL

> **LƯU Ý QUAN TRỌNG:**
> Toàn bộ mã nguồn, cấu hình và dữ liệu demo được triển khai **HOÀN TOÀN TẠI LOCAL**.
> Hệ thống áp dụng cơ chế bảo vệ nghiêm ngặt: **KHÔNG commit, KHÔNG push và KHÔNG deploy** lên production khi chưa có yêu cầu từ người phụ trách.

---

## 1. TỔNG QUAN KIẾN TRÚC MÔI TRƯỜNG DEMO & BẢO VỆ CÁCH LY

### 1.1 Cơ sở dữ liệu: Phân biệt rõ rệt giữa PGlite và PostgreSQL Demo riêng

Hệ thống hỗ trợ 2 chế độ cơ sở dữ liệu cho môi trường DEMO, được cấu hình linh hoạt qua biến môi trường `CRM_DATABASE_MODE`:

#### Chế độ A: Local PGlite Engine (Mặc định cho máy cá nhân)
- **Cơ chế:** Động cơ PostgreSQL 18.3 chạy trực tiếp dạng nhúng (WebAssembly/Native), lưu trữ dữ liệu tại thư mục cục bộ `.local/crm-demo`.
- **Cấu hình:**
  ```powershell
  $env:CRM_ENVIRONMENT="DEMO"
  $env:CRM_DEMO_MODE="true"
  $env:CRM_DATABASE_MODE="pglite"
  $env:CRM_LOCAL_DATA_DIR=".local/crm-demo"
  ```
- **Tên Database thực tế từ Server:** `postgres` (User: `postgres`, Engine: `PostgreSQL 18.3 PGlite`).
- **Ưu điểm:** Khởi động tức thì, không phụ thuộc service hệ điều hành, lý tưởng cho lập trình viên và kiểm thử nhanh.

#### Chế độ B: PostgreSQL Dedicated Server (Chuẩn bị chạy VPS độc lập)
- **Cơ chế:** Kết nối TCP/IP tới máy chủ PostgreSQL riêng biệt trên VPS hoặc máy chủ nội bộ.
- **Hỗ trợ `NODE_ENV=production`:** Chạy hoàn chỉnh dưới chế độ production trên VPS mà không bị chặn bởi các kiểm tra môi trường.
- **Cấu hình mẫu:**
  ```powershell
  $env:NODE_ENV="production"
  $env:CRM_ENVIRONMENT="DEMO"
  $env:CRM_DEMO_MODE="true"
  $env:CRM_DATABASE_MODE="postgres"
  $env:CRM_DATABASE_URL="postgresql://cohamy_demo_user:SecretPassword@127.0.0.1:5432/cohamy_crm_demo?sslmode=disable"
  ```
- **Tên Database thực tế từ Server:** Bắt buộc là database riêng biệt (ví dụ: `cohamy_crm_demo`). Tên database được script xác minh `current_database()` kiểm chứng thực tế và ghi nhận vào log báo cáo.
- **Allowlist chống kết nối nhầm Production:**
  - `lib/crm/db.ts` và `scripts/crm/demo/reset.ts` chặn đứng mọi kết nối nếu tên database là `cohamy`, `cohamy_crm`, `cohamy_prod`, `cohamy_production` hoặc host trỏ tới `cohamy.com`.
  - Tên database bắt buộc phải chứa `demo` hoặc `test`.

---

### 1.2 Bảo mật API công khai & Xóa bỏ qaToken trong môi trường DEMO

Nhằm loại bỏ hoàn toàn nguy cơ rò rỉ token hoặc đặt lại mật khẩu trái phép:
1. **Xóa `qaToken` khỏi API công khai:**
   - Trong `lib/crm/account-security.ts`, trường `qaToken` **chỉ được phép trả về** khi `CRM_ENVIRONMENT === 'LOCAL'` (dành cho integration tests nội bộ).
   - Trong môi trường `DEMO` hoặc `PRODUCTION`, endpoint `POST /api/crm/security/forgot` và hàm `requestPasswordReset()` **chỉ trả về `{ accepted: true }`**, tuyệt đối không trả về `qaToken`.
2. **Kiểm thử Bảo mật Người chưa đăng nhập (`npm run crm:demo-security-test`):**
   - Người chưa đăng nhập gửi yêu cầu quên mật khẩu: API trả về `{ accepted: true }`, không có bất kỳ token nào trong phản hồi.
   - Thử nghiệm đặt lại mật khẩu với token giả mạo, token rỗng, hoặc token đoán ngẫu nhiên: Bị từ chối ngay lập tức với lỗi `INVALID_FIELDS` / `RESET_TOKEN_INVALID`.
   - Mật khẩu của tài khoản Quản trị viên (`admin@demo.cohamy.invalid`) được kiểm chứng bảo toàn 100%, không bị thay đổi.
3. **Bắt buộc HTTPS khi chạy Production:**
   - `lib/crm/http.ts` và `lib/crm/account-security.ts` yêu cầu `CRM_PUBLIC_ORIGIN` phải bắt đầu bằng `https://` khi chạy với `NODE_ENV=production`.
   - Browser smoke test tích hợp sẵn HTTPS reverse proxy với chứng chỉ SSL self-signed để tuân thủ nghiêm ngặt quy định này.

---

### 1.3 Cơ chế Reset an toàn: Không đổi session_replication_role, Không tắt Trigger

Quy trình `npm run crm:demo-reset` được viết lại hoàn toàn để khắc phục các hạn chế bảo mật:
1. **Tuyệt đối KHÔNG thay đổi `session_replication_role`:**
   - Không yêu cầu quyền superuser `ALTER SYSTEM` hoặc `SET session_replication_role = 'replica'`.
2. **Tuyệt đối KHÔNG tắt Trigger (`DISABLE TRIGGER ALL`):**
   - Tất cả các trigger ràng buộc toàn vẹn và trigger audit vẫn hoạt động liên tục.
   - Để xóa các bản ghi demo trong bảng audit append-only (`audit_events`, `custom_field_versions`, `document_versions`), transaction reset tạm thời bật cờ session nội bộ `SET LOCAL cohamy.demo_reset = 'on'` cho hàm kiểm tra `deny_audit_mutation()`, sau đó khôi phục nguyên trạng trước khi `COMMIT`.
3. **Thực thi trong một Transaction duy nhất có Rollback:**
   - Mọi thao tác xóa diễn ra trong transaction nguyên tử.
   - Nếu bất kỳ câu lệnh nào thất bại, toàn bộ transaction tự động `ROLLBACK`, bảo toàn 100% dữ liệu hiện có.
4. **Chỉ xóa bản ghi thuộc batch demo:**
   - Lọc chính xác theo `batch_tag = 'DEMO_BATCH_2026'`, tiền tố `DEMO_`, hoặc email `@demo.cohamy.invalid`.
5. **Kiểm thử Sentinel trên Database dùng một lần (`npm run crm:demo-sentinel-test`):**
   - Tự động tạo một database độc lập dùng một lần (`.local/crm-demo-sentinel-${uuid}`).
   - Cấy trộn dữ liệu Sentinel (phi-demo) và dữ liệu Demo.
   - Kiểm thử rollback khi gặp sự cố, sau đó chạy reset và kiểm chứng: **100% bản ghi Sentinel còn nguyên vẹn, 0 bản ghi demo còn sót lại**.
   - Tự động dọn dẹp sạch sẽ thư mục database sau khi kiểm thử kết thúc.

---

### 1.4 Chọn cổng Non-destructive trong Browser Test (Không kill tiến trình lạ)

Trong `scripts/crm/demo/browser-smoke.mjs`:
- **Chọn cổng tự động:** Sử dụng `net.createServer().listen(0)` để cấp phát động một cổng TCP khả dụng nếu cổng mặc định (4330) đang bận.
- **Báo lỗi tường minh khi chỉ định cổng:** Nếu biến môi trường `PORT` được người dùng chỉ định nhưng cổng đó đang có ứng dụng khác chiếm giữ, test sẽ dừng ngay và báo lỗi `PORT_OCCUPIED_ERROR` thay vì cố gắng tắt tiến trình.
- **Tuyệt đối KHÔNG kill tiến trình ngoài:** Đã loại bỏ hoàn toàn các lệnh `taskkill` hoặc can thiệp vào các tiến trình không do bài test tạo ra.

---

### 1.5 Bảo mật Thông tin: Không in Mật khẩu & URL chứa Mật khẩu

- Không in plaintext mật khẩu người dùng demo ra console hoặc log file.
- Chuỗi kết nối database (`CRM_DATABASE_URL`) luôn được bọc qua hàm làm sạch `sanitizeDatabaseUrl()` để che giấu mật khẩu (ví dụ: `postgresql://user:****@host:5432/db`) trước khi hiển thị ra console hoặc báo cáo.
- Thông tin mật khẩu demo được lưu trữ an toàn trong `.local/demo-credentials.json` (đã gitignored) hoặc cấu hình qua biến môi trường bí mật `CRM_DEMO_PASSWORD`.

---

## 2. BẢNG TỔNG HỢP DỮ LIỆU DEMO THỰC TẾ TRONG HỆ THỐNG

Bộ dữ liệu được tạo bởi các service nghiệp vụ chính thống của hệ thống, tuân thủ ràng buộc toàn vẹn khóa ngoại và quy trình phê duyệt:

| STT | Nhóm dữ liệu nghiệp vụ | Số lượng bản ghi thực tế | Các trạng thái nghiệp vụ có trong demo | Mô tả chi tiết |
|:---:|:---|:---:|:---|:---|
| **1** | **Khách hàng (Customers)** | **10** | `LEAD`, `PROSPECT`, `ACTIVE` | Đầy đủ nhãn chăm sóc (`VIP`, `TIEM_NANG`), kênh liên hệ ưu tiên (`PHONE`, `ZALO`), gán nhân viên kinh doanh phụ trách |
| **2** | **Đại lý (Dealers)** | **10** | `ACTIVE` | Cấu hình địa chỉ giao hàng kho đại lý, liên kết hạn mức tín dụng và kỳ hạn nợ đối soát (30 ngày) |
| **3** | **Hồ sơ đăng ký đối tác** | **10** | `SUBMITTED` (3), `INFO_REQUESTED` (2), `DRAFT` (2), `APPROVED` (2), `REJECTED` (1) | Hồ sơ đại lý đăng ký onboarding trực tuyến, có đầy đủ người liên hệ, mã số thuế, tỉnh thành |
| **4** | **Nhà cung cấp (Suppliers)** | **10** | `ACTIVE` | Vùng nguyên liệu Macca Đắk Lắk, Hạnh nhân Úc, Bao bì giấy carton... kèm điều khoản thanh toán 15–45 ngày |
| **5** | **Sản phẩm & SKU** | **10** | `ACTIVE` (10 SKU) | Socola thanh hạt, macca rang củi, thanh năng lượng, nho khô, bột cacao, trà mãng cầu... |
| **6** | **Quy chuẩn đơn vị bán** | **20** | `BASE` (10) & `CASE` (10) | Cấu hình quy đổi chuẩn từ đơn vị đóng gói lẻ (Gói, Hộp, Túi) sang Thùng (12–24 đơn vị/thùng) |
| **7** | **Bảng giá thương mại** | **1** | `PUBLISHED` (Đang hiệu lực) | Bảng giá Toàn Quốc 2026 với 10 mục giá lẻ BASE và 10 mục giá sỉ thùng CASE có chiết khấu thương mại |
| **8** | **Kho hàng & Vị trí** | **6 kho / 12 vị trí** | `ACTIVE` | Tổng kho Hà Nội, TP.HCM, Kho hàng mẫu, Kho ký gửi, Kho Đại lý A, Kho Đại lý B (Mỗi kho có vị trí `LOC_PICK` và `LOC_QUARANTINE`) |
| **9** | **Tồn kho & Lô hàng** | **10 dòng tồn kho** | Có lô cận hạn cảnh báo | Tồn kho thực tế tại kho Hà Nội, kèm 2 lô hàng có hạn sử dụng cận hạn (còn 20 ngày) để hiển thị cảnh báo Dashboard |
| **10** | **Báo giá (Quotations)** | **10** | `DRAFT` (2), `SENT` (3), `ACCEPTED` (3), `REJECTED` (1), `EXPIRED` (1) | Tự động kết xuất và lưu trữ file PDF nhị phân trong hệ thống lưu trữ chứng từ |
| **11** | **Đơn bán hàng & Giao hàng** | **1 chu kỳ trọn vẹn** | `CONFIRMED` -> `DELIVERED` | Đề xuất mua hàng -> Duyệt thương mại -> Xác nhận đơn -> Giữ tồn kho -> Lập lệnh giao -> Soạn hàng (Pick) -> Đóng gói (Pack) -> Điều phối xe (Trip) -> Giao hàng thành công (POD) |
| **12** | **Quản lý Hàng mẫu** | **1 chu kỳ trọn vẹn** | `ISSUED` -> `RECEIVED` | Yêu cầu cấp mẫu -> Xuất kho mẫu theo nguyên tắc FEFO -> Đại lý ký nhận mẫu nguyên vẹn |
| **13** | **Hợp đồng Ký gửi** | **1 hợp đồng active** | `ACTIVE` (2 bên chấp thuận) | Thỏa thuận ký gửi 2 chiều Cohamy HQ và Siêu thị An Nhiên (Hoa hồng 20%, định mức tồn an toàn 5–20 thùng) |
| **14** | **Sổ cái Công nợ & Tuổi nợ** | **6 khoản phải thu** | Đủ 5 dải tuổi nợ | `NOT_DUE` (Trong hạn), `0_30` (Quá hạn 1-30 ngày), `31_60` (31-60 ngày), `61_90` (61-90 ngày), `OVER_90` (>90 ngày) |
| **15** | **Thanh toán & Sao kê** | **1 phiếu thu, 1 giao dịch** | `CONFIRMED` | Phiếu thu chuyển khoản 20.000.000đ và giao dịch ngân hàng Vietcombank tự động import |
| **16** | **Cơ hội kinh doanh** | **10** | `DISCOVERY`, `PROPOSAL`, `WON`, `LOST` | Theo dõi pipeline bán buôn, giá trị tiềm năng từ 20 triệu đến 150 triệu VNĐ |
| **17** | **Lịch sử ghé thăm đối tác** | **10** | `COMPLETED` | Ghi nhận hoạt động thị trường của nhân viên Sales tại các cửa hàng đại lý và chuỗi cafe |
| **18** | **Công việc (Tasks)** | **10** | `OVERDUE` (3), `DUE_SOON` (4), `COMPLETED` (3) | Đầy đủ việc quá hạn, việc sắp tới và việc đã xong để dashboard hiển thị badge và cảnh báo chuẩn |
| **19** | **Phiếu hỗ trợ (Tickets)** | **10** | `OPEN` (3), `IN_PROGRESS` (2), `WAITING_PARTNER` (1), `RESOLVED` (4) | Kèm trao đổi tin nhắn 2 chiều giữa Đại lý và CSKH Cohamy |
| **20** | **Thư viện tài liệu đối tác** | **10** | `PUBLISHED` (10 tài liệu PDF) | Catalogue 2026, Chính sách chiết khấu, Chứng nhận HACCP/ISO, Quy định bảo quản hàng hóa... |
| **21** | **Thông báo in-app** | **10** | `GENERAL` | Thông báo cập nhật đơn hàng, hạn mức tín dụng và chính sách đại lý |
| **22** | **Đơn hàng Website** | **10** | `PENDING` | Hàng đợi đơn đặt từ khách lẻ trên trang chủ, sẵn sàng cho Sales intake thành cơ hội |

---

## 3. DANH SÁCH TÀI KHOẢN TRẢI NGHIỆM THEO TỪNG VAI TRÒ

Mọi tài khoản đều được cấp quyền chuẩn qua hệ thống `memberships` và xác thực bảo mật thực tế (sử dụng bcrypt).

### 3.1 Thông tin tài khoản
| Vai trò (Role) | Email đăng nhập | Phân khu truy cập | Quyền hạn tiêu biểu | Mục đích demo cho Sếp |
|:---|:---|:---:|:---|:---|
| **Quản trị viên (Admin)** | `admin@demo.cohamy.invalid` | `/crm` | Toàn quyền kiểm soát, phê duyệt | Duyệt hồ sơ đối tác, duyệt báo giá, xem toàn bộ dashboard |
| **Trưởng phòng / Quản lý** | `manager@demo.cohamy.invalid` | `/crm` | Quản lý kinh doanh, phê duyệt chính sách | Xem báo cáo doanh số, duyệt hạn mức công nợ |
| **Nhân viên Kinh doanh (Sales)** | `sales@demo.cohamy.invalid` | `/crm` | Cơ hội, chăm sóc, ghé thăm, công việc | Xử lý pipeline bán hàng, theo dõi việc quá hạn |
| **Thủ kho (Warehouse)** | `warehouse@demo.cohamy.invalid` | `/crm` | Tồn kho, vị trí kệ, soạn hàng, hàng mẫu | Xem cảnh báo cận date, soạn hàng Pick theo lô |
| **Kế toán (Accountant)** | `accountant@demo.cohamy.invalid` | `/crm` | Sổ cái công nợ, phân tích tuổi nợ, phiếu thu | Phân tích 5 dải tuổi nợ, khớp nối sao kê VCB |
| **Chủ Đại lý A (Dealer Owner)** | `dealer-a@demo.cohamy.invalid` | `/portal` | Đại lý Siêu thị An Nhiên (Hà Nội) | Đặt hàng sỉ, xem công nợ, ký hợp đồng ký gửi |
| **Nhân viên Đại lý A (Staff)** | `staff-a@demo.cohamy.invalid` | `/portal` | Nhân viên mua hàng Đại lý A | Thao tác nhập liệu, tra cứu thư viện chính sách |
| **Chủ Đại lý B (Dealer Owner)** | `dealer-b@demo.cohamy.invalid` | `/portal` | Chuỗi Nông Sản Xanh Bình An (Đà Nẵng) | Kiểm chứng cách ly dữ liệu: không thấy đơn của A |

### 3.2 Cơ chế Cấp mật khẩu Bảo mật & Bàn giao Kênh riêng
- Mật khẩu đăng nhập **TUYỆT ĐỐI KHÔNG ĐƯỢC LƯU MẶC ĐỊNH TRONG MÃ NGUỒN, LOG HOẶC TÀI LIỆU**.
- Cơ chế khởi tạo mật khẩu:
  - **Cách 1 (Biến môi trường bí mật):** Truyền qua `CRM_DEMO_PASSWORD`:
    ```powershell
    $env:CRM_DEMO_PASSWORD="MatKhauBiMatTuChon2026!"
    npm run crm:demo-seed
    ```
  - **Cách 2 (Sinh ngẫu nhiên chuẩn mật mã):** Nếu không đặt `CRM_DEMO_PASSWORD`, script sẽ tự động sinh ngẫu nhiên chuỗi bảo mật cao bằng `crypto.randomBytes(16)`.
- Tệp lưu trữ thông tin đăng nhập sau seed nằm tại:
  ```
  .local/demo-credentials.json
  ```
  *(Đã được cấu hình trong `.gitignore`, không bao giờ bị commit lên repository).*
- **Quy trình cấp tài khoản cho Ban Lãnh đạo qua kênh bảo mật riêng:**
  1. Trích xuất mật khẩu từ `.local/demo-credentials.json` hoặc từ cấu hình bí mật trên VPS.
  2. Gửi tài khoản (`admin@demo.cohamy.invalid` hoặc `dealer-a@demo.cohamy.invalid`) kèm mật khẩu cho Sếp qua **kênh liên lạc bảo mật riêng** (ví dụ: Tin nhắn tự hủy Signal/Telegram Secret Chat, ghi chú bảo mật 1Password/Bitwarden, hoặc trao đổi trực tiếp).
  3. **Tuyệt đối không** gửi mật khẩu qua email công khai, kênh chat chung không mã hóa hoặc ghi lại vào tài liệu công khai.

---

## 4. KỊCH BẢN ĐỀ XUẤT CHO SẾP TRẢI NGHIỆM (8 WALKTHROUGH FLOWS)

### Kịch bản 1: Sếp đăng nhập Quản trị viên duyệt hồ sơ đối tác mới
1. **Đường dẫn:** `http://localhost:3000/crm/login`
2. **Đăng nhập:** Email `admin@demo.cohamy.invalid` / Mật khẩu: lấy từ `.local/demo-credentials.json` (hoặc biến `CRM_DEMO_PASSWORD` đã thiết lập)
3. **Thao tác:**
   - Vào menu **Hồ sơ đối tác** (`/crm/applications`).
   - Sếp sẽ thấy danh sách 10 hồ sơ đại lý ở nhiều trạng thái (`SUBMITTED`, `INFO_REQUESTED`, `APPROVED`...).
   - Bấm vào hồ sơ đang ở trạng thái `SUBMITTED` (ví dụ: *Đại lý Nông sản Xanh Hà Tĩnh*).
   - Xem thông tin doanh nghiệp, người đại diện, số điện thoại.
   - Bấm nút **Yêu cầu bổ sung thông tin** hoặc **Phê duyệt đối tác**.
4. **Kết quả mong đợi:** Trạng thái hồ sơ chuyển tức thì sang trạng thái mới, lịch sử xử lý (audit trail) ghi nhận hành động của Admin.

---

### Kịch bản 2: Sếp kiểm tra Sổ cái công nợ & Phân tích tuổi nợ 5 dải (Aging Debt)
1. **Đường dẫn:** `http://localhost:3000/crm/debts`
2. **Đăng nhập:** Tài khoản Admin hoặc Kế toán (`accountant@demo.cohamy.invalid`)
3. **Thao tác:**
   - Xem biểu đồ và bảng phân loại tuổi nợ:
     - **Trong hạn (NOT_DUE):** Khoản nợ còn 10 ngày đến hạn thanh toán.
     - **Quá hạn 1–30 ngày:** Lô hàng hạt điều cần theo dõi.
     - **Quá hạn 31–60 ngày:** Cảnh báo cần gửi thư nhắc nợ.
     - **Quá hạn 61–90 ngày:** Khoản nợ đang đối soát.
     - **Quá hạn >90 ngày:** Khoản nợ khó đòi cần phương án xử lý.
   - Xem mục **Phiếu thu tiền** & **Sao kê ngân hàng VCB** đã khớp nối tự động.
4. **Kết quả mong đợi:** Sếp thấy rõ bức tranh tài chính công nợ đại lý đa chiều, các khoản nợ quá hạn được gắn nhãn màu đỏ cảnh báo trực quan.

---

### Kịch bản 3: Sếp trải nghiệm vai trò Sales quản lý cơ hội và công việc quá hạn
1. **Đường dẫn:** `http://localhost:3000/crm/care` và `/crm/tasks`
2. **Đăng nhập:** Email `sales@demo.cohamy.invalid`
3. **Thao tác:**
   - Vào trang **Cơ hội kinh doanh** (`/crm/care`): Thấy 10 cơ hội phân bổ từ giai đoạn Tìm hiểu đến Thành công, tổng giá trị tiềm năng hàng trăm triệu đồng.
   - Vào trang **Công việc** (`/crm/tasks`): Sếp sẽ thấy 3 công việc hiển thị cảnh báo đỏ **QUÁ HẠN** (ví dụ: *Gặp trực tiếp quản lý Oasis Cafe chốt hợp đồng quý 4*).
   - Thử bấm checkbox hoàn thành công việc hoặc lọc theo việc cần xử lý trong ngày.
   - Vào trang **Lịch sử ghé thăm** (`/crm/visits`): Xem nhật ký nhân viên thị trường đã tới từng điểm bán, ghi chú phản hồi của chủ tiệm.
4. **Kết quả mong đợi:** Thao tác cập nhật tức thì, danh sách việc quá hạn được làm nổi bật để nhắc nhở nhân viên.

---

### Kịch bản 4: Sếp trải nghiệm vai trò Quản lý Kho kiểm tra hàng cận hạn & Hàng mẫu
1. **Đường dẫn:** `http://localhost:3000/crm/inventory` và `/crm/samples`
2. **Đăng nhập:** Email `warehouse@demo.cohamy.invalid`
3. **Thao tác:**
   - Vào trang **Sổ cái kho & Tồn kho** (`/crm/inventory`): Xem tồn kho tại Tổng kho Hà Nội và TP.HCM.
   - Quan sát danh sách lô hàng: Hệ thống hiển thị cảnh báo màu vàng/đỏ cho các lô hàng **HSD chỉ còn 20 ngày** (Lô hạt sen sấy giòn `LOT-DEMO-EXPIRE-SOON`).
   - Vào mục **Quản lý hàng mẫu** (`/crm/samples`): Xem phiếu xuất mẫu `DEMO-BAR-03` cho Trưởng phòng Thu mua Siêu thị An Nhiên thẩm định chất lượng.
4. **Kết quả mong đợi:** Quản lý kho nắm bắt chính xác vị trí hàng hóa (vị trí Pick / Quarantine) và không lo sót hàng cận date.

---

### Kịch bản 5: Sếp đóng vai Chủ Đại lý A (Portal) đặt hàng sỉ và xem bảng giá
1. **Đường dẫn:** `http://localhost:3000/portal/login`
2. **Đăng nhập:** Email `dealer-a@demo.cohamy.invalid` / Mật khẩu: lấy từ `.local/demo-credentials.json` (hoặc biến `CRM_DEMO_PASSWORD` đã thiết lập)
3. **Thao tác:**
   - Ngay đầu trang xuất hiện banner cảnh báo màu cam: `MÔI TRƯỜNG DEMO — DỮ LIỆU GIẢ LẬP`.
   - Vào trang **Đặt hàng** (`/portal/orders`): Xem đơn hàng sỉ đã xác nhận và theo dõi tiến độ giao nhận.
   - Vào trang **Thư viện tài liệu** (`/portal/library`): Bấm tải về các file PDF chính thức như *Catalogue Sản phẩm 2026*, *Chính sách Bán hàng & Chiết khấu Đại lý Toàn quốc*.
   - Vào trang **Hỗ trợ** (`/portal/support`): Xem phiếu khiếu nại bao bì móp méo và tin nhắn CSKH Cohamy đã tiếp nhận xử lý.
4. **Kết quả mong đợi:** Giao diện Portal tối ưu cho đại lý, tinh gọn, hiển thị đúng giá sỉ chiết khấu theo hợp đồng.

---

### Kịch bản 6: Sếp kiểm tra tính Cách ly dữ liệu giữa Đại lý A và Đại lý B
1. **Mục tiêu:** Đảm bảo đại lý này tuyệt đối không xem được dữ liệu nhạy cảm (đơn hàng, giá cả, phiếu hỗ trợ) của đại lý khác.
2. **Thao tác:**
   - Mở cửa sổ trình duyệt ẩn danh (Incognito), đăng nhập Đại lý B: `dealer-b@demo.cohamy.invalid`.
   - Vào `/portal/orders`: Danh sách đơn hoàn toàn trống (hoặc chỉ có đơn riêng của B), không hề xuất hiện đơn hàng của Đại lý An Nhiên.
   - Cố tình dán ID đơn hàng hoặc ID phiếu hỗ trợ của Đại lý A lên thanh địa chỉ: Hệ thống báo lỗi `NOT_FOUND` (404).
3. **Kết quả mong đợi:** Cơ chế phân quyền cấp cơ sở dữ liệu (`partnerScope`) bảo vệ an toàn 100% dữ liệu của từng đối tác.

---

### Kịch bản 7: Sếp kiểm tra Hợp đồng Ký gửi đối soát 2 chiều
1. **Đường dẫn:** `http://localhost:3000/crm/consignment`
2. **Đăng nhập:** Admin (`admin@demo.cohamy.invalid`)
3. **Thao tác:**
   - Xem hợp đồng ký gửi đang hiệu lực giữa Cohamy HQ và Siêu thị An Nhiên.
   - Tỷ lệ hoa hồng ký gửi: 20% (`partnerBasisPoints: 2000`).
   - Tồn an toàn tại kho đại lý: 5–20 thùng Socola Hạnh Nhân Đen.
4. **Kết quả mong đợi:** Thể hiện trọn vẹn mô hình kinh doanh ký gửi hàng hóa tại chuỗi bán lẻ.

---

### Kịch bản 8: Sếp kiểm tra hàng đợi xử lý Đơn hàng từ Website
1. **Đường dẫn:** `http://localhost:3000/crm/orders`
2. **Đăng nhập:** Admin hoặc Sales
3. **Thao tác:**
   - Xem danh sách 10 đơn đặt hàng bán lẻ từ khách truy cập website Cohamy (Đỗ Mỹ Linh, Trần Tuấn Anh, Lê Thu Trang...).
   - Xem thông tin địa chỉ giao hàng, ghi chú đóng gói, sản phẩm quan tâm.
   - Thao tác tiếp nhận để đội ngũ kinh doanh liên hệ chăm sóc.
4. **Kết quả mong đợi:** Liên kết thông suốt giữa kênh Website bán lẻ và CRM quản trị tập trung.

---

## 5. BỘ LỆNH ĐIỀU HÀNH & KIỂM THỬ LOCAL

Tất cả các lệnh dưới đây được chạy trực tiếp tại terminal local:

| Mục đích kiểm thử | Lệnh thực thi | Mô tả chi tiết & Tiêu chí thành công |
|:---|:---|:---|
| **Khởi tạo dữ liệu Demo** | `npm run crm:demo-seed` | Tạo 8 tài khoản, kho, 10 sản phẩm, 10 đại lý, 10 khách hàng, công nợ, đơn hàng. Idempotent: chạy lại nhiều lần không sinh trùng bản ghi. |
| **Xác minh kết nối DB Demo** | `npm run crm:demo-verify-db` | In tên database thực tế (`current_database()`), user, version. Kiểm tra allowlist cấm database production và xác nhận 178 bảng schema CRM. |
| **Kiểm thử Bảo mật API & qaToken** | `npm run crm:demo-security-test` | Kiểm tra request quên mật khẩu không lộ `qaToken`, từ chối token giả mạo, bảo vệ tài khoản admin an toàn tuyệt đối. |
| **Kiểm thử Cách ly mạng ra ngoài** | `npm run crm:demo-network-test` | Đánh chặn mọi kết nối DNS/Socket ra bên ngoài. Xác nhận email Brevo và SMS nhắc nợ được mô phỏng an toàn, 0 outbound HTTP request. |
| **Kiểm thử Reset an toàn & Sentinel** | `npm run crm:demo-sentinel-test` | Chạy trên database dùng một lần. Kiểm thử rollback khi lỗi, kiểm chứng xóa sạch 100% bản ghi demo và bảo toàn 100% bản ghi sentinel, không tắt trigger. |
| **Reset dữ liệu Demo chọn lọc** | `npm run crm:demo-reset` | Xóa có chọn lọc bản ghi demo trong transaction an toàn, không đổi `session_replication_role`, không tắt trigger. |
| **Kiểm thử Nghiệp vụ 15 điểm** | `npm run test:crm:demo` | Xác thực 8 vai trò người dùng, kiểm tra liên kết khóa ngoại, hạn mức tín dụng, dải tuổi nợ, phân tách đại lý, chặn email. |
| **Kiểm thử Trình duyệt Tương tác** | `npm run test:crm:demo-browser` | Khởi động Next.js server trên cổng trống, tự động test 10 kịch bản UI (Tạo, Sửa, Duyệt), xuất 22 ảnh chụp chứng cứ. |
| **Kiểm tra TypeScript & Lint** | `npm run typecheck` & `npm run lint` | Đảm bảo mã nguồn không có bất kỳ lỗi kiểu dữ liệu hoặc vi phạm quy chuẩn linter. |

---

## 6. KẾT QUẢ KIỂM THỬ THỰC TẾ & BẰNG CHỨNG (TEST EVIDENCE)

### 6.1 Bằng chứng Thực chạy: Phân biệt PGlite và PostgreSQL Dedicated

#### Bằng chứng Chạy trên PGlite Engine (Local Data Dir)
```text
> npm run crm:demo-verify-db

=================================================
 [COHAMY CRM] XÁC MINH KẾT NỐI DATABASE DEMO    
=================================================
- Môi trường (CRM_ENVIRONMENT): DEMO
- Chế độ Database (CRM_DATABASE_MODE): pglite
- NODE_ENV: development

--- THÔNG TIN KẾT NỐI THỰC TẾ TỪ SERVER ---
- Database Name : postgres
- Database User : postgres
- Engine Version: PostgreSQL 18.3 (PGlite 0.5.8) on wasm32-unknown-emscripten
- Local Storage : .local/crm-demo
✅ XÁC NHẬN: Sử dụng bộ lưu trữ nhúng cục bộ độc lập .local/crm-demo.
- Tổng số bảng schema 'cohamy_crm': 178 bảng

=================================================
 ✅ XÁC MINH HOÀN TẤT: SERVER KẾT NỐI ĐÚNG DATABASE DEMO!
=================================================
```

#### Bằng chứng Chạy trên PostgreSQL Dedicated Server (VPS / Dedicated Instance)
```text
> $env:CRM_DATABASE_MODE="postgres"
> $env:CRM_DATABASE_URL="postgresql://cohamy_demo_user:****@127.0.0.1:5432/cohamy_crm_demo"
> npm run crm:demo-verify-db

=================================================
 [COHAMY CRM] XÁC MINH KẾT NỐI DATABASE DEMO    
=================================================
- Môi trường (CRM_ENVIRONMENT): DEMO
- Chế độ Database (CRM_DATABASE_MODE): postgres
- NODE_ENV: production

--- THÔNG TIN KẾT NỐI THỰC TẾ TỪ SERVER ---
- Database Name : cohamy_crm_demo
- Database User : cohamy_demo_user
- Engine Version: PostgreSQL 16.2 on x86_64-pc-linux-gnu
- Connection URL: postgresql://cohamy_demo_user:****@127.0.0.1:5432/cohamy_crm_demo
✅ XÁC NHẬN: Database đích nằm trong allowlist demo và hoàn toàn tách biệt khỏi database production.
- Tổng số bảng schema 'cohamy_crm': 178 bảng

=================================================
 ✅ XÁC MINH HOÀN TẤT: SERVER KẾT NỐI ĐÚNG DATABASE DEMO!
=================================================
```

#### Kiểm chứng Idempotent Double Seed (Không trùng dữ liệu)
- **Lần seed 1 (`npm run crm:demo-seed`):** Khởi tạo đầy đủ 10 Khách hàng, 10 Đại lý, 10 Báo giá, 10 Hồ sơ đối tác.
- **Lần seed 2 (`npm run crm:demo-seed`):** Hệ thống nhận diện các bản ghi đã tồn tại, tự động cập nhật hoặc bỏ qua:
  - `Báo giá đã có sẵn.`
  - `Tồn kho đã có sẵn.`
  - `Hồ sơ đối tác đã có sẵn.`
  - Đếm lại số bản ghi sau lần seed 2: **Số lượng bản ghi giữ nguyên chính xác 10 bản ghi**, không sinh bản ghi nhân bản (`0 duplicate rows`).

---

### 6.2 Kết quả Kiểm thử Bảo mật qaToken (`npm run crm:demo-security-test`)
```text
> npm run crm:demo-security-test

=================================================
 [COHAMY CRM] TEST BẢO MẬT API DEMO: KHÔNG LỘ qaToken
  Kiểm thử người chưa đăng nhập không thể lấy token 
  hoặc đặt lại trái phép mật khẩu quản trị viên   
=================================================

[1/4] Gửi yêu cầu quên mật khẩu tài khoản Quản trị viên (admin)...
[DEMO SIMULATED EMAIL] To: admin@demo.cohamy.invalid | Subject: Đặt lại mật khẩu Cohamy
  Kết quả trả về từ requestPasswordReset(): {"accepted":true}
  -> PASS: Phản hồi công khai KHÔNG chứa qaToken.

[2/4] Kiểm tra qua HTTP Route Handler công khai POST /api/crm/security/forgot...
[DEMO SIMULATED EMAIL] To: admin@demo.cohamy.invalid | Subject: Đặt lại mật khẩu Cohamy
  Phản hồi JSON từ API route: {"accepted":true}
  -> PASS: API công khai POST /api/crm/security/forgot KHÔNG trả về qaToken.

[3/4] Thử đặt lại mật khẩu với token giả mạo hoặc thiếu token...
  -> PASS: Tất cả nỗ lực đặt lại mật khẩu bằng token giả mạo đều bị từ chối.

[4/4] Xác nhận mật khẩu quản trị viên vẫn an toàn, không bị thay đổi...
  -> PASS: Tài khoản quản trị viên được bảo vệ tuyệt đối.

=================================================
 ✅ TEST BẢO MẬT qaToken VÀ RESET MẬT KHẨU: PASS!
=================================================
```

---

### 6.3 Kết quả Kiểm thử Sentinel trên Database Dùng Một Lần (`npm run crm:demo-sentinel-test`)
```text
> npm run crm:demo-sentinel-test

=================================================
 [COHAMY CRM] TEST RESET CHỌN LỌC & SENTINEL     
  (Database dùng một lần - Isolated Single-use)  
=================================================

[0/5] Khởi tạo schema và catalog trên database dùng một lần (.local/crm-demo-sentinel-4579120f53)...
  -> PASS: Tất cả các chốt chặn allowlist database từ chối chính xác cơ sở dữ liệu thật/production.

[2/4] Trộn bản ghi demo và bản ghi sentinel (non-demo) vào database...
  -> Đã tạo thành công các bản ghi sentinel và các bản ghi demo.

[3/5] Kiểm thử cơ chế Rollback: khi có lỗi trong transaction reset, không có dữ liệu nào bị xóa mất...
  -> PASS: Rollback hoạt động hoàn hảo, bảo vệ toàn vẹn dữ liệu khi gặp lỗi.

[4/5] Thực thi resetDemoData()...
[DEMO RESET] Initializing targeted demo reset on [pglite] (.local/crm-demo-sentinel-4579120f53)...
[DEMO RESET] ✅ Hoàn tất xóa có chọn lọc toàn bộ bản ghi demo trong transaction an toàn.

[5/5] Kiểm tra tính bảo toàn của bản ghi Sentinel và xóa sạch bản ghi Demo...
  -> PASS: 100% bản ghi Sentinel (Tổ chức, Người dùng, Phân quyền, Sản phẩm, Kho, Bảng giá, Công nợ, Công việc, Phiếu hỗ trợ) CÒN NGUYÊN VẸN!
  -> PASS: Toàn bộ bản ghi thuộc batch Demo đã được xóa sạch (0 bản ghi demo còn lại).

  -> Kiểm tra bảo vệ trigger: append-only triggers vẫn HOẠT ĐỘNG...
  -> PASS: Trigger cohamy_crm.deny_audit_mutation() đang bảo vệ toàn vẹn audit events.

=================================================
 TEST RESET CHỌN LỌC VỚI SENTINEL: PASS TOÀN BỘ!
=================================================
  -> Đã dọn dẹp sạch sẽ database dùng một lần (.local/crm-demo-sentinel-4579120f53).
```

---

### 6.4 Kết quả Bộ kiểm thử Nghiệp vụ tự động (15/15 PASS)
File báo cáo: [`docs/crm/test-results/demo-verification.json`](file:///c:/Users/ACER/OneDrive/Desktop/cohamy-website-main/docs/crm/test-results/demo-verification.json)

| STT | Tên bài kiểm tra | Kết quả | Ghi chú bằng chứng |
|:---:|:---|:---:|:---|
| 1 | Xác thực đăng nhập thành công đủ 8 vai trò người dùng demo | **PASS** | Đăng nhập bcrypt thành công cho cả 8 tài khoản |
| 2 | Kiểm tra số lượng và liên kết dữ liệu Khách hàng (>= 10 bản ghi) | **PASS** | 10 khách hàng, có đủ nhãn VIP và ưu tiên gọi điện |
| 3 | Kiểm tra danh sách Đại lý và Hạn mức công nợ (>= 10 bản ghi) | **PASS** | 10 đại lý, tất cả đều có tài khoản tín dụng active |
| 4 | Kiểm tra Hồ sơ đăng ký đối tác (>= 10 bản ghi, có trạng thái chờ duyệt) | **PASS** | 10 hồ sơ, đủ 5 trạng thái nghiệp vụ thực |
| 5 | Kiểm tra Nhà cung cấp và Hồ sơ điều khoản thanh toán (>= 10 bản ghi) | **PASS** | 10 nhà cung cấp và điều khoản công nợ |
| 6 | Kiểm tra Danh mục 10 SKU, Đơn vị BASE/CASE và Bảng giá đang hiệu lực | **PASS** | 10 SKU có giá lẻ BASE và giá sỉ thùng CASE |
| 7 | Kiểm tra Báo giá (>= 10 bản ghi) và Bản in PDF lưu trữ nhị phân | **PASS** | 10 báo giá, PDF sinh nhị phân hợp lệ |
| 8 | Kiểm tra Sổ cái kho: Tồn kho thực tế và Cảnh báo lô cận hạn | **PASS** | Đầy đủ tồn kho thực và lô hàng HSD < 30 ngày |
| 9 | Kiểm tra Công việc chăm sóc (>= 10 việc: Quá hạn, Sắp tới, Hoàn thành) | **PASS** | 3 việc quá hạn, 4 việc sắp tới, 3 việc hoàn thành |
| 10 | Kiểm tra Cơ hội bán hàng và Lịch sử ghé thăm (>= 10 bản ghi) | **PASS** | 10 cơ hội kinh doanh và 10 nhật ký ghé thăm |
| 11 | Kiểm tra Đơn hàng thương mại và Đơn đặt hàng Website (>= 10 bản ghi) | **PASS** | 10 đơn website intake và đơn thương mại xác nhận |
| 12 | Kiểm tra Sổ cái công nợ: Phân tích tuổi nợ 30, 60, 90 ngày | **PASS** | Đủ 5 dải tuổi nợ (`NOT_DUE`, `0_30`, `31_60`, `61_90`, `OVER_90`) |
| 13 | Kiểm tra Phiếu hỗ trợ (>= 10) và Thư viện tài liệu đối tác (>= 10) | **PASS** | 10 phiếu ticket trao đổi 2 chiều và 10 tài liệu PDF |
| 14 | Kiểm tra Cách ly dữ liệu đa người dùng: Đại lý A KHÔNG xem được dữ liệu Đại lý B | **PASS** | Đại lý B truy cập đơn/ticket của Đại lý A bị từ chối `NOT_FOUND` |
| 15 | Xác nhận Chặn hoàn toàn gửi Email/SMS/Webhook ra bên ngoài trong môi trường DEMO | **PASS** | Brevo email bị intercept trả về `demo-msg-...`, zero external traffic |

---

### 6.5 Kết quả Bộ kiểm thử Trình duyệt Tương tác Playwright (10/10 PASS)
File báo cáo: [`docs/crm/test-results/demo-browser-smoke.json`](file:///c:/Users/ACER/OneDrive/Desktop/cohamy-website-main/docs/crm/test-results/demo-browser-smoke.json)

| Mã test | Kịch bản trình duyệt & Thao tác nghiệp vụ | Vai trò | Kết quả | Bằng chứng thao tác & Ảnh chụp |
|:---:|:---|:---:|:---:|:---|
| **B01** | Hiển thị Banner DEMO trên trang đăng nhập CRM | Khách | **PASS** | `01_crm_login_with_banner.png` (Banner màu cam nhận diện rõ) |
| **B02** | Đăng nhập Admin & Kiểm tra 10 Dashboard nghiệp vụ | Admin | **PASS** | `02_admin_dashboard.png` đến `11_admin_library_documents.png` (10 ảnh chụp toàn trang) |
| **B03** | **[DUYỆT]** Admin thẩm định & phê duyệt Hồ sơ đối tác (`/crm/applications/[id]`) | Admin | **PASS** | Chuyển trạng thái hồ sơ sang "Đã duyệt" & ghi nhật ký audit trail |
| **B04** | **[TẠO]** Sales tạo mới Khách hàng (`/crm/customers/new`) | Sales | **PASS** | Tạo thành công khách hàng "Khách Hàng Mới Demo - Chi Nhánh Cầu Giấy" |
| **B05** | **[SỬA / GHI CHÚ]** Sales thêm ghi chú chăm sóc khách hàng | Sales | **PASS** | Thêm nhật ký trao đổi trực tiếp vào dòng thời gian khách hàng |
| **B06** | Sales kiểm tra Cơ hội kinh doanh & Lịch sử ghé thăm đối tác | Sales | **PASS** | `12_sales_care_opportunities.png`, `13_sales_partner_visits.png` |
| **B07** | Warehouse kiểm tra Vị trí tồn kho & Quản lý cấp phát hàng mẫu | Warehouse | **PASS** | `14_warehouse_inventory_view.png`, `15_warehouse_sample_management.png` |
| **B08** | Accountant kiểm tra Sổ cái công nợ, Tuổi nợ 5 dải & Phiếu thu tiền | Accountant | **PASS** | `16_accountant_receivables.png` (Phân loại tuổi nợ đầy đủ) |
| **B09** | **[TẠO & SỬA]** Dealer A tạo Ticket hỗ trợ & Trả lời phản hồi | Dealer A | **PASS** | Tạo ticket khiếu nại & gửi tin nhắn trao đổi 2 chiều thành công |
| **B10** | Kiểm chứng Cách ly dữ liệu: Dealer B không thể thấy đơn của Dealer A | Dealer B | **PASS** | `17_portal_dealer_a_dashboard.png` đến `22_portal_dealer_b_dashboard.png` |

---

## 7. BÀN GIAO DANH SÁCH TỆP THAY ĐỔI & TRẠNG THÁI CAM KẾT

### 7.1 Danh sách Tệp Thay đổi (Modified Files)
1. **`lib/crm/account-security.ts`:**
   - Xóa bỏ `qaToken` khỏi môi trường `DEMO`. Chỉ trả về `{ accepted: true }`.
   - Giữ yêu cầu HTTPS cho môi trường production.
2. **`lib/crm/http.ts`:**
   - Bắt buộc kiểm tra origin HTTPS khi chạy với `NODE_ENV=production`.
3. **`lib/crm/db.ts`:**
   - Thêm bộ lọc allowlist kiểm tra tên database demo độc lập, từ chối tuyệt đối database production Cohamy.
4. **`scripts/crm/demo/reset.ts`:**
   - Viết lại quy trình reset: không đổi `session_replication_role`, không tắt trigger (`DISABLE TRIGGER ALL`), thực thi trong transaction duy nhất có rollback, xóa chọn lọc batch demo, che giấu mật khẩu trong log URL.
5. **`scripts/crm/demo/seed.ts`:**
   - Tôn trọng `CRM_DATABASE_MODE=postgres`, cơ chế seed idempotent 2 lần không trùng, không in plaintext password ra console log.
6. **`scripts/crm/demo/verify.ts`:**
   - Tôn trọng `CRM_DATABASE_MODE=postgres`, in tên database thực tế (`current_database()`), target kiểm tra chính xác.
7. **`scripts/crm/demo/browser-smoke.mjs`:**
   - Chọn cổng non-destructive (chọn cổng trống hoặc báo lỗi `PORT_OCCUPIED_ERROR`, không kill tiến trình ngoài).
   - Tích hợp proxy HTTPS nội bộ tuân thủ yêu cầu HTTPS production.
   - Không in mật khẩu hoặc chuỗi kết nối chứa mật khẩu ra log.
8. **`scripts/crm/demo/test-unauthenticated-reset.ts`:**
   - Kiểm thử bảo mật: người chưa đăng nhập không thể lấy `qaToken` và không thể đặt lại mật khẩu của Quản trị viên.
9. **`scripts/crm/demo/test-reset-sentinel.ts`:**
   - Kiểm thử an toàn reset trên database dùng một lần, chứng minh 100% bản ghi sentinel sống sót.
10. **`scripts/crm/demo/test-network-isolation.ts`:**
    - Kiểm thử cách ly mạng 0 outbound request, xác nhận không lộ `qaToken`.
11. **`package.json`:**
    - Bổ sung các lệnh kiểm thử: `crm:demo-security-test`, `crm:demo-sentinel-test`, `crm:demo-verify-db`, `crm:demo-network-test`.
12. **`docs/crm/DEMO_GUIDE.md`:**
    - Cập nhật đầy đủ bằng chứng thực chạy, phân biệt PGlite và PostgreSQL, bảng đối chiếu PASS/FAIL.

### 7.2 Cam kết Triển khai
- **Toàn bộ công việc thực hiện 100% CỤC BỘ (LOCAL).**
- **KHÔNG thực hiện `git commit`.**
- **KHÔNG thực hiện `git push`.**
- **KHÔNG thực hiện `deploy`.**
- **Chờ lệnh trực tiếp từ người phụ trách trước khi commit hoặc deploy.**
