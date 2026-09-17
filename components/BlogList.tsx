"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { BlogRow } from "@/lib/blog-schema";
import type { Locale } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/SectionHeading";
import { BlogCard } from "@/components/BlogCard";

export function BlogList({
  posts,
  className,
  showHeading = true,
}: {
  posts: BlogRow[];
  className?: string;
  showHeading?: boolean;
}) {
  const t = useTranslations("blog");
  const locale = useLocale() as Locale;
  const [query, setQuery] = useState("");
  const filteredPosts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale);
    if (!normalized) return posts;
    return posts.filter((post) =>
      [post.title, post.excerpt, ...post.tags]
        .join(" ")
        .toLocaleLowerCase(locale)
        .includes(normalized),
    );
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
          className="h-12 w-full rounded-full border border-[#4A2418]/15 bg-[#FFF4D8]/50 pl-11 pr-4 text-sm outline-none focus:border-[#D9A441]"
        />
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredPosts.map((post) => (
          <BlogCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
