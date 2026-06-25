"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { filterProducts as filterByLib } from "@/lib/products";
import { products as allProducts } from "@/data/products";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { SectionHeading } from "@/components/SectionHeading";
import { ProductCard } from "@/components/ProductCard";
import {
  ProductFilters,
  type ProductFilterState,
} from "@/components/ProductFilters";

interface ProductGridProps {
  /** When provided, renders a simple grid without built-in filters */
  products?: Product[];
  locale?: string;
  emptyMessage?: string;
  className?: string;
  showHeading?: boolean;
  showFilters?: boolean;
  initialFilters?: Partial<ProductFilterState>;
}

function applyFilters(filters: ProductFilterState): Product[] {
  return filterByLib({
    category: filters.category === "all" ? undefined : filters.category,
    flavor: filters.flavor === "all" ? undefined : filters.flavor,
  });
}

export function ProductGrid({
  products: productsProp,
  emptyMessage,
  className,
  showHeading = true,
  showFilters = true,
  initialFilters,
}: ProductGridProps) {
  const t = useTranslations("products");
  const filtersT = useTranslations("filters");
  const [filters, setFilters] = useState<ProductFilterState>({
    category: initialFilters?.category ?? "all",
    flavor: initialFilters?.flavor ?? "all",
  });

  const sourceProducts = productsProp ?? allProducts;
  const filteredProducts = useMemo(() => {
    if (productsProp) return productsProp;
    return applyFilters(filters);
  }, [productsProp, sourceProducts, filters]);

  const isStandalone = !productsProp;

  const grid = (
    <>
      {!isStandalone && filteredProducts.length === 0 ? (
        <div className="py-16 text-center text-[#4A2418]/70">
          {emptyMessage ?? t("empty")}
        </div>
      ) : isStandalone && filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#4A2418]/15 bg-[#FFF4D8]/40 px-6 py-16 text-center">
          <p className="font-[family-name:var(--font-playfair)] text-2xl text-[#2A120C]">
            {t("empty")}
          </p>
          <p className="mt-2 text-sm text-[#4A2418]/65">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </>
  );

  if (!isStandalone) {
    return <div className={className}>{grid}</div>;
  }

  return (
    <section className={cn("mx-auto max-w-7xl px-5 py-12 md:px-8", className)}>
      {showHeading ? (
        <SectionHeading
          title={t("title")}
          subtitle={t("subtitle")}
          className="mb-10"
        />
      ) : null}

      {showFilters ? (
        <div className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:gap-12">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <ProductFilters value={filters} onChange={setFilters} />
          </aside>
          <div>
            <p className="mb-6 text-sm text-[#4A2418]/60">
              {filtersT("results", { count: filteredProducts.length })}
            </p>
            {grid}
          </div>
        </div>
      ) : (
        grid
      )}
    </section>
  );
}