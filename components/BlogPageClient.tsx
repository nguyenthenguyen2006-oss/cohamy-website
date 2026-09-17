import Link from "next/link";
import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BlogCard } from "@/components/BlogCard";
import { SectionHeading } from "@/components/SectionHeading";
import { getPathname } from "@/i18n/navigation";
import {
  BLOG_CATEGORIES,
  type BlogCategory,
  type BlogLocale,
} from "@/lib/blog-schema";
import type { PublicBlogPage } from "@/lib/blog-repository";

function buildHref(
  locale: BlogLocale,
  options: { q?: string; category?: BlogCategory; page?: number;references?:Record<string,string> },
): string {
  const pathname = getPathname({ locale, href: "/blog" });
  const query = new URLSearchParams();
  if (options.q) query.set("q", options.q);
  if (options.category) query.set("category", options.category);
  for(const [key,value] of Object.entries(options.references || {}))if(value)query.set(key,value);
  if (options.page && options.page > 1) query.set("page", String(options.page));
  const suffix = query.toString();
  return suffix ? `${pathname}?${suffix}` : pathname;
}

export async function BlogPageClient({
  locale,
  result,
  q,
  category,
  referenceFilters={},referenceOptions=[],
}: {
  locale: BlogLocale;
  result: PublicBlogPage;
  q: string;
  category?: BlogCategory;
  referenceFilters?:Record<string,string>;
  referenceOptions?:{entity_id:string;name:string;type:string}[];
}) {
  const t = await getTranslations({ locale, namespace: "blog" });

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
      <SectionHeading
        title={t("title")}
        subtitle={t("subtitle")}
        className="mb-8"
      />

      <form
        action={getPathname({ locale, href: "/blog" })}
        className="mb-8 flex flex-col gap-4"
      >
        <div className="relative max-w-xl">
          <Search
            size={16}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#4A2418]/40"
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="h-12 w-full rounded-full border border-[#4A2418]/15 bg-[#FFF4D8]/50 pl-11 pr-28 text-sm outline-none focus:border-[#D9A441]"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1.5 h-9 rounded-full bg-[#2A120C] px-5 text-sm font-medium text-[#FAF6EF]"
          >
            {t("searchButton")}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildHref(locale, { q,references:referenceFilters })}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              !category
                ? "border-[#2A120C] bg-[#2A120C] text-white"
                : "border-[#4A2418]/20 bg-white text-[#2A120C]"
            }`}
          >
            {t("categoryLabels.all")}
          </Link>
          {BLOG_CATEGORIES.map((item) => (
            <Link
              key={item}
              href={buildHref(locale, { q, category: item,references:referenceFilters })}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                category === item
                  ? "border-[#2A120C] bg-[#2A120C] text-white"
                  : "border-[#4A2418]/20 bg-white text-[#2A120C]"
              }`}
            >
              {t(`categoryLabels.${item}`)}
            </Link>
          ))}
        </div>
        {category ? <input type="hidden" name="category" value={category}/> : null}
        <div className="flex flex-wrap gap-4">{["country","topic","subject","location"].filter(kind=>referenceOptions.some(r=>r.type===kind)).map(kind=><label key={kind} className="text-sm">{({vi:{country:"Quốc gia",topic:"Chủ đề",subject:"Đối tượng",location:"Địa điểm"},en:{country:"Country",topic:"Topic",subject:"Subject",location:"Location"},zh:{country:"国家",topic:"主题",subject:"对象",location:"地点"},ko:{country:"국가",topic:"주제",subject:"대상",location:"위치"},ja:{country:"国",topic:"テーマ",subject:"対象",location:"場所"}}[locale] as Record<string,string>)[kind]}<select name={kind} defaultValue={referenceFilters[kind] || ""} className="ml-2 rounded border border-[#4A2418]/20 bg-white px-3 py-2"><option value="">—</option>{referenceOptions.filter(r=>r.type===kind).map(r=><option key={r.entity_id} value={r.entity_id}>{r.name}</option>)}{referenceFilters[kind] && !referenceOptions.some(r=>r.entity_id===referenceFilters[kind]) ? <option value={referenceFilters[kind]}>{referenceFilters[kind]}</option> : null}</select></label>)}</div>
      </form>

      {result.featured ? (
        <div className="mb-10">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#D9A441]">
            {t("featuredLabel")}
          </p>
          <BlogCard post={result.featured} featured />
        </div>
      ) : null}

      {result.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#4A2418]/15 px-6 py-16 text-center">
          <p className="font-serif text-2xl">{t("empty")}</p>
          <p className="mt-2 text-sm text-[#4A2418]/65">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {result.items.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {result.totalPages > 1 ? (
        <nav
          className="mt-10 flex items-center justify-between border-t border-[#4A2418]/10 pt-6"
          aria-label={t("pagination")}
        >
          <Link
            href={buildHref(locale, {
              q,
              category,
              references:referenceFilters,
              page: Math.max(1, result.page - 1),
            })}
            aria-disabled={result.page === 1}
            className={`btn-secondary h-11 rounded-full px-5 ${
              result.page === 1 ? "pointer-events-none opacity-40" : ""
            }`}
          >
            {t("previousPage")}
          </Link>
          <span className="text-sm text-[#4A2418]/65">
            {t("pageStatus", {
              page: result.page,
              total: result.totalPages,
            })}
          </span>
          <Link
            href={buildHref(locale, {
              q,
              category,
              references:referenceFilters,
              page: Math.min(result.totalPages, result.page + 1),
            })}
            aria-disabled={result.page === result.totalPages}
            className={`btn-secondary h-11 rounded-full px-5 ${
              result.page === result.totalPages
                ? "pointer-events-none opacity-40"
                : ""
            }`}
          >
            {t("nextPage")}
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
