"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/types";

const locales: { code: Locale; label: string }[] = [
  { code: "vi", label: "Tiếng Việt" },
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
  { code: "ko", label: "한국어" },
  { code: "ja", label: "日本語" },
];

interface LocaleSwitcherProps {
  variant?: "header" | "footer";
  className?: string;
}

export function LocaleSwitcher({
  variant = "header",
  className,
}: LocaleSwitcherProps) {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = locales.find((item) => item.code === locale) ?? locales[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function switchLocale(nextLocale: Locale) {
    router.replace(
      pathname as Parameters<typeof router.replace>[0],
      { locale: nextLocale },
    );
    setOpen(false);
  }

  if (variant === "footer") {
    return (
      <div className={cn("flex flex-wrap gap-3", className)}>
        {locales.map((item) => (
          <button
            key={item.code}
            type="button"
            onClick={() => switchLocale(item.code)}
            className={cn(
              "text-sm transition-colors",
              item.code === locale
                ? "text-[#D9A441]"
                : "text-[#FAF6EF]/60 hover:text-[#FAF6EF]",
            )}
            aria-current={item.code === locale ? "true" : undefined}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-[#4A2418]/15 px-3 text-sm text-[#4A2418] transition-colors hover:border-[#4A2418]/30"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("language")}
      >
        <Globe size={15} aria-hidden />
        <span className="hidden sm:inline">{current.label}</span>
        <span className="sm:hidden">{current.code.toUpperCase()}</span>
        <ChevronDown
          size={14}
          className={cn("transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={t("language")}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-[10rem] overflow-hidden rounded-xl border border-[#4A2418]/10 bg-[#FAF6EF] py-1 shadow-lg"
        >
          {locales.map((item) => (
            <li key={item.code} role="option" aria-selected={item.code === locale}>
              <button
                type="button"
                onClick={() => switchLocale(item.code)}
                className={cn(
                  "flex w-full items-center px-4 py-2.5 text-left text-sm transition-colors",
                  item.code === locale
                    ? "bg-[#FFF4D8] font-medium text-[#2A120C]"
                    : "text-[#4A2418]/80 hover:bg-[#FFF4D8]/60",
                )}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}