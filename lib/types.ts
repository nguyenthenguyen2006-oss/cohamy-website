export const LOCALES = ["vi", "en", "zh", "ko", "ja"] as const;

export type Locale = (typeof LOCALES)[number];

export type LocalizedString = Record<Locale, string>;

export type LocalizedSlug = Record<Locale, string>;

export type ProductCategory = "pouch" | "jar" | "gift";

export type ProductFlavor =
  | "almond-chocolate"
  | "almond-durian"
  | "cashew-chocolate"
  | "dried-mango"
  | "mango-chocolate"
  | "macadamia-chocolate"
  | "almond-matcha"
  | "almond-strawberry"
  | "almond-milk"
  | "gift-collection";

export interface Product {
  id: string;
  slug: LocalizedSlug;
  name: LocalizedString;
  shortDescription: LocalizedString;
  description: LocalizedString;
  category: ProductCategory;
  flavor: ProductFlavor;
  weight: string;
  price: number;
  images: string[];
  ingredients: LocalizedString;
  storage: LocalizedString;
  tags: string[];
  featured: boolean;
  relatedProductIds: string[];
}

export type BlogCategory =
  | "chocolate"
  | "dried-fruit"
  | "gift-ideas"
  | "food-guide"
  | "brand-story";

export interface BlogPost {
  id: string;
  slug: LocalizedSlug;
  title: LocalizedString;
  excerpt: LocalizedString;
  content: LocalizedString;
  coverImage: string;
  author: string;
  publishedAt: string;
  category: BlogCategory;
  tags: string[];
  featured: boolean;
  relatedProductIds: string[];
  metaTitle?: LocalizedString;
  metaDescription?: LocalizedString;
}

export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
  name: LocalizedString;
  image: string;
}

export type AssetCategory =
  | "logo"
  | "product_pouch"
  | "product_jar"
  | "company_activity";

export interface AssetManifestItem {
  id: string;
  path: string;
  category: AssetCategory;
  alt: LocalizedString;
  productId?: string;
}

export interface Activity {
  id: string;
  imageId: string;
  caption: LocalizedString;
  date?: string;
  location?: LocalizedString;
}

export interface DesignTokens {
  colors: {
    chocolate: string;
    deepCocoa: string;
    gold: string;
    cream: string;
    warmWhite: string;
  };
  typography: {
    fontFamily: {
      sans: string;
      serif: string;
      display: string;
    };
    fontSize: Record<string, string>;
    fontWeight: Record<string, number>;
    lineHeight: Record<string, number>;
    letterSpacing: Record<string, string>;
  };
  spacing: Record<string, string>;
  radius: Record<string, string>;
  shadow: Record<string, string>;
  motion: {
    duration: Record<string, string>;
    easing: Record<string, string>;
  };
}