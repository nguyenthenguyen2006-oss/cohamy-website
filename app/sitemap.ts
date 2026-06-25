import type { MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getAllBlogSlugs } from "@/lib/blog";
import { getAllProductSlugs } from "@/lib/products";
import { SITE_URL } from "@/lib/seo";

const staticPaths = [
  "/",
  "/products",

  "/blog",
  "/about",
  "/activities",
  "/contact",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();

  for (const locale of routing.locales) {
    for (const pathname of staticPaths) {
      entries.push({
        url: `${SITE_URL}${getPathname({ locale, href: pathname })}`,
        lastModified: now,
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
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const { locale, slug } of getAllBlogSlugs()) {
    entries.push({
      url: `${SITE_URL}${getPathname({
        locale,
        href: { pathname: "/blog/[slug]", params: { slug } },
      })}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  return entries;
}