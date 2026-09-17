<?php namespace Cohamy; defined('ABSPATH') || exit; ?>
<section data-view="content" hidden><h2>Tìm bài và trang</h2>
<p>Sửa nội dung, revisions, autosave và media trong Gutenberg. Quick edit kiểm tra quyền và bản đang lưu trước khi ghi từng bài. Điểm trống nghĩa là chưa phân tích.</p>
<form data-operation="content-filter">
<label>Tìm <input name="q" type="search"></label>
<label>Loại <select name="type"><option value="post">Bài viết</option><option value="page">Trang</option></select></label>
<label>Trạng thái <select name="status"><option value="">Tất cả</option><?php foreach (['draft','pending','publish','future','private','trash'] as $status) echo '<option>'.esc_html($status).'</option>'; ?></select></label>
<?php foreach (['locale'=>'Ngôn ngữ','author'=>'Author ID','category'=>'Danh mục','campaign_id'=>'Campaign','location_id'=>'Location','country_id'=>'Quốc gia','topic_id'=>'Chủ đề','subject_id'=>'Đối tượng','template_base'=>'Template gốc'] as $key=>$label) echo '<label>'.esc_html($label).' <input name="'.esc_attr($key).'"></label>'; ?>
<label>Thiếu <select name="missing"><option value="">Không lọc</option><option value="seo_title">SEO title</option><option value="seo_description">SEO description</option><option value="focus_keyword">Từ khóa</option><option value="image">Ảnh đại diện</option></select></label>
<label>Score từ <input name="score_min" type="number" min="0" max="100"></label><label>Score đến <input name="score_max" type="number" min="0" max="100"></label>
<label>Phân tích <select name="analysis_state"><option value="">Tất cả</option><option value="error">Có lỗi</option><option value="queued">Đang chờ</option><option value="analyzed">Đã phân tích</option><option value="awaiting_keyword">Thiếu từ khóa</option></select></label><label>Link vào <select name="orphan"><option value="">Tất cả</option><option value="1">Đã phân tích, không có link vào từ bài public</option></select></label>
<label>Từ ngày sửa <input name="from" type="date"></label><label>Đến ngày sửa <input name="to" type="date"></label>
<label>Index <select name="indexable"><option value="">Tất cả</option><option value="1">Index</option><option value="0">Noindex</option></select></label><button class="button">Lọc trên server</button>
</form><div data-results="content"></div><p data-pager="content"></p>
<form data-operation="content-bulk"><h3>Quick edit / bulk có preview</h3><label>WordPress IDs (dấu phẩy) <input name="ids" required></label>
<label>Thay đổi JSON<br><textarea name="patch" rows="4" cols="80" required>{"status":"draft"}</textarea></label>
<button name="intent" value="preview" class="button">Preview từng bài</button><button name="intent" value="apply" class="button button-primary">Xác nhận ghi</button></form><pre data-preview="bulk" tabindex="0"></pre>
<form data-operation="inspect"><label>URL public cần kiểm tra <input name="path" required placeholder="/vi/bai-viet/slug"></label><button class="button">Đọc HTML và metadata thực tế</button></form><pre data-preview="inspect" tabindex="0"></pre>
<p>Nhập /robots.txt để đọc bản robots thực tế và kiểm tra rule chặn toàn website.</p>
<form data-operation="links-scan"><label>ID bài phân tích link <input name="post_id" type="number" min="1" required></label><button class="button">Kiểm tra link nội bộ / gợi ý liên kết</button></form><p>Rank Math lưu bộ đếm link thật. Link ngoài website chưa được kiểm tra HTTP. Mỗi lần kiểm tra tối đa 20 link nội bộ, hiện rõ những link chưa được kiểm tra.</p><pre data-preview="links" tabindex="0"></pre>
</section>
