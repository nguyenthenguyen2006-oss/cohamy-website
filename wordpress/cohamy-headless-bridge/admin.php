<?php
namespace Cohamy;
defined('ABSPATH') || exit;

add_action('enqueue_block_editor_assets',function () {
    $screen=get_current_screen(); if (!$screen || !in_array($screen->post_type,['post','page'],true)) return;
    wp_enqueue_script('cohamy-editor',plugins_url('editor.js',__FILE__),['wp-plugins','wp-element','wp-components','wp-data','wp-editor','wp-api-fetch'],OPERATIONS_VERSION,true);
    $categories=[]; foreach (CATEGORIES as $slug) { $term=get_term_by('slug',$slug,'category'); if ($term) $categories[]=['label'=>$term->name,'value'=>(int)$term->term_id]; }
    wp_add_inline_script('cohamy-editor','window.cohamyEditor='.wp_json_encode(['publicUrl'=>public_base(),'products'=>products(),'categories'=>$categories,'type'=>$screen->post_type]).';','before');
});
// Rank Math 1.0.278 registers its format script without lodash dependencies. Declare order in the bridge, not in vendor code.
add_action('admin_enqueue_scripts',function () {
    $scripts=wp_scripts();
    if (isset($scripts->registered['rank-math-formats'])) $scripts->registered['rank-math-formats']->deps=array_values(array_unique(array_merge($scripts->registered['rank-math-formats']->deps,['lodash','wp-rich-text','wp-element','wp-components','wp-data'])));
},100);
add_action('admin_menu',function () {
    add_submenu_page('edit.php','Import CSV Cohamy','Import CSV Cohamy','edit_posts','cohamy-import',__NAMESPACE__.'\\import_screen');
    add_options_page('Cohamy Headless','Cohamy Headless','manage_options','cohamy-headless',__NAMESPACE__.'\\settings_screen');
});
add_action('admin_notices',function () {
    if (!rank_math_ready()) echo '<div class="notice notice-error"><p>Cohamy: hãy cài và kích hoạt Rank Math SEO miễn phí. Public API tạm trả 503 đến khi Rank Math sẵn sàng.</p></div>';
});

function import_screen(): void {
    if (!current_user_can('edit_posts')) wp_die('Không có quyền.');
    $download=wp_nonce_url(admin_url('admin-post.php?action=cohamy_csv_template'),'cohamy_csv_template');
    ?>
    <div class="wrap"><h1>Import bài viết Cohamy</h1>
    <p><a class="button" href="<?php echo esc_url($download); ?>">Tải CSV mẫu — UTF-8, 23 cột, Excel</a></p>
    <p>Dùng CSV UTF-8 với dấu <code>;</code> hoặc <code>,</code>. Dòng <code>sep=;</code> giúp Excel chia cột. Giữ đúng header;
    bao HTML, dấu phân cách và xuống dòng trong dấu nháy kép, nhân đôi nháy kép bên trong. Tối đa 16 MB / 20.000 bản ghi.</p>
    <p><code>group_id</code> bắt buộc, dùng chung cho các bản dịch; <code>id</code> là ID đối chiếu ổn định (để trống sẽ sinh từ group_id + locale).
    Public slug chỉ dùng chữ thường không dấu/số/gạch ngang. Thời gian cần ISO 8601 có <code>Z</code> hoặc <code>+07:00</code>.
    Ảnh HTTPS được giữ nguyên URL, không tải từ mạng trên server. Sản phẩm liên quan dùng mã trong danh sách sản phẩm ở editor.</p>
    <p>Mặc định ghi <strong>draft</strong>. Chọn cập nhật khi import lại. Xem lỗi theo dòng trước khi bấm ghi;
    dòng lỗi được bỏ qua, dòng hợp lệ xử lý từng batch 25 bài. Điểm SEO Rank Math chỉ là gợi ý nội dung, không cam kết thứ hạng/index.</p>
    <form id="cohamy-import-form">
      <p><input type="file" name="file" accept=".csv,text/csv" required></p>
      <p><label>Chế độ <select name="mode"><option value="create">Chỉ tạo mới</option><option value="upsert">Tạo mới/cập nhật theo ID ổn định</option></select></label></p>
      <p><label><input type="checkbox" name="preserve_status" value="true"> Giữ published/scheduled/archived từ CSV (published/scheduled cần quyền xuất bản)</label></p>
      <?php if (current_user_can('manage_options')): ?><p><label><input type="checkbox" name="preserve_dates" value="true"> Migration: giữ thời gian nguồn (chỉ admin; không dùng để ghi đè thay đổi mới)</label></p><?php endif; ?>
      <button class="button button-primary" type="submit">Xem trước và kiểm tra</button>
    </form><div id="cohamy-import-result" role="status" style="margin-top:20px"></div>
    <button id="cohamy-import-commit" class="button button-primary" type="button" hidden>Ghi các dòng hợp lệ theo batch</button></div>
    <?php
    wp_enqueue_script('cohamy-import',plugins_url('import.js',__FILE__),['wp-api-fetch'],'1.0.0',true);
}
add_action('admin_post_cohamy_csv_template',function () {
    if (!current_user_can('edit_posts')) wp_die('Không có quyền.',403);
    check_admin_referer('cohamy_csv_template');
    nocache_headers(); header('Content-Type: text/csv; charset=UTF-8'); header('Content-Disposition: attachment; filename="cohamy-blog-import-excel.csv"');
    echo "\xEF\xBB\xBFsep=;\r\n";
    $out=fopen('php://output','w');
    fputcsv($out,HEADERS,';','"','',"\r\n");
    $defaults=['locale'=>'vi','author'=>'Cohamy Editorial','category'=>'chocolate','featured'=>'FALSE','robots_index'=>'TRUE','status'=>'draft'];
    fputcsv($out,array_map(function ($key) use ($defaults) { return $defaults[$key] ?? ''; },HEADERS),';','"','',"\r\n");
    fclose($out); exit;
});
function settings_screen(): void {
    global $wpdb;
    if (!current_user_can('manage_options')) wp_die('Không có quyền.');
    echo '<div class="wrap"><h1>Cohamy Headless</h1><p>Frontend: <code>'.esc_html(public_base()).'</code>. Cấu hình URL/secret/webhook bằng wp-config.php hoặc biến môi trường, không lưu secret trong trình duyệt.</p>';
    echo '<p>Rank Math: '.(rank_math_ready() ? 'đã kích hoạt' : 'chưa kích hoạt').'. Preview/webhook secret: '.(strlen(secret())>=32 ? 'đã cấu hình' : 'chưa cấu hình').'. Timezone WordPress: <code>'.esc_html(wp_timezone_string()).'</code>.</p>';
    echo '<p>Đặt cron hệ thống chạy <code>wp cron event run --due-now</code> mỗi phút; headless không dựa vào traffic. Next.js là nguồn sitemap công khai duy nhất.</p>';
    echo '<h2>Webhook gần đây</h2><table class="widefat"><thead><tr><th>Event</th><th>Số lần gửi</th><th>Trạng thái</th><th>Lỗi gần nhất</th></tr></thead><tbody>';
    foreach ($wpdb->get_results("SELECT event_id,attempts,delivered,last_error FROM {$wpdb->prefix}cohamy_outbox ORDER BY next_attempt DESC LIMIT 30",ARRAY_A) as $entry) {
        echo '<tr><td>'.esc_html($entry['event_id']).'</td><td>'.esc_html($entry['attempts']).'</td><td>'.($entry['delivered'] ? 'Đã gửi' : 'Đang chờ/retry').'</td><td>'.esc_html($entry['last_error']).'</td></tr>';
    }
    echo '</tbody></table></div>';
}
