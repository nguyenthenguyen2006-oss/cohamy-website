<?php
if(PHP_SAPI!=='cli')exit(1);$_SERVER['HTTP_HOST']='127.0.0.1:8081';require dirname(__DIR__,2).'/.local/wordpress/wp-load.php';
if(!defined('COHAMY_LOCAL_SETUP') || !COHAMY_LOCAL_SETUP || wp_get_environment_type()!=='local')exit(1);wp_set_current_user(1);
$text='<p>Chocolate Cohamy được chế biến từ hạt cacao Việt Nam với nguồn nguyên liệu có kiểm chứng và mô tả sản phẩm rõ ràng.</p>';
$id=wp_insert_post(['post_type'=>'post','post_status'=>'publish','post_title'=>'Duplicate review local '.wp_generate_uuid4(),'post_content'=>$text],true);
if(is_wp_error($id))throw new RuntimeException($id->get_error_message());update_post_meta($id,'_cohamy_locale','vi');
try{
    $p=wp_insert_post(['post_type'=>'post','post_status'=>'draft','post_title'=>'Review input local','post_content'=>$text],true);
    if(is_wp_error($p))throw new RuntimeException($p->get_error_message());update_post_meta($p,'_cohamy_locale','vi');
    $result=Cohamy\near_duplicates($p,$text);$found=array_values(array_filter($result['items'],fn($row)=>(int)$row['post_id']===$id));
    if(!$found || $found[0]['word_overlap']!==1.0)throw new RuntimeException('Native same-locale duplicate review did not find exact text.');
    echo json_encode(['name'=>'Native same-locale near-duplicate review finds exact text, remains advisory','status'=>'PASS','word_overlap'=>1,'scope'=>$result['scope']],JSON_UNESCAPED_UNICODE);
}finally{wp_update_post(['ID'=>$id,'post_status'=>'draft']);}
