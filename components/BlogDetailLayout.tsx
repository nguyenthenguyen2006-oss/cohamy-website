"use client";

import Image from "next/image";
import { useMemo } from "react";
import { Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { BlogPost, Locale, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CTAButton } from "@/components/CTAButton";
import { BlogCard } from "@/components/BlogCard";

interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

interface BlogDetailLayoutProps {
  post: BlogPost;
  relatedPosts?: BlogPost[];
  featuredProduct?: Product;
  className?: string;
}

function extractHeadings(content: string): TocItem[] {
  const lines = content.split("\n");
  const headings: TocItem[] = [];

  lines.forEach((line) => {
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);

    if (h2) {
      const text = h2[1].trim();
      headings.push({
        id: text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-"),
        text,
        level: 2,
      });
    } else if (h3) {
      const text = h3[1].trim();
      headings.push({
        id: text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-"),
        text,
        level: 3,
      });
    }
  });

  return headings;
}

function renderContent(content: string) {
  return content.split("\n").map((line, index) => {
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);

    if (h2) {
      const text = h2[1].trim();
      const id = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
      return (
        <h2
          key={index}
          id={id}
          className="scroll-mt-28 font-[family-name:var(--font-playfair)] text-3xl tracking-[-0.02em] text-[#2A120C]"
        >
          {text}
        </h2>
      );
    }

    if (h3) {
      const text = h3[1].trim();
      const id = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
      return (
        <h3
          key={index}
          id={id}
          className="scroll-mt-28 font-[family-name:var(--font-playfair)] text-2xl text-[#2A120C]"
        >
          {text}
        </h3>
      );
    }

    if (!line.trim()) return <div key={index} className="h-3" />;

    return (
      <p key={index} className="text-base leading-relaxed text-[#4A2418]/80">
        {line}
      </p>
    );
  });
}

function estimateReadTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 180));
}

export function BlogDetailLayout({
  post,
  relatedPosts = [],
  featuredProduct,
  className,
}: BlogDetailLayoutProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("blog");
  const homeT = useTranslations("home.featured");
  const tProducts = useTranslations("products");
  const content = post.content[locale];
  const toc = useMemo(() => extractHeadings(content), [content]);
  const readTime = estimateReadTime(content);

  return (
    <article className={cn("mx-auto max-w-7xl px-5 py-12 md:px-8", className)}>
      <div className="mb-8">
        <Link
          href="/blog"
          className="text-sm text-[#4A2418]/60 transition-colors hover:text-[#4A2418]"
        >
          ← {t("backToList")}
        </Link>
      </div>

      <header className="mx-auto max-w-3xl text-center">
        <div className="mb-4 flex flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-[0.14em] text-[#4A2418]/50">
          <time dateTime={post.publishedAt}>
            {t("publishedAt")}: {new Date(post.publishedAt).toLocaleDateString(locale)}
          </time>
          <span className="inline-flex items-center gap-1">
            <Clock size={12} />
            {readTime} {t("minRead")}
          </span>
          <span>
            {t("author")}: {post.author}
          </span>
        </div>
        <h1 className="font-[family-name:var(--font-playfair)] text-[clamp(2rem,5vw,3.5rem)] leading-tight tracking-[-0.03em] text-[#2A120C]">
          {post.title[locale]}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-[#4A2418]/75">
          {post.excerpt[locale]}
        </p>
      </header>

      <div className="relative mx-auto mt-10 aspect-[21/9] max-w-5xl overflow-hidden rounded-[1.75rem] border border-[#4A2418]/10">
        <Image
          src={post.coverImage}
          alt={post.title[locale]}
          fill
          className="object-cover"
          sizes="(max-width: 1280px) 100vw, 1024px"
          priority
        />
      </div>

      <div className="mx-auto mt-12 grid max-w-6xl gap-10 lg:grid-cols-[14rem_1fr]">
        {toc.length > 0 ? (
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <nav aria-label="Table of contents">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#4A2418]/50">
                {t("toc")}
              </p>
              <ul className="space-y-2 border-l border-[#4A2418]/10 pl-4">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className={cn(
                        "block text-sm text-[#4A2418]/70 transition-colors hover:text-[#2A120C]",
                        item.level === 3 && "pl-3",
                      )}
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        ) : (
          <div className="hidden lg:block" />
        )}

        <div className="space-y-5">{renderContent(content)}</div>
      </div>

      {featuredProduct ? (
        <aside className="mx-auto mt-16 max-w-4xl overflow-hidden rounded-[1.5rem] border border-[#4A2418]/10 bg-[#FFF4D8]">
          <div className="grid md:grid-cols-[10rem_1fr_auto] md:items-center">
            <div className="relative aspect-square md:aspect-auto md:h-full md:min-h-[10rem]">
              <Image
                src={featuredProduct.images[0]}
                alt={featuredProduct.name[locale]}
                fill
                className="object-cover"
                sizes="160px"
              />
            </div>
            <div className="p-6">
              <p className="text-xs uppercase tracking-[0.16em] text-[#4A2418]/50">
                {homeT("viewDetail")}
              </p>
              <h2 className="mt-1 font-[family-name:var(--font-playfair)] text-2xl text-[#2A120C]">
                {featuredProduct.name[locale]}
              </h2>
              <p className="mt-2 text-sm text-[#4A2418]/70">
                {featuredProduct.shortDescription[locale]}
              </p>
              <p className="mt-3 font-medium text-[#4A2418]/70">
                {tProducts("contactForPrice")}
              </p>
            </div>
            <div className="flex items-center p-6 md:justify-center">
              <CTAButton href="/contact">{homeT("contactCta")}</CTAButton>
            </div>
          </div>
        </aside>
      ) : null}

      {relatedPosts.length > 0 ? (
        <section className="mt-20">
          <h2 className="mb-6 font-[family-name:var(--font-playfair)] text-3xl tracking-[-0.02em] text-[#2A120C]">
            {t("related")}
          </h2>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {relatedPosts.map((related) => (
              <BlogCard key={related.id} post={related} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}