<?php
namespace Cohamy;
defined('ABSPATH') || exit;

function analysis_hash(int $id): string {
    $post=get_post($id); if (!$post) return '';
    $parts=[$post->post_title,$post->post_content,$post->post_excerpt,get_locale(),wp_json_encode(get_option('rank-math-options-titles',[]))];
    foreach (['rank_math_title','rank_math_description','rank_math_focus_keyword','_thumbnail_id'] as $key) $parts[]=wp_json_encode(get_post_meta($id,$key,true));
    $parts[]=(string)get_post_meta((int)get_post_thumbnail_id($id),'_wp_attachment_image_alt',true); return hash('sha256',implode('|',$parts));
}
function analysis_enqueue(int $id): void {
    if (!get_post($id) || !in_array(get_post_type($id),['post','page'],true) || !function_exists('as_schedule_single_action')) return;
    if (!csv_list(get_post_meta($id,'rank_math_focus_keyword',true))) { update_post_meta($id,'_cohamy_analysis_state','awaiting_keyword'); return; }
    update_post_meta($id,'_cohamy_analysis_state','queued');
    update_post_meta($id,'_cohamy_analysis_attempt',0);
    if (!as_get_scheduled_actions(['hook'=>'cohamy_analysis_tick','args'=>[$id,0],'group'=>'cohamy','status'=>'pending','per_page'=>1],'ids')) as_schedule_single_action(time()+2,'cohamy_analysis_tick',[$id,0],'cohamy',false,50);
}
function analysis_tick(int $id,int $attempt=0): void { $key='cohamy_analysis_lock_'.$id;$owner=op_lease($key,90);if(!$owner)return;try{analysis_execute($id,$attempt);}finally{op_release($key,$owner);} }
function analysis_execute(int $id,int $attempt=0): void {
    global $wpdb; $post=get_post($id); if (!$post || $post->post_status==='trash') return;
    $hash=analysis_hash($id); $keywords=array_slice(csv_list(get_post_meta($id,'rank_math_focus_keyword',true)),0,10);
    if (!$keywords) { update_post_meta($id,'_cohamy_analysis_state','awaiting_keyword'); return; }
    if (meta($id,'analysis_hash')===$hash && meta($id,'analysis_state')==='analyzed') return;
    update_post_meta($id,'_cohamy_analysis_state','analyzing');
    update_post_meta($id,'_cohamy_analysis_attempt',$attempt);
    $row=row_for($id); $is_new=[];
    foreach ($keywords as $keyword) $is_new[]=!$wpdb->get_var($wpdb->prepare("SELECT p.ID FROM {$wpdb->posts} p JOIN {$wpdb->postmeta} m ON m.post_id=p.ID WHERE p.post_status='publish' AND p.ID!=%d AND m.meta_key='rank_math_focus_keyword' AND (m.meta_value=%s OR m.meta_value LIKE %s) LIMIT 1",$id,$keyword,$wpdb->esc_like($keyword).',%'));
    $general=(array)get_option('rank-math-options-general',[]);
    $schemas=[]; foreach (get_post_meta($id) as $key=>$values) if (str_starts_with($key,'rank_math_schema_')) $schemas[$key]=maybe_unserialize($values[0]);
    $body=wp_json_encode(['rank_math_version'=>RANK_MATH_VERSION,'base_url'=>public_base(),'url'=>public_url($id),'post_type'=>$post->post_type,'locale'=>get_locale(),'title'=>$row['seo_title'],'description'=>$row['seo_description'],'slug'=>$row['slug'],'content_html'=>$row['content_html'],'keywords'=>$keywords,'keyword_is_new'=>$is_new,'thumbnail'=>$row['cover_image'],'thumbnail_alt'=>$row['cover_image_alt'],'schemas'=>$schemas ?: new \stdClass(),'nofollow_external'=>!empty($general['nofollow_external_links']),'nofollow_domains'=>csv_list($general['nofollow_domains'] ?? ''),'nofollow_exclusions'=>csv_list($general['nofollow_exclude_domains'] ?? '')]);
    $timestamp=(string)time(); $url=preview_base().'/api/wordpress/analyze';
    $result=wp_remote_post($url,['timeout'=>20,'redirection'=>0,'limit_response_size'=>1024*1024,'headers'=>['Content-Type'=>'application/json','X-Cohamy-Timestamp'=>$timestamp,'X-Cohamy-Signature'=>hash_hmac('sha256',$timestamp.'.'.$body,secret())],'body'=>$body]);
    $data=is_wp_error($result) ? [] : json_decode(wp_remote_retrieve_body($result),true);
    if (is_wp_error($result) || wp_remote_retrieve_response_code($result)!==200 || !isset($data['score']) || !is_numeric($data['score']) || $data['score']<0 || $data['score']>100) {
        update_post_meta($id,'_cohamy_analysis_state','error'); update_post_meta($id,'_cohamy_analysis_error',is_wp_error($result) ? $result->get_error_code() : ($data['error'] ?? 'HTTP '.wp_remote_retrieve_response_code($result)));
        if ($attempt<5) {update_post_meta($id,'_cohamy_analysis_attempt',$attempt+1);as_schedule_single_action(time()+min(900,10*(2**$attempt)),'cohamy_analysis_tick',[$id,$attempt+1],'cohamy',false,50);}return;
    }
    $before=editorial_checkpoint();editorial_lock($id);
    try{
        if (!hash_equals($hash,analysis_hash($id))) { editorial_rollback($before); analysis_enqueue($id); return; }
        update_post_meta($id,'rank_math_seo_score',(string)(int)$data['score']);
        update_post_meta($id,'_cohamy_analysis_hash',$hash); update_post_meta($id,'_cohamy_analysis_state','analyzed'); update_post_meta($id,'_cohamy_analysis_error',''); update_post_meta($id,'_cohamy_analysis_result',$data);
        if($wpdb->query('COMMIT')===false)throw new \RuntimeException('Không commit được phân tích SEO.');
    }catch(\Throwable $e){editorial_rollback($before);throw $e;}
}
add_action('cohamy_analysis_tick',__NAMESPACE__.'\\analysis_tick',10,2);
add_action('rest_api_init',function () { op_route('analysis','POST','cohamy_seo',function ($r) { $id=(int)$r['post_id']; if (!current_user_can('edit_post',$id)) return op_error('Không có quyền phân tích bài.',403); analysis_enqueue($id);$state=meta($id,'analysis_state'); return response(['queued'=>$state==='queued','state'=>$state,'post_id'=>$id]); }); });
