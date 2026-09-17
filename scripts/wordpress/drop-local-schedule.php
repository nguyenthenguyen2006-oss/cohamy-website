<?php
// A controlled lost-event regression fixture, never callable over HTTP.
if(PHP_SAPI!=='cli')exit(1);
$_SERVER['HTTP_HOST']='127.0.0.1:8081';
require dirname(__DIR__,2).'/.local/wordpress/wp-load.php';
if(!defined('COHAMY_LOCAL_SETUP') || !COHAMY_LOCAL_SETUP)throw new RuntimeException('Local-only schedule fixture refused.');
$id=filter_var($argv[1] ?? '',FILTER_VALIDATE_INT);$post=$id?get_post($id):null;
if(!$post || $post->post_status!=='future' || strpos(Cohamy\meta($id,'public_slug'),'e2e-')!==0)throw new RuntimeException('Only a local future e2e post can lose its event.');
if(wp_next_scheduled('publish_future_post',[$id])===false)throw new RuntimeException('The native event must exist before the controlled deletion.');
wp_clear_scheduled_hook('publish_future_post',[$id]);
if(wp_next_scheduled('publish_future_post',[$id])!==false)throw new RuntimeException('Event deletion did not persist.');
echo 'CONTROLLED lost native cron event '.(int)$id.PHP_EOL;
