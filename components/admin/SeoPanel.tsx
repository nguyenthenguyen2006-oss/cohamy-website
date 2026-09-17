export function SeoPanel({
  initialSeoTitle,
  initialSeoDescription,
  robotsIndex,
}: {
  initialSeoTitle: string;
  initialSeoDescription: string;
  robotsIndex: boolean;
}) {
  return (
    <section className="admin-panel">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold">SEO và chia sẻ</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Nếu để trống, website dùng tiêu đề và mô tả ngắn của bài.
        </p>
      </div>
      <div className="space-y-4 p-5">
        <div className="space-y-2">
          <label htmlFor="seo_title" className="admin-label">
            SEO title
          </label>
          <input
            id="seo_title"
            name="seo_title"
            defaultValue={initialSeoTitle}
            maxLength={300}
            className="admin-input"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="seo_description" className="admin-label">
            Meta description
          </label>
          <textarea
            id="seo_description"
            name="seo_description"
            defaultValue={initialSeoDescription}
            rows={4}
            maxLength={1000}
            className="admin-textarea"
          />
        </div>
        <div className="space-y-2">
          <p className="admin-label">Canonical URL</p>
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
            Hệ thống tự tạo canonical trùng chính xác với URL công khai dựa
            trên ngôn ngữ và slug. Nhân viên không cần nhập thủ công.
          </p>
        </div>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            name="robots_index"
            type="checkbox"
            defaultChecked={robotsIndex}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-700 focus:ring-amber-600"
          />
          <span>
            Cho phép công cụ tìm kiếm index
            <span className="mt-0.5 block text-xs text-slate-500">
              Bỏ chọn sẽ tạo robots noindex, follow.
            </span>
          </span>
        </label>
      </div>
    </section>
  );
}
