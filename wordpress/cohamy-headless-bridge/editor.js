(function (wp) {
  "use strict";
  const e = wp.element.createElement;
  const { TextControl, SelectControl, CheckboxControl, Button, Notice } = wp.components;
  const Panel = wp.editor.PluginDocumentSettingPanel || wp.editPost.PluginDocumentSettingPanel;
  function Settings() {
    const [error, setError] = wp.element.useState("");
    const [records,setRecords]=wp.element.useState([]);
    wp.element.useEffect(()=>{wp.apiFetch({path:'/cohamy/v1/editor-records'}).then(data=>setRecords(data.items)).catch(failure=>setError(failure.message || 'Không tải được dữ liệu tham chiếu.'));},[]);
    const edited = wp.data.useSelect((select) => ({
      id: select("core/editor").getCurrentPostId(),
      title: select("core/editor").getEditedPostAttribute("title"),
      meta: select("core/editor").getEditedPostAttribute("meta") || {},
      categories: select("core/editor").getEditedPostAttribute("categories") || [],
    }), []);
    const update = (key, value) => wp.data.dispatch("core/editor").editPost({ meta: { ...edited.meta, ["_cohamy_" + key]: value } });
    wp.element.useEffect(() => {
      if (!edited.id) return;
      const defaults = {};
      if (!edited.meta._cohamy_locale) defaults._cohamy_locale = "en";
      if (!edited.meta._cohamy_group_id) defaults._cohamy_group_id = "wp-" + edited.id;
      if (!edited.meta._cohamy_legacy_id) defaults._cohamy_legacy_id = "wp-" + edited.id;
      if (!edited.meta._cohamy_author) defaults._cohamy_author = "Cohamy Editorial";
      if (Object.keys(defaults).length) wp.data.dispatch("core/editor").editPost({ meta: { ...edited.meta, ...defaults } });
      if (!cohamyEditor.categories.some((category) => edited.categories.includes(category.value))) wp.data.dispatch("core/editor").editPost({ categories: [cohamyEditor.categories[0].value] });
    }, [edited.id]);
    const locale = edited.meta._cohamy_locale || "en";
    const slug = edited.meta._cohamy_public_slug || "";
    const url = cohamyEditor.publicUrl + "/" + locale + (cohamyEditor.type === "page" ? (locale === "vi" ? "/noi-dung/" : "/pages/") : (locale === "vi" ? "/bai-viet/" : "/blog/")) + slug;
    wp.element.useEffect(() => {
      try { const store = wp.data.dispatch("rank-math"); if (store && store.updatePermalink && slug) store.updatePermalink(url); } catch { /* Rank Math loads its editor store asynchronously. */ }
    }, [url, slug]);
    async function preview() {
      setError("");
      try {
        await wp.data.dispatch("core/editor").savePost();
        if (wp.data.select("core/editor").didPostSaveRequestFail()) throw new Error("Hãy sửa lỗi lưu bài trước khi xem.");
        const result = await wp.apiFetch({ path: "/cohamy/v1/preview-token", method: "POST", data: { id: edited.id } });
        window.location.assign(result.url);
      } catch (failure) { setError(failure.message || "Không thể mở preview."); }
    }
    return e(Panel, { name: "cohamy", title: "Cohamy — Ngôn ngữ và URL", initialOpen: true },
      e(SelectControl, { label: "Ngôn ngữ", value: locale, options: [{ label: "Tiếng Việt", value: "vi" }, { label: "English", value: "en" }, { label: "中文", value: "zh" }, { label: "한국어", value: "ko" }, { label: "日本語", value: "ja" }], onChange: (value) => update("locale", value) }),
      e(TextControl, { label: "Nhóm bản dịch (group_id)", value: edited.meta._cohamy_group_id || "", help: "Dùng cùng ID cho các bản dịch; mỗi nhóm chỉ có một bài cho mỗi ngôn ngữ.", onChange: (value) => update("group_id", value) }),
      e(TextControl, { label: "Public slug", value: slug, help: "Không dùng slug nội bộ WordPress. Cùng slug ở các ngôn ngữ khác nhau được phép.", onChange: (value) => update("public_slug", value) }),
      e(Button, { variant: "secondary", onClick: () => update("public_slug", String(edited.title || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")) }, "Tạo slug từ tiêu đề"),
      e("p", null, e("code", null, url)),
      e(SelectControl, { label: "Danh mục Cohamy", value: edited.categories[0] || cohamyEditor.categories[0].value, options: cohamyEditor.categories, onChange: (value) => wp.data.dispatch("core/editor").editPost({ categories: [Number(value)] }) }),
      e(TextControl, { label: "Tác giả hiển thị", value: edited.meta._cohamy_author || "", onChange: (value) => update("author", value) }),
      ...['country','topic','subject','location'].map(kind=>{const current=edited.meta['_cohamy_'+kind+'_id'] || '';const options=records.filter(r=>r.type===kind).map(r=>({label:r.name,value:r.entity_id}));if(current&&!options.some(r=>r.value===current))options.unshift({label:current+' (ID đang lưu)',value:current});return e('div',{key:kind},e(SelectControl,{label:({country:'Quốc gia',topic:'Chủ đề',subject:'Đối tượng',location:'Địa điểm'})[kind],value:current,options:[{label:'Không chọn',value:''},...options],onChange:value=>update(kind+'_id',value)}),e(TextControl,{label:'Stable ID '+kind,value:current,help:'Có thể nhập ID đã duyệt nếu dữ liệu vượt danh sách 500 lựa chọn.',onChange:value=>update(kind+'_id',value)}));}),
      e(CheckboxControl, { label: "Bài nổi bật", checked: edited.meta._cohamy_featured === "TRUE", onChange: (value) => update("featured", value ? "TRUE" : "FALSE") }),
      e("label", null, "Sản phẩm liên quan (Ctrl/Cmd để chọn nhiều)", e("select", { multiple: true, style: { width: "100%", minHeight: "140px" }, value: (edited.meta._cohamy_related_product_ids || "").split(",").filter(Boolean), onChange: (event) => update("related_product_ids", Array.from(event.target.selectedOptions).map((option) => option.value).join(",")) }, cohamyEditor.products.map((product) => e("option", { key: product.id, value: product.id }, product.label)))),
      e("p", null, "Chọn ảnh đại diện/ALT trong Thư viện. Tags và ngày xuất bản dùng các panel WordPress. SEO title, mô tả, từ khóa chính và gợi ý dùng Rank Math."),
      e("p", null, "Hỗ trợ paragraph, heading, list, image, gallery, quote, table, video, CTA, separator, reusable block và HTML được làm sạch. Embed chỉ hỗ trợ YouTube/Vimeo HTTPS. Block khác báo lỗi khi lưu."),
      error ? e(Notice, { status: "error", isDismissible: false }, error) : null,
      e(Button, { variant: "primary", onClick: preview }, "Lưu và xem trên giao diện Cohamy")
    );
  }
  wp.plugins.registerPlugin("cohamy-settings", { render: Settings });
})(window.wp);
