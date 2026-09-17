import { CartView } from "@/components/CartView";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/types";
import type { Metadata } from "next";

// Cart contents belong to this browser, not the public product index.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return null;

  setRequestLocale(locale);
  return <CartView locale={locale as Locale} />;
}
