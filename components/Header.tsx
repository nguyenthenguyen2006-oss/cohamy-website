"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Menu, X, ShoppingBag } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import styles from "@/components/home/CacaoHome.module.css";

const navItems = [
  { href: "/products" as const, label: "products" },
  { href: "/blog" as const, label: "blog" },
  { href: "/about" as const, label: "about" },
  { href: "/activities" as const, label: "activities" },
  { href: "/contact" as const, label: "contact" },
];

export function Header({orderIntakeEnabled = false}:{orderIntakeEnabled?:boolean}) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const mobileMenuButton = (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={isHome ? styles.menuButton : "md:hidden inline-flex min-h-11 min-w-11 items-center justify-center"}
      aria-label={open ? t("close") : t("menu")}
      aria-expanded={open}
      aria-controls="main-mobile-menu"
    >
      {open ? <X size={20} /> : <Menu size={20} />}
    </button>
  );

  return (
    <header className={isHome ? styles.header : "sticky top-0 z-50 bg-[#FAF6EF]/95 border-b border-[#4A2418]/10 backdrop-blur"}>
      <div className={isHome ? styles.headerInner : "max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-2"}>
        {isHome && mobileMenuButton}
        <Link href="/" className={isHome ? styles.logo : "inline-flex shrink-0 items-center leading-none [&>img]:h-7! sm:[&>img]:h-12!"} aria-label="Cohamy">
          {isHome ? <Image src="/images/home-cacao/logo.png" alt="Cohamy" width={925} height={267} sizes="(max-width: 600px) 142px, (max-width: 1100px) 170px, 211px" /> : <BrandLogo height={48} />}
        </Link>

        <nav aria-label={t("menu")} className={isHome ? styles.navigation : "hidden md:flex gap-9 text-base font-medium"}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-[#D9A441] transition">
              {t(item.label)}
            </Link>
          ))}
        </nav>

        <div className={isHome ? styles.headerActions : "flex shrink-0 items-center gap-1 sm:gap-3"}>
          <LocaleSwitcher className={isHome ? styles.localeSwitcher : undefined} />
          {orderIntakeEnabled && <Link href="/cart" className="inline-flex min-h-11 min-w-11 items-center justify-center" aria-label={t("cart")}><ShoppingBag size={20}/></Link>}
          {!isHome && mobileMenuButton}
        </div>
      </div>

      {open && (
        <nav id="main-mobile-menu" aria-label={t("menu")} className={isHome ? styles.mobileMenu : "md:hidden px-6 py-4 border-t text-sm bg-[#FAF6EF] space-y-3"}>
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
        </nav>
      )}
    </header>
  );
}
