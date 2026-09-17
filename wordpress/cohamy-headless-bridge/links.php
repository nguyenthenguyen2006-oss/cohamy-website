<?php
namespace Cohamy;
defined('ABSPATH') || exit;
function public_link_target(string $path): int {
    global $wpdb;if(!preg_match('~^/(vi|en|zh|ko|ja)/(?:bai-viet|blog|noi-dung|pages)/([a-z0-9-]+)$~D',$path,$m))return 0;
    $key=hash('sha256',$m[1].':'.$m[2]);return (int)($wpdb->get_var($wpdb->prepare('SELECT post_id FROM '.op_table('identity').' WHERE slug_key=%s',$key)) ?: $wpdb->get_var($wpdb->prepare('SELECT post_id FROM '.op_table('redirect').' WHERE path_key=%s',$key)));
}
// Native Free Rank Math stores and counts these edges. The bridge supplies correct
// headless classification/IDs via its extension hook, without editing the plugin.
add_filter('rank_math/links/extract',function($data,$html,$id){
    if($data!==null || !in_array(get_post_type($id),['post','page'],true))return $data;
    $doc=new \DOMDocument();@$doc->loadHTML('<?xml encoding="UTF-8">'.rewrite_links($html));$links=[];$counts=['internal'=>0,'external'=>0];
    foreach($doc->getElementsByTagName('a') as $a){$url=$a->getAttribute('href');if(!$url || str_starts_with($url,'#') || preg_match('~^(?:mailto|tel):~i',$url))continue;$parts=wp_parse_url($url);if(!$parts)continue;
        $internal=(!isset($parts['host']) && str_starts_with($url,'/') && !str_starts_with($url,'//')) || (($parts['host'] ?? '')===wp_parse_url(public_base(),PHP_URL_HOST));
        if(!$internal && !preg_match('~^https?://~i',$url))continue;
        $type=$internal?'internal':'external';$target=$internal?public_link_target($parts['path'] ?? '/'):0;if($target===$id)continue;$counts[$type]++;$links[]=new \RankMath\Links\Link($internal?public_base().($parts['path'] ?? '/').(isset($parts['query'])?'?'.$parts['query']:''):$url,$target,$type);
    }return ['links'=>$links,'counts'=>$counts];
},20,3);
function links_summary(int $id): array {
    global $wpdb;
    $meta=$wpdb->get_row($wpdb->prepare("SELECT internal_link_count,external_link_count,incoming_link_count FROM {$wpdb->prefix}rank_math_internal_meta WHERE object_id=%d",$id),ARRAY_A);
    if($wpdb->last_error)throw new \RuntimeException('Không đọc được phân tích link Rank Math.');
    $incoming=$meta?(int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT l.post_id) FROM {$wpdb->prefix}rank_math_internal_links l JOIN {$wpdb->posts} p ON p.ID=l.post_id WHERE l.target_post_id=%d AND l.type='internal' AND p.post_status='publish' AND p.post_password='' AND p.post_date_gmt<=%s",$id,gmdate('Y-m-d H:i:s'))):null;
    if($wpdb->last_error)throw new \RuntimeException('Không đọc được link trỏ đến bài.');
    return ['counts'=>$meta ? array_map('intval',$meta) : null,'public_incoming'=>$incoming,'orphan'=>$incoming===null?null:$incoming===0,'analysis_state'=>$meta?'analyzed':'not_analyzed'];
}
function near_duplicates(int $id,string $html): array {$tokens=function($value){$text=mb_strtolower(html_entity_decode(wp_strip_all_tags(preg_replace('/<!--.*?-->/s','',$value)),ENT_QUOTES,'UTF-8'));$words=array_slice(preg_split('/[^\p{L}\p{N}]+/u',$text,-1,PREG_SPLIT_NO_EMPTY),0,512);return array_fill_keys(array_filter($words,fn($word)=>mb_strlen($word)>2),true);};$needle=$tokens($html);if(count($needle)<4)return ['scope'=>'100 bài publish gần nhất cùng locale; gợi ý để người duyệt đánh giá','items'=>[]];$query=new \WP_Query(['post_type'=>'post','post_status'=>'publish','has_password'=>false,'post__not_in'=>[$id],'posts_per_page'=>100,'orderby'=>'modified','order'=>'DESC','meta_query'=>[['key'=>'_cohamy_locale','value'=>meta($id,'locale','en')]]]);$items=[];global $wpdb;if($wpdb->last_error)throw new \RuntimeException('Không đọc được gợi ý bài tương tự.');foreach($query->posts as $post){$words=$tokens($post->post_content);$union=count($needle+$words);$score=$union?count(array_intersect_key($needle,$words))/$union:0;if($score>=0.75)$items[]=['post_id'=>$post->ID,'title'=>$post->post_title,'url'=>meta($post->ID,'public_slug')?public_url($post->ID):'','word_overlap'=>round($score,3)];}return ['scope'=>'100 bài publish gần nhất cùng locale; độ trùng từ không kết luận sao chép','items'=>$items];}
function links_scan(string $job): void {
    $input=get_option('cohamy_links_scan_'.$job);if(!$input || $input['state']!=='queued')return;$actor=get_current_user_id();wp_set_current_user($input['actor']);
    try{if(!current_user_can('edit_post',$input['post_id']))throw new \RuntimeException('Quyền phân tích đã bị thu hồi.');$id=$input['post_id'];\RankMath\Links\ContentProcessor::get()->process($id,get_post($id)->post_content);
        $edges=\RankMath\Links\ContentProcessor::get()->storage->get_links($id);$results=[];$checked=0;
        foreach($edges as $edge){$url=$edge->get_url();$internal=wp_parse_url($url,PHP_URL_HOST)===wp_parse_url(public_base(),PHP_URL_HOST);$state='external_not_checked';$status=null;
            if($internal && $checked<20){$path=safe_path($url);$r=wp_remote_head(preview_base().$path,['timeout'=>5,'redirection'=>0]);$status=is_wp_error($r)?null:wp_remote_retrieve_response_code($r);$state=is_wp_error($r)?'connection_error':($status===404 || $status===410?'broken':($status>=300 && $status<400?'redirect':($status>=200 && $status<300?'ok':'http_error')));$checked++;}
            elseif($internal)$state='not_checked_batch_limit';$results[]=['url'=>$url,'state'=>$state,'http_status'=>$status];
        }
        $query=public_query(['locale'=>meta($id,'locale','en'),'category'=>row_for($id)['category'],'exclude'=>meta($id,'legacy_id'),'page_size'=>6]);$suggestions=[];foreach($query['items'] as $row)if($row['robots_index'])$suggestions[]=['title'=>$row['title'],'url'=>public_base().path_for($row['locale'],$row['slug']),'pillar'=>$row['seo']['pillar']];
        $input['state']='completed';$input['result']=['rank_math'=>links_summary($id),'checked_at'=>gmdate('c'),'links'=>$results,'suggestions'=>$suggestions,'external_policy'=>'Không fetch URL ngoài site; external_not_checked không có nghĩa link hoạt động.'];
    }catch(\Throwable $e){$input['state']='failed';$input['result']=['error'=>$e->getMessage()];}finally{wp_set_current_user($actor);update_option('cohamy_links_scan_'.$job,$input,false);}
}
add_action('cohamy_links_scan',__NAMESPACE__.'\\links_scan',10,1);
add_action('rest_api_init',function(){
    op_route('links','POST','cohamy_seo',function($r){$id=(int)$r['post_id'];if(!current_user_can('edit_post',$id))return op_error('Không đủ quyền.',403);$job=wp_generate_uuid4();update_option('cohamy_links_scan_'.$job,['actor'=>get_current_user_id(),'post_id'=>$id,'state'=>'queued','created'=>time()],false);as_enqueue_async_action('cohamy_links_scan',[$job],'cohamy',false,60);return response(['job_id'=>$job,'state'=>'queued'],202);});
    op_route('links/(?P<id>[a-f0-9-]{36})','GET','cohamy_seo',function($r){$job=get_option('cohamy_links_scan_'.$r['id']);if(!$job || $job['actor']!==get_current_user_id())return op_error('Không có quyền xem job.',403);return response($job);});
});
