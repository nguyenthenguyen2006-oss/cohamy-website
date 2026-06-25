"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { MotionWrapper } from "@/components/MotionWrapper";
import { DecorativeOrbs } from "@/components/DecorativeOrbs";
import { SectionOrnament } from "@/components/SectionOrnament";

export function BrandStory() {
  const t = useTranslations("home.about");

  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <DecorativeOrbs variant="chocolate" density="light" />
      <SectionOrnament className="relative mx-auto max-w-4xl px-6 text-center">
        <MotionWrapper>
          <p className="type-label text-[#D9A441]">{t("subtitle")}</p>
          <h2 className="type-display-md mx-auto mt-5 max-w-3xl">{t("title")}</h2>
          <p className="type-body-lg mx-auto mt-6 max-w-2xl text-[#4A2418]/80">{t("description")}</p>
          <Link
            href="/about"
            className="btn-3d mt-10 inline-flex items-center rounded-full border border-[#4A2418]/20 bg-white/70 px-8 py-3.5 text-base text-[#D9A441] backdrop-blur-sm transition hover:border-[#D9A441]/40"
          >
            {t("cta")} →
          </Link>
        </MotionWrapper>
      </SectionOrnament>
    </section>
  );
}