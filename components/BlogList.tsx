"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { BlogPost, Locale } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/SectionHeading";
import { BlogCard } from "@/components/BlogCard";

interface BlogListProps {
  posts: BlogPost[];
  className?: string;
  showHeading?: boolean;
}

export function BlogList({
  posts,
  className,
  showHeading = true,
}: BlogListProps) {
  const t = useTranslations("blog");
  const locale = useLocale() as Locale;
  const [query, setQuery] = useState("");

  const filteredPosts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return posts;

    return posts.filter((post) => {
      const haystack = [
        post.title[locale],
        post.excerpt[locale],
        ...post.tags,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [posts, query, locale]);

  return (
    <section className={cn("mx-auto max-w-7xl px-5 py-12 md:px-8", className)}>
      {showHeading ? (
        <SectionHeading
          title={t("title")}
          subtitle={t("subtitle")}
          className="mb-8"
        />
      ) : null}

      <div className="relative mb-8 max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#4A2418]/40"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-12 w-full rounded-full border border-[#4A2418]/15 bg-[#FFF4D8]/50 pl-11 pr-4 text-sm text-[#2A120C] outline-none transition-colors placeholder:text-[#4A2418]/40 focus:border-[#D9A441]"
          aria-label={t("searchPlaceholder")}
        />
      </div>

      {filteredPosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#4A2418]/15 px-6 py-16 text-center">
          <p className="font-[family-name:var(--font-playfair)] text-2xl text-[#2A120C]">
            {t("empty")}
          </p>
          <p className="mt-2 text-sm text-[#4A2418]/65">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredPosts.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </section>
  );
}