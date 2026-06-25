"use client";

import { useTranslations } from "next-intl";
import { Leaf, FlaskConical, ShieldCheck, Package } from "lucide-react";
import { Tilt3D } from "@/components/ui/Tilt3D";
import { MotionWrapper } from "@/components/MotionWrapper";
import { SectionHeading } from "@/components/SectionHeading";
import { DecorativeOrbs } from "@/components/DecorativeOrbs";

const STEPS = [
  { key: "step1", icon: Leaf, accent: "from-[#E8F0E4] to-white" },
  { key: "step2", icon: FlaskConical, accent: "from-[#FFF4D8] to-white" },
  { key: "step3", icon: ShieldCheck, accent: "from-[#FAF6EF] to-white" },
  { key: "step4", icon: Package, accent: "from-[#FFF4D8] to-[#FAF6EF]" },
] as const;

export function ProcessSection() {
  const t = useTranslations("home.process");

  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <DecorativeOrbs variant="cream" density="medium" />
      <div className="relative mx-auto max-w-6xl px-6">
        <MotionWrapper className="mb-12">
          <SectionHeading title={t("title")} subtitle={t("subtitle")} align="center" />
        </MotionWrapper>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ key, icon: Icon, accent }, index) => (
            <MotionWrapper key={key} delay={index * 0.1}>
              <Tilt3D intensity={12} className="h-full">
                <div
                  className={`relative h-full overflow-hidden rounded-2xl border border-[#4A2418]/10 bg-gradient-to-br ${accent} p-6 shadow-[0_16px_40px_-20px_rgba(42,18,12,0.25)]`}
                >
                  <span className="absolute -right-2 -top-3 font-serif text-7xl font-bold text-[#4A2418]/[0.06]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="icon-3d mb-5 inline-flex rounded-xl border border-[#D9A441]/25 bg-white/70 p-3 text-[#D9A441] shadow-sm">
                    <Icon size={22} />
                  </div>
                  <h3 className="text-xl font-medium text-[#2A120C]">{t(`${key}.title`)}</h3>
                  <p className="type-body-md mt-3 text-[#4A2418]/70">
                    {t(`${key}.description`)}
                  </p>
                </div>
              </Tilt3D>
            </MotionWrapper>
          ))}
        </div>
      </div>
    </section>
  );
}