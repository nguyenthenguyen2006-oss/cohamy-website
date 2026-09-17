import type { Metadata } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { CONTACT, getAddresses, getCompanyName } from "@/lib/contact";

const configuredSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://cohamy.vn";

export const SITE_URL = configuredSiteUrl.replace(/\/+$/u, "");

export const SITE_NAME = "Cohamy";

type HreflangHref = Parameters<typeof getPathname>[0]["href"];

export function buildLocalizedUrl(locale: Locale, pathname: HreflangHref): string {
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
  modifiedTime?: string;
  author?: string;
  canonicalUrl?: string;
  alternates?: Metadata["alternates"];
  robots?: Metadata["robots"];
  imageAlt?: string;
  keywords?: string[];
  social?: { facebook_title?: string; facebook_description?: string; facebook_image?: string; twitter_title?: string; twitter_description?: string; twitter_image?: string; twitter_card_type?: string };
}): Metadata {
  const {
    locale,
    pathname,
    title,
    description,
    image = "/images/products/cohamy-almond-chocolate-55g.jpg",
    type = "website",
    publishedTime,
    modifiedTime,
    author,
    canonicalUrl,
    alternates,
    robots,
    imageAlt,
    keywords,
    social,
  } = options;

  const url = buildLocalizedUrl(locale, pathname);
  const resolvedImage =
    image || "/images/products/cohamy-almond-chocolate-55g.jpg";
  const imageUrl = resolvedImage.startsWith("http")
    ? resolvedImage
    : `${SITE_URL}${resolvedImage}`;
  const resolvedAlternates =
    alternates ??
    {
      ...buildAlternates(pathname, locale),
      canonical: canonicalUrl || url,
    };

  return {
    title,
    description,
    keywords,
    robots,
    alternates: resolvedAlternates,
    openGraph: {
      title: social?.facebook_title || title,
      description: social?.facebook_description || description,
      url: canonicalUrl || url,
      siteName: SITE_NAME,
      locale,
      type,
      images: [{ url: social?.facebook_image || imageUrl, alt: imageAlt || title }],
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
      ...(author ? { authors: [author] } : {}),
    },
    twitter: {
      card: social?.twitter_card_type === "summary" ? "summary" : "summary_large_image",
      title: social?.twitter_title || title,
      description: social?.twitter_description || description,
      images: [social?.twitter_image || imageUrl],
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
  const addresses = getAddresses(locale);

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: getCompanyName(locale),
    alternateName: ["Cohamy", "Cohamy and Jamy Green", "Cohamy và Jamy Green"],
    legalName: getCompanyName(locale),
    url: SITE_URL,
    logo: `${SITE_URL}/images/logo/cohamy-brand-logo.png`,
    email: CONTACT.email,
    telephone: "+84981956111",
    address: [
      {
        "@type": "PostalAddress",
        name: "Hanoi Office",
        streetAddress: CONTACT.addresses.hanoi.vi,
        addressLocality: "Hà Nội",
        addressRegion: "Hà Nội",
        addressCountry: "VN",
      },
      {
        "@type": "PostalAddress",
        name: "Ho Chi Minh City Office",
        streetAddress: CONTACT.addresses.hcmc.vi,
        addressLocality: "Hồ Chí Minh",
        addressRegion: "Hồ Chí Minh",
        addressCountry: "VN",
      },
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: "+84981956111",
        contactType: "customer service",
        email: CONTACT.email,
        availableLanguage: routing.locales,
      },
    ],
    sameAs: [CONTACT.zaloUrl, CONTACT.mapsLink, CONTACT.mapsLinkHcmc].map(url => String(url)),
    description: `${addresses.hanoi} | ${addresses.hcmc}`,
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
  modifiedAt?: string;
  canonicalUrl?: string;
}) {
  const {
    locale,
    title,
    description,
    image,
    slug,
    author,
    publishedAt,
    modifiedAt,
    canonicalUrl,
  } = options;
  const url =
    canonicalUrl ||
    buildLocalizedUrl(locale, {
      pathname: "/blog/[slug]",
      params: { slug },
    });
  const resolvedImage =
    image || "/images/products/cohamy-almond-chocolate-55g.jpg";
  const imageUrl = resolvedImage.startsWith("http")
    ? resolvedImage
    : `${SITE_URL}${resolvedImage}`;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    image: imageUrl,
    datePublished: publishedAt,
    dateModified: modifiedAt || publishedAt,
    author: {
      "@type": "Person",
      name: author,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/images/logo/cohamy-brand-logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };
}

export function generateBlogBreadcrumbJsonLd(options: {
  locale: Locale;
  slug: string;
  title: string;
}) {
  const { locale, slug, title } = options;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: SITE_NAME,
        item: buildLocalizedUrl(locale, "/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: buildLocalizedUrl(locale, "/blog"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: title,
        item: buildLocalizedUrl(locale, {
          pathname: "/blog/[slug]",
          params: { slug },
        }),
      },
    ],
  };
}
