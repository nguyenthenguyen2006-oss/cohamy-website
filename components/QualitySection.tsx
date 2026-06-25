"use client";

import { useTranslations } from "next-intl";
import { Leaf, Sparkles, Shield, Gift } from "lucide-react";
import { Tilt3D } from "@/components/ui/Tilt3D";
import { MotionWrapper } from "@/components/MotionWrapper";
import { DecorativeOrbs } from "@/components/DecorativeOrbs";

const items = [
  { key: "quality", icon: Leaf },
  { key: "craft", icon: Sparkles },
  { key: "natural", icon: Shield },
  { key: "gift", icon: Gift },
] as const;

export function QualitySection() {
  const t = useTranslations("home.whyUs");

  return (
    <section className="relative overflow-hidden border-y border-[#4A2418]/10 bg-white py-20">
      <DecorativeOrbs variant="cream" density="light" />
      <div className="relative mx-auto max-w-6xl px-6">
        <MotionWrapper className="text-center">
          <h2 className="type-display-md">{t("title")}</h2>
          <p className="type-body-lg mt-4 text-[#4A2418]/70">{t("subtitle")}</p>
          <div className="section-divider mx-auto mt-6 max-w-[100px]" />
        </MotionWrapper>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ key, icon: Icon }, index) => (
            <MotionWrapper key={key} delay={index * 0.1}>
              <Tilt3D intensity={10} className="h-full">
                <div className="card-shine group relative h-full overflow-hidden rounded-2xl border border-[#4A2418]/10 bg-[#FAF6EF] p-6 shadow-[0_12px_36px_-20px_rgba(42,18,12,0.2)] transition hover:border-[#D9A441]/30">
                  <div className="icon-3d mb-4 inline-flex rounded-xl border border-[#D9A441]/20 bg-white p-3 text-[#D9A441] shadow-sm">
                    <Icon size={24} />
                  </div>
                  <h3 className="mb-2 text-xl font-medium">{t(`${key}.title`)}</h3>
                  <p className="type-body-md text-[#4A2418]/70">{t(`${key}.description`)}</p>
                </div>
              </Tilt3D>
            </MotionWrapper>
          ))}
        </div>
      </div>
    </section>
  );
}