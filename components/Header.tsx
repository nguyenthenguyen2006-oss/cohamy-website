"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

const navItems = [
  { href: "/products" as const, label: "products" },
  { href: "/blog" as const, label: "blog" },
  { href: "/about" as const, label: "about" },
  { href: "/activities" as const, label: "activities" },
  { href: "/contact" as const, label: "contact" },
];

export function Header() {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#FAF6EF]/95 border-b border-[#4A2418]/10 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="inline-flex shrink-0 items-center leading-none" aria-label="Cohamy">
          <BrandLogo height={48} />
        </Link>

        <nav className="hidden md:flex gap-9 text-base font-medium">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-[#D9A441] transition">
              {t(item.label)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="md:hidden p-2"
            aria-label={t("menu")}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden px-6 py-4 border-t text-sm bg-[#FAF6EF] space-y-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block py-1"
            >
              {t(item.label)}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}