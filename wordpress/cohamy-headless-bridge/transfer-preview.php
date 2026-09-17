<?php
namespace Cohamy;
defined('ABSPATH') || exit;

// Large previews are durable, private jobs. Parsing is bounded by 16MB/20k rows;
// API/identity validation runs 50 rows per Action Scheduler action before any write.
function transfer_preview_enqueue(string $kind,array $rows,array $options,array $mapping) {
    global $wpdb;$id=wp_generate_uuid4();if($wpdb->query('START TRANSACTION')===false)throw new \RuntimeException('Không bắt đầu được preview.');
    try{
        if(!$wpdb->insert(op_table('data_job'),['job_id'=>$id,'actor'=>get_current_user_id(),'state'=>'validating','kind'=>$kind,'total'=>count($rows),'created'=>time()]))throw new \RuntimeException('Không lưu preview job.');
        foreach(array_chunk($rows,100,true) as $chunk){$values=[];foreach($chunk as $i=>$raw)$values[]=$wpdb->prepare('(%s,%d,%s,%s,%s)',$id,$i+1,'unvalidated',wp_json_encode($raw),'');if($wpdb->query('INSERT INTO '.op_table('data_row').' (job_id,ordinal,state,payload,error) VALUES '.implode(',',$values))===false)throw new \RuntimeException('Không lưu được dữ liệu preview.');}
        if(!add_option('cohamy_transfer_options_'.$id,wp_json_encode(['options'=>$options,'mapping'=>$mapping]),'','no'))throw new \RuntimeException('Không lưu được cấu hình preview.');if($wpdb->query('COMMIT')===false)throw new \RuntimeException('Không commit được preview.');
    }catch(\Throwable $e){$wpdb->query('ROLLBACK');throw $e;}
    as_enqueue_async_action('cohamy_transfer_preview_tick',[$id],'cohamy',false,25);return response(['job_id'=>$id,'state'=>'validating','total'=>count($rows),'message'=>'Chưa ghi nội dung. Cron đang validate từng batch.'],202);
}
function transfer_preview_tick(string $id): void {
    global $wpdb;$job=transfer_status($id);if(!$job || $job['state']!=='validating')return;$key='cohamy_preview_lock_'.$id;$owner=op_lease($key,120);if(!$owner)return;$actor=get_current_user_id();wp_set_current_user((int)$job['actor']);
    try{
        if(!current_user_can(transfer_cap($job['kind'])))throw new \RuntimeException('Quyền preview đã bị thu hồi.');
        $settings=json_decode((string)get_option('cohamy_transfer_options_'.$id),true);$rows=$wpdb->get_results($wpdb->prepare('SELECT ordinal,payload FROM '.op_table('data_row')." WHERE job_id=%s AND state='unvalidated' ORDER BY ordinal LIMIT 50",$id),ARRAY_A);if($wpdb->last_error)throw new \RuntimeException('Không đọc được batch preview.');
        $request=new \WP_REST_Request('POST','/cohamy/v1/ops/imports/preview');$request->set_header('Content-Type','application/json');$request->set_body(wp_json_encode(['kind'=>$job['kind'],'rows'=>array_map(fn($row)=>json_decode($row['payload'],true),$rows),'mapping'=>$settings['mapping'],'mode'=>$settings['options']['mode'],'preserve_state'=>$settings['options']['preserve_status']]));
        $result=transfer_preview($request);if(is_wp_error($result))throw new \RuntimeException($result->get_error_message());$preview=get_transient('cohamy_transfer_preview_'.$result->get_data()['token']);delete_transient('cohamy_transfer_preview_'.$result->get_data()['token']);$valid=[];foreach($preview['valid'] as $item)$valid[$item['ordinal']]=$item['payload'];$errors=[];foreach($preview['errors'] as $item)$errors[$item['row']]=$item['error'];
        foreach($rows as $i=>$row){$state='invalid';$error=$errors[$i+1] ?? ''; $normalized=$valid[$i+1] ?? null;$payload=$row['payload'];
            if($normalized){$keys=[];if($job['kind']==='post'){$p=$normalized['row'];$keys=['legacy:'.$p['id'],'slug:'.$p['locale'].':'.$p['slug'],'group:'.$p['group_id'].':'.$p['locale']];}else $keys=[$job['kind'].':'.($normalized['entity_id'] ?? $normalized['source'])];
                if($wpdb->query('START TRANSACTION')===false)throw new \RuntimeException('Không khóa được preview keys.');try{foreach($keys as $identity){$hash=hash('sha256',$identity);$old=$wpdb->get_var($wpdb->prepare('SELECT ordinal FROM '.op_table('validation_key').' WHERE job_id=%s AND key_hash=%s',$id,$hash));if($wpdb->last_error)throw new \RuntimeException('Không đọc được khóa preview.');if($old && (int)$old!==(int)$row['ordinal'])throw new \RuntimeException('Trùng stable ID/URL với dòng '.$old.' trong file.');if(!$old && !$wpdb->insert(op_table('validation_key'),['job_id'=>$id,'key_hash'=>$hash,'ordinal'=>$row['ordinal']]))throw new \RuntimeException('Không ghi được khóa preview.');}$state='valid';$payload=wp_json_encode($normalized);if($wpdb->query('COMMIT')===false)throw new \RuntimeException('Commit preview keys lỗi.');}catch(\Throwable $e){$wpdb->query('ROLLBACK');$error=$e->getMessage();}}
            if($wpdb->update(op_table('data_row'),['state'=>$state,'payload'=>$payload,'error'=>$error],['job_id'=>$id,'ordinal'=>$row['ordinal']])===false)throw new \RuntimeException('Checkpoint preview lỗi.');
        }
        $left=(int)$wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM '.op_table('data_row')." WHERE job_id=%s AND state='unvalidated'",$id));if($left)as_schedule_single_action(time()+2,'cohamy_transfer_preview_tick',[$id],'cohamy',false,25);else{
            if($job['kind']==='redirect'){$items=[];foreach($wpdb->get_results($wpdb->prepare('SELECT ordinal,payload FROM '.op_table('data_row')." WHERE job_id=%s AND state='valid'",$id),ARRAY_A) as $row)$items[]=['ordinal'=>(int)$row['ordinal'],'payload'=>json_decode($row['payload'],true)];foreach(redirect_batch_errors($items) as $line=>$error)if($wpdb->update(op_table('data_row'),['state'=>'invalid','error'=>$error],['job_id'=>$id,'ordinal'=>$line])===false)throw new \RuntimeException('Không lưu được lỗi redirect graph.');}
            if($wpdb->update(op_table('data_job'),['state'=>'previewed'],['job_id'=>$id])===false)throw new \RuntimeException('Không lưu được preview hoàn tất.');op_audit('import.preview-complete',$id,null,transfer_status($id));
        }
    }catch(\Throwable $e){$wpdb->update(op_table('data_job'),['state'=>'blocked'],['job_id'=>$id]);op_audit('import.preview-error',$id,null,['error'=>$e->getMessage()]);}finally{wp_set_current_user($actor);op_release($key,$owner);}
}
function transfer_preview_start(string $id,bool $confirmed,bool $skip_invalid) {
    global $wpdb;$job=transfer_status($id);if(!$job || (int)$job['actor']!==get_current_user_id() || !current_user_can(transfer_cap($job['kind'])))return op_error('Không có quyền xác nhận preview.',403);if($job['state']!=='previewed' || (int)$job['created']<time()-HOUR_IN_SECONDS)return op_error('Preview chưa xong/đã hết hạn. Validate lại.',409);if(!$confirmed || ($job['failed'] && !$skip_invalid))return op_error('Xác nhận preview; chọn bỏ dòng lỗi rõ ràng nếu cần.');if(!$job['valid'])return op_error('Không có dòng hợp lệ.');
    $wpdb->query('START TRANSACTION');try{if(!$wpdb->update(op_table('data_job'),['state'=>'queued'],['job_id'=>$id,'state'=>'previewed']))throw new \RuntimeException('Preview đã được xác nhận ở phiên khác.');if($wpdb->query($wpdb->prepare('UPDATE '.op_table('data_row')." SET state=CASE WHEN state='valid' THEN 'queued' ELSE 'failed' END WHERE job_id=%s",$id))===false)throw new \RuntimeException('Không ghi được trạng thái batch.');if($wpdb->query('COMMIT')===false)throw new \RuntimeException('Không commit được xác nhận.');}catch(\Throwable $e){$wpdb->query('ROLLBACK');throw $e;}
    as_enqueue_async_action('cohamy_transfer_tick',[$id],'cohamy',false,25);op_audit('import.start',$id,null,['valid'=>$job['valid'],'failed'=>$job['failed']]);return response(['job_id'=>$id],201);
}
add_action('cohamy_transfer_preview_tick',__NAMESPACE__.'\\transfer_preview_tick',10,1);
