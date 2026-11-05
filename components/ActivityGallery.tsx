"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { activities } from "@/data/activities";
import { getAssetById } from "@/lib/assets/manifest";
import type { Locale } from "@/lib/types";

interface ActivityGalleryProps {
  locale: Locale;
}

const dimensions: Record<string, [number, number]> = {
  'team-factory': [2560, 1707],
  'exhibition-team-aodai': [2180, 1925],
  'exhibition-booth-visitors': [1920, 2560],
  'trade-show-interaction': [1920, 2560],
  'product-display-table': [1441, 2560],
  'exhibition-booth-side': [1920, 2560],
  'exhibition-booth-staff': [1920, 2060],
  'exhibition-booth-team': [1715, 1782],
};

export function ActivityGallery({ locale }: ActivityGalleryProps) {
  const t = useTranslations("activities");

  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-6" data-activity-gallery>
      {activities.map((activity) => {
        const asset = getAssetById(activity.imageId);
        const [width, height] = dimensions[activity.imageId] ?? [2560, 1707];
        return (
          <article
            key={activity.id}
            className="mb-6 break-inside-avoid bg-white rounded-xl overflow-hidden border border-[#4A2418]/10"
          >
            <Image
              src={asset?.path ?? "/images/activities/team-factory.jpg"}
              alt={activity.caption[locale]}
              width={width}
              height={height}
              sizes="(max-width: 640px) 90vw, (max-width: 1024px) 44vw, 360px"
              className="block h-auto w-full"
            />
            <div className="p-5">
              <p className="text-sm leading-relaxed">{activity.caption[locale]}</p>
              {activity.date && (
                <div className="text-xs text-[#73584D] mt-3">
                  {t("date")}: {activity.date}
                  {activity.location && ` • ${activity.location[locale]}`}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
