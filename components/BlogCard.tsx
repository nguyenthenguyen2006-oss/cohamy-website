"use client";

import Image from "next/image";
import { ArrowUpRight, Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { BlogRow } from "@/lib/blog-schema";
import type { Locale } from "@/lib/types";

interface BlogCardProps {
  post: BlogRow;
  className?: string;
  featured?: boolean;
}

function estimateReadTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 180));
}

export function BlogCard({ post, className, featured = false }: BlogCardProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("blog");
  const readTime = estimateReadTime(post.content_html);

  return (
    <article
      className={cn(
        "card-shine group h-full overflow-hidden rounded-[1.35rem] border border-[#4A2418]/10 bg-[#FAF6EF] transition hover:border-[#D9A441]/25",
        featured && "md:grid md:grid-cols-2",
        className,
      )}
    >
      <Link
        href={{
          pathname: "/blog/[slug]",
          params: { slug: post.slug },
        }}
        className={cn(
          "relative block overflow-hidden bg-[#FFF4D8]",
          featured ? "aspect-[16/11] md:aspect-auto md:min-h-full" : "aspect-[16/10]",
        )}
      >
        {post.cover_image ? (
          <Image
            src={post.cover_image}
            unoptimized={/^https?:\/\//u.test(post.cover_image)}
            alt={post.cover_image_alt}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            sizes={
              featured
                ? "(max-width: 768px) 100vw, 50vw"
                : "(max-width: 768px) 100vw, 33vw"
            }
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center font-[family-name:var(--font-playfair)] text-2xl text-[#4A2418]/35">
            Cohamy
          </span>
        )}
      </Link>

      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-[#4A2418]/50">
          <time dateTime={post.published_at || post.scheduled_at}>
            {new Date(
              post.published_at || post.scheduled_at || post.updated_at,
            ).toLocaleDateString(locale)}
          </time>
          <span className="inline-flex items-center gap-1">
            <Clock size={12} />
            {readTime} {t("minRead")}
          </span>
        </div>

        <h3 className="font-[family-name:var(--font-playfair)] text-2xl leading-tight tracking-[-0.02em] text-[#2A120C] md:text-[1.75rem]">
          <Link
            href={{
              pathname: "/blog/[slug]",
              params: { slug: post.slug },
            }}
            className="transition-colors hover:text-[#4A2418]"
          >
            {post.title}
          </Link>
        </h3>

        <p className="type-body-md line-clamp-3 text-[#4A2418]/70">
          {post.excerpt}
        </p>

        <Link
          href={{
            pathname: "/blog/[slug]",
            params: { slug: post.slug },
          }}
          className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-[#D9A441] transition-colors hover:text-[#4A2418]"
        >
          {t("readMore")}
          <ArrowUpRight size={15} />
        </Link>
      </div>
    </article>
  );
}
