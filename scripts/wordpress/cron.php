<?php
if (PHP_SAPI!=='cli') exit(1);
$root=$argv[1] ?? '';
$_SERVER['HTTP_HOST']='127.0.0.1:8081'; $_SERVER['SERVER_NAME']='127.0.0.1'; $_SERVER['SERVER_PORT']='8081';
require $root.'/wp-load.php';
if (!defined('COHAMY_LOCAL_SETUP') || !COHAMY_LOCAL_SETUP) throw new RuntimeException('Local-only cron refused.');
Cohamy\repair_due_schedules();
$crons=wp_get_ready_cron_jobs();
foreach ($crons as $timestamp=>$hooks) foreach ($hooks as $hook=>$events) foreach ($events as $event) {
    if ($event['schedule']) wp_reschedule_event($timestamp,$event['schedule'],$hook,$event['args']);
    wp_unschedule_event($timestamp,$hook,$event['args']);
    if ($hook==='publish_future_post') echo '[cron] '.gmdate('c').' publish_future_post '.(int)($event['args'][0] ?? 0).PHP_EOL;
    do_action_ref_array($hook,$event['args']);
}
// Scheduled publication must commit its revision before webhook delivery in this process.
if (class_exists('ActionScheduler_QueueRunner')) ActionScheduler_QueueRunner::instance()->run('Cohamy system cron');
Cohamy\flush_changes();
Cohamy\deliver_webhooks();
