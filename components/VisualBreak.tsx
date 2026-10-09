"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/types";
import { Link } from "@/i18n/navigation";
import { getProductById } from "@/lib/products";
import { Tilt3D } from "@/components/ui/Tilt3D";
import { MotionWrapper } from "@/components/MotionWrapper";
import { DecorativeOrbs } from "@/components/DecorativeOrbs";

const SHOWCASE_IDS = [
  "cohamy-almond-chocolate-80g",
  "cohamy-mango-chocolate-80g",
  "cohamy-almond-matcha-chocolate-80g",
] as const;

export function VisualBreak() {
  const t = useTranslations("home.visualBreak");
  const locale = useLocale() as Locale;

  return (
    <section className="relative overflow-hidden py-16 md:py-24">
      <DecorativeOrbs variant="gold" density="rich" />
      <div className="grain-overlay pointer-events-none absolute inset-0 opacity-25" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-12">
        <MotionWrapper className="lg:col-span-4">
          <p className="type-display-sm font-serif text-[#D9A441]/40">{t("number")}</p>
          <h2 className="type-display-lg mt-2 text-[#2A120C]">{t("title")}</h2>
          <p className="type-body-lg mt-4 text-[#4A2418]/75">{t("subtitle")}</p>
          <Link
            href="/products"
            className="btn-primary btn-3d mt-8 inline-flex h-14 items-center rounded-full px-10 text-base"
          >
            {t("cta")}
          </Link>
        </MotionWrapper>

        <div className="grid grid-cols-3 gap-4 lg:col-span-8 lg:gap-6">
          {SHOWCASE_IDS.map((id, index) => {
            const product = getProductById(id);
            if (!product) return null;

            return (
              <MotionWrapper key={id} delay={index * 0.12} className={index === 1 ? "mt-8" : ""}>
                <Tilt3D intensity={12} scale={1.04}>
                  <Link href={{ pathname: "/products/[slug]", params: { slug: product.slug[locale] } }} className="card-shine ring-glow relative block overflow-hidden rounded-[1.5rem] border border-[#4A2418]/10 bg-[#FFF4D8] p-4 shadow-[0_20px_50px_-22px_rgba(42,18,12,0.3)]">
                    <Image
                      src={product.images[0]}
                      alt={product.name[locale]}
                      width={280}
                      height={360}
                      className="mx-auto h-auto w-full max-w-[200px] object-contain transition duration-700 hover:scale-105 lg:max-w-[220px]"
                    />
                  </Link>
                </Tilt3D>
              </MotionWrapper>
            );
          })}
        </div>
      </div>
    </section>
  );
}
