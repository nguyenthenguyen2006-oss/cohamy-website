"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Tilt3D } from "@/components/ui/Tilt3D";
import type { Locale, Product } from "@/lib/types";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("products");
  const tFeatured = useTranslations("home.featured");

  return (
    <Link
      href={{ pathname: "/products/[slug]", params: { slug: product.slug[locale] } }}
      className="group block h-full"
    >
      <Tilt3D intensity={11} scale={1.04} className="h-full">
        <div className="card-shine ring-glow relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#4A2418]/10 bg-white shadow-[0_12px_36px_-18px_rgba(42,18,12,0.22)]">
          <div className="relative aspect-[4/3.5] overflow-hidden bg-[#FFF4D8]">
            <Image
              src={product.images[0]}
              alt={product.name[locale]}
              fill
              className="object-cover transition duration-500 group-hover:scale-110"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#2A120C]/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            {product.featured && (
              <span className="absolute left-3 top-3 rounded-full bg-[#D9A441] px-3 py-1.5 text-sm font-medium text-white shadow-md">
                ★ {tFeatured("bestseller")}
              </span>
            )}
          </div>
          <div className="flex flex-1 flex-col p-6">
            <div className="flex items-start justify-between gap-2">
              <div className="line-clamp-1 text-lg font-medium">{product.name[locale]}</div>
              <div className="whitespace-nowrap rounded-full border border-[#D9A441]/30 bg-[#FFF4D8]/60 px-2.5 py-1 text-sm font-medium text-[#4A2418]/80">
                {t("contactForPrice")}
              </div>
            </div>
            <div className="type-body-md mt-2 line-clamp-2 text-[#4A2418]/70">
              {product.shortDescription[locale]}
            </div>
            <div className="mt-auto pt-4 text-sm text-[#D9A441] transition group-hover:translate-x-1 group-hover:underline md:text-base">
              {tFeatured("viewDetail")} →
            </div>
          </div>
        </div>
      </Tilt3D>
    </Link>
  );
}