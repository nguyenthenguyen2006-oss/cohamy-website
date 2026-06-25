"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
  size?: "sm" | "md";
}

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 99,
  className,
  size = "md",
}: QuantitySelectorProps) {
  const t = useTranslations("products");

  const buttonSize = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const textSize = size === "sm" ? "text-sm" : "text-base";

  function decrement() {
    onChange(Math.max(min, value - 1));
  }

  function increment() {
    onChange(Math.min(max, value + 1));
  }

  return (
    <div
      className={cn("inline-flex items-center gap-2", className)}
      role="group"
      aria-label={t("quantity")}
    >
      <button
        type="button"
        onClick={decrement}
        disabled={value <= min}
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-[#4A2418]/15 text-[#4A2418] transition-colors hover:border-[#4A2418]/30 hover:bg-[#FFF4D8] disabled:cursor-not-allowed disabled:opacity-40",
          buttonSize,
        )}
        aria-label={`${t("quantity")} -`}
      >
        <Minus size={size === "sm" ? 14 : 16} />
      </button>

      <span
        className={cn(
          "min-w-[2.5rem] text-center font-medium tabular-nums text-[#2A120C]",
          textSize,
        )}
        aria-live="polite"
      >
        {value}
      </span>

      <button
        type="button"
        onClick={increment}
        disabled={value >= max}
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-[#4A2418]/15 text-[#4A2418] transition-colors hover:border-[#4A2418]/30 hover:bg-[#FFF4D8] disabled:cursor-not-allowed disabled:opacity-40",
          buttonSize,
        )}
        aria-label={`${t("quantity")} +`}
      >
        <Plus size={size === "sm" ? 14 : 16} />
      </button>
    </div>
  );
}