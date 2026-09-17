<?php
// Actual isolated WordPress published posts for export/sitemap scale tests, never production.
if (PHP_SAPI!=='cli') exit(1);
require dirname(__DIR__,2).'/.local/wordpress/wp-load.php';
if (!defined('COHAMY_LOCAL_SETUP') || !COHAMY_LOCAL_SETUP || wp_get_environment_type()!=='local') exit(1);
global $wpdb;
$count=max(1,min(20000,(int)($argv[1] ?? 10001))); $run=$argv[2] ?? 'export-load';
if (!preg_match('/^[a-z0-9-]{1,50}$/D',$run)) exit(1);
$start=microtime(true); $created=0; $existing=0;
// Seeder is a fixture importer; batch native table writes avoid manufacturing 10k HTTP/editor operations.
// All three native content/meta/identity records and public inventory are committed together.
for ($offset=0;$offset<$count;$offset+=100) {
    $wpdb->query('START TRANSACTION');
    try {
        for ($i=$offset;$i<min($offset+100,$count);$i++) {
            $slug=$run.'-'.($i+1); $legacy=$run.'-'.($i+1); $key=hash('sha256',$legacy);
            if ($wpdb->get_var($wpdb->prepare('SELECT post_id FROM '.Cohamy\op_table('identity').' WHERE legacy_key=%s',$key))) { $existing++; continue; }
            $now=gmdate('Y-m-d H:i:s');
            $data=['post_author'=>1,'post_date'=>$now,'post_date_gmt'=>$now,'post_content'=>'<h2>Fixture kiểm thử export</h2><p>LOCAL_SCALE_FIXTURE_'.$slug.'</p>','post_title'=>'Local scale fixture '.$slug,'post_excerpt'=>'Dữ liệu test riêng, không phát hành production.','post_status'=>'publish','comment_status'=>'closed','ping_status'=>'closed','post_password'=>'','post_name'=>'internal-'.$slug,'to_ping'=>'','pinged'=>'','post_modified'=>$now,'post_modified_gmt'=>$now,'post_content_filtered'=>'','post_parent'=>0,'guid'=>'','menu_order'=>0,'post_type'=>'post','post_mime_type'=>'','comment_count'=>0];
            if (!$wpdb->insert($wpdb->posts,$data)) throw new RuntimeException('Native post insert failed.'); $id=(int)$wpdb->insert_id;
            $identity=['locale'=>'vi','slug'=>$slug,'group_id'=>$legacy,'legacy_id'=>$legacy];
            if (is_wp_error($claim=Cohamy\reserve_identity($id,$identity))) throw new RuntimeException($claim->get_error_message()); Cohamy\commit_identity($id,$id,$identity);
            foreach (['_cohamy_author'=>'Cohamy QA','_cohamy_load_fixture'=>$run,'_cohamy_campaign_id'=>$run,'_cohamy_created_at'=>Cohamy\utc($now),'_cohamy_updated_at'=>Cohamy\utc($now),'_cohamy_published_at'=>Cohamy\utc($now),'rank_math_title'=>'Local scale fixture '.$slug,'rank_math_description'=>'Dữ liệu test export Cohamy.','rank_math_robots'=>['index','follow']] as $name=>$value) update_post_meta($id,$name,$value);
            wp_set_post_terms($id,[(int)get_term_by('slug','brand-story','category')->term_id],'category');
            Cohamy\inventory_update($id); $created++;
        }
        $wpdb->query('COMMIT');
    } catch (Throwable $e) { $wpdb->query('ROLLBACK'); throw $e; }
    global $dirty_posts; $dirty_posts=[]; wp_cache_flush();
    usleep(100000); // Yield between commits to interactive editors on SQLite local.
    echo json_encode(['processed'=>min($offset+100,$count),'created'=>$created,'existing'=>$existing,'elapsed_seconds'=>round(microtime(true)-$start,2)]).PHP_EOL;
}
update_option('cohamy_revision',wp_generate_uuid4(),false);
echo json_encode(['environment'=>'LOCAL / REAL WORDPRESS POST TABLES / FIXTURE IMPORTER','run'=>$run,'created'=>$created,'existing'=>$existing,'total'=>$count,'elapsed_seconds'=>round(microtime(true)-$start,2),'php_peak_mb'=>round(memory_get_peak_usage(true)/1024/1024,1)]).PHP_EOL;
