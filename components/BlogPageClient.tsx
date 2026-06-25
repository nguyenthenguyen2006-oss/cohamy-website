"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { BlogCard } from "@/components/BlogCard";
import { SectionHeading } from "@/components/SectionHeading";
import { blogPosts } from "@/lib/blog";
import { getBlogSearchText } from "@/lib/blog-content";
import type { BlogCategory, Locale } from "@/lib/types";

const CATEGORY_KEYS = [
  "all",
  "chocolate",
  "dried-fruit",
  "gift-ideas",
  "food-guide",
  "brand-story",
] as const;

export function BlogPageClient() {
  const t = useTranslations("blog");
  const locale = useLocale() as Locale;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<BlogCategory | "all">("all");

  const featured = blogPosts.find((p) => p.featured);

  const filtered = useMemo(() => {
    let result = [...blogPosts];

    if (query.trim()) {
      const normalized = query.trim().toLowerCase();
      result = result.filter((post) => {
        const haystack = [
          post.title[locale],
          post.excerpt[locale],
          getBlogSearchText(post.id, locale, post.content.vi),
          ...post.tags,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalized);
      });
    }

    if (category !== "all") {
      result = result.filter((post) => post.category === category);
    }

    return result;
  }, [query, category, locale]);

  const listPosts =
    !query && category === "all" && featured
      ? filtered.filter((p) => p.id !== featured.id)
      : filtered;

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
      <SectionHeading title={t("title")} subtitle={t("subtitle")} className="mb-8" />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div className="relative max-w-md flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#4A2418]/40"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-12 w-full rounded-full border border-[#4A2418]/15 bg-[#FFF4D8]/50 pl-11 pr-4 text-sm outline-none focus:border-[#D9A441]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_KEYS.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm border transition ${
                category === cat
                  ? "bg-[#2A120C] text-white border-[#2A120C]"
                  : "bg-white border-[#4A2418]/20"
              }`}
            >
              {t(`categoryLabels.${cat}`)}
            </button>
          ))}
        </div>
      </div>

      {!query && category === "all" && featured && (
        <div className="mb-10">
          <p className="text-xs uppercase tracking-wider text-[#D9A441] mb-4">{t("featuredLabel")}</p>
          <BlogCard post={featured} featured />
        </div>
      )}

      {listPosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#4A2418]/15 px-6 py-16 text-center">
          <p className="font-serif text-2xl">{t("empty")}</p>
          <p className="mt-2 text-sm text-[#4A2418]/65">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {listPosts.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}