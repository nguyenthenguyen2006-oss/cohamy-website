<?php
namespace Cohamy;
defined('ABSPATH') || exit;

function is_public(int $id): bool {
    global $wpdb;
    $post=get_post($id);
    if($wpdb->last_error)throw new \RuntimeException('Database bài viết tạm thời không đọc được.');
    if(!$post || !in_array($post->post_type,['post','page'],true) || $post->post_status!=='publish' || $post->post_password!=='' || strtotime($post->post_date_gmt.' UTC')>time())return false;
    $identity=$wpdb->get_var($wpdb->prepare("SELECT post_id FROM {$wpdb->prefix}cohamy_identity WHERE post_id=%d",$id));if($wpdb->last_error)throw new \RuntimeException('Database định danh tạm thời không đọc được.');return (bool)$identity;
}
function rank_math_ready(): bool { return class_exists('RankMath\\Helper'); }
function seo_value(\WP_Post $post, string $field): string {
    if (!rank_math_ready()) throw new \RuntimeException('Rank Math chưa được kích hoạt.');
    // Rank Math normally initializes variables on `wp`/admin_enqueue_scripts, neither fires for public REST.
    rank_math()->variables->setup();
    $raw=(string)get_post_meta($post->ID,'rank_math_'.$field,true);
    if ($raw==='') $raw=(string)\RankMath\Helper::get_settings('titles.pt_'.$post->post_type.'_'.$field,$field==='title' ? '%title% %sep% %sitename%' : '%excerpt%');
    // Native Rank Math variable resolver, with the actual WP_Post as context.
    return trim(html_entity_decode(wp_strip_all_tags(\RankMath\Helper::replace_vars($raw,$post)),ENT_QUOTES|ENT_HTML5,'UTF-8'));
}
function indexable(int $id): bool {
    $robots=get_post_meta($id,'rank_math_robots',true);
    if (!is_array($robots) || !$robots) {
        $type=get_post_type($id) ?: 'post';
        $custom=\RankMath\Helper::get_settings('titles.pt_'.$type.'_custom_robots',false);
        $robots=(array)\RankMath\Helper::get_settings($custom ? 'titles.pt_'.$type.'_robots' : 'titles.robots',[]);
    }
    // Deliberately do not invoke rank_math/frontend/robots, wp_robots or blog_public: those protect the CMS host.
    return !in_array('noindex',$robots,true);
}
function rewrite_links(string $html): string {
    $host=wp_parse_url(home_url(),PHP_URL_HOST);
    return preg_replace_callback('~(<a\b[^>]*\bhref=)(["\'])(.*?)\2~is',function ($match) use ($host) {
        $href=html_entity_decode($match[3],ENT_QUOTES,'UTF-8');
        $url=wp_parse_url($href);
        if (!$url || (isset($url['host']) && strtolower($url['host'])!==strtolower($host))) return $match[0];
        if (!isset($url['host']) && !str_starts_with($href,'/')) return $match[0];
        $resolved=str_starts_with($href,'/') ? home_url($href) : $href;
        $target=url_to_postid($resolved);
        $public=$target && meta($target,'public_slug')!=='' ? public_url($target) : public_base().($url['path'] ?? '/');
        if (preg_match('~^/(wp-admin|wp-login|wp-json)(?:/|\.|$)~',$url['path'] ?? '')) $public=public_base();
        if (isset($url['fragment'])) $public.='#'.$url['fragment'];
        return $match[1].$match[2].esc_url($public).$match[2];
    },$html);
}
function embed_source(string $url): string {
    $p=wp_parse_url($url); if (!$p || ($p['scheme'] ?? '')!=='https' || isset($p['user']) || isset($p['pass']) || !empty($p['port'])) return '';
    $host=strtolower($p['host'] ?? ''); $path=$p['path'] ?? ''; $id='';
    if (in_array($host,['www.youtube.com','youtube.com','youtu.be'],true)) {
        if ($host==='youtu.be') $id=ltrim($path,'/'); elseif ($path==='/watch') { parse_str($p['query'] ?? '',$q); $id=$q['v'] ?? ''; } else $id=preg_replace('~^/(?:embed|shorts)/~','',$path);
        return preg_match('/^[a-zA-Z0-9_-]{6,20}$/D',$id) ? 'https://www.youtube-nocookie.com/embed/'.$id : '';
    }
    if (in_array($host,['vimeo.com','www.vimeo.com','player.vimeo.com'],true) && preg_match('~/(?:video/)?(\d{4,15})$~',$path,$m)) return 'https://player.vimeo.com/video/'.$m[1];
    return '';
}
add_filter('render_block_core/embed',function ($html,$block) { $src=embed_source((string)($block['attrs']['url'] ?? '')); return $src ? '<figure class="wp-block-embed"><iframe src="'.esc_url($src).'" title="Video" loading="lazy" allowfullscreen></iframe></figure>' : $html; },20,2);
function safe_content_html(string $html): string {
    // KSES removes script tags but keeps their body as visible text. Remove the whole unsafe element first.
    $html=preg_replace('~<(script|style|object|embed)\b[^>]*>[\s\S]*?</\1\s*>~i','',$html);
    $html=preg_replace_callback('~<iframe\b[^>]*>[\s\S]*?</iframe\s*>~i',function ($m) {
        if (!preg_match('~\bsrc=["\'](https://(?:www\.youtube-nocookie\.com/embed/[a-zA-Z0-9_-]{6,20}|player\.vimeo\.com/video/\d{4,15}))["\']~',$m[0],$src)) return '';
        return '<iframe src="'.esc_url($src[1]).'" title="Video" loading="lazy" allowfullscreen></iframe>';
    },$html);
    $allowed=wp_kses_allowed_html('post'); $allowed['iframe']=['src'=>true,'title'=>true,'loading'=>true,'allowfullscreen'=>true];
    return wp_kses($html,$allowed);
}
function row_for(int $id, ?\WP_Post $override = null): array {
    $post=$override ?: get_post($id);
    if (!$post) throw new \RuntimeException('Không tìm thấy bài.');
    $thumb=(int)get_post_thumbnail_id($id);
    $cover=$thumb ? (string)wp_get_attachment_image_url($thumb,'full') : meta($id,'cover_image');
    $alt=$thumb ? (string)get_post_meta($thumb,'_wp_attachment_image_alt',true) : meta($id,'cover_image_alt');
    $categories=wp_get_post_terms($id,'category',['fields'=>'slugs']);
    $category=array_values(array_intersect(CATEGORIES,is_wp_error($categories) ? [] : $categories))[0] ?? 'chocolate';
    $tags=wp_get_post_terms($id,'post_tag',['fields'=>'names']);
    $status=['publish'=>'published','future'=>'scheduled','trash'=>'archived'][''.$post->post_status] ?? 'draft';
    $schedule=meta($id,'scheduled_at');
    if ($status==='scheduled' && (!$schedule || strtotime($schedule)!==strtotime($post->post_date_gmt.' UTC'))) $schedule=utc($post->post_date_gmt);
    $content=do_blocks($post->post_content);
    if (!has_blocks($post->post_content)) $content=wpautop($content);
    $seo_context=clone $post; $seo_context->ID=$id;
    return [
      'id'=>meta($id,'legacy_id','wp-'.$id),'group_id'=>meta($id,'group_id','wp-'.$id),'locale'=>meta($id,'locale','en'),'slug'=>meta($id,'public_slug'),
      'title'=>html_entity_decode(wp_strip_all_tags($post->post_title),ENT_QUOTES|ENT_HTML5,'UTF-8'),
      'excerpt'=>html_entity_decode(wp_strip_all_tags($post->post_excerpt),ENT_QUOTES|ENT_HTML5,'UTF-8'),
      'content_html'=>rewrite_links(safe_content_html($content)),'cover_image'=>$cover,'cover_image_alt'=>$alt,
      'author'=>meta($id,'author',get_the_author_meta('display_name',$post->post_author)),'category'=>$category,'tags'=>is_wp_error($tags) ? [] : array_values($tags),
      'featured'=>meta($id,'featured')==='TRUE','related_product_ids'=>csv_list(meta($id,'related_product_ids')),
      'seo_title'=>seo_value($seo_context,'title'),'seo_description'=>seo_value($seo_context,'description'),
      'canonical_url'=>meta($id,'canonical_url'),'robots_index'=>indexable($id),'status'=>$status,
      'scheduled_at'=>utc($schedule),
      'published_at'=>utc($status==='published' ? meta($id,'published_at',utc($post->post_date_gmt)) : meta($id,'published_at')),
      'created_at'=>utc(meta($id,'created_at',utc($post->post_date_gmt))),
      'updated_at'=>utc(meta($id,'updated_at',utc($post->post_modified_gmt))),
    ];
}
function response($data,int $status=200): \WP_REST_Response {
    $response=new \WP_REST_Response($data,$status);
    $response->header('Cache-Control','private, no-store');
    $response->header('X-Robots-Tag','noindex, nofollow');
    return $response;
}
function revision(): string { return (string)get_option('cohamy_revision'); }

function mint_preview(int $id) {
    if (!current_user_can('edit_post',$id) || !in_array(get_post_type($id),['post','page'],true)) return new \WP_Error('preview_denied','Không có quyền xem trước bài này.',['status'=>403]);
    if (strlen(secret())<32) return new \WP_Error('preview_not_configured','Chưa cấu hình preview secret.',['status'=>503]);
    $grant=['id'=>$id,'uid'=>get_current_user_id(),'exp'=>time()+300,'nonce'=>wp_generate_uuid4()];
    set_transient('cohamy_preview_'.$grant['nonce'],$grant,300);
    $payload=rtrim(strtr(base64_encode(wp_json_encode($grant)),'+/','-_'),'=');
    return $payload.'.'.hash_hmac('sha256',$payload,secret());
}
function preview_base(): string { return rtrim(defined('COHAMY_PREVIEW_URL') ? COHAMY_PREVIEW_URL : public_base(),'/'); }
function preview($request) {
    $token=(string)$request['token'];
    if (strlen($token)>2000 || strlen(secret())<32) return new \WP_Error('preview_denied','Preview không hợp lệ.',['status'=>403]);
    $parts=explode('.',$token);
    if (count($parts)!==2 || !hash_equals(hash_hmac('sha256',$parts[0],secret()),$parts[1])) return new \WP_Error('preview_denied','Chữ ký preview không hợp lệ.',['status'=>403]);
    $grant=json_decode((string)base64_decode(strtr($parts[0],'-_','+/'),true),true);
    if (!is_array($grant) || ($grant['exp'] ?? 0)<time() || !isset($grant['nonce'],$grant['uid'],$grant['id']) || get_transient('cohamy_preview_'.$grant['nonce'])!==$grant || !user_can((int)$grant['uid'],'edit_post',(int)$grant['id'])) return new \WP_Error('preview_denied','Preview hết hạn hoặc quyền đã bị thu hồi.',['status'=>403]);
    $post=get_post((int)$grant['id']);
    if (!$post || !in_array($post->post_type,['post','page'],true) || $post->post_status==='trash') return new \WP_Error('preview_denied','Bài không còn khả dụng.',['status'=>403]);
    $autosave=wp_get_post_autosave($post->ID,(int)$grant['uid']);
    if ($autosave && strtotime($autosave->post_modified_gmt)>strtotime($post->post_modified_gmt)) {
        $post=clone $post;
        foreach (['post_content','post_title','post_excerpt'] as $field) $post->$field=$autosave->$field;
    }
    return response(array_merge(row_for((int)$grant['id'],$post),['content_type'=>$post->post_type]));
}
add_filter('preview_post_link',function ($url,$post) {
    $token=mint_preview($post->ID);
    return is_wp_error($token) ? $url : preview_base().'/api/wordpress/preview?token='.rawurlencode($token);
},20,2);

add_action('rest_api_init',function () {
    register_rest_route('cohamy/v1','/revision',['methods'=>'GET','permission_callback'=>'__return_true','callback'=>function () {
        if (!rank_math_ready()) return new \WP_Error('rank_math_required','Rank Math chưa được kích hoạt.',['status'=>503]);
        return response(['revision'=>revision(),'rank_math'=>true]);
    }]);
    register_rest_route('cohamy/v1','/snapshot',['methods'=>'GET','permission_callback'=>'__return_true','callback'=>function ($request) {
        global $wpdb;
        if (!rank_math_ready()) return new \WP_Error('rank_math_required','Rank Math chưa được kích hoạt.',['status'=>503]);
        $version=revision();
        if ($request['revision'] && $version!==$request['revision']) return response(['error'=>'revision_changed'],409);
        $scope='';if($request['q']){$pattern='%'.$wpdb->esc_like(mb_substr(sanitize_text_field($request['q']),0,200)).'%';$scope=$wpdb->prepare(" AND (p.post_title LIKE %s OR EXISTS (SELECT 1 FROM {$wpdb->postmeta} qs WHERE qs.post_id=p.ID AND qs.meta_key='_cohamy_public_slug' AND qs.meta_value LIKE %s))",$pattern,$pattern);}
        $ids=$wpdb->get_col("SELECT p.ID FROM {$wpdb->posts} p INNER JOIN {$wpdb->prefix}cohamy_identity i ON i.post_id=p.ID WHERE p.post_type='post' AND p.post_status='publish' AND p.post_password='' $scope ORDER BY p.ID");
        if($wpdb->last_error)return op_error('Database nội dung tạm thời không đọc được.',503);
        $posts=[]; foreach ($ids as $id) if (is_public((int)$id)) $posts[]=row_for((int)$id);
        $redirects=[];
        foreach ($wpdb->get_results("SELECT * FROM {$wpdb->prefix}cohamy_redirect",ARRAY_A) as $entry) {
            $id=(int)$entry['post_id'];
            if (is_public($id) && $entry['locale']===meta($id,'locale') && $entry['old_slug']!==meta($id,'public_slug')) $redirects[]=['locale'=>$entry['locale'],'from'=>$entry['old_slug'],'to'=>meta($id,'public_slug')];
        }
        if (revision()!==$version) return response(['error'=>'revision_changed'],409);
        return response(['revision'=>$version,'posts'=>$posts,'redirects'=>$redirects]);
    }]);
    register_rest_route('cohamy/v1','/resolve',['methods'=>'GET','permission_callback'=>'__return_true','callback'=>function ($request) {
        global $wpdb;
        $locale=(string)$request['locale']; $slug=(string)$request['slug'];
        if (!in_array($locale,LOCALES,true) || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D',$slug)) return new \WP_Error('invalid_identity','URL không hợp lệ.',['status'=>400]);
        $key=hash('sha256',$locale.':'.$slug);
        $owner=(int)$wpdb->get_var($wpdb->prepare("SELECT post_id FROM {$wpdb->prefix}cohamy_identity WHERE slug_key=%s",$key));
        if($wpdb->last_error)return op_error('Database URL tạm thời không đọc được.',503);
        $type=$request['type']==='page' ? 'page' : 'post';
        if ($owner && is_public($owner) && get_post_type($owner)===$type) return response(['exists'=>true]);
        $target=(int)$wpdb->get_var($wpdb->prepare("SELECT post_id FROM {$wpdb->prefix}cohamy_redirect WHERE path_key=%s",$key));
        if($wpdb->last_error)return op_error('Database redirect tạm thời không đọc được.',503);
        if ($target && is_public($target) && get_post_type($target)===$type && meta($target,'locale')===$locale && meta($target,'public_slug')!==$slug) return response(['to'=>meta($target,'public_slug')]);
        return response(['exists'=>false]);
    }]);
    register_rest_route('cohamy/v1','/preview-token',['methods'=>'POST','permission_callback'=>function ($request) { return current_user_can('edit_post',(int)$request['id']); },'callback'=>function ($request) {
        $token=mint_preview((int)$request['id']);
        return is_wp_error($token) ? $token : response(['url'=>preview_base().'/api/wordpress/preview?token='.rawurlencode($token)]);
    }]);
    // Bearer token is the permission check; it is verified before any post or autosave is returned.
    register_rest_route('cohamy/v1','/preview',['methods'=>'POST','permission_callback'=>'__return_true','callback'=>__NAMESPACE__.'\\preview']);
});
