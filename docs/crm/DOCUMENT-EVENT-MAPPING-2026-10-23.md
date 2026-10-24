# Mapping chứng từ và email Cohamy — 23/10/2026

Phạm vi tài liệu: source và bằng chứng thử nghiệm của luồng đề nghị → nhà máy → kho → đối chiếu/VAT; tích hợp email vào nghiệp vụ thương mại hiện có. Chưa triển khai hoặc chạy migration production. Không có lần gửi Brevo thật trong đợt kiểm thử này.

## Cách đọc mapping

- `FLOW`: snapshot và PDF bất biến ở `cohamy_crm.document_flow_revisions`; job lưu ID revision, tên file và checksum.
- `VAT`: bytes file gốc ở `document_versions`, liên kết phiên bản đã khóa ở `document_vat_links`; không lấy file tạm hoặc tự chọn phiên bản mới nhất lúc gửi.
- `BUSINESS`: `document_business_snapshots` lưu bản chụp record, version, các bảng con, kết quả sự kiện và PDF sinh tại transaction nghiệp vụ. Đây là PDF trình bày dữ liệu snapshot bằng `renderBusinessPdf`, chưa có chứng nhận giống từng mẫu biểu thương mại sẵn có.
- `PRIVATE`: file gốc `document_versions` được tìm bằng các khóa `document_version_id`, `documentVersionId`, `photo_document_id`, `signature_document_id` trong snapshot; chỉ đính kèm đúng ID đã ghi nhận.
- `OBSERVED`: đã có job và đối chiếu ID/tên/checksum file trong các artifact `events-verify-*.json`; không đồng nghĩa mọi nhánh, phạm vi hoặc gửi qua nhà cung cấp đã được kiểm thử.
- `HOOK`: registry và service có đường gọi thật; chưa thấy nhánh đó trong các capture nêu ở cuối tài liệu.
- `SOURCE_MAPPING_PASS`: replay riêng action registry trên record đã có trong fixture để kiểm tra snapshot/PDF/file. Đây không phải bằng chứng service đã thực hiện chuyển trạng thái đó; giữ tách khỏi capture OBSERVED.

Nguồn registry: `lib/crm/document-mail-model.ts` có 9 core event; `lib/crm/document-business-registry.ts` có 80 business event khả dụng và 1 event đánh dấu chưa có nghiệp vụ. Các loại/sự kiện được cấu hình riêng, không gộp thành một công tắc gửi chung.

## Quy tắc người nhận và tài liệu chung

`enqueueDocumentMail()` trong `lib/crm/document-mail.ts` chỉ chọn rule đúng event, đang bật, khớp `warehouse_id` và `factory_membership_id` nếu rule có giới hạn. Admin chủ động nhập To/CC/BCC; không cần tạo tài khoản CRM cho email ngoài. Địa chỉ chuẩn hóa chữ thường, loại trùng trong rule và giữa các rule chồng lấn của cùng event/version. Rule bật phải có To. Rule mới mặc định tắt/chưa có người nhận, không phát lại chứng từ lịch sử khi lưu hoặc bật.

Job chụp người nhận, subject/body đã thay biến, file ID/tên/checksum và revision ngay trong transaction chốt nghiệp vụ. Worker đọc bytes từ DB sau commit, kiểm tra checksum rồi gọi `sendDocumentEmail()`. Cài đặt cá nhân trong notification outbox không điều khiển danh sách email do Admin cấu hình.

`EVENT` gửi file của sự kiện. Với core flow, `BUNDLE` bổ sung đúng revision nguồn và đề nghị; VAT còn có thể kèm phiếu flow mà VAT gắn vào. Với business event, snapshot đã chứa record/version/bảng con và file PRIVATE tìm được; envelope hiện không có `sourceId`/`requestId` cho việc mở rộng bộ FLOW. Không diễn giải `BUNDLE` business thành đã tự gom mọi chứng từ liên quan của phân hệ.

Core flow có kho và nhà máy cụ thể. Business event chụp `envelope`, file và danh sách loại trừ vào snapshot bất biến. Phạm vi kho lấy từ record/version/bảng con; truy vị trí, reservation, batch ký gửi, movements của phiếu nhận/khiếu nại và accounting-order-clearance khi cần. Điều chuyển dùng kho nguồn/đích theo event. Nếu có nhiều kho, không chọn một kho tùy ý: `warehouseId` rỗng và rule kho không khớp.

API trả capability từng event; UI khóa bộ chọn không hỗ trợ và service từ chối `MAIL_SCOPE_NOT_SUPPORTED`. Business không có phạm vi nhà máy. Phạm vi kho được hỗ trợ cho yêu cầu/đơn bán, nhận mua/khiếu nại NCC, thỏa thuận/gửi/báo bán/hoàn trả ký gửi, giao nhận/trả hàng, điều chuyển/kiểm kê/chứng từ kho. Báo giá bán, đề nghị mua/RFQ/báo giá NCC/đơn mua, settlement/replenishment ký gửi, payment/cash/payable chưa có ngữ cảnh kho đủ rõ: chỉ dùng rule không giới hạn kho. Rule cũ dùng phạm vi không hỗ trợ được hiện rõ để Admin xóa hoặc sửa; không âm thầm coi là đã hoạt động.

Chống trùng RFQ còn loại email đã được pipeline RFQ trực tiếp gửi thành công khỏi rule chứng từ; danh sách loại trừ được chụp cùng snapshot. Xem trước rule mô phỏng cả loại trùng theo thứ tự các rule khớp, giữ parity với enqueue. `{{url}}` core mở PDF phiên bản đã chốt qua endpoint có đăng nhập/quyền; yêu cầu/báo giá/đơn bán mở route chi tiết; tài chính/kho mở module hiện hữu, các nghiệp vụ chưa có màn hình chi tiết dùng tìm mã tại `/crm/search`.

## Đủ 21 nhóm trong yêu cầu

| # | Chứng từ / event cấu hình | Service/action thật và mốc ghi | Snapshot/file | Phạm vi và bằng chứng |
| --- | --- | --- | --- | --- |
| 1 | `factory.request.sent`; `factory.request.accepted` | `document-flow.ts`: `saveFlowDocument`/`confirmFlowDocument` chốt REQUEST; `acceptFactoryRequest` ghi lần tiếp nhận | FLOW của REQUEST. Tiếp nhận dùng cùng revision PDF đề nghị, body trạng thái ACCEPTED; không sinh hóa đơn tài chính | Kho nhận + membership nhà máy của đề nghị. Hai event OBSERVED trong `events-verify-inventory.json`; browser tạo/gửi/tiếp nhận PASS |
| 2 | `factory.dispatch.confirmed` | `document-flow.ts`: chốt DISPATCH từ REQUEST đã xác nhận và tiếp nhận; khóa nguồn, kiểm tra SKU/kho/tổng giao còn lại | FLOW DISPATCH có `sourceId/sourceRevision`, mã đề nghị và lượng gửi | Kho nhận + nhà máy được giao. OBSERVED; core integration và browser PASS. Xác nhận chuyển chưa cộng tồn kho nhận |
| 3 | `factory.receipt.confirmed` | `document-flow.ts`: chốt RECEIPT từ DISPATCH; `moveStock` ghi thực nhận trong cùng transaction | FLOW RECEIPT, số gửi/nhận/chênh lệch, liên kết DISPATCH/REQUEST | Đúng kho nhận + nhà máy nguồn. OBSERVED; nhận 100 và 98/100 được kiểm thử |
| 4 | `factory.receipt.discrepancy`; `factory.discrepancy.resolved` | RECEIPT có `difference != 0` tạo event chênh lệch sau xác nhận; event chốt biên bản xử lý riêng có `available:false` | FLOW RECEIPT thật; BUNDLE có hai phiếu nguồn. Không tạo biên bản ký giả | Nghiệp vụ nhận lệch và event/file chênh lệch PASS qua core integration nhóm 19. Chốt biên bản xử lý riêng: **Chưa có nghiệp vụ**, UI không cho bật |
| 5 | `audit:commercial-request.submitted` | `order-requests.ts`: `requestAction`; `sales-orders.ts`: `submitSalesRequest`; hook audit ở `auth.ts` và hook trực tiếp đường submit | BUSINESS từ `commercial_requests` + `commercial_request_versions` tại phiên bản đã gửi | Kho nguồn/snapshot hoặc accounting-order-clearance; nhiều kho không khớp rule kho. OBSERVED: commercial-orders/inventory/finance/fulfillment |
| 6 | `audit:quotation.sent`, `.accepted`, `.rejected`, `.revision_requested` | `quotations.ts`: `quotationAction`; `auth.ts audit()` chuyển vào business hook trong transaction | BUSINESS từ `quotations` + `quotation_versions` theo versionId/sent/current version | Chưa hỗ trợ rule kho. Sent/accepted OBSERVED; rejected/revision_requested mới HOOK |
| 7 | `audit:sales-order.confirmed`, `.amended`, `.cancelled` | `sales-orders.ts`: `salesOrderAction`; hook audit | BUSINESS từ `sales_orders` + `sales_order_versions`; amendment giữ version tương ứng | Kho nguồn/snapshot hoặc accounting-order-clearance. Cả 3 OBSERVED (`events-verify-inventory.json`), confirm còn có commercial-orders |
| 8 | `warehouse.issue.confirmed` | `document-flow.ts`: chốt ISSUE, kiểm tra khả dụng/giữ hàng, `moveStock`; chặn đơn đã xuất qua luồng khác | FLOW ISSUE; PDF giao hàng theo layout/logo trích từ đúng Word gốc, tiền server lấy nguồn | Kho xuất. OBSERVED; core integration và form browser chứng minh preview không trừ tồn, xác nhận trừ một lần. Browser kiểm cả phiếu không đơn nguồn, phần tiền trống/chỉ đọc; lưu `browser-issued.pdf`. Chưa chứng nhận khớp Microsoft Word 100% |
| 9 | `fulfillment:DELIVERY_DELIVERED`, `fulfillment:DELIVERY_FAILED` | `fulfillment.ts`: `finishDelivery`; `remember()` hook sau cập nhật kết quả giao | BUSINESS `deliveries` + `delivery_lines`, `delivery_proofs`; PRIVATE ảnh/chữ ký đúng version nếu có | `deliveries.warehouse_id` nếu có. Cả hai OBSERVED trong fulfillment; không tự phát hành VAT |
| 10 | `vat.saved`, `vat.replaced` | `workspace.ts` upload → `document-vat.ts guardFlowUpload/sealVatUpload`; lần đầu lưu khóa; Admin thay thế tạo link revision mới, bắt lý do | VAT bytes gốc `document_versions`; link bất biến `document_vat_links`, `source_revision` giữ revision flow đã chốt. Nhập gắn DISPATCH của cặp nhập, xuất gắn ISSUE | Kế thừa phạm vi của phiếu flow, file tải kiểm quyền server. Upload/khóa/bytes đúng và cấm thay lách PASS; core nhóm 19 tạo thật cả saved/replaced và kiểm file; business-mail xác nhận BUNDLE/preview giữ source_revision cũ sau đính chính |
| 11 | `inventory:TRANSFER_SHIPPED`, `inventory:TRANSFER_RECEIVED` | `inventory.ts`: `shipTransfer`, `receiveTransfer`; `remember()` hook | BUSINESS `inventory_transfers` + `inventory_transfer_receipts`; nhận lệch thể hiện dữ liệu nhận thực tế | Shipped dùng `source_warehouse_id`, received dùng `destination_warehouse_id`. Hai event OBSERVED, có nhiều lần nhận |
| 12 | `fulfillment:RETURN_REQUESTED`, `RETURN_APPROVE`, `RETURN_REJECT`, `RETURN_RECEIVED` | `fulfillment.ts`: `requestReturn`, `decideReturn`, `receiveReturn` | BUSINESS `return_requests` + `return_request_lines`, liên kết nguồn trên record | Kho trực tiếp nếu có. Requested/approve/received OBSERVED; reject mới HOOK |
| 13 | `consignment:AGREEMENT_ACCEPTED`, `CONSIGNMENT_SHIPPED`, `CONSIGNMENT_RECEIVED` | `consignment.ts`: `acceptAgreement`, `shipConsignment`, `receiveConsignment` | BUSINESS `consignment_agreements` + version; shipment + `consignment_batches`; nhận thêm `consignment_receipts` | Kho trực tiếp nếu có; không tự suy phạm vi nhà máy. Cả ba OBSERVED |
| 14 | `consignment:SALE_REPORTED`, `SETTLEMENT_CREATED`, `SETTLEMENT_ACCEPTED`, `SETTLEMENT_DISPUTED`, `SETTLEMENT_ADJUSTED` | `consignment.ts`: `submitSaleReport`, `createSettlement`, `actSettlement`, `adjustSettlement` | BUSINESS `consignment_sale_reports` + `consignment_sale_lines`; `consignment_settlements` và dữ liệu snapshot trên record | Kho trực tiếp nếu có. Sale/created/accepted/adjusted OBSERVED; disputed mới HOOK. Chỉ thông báo sự kiện hiện có |
| 15 | `consignment:REPLENISHMENT_APPROVE`, `REPLENISHMENT_REJECT`; `CONSIGNMENT_RETURN_REQUESTED`, `..._APPROVE`, `..._REJECT`, `..._SHIP`, `..._RECEIVE` | `consignment.ts`: `decideReplenishment`, `requestConsignmentReturn`, `actConsignmentReturn` | BUSINESS `consignment_replenishments`; `consignment_returns` + `consignment_return_lines` | Approve bổ sung và requested/approve/ship/receive hoàn trả OBSERVED; hai nhánh reject mới HOOK. `suggestReplenishment` chỉ sinh gợi ý DRAFT, **không có sự kiện gửi đề nghị bổ sung riêng**; không gửi gợi ý như phiếu đã phát hành |
| 16 | `procurement:PURCHASE_REQUESTED`, `PURCHASE_REQUEST_APPROVE/REJECT`; `RFQ_CREATED`, `RFQ_DISPATCHED`, `SUPPLIER_QUOTE_ADDED`; `SUPPLIER_SELECTED`, `PURCHASE_ORDER_APPROVE/CANCEL`, `PURCHASE_ORDER_AMENDED` | `procurement.ts`: `createPurchaseRequest`, `decidePurchaseRequest`, `createRfq`, `dispatchRfq`, `addSupplierQuote`, `selectSupplierQuote`, `decidePurchaseOrder`, `amendPurchaseOrder` | BUSINESS lần lượt từ `purchase_requests` + lines; `supplier_rfqs` + version; `supplier_rfq_dispatches`; `supplier_quotes`; `purchase_orders` + lines | Rule riêng từng event/loại; không hỗ trợ rule kho ở bộ chứng từ này vì schema không có phân bổ kho đủ rõ. RFQ loại người đã nhận qua pipeline trực tiếp. OBSERVED tất cả trừ purchase-request reject và purchase-order cancel |
| 17 | `procurement:GOODS_RECEIVED`; `SUPPLIER_CLAIM_OPENED`, `..._ACKNOWLEDGED`, `..._RESOLVED`, `..._REJECTED` | `procurement.ts`: `receivePurchaseOrder`, `createSupplierClaim`, `updateSupplierClaim` | BUSINESS `goods_receipts` + `goods_receipt_lines`; `supplier_claims`; PRIVATE tài liệu khiếu nại đúng version nếu có | Suy kho từ movements của inventory_document nguồn; khiếu nại đi qua receipt_line → receipt. Received/opened/acknowledged/resolved OBSERVED; rejected mới HOOK |
| 18 | `finance:PAYMENT_PROOF_SUBMITTED`, `..._CONFIRMED`, `..._REJECTED`; `PAYMENT_RECEIPT_CREATED`, `..._CONFIRMED`; `PAYMENT_ALLOCATED`; `CASH_COLLECT_REQUESTED/APPROVE/REJECT/EXECUTE/REVERSE` | `finance.ts`: `createPaymentReceipt`, `reviewPaymentReceipt`, `allocatePayment`, `createCashRequest`, `actCashRequest`; business hook phân loại PAYMENT_CREATED/REVIEWED theo proof và trạng thái | BUSINESS `payment_receipts` + `bank_transfer_proofs` hoặc `payment_allocations`; PRIVATE bằng chứng gốc; `cash_requests` cho COLLECT | Không cấp lại quyền ghi tiền cho ACCOUNTANT. Proof submitted/confirmed, receipt created/confirmed, allocated OBSERVED; proof rejected và 5 COLLECT mới HOOK |
| 19 | `finance:CASH_PAY_*`, `CASH_REFUND_*`, `DEPOSIT_REFUND_REQUESTED`, `CASH_DEPOSIT_REFUND_APPROVE/REJECT/EXECUTE/REVERSE`; `procurement:SUPPLIER_PAYMENT_CREATED/APPROVE/EXECUTE/REVERSE` | `finance.ts`: `createCashRequest`, `requestDepositRefund`, `actCashRequest`; `procurement.ts`: `createSupplierPayment`, `actSupplierPayment` | BUSINESS `cash_requests`; `supplier_payments` + `supplier_payment_allocations` | Không hỗ trợ rule kho; event không thực hiện giao dịch tiền ngoài service gốc. Hoàn cọc requested/approve/execute/reverse, REFUND requested/approve/execute/reverse và cả 4 supplier-payment OBSERVED; PAY 5 nhánh, REFUND reject và hoàn cọc reject mới HOOK. Source NCC không có action REJECT nên không liệt kê như đang hoạt động |
| 20 | `inventory:COUNT_POSTED`, `DOCUMENT_REVERSED`, `RECEIPT_POSTED` | `inventory.ts`: `approveStockCount`, `reverseDocument`, `postReceipt` | BUSINESS `stock_counts`; `inventory_documents` + `inventory_movements` cho đảo/nhập | COUNT dùng `warehouse_id`; inventory document suy đúng một kho từ movements. Ba event OBSERVED. Điều chỉnh bù trừ core nằm trong nhóm 21 |
| 21 | `document.amended`, `vat.replaced`; event sửa/hủy riêng ở nhóm 6/7/14/16 | `document-flow.ts amendFlowDocument`: chỉ ADMIN, lý do/version, transaction, bút toán delta khi ảnh hưởng tồn; VAT: tài liệu mới/link mới; các phân hệ khác dùng quyền và action sẵn có | FLOW revision cũ và mới, audit trước/sau, `document_flow_reservation_adjustments` khi dùng giữ hàng; VAT giữ file/link cũ; BUSINESS theo service gốc | Core sửa RECEIPT/ISSUE và bảo toàn PDF cũ PASS; core nhóm 19 tạo thật amended/replaced và kiểm file. Không có cơ chế chung Admin hủy/thay thế mọi loại; chỉ event thật nêu trong registry |

## Chứng từ ngoài danh sách 21 nhóm

`procurement:PAYABLE_POSTED` là event có thật bổ sung trong registry, nguồn `procurement.ts postPayable`, snapshot BUSINESS từ `payables`. Đã OBSERVED trong procurement capture. Đây là thông báo ghi công nợ NCC, không phải thao tác email làm phát sinh tiền.

Email bảo mật/đặt lại mật khẩu và RFQ gửi NCC trực tiếp hiện hữu tiếp tục có mục đích, pipeline và người nhận riêng. Không trộn rule chứng từ vào danh sách nhận mã bảo mật. Business-mail test chứng minh loại người RFQ đã nhận trực tiếp và dedup rule; chưa có kiểm thử mailbox thật giữa mọi pipeline.

## Mapping đầy đủ placeholder Word giao hàng

Mẫu duy nhất: `C:\Users\ACER\Downloads\Hoa_Don_Giao_Hang_COHAMY.docx`. Bản sao giữ nguyên bytes trong `assets/crm/delivery-template/Hoa_Don_Giao_Hang_COHAMY.docx`, SHA-256 `6aa3889e7c1b772e436b754080beaaa02aa150176991f7498690fab53627ac3e`. Không dùng `Mau_Hoa_Don_Dat_Hang_Cohamy.docx` thay mẫu. Nguồn mapping: `deliveryPlaceholders()` và `renderDeliveryPdf()` trong `lib/crm/document-flow-pdf.ts`; nguồn dữ liệu snapshot: `prepare()` trong `lib/crm/document-flow.ts`.

| Placeholder | Nguồn snapshot / quy tắc |
| --- | --- |
| `MA_PHIEU_GIAO` | `FlowSnapshot.code`, tự sinh GH-ngày-ID |
| `MA_DON_HANG` | `sourceCode` của order-clearance nguồn; thiếu hiển thị `—` |
| `NGAY_LAP` | `confirmedAt ?? createdAt`, định dạng vi-VN, múi giờ Asia/Ho_Chi_Minh |
| `NGUOI_GIAO` | `delivery.giver`; nguồn mặc định tên người thao tác, kho có thể điền giao nhận thực tế |
| `SDT_NGUOI_GIAO` | `delivery.giverPhone`; không tự suy số điện thoại |
| `KHO_XUAT` | `warehouseName` chụp từ kho có quyền |
| `TEN_DOI_TAC` | `delivery.customer` từ `order_clearances.organization_name`; phiếu không nguồn phải điền bên nhận |
| `NGUOI_NHAN_HANG` | `delivery.recipient`, ưu tiên `snapshot.delivery.recipient`, sau đó `orderer_name`, hoặc thông tin kho bổ sung |
| `SDT_NHAN_HANG` | `delivery.recipientPhone`, nguồn delivery.phone/orderer_phone hoặc bổ sung |
| `DIA_CHI_GIAO_HANG` | `delivery.address`, nguồn delivery.address hoặc bổ sung |
| `NGAY_GIAO`, `GIO_GIAO` | `delivery.deliveryDate`, `delivery.deliveryTime`, thông tin thực tế |
| `DON_VI_VAN_CHUYEN` | `delivery.carrier`, thông tin giao nhận bổ sung |
| `TONG_SL_GIAO` | Tổng `lines[].quantity` bằng decimal fixed, không dùng tổng đặt |
| `TONG_SO_THUNG` | `delivery.packages`; thiếu `—`, không mặc định số kiện |
| `SL_CHENH_LECH` | `delivery.shortage`; ghi nhận giao nhận thực tế, không tự giả hàng hoàn |
| `TINH_TRANG_HANG` | `delivery.condition`; thiếu `—` |
| `TIEN_HANG` | `totals.goods`: phân bổ `listLineTotal` nguồn theo lượng thực xuất; thiếu tiền ở phiếu không nguồn hiển thị `—` |
| `CHIET_KHAU` | `totals.discount = goods - tổng amount` lấy giá/dòng nguồn |
| `PHI_VAN_CHUYEN` | `totals.shipping`: `snapshot.totals.shippingFee` nguồn ở phiếu đầu; các phiếu sau bằng 0 để tránh tính lặp |
| `TONG_THANH_TOAN` | `totals.total = tổng amount + shipping`, phép tính server bằng integer/decimal |
| `DA_THANH_TOAN` | `totals.paid` từ `order_clearances.paid_amount`; không tạo phiếu thu khi sinh PDF |
| `CON_PHAI_THU` | `totals.remaining = max(total-paid, 0)` theo snapshot đang chốt |
| `GHI_CHU_GIAO_NHAN` | `delivery.note`, sau đó `FlowSnapshot.note`, thiếu `—` |
| `SO_TIEN_BANG_CHU` | `vndToVietnameseWords(totals.total)`, thiếu tổng tiền hiển thị `—` |

7 cột động giữ thứ tự mẫu: STT = chỉ số dòng; tên/quy cách/mã = `line.name` + `line.sku`; ĐVT = `line.unit`; SL đặt = `line.ordered`; SL giao = `line.quantity`; đơn giá = `line.unitPrice`; thành tiền = `line.amount`. Giá và số tiền lấy immutable lines của order-clearance, dùng `roundRatio`/`lineAmount` với HALF_UP; kho chỉ được bổ sung trường giao nhận cho phép. Header, logo, nội dung tĩnh, khung bảng, màu và footer lấy `assets/crm/delivery-template/layout.json`/`logo.png`. Số dòng không giới hạn theo sáu dòng trống; có ngắt trang/lặp đầu bảng.

Phiếu ISSUE có nguồn bắt buộc còn thiếu người giao, người nhận, số nhận, địa chỉ, ngày giao hoặc đơn vị/hình thức giao sẽ báo `DELIVERY_REQUIRED_*` khi xác nhận. Nháp được xem trước; thiếu không áp dụng hiển thị `—`. Ba vùng chữ ký giữ nhãn mẫu; không chèn chữ ký giả.

## Bằng chứng và phần chưa phủ

Các capture dưới `docs/crm/test-results/document-flow/` hiện ghi 63 tên event khác nhau; trong đó có 5 core và 58 business. 22/80 business event chưa chạy nhánh nghiệp vụ thực, được liệt kê là HOOK trong 21 hàng trên. Capture OBSERVED chỉ chứng minh event đã phát sinh ở service thật và file reference đúng; không chứng minh nội dung PDF của mọi loại đã được người dùng duyệt.

Core integration nhóm 19 chạy thật và kiểm mail/file của **9/9 core event** trên PGlite và native PostgreSQL. Hợp với 58 business event thực là **67/89 event khả dụng có bằng chứng service**, khác với số 63 chỉ trong sáu capture domain.

Sáu file `source-mapping-verify-*.json` phủ đủ **80/80 business event khả dụng** bằng dữ liệu các fixture hiện hữu, render PDF và kiểm bytes/file qua `mailFiles`. Mỗi dòng có `SOURCE_MAPPING_PASS`, `NO_SOURCE_IN_FIXTURE` hoặc `NO_TABLE`; hợp của các suite có PASS cho toàn bộ 80 event. Replay này không thay đổi trạng thái chứng từ nghiệp vụ và không được cộng vào 58 event thực.

22 nhánh dưới đây có SOURCE_MAPPING_PASS nhưng chưa có thực thi service thực riêng:

| Nhóm | Event chưa chạy nhánh thực |
| --- | --- |
| Báo giá | `audit:quotation.rejected`, `audit:quotation.revision_requested` |
| Mua hàng | `procurement:PURCHASE_REQUEST_REJECT`, `procurement:PURCHASE_ORDER_CANCEL`, `procurement:SUPPLIER_CLAIM_REJECTED` |
| Proof | `finance:PAYMENT_PROOF_REJECTED` |
| Thu tiền mặt | `finance:CASH_COLLECT_REQUESTED`, `CASH_COLLECT_APPROVE`, `CASH_COLLECT_REJECT`, `CASH_COLLECT_EXECUTE`, `CASH_COLLECT_REVERSE` |
| Chi tiền | `finance:CASH_PAY_REQUESTED`, `CASH_PAY_APPROVE`, `CASH_PAY_REJECT`, `CASH_PAY_EXECUTE`, `CASH_PAY_REVERSE` |
| Hoàn tiền/cọc | `finance:CASH_REFUND_REJECT`, `finance:CASH_DEPOSIT_REFUND_REJECT` |
| Ký gửi | `consignment:SETTLEMENT_DISPUTED`, `consignment:REPLENISHMENT_REJECT`, `consignment:CONSIGNMENT_RETURN_REJECT` |
| Khách trả | `fulfillment:RETURN_REJECT` |

| Artifact | Phạm vi |
| --- | --- |
| `events-verify-commercial-orders.json` | Gửi yêu cầu, gửi/chấp nhận báo giá, xác nhận đơn |
| `events-verify-inventory.json` | Core request/accept/dispatch/receipt/issue, sửa/hủy đơn, điều chuyển, kiểm kê, đảo, nhập khác |
| `events-verify-procurement.json` | Đề nghị mua/RFQ/báo giá/đơn mua/nhận/khiếu nại/NCC/công nợ |
| `events-verify-consignment.json` | Thỏa thuận/gửi/nhận/báo bán/đối soát/bổ sung/hoàn trả |
| `events-verify-fulfillment.json` | Giao thành công/thất bại và yêu cầu/duyệt/nhận trả |
| `events-verify-finance.json` | Proof/phiếu thu/phân bổ/hoàn cọc; đối chiếu kết quả suite finance ở handoff |
| `integration-pglite.json`, `integration-postgres.json` | 19 nhóm core PASS ở PGlite và native PostgreSQL local, về tồn, nguồn, RBAC, khóa, VAT, atomicity, outbox/provider giả và đủ 9 core event thật |
| `browser-local.json` | 7 nhóm UI/API qua Edge trên PGlite riêng; có form xuất không đơn nguồn, preview không đổi tồn và xác nhận trừ 1; không gửi email ngoài |
| `provider-fake.json` | 5 nhóm Brevo fetch giả, payload/To/CC/BCC/file, phân loại lỗi, DEMO, xác thực webhook |
| `outbox-states-pglite.json` | 10 nhóm trạng thái/retry/crash recovery/deferred/bounce/webhook sớm hoặc sai thứ tự; provider giả, `networkAttempts=0` |
| `business-mail-local.json` | 5 nhóm preview BUSINESS bất biến, capability phạm vi, quyền Admin, loại trùng RFQ, rule chồng lấn và BUNDLE giữ đúng revision FLOW/VAT |

Xem trước job đã phát sinh hiển thị snapshot người nhận/nội dung/file thật. Xem trước rule hỗ trợ FLOW và BUSINESS qua bộ chọn phiên bản đã lưu, dùng envelope/files/exclusions của snapshot; không sinh email. Trước khi có snapshot BUSINESS cho event đó, UI báo cần phiên bản đã lưu, không tạo một phiếu giả để xem trước.

Không có bằng chứng gửi mailbox thật, webhook Brevo thật, staging server dùng chung hoặc production. API Brevo trả `messageId` chỉ được hiển thị ACCEPTED; DELIVERED cần webhook hợp lệ cho toàn bộ người nhận. Kết quả gửi không rõ giữ UNKNOWN để Admin kiểm tra trước khi gửi lại có chủ đích.
