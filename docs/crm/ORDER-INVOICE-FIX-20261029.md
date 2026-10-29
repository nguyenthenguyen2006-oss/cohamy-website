# Sửa giá và PDF hóa đơn đặt hàng — 29/10/2026

## Phạm vi và trạng thái

Bản sửa dành cho **Hóa đơn đặt hàng / Phiếu xác nhận yêu cầu đặt hàng**. Đây không phải hóa đơn thuế. Luồng VAT, kho, công nợ và email chứng từ giữ nguyên.

**Đã triển khai production** commit `048a0f1324b0be2cee9732001f0e19e25af1a45e` lên https://cohamy.vn. LOCAL, PostgreSQL QA, candidate và HTTPS production đều PASS. Bằng chứng ở `test-results/order-invoice/production-release.json` và `native-mcp-live.json`.

## Lỗi và nguyên nhân gốc

| Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|
| Tiền từng dòng cao hơn số thực trả | Mapper lấy `gross` và `unitPrice` trước CK đơn, trong khi tổng cuối đã giảm | Dùng `discount/net` đã phân bổ trong bản tính backend; tách đủ ba mức giá |
| Thiếu giá niêm yết khi nhập giá riêng hoặc dùng bậc số lượng | Metadata cũ thiếu giá gốc hoặc chứa giá đã giảm theo bậc | Lấy giá niêm yết từ chính sách đã chụp cùng chứng từ; bổ sung metadata cho bản tính mới |
| Form tạm tính lệch backend | Form dùng Number/Math.round theo từng dòng và chưa biết chính sách riêng | Dùng lại calculator số nguyên cho ước tính; nhận kết quả backend sau debounce và bỏ phản hồi đã cũ |
| Tổng số lượng 20 hiển thị thành 2 | Regex xóa cả số 0 ở cuối phần nguyên | Định dạng fixed decimal, giữ nguyên phần nguyên |
| Mã hóa đơn/yêu cầu chồng nhau | Khung cao cố định và text tiếp nối | Đo chiều cao nội dung, cho mã dài xuống dòng và đặt tọa độ độc lập |
| Sáu sản phẩm thành hai trang | Dự trữ chiều cao bảng/tổng/chữ ký quá lớn | Đo từng dòng và khối tổng kết; giữ dòng cuối với tổng và chữ ký |
| Bản in A4 và PDF khác nhau | Hai template/cách tính hiển thị không thống nhất | Cùng payload backend; CSS in A4, lặp thead, tránh ngắt dòng và có số trang |
| Mã đối tác nội bộ xuất hiện ở trường thuế | businessId được đưa thẳng sang PDF | Chỉ hiển thị chuỗi đúng định dạng mã thuế; không sửa dữ liệu hồ sơ và không tuyên bố đã xác minh pháp lý |
| Mất thuế/phí ở tổng PDF | Template tự tính subtotal trừ CK | Giữ tổng backend, hiển thị thuế/phí riêng và cộng đúng một lần |
| Có thể gửi giá tùy ý khi POST PDF | Endpoint tin tiền do client gửi | Bắt buộc nguồn REQUEST/ORDER/DRAFT; đọc/tính lại theo quyền và so khớp mọi dòng/tổng; lệch trả 409 |
| Đơn nhiều dòng không xuất được | Trần JSON 32 KiB dùng chung | Chỉ tăng hạn mức invoice-preview 128 KiB, invoice-pdf 1 MiB; giữ các API khác ở mức cũ |

## Công thức và đối chiếu

```text
line_subtotal = effective_base_unit_price × base_quantity (làm tròn theo chính sách)
order_discount = làm tròn(sum(line_subtotal) × basis_points / 10000)
allocated_line_discount = phân bổ theo tỷ trọng, chia phần dư theo thứ tự ổn định
line_final_total = line_subtotal - allocated_line_discount
merchandise_total = sum(line_final_total)
total_payable = merchandise_total + tax + fee
final_display_unit_price = line_final_total / số lượng theo ĐVT đã chọn
```

Tiền và phân bổ dùng BigInt/fixed decimal. Đơn giá hiển thị có tối đa 6 số thập phân; nếu phải làm tròn sẽ có dấu xấp xỉ và ghi chú. **Thành tiền từng dòng là số tiền chính xác.** Không trừ CK lần thứ hai khi cộng các dòng cuối.

Mẫu `HD-20261029-52E60EA4` là **phiên bản 1**, gồm 6 dòng / 20 gói:

| Chỉ tiêu | VND |
|---|---:|
| Tổng giá niêm yết | 1.387.000 |
| Giảm giá sản phẩm | -57.000 |
| Tiền trước CK đơn | 1.330.000 |
| CK đơn 25% | -332.500 |
| **Tổng thanh toán** | **997.500** |

Theo yêu cầu cập nhật, bảng có hai cột giá riêng: **Giá gốc** và **Giá sau KM & CK** (giá cuối). Nếu cần giải thích giá riêng trước CK đơn, thông tin này nằm dưới tên sản phẩm.

Đơn giá cuối lần lượt: 59.250; 45.000; 61.500; 24.000; 67.500; 59.250. Tổng sáu dòng là 997.500.

Runtime còn có **phiên bản 2**, 8 dòng / 40 gói, CK 30%, tổng **2.030.000**. Không thay bản 2 bằng mẫu bản 1. Hai checksum được kiểm tra lại trước và sau triển khai.

## File thay đổi

- `lib/crm/order-invoice-pricing.ts`: phép chiếu giá từ snapshot, kiểm tra tổng, định dạng số lượng/tiền/mã thuế.
- `lib/crm/order-invoice-model.ts`: payload ba mức giá và nguồn chứng từ, tổng thuế/phí chính xác.
- `lib/crm/order-invoice-pdf.ts`: lấy payload có kiểm soát quyền và xác minh lại POST PDF.
- `lib/crm/order-invoice-renderer.ts`: PDFKit A4, font tiếng Việt, đo chiều cao và phân trang.
- `lib/crm/pricing-model.ts`: bổ sung giá niêm yết trong metadata, giữ nguyên phép tính tiền/duyệt.
- `lib/crm/order-basket-estimate.ts`: dùng calculator chung cho ước tính giao diện.
- `components/crm/CommercialProductGrid.tsx`, `CommercialForms.tsx`, `OrderForms.tsx`: giá tạm tính và kết quả backend theo đúng đối tác/giỏ hiện tại.
- `components/crm/OrderPages.tsx`: payload từ dịch vụ theo đúng phiên bản đã chọn.
- `components/crm/OrderInvoiceModal.tsx`, `order-invoice.css`: xem trước, bổ sung thông tin bản in, tải/in A4 và portal an toàn khi SSR.
- `app/api/crm/commerce/[action]/route.ts`: giới hạn body riêng cho hai API hóa đơn.
- `scripts/crm/generate-mcp-catalog.mjs`, `lib/crm/mcp/routes.generated.ts`: hợp đồng MCP mới có source và ba mức giá.
- Các script `verify-order-invoice-*`, fixture ẩn thông tin liên hệ, live-check và production-smoke: bằng chứng hồi quy.

Không cần migration; không cập nhật bảng đơn, giá hay hồ sơ để che lỗi hiển thị.

## Bằng chứng kiểm thử

| Phạm vi | Kết quả |
|---|---|
| Model/PDF | 14 nhóm PASS, gồm 160 giỏ hỗn hợp đơn vị/phần lẻ và số tiền vượt giới hạn Number |
| Service PGlite | 8 nhóm PASS, gồm REQUEST/DRAFT/ORDER đã xác nhận, chống sửa tiền, phạm vi tổ chức và giữ checksum |
| PostgreSQL 17 QA / quyền runtime | 8 nhóm PASS, database và role QA được dọn sau test |
| Edge + API HTTP + OAuth MCP SDK | 8 nhóm PASS, không có lỗi JS; từng dòng form khớp backend và preview |
| In A4 Edge | 1 trang cho mẫu sáu dòng; đã render kiểm tra |
| PDF native | Trước 2 trang, sau 1 trang; đủ giá, tổng, chữ ký; đã xem ảnh render |
| Nhiều hàng / trường dài / không CK / thuế phí / tiền lớn | A4, không trang trắng, tổng và chữ ký cùng trang; các ca dài được phép nhiều trang |
| Hồi quy pricing-model / decimal / commercial-orders | 10 / 6 / 15 nhóm PASS |
| Kho / công nợ / VAT / mail chứng từ | 19 nhóm PASS, provider giả, không gửi mail thật |
| TypeScript, lint, production build và build traces | PASS; đủ font/PDF assets, không mang dữ liệu QA hay backup vào trace |
| Catalog MCP | 337 operations, 229 available, 108 retired; generate/check PASS |
| Candidate / HTTPS production | 16 / 16 nhóm PASS |
| Backup mới và thử restore | 2 lần PASS; 225 bảng / 2.342 dòng; 0 lỗi file và nguồn chứng từ |
| Dữ liệu trước/sau | 43 bảng nghiệp vụ / 377 dòng giữ nguyên số lượng và dấu băm |
| MCP kết nối production | Đọc hai phiên bản, tải đủ PDF và POST xuất PDF native đều 200 |

Báo cáo máy đọc được ở `docs/crm/test-results/order-invoice/`. PDF đối chiếu ở `output/pdf/HD-20261029-52E60EA4-{before,after}-anonymized.pdf`; chỉ dùng nội dung đã ẩn dữ liệu liên hệ. PDF live được đọc và đếm trang trong bộ nhớ, không lưu payload chứa liên hệ production ra máy.

## MCP

**MCP có dùng được không?** Có. SDK thật trên QA đã kiểm tra đọc hợp đồng, xem dữ liệu, tải/xuất PDF, retry và chặn sửa tiền. Sau triển khai, connector Cohamy đang kết nối đã thực hiện cả GET dữ liệu/PDF và POST xuất PDF trên production, đều trả 200. Chỉ xuất bản của yêu cầu đã có, không tạo hay sửa đơn thật.

**MCP có đọc được dữ liệu này không?** Có, đã kiểm tra trực tiếp trên production: `GET /api/crm/commerce/invoice-data` trả ba mức giá, CK phân bổ và tổng; `GET /api/crm/commerce/invoice-pdf` trả file có phân đoạn. Dùng requestId/orderId và versionId để đọc đúng bản. POST PDF phải dùng payload vừa lấy từ invoice-data/invoice-preview, có source; payload tự dựng theo hợp đồng cũ không còn được chấp nhận.

Không thêm SQL, shell, đường dẫn tùy ý hay công cụ lấy mật khẩu/token. Quyền server, phạm vi kho/tổ chức, audit, idempotency và lịch sử bất biến được giữ.

## Phát hành và rollback

Chỉ kích hoạt sau build, backup mới và thử khôi phục, candidate smoke qua. Trước cutover kiểm tra SHA hiện tại vẫn là bản đã lấy làm gốc và là tổ tiên của commit phát hành. Giữ release cũ; nếu sau cutover lỗi, script khởi động lại web + worker ở release trước. Không rollback dữ liệu nghiệp vụ khi không có migration hay yêu cầu khôi phục dữ liệu.

Đã so sánh số dòng và dấu băm **43 bảng nghiệp vụ / 377 dòng** trước/sau: **khớp toàn bộ**. Checksum bản 1 và bản 2 của mẫu giữ nguyên. Chỉ lưu dấu băm và số lượng, không lưu liên hệ hay thông tin đăng nhập.

Backup đã kiểm tra khôi phục: `/root/cohamy-backups/20261029T082213Z-048a0f1324b0`. Web và worker đều online đúng release, 0 lần restart khi kiểm tra. Release trước `f307fd0ed237548e58b00d9dcf380b7c4fd9d512` được giữ để rollback.

## Giới hạn

- Không gửi thêm email thật trong lần kiểm thử này; tính tương thích hàng đợi/đính kèm đã kiểm tra bằng provider giả. File đã gắn vào chứng từ xác nhận không bị tạo lại.
- Kiểm tra mã thuế là kiểm tra định dạng hiển thị, không tra cứu tình trạng pháp lý.
- Tab mở trước cập nhật cần tải lại trang (Ctrl+F5), rồi mở lại bản xem trước để lấy source và hợp đồng mới.
- Mẫu dài, nhiều sản phẩm, hoặc thêm thuế/phí có thể cần hơn một trang; không giảm font để ép một trang.
