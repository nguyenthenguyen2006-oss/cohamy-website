"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Eye,
  Save,
  Send,
} from "lucide-react";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { PostEditor } from "@/components/admin/PostEditor";
import { SeoPanel } from "@/components/admin/SeoPanel";
import {
  BLOG_CATEGORIES,
  BLOG_LOCALES,
  BLOG_STATUSES,
  type BlogRow,
} from "@/lib/blog-schema";

interface ProductOption {
  id: string;
  label: string;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/đ/gu, "d")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function datetimeLocal(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isoFromLocal(value: FormDataEntryValue | null): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return new Date(text).toISOString();
}

export function PostForm({
  initialPost,
  products,
}: {
  initialPost?: BlogRow;
  products: ProductOption[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const slugTouched = useRef(Boolean(initialPost));
  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [slug, setSlug] = useState(initialPost?.slug ?? "");
  const [content, setContent] = useState(initialPost?.content_html ?? "<p></p>");
  const [coverImage, setCoverImage] = useState(initialPost?.cover_image ?? "");
  const [status, setStatus] = useState(initialPost?.status ?? "draft");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function saveWithStatus(targetStatus: string) {
    if (!formRef.current || submitting) return;
    setSubmitting(true);
    setError("");
    setSaved(false);

    const form = new FormData(formRef.current);
    const payload = {
      id: initialPost?.id,
      group_id: form.get("group_id"),
      locale: form.get("locale"),
      slug,
      title,
      excerpt: form.get("excerpt"),
      content_html: content,
      cover_image: coverImage,
      cover_image_alt: form.get("cover_image_alt"),
      author: form.get("author"),
      category: form.get("category"),
      tags: form.get("tags"),
      featured: form.get("featured") === "on",
      related_product_ids: form.getAll("related_product_ids"),
      seo_title: form.get("seo_title"),
      seo_description: form.get("seo_description"),
      canonical_url: "",
      robots_index: form.get("robots_index") === "on",
      status: targetStatus,
      scheduled_at: isoFromLocal(form.get("scheduled_at")),
      published_at: isoFromLocal(form.get("published_at")),
    };

    try {
      const response = await fetch(
        initialPost
          ? `/api/admin/posts/${encodeURIComponent(initialPost.id)}`
          : "/api/admin/posts",
        {
          method: initialPost ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as {
        post?: BlogRow;
        error?: string;
      };
      if (!response.ok || !result.post) {
        setError(
          result.error?.startsWith("BLOG_VALIDATION_FAILED:")
            ? result.error.replace("BLOG_VALIDATION_FAILED:", "").replaceAll("|", "\n")
            : result.error === "DUPLICATE_LOCALE_SLUG"
              ? "Slug đã tồn tại trong ngôn ngữ này."
              : result.error === "DUPLICATE_GROUP_LOCALE"
                ? "Group ID đã có bản ghi cho ngôn ngữ này."
                : "Không thể lưu bài viết. Vui lòng kiểm tra cấu hình và thử lại.",
        );
        return;
      }

      setSaved(true);
      if (!initialPost) {
        router.replace(`/admin/posts/${result.post.id}`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        void saveWithStatus(status);
      }}
      className="space-y-6"
    >
      <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <Link
            href="/admin/posts"
            className="text-sm font-medium text-amber-800 hover:text-amber-950"
          >
            Quay lại danh sách
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {initialPost ? "Chỉnh sửa bài viết" : "Tạo bài viết mới"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {initialPost ? (
            <Link
              href={`/admin/posts/${initialPost.id}/preview`}
              className="admin-button-secondary"
            >
              <Eye size={17} />
              Xem trước
            </Link>
          ) : null}
          <button
            type="button"
            disabled={submitting}
            onClick={() => void saveWithStatus("draft")}
            className="admin-button-secondary"
          >
            <Save size={17} />
            Lưu nháp
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void saveWithStatus("published")}
            className="admin-button"
          >
            <Send size={17} />
            Đăng ngay
          </button>
        </div>
      </header>

      {saved ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <CheckCircle2 size={18} />
          Đã lưu bài viết thành công.
        </div>
      ) : null}
      {error ? (
        <pre
          role="alert"
          className="whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm leading-relaxed text-red-800"
        >
          {error}
        </pre>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className="admin-panel space-y-5 p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="locale" className="admin-label">
                  Ngôn ngữ
                </label>
                <select
                  id="locale"
                  name="locale"
                  defaultValue={initialPost?.locale ?? "vi"}
                  className="admin-select"
                >
                  {BLOG_LOCALES.map((locale) => (
                    <option key={locale} value={locale}>
                      {locale.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="group_id" className="admin-label">
                  Group ID
                </label>
                <input
                  id="group_id"
                  name="group_id"
                  defaultValue={initialPost?.group_id ?? ""}
                  placeholder="Để trống để tự tạo"
                  className="admin-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="title" className="admin-label">
                Tiêu đề
              </label>
              <input
                id="title"
                name="title"
                value={title}
                required
                maxLength={300}
                onChange={(event) => {
                  const nextTitle = event.target.value;
                  setTitle(nextTitle);
                  if (!slugTouched.current) setSlug(slugify(nextTitle));
                }}
                className="admin-input text-base font-semibold"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="slug" className="admin-label">
                Slug
              </label>
              <input
                id="slug"
                name="slug"
                value={slug}
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                title="Chỉ dùng chữ thường không dấu, số và dấu gạch ngang đơn"
                onChange={(event) => {
                  slugTouched.current = true;
                  setSlug(event.target.value.toLowerCase());
                }}
                onBlur={(event) => setSlug(slugify(event.target.value))}
                className="admin-input font-mono text-sm"
              />
              <p className="text-xs text-slate-500">
                Chỉ dùng chữ thường không dấu, số và dấu gạch ngang, ví dụ:
                huong-dan-chon-socola.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="excerpt" className="admin-label">
                Mô tả ngắn
              </label>
              <textarea
                id="excerpt"
                name="excerpt"
                defaultValue={initialPost?.excerpt ?? ""}
                rows={4}
                maxLength={1000}
                className="admin-textarea"
              />
            </div>
          </section>

          <section className="admin-panel p-5 sm:p-6">
            <div className="mb-4">
              <label className="admin-label">Nội dung</label>
              <p className="mt-1 text-xs text-slate-500">
                Chỉ dùng H2 và H3. Heading ID được chuẩn hóa tự động khi lưu.
              </p>
            </div>
            <PostEditor value={content} onChange={setContent} />
          </section>

          <section className="admin-panel space-y-5 p-5 sm:p-6">
            <h2 className="font-semibold">Phân loại và liên kết</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="author" className="admin-label">
                  Tác giả
                </label>
                <input
                  id="author"
                  name="author"
                  defaultValue={initialPost?.author ?? "Cohamy Editorial"}
                  required
                  className="admin-input"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="category" className="admin-label">
                  Danh mục
                </label>
                <select
                  id="category"
                  name="category"
                  defaultValue={initialPost?.category ?? "chocolate"}
                  className="admin-select"
                >
                  {BLOG_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="tags" className="admin-label">
                Tags
              </label>
              <input
                id="tags"
                name="tags"
                defaultValue={initialPost?.tags.join(", ") ?? ""}
                placeholder="socola, quà tặng, hướng dẫn"
                className="admin-input"
              />
            </div>
            <div>
              <p className="admin-label mb-3">Sản phẩm liên quan</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {products.map((product) => (
                  <label
                    key={product.id}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm hover:border-slate-400"
                  >
                    <input
                      type="checkbox"
                      name="related_product_ids"
                      value={product.id}
                      defaultChecked={initialPost?.related_product_ids.includes(
                        product.id,
                      )}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-700 focus:ring-amber-600"
                    />
                    <span>
                      <span className="block font-medium">{product.label}</span>
                      <span className="mt-0.5 block font-mono text-xs text-slate-500">
                        {product.id}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="admin-panel p-5">
            <h2 className="font-semibold">Ảnh đại diện</h2>
            <div className="mt-4">
              <ImageUploader value={coverImage} onChange={setCoverImage} />
            </div>
            <div className="mt-4 space-y-2">
              <label htmlFor="cover_image_alt" className="admin-label">
                Alt ảnh
              </label>
              <input
                id="cover_image_alt"
                name="cover_image_alt"
                defaultValue={initialPost?.cover_image_alt ?? ""}
                className="admin-input"
              />
            </div>
          </section>

          <section className="admin-panel">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold">Xuất bản</h2>
            </div>
            <div className="space-y-4 p-5">
              <div className="space-y-2">
                <label htmlFor="status" className="admin-label">
                  Trạng thái
                </label>
                <select
                  id="status"
                  name="status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as BlogRow["status"])
                  }
                  className="admin-select"
                >
                  {BLOG_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="scheduled_at" className="admin-label">
                  Ngày đặt lịch
                </label>
                <input
                  id="scheduled_at"
                  name="scheduled_at"
                  type="datetime-local"
                  defaultValue={datetimeLocal(initialPost?.scheduled_at ?? "")}
                  className="admin-input"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="published_at" className="admin-label">
                  Ngày xuất bản
                </label>
                <input
                  id="published_at"
                  name="published_at"
                  type="datetime-local"
                  defaultValue={datetimeLocal(initialPost?.published_at ?? "")}
                  className="admin-input"
                />
              </div>
              <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <input
                  name="featured"
                  type="checkbox"
                  defaultChecked={initialPost?.featured}
                  className="h-4 w-4 rounded border-slate-300 text-amber-700 focus:ring-amber-600"
                />
                Ghim bài nổi bật
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="admin-button w-full"
              >
                {status === "scheduled" ? (
                  <CalendarClock size={17} />
                ) : (
                  <Save size={17} />
                )}
                {submitting ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </section>

          <SeoPanel
            initialSeoTitle={initialPost?.seo_title ?? ""}
            initialSeoDescription={initialPost?.seo_description ?? ""}
            robotsIndex={initialPost?.robots_index ?? true}
          />
        </aside>
      </div>
    </form>
  );
}
