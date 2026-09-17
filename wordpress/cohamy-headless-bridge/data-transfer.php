<?php
namespace Cohamy;
defined('ABSPATH') || exit;

function transfer_cap(string $kind): string { return $kind==='rollback'?'cohamy_campaigns':($kind==='redirect' ? 'cohamy_seo' : ($kind==='post' ? 'edit_posts' : 'cohamy_templates')); }
function transfer_preview(\WP_REST_Request $r) {
    $kind=(string)$r['kind']; if (!in_array($kind,['record','template','post','redirect'],true) || !current_user_can(transfer_cap($kind))) return op_error('Không đủ quyền import loại dữ liệu này.',403);
    $input=$r->get_json_params() ?: $r->get_params(); $mapping=(array)($input['mapping'] ?? []); if (is_string($input['mapping'] ?? null)) $mapping=json_decode($input['mapping'],true,512,JSON_THROW_ON_ERROR);
    $rows=(array)($input['rows'] ?? []); $upload=$r->get_file_params()['file'] ?? null;
    if ($upload) {
        if ($upload['error']!==UPLOAD_ERR_OK || $upload['size']>16*1024*1024) return op_error('File UTF-8 tối đa 16 MB.');
        $data=file_get_contents($upload['tmp_name']); if (!mb_check_encoding($data,'UTF-8')) return op_error('Lưu file UTF-8.');
        if (strtolower(pathinfo($upload['name'],PATHINFO_EXTENSION))==='json') $rows=json_decode(preg_replace('/^\xEF\xBB\xBF/','',$data),true,512,JSON_THROW_ON_ERROR);
        else {
            $file=fopen($upload['tmp_name'],'rb'); $first=preg_replace('/^\xEF\xBB\xBF/','',(string)fgets($file)); $offset=str_starts_with(strtolower(trim($first)),'sep=') ? ftell($file) : 0; if ($offset) $first=(string)fgets($file);
            $delimiter=count(str_getcsv($first,';','"',''))>count(str_getcsv($first,',','"','')) ? ';' : ','; fseek($file,$offset); $header=fgetcsv($file,0,$delimiter,'"',''); $header[0]=preg_replace('/^\xEF\xBB\xBF/','',$header[0]);
            if (count(array_unique($header))!==count($header)) return op_error('Header trùng.');
            $rows=[]; while (($cells=fgetcsv($file,0,$delimiter,'"',''))!==false) { if ($cells===[null]) continue; if (count($cells)!==count($header)) $rows[]=['_parse_error'=>'Sai số cột.']; else $rows[]=array_combine($header,$cells); if(count($rows)>20000)break; } fclose($file);
        }
    }
    if (!$rows || count($rows)>20000) return op_error('Chọn 1–20.000 dòng CSV/JSON.');
    $options=['mode'=>($input['mode'] ?? '')==='upsert' ? 'upsert' : 'create','preserve_status'=>filter_var($input['preserve_state'] ?? false,FILTER_VALIDATE_BOOLEAN),'preserve_dates'=>false];
    if(count($rows)>250)return transfer_preview_enqueue($kind,$rows,$options,$mapping);
    $valid=[]; $errors=[]; $seen=[]; $entities=[];
    foreach ($rows as $i=>$raw) try {
        if (!is_array($raw) || isset($raw['_parse_error'])) throw new \InvalidArgumentException($raw['_parse_error'] ?? 'Dòng cần object.');
        if ($mapping) { $mapped=[]; foreach ($mapping as $source=>$destination) { if (!array_key_exists($source,$raw)) throw new \InvalidArgumentException('Thiếu cột map '.$source); $mapped[$destination]=$raw[$source]; } $raw=$mapped; }
        if ($kind==='post') { foreach(['featured','robots_index'] as $field)if(is_bool($raw[$field] ?? null))$raw[$field]=$raw[$field]?'TRUE':'FALSE';$row=validate_import_row($raw,$options,$seen); foreach(['featured','robots_index'] as $field)$row[$field]=$row[$field]?'TRUE':'FALSE';$normalized=['row'=>$row,'options'=>$options,'hash'=>$row['_existing'] ? editorial_hash($row['_existing']) : '']; }
        elseif ($kind==='redirect') { $normalized=['source'=>safe_path((string)($raw['source'] ?? '')),'target'=>(string)($raw['target'] ?? ''),'code'=>(int)($raw['code'] ?? 301),'enabled'=>filter_var($raw['enabled'] ?? true,FILTER_VALIDATE_BOOLEAN)]; if(!in_array($normalized['code'],[301,302,307,308,410],true))throw new \InvalidArgumentException('HTTP code không hợp lệ.'); if($normalized['code']!==410) $normalized['target']=safe_path($normalized['target']); if($normalized['source']===$normalized['target'])throw new \InvalidArgumentException('Redirect tự trỏ.'); }
        else {
            $id=(string)($raw['entity_id'] ?? ''); if(!$id)throw new \InvalidArgumentException('Stable entity_id bắt buộc.'); if(isset($entities[$id]))throw new \InvalidArgumentException('Stable ID trùng trong file.');$entities[$id]=true;$old=entity_get($id);
            if($old && $options['mode']==='create')throw new \InvalidArgumentException('ID đã tồn tại. Chọn cập nhật.');
            $payload=$raw['payload'] ?? null; if (!$payload) $payload=isset($raw['payload_json']) && $raw['payload_json']!=='' ? json_decode($raw['payload_json'],true,512,JSON_THROW_ON_ERROR) : ['type'=>$raw['type'] ?? 'location','fields'=>json_decode($raw['fields_json'] ?? '{}',true,512,JSON_THROW_ON_ERROR),'reference_source'=>$raw['reference_source'] ?? '', 'reference_date'=>$raw['reference_date'] ?? '', 'expires_at'=>$raw['expires_at'] ?? ''];
            $normalized=['entity_id'=>$id,'name'=>$raw['name'] ?? '', 'kind'=>$kind,'state'=>$options['preserve_status'] ? ($raw['state'] ?? 'draft') : 'draft','version'=>$old['version'] ?? 0,'payload'=>$payload];
            $check=entity_save($normalized,true); if (is_wp_error($check))throw new \InvalidArgumentException($check->get_error_message());
        }
        $valid[]=['ordinal'=>$i+1,'payload'=>$normalized];
    }catch(\Throwable $e){$errors[]=['row'=>$i+1,'error'=>$e->getMessage()];}
    if($kind==='redirect'){$graph=redirect_batch_errors($valid);foreach($graph as $line=>$error)$errors[]=['row'=>$line,'error'=>$error];$valid=array_values(array_filter($valid,fn($item)=>!isset($graph[$item['ordinal']])));}
    $token=wp_generate_uuid4();set_transient('cohamy_transfer_preview_'.$token,['actor'=>get_current_user_id(),'kind'=>$kind,'valid'=>$valid,'errors'=>$errors],HOUR_IN_SECONDS);
    return response(['token'=>$token,'total'=>count($rows),'valid'=>count($valid),'failed'=>count($errors),'errors'=>$errors,'preview'=>array_slice($valid,0,10)]);
}
function transfer_tick(string $id): void {
    global $wpdb,$dirty_posts,$reservations,$preserve_dates;
    $job=$wpdb->get_row($wpdb->prepare('SELECT * FROM '.op_table('data_job').' WHERE job_id=%s',$id),ARRAY_A);if(!$job || !in_array($job['state'],['queued','processing'],true))return;
    $lock='cohamy_transfer_lock_'.$id;$owner=op_lease($lock);if(!$owner)return;
    $actor=get_current_user_id();wp_set_current_user((int)$job['actor']);
    try {
        if(!current_user_can(transfer_cap($job['kind']))) { $wpdb->update(op_table('data_job'),['state'=>'blocked'],['job_id'=>$id]);return; }
        $wpdb->update(op_table('data_job'),['state'=>'processing'],['job_id'=>$id]);
        $rows=$wpdb->get_results($wpdb->prepare('SELECT * FROM '.op_table('data_row')." WHERE job_id=%s AND state='queued' ORDER BY ordinal LIMIT 10",$id),ARRAY_A);
        foreach($rows as $row) {
            $p=json_decode($row['payload'],true);$before=[$dirty_posts,$reservations,$preserve_dates];$wpdb->query('START TRANSACTION');
            try {
                if($job['kind']==='post') { $old=(int)$p['row']['_existing']; if($old){$wpdb->query($wpdb->prepare("UPDATE {$wpdb->posts} SET post_content=post_content WHERE ID=%d",$old));$wpdb->query($wpdb->prepare("UPDATE {$wpdb->postmeta} SET meta_value=meta_value WHERE post_id=%d",$old));clean_post_cache($old);wp_cache_delete($old,'post_meta');if(!hash_equals($p['hash'],editorial_hash($old)))throw new \RuntimeException('Bài đã sửa sau preview.');} $seen=[];$validated=validate_import_row($p['row'],$p['options'],$seen);$result=write_import_row($validated,$p['options']); }
                elseif($job['kind']==='rollback'){
                    $post=(int)$p['post_id'];$wpdb->query($wpdb->prepare("UPDATE {$wpdb->posts} SET post_content=post_content WHERE ID=%d",$post));$wpdb->query($wpdb->prepare("UPDATE {$wpdb->postmeta} SET meta_value=meta_value WHERE post_id=%d",$post));clean_post_cache($post);wp_cache_delete($post,'post_meta');
                    $current=get_post($post);$changed=!$current || $current->post_content!==$p['before_content'] || $current->post_title!==$p['before_title'] || $current->post_excerpt!==$p['before_excerpt'] || $current->post_status!==$p['before_status'];foreach($p as $meta_key=>$old_value)if(str_starts_with($meta_key,'_') || str_starts_with($meta_key,'rank_math_')){global $wpdb;$value=(string)$wpdb->get_var($wpdb->prepare("SELECT meta_value FROM {$wpdb->postmeta} WHERE post_id=%d AND meta_key=%s ORDER BY meta_id LIMIT 1",$post,$meta_key));if($wpdb->last_error || $value!==$old_value)$changed=true;}
                    if(!current_user_can('delete_post',$post) || meta($post,'campaign_id')!==$p['campaign_id'] || $changed)throw new \RuntimeException('Bài đã sửa/đổi chủ sở hữu sau preview rollback; chưa gỡ bài.');
                    $result=$p['mode']==='trash'?wp_trash_post($post):wp_update_post(['ID'=>$post,'post_status'=>'draft'],true);if(!$result)throw new \RuntimeException('Không rollback được bài.');
                }elseif($job['kind']==='redirect') $result=redirect_save($p); else $result=entity_save($p);
                if(is_wp_error($result))throw new \RuntimeException($result->get_error_message());
                if($wpdb->update(op_table('data_row'),['state'=>'completed','error'=>''],['job_id'=>$id,'ordinal'=>$row['ordinal']])===false)throw new \RuntimeException('Checkpoint ghi lỗi.');
                editorial_commit();
            } catch(\Throwable $e) { editorial_rollback($before);$wpdb->update(op_table('data_row'),['state'=>'failed','error'=>$e->getMessage()],['job_id'=>$id,'ordinal'=>$row['ordinal']]); }
            update_option($lock,wp_json_encode(['owner'=>$owner,'until'=>time()+120]),false);
        }
        $left=(int)$wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM '.op_table('data_row')." WHERE job_id=%s AND state='queued'",$id));
        if($left)as_schedule_single_action(time()+2,'cohamy_transfer_tick',[$id],'cohamy',false,25);else {$wpdb->update(op_table('data_job'),['state'=>'completed'],['job_id'=>$id]);op_audit('import.complete',$id,null,transfer_status($id));}
    }finally{wp_set_current_user($actor);op_release($lock,$owner);}
}
function transfer_status(string $id): array {
    global $wpdb;$job=$wpdb->get_row($wpdb->prepare('SELECT * FROM '.op_table('data_job').' WHERE job_id=%s',$id),ARRAY_A);if(!$job)return [];
    $job['stats']=$wpdb->get_results($wpdb->prepare('SELECT state,COUNT(*) AS count FROM '.op_table('data_row').' WHERE job_id=%s GROUP BY state',$id),ARRAY_A);
    $job['errors']=$wpdb->get_results($wpdb->prepare('SELECT ordinal AS row,error FROM '.op_table('data_row')." WHERE job_id=%s AND state IN ('failed','invalid') ORDER BY ordinal LIMIT 200",$id),ARRAY_A);$job['valid']=(int)$wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM '.op_table('data_row')." WHERE job_id=%s AND state='valid'",$id));$job['failed']=(int)$wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM '.op_table('data_row')." WHERE job_id=%s AND state IN ('invalid','failed')",$id));if($job['state']==='previewed'){$job['token']=$id;$job['preview']=$wpdb->get_results($wpdb->prepare('SELECT ordinal,payload FROM '.op_table('data_row')." WHERE job_id=%s AND state='valid' ORDER BY ordinal LIMIT 10",$id),ARRAY_A);foreach($job['preview'] as &$item)$item['payload']=json_decode($item['payload'],true);}return $job;
}
add_action('cohamy_transfer_tick',__NAMESPACE__.'\\transfer_tick',10,1);
add_action('rest_api_init',function(){
    op_route('imports/preview','POST','cohamy_operate',__NAMESPACE__.'\\transfer_preview');
    op_route('imports/start','POST','cohamy_operate',function($r){global $wpdb;if(get_option('cohamy_transfer_options_'.(string)$r['token']))return transfer_preview_start((string)$r['token'],(bool)$r['confirmed'],(bool)$r['skip_invalid']);$p=get_transient('cohamy_transfer_preview_'.$r['token']);if(!$p || $p['actor']!==get_current_user_id() || !current_user_can(transfer_cap($p['kind'])))return op_error('Preview hết hạn/không đủ quyền.',403);if(!$r['confirmed'] || ($p['errors'] && !$r['skip_invalid']))return op_error('Xác nhận preview; chỉ bỏ dòng lỗi khi chọn rõ ràng.');$id=wp_generate_uuid4();$wpdb->query('START TRANSACTION');try{if(!$wpdb->insert(op_table('data_job'),['job_id'=>$id,'actor'=>get_current_user_id(),'state'=>'queued','kind'=>$p['kind'],'total'=>count($p['valid']),'created'=>time()]))throw new \RuntimeException('Không ghi job.');foreach($p['valid'] as $row)if(!$wpdb->insert(op_table('data_row'),['job_id'=>$id,'ordinal'=>$row['ordinal'],'state'=>'queued','payload'=>wp_json_encode($row['payload']),'error'=>'']))throw new \RuntimeException('Không ghi dòng.');$wpdb->query('COMMIT');}catch(\Throwable $e){$wpdb->query('ROLLBACK');throw $e;}delete_transient('cohamy_transfer_preview_'.$r['token']);as_enqueue_async_action('cohamy_transfer_tick',[$id],'cohamy',false,25);op_audit('import.start',$id,null,['kind'=>$p['kind'],'total'=>count($p['valid'])]);return response(['job_id'=>$id],201);});
    op_route('imports/(?P<id>[a-f0-9-]{36})','GET','cohamy_operate',function($r){$job=transfer_status($r['id']);if(!$job || (int)$job['actor']!==get_current_user_id())return op_error('Không có quyền đọc job.',403);return response($job);});
    op_route('imports','GET','cohamy_operate',function($r){global $wpdb;$ids=$wpdb->get_col($wpdb->prepare('SELECT job_id FROM '.op_table('data_job').' WHERE actor=%d ORDER BY created DESC,job_id LIMIT 25 OFFSET %d',get_current_user_id(),max(0,(int)$r['page']-1)*25));return response(array_map(__NAMESPACE__.'\\transfer_status',$ids));});
    op_route('entities/export','GET','cohamy_export',function($r){global $wpdb;$kind=$r['kind']==='template'?'template':'record';$rows=$wpdb->get_results($wpdb->prepare('SELECT * FROM '.op_table('entity').' WHERE kind=%s ORDER BY entity_id LIMIT 1000 OFFSET %d',$kind,max(0,(int)$r['page']-1)*1000),ARRAY_A);foreach($rows as &$row)$row['payload']=json_decode($row['payload'],true);return response(['items'=>$rows,'page'=>max(1,(int)$r['page']),'total'=>(int)$wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM '.op_table('entity').' WHERE kind=%s',$kind))]);});
});
