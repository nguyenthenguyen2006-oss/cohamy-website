"use client";

import { useLocale } from "next-intl";
import type { Locale } from "@/lib/types";
import { getAssetById } from "@/lib/assets/manifest";

const LOGO_PATH = "/images/logo/cohamy-brand-logo.png";

type BrandLogoProps = {
  className?: string;
  height?: number;
};

export function BrandLogo({ className = "", height = 40 }: BrandLogoProps) {
  const locale = useLocale() as Locale;
  const logoAsset = getAssetById("cohamy-logo");

  return (
    <img
      src={LOGO_PATH}
      alt={logoAsset?.alt[locale] ?? "Cohamy"}
      height={height}
      decoding="async"
      className={`block w-auto max-w-none object-contain ${className}`}
      style={{ height }}
    />
  );
}