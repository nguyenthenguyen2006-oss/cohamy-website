import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { ActivityGallery } from "@/components/ActivityGallery";
import { routing } from "@/i18n/routing";
import { generatePageMetadata } from "@/lib/seo";
import type { Locale } from "@/lib/types";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "seo.activities" });
  return generatePageMetadata({
    locale,
    pathname: "/activities",
    title: t("title"),
    description: t("description"),
  });
}

export default async function ActivitiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "activities" });

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="font-serif text-5xl tracking-tight mb-2">{t("title")}</h1>
      <p className="text-[#4A2418]/70 mb-10">{t("subtitle")}</p>
      <ActivityGallery locale={locale as Locale} />
    </div>
  );
}