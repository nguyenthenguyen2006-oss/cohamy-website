import {
  products,
  getProductById,
  getProductBySlug,
  getFeaturedProducts,
  getProductsByCategory,
} from "@/data/products";
import type { Locale, Product, ProductFlavor } from "@/lib/types";

export type ProductFilterCategory =
  | "chocolate-nuts"
  | "dried-fruit"
  | "gift-jar"
  | "premium-pack";

export {
  products,
  getProductById,
  getProductBySlug,
  getFeaturedProducts,
  getProductsByCategory,
};

export function getProductSlug(product: Product, locale: Locale): string {
  return product.slug[locale];
}

export function matchesFilterCategory(
  product: Product,
  filter: ProductFilterCategory,
): boolean {
  switch (filter) {
    case "chocolate-nuts":
      return (
        product.category === "pouch" &&
        product.flavor !== "dried-mango" &&
        !product.tags.includes("dried-fruit")
      );
    case "dried-fruit":
      return (
        product.flavor === "dried-mango" ||
        product.tags.includes("dried-fruit") ||
        product.tags.includes("mango")
      );
    case "gift-jar":
      return product.category === "jar" || product.category === "gift";
    case "premium-pack":
      return (
        product.tags.includes("premium") ||
        product.category === "gift" ||
        product.price >= 98000
      );
    default:
      return true;
  }
}

export function filterProducts(options: {
  category?: ProductFilterCategory;
  flavor?: ProductFlavor;
  locale?: Locale;
}): Product[] {
  let result = [...products];

  if (options.category) {
    result = result.filter((p) => matchesFilterCategory(p, options.category!));
  }

  if (options.flavor) {
    result = result.filter((p) => p.flavor === options.flavor);
  }

  return result;
}

export function getRelatedProducts(product: Product): Product[] {
  return product.relatedProductIds
    .map((id) => getProductById(id))
    .filter((p): p is Product => Boolean(p));
}

export function getAllProductSlugs(): { locale: Locale; slug: string }[] {
  const locales: Locale[] = ["vi", "en", "zh", "ko", "ja"];
  return products.flatMap((product) =>
    locales.map((locale) => ({
      locale,
      slug: product.slug[locale],
    })),
  );
}