<?php
namespace Cohamy;
defined('ABSPATH') || exit;

function editorial_hash(int $id): string { $p=get_post($id); return $p ? hash('sha256',$p->post_content.'|'.$p->post_title.'|'.$p->post_excerpt.'|'.$p->post_status.'|'.analysis_hash($id)) : ''; }
function editorial_lock(int $id): void {
    global $wpdb;
    if ($wpdb->query('START TRANSACTION')===false || $wpdb->query($wpdb->prepare("UPDATE {$wpdb->posts} SET post_content=post_content WHERE ID=%d",$id))===false || $wpdb->query($wpdb->prepare("UPDATE {$wpdb->postmeta} SET meta_value=meta_value WHERE post_id=%d",$id))===false) { $wpdb->query('ROLLBACK'); throw new \RuntimeException('Không khóa được bản hiện tại; thử lại.'); }
    clean_post_cache($id); wp_cache_delete($id,'post_meta');
}
function editorial_checkpoint(): array { global $dirty_posts,$reservations,$preserve_dates; return [$dirty_posts,$reservations,$preserve_dates]; }
function editorial_rollback(array $before): void { global $wpdb,$dirty_posts,$reservations,$preserve_dates; $wpdb->query('ROLLBACK'); [$dirty_posts,$reservations,$preserve_dates]=$before; wp_cache_flush(); }
function editorial_commit(): void { global $wpdb; flush_changes(); if($wpdb->query('COMMIT')===false)throw new \RuntimeException('Không commit được thay đổi; database chưa sẵn sàng.'); }
function editorial_list(\WP_REST_Request $r): array {
    $type=$r['type']==='page' ? 'page' : 'post'; $page=max(1,(int)$r['page']);
    $args=['post_type'=>$type,'post_status'=>$r['status'] ?: ['publish','future','draft','pending','private','trash'],'posts_per_page'=>25,'paged'=>$page,'orderby'=>'modified','order'=>'DESC','s'=>sanitize_text_field($r['q'] ?? '')];
    if (!current_user_can('edit_others_posts')) $args['author']=get_current_user_id(); elseif ($r['author']) $args['author']=(int)$r['author'];
    if ($r['category']) $args['category_name']=sanitize_title($r['category']);
    $meta=[]; foreach (['locale','campaign_id','location_id','country_id','topic_id','subject_id','template_base'] as $key) if ($r[$key]) $meta[]=['key'=>'_cohamy_'.$key,'value'=>(string)$r[$key]];
    foreach (['seo_title'=>'rank_math_title','seo_description'=>'rank_math_description','focus_keyword'=>'rank_math_focus_keyword','image'=>'_thumbnail_id'] as $filter=>$key) if ($r['missing']===$filter) $meta[]=['relation'=>'OR',['key'=>$key,'compare'=>'NOT EXISTS'],['key'=>$key,'value'=>'']];
    if ($r['analysis_state']) $meta[]=['key'=>'_cohamy_analysis_state','value'=>(string)$r['analysis_state']];
    if($r['orphan']==='1'){global $wpdb;$args['post__in']=array_map('intval',$wpdb->get_col("SELECT m.object_id FROM {$wpdb->prefix}rank_math_internal_meta m WHERE NOT EXISTS (SELECT 1 FROM {$wpdb->prefix}rank_math_internal_links l JOIN {$wpdb->posts} p ON p.ID=l.post_id WHERE l.target_post_id=m.object_id AND l.type='internal' AND p.post_status='publish' AND p.post_password='' AND p.post_date_gmt<='".gmdate('Y-m-d H:i:s')."')"));if($wpdb->last_error)throw new \RuntimeException('Không đọc được bộ lọc orphan Rank Math.');if(!$args['post__in'])$args['post__in']=[0];}
    if ($r['score_min']!==null && $r['score_min']!=='') $meta[]=['key'=>'rank_math_seo_score','value'=>(int)$r['score_min'],'type'=>'NUMERIC','compare'=>'>='];
    if ($r['score_max']!==null && $r['score_max']!=='') $meta[]=['key'=>'rank_math_seo_score','value'=>(int)$r['score_max'],'type'=>'NUMERIC','compare'=>'<='];
    $eligibility=null;
    if(in_array($r['indexable'],['0','1'],true)) { global $wpdb; $eligibility=function($where)use($r,$wpdb){return $where.' AND '.($r['indexable']==='0'?'NOT ':'').'EXISTS (SELECT 1 FROM '.op_table('inventory').' i WHERE i.post_id='.$wpdb->posts.'.ID AND ('.inventory_eligible_sql().'))';}; add_filter('posts_where',$eligibility); }
    if ($meta) $args['meta_query']=$meta;
    if ($r['from'] || $r['to']) $args['date_query']=[['column'=>'post_modified_gmt','after'=>$r['from'] ?: null,'before'=>$r['to'] ?: null,'inclusive'=>true]];
    try{$query=new \WP_Query($args);}finally{if($eligibility)remove_filter('posts_where',$eligibility);} global $wpdb; if($wpdb->last_error)throw new \RuntimeException('Không đọc được danh sách nội dung.'); $items=[];
    foreach ($query->posts as $post) if (current_user_can('edit_post',$post->ID)) {
        $id=$post->ID; $items[]=['wp_id'=>$id,'id'=>meta($id,'legacy_id','wp-'.$id),'title'=>$post->post_title,'status'=>$post->post_status,'locale'=>meta($id,'locale'),'author'=>get_the_author_meta('display_name',$post->post_author),'categories'=>wp_get_post_terms($id,'category',['fields'=>'names']),'tags'=>wp_get_post_terms($id,'post_tag',['fields'=>'names']),'created_at'=>utc(meta($id,'created_at',utc($post->post_date_gmt))),'updated_at'=>utc(meta($id,'updated_at',utc($post->post_modified_gmt))),'score'=>metadata_exists('post',$id,'rank_math_seo_score') ? (int)get_post_meta($id,'rank_math_seo_score',true) : null,'analysis_state'=>meta($id,'analysis_state','awaiting_editor'),'focus_keywords'=>get_post_meta($id,'rank_math_focus_keyword',true),'canonical'=>meta($id,'public_slug') ? public_url($id) : '', 'indexable'=>is_public($id) && indexable($id),'campaign_id'=>meta($id,'campaign_id'),'editor_url'=>get_edit_post_link($id,'raw'),'hash'=>editorial_hash($id)];
        $summary=&$items[count($items)-1];$summary['indexable']=(bool)$wpdb->get_var($wpdb->prepare('SELECT post_id FROM '.op_table('inventory').' i WHERE post_id=%d AND ('.inventory_eligible_sql().')',$id));if($wpdb->last_error)throw new \RuntimeException('Không đọc được trạng thái indexability.');$summary['links']=links_summary($id);$summary['references']=[];foreach(['country','topic','subject','location'] as $kind)$summary['references'][$kind]=meta($id,$kind.'_id');$summary['schema_source']='Next.js Article/Breadcrumb; Organization/WebSite toàn site';$summary['analysis_error']=meta($id,'analysis_error');if(meta($id,'analysis_hash') && meta($id,'analysis_hash')!==analysis_hash($id))$summary['analysis_state']='stale';unset($summary);
    }
    return ['items'=>$items,'total'=>(int)$query->found_posts,'page'=>$page,'pages'=>max(1,(int)$query->max_num_pages)];
}
function editorial_bulk(array $input) {
    $ids=array_values(array_unique(array_map('intval',(array)($input['ids'] ?? [])))); $patch=(array)($input['patch'] ?? []);
    if (!$ids || count($ids)>100 || array_diff(array_keys($patch),['title','excerpt','status','date_gmt','categories','tags','featured_media','meta'])) return op_error('Chọn 1–100 ID và field quick edit được hỗ trợ.');
    $allowed=['rank_math_title','rank_math_description','rank_math_focus_keyword','rank_math_robots','rank_math_pillar_content','rank_math_facebook_title','rank_math_facebook_description','rank_math_twitter_title','rank_math_twitter_description','_cohamy_public_slug','_cohamy_locale','_cohamy_group_id','_cohamy_featured','_cohamy_related_product_ids','_cohamy_country_id','_cohamy_topic_id','_cohamy_subject_id','_cohamy_location_id'];
    if (array_diff(array_keys((array)($patch['meta'] ?? [])),$allowed)) return op_error('Meta không được hỗ trợ qua quick edit.');
    $results=[];
    foreach ($ids as $id) {
        $post=get_post($id); $hash=editorial_hash($id); $error='';
        if (!$post || !in_array($post->post_type,['post','page'],true) || !current_user_can('edit_post',$id)) $error='Không đủ quyền sửa bài.';
        elseif (in_array($patch['status'] ?? '',['publish','future','private'],true) && !current_user_can($post->post_type==='page' ? 'publish_pages' : 'publish_posts')) $error='Không đủ quyền xuất bản.';
        elseif (!empty($input['confirmed']) && !hash_equals($hash,(string)($input['hashes'][$id] ?? ''))) $error='Bài đã được sửa sau preview. Tải lại trước khi áp dụng.';
        if ($error) { $results[]=['wp_id'=>$id,'ok'=>false,'error'=>$error]; continue; }
        if (empty($input['confirmed'])) { $results[]=['wp_id'=>$id,'ok'=>true,'hash'=>$hash,'before'=>['title'=>$post->post_title,'status'=>$post->post_status],'after'=>$patch]; continue; }
        global $wpdb; $before=editorial_checkpoint(); editorial_lock($id);
        if (!hash_equals($hash,editorial_hash($id))) { $wpdb->query('ROLLBACK'); $results[]=['wp_id'=>$id,'ok'=>false,'error'=>'Bài vừa thay đổi. Preview lại.']; continue; }
        try {
            $request=new \WP_REST_Request('POST','/wp/v2/'.($post->post_type==='page' ? 'pages' : 'posts').'/'.$id); $request->set_body_params($patch); $request->set_header('Content-Type','application/json'); $request->set_body(wp_json_encode($patch));
            $result=rest_do_request($request); $data=$result->get_data(); $ok=$result->get_status()<300; if($ok)editorial_commit();else editorial_rollback($before);
        } catch (\Throwable $e) { editorial_rollback($before); $results[]=['wp_id'=>$id,'ok'=>false,'error'=>$e->getMessage()]; continue; }
        $results[]=['wp_id'=>$id,'ok'=>$ok,'error'=>$ok ? '' : ($data['message'] ?? 'HTTP '.$result->get_status())];
        if ($ok) op_audit('editorial.quick-edit',(string)$id,['hash'=>$hash],$patch);
    }
    return response(['results'=>$results,'confirmed'=>!empty($input['confirmed']),'success'=>count(array_filter($results,fn($r)=>$r['ok'])),'failed'=>count(array_filter($results,fn($r)=>!$r['ok']))]);
}
function editorial_duplicate(int $id) {
    if (!current_user_can('edit_post',$id) || get_post_type($id)!=='post') return op_error('Không đủ quyền nhân bản bài.',403);
    $post=get_post($id); $row=row_for($id); $token=substr(str_replace('-','',wp_generate_uuid4()),0,10);
    $row['id']='duplicate-'.$token; $row['group_id']='duplicate-'.$token; $row['slug']=substr($row['slug'],0,160).'-'.$token; $row['title'].=' — bản sao';
    $row['status']='draft'; foreach (['canonical_url','scheduled_at','published_at','created_at','updated_at'] as $key) $row[$key]='';
    $row['content_html']=$post->post_content; $row['seo_title']=get_post_meta($id,'rank_math_title',true); $row['seo_description']=get_post_meta($id,'rank_math_description',true); $row['tags']=implode(',',$row['tags']); $row['related_product_ids']=implode(',',$row['related_product_ids']); $seen=[];
    $options=['mode'=>'create','preserve_status'=>false,'preserve_dates'=>false]; $validated=validate_import_row($row,$options,$seen); $result=import_row($validated,$options);
    if ($thumbnail=get_post_thumbnail_id($id)) set_post_thumbnail($result['wp_id'],$thumbnail);
    update_post_meta($result['wp_id'],'rank_math_focus_keyword',get_post_meta($id,'rank_math_focus_keyword',true)); op_audit('editorial.duplicate',(string)$result['wp_id'],['original'=>$id],$result); return response($result,201);
}
function editorial_inspect(string $path) {
    $path=safe_path($path); $r=wp_remote_get(preview_base().$path,['timeout'=>15,'redirection'=>0,'limit_response_size'=>2*1024*1024]);
    if (is_wp_error($r)) return op_error('Không đọc được public HTML: '.$r->get_error_code(),503);
    if($path==='/robots.txt'){$raw=wp_remote_retrieve_body($r);$warnings=[];if(preg_match('~^\s*Disallow\s*:\s*/\*?\s*(?:#.*)?$~im',$raw))$warnings[]='Có rule chặn toàn website; kiểm tra User-agent áp dụng.';if(!str_contains($raw,public_base().'/sitemap.xml'))$warnings[]='Thiếu sitemap public Cohamy.';return response(['type'=>'robots','url'=>public_base().$path,'http_status'=>wp_remote_retrieve_response_code($r),'raw'=>$raw,'warnings'=>$warnings,'valid'=>!$warnings,'checked_at'=>gmdate('c')]);}
    $html=wp_remote_retrieve_body($r); $doc=new \DOMDocument(); $previous=libxml_use_internal_errors(true); $doc->loadHTML('<?xml encoding="UTF-8">'.$html); libxml_clear_errors(); libxml_use_internal_errors($previous); $xp=new \DOMXPath($doc);
    $meta=[]; foreach ($xp->query('//meta[@name or @property]') as $node) $meta[]=['key'=>$node->getAttribute('name') ?: $node->getAttribute('property'),'value'=>$node->getAttribute('content')];
    $canonical=[]; foreach ($xp->query('//link[@rel="canonical"]') as $node) $canonical[]=$node->getAttribute('href');
    $schema=[]; foreach ($xp->query('//script[@type="application/ld+json"]') as $node) $schema[]=json_decode($node->textContent,true);
    return response(['url'=>public_base().$path,'http_status'=>wp_remote_retrieve_response_code($r),'canonical'=>$canonical,'canonical_valid'=>count($canonical)===1 && $canonical[0]===public_base().$path,'title'=>$xp->evaluate('string(//title)'),'meta'=>$meta,'schema'=>$schema,'x_robots_tag'=>wp_remote_retrieve_header($r,'x-robots-tag'),'checked_at'=>gmdate('c')]);
}
function inspection_tick(string $id): void {
    $job=get_option('cohamy_html_inspect_'.$id); if (!$job || $job['state']!=='queued') return;
    $result=editorial_inspect($job['path']); $job['state']=is_wp_error($result) ? 'failed' : 'completed';
    $job['result']=is_wp_error($result) ? ['error'=>$result->get_error_message()] : $result->get_data(); update_option('cohamy_html_inspect_'.$id,$job,false);
}
add_action('cohamy_html_inspect',__NAMESPACE__.'\\inspection_tick',10,1);
add_action('rest_api_init',function () {
    op_route('content','GET','edit_posts',function ($r) { return response(editorial_list($r)); });
    op_route('content/bulk','POST','edit_posts',function ($r) { return editorial_bulk($r->get_json_params()); });
    op_route('content/duplicate','POST','edit_posts',function ($r) { return editorial_duplicate((int)$r['post_id']); });
    op_route('inspect','POST','cohamy_seo',function ($r) { $path=safe_path((string)$r['path']); $id=wp_generate_uuid4(); $job=['actor'=>get_current_user_id(),'state'=>'queued','path'=>$path,'created'=>time()]; update_option('cohamy_html_inspect_'.$id,$job,false); as_enqueue_async_action('cohamy_html_inspect',[$id],'cohamy',false,60); return response(['job_id'=>$id]+$job,202); });
    op_route('inspect/(?P<id>[a-f0-9-]{36})','GET','cohamy_seo',function ($r) { $job=get_option('cohamy_html_inspect_'.$r['id']); if (!$job || $job['actor']!==get_current_user_id()) return op_error('Không có quyền đọc inspection.',403); return response($job); });
});
