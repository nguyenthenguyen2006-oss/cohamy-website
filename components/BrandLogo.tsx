"use client";

import { useLocale } from "next-intl";
import type { Locale } from "@/lib/types";
import { getAssetById } from "@/lib/assets/manifest";

const LOGO_PATH = "/images/logo/cohamy-brand-logo.png";
const LOGO_ASPECT = 925 / 267;

type BrandLogoProps = {
  className?: string;
  height?: number;
};

export function BrandLogo({ className = "", height = 40 }: BrandLogoProps) {
  const locale = useLocale() as Locale;
  const logoAsset = getAssetById("cohamy-logo");
  const width = Math.round(height * LOGO_ASPECT);

  return (
    // Native img avoids Next.js /_next/image cache serving stale optimized logos.
    <img
      src={LOGO_PATH}
      alt={logoAsset?.alt[locale] ?? "Cohamy"}
      width={width}
      height={height}
      decoding="async"
      className={`block object-contain object-left ${className}`}
      style={{ height, width, maxWidth: width }}
    />
  );
}