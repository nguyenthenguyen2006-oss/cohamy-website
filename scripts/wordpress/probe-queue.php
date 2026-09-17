<?php
if (PHP_SAPI!=='cli') exit(1);require dirname(__DIR__,2).'/.local/wordpress/wp-load.php';if(!defined('COHAMY_LOCAL_SETUP') || !COHAMY_LOCAL_SETUP)exit(1);
echo wp_json_encode($wpdb->get_results("SELECT hook,status,COUNT(*) AS count FROM {$wpdb->prefix}actionscheduler_actions GROUP BY hook,status",ARRAY_A)).PHP_EOL;
echo wp_json_encode($wpdb->get_results("SELECT j.job_id,j.state,j.total,j.last_ordinal FROM {$wpdb->prefix}cohamy_export_job j ORDER BY created DESC LIMIT 3",ARRAY_A)).PHP_EOL;
echo wp_json_encode($wpdb->get_results("SELECT a.hook,a.status,l.message FROM {$wpdb->prefix}actionscheduler_actions a JOIN {$wpdb->prefix}actionscheduler_logs l ON l.action_id=a.action_id WHERE a.status='failed' ORDER BY l.log_id DESC LIMIT 6",ARRAY_A)).PHP_EOL;
echo wp_json_encode($wpdb->get_results("SELECT a.action_id,a.hook,a.status,a.scheduled_date_gmt,l.message,l.log_date_gmt FROM {$wpdb->prefix}actionscheduler_actions a JOIN {$wpdb->prefix}actionscheduler_logs l ON l.action_id=a.action_id ORDER BY l.log_id DESC LIMIT 8",ARRAY_A)).PHP_EOL;
echo wp_json_encode($wpdb->get_results("SELECT option_name,option_value FROM {$wpdb->options} WHERE option_name LIKE 'cohamy_export_lock_%'",ARRAY_A)).PHP_EOL;
