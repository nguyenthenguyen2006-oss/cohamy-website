# Bảng tồn kho: bỏ số 0 thừa và thêm STT

Bảng “Tồn kho được phân công” trước đây in nguyên chuỗi numeric(30,6) từ API, nên `109.000000` bị ngắt dòng trong ô hẹp. Giao diện dùng lại phép tính thập phân BigInt hiện có để hiển thị `109`, `0`, `12.34`, giữ chính xác tối đa 6 chữ số lẻ. Không chuyển số lượng qua JavaScript Number, không làm tròn và không đổi số liệu kho.

Cột STT đứng đầu và đánh lại từ 1 theo danh sách sau khi lọc kho/tên sản phẩm. Các cột số căn phải và không xuống dòng; kho/tên sản phẩm có chiều rộng tối thiểu. Điện thoại cuộn ngang trong khung bảng. Trạng thái không có kết quả gộp đủ 10 cột.

Chỉ sửa `DocumentFlowWorkspace.tsx` và CSS dùng cho bảng này. Không thay API, schema, ghi sổ, quyền truy cập hay PDF đã chốt. Catalog MCP giữ nguyên 339 operations và kiểm tra đồng bộ PASS.

LOCAL: TypeScript, lint, production build và kiểm tra tracing PASS. Edge với tài khoản WAREHOUSE_HN/WAREHOUSE_HCM trên PGlite riêng xác minh 3 nhóm: dữ liệu đúng kho, 10 cột/STT, số lượng khớp API, số lẻ 6 chữ số và số nguyên lớn chính xác, lọc/không kết quả, căn số không ngắt dòng và cuộn trên điện thoại. Không có lỗi JavaScript hay gửi mail ngoài. Bằng chứng trong `test-results/stock-view/`.

**MCP có dùng được không?** Có, thao tác kho giữ nguyên API và phân quyền.

**MCP có đọc được dữ liệu này không?** Có: `GET /api/crm/document-flow/workspace` trả tồn đầu, nhập, xuất, tồn, giữ hàng theo kho. Định dạng số gọn và STT thuộc giao diện; API vẫn trả chuỗi thập phân chính xác để ChatGPT tính toán, đối chiếu. Kết nối MCP hiện có đọc HTTP 200, đủ 16 dòng, các số lượng trước/sau khớp hoàn toàn.

## PRODUCTION đã xác minh

- Release `6b69d35e7b7733dc45cf00c9d185fc0be0885ff3` đã lên cohamy.vn ngày 30/10/2026; backup `/root/cohamy-backups/20261030T070402Z-6b69d35e7b77`.
- Hai bản backup đều khôi phục kiểm tra PASS (225 bảng); 18 kiểm tra bản ứng viên và 18 kiểm tra HTTPS công khai PASS. Web/worker online và không restart trong kiểm tra triển khai.
- Đọc HTML thật bằng Admin: bảng tồn kho cùng component có 16 dòng, 10 cột, STT liên tiếp và toàn bộ giá trị hiển thị khớp API sau khi bỏ số 0 thừa. Không có thao tác ghi dữ liệu hay gửi mail trong kiểm tra này.
- Hash của 48 bảng nghiệp vụ/458 dòng gồm tồn kho, biến động hàng, chứng từ, PDF, công nợ và thanh toán không đổi. Hai bảng users/memberships có thay đổi đồng thời: audit ghi 3 lần khóa, 3 lần mở và 1 lần xóa tài khoản trong khoảng đối chiếu. Không kết luận cả 50 bảng bất biến; giữ nguyên các thao tác tài khoản đã ghi nhận, không khôi phục hay ghi đè. Bản sửa này chỉ đổi component/CSS.

Bằng chứng: `test-results/stock-view/production-release.json`, `connected-mcp-production.json` và ảnh kiểm tra LOCAL. Commit tài liệu sau triển khai không đổi source đang chạy.
