"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductFAQ } from "@/components/ProductFAQ";
import { ProductGrid } from "@/components/ProductGrid";
import type { Locale, Product } from "@/lib/types";

interface ProductDetailViewProps {
  product: Product;
  related: Product[];
  locale: Locale;
}

export function ProductDetailView({ product, related, locale }: ProductDetailViewProps) {
  const t = useTranslations("products");

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="grid md:grid-cols-2 gap-10">
        <ProductGallery images={product.images} alt={product.name[locale]} />
        <div>
          <h1 className="font-serif text-4xl md:text-5xl tracking-tight">
            {product.name[locale]}
          </h1>
          <p className="mt-4 text-lg font-medium text-[#4A2418]/80">
            {t("contactForPrice")}
          </p>
          <p className="text-[#4A2418]/80 mb-6 mt-4 leading-relaxed">
            {product.description[locale]}
          </p>

          <div className="text-sm text-[#4A2418]/60 mb-8 space-y-1">
            <div>
              {t("weight")}: {product.weight}
            </div>
            <div>
              {t("ingredients")}: {product.ingredients[locale]}
            </div>
          </div>

          <Link
            href="/contact"
            className="btn-primary inline-flex h-14 items-center rounded-2xl px-10"
          >
            {t("contactCta")}
          </Link>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="font-serif text-3xl mb-8">{t("related")}</h2>
          <ProductGrid products={related} showHeading={false} showFilters={false} />
        </section>
      )}

      <ProductFAQ />
    </div>
  );
}