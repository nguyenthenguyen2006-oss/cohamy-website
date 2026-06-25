"use client";

import { useTranslations } from "next-intl";
import { Quote } from "lucide-react";
import { Tilt3D } from "@/components/ui/Tilt3D";
import { MotionWrapper } from "@/components/MotionWrapper";
import { SectionHeading } from "@/components/SectionHeading";
import { DecorativeOrbs } from "@/components/DecorativeOrbs";

const REVIEWS = ["review1", "review2", "review3"] as const;

export function TestimonialsSection() {
  const t = useTranslations("home.testimonials");

  return (
    <section className="relative overflow-hidden bg-[#2A120C] py-20 text-[#FAF6EF]">
      <DecorativeOrbs variant="gold" density="rich" className="opacity-60" />
      <div className="relative mx-auto max-w-6xl px-6">
        <MotionWrapper className="mb-12">
          <SectionHeading
            title={t("title")}
            subtitle={t("subtitle")}
            align="center"
            className="[&_h2]:text-[#FAF6EF] [&_p]:text-[#FAF6EF]/70 [&_span]:text-[#D9A441]"
          />
        </MotionWrapper>

        <div className="grid gap-6 md:grid-cols-3">
          {REVIEWS.map((key, index) => (
            <MotionWrapper key={key} delay={index * 0.12}>
              <Tilt3D intensity={9} scale={1.03} className="h-full">
                <article className="card-shine relative h-full overflow-hidden rounded-2xl border border-[#FAF6EF]/10 bg-[#4A2418]/40 p-7 backdrop-blur-sm">
                  <Quote size={28} className="mb-4 text-[#D9A441]/80" />
                  <p className="type-body-md text-[#FAF6EF]/85">
                    &ldquo;{t(`${key}.text`)}&rdquo;
                  </p>
                  <div className="mt-6 border-t border-[#FAF6EF]/10 pt-4">
                    <div className="text-lg font-medium">{t(`${key}.author`)}</div>
                    <div className="text-sm text-[#FAF6EF]/55">{t(`${key}.role`)}</div>
                  </div>
                </article>
              </Tilt3D>
            </MotionWrapper>
          ))}
        </div>
      </div>
    </section>
  );
}