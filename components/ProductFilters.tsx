"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ProductFilterCategory } from "@/lib/products";
import type { ProductFlavor } from "@/lib/types";

export type CategoryFilter = ProductFilterCategory | "all";
export type FlavorFilter = ProductFlavor | "all";

export interface ProductFilterState {
  category: CategoryFilter;
  flavor: FlavorFilter;
}

interface ProductFiltersProps {
  value: ProductFilterState;
  onChange: (value: ProductFilterState) => void;
  className?: string;
  layout?: "horizontal" | "sidebar";
}

const categoryOptions: CategoryFilter[] = [
  "all",
  "chocolate-nuts",
  "dried-fruit",
  "gift-jar",
  "premium-pack",
];

const flavorOptions: FlavorFilter[] = [
  "all",
  "almond-chocolate",
  "almond-durian",
  "almond-matcha",
  "almond-strawberry",
  "almond-milk",
  "cashew-chocolate",
  "dried-mango",
  "mango-chocolate",
  "macadamia-chocolate",
  "gift-collection",
];

const categoryLabelKeys: Record<Exclude<CategoryFilter, "all">, string> = {
  "chocolate-nuts": "chocolateNuts",
  "dried-fruit": "driedFruit",
  "gift-jar": "giftJar",
  "premium-pack": "premiumPack",
};

const flavorLabelKeys: Partial<Record<Exclude<FlavorFilter, "all">, string>> = {
  "almond-chocolate": "original",
  "almond-matcha": "matcha",
  "almond-durian": "durian",
  "almond-strawberry": "strawberry",
  "almond-milk": "milk",
  "dried-mango": "mango",
  "mango-chocolate": "mango",
  "macadamia-chocolate": "macadamia",
};

export function ProductFilters({
  value,
  onChange,
  className,
  layout = "sidebar",
}: ProductFiltersProps) {
  const t = useTranslations("filters");

  function setCategory(category: CategoryFilter) {
    onChange({ ...value, category });
  }

  function setFlavor(flavor: FlavorFilter) {
    onChange({ ...value, flavor });
  }

  function clearFilters() {
    onChange({ category: "all", flavor: "all" });
  }

  const hasActiveFilters =
    value.category !== "all" || value.flavor !== "all";

  return (
    <div
      className={cn(
        layout === "sidebar" ? "space-y-6" : "flex flex-wrap items-end gap-6",
        className,
      )}
    >
      <div className={layout === "sidebar" ? "space-y-3" : "min-w-[12rem]"}>
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4A2418]/60">
          {t("category")}
        </h3>
        <div
          className={cn(
            "flex gap-2",
            layout === "sidebar" ? "flex-col" : "flex-wrap",
          )}
          role="group"
          aria-label={t("category")}
        >
          {categoryOptions.map((category) => {
            const label =
              category === "all"
                ? t("categories.all")
                : t(`categories.${categoryLabelKeys[category]}`);

            return (
              <button
                key={category}
                type="button"
                onClick={() => setCategory(category)}
                className={cn(
                  "rounded-full px-4 py-2 text-left text-sm transition-colors",
                  value.category === category
                    ? "bg-[#4A2418] text-[#FAF6EF]"
                    : "bg-[#FFF4D8] text-[#4A2418] hover:bg-[#FFF4D8]/80",
                )}
                aria-pressed={value.category === category}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={layout === "sidebar" ? "space-y-3" : "min-w-[12rem] flex-1"}>
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4A2418]/60">
          {t("flavor")}
        </h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("flavor")}>
          {flavorOptions.map((flavor) => {
            const label =
              flavor === "all"
                ? t("categories.all")
                : flavorLabelKeys[flavor]
                  ? t(`flavors.${flavorLabelKeys[flavor]}`)
                  : flavor.replace(/-/g, " ");

            return (
              <button
                key={flavor}
                type="button"
                onClick={() => setFlavor(flavor)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm capitalize transition-colors",
                  value.flavor === flavor
                    ? "bg-[#D9A441] text-[#2A120C]"
                    : "border border-[#4A2418]/12 bg-transparent text-[#4A2418] hover:border-[#4A2418]/25",
                )}
                aria-pressed={value.flavor === flavor}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {hasActiveFilters ? (
        <button
          type="button"
          onClick={clearFilters}
          className="text-sm font-medium text-[#4A2418]/70 underline-offset-4 hover:text-[#4A2418] hover:underline"
        >
          {t("clear")}
        </button>
      ) : null}
    </div>
  );
}