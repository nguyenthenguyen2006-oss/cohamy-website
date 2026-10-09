"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/types";
import { Link } from "@/i18n/navigation";
import { Cookie, Cherry, Nut, Leaf } from "lucide-react";
import { Tilt3D } from "@/components/ui/Tilt3D";
import { MotionWrapper } from "@/components/MotionWrapper";
import { DecorativeOrbs } from "@/components/DecorativeOrbs";
import { SectionOrnament } from "@/components/SectionOrnament";
import { getProductById } from "@/lib/products";

const FLAVOR_KEYS = ["almond", "mango", "macadamia", "matcha"] as const;

const flavorMeta = {
  almond: {
    className: "md:col-span-2",
    bg: "bg-[#2A120C] text-[#FAF6EF]",
    icon: Cookie,
    productId: "cohamy-almond-chocolate-80g",
  },
  mango: {
    className: "",
    bg: "bg-[#FFF4D8] text-[#2A120C]",
    icon: Cherry,
    productId: "cohamy-mango-chocolate-80g",
  },
  macadamia: {
    className: "",
    bg: "bg-white text-[#2A120C]",
    icon: Nut,
    productId: "cohamy-macadamia-chocolate-80g",
  },
  matcha: {
    className: "md:col-span-2",
    bg: "bg-[#E8F0E4] text-[#2A120C]",
    icon: Leaf,
    productId: "cohamy-almond-matcha-chocolate-80g",
  },
} as const;

export function BentoGrid() {
  const locale = useLocale() as Locale;
  const t = useTranslations("home.taste");
  const tBento = useTranslations("home.bento");
  const tExplore = useTranslations("home.categories");

  return (
    <section className="relative overflow-hidden bg-[#FFF4D8] py-20 md:py-28">
      <DecorativeOrbs variant="mixed" density="medium" />
      <SectionOrnament className="relative mx-auto max-w-5xl px-6">
        <MotionWrapper className="mb-10">
          <h2 className="type-display-lg text-[#2A120C]">{t("title")}</h2>
          <p className="type-body-lg mt-3 text-[#4A2418]/70">{t("subtitle")}</p>
          <div className="section-divider mt-6 max-w-xs" />
        </MotionWrapper>

        <div className="grid gap-5 md:grid-cols-3">
          {FLAVOR_KEYS.map((key, index) => {
            const meta = flavorMeta[key];
            const Icon = meta.icon;
            const product = getProductById(meta.productId);
            if (!product) return null;
            const image = product.images[0];

            return (
              <MotionWrapper key={key} delay={index * 0.08} className={meta.className}>
                <Link href={{ pathname: "/products/[slug]", params: { slug: product.slug[locale] } }} className="group block h-full">
                  <Tilt3D intensity={14} scale={1.03} className="h-full">
                    <div
                      className={`card-shine relative h-full min-h-[220px] overflow-hidden rounded-2xl border border-[#4A2418]/10 p-9 shadow-[0_18px_48px_-24px_rgba(42,18,12,0.32)] ${meta.bg}`}
                    >
                      {image ? (
                        <Image
                          src={image}
                          alt={tBento(`${key}.title`)}
                          width={140}
                          height={140}
                          className="pointer-events-none absolute -bottom-5 -right-3 h-32 w-32 rotate-12 object-contain opacity-30 transition duration-500 group-hover:rotate-6 group-hover:scale-110 group-hover:opacity-45"
                        />
                      ) : null}
                      <div className="icon-3d mb-5 inline-flex rounded-xl border border-current/15 bg-white/10 p-3 backdrop-blur-sm">
                        <Icon size={22} />
                      </div>
                      <div className="relative z-10 text-xl font-medium md:text-2xl">
                        {tBento(`${key}.title`)}
                      </div>
                      <div className="relative z-10 mt-2 type-body-md opacity-85">
                        {product.shortDescription[locale]} {product.weight}
                      </div>
                      <div className="relative z-10 mt-6 text-sm underline opacity-75 transition group-hover:translate-x-1 md:text-base">
                        {tExplore("explore")} →
                      </div>
                    </div>
                  </Tilt3D>
                </Link>
              </MotionWrapper>
            );
          })}
        </div>
      </SectionOrnament>
    </section>
  );
}
