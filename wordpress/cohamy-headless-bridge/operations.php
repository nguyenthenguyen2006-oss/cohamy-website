<?php
namespace Cohamy;
defined('ABSPATH') || exit;

const OPERATIONS_VERSION = '2.0.9';
function operations_install(): void {
    global $wpdb;
    require_once ABSPATH.'wp-admin/includes/upgrade.php';
    $charset=$wpdb->get_charset_collate();
    foreach ([
      'entity'=>"entity_id varchar(64) NOT NULL, kind varchar(24) NOT NULL, name varchar(240) NOT NULL, state varchar(24) NOT NULL, version int NOT NULL, payload longtext NOT NULL, updated bigint NOT NULL, PRIMARY KEY  (entity_id), KEY kind_state (kind,state)",
      'campaign'=>"campaign_id char(36) NOT NULL, actor bigint NOT NULL, state varchar(24) NOT NULL, payload longtext NOT NULL, heartbeat bigint NOT NULL DEFAULT 0, created bigint NOT NULL, PRIMARY KEY  (campaign_id), KEY state (state)",
      'campaign_item'=>"item_key char(64) NOT NULL, campaign_id char(36) NOT NULL, payload longtext NOT NULL, state varchar(24) NOT NULL, post_id bigint NOT NULL DEFAULT 0, attempts int NOT NULL DEFAULT 0, lease_until bigint NOT NULL DEFAULT 0, duration_ms bigint NOT NULL DEFAULT 0, error text NOT NULL, PRIMARY KEY  (item_key), KEY campaign_state (campaign_id,state)",
      'audit'=>"audit_id char(36) NOT NULL, actor bigint NOT NULL, action varchar(80) NOT NULL, object_id varchar(64) NOT NULL, before_json longtext NOT NULL, after_json longtext NOT NULL, created bigint NOT NULL, PRIMARY KEY  (audit_id), KEY created (created)",
      'inventory'=>"post_id bigint NOT NULL, url varchar(2000) NOT NULL, locale varchar(5) NOT NULL, content_type varchar(24) NOT NULL, indexable int NOT NULL, status varchar(24) NOT NULL, modified varchar(32) NOT NULL, shard bigint NOT NULL, PRIMARY KEY  (post_id), KEY shard_indexable (shard,indexable)",
      'shard'=>"shard_id bigint NOT NULL, revision char(36) NOT NULL, modified varchar(32) NOT NULL, PRIMARY KEY  (shard_id)",
      'redirect_rule'=>"path_key char(64) NOT NULL, source varchar(2000) NOT NULL, target varchar(2000) NOT NULL, code int NOT NULL, enabled int NOT NULL, hits bigint NOT NULL DEFAULT 0, PRIMARY KEY  (path_key)",
      'not_found'=>"path_key char(64) NOT NULL, path varchar(2000) NOT NULL, hits bigint NOT NULL, first_seen bigint NOT NULL, last_seen bigint NOT NULL, PRIMARY KEY  (path_key), KEY last_seen (last_seen)",
      'export_job'=>"job_id char(36) NOT NULL, actor bigint NOT NULL, state varchar(24) NOT NULL, format varchar(8) NOT NULL, total bigint NOT NULL, last_ordinal bigint NOT NULL DEFAULT 0, created bigint NOT NULL, manifest longtext NOT NULL, PRIMARY KEY  (job_id)",
      'export_item'=>"job_id char(36) NOT NULL, ordinal bigint NOT NULL, url varchar(2000) NOT NULL, locale varchar(5) NULL, content_type varchar(24) NULL, status varchar(24) NULL, modified varchar(32) NULL, PRIMARY KEY  (job_id,ordinal)",
      'index_event'=>"event_key char(64) NOT NULL, generation varchar(36) NOT NULL DEFAULT '', kind varchar(16) NOT NULL DEFAULT 'updated', url varchar(2000) NOT NULL, state varchar(24) NOT NULL, attempts int NOT NULL DEFAULT 0, next_attempt bigint NOT NULL, http_code int NOT NULL DEFAULT 0, error text NOT NULL, created bigint NOT NULL, PRIMARY KEY  (event_key), KEY state_due (state,next_attempt)",
      'inspection'=>"url_key char(64) NOT NULL, url varchar(2000) NOT NULL, state varchar(32) NOT NULL, payload longtext NOT NULL, inspected bigint NOT NULL, PRIMARY KEY  (url_key)",
      'data_job'=>"job_id char(36) NOT NULL, actor bigint NOT NULL, state varchar(24) NOT NULL, kind varchar(24) NOT NULL, total int NOT NULL, created bigint NOT NULL, PRIMARY KEY  (job_id)",
      'data_row'=>"job_id char(36) NOT NULL, ordinal int NOT NULL, state varchar(24) NOT NULL, payload longtext NOT NULL, error text NOT NULL, PRIMARY KEY  (job_id,ordinal), KEY job_state (job_id,state)",
      'validation_key'=>"job_id char(36) NOT NULL, key_hash char(64) NOT NULL, ordinal int NOT NULL, PRIMARY KEY  (job_id,key_hash)",
    ] as $name=>$columns) {
        $columns=preg_replace('/, (?=[a-z_]|PRIMARY|UNIQUE|KEY)/',",\n  ",$columns);
        dbDelta("CREATE TABLE {$wpdb->prefix}cohamy_$name (\n  $columns\n) $charset;");
        if ($wpdb->query("SELECT COUNT(*) FROM {$wpdb->prefix}cohamy_$name")===false) throw new \RuntimeException('Không tạo được bảng '.$name.'; chưa hoàn tất nâng cấp.');
    }
    if (!get_option('cohamy_site_id')) update_option('cohamy_site_id',wp_generate_uuid4(),false);
    foreach (['administrator','cohamy_reviewer'] as $name) if ($role=get_role($name)) foreach (['cohamy_operate','cohamy_templates','cohamy_campaigns','cohamy_export','cohamy_seo'] as $cap) $role->add_cap($cap);
    add_role('cohamy_seo_manager','Cohamy — Quản lý SEO',array_merge(get_role('editor')->capabilities,['cohamy_operate'=>true,'cohamy_templates'=>true,'cohamy_campaigns'=>true,'cohamy_export'=>true,'cohamy_seo'=>true]));
    // One index notification authority: native Rank Math would submit CMS URLs.
    $modules=(array)get_option('rank_math_modules',[]);
    update_option('rank_math_modules',array_values(array_diff($modules,['instant-indexing','sitemap'])),false);
    if (!(int)$wpdb->get_var('SELECT COUNT(*) FROM '.op_table('inventory'))) operations_rebuild_inventory();
    update_option('cohamy_operations_version',OPERATIONS_VERSION,false);
}
add_action('init',function () { if (get_option('cohamy_operations_version')!==OPERATIONS_VERSION) { $owner=op_lease('cohamy_install_lock',300);if(!$owner){if(PHP_SAPI==='cli')throw new \RuntimeException('Nâng cấp database đang chạy; thử lại.');wp_die('CMS đang nâng cấp cấu trúc dữ liệu. Thử lại sau.','CMS unavailable',['response'=>503]);}try{operations_install();}finally{op_release('cohamy_install_lock',$owner);} } },30);
function op_table(string $name): string { global $wpdb; return $wpdb->prefix.'cohamy_'.$name; }
function reference_options(string $type,string $q='',int $limit=200): array {global $wpdb;if(!in_array($type,['country','topic','subject','location'],true))return [];$rows=$wpdb->get_results($wpdb->prepare('SELECT entity_id,name,payload FROM '.op_table('entity')." WHERE kind='record' AND state='approved' AND payload LIKE %s AND (name LIKE %s OR entity_id LIKE %s) ORDER BY name LIMIT %d",'%"type":"'.$type.'"%','%'.$wpdb->esc_like($q).'%','%'.$wpdb->esc_like($q).'%',min(500,max(1,$limit))),ARRAY_A);if($wpdb->last_error)throw new \RuntimeException('Không đọc được dữ liệu tham chiếu.');$items=[];foreach($rows as $row){$p=json_decode($row['payload'],true);if(($p['type'] ?? '')===$type)$items[]=['entity_id'=>$row['entity_id'],'name'=>$row['name'],'type'=>$type];}return $items;}
function op_lease(string $key,int $ttl=120): ?string {
    global $wpdb;$owner=wp_generate_uuid4();$value=wp_json_encode(['owner'=>$owner,'until'=>time()+$ttl]);if(add_option($key,$value,'','no'))return $owner;
    $old=(string)get_option($key);$lease=json_decode($old,true);if(($lease['until'] ?? 0)>time())return null;
    if(!$wpdb->query($wpdb->prepare("UPDATE {$wpdb->options} SET option_value=%s WHERE option_name=%s AND option_value=%s",$value,$key,$old)))return null;wp_cache_delete($key,'options');return $owner;
}
function op_release(string $key,string $owner): void {global $wpdb;$old=(string)get_option($key);if((json_decode($old,true)['owner'] ?? '')===$owner){$wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name=%s AND option_value=%s",$key,$old));wp_cache_delete($key,'options');}}
function op_error(string $message,int $status=400): \WP_Error { return new \WP_Error('cohamy_operation_error',$message,['status'=>$status]); }
function op_audit(string $action,string $id,$before,$after): void {
    global $wpdb;
    $redact=function ($value) use (&$redact) { if(is_string($value) && preg_match('/^\s*[\[{]/',$value)){ $decoded=json_decode($value,true);if(is_array($decoded))return wp_json_encode($redact($decoded)); } if (!is_array($value)) return $value; foreach ($value as $key=>&$entry) $entry=preg_match('/secret|password|private_key|token|api_key/i',(string)$key) ? '[REDACTED]' : $redact($entry); return $value; };
    $wpdb->insert(op_table('audit'),['audit_id'=>wp_generate_uuid4(),'actor'=>get_current_user_id(),'action'=>$action,'object_id'=>$id,'before_json'=>wp_json_encode($redact($before)),'after_json'=>wp_json_encode($redact($after)),'created'=>time()]);
}
function entity_get(string $id): ?array {
    global $wpdb; $row=$wpdb->get_row($wpdb->prepare('SELECT * FROM '.op_table('entity').' WHERE entity_id=%s',$id),ARRAY_A);
    if (!$row) return null; $row['payload']=json_decode($row['payload'],true); $row['version']=(int)$row['version']; return $row;
}
function entity_save(array $input,bool $dry_run=false) {
    global $wpdb;
    $kind=(string)($input['kind'] ?? 'record');
    if (!in_array($kind,['record','template'],true)) return op_error('Loại bản ghi không hợp lệ.');
    $id=(string)($input['entity_id'] ?? wp_generate_uuid4());
    if (!preg_match('/^[a-zA-Z0-9_-]{1,64}$/D',$id)) return op_error('Stable ID chỉ chứa chữ, số, _ và -.');
    $old=entity_get($id); $version=(int)($input['version'] ?? 0);
    if ($old && ($old['kind']!==$kind || $old['version']!==$version)) return op_error('Bản ghi đã được sửa. Tải lại trước khi lưu.',409);
    $name=sanitize_text_field($input['name'] ?? ''); $state=(string)($input['state'] ?? 'draft'); $payload=(array)($input['payload'] ?? []);
    if (!$name || mb_strlen($name)>240 || !in_array($state,['draft','approved','archived'],true)) return op_error('Tên bắt buộc, trạng thái draft/approved/archived.');
    if ($state==='approved' && !current_user_can('publish_posts')) return op_error('Không có quyền duyệt template/dữ liệu.',403);
    if ($kind==='record') {
        if (!in_array($payload['type'] ?? '',['country','location','topic','subject','school','program'],true)) return op_error('Chọn loại dữ liệu.');
        if (!is_array($payload['fields'] ?? null)) return op_error('fields cần là object dữ liệu.');
        foreach ($payload['fields'] as $key=>$value) if (!preg_match('/^[a-z][a-z0-9_]{0,60}$/D',$key) || !is_scalar($value)) return op_error('Field cần tên hợp lệ và giá trị đơn.');
        foreach (['reference_date','expires_at'] as $key) if (!empty($payload[$key]) && strtotime($payload[$key])===false) return op_error('Ngày tham chiếu/hết hạn không hợp lệ.');
        if (!empty($payload['reference_source']) && !preg_match('~^https://~i',$payload['reference_source'])) return op_error('Nguồn tham chiếu phải là HTTPS. Không tải nguồn tự động.');
    } else {
        if (empty($payload['title']) || empty($payload['content_html'])) return op_error('Template cần title và content_html.');
        if ($blocks=unsupported_blocks($payload['content_html'])) return op_error('Block chưa hỗ trợ: '.implode(', ',$blocks));
        $payload['content_html']=safe_content_html($payload['content_html']);
        $payload['base_id']=$old['payload']['base_id'] ?? ($payload['base_id'] ?? $id);
        $payload['required_variables']=array_values(array_unique((array)($payload['required_variables'] ?? [])));
        foreach ($payload['required_variables'] as $variable) if (!preg_match('/^[a-zA-Z0-9_.]+$/D',$variable)) return op_error('Tên biến không hợp lệ.');
        $payload['history']=$old ? array_slice(array_merge((array)($old['payload']['history'] ?? []),[['version'=>$old['version'],'title'=>$old['payload']['title'],'content_html'=>$old['payload']['content_html'],'seo_title'=>$old['payload']['seo_title'] ?? '','seo_description'=>$old['payload']['seo_description'] ?? '']]),-20) : [];
    }
    $data=['entity_id'=>$id,'kind'=>$kind,'name'=>$name,'state'=>$state,'version'=>$version+1,'payload'=>wp_json_encode($payload),'updated'=>time()];
    if ($dry_run) return response(['valid'=>true,'input'=>array_merge($input,['entity_id'=>$id,'payload'=>$payload])]);
    if ($old) $ok=$wpdb->update(op_table('entity'),$data,['entity_id'=>$id,'version'=>$version]); else $ok=$wpdb->insert(op_table('entity'),$data);
    if (!$ok) return op_error('Không lưu được hoặc xung đột cập nhật.',409);
    op_audit('entity.save',$id,$old,$data); return response(entity_get($id));
}
function op_auth_signature(\WP_REST_Request $request): bool {
    $timestamp=(string)$request->get_header('X-Cohamy-Timestamp'); $signature=(string)$request->get_header('X-Cohamy-Signature');
    if (!ctype_digit($timestamp) || abs(time()-(int)$timestamp)>300 || strlen(secret())<32) return false;
    return hash_equals(hash_hmac('sha256',$timestamp.'.'.$request->get_body(),secret()),$signature);
}
function shard_size(): int { return max(1,min(5000,(int)get_option('cohamy_sitemap_shard_size',5000))); }
function inventory_update(int $id): void {
    global $wpdb; $table=op_table('inventory'); $old=$wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE post_id=%d",$id),ARRAY_A);
    if($wpdb->last_error)throw new \RuntimeException('Không đọc được inventory hiện tại.');
    $post=get_post($id); $shard=intdiv($id,shard_size());
    if ($post && in_array($post->post_type,['post','page'],true) && meta($id,'public_slug')) {
        $url=public_url($id); $redirected=$wpdb->get_var($wpdb->prepare('SELECT enabled FROM '.op_table('redirect_rule').' WHERE path_key=%s',hash('sha256',wp_parse_url($url,PHP_URL_PATH))));
        $data=['post_id'=>$id,'url'=>$url,'locale'=>meta($id,'locale','en'),'content_type'=>$post->post_type,'indexable'=>is_public($id) && indexable($id) && !$redirected ? 1 : 0,'status'=>$post->post_status,'modified'=>utc(meta($id,'updated_at',utc($post->post_modified_gmt))),'shard'=>$shard];
        if($wpdb->replace($table,$data)===false)throw new \RuntimeException('Không cập nhật được inventory nội dung.');
    } else { if($wpdb->delete($table,['post_id'=>$id])===false)throw new \RuntimeException('Không gỡ được inventory nội dung.'); $data=null; }
    if ($data!==$old) foreach (array_unique([$shard,(int)($old['shard'] ?? $shard)]) as $affected) if($wpdb->replace(op_table('shard'),['shard_id'=>$affected,'revision'=>wp_generate_uuid4(),'modified'=>gmdate('Y-m-d\TH:i:s.000\Z')])===false)throw new \RuntimeException('Không cập nhật được revision sitemap.');
    if (function_exists(__NAMESPACE__.'\\index_event')) {
        if ($old && $old['url']!==($data['url'] ?? '') && (int)$old['indexable']) index_event($old['url'],'deleted');
        if ($data && ((int)$data['indexable'] || ($old && (int)$old['indexable']))) index_event($data['url'],(int)$data['indexable']?'updated':'deleted');
    }
}
function operations_rebuild_inventory(): void {
    global $wpdb;
    foreach ($wpdb->get_col("SELECT p.ID FROM {$wpdb->posts} p JOIN ".op_table('identity')." i ON i.post_id=p.ID WHERE p.post_type IN ('post','page') ORDER BY p.ID") as $id) inventory_update((int)$id);
}
function op_route(string $path,string $method,string $cap,callable $callback): void {
    register_rest_route('cohamy/v1','/ops/'.$path,['methods'=>$method,'permission_callback'=>function () use ($cap) { return current_user_can($cap); },'callback'=>function ($request) use ($callback) { try { return $callback($request); } catch (\Throwable $error) { error_log('Cohamy operation: '.$error->getMessage()); return op_error($error->getMessage(),500); } }]);
}
add_action('rest_api_init',function () {
    register_rest_route('cohamy/v1','/reference-options',['methods'=>'GET','permission_callback'=>'__return_true','callback'=>function($r){try{return response(['items'=>reference_options((string)$r['type'],sanitize_text_field($r['q'] ?? ''))]);}catch(\Throwable $e){return op_error('Không đọc được bộ lọc dữ liệu; thử lại.',503);}}]);
    register_rest_route('cohamy/v1','/editor-records',['methods'=>'GET','permission_callback'=>function(){return current_user_can('edit_posts');},'callback'=>function(){return response(['items'=>array_merge(...array_map(function($kind){return reference_options($kind,'',500);},['country','topic','subject','location']))]);}]);
    op_route('entities','GET','cohamy_operate',function ($r) {
        global $wpdb; $page=max(1,(int)$r['page']); $kind=$r['kind']==='template' ? 'template' : 'record';
        $pattern='%'.$wpdb->esc_like((string)$r['q']).'%'; $where=$wpdb->prepare('kind=%s AND (name LIKE %s OR entity_id LIKE %s)',$kind,$pattern,$pattern);
        $rows=$wpdb->get_results('SELECT * FROM '.op_table('entity')." WHERE $where ORDER BY updated DESC LIMIT 25 OFFSET ".(($page-1)*25),ARRAY_A);
        foreach ($rows as &$row) $row['payload']=json_decode($row['payload'],true);
        return response(['items'=>$rows,'total'=>(int)$wpdb->get_var('SELECT COUNT(*) FROM '.op_table('entity')." WHERE $where"),'page'=>$page]);
    });
    op_route('entities','POST','cohamy_templates',function ($r) { return entity_save((array)$r->get_json_params()); });
    op_route('entities/(?P<id>[a-zA-Z0-9_-]+)','DELETE','cohamy_templates',function ($r) {
        $old=entity_get($r['id']); if (!$old) return op_error('Không tìm thấy bản ghi.',404);
        return entity_save(array_merge($old,['state'=>'archived']));
    });
    op_route('status','GET','cohamy_operate',function () {
        global $wpdb; return response(['wordpress'=>get_bloginfo('version'),'rank_math'=>defined('RANK_MATH_VERSION') ? RANK_MATH_VERSION : null,'action_scheduler'=>function_exists('as_schedule_single_action'),'timezone'=>wp_timezone_string(),'database'=>$wpdb->get_var('SELECT 1')==='1' || (int)$wpdb->get_var('SELECT 1')===1,'storage_writable'=>is_writable(wp_upload_dir()['basedir']),'pending_webhooks'=>(int)$wpdb->get_var('SELECT COUNT(*) FROM '.op_table('outbox').' WHERE delivered=0'),'active_campaigns'=>(int)$wpdb->get_var('SELECT COUNT(*) FROM '.op_table('campaign')." WHERE state IN ('running','scheduled')"),'gsc'=>get_option('cohamy_gsc_credentials') ? 'configured' : 'not_connected','ai'=>get_option('cohamy_ai_config') ? 'configured' : 'not_connected','indexnow'=>get_option('cohamy_indexnow_enabled') ? 'enabled' : 'not_connected','smtp'=>has_action('phpmailer_init') ? 'configured_hook_not_verified' : 'not_verified']);
    });
    op_route('audit','GET','cohamy_seo',function ($r) { global $wpdb; return response($wpdb->get_results('SELECT * FROM '.op_table('audit').' ORDER BY created DESC LIMIT 50 OFFSET '.(max(0,(int)$r['page']-1)*50),ARRAY_A)); });
});

