"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ProductGrid } from "@/components/ProductGrid";
import { BlogCard } from "@/components/BlogCard";
import { extractTableOfContents } from "@/lib/blog-toc";
import { getProductById } from "@/lib/products";

import type { BlogRow } from "@/lib/blog-schema";
import type { Locale, Product } from "@/lib/types";

interface BlogArticleProps {
  post: BlogRow;
  locale: Locale;
  relatedPosts?: BlogRow[];
  featuredProduct?: Product;
}

export function BlogArticle({
  post,
  locale,
  relatedPosts = [],
  featuredProduct,
}: BlogArticleProps) {
  const t = useTranslations("blog");
  const tProducts = useTranslations("products");
  const content = post.content_html;
  const toc = extractTableOfContents(content);
  const relatedProducts = post.related_product_ids
    .map((id) => getProductById(id))
    .filter(Boolean) as NonNullable<ReturnType<typeof getProductById>>[];

  return (
    <article className="max-w-6xl mx-auto px-6 py-12">
      <Link href="/blog" className="text-sm text-[#D9A441] underline mb-6 inline-block">
        ← {t("backToList")}
      </Link>

      <header className="max-w-3xl mb-10">
        <span className="text-xs uppercase tracking-wider text-[#D9A441]">
          {t(`categoryLabels.${post.category}`)}
        </span>
        <h1 className="font-serif text-4xl md:text-5xl tracking-tight mt-3">
          {post.title}
        </h1>
        <p className="text-[#4A2418]/70 mt-4 text-lg">{post.excerpt}</p>
        <div className="text-sm text-[#4A2418]/50 mt-4">
          {t("publishedAt")}:{" "}
          {new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
            new Date(
              post.published_at || post.scheduled_at || post.updated_at,
            ),
          )}{" "}
          <span aria-hidden="true">/</span> {t("author")}: {post.author}
        </div>
      </header>

      {post.cover_image ? (
        <Image
          src={post.cover_image}
          unoptimized={/^https?:\/\//u.test(post.cover_image)}
          alt={post.cover_image_alt}
          width={1200}
          height={630}
          priority
          className="mb-12 max-h-[480px] w-full rounded-3xl object-cover"
          sizes="(max-width: 1200px) 100vw, 1200px"
        />
      ) : null}

      <div className="grid lg:grid-cols-4 gap-10">
        {toc.length > 0 && (
          <aside className="lg:col-span-1">
            <nav className="sticky top-24 p-5 bg-[#FFF4D8] rounded-2xl text-sm space-y-2">
              <div className="font-medium mb-3">{t("toc")}</div>
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`block text-[#4A2418]/80 hover:text-[#D9A441] ${
                    item.level === 3 ? "pl-4" : ""
                  }`}
                >
                  {item.text}
                </a>
              ))}
            </nav>
          </aside>
        )}

        <div
          className={`${toc.length > 0 ? "lg:col-span-3" : "lg:col-span-4"} prose-cohamy max-w-none`}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>

      {featuredProduct && (
        <aside className="mt-16 p-6 bg-[#FFF4D8] rounded-3xl flex flex-col md:flex-row gap-6 items-center">
          <Image
            src={featuredProduct.images[0]}
            alt={featuredProduct.name[locale]}
            width={128}
            height={128}
            className="h-32 w-32 rounded-2xl object-cover"
          />
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider text-[#4A2418]/50">{t("featuredProduct")}</p>
            <h2 className="font-serif text-2xl mt-1">{featuredProduct.name[locale]}</h2>
            <p className="text-sm text-[#4A2418]/70 mt-2">
              {featuredProduct.shortDescription[locale]}
            </p>
            <p className="text-sm font-medium text-[#4A2418]/70 mt-2">
              {tProducts("contactForPrice")}
            </p>
          </div>
          <Link
            href={{
              pathname: "/products/[slug]",
              params: { slug: featuredProduct.slug[locale] },
            }}
            className="btn-primary px-6 h-12 rounded-full inline-flex items-center"
          >
            {t("viewProduct")}
          </Link>
        </aside>
      )}

      {relatedProducts.length > 0 && (
        <section className="mt-20 p-8 bg-white rounded-3xl border border-[#4A2418]/10">
          <h2 className="font-serif text-2xl mb-6">{tProducts("related")}</h2>
          <ProductGrid products={relatedProducts} showHeading={false} showFilters={false} />
        </section>
      )}

      {relatedPosts.length > 0 && (
        <section className="mt-20">
          <h2 className="font-serif text-2xl mb-6">{t("related")}</h2>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {relatedPosts.map((related) => (
              <BlogCard key={related.id} post={related} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
