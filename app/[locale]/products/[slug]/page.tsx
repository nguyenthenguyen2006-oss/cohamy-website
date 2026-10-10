import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { ProductDetailView } from "@/components/ProductDetailView";
import { routing } from "@/i18n/routing";
import {
  getAllProductSlugs,
  getProductBySlug,
  getRelatedProducts,
} from "@/lib/products";
import { buildProductAlternates, generatePageMetadata, generateProductCatalogJsonLd } from "@/lib/seo";
import type { Locale } from "@/lib/types";
import type { Metadata } from "next";
import { sanitizeBlogHtml } from "@/lib/blog-sanitize";

export function generateStaticParams() {
  return getAllProductSlugs().map(({ locale, slug }) => ({ locale, slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const product = getProductBySlug(slug, locale as Locale);
  if (!product) return {};

  const t = await getTranslations({ locale, namespace: "seo.productDetail" });

  return generatePageMetadata({
    locale,
    pathname: { pathname: "/products/[slug]", params: { slug } },
    title: t("title", { name: product.name[locale as Locale] }),
    description: product.newArrival
      ? product.description[locale as Locale]
      : t("description", { name: product.name[locale as Locale] }),
    image: product.images[0],
    alternates: buildProductAlternates(product, locale),
  });
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const product = getProductBySlug(slug, locale as Locale);
  if (!product) notFound();

  const related = getRelatedProducts(product);
  const jsonLd = generateProductCatalogJsonLd({
    locale: locale as Locale,
    name: product.name[locale as Locale],
    description: product.description[locale as Locale],
    image: product.images[0],
    slug,
    sku: product.id,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</gu, "\\u003c") }}
      />
      <ProductDetailView
        product={product}
        related={related}
        locale={locale as Locale}
        orderIntakeEnabled={process.env.CRM_WEBSITE_ORDER_INTAKE === "true"}
        articleHtml={product.article?.[locale as Locale]
          ? sanitizeBlogHtml(product.article[locale as Locale]!)
          : undefined}
      />
    </>
  );
}
