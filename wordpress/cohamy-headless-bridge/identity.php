<?php
namespace Cohamy;
defined('ABSPATH') || exit;

global $reservations;
$reservations = [];

function identity_values(int $id, array $incoming = [], string $title = ''): array {
    $get = function ($key,$default='') use ($id,$incoming) { return array_key_exists('_cohamy_'.$key,$incoming) ? (string)$incoming['_cohamy_'.$key] : ($id > 0 ? meta($id,$key,$default) : $default); };
    return [
        'locale'=>$get('locale','en'), 'slug'=>$get('public_slug',sanitize_title(remove_accents($title))),
        'group_id'=>$get('group_id','wp-'.($id > 0 ? $id : wp_generate_uuid4())),
        'legacy_id'=>$get('legacy_id','wp-'.($id > 0 ? $id : wp_generate_uuid4())),
    ];
}
function validate_identity(array $identity): ?\WP_Error {
    if (!in_array($identity['locale'],LOCALES,true)) return new \WP_Error('invalid_locale','Ngôn ngữ không hợp lệ.',['status'=>400]);
    if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D',$identity['slug']) || strlen($identity['slug']) > 180) return new \WP_Error('invalid_public_slug','Public slug phải gồm chữ thường không dấu, số và dấu gạch ngang đơn.',['status'=>400]);
    foreach (['group_id','legacy_id'] as $key) if (trim($identity[$key]) === '' || strlen($identity[$key]) > 200) return new \WP_Error('invalid_identity','ID/nhóm bản dịch bắt buộc, tối đa 200 ký tự.',['status'=>400]);
    return null;
}
function reserve_identity(int $id, array $identity) {
    global $wpdb, $reservations;
    if ($error = validate_identity($identity)) return $error;
    $table = $wpdb->prefix.'cohamy_identity';
    $historical_owner=(int)$wpdb->get_var($wpdb->prepare("SELECT post_id FROM {$wpdb->prefix}cohamy_redirect WHERE path_key=%s",hash('sha256',$identity['locale'].':'.$identity['slug'])));
    if ($historical_owner && $historical_owner!==$id) return new \WP_Error('historical_slug_conflict','URL này đã từng xuất bản cho một bài khác; giữ redirect 301, hãy chọn slug khác.',['status'=>409]);
    $previous = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE post_id=%d",$id),ARRAY_A);
    $data=['slug_key'=>hash('sha256',$identity['locale'].':'.$identity['slug']),'group_key'=>hash('sha256',$identity['group_id'].':'.$identity['locale']),'legacy_key'=>hash('sha256',$identity['legacy_id'])];
    $wpdb->suppress_errors(true);
    $result = $previous ? $wpdb->update($table,$data,['post_id'=>$id]) : $wpdb->insert($table,array_merge(['post_id'=>$id],$data));
    $wpdb->suppress_errors(false);
    if ($result === false) {
        foreach ($data as $column=>$value) {
            $owner=(int)$wpdb->get_var($wpdb->prepare("SELECT post_id FROM $table WHERE $column=%s",$value));
            if ($owner && $owner!==$id) return new \WP_Error('identity_conflict','Trùng locale + public slug, group_id + locale hoặc ID cũ. Không tự đổi URL.',['status'=>409]);
        }
        return new \WP_Error('identity_storage_unavailable','Database đang bận hoặc không ghi được khóa URL; thử lại sau. Không có bài mới được tạo.',['status'=>503]);
    }
    if (!isset($reservations[$id])) $reservations[$id]=['previous'=>$previous,'identity'=>$identity];
    return $identity;
}
function commit_identity(int $reserved, int $id, array $identity): void {
    global $wpdb,$reservations;
    if ($reserved !== $id) $wpdb->update($wpdb->prefix.'cohamy_identity',['post_id'=>$id],['post_id'=>$reserved]);
    foreach (['locale'=>'locale','slug'=>'public_slug','group_id'=>'group_id','legacy_id'=>'legacy_id'] as $field=>$key) update_post_meta($id,'_cohamy_'.$key,$identity[$field]);
    unset($reservations[$reserved]);
}
add_action('shutdown',function () {
    global $wpdb,$reservations;
    // Failed requests release provisional reservations; successful REST/import writes commit them.
    foreach ($reservations as $id=>$reservation) {
        if ($reservation['previous']) $wpdb->update($wpdb->prefix.'cohamy_identity',$reservation['previous'],['post_id'=>$id]);
        else $wpdb->delete($wpdb->prefix.'cohamy_identity',['post_id'=>$id]);
    }
}, 0);

function unsupported_blocks(string $content): array {
    $unsupported=[];
    $visited=[];
    $walk=function ($blocks) use (&$walk,&$unsupported,&$visited) { foreach ($blocks as $block) {
        if ($block['blockName'] && !in_array($block['blockName'],BLOCKS,true)) $unsupported[]=$block['blockName'];
        if ($block['blockName']==='core/embed' && !embed_source((string)($block['attrs']['url'] ?? ''))) $unsupported[]='embed — chỉ YouTube/Vimeo HTTPS';
        if ($block['blockName']==='core/heading' && !in_array((int)($block['attrs']['level'] ?? 2),[2,3,4],true)) $unsupported[]='heading — chọn H2/H3/H4; H1 do giao diện tạo từ tiêu đề';
        if ($block['blockName']==='core/block') {
            $ref=(int)($block['attrs']['ref'] ?? 0); $shared=get_post($ref);
            if (!$shared || $shared->post_type!=='wp_block' || isset($visited[$ref]) || count($visited)>=8) $unsupported[]='reusable block thiếu hoặc lồng vòng';
            else { $visited[$ref]=true; $walk(parse_blocks($shared->post_content)); unset($visited[$ref]); }
        }
        if (!empty($block['innerBlocks'])) $walk($block['innerBlocks']);
    }};
    $walk(parse_blocks($content)); return array_unique($unsupported);
}

function guard_rest_identity($post,$request) {
    $id=(int)$request['id'];
    // WP 7.1's draft slug preparation reads these lowercase properties even on a new post.
    $post->id=$id;
    if (!isset($post->post_parent)) $post->post_parent=0;
    $incoming=(array)($request['meta'] ?? []);
    $identity=identity_values($id,$incoming,(string)($post->post_title ?? get_the_title($id)));
    // Blank editor fields may use stable defaults; public slugs must always be explicit or valid title-derived values.
    foreach (['group_id'=>'group_id','legacy_id'=>'legacy_id'] as $key=>$field) if ($identity[$field] === '') $identity[$field]='wp-'.($id ?: wp_generate_uuid4());
    if ($identity['locale'] === '') $identity['locale']='en';
    if ($id && meta($id,'last_public_locale') && $identity['locale']!==meta($id,'last_public_locale')) return new \WP_Error('published_locale_locked','Không đổi ngôn ngữ của URL đã xuất bản. Tạo bài dịch riêng với cùng group_id.',['status'=>409]);
    if ($identity['slug'] === '') $identity['slug']=sanitize_title(remove_accents((string)($post->post_title ?? get_the_title($id))));
    $ids=csv_list($incoming['_cohamy_related_product_ids'] ?? meta($id,'related_product_ids'));
    if (array_diff($ids,array_column(products(),'id'))) return new \WP_Error('invalid_products','Có mã sản phẩm không tồn tại.',['status'=>400]);
    foreach(['country','topic','subject','location'] as $kind) if(!empty($incoming['_cohamy_'.$kind.'_id'])) { $ref=entity_get($incoming['_cohamy_'.$kind.'_id']);if(!$ref || $ref['kind']!=='record' || $ref['payload']['type']!==$kind || $ref['state']!=='approved' || (!empty($ref['payload']['expires_at']) && strtotime($ref['payload']['expires_at'])<time()))return new \WP_Error('invalid_reference','Record '.$kind.' thiếu, chưa duyệt hoặc hết hạn.',['status'=>422]); }
    if (isset($post->post_content) && ($blocks=unsupported_blocks($post->post_content))) return new \WP_Error('unsupported_blocks','Block chưa được hỗ trợ: '.implode(', ',$blocks).'. Chuyển nội dung sang paragraph/heading/list/image/gallery/quote/table.',['status'=>400]);
    if (isset($request['categories'])) {
        $categories=get_terms(['taxonomy'=>'category','include'=>(array)$request['categories'],'hide_empty'=>false]);
        if (is_wp_error($categories) || !$categories || count($categories)>10 || !array_intersect(array_column($categories,'slug'),CATEGORIES)) return new \WP_Error('invalid_category','Chọn ít nhất một danh mục Cohamy; tối đa 10 danh mục.',['status'=>400]);
    }
    $reserved=$id ?: -random_int(1,PHP_INT_MAX);
    $result=reserve_identity($reserved,$identity);
    if (is_wp_error($result)) return $result;
    $request->set_param('_cohamy_reservation',['id'=>$reserved,'identity'=>$identity]);
    // WordPress's globally unique post_name is internal; it never controls the public slug.
    $post->post_name='cohamy-'.($id ?: wp_generate_uuid4());
    return $post;
}
foreach (['post','page'] as $type) add_filter('rest_pre_insert_'.$type,__NAMESPACE__.'\\guard_rest_identity',20,2);
function after_rest_identity($post,$request) {
    $reservation=$request->get_param('_cohamy_reservation');
    if ($reservation) commit_identity($reservation['id'],$post->ID,$reservation['identity']);
    if (!get_post_meta($post->ID,'_cohamy_created_at',true)) update_post_meta($post->ID,'_cohamy_created_at',utc($post->post_date_gmt));
    if (!meta($post->ID,'author')) update_post_meta($post->ID,'_cohamy_author',get_the_author_meta('display_name',$post->post_author));
    $categories=wp_get_post_terms($post->ID,'category',['fields'=>'slugs']);
    if (!array_intersect(CATEGORIES,$categories)) wp_set_post_terms($post->ID,[get_term_by('slug','chocolate','category')->term_id],'category');
    dirty($post->ID);
}
foreach (['post','page'] as $type) add_action('rest_after_insert_'.$type,__NAMESPACE__.'\\after_rest_identity',100,2);

// Disable classic editor/Quick Edit identity writes: all identity changes go through the guarded REST editor/import.
add_filter('use_block_editor_for_post',function ($use,$post) { return $post->post_type === 'post' ? true : $use; },20,2);
add_filter('post_row_actions',function ($actions,$post) { if ($post->post_type==='post') unset($actions['inline hide-if-no-js']); return $actions; },20,2);
add_filter('bulk_actions-edit-post',function ($actions) { unset($actions['edit']); return $actions; });
