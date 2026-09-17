<?php
namespace Cohamy;
defined('ABSPATH') || exit;

function indexnow_selection(\WP_REST_Request $r) {
    global $wpdb;$kind=$r['kind']==='deleted'?'deleted':'updated';$urls=(array)($r['urls'] ?? []);
    if(is_string($r['urls']))$urls=preg_split('/\R/',(string)$r['urls']);
    $upload=$r->get_file_params()['file'] ?? null;if(($upload['error'] ?? null)===UPLOAD_ERR_NO_FILE)$upload=null;
    if($upload){
        if($upload['error']!==UPLOAD_ERR_OK || $upload['size']>4*1024*1024)return op_error('File TXT/CSV UTF-8 tối đa 4 MB.');
        $text=file_get_contents($upload['tmp_name']);if(!mb_check_encoding($text,'UTF-8'))return op_error('Lưu file UTF-8.');
        $text=preg_replace('/^\xEF\xBB\xBF/','',$text);
        if(strtolower(pathinfo($upload['name'],PATHINFO_EXTENSION))==='txt')$urls=array_merge($urls,preg_split('/\R/',$text));
        elseif(strtolower(pathinfo($upload['name'],PATHINFO_EXTENSION))==='csv'){
            $file=fopen('php://temp','w+');fwrite($file,$text);rewind($file);$first=(string)fgets($file);$offset=str_starts_with(strtolower(trim($first)),'sep=')?ftell($file):0;if($offset)$first=(string)fgets($file);$delimiter=count(str_getcsv($first,';','"',''))>count(str_getcsv($first,',','"',''))?';':',';fseek($file,$offset);$header=fgetcsv($file,0,$delimiter,'"','');$column=array_search('url',array_map('strtolower',$header ?: []),true);if($column===false){fclose($file);return op_error('CSV phải có cột url.');}while(($cells=fgetcsv($file,0,$delimiter,'"',''))!==false){$urls[]=$cells[$column] ?? '';if(count($urls)>10000)break;}fclose($file);
        }else return op_error('Chỉ nhận TXT/CSV.');
    }
    $has_selection=$r['wp_ids'] || $r['campaign_id'] || $r['from'] || $r['to'];
    if($has_selection){
        $where=$kind==='updated'?'('.inventory_eligible_sql().')':'NOT ('.inventory_eligible_sql().')';
        if($r['wp_ids']){$ids=array_filter(array_map('intval',is_array($r['wp_ids'])?$r['wp_ids']:explode(',',(string)$r['wp_ids'])));if(!$ids || count($ids)>10000)return op_error('Chọn 1–10.000 WordPress IDs.');$where.=' AND i.post_id IN ('.implode(',',$ids).')';}
        if($r['campaign_id'])$where.=$wpdb->prepare(" AND EXISTS (SELECT 1 FROM {$wpdb->postmeta} m WHERE m.post_id=i.post_id AND m.meta_key='_cohamy_campaign_id' AND m.meta_value=%s)",$r['campaign_id']);
        foreach(['from'=>'>=','to'=>'<='] as $key=>$op)if($r[$key]){if(!preg_match('/^\d{4}-\d\d-\d\d$/D',(string)$r[$key]))return op_error('Ngày cần YYYY-MM-DD.');$date=new \DateTimeImmutable($r[$key].($key==='to'?' 23:59:59.999':' 00:00:00'),wp_timezone());$where.=$wpdb->prepare(" AND i.modified $op %s",utc($date->format('c')));}
        $selected=$wpdb->get_col('SELECT i.url FROM '.op_table('inventory')." i WHERE $where ORDER BY i.post_id LIMIT 10001");if($wpdb->last_error)return op_error('Không đọc được danh sách URL.',503);$urls=array_merge($urls,$selected);
    }
    $urls=array_values(array_unique(array_filter(array_map('trim',$urls))));if(!$urls || count($urls)>10000)return op_error('Chọn 1–10.000 URL; chia batch nếu vượt giới hạn.');
    $errors=[];foreach($urls as $i=>$url)try{
        if(!str_starts_with($url,public_base().'/'))throw new \InvalidArgumentException('URL phải thuộc host public HTTPS Cohamy.');$path=safe_path($url);if($url!==public_base().$path)throw new \InvalidArgumentException('Không nhận query/fragment hoặc URL khác canonical.');
        $post=$wpdb->get_var($wpdb->prepare('SELECT i.post_id FROM '.op_table('inventory').' i WHERE i.url=%s AND ('.inventory_eligible_sql().')',$url));if($wpdb->last_error)throw new \RuntimeException('Không validate được database.');
        $known=$wpdb->get_var($wpdb->prepare('SELECT post_id FROM '.op_table('inventory').' WHERE url=%s',$url));if($known && (($kind==='updated' && !$post) || ($kind==='deleted' && $post)))throw new \InvalidArgumentException('Loại cập nhật/gỡ không khớp trạng thái URL hiện tại.');
    }catch(\Throwable $e){$errors[]=['row'=>$i+1,'url'=>$url,'error'=>$e->getMessage()];}
    if($errors)return response(['valid'=>false,'errors'=>$errors,'queued'=>0],422);
    $preview=['valid'=>true,'kind'=>$kind,'total'=>count($urls),'urls'=>$urls,'meaning'=>'preview_not_submitted'];
    if(!filter_var($r['confirmed'] ?? false,FILTER_VALIDATE_BOOLEAN))return response($preview);
    if(!get_option('cohamy_indexnow_enabled'))return op_error('IndexNow chưa bật; chưa có URL được đưa vào hàng đợi.',503);
    if($wpdb->query('START TRANSACTION')===false)return op_error('Không khóa được hàng đợi.',503);
    try{foreach($urls as $url)index_event($url,$kind);if($wpdb->query('COMMIT')===false)throw new \RuntimeException('Không commit được hàng đợi.');}catch(\Throwable $e){$wpdb->query('ROLLBACK');throw $e;}
    op_audit('indexnow.manual-'.$kind,'batch',null,['urls'=>$urls]);return response(['queued'=>count($urls),'kind'=>$kind,'meaning'=>'queued_not_indexed']);
}
add_action('rest_api_init',function(){op_route('indexnow/selection','POST','cohamy_seo',__NAMESPACE__.'\\indexnow_selection');});
