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
import { generatePageMetadata, generateProductJsonLd } from "@/lib/seo";
import type { Locale } from "@/lib/types";
import type { Metadata } from "next";

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
    description: t("description", { name: product.name[locale as Locale] }),
    image: product.images[0],
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
  const jsonLd = generateProductJsonLd({
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailView
        product={product}
        related={related}
        locale={locale as Locale}
      />
    </>
  );
}