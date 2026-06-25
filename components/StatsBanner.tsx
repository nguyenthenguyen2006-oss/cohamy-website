"use client";

import { useTranslations } from "next-intl";
import { Tilt3D } from "@/components/ui/Tilt3D";
import { MotionWrapper } from "@/components/MotionWrapper";
import { DecorativeOrbs } from "@/components/DecorativeOrbs";

const STAT_KEYS = [
  { key: "products", value: "10+" },
  { key: "partners", value: "50+" },
  { key: "years", value: "5+" },
  { key: "customers", value: "1K+" },
] as const;

export function StatsBanner() {
  const t = useTranslations("home.about.stats");

  return (
    <section className="pattern-chocolate relative overflow-hidden bg-[#FFF4D8]/55 py-16 md:py-20">
      <DecorativeOrbs variant="gold" density="light" />
      <div className="relative mx-auto grid max-w-6xl grid-cols-2 gap-5 px-6 md:grid-cols-4 md:gap-7">
        {STAT_KEYS.map(({ key, value }, index) => (
          <MotionWrapper key={key} delay={index * 0.08}>
            <Tilt3D intensity={8} scale={1.05} className="h-full">
              <div className="card-shine relative h-full overflow-hidden rounded-2xl border border-[#4A2418]/10 bg-white/85 p-7 text-center shadow-[0_14px_44px_-20px_rgba(42,18,12,0.24)] backdrop-blur-sm md:p-8">
                <div className="type-display-sm font-serif text-[#2A120C] md:text-5xl">{value}</div>
                <div className="type-label mt-3 text-[#4A2418]/70">{t(key)}</div>
              </div>
            </Tilt3D>
          </MotionWrapper>
        ))}
      </div>
    </section>
  );
}