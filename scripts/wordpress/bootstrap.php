<?php
// CLI-only bootstrap for an isolated local database. Not a public HTTP endpoint.
if (PHP_SAPI!=='cli') exit(1);
$root=$argv[1] ?? '';
define('WP_INSTALLING',true);
$_SERVER['HTTP_HOST']='127.0.0.1:8081';
$_SERVER['SERVER_NAME']='127.0.0.1';
$_SERVER['SERVER_PORT']='8081';
require $root.'/wp-load.php';
if (!defined('COHAMY_LOCAL_SETUP') || !COHAMY_LOCAL_SETUP) throw new RuntimeException('Local-only bootstrap refused.');
require_once ABSPATH.'wp-admin/includes/upgrade.php';
require_once ABSPATH.'wp-admin/includes/plugin.php';
// WP_INSTALLING deliberately skips active plugins; load only this isolated CMS's required plugins.
require_once WP_PLUGIN_DIR.'/seo-by-rank-math/rank-math.php';
require_once WP_PLUGIN_DIR.'/cohamy-headless-bridge/cohamy-headless-bridge.php';
$credential_file=$argv[2];
$credentials=file_exists($credential_file) ? json_decode(file_get_contents($credential_file),true) : null;
if (!$credentials) {
    $credentials=['admin'=>['username'=>'cohamy-local-admin','password'=>bin2hex(random_bytes(18))],'writer'=>['username'=>'cohamy-local-writer','password'=>bin2hex(random_bytes(18))],'reviewer'=>['username'=>'cohamy-local-reviewer','password'=>bin2hex(random_bytes(18))]];
}
if (!is_blog_installed()) wp_install('Cohamy',$credentials['admin']['username'],'local-admin@example.test',true,'',$credentials['admin']['password']);
foreach (['seo-by-rank-math/rank-math.php','cohamy-headless-bridge/cohamy-headless-bridge.php'] as $plugin) {
    $result=activate_plugin($plugin,'',false,true); if (is_wp_error($result)) throw new RuntimeException($result->get_error_message());
}
Cohamy\activate();
// Run the real Rank Math installer, including its tables and capability initialization.
(new RankMath\Installer())->activation(false);
RankMath\Installer::create_tables(['link-counter']);
delete_transient('_rank_math_activation_redirect');
update_option('timezone_string','Asia/Ho_Chi_Minh');
update_option('permalink_structure','/%postname%/');
update_option('blogname','Cohamy');
update_option('blog_public',1);
update_option('default_category',get_term_by('slug','chocolate','category')->term_id);
$titles=get_option('rank-math-options-titles',[]); $titles['pt_post_title']='%title% %sep% %sitename%'; $titles['pt_post_description']='%excerpt%'; $titles['title_separator']='-';
update_option('rank-math-options-titles',$titles);
update_option('rank_math_modules',array_values(array_diff((array)get_option('rank_math_modules',[]),['sitemap','analytics','content-ai'])));
update_option('rank_math_registration_skip',true);
foreach (['admin'=>'administrator','writer'=>'cohamy_writer','reviewer'=>'cohamy_reviewer'] as $key=>$role) {
    $user=get_user_by('login',$credentials[$key]['username']);
    $id=$user ? $user->ID : wp_create_user($credentials[$key]['username'],$credentials[$key]['password'],$key.'@example.test');
    if (is_wp_error($id)) throw new RuntimeException($id->get_error_message());
    $user=new WP_User($id); $user->set_role($role); $credentials[$key]['id']=$id;
    if (!wp_check_password($credentials[$key]['password'],$user->user_pass,$id)) wp_set_password($credentials[$key]['password'],$id);
    if (empty($credentials[$key]['application_password'])) {
        $app=WP_Application_Passwords::create_new_application_password($id,['name'=>'Cohamy isolated local tests']);
        if (is_wp_error($app)) throw new RuntimeException($app->get_error_message());
        $credentials[$key]['application_password']=$app[0];
    }
}
// Keep credentials on disk, never print them in tool output.
file_put_contents($credential_file,json_encode($credentials,JSON_PRETTY_PRINT));
echo json_encode(['installed'=>true,'wordpress'=>$wp_version,'rank_math'=>defined('RANK_MATH_VERSION') ? RANK_MATH_VERSION : 'active','timezone'=>wp_timezone_string(),'credential_file'=>$credential_file]).PHP_EOL;
