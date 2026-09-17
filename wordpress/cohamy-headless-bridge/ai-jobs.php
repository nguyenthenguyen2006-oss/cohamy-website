<?php
namespace Cohamy;
defined('ABSPATH') || exit;

function ai_job_tick(string $id): void {
    $key='cohamy_ai_job_'.$id;$job=ai_job_get($id);if(!$job || !in_array($job['state'],['queued','retrying'],true))return;
    if(($job['next_attempt'] ?? 0)>time()){as_schedule_single_action($job['next_attempt'],'cohamy_ai_job_tick',[$id],'cohamy',false,70);return;}
    $lock=$key.'_lease';$owner=op_lease($lock,90);if(!$owner)return;$actor=get_current_user_id();wp_set_current_user($job['actor']);
    try{
        if(!current_user_can('cohamy_seo') || !current_user_can('edit_post',$job['input']['post_id']))throw new \RuntimeException('Quyền AI đã bị thu hồi.');
        if(!hash_equals($job['base_hash'],editorial_hash($job['input']['post_id'])))throw new \RuntimeException('Bài đã sửa sau khi gửi job. Tạo lại preview; không ghi đè.');
        $job['attempts']++;$job['heartbeat']=time();$job['state']='processing';update_option($key,wp_json_encode($job),false);
        $result=ai_generate($job['input']);
        if(is_wp_error($result)){$data=$result->get_error_data();$status=(int)($data['status'] ?? 500);$job['error']=$result->get_error_message();$job['http_status']=$status;if(in_array($status,[409,429,502,503],true) && $job['attempts']<3){$job['state']='retrying';$job['next_attempt']=time()+max(30,min(86400,(int)($data['retry_after'] ?? 30*(2**$job['attempts']))));as_schedule_single_action($job['next_attempt'],'cohamy_ai_job_tick',[$id],'cohamy',false,70);}else $job['state']='failed';}
        else{$job['result']=$result->get_data();$job['http_status']=$result->get_status();$job['state']=$result->get_status()===200?'completed':'missing_data';}
    }catch(\Throwable $e){$job['error']=$e->getMessage();$job['state']='failed';}finally{$job['heartbeat']=time();update_option($key,wp_json_encode($job),false);op_audit('ai.job-'.$job['state'],$id,null,['attempts'=>$job['attempts'],'state'=>$job['state'],'error'=>$job['error'] ?? '']);wp_set_current_user($actor);op_release($lock,$owner);}
}
function ai_job_get(string $id): ?array { $job=get_option('cohamy_ai_job_'.$id);return is_array($job)?$job:(json_decode((string)$job,true) ?: null); }
function ai_job_input(array $raw): array {
    $task=$raw['task'] ?? 'draft';$records=(array)($raw['records'] ?? []);
    if(!in_array($task,['draft','outline','seo','image_alt','faq','internal_link_suggestions'],true) || !$records || count($records)>20)throw new \InvalidArgumentException('Chọn tác vụ hỗ trợ và 1–20 record nguồn.');
    foreach($records as $id)if(!is_string($id) || !preg_match('/^[a-zA-Z0-9_-]{1,64}$/D',$id))throw new \InvalidArgumentException('Record ID không hợp lệ.');
    return ['post_id'=>(int)($raw['post_id'] ?? 0),'task'=>$task,'records'=>array_values(array_unique($records))];
}
add_action('cohamy_ai_job_tick',__NAMESPACE__.'\\ai_job_tick',10,1);
add_action('rest_api_init',function(){
    op_route('ai/jobs','POST','cohamy_seo',function($r){$config=get_option('cohamy_ai_config');if(empty($config['api_key']))return op_error('Chưa kết nối AI provider.',503);$input=ai_job_input($r->get_json_params());$id=(int)($input['post_id'] ?? 0);if(!$id || !current_user_can('edit_post',$id))return op_error('Chọn bài được phép sửa.',403);$uuid=wp_generate_uuid4();$job=['job_id'=>$uuid,'actor'=>get_current_user_id(),'state'=>'queued','input'=>$input,'base_hash'=>editorial_hash($id),'attempts'=>0,'next_attempt'=>time(),'heartbeat'=>time(),'created'=>time()];if(!add_option('cohamy_ai_job_'.$uuid,wp_json_encode($job),'','no'))return op_error('Không lưu được job AI.',503);as_enqueue_async_action('cohamy_ai_job_tick',[$uuid],'cohamy',false,70);return response(['job_id'=>$uuid,'state'=>'queued'],202);});
    op_route('ai/jobs/(?P<id>[a-f0-9-]{36})','GET','cohamy_seo',function($r){$job=ai_job_get($r['id']);if(!$job || $job['actor']!==get_current_user_id())return op_error('Không có quyền đọc job.',403);return response($job);});
    op_route('ai/jobs','GET','cohamy_seo',function($r){global $wpdb;$pattern=$wpdb->esc_like('cohamy_ai_job_').'%';$names=$wpdb->get_col($wpdb->prepare("SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s AND option_value LIKE %s ORDER BY option_id DESC LIMIT 25 OFFSET %d",$pattern,'%"actor":'.get_current_user_id().',%',max(0,(int)$r['page']-1)*25));$jobs=[];foreach($names as $name){$job=ai_job_get(substr($name,strlen('cohamy_ai_job_')));if(is_array($job) && ($job['actor'] ?? 0)===get_current_user_id() && isset($job['job_id']))$jobs[]=$job;}return response($jobs);});
});


