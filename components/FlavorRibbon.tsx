"use client";

import { useTranslations } from "next-intl";
import { Tilt3D } from "@/components/ui/Tilt3D";
import { MotionWrapper } from "@/components/MotionWrapper";

const FLAVOR_KEYS = ["item1", "item2", "item3", "item4", "item5", "item6"] as const;

export function FlavorRibbon() {
  const t = useTranslations("home.flavorRibbon");

  return (
    <section className="pattern-chocolate relative overflow-hidden border-y border-[#4A2418]/10 bg-[#FFF4D8]/70 py-10 md:py-12">
      <div className="grain-overlay pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative mx-auto max-w-6xl px-6">
        <MotionWrapper className="mb-7 text-center">
          <h2 className="type-display-md text-[#2A120C]">{t("title")}</h2>
          <p className="type-body-lg mx-auto mt-3 max-w-2xl text-[#4A2418]/75">{t("subtitle")}</p>
        </MotionWrapper>

        <div className="flex flex-wrap justify-center gap-3 md:gap-4">
          {FLAVOR_KEYS.map((key, index) => (
            <MotionWrapper key={key} delay={index * 0.06}>
              <Tilt3D intensity={14} scale={1.06} glare={false}>
                <div className="card-shine group relative overflow-hidden rounded-full border border-[#4A2418]/15 bg-white/80 px-6 py-3 shadow-[0_10px_30px_-16px_rgba(42,18,12,0.22)] backdrop-blur-sm md:px-8 md:py-3.5">
                  <span className="type-label text-[#D9A441]">{String(index + 1).padStart(2, "0")}</span>
                  <span className="type-body-md ml-3 font-medium text-[#2A120C]">{t(key)}</span>
                </div>
              </Tilt3D>
            </MotionWrapper>
          ))}
        </div>
      </div>
    </section>
  );
}