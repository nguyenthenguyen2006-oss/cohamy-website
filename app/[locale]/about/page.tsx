import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { generatePageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "seo.about" });
  return generatePageMetadata({
    locale,
    pathname: "/about",
    title: t("title"),
    description: t("description"),
    image: "/images/activities/team-factory.jpg",
  });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "about" });

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="font-serif text-5xl tracking-tight mb-2">{t("title")}</h1>
      <p className="text-[#4A2418]/70 mb-12">{t("subtitle")}</p>

      <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
        <img
          src="/images/activities/team-factory.jpg"
          alt={t("story.title")}
          className="rounded-3xl shadow-lg w-full aspect-[4/3] object-cover"
        />
        <div>
          <h2 className="font-serif text-3xl mb-4">{t("story.title")}</h2>
          <p className="text-[#4A2418]/80 leading-relaxed">{t("story.description")}</p>
        </div>
      </div>

      <div className="p-8 bg-white rounded-2xl border border-[#4A2418]/10 mb-12">
        <h2 className="font-serif text-3xl mb-4">{t("company.title")}</h2>
        <div className="space-y-2 text-[#4A2418]/80">
          <p>{t("company.nameVi")}</p>
          <p>{t("company.nameEn")}</p>
          <p>{t("company.addressHanoi")}</p>
          <p>{t("company.addressHcmc")}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="p-8 bg-white rounded-2xl border border-[#4A2418]/10">
          <h3 className="font-serif text-2xl mb-3">{t("mission.title")}</h3>
          <p className="text-[#4A2418]/80">{t("mission.description")}</p>
        </div>
        <div className="p-8 bg-[#FFF4D8] rounded-2xl border border-[#4A2418]/10">
          <h3 className="font-serif text-2xl mb-3">{t("vision.title")}</h3>
          <p className="text-[#4A2418]/80">{t("vision.description")}</p>
        </div>
      </div>
    </div>
  );
}