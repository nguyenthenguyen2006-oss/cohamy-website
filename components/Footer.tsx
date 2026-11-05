"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { CONTACT, getAddresses, getCompanyName } from "@/lib/contact";
import type { Locale } from "@/lib/types";
import { FooterPolicies } from "./FooterPolicies";
import styles from "./Footer.module.css";

const companyLabels = {
  vi: { title: "Thông tin doanh nghiệp", tax: "Mã số thuế", issued: "Ngày cấp lần đầu", authority: "Nơi cấp", address: "Địa chỉ trụ sở" },
  en: { title: "Company information", tax: "Tax code", issued: "First issued", authority: "Issuing authority", address: "Registered address" },
  zh: { title: "企业信息", tax: "税号", issued: "首次签发日期", authority: "签发机关", address: "注册地址" },
  ko: { title: "기업 정보", tax: "세금 코드", issued: "최초 발급일", authority: "발급 기관", address: "등록 주소" },
  ja: { title: "企業情報", tax: "税番号", issued: "初回発行日", authority: "発行機関", address: "登録住所" },
} as const;

export function Footer() {
  const t = useTranslations("footer");
  const nav = useTranslations("nav");
  const contact = useTranslations("contact.info");
  const locale = useLocale() as Locale;
  const labels = companyLabels[locale];
  const addresses = getAddresses(locale);
  const registration = CONTACT.registration;

  return <footer className={styles.footer} data-site-footer>
    <div className={styles.columns}>
      <div className={styles.brand} data-footer-column="brand">
        <Link href="/" aria-label="Cohamy" className={styles.logo}><BrandLogo height={56} /></Link>
        <p>{t("brandTagline")}</p>
        <p>{t("description")}</p>
      </div>

      <FooterPolicies />

      <section className={styles.contact} aria-labelledby="site-footer-contact" data-footer-column="contact">
        <h2 id="site-footer-contact">{nav("contact")}</h2>
        <a href={CONTACT.phoneTel}>{CONTACT.phoneDisplay}</a>
        <a href={CONTACT.emailMailto}>{CONTACT.email}</a>
        <a href={CONTACT.zaloUrl} target="_blank" rel="noopener noreferrer">{contact("zalo")}: {CONTACT.phoneDisplay}</a>
        <div className={styles.office}>
          <p className={styles.label}>{contact("addressHcmc")}</p>
          <p>{addresses.hcmc}</p>
        </div>
        <a href={CONTACT.mapsLink} target="_blank" rel="noopener noreferrer">{contact("openMapsHanoi")}</a>
        <a href={CONTACT.mapsLinkHcmc} target="_blank" rel="noopener noreferrer">{contact("openMapsHcmc")}</a>
      </section>

      <section className={styles.company} aria-labelledby="site-footer-company" data-footer-column="company">
        <h2 id="site-footer-company">{labels.title}</h2>
        <p className={styles.legalName}>{getCompanyName(locale)}</p>
        <dl>
          <div><dt>{labels.tax}:</dt><dd data-company-tax-id>{registration.taxId}</dd></div>
          <div><dt>{labels.issued}:</dt><dd><time dateTime={registration.firstIssuedAt}>{registration.firstIssuedDisplay}</time></dd></div>
          <div><dt>{labels.authority}:</dt><dd>{registration.issuingAuthority}</dd></div>
          <div className={styles.registeredAddress}><dt>{labels.address}:</dt><dd><address>{registration.registeredAddress}</address></dd></div>
        </dl>
      </section>
    </div>
    <div className={styles.bottom}><p>{t("copyright", { year: new Date().getFullYear() })}</p></div>
  </footer>;
}
