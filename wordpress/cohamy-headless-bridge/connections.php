<?php
namespace Cohamy;
defined('ABSPATH') || exit;
function provider_evidence(): string {return PHP_SAPI==='cli' && defined('COHAMY_PROVIDER_CONTRACT_MOCK') && COHAMY_PROVIDER_CONTRACT_MOCK ? 'CONTRACT_MOCK' : 'LIVE_API';}

function connection_http(string $url,array $args=[]): array {
    if (!preg_match('~^https://~',$url) || !wp_http_validate_url($url)) throw new \RuntimeException('URL kết nối HTTPS không an toàn.');
    $result=wp_remote_request($url,array_merge(['timeout'=>20,'redirection'=>0,'limit_response_size'=>2*1024*1024],$args));
    if (is_wp_error($result)) throw new \RuntimeException('Kết nối thất bại: '.$result->get_error_code());
    return ['status'=>wp_remote_retrieve_response_code($result),'body'=>wp_remote_retrieve_body($result),'retry_after'=>wp_remote_retrieve_header($result,'retry-after')];
}
function index_event(string $url,string $kind='updated'): void {
    global $wpdb;
    if (!get_option('cohamy_indexnow_enabled')) return;
    safe_path($url); $key=hash('sha256',$url);
    $old=$wpdb->get_row($wpdb->prepare('SELECT * FROM '.op_table('index_event').' WHERE event_key=%s',$key),ARRAY_A);
    $data=['event_key'=>$key,'generation'=>wp_generate_uuid4(),'kind'=>$kind==='deleted'?'deleted':'updated','url'=>$url,'state'=>'queued','attempts'=>0,'next_attempt'=>time(),'http_code'=>0,'error'=>'','created'=>time()];
    $saved=$old ? $wpdb->update(op_table('index_event'),$data,['event_key'=>$key]) : $wpdb->insert(op_table('index_event'),$data);
    if($saved===false)throw new \RuntimeException('Không ghi được sự kiện IndexNow.');
    if (function_exists('as_schedule_single_action') && !as_get_scheduled_actions(['hook'=>'cohamy_indexnow_tick','status'=>'pending','group'=>'cohamy','per_page'=>1],'ids')) as_schedule_single_action(time()+2,'cohamy_indexnow_tick',[],'cohamy',false,40);
}
function indexnow_tick(): void {
    global $wpdb; if (!get_option('cohamy_indexnow_enabled') || !get_option('cohamy_indexnow_live_authorized')) return;
    $owner=op_lease('cohamy_indexnow_lock',120);if(!$owner)return;
    try {
        $events=$wpdb->get_results($wpdb->prepare('SELECT * FROM '.op_table('index_event')." WHERE state='queued' AND next_attempt<=%d ORDER BY next_attempt LIMIT 10000",time()),ARRAY_A); if (!$events) return;
        $key=(string)get_option('cohamy_indexnow_key'); $host=wp_parse_url(public_base(),PHP_URL_HOST); $keyurl=public_base().'/indexnow/'.$key.'.txt';
        $verify=connection_http($keyurl); if ($verify['status']!==200 || trim($verify['body'])!==$key) throw new \RuntimeException('Key IndexNow chưa đọc được trên public host.');
        $result=connection_http('https://api.indexnow.org/indexnow',['method'=>'POST','headers'=>['Content-Type'=>'application/json'],'body'=>wp_json_encode(['host'=>$host,'key'=>$key,'keyLocation'=>$keyurl,'urlList'=>array_column($events,'url')])]);
        foreach ($events as $event) {
            $attempt=(int)$event['attempts']+1; $ok=in_array($result['status'],[200,202],true); $delay=is_numeric($result['retry_after']) ? (int)$result['retry_after'] : (strtotime((string)$result['retry_after']) ?: 0)-time();
            $wpdb->update(op_table('index_event'),['state'=>$ok ? 'accepted_not_indexed' : ($attempt>=8 ? 'failed' : 'queued'),'attempts'=>$attempt,'http_code'=>$result['status'],'next_attempt'=>time()+max(30,min(86400,max($delay,30*(2**min($attempt,10))))),'error'=>(provider_evidence()==='CONTRACT_MOCK'?'CONTRACT_MOCK transport; ':'').($ok ? '' : 'HTTP '.$result['status'])],['event_key'=>$event['event_key'],'generation'=>$event['generation']]);
        }
    } catch (\Throwable $e) {
        foreach ($events ?? [] as $event) { $attempt=(int)$event['attempts']+1; $wpdb->update(op_table('index_event'),['attempts'=>$attempt,'state'=>$attempt>=8 ? 'failed' : 'queued','next_attempt'=>time()+min(86400,60*(2**min($attempt,10))),'error'=>$e->getMessage()],['event_key'=>$event['event_key'],'generation'=>$event['generation']]); }
        error_log('Cohamy IndexNow: '.$e->getMessage());
    } finally {
        op_release('cohamy_indexnow_lock',$owner); $due=$wpdb->get_var('SELECT MIN(next_attempt) FROM '.op_table('index_event')." WHERE state='queued'");
        if ($due) as_schedule_single_action(max(time()+2,(int)$due),'cohamy_indexnow_tick',[],'cohamy',false,40);
    }
}
add_action('cohamy_indexnow_tick',__NAMESPACE__.'\\indexnow_tick');
function gsc_token(): string {
    $cached=get_transient('cohamy_gsc_access_token'); if ($cached) return (string)$cached;
    $credentials=get_option('cohamy_gsc_credentials'); if (!$credentials) throw new \RuntimeException('Chưa kết nối Google Search Console.');
    $b64=function ($v) { return rtrim(strtr(base64_encode(wp_json_encode($v)),'+/','-_'),'='); };
    $input=$b64(['alg'=>'RS256','typ'=>'JWT']).'.'.$b64(['iss'=>$credentials['client_email'],'scope'=>'https://www.googleapis.com/auth/webmasters','aud'=>'https://oauth2.googleapis.com/token','iat'=>time(),'exp'=>time()+3600]);
    if (!openssl_sign($input,$signature,$credentials['private_key'],OPENSSL_ALGO_SHA256)) throw new \RuntimeException('Service account private key không hợp lệ.');
    $jwt=$input.'.'.rtrim(strtr(base64_encode($signature),'+/','-_'),'=');
    $r=connection_http('https://oauth2.googleapis.com/token',['method'=>'POST','body'=>['grant_type'=>'urn:ietf:params:oauth:grant-type:jwt-bearer','assertion'=>$jwt]]); $data=json_decode($r['body'],true);
    if ($r['status']!==200 || empty($data['access_token'])) throw new \RuntimeException('Google từ chối xác thực service account: HTTP '.$r['status']);
    set_transient('cohamy_gsc_access_token',$data['access_token'],max(60,(int)$data['expires_in']-120)); return $data['access_token'];
}
function gsc_request(string $url,array $data=[],string $method='POST'): array {
    $r=connection_http($url,['method'=>$method,'headers'=>['Authorization'=>'Bearer '.gsc_token(),'Content-Type'=>'application/json'],'body'=>$method==='GET' ? null : wp_json_encode($data)]);
    if ($r['status']<200 || $r['status']>=300) throw new \RuntimeException('GSC API HTTP '.$r['status'].($r['status']===429 ? ': vượt quota; thử lại sau.' : ''));
    return json_decode($r['body'],true) ?: [];
}
function gsc_property(): string {
    $property=(string)get_option('cohamy_gsc_property'); $host=wp_parse_url(public_base(),PHP_URL_HOST);
    if ($property!=='sc-domain:'.$host && $property!==public_base().'/') throw new \RuntimeException('Property cần khớp chính xác website public Cohamy.'); return $property;
}
function ai_generate(array $input) {
    $config=get_option('cohamy_ai_config'); if (!$config || empty($config['api_key'])) return op_error('Chưa kết nối AI provider.',503);
    if(!in_array($input['task'] ?? 'draft',['draft','outline','seo','image_alt','faq','internal_link_suggestions'],true))return op_error('Task AI không được hỗ trợ.',422);
    $post_id=(int)($input['post_id'] ?? 0); if (!$post_id || !get_post($post_id))return op_error('Tạo hoặc chọn bài nháp WordPress trước khi dùng AI.',422);if (!current_user_can('edit_post',$post_id)) return op_error('Không có quyền sửa bài.',403);
    $facts=[]; foreach ((array)($input['records'] ?? []) as $id) {
        $record=entity_get($id); if (!$record || $record['state']!=='approved' || (!empty($record['payload']['expires_at']) && strtotime($record['payload']['expires_at'])<time())) return op_error('Nguồn dữ liệu thiếu/chưa duyệt/hết hạn: '.$id,422);
        $facts[]=['name'=>$record['name'],'fields'=>$record['payload']['fields'],'reference_source'=>$record['payload']['reference_source'] ?? '', 'reference_date'=>$record['payload']['reference_date'] ?? ''];
        if(empty($record['payload']['reference_source']) || empty($record['payload']['reference_date']))return response(['state'=>'missing_data','missing_fields'=>[$id.'.reference_source/reference_date']],422);
    }
    if (!$facts) return op_error('Chọn ít nhất một record đã duyệt. AI không tự bịa dữ liệu còn thiếu.',422);
    $lock='cohamy_ai_budget_lock';$owner=op_lease($lock,120);if(!$owner)return op_error('Một yêu cầu AI đang chạy.',409);
    try {
        $day=wp_date('Y-m-d');$usage_key=(provider_evidence()==='CONTRACT_MOCK'?'cohamy_ai_usage_contract_mock_':'cohamy_ai_usage_').$day; $usage=(array)get_option($usage_key,['tokens'=>0,'requests'=>0]); $max=min(4000,max(256,(int)($config['max_tokens'] ?? 2000)));
        $post=$post_id ? get_post($post_id) : null; $hash=$post ? editorial_hash($post_id) : '';
        $link_candidates=[];if(($input['task'] ?? '')==='internal_link_suggestions')foreach(public_query(['locale'=>meta($post_id,'locale','en'),'category'=>row_for($post_id)['category'],'exclude'=>meta($post_id,'legacy_id'),'page_size'=>6])['items'] as $candidate)if($candidate['robots_index'])$link_candidates[]=['title'=>$candidate['title'],'url'=>public_base().path_for($candidate['locale'],$candidate['slug'])];
        $system='Bạn viết nội dung cho Cohamy theo ngôn ngữ '.meta($post_id,'locale','vi').'. Chỉ dùng dữ liệu được cung cấp. Thiếu thông tin thì trả missing_fields, không suy đoán. Trả JSON object gồm title, excerpt, content_html (HTML paragraph/heading/list), seo_title, seo_description, focus_keyword, image_alt, missing_fields. Không tạo canonical, ID, script hoặc thông tin giá/lịch chưa có nguồn. '.$config['voice'];
        if(($input['task'] ?? '')==='faq')$system.=' Task faq: content_html chỉ chứa phần FAQ mới với câu hỏi và câu trả lời có nguồn; các field khác giữ theo current. Người dùng duyệt để nối FAQ vào cuối bài, không thay phần đang có.';
        if(($input['task'] ?? '')==='internal_link_suggestions')$system.=' Task internal_link_suggestions: thêm suggested_links là danh sách {url,anchor}; chỉ dùng đúng URL trong link_candidates. Đây là gợi ý để người dùng chèn trong Gutenberg; không tự sửa bài.';
        $prompt=wp_json_encode(['task'=>sanitize_text_field($input['task'] ?? 'draft'),'facts'=>$facts,'link_candidates'=>$link_candidates,'current'=>$post ? ['title'=>$post->post_title,'content_html'=>$post->post_content] : null]);
        if(strlen($prompt)>128*1024)return op_error('Nguồn và bài quá lớn cho một request AI (128 KB). Chọn ít nguồn hơn.',422);
        $reserved=strlen($system)+strlen($prompt)+$max+1024;
        if($usage['tokens']+$reserved>(int)$config['daily_token_budget'])return op_error('Không đủ ngân sách token hôm nay cho input và output dự phòng.',429);
        $usage['tokens']+=$reserved;$usage['requests']++;$usage['last_usage_source']='reserved_input_bytes_plus_output_estimate';update_option($usage_key,$usage,false);
        $result=connection_http($config['endpoint'].'/chat/completions',['method'=>'POST','headers'=>['Content-Type'=>'application/json','Authorization'=>'Bearer '.$config['api_key']],'body'=>wp_json_encode(['model'=>$config['model'],'temperature'=>0.3,'max_tokens'=>$max,'response_format'=>['type'=>'json_object'],'messages'=>[['role'=>'system','content'=>$system],['role'=>'user','content'=>$prompt]]])]);
        if ($result['status']!==200) { $delay=is_numeric($result['retry_after'])?(int)$result['retry_after']:max(30,(strtotime((string)$result['retry_after']) ?: 0)-time());op_audit('ai.error',(string)$post_id,null,['model'=>$config['model'],'http_status'=>$result['status'],'retry_after'=>$delay,'reserved_tokens'=>$reserved]);return new \WP_Error('cohamy_ai_provider','AI API HTTP '.$result['status'].'; chưa áp dụng nội dung.',['status'=>$result['status']===429?429:502,'retry_after'=>$delay]); }
        $data=json_decode($result['body'],true); $suggestion=json_decode($data['choices'][0]['message']['content'] ?? '',true);
        if (!is_array($suggestion)) throw new \RuntimeException('Provider trả dữ liệu không đúng JSON contract.');
        $used=max(0,(int)($data['usage']['total_tokens'] ?? $reserved)); $usage['tokens']+=($used-$reserved); $usage['last_usage_source']=provider_evidence()==='CONTRACT_MOCK' ? 'CONTRACT_MOCK' : (isset($data['usage']['total_tokens']) ? 'provider' : 'reserved_estimate'); update_option($usage_key,$usage,false);
        if (!empty($suggestion['missing_fields'])) return response(['state'=>'missing_data','missing_fields'=>$suggestion['missing_fields'],'usage'=>$usage],422);
        foreach (['title','content_html','seo_title','seo_description'] as $field) if (empty($suggestion[$field])) throw new \RuntimeException('AI thiếu field '.$field);
        $suggestion['content_html']=safe_content_html($suggestion['content_html']);
        if(($input['task'] ?? '')==='internal_link_suggestions'){foreach((array)($suggestion['suggested_links'] ?? []) as $link)if(!is_array($link) || !in_array($link['url'] ?? '',array_column($link_candidates,'url'),true) || empty($link['anchor']) || mb_strlen($link['anchor'])>200)return op_error('Provider gợi ý URL/anchor không thuộc danh sách nội bộ đã cung cấp.',422);$suggestion['link_candidates']=$link_candidates;}
        $id=wp_generate_uuid4();
        $draft=['actor'=>get_current_user_id(),'post_id'=>$post_id,'base_hash'=>$hash,'task'=>$input['task'] ?? 'draft','suggestion'=>$suggestion,'sources'=>$facts,'created'=>time()]; update_option('cohamy_ai_draft_'.$id,$draft,false);
        op_audit('ai.generate',$id,null,['model'=>$config['model'],'usage'=>$used,'post_id'=>$post_id]);
        return response(['draft_id'=>$id,'task'=>$input['task'] ?? 'draft','apply_allowed'=>($input['task'] ?? '')!=='internal_link_suggestions','apply_behavior'=>($input['task'] ?? '')==='faq'?'append_faq_preserve_existing':(($input['task'] ?? '')==='internal_link_suggestions'?'review_insert_in_gutenberg':'review_diff_before_apply'),'state'=>'preview','before'=>$post ? ['title'=>$post->post_title,'content_html'=>$post->post_content] : null,'after'=>$suggestion,'usage'=>$usage,'near_duplicates'=>near_duplicates($post_id,$suggestion['content_html'])]);
    } finally { op_release($lock,$owner); }
}
add_action('rest_api_init',function () {
    register_rest_route('cohamy/v1','/indexnow-key',['methods'=>'GET','permission_callback'=>'__return_true','callback'=>function () { return response(['key'=>(string)get_option('cohamy_indexnow_key'),'host'=>wp_parse_url(public_base(),PHP_URL_HOST)]); }]);
    op_route('connections','GET','cohamy_seo',function () { $ai=(array)get_option('cohamy_ai_config',[]); return response(['indexnow'=>['enabled'=>(bool)get_option('cohamy_indexnow_enabled'),'live_authorized'=>(bool)get_option('cohamy_indexnow_live_authorized'),'key_location'=>public_base().'/indexnow/'.get_option('cohamy_indexnow_key').'.txt'],'gsc'=>['connected'=>(bool)get_option('cohamy_gsc_credentials'),'property'=>get_option('cohamy_gsc_property') ?: ''],'ai'=>['connected'=>!empty($ai['api_key']),'model'=>$ai['model'] ?? '', 'endpoint'=>$ai['endpoint'] ?? '', 'daily_token_budget'=>$ai['daily_token_budget'] ?? 0]]); });
    op_route('connections','POST','manage_options',function ($r) {
        $input=$r->get_json_params(); $type=$input['type'] ?? '';
        if ($type==='indexnow') {
            if (!get_option('cohamy_indexnow_key')) update_option('cohamy_indexnow_key',bin2hex(random_bytes(16)),false);
            update_option('cohamy_indexnow_enabled',!empty($input['enabled']),false); update_option('cohamy_indexnow_live_authorized',!empty($input['live_authorized']),false);
        } elseif ($type==='gsc') {
            $credentials=(array)($input['credentials'] ?? []);
            if (($credentials['type'] ?? '')!=='service_account' || !preg_match('/@[^@]+\.iam\.gserviceaccount\.com$/D',$credentials['client_email'] ?? '') || !openssl_pkey_get_private($credentials['private_key'] ?? '')) return op_error('Cần JSON service account riêng Cohamy hợp lệ.');
            $property=(string)($input['property'] ?? ''); if (!in_array($property,[public_base().'/', 'sc-domain:'.wp_parse_url(public_base(),PHP_URL_HOST)],true)) return op_error('Property phải khớp website Cohamy.');
            update_option('cohamy_gsc_credentials',['client_email'=>$credentials['client_email'],'private_key'=>$credentials['private_key']],false); update_option('cohamy_gsc_property',$property,false); delete_transient('cohamy_gsc_access_token');
        } elseif ($type==='ai') {
            $endpoint=rtrim((string)($input['endpoint'] ?? ''),'/'); $allow=['https://api.openai.com/v1','https://api.deepseek.com'];
            if (!in_array($endpoint,$allow,true) || empty($input['model']) || empty($input['api_key'])) return op_error('Endpoint HTTPS được hỗ trợ: OpenAI / DeepSeek; cần model và key.');
            update_option('cohamy_ai_config',['endpoint'=>$endpoint,'model'=>sanitize_text_field($input['model']),'api_key'=>$input['api_key'],'voice'=>sanitize_textarea_field($input['voice'] ?? 'Giọng văn rõ ràng, không hứa hẹn sai sự thật.'),'daily_token_budget'=>max(1000,min(1000000,(int)($input['daily_token_budget'] ?? 10000))),'max_tokens'=>max(256,min(4000,(int)($input['max_tokens'] ?? 2000)))],false);
        } else return op_error('Loại kết nối không hợp lệ.');
        op_audit('connection.configure',$type,null,['type'=>$type,'configured'=>true]); return response(['saved'=>true]);
    });
    op_route('indexnow','GET','cohamy_seo',function ($r) { global $wpdb; return response($wpdb->get_results('SELECT * FROM '.op_table('index_event').' ORDER BY created DESC,event_key LIMIT 100 OFFSET '.(max(0,(int)$r['page']-1)*100),ARRAY_A)); });
    op_route('indexnow','POST','cohamy_seo',function ($r) {$r->set_param('confirmed',true);return indexnow_selection($r);});
    op_route('ai/connection-test','POST','manage_options',function(){
        $config=get_option('cohamy_ai_config');if(empty($config['api_key']))return op_error('Chưa kết nối AI provider.',503);
        $result=connection_http($config['endpoint'].'/models',['method'=>'GET','headers'=>['Authorization'=>'Bearer '.$config['api_key']]]);
        if($result['status']!==200)return op_error('Provider từ chối kiểm tra model: HTTP '.$result['status'],502);
        $data=json_decode($result['body'],true);$models=array_column($data['data'] ?? [],'id');$found=in_array($config['model'],$models,true);
        $test=['evidence'=>provider_evidence(),'checked_at'=>gmdate('c'),'model'=>$config['model'],'model_available'=>$found,'meaning'=>'model_list_verified_content_generation_not_tested'];update_option('cohamy_ai_connection_test',$test,false);return response($test,$found?200:422);
    });
    op_route('gsc/verify','POST','cohamy_seo',function () { if(!get_option('cohamy_gsc_credentials'))return op_error('Chưa kết nối Google Search Console.',503);$property=gsc_property(); $data=gsc_request('https://www.googleapis.com/webmasters/v3/sites',[],'GET'); foreach ($data['siteEntry'] ?? [] as $site) if ($site['siteUrl']===$property) {update_option('cohamy_gsc_verified',['property'=>$property,'permission'=>$site['permissionLevel'],'evidence'=>provider_evidence(),'verified_at'=>gmdate('c')],false);return response(['connected'=>true,'property'=>$property,'permission'=>$site['permissionLevel']]);} return op_error('Service account chưa được cấp quyền property Cohamy.',403); });
    op_route('gsc/analytics','POST','cohamy_seo',function ($r) {
        if(!get_option('cohamy_gsc_credentials'))return op_error('Chưa kết nối Google Search Console.',503);
        $start=(string)$r['start_date']; $end=(string)$r['end_date']; foreach ([$start,$end] as $date) if (!preg_match('/^\d{4}-\d\d-\d\d$/D',$date) || strtotime($date)===false) return op_error('Ngày cần YYYY-MM-DD.');
        $result=gsc_request('https://www.googleapis.com/webmasters/v3/sites/'.rawurlencode(gsc_property()).'/searchAnalytics/query',['startDate'=>$start,'endDate'=>$end,'dimensions'=>['page','query'],'rowLimit'=>min(25000,max(1,(int)($r['row_limit'] ?: 100))),'startRow'=>max(0,(int)$r['start_row'])]);update_option('cohamy_gsc_analytics',['property'=>gsc_property(),'start_date'=>$start,'end_date'=>$end,'start_row'=>(int)$r['start_row'],'evidence'=>provider_evidence(),'fetched_at'=>gmdate('c'),'data'=>$result],false);return response($result);
    });
    op_route('gsc/inspect','POST','cohamy_seo',function ($r) {
        if(!get_option('cohamy_gsc_credentials'))return op_error('Chưa kết nối Google Search Console.',503);
        global $wpdb; $url=public_base().safe_path((string)$r['url']); $key=hash('sha256',$url); $day=gmdate('Y-m-d');
        $quota_owner=op_lease('cohamy_gsc_quota',30);if(!$quota_owner)return op_error('Inspection quota đang được cập nhật; thử lại.',409);
        if ((int)get_option('cohamy_gsc_inspection_'.$day,0)>=200){op_release('cohamy_gsc_quota',$quota_owner);return op_error('Đạt quota nội bộ 200 inspection/ngày; quota Google có thể thấp hơn.',429);}
        update_option('cohamy_gsc_inspection_'.$day,(int)get_option('cohamy_gsc_inspection_'.$day,0)+1,false);
        op_release('cohamy_gsc_quota',$quota_owner);
        try { $result=gsc_request('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',['inspectionUrl'=>$url,'siteUrl'=>gsc_property(),'languageCode'=>'vi-VN']); $verdict=$result['inspectionResult']['indexStatusResult']['verdict'] ?? ''; $state=$verdict==='PASS' ? 'indexed' : ($verdict==='FAIL' || $verdict==='NEUTRAL' ? 'not_indexed' : 'unknown'); }
        catch (\Throwable $e) { $result=['error'=>$e->getMessage()]; $state='api_error'; }
        $row=['url_key'=>$key,'url'=>$url,'state'=>$state,'payload'=>wp_json_encode($result),'inspected'=>time()]; $wpdb->replace(op_table('inspection'),$row); return response($row,$state==='api_error' ? 502 : 200);
    });
    op_route('gsc/sitemap','POST','cohamy_seo',function () { if(!get_option('cohamy_gsc_credentials'))return op_error('Chưa kết nối Google Search Console.',503);$result=gsc_request('https://www.googleapis.com/webmasters/v3/sites/'.rawurlencode(gsc_property()).'/sitemaps/'.rawurlencode(public_base().'/sitemap.xml'),[],'PUT');update_option('cohamy_gsc_sitemap',['url'=>public_base().'/sitemap.xml','evidence'=>provider_evidence(),'submitted_at'=>gmdate('c'),'state'=>'api_accepted_not_indexed'],false);return response($result); });
    op_route('gsc/history','GET','cohamy_seo',function(){global $wpdb;return response(['property_verification'=>get_option('cohamy_gsc_verified') ?: null,'analytics'=>get_option('cohamy_gsc_analytics') ?: null,'sitemap'=>get_option('cohamy_gsc_sitemap') ?: null,'inspections'=>$wpdb->get_results('SELECT * FROM '.op_table('inspection').' ORDER BY inspected DESC LIMIT 100',ARRAY_A),'quota_today'=>(int)get_option('cohamy_gsc_inspection_'.gmdate('Y-m-d'),0)]);});
    op_route('ai/generate','POST','cohamy_seo',function ($r) { return ai_generate($r->get_json_params()); });
    op_route('ai/apply','POST','cohamy_seo',function ($r) {
        $id=(string)$r['draft_id']; if (!preg_match('/^[a-f0-9-]{36}$/D',$id)) return op_error('Draft ID không hợp lệ.'); $draft=get_option('cohamy_ai_draft_'.$id);
        if (!$draft || $draft['actor']!==get_current_user_id() || !$draft['post_id'] || !current_user_can('edit_post',$draft['post_id'])) return op_error('Không có quyền apply draft.',403);
        if (!$r['confirmed']) return op_error('Xác nhận diff trước khi apply.'); global $wpdb; $before=editorial_checkpoint();editorial_lock($draft['post_id']); $post=get_post($draft['post_id']);
        try{
            if (!hash_equals($draft['base_hash'],editorial_hash($draft['post_id']))) { editorial_rollback($before); return op_error('Bài đã được người dùng sửa. Không ghi đè; tạo bản gợi ý mới.',409); }
            $s=$draft['suggestion'];$task=$draft['task'] ?? 'draft';
            if($task==='internal_link_suggestions'){editorial_rollback($before);return op_error('Gợi ý liên kết đã lưu; người dùng duyệt và chèn trong Gutenberg. Chưa tự sửa bài.',422);}
            if($task==='faq'){$result=wp_update_post(wp_slash(['ID'=>$post->ID,'post_content'=>$post->post_content."\n".$s['content_html']]),true);if(is_wp_error($result))throw new \RuntimeException($result->get_error_message());}
            elseif($task==='image_alt') { $thumbnail=get_post_thumbnail_id($post->ID);if(!$thumbnail || empty($s['image_alt'])){editorial_rollback($before);return op_error('Chọn ảnh đại diện và gợi ý ALT trước khi áp dụng.',422);}update_post_meta($thumbnail,'_wp_attachment_image_alt',sanitize_text_field($s['image_alt'])); }
            else { $changes=['ID'=>$post->ID];if($task!=='seo')$changes=array_merge($changes,['post_title'=>sanitize_text_field($s['title']),'post_excerpt'=>sanitize_text_field($s['excerpt'] ?? ''),'post_content'=>$s['content_html']]);$result=wp_update_post(wp_slash($changes),true);if(is_wp_error($result))throw new \RuntimeException($result->get_error_message());update_post_meta($post->ID,'rank_math_title',sanitize_text_field($s['seo_title'])); update_post_meta($post->ID,'rank_math_description',sanitize_text_field($s['seo_description']));update_post_meta($post->ID,'rank_math_focus_keyword',sanitize_text_field($s['focus_keyword'] ?? '')); }
            editorial_commit();
        }catch(\Throwable $e){editorial_rollback($before);throw $e;}
        delete_option('cohamy_ai_draft_'.$id); op_audit('ai.apply',$id,['post_id'=>$post->ID,'base_hash'=>$draft['base_hash']],['post_id'=>$post->ID]); return response(['saved'=>true,'post_id'=>$post->ID]);
    });
});




