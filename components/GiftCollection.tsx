"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/types";
import { Link } from "@/i18n/navigation";
import { Gift } from "lucide-react";
import { getAssetById } from "@/lib/assets/manifest";
import { MotionWrapper } from "./MotionWrapper";
import { SectionHeading } from "./SectionHeading";
import { Tilt3D } from "./ui/Tilt3D";
import { DecorativeOrbs } from "./DecorativeOrbs";

const giftImage =
  getAssetById("cohamy-gift-jar-collection")?.path ??
  "/images/products/cohamy-gift-jar-collection.jpg";

export function GiftCollection() {
  const t = useTranslations("home.gift");
  const locale = useLocale() as Locale;
  const giftAsset = getAssetById("cohamy-gift-jar-collection");

  return (
    <section className="relative overflow-hidden bg-[#FFF4D8]/40 py-20 md:py-28">
      <DecorativeOrbs variant="gold" density="medium" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 md:grid-cols-12 md:gap-16">
        <MotionWrapper className="md:col-span-7 md:col-start-1">
          <Tilt3D intensity={8} scale={1.01}>
            <div className="group relative">
              <div
                aria-hidden
                className="absolute -right-6 -top-6 h-full w-full rounded-[2rem] border border-[#D9A441]/30 transition duration-500 group-hover:-right-4 group-hover:-top-4"
              />
              <div className="card-shine relative overflow-hidden rounded-[2rem] shadow-[0_20px_50px_-15px_rgba(42,18,12,0.25)]">
                <Image
                  src={giftImage}
                  alt={giftAsset?.alt[locale] ?? t("imageAlt")}
                  width={720}
                  height={540}
                  className="object-cover transition duration-700 group-hover:scale-[1.03]"
                />
              </div>
              <div className="floating-chip absolute -bottom-5 -left-3 hidden rounded-2xl border border-[#4A2418]/10 bg-white/90 px-5 py-3 shadow-lg backdrop-blur-sm md:block">
                <div className="flex items-center gap-2 text-[#D9A441]">
                  <Gift size={16} />
                  <span className="text-xs font-medium uppercase tracking-wider">{t("badge")}</span>
                </div>
              </div>
            </div>
          </Tilt3D>
        </MotionWrapper>

        <MotionWrapper delay={0.1} className="md:col-span-4 md:col-start-9">
          <SectionHeading
            eyebrow={t("eyebrow")}
            title={t("title")}
            subtitle={t("subtitle")}
            align="left"
          />
          <Link
            href="/products"
            className="btn-primary btn-3d mt-8 inline-flex h-12 items-center rounded-full px-8"
          >
            {t("cta")}
          </Link>
        </MotionWrapper>
      </div>
    </section>
  );
}