import type { Locale } from "@/lib/types";

type JsonLdType = "Product" | "Article" | "Organization" | "BreadcrumbList";

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface ProductJsonLdData {
  name: string;
  description: string;
  image: string[];
  sku: string;
  url: string;
}

interface ArticleJsonLdData {
  title: string;
  description: string;
  image: string;
  author: string;
  publishedAt: string;
  url: string;
}

interface OrganizationJsonLdData {
  name: string;
  description: string;
  url: string;
  logo: string;
  email?: string;
  telephone?: string;
}

interface SEOJsonLdProps {
  type: JsonLdType;
  locale?: Locale;
  product?: ProductJsonLdData;
  article?: ArticleJsonLdData;
  organization?: OrganizationJsonLdData;
  breadcrumbs?: BreadcrumbItem[];
}

function buildSchema(props: SEOJsonLdProps): Record<string, unknown> {
  const { type, locale = "vi" } = props;

  switch (type) {
    case "Product": {
      const p = props.product!;
      return {
        "@context": "https://schema.org",
        "@type": "Product",
        name: p.name,
        description: p.description,
        image: p.image,
        sku: p.sku,
        inLanguage: locale,
        offers: {
          "@type": "Offer",
          availability: "https://schema.org/InStock",
          url: p.url,
        },
      };
    }
    case "Article": {
      const a = props.article!;
      return {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: a.title,
        description: a.description,
        image: a.image,
        author: {
          "@type": "Person",
          name: a.author,
        },
        datePublished: a.publishedAt,
        inLanguage: locale,
        mainEntityOfPage: a.url,
      };
    }
    case "Organization": {
      const o = props.organization!;
      return {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: o.name,
        description: o.description,
        url: o.url,
        logo: o.logo,
        ...(o.email ? { email: o.email } : {}),
        ...(o.telephone ? { telephone: o.telephone } : {}),
      };
    }
    case "BreadcrumbList": {
      const items = props.breadcrumbs ?? [];
      return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      };
    }
    default:
      return {};
  }
}

export function SEOJsonLd(props: SEOJsonLdProps) {
  const schema = buildSchema(props);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}