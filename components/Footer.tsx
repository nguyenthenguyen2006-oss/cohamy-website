"use client";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { Link, usePathname } from "@/i18n/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { CONTACT, getAddresses, getCompanyName } from "@/lib/contact";
import type { Locale } from "@/lib/types";
import styles from "@/components/home/CacaoHome.module.css";

export function Footer() {
  const t = useTranslations("footer");
  const nav = useTranslations("nav");
  const contact = useTranslations("contact.info");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const home = useTranslations("home.cacao");

  if (pathname === "/") {
    const addresses = getAddresses(locale);
    return (
      <footer className={styles.footer}>
        <div className={styles.footerMain}>
          <div className={styles.footerBrand}>
            <Link href="/" className={styles.logo} aria-label="Cohamy">
              <Image src="/images/home-cacao/logo.png" alt="Cohamy" width={925} height={267} sizes="(max-width: 600px) 142px, (max-width: 1100px) 170px, 211px" />
            </Link>
            <div className={styles.footerContact}>
              <p>{getCompanyName(locale)}</p>
              <a href={CONTACT.phoneTel}>{CONTACT.phoneDisplay}</a>
              <a href={CONTACT.emailMailto}>
                {CONTACT.email.split("@")[0]}<wbr />@{CONTACT.email.split("@")[1]}
              </a>
            </div>
          </div>
          <nav className={styles.footerNavigation} aria-label={t("quickLinks")}>
            <Link href="/products">{nav("products")}</Link>
            <Link href="/blog">{nav("blog")}</Link>
            <Link href="/about">{nav("about")}</Link>
            <Link href="/activities">{nav("activities")}</Link>
            <Link href="/contact">{nav("contact")}</Link>
            <Link href="/partners">{home("partnerCta")}</Link>
          </nav>
        </div>
        <div className={styles.footerBottom}>
          <p>{t("copyright", { year: new Date().getFullYear() })}</p>
          <details className={styles.footerDetails}>
            <summary>{contact("title")}</summary>
            <div className={styles.footerAddresses}>
              <div>
                <p>{contact("addressHanoi")}</p>
                <p>{addresses.hanoi}</p>
                <a href={CONTACT.mapsLink} target="_blank" rel="noopener noreferrer">{contact("openMapsHanoi")}</a>
              </div>
              <div>
                <p>{contact("addressHcmc")}</p>
                <p>{addresses.hcmc}</p>
                <a href={CONTACT.mapsLinkHcmc} target="_blank" rel="noopener noreferrer">{contact("openMapsHcmc")}</a>
              </div>
              <a href={CONTACT.zaloUrl} target="_blank" rel="noopener noreferrer">{contact("zalo")}: {CONTACT.phoneDisplay}</a>
            </div>
          </details>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-[#2A120C] text-[#FAF6EF] text-base pt-16 pb-10">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-4 gap-8">
        <div>
          <div className="mb-2 leading-none">
            <BrandLogo height={40} />
          </div>
          <p className="text-[#FAF6EF]/80 text-xs font-medium mb-1">{getCompanyName(locale)}</p>
          <div className="text-xs text-[#D9A441] mb-3">{t("brandTagline")}</div>
          <p className="text-[#FAF6EF]/70 text-xs leading-relaxed">{t("description")}</p>
        </div>
        <div>
          <div className="font-medium mb-3">{t("quickLinks")}</div>
          <Link href="/products" className="block text-[#FAF6EF]/70 hover:text-[#D9A441] mb-1">
            {nav("products")}
          </Link>
          <Link href="/blog" className="block text-[#FAF6EF]/70 hover:text-[#D9A441] mb-1">
            {nav("blog")}
          </Link>
          <Link href="/contact" className="block text-[#FAF6EF]/70 hover:text-[#D9A441]">
            {nav("contact")}
          </Link>
          <Link href="/partners" className="block text-[#FAF6EF]/70 hover:text-[#D9A441] mt-1">
            {{vi:'Dành cho đối tác',en:'For partners',zh:'合作伙伴',ko:'파트너 안내',ja:'パートナーの皆様へ'}[locale]}
          </Link>
        </div>
        <div>
          <div className="font-medium mb-3">{nav("about")}</div>
          <Link href="/about" className="block text-[#FAF6EF]/70 hover:text-[#D9A441] mb-1">
            {nav("about")}
          </Link>
          <Link href="/activities" className="block text-[#FAF6EF]/70 hover:text-[#D9A441]">
            {nav("activities")}
          </Link>
        </div>
        <div>
          <div className="font-medium mb-3">{nav("contact")}</div>
          <a
            href={CONTACT.emailMailto}
            className="block text-[#FAF6EF]/70 hover:text-[#D9A441] mb-1 break-all"
          >
            {CONTACT.email}
          </a>
          <a
            href={CONTACT.phoneTel}
            className="block text-[#FAF6EF]/70 hover:text-[#D9A441] mb-1"
          >
            {CONTACT.phoneDisplay}
          </a>
          <a
            href={CONTACT.zaloUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[#FAF6EF]/70 hover:text-[#D9A441] mb-2"
          >
            {contact("zalo")}: {CONTACT.phoneDisplay}
          </a>
          <p className="text-[#FAF6EF]/60 text-xs font-medium mb-0.5">{contact("addressHanoi")}</p>
          <p className="text-[#FAF6EF]/50 text-xs leading-relaxed mb-2">{getAddresses(locale).hanoi}</p>
          <p className="text-[#FAF6EF]/60 text-xs font-medium mb-0.5">{contact("addressHcmc")}</p>
          <p className="text-[#FAF6EF]/50 text-xs leading-relaxed mb-2">{getAddresses(locale).hcmc}</p>
          <a
            href={CONTACT.mapsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FAF6EF]/50 hover:text-[#D9A441] text-xs block mb-1"
          >
            {contact("openMapsHanoi")}
          </a>
          <a
            href={CONTACT.mapsLinkHcmc}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FAF6EF]/50 hover:text-[#D9A441] text-xs"
          >
            {contact("openMapsHcmc")}
          </a>
        </div>
      </div>
      <div className="text-center mt-12 text-xs text-[#FAF6EF]/50">
        {t("copyright", { year: new Date().getFullYear() })}
      </div>
    </footer>
  );
}
