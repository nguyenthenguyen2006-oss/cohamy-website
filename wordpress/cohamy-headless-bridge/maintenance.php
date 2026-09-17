<?php
namespace Cohamy;
defined('ABSPATH') || exit;

// Core stores all WP-Cron events in one option. Concurrent requests can lose an
// event while the post itself remains future. Restore only due native events;
// publication still runs through WordPress's timestamp/status checks and hooks.
function repair_due_schedules(): int {
    global $wpdb;
    $owner=op_lease('cohamy_schedule_repair_lock',30);if(!$owner)return 0;
    try {
        $ids=$wpdb->get_col($wpdb->prepare("SELECT ID FROM {$wpdb->posts} WHERE post_type IN ('post','page') AND post_status='future' AND post_date_gmt<=%s ORDER BY post_date_gmt,ID LIMIT 100",gmdate('Y-m-d H:i:s')));
        if($wpdb->last_error)throw new \RuntimeException('Không đọc được lịch xuất bản để phục hồi.');
        wp_cache_delete('cron','options');$repaired=0;
        foreach($ids as $id){
            $args=[(int)$id];if(wp_next_scheduled('publish_future_post',$args)!==false)continue;
            $result=wp_schedule_single_event(time()-1,'publish_future_post',$args,true);
            if(is_wp_error($result) || !$result)throw new \RuntimeException('Không phục hồi được sự kiện xuất bản đã đến lịch.');
            $repaired++;
        }
        return $repaired;
    }finally{op_release('cohamy_schedule_repair_lock',$owner);}
}
add_action('init',function(){if((defined('WP_CLI') && WP_CLI) || (defined('DOING_CRON') && DOING_CRON))repair_due_schedules();},60);

// Repair only missing work. A pending action, including a next-day quota action,
// retains its scheduled time; an active worker retains its lease.
function ensure_work(string $hook,array $args,int $priority=30): void {
    if (as_get_scheduled_actions(['hook'=>$hook,'args'=>$args,'group'=>'cohamy','status'=>'pending','per_page'=>1],'ids')) return;
    if (as_get_scheduled_actions(['hook'=>$hook,'args'=>$args,'group'=>'cohamy','status'=>'in-progress','per_page'=>1],'ids')) return;
    as_schedule_single_action(time()+5,$hook,$args,'cohamy',false,$priority);
}
function operations_housekeeping(): void {
    global $wpdb;
    repair_due_schedules();
    if (!function_exists('as_get_scheduled_actions')) return;
    $owner=op_lease('cohamy_repair_lock',90);if(!$owner)return;
    try {
        foreach($wpdb->get_col('SELECT campaign_id FROM '.op_table('campaign')." WHERE state='running' ORDER BY heartbeat LIMIT 100") as $id) ensure_work('cohamy_campaign_tick',[$id],20);
        foreach($wpdb->get_col('SELECT job_id FROM '.op_table('export_job')." WHERE state IN ('queued','processing') ORDER BY created LIMIT 100") as $id) ensure_work('cohamy_export_tick',[$id]);
        foreach($wpdb->get_col('SELECT job_id FROM '.op_table('data_job')." WHERE state IN ('queued','processing') ORDER BY created LIMIT 100") as $id) ensure_work('cohamy_transfer_tick',[$id],25);
        foreach($wpdb->get_col('SELECT job_id FROM '.op_table('data_job')." WHERE state='validating' ORDER BY created LIMIT 100") as $id) ensure_work('cohamy_transfer_preview_tick',[$id],25);
        foreach($wpdb->get_results("SELECT m.post_id,m.meta_value FROM {$wpdb->postmeta} m JOIN {$wpdb->posts} p ON p.ID=m.post_id WHERE m.meta_key='_cohamy_analysis_state' AND m.meta_value IN ('queued','analyzing','error') AND p.post_status!='trash' LIMIT 100",ARRAY_A) as $row){$attempt=(int)meta((int)$row['post_id'],'analysis_attempt','0');if($row['meta_value']!=='error' || $attempt<5)ensure_work('cohamy_analysis_tick',[(int)$row['post_id'],$attempt],50);}
        foreach(['cohamy_html_inspect_'=>'cohamy_html_inspect','cohamy_links_scan_'=>'cohamy_links_scan','cohamy_ai_job_'=>'cohamy_ai_job_tick'] as $prefix=>$hook){$names=$wpdb->get_col($wpdb->prepare("SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s ORDER BY option_id DESC LIMIT 100",$wpdb->esc_like($prefix).'%'));foreach($names as $name){$id=substr($name,strlen($prefix));if(!preg_match('/^[a-f0-9-]{36}$/D',$id))continue;$job=$prefix==='cohamy_ai_job_'?ai_job_get($id):get_option($name);if(!$job)continue;if(($job['created'] ?? time())<time()-30*DAY_IN_SECONDS && !in_array($job['state'],['queued','retrying','processing'],true)){delete_option($name);continue;}if($prefix==='cohamy_ai_job_' && $job['state']==='processing' && ($job['heartbeat'] ?? time())<time()-120){$job['state']='failed';$job['error']='Provider có thể đã nhận request trước khi worker dừng; không retry tự động để tránh phí trùng.';update_option($name,wp_json_encode($job),false);}elseif(in_array($job['state'],['queued','retrying'],true))ensure_work($hook,[$id],70);}}
        if(get_option('cohamy_indexnow_enabled') && get_option('cohamy_indexnow_live_authorized') && $wpdb->get_var('SELECT event_key FROM '.op_table('index_event')." WHERE state='queued' LIMIT 1")) ensure_work('cohamy_indexnow_tick',[],40);
        $wpdb->query($wpdb->prepare('DELETE FROM '.op_table('not_found').' WHERE last_seen<%d',time()-30*DAY_IN_SECONDS));
        $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name LIKE 'cohamy404event_%' AND CAST(option_value AS UNSIGNED)<%d",time()-600));
        // Audit and provider history are retained; completed URL files expire after 7 days.
        foreach($wpdb->get_col($wpdb->prepare('SELECT job_id FROM '.op_table('export_job')." WHERE state='completed' AND created<%d LIMIT 20",time()-7*DAY_IN_SECONDS)) as $id) {
            if(!preg_match('/^[a-f0-9-]{36}$/D',$id))continue;$dir=export_directory($id);
            if(is_dir($dir) && !is_link($dir)) {foreach(glob($dir.'/*') ?: [] as $file)if(is_file($file) && !is_link($file))unlink($file);if(!glob($dir.'/*'))rmdir($dir);}
            $wpdb->update(op_table('export_job'),['state'=>'expired'],['job_id'=>$id]);$wpdb->delete(op_table('export_item'),['job_id'=>$id]);
        }
        update_option('cohamy_repair_checked_at',gmdate('c'),false);
    }finally{op_release('cohamy_repair_lock',$owner);}
}
add_action('cohamy_operations_housekeeping',__NAMESPACE__.'\\operations_housekeeping');
add_action('init',function(){if(!wp_next_scheduled('cohamy_operations_housekeeping'))wp_schedule_event(time()+15,'cohamy_minute','cohamy_operations_housekeeping');},40);

function queue_health(): array {
    global $wpdb;$groups=[];
    foreach(['campaign'=>"state IN ('running','paused','stopped','blocked')",'export_job'=>"state IN ('queued','processing','failed')",'data_job'=>"state IN ('queued','processing','blocked')"] as $table=>$where)$groups[$table]=$wpdb->get_results('SELECT state,COUNT(*) AS count FROM '.op_table($table)." WHERE $where GROUP BY state",ARRAY_A);
    return ['checked_at'=>gmdate('c'),'last_repair'=>get_option('cohamy_repair_checked_at') ?: null,'jobs'=>$groups,'generation_concurrency'=>1,'worker'=>get_option('cohamy_last_worker_health') ?: null,'action_scheduler_pending'=>(int)$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}actionscheduler_actions WHERE status='pending' AND hook LIKE 'cohamy_%'"),'action_scheduler_failed'=>(int)$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}actionscheduler_actions WHERE status='failed' AND hook LIKE 'cohamy_%'")];
}
add_action('rest_api_init',function(){op_route('queue','GET','cohamy_operate',function(){return response(queue_health());});op_route('queue/repair','POST','cohamy_seo',function(){operations_housekeeping();op_audit('queue.repair','queue',null,queue_health());return response(queue_health());});});
