"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { href: "/products" as const, key: "products" },
  { href: "/blog" as const, key: "blog" },
  { href: "/about" as const, key: "about" },
  { href: "/activities" as const, key: "activities" },
  { href: "/contact" as const, key: "contact" },
] as const;

export function MobileMenu({ open, onClose }: MobileMenuProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (open) onClose();
    // Close menu after locale/path navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-[#2A120C]/40 transition-opacity duration-300 md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label={t("menu")}
        className={cn(
          "fixed inset-y-0 right-0 z-[70] flex w-[min(88vw,20rem)] flex-col border-l border-[#4A2418]/10 bg-[#FAF6EF] shadow-2xl transition-transform duration-300 ease-out md:hidden",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-[#4A2418]/10 px-5 py-4">
          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4A2418]/70">
            {t("menu")}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#4A2418] hover:bg-[#FFF4D8]"
            aria-label={t("close")}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-4 py-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl px-3 py-3 text-base font-medium text-[#2A120C] transition-colors hover:bg-[#FFF4D8]"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="border-t border-[#4A2418]/10 px-5 py-5">
          <p className="mb-3 text-xs uppercase tracking-[0.16em] text-[#4A2418]/60">
            {t("language")}
          </p>
          <LocaleSwitcher />
        </div>
      </aside>
    </>
  );
}