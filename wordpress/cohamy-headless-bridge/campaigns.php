<?php
namespace Cohamy;
defined('ABSPATH') || exit;

function campaign_get(string $id,int $page=1): ?array {
    global $wpdb; $row=$wpdb->get_row($wpdb->prepare('SELECT * FROM '.op_table('campaign').' WHERE campaign_id=%s',$id),ARRAY_A);
    if (!$row) return null; $row['payload']=json_decode($row['payload'],true);
    $row['stats']=$wpdb->get_results($wpdb->prepare('SELECT state,COUNT(*) AS count,SUM(duration_ms) AS duration_ms FROM '.op_table('campaign_item').' WHERE campaign_id=%s GROUP BY state',$id),ARRAY_A);
    $row['items']=$wpdb->get_results($wpdb->prepare('SELECT item_key,state,post_id,attempts,error,duration_ms FROM '.op_table('campaign_item').' WHERE campaign_id=%s ORDER BY item_key LIMIT 100 OFFSET %d',$id,max(0,$page-1)*100),ARRAY_A);
    $counts=[];$duration=0;foreach($row['stats'] as $stat){$counts[$stat['state']]=(int)$stat['count'];$duration+=(int)$stat['duration_ms'];}
    $created=(int)$wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM '.op_table('campaign_item').' WHERE campaign_id=%s AND post_id>0',$id));
    $published=(int)$wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM '.op_table('campaign_item')." ci JOIN {$wpdb->posts} p ON p.ID=ci.post_id WHERE ci.campaign_id=%s AND p.post_status='publish'",$id));
    if($wpdb->last_error)throw new \RuntimeException('Không đọc được báo cáo campaign.');
    $row['progress']=['expected'=>(int)$row['payload']['dry_run_total'],'created'=>$created,'published_now'=>$published,'updated'=>0,'skipped'=>(int)$row['payload']['duplicates'],'errors'=>$counts['failed'] ?? 0,'remaining'=>($counts['queued'] ?? 0)+($counts['processing'] ?? 0),'worker_seconds'=>round($duration/1000,3),'completed_per_worker_second'=>$duration>0?round(($counts['completed'] ?? 0)*1000/$duration,2):null,'started_at'=>gmdate('c',(int)$row['created']),'last_heartbeat'=>$row['heartbeat']?gmdate('c',(int)$row['heartbeat']):null,'speed_scope'=>'Thời gian xử lý từng item; không tính thời gian chờ quota/queue.','existing_policy'=>'skip_existing'];
    foreach($row['items'] as &$item){$item['editor_url']=$item['post_id']?get_edit_post_link((int)$item['post_id'],'raw'):null;$item['public_url']=$item['post_id'] && is_public((int)$item['post_id'])?public_url((int)$item['post_id']):null;}unset($item);$row['items_page']=max(1,$page);$row['items_total']=array_sum($counts);
    return $row;
}
function campaign_vars(?array $subject,array $location): array {
    $vars=[]; foreach (['subject'=>$subject,'location'=>$location] as $prefix=>$record) if ($record) {
        if ($record['kind']!=='record' || $record['state']!=='approved') throw new \InvalidArgumentException('Dữ liệu chưa được duyệt: '.$record['entity_id']);
        if (!empty($record['payload']['expires_at']) && strtotime($record['payload']['expires_at'])<time()) throw new \InvalidArgumentException('Dữ liệu đã hết hạn: '.$record['entity_id']);
        $vars[$prefix.'.id']=$record['entity_id']; $vars[$prefix.'.name']=$record['name'];
        foreach ($record['payload']['fields'] as $key=>$value) $vars[$prefix.'.'.$key]=(string)$value;
    }
    $vars['year']=wp_date('Y'); $vars['site.name']=get_bloginfo('name'); return $vars;
}
function campaign_render(array $template,array $vars): array {
    if ($template['kind']!=='template' || $template['state']!=='approved') throw new \InvalidArgumentException('Template chưa được duyệt.');
    $p=$template['payload'];
    foreach ((array)($p['required_variables'] ?? []) as $key) if (!isset($vars[$key]) || trim($vars[$key])==='') throw new \InvalidArgumentException('Thiếu biến bắt buộc '.$key);
    $replace=function ($value,string $field) use (&$replace,$vars) {
        if (is_array($value)) { foreach ($value as &$child) $child=$replace($child,$field); return $value; }
        if (!is_string($value)) return $value;
        $result=preg_replace_callback('/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/',function ($m) use ($vars,$field) {
            if (!isset($vars[$m[1]])) throw new \InvalidArgumentException('Thiếu biến '.$m[1]);
            return $field==='content_html' ? esc_html($vars[$m[1]]) : $vars[$m[1]];
        },$value);
        if (preg_match('/\{\{|\}\}/',$result)) throw new \InvalidArgumentException('Placeholder không hợp lệ còn trong '.$field);
        return $result;
    };
    $result=[]; foreach (array_diff(HEADERS,['id','group_id','canonical_url','created_at','updated_at','published_at','scheduled_at']) as $field) $result[$field]=$replace($p[$field] ?? '',$field);
    $result['locale']=$result['locale'] ?: 'vi'; $result['category']=$result['category'] ?: 'brand-story'; $result['author']=$result['author'] ?: 'Cohamy';
    $result['slug']=sanitize_title(remove_accents($result['slug'] ?: $result['title']));
    $result['status']='draft'; $result['robots_index']=$result['robots_index']!==false && $result['robots_index']!=='FALSE' ? 'TRUE' : 'FALSE';
    $result['featured']=($result['featured']===true || $result['featured']==='TRUE') ? 'TRUE' : 'FALSE';
    foreach (['tags','related_product_ids'] as $field) if (is_array($result[$field])) $result[$field]=implode(',',$result[$field]);
    foreach(['focus_keyword','facebook_title','facebook_description','facebook_image','twitter_title','twitter_description','twitter_image','country_id','topic_id','subject_id'] as $field)if(isset($p[$field]))$result[$field]=$replace($p[$field],$field);
    return $result;
}
function campaign_plan(array $input): array {
    $templates=array_values(array_unique((array)($input['templates'] ?? []))); $locations=array_values(array_unique((array)($input['locations'] ?? []))); $subject=!empty($input['subject']) ? entity_get($input['subject']) : null;
    if (!$templates || !$locations || count($templates)*count($locations)>20000) throw new \InvalidArgumentException('Chọn template và location, tối đa 20.000 tổ hợp/campaign.');
    if(!empty($input['subject']) && (!$subject || ($subject['payload']['type'] ?? '')!=='subject'))throw new \InvalidArgumentException('Subject ID đã chọn không tồn tại hoặc sai loại.');
    $items=[]; $errors=[]; $duplicates=0; global $wpdb;
    foreach ($templates as $tid) foreach ($locations as $lid) {
        try {
            $template=entity_get($tid); $location=entity_get($lid);
            if (!$template || !$location || ($location['payload']['type'] ?? '')!=='location') throw new \InvalidArgumentException('Template hoặc location không tồn tại.');
            $key=hash('sha256',get_option('cohamy_site_id').':'.$template['payload']['base_id'].':'.($subject['entity_id'] ?? '-').':'.$location['entity_id']);
            $row=campaign_render($template,campaign_vars($subject,$location));
            foreach(['country_id','topic_id'] as $field){$values=array_filter([$row[$field] ?? '',$location['payload']['fields'][$field] ?? '',$subject['payload']['fields'][$field] ?? '']);if(count(array_unique($values))>1)throw new \InvalidArgumentException('Thông tin mâu thuẫn '.$field.' giữa template, subject và location.');}
            if($subject)$row['subject_id']=$subject['entity_id'];
            foreach(['country','topic'] as $kind)if(empty($row[$kind.'_id']) && !empty($location['payload']['fields'][$kind.'_id']))$row[$kind.'_id']=$location['payload']['fields'][$kind.'_id'];
            $row['id']='clone-'.$key; $row['group_id']='clone-'.$key; $row['canonical_url']=''; $row['created_at']=''; $row['updated_at']=''; $row['published_at']=''; $row['scheduled_at']='';
            $existing=$wpdb->get_var($wpdb->prepare('SELECT post_id FROM '.op_table('campaign_item').' WHERE item_key=%s',$key));
            if ($existing!==null) { $duplicates++; continue; }
            $seen=[]; validate_import_row($row,['mode'=>'create','preserve_status'=>false,'preserve_dates'=>false],$seen);
            $items[]=['key'=>$key,'row'=>$row,'template_id'=>$tid,'template_version'=>$template['version'],'location_id'=>$lid,'subject_id'=>$subject['entity_id'] ?? null];
        } catch (\Throwable $e) { $errors[]=['template'=>$tid,'location'=>$lid,'error'=>$e->getMessage()]; }
    }
    return ['items'=>$items,'errors'=>$errors,'duplicates'=>$duplicates,'total_combinations'=>count($templates)*count($locations)];
}
function campaign_enqueue(string $id,int $at=0): void {
    if (!function_exists('as_schedule_single_action')) throw new \RuntimeException('Action Scheduler chưa hoạt động.');
    if (as_get_scheduled_actions(['hook'=>'cohamy_campaign_tick','args'=>[$id],'group'=>'cohamy','status'=>'pending','per_page'=>1],'ids')) return;
    as_schedule_single_action(max(time()+1,$at),'cohamy_campaign_tick',[$id],'cohamy',false,20);
}
function campaign_start(array $input) {
    global $wpdb; $plan=campaign_plan($input);
    if ($plan['errors']) return response(['valid'=>false,'errors'=>$plan['errors'],'duplicates'=>$plan['duplicates']],422);
    if (empty($input['confirmed'])) return op_error('Phải preview và xác nhận campaign trước khi ghi.');
    $status=$input['publish_mode'] ?? 'draft';
    if (!in_array($status,['draft','pending','scheduled','published'],true)) return op_error('Chọn chế độ xuất bản.');
    if (in_array($status,['scheduled','published'],true) && !current_user_can('publish_posts')) return op_error('Không đủ quyền xuất bản.',403);
    if (!empty($input['daily_at']) && !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/D',$input['daily_at'])) return op_error('Giờ hằng ngày cần HH:mm theo Asia/Ho_Chi_Minh.');
    if ($status==='scheduled' && (empty($input['scheduled_at']) || !preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)$/D',$input['scheduled_at']) || strtotime($input['scheduled_at'])<=time())) return op_error('Cần scheduled_at ISO 8601 trong tương lai, có timezone.');
    $id=wp_generate_uuid4(); $payload=['name'=>sanitize_text_field($input['name'] ?? 'Campaign'),'publish_mode'=>$status,'scheduled_at'=>$input['scheduled_at'] ?? '', 'daily_at'=>$input['daily_at'] ?? '', 'daily_quota'=>max(1,min(1000,(int)($input['daily_quota'] ?? 100))), 'batch_size'=>max(1,min(10,(int)($input['batch_size'] ?? 5))), 'catchup'=>'skip_missed','duplicates'=>$plan['duplicates'],'completed_today'=>0,'quota_date'=>'','dry_run_total'=>$plan['total_combinations']];
    $wpdb->query('START TRANSACTION');
    try {
        if (!$wpdb->insert(op_table('campaign'),['campaign_id'=>$id,'actor'=>get_current_user_id(),'state'=>'running','payload'=>wp_json_encode($payload),'heartbeat'=>0,'created'=>time()])) throw new \RuntimeException('Không ghi được campaign.');
        foreach ($plan['items'] as $item) if (!$wpdb->insert(op_table('campaign_item'),['item_key'=>$item['key'],'campaign_id'=>$id,'payload'=>wp_json_encode($item),'state'=>'queued','error'=>''])) throw new \RuntimeException('Một tổ hợp đã được campaign khác nhận; preview lại.');
        if($wpdb->query('COMMIT')===false)throw new \RuntimeException('Không commit được campaign.');
    } catch (\Throwable $e) { $wpdb->query('ROLLBACK'); return op_error($e->getMessage(),409); }
    campaign_enqueue($id); op_audit('campaign.start',$id,null,$payload); return response(campaign_get($id),201);
}
function campaign_tick(string $id): void {
    global $wpdb; $campaign=campaign_get($id); if (!$campaign || $campaign['state']!=='running') return;
    $global_owner=op_lease('cohamy_generation_global'); if(!$global_owner){campaign_enqueue($id,time()+10);return;}
    $lock='cohamy_campaign_lock_'.$id; $owner=wp_generate_uuid4();
    // Lease acquisition/recovery is one compare-and-swap SQL operation.
    $encoded=wp_json_encode(['owner'=>$owner,'until'=>time()+120]);
    if (!add_option($lock,$encoded,'','no')) {
        $old=(string)get_option($lock); $lease=json_decode($old,true);
        if (($lease['until'] ?? 0)>time()) {op_release('cohamy_generation_global',$global_owner);return;}
        if (!$wpdb->query($wpdb->prepare("UPDATE {$wpdb->options} SET option_value=%s WHERE option_name=%s AND option_value=%s",$encoded,$lock,$old))) {op_release('cohamy_generation_global',$global_owner);return;}
        wp_cache_delete($lock,'options');
    }
    $previous=get_current_user_id(); wp_set_current_user((int)$campaign['actor']);
    try {
        if (!current_user_can('cohamy_campaigns')) { $wpdb->update(op_table('campaign'),['state'=>'blocked'],['campaign_id'=>$id]); return; }
        $p=$campaign['payload']; $today=wp_date('Y-m-d',null,new \DateTimeZone('Asia/Ho_Chi_Minh'));
        if ($p['quota_date']!==$today) { $p['quota_date']=$today; $p['completed_today']=0; }
        if ($p['daily_at']) {
            $now=new \DateTimeImmutable('now',new \DateTimeZone('Asia/Ho_Chi_Minh')); $at=new \DateTimeImmutable($today.' '.$p['daily_at'],new \DateTimeZone('Asia/Ho_Chi_Minh'));
            // Do not burst after a missed window; next day gets its own quota.
            if ($now<$at || $now->getTimestamp()>$at->getTimestamp()+300) { if ($now>$at) $at=$at->modify('+1 day'); campaign_enqueue($id,$at->getTimestamp()); return; }
        }
        if ($p['completed_today']>=$p['daily_quota']) { campaign_enqueue($id,(new \DateTimeImmutable('tomorrow '.($p['daily_at'] ?: '00:00'),new \DateTimeZone('Asia/Ho_Chi_Minh')))->getTimestamp()); return; }
        if (memory_get_usage(true)>350*1024*1024 || (function_exists('sys_getloadavg') && ($load=sys_getloadavg()) && $load[0]>8)) { campaign_enqueue($id,time()+60); return; }
        if(!worker_health()){campaign_enqueue($id,time()+60);return;}
        $items=$wpdb->get_results($wpdb->prepare('SELECT * FROM '.op_table('campaign_item')." WHERE campaign_id=%s AND (state='queued' OR (state='processing' AND lease_until<%d)) ORDER BY item_key LIMIT %d",$id,time(),min($p['batch_size'],$p['daily_quota']-$p['completed_today'])),ARRAY_A);
        foreach ($items as $item) {
            if (($fresh=campaign_get($id))['state']!=='running') break;
            $start=microtime(true); $key=$item['item_key']; $attempt=(int)$item['attempts']+1;
            if (!$wpdb->query($wpdb->prepare('UPDATE '.op_table('campaign_item')." SET state='processing',attempts=%d,lease_until=%d WHERE item_key=%s AND (state='queued' OR lease_until<%d)",$attempt,time()+120,$key,time()))) continue;
            $data=json_decode($item['payload'],true);
            global $dirty_posts,$reservations,$preserve_dates; $before=[$dirty_posts,$reservations,$preserve_dates];
            try {
                $template=entity_get($data['template_id']); $location=entity_get($data['location_id']); $subject=$data['subject_id'] ? entity_get($data['subject_id']) : null;
                campaign_vars($subject,$location); if (!$template || $template['state']!=='approved') throw new \RuntimeException('Template đã bị gỡ duyệt.');
                $row=$data['row'];
                if (in_array($p['publish_mode'],['published','scheduled'],true) && (!current_user_can('publish_posts') || !$row['seo_title'] || !$row['seo_description'] || !trim(wp_strip_all_tags($row['content_html'])))) throw new \RuntimeException('Publish gate: thiếu SEO/nội dung hoặc không đủ quyền.');
                // Transaction covers post + identity + checkpoint. Timeout after commit is reconciled by this key.
                $wpdb->query('START TRANSACTION');
                if (!$wpdb->query($wpdb->prepare('UPDATE '.op_table('campaign')." SET heartbeat=heartbeat+1 WHERE campaign_id=%s AND state='running'",$id))) { $wpdb->query('ROLLBACK'); break; }
                $post_id=(int)$wpdb->get_var($wpdb->prepare('SELECT post_id FROM '.op_table('identity').' WHERE legacy_key=%s',hash('sha256',$row['id'])));
                if (!$post_id) {
                    $seen=[]; $validated=validate_import_row($row,['mode'=>'create','preserve_status'=>false,'preserve_dates'=>false],$seen);
                    if (campaign_get($id)['state']!=='running') { $wpdb->query('ROLLBACK'); break; }
                    $result=write_import_row($validated,['mode'=>'create','preserve_status'=>false,'preserve_dates'=>false]); $post_id=$result['wp_id'];
                    update_post_meta($post_id,'_cohamy_campaign_id',$id); update_post_meta($post_id,'_cohamy_template_base',$template['payload']['base_id']); update_post_meta($post_id,'_cohamy_location_id',$data['location_id']); update_post_meta($post_id,'_cohamy_template_version',(string)$data['template_version']);
                    foreach(['focus_keyword','facebook_title','facebook_description','facebook_image','twitter_title','twitter_description','twitter_image'] as $field)if(isset($row[$field]))update_post_meta($post_id,'rank_math_'.$field,sanitize_text_field($row[$field]));
                    foreach(['country','topic','subject'] as $kind)if(!empty($row[$kind.'_id'])){ $ref=entity_get($row[$kind.'_id']);if(!$ref || $ref['state']!=='approved' || $ref['payload']['type']!==$kind || (!empty($ref['payload']['expires_at']) && strtotime($ref['payload']['expires_at'])<time()))throw new \RuntimeException('Reference '.$kind.' thiếu/chưa duyệt/hết hạn.');update_post_meta($post_id,'_cohamy_'.$kind.'_id',$row[$kind.'_id']); }
                    if (campaign_get($id)['state']==='running' && $p['publish_mode']!=='draft') {
                        $status=['pending'=>'pending','published'=>'publish','scheduled'=>'future'][$p['publish_mode']]; $changes=['ID'=>$post_id,'post_status'=>$status];
                        if ($status==='future') { $changes['post_date_gmt']=gmdate('Y-m-d H:i:s',strtotime($p['scheduled_at'])); $changes['post_date']=get_date_from_gmt($changes['post_date_gmt']); }
                        $result=wp_update_post($changes,true); if (is_wp_error($result)) throw new \RuntimeException($result->get_error_message());
                    }
                }
                if($wpdb->update(op_table('campaign_item'),['post_id'=>$post_id,'state'=>'completed','lease_until'=>0,'duration_ms'=>(int)((microtime(true)-$start)*1000),'error'=>''],['item_key'=>$key])===false)throw new \RuntimeException('Checkpoint item lỗi.');
                $p['completed_today']++; if($wpdb->update(op_table('campaign'),['payload'=>wp_json_encode($p),'heartbeat'=>time()],['campaign_id'=>$id])===false)throw new \RuntimeException('Checkpoint quota lỗi.');
                if($wpdb->query('COMMIT')===false)throw new \RuntimeException('Commit campaign lỗi.'); op_audit('campaign.item',$id,null,['key'=>$key,'post_id'=>$post_id]);
            } catch (\Throwable $e) {
                $wpdb->query('ROLLBACK'); [$dirty_posts,$reservations,$preserve_dates]=$before;wp_cache_flush();
                $wpdb->update(op_table('campaign_item'),['state'=>$attempt<3 ? 'queued' : 'failed','lease_until'=>0,'error'=>$e->getMessage()],['item_key'=>$key]);
            }
            update_option($lock,wp_json_encode(['owner'=>$owner,'until'=>time()+120]),false);
            update_option('cohamy_generation_global',wp_json_encode(['owner'=>$global_owner,'until'=>time()+120]),false);
        }
        $remaining=(int)$wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM '.op_table('campaign_item')." WHERE campaign_id=%s AND state IN ('queued','processing')",$id));
        if ($remaining) campaign_enqueue($id,time()+5); elseif (campaign_get($id)['state']==='running') $wpdb->update(op_table('campaign'),['state'=>'completed','heartbeat'=>time()],['campaign_id'=>$id]);
    } finally { if ((json_decode((string)get_option($lock),true)['owner'] ?? '')===$owner) delete_option($lock);op_release('cohamy_generation_global',$global_owner); wp_set_current_user($previous); }
}
function worker_health(): bool {
    $timestamp=(string)time();$r=wp_remote_get(preview_base().'/api/wordpress/worker-health',['timeout'=>3,'redirection'=>0,'headers'=>['X-Cohamy-Timestamp'=>$timestamp,'X-Cohamy-Signature'=>hash_hmac('sha256',$timestamp.'.',secret())]]);
    $data=is_wp_error($r)?[]:json_decode(wp_remote_retrieve_body($r),true);$healthy=!is_wp_error($r)&&wp_remote_retrieve_response_code($r)===200&&!empty($data['ready']);update_option('cohamy_last_worker_health',['ready'=>$healthy,'checked_at'=>gmdate('c'),'reason'=>is_wp_error($r)?$r->get_error_code():($data['reason'] ?? 'HTTP '.wp_remote_retrieve_response_code($r))],false);return $healthy;
}
add_action('cohamy_campaign_tick',__NAMESPACE__.'\\campaign_tick',10,1);
add_filter('action_scheduler_allow_async_request_runner','__return_false');
add_action('rest_api_init',function () {
    op_route('campaigns/preview','POST','cohamy_campaigns',function ($r) { $plan=campaign_plan($r->get_json_params()); return response(['valid'=>!$plan['errors'],'total'=>$plan['total_combinations'],'new'=>count($plan['items']),'duplicates'=>$plan['duplicates'],'errors'=>$plan['errors'],'preview'=>array_slice($plan['items'],0,10)]); });
    op_route('campaigns','POST','cohamy_campaigns',function ($r) { return campaign_start($r->get_json_params()); });
    op_route('campaigns','GET','cohamy_campaigns',function ($r) { global $wpdb; $ids=$wpdb->get_col('SELECT campaign_id FROM '.op_table('campaign').' ORDER BY created DESC LIMIT 25 OFFSET '.(max(0,(int)$r['page']-1)*25)); return response(array_map(__NAMESPACE__.'\\campaign_get',$ids)); });
    op_route('campaigns/(?P<id>[a-f0-9-]{36})','GET','cohamy_campaigns',function ($r) { return ($c=campaign_get($r['id'],max(1,(int)$r['page']))) ? response($c) : op_error('Không có campaign.',404); });
    op_route('campaigns/(?P<id>[a-f0-9-]{36})/control','POST','cohamy_campaigns',function ($r) {
        global $wpdb; $c=campaign_get($r['id']); if (!$c) return op_error('Không có campaign.',404); $action=$r['action'];
        $states=['pause'=>'paused','resume'=>'running','stop'=>'stopped','retry'=>'running']; if (!isset($states[$action])) return op_error('Chọn pause/resume/stop/retry.');
        $wpdb->update(op_table('campaign'),['state'=>$states[$action]],['campaign_id'=>$c['campaign_id']]);
        if ($action==='retry') $wpdb->query($wpdb->prepare('UPDATE '.op_table('campaign_item')." SET state='queued',attempts=0 WHERE campaign_id=%s AND state='failed'",$c['campaign_id']));
        if ($states[$action]==='running') campaign_enqueue($c['campaign_id']); op_audit('campaign.'.$action,$c['campaign_id'],$c['state'],$states[$action]); return response(campaign_get($c['campaign_id']));
    });
    op_route('campaigns/(?P<id>[a-f0-9-]{36})/rollback','POST','cohamy_campaigns',function ($r) {
        global $wpdb; $c=campaign_get($r['id']); if (!$c || $c['state']==='running') return op_error('Dừng campaign trước khi rollback.');
        $ids=array_map('intval',$wpdb->get_col($wpdb->prepare('SELECT post_id FROM '.op_table('campaign_item')." WHERE campaign_id=%s AND post_id>0",$c['campaign_id'])));
        $eligible=array_values(array_filter($ids,function ($id) use ($c) { return meta($id,'campaign_id')===$c['campaign_id'] && current_user_can('delete_post',$id); }));
        if (!$r['confirmed']) return response(['preview'=>$eligible,'count'=>count($eligible)]);
        if (!in_array($r['mode'],['draft','trash'],true)) return op_error('Rollback mode draft/trash.');
        if(count($eligible)>100){
            $job=wp_generate_uuid4();$wpdb->query('START TRANSACTION');try{
                if(!$wpdb->insert(op_table('data_job'),['job_id'=>$job,'actor'=>get_current_user_id(),'state'=>'queued','kind'=>'rollback','total'=>count($eligible),'created'=>time()]))throw new \RuntimeException('Không lưu được rollback job.');
                $fields=["'post_id',p.ID","'campaign_id',".$wpdb->prepare('%s',$c['campaign_id']),"'mode',".$wpdb->prepare('%s',$r['mode']),"'before_status',p.post_status","'before_content',p.post_content","'before_title',p.post_title","'before_excerpt',p.post_excerpt"];
                foreach(['_cohamy_updated_at','_cohamy_public_slug','_cohamy_group_id','_cohamy_locale','_thumbnail_id','rank_math_title','rank_math_description','rank_math_focus_keyword','rank_math_robots','rank_math_pillar_content','rank_math_facebook_title','rank_math_facebook_description','rank_math_twitter_title','rank_math_twitter_description'] as $meta_key)$fields[]=$wpdb->prepare('%s',$meta_key).",COALESCE((SELECT meta_value FROM {$wpdb->postmeta} m WHERE m.post_id=p.ID AND m.meta_key=".$wpdb->prepare('%s',$meta_key)." ORDER BY meta_id LIMIT 1),'')";
                $sql=$wpdb->prepare('INSERT INTO '.op_table('data_row')." (job_id,ordinal,state,payload,error) SELECT %s,ROW_NUMBER() OVER (ORDER BY p.ID),'queued',JSON_OBJECT(".implode(',',$fields)."),'' FROM {$wpdb->posts} p WHERE p.ID IN (".implode(',',array_map('intval',$eligible)).')',$job);if($wpdb->query($sql)!==count($eligible))throw new \RuntimeException('Không chụp đủ checkpoint rollback.');
                if($wpdb->query('COMMIT')===false)throw new \RuntimeException('Không commit được rollback job.');
            }catch(\Throwable $e){$wpdb->query('ROLLBACK');throw $e;}
            as_enqueue_async_action('cohamy_transfer_tick',[$job],'cohamy',false,25);op_audit('campaign.rollback-start',$c['campaign_id'],null,['job_id'=>$job,'total'=>count($eligible)]);return response(['job_id'=>$job,'state'=>'queued','total'=>count($eligible),'status_location'=>'imports/'.$job],202);
        }
        $results=[]; foreach ($eligible as $id) { $result=$r['mode']==='trash' ? wp_trash_post($id) : wp_update_post(['ID'=>$id,'post_status'=>'draft'],true); $results[]=['post_id'=>$id,'ok'=>$result && !is_wp_error($result)]; }
        op_audit('campaign.rollback',$c['campaign_id'],null,$results); return response($results);
    });
});
