# Engine Rank Math thật trên worker

Các asset trong `assets/` được sao chép nguyên byte từ Rank Math 1.0.278 và WordPress 7.1 local, không sửa core/plugin hoặc công thức scoring. `manifest.json` khóa phiên bản và SHA-256 từng file. WordPress core và dependency giữ thông tin license trong header và WORDPRESS-LICENSE.txt; Rank Math khai báo GPLv3-or-later, engine upstream: https://github.com/rankmath/content-analyzer (ISC). jQuery MIT và lodash MIT giữ header gốc.

Worker sử dụng các class Paper, Analyzer và ResultManager được engine export, cùng hooks/i18n/wordcount/autop/url/lodash/jQuery thật của WordPress. JSDOM chỉ cung cấp DOM; không chạy HTML bài viết như script và không cho engine mở network. Kết quả keyword usage lấy từ truy vấn database đúng điều kiện native Rank Math. Không sao chép/reimplement scoring sang PHP.

Khi plugin Rank Math nâng phiên bản, worker từ chối xử lý đến khi snapshot asset đúng phiên bản được cập nhật, kiểm tra hash, regression và deploy. Việc viết/sửa/xuất bản bài không cần deploy. Những hook scoring riêng của plugin khác cần được tích hợp và kiểm thử trước khi dùng điểm worker với plugin đó; môi trường Cohamy hiện không có hook scoring bên thứ ba.

Điểm được lưu chỉ khi input hash còn khớp sau phân tích. Chưa có focus keyword hiển thị chưa phân tích; lỗi/đang chạy/cần phân tích lại là trạng thái riêng. Điểm SEO không bảo đảm thứ hạng hoặc index.

Toàn văn GPLv3 đi kèm tại `RANK-MATH-LICENSE.txt`, lấy nguyên văn từ GNU. Thông báo license và source upstream giữ nguyên trong asset; bridge không chỉnh sửa plugin Rank Math đã cài.
