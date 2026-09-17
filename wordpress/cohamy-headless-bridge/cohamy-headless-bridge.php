<?php
/**
 * Plugin Name: Cohamy Headless Bridge
 * Description: Gutenberg, public REST contract, Rank Math adapter, multilingual identities, CSV and signed webhooks for Cohamy.
 * Version: 2.0.9
 * Requires PHP: 8.1
 * License: GPL-2.0-or-later
 */
namespace Cohamy;
defined('ABSPATH') || exit;

const LOCALES = ['vi', 'en', 'zh', 'ko', 'ja'];
const CATEGORIES = ['chocolate', 'dried-fruit', 'gift-ideas', 'food-guide', 'brand-story'];
const HEADERS = ['id','group_id','locale','slug','title','excerpt','content_html','cover_image','cover_image_alt','author','category','tags','featured','related_product_ids','seo_title','seo_description','canonical_url','robots_index','status','scheduled_at','published_at','created_at','updated_at'];
const BLOCKS = ['core/paragraph','core/heading','core/list','core/list-item','core/image','core/gallery','core/quote','core/table','core/video','core/embed','core/buttons','core/button','core/separator','core/html','core/block','core/group'];

require_once __DIR__ . '/identity.php';
require_once __DIR__ . '/rest.php';
require_once __DIR__ . '/webhooks.php';
require_once __DIR__ . '/import.php';
require_once __DIR__ . '/admin.php';
require_once __DIR__ . '/operations.php';
require_once __DIR__ . '/campaigns.php';
require_once __DIR__ . '/distribution.php';
require_once __DIR__ . '/connections.php';
require_once __DIR__ . '/indexnow-selection.php';
require_once __DIR__ . '/ai-jobs.php';
require_once __DIR__ . '/analysis.php';
require_once __DIR__ . '/editorial.php';
require_once __DIR__ . '/data-transfer.php';
require_once __DIR__ . '/transfer-preview.php';
require_once __DIR__ . '/maintenance.php';
require_once __DIR__ . '/atomic-rest.php';
require_once __DIR__ . '/links.php';
require_once __DIR__ . '/operations-admin.php';

function activate(): void {
    global $wpdb;
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    $charset = $wpdb->get_charset_collate();
    dbDelta("CREATE TABLE {$wpdb->prefix}cohamy_identity (
      post_id bigint(20) NOT NULL,
      slug_key char(64) NOT NULL,
      group_key char(64) NOT NULL,
      legacy_key char(64) NOT NULL,
      PRIMARY KEY  (post_id),
      UNIQUE KEY slug_key (slug_key),
      UNIQUE KEY group_key (group_key),
      UNIQUE KEY legacy_key (legacy_key)
    ) $charset;");
    dbDelta("CREATE TABLE {$wpdb->prefix}cohamy_redirect (
      path_key char(64) NOT NULL,
      locale varchar(5) NOT NULL,
      old_slug varchar(180) NOT NULL,
      post_id bigint(20) NOT NULL,
      PRIMARY KEY  (path_key),
      KEY post_id (post_id)
    ) $charset;");
    dbDelta("CREATE TABLE {$wpdb->prefix}cohamy_outbox (
      event_id char(36) NOT NULL,
      body longtext NOT NULL,
      attempts int NOT NULL DEFAULT 0,
      next_attempt bigint(20) NOT NULL,
      delivered bigint(20) NOT NULL DEFAULT 0,
      last_error text NOT NULL,
      PRIMARY KEY  (event_id),
      KEY next_attempt (next_attempt)
    ) $charset;");
    foreach (CATEGORIES as $category) if (!term_exists($category, 'category')) wp_insert_term($category, 'category', ['slug' => $category]);
    add_role('cohamy_writer', 'Cohamy — Người viết', ['read'=>true,'edit_posts'=>true,'edit_published_posts'=>false,'delete_posts'=>true,'upload_files'=>true]);
    $editor = get_role('editor');
    add_role('cohamy_reviewer', 'Cohamy — Người duyệt', $editor ? $editor->capabilities : ['read'=>true,'edit_posts'=>true,'edit_others_posts'=>true,'publish_posts'=>true,'upload_files'=>true]);
    foreach (['cohamy_writer','cohamy_reviewer'] as $role_name) {
        $role=get_role($role_name);
        foreach (['rank_math_onpage_analysis','rank_math_onpage_general','rank_math_onpage_snippet','rank_math_onpage_advanced','rank_math_onpage_social'] as $cap) $role->add_cap($cap);
    }
    if (!get_option('cohamy_revision')) update_option('cohamy_revision', wp_generate_uuid4(), false);
    if (!wp_next_scheduled('cohamy_deliver_webhooks')) wp_schedule_event(time()+10, 'cohamy_minute', 'cohamy_deliver_webhooks');
}
register_activation_hook(__FILE__, __NAMESPACE__ . '\\activate');
register_deactivation_hook(__FILE__, function () { wp_clear_scheduled_hook('cohamy_deliver_webhooks'); });

function public_base(): string {
    return rtrim(defined('COHAMY_PUBLIC_URL') ? COHAMY_PUBLIC_URL : (string)get_option('cohamy_public_url', 'https://cohamy.vn'), '/');
}
function secret(): string { return defined('COHAMY_WEBHOOK_SECRET') ? COHAMY_WEBHOOK_SECRET : ''; }
function meta(int $id, string $key, string $default = ''): string {
    $value = get_post_meta($id, '_cohamy_' . $key, true);
    return is_scalar($value) && (string)$value !== '' ? (string)$value : $default;
}
function path_for(string $locale, string $slug,string $type='post'): string { return '/' . $locale . '/' . ($type==='page' ? ($locale==='vi' ? 'noi-dung' : 'pages') : ($locale === 'vi' ? 'bai-viet' : 'blog')) . '/' . $slug; }
function public_url(int $id): string { return public_base() . path_for(meta($id,'locale','en'), meta($id,'public_slug'),get_post_type($id) ?: 'post'); }
function csv_list($value): array {
    if (is_array($value)) return array_values(array_filter(array_map('trim', $value), 'strlen'));
    return array_values(array_filter(array_map('trim', explode(',', (string)$value)), 'strlen'));
}
function products(): array {
    return json_decode((string)file_get_contents(__DIR__ . '/products.json'), true) ?: [];
}
function utc(string $value): string {
    if ($value === '' || $value === '0000-00-00 00:00:00') return '';
    $date=new \DateTimeImmutable($value,new \DateTimeZone('UTC'));
    return $date->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
}

add_action('init', function () {
    register_taxonomy_for_object_type('category','page'); register_taxonomy_for_object_type('post_tag','page');
    foreach (['post','page'] as $type) {
    add_post_type_support($type,'custom-fields');
    foreach (['legacy_id','group_id','locale','public_slug','cover_image','cover_image_alt','author','featured','related_product_ids','canonical_url','scheduled_at','published_at','created_at','updated_at','campaign_id','template_base','location_id','country_id','topic_id','subject_id'] as $key) {
        register_post_meta($type, '_cohamy_' . $key, [
            'type'=>'string','single'=>true,'default'=>'','show_in_rest'=>['schema'=>['type'=>'string','context'=>['edit']]],
            'sanitize_callback'=>'sanitize_text_field','auth_callback'=>function ($allowed,$name,$id) { return current_user_can('edit_post',$id); },
        ]);
    }
    // Rank Math does not promise these fields on the core REST API. Register only the fields the bridge needs, edit context only.
    foreach (['rank_math_title','rank_math_description','rank_math_focus_keyword','rank_math_facebook_title','rank_math_facebook_description','rank_math_facebook_image','rank_math_twitter_title','rank_math_twitter_description','rank_math_twitter_image','rank_math_twitter_card_type','rank_math_pillar_content'] as $key) register_post_meta($type, $key, [
        'type'=>'string','single'=>true,'show_in_rest'=>['schema'=>['type'=>'string','context'=>['edit']]],
        'auth_callback'=>function ($allowed,$name,$id) { return current_user_can('edit_post',$id); },'sanitize_callback'=>'sanitize_text_field',
    ]);
    register_post_meta($type,'rank_math_robots',['single'=>true,'type'=>'array','show_in_rest'=>['schema'=>['type'=>'array','items'=>['type'=>'string','enum'=>['index','noindex','follow','nofollow','noarchive','noimageindex','nosnippet']],'context'=>['edit']]],'auth_callback'=>function ($allowed,$name,$id) { return current_user_can('edit_post',$id); }]);
    }
    add_filter('allowed_block_types_all', function ($allowed, $context) { return isset($context->post) && in_array($context->post->post_type,['post','page'],true) ? BLOCKS : $allowed; }, 20, 2);
});

// CMS HTML is a non-indexable copy. This host policy is NEVER used to derive public article robots.
add_filter('wp_robots', function ($robots) { $robots['noindex']=true; $robots['nofollow']=true; return $robots; });
add_filter('rank_math/frontend/robots', function ($robots) { $robots['index']='noindex'; return $robots; });
add_filter('wp_sitemaps_enabled','__return_false');
add_filter('rank_math/sitemap/enable_caching','__return_false');
add_filter('rank_math/sitemap/exclude_post_type', function ($exclude,$type) { return true; }, 20, 2);
add_filter('rank_math/sitemap/exclude_taxonomy', function ($exclude,$type) { return true; }, 20, 2);
add_filter('rank_math/modules', function ($modules) { unset($modules['sitemap'],$modules['instant-indexing']); return $modules; });
add_filter('robots_txt', function () { return "User-agent: *\nDisallow: /wp-admin/\nDisallow: /wp-login.php\nAllow: /wp-admin/admin-ajax.php\n"; });
add_action('send_headers', function () { if (!is_admin()) header('X-Robots-Tag: noindex, nofollow'); });
add_action('template_redirect', function () {
    if (preg_match('~(?:sitemap[^/]*\.xml|wp-sitemap)~', $_SERVER['REQUEST_URI'] ?? '')) { status_header(404); exit; }
    if (is_singular(['post','page']) && is_public((int)get_queried_object_id())) { wp_redirect(public_url((int)get_queried_object_id()), 301, 'Cohamy'); exit; }
    if (!is_feed() && !is_robots()) { status_header(404); nocache_headers(); exit; }
}, 0);
add_filter('post_link', function ($url,$post) { return $post->post_type === 'post' && meta($post->ID,'public_slug') !== '' ? public_url($post->ID) : $url; }, 20, 2);
add_filter('page_link',function($url,$id){return meta((int)$id,'public_slug')!=='' ? public_url((int)$id) : $url;},20,2);

