"use client";

import { useLocale } from "next-intl";
import { BlogArticle } from "@/components/BlogArticle";
import type { BlogRow } from "@/lib/blog-schema";
import type { Locale, Product } from "@/lib/types";

export function BlogDetailLayout({
  post,
  relatedPosts = [],
  featuredProduct,
  className,
}: {
  post: BlogRow;
  relatedPosts?: BlogRow[];
  featuredProduct?: Product;
  className?: string;
}) {
  const locale = useLocale() as Locale;
  return (
    <div className={className}>
      <BlogArticle
        post={post}
        locale={locale}
        relatedPosts={relatedPosts}
        featuredProduct={featuredProduct}
      />
    </div>
  );
}
