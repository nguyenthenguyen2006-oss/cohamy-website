"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import type { Locale } from "@/lib/types";
import { getAssetById } from "@/lib/assets/manifest";

const LOGO_PATH = "/images/logo/cohamy-logo.png";
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
    <Image
      src={LOGO_PATH}
      alt={logoAsset?.alt[locale] ?? "Cohamy"}
      width={width}
      height={height}
      priority
      className={`block object-contain object-left ${className}`}
      style={{ height, width, maxWidth: width }}
    />
  );
}