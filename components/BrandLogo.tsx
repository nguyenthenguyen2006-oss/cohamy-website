"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import type { Locale } from "@/lib/types";
import { getAssetById } from "@/lib/assets/manifest";

const LOGO_PATH = "/images/logo/cohamy-logo.png";

type BrandLogoProps = {
  className?: string;
  height?: number;
};

export function BrandLogo({ className = "", height = 40 }: BrandLogoProps) {
  const locale = useLocale() as Locale;
  const logoAsset = getAssetById("cohamy-logo");
  const width = Math.round(height * 3.2);

  return (
    <Image
      src={LOGO_PATH}
      alt={logoAsset?.alt[locale] ?? "Cohamy"}
      width={width}
      height={height}
      priority
      className={`h-auto w-auto object-contain ${className}`}
      style={{ height, width: "auto", maxWidth: width }}
    />
  );
}