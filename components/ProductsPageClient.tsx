"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { filterProducts } from "@/lib/products";
import { ProductGrid } from "@/components/ProductGrid";
import {
  ProductFilters,
  type ProductFilterState,
} from "@/components/ProductFilters";

export function ProductsPageClient() {
  const t = useTranslations("products");
  const filtersT = useTranslations("filters");
  const [filters, setFilters] = useState<ProductFilterState>({
    category: "all",
    flavor: "all",
  });

  const filteredProducts = useMemo(() => {
    return filterProducts({
      category: filters.category === "all" ? undefined : filters.category,
      flavor: filters.flavor === "all" ? undefined : filters.flavor,
    });
  }, [filters]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="mb-2 font-[family-name:var(--font-playfair)] text-5xl tracking-tight text-[#2A120C]">
        {t("title")}
      </h1>
      <p className="mb-10 text-[#4A2418]/70">{t("subtitle")}</p>

      <div className="grid gap-10 lg:grid-cols-4">
        <aside className="lg:col-span-1">
          <ProductFilters value={filters} onChange={setFilters} />
        </aside>
        <div className="lg:col-span-3">
          <p className="mb-6 text-sm text-[#4A2418]/60">
            {filtersT("results", { count: filteredProducts.length })}
          </p>
          <ProductGrid
            products={filteredProducts}
            showHeading={false}
            emptyMessage={t("empty")}
          />
        </div>
      </div>
    </div>
  );
}