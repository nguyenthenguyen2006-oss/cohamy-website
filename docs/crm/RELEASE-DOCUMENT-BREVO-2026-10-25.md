# Release chứng từ và cài đặt Brevo — 25/10/2026

Trạng thái: candidate đã chuẩn bị; chưa chuyển production. DNS `cohamy.vn` vẫn trỏ 168.231.118.227, người dùng xác nhận IP/port không đổi, nhưng SSH 22 và HTTPS 443 từ máy triển khai đều timeout. Không có backup, migration, thay đổi master key hoặc PM2 nào được thực hiện trên server trong lần này.

Candidate dựa trên commit `e47edb6846611d24b356ea649b59492b696738ab`, là release internal-documents đã xác minh ngày 23/10; chưa thể xác nhận lại trạng thái live ngày 25/10. Worktree gốc và thay đổi có trước được giữ nguyên. Các module đã bỏ và vùng tài liệu nội bộ vẫn được giữ.

## Phạm vi

- Luồng Admin đề nghị → nhà máy giao từng đợt → kho nhập/xuất → kế toán đối chiếu và khóa VAT, lịch sử/đính chính và thông báo chứng từ.
- Form Admin nhập API Brevo và sender, khóa mã hóa trong DB, không đọc lại secret về browser; giữ nguyên gate gửi email.
- Migration bổ sung 036–042, bao gồm cả hai file tiền tố 040 khác tên. Không sửa checksum các migration đã áp dụng.
- Không đóng gói `.local`, key local, credential, DB QA, báo cáo/screenshot QA mới hoặc mẫu Word không được chọn vào commit release.

## Gate triển khai đã bổ sung

`scripts/deploy-cohamy-release.sh` thực hiện backup/restore độc lập trước migration và trước cutover. Manifest backup tương thích cả schema chưa có `doc_category` và file VAT dùng SHA-256 raw sau migration.

`scripts/crm/provision-brevo-master.mjs` bảo toàn master hiện có; nếu chưa có sẽ tạo master 32 byte ngẫu nhiên trong `/root/cohamy-shared/crm-settings-encryption.key`, mode 0600, backup riêng ngoài dump SQL. Nếu tồn tại ciphertext nhưng thiếu master gốc hoặc env/file xung đột, dừng an toàn. Không in secret và không bật `CRM_EMAIL_ENABLED`/SMS.

`scripts/crm/migrate-release.ts` áp dụng toàn bộ migration đang thiếu trong một transaction, đối chiếu checksum và khóa registry. Lỗi giữa batch rollback cả DDL để không lộ phiên bản trigger trung gian. Web và worker đọc cùng master từ `.env.production` của release.

Smoke candidate giữ kiểm tra các module đã bỏ/internal documents và bổ sung đọc trang chứng từ/cài Brevo với master sẵn sàng. Không gửi mail, lưu API key giả hoặc tạo chứng từ thật khi smoke production.

## Bằng chứng LOCAL trên candidate

- Fresh `npm ci`, optimized `npm run build`, kiểm tra trace đóng gói, whole-tree TypeScript và shell syntax.
- Brevo settings: 14/14, provider fake; core chứng từ: 19/19 PGlite.
- Release preflight: 7/7, gồm master tồn tại/xung đột/thiếu, backup schema cũ/mới và rollback batch migration.
- Backup guards: 3/3; module-removal/service/browser: 11/11.

Đây là LOCAL, không thay cho restore thử trên bản backup production mới hoặc smoke live. Thông tin mailbox thật và các giới hạn PDF vẫn theo tài liệu bàn giao trước.

## Khi SSH hoạt động lại

1. Đọc lại marker release/SHA, PM2, DB migrations và các gate email hiện tại; đối chiếu candidate với mọi thay đổi live mới.
2. Upload đúng script deploy từ candidate vào shared protected directory, kiểm tra hash và chạy với SHA commit chính xác trên nhánh `codex/crm-document-brevo-20261025`.
3. Chỉ cutover khi cả hai backup/restore, master, migration, build/trace và candidate smoke đều pass.
4. Xác minh HTTPS, web/worker đúng release, role/API cài đặt Brevo và trạng thái email không đổi. Giữ release cũ để rollback source, không drop schema mới hoặc ghi đè DB bằng snapshot cũ.

Không reboot VPS hoặc thay tường lửa của các ứng dụng khác như một phần của release này.
