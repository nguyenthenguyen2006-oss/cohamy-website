"use client";

import { useTranslations } from "next-intl";
import { activities } from "@/data/activities";
import { getAssetById } from "@/lib/assets/manifest";
import type { Locale } from "@/lib/types";

interface ActivityGalleryProps {
  locale: Locale;
}

export function ActivityGallery({ locale }: ActivityGalleryProps) {
  const t = useTranslations("activities");

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {activities.map((activity) => {
        const asset = getAssetById(activity.imageId);
        return (
          <article
            key={activity.id}
            className="bg-white rounded-2xl overflow-hidden border border-[#4A2418]/10"
          >
            <img
              src={asset?.path ?? "/images/activities/team-factory.jpg"}
              alt={activity.caption[locale]}
              className="aspect-[4/3] object-cover w-full"
            />
            <div className="p-5">
              <p className="text-sm leading-relaxed">{activity.caption[locale]}</p>
              {activity.date && (
                <div className="text-xs text-[#4A2418]/50 mt-3">
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