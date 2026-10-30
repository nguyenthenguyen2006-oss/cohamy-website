# Cấp lại tài khoản bằng email đã xóa

Lỗi xảy ra vì tài khoản đã xóa vẫn nằm trong bảng users để giữ lịch sử, trong khi kiểm tra trùng email và hai ràng buộc UNIQUE vẫn áp dụng cho cả các hàng đã xóa.

Migration 049-reuse-deleted-account-email.sql thay hai ràng buộc email toàn cục bằng một unique index chỉ áp dụng khi deleted_at IS NULL. Email vẫn bắt buộc viết thường. Tài khoản đang hoạt động, bị khóa hoặc đang chờ kích hoạt vẫn giữ độc quyền email. Tài khoản đã xóa giữ nguyên toàn bộ dữ liệu, email, mật khẩu cũ, mã người dùng, các thành viên, audit và chứng từ; không cập nhật hàng cũ khi cấp lại.

Cấp lại tạo user và membership mới với đúng tổ chức/vai trò được chọn. Lời mời hoặc mật khẩu tự sinh sử dụng luồng hiện có. Không kế thừa phiên đăng nhập, MFA, lời mời, quyền kho, phân công hoặc quyền sở hữu dữ liệu của user cũ. Tìm người dùng bằng email trong đăng nhập CRM/MCP, khôi phục mật khẩu và kiểm tra đăng ký chỉ xét hàng chưa xóa. Khóa tài khoản không đồng nghĩa xóa và không giải phóng email.

API và hợp đồng input không đổi. MCP dùng POST /api/crm/accounts/provision và GET /api/crm/accounts như trước; cohamy_data đọc được cả hàng lưu lịch sử và hàng mới. Phải giữ nguyên requestId và idempotencyKey khi thử lại cùng lệnh. Muốn cấp lại sau một lần xóa phải dùng một lệnh mới, không phát lại khóa của lần cấp cũ.

Kiểm thử riêng cho email dùng lại gồm: lời mời, mật khẩu tự sinh, đăng nhập đúng identity mới, mã định danh/quyền kho khác, phiên và mật khẩu cũ bị từ chối, giữ nguyên hàng lịch sử, nhiều chu kỳ xóa/cấp lại, giữ email của tài khoản bị khóa/chờ kích hoạt, tranh chấp đồng thời, khôi phục mật khẩu chọn đúng người và MCP đọc/ghi/thử lại. Chạy thêm các bộ hồi quy xóa tài khoản và cấp tài khoản hiện có.

Dữ liệu kiểm thử dùng database LOCAL/STAGING độc lập và email .invalid; không phát thư hoặc cấp lại tài khoản thật trong khi xác minh. Website production chỉ kiểm tra đọc, schema/index, danh sách tài khoản và MCP. Người dùng chủ động tạo lại tài khoản và gửi lời mời từ giao diện sau khi cập nhật.

- npm run test:crm:account-email-reuse
- npm run test:crm:account-email-reuse-browser (qua tunnel thuộc phiên kiểm thử)
- npm run crm:mcp:catalog
- npm run test:crm:mcp:catalog

Biên bản: docs/crm/test-results/account-email-reuse/; phân biệt rõ LOCAL, STAGING và PRODUCTION. Quy trình phát hành tạo và kiểm tra khôi phục backup trước migration và trước chuyển bản; kiểm tra SHA hiện tại trước kích hoạt để giữ mọi bản cập nhật khác.

Bản phát hành giữ bản cập nhật danh tính người lập chứng từ đang chạy trên server. Hai migration 049-document-creators.sql và 049-reuse-deleted-account-email.sql giữ nguyên tên đầy đủ: migration registry dùng tên file, và cả hai đã được áp dụng độc lập trước chuyển bản. Không đổi tên migration đã áp dụng hoặc sửa checksum của chúng.
