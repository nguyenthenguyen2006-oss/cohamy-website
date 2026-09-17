<?php
namespace Cohamy;
defined('ABSPATH') || exit;

function import_options($request): array {
    return ['mode'=>$request['mode']==='upsert' ? 'upsert' : 'create','preserve_status'=>filter_var($request['preserve_status'],FILTER_VALIDATE_BOOLEAN),'preserve_dates'=>filter_var($request['preserve_dates'],FILTER_VALIDATE_BOOLEAN)];
}
function bool_value($value,bool $default=false): bool {
    if ($value==='' || $value===null) return $default;
    if (is_bool($value)) return $value;
    $value=strtoupper(trim((string)$value));
    if ($value!=='TRUE' && $value!=='FALSE') throw new \InvalidArgumentException('Boolean phải là TRUE hoặc FALSE.');
    return $value==='TRUE';
}
function validate_import_row(array $row,array $options,array &$seen): array {
    global $wpdb;
    foreach (HEADERS as $field) $row[$field]=in_array($field,['featured','robots_index'],true) && is_bool($row[$field] ?? null) ? ($row[$field] ? 'TRUE' : 'FALSE') : (string)($row[$field] ?? '');
    foreach (HEADERS as $field) if ($field!=='content_html') $row[$field]=trim($row[$field]);
    if ($row['group_id']==='') throw new \InvalidArgumentException('group_id bắt buộc; dùng cùng ID cho các bản dịch.');
    if ($row['id']==='') $row['id']='csv-'.hash('sha256',$row['group_id'].':'.$row['locale']);
    $identity=['locale'=>$row['locale'],'slug'=>$row['slug'],'group_id'=>$row['group_id'],'legacy_id'=>$row['id']];
    if ($error=validate_identity($identity)) throw new \InvalidArgumentException($error->get_error_message());
    foreach (['title'=>300,'excerpt'=>1000,'author'=>200,'seo_title'=>300,'seo_description'=>1000,'cover_image_alt'=>500,'cover_image'=>2000] as $field=>$max) {
        if (mb_strlen($row[$field])>$max || (in_array($field,['title','author'],true) && $row[$field]==='')) throw new \InvalidArgumentException($field.' bắt buộc hoặc vượt giới hạn '.$max.' ký tự.');
    }
    if (!in_array($row['category'],CATEGORIES,true)) throw new \InvalidArgumentException('category không thuộc danh mục Cohamy.');
    if (!in_array($row['status'],['draft','scheduled','published','archived'],true)) throw new \InvalidArgumentException('status phải là draft/scheduled/published/archived.');
    foreach (['scheduled_at','published_at','created_at','updated_at'] as $field) {
        if ($row[$field]!=='' && (!preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/D',$row[$field]) || strtotime($row[$field])===false)) throw new \InvalidArgumentException($field.' phải là ISO 8601 có timezone (Z hoặc +07:00).');
    }
    if ($row['status']==='scheduled' && $row['scheduled_at']==='') throw new \InvalidArgumentException('Bài scheduled thiếu scheduled_at.');
    if ($row['canonical_url']!=='' && !filter_var($row['canonical_url'],FILTER_VALIDATE_URL)) throw new \InvalidArgumentException('canonical_url không hợp lệ (chỉ lưu tương thích).');
    if ($row['cover_image']!=='' && !(str_starts_with($row['cover_image'],'/') && !str_starts_with($row['cover_image'],'//')) && !preg_match('~^https://~i',$row['cover_image'])) throw new \InvalidArgumentException('cover_image cần URL HTTPS hoặc đường dẫn /images/…; không tải URL trên server.');
    if (count(csv_list($row['tags']))>50 || count(csv_list($row['related_product_ids']))>30 || array_diff(csv_list($row['related_product_ids']),array_column(products(),'id'))) throw new \InvalidArgumentException('Tags quá nhiều hoặc mã sản phẩm không tồn tại.');
    $row['featured']=bool_value($row['featured']); $row['robots_index']=bool_value($row['robots_index'],true);
    foreach(['focus_keyword'=>500,'facebook_title'=>300,'facebook_description'=>1000,'twitter_title'=>300,'twitter_description'=>1000] as $field=>$max)if(isset($row[$field]) && (!is_scalar($row[$field]) || mb_strlen((string)$row[$field])>$max))throw new \InvalidArgumentException('Field '.$field.' vượt giới hạn hoặc sai kiểu.');
    foreach(['country','topic','subject','location'] as $kind)if(!empty($row[$kind.'_id'])){ $reference=entity_get((string)$row[$kind.'_id']);if(!$reference || $reference['kind']!=='record' || ($reference['payload']['type'] ?? '')!==$kind || $reference['state']!=='approved' || (!empty($reference['payload']['expires_at']) && strtotime($reference['payload']['expires_at'])<time()))throw new \InvalidArgumentException('Record '.$kind.' chưa hợp lệ/được duyệt.'); }
    if ($blocks=unsupported_blocks($row['content_html'])) throw new \InvalidArgumentException('Block không được hỗ trợ: '.implode(', ',$blocks));
    $existing=(int)$wpdb->get_var($wpdb->prepare("SELECT post_id FROM {$wpdb->prefix}cohamy_identity WHERE legacy_key=%s",hash('sha256',$row['id'])));
    if ($existing && $options['mode']==='create') throw new \InvalidArgumentException('ID đã tồn tại. Chọn Tạo mới/cập nhật để import lại.');
    if ($existing && !current_user_can('edit_post',$existing)) throw new \InvalidArgumentException('Không có quyền sửa bài hiện có.');
    if ($existing && meta($existing,'last_public_locale') && $row['locale']!==meta($existing,'last_public_locale')) throw new \InvalidArgumentException('Không đổi locale của URL đã xuất bản; tạo bản dịch riêng cùng group_id.');
    if ($options['preserve_status'] && in_array($row['status'],['published','scheduled'],true) && !current_user_can('publish_posts')) throw new \InvalidArgumentException('Không có quyền giữ trạng thái published/scheduled.');
    if ($options['preserve_dates'] && !current_user_can('manage_options')) throw new \InvalidArgumentException('Chỉ admin migration được giữ thời gian nguồn.');
    $keys=['slug'=>hash('sha256',$row['locale'].':'.$row['slug']),'group'=>hash('sha256',$row['group_id'].':'.$row['locale']),'legacy'=>hash('sha256',$row['id'])];
    foreach ($keys as $kind=>$key) {
        if (isset($seen[$kind][$key])) throw new \InvalidArgumentException('Trùng '.$kind.' trong file.');
        $column=['slug'=>'slug_key','group'=>'group_key','legacy'=>'legacy_key'][$kind];
        $owner=(int)$wpdb->get_var($wpdb->prepare("SELECT post_id FROM {$wpdb->prefix}cohamy_identity WHERE $column=%s",$key));
        if ($owner && $owner!==$existing) throw new \InvalidArgumentException('Trùng '.$kind.' với một bài khác.');
    }
    foreach ($keys as $kind=>$key) $seen[$kind][$key]=true;
    $row['_existing']=$existing;
    return $row;
}

function import_row(array $row,array $options): array {
    global $wpdb,$dirty_posts,$reservations,$preserve_dates;
    $before=[$dirty_posts,$reservations,$preserve_dates];
    if ($wpdb->query('START TRANSACTION')===false) throw new \RuntimeException('Không bắt đầu được transaction import.');
    try {
        $result=write_import_row($row,$options);
        if ($wpdb->query('COMMIT')===false) throw new \RuntimeException('Không commit được bài import.');
        return $result;
    } catch (\Throwable $error) {
        $id=(int)$wpdb->get_var($wpdb->prepare("SELECT post_id FROM {$wpdb->prefix}cohamy_identity WHERE legacy_key=%s",hash('sha256',$row['id'])));
        $wpdb->query('ROLLBACK');
        [$dirty_posts,$reservations,$preserve_dates]=$before;
        if ($id>0) clean_post_cache($id);
        if ($row['_existing']) clean_post_cache((int)$row['_existing']);
        throw $error;
    }
}

function write_import_row(array $row,array $options): array {
    global $wpdb,$preserve_dates;
    $existing=(int)$row['_existing'];
    $reserved=$existing ?: -random_int(1,PHP_INT_MAX);
    $identity=['locale'=>$row['locale'],'slug'=>$row['slug'],'group_id'=>$row['group_id'],'legacy_id'=>$row['id']];
    $claim=reserve_identity($reserved,$identity);
    if (is_wp_error($claim)) throw new \RuntimeException($claim->get_error_message());
    $status=$options['preserve_status'] ? ['draft'=>'draft','published'=>'publish','scheduled'=>'future','archived'=>'trash'][$row['status']] : 'draft';
    $date=$status==='future' ? $row['scheduled_at'] : ($row['published_at'] ?: ($row['created_at'] ?: gmdate('c')));
    $gmt=gmdate('Y-m-d H:i:s',strtotime($date));
    $data=['post_type'=>'post','post_status'=>$status,'post_title'=>sanitize_text_field($row['title']),'post_excerpt'=>wp_kses_post($row['excerpt']),'post_content'=>safe_content_html($row['content_html']),'post_name'=>'cohamy-'.($existing ?: wp_generate_uuid4()),'post_date_gmt'=>$gmt,'post_date'=>get_date_from_gmt($gmt)];
    if ($existing) $data['ID']=$existing; else $data['post_author']=get_current_user_id();
    // wp_slash protects literal backslashes and quoted HTML from WP's unslashing.
    $id=wp_insert_post(wp_slash($data),true);
    if (is_wp_error($id)) throw new \RuntimeException($id->get_error_message());
    commit_identity($reserved,(int)$id,$identity);
    foreach (['cover_image','cover_image_alt','author','canonical_url','scheduled_at','published_at'] as $key) update_post_meta($id,'_cohamy_'.$key,$row[$key]);
    update_post_meta($id,'_cohamy_featured',$row['featured'] ? 'TRUE' : 'FALSE');
    update_post_meta($id,'_cohamy_related_product_ids',implode(',',csv_list($row['related_product_ids'])));
    update_post_meta($id,'rank_math_title',$row['seo_title']);
    update_post_meta($id,'rank_math_description',$row['seo_description']);
    foreach(['focus_keyword','facebook_title','facebook_description','twitter_title','twitter_description'] as $key)if(array_key_exists($key,$row))update_post_meta($id,'rank_math_'.$key,sanitize_text_field($row[$key]));
    foreach(['country','topic','subject','location'] as $kind)if(array_key_exists($kind.'_id',$row))update_post_meta($id,'_cohamy_'.$kind.'_id',sanitize_text_field($row[$kind.'_id']));
    update_post_meta($id,'rank_math_robots',[$row['robots_index'] ? 'index' : 'noindex','follow']);
    $category=get_term_by('slug',$row['category'],'category');
    $terms=wp_set_post_terms($id,[(int)$category->term_id],'category');
    if (is_wp_error($terms)) throw new \RuntimeException($terms->get_error_message());
    $terms=wp_set_post_terms($id,csv_list($row['tags']),'post_tag');
    if (is_wp_error($terms)) throw new \RuntimeException($terms->get_error_message());
    if (!$existing || !meta($id,'created_at')) update_post_meta($id,'_cohamy_created_at',$row['created_at'] ? utc($row['created_at']) : utc($gmt));
    if ($options['preserve_dates']) {
        $preserve_dates[$id]=true;
        update_post_meta($id,'_cohamy_updated_at',utc($row['updated_at'] ?: $gmt));
        $modified=gmdate('Y-m-d H:i:s',strtotime($row['updated_at'] ?: $gmt));
        $wpdb->update($wpdb->posts,['post_modified_gmt'=>$modified,'post_modified'=>get_date_from_gmt($modified)],['ID'=>$id]);
        clean_post_cache($id);
    }
    dirty((int)$id);
    return ['id'=>$row['id'],'wp_id'=>(int)$id,'action'=>$existing ? 'updated' : 'created'];
}

function open_csv(string $filename): array {
    $file=fopen($filename,'rb');
    if (!$file) throw new \RuntimeException('Không mở được file CSV.');
    $first=(string)fgets($file); $first=preg_replace('/^\xEF\xBB\xBF/','',$first);
    $offset=str_starts_with(strtolower(trim($first)),'sep=') ? ftell($file) : 0;
    if ($offset) $first=(string)fgets($file);
    $semicolon=count(str_getcsv($first,';','"',''));
    $comma=count(str_getcsv($first,',','"',''));
    $delimiter=$semicolon>$comma ? ';' : ',';
    fseek($file,$offset);
    $header=fgetcsv($file,0,$delimiter,'"','');
    if (!$header) throw new \InvalidArgumentException('File CSV rỗng.');
    $header[0]=preg_replace('/^\xEF\xBB\xBF/','',$header[0]); $header=array_map('trim',$header);
    if ($header!==HEADERS) throw new \InvalidArgumentException('Cần đủ 23 cột BLOG_HEADERS theo đúng thứ tự của CSV mẫu.');
    return [$file,$delimiter];
}

function preview_import($request) {
    $files=$request->get_file_params(); $upload=$files['file'] ?? null;
    if (!$upload || $upload['error']!==UPLOAD_ERR_OK || $upload['size']>16*1024*1024) return new \WP_Error('invalid_file','Chọn CSV UTF-8 tối đa 16 MB.',['status'=>400]);
    $options=import_options($request); $token=wp_generate_uuid4();
    $filename=tempnam(get_temp_dir(),'cohamy-csv-');
    if (!move_uploaded_file($upload['tmp_name'],$filename)) return new \WP_Error('upload_failed','Không lưu được file tạm.',['status'=>500]);
    chmod($filename,0600);
    try {
        [$file,$delimiter]=open_csv($filename); $start=ftell($file); $total=0;$valid=0;$errors=[];$preview=[];$seen=[];
        while (($cells=fgetcsv($file,0,$delimiter,'"',''))!==false) {
            if ($cells===[null]) continue;
            $total++; if ($total>20000) throw new \InvalidArgumentException('Tối đa 20.000 bản ghi mỗi file.');
            try {
                if (count($cells)!==23 || !mb_check_encoding(implode('',$cells),'UTF-8')) throw new \InvalidArgumentException('Sai số cột hoặc encoding; lưu CSV UTF-8.');
                $row=validate_import_row(array_combine(HEADERS,$cells),$options,$seen); $valid++;
                if (count($preview)<10) $preview[]=['row'=>$total+1,'id'=>$row['id'],'locale'=>$row['locale'],'slug'=>$row['slug'],'title'=>$row['title'],'status'=>$options['preserve_status'] ? $row['status'] : 'draft','action'=>$row['_existing'] ? 'updated' : 'created'];
            } catch (\Throwable $error) { $errors[]=['row'=>$total+1,'reason'=>$error->getMessage()]; }
        }
        fclose($file);
        set_transient('cohamy_import_'.$token,['uid'=>get_current_user_id(),'file'=>$filename,'delimiter'=>$delimiter,'offset'=>$start,'cursor'=>0,'total'=>$total,'options'=>$options,'seen'=>[],'created'=>0,'updated'=>0,'failed'=>0,'errors'=>[]],HOUR_IN_SECONDS);
        wp_schedule_single_event(time()+HOUR_IN_SECONDS,'cohamy_cleanup_import',[$filename]);
        return response(['token'=>$token,'total'=>$total,'valid'=>$valid,'invalid'=>count($errors),'errors'=>$errors,'preview'=>$preview,'batch_size'=>25]);
    } catch (\Throwable $error) { @unlink($filename); return new \WP_Error('csv_invalid',$error->getMessage(),['status'=>400]); }
}

function import_batch($request) {
    $token=(string)$request['token'];
    if (!preg_match('/^[a-f0-9-]{36}$/D',$token)) return new \WP_Error('job_denied','Phiên import không hợp lệ.',['status'=>403]);
    $key='cohamy_import_'.$token; $job=get_transient($key);
    if (!$job || $job['uid']!==get_current_user_id()) return new \WP_Error('job_denied','Phiên import hết hạn hoặc thuộc người khác.',['status'=>403]);
    if ((int)$request['cursor']!==$job['cursor']) return new \WP_Error('cursor_conflict','Cursor đã thay đổi; tải lại trạng thái job.',['status'=>409]);
    $lock='cohamy_import_lock_'.$token;
    if (!add_option($lock,time(),'','no')) {
        if ((int)get_option($lock)>time()-300) return new \WP_Error('job_busy','Batch đang chạy.',['status'=>409]);
        delete_option($lock);
        if (!add_option($lock,time(),'','no')) return new \WP_Error('job_busy','Batch đang chạy.',['status'=>409]);
    }
    try {
        if (!empty($job['done'])) return response(array_diff_key($job,array_flip(['file','uid','seen','options','offset','delimiter'])));
        $file=fopen($job['file'],'rb');
        if (!$file) return new \WP_Error('job_file_missing','File tạm không còn; preview file lại.',['status'=>410]);
        fseek($file,$job['offset']); $count=0;
        while ($count<25 && ($cells=fgetcsv($file,0,$job['delimiter'],'"',''))!==false) {
            if ($cells===[null]) continue;
            $count++; $job['cursor']++;
            try {
                if (count($cells)!==23) throw new \InvalidArgumentException('Sai số cột.');
                $row=validate_import_row(array_combine(HEADERS,$cells),$job['options'],$job['seen']);
                $result=import_row($row,$job['options']); $job[$result['action']]++;
            } catch (\Throwable $error) { $job['failed']++; $job['errors'][]=['row'=>$job['cursor']+1,'reason'=>$error->getMessage()]; }
            $job['offset']=ftell($file);
        }
        $job['done']=$job['cursor']>=$job['total']; fclose($file);
        set_transient($key,$job,HOUR_IN_SECONDS);
        if ($job['done']) @unlink($job['file']);
        return response(['token'=>$token,'cursor'=>$job['cursor'],'total'=>$job['total'],'done'=>$job['done'],'created'=>$job['created'],'updated'=>$job['updated'],'failed'=>$job['failed'],'errors'=>$job['errors']]);
    } finally { delete_option($lock); }
}
add_action('cohamy_cleanup_import',function ($filename) {
    // Only remove our own temporary file within the resolved temp directory.
    $resolved=realpath($filename); $root=realpath(get_temp_dir());
    if ($resolved && $root && str_starts_with($resolved,$root.DIRECTORY_SEPARATOR) && str_starts_with(basename($resolved),'cohamy-csv-')) unlink($resolved);
});

add_action('rest_api_init',function () {
    $permission=function () { return current_user_can('edit_posts'); };
    register_rest_route('cohamy/v1','/import/preview',['methods'=>'POST','permission_callback'=>$permission,'callback'=>__NAMESPACE__.'\\preview_import']);
    register_rest_route('cohamy/v1','/import/batch',['methods'=>'POST','permission_callback'=>$permission,'callback'=>__NAMESPACE__.'\\import_batch']);
    register_rest_route('cohamy/v1','/export',['methods'=>'GET','permission_callback'=>function () { return current_user_can('manage_options'); },'callback'=>function ($request) {
        global $wpdb;
        $where='post_id>0';
        if($request['legacy_ids']){$keys=json_decode((string)$request['legacy_ids'],true);if(!is_array($keys)||count($keys)>100 || !$keys)return op_error('Chọn 1–100 legacy ID.');$keys=array_map(fn($id)=>hash('sha256',(string)$id),$keys);$where.=$wpdb->prepare(' AND legacy_key IN ('.implode(',',array_fill(0,count($keys),'%s')).')',...$keys);}
        if($request['wp_id'])$where.=$wpdb->prepare(' AND post_id=%d',(int)$request['wp_id']);
        if($request['after'])$where.=$wpdb->prepare(' AND post_id>%d',(int)$request['after']);$limit=$request['page_size']?' LIMIT '.max(1,min(500,(int)$request['page_size'])):'';
        $ids=$wpdb->get_col("SELECT post_id FROM {$wpdb->prefix}cohamy_identity WHERE $where ORDER BY post_id $limit");if($wpdb->last_error)return op_error('Không đọc được export dữ liệu.',503);
        $rows=[]; foreach ($ids as $id) if (get_post($id)) {
            $row=row_for((int)$id); $row['seo_title']=(string)get_post_meta($id,'rank_math_title',true); $row['seo_description']=(string)get_post_meta($id,'rank_math_description',true);
            $row['content_html']=get_post($id)->post_content; $row['wp_status']=get_post_status($id); $row['wp_id']=(int)$id; $rows[]=$row;
        }
        return response(['revision'=>revision(),'rows'=>$rows,'last_id'=>$ids ? (int)end($ids) : 0]);
    }]);
});
