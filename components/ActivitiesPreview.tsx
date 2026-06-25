"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { activities } from "@/data/activities";
import { getAssetById } from "@/lib/assets/manifest";
import { Tilt3D } from "@/components/ui/Tilt3D";
import { MotionWrapper } from "@/components/MotionWrapper";
import { DecorativeOrbs } from "@/components/DecorativeOrbs";
import type { Locale } from "@/lib/types";

interface ActivitiesPreviewProps {
  locale: Locale;
}

export function ActivitiesPreview({ locale }: ActivitiesPreviewProps) {
  const t = useTranslations("home.activities");
  const preview = activities.slice(0, 3);

  return (
    <section className="relative overflow-hidden py-20">
      <DecorativeOrbs variant="mixed" density="light" />
      <div className="relative mx-auto max-w-6xl px-6">
        <MotionWrapper className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="type-display-md">{t("title")}</h2>
            <p className="type-body-lg mt-3 text-[#4A2418]/70">{t("subtitle")}</p>
            <div className="section-divider mt-5 max-w-[100px]" />
          </div>
          <Link
            href="/activities"
            className="btn-3d hidden rounded-full border border-[#4A2418]/15 bg-white/70 px-5 py-2 text-sm text-[#D9A441] backdrop-blur-sm md:block"
          >
            {t("viewAll")} →
          </Link>
        </MotionWrapper>

        <div className="grid gap-5 md:grid-cols-3">
          {preview.map((activity, index) => {
            const asset = getAssetById(activity.imageId);
            const src = asset?.path ?? "/images/activities/team-factory.jpg";

            return (
              <MotionWrapper key={activity.id} delay={index * 0.1}>
                <Tilt3D intensity={10} className="h-full">
                  <article className="card-shine group overflow-hidden rounded-2xl border border-[#4A2418]/10 bg-white shadow-[0_14px_40px_-22px_rgba(42,18,12,0.25)]">
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <Image
                        src={src}
                        alt={activity.caption[locale]}
                        fill
                        className="object-cover transition duration-700 group-hover:scale-110"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#2A120C]/50 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                    </div>
                    <div className="line-clamp-2 p-4 text-sm text-[#4A2418]/80">
                      {activity.caption[locale]}
                    </div>
                  </article>
                </Tilt3D>
              </MotionWrapper>
            );
          })}
        </div>
      </div>
    </section>
  );
}