<?php
if (PHP_SAPI!=='cli') exit(1);
$_SERVER['HTTP_HOST']='127.0.0.1:8081'; $_SERVER['SERVER_NAME']='127.0.0.1'; $_SERVER['SERVER_PORT']='8081';
require dirname(__DIR__,2).'/.local/wordpress/wp-load.php';
if (!defined('COHAMY_LOCAL_SETUP') || !COHAMY_LOCAL_SETUP) exit(1);
$id=(int)$wpdb->get_var("SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key='_cohamy_legacy_id' AND meta_value='public-mu5wad3m'");
foreach (['_cohamy_analysis_state','_cohamy_analysis_error','_cohamy_analysis_hash','rank_math_seo_score'] as $key) echo $key.' '.wp_json_encode(get_post_meta($id,$key,true)).PHP_EOL;
echo wp_json_encode(as_get_scheduled_actions(['hook'=>'cohamy_analysis_tick','group'=>'cohamy','per_page'=>5],'ids')).PHP_EOL;
if (in_array('--run',$argv,true)) Cohamy\analysis_tick($id);
