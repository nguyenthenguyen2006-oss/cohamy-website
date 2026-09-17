<?php
namespace Cohamy;
defined('ABSPATH') || exit;
global $dirty_posts,$preserve_dates,$flushing;
$dirty_posts=[]; $preserve_dates=[]; $flushing=false;

function dirty(int $id): void {
    global $dirty_posts,$flushing;
    if (!$flushing && in_array(get_post_type($id),['post','page'],true) && !wp_is_post_revision($id)) $dirty_posts[$id]=true;
}
add_action('wp_after_insert_post',function ($id,$post) { if ($post->post_status!=='auto-draft') dirty((int)$id); },100,2);
add_action('set_object_terms',function ($id,$terms,$tt_ids,$taxonomy) { if (in_array($taxonomy,['category','post_tag'],true)) dirty((int)$id); },100,4);
add_action('edited_term',function ($id,$tt_id,$taxonomy) { if (in_array($taxonomy,['category','post_tag'],true)) foreach (get_objects_in_term($id,$taxonomy) as $post) dirty((int)$post); },100,3);
foreach (['added_post_meta','updated_post_meta','deleted_post_meta'] as $hook) add_action($hook,function ($mid,$id,$key) {
    if (str_starts_with($key,'_cohamy_analysis_')) return;
    // Ignore Rank Math's derived score/link-analysis jobs and WP editor locks: they are not editorial changes.
    if (str_starts_with($key,'_cohamy_') || (str_starts_with($key,'rank_math_') && !in_array($key,['rank_math_seo_score','rank_math_internal_links_processed','rank_math_analytic_object_id'],true)) || $key==='_thumbnail_id') dirty((int)$id);
    if ($key==='_wp_attachment_image_alt') {
        $posts=get_posts(['post_type'=>'post','post_status'=>'any','numberposts'=>-1,'fields'=>'ids','meta_key'=>'_thumbnail_id','meta_value'=>(string)$id]);
        foreach ($posts as $post) dirty((int)$post);
    }
},100,3);
add_action('before_delete_post',function ($id) { dirty((int)$id); });
add_action('deleted_post',function ($id) { global $dirty_posts; $dirty_posts[(int)$id]=true; });
add_action('transition_post_status',function ($new,$old,$post) { if ($new!==$old) dirty($post->ID); },100,3);
add_filter('cron_schedules',function ($schedules) { $schedules['cohamy_minute']=['interval'=>60,'display'=>'Every minute (Cohamy)']; return $schedules; });

function flush_changes(): void {
    global $dirty_posts,$wpdb,$preserve_dates,$flushing;
    if (!$dirty_posts || $flushing) return;
    $flushing=true; $paths=[];try {
    foreach (array_keys($dirty_posts) as $id) {
        $old_locale=meta($id,'last_public_locale'); $old_slug=meta($id,'last_public_slug');
        $locale=meta($id,'locale'); $slug=meta($id,'public_slug');
        $type=get_post_type($id) ?: 'post';
        if ($old_locale && $old_slug) $paths[]=path_for($old_locale,$old_slug,$type);
        if ($locale && $slug) $paths[]=path_for($locale,$slug,$type);
        if ($old_slug && ($old_slug!==$slug || $old_locale!==$locale) && get_post($id)) {
            $key=hash('sha256',$old_locale.':'.$old_slug);
            $existing=$wpdb->get_var($wpdb->prepare("SELECT post_id FROM {$wpdb->prefix}cohamy_redirect WHERE path_key=%s",$key));
            if (!$existing || (int)$existing===$id) $wpdb->replace($wpdb->prefix.'cohamy_redirect',['path_key'=>$key,'locale'=>$old_locale,'old_slug'=>$old_slug,'post_id'=>$id]);
        }
        if (is_public($id)) {
            // A redirect points directly to a post's CURRENT slug; returning to a previous slug cannot create a loop.
            $wpdb->delete($wpdb->prefix.'cohamy_redirect',['path_key'=>hash('sha256',$locale.':'.$slug),'post_id'=>$id]);
            update_post_meta($id,'_cohamy_last_public_locale',$locale);
            update_post_meta($id,'_cohamy_last_public_slug',$slug);
            if (!meta($id,'published_at')) update_post_meta($id,'_cohamy_published_at',utc(get_post($id)->post_date_gmt));
        }
        if (get_post($id) && !isset($preserve_dates[$id])) update_post_meta($id,'_cohamy_updated_at',gmdate('Y-m-d\TH:i:s.000\Z'));
        inventory_update((int)$id);
        analysis_enqueue((int)$id);
    }
    $version=wp_generate_uuid4(); update_option('cohamy_revision',$version,false);
    $event=wp_generate_uuid4();
    $body=wp_json_encode(['event_id'=>$event,'revision'=>$version,'post_ids'=>array_map('intval',array_keys($dirty_posts)),'paths'=>array_values(array_unique($paths))],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
    if($wpdb->insert($wpdb->prefix.'cohamy_outbox',['event_id'=>$event,'body'=>$body,'attempts'=>0,'next_attempt'=>time(),'delivered'=>0,'last_error'=>''])===false)throw new \RuntimeException('Không lưu được webhook outbox.');
    $dirty_posts=[];
    }finally{$flushing=false;}
}
// Rank Math/Gutenberg may save their metadata after save_post/rest_after_insert_post.
// Defer revision and outbox until the complete request, never POST to Next.js from a partial save hook.
add_action('shutdown',__NAMESPACE__.'\\flush_changes',999);
add_action('updated_option',function($name,$old,$new){
    if(!in_array($name,['rank-math-options-titles','rank-math-options-general','blogname','blogdescription'],true) || $old===$new)return;
    global $wpdb;$version=wp_generate_uuid4();update_option('cohamy_revision',$version,false);
    $wpdb->query($wpdb->prepare('UPDATE '.op_table('shard').' SET revision=%s,modified=%s',$version,gmdate('Y-m-d\TH:i:s.000\Z')));
    $event=wp_generate_uuid4();$wpdb->insert(op_table('outbox'),['event_id'=>$event,'body'=>wp_json_encode(['event_id'=>$event,'revision'=>$version,'post_ids'=>[],'paths'=>[]]),'attempts'=>0,'next_attempt'=>time(),'delivered'=>0,'last_error'=>'']);
},100,3);

function deliver_webhooks(): void {
    global $wpdb;
    $url=defined('COHAMY_WEBHOOK_URL') ? COHAMY_WEBHOOK_URL : public_base().'/api/wordpress/webhook';
    if (strlen(secret())<32) { error_log('Cohamy webhook: secret missing'); return; }
    // Cron lock serializes senders; add_option is atomic even with overlapping system cron runs.
    if (!add_option('cohamy_outbox_lock',time(),'','no')) {
        if ((int)get_option('cohamy_outbox_lock')>time()-120) return;
        delete_option('cohamy_outbox_lock'); if (!add_option('cohamy_outbox_lock',time(),'','no')) return;
    }
    try {
        $events=$wpdb->get_results($wpdb->prepare("SELECT * FROM {$wpdb->prefix}cohamy_outbox WHERE delivered=0 AND next_attempt<=%d ORDER BY next_attempt LIMIT 20",time()),ARRAY_A);
        foreach ($events as $event) {
            update_option('cohamy_outbox_lock',time(),false);
            $timestamp=(string)time();
            $result=wp_remote_post($url,['timeout'=>10,'redirection'=>0,'headers'=>['Content-Type'=>'application/json','X-Cohamy-Timestamp'=>$timestamp,'X-Cohamy-Signature'=>hash_hmac('sha256',$timestamp.'.'.$event['body'],secret())],'body'=>$event['body']]);
            $status=is_wp_error($result) ? 0 : wp_remote_retrieve_response_code($result);
            $data=is_wp_error($result) ? null : json_decode(wp_remote_retrieve_body($result),true);
            $ok=($status===200 && !empty($data['accepted'])) || ($status===409 && ($data['error'] ?? '')==='REPLAY_REJECTED');
            $attempt=(int)$event['attempts']+1;
            $error=$ok ? '' : (is_wp_error($result) ? $result->get_error_code() : 'HTTP '.$status);
            $wpdb->update($wpdb->prefix.'cohamy_outbox',['attempts'=>$attempt,'delivered'=>$ok ? time() : 0,'next_attempt'=>time()+min(3600,5*(2**min($attempt,9))),'last_error'=>$error],['event_id'=>$event['event_id']]);
            if (!$ok) error_log('Cohamy webhook '.$event['event_id'].' failed: '.$error.'; retry queued');
        }
    } finally { delete_option('cohamy_outbox_lock'); }
}
add_action('cohamy_deliver_webhooks',__NAMESPACE__.'\\deliver_webhooks');
