"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ProductGrid } from "@/components/ProductGrid";
import { getFeaturedProducts } from "@/lib/products";
import { DecorativeOrbs } from "@/components/DecorativeOrbs";
import { MotionWrapper } from "@/components/MotionWrapper";
import { SectionOrnament } from "@/components/SectionOrnament";

export function FeaturedProducts() {
  const t = useTranslations("home.featured");
  const featured = getFeaturedProducts().slice(0, 6);

  return (
    <section className="relative overflow-hidden py-20 md:py-24">
      <DecorativeOrbs variant="cream" density="medium" />
      <SectionOrnament className="relative mx-auto max-w-7xl px-6 pb-4">
        <MotionWrapper className="mb-10 flex items-end justify-between">
          <div>
            <h2 className="type-display-lg text-[#2A120C]">{t("title")}</h2>
            <p className="type-body-lg mt-3 text-[#4A2418]/70">{t("subtitle")}</p>
            <div className="section-divider mt-6 max-w-[140px]" />
          </div>
          <Link
            href="/products"
            className="btn-3d hidden rounded-full border border-[#4A2418]/20 bg-white/80 px-6 py-3 text-base text-[#D9A441] backdrop-blur-sm transition hover:border-[#D9A441]/40 md:block"
          >
            {t("viewAll")} →
          </Link>
        </MotionWrapper>
        <ProductGrid products={featured} showHeading={false} showFilters={false} />
      </SectionOrnament>
    </section>
  );
}