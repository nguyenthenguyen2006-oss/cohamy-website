(function () {
  'use strict';
  const root = document.getElementById('cohamy-operations'); if (!root) return;
  const config = window.cohamyOperations; let previewSignature = ''; let aiDraft = ''; let bulkPreview = null; let bulkSignature = ''; let transferToken = ''; let transferSignature = ''; const pages = {};
  const msg = root.querySelector('#cohamy-message');let indexnowPreview='';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const list = value => String(value || '').split(',').map(v => v.trim()).filter(Boolean);
  function message(text, error = false) { msg.textContent = text; msg.dataset.error = String(error); }
  async function api(path, data, method) {
    const response = await fetch(config.root + path, {method: method || (data ? 'POST' : 'GET'), credentials:'same-origin', signal:AbortSignal.timeout(60000), headers:{'X-WP-Nonce':config.nonce,'Content-Type':'application/json'}, body:data ? JSON.stringify(data) : undefined});
    const result = await response.json(); if (!response.ok) throw new Error(result.message || result.errors?.map(e => e.error).join('; ') || `HTTP ${response.status}`); return result;
  }
  function table(target, rows, actions) {
    const el = root.querySelector(`[data-results="${target}"]`); if (!el) return;
    if (!rows.length) { el.textContent='Chưa có dữ liệu phù hợp.'; return; }
    const keys = Object.keys(rows[0]).filter(k => !['payload','manifest','before_json','after_json'].includes(k));
    el.innerHTML='<table class="widefat striped"><thead><tr>'+keys.map(k=>'<th scope="col">'+esc(k)+'</th>').join('')+(actions?'<th scope="col">Thao tác</th>':'')+'</tr></thead><tbody>'+rows.map((row,i)=>'<tr>'+keys.map(k=>'<td>'+esc(typeof row[k]==='object'?JSON.stringify(row[k]):row[k])+'</td>').join('')+(actions?'<td>'+actions(row,i)+'</td>':'')+'</tr>').join('')+'</tbody></table>';
  }
  async function refresh(kind) {
    if (kind==='content') {
      const params = new URLSearchParams(); for (const [key,value] of new FormData(root.querySelector('[data-operation="content-filter"]'))) if(value) params.set(key,value); params.set('page',String(pages.content || 1));
      const data=await api('content?'+params); table(kind,data.items,row=>'<a class="button" href="'+esc(row.editor_url)+'">Gutenberg / revisions</a> <button class="button" type="button" data-duplicate="'+esc(row.wp_id)+'">Nhân bản draft</button> <button class="button" type="button" data-analyze="'+esc(row.wp_id)+'">Phân tích Rank Math</button>'+(row.indexable?'<a href="'+esc(row.canonical)+'" target="_blank" rel="noopener">Public</a>':'')); pager(kind,data.page,data.total,25); return;
    }
    if (kind==='record' || kind==='template') {
      const q=root.querySelector(`[data-search="${kind}"]`).value; const data=await api('entities?kind='+kind+'&page='+(pages[kind] || 1)+'&q='+encodeURIComponent(q));
      table(kind,data.items,(row,i)=>'<button class="button" type="button" data-edit-entity="'+i+'" data-kind="'+kind+'">Chỉnh sửa</button>');
      root.querySelectorAll(`[data-edit-entity][data-kind="${kind}"]`).forEach(button=>button.addEventListener('click',()=>{
        const row=data.items[Number(button.dataset.editEntity)]; const form=root.querySelector(`[data-operation="${kind}"]`);
        for (const key of ['entity_id','name','version','state']) form.elements[key].value=row[key];
        if (kind==='template') form.elements.payload.value=JSON.stringify(row.payload,null,2); else { form.elements.type.value=row.payload.type; form.elements.fields.value=JSON.stringify(row.payload.fields,null,2); for(const key of ['reference_source','reference_date','expires_at']) form.elements[key].value=row.payload[key] || ''; }
        form.scrollIntoView({block:'start'}); message('Đang chỉnh '+row.entity_id+'; lưu kiểm tra version trên server.');
      })); pager(kind,data.page,data.total,25); return;
    }
    if (kind==='campaigns') {
      const data=await api('campaigns?page='+(pages[kind] || 1)); const rows=data.map(c=>({campaign_id:c.campaign_id,name:c.payload.name,state:c.state,progress:c.progress}));
      table(kind,rows,row=>'<button type="button" class="button" data-campaign-details="'+esc(row.campaign_id)+'" data-detail-page="1">Kết quả / links</button> '+['pause','resume','stop','retry','rollback-preview'].map(action=>'<button type="button" class="button" data-campaign="'+esc(row.campaign_id)+'" data-action="'+action+'">'+esc(action)+'</button>').join(' ')); pageWindow(kind,data.length,25);return;
    }
    if (kind==='exports') { const rows=await api('exports?page='+(pages[kind] || 1)); table(kind,rows,row=>row.state==='completed'?'<a class="button" href="'+esc(config.root+'exports/'+row.job_id+'/download?_wpnonce='+config.nonce)+'">Tải ZIP ('+esc(row.total)+' URL)</a>':esc(row.state)); pageWindow(kind,rows.length,25);return; }
    if(kind==='audit'){const rows=await api('audit?page='+(pages[kind] || 1));table(kind,rows,row=>'<details><summary>Xem trước / sau</summary><pre>'+esc(JSON.stringify({before:JSON.parse(row.before_json),after:JSON.parse(row.after_json)},null,2))+'</pre></details>');pageWindow(kind,rows.length,50);return;}
    if(kind==='ai-jobs'){const jobs=await api('ai/jobs?page='+(pages[kind] || 1));table(kind,jobs.map(j=>({job_id:j.job_id,state:j.state,attempts:j.attempts,heartbeat:j.heartbeat,error:j.error || '',post_id:j.input.post_id})),row=>'<button type="button" class="button" data-ai-job="'+esc(row.job_id)+'">Mở kết quả / diff</button>');pageWindow(kind,jobs.length,25);return;}
    if(kind==='imports'){const jobs=await api('imports?page='+(pages[kind] || 1));table(kind,jobs,row=>'<button type="button" class="button" data-import-job="'+esc(row.job_id)+'">Mở trạng thái / preview</button>');pageWindow(kind,jobs.length,25);return;}
    if(['redirects','404'].includes(kind)){const params=new URLSearchParams();const form=root.querySelector('[data-operation="'+kind+'-filter"]');if(form)for(const [key,value] of new FormData(form))if(value)params.set(key,value);params.set('page',String(pages[kind] || 1));const rows=await api(kind+'?'+params);table(kind,rows,kind==='redirects'?row=>'<button type="button" class="button" data-toggle-redirect="'+esc(JSON.stringify({...row,enabled:!Number(row.enabled)}))+'">'+(Number(row.enabled)?'Tắt':'Bật')+'</button>':undefined);pageWindow(kind,rows.length,50);return;}
    const data=await api(kind+(['redirects','404','audit','indexnow'].includes(kind)?'?page='+(pages[kind] || 1):'')); table(kind,Array.isArray(data)?data:[data]);if(Array.isArray(data))pageWindow(kind,data.length,kind==='indexnow'?100:50);
  }
  function pageWindow(kind,count,size){const page=pages[kind] || 1;pager(kind,page,(page-1)*size+count+(count===size?1:0),size);}
  function pager(kind,page,total,size) {
    let el=root.querySelector(`[data-pager="${kind}"]`); if(!el) {el=document.createElement('p');el.dataset.pager=kind;root.querySelector(`[data-results="${kind}"]`).after(el);}
    const count=Math.max(1,Math.ceil(total/size));const windowed=['campaigns','exports','imports','redirects','404','audit','indexnow','ai-jobs'].includes(kind);el.innerHTML='<button type="button" class="button" data-page="'+esc(kind)+'" data-next="'+Math.max(1,page-1)+'" '+(page<=1?'disabled':'')+'>Trang trước</button> '+(windowed?'Trang '+esc(page):esc(page)+' / '+count+' ('+esc(total)+' kết quả)')+' <button type="button" class="button" data-page="'+esc(kind)+'" data-next="'+(page+1)+'" '+(page>=count?'disabled':'')+'>Trang sau</button>';
  }
  root.querySelectorAll('[data-panel]').forEach(button=>button.addEventListener('click',async()=>{
    root.querySelectorAll('[data-view]').forEach(el=>el.hidden=el.dataset.view!==button.dataset.panel); root.querySelectorAll('[data-panel]').forEach(el=>el.classList.toggle('nav-tab-active',el===button));
    const kinds={content:['content'],transfer:['imports'],records:['record'],templates:['template'],campaigns:['campaigns'],exports:['exports'],redirects:['redirects','404'],connections:['connections','indexnow'],ai:['ai-jobs'],status:['status','queue','audit']};
    try { for(const kind of kinds[button.dataset.panel] || []) await refresh(kind); message('Đã đọc dữ liệu từ server.'); } catch(error) { message(error.message,true); }
  }));
  root.addEventListener('click',async event=>{
    const button=event.target.closest('button'); if (!button) return;
    try {
      if(button.dataset.refresh) await refresh(button.dataset.refresh);
      if(button.dataset.campaignDetails){const page=Number(button.dataset.detailPage);const c=await api('campaigns/'+button.dataset.campaignDetails+'?page='+page);root.querySelector('[data-preview="campaign"]').textContent=JSON.stringify(c.progress,null,2);let output=root.querySelector('[data-results="campaign-items"]');if(!output){output=document.createElement('div');output.dataset.results='campaign-items';root.querySelector('[data-preview="campaign"]').after(output);}table('campaign-items',c.items,row=>(row.editor_url?'<a href="'+esc(row.editor_url)+'">Gutenberg</a> ':'')+(row.public_url?'<a href="'+esc(row.public_url)+'" target="_blank" rel="noopener">Public</a>':''));let nav=root.querySelector('[data-campaign-nav]');if(!nav){nav=document.createElement('p');nav.dataset.campaignNav='';output.after(nav);}nav.innerHTML=[page>1?page-1:null,page*100<c.items_total?page+1:null].filter(Boolean).map(p=>'<button type="button" class="button" data-campaign-details="'+esc(c.campaign_id)+'" data-detail-page="'+p+'">Trang kết quả '+p+'</button>').join(' ');}
      if(button.dataset.toggleRedirect){await api('redirects',JSON.parse(button.dataset.toggleRedirect));await refresh('redirects');message('Đã lưu trạng thái redirect.');}
      if(button.dataset.aiJob){const j=await api('ai/jobs/'+button.dataset.aiJob);root.querySelector('[data-preview="ai"]').textContent=JSON.stringify(j,null,2);aiDraft=j.result?.apply_allowed===false?'':j.result?.draft_id || '';root.querySelector('[data-ai-apply]').disabled=!aiDraft;}
      if(button.dataset.importJob){const j=await api('imports/'+button.dataset.importJob);const output=root.querySelector('[data-preview="transfer"]');output.textContent=JSON.stringify(j,null,2);root.querySelector('[data-confirm-import]')?.remove();if(j.state==='previewed'){const commit=document.createElement('button');commit.type='button';commit.className='button button-primary';commit.dataset.confirmImport=j.token;commit.textContent='Xác nhận ghi '+j.valid+' dòng từ preview đang hiển thị';output.after(commit);}}
      if(button.dataset.confirmImport){const form=root.querySelector('[data-operation="transfer"]');await api('imports/start',{token:button.dataset.confirmImport,confirmed:true,skip_invalid:form.elements.skip_invalid.checked});button.remove();await refresh('imports');message('Đã xác nhận; cron tiếp tục ghi dữ liệu.');}
      if(button.dataset.transferExample) {
        if(button.dataset.transferExample==='record') download('cohamy-records.csv','\uFEFFsep=;\r\nentity_id;name;type;state;fields_json;reference_source;reference_date;expires_at\r\nlocal-location-1;Địa điểm mẫu;location;draft;"{""slug"":""dia-diem-mau""}";https://cohamy.vn;2026-09-18;\r\n','text/csv;charset=utf-8');
        else download('cohamy-templates.json',JSON.stringify([{entity_id:'local-template-1',name:'Template mẫu',state:'draft',payload:{title:'Cohamy tại {{location.name}}',slug:'cohamy-{{location.slug}}',content_html:'<p>Cohamy tại {{location.name}}.</p>',seo_title:'Cohamy tại {{location.name}}',seo_description:'Tìm hiểu Cohamy tại {{location.name}}.',locale:'vi',category:'brand-story',required_variables:['location.name','location.slug']}}],null,2),'application/json');
      }
      if(button.dataset.entityExport) {let rows=[],page=1,data;do{data=await api('entities/export?kind='+button.dataset.entityExport+'&page='+page++);rows.push(...data.items);}while(rows.length<data.total && data.items.length);download('cohamy-'+button.dataset.entityExport+'.json',JSON.stringify(rows,null,2),'application/json');}
      if(button.hasAttribute('data-redirect-export')) {let rows=[],page=1,data;do{data=await api('redirects?page='+page++);rows.push(...data);}while(data.length===50);download('cohamy-redirects.json',JSON.stringify(rows,null,2),'application/json');}
      if(button.dataset.page) {pages[button.dataset.page]=Number(button.dataset.next);await refresh(button.dataset.page);}
      if(button.dataset.duplicate) {const data=await api('content/duplicate',{post_id:Number(button.dataset.duplicate)});message('Đã tạo bản sao draft ID '+data.wp_id);await refresh('content');}
      if(button.dataset.analyze) {const result=await api('analysis',{post_id:Number(button.dataset.analyze)});message(result.queued?'Đã đưa vào hàng đợi engine Rank Math thật; tải lại bảng sau khi cron chạy.':'Chưa phân tích: cần nhập từ khóa chính trong Rank Math.');}
      if(button.hasAttribute('data-gsc-history'))root.querySelector('[data-preview="connections"]').textContent=JSON.stringify(await api('gsc/history'),null,2);
      if(button.hasAttribute('data-queue-repair')){await api('queue/repair',{});await refresh('queue');message('Server đã kiểm tra hàng đợi. Lịch chạy tương lai được giữ nguyên.');}
      if(button.dataset.api) root.querySelector('[data-preview="'+(button.dataset.api.startsWith('ai/')?'ai':'connections')+'"]').textContent=JSON.stringify(await api(button.dataset.api,{}),null,2);
      if(button.dataset.campaign) {
        if(button.dataset.action==='rollback-preview') {
          const result=await api('campaigns/'+button.dataset.campaign+'/rollback',{}); root.querySelector('[data-preview="campaign"]').textContent=JSON.stringify(result,null,2);
          if(result.count && window.confirm('Đưa '+result.count+' bài thuộc campaign này về draft?')) await api('campaigns/'+button.dataset.campaign+'/rollback',{confirmed:true,mode:'draft'});
        } else await api('campaigns/'+button.dataset.campaign+'/control',{action:button.dataset.action}); await refresh('campaigns');
      }
      if(button.hasAttribute('data-ai-apply') && aiDraft) { await api('ai/apply',{draft_id:aiDraft,confirmed:true}); aiDraft=''; button.disabled=true; message('Đã áp dụng gợi ý vào bài WordPress.'); }
    } catch(error) { message(error.message,true); }
  });
  root.querySelectorAll('form[data-operation]').forEach(form=>form.addEventListener('submit',async event=>{
    event.preventDefault(); const operation=form.dataset.operation; const data=Object.fromEntries(new FormData(form)); const submit=event.submitter;
    form.querySelectorAll('button').forEach(b=>b.disabled=true); message('Đang kiểm tra / lưu trên server…');
    try {
      let result;
      if(operation==='transfer') {
        const upload=form.elements.file.files[0];const signature=JSON.stringify([upload?.name,upload?.size,upload?.lastModified,data.kind,data.mode,data.mapping,form.elements.preserve_state.checked]);
        if(submit.value==='preview') {JSON.parse(data.mapping);const body=new FormData(form);body.set('preserve_state',String(form.elements.preserve_state.checked));const r=await fetch(config.root+'imports/preview',{method:'POST',credentials:'same-origin',signal:AbortSignal.timeout(90000),headers:{'X-WP-Nonce':config.nonce},body});result=await r.json();if(!r.ok)throw new Error(result.message || 'Preview lỗi.');if(result.state==='validating'){root.querySelector('[data-preview="transfer"]').textContent=JSON.stringify(result,null,2);result=await pollInspection(result.job_id,root.querySelector('[data-preview="transfer"]'),'imports');}transferToken=result.token;transferSignature=signature;}
        else {if(!transferToken || signature!==transferSignature)throw new Error('Preview lại file/cấu hình hiện tại.');result=await api('imports/start',{token:transferToken,confirmed:true,skip_invalid:form.elements.skip_invalid.checked});transferToken='';await refresh('imports');}
        root.querySelector('[data-preview="transfer"]').textContent=JSON.stringify(result,null,2);
      }
      else if(operation==='content-filter') {pages.content=1; await refresh('content');}
      else if(operation==='content-bulk') {
        const input={ids:list(data.ids).map(Number),patch:JSON.parse(data.patch)};const signature=JSON.stringify(input);
        if(submit.value==='preview') {result=await api('content/bulk',input);bulkPreview=Object.fromEntries(result.results.filter(r=>r.ok).map(r=>[r.wp_id,r.hash]));bulkSignature=signature;}
        else {if(bulkSignature!==signature || !bulkPreview) throw new Error('Preview lại các ID và thay đổi hiện tại.');result=await api('content/bulk',{...input,hashes:bulkPreview,confirmed:true});bulkPreview=null;bulkSignature='';await refresh('content');}
        root.querySelector('[data-preview="bulk"]').textContent=JSON.stringify(result,null,2);
        if(result.failed) throw new Error(result.failed+' bài lỗi; xem kết quả từng dòng. Các bài thành công đã được lưu.');
      }
      else if(['redirects-filter','404-filter'].includes(operation)){const kind=operation.replace('-filter','');pages[kind]=1;await refresh(kind);}
      else if(operation==='inspect') {result=await api('inspect',data);const output=root.querySelector('[data-preview="inspect"]');output.textContent='Đang chạy trên cron: '+result.job_id;await pollInspection(result.job_id,output);}
      else if(operation==='links-scan'){result=await api('links',data);await pollInspection(result.job_id,root.querySelector('[data-preview="links"]'),'links');}
      else if(operation==='indexnow-submit'){
        const signature=JSON.stringify({...data,file:{name:data.file?.name,size:data.file?.size,lastModified:data.file?.lastModified}});const confirmed=event.submitter?.value==='queue';if(confirmed && indexnowPreview!==signature)throw new Error('Preview danh sách hiện tại trước khi đưa vào hàng đợi.');
        const body=new FormData(form);body.set('confirmed',String(confirmed));const response=await fetch(config.root+'indexnow/selection',{method:'POST',credentials:'same-origin',signal:AbortSignal.timeout(60000),headers:{'X-WP-Nonce':config.nonce},body});result=await response.json();root.querySelector('[data-preview="indexnow"]').textContent=JSON.stringify(result,null,2);if(!response.ok)throw new Error(result.message || JSON.stringify(result.errors));indexnowPreview=confirmed?'':signature;if(confirmed)await refresh('indexnow');
      }
      else if(operation==='record' || operation==='template') {
        const payload=operation==='record'?{type:data.type,fields:JSON.parse(data.fields),reference_source:data.reference_source,reference_date:data.reference_date,expires_at:data.expires_at}:JSON.parse(data.payload);
        result=await api('entities',{entity_id:data.entity_id,kind:operation,name:data.name,state:data.state,version:Number(data.version),payload}); form.elements.version.value=result.version; await refresh(operation);
      } else if(operation==='template-from-post') { result=await api('templates/from-post',data); await refresh('template'); }
      else if(operation==='campaign') {
        data.templates=list(data.templates); data.locations=list(data.locations); const signature=JSON.stringify(data);
        if(submit.value==='preview') { result=await api('campaigns/preview',data); previewSignature=result.valid?signature:''; }
        else { if(previewSignature!==signature) throw new Error('Preview lại cấu hình hiện tại trước khi xác nhận chạy.'); result=await api('campaigns',{...data,confirmed:true}); previewSignature=''; await refresh('campaigns'); }
        root.querySelector('[data-preview="campaign"]').textContent=JSON.stringify(result,null,2);
      } else if(operation==='export') { data.indexable_only=form.elements.indexable_only.checked; result=await api('exports',data); await refresh('exports'); }
      else if(operation==='redirect') { data.enabled=form.elements.enabled.checked; result=await api('redirects',data); await refresh('redirects'); }
      else if(operation.endsWith('-config')) {
        data.type=operation.replace('-config',''); if(data.type==='gsc') data.credentials=JSON.parse(data.credentials);
        if(data.type==='indexnow') { data.enabled=form.elements.enabled.checked; data.live_authorized=form.elements.live_authorized.checked; }
        result=await api('connections',data); for(const key of ['api_key','credentials']) if(form.elements[key]) form.elements[key].value=''; await refresh('connections');
      } else if(operation.startsWith('gsc-')) { result=await api('gsc/'+operation.replace('gsc-',''),data); root.querySelector('[data-preview="connections"]').textContent=JSON.stringify(result,null,2); }
      else if(operation==='ai-generate') { data.records=list(data.records); result=await api('ai/jobs',data);const output=root.querySelector('[data-preview="ai"]');output.textContent='Job AI đã lưu: '+result.job_id;result=await pollInspection(result.job_id,output,'ai/jobs');aiDraft=result.result?.apply_allowed===false?'':result.result?.draft_id || '';root.querySelector('[data-ai-apply]').disabled=!aiDraft; }
      message('Hoàn tất: dữ liệu đã được server xác nhận.');
    } catch(error) { message(error.message,true); } finally { form.querySelectorAll('button').forEach(b=>b.disabled=false); }
  }));
  async function pollInspection(id,output,path='inspect') {
    const end=Date.now()+120000;
    while(Date.now()<end) {const data=await api(path+'/'+id);output.textContent=JSON.stringify(data,null,2);if(data.state==='completed' || (path==='imports' && data.state==='previewed')) return data;if(['failed','missing_data'].includes(data.state))throw new Error(data.error || data.result?.error || 'Dữ liệu thiếu: xem kết quả job.');await new Promise(resolve=>setTimeout(resolve,2000));}
    throw new Error('Inspection đang chờ cron. Job vẫn lưu trên server; kiểm tra Trạng thái / Scheduled Actions.');
  }
  function download(name,text,type) {const url=URL.createObjectURL(new Blob([text],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  root.querySelectorAll('input,select,textarea').forEach(input=>{const label=input.closest('label');if(label&&!input.getAttribute('aria-label')) {const name=Array.from(label.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent.trim()).join(' ').trim();if(name)input.setAttribute('aria-label',name);}});
  root.querySelector('[data-panel="records"]').click();
})();

