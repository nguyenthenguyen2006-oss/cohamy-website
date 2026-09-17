import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { routing } from "@/i18n/routing";
import { generateOrganizationJsonLd, generatePageMetadata } from "@/lib/seo";
import { wordpressSiteSeo } from "@/lib/wordpress-site-seo";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    return {};
  }

  const t = await getTranslations({ locale, namespace: "seo.home" });

  return generatePageMetadata({
    locale,
    pathname: "/",
    title: t("title"),
    description: t("description"),
  });
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const organizationJsonLd = generateOrganizationJsonLd(locale);
  const siteSeo = await wordpressSiteSeo();
  if (siteSeo?.name) organizationJsonLd.name = siteSeo.name;
  if (siteSeo?.logo) organizationJsonLd.logo = siteSeo.logo;
  if (siteSeo?.same_as.length) organizationJsonLd.sameAs = siteSeo.same_as;
  const websiteJsonLd = {"@context":"https://schema.org","@type":"WebSite","@id":SITE_URL+"/#website",url:SITE_URL,name:siteSeo?.website_name || "Cohamy",description:siteSeo?.website_description || undefined,inLanguage:routing.locales};

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#FAF6EF] text-[#2A120C]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/</gu,"\\u003c") }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(websiteJsonLd).replace(/</gu,"\\u003c")}} />
      <NextIntlClientProvider messages={messages}>
        <Header orderIntakeEnabled={process.env.CRM_WEBSITE_ORDER_INTAKE === "true"} />
        <main className="flex-1">{children}</main>
        <Footer />
      </NextIntlClientProvider>
    </div>
  );
}
