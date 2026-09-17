<?php
namespace Cohamy;
defined('ABSPATH') || exit;
// Core REST normally writes the post before its taxonomy and registered meta.
// Wrap top-level editorial requests, while internal bulk/import transactions keep ownership.
$rest_callback_depth=0;$native_rest_transaction=null;
add_filter('rest_request_before_callbacks',function($response,$handler,$request){
    global $wpdb,$rest_callback_depth,$native_rest_transaction,$dirty_posts,$reservations,$preserve_dates;
    $rest_callback_depth++;
    if($rest_callback_depth!==1 || !in_array($request->get_method(),['POST','PUT','PATCH','DELETE'],true) || !preg_match('~^/wp/v2/(?:posts|pages)(?:/\d+)?$~D',$request->get_route()))return $response;
    if($wpdb->query('START TRANSACTION')===false)return op_error('Không mở được transaction lưu nội dung.',503);
    $native_rest_transaction=['dirty'=>$dirty_posts,'reservations'=>$reservations,'dates'=>$preserve_dates];return $response;
},1,3);
add_filter('rest_request_after_callbacks',function($response,$handler,$request){
    global $wpdb,$rest_callback_depth,$native_rest_transaction,$dirty_posts,$reservations,$preserve_dates;
    if($rest_callback_depth===1 && $native_rest_transaction!==null){
        $ok=!is_wp_error($response) && (!($response instanceof \WP_REST_Response) || $response->get_status()<400);
        if($ok){flush_changes();$ok=$wpdb->query('COMMIT')!==false;}
        if(!$ok){$wpdb->query('ROLLBACK');$dirty_posts=$native_rest_transaction['dirty'];$reservations=$native_rest_transaction['reservations'];$preserve_dates=$native_rest_transaction['dates'];wp_cache_flush();}
        $native_rest_transaction=null;
        if(!$ok && !is_wp_error($response) && (!($response instanceof \WP_REST_Response) || $response->get_status()<400))$response=op_error('Lưu nội dung không commit được; tải lại trước khi thử lại.',503);
    }
    $rest_callback_depth=max(0,$rest_callback_depth-1);return $response;
},9999,3);
// A fatal error must not leave dirty globals able to emit a webhook for rolled-back data.
add_action('shutdown',function(){global $wpdb,$native_rest_transaction,$dirty_posts,$reservations,$preserve_dates;if($native_rest_transaction!==null){$wpdb->query('ROLLBACK');$dirty_posts=$native_rest_transaction['dirty'];$reservations=$native_rest_transaction['reservations'];$preserve_dates=$native_rest_transaction['dates'];$native_rest_transaction=null;}},-10);
