import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { CacaoHome } from "@/components/home/CacaoHome";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    return null;
  }

  setRequestLocale(locale);

  return <CacaoHome locale={locale} />;
}
