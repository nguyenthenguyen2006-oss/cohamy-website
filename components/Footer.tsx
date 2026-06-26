"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CONTACT, getAddresses, getCompanyName } from "@/lib/contact";
import type { Locale } from "@/lib/types";

export function Footer() {
  const t = useTranslations("footer");
  const nav = useTranslations("nav");
  const contact = useTranslations("contact.info");
  const locale = useLocale() as Locale;

  return (
    <footer className="bg-[#2A120C] text-[#FAF6EF] text-base pt-16 pb-10">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-4 gap-8">
        <div>
          <div className="font-serif text-3xl mb-2 tracking-tight">Cohamy</div>
          <p className="text-[#FAF6EF]/80 text-xs font-medium mb-1">{getCompanyName(locale)}</p>
          <div className="text-xs text-[#D9A441] mb-3">by Jamy Green</div>
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