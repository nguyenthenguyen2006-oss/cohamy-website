import Link from "next/link";
import { FilePlus2, Search } from "lucide-react";
import { ImportCsvDialog } from "@/components/admin/ImportCsvDialog";
import { PostTable } from "@/components/admin/PostTable";
import { listAdminPosts } from "@/lib/blog-repository";
import {
  BLOG_CATEGORIES,
  BLOG_LOCALES,
  BLOG_STATUSES,
  type BlogCategory,
  type BlogLocale,
  type BlogStatus,
} from "@/lib/blog-schema";

function optionalEnum<T extends string>(
  value: string | undefined,
  values: readonly T[],
): T | undefined {
  return values.includes(value as T) ? (value as T) : undefined;
}

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q : "";
  const locale = optionalEnum(
    typeof query.locale === "string" ? query.locale : undefined,
    BLOG_LOCALES,
  ) as BlogLocale | undefined;
  const status = optionalEnum(
    typeof query.status === "string" ? query.status : undefined,
    BLOG_STATUSES,
  ) as BlogStatus | undefined;
  const category = optionalEnum(
    typeof query.category === "string" ? query.category : undefined,
    BLOG_CATEGORIES,
  ) as BlogCategory | undefined;
  const page = Number(typeof query.page === "string" ? query.page : "1");
  const result = await listAdminPosts({
    page,
    pageSize: 20,
    q,
    locale,
    status,
    category,
  });

  function pageHref(target: number): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (locale) params.set("locale", locale);
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    params.set("page", String(target));
    return `/admin/posts?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Bài viết</h1>
          <p className="mt-2 text-sm text-slate-600">
            {result.totalItems} kết quả, sắp xếp theo lần cập nhật mới nhất.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportCsvDialog />
          <Link href="/admin/posts/new" className="admin-button">
            <FilePlus2 size={17} />
            Tạo bài mới
          </Link>
        </div>
      </header>

      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[minmax(15rem,1fr)_10rem_11rem_11rem_auto]">
        <div className="relative">
          <Search
            aria-hidden
            size={17}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Tìm title, excerpt hoặc tags"
            className="admin-input pl-10"
            aria-label="Tìm bài viết"
          />
        </div>
        <select
          name="locale"
          defaultValue={locale ?? ""}
          className="admin-select"
          aria-label="Lọc ngôn ngữ"
        >
          <option value="">Mọi locale</option>
          {BLOG_LOCALES.map((item) => (
            <option key={item} value={item}>
              {item.toUpperCase()}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="admin-select"
          aria-label="Lọc trạng thái"
        >
          <option value="">Mọi trạng thái</option>
          {BLOG_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          name="category"
          defaultValue={category ?? ""}
          className="admin-select"
          aria-label="Lọc danh mục"
        >
          <option value="">Mọi danh mục</option>
          {BLOG_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button type="submit" className="admin-button">
          Lọc
        </button>
      </form>

      <PostTable posts={result.items} />

      {result.totalPages > 1 ? (
        <nav
          className="flex items-center justify-between"
          aria-label="Phân trang bài viết"
        >
          <Link
            href={pageHref(Math.max(1, result.page - 1))}
            aria-disabled={result.page === 1}
            className={`admin-button-secondary ${
              result.page === 1 ? "pointer-events-none opacity-45" : ""
            }`}
          >
            Trang trước
          </Link>
          <p className="text-sm text-slate-600">
            Trang {result.page} / {result.totalPages}
          </p>
          <Link
            href={pageHref(Math.min(result.totalPages, result.page + 1))}
            aria-disabled={result.page === result.totalPages}
            className={`admin-button-secondary ${
              result.page === result.totalPages
                ? "pointer-events-none opacity-45"
                : ""
            }`}
          >
            Trang sau
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
