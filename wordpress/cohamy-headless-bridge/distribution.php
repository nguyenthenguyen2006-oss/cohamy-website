<?php
namespace Cohamy;
defined('ABSPATH') || exit;

function public_row(int $id): array {
    $row=row_for($id); $robots=(array)get_post_meta($id,'rank_math_robots',true);
    if(!$robots){$type=get_post_type($id);$custom=\RankMath\Helper::get_settings('titles.pt_'.$type.'_custom_robots',false);$robots=(array)\RankMath\Helper::get_settings($custom?'titles.pt_'.$type.'_robots':'titles.robots',[]);}
    $row['content_type']=get_post_type($id);
    $row['references']=[];foreach(['country','topic','subject','location'] as $kind)$row['references'][$kind]=meta($id,$kind.'_id');
    // Analysis keywords/scores are editorial data, served only by authorized ops APIs.
    $row['seo']=['follow'=>!in_array('nofollow',$robots,true),'pillar'=>get_post_meta($id,'rank_math_pillar_content',true)==='on'];
    foreach (['facebook_title','facebook_description','facebook_image','twitter_title','twitter_description','twitter_image','twitter_card_type'] as $key) {
        $raw=(string)get_post_meta($id,'rank_math_'.$key,true);
        $row['seo'][$key]=str_contains($key,'title') || str_contains($key,'description') ? trim(wp_strip_all_tags(\RankMath\Helper::replace_vars($raw,get_post($id)))) : $raw;
    }
    $primary=(int)get_post_meta($id,'rank_math_primary_category',true); $term=$primary ? get_term($primary,'category') : null;
    if ($term && !is_wp_error($term) && in_array($term->slug,CATEGORIES,true)) $row['category']=$term->slug;
    return $row;
}
function inventory_eligible_sql(string $alias='i'): string {
    global $wpdb;$defaults=[];foreach(['post','page'] as $type){$custom=\RankMath\Helper::get_settings('titles.pt_'.$type.'_custom_robots',false);$robots=(array)\RankMath\Helper::get_settings($custom?'titles.pt_'.$type.'_robots':'titles.robots',[]);if(!in_array('noindex',$robots,true))$defaults[]=$type;}
    $types=$defaults ? "('".implode("','",$defaults)."')" : "('none')";
    return "$alias.status='publish' AND EXISTS (SELECT 1 FROM {$wpdb->posts} ep WHERE ep.ID=$alias.post_id AND ep.post_status='publish' AND ep.post_password='' AND ep.post_date_gmt<='".gmdate('Y-m-d H:i:s')."') AND NOT EXISTS (SELECT 1 FROM ".op_table('redirect_rule')." er WHERE er.enabled=1 AND CONCAT('".esc_sql(public_base())."',er.source)=$alias.url) AND NOT EXISTS (SELECT 1 FROM {$wpdb->postmeta} en WHERE en.post_id=$alias.post_id AND en.meta_key='rank_math_robots' AND en.meta_value LIKE '%noindex%') AND ($alias.content_type IN $types OR EXISTS (SELECT 1 FROM {$wpdb->postmeta} em WHERE em.post_id=$alias.post_id AND em.meta_key='rank_math_robots' AND em.meta_value NOT IN ('','a:0:{}')))";
}
function public_query(array $input): array {
    $type=($input['type'] ?? '')==='page' ? 'page' : 'post'; $locale=$input['locale'] ?? 'en';
    if (!in_array($locale,LOCALES,true)) throw new \InvalidArgumentException('Ngôn ngữ không hợp lệ.');
    $size=max(1,min(500,(int)($input['page_size'] ?? 12))); $page=max(1,(int)($input['page'] ?? 1));
    $args=['post_type'=>$type,'post_status'=>'publish','has_password'=>false,'posts_per_page'=>$size,'paged'=>$page,'orderby'=>['date'=>'DESC','ID'=>'DESC'],'date_query'=>[['column'=>'post_date_gmt','before'=>gmdate('Y-m-d H:i:s'),'inclusive'=>true]],'meta_query'=>[['key'=>'_cohamy_locale','value'=>$locale],['key'=>'_cohamy_public_slug','compare'=>'EXISTS']]];
    if (!empty($input['q'])) $args['s']=mb_substr(sanitize_text_field($input['q']),0,200);
    if (!empty($input['category'])) $args['category_name']=sanitize_title($input['category']);
    if (!empty($input['group'])) $args['meta_query'][]=['key'=>'_cohamy_group_id','value'=>$input['group']];
    if (!empty($input['featured'])) $args['meta_query'][]=['key'=>'_cohamy_featured','value'=>'TRUE'];
    if (!empty($input['exclude'])) $args['meta_query'][]=['key'=>'_cohamy_legacy_id','value'=>$input['exclude'],'compare'=>'!='];
    if (!empty($input['location'])) $args['meta_query'][]=['key'=>'_cohamy_location_id','value'=>$input['location']];
    foreach(['country','topic','subject'] as $kind)if(!empty($input[$kind]))$args['meta_query'][]=['key'=>'_cohamy_'.$kind.'_id','value'=>(string)$input[$kind]];
    $featured=null;
    if (!empty($input['show_featured']) && empty($input['q']) && empty($input['category'])) {
        $featured_args=$args; $featured_args['posts_per_page']=1; $featured_args['paged']=1; $featured_args['meta_query'][]=['key'=>'_cohamy_featured','value'=>'TRUE'];
        $highlight=new \WP_Query($featured_args);
        if ($highlight->posts && is_public($highlight->posts[0]->ID)) { $featured=public_row($highlight->posts[0]->ID); $args['post__not_in']=[$highlight->posts[0]->ID]; $args['offset']=$page===1 ? 0 : max(0,$size-1)+($page-2)*$size; $args['posts_per_page']=$page===1 ? max(1,$size-1) : $size; }
    }
    $query=new \WP_Query($args);global $wpdb;if($wpdb->last_error)throw new \RuntimeException('Database nội dung tạm thời không đọc được.');$total=(int)$query->found_posts+($featured ? 1 : 0); $pages=max(1,(int)ceil($total/$size));
    if ($page>$pages) return public_query(array_merge($input,['page'=>$pages]));
    $items=[]; foreach ($query->posts as $post) if (is_public($post->ID)) $items[]=public_row($post->ID);
    if ($featured && $page===1 && $size===1) $items=[];
    $result=['items'=>$items,'page'=>$page,'pageSize'=>$size,'totalItems'=>$total,'totalPages'=>$pages,'revision'=>revision()];
    if ($featured && $page===1) $result['featured']=$featured; return $result;
}
function safe_path(string $value): string {
    $parts=wp_parse_url($value); if (!$parts) throw new \InvalidArgumentException('URL không hợp lệ.');
    if(isset($parts['user']) || isset($parts['pass']) || (isset($parts['scheme']) && $parts['scheme']!=='https') || (isset($parts['port']) && $parts['port']!==443))throw new \InvalidArgumentException('URL public phải dùng HTTPS, không có userinfo hoặc port riêng.');
    if (isset($parts['host']) && strtolower($parts['host'])!==strtolower(wp_parse_url(public_base(),PHP_URL_HOST))) throw new \InvalidArgumentException('Chỉ nhận URL website Cohamy.');
    $path=$parts['path'] ?? '/';
    if (!str_starts_with($path,'/') || str_starts_with($path,'//') || strlen($path)>2000 || preg_match('~[\x00-\x20\\\\]|\.\.|%(?:00|0a|0d|2e|2f|5c)~i',$path) || preg_match('~^/(?:api|admin|preview|wp-admin|wp-login)(?:/|$)~',$path)) throw new \InvalidArgumentException('Đường dẫn không hợp lệ hoặc là route quản trị.');
    return $path;
}
function redirect_batch_errors(array $items): array {
    global $wpdb;$rules=[];$errors=[];$sources=[];
    foreach($wpdb->get_results('SELECT source,target,code,enabled FROM '.op_table('redirect_rule'),ARRAY_A) as $rule)$rules[$rule['source']]=$rule;
    if($wpdb->last_error)throw new \RuntimeException('Không đọc được redirect để preview.');
    foreach($items as $item){$rule=$item['payload'];$source=$rule['source'];if(isset($sources[$source])){$errors[$item['ordinal']]='URL nguồn trùng dòng '.$sources[$source];$errors[$sources[$source]]='URL nguồn bị lặp trong file.';}$sources[$source]=$item['ordinal'];$rules[$source]=$rule;}
    foreach($items as $item){$rule=$item['payload'];if(!$rule['enabled'] || (int)$rule['code']===410)continue;$cursor=$rule['target'];$seen=[$rule['source']=>true];
        for($i=0;$cursor && $i<20;$i++){
            if(isset($seen[$cursor])){$errors[$item['ordinal']]='Vòng lặp redirect trong toàn bộ file / rule đang lưu.';break;}$seen[$cursor]=true;
            $next=$rules[$cursor] ?? null;if($next && $next['enabled']){if((int)$next['code']===410){$errors[$item['ordinal']]='Đích chuỗi redirect bị gỡ (410).';break;}$cursor=$next['target'];continue;}
            if(preg_match('~^/(vi|en|zh|ko|ja)/(bai-viet|blog|noi-dung|pages)/([a-z0-9-]+)$~',$cursor,$m)){$post=(int)$wpdb->get_var($wpdb->prepare('SELECT post_id FROM '.op_table('redirect').' WHERE path_key=%s',hash('sha256',$m[1].':'.$m[3])));if($wpdb->last_error)throw new \RuntimeException('Không đọc được lịch sử slug.');if($post && is_public($post)){$cursor=wp_parse_url(public_url($post),PHP_URL_PATH);continue;}}
            break;
        }
        if($i===20)$errors[$item['ordinal']]='Chuỗi redirect quá 20 bước.';
    }return $errors;
}
function redirect_save(array $input) {
    global $wpdb; $source=safe_path((string)($input['source'] ?? '')); $code=(int)($input['code'] ?? 301); $enabled=empty($input['enabled']) ? 0 : 1;
    if (!in_array($code,[301,302,307,308,410],true)) return op_error('HTTP code không hợp lệ.');
    $target=$code===410 ? '' : safe_path((string)($input['target'] ?? ''));
    $cursor=$target; $seen=[$source=>true];
    for ($i=0;$cursor && $i<20;$i++) {
        if (isset($seen[$cursor])) return op_error('Redirect tạo vòng lặp.',409); $seen[$cursor]=true;
        $next=$wpdb->get_row($wpdb->prepare('SELECT * FROM '.op_table('redirect_rule').' WHERE path_key=%s AND enabled=1',hash('sha256',$cursor)),ARRAY_A);
        if (!$next) {
            if (preg_match('~^/(vi|en|zh|ko|ja)/(bai-viet|blog|noi-dung|pages)/([a-z0-9-]+)$~',$cursor,$m)) {
                $post_id=(int)$wpdb->get_var($wpdb->prepare('SELECT post_id FROM '.op_table('redirect').' WHERE path_key=%s',hash('sha256',$m[1].':'.$m[3])));
                if ($post_id && is_public($post_id)) { $cursor=wp_parse_url(public_url($post_id),PHP_URL_PATH); continue; }
            }
            break;
        }
        if ((int)$next['code']===410) return op_error('Đích redirect đã bị gỡ (410).',409); $cursor=$next['target'];
    }
    if ($i===20) return op_error('Chuỗi redirect quá dài.',409);
    $data=['path_key'=>hash('sha256',$source),'source'=>$source,'target'=>$target,'code'=>$code,'enabled'=>$enabled];
    $old=$wpdb->get_row($wpdb->prepare('SELECT * FROM '.op_table('redirect_rule').' WHERE path_key=%s',$data['path_key']),ARRAY_A);
    $saved=$old ? $wpdb->update(op_table('redirect_rule'),$data,['path_key'=>$data['path_key']]) : $wpdb->insert(op_table('redirect_rule'),$data);
    if($saved===false)return op_error('Không ghi được redirect; thử lại khi database sẵn sàng.',503);
    $post_id=(int)$wpdb->get_var($wpdb->prepare('SELECT post_id FROM '.op_table('inventory').' WHERE url=%s',public_base().$source)); if ($post_id) inventory_update($post_id);
    update_option('cohamy_revision',wp_generate_uuid4(),false); op_audit('redirect.save',$data['path_key'],$old,$data); return response($data);
}
function export_start(array $input) {
    global $wpdb; $format=$input['format'] ?? 'txt'; if (!in_array($format,['txt','csv'],true)) return op_error('Format txt/csv.');
    $where='1=1';
    if (array_key_exists('wp_ids',$input) && $input['wp_ids']!=='' && $input['wp_ids']!==[]) {
        $selected=is_array($input['wp_ids']) ? $input['wp_ids'] : preg_split('/[\s,]+/',trim((string)$input['wp_ids']),-1,PREG_SPLIT_NO_EMPTY);
        if (!$selected || count($selected)>20000) return op_error('Chọn từ 1 đến 20.000 WordPress IDs.');
        foreach ($selected as $value) if (!ctype_digit((string)$value) || (int)$value<1) return op_error('WordPress IDs phải là số nguyên dương.');
        $selected=array_values(array_unique(array_map('intval',$selected)));
        $where.=' AND i.post_id IN ('.implode(',',$selected).')';
        $input['wp_ids']=$selected;
    }
    if (!empty($input['indexable_only'])) $where.=' AND ('.inventory_eligible_sql().')';
    foreach (['locale','status','content_type'] as $key) if (!empty($input[$key])) $where.=$wpdb->prepare(" AND $key=%s",$input[$key]);
    foreach (['from'=>'>=','to'=>'<='] as $key=>$operator) if (!empty($input[$key])) { if (strtotime($input[$key])===false) return op_error('Ngày lọc không hợp lệ.');$date=(string)$input[$key];if(preg_match('/^\d{4}-\d\d-\d\d$/D',$date))$date=(new \DateTimeImmutable($date.($key==='to'?' 23:59:59.999':' 00:00:00'),wp_timezone()))->format('Y-m-d\TH:i:s.vP'); $where.=$wpdb->prepare(" AND modified $operator %s",utc($date)); }
    $join=''; foreach (['campaign_id','location_id','country_id','topic_id','subject_id','template_base'] as $key) if (!empty($input[$key])) { $alias='m_'.$key; $join.=$wpdb->prepare(" JOIN {$wpdb->postmeta} $alias ON $alias.post_id=i.post_id AND $alias.meta_key=%s AND $alias.meta_value=%s",'_cohamy_'.$key,$input[$key]); }
    if(!empty($input['category']))$where.=$wpdb->prepare(" AND EXISTS (SELECT 1 FROM {$wpdb->term_relationships} tr JOIN {$wpdb->term_taxonomy} tt ON tt.term_taxonomy_id=tr.term_taxonomy_id JOIN {$wpdb->terms} t ON t.term_id=tt.term_id WHERE tr.object_id=i.post_id AND tt.taxonomy='category' AND t.slug=%s)",$input['category']);
    $id=wp_generate_uuid4();
    $wpdb->query('START TRANSACTION');
    try {
        // A single INSERT SELECT freezes membership + URLs; later edits do not reorder the export.
        $count=$wpdb->query($wpdb->prepare('INSERT INTO '.op_table('export_item')." (job_id,ordinal,url,locale,content_type,status,modified) SELECT %s,i.post_id,i.url,i.locale,i.content_type,i.status,i.modified FROM ".op_table('inventory')." i $join WHERE $where ORDER BY i.post_id",$id));
        if ($count===false) throw new \RuntimeException('Không chụp được danh sách export.');
        if (!$wpdb->insert(op_table('export_job'),['job_id'=>$id,'actor'=>get_current_user_id(),'state'=>'queued','format'=>$format,'total'=>$count,'last_ordinal'=>0,'created'=>time(),'manifest'=>wp_json_encode(['files'=>[],'current_count'=>0,'records_written'=>0,'limit'=>10000,'selection'=>$input])])) throw new \RuntimeException('Không ghi được export job.');
        if($wpdb->query('COMMIT')===false)throw new \RuntimeException('Không commit được export snapshot.');
    } catch (\Throwable $e) { $wpdb->query('ROLLBACK'); throw $e; }
    as_enqueue_async_action('cohamy_export_tick',[$id],'cohamy',false,30); op_audit('export.start',$id,null,['format'=>$format,'total'=>$count]); return response(['job_id'=>$id,'total'=>$count],201);
}
function export_directory(string $id): string { return rtrim(get_temp_dir(),'/\\').'/cohamy-export-'.$id; }
function export_tick(string $id): void {
    global $wpdb; $job=$wpdb->get_row($wpdb->prepare('SELECT * FROM '.op_table('export_job').' WHERE job_id=%s',$id),ARRAY_A);
    if (!$job || !in_array($job['state'],['queued','processing'],true)) return;
    $lock='cohamy_export_lock_'.$id;$owner=op_lease($lock);if(!$owner)return;
    try {
        $dir=export_directory($id); if (!is_dir($dir)) wp_mkdir_p($dir); chmod($dir,0700);
        $m=json_decode($job['manifest'],true); $items=$wpdb->get_results($wpdb->prepare('SELECT ordinal,url,locale,content_type,status,modified FROM '.op_table('export_item').' WHERE job_id=%s AND ordinal>%d ORDER BY ordinal LIMIT 1000',$id,$job['last_ordinal']),ARRAY_A);if($wpdb->last_error)throw new \RuntimeException('Không đọc được export snapshot.');
        // Buffer one batch and open each file once; Windows antivirus makes per-URL opens expensive.
        $offsets=array_column($m['files'],'bytes'); $buffers=[];
        foreach ($items as $item) {
            if (!$m['files'] || $m['current_count']>=10000) { $m['files'][]=['name'=>'urls-'.str_pad((string)(count($m['files'])+1),4,'0',STR_PAD_LEFT).'.'.$job['format'],'count'=>0,'bytes'=>0]; $m['current_count']=0; }
            $number=count($m['files'])-1; $file=&$m['files'][$number];$cells=[$item['url'],$item['ordinal'],$item['locale'],$item['content_type'],$item['status'],$item['modified']];$line=($job['format']==='csv'?implode(';',array_map(fn($cell)=>'"'.str_replace('"','""',(string)$cell).'"',$cells)):$item['url'])."\r\n";
            if (!$file['bytes'] && $job['format']==='csv') $line="\xEF\xBB\xBFsep=;\r\nurl;wp_id;locale;content_type;status;last_modified_utc\r\n".$line;
            $buffers[$number]=($buffers[$number] ?? '').$line; $file['bytes']+=strlen($line); $file['count']++; $m['current_count']++; $m['records_written']++; $job['last_ordinal']=$item['ordinal']; unset($file);
        }
        foreach($buffers as $number=>$buffer) { $handle=fopen($dir.'/'.$m['files'][$number]['name'],'c+b'); if(!$handle)throw new \RuntimeException('Không mở được file export.'); try { if(!ftruncate($handle,$offsets[$number] ?? 0) || fseek($handle,0,SEEK_END)!==0 || fwrite($handle,$buffer)!==strlen($buffer) || !fflush($handle))throw new \RuntimeException('Không ghi đủ batch export.'); }finally{fclose($handle);} }
        $done=$m['records_written']===(int)$job['total'];
        if ($done) {
            foreach ($m['files'] as &$file) $file['sha256']=hash_file('sha256',$dir.'/'.$file['name']); unset($file);
            $m['snapshot_created_at']=gmdate('c',(int)$job['created']); $m['total']=(int)$job['total'];
            file_put_contents($dir.'/manifest.json',wp_json_encode($m,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
            $zip=new \ZipArchive(); if ($zip->open($dir.'/urls.zip',\ZipArchive::CREATE|\ZipArchive::OVERWRITE)!==true) throw new \RuntimeException('Không tạo được ZIP.');
            foreach ($m['files'] as $file) $zip->addFile($dir.'/'.$file['name'],$file['name']); $zip->addFile($dir.'/manifest.json','manifest.json'); $zip->close();
        }
        if($wpdb->update(op_table('export_job'),['state'=>$done ? 'completed' : 'processing','last_ordinal'=>$job['last_ordinal'],'manifest'=>wp_json_encode($m)],['job_id'=>$id])===false)throw new \RuntimeException('Không ghi được checkpoint export.');
        if (!$done) as_schedule_single_action(time()+2,'cohamy_export_tick',[$id],'cohamy',false,30);
    } catch(\Throwable $e) {
        // File writes may have happened; the next attempt truncates to the committed offsets.
        $committed=json_decode($job['manifest'],true);$committed['attempts']=(int)($committed['attempts'] ?? 0)+1;$committed['error']=$e->getMessage();
        $wpdb->update(op_table('export_job'),['state'=>$committed['attempts']>=5 ? 'failed' : 'processing','manifest'=>wp_json_encode($committed)],['job_id'=>$id]);
        if($committed['attempts']<5)as_schedule_single_action(time()+min(900,10*(2**$committed['attempts'])),'cohamy_export_tick',[$id],'cohamy',false,30);
        error_log('Cohamy export: '.$e->getMessage());
    } finally { op_release($lock,$owner); }
}
add_action('cohamy_export_tick',__NAMESPACE__.'\\export_tick',10,1);
add_action('rest_api_init',function () {
    register_rest_route('cohamy/v1','/site-seo',['methods'=>'GET','permission_callback'=>'__return_true','callback'=>function () {
        if (!rank_math_ready()) return op_error('Rank Math chưa sẵn sàng.',503);
        $settings=(array)get_option('rank-math-options-titles',[]); $social=[];
        foreach (['facebook','twitter','instagram','linkedin','youtube','pinterest'] as $network) if (!empty($settings['social_url_'.$network]) && preg_match('~^https://~',$settings['social_url_'.$network])) $social[]=$settings['social_url_'.$network];
        return response(['revision'=>revision(),'name'=>(string)($settings['knowledgegraph_name'] ?? ''),'logo'=>(string)($settings['knowledgegraph_logo'] ?? ''),'same_as'=>$social,'website_name'=>get_bloginfo('name'),'website_description'=>get_bloginfo('description')]);
    }]);
    register_rest_route('cohamy/v1','/content',['methods'=>'GET','permission_callback'=>'__return_true','callback'=>function ($r) { try { if (!rank_math_ready()) return op_error('Rank Math chưa sẵn sàng.',503); return response(public_query($r->get_params())); } catch (\Throwable $e) { return op_error($e->getMessage(),503); } }]);
    register_rest_route('cohamy/v1','/content/detail',['methods'=>'GET','permission_callback'=>'__return_true','callback'=>function ($r) {
        global $wpdb; if (!rank_math_ready()) return op_error('Rank Math chưa sẵn sàng.',503);
        $key=hash('sha256',(string)$r['locale'].':'.(string)$r['slug']); $id=(int)$wpdb->get_var($wpdb->prepare('SELECT post_id FROM '.op_table('identity').' WHERE slug_key=%s',$key));
        if($wpdb->last_error)return op_error('Database nội dung tạm thời không đọc được.',503);
        if (!$id || !is_public($id) || get_post_type($id)!==($r['type']==='page' ? 'page' : 'post')) return response(['post'=>null,'revision'=>revision()]);
        return response(['post'=>public_row($id),'revision'=>revision()]);
    }]);
    register_rest_route('cohamy/v1','/sitemaps',['methods'=>'GET','permission_callback'=>'__return_true','callback'=>function ($r) {
        global $wpdb; if (!rank_math_ready()) return op_error('Rank Math chưa sẵn sàng.',503);
        if ($r['shard']!==null) { $id=(int)$r['shard']; $rev=$wpdb->get_var($wpdb->prepare('SELECT revision FROM '.op_table('shard').' WHERE shard_id=%d',$id));
            if ($r['revision'] && $r['revision']!==$rev) return response(['error'=>'revision_changed'],409);
            $rows=$wpdb->get_results($wpdb->prepare('SELECT i.url,i.modified FROM '.op_table('inventory').' i WHERE i.shard=%d AND ('.inventory_eligible_sql().') ORDER BY i.post_id LIMIT 5001',$id),ARRAY_A);
            if($wpdb->last_error)return op_error('Database sitemap tạm thời không đọc được.',503);
            if ($wpdb->get_var($wpdb->prepare('SELECT revision FROM '.op_table('shard').' WHERE shard_id=%d',$id))!==$rev) return response(['error'=>'revision_changed'],409);
            return response(['revision'=>$rev,'items'=>$rows]);
        }
        $items=$wpdb->get_results('SELECT s.shard_id,s.revision,s.modified,COUNT(i.post_id) AS count FROM '.op_table('shard').' s JOIN '.op_table('inventory').' i ON i.shard=s.shard_id WHERE ('.inventory_eligible_sql().') GROUP BY s.shard_id,s.revision,s.modified ORDER BY s.shard_id',ARRAY_A);if($wpdb->last_error)return op_error('Database sitemap tạm thời không đọc được.',503);return response(['revision'=>revision(),'items'=>$items]);
    }]);
    register_rest_route('cohamy/v1','/redirect',['methods'=>'GET','permission_callback'=>'__return_true','callback'=>function ($r) {
        global $wpdb; try { $path=safe_path((string)$r['path']); } catch (\Throwable $e) { return op_error($e->getMessage()); }
        $row=$wpdb->get_row($wpdb->prepare('SELECT source,target,code FROM '.op_table('redirect_rule').' WHERE path_key=%s AND enabled=1',hash('sha256',$path)),ARRAY_A);
        if($wpdb->last_error)return op_error('Database redirect tạm thời không đọc được.',503);
        if ($row) $wpdb->query($wpdb->prepare('UPDATE '.op_table('redirect_rule').' SET hits=hits+1 WHERE path_key=%s',hash('sha256',$path)));
        if ($row) $row['code']=(int)$row['code'];
        return response(['rule'=>$row]);
    }]);
    register_rest_route('cohamy/v1','/not-found',['methods'=>'POST','permission_callback'=>__NAMESPACE__.'\\op_auth_signature','callback'=>function ($r) {
        global $wpdb;try{$path=safe_path((string)$r['path']);}catch(\Throwable $e){return op_error($e->getMessage());}$key=hash('sha256',$path);$event=(string)$r['request_id'];if($event && !preg_match('/^[a-f0-9-]{36}$/D',$event))return op_error('Request ID không hợp lệ.');
        if($wpdb->query('START TRANSACTION')===false)return op_error('Không ghi được log 404.',503);
        try{
            $changed=$wpdb->query($wpdb->prepare('UPDATE '.op_table('not_found').' SET hits=hits+1,last_seen=%d WHERE path_key=%s',time(),$key));if($changed===false)throw new \RuntimeException('Cập nhật log 404 thất bại.');
            if($event && !add_option('cohamy404event_'.$event,time(),'','no')){$wpdb->query('ROLLBACK');return response(['recorded'=>false,'duplicate'=>true]);}
            if(!$changed && !$wpdb->insert(op_table('not_found'),['path_key'=>$key,'path'=>$path,'hits'=>1,'first_seen'=>time(),'last_seen'=>time()]))throw new \RuntimeException('Tạo log 404 thất bại.');
            if($wpdb->query($wpdb->prepare('DELETE FROM '.op_table('not_found').' WHERE last_seen<%d',time()-30*DAY_IN_SECONDS))===false || $wpdb->query('COMMIT')===false)throw new \RuntimeException('Commit log 404 thất bại.');return response(['recorded'=>true]);
        }catch(\Throwable $e){$wpdb->query('ROLLBACK');if($event)wp_cache_delete('cohamy404event_'.$event,'options');return op_error($e->getMessage(),503);}
    }]);
    op_route('redirects','GET','cohamy_seo',function ($r) { global $wpdb;$where=$wpdb->prepare('(source LIKE %s OR target LIKE %s)','%'.$wpdb->esc_like((string)$r['q']).'%','%'.$wpdb->esc_like((string)$r['q']).'%');if(in_array((string)$r['enabled'],['0','1'],true))$where.=$wpdb->prepare(' AND enabled=%d',(int)$r['enabled']);if($r['code'])$where.=$wpdb->prepare(' AND code=%d',(int)$r['code']);return response($wpdb->get_results('SELECT * FROM '.op_table('redirect_rule')." WHERE $where ORDER BY hits DESC,path_key LIMIT 50 OFFSET ".(max(0,(int)$r['page']-1)*50),ARRAY_A)); });
    op_route('redirects','POST','cohamy_seo',function ($r) { return redirect_save($r->get_json_params()); });
    op_route('404','GET','cohamy_seo',function ($r) { global $wpdb;$where=$wpdb->prepare('path LIKE %s AND hits>=%d','%'.$wpdb->esc_like((string)$r['q']).'%',max(1,(int)$r['min_hits']));foreach(['from'=>'>=','to'=>'<='] as $key=>$op)if($r[$key]){if(!preg_match('/^\d{4}-\d\d-\d\d$/D',(string)$r[$key]))return op_error('Ngày cần YYYY-MM-DD.');$where.=$wpdb->prepare(" AND last_seen$op%d",strtotime($r[$key].($key==='to'?' 23:59:59 UTC':' 00:00:00 UTC')));}return response($wpdb->get_results('SELECT * FROM '.op_table('not_found')." WHERE $where ORDER BY hits DESC,path_key LIMIT 50 OFFSET ".(max(0,(int)$r['page']-1)*50),ARRAY_A)); });
    op_route('exports','POST','cohamy_export',function ($r) { return export_start($r->get_json_params()); });
    op_route('exports','GET','cohamy_export',function ($r) { global $wpdb; $rows=$wpdb->get_results($wpdb->prepare('SELECT * FROM '.op_table('export_job').' WHERE actor=%d ORDER BY created DESC,job_id LIMIT 25 OFFSET %d',get_current_user_id(),max(0,(int)$r['page']-1)*25),ARRAY_A); foreach ($rows as &$row) $row['manifest']=json_decode($row['manifest'],true); return response($rows); });
    op_route('exports/(?P<id>[a-f0-9-]{36})/download','GET','cohamy_export',function ($r) {
        global $wpdb; $job=$wpdb->get_row($wpdb->prepare('SELECT * FROM '.op_table('export_job').' WHERE job_id=%s',$r['id']),ARRAY_A);
        if (!$job || (int)$job['actor']!==get_current_user_id()) return op_error('Không có quyền xem export.',403);
        if ($job['state']==='expired')return op_error('File export đã hết hạn.',410);
        if ($job['state']!=='completed') return op_error('Export chưa hoàn tất.',409); $path=export_directory($r['id']).'/urls.zip';
        if (!is_file($path)) return op_error('File export đã hết hạn.',410);
        header('Content-Type: application/zip'); header('Content-Disposition: attachment; filename="cohamy-urls-'.$r['id'].'.zip"'); header('Cache-Control: private, no-store'); header('X-Robots-Tag: noindex'); readfile($path); exit;
    });
});
