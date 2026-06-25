import type { Metadata } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { CONTACT, getAddress } from "@/lib/contact";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://cohamy.vn";

export const SITE_NAME = "Cohamy";

type HreflangHref = Parameters<typeof getPathname>[0]["href"];

function buildLocalizedUrl(locale: Locale, pathname: HreflangHref): string {
  const localizedPath = getPathname({ locale, href: pathname });
  return `${SITE_URL}${localizedPath}`;
}

export function buildAlternates(
  pathname: HreflangHref,
  locale: Locale,
): Metadata["alternates"] {
  const languages: Record<string, string> = {};

  for (const loc of routing.locales) {
    languages[loc] = buildLocalizedUrl(loc, pathname);
  }

  languages["x-default"] = buildLocalizedUrl(routing.defaultLocale, pathname);

  return {
    canonical: buildLocalizedUrl(locale, pathname),
    languages,
  };
}

export function generatePageMetadata(options: {
  locale: Locale;
  pathname: HreflangHref;
  title: string;
  description: string;
  image?: string;
  type?: "website" | "article";
  publishedTime?: string;
  keywords?: string[];
}): Metadata {
  const {
    locale,
    pathname,
    title,
    description,
    image = "/images/products/cohamy-almond-chocolate-55g.jpg",
    type = "website",
    publishedTime,
    keywords,
  } = options;

  const url = buildLocalizedUrl(locale, pathname);
  const imageUrl = image.startsWith("http") ? image : `${SITE_URL}${image}`;

  return {
    title,
    description,
    keywords,
    alternates: buildAlternates(pathname, locale),
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale,
      type,
      images: [{ url: imageUrl, alt: title }],
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export function generateProductJsonLd(options: {
  locale: Locale;
  name: string;
  description: string;
  image: string;
  slug: string;
  sku: string;
}) {
  const { locale, name, description, image, slug, sku } = options;
  const url = buildLocalizedUrl(locale, {
    pathname: "/products/[slug]",
    params: { slug },
  });
  const imageUrl = image.startsWith("http") ? image : `${SITE_URL}${image}`;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    image: imageUrl,
    sku,
    brand: {
      "@type": "Brand",
      name: SITE_NAME,
    },
    offers: {
      "@type": "Offer",
      url,
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: SITE_NAME,
      },
    },
  };
}

export function generateOrganizationJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: "Cohamy by Jamy Green",
    url: SITE_URL,
    logo: `${SITE_URL}/images/logo/cohamy-logo.jpg`,
    email: CONTACT.email,
    telephone: "+84981956111",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Tầng 3, tháp A, Tòa T608, Tôn Quang Phiệt",
      addressLocality: "Hà Nội",
      addressRegion: "Hà Nội",
      addressCountry: "VN",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: "+84981956111",
        contactType: "customer service",
        email: CONTACT.email,
        availableLanguage: routing.locales,
      },
    ],
    sameAs: [CONTACT.zaloUrl, CONTACT.mapsLink],
    description: getAddress(locale),
  };
}

export function generateArticleJsonLd(options: {
  locale: Locale;
  title: string;
  description: string;
  image: string;
  slug: string;
  author: string;
  publishedAt: string;
}) {
  const { locale, title, description, image, slug, author, publishedAt } =
    options;
  const url = buildLocalizedUrl(locale, {
    pathname: "/blog/[slug]",
    params: { slug },
  });
  const imageUrl = image.startsWith("http") ? image : `${SITE_URL}${image}`;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    image: imageUrl,
    datePublished: publishedAt,
    dateModified: publishedAt,
    author: {
      "@type": "Person",
      name: author,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/images/logo/cohamy-logo.jpg`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };
}