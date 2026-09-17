import type { MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getAllProductSlugs } from "@/lib/products";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

const staticPaths = [
  "/",
  "/products",
  "/blog",
  "/about",
  "/activities",
  "/contact",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const modified = process.env.SITE_CONTENT_UPDATED_AT;

  for (const locale of routing.locales) {
    for (const pathname of staticPaths) {
      entries.push({
        url: `${SITE_URL}${getPathname({ locale, href: pathname })}`,
        ...(modified && !Number.isNaN(Date.parse(modified)) ? { lastModified: new Date(modified).toISOString() } : {}),
        changeFrequency: pathname === "/" ? "daily" : "weekly",
        priority: pathname === "/" ? 1 : 0.8,
      });
    }
  }

  for (const { locale, slug } of getAllProductSlugs()) {
    entries.push({
      url: `${SITE_URL}${getPathname({
        locale,
        href: { pathname: "/products/[slug]", params: { slug } },
      })}`,
      ...(modified && !Number.isNaN(Date.parse(modified)) ? { lastModified: new Date(modified).toISOString() } : {}),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  return entries;
}
