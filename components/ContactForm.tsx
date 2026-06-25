"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Mail, MapPin, Phone } from "lucide-react";
import { CONTACT, getAddress } from "@/lib/contact";
import type { Locale } from "@/lib/types";

export function ContactForm() {
  const t = useTranslations("contact");
  const locale = useLocale() as Locale;
  const [done, setDone] = useState(false);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 grid lg:grid-cols-2 gap-12">
      <div>
        <h1 className="font-serif text-5xl tracking-tight mb-2">{t("title")}</h1>
        <p className="text-[#4A2418]/70 mb-10">{t("subtitle")}</p>

        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <Phone className="text-[#D9A441] mt-1 shrink-0" size={20} />
            <div>
              <div className="font-medium">{t("info.phone")}</div>
              <a
                href={CONTACT.phoneTel}
                className="text-[#4A2418]/70 hover:text-[#D9A441] transition"
              >
                {CONTACT.phoneDisplay}
              </a>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <Phone className="text-[#D9A441] mt-1 shrink-0" size={20} />
            <div>
              <div className="font-medium">{t("info.zalo")}</div>
              <a
                href={CONTACT.zaloUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#4A2418]/70 hover:text-[#D9A441] transition"
              >
                {CONTACT.phoneDisplay}
              </a>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <Mail className="text-[#D9A441] mt-1 shrink-0" size={20} />
            <div>
              <div className="font-medium">{t("info.email")}</div>
              <a
                href={CONTACT.emailMailto}
                className="text-[#4A2418]/70 hover:text-[#D9A441] transition break-all"
              >
                {CONTACT.email}
              </a>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <MapPin className="text-[#D9A441] mt-1 shrink-0" size={20} />
            <div>
              <div className="font-medium">{t("info.address")}</div>
              <p className="text-[#4A2418]/70 leading-relaxed">{getAddress(locale)}</p>
              <a
                href={CONTACT.mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-[#D9A441] hover:underline"
              >
                {t("info.openMaps")}
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-[#4A2418]/10 shadow-sm">
          <iframe
            title={t("info.mapTitle")}
            src={CONTACT.mapsEmbedUrl}
            className="h-56 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </div>

      <div>
        <h2 className="font-medium text-lg mb-6">{t("form.title")}</h2>
        {done ? (
          <div className="p-8 bg-[#FFF4D8] rounded-2xl text-center">
            {t("form.success")}
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setDone(true);
            }}
            className="space-y-4"
          >
            <input
              required
              placeholder={t("form.name")}
              className="w-full h-12 px-4 border rounded-xl bg-white"
            />
            <input
              required
              type="email"
              placeholder={t("form.email")}
              className="w-full h-12 px-4 border rounded-xl bg-white"
            />
            <input
              required
              placeholder={t("form.phone")}
              className="w-full h-12 px-4 border rounded-xl bg-white"
            />
            <select className="w-full h-12 px-4 border rounded-xl bg-white">
              <option>{t("subjects.general")}</option>
              <option>{t("subjects.order")}</option>
              <option>{t("subjects.gift")}</option>
              <option>{t("subjects.product")}</option>
            </select>
            <textarea
              required
              rows={5}
              placeholder={t("form.messagePlaceholder")}
              className="w-full p-4 border rounded-xl bg-white"
            />
            <button type="submit" className="btn-primary w-full h-14 rounded-2xl">
              {t("form.submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}